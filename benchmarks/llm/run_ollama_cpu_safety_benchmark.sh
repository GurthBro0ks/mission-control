#!/usr/bin/env bash
set -euo pipefail

EXPECTED_HOST="slimy-nuc1"
HOSTNAME_NOW="$(hostname)"
if [[ "${HOSTNAME_NOW}" != "${EXPECTED_HOST}" ]]; then
  echo "ABORT: expected host ${EXPECTED_HOST}, got ${HOSTNAME_NOW}" >&2
  exit 1
fi

MODELS=(
  "qwen2.5:0.5b"
  "qwen2.5:1.5b"
  "qwen2.5:3b"
  "llama3.2:1b"
)

OLLAMA_HOST="${OLLAMA_HOST:-http://127.0.0.1:11434}"
REQUEST_TIMEOUT_S="${REQUEST_TIMEOUT_S:-180}"
NUM_THREAD=3
NUM_CTX=2048
TEMPERATURE=0
NUM_PREDICT=96
PROMPT="Write exactly three short sentences on why production monitoring prevents outages."

MEM_MIN_KB=$(( 2621440 ))
MAX_SWAP_DELTA_KB=$(( 131072 ))

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
PROOF_DIR="/tmp/proof_nuc1_ollama_safety_bench_${STAMP}"
mkdir -p "${PROOF_DIR}"

RESULT_TXT="${PROOF_DIR}/RESULT.txt"
REPORT_MD="${PROOF_DIR}/REPORT.md"
SUMMARY_CSV="${PROOF_DIR}/summary.csv"
RAW_JSONL="${PROOF_DIR}/raw_runs.jsonl"
ENV_TXT="${PROOF_DIR}/environment.txt"
HOST_TXT="${PROOF_DIR}/host.txt"
MEM_BEFORE_TXT="${PROOF_DIR}/mem_before.txt"
MEM_AFTER_TXT="${PROOF_DIR}/mem_after.txt"
SWAP_BEFORE_TXT="${PROOF_DIR}/swap_before.txt"
SWAP_AFTER_TXT="${PROOF_DIR}/swap_after.txt"
VMSTAT_LIVE_TXT="${PROOF_DIR}/vmstat_live.txt"
TOP_BEFORE_TXT="${PROOF_DIR}/top_before.txt"
TOP_AFTER_TXT="${PROOF_DIR}/top_after.txt"
CMDLOG_TXT="${PROOF_DIR}/cmdlog.txt"
SUMMARY_JSON="${PROOF_DIR}/summary.json"
KILL_REASON_TXT="${PROOF_DIR}/kill_reason.txt"

exec > >(tee -a "${CMDLOG_TXT}") 2>&1

MONITOR_PID=""
STOP_REASON=""
ABORTED=0
HAS_ACCEPTABLE=0
BEST_MODEL=""
BEST_GEN_TPS="0"
HIGHEST_SAFE_MODEL=""
declare -A MODEL_GEN_SUM
declare -A MODEL_GEN_COUNT

get_memavailable_kb() {
  awk '/MemAvailable:/ {print $2; exit}' /proc/meminfo
}

get_swap_used_kb() {
  local swap_total_kb swap_free_kb
  swap_total_kb="$(awk '/SwapTotal:/ {print $2; exit}' /proc/meminfo)"
  swap_free_kb="$(awk '/SwapFree:/ {print $2; exit}' /proc/meminfo)"
  echo $(( swap_total_kb - swap_free_kb ))
}

set_stop_reason() {
  local reason="$1"
  STOP_REASON="${reason}"
  ABORTED=1
  echo "${reason}" > "${KILL_REASON_TXT}"
  echo "[safety] ${reason}"
}

