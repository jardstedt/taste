#!/bin/bash
# ============================================================
# ACP End-to-End Test — Real on-chain job lifecycle
# ============================================================
# Creates real ACP buyer jobs and walks through various
# scenarios. Outputs a structured log file with every
# request/response for review or evidence.
#
# Usage: bash scripts/acp-e2e-test.sh [base_url]
#   base_url defaults to http://localhost:3001
#
# Scenarios:
#   1. Happy path    — full lifecycle: create → pay → complete → accept
#   2. Expert decline — expert declines session, buyer gets refund
#   3. Messaging     — back-and-forth memos between agent and expert
#   4. Auto timeout  — no expert action, deadline expires, auto-refund
#
# Output: scripts/acp-e2e-results/<timestamp>_<scenario>.log
# ============================================================

set -uo pipefail

# Auto-detect: if running on the VPS, use the public HTTPS domain
# (production sets secure cookies that won't send over plain HTTP).
if [ -d "/opt/taste" ] && [ "$(hostname)" = "racknerd-19f4019" ]; then
  DEFAULT_BASE="https://humantaste.app"
else
  DEFAULT_BASE="http://localhost:3001"
fi
BASE="${1:-$DEFAULT_BASE}"
COOKIE_FILE=$(mktemp)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_DIR="$(cd "$(dirname "$0")" && pwd)/acp-e2e-results"
mkdir -p "$RESULTS_DIR"

LOG_FILE=""
JOB_ID=""
SESSION_ID=""
CURRENT_PHASE=""
OFFERING_NAME=""
SCENARIO=""
AUTO_MODE=false
OFFERINGS_JSON=""
SAMPLES_JSON=""
BUYER_WALLET=""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ── Logging ──

step_num=0

log() {
  echo "$1" >> "$LOG_FILE"
}

log_header() {
  log ""
  log "$(printf '=%.0s' {1..70})"
  log "$1"
  log "$(printf '=%.0s' {1..70})"
  log ""
}

log_step() {
  step_num=$((step_num + 1))
  local label="STEP $step_num: $1"
  log ""
  log "--- $label ---"
  log "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"
  log ""
  echo -e "${CYAN}[$step_num]${NC} $1"
}

log_request() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  log "REQUEST:"
  log "  $method $url"
  if [ -n "$body" ]; then
    log "  Body: $(echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body")"
  fi
  log ""
}

log_response() {
  local status="$1"
  local body="$2"
  log "RESPONSE:"
  log "  Status: $status"
  log "  Body: $(echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body")"
  log ""
}

log_result() {
  local ok="$1"
  local msg="$2"
  if [ "$ok" = "true" ]; then
    log "RESULT: OK — $msg"
    echo -e "  ${GREEN}OK${NC} $msg"
  else
    log "RESULT: FAIL — $msg"
    echo -e "  ${RED}FAIL${NC} $msg"
  fi
}

# ── API helpers ──

api_get() {
  local url="$1"
  log_request "GET" "$BASE$url"
  local tmp=$(mktemp)
  RESP_CODE=$(curl -s -o "$tmp" -w "%{http_code}" -b "$COOKIE_FILE" "$BASE$url")
  RESP_BODY=$(cat "$tmp")
  rm -f "$tmp"
  log_response "$RESP_CODE" "$RESP_BODY"
}

api_post() {
  local url="$1"
  local body
  body="${2-}"
  if [ -z "$body" ]; then body='{}'; fi
  log_request "POST" "$BASE$url" "$body"
  local tmp=$(mktemp)
  local body_file=$(mktemp)
  printf '%s' "$body" > "$body_file"
  RESP_CODE=$(curl -s -o "$tmp" -w "%{http_code}" -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
    -H "Content-Type: application/json" -X POST "$BASE$url" --data-binary "@$body_file")
  RESP_BODY=$(cat "$tmp")
  rm -f "$tmp" "$body_file"
  log_response "$RESP_CODE" "$RESP_BODY"
}

json_field() {
  local json="$1"
  local path="$2"
  echo "$json" | node -e "
    let d='';process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      try{const o=JSON.parse(d);const v=$path;process.stdout.write(String(v??''))}
      catch(e){process.stderr.write(e.message)}
    });
  "
}

json_escape() {
  node -e "process.stdout.write(JSON.stringify(process.argv[1]))" -- "$1"
}

is_success() {
  echo "$1" | grep -q '"success":true'
}

# ── Shared Steps ──

do_login() {
  log_step "Login as admin"

  read -rp "  Admin email: " admin_email
  read -rsp "  Admin password: " admin_pass
  echo ""

  # Build login payload safely (password may contain special chars)
  local login_body
  login_body=$(node -e "process.stdout.write(JSON.stringify({email:process.argv[1],password:process.argv[2]}))" -- "$admin_email" "$admin_pass")

  api_post "/api/auth/login" "$login_body"

  # Redact password from log file
  if [ -n "$LOG_FILE" ] && [ -f "$LOG_FILE" ]; then
    local escaped_pass=$(node -e "process.stdout.write(process.argv[1].replace(/[.*+?^\${}()|[\\]\\\\]/g,'\\\\\\$&'))" -- "$admin_pass")
    sed -i "s/$escaped_pass/[REDACTED]/g" "$LOG_FILE"
  fi

  if is_success "$RESP_BODY"; then
    local expert_id=$(json_field "$RESP_BODY" "o.data?.expertId ?? o.expertId ?? ''")
    log_result "true" "Logged in (expert: $expert_id)"
  else
    local err=$(json_field "$RESP_BODY" "o.error ?? 'unknown'")
    log_result "false" "Login failed: $err"
    echo -e "  ${RED}Cannot continue without login.${NC}"
    exit 1
  fi
}

do_init_buyer() {
  log_step "Initialize ACP buyer client"

  api_post "/api/agent-sim/init"

  if is_success "$RESP_BODY"; then
    local wallet=$(json_field "$RESP_BODY" "o.data?.wallet ?? ''")
    log_result "true" "Buyer client initialized (wallet: $wallet)"
  else
    local err=$(json_field "$RESP_BODY" "o.error ?? 'unknown'")
    log_result "false" "Init failed: $err"
    exit 1
  fi
}

do_check_status() {
  log_step "Check buyer status and gas price"

  api_get "/api/agent-sim/status"

  local connected=$(json_field "$RESP_BODY" "o.data?.connected ?? false")
  local gas=$(json_field "$RESP_BODY" "o.data?.gasPrice ?? 'unknown'")
  local wallet=$(json_field "$RESP_BODY" "o.data?.wallet ?? ''")

  log_result "true" "Connected: $connected | Gas: ${gas} gwei | Wallet: $wallet"
}

