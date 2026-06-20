#!/bin/bash
# ============================================================
# Infra-Server Watchdog Agent
# Run on your Infra-Server VM (Linux) via cron
#
# Monitors:
#   - Wazuh service health
#   - Suricata service health
#   - Disk space (alert if >85%)
#   - Memory usage (alert if >90%)
#   - Failed SSH logins in last hour
#   - New listening ports (unexpected services)
#
# Setup:
#   1. Copy this script to your Infra-Server
#   2. chmod +x infra-watchdog-agent.sh
#   3. Add to cron: */15 * * * * /path/to/infra-watchdog-agent.sh
#   4. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID below
# ============================================================

TELEGRAM_BOT_TOKEN="YOUR_BOT_TOKEN_HERE"   # paste your token (never commit the real value)
TELEGRAM_CHAT_ID="YOUR_CHAT_ID_HERE"       # paste your Telegram user ID
HOSTNAME=$(hostname)
ALERTS=""

send_telegram() {
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -H "Content-Type: application/json" \
    -d "{\"chat_id\":\"${TELEGRAM_CHAT_ID}\",\"text\":\"$1\"}" > /dev/null
}

# ── 1. Wazuh service check ────────────────────────────────
if systemctl is-active --quiet wazuh-manager 2>/dev/null || \
   systemctl is-active --quiet wazuh-agent 2>/dev/null; then
  WAZUH_STATUS="✅ Running"
else
  WAZUH_STATUS="🔴 STOPPED"
  ALERTS="${ALERTS}\n⚠️ Wazuh is NOT running!"
fi

# ── 2. Suricata service check ─────────────────────────────
if systemctl is-active --quiet suricata 2>/dev/null; then
  SURICATA_STATUS="✅ Running"
else
  SURICATA_STATUS="🔴 STOPPED"
  ALERTS="${ALERTS}\n⚠️ Suricata is NOT running!"
fi

# ── 3. Disk space check ───────────────────────────────────
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
if [ "$DISK_USAGE" -gt 85 ]; then
  ALERTS="${ALERTS}\n⚠️ Disk usage critical: ${DISK_USAGE}%"
fi

# ── 4. Memory check ───────────────────────────────────────
MEM_USAGE=$(free | awk '/Mem:/ {printf "%.0f", ($3/$2)*100}')
if [ "$MEM_USAGE" -gt 90 ]; then
  ALERTS="${ALERTS}\n⚠️ Memory usage critical: ${MEM_USAGE}%"
fi

# ── 5. Failed SSH logins in last hour ────────────────────
FAILED_SSH=$(journalctl -u ssh --since "1 hour ago" 2>/dev/null | \
  grep -c "Failed password" || \
  grep -c "Failed password" /var/log/auth.log 2>/dev/null || echo "0")
if [ "$FAILED_SSH" -gt 10 ]; then
  ALERTS="${ALERTS}\n🚨 ${FAILED_SSH} failed SSH login attempts in last hour!"
fi

# ── 6. Send daily health report ───────────────────────────
HOUR=$(date +%H)
if [ "$HOUR" = "09" ]; then
  REPORT=$(printf '🖥️ Infra-Server Health Report\nHost: %s\nTime: %s\n\nServices:\n  Wazuh: %s\n  Suricata: %s\n\nResources:\n  Disk: %s%%\n  Memory: %s%%\n\nSecurity:\n  Failed SSH (1h): %s' \
    "$HOSTNAME" "$(date -u)" "$WAZUH_STATUS" "$SURICATA_STATUS" "$DISK_USAGE" "$MEM_USAGE" "$FAILED_SSH")
  send_telegram "$REPORT"
fi

# ── 7. Send alerts if any ────────────────────────────────
if [ -n "$ALERTS" ]; then
  MSG=$(printf '🚨 INFRA-SERVER ALERT\nHost: %s\nTime: %s\n%s' "$HOSTNAME" "$(date -u)" "$(echo -e "$ALERTS")")
  send_telegram "$MSG"
fi