start_monitor() {
  {
    echo "timestamp_utc memavailable_kb swap_used_kb vmstat(r,b,swpd,free,buff,cache,si,so,bi,bo,in,cs,us,sy,id,wa,st)"
    while true; do
      ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
      mem_kb="$(get_memavailable_kb)"
      swap_kb="$(get_swap_used_kb)"
      vm_line="$(vmstat -n 1 1 | tail -n 1 | awk '{$1=$1; print}')"
      echo "${ts} ${mem_kb} ${swap_kb} ${vm_line}"
      sleep 1
    done
  } >> "${VMSTAT_LIVE_TXT}" &
  MONITOR_PID="$!"
}

cleanup() {
  if [[ -n "${MONITOR_PID}" ]] && kill -0 "${MONITOR_PID}" >/dev/null 2>&1; then
    kill "${MONITOR_PID}" >/dev/null 2>&1 || true
    wait "${MONITOR_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

append_csv_row() {
  local host="$1"
  local model="$2"
  local run_type="$3"
  local run_index="$4"
  local total_duration_ns="$5"
  local load_duration_ns="$6"
  local prompt_eval_count="$7"
  local prompt_eval_duration_ns="$8"
  local eval_count="$9"
  local eval_duration_ns="${10}"
  local generation_tps="${11}"
  local prompt_tps="${12}"
  local end_to_end_tps="${13}"
  local mem_before_kb="${14}"
  local mem_after_kb="${15}"
  local swap_before_kb="${16}"
  local swap_after_kb="${17}"
  local status="${18}"
  local note="${19}"

  printf '%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s\n' \
    "${host}" "${model}" "${run_type}" "${run_index}" \
    "${total_duration_ns}" "${load_duration_ns}" "${prompt_eval_count}" "${prompt_eval_duration_ns}" \
    "${eval_count}" "${eval_duration_ns}" "${generation_tps}" "${prompt_tps}" "${end_to_end_tps}" \
    "${mem_before_kb}" "${mem_after_kb}" "${swap_before_kb}" "${swap_after_kb}" "${status}" "${note}" >> "${SUMMARY_CSV}"
}

json_number_or_fail() {
  local key="$1"
  local source_json="$2"
  local out
  if ! out="$(jq -er --arg k "${key}" '.[$k]' <<< "${source_json}" 2>/dev/null)"; then
    echo ""
    return 1
  fi
  if [[ ! "${out}" =~ ^[0-9]+$ ]]; then
    echo ""
    return 1
  fi
  echo "${out}"
}

check_memory_swap_gate() {
  local mem_now_kb="$1"
  local swap_now_kb="$2"
  local baseline_swap_kb="$3"

  if (( mem_now_kb < MEM_MIN_KB )); then
    set_stop_reason "ABORT_MEMAVAILABLE_BELOW_2_5GIB memavailable_kb=${mem_now_kb}"
    return 1
  fi

  if (( (swap_now_kb - baseline_swap_kb) > MAX_SWAP_DELTA_KB )); then
    set_stop_reason "ABORT_SWAP_INCREASE_GT_128MIB baseline_swap_kb=${baseline_swap_kb} current_swap_kb=${swap_now_kb}"
    return 1
  fi

  return 0
}

run_one() {
  local model="$1"
  local run_type="$2"
  local run_index="$3"
  local baseline_swap_kb="$4"
  local model_size="$5"

  local mem_before_kb swap_before_kb mem_after_kb swap_after_kb
  mem_before_kb="$(get_memavailable_kb)"
  swap_before_kb="$(get_swap_used_kb)"

  if ! check_memory_swap_gate "${mem_before_kb}" "${swap_before_kb}" "${baseline_swap_kb}"; then
    append_csv_row "${HOSTNAME_NOW}" "${model}" "${run_type}" "${run_index}" "0" "0" "0" "0" "0" "0" "0" "0" "0" "${mem_before_kb}" "${mem_before_kb}" "${swap_before_kb}" "${swap_before_kb}" "ABORT_SAFETY_GATE" "pre_run_memory_or_swap_gate"
    return 1
  fi

  local payload
  payload="$(jq -nc \
    --arg model "${model}" \
    --arg prompt "${PROMPT}" \
    --argjson num_thread "${NUM_THREAD}" \
    --argjson num_ctx "${NUM_CTX}" \
    --argjson temperature "${TEMPERATURE}" \
    --argjson num_predict "${NUM_PREDICT}" \
    '{model:$model,prompt:$prompt,stream:false,options:{num_thread:$num_thread,num_ctx:$num_ctx,temperature:$temperature,num_predict:$num_predict}}')"

  local response curl_exit
  set +e
  response="$(curl -sS --max-time "${REQUEST_TIMEOUT_S}" -H 'Content-Type: application/json' "${OLLAMA_HOST}/api/generate" -d "${payload}")"
  curl_exit=$?
  set -e

  if (( curl_exit != 0 )); then
    set_stop_reason "ABORT_REQUEST_TIMEOUT_OR_HUNG model=${model} run_type=${run_type} run_index=${run_index} curl_exit=${curl_exit}"
    mem_after_kb="$(get_memavailable_kb)"
    swap_after_kb="$(get_swap_used_kb)"
    append_csv_row "${HOSTNAME_NOW}" "${model}" "${run_type}" "${run_index}" "0" "0" "0" "0" "0" "0" "0" "0" "0" "${mem_before_kb}" "${mem_after_kb}" "${swap_before_kb}" "${swap_after_kb}" "ABORT_TIMEOUT" "curl_nonzero"
    return 1
  fi

  if [[ -z "${response}" ]]; then
    set_stop_reason "ABORT_EMPTY_RESPONSE model=${model} run_type=${run_type} run_index=${run_index}"
    mem_after_kb="$(get_memavailable_kb)"
    swap_after_kb="$(get_swap_used_kb)"
    append_csv_row "${HOSTNAME_NOW}" "${model}" "${run_type}" "${run_index}" "0" "0" "0" "0" "0" "0" "0" "0" "0" "${mem_before_kb}" "${mem_after_kb}" "${swap_before_kb}" "${swap_after_kb}" "ABORT_EMPTY_RESPONSE" "empty_body"
    return 1
  fi

  if ! jq -e 'type=="object"' >/dev/null 2>&1 <<< "${response}"; then
    set_stop_reason "ABORT_MALFORMED_JSON model=${model} run_type=${run_type} run_index=${run_index}"
    mem_after_kb="$(get_memavailable_kb)"
    swap_after_kb="$(get_swap_used_kb)"
    append_csv_row "${HOSTNAME_NOW}" "${model}" "${run_type}" "${run_index}" "0" "0" "0" "0" "0" "0" "0" "0" "0" "${mem_before_kb}" "${mem_after_kb}" "${swap_before_kb}" "${swap_after_kb}" "ABORT_MALFORMED_JSON" "invalid_json"
    return 1
  fi

  if jq -e '.error != null and (.error|tostring|length>0)' >/dev/null 2>&1 <<< "${response}"; then
    local api_err
    api_err="$(jq -r '.error|tostring' <<< "${response}")"
    set_stop_reason "ABORT_OLLAMA_ERROR model=${model} run_type=${run_type} run_index=${run_index} error=${api_err}"
    mem_after_kb="$(get_memavailable_kb)"
    swap_after_kb="$(get_swap_used_kb)"
    append_csv_row "${HOSTNAME_NOW}" "${model}" "${run_type}" "${run_index}" "0" "0" "0" "0" "0" "0" "0" "0" "0" "${mem_before_kb}" "${mem_after_kb}" "${swap_before_kb}" "${swap_after_kb}" "ABORT_OLLAMA_ERROR" "api_error"
    return 1
  fi

  if ! jq -e '.done == true' >/dev/null 2>&1 <<< "${response}"; then
    set_stop_reason "ABORT_REQUEST_NOT_DONE model=${model} run_type=${run_type} run_index=${run_index}"
    mem_after_kb="$(get_memavailable_kb)"
    swap_after_kb="$(get_swap_used_kb)"
    append_csv_row "${HOSTNAME_NOW}" "${model}" "${run_type}" "${run_index}" "0" "0" "0" "0" "0" "0" "0" "0" "0" "${mem_before_kb}" "${mem_after_kb}" "${swap_before_kb}" "${swap_after_kb}" "ABORT_NOT_DONE" "done_false"
    return 1
  fi

  local total_duration_ns load_duration_ns prompt_eval_count prompt_eval_duration_ns eval_count eval_duration_ns
  if ! total_duration_ns="$(json_number_or_fail "total_duration" "${response}")"; then
    set_stop_reason "ABORT_METRIC_PARSE_FAIL total_duration model=${model} run_type=${run_type} run_index=${run_index}"
    return 1
  fi
  if ! load_duration_ns="$(json_number_or_fail "load_duration" "${response}")"; then
    set_stop_reason "ABORT_METRIC_PARSE_FAIL load_duration model=${model} run_type=${run_type} run_index=${run_index}"
    return 1
  fi
  if ! prompt_eval_count="$(json_number_or_fail "prompt_eval_count" "${response}")"; then
    set_stop_reason "ABORT_METRIC_PARSE_FAIL prompt_eval_count model=${model} run_type=${run_type} run_index=${run_index}"
    return 1
  fi
  if ! prompt_eval_duration_ns="$(json_number_or_fail "prompt_eval_duration" "${response}")"; then
    set_stop_reason "ABORT_METRIC_PARSE_FAIL prompt_eval_duration model=${model} run_type=${run_type} run_index=${run_index}"
    return 1
  fi
  if ! eval_count="$(json_number_or_fail "eval_count" "${response}")"; then
    set_stop_reason "ABORT_METRIC_PARSE_FAIL eval_count model=${model} run_type=${run_type} run_index=${run_index}"
    return 1
  fi
  if ! eval_duration_ns="$(json_number_or_fail "eval_duration" "${response}")"; then
    set_stop_reason "ABORT_METRIC_PARSE_FAIL eval_duration model=${model} run_type=${run_type} run_index=${run_index}"
    return 1
  fi

  if (( total_duration_ns <= 0 || eval_duration_ns <= 0 || eval_count <= 0 )); then
    set_stop_reason "ABORT_METRIC_COMPUTE_FAIL nonpositive_duration_or_count model=${model} run_type=${run_type} run_index=${run_index}"
    return 1
  fi

  local generation_tps prompt_tps end_to_end_tps
  generation_tps="$(awk -v c="${eval_count}" -v ns="${eval_duration_ns}" 'BEGIN {printf "%.3f", c/(ns/1e9)}')"
  if (( prompt_eval_duration_ns > 0 && prompt_eval_count > 0 )); then
    prompt_tps="$(awk -v c="${prompt_eval_count}" -v ns="${prompt_eval_duration_ns}" 'BEGIN {printf "%.3f", c/(ns/1e9)}')"
  else
    prompt_tps="0.000"
  fi
  end_to_end_tps="$(awk -v c="${eval_count}" -v ns="${total_duration_ns}" 'BEGIN {printf "%.3f", c/(ns/1e9)}')"

  mem_after_kb="$(get_memavailable_kb)"
  swap_after_kb="$(get_swap_used_kb)"

  jq -nc \
    --arg timestamp_utc "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg host "${HOSTNAME_NOW}" \
    --arg model "${model}" \
    --arg model_size "${model_size}" \
    --arg run_type "${run_type}" \
    --argjson run_index "${run_index}" \
    --argjson memavailable_kb_before "${mem_before_kb}" \
    --argjson memavailable_kb_after "${mem_after_kb}" \
    --argjson swap_used_kb_before "${swap_before_kb}" \
    --argjson swap_used_kb_after "${swap_after_kb}" \
    --argjson generation_tps "${generation_tps}" \
    --argjson prompt_tps "${prompt_tps}" \
    --argjson end_to_end_tps "${end_to_end_tps}" \
    --argjson response "${response}" \
    '{timestamp_utc:$timestamp_utc,host:$host,model:$model,model_size:$model_size,run_type:$run_type,run_index:$run_index,memavailable_kb_before:$memavailable_kb_before,memavailable_kb_after:$memavailable_kb_after,swap_used_kb_before:$swap_used_kb_before,swap_used_kb_after:$swap_used_kb_after,generation_tps:$generation_tps,prompt_tps:$prompt_tps,end_to_end_tps:$end_to_end_tps,response:$response}' >> "${RAW_JSONL}"

  append_csv_row "${HOSTNAME_NOW}" "${model}" "${run_type}" "${run_index}" \
    "${total_duration_ns}" "${load_duration_ns}" "${prompt_eval_count}" "${prompt_eval_duration_ns}" \
    "${eval_count}" "${eval_duration_ns}" "${generation_tps}" "${prompt_tps}" "${end_to_end_tps}" \
    "${mem_before_kb}" "${mem_after_kb}" "${swap_before_kb}" "${swap_after_kb}" "OK" "${run_type}"

  if ! check_memory_swap_gate "${mem_after_kb}" "${swap_after_kb}" "${baseline_swap_kb}"; then
    return 1
  fi

  if [[ "${run_type}" == "measured" ]]; then
    if awk -v g="${generation_tps}" 'BEGIN {exit !(g < 5.0)}'; then
      set_stop_reason "ABORT_GEN_TPS_BELOW_5 model=${model} run_index=${run_index} generation_tps=${generation_tps}"
      return 1
    fi
  fi

  echo "[bench] ${model} ${run_type}#${run_index} gen_tps=${generation_tps} prompt_tps=${prompt_tps} end_to_end_tps=${end_to_end_tps}"
  return 0
}

{
  echo "host,model,run_type,run_index,total_duration_ns,load_duration_ns,prompt_eval_count,prompt_eval_duration_ns,eval_count,eval_duration_ns,generation_tps,prompt_tps,end_to_end_tps,memavailable_kb_before,memavailable_kb_after,swap_used_kb_before,swap_used_kb_after,status,note"
} > "${SUMMARY_CSV}"

: > "${RAW_JSONL}"

{
  echo "timestamp_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "hostname=${HOSTNAME_NOW}"
  echo "uname=$(uname -a)"
  echo "ollama_version=$(ollama --version)"
  echo "ollama_host=${OLLAMA_HOST}"
  echo "num_thread=${NUM_THREAD}"
  echo "num_ctx=${NUM_CTX}"
  echo "temperature=${TEMPERATURE}"
  echo "num_predict=${NUM_PREDICT}"
  echo "request_timeout_s=${REQUEST_TIMEOUT_S}"
} > "${ENV_TXT}"

{
  echo "hostname=$(hostname)"
  hostnamectl 2>/dev/null || true
  uname -a
} > "${HOST_TXT}"

{
  free -h
  grep MemAvailable /proc/meminfo
} > "${MEM_BEFORE_TXT}"

{
  swapon --show || true
  echo "swap_used_kb=$(get_swap_used_kb)"
} > "${SWAP_BEFORE_TXT}"

vmstat 1 3 | tail -n +1 > /dev/null

top -b -n 1 > "${TOP_BEFORE_TXT}"

BASELINE_MEM_KB="$(get_memavailable_kb)"
BASELINE_SWAP_USED_KB="$(get_swap_used_kb)"

echo "baseline_memavailable_kb=${BASELINE_MEM_KB}"
echo "baseline_swap_used_kb=${BASELINE_SWAP_USED_KB}"

start_monitor

if ! check_memory_swap_gate "${BASELINE_MEM_KB}" "${BASELINE_SWAP_USED_KB}" "${BASELINE_SWAP_USED_KB}"; then
  :
fi

for model in "${MODELS[@]}"; do
  if (( ABORTED == 1 )); then
    break
  fi

  model_size="$(ollama list | awk -v m="${model}" '$1==m {print $3" "$4}')"
  if ! ollama show "${model}" >/dev/null 2>&1; then
    echo "[bench] SKIP_MISSING_MODEL ${model}"
    append_csv_row "${HOSTNAME_NOW}" "${model}" "none" "0" "0" "0" "0" "0" "0" "0" "0" "0" "0" "$(get_memavailable_kb)" "$(get_memavailable_kb)" "$(get_swap_used_kb)" "$(get_swap_used_kb)" "SKIP_MISSING_MODEL" "model_missing"
    jq -nc --arg timestamp_utc "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg host "${HOSTNAME_NOW}" --arg model "${model}" '{timestamp_utc:$timestamp_utc,host:$host,model:$model,status:"SKIP_MISSING_MODEL"}' >> "${RAW_JSONL}"
    continue
  fi

  echo "[bench] model=${model} size=${model_size}"

  model_is_safe=1
  model_measured_ok=0

  if ! run_one "${model}" "warmup" "1" "${BASELINE_SWAP_USED_KB}" "${model_size}"; then
    model_is_safe=0
  fi

  for run_index in 1 2; do
    if (( ABORTED == 1 )); then
      model_is_safe=0
      break
    fi

    if ! run_one "${model}" "measured" "${run_index}" "${BASELINE_SWAP_USED_KB}" "${model_size}"; then
      model_is_safe=0
      break
    fi

    gen_tps_last="$(tail -n 1 "${SUMMARY_CSV}" | awk -F',' '{print $11}')"
    if awk -v g="${gen_tps_last}" 'BEGIN {exit !(g >= 5.0)}'; then
      HAS_ACCEPTABLE=1
      model_measured_ok=1
      MODEL_GEN_SUM["${model}"]="$(awk -v a="${MODEL_GEN_SUM[${model}]:-0}" -v b="${gen_tps_last}" 'BEGIN {printf "%.6f", a+b}')"
      MODEL_GEN_COUNT["${model}"]="$(( ${MODEL_GEN_COUNT[${model}]:-0} + 1 ))"
    fi
  done

  if (( model_is_safe == 1 && model_measured_ok == 1 )); then
    HIGHEST_SAFE_MODEL="${model}"
  fi

  if (( ABORTED == 1 )); then
    break
  fi

done

cleanup
MONITOR_PID=""

{
  free -h
  grep MemAvailable /proc/meminfo
} > "${MEM_AFTER_TXT}"

{
  swapon --show || true
  echo "swap_used_kb=$(get_swap_used_kb)"
} > "${SWAP_AFTER_TXT}"

top -b -n 1 > "${TOP_AFTER_TXT}"

if (( HAS_ACCEPTABLE == 1 )); then
  RESULT="PASS"
else
  RESULT="FAIL"
fi

for model in "${!MODEL_GEN_COUNT[@]}"; do
  count="${MODEL_GEN_COUNT[$model]}"
  if (( count > 0 )); then
    avg="$(awk -v sum="${MODEL_GEN_SUM[$model]}" -v c="${count}" 'BEGIN {printf "%.3f", sum/c}')"
    if [[ -z "${BEST_MODEL}" ]] || awk -v a="${avg}" -v b="${BEST_GEN_TPS}" 'BEGIN {exit !(a > b)}'; then
      BEST_MODEL="${model}"
      BEST_GEN_TPS="${avg}"
    fi
  fi
done

if [[ -z "${BEST_MODEL}" ]]; then
  BEST_MODEL="none"
  BEST_GEN_TPS="0.000"
fi

if [[ -z "${HIGHEST_SAFE_MODEL}" ]]; then
  HIGHEST_SAFE_MODEL="none"
fi

if [[ -z "${STOP_REASON}" ]]; then
  STOP_REASON="COMPLETED_ALL_SAFE_MODELS"
fi

echo "RESULT=${RESULT}" > "${RESULT_TXT}"

action_label="KEEP"
if [[ "${BEST_MODEL}" == "none" ]]; then
  action_label="REJECT"
elif awk -v g="${BEST_GEN_TPS}" 'BEGIN {exit !(g < 7.0)}'; then
  action_label="BORDERLINE"
fi

jq -nc \
  --arg result "${RESULT}" \
  --arg proof_dir "${PROOF_DIR}" \
  --arg host "${HOSTNAME_NOW}" \
  --arg best_model_for_nuc1 "${BEST_MODEL}" \
  --argjson best_generation_tps "${BEST_GEN_TPS}" \
  --arg highest_model_that_stayed_safe "${HIGHEST_SAFE_MODEL}" \
  --arg stop_reason "${STOP_REASON}" \
  --arg recommendation "${action_label}" \
  '{result:$result,proof_dir:$proof_dir,host:$host,best_model_for_nuc1:$best_model_for_nuc1,best_generation_tps:$best_generation_tps,highest_model_that_stayed_safe:$highest_model_that_stayed_safe,stop_reason:$stop_reason,recommendation:$recommendation}' > "${SUMMARY_JSON}"

{
  echo "# NUC1 Ollama CPU Safety Benchmark"
  echo
  echo "## Script"
  echo "- /home/slimy/mission-control/benchmarks/llm/run_ollama_cpu_safety_benchmark.sh"
  echo
  echo "## Host Identity"
  echo "- Host: ${HOSTNAME_NOW}"
  echo "- Uname: $(uname -a)"
  echo "- Ollama: $(ollama --version)"
  echo
  echo "## Benchmark Settings"
  echo "- Models (ordered): qwen2.5:0.5b, qwen2.5:1.5b, qwen2.5:3b, llama3.2:1b"
  echo "- Warm-up: 1 run/model"
  echo "- Measured: 2 runs/model"
  echo "- num_thread=${NUM_THREAD}, num_ctx=${NUM_CTX}, temperature=${TEMPERATURE}, num_predict=${NUM_PREDICT}"
  echo "- prompt: ${PROMPT}"
  echo "- timeout per request: ${REQUEST_TIMEOUT_S}s"
  echo
  echo "## Baseline Memory/Swap"
  echo "- baseline_memavailable_kb=${BASELINE_MEM_KB}"
  echo "- baseline_swap_used_kb=${BASELINE_SWAP_USED_KB}"
  echo
  echo "## Per-model measured throughput"
  awk -F',' 'NR>1 && $3=="measured" && $18=="OK" {sumg[$2]+=$11; sump[$2]+=$12; sume[$2]+=$13; n[$2]++} END {for (m in n) printf "- %s: generation_tps=%.3f prompt_tps=%.3f end_to_end_tps=%.3f (%d measured runs)\n", m, sumg[m]/n[m], sump[m]/n[m], sume[m]/n[m], n[m]}' "${SUMMARY_CSV}" | sort
  echo
  echo "## Model Decision"
  echo "- best NUC1 default for responsiveness: ${BEST_MODEL} (${BEST_GEN_TPS} gen tok/s avg measured)"
  echo "- highest acceptable upper limit: ${HIGHEST_SAFE_MODEL}"
  echo
  echo "## Stop Reason"
  echo "- ${STOP_REASON}"
  echo
  echo "## Final Recommendation"
  echo "- ${action_label}"
} > "${REPORT_MD}"

echo "[bench] RESULT=${RESULT}"
echo "[bench] PROOF_DIR=${PROOF_DIR}"
echo "[bench] best_model_for_nuc1=${BEST_MODEL}"
echo "[bench] best_generation_tps=${BEST_GEN_TPS}"
echo "[bench] highest_model_that_stayed_safe=${HIGHEST_SAFE_MODEL}"
echo "[bench] stop_reason_if_any=${STOP_REASON}"