do_discover_offerings() {
  log_step "Discover Taste offerings on ACP"

  api_get "/api/agent-sim/offerings"

  if is_success "$RESP_BODY"; then
    local count=$(json_field "$RESP_BODY" "(o.data ?? []).length")
    log_result "true" "Found $count enabled offerings"

    echo ""
    echo "$RESP_BODY" | node -e "
      let d='';process.stdin.on('data',c=>d+=c);
      process.stdin.on('end',()=>{
        const o=JSON.parse(d);
        (o.data ?? []).forEach((off, i) => {
          console.log('  [' + i + '] ' + off.name + ' (\$' + off.price + ' USDC) — index ' + off.index);
        });
      });
    "
  else
    local err=$(json_field "$RESP_BODY" "o.error ?? 'unknown'")
    log_result "false" "Discovery failed: $err"
    exit 1
  fi
}

do_select_and_create_job() {
  log_step "Create ACP buyer job"

  api_get "/api/agent-sim/samples"
  local samples_body="$RESP_BODY"

  echo ""
  read -rp "  Which offering # to test? " offering_num

  api_get "/api/agent-sim/offerings"
  OFFERING_NAME=$(json_field "$RESP_BODY" "(o.data ?? [])[$offering_num]?.name ?? ''")
  local offering_index=$(json_field "$RESP_BODY" "(o.data ?? [])[$offering_num]?.index ?? -1")

  if [ -z "$OFFERING_NAME" ] || [ "$offering_index" = "-1" ]; then
    log_result "false" "Invalid offering selection"
    exit 1
  fi

  # Sanitize offering name (only allow alphanumeric + underscore)
  OFFERING_NAME=$(echo "$OFFERING_NAME" | tr -cd 'a-zA-Z0-9_')

  echo -e "  Selected: ${BOLD}$OFFERING_NAME${NC} (on-chain index: $offering_index)"

  local sample_input=$(echo "$samples_body" | node -e "
    let d='';process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      const o=JSON.parse(d);
      const match=(o.data ?? []).find(s => s.name === '$OFFERING_NAME');
      process.stdout.write(JSON.stringify(match?.data ?? {}));
    });
  ")

  echo ""
  echo -e "  ${DIM}Sample input:${NC}"
  echo "$sample_input" | node -e "
    let d='';process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      try{
        const o=JSON.parse(d);
        Object.entries(o).forEach(([k,v])=>{
          const val=typeof v==='string'?v.substring(0,80)+'..':JSON.stringify(v).substring(0,80)+'..';
          console.log('    ' + k + ': ' + val);
        });
      }catch{}
    });
  "

  echo ""
  read -rp "  Use sample input? (Y/n): " use_sample
  local requirement="$sample_input"

  if [[ "$use_sample" =~ ^[nN] ]]; then
    echo "  Enter custom requirement JSON (single line):"
    read -rp "  > " custom_req
    requirement="$custom_req"
  fi

  local body="{\"offeringIndex\":$offering_index,\"requirement\":$requirement}"

  api_post "/api/agent-sim/jobs" "$body"

  if is_success "$RESP_BODY"; then
    JOB_ID=$(json_field "$RESP_BODY" "o.data?.jobId ?? ''")
    log_result "true" "Job created — ACP Job ID: $JOB_ID"
    echo -e "  ${BOLD}Job ID: $JOB_ID${NC}"
  else
    local err=$(json_field "$RESP_BODY" "o.error ?? 'unknown'")
    log_result "false" "Job creation failed: $err"
    exit 1
  fi
}

do_poll_status() {
  local label="${1:-Check job status}"
  log_step "$label"

  api_get "/api/agent-sim/jobs/$JOB_ID"

  if is_success "$RESP_BODY"; then
    local phase=$(json_field "$RESP_BODY" "o.data?.phase ?? 'unknown'")
    local price=$(json_field "$RESP_BODY" "o.data?.price ?? 0")
    local memo_count=$(json_field "$RESP_BODY" "(o.data?.memos ?? []).length")
    log_result "true" "Phase: $phase | Price: \$$price USDC | Memos: $memo_count"
    CURRENT_PHASE="$phase"
  else
    local err=$(json_field "$RESP_BODY" "o.error ?? 'unknown'")
    log_result "false" "Status check failed: $err"
  fi
}

do_wait_for_negotiation() {
  log_step "Wait for provider to accept (REQUEST → NEGOTIATION)"

  local max_wait=90
  local waited=0

  while [ $waited -lt $max_wait ]; do
    api_get "/api/agent-sim/jobs/$JOB_ID"
    local phase=$(json_field "$RESP_BODY" "o.data?.phase ?? 'unknown'")

    if [ "$phase" = "NEGOTIATION" ]; then
      log_result "true" "Provider accepted — job is in NEGOTIATION phase"
      return 0
    elif [ "$phase" = "REJECTED" ]; then
      log_result "false" "Provider rejected the job"
      return 1
    fi

    echo -ne "  Waiting... ${waited}s (phase: $phase)  \r"
    sleep 5
    waited=$((waited + 5))
  done

  log_result "false" "Timed out waiting for NEGOTIATION (${max_wait}s)"
  return 1
}

do_pay() {
  log_step "Pay for job (NEGOTIATION → TRANSACTION)"

  # The provider sends accept + createRequirement as two separate on-chain
  # calls.  The buyer's payAndAcceptRequirement needs the requirement memo
  # to exist, which may take a few seconds to propagate after NEGOTIATION.
  local max_retries=5
  local attempt=0

  while [ $attempt -lt $max_retries ]; do
    api_post "/api/agent-sim/jobs/$JOB_ID/pay"

    if is_success "$RESP_BODY"; then
      log_result "true" "Payment submitted on-chain"
      return 0
    fi

    local err=$(json_field "$RESP_BODY" "o.error ?? 'unknown'")

    # Retry on "no notification memo" — the requirement hasn't propagated yet
    if echo "$err" | grep -qi "memo\|notification"; then
      attempt=$((attempt + 1))
      echo -e "  ${DIM}Requirement memo not ready, retrying in 10s... ($attempt/$max_retries)${NC}"
      log "  Payment attempt $attempt failed: $err — retrying in 10s"
      sleep 10
    else
      log_result "false" "Payment failed: $err"
      return 1
    fi
  done

  log_result "false" "Payment failed after $max_retries retries (requirement memo never arrived)"
  return 1
}

