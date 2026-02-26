const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

export async function sendDiscordMessage(content: string, embed?: object): Promise<void> {
  if (!DISCORD_WEBHOOK_URL) {
    console.log('[discord] No webhook URL configured, skipping');
    return;
  }

  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        ...(embed && { embeds: [embed] }),
      }),
    });
  } catch (error) {
    console.error('[discord] Failed to send message:', error);
  }
}
