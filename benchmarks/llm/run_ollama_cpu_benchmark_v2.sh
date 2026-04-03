#!/usr/bin/env bash
set -euo pipefail

MODELS=(
  "qwen2.5:0.5b"
  "llama3.2:1b"
  "qwen2.5:3b"
  "mistral:7b"
)

RUNS_PER_MODEL="${RUNS_PER_MODEL:-3}"
NUM_PREDICT="${NUM_PREDICT:-120}"
NUM_THREAD="${NUM_THREAD:-4}"
OLLAMA_HOST="${OLLAMA_HOST:-http://127.0.0.1:11434}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="benchmarks/llm/results/${STAMP}"
RAW_CSV="${OUT_DIR}/raw_runs.csv"
SUMMARY_CSV="${OUT_DIR}/summary.csv"
ENV_TXT="${OUT_DIR}/environment.txt"

PROMPT="Write exactly 120 words explaining why unit tests matter in production software."

mkdir -p "${OUT_DIR}"

{
  echo "timestamp_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "hostname=$(hostname)"
  echo "kernel=$(uname -srmo)"
  echo "cpu=$(lscpu | awk -F: '/Model name/ {gsub(/^ +/, "", $2); print $2; exit}')"
  echo "cpus=$(nproc)"
  echo "memory=$(free -h | awk '/Mem:/ {print $2" total, "$7" available"}')"
  echo "ollama_version=$(ollama --version)"
  if command -v nvidia-smi >/dev/null 2>&1; then
    echo "gpu=$(nvidia-smi --query-gpu=name,memory.total --format=csv,noheader | tr '\n' ';')"
  else
    echo "gpu=none"
  fi
} > "${ENV_TXT}"

echo "model,run,success,error,model_size,load_s,prompt_tokens,prompt_tps,gen_tokens,gen_tps,total_s" > "${RAW_CSV}"

for model in "${MODELS[@]}"; do
  if ! ollama show "${model}" >/dev/null 2>&1; then
    echo "[bench] skipping missing model ${model}"
    echo "${model},0,false,model_not_found,,0,0,0,0,0,0" >> "${RAW_CSV}"
    continue
  fi

  model_size="$(ollama list | awk -v m="${model}" '$1==m {size=$3" "$4} END{print size}')"
  echo "[bench] model ${model} (${model_size})"

  for run in $(seq 1 "${RUNS_PER_MODEL}"); do
    payload="$(jq -nc \
      --arg model "${model}" \
      --arg prompt "${PROMPT}" \
      --argjson num_predict "${NUM_PREDICT}" \
      --argjson num_thread "${NUM_THREAD}" \
      '{model:$model,prompt:$prompt,stream:true,options:{temperature:0,num_predict:$num_predict,num_thread:$num_thread}}')"

    response="$(curl -sS -m 1200 -H 'Content-Type: application/json' "${OLLAMA_HOST}/api/generate" -d "${payload}" || true)"

    final_json="$(printf '%s\n' "${response}" | jq -cs 'map(select(.done==true))|last // {}' 2>/dev/null || echo '{}')"

    done_flag="$(jq -r '.done // false' <<<"${final_json}")"
    err="$(jq -r '.error // empty' <<<"${final_json}")"

    if [[ "${done_flag}" != "true" ]] || [[ -n "${err}" ]]; then
      fail_msg="${err:-no_done_chunk}"
      echo "${model},${run},false,${fail_msg},${model_size},0,0,0,0,0,0" >> "${RAW_CSV}"
      echo "[bench] ${model} run ${run} failed: ${fail_msg}"
      continue
    fi

    load_ns="$(jq -r '.load_duration // 0' <<<"${final_json}")"
    prompt_count="$(jq -r '.prompt_eval_count // 0' <<<"${final_json}")"
    prompt_ns="$(jq -r '.prompt_eval_duration // 0' <<<"${final_json}")"
    gen_count="$(jq -r '.eval_count // 0' <<<"${final_json}")"
    gen_ns="$(jq -r '.eval_duration // 0' <<<"${final_json}")"
    total_ns="$(jq -r '.total_duration // 0' <<<"${final_json}")"

    if [[ "${gen_count}" == "0" ]] || [[ "${total_ns}" == "0" ]]; then
      echo "${model},${run},false,no_eval_tokens,${model_size},0,0,0,0,0,0" >> "${RAW_CSV}"
      echo "[bench] ${model} run ${run} failed: no_eval_tokens"
      continue
    fi

    load_s="$(awk -v ns="${load_ns}" 'BEGIN {printf "%.4f", ns/1e9}')"
    total_s="$(awk -v ns="${total_ns}" 'BEGIN {printf "%.4f", ns/1e9}')"
    prompt_tps="$(awk -v c="${prompt_count}" -v ns="${prompt_ns}" 'BEGIN {if (ns>0) printf "%.3f", c/(ns/1e9); else print "0"}')"
    gen_tps="$(awk -v c="${gen_count}" -v ns="${gen_ns}" 'BEGIN {if (ns>0) printf "%.3f", c/(ns/1e9); else print "0"}')"

    echo "${model},${run},true,,${model_size},${load_s},${prompt_count},${prompt_tps},${gen_count},${gen_tps},${total_s}" >> "${RAW_CSV}"
    echo "[bench] ${model} run ${run}: gen_tps=${gen_tps} prompt_tps=${prompt_tps} total_s=${total_s}"
  done
done

{
  echo "model,successful_runs,avg_gen_tps,avg_prompt_tps,avg_total_s,model_size"
  awk -F',' '
    NR==1 {next}
    $3=="true" {
      m=$1
      n[m]++
      size[m]=$5
      sum_gen[m]+=$10
      sum_prompt[m]+=$8
      sum_total[m]+=$11
    }
    END {
      for (m in n) {
        printf "%s,%d,%.3f,%.3f,%.3f,%s\n", m, n[m], sum_gen[m]/n[m], sum_prompt[m]/n[m], sum_total[m]/n[m], size[m]
      }
    }
  ' "${RAW_CSV}" | sort
} > "${SUMMARY_CSV}"

echo "[bench] done"
echo "[bench] raw: ${RAW_CSV}"
echo "[bench] summary: ${SUMMARY_CSV}"