do_find_session() {
  log_step "Find internal session for ACP job"

  local max_wait=30
  local waited=0

  while [ $waited -lt $max_wait ]; do
    api_get "/api/sessions"

    SESSION_ID=$(echo "$RESP_BODY" | node -e "
      let d='';process.stdin.on('data',c=>d+=c);
      process.stdin.on('end',()=>{
        const o=JSON.parse(d);
        const match=(o.data ?? []).find(s => s.acpJobId === '$JOB_ID' || s.acpJobId === String($JOB_ID));
        process.stdout.write(match?.id ?? '');
      });
    ")

    if [ -n "$SESSION_ID" ]; then
      local status=$(echo "$RESP_BODY" | node -e "
        let d='';process.stdin.on('data',c=>d+=c);
        process.stdin.on('end',()=>{
          const o=JSON.parse(d);
          const match=(o.data ?? []).find(s => s.id === '$SESSION_ID');
          process.stdout.write(match?.status ?? '');
        });
      ")
      log_result "true" "Session: $SESSION_ID | Status: $status"
      return 0
    fi

    echo -ne "  Waiting for session... ${waited}s  \r"
    sleep 3
    waited=$((waited + 3))
  done

  log_result "false" "No session found after ${max_wait}s"
  return 1
}

do_check_session_status() {
  api_get "/api/sessions/$SESSION_ID"
  local status=$(json_field "$RESP_BODY" "o.data?.session?.status ?? o.data?.status ?? 'unknown'")
  local turns=$(json_field "$RESP_BODY" "o.data?.session?.turnCount ?? o.data?.turnCount ?? 0")
  local max=$(json_field "$RESP_BODY" "o.data?.session?.maxTurns ?? o.data?.maxTurns ?? 0")
  echo "$status"
}

do_log_memos() {
  log ""
  log "ALL MEMOS:"
  api_get "/api/agent-sim/jobs/$JOB_ID"
  echo "$RESP_BODY" | node -e "
    let d='';process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      const o=JSON.parse(d);
      (o.data?.memos ?? []).forEach((m, i) => {
        console.log('  Memo ' + (i+1) + ': ' + (typeof m.content === 'string' ? m.content.substring(0,500) : JSON.stringify(m.content).substring(0,500)));
      });
    });
  " >> "$LOG_FILE"
}

do_log_messages() {
  if [ -z "$SESSION_ID" ]; then return; fi
  log ""
  log "ALL SESSION MESSAGES:"
  api_get "/api/sessions/$SESSION_ID/messages"
  echo "$RESP_BODY" | node -e "
    let d='';process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      const o=JSON.parse(d);
      (o.data ?? []).forEach((m, i) => {
        const sender=m.senderType ?? 'unknown';
        const content=(m.content ?? '').substring(0,200);
        const type=m.messageType ?? 'text';
        console.log('  [' + sender + '] (' + type + ') ' + content);
      });
    });
  " >> "$LOG_FILE"
}

do_final_report() {
  log_step "Final status"

  api_get "/api/agent-sim/jobs/$JOB_ID"
  if is_success "$RESP_BODY"; then
    local phase=$(json_field "$RESP_BODY" "o.data?.phase ?? 'unknown'")
    local price=$(json_field "$RESP_BODY" "o.data?.price ?? 0")
    local memo_count=$(json_field "$RESP_BODY" "(o.data?.memos ?? []).length")
    log_result "true" "Final phase: $phase | Price: \$$price USDC | Memos: $memo_count"
  fi

  if [ -n "$SESSION_ID" ]; then
    api_get "/api/sessions/$SESSION_ID"
    local status=$(json_field "$RESP_BODY" "o.data?.session?.status ?? o.data?.status ?? 'unknown'")
    local turns=$(json_field "$RESP_BODY" "o.data?.session?.turnCount ?? o.data?.turnCount ?? 0")
    local max=$(json_field "$RESP_BODY" "o.data?.session?.maxTurns ?? o.data?.maxTurns ?? 0")
    log_result "true" "Session: $status | Turns: $turns/$max"
  fi

  do_log_memos
  do_log_messages

  log_header "TEST COMPLETE"
  log "Scenario: $SCENARIO"
  log "Offering: $OFFERING_NAME"
  log "Finished: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  log "Job ID:   $JOB_ID"
  log "Session:  ${SESSION_ID:-none}"

  echo ""
  echo -e "${GREEN}${BOLD}Test complete.${NC}"
  echo -e "Log file: ${CYAN}$LOG_FILE${NC}"
}

# ── Auto-Mode Helpers ──

do_auto_create_job() {
  local array_idx="$1"
  local evaluator="${2-}"
  log_step "Create ACP buyer job (auto: offering #$array_idx)"

  OFFERING_NAME=$(json_field "$OFFERINGS_JSON" "(o.data ?? [])[$array_idx]?.name ?? ''")
  local offering_index=$(json_field "$OFFERINGS_JSON" "(o.data ?? [])[$array_idx]?.index ?? -1")

  if [ -z "$OFFERING_NAME" ] || [ "$offering_index" = "-1" ]; then
    log_result "false" "Invalid offering index $array_idx"
    return 1
  fi

  OFFERING_NAME=$(echo "$OFFERING_NAME" | tr -cd 'a-zA-Z0-9_')
  echo -e "  Selected: ${BOLD}$OFFERING_NAME${NC} (on-chain index: $offering_index)"

  local sample_input=$(echo "$SAMPLES_JSON" | node -e "
    let d='';process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      const o=JSON.parse(d);
      const match=(o.data ?? []).find(s => s.name === '$OFFERING_NAME');
      process.stdout.write(JSON.stringify(match?.data ?? {}));
    });
  ")
  echo -e "  ${DIM}Using sample data${NC}"

  local body
  if [ -n "$evaluator" ]; then
    body="{\"offeringIndex\":$offering_index,\"requirement\":$sample_input,\"evaluatorAddress\":\"$evaluator\"}"
    echo -e "  ${CYAN}Evaluator: $evaluator${NC}"
  else
    body="{\"offeringIndex\":$offering_index,\"requirement\":$sample_input}"
  fi
  api_post "/api/agent-sim/jobs" "$body"

  if is_success "$RESP_BODY"; then
    JOB_ID=$(json_field "$RESP_BODY" "o.data?.jobId ?? ''")
    log_result "true" "Job created — ACP Job ID: $JOB_ID"
    echo -e "  ${BOLD}Job ID: $JOB_ID${NC}"
    return 0
  else
    local err=$(json_field "$RESP_BODY" "o.error ?? 'unknown'")
    log_result "false" "Job creation failed: $err"
    return 1
  fi
}

do_auto_accept_session() {
  log_step "Accept session as expert (auto)"
  api_post "/api/sessions/$SESSION_ID/accept" "{}"
  if is_success "$RESP_BODY"; then
    log_result "true" "Session accepted"
  else
    log_result "false" "Accept failed: $(json_field "$RESP_BODY" "o.error ?? ''")"
  fi
}

do_auto_send_expert_message() {
  local msg="$1"
  local escaped=$(json_escape "$msg")
  log_step "Send expert message (auto)"
  api_post "/api/sessions/$SESSION_ID/messages" "{\"content\":$escaped}"
  if is_success "$RESP_BODY"; then
    log_result "true" "Expert message sent: ${msg:0:60}"
  else
    log_result "false" "Send failed: $(json_field "$RESP_BODY" "o.error ?? ''")"
  fi
}

do_auto_send_agent_message() {
  local msg="$1"
  local escaped=$(json_escape "$msg")
  log_step "Send agent message (auto)"
  api_post "/api/sessions/$SESSION_ID/messages" "{\"content\":$escaped,\"senderType\":\"agent\"}"
  if is_success "$RESP_BODY"; then
    log_result "true" "Agent message sent: ${msg:0:60}"
  else
    log_result "false" "Send failed: $(json_field "$RESP_BODY" "o.error ?? ''")"
  fi
}

do_auto_complete_session() {
  log_step "Complete session (auto)"
  api_post "/api/sessions/$SESSION_ID/complete" "{}"
  if is_success "$RESP_BODY"; then
    log_result "true" "Session completed"
  else
    log_result "false" "Complete failed: $(json_field "$RESP_BODY" "o.error ?? ''")"
  fi
}

do_auto_decline_session() {
  local reason="${1:-E2E test: expert decline scenario}"
  local escaped=$(json_escape "$reason")
  log_step "Decline session (auto)"
  api_post "/api/sessions/$SESSION_ID/decline" "{\"reason\":$escaped}"
  if is_success "$RESP_BODY"; then
    log_result "true" "Session declined"
  else
    log_result "false" "Decline failed: $(json_field "$RESP_BODY" "o.error ?? ''")"
  fi
}

do_wait_for_evaluation() {
  log_step "Wait for EVALUATION phase (deliverable delivery)"
  local max_wait=120
  local waited=0

  while [ $waited -lt $max_wait ]; do
    api_get "/api/agent-sim/jobs/$JOB_ID"
    local phase=$(json_field "$RESP_BODY" "o.data?.phase ?? 'unknown'")

    if [ "$phase" = "EVALUATION" ] || [ "$phase" = "COMPLETED" ]; then
      log_result "true" "Job reached $phase phase"
      CURRENT_PHASE="$phase"
      return 0
    fi

    echo -ne "  Waiting for EVALUATION... ${waited}s (phase: $phase)  \r"
    sleep 10
    waited=$((waited + 10))
  done

  log_result "false" "Timed out waiting for EVALUATION (${max_wait}s)"
  return 1
}

do_auto_accept_deliverable() {
  log_step "Accept deliverable on-chain (auto)"
  api_post "/api/agent-sim/jobs/$JOB_ID/accept" "{}"
  if is_success "$RESP_BODY"; then
    log_result "true" "Deliverable accepted on-chain"
  else
    log_result "false" "Accept failed: $(json_field "$RESP_BODY" "o.error ?? ''")"
  fi
}

do_auto_evaluate_job() {
  log_step "Evaluate job as third-party evaluator (auto: approve)"
  api_post "/api/agent-sim/jobs/$JOB_ID/evaluate" '{"approved":true,"memo":"E2E auto test: evaluation approved"}'
  if is_success "$RESP_BODY"; then
    log_result "true" "Evaluator approved deliverable on-chain"
  else
    log_result "false" "Evaluate failed: $(json_field "$RESP_BODY" "o.error ?? ''")"
  fi
}

do_wait_for_timeout() {
  log_step "Wait for session timeout (auto)"

  api_get "/api/sessions/$SESSION_ID"
  local deadline=$(json_field "$RESP_BODY" "o.data?.session?.deadlineAt ?? o.data?.deadlineAt ?? ''")
  log "Session deadline: $deadline"
  echo -e "  ${DIM}Session deadline: $deadline${NC}"
  echo -e "  ${DIM}Polling every 30s until timeout...${NC}"

  local max_wait=900
  local waited=0

  while [ $waited -lt $max_wait ]; do
    api_get "/api/sessions/$SESSION_ID"
    local sess_status=$(json_field "$RESP_BODY" "o.data?.session?.status ?? o.data?.status ?? 'unknown'")

    if [ "$sess_status" = "timeout" ] || [ "$sess_status" = "cancelled" ]; then
      echo ""
      log_result "true" "Session timed out as expected ($sess_status)"

      do_poll_status "ACP job status after timeout"
      if [ "$CURRENT_PHASE" = "REJECTED" ]; then
        log_result "true" "ACP job rejected — buyer will be refunded"
      fi

      api_get "/api/sessions/$SESSION_ID/messages"
      local cancel_msg=$(echo "$RESP_BODY" | node -e "
        let d='';process.stdin.on('data',c=>d+=c);
        process.stdin.on('end',()=>{
          const o=JSON.parse(d);
          const msgs=o.data ?? [];
          const cancel=msgs.find(m => m.messageType === 'system_notice' && (m.content ?? '').includes('expired'));
          process.stdout.write(cancel?.content ?? 'No cancellation message found');
        });
      ")
      log ""
      log "CANCELLATION MESSAGE: $cancel_msg"
      return 0
    fi

    local now_epoch=$(date +%s)
    local deadline_epoch=$(node -e "console.log(Math.floor(new Date('$deadline').getTime()/1000))" 2>/dev/null || echo "0")
    local remaining=$((deadline_epoch - now_epoch))
    if [ $remaining -gt 0 ]; then
      echo -ne "  Waiting... ${waited}s (~${remaining}s until deadline)  \r"
    else
      echo -ne "  Deadline passed, waiting for timeout check... ${waited}s  \r"
    fi

    sleep 30
    waited=$((waited + 30))
  done

  log_result "false" "Timed out waiting for session timeout (${max_wait}s)"
  return 1
}

do_wait_for_rejected() {
  log_step "Wait for ACP job REJECTED phase"
  local max_wait=120
  local waited=0

  while [ $waited -lt $max_wait ]; do
    api_get "/api/agent-sim/jobs/$JOB_ID"
    local phase=$(json_field "$RESP_BODY" "o.data?.phase ?? 'unknown'")

    if [ "$phase" = "REJECTED" ]; then
      log_result "true" "Job rejected on-chain as expected"
      CURRENT_PHASE="$phase"
      return 0
    fi

    echo -ne "  Waiting for REJECTED... ${waited}s (phase: $phase)  \r"
    sleep 10
    waited=$((waited + 10))
  done

  log_result "false" "Timed out waiting for REJECTED (${max_wait}s)"
  return 1
}

# ════════════════════════════════════════════════════════════
# SCENARIO 1: Happy Path
# ════════════════════════════════════════════════════════════

run_happy_path() {
  SCENARIO="happy_path"
  LOG_FILE="$RESULTS_DIR/${TIMESTAMP}_happy_path_${OFFERING_NAME}.log"
  log_header "ACP E2E Test — Scenario: HAPPY PATH"
  log "Date:     $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  log "Server:   $BASE"
  log "Offering: $OFFERING_NAME"
  log "Scenario: Full lifecycle — create → accept → pay → complete → deliver → accept"

  do_poll_status "Initial job status"

  if ! do_wait_for_negotiation; then
    do_final_report; return 1
  fi

  do_pay
  do_poll_status "Status after payment"
  do_find_session

  log_step "Waiting for expert to complete session"
  echo ""
  echo -e "  ${YELLOW}Go to the dashboard and complete the session as expert.${NC}"
  echo -e "  Session: ${BOLD}$SESSION_ID${NC}"
  echo ""
  echo "  [s] Check status  [a] Accept deliverable  [d] Done"

  while true; do
    read -rp "  > " action
    case "$action" in
      s) do_poll_status "Manual status check" ;;
      a)
        log_step "Accept deliverable"
        api_post "/api/agent-sim/jobs/$JOB_ID/accept" "{}"
        if is_success "$RESP_BODY"; then
          log_result "true" "Deliverable accepted on-chain"
        else
          log_result "false" "Accept failed: $(json_field "$RESP_BODY" "o.error ?? ''")"
        fi
        break ;;
      d) break ;;
      *) echo "  Use s/a/d" ;;
    esac
  done

  do_final_report
}

# ════════════════════════════════════════════════════════════
# SCENARIO 2: Expert Decline
# ════════════════════════════════════════════════════════════

run_expert_decline() {
  SCENARIO="expert_decline"
  LOG_FILE="$RESULTS_DIR/${TIMESTAMP}_expert_decline_${OFFERING_NAME}.log"
  log_header "ACP E2E Test — Scenario: EXPERT DECLINE"
  log "Date:     $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  log "Server:   $BASE"
  log "Offering: $OFFERING_NAME"
  log "Scenario: Expert declines session → job rejected → buyer refunded"

  do_poll_status "Initial job status"

  if ! do_wait_for_negotiation; then
    do_final_report; return 1
  fi

  do_pay
  do_poll_status "Status after payment"
  do_find_session

  log_step "Waiting for expert to DECLINE the session"
  echo ""
  echo -e "  ${YELLOW}Go to the dashboard and DECLINE the session.${NC}"
  echo -e "  Session: ${BOLD}$SESSION_ID${NC}"
  echo ""
  echo "  [s] Check status  [d] Done"

  while true; do
    read -rp "  > " action
    case "$action" in
      s)
        do_poll_status "Status check after decline"
        if [ "$CURRENT_PHASE" = "REJECTED" ]; then
          log_result "true" "Job rejected on-chain as expected after expert decline"
          break
        fi
        # Also check session status
        local sess_status=$(do_check_session_status)
        echo -e "  Session status: $sess_status"
        ;;
      d) break ;;
      *) echo "  Use s/d" ;;
    esac
  done

  do_final_report
}

# ════════════════════════════════════════════════════════════
# SCENARIO 3: Messaging (Memo Bridge)
# ════════════════════════════════════════════════════════════

run_messaging() {
  SCENARIO="messaging"
  LOG_FILE="$RESULTS_DIR/${TIMESTAMP}_messaging_${OFFERING_NAME}.log"
  log_header "ACP E2E Test — Scenario: MESSAGING (MEMO BRIDGE)"
  log "Date:     $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  log "Server:   $BASE"
  log "Offering: $OFFERING_NAME"
  log "Scenario: Agent sends messages via REST, expert responds via dashboard, memo bridge relays"

  do_poll_status "Initial job status"

  if ! do_wait_for_negotiation; then
    do_final_report; return 1
  fi

  do_pay
  do_poll_status "Status after payment"
  do_find_session

  log_step "Accept session as expert"
  api_post "/api/sessions/$SESSION_ID/accept" "{}"
  if is_success "$RESP_BODY"; then
    log_result "true" "Session accepted by expert"
  else
    log_result "false" "Accept failed: $(json_field "$RESP_BODY" "o.error ?? ''")"
  fi

  log_step "Messaging loop"
  echo ""
  echo -e "  ${YELLOW}Messaging mode. Send messages as agent, respond as expert on dashboard.${NC}"
  echo -e "  Session: ${BOLD}$SESSION_ID${NC}"
  echo ""
  echo "  [m] Send agent message      [e] Send expert message (from here)"
  echo "  [v] View messages            [s] Check ACP job status (see memos)"
  echo "  [c] Complete session          [d] Done"
  echo ""

  while true; do
    read -rp "  > " action
    case "$action" in
      m)
        read -rp "  Agent message: " agent_msg
        local escaped=$(json_escape "$agent_msg")
        log_step "Send agent message"
        api_post "/api/sessions/$SESSION_ID/messages" "{\"content\":$escaped,\"senderType\":\"agent\"}"
        if is_success "$RESP_BODY"; then
          log_result "true" "Agent message sent"
        else
          log_result "false" "Send failed: $(json_field "$RESP_BODY" "o.error ?? ''")"
        fi
        ;;
      e)
        read -rp "  Expert message: " expert_msg
        local escaped=$(json_escape "$expert_msg")
        log_step "Send expert message"
        api_post "/api/sessions/$SESSION_ID/messages" "{\"content\":$escaped}"
        if is_success "$RESP_BODY"; then
          log_result "true" "Expert message sent"
        else
          log_result "false" "Send failed: $(json_field "$RESP_BODY" "o.error ?? ''")"
        fi
        ;;
      v)
        log_step "View session messages"
        api_get "/api/sessions/$SESSION_ID/messages"
        echo "$RESP_BODY" | node -e "
          let d='';process.stdin.on('data',c=>d+=c);
          process.stdin.on('end',()=>{
            const o=JSON.parse(d);
            const msgs=(o.data ?? []).slice(-8);
            msgs.forEach(m=>{
              const tag=(m.senderType??'system').padEnd(7);
              const content=(m.content??'').substring(0,120);
              console.log('    ['+tag+'] '+content);
            });
          });
        "
        ;;
      s)
        do_poll_status "ACP job status (check memos)"
        ;;
      c)
        log_step "Complete session"
        api_post "/api/sessions/$SESSION_ID/complete" "{}"
        if is_success "$RESP_BODY"; then
          log_result "true" "Session completed"
        else
          log_result "false" "Complete failed: $(json_field "$RESP_BODY" "o.error ?? ''")"
        fi
        echo ""
        echo -e "  ${DIM}Waiting 10s for deliverable to reach ACP...${NC}"
        sleep 10
        do_poll_status "Status after completion"

        if [ "$CURRENT_PHASE" = "EVALUATION" ] || [ "$CURRENT_PHASE" = "COMPLETED" ]; then
          log_step "Accept deliverable"
          api_post "/api/agent-sim/jobs/$JOB_ID/accept" "{}"
          if is_success "$RESP_BODY"; then
            log_result "true" "Deliverable accepted on-chain"
          else
            log_result "false" "Accept failed: $(json_field "$RESP_BODY" "o.error ?? ''")"
          fi
        fi
        break
        ;;
      d) break ;;
      *) echo "  Use m/e/v/s/c/d" ;;
    esac
    echo ""
  done

  do_final_report
}

# ════════════════════════════════════════════════════════════
# SCENARIO 4: Auto Timeout
# ════════════════════════════════════════════════════════════

run_timeout() {
  SCENARIO="auto_timeout"
  LOG_FILE="$RESULTS_DIR/${TIMESTAMP}_timeout_${OFFERING_NAME}.log"
  log_header "ACP E2E Test — Scenario: AUTO TIMEOUT"
  log "Date:     $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  log "Server:   $BASE"
  log "Offering: $OFFERING_NAME"
  log "Scenario: Session created → no expert action → deadline expires → auto-cancel → refund"

  do_poll_status "Initial job status"

  if ! do_wait_for_negotiation; then
    do_final_report; return 1
  fi

  do_pay
  do_poll_status "Status after payment"
  do_find_session

  # Get deadline
  api_get "/api/sessions/$SESSION_ID"
  local deadline=$(json_field "$RESP_BODY" "o.data?.session?.deadlineAt ?? o.data?.deadlineAt ?? ''")
  local status=$(json_field "$RESP_BODY" "o.data?.session?.status ?? o.data?.status ?? ''")

  log_step "Session deadline and timeout wait"
  log "Session deadline: $deadline"
  log "Session status: $status"

  echo ""
  echo -e "  ${YELLOW}Session deadline: $deadline${NC}"
  echo -e "  Status: $status"
  echo ""
  echo -e "  ${DIM}Do NOT accept or interact with this session.${NC}"
  echo -e "  ${DIM}The server's timeout checker will cancel it when the deadline passes.${NC}"
  echo -e "  ${DIM}For test tier this is ~5 minutes. For quick tier ~15 minutes.${NC}"
  echo ""
  echo "  [s] Check status  [d] Done (stop waiting)"
  echo ""

  local timeout_detected=false

  while true; do
    read -rp "  > " action
    case "$action" in
      s)
        # Check session status
        api_get "/api/sessions/$SESSION_ID"
        local sess_status=$(json_field "$RESP_BODY" "o.data?.session?.status ?? o.data?.status ?? 'unknown'")

        log_step "Timeout status check"
        log_result "true" "Session status: $sess_status"

        if [ "$sess_status" = "timeout" ] || [ "$sess_status" = "cancelled" ]; then
          timeout_detected=true
          log_result "true" "Session timed out as expected!"
          echo ""

          # Check ACP side
          do_poll_status "ACP job status after timeout"

          if [ "$CURRENT_PHASE" = "REJECTED" ]; then
            log_result "true" "ACP job rejected — buyer will be refunded"
          fi
          break
        fi

        # Show time remaining
        local now_epoch=$(date +%s)
        local deadline_epoch=$(node -e "console.log(Math.floor(new Date('$deadline').getTime()/1000))")
        local remaining=$((deadline_epoch - now_epoch))
        if [ $remaining -gt 0 ]; then
          echo -e "  ${DIM}~${remaining}s until deadline${NC}"
        else
          echo -e "  ${YELLOW}Deadline passed — timeout should trigger on next check cycle (30s)${NC}"
        fi
        ;;
      d) break ;;
      *) echo "  Use s/d" ;;
    esac
    echo ""
  done

  if [ "$timeout_detected" = true ]; then
    # Log the cancellation message from session
    api_get "/api/sessions/$SESSION_ID/messages"
    local cancel_msg=$(echo "$RESP_BODY" | node -e "
      let d='';process.stdin.on('data',c=>d+=c);
      process.stdin.on('end',()=>{
        const o=JSON.parse(d);
        const msgs=o.data ?? [];
        const cancel=msgs.find(m => m.messageType === 'system_notice' && (m.content ?? '').includes('expired'));
        process.stdout.write(cancel?.content ?? 'No cancellation message found');
      });
    ")
    log ""
    log "CANCELLATION MESSAGE: $cancel_msg"
  fi

  do_final_report
}

# ════════════════════════════════════════════════════════════
# AUTO-MODE SCENARIO RUNNERS
# ════════════════════════════════════════════════════════════

run_happy_path_auto() {
  SCENARIO="happy_path"
  LOG_FILE="$RESULTS_DIR/${TIMESTAMP}_happy_path_${OFFERING_NAME}.log"
  log_header "ACP E2E Test — Scenario: HAPPY PATH (AUTO)"
  log "Date:     $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  log "Server:   $BASE"
  log "Offering: $OFFERING_NAME"
  log "Scenario: Full lifecycle — create → accept → pay → complete → deliver → accept (automated)"

  do_poll_status "Initial job status"

  if ! do_wait_for_negotiation; then
    do_final_report; return 1
  fi

  if ! do_pay; then
    do_final_report; return 1
  fi

  do_poll_status "Status after payment"

  if ! do_find_session; then
    do_final_report; return 1
  fi

  do_auto_accept_session
  sleep 2

  do_auto_send_expert_message "E2E auto test: This is my expert evaluation for the $OFFERING_NAME offering."
  sleep 2

  do_auto_complete_session

  echo -e "  ${DIM}Waiting 15s for deliverable to reach ACP...${NC}"
  sleep 15

  if do_wait_for_evaluation; then
    # Only accept if in EVALUATION — COMPLETED means auto-confirmed (no evaluator)
    if [ "$CURRENT_PHASE" = "EVALUATION" ]; then
      do_auto_accept_deliverable
    else
      log_step "Deliverable auto-confirmed (no evaluator)"
      log_result "true" "Job already COMPLETED — no buyer accept needed"
    fi
  fi

  do_final_report
}

run_happy_path_with_evaluator_auto() {
  SCENARIO="happy_path_evaluator"
  LOG_FILE="$RESULTS_DIR/${TIMESTAMP}_happy_path_evaluator_${OFFERING_NAME}.log"
  log_header "ACP E2E Test — Scenario: HAPPY PATH WITH EVALUATOR (AUTO)"
  log "Date:     $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  log "Server:   $BASE"
  log "Offering: $OFFERING_NAME"
  log "Evaluator: $BUYER_WALLET"
  log "Scenario: Full lifecycle with third-party evaluator approval (automated)"

  do_poll_status "Initial job status"

  if ! do_wait_for_negotiation; then
    do_final_report; return 1
  fi

  if ! do_pay; then
    do_final_report; return 1
  fi

  do_poll_status "Status after payment"

  if ! do_find_session; then
    do_final_report; return 1
  fi

  do_auto_accept_session
  sleep 2

  do_auto_send_expert_message "E2E auto test: This is my expert evaluation for the $OFFERING_NAME offering (with evaluator)."
  sleep 2

  do_auto_complete_session

  echo -e "  ${DIM}Waiting 15s for deliverable to reach ACP...${NC}"
  sleep 15

  if do_wait_for_evaluation; then
    if [ "$CURRENT_PHASE" = "EVALUATION" ]; then
      log_step "Third-party evaluator approving deliverable"
      log_result "true" "Job in EVALUATION — evaluator will approve"
      do_auto_evaluate_job

      # Wait for COMPLETED after evaluation
      echo -e "  ${DIM}Waiting 15s for evaluation to finalize...${NC}"
      sleep 15
      do_poll_status "Status after evaluator approval"
    else
      log_step "Deliverable auto-confirmed (evaluator not used)"
      log_result "true" "Job already COMPLETED"
    fi
  fi

  do_final_report
}

run_expert_decline_auto() {
  SCENARIO="expert_decline"
  LOG_FILE="$RESULTS_DIR/${TIMESTAMP}_expert_decline_${OFFERING_NAME}.log"
  log_header "ACP E2E Test — Scenario: EXPERT DECLINE (AUTO)"
  log "Date:     $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  log "Server:   $BASE"
  log "Offering: $OFFERING_NAME"
  log "Scenario: Expert declines session → job rejected → buyer refunded (automated)"

  do_poll_status "Initial job status"

  if ! do_wait_for_negotiation; then
    do_final_report; return 1
  fi

  if ! do_pay; then
    do_final_report; return 1
  fi

  do_poll_status "Status after payment"

  if ! do_find_session; then
    do_final_report; return 1
  fi

  do_auto_decline_session "E2E auto test: expert decline scenario"

  do_wait_for_rejected

  do_final_report
}

run_messaging_auto() {
  SCENARIO="messaging"
  LOG_FILE="$RESULTS_DIR/${TIMESTAMP}_messaging_${OFFERING_NAME}.log"
  log_header "ACP E2E Test — Scenario: MESSAGING (AUTO)"
  log "Date:     $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  log "Server:   $BASE"
  log "Offering: $OFFERING_NAME"
  log "Scenario: Agent and expert exchange messages, then complete (automated)"

  do_poll_status "Initial job status"

  if ! do_wait_for_negotiation; then
    do_final_report; return 1
  fi

  if ! do_pay; then
    do_final_report; return 1
  fi

  do_poll_status "Status after payment"

  if ! do_find_session; then
    do_final_report; return 1
  fi

  do_auto_accept_session
  sleep 2

  do_auto_send_agent_message "Hello, I am an AI agent requesting a $OFFERING_NAME evaluation."
  sleep 2
  do_auto_send_expert_message "Understood, I am reviewing your request now."
  sleep 2
  do_auto_send_agent_message "Here is additional context for the evaluation."
  sleep 2
  do_auto_send_expert_message "Thank you. Based on my analysis, here is my professional assessment."
  sleep 2

  log_step "View session messages"
  api_get "/api/sessions/$SESSION_ID/messages"
  local msg_count=$(json_field "$RESP_BODY" "(o.data ?? []).length")
  log_result "true" "Total messages in session: $msg_count"

  do_auto_complete_session

  echo -e "  ${DIM}Waiting 15s for deliverable to reach ACP...${NC}"
  sleep 15

  if do_wait_for_evaluation; then
    if [ "$CURRENT_PHASE" = "EVALUATION" ]; then
      do_auto_accept_deliverable
    else
      log_step "Deliverable auto-confirmed (no evaluator)"
      log_result "true" "Job already COMPLETED — no buyer accept needed"
    fi
  fi

  do_final_report
}

run_timeout_auto() {
  SCENARIO="auto_timeout"
  LOG_FILE="$RESULTS_DIR/${TIMESTAMP}_timeout_${OFFERING_NAME}.log"
  log_header "ACP E2E Test — Scenario: AUTO TIMEOUT (AUTO)"
  log "Date:     $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  log "Server:   $BASE"
  log "Offering: $OFFERING_NAME"
  log "Scenario: Session created → no expert action → deadline expires → auto-cancel (automated)"

  do_poll_status "Initial job status"

  if ! do_wait_for_negotiation; then
    do_final_report; return 1
  fi

  if ! do_pay; then
    do_final_report; return 1
  fi

  do_poll_status "Status after payment"

  if ! do_find_session; then
    do_final_report; return 1
  fi

  # Shorten deadline to 2 minutes so we don't wait 15-45 min
  log_step "Shorten session deadline to 2 minutes (test speedup)"
  api_post "/api/agent-sim/shorten-deadline" "{\"sessionId\":\"$SESSION_ID\",\"minutes\":2}"
  if is_success "$RESP_BODY"; then
    local new_deadline=$(json_field "$RESP_BODY" "o.data?.newDeadline ?? ''")
    log_result "true" "Deadline shortened to: $new_deadline"
  else
    log_result "false" "Could not shorten deadline: $(json_field "$RESP_BODY" "o.error ?? ''")"
    echo -e "  ${YELLOW}Continuing with original deadline — this may take a while${NC}"
  fi

  do_wait_for_timeout

  do_final_report
}

# ════════════════════════════════════════════════════════════
# Main
# ════════════════════════════════════════════════════════════

main() {
  echo ""
  echo -e "${BOLD}=== ACP End-to-End Test ===${NC}"
  echo -e "Server: $BASE"
  echo -e "${DIM}Creates real on-chain ACP jobs (\$0.01 USDC each).${NC}"
  echo ""

  # Temp log for pre-scenario steps
  LOG_FILE=$(mktemp)

  do_login
  do_init_buyer
  do_check_status
  do_discover_offerings

  echo ""
  echo -e "${BOLD}Select test scenario:${NC}"
  echo ""
  echo -e "  ${GREEN}[1]${NC} Happy path       — Full lifecycle: create → pay → complete → accept"
  echo -e "  ${YELLOW}[2]${NC} Expert decline   — Expert declines session, buyer gets ACP refund"
  echo -e "  ${CYAN}[3]${NC} Messaging        — Back-and-forth memos between agent and expert"
  echo -e "  ${RED}[4]${NC} Auto timeout     — No expert action, deadline expires, auto-refund"
  echo -e "  ${MAGENTA}[a]${NC} Run ALL (auto)   — Happy path for ALL offerings + edge cases, fully automated"
  echo ""
  read -rp "  Choose: " scenario_choice

  if [[ "$scenario_choice" =~ ^[aA]$ ]]; then
    # ── Fully automated run-all mode ──
    AUTO_MODE=true

    # Cache offerings, samples, and buyer wallet
    api_get "/api/agent-sim/offerings"
    OFFERINGS_JSON="$RESP_BODY"
    api_get "/api/agent-sim/samples"
    SAMPLES_JSON="$RESP_BODY"
    api_get "/api/agent-sim/status"
    BUYER_WALLET=$(json_field "$RESP_BODY" "o.data?.wallet ?? ''")

    local offering_count=$(json_field "$OFFERINGS_JSON" "(o.data ?? []).length")
    local evaluator_idx=$((offering_count - 1))

    echo ""
    echo -e "${BOLD}${MAGENTA}AUTO MODE: Happy path for all $offering_count offerings + 4 edge cases${NC}"
    echo -e "${DIM}Offering #$((evaluator_idx+1)) will use buyer wallet as evaluator.${NC}"
    echo -e "${DIM}No further prompts — sit back and watch.${NC}"
    echo ""

    local pass_count=0
    local fail_count=0

    # ── Happy path for each offering ──
    for ((i=0; i<offering_count; i++)); do
      JOB_ID=""
      SESSION_ID=""
      CURRENT_PHASE=""
      step_num=0

      echo ""
      echo -e "${BOLD}$(printf '═%.0s' {1..50})${NC}"
      if [ "$i" -eq "$evaluator_idx" ]; then
        echo -e "${BOLD}  HAPPY PATH + EVALUATOR — Offering $((i+1))/$offering_count${NC}"
      else
        echo -e "${BOLD}  HAPPY PATH — Offering $((i+1))/$offering_count${NC}"
      fi
      echo -e "${BOLD}$(printf '═%.0s' {1..50})${NC}"

      LOG_FILE=$(mktemp)

      # Last offering uses buyer wallet as evaluator
      if [ "$i" -eq "$evaluator_idx" ]; then
        if do_auto_create_job "$i" "$BUYER_WALLET"; then
          local temp_log="$LOG_FILE"
          run_happy_path_with_evaluator_auto
          if [ -f "$temp_log" ] && [ "$temp_log" != "$LOG_FILE" ]; then
            rm -f "$temp_log"
          fi
          pass_count=$((pass_count + 1))
        else
          fail_count=$((fail_count + 1))
          echo -e "  ${RED}Skipping — job creation failed${NC}"
        fi
      else
        if do_auto_create_job "$i"; then
          local temp_log="$LOG_FILE"
          run_happy_path_auto
          if [ -f "$temp_log" ] && [ "$temp_log" != "$LOG_FILE" ]; then
            rm -f "$temp_log"
          fi
          pass_count=$((pass_count + 1))
        else
          fail_count=$((fail_count + 1))
          echo -e "  ${RED}Skipping — job creation failed${NC}"
        fi
      fi

      echo -e "${DIM}Offering $((i+1)) done. Continuing...${NC}"
    done

    # ── Edge cases — use first offering ──
    for edge_scenario in "decline" "messaging" "timeout"; do
      JOB_ID=""
      SESSION_ID=""
      CURRENT_PHASE=""
      step_num=0

      echo ""
      echo -e "${BOLD}$(printf '═%.0s' {1..50})${NC}"
      echo -e "${BOLD}  EDGE CASE: $edge_scenario${NC}"
      echo -e "${BOLD}$(printf '═%.0s' {1..50})${NC}"

      LOG_FILE=$(mktemp)
      if do_auto_create_job 0; then
        local temp_log="$LOG_FILE"
        case "$edge_scenario" in
          decline)   run_expert_decline_auto ;;
          messaging) run_messaging_auto ;;
          timeout)   run_timeout_auto ;;
        esac
        if [ -f "$temp_log" ] && [ "$temp_log" != "$LOG_FILE" ]; then
          rm -f "$temp_log"
        fi
        pass_count=$((pass_count + 1))
      else
        fail_count=$((fail_count + 1))
        echo -e "  ${RED}Skipping — job creation failed${NC}"
      fi

      echo -e "${DIM}Edge case $edge_scenario done. Continuing...${NC}"
    done

    rm -f "$COOKIE_FILE"

    echo ""
    echo -e "${GREEN}${BOLD}═══ ALL TESTS COMPLETE ═══${NC}"
    echo -e "  Passed: ${GREEN}$pass_count${NC}"
    echo -e "  Failed: ${RED}$fail_count${NC}"
    echo -e "Results in: ${CYAN}$RESULTS_DIR/${NC}"
    ls -1 "$RESULTS_DIR/${TIMESTAMP}_"* 2>/dev/null | while read -r f; do
      echo -e "  ${DIM}$(basename "$f")${NC}"
    done

  else
    # ── Interactive single-scenario mode ──
    local scenarios=()
    case "$scenario_choice" in
      1) scenarios=("happy") ;;
      2) scenarios=("decline") ;;
      3) scenarios=("messaging") ;;
      4) scenarios=("timeout") ;;
      *) echo "Invalid choice"; exit 1 ;;
    esac

    for scenario in "${scenarios[@]}"; do
      JOB_ID=""
      SESSION_ID=""
      CURRENT_PHASE=""
      step_num=0

      do_select_and_create_job
      local temp_log="$LOG_FILE"

      case "$scenario" in
        happy)     run_happy_path ;;
        decline)   run_expert_decline ;;
        messaging) run_messaging ;;
        timeout)   run_timeout ;;
      esac

      if [ -f "$temp_log" ] && [ "$temp_log" != "$LOG_FILE" ]; then
        rm -f "$temp_log"
      fi
    done

    rm -f "$COOKIE_FILE"
  fi
}

main
