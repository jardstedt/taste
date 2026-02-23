#!/bin/bash
# ============================================================
# Taste Agent Simulator — Interactive testing from both sides
# ============================================================
# Play as both the buyer agent AND the expert from the terminal,
# or use alongside the dashboard UI for phone/browser testing.
#
# Usage: bash scripts/agent-sim.sh [base_url]
# ============================================================

set -uo pipefail

BASE="${1:-http://localhost:3001}"
COOKIE_FILE=$(mktemp)
SESSION_ID=""
EXPERT_ID=""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

info()    { echo -e "${GREEN}[OK]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
err()     { echo -e "${RED}[ERR]${NC} $1"; }
agent()   { echo -e "${CYAN}[AGENT]${NC} $1"; }
expert()  { echo -e "${MAGENTA}[EXPERT]${NC} $1"; }
divider() { echo -e "${DIM}──────────────────────────────────────${NC}"; }

# ── API helpers ──

api_get() {
  curl -s -b "$COOKIE_FILE" "$BASE$1"
}

api_post() {
  curl -s -X POST -b "$COOKIE_FILE" -H "Content-Type: application/json" "$BASE$1" -d "$2"
}

check_success() {
  local result="$1"
  local label="$2"
  if echo "$result" | grep -q '"success":true'; then
    info "$label"
    return 0
  else
    local error
    error=$(echo "$result" | grep -o '"error":"[^"]*"' | head -1 | cut -d'"' -f4)
    err "$label — ${error:-unknown error}"
    return 1
  fi
}

# Use node for reliable JSON field extraction
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

# JSON-escape a string for embedding in a JSON body
json_escape() {
  node -e "process.stdout.write(JSON.stringify(process.argv[1]))" -- "$1"
}

extract_id() {
  echo "$1" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4
}

# ── Login ──

login() {
  echo ""
  echo -e "${BOLD}=== Taste Agent Simulator ===${NC}"
  echo -e "Server: $BASE"
  divider

  echo "Logging in as admin..."
  local result
  result=$(curl -s -X POST "$BASE/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@taste.local","password":"devpassword123"}' \
    -c "$COOKIE_FILE")

  if ! check_success "$result" "Logged in"; then
    err "Cannot login. Is the server running? Check credentials."
    exit 1
  fi

  EXPERT_ID=$(echo "$result" | grep -o '"expertId":"[^"]*"' | head -1 | cut -d'"' -f4)
  info "Expert ID: $EXPERT_ID"
  echo ""
}

# ── Session Management ──

create_session() {
  divider
  echo -e "${BOLD}Create New Session${NC}"
  echo ""
  echo "Offering type:"
  echo "  [1]  trust_evaluation         — Full session, crypto/community"
  echo "  [2]  cultural_context         — Quick, narrative/community/art/music"
  echo "  [3]  output_quality_gate      — Quick, design/art/narrative"
  echo "  [4]  option_ranking           — Full, general/crypto/design"
  echo "  [5]  blind_spot_check         — Quick, general/crypto/narrative"
  echo "  [6]  human_reaction_prediction — Full, community/narrative/design"
  echo "  [7]  expert_brainstorming     — Deep, all domains"
  echo "  [8]  content_quality_gate     — Full, art/music/design/narrative"
  echo "  [9]  audience_reaction_poll   — Quick, art/music/design/community"
  echo "  [10] creative_direction_check — Quick, art/music/design/narrative"
  echo ""
  read -rp "Choose (1-10): " offering_choice

  local offering
  case $offering_choice in
    1)  offering="trust_evaluation" ;;
    2)  offering="cultural_context" ;;
    3)  offering="output_quality_gate" ;;
    4)  offering="option_ranking" ;;
    5)  offering="blind_spot_check" ;;
    6)  offering="human_reaction_prediction" ;;
    7)  offering="expert_brainstorming" ;;
    8)  offering="content_quality_gate" ;;
    9)  offering="audience_reaction_poll" ;;
    10) offering="creative_direction_check" ;;
    *)  offering="trust_evaluation" ;;
  esac

  echo ""
  echo "Tier:"
  echo "  [1] quick  — 10 turns, 5-15 min,  \$0.50-\$2"
  echo "  [2] full   — 20 turns, 15-45 min, \$2-\$5"
  echo "  [3] deep   — 40 turns, 30-90 min, \$5-\$15"
  echo ""
  read -rp "Choose (1-3): " tier_choice

  local tier
  case $tier_choice in
    1) tier="quick" ;;
    2) tier="full" ;;
    3) tier="deep" ;;
    *) tier="quick" ;;
  esac

  read -rp "Description (or Enter to skip): " desc
  local desc_field=""
  if [ -n "$desc" ]; then
    desc_field="\"description\":$(json_escape "$desc"),"
  fi

  local result
  result=$(api_post "/api/sessions" \
    "{\"offeringType\":\"$offering\",\"tierId\":\"$tier\",${desc_field}\"buyerAgent\":\"test-agent\",\"buyerAgentDisplay\":\"Test Agent\"}")

  if check_success "$result" "Session created ($offering / $tier)"; then
    SESSION_ID=$(extract_id "$result")
    info "Session ID: $SESSION_ID"
    echo ""
    warn "Session is waiting for expert to accept."
    warn "Accept it from the dashboard, or press [5] in the menu."
  fi
}

create_job() {
  divider
  echo -e "${BOLD}Create V1.0 Job${NC}"
  echo ""
  echo "Offering type:"
  echo "  [1] vibes_check"
  echo "  [2] narrative"
  echo "  [3] creative_review"
  echo "  [4] community_sentiment"
  echo "  [5] general"
  echo ""
  read -rp "Choose (1-5): " job_choice

  local offering payload
  case $job_choice in
    1)
      offering="vibes_check"
      payload='{"offeringType":"vibes_check","requirements":{"projectName":"TestProject","tokenAddress":"0x1234...","specificQuestion":"Is this project legit or a rug pull?"}}'
      ;;
    2)
      offering="narrative"
      payload='{"offeringType":"narrative","requirements":{"narrative":"AI agents managing DeFi portfolios","context":"Multiple protocols launching autonomous trading agents. CT is very bullish.","relatedTokens":["VIRTUAL","AI16Z"]}}'
      ;;
    3)
      offering="creative_review"
      payload='{"offeringType":"creative_review","requirements":{"contentUrls":["https://example.com/logo.png"],"contentType":"design","reviewType":"feedback","context":"Logo for a new DeFi protocol. Need honest feedback."}}'
      ;;
    4)
      offering="community_sentiment"
      payload='{"offeringType":"community_sentiment","requirements":{"community":"Monad","platforms":["Twitter","Discord"],"timeframe":"Last 7 days before TGE"}}'
      ;;
    5)
      offering="general"
      payload='{"offeringType":"general","requirements":{"question":"Should I invest in this project? The team is anon, 3-page whitepaper, launched 2 days ago.","domain":"crypto","urgency":"standard"}}'
      ;;
    *)
      offering="general"
      payload='{"offeringType":"general","requirements":{"question":"Test question","domain":"general"}}'
      ;;
  esac

  local result
  result=$(api_post "/api/jobs" "$payload")
  if check_success "$result" "Job created ($offering)"; then
    local job_id
    job_id=$(extract_id "$result")
    info "Job ID: $job_id"
    echo ""
    warn "Check the dashboard to see the job and submit a judgment."
  fi
}

# ── Agent Actions ──

send_agent_message() {
  if [ -z "$SESSION_ID" ]; then
    err "No active session. Create one first."
    return
  fi

  echo ""
  agent "Type message as AGENT (or 'auto' for a generated message):"
  read -rp "> " msg

  if [ "$msg" = "auto" ]; then
    local turn
    turn=$(json_field "$(api_get "/api/sessions/$SESSION_ID")" "o.data?.session?.turnCount ?? o.data?.turnCount ?? 0")
    msg="[Agent turn $turn] Thanks for your input. Can you elaborate on the risk factors you identified? Specifically, what concerns you most about the team's background?"
  fi

  local escaped
  escaped=$(json_escape "$msg")

  local result
  result=$(api_post "/api/sessions/$SESSION_ID/messages" \
    "{\"content\":$escaped,\"senderType\":\"agent\"}")
  check_success "$result" "Agent message sent"
}

send_expert_message() {
  if [ -z "$SESSION_ID" ]; then
    err "No active session. Create one first."
    return
  fi

  echo ""
  expert "Type message as EXPERT (or 'auto' for a generated message):"
  read -rp "> " msg

  if [ "$msg" = "auto" ]; then
    local turn
    turn=$(json_field "$(api_get "/api/sessions/$SESSION_ID")" "o.data?.session?.turnCount ?? o.data?.turnCount ?? 0")
    msg="[Expert turn $turn] Based on my analysis, the main risk factor is the anonymous team combined with the short whitepaper. The technical claims are unsubstantiated."
  fi

  local escaped
  escaped=$(json_escape "$msg")

  local result
  result=$(api_post "/api/sessions/$SESSION_ID/messages" \
    "{\"content\":$escaped}")
  check_success "$result" "Expert message sent"
}

# ── Add-on Actions ──

request_addon() {
  if [ -z "$SESSION_ID" ]; then
    err "No active session. Create one first."
    return
  fi

  divider
  echo -e "${BOLD}Request Add-on (as Agent)${NC}"
  echo ""
  echo "  [1] screenshot        — \$1.00"
  echo "  [2] extended_time     — \$2.00"
  echo "  [3] written_report    — \$3.00"
  echo "  [4] second_opinion    — \$5.00"
  echo "  [5] image_upload      — \$0.50"
  echo "  [6] follow_up         — \$3.00"
  echo "  [7] crowd_poll        — \$4.00"
  echo ""
  read -rp "Choose (1-7): " addon_choice

  local addon_type price description
  case $addon_choice in
    1) addon_type="screenshot";      price=1;   description="Please take a screenshot of the project dashboard" ;;
    2) addon_type="extended_time";   price=2;   description="Need more time to discuss tokenomics in depth" ;;
    3) addon_type="written_report";  price=3;   description="Please provide a written summary of your analysis" ;;
    4) addon_type="second_opinion";  price=5;   description="Would like another expert to verify these findings" ;;
    5) addon_type="image_upload";    price=0.5; description="Attaching relevant chart for context" ;;
    6) addon_type="follow_up";       price=3;   description="Schedule a follow-up session next week" ;;
    7) addon_type="crowd_poll";      price=4;   description="Run a community poll on this topic" ;;
    *) addon_type="screenshot";      price=1;   description="Screenshot request" ;;
  esac

  local result
  result=$(api_post "/api/sessions/$SESSION_ID/addons" \
    "{\"addonType\":\"$addon_type\",\"priceUsdc\":$price,\"description\":\"$description\"}")

  if check_success "$result" "Add-on requested: $addon_type (\$$price)"; then
    local addon_id
    addon_id=$(extract_id "$result")
    info "Add-on ID: $addon_id"
    warn "Respond to it from the dashboard, or press [4] in the menu."
  fi
}

respond_addon() {
  if [ -z "$SESSION_ID" ]; then
    err "No active session. Create one first."
    return
  fi

  local session_data
  session_data=$(api_get "/api/sessions/$SESSION_ID")

  # Use node to parse the addons array reliably
  local addon_list
  addon_list=$(echo "$session_data" | node -e "
    let d='';process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      try{
        const o=JSON.parse(d);
        const addons=o.data?.addons ?? [];
        if(addons.length===0){process.stdout.write('EMPTY');return}
        addons.forEach((a,i)=>{
          process.stdout.write((i+1)+'|'+a.id+'|'+a.addonType+'|'+a.status+'|'+(a.priceUsdc??0)+'\n');
        });
      }catch(e){process.stdout.write('ERROR')}
    });
  ")

  if [ "$addon_list" = "EMPTY" ] || [ "$addon_list" = "ERROR" ] || [ -z "$addon_list" ]; then
    warn "No add-ons on this session. Request one first."
    return
  fi

  echo ""
  echo -e "${BOLD}Add-ons:${NC}"

  local pending_found=false
  while IFS='|' read -r num aid atype astatus aprice; do
    local status_color="$DIM"
    if [ "$astatus" = "pending" ]; then
      status_color="$YELLOW"
      pending_found=true
    elif [ "$astatus" = "accepted" ]; then
      status_color="$GREEN"
    fi
    echo -e "  [$num] $atype — ${status_color}${astatus}${NC} — \$$aprice — ID: $aid"
  done <<< "$addon_list"

  if [ "$pending_found" = false ]; then
    warn "No pending add-ons to respond to."
    return
  fi

  echo ""
  read -rp "Which add-on # to respond to? " addon_num

  # Extract the addon ID for the chosen number
  local addon_id
  addon_id=$(echo "$addon_list" | while IFS='|' read -r num aid rest; do
    if [ "$num" = "$addon_num" ]; then echo "$aid"; break; fi
  done)

  if [ -z "$addon_id" ]; then
    err "Invalid choice."
    return
  fi

  read -rp "Accept? (y/n): " accept
  local accepted="true"
  if [[ "$accept" != [yY] ]]; then
    accepted="false"
  fi

  local result
  result=$(api_post "/api/sessions/$SESSION_ID/addons/$addon_id/respond" \
    "{\"accepted\":$accepted}")
  if [ "$accepted" = "true" ]; then
    check_success "$result" "Add-on ACCEPTED"
  else
    check_success "$result" "Add-on DECLINED"
  fi
}

# ── Session Actions ──

accept_session() {
  if [ -z "$SESSION_ID" ]; then
    err "No active session. Create one first."
    return
  fi

  local result
  result=$(api_post "/api/sessions/$SESSION_ID/accept" "{}")
  check_success "$result" "Session accepted (as expert)"
}

complete_session() {
  if [ -z "$SESSION_ID" ]; then
    err "No active session. Create one first."
    return
  fi

  local result
  result=$(api_post "/api/sessions/$SESSION_ID/complete" "{}")
  check_success "$result" "Session completed"
}

# ── View ──

view_session() {
  if [ -z "$SESSION_ID" ]; then
    err "No active session. Create one first."
    return
  fi

  divider
  local data
  data=$(api_get "/api/sessions/$SESSION_ID")

  # Use node for reliable extraction of session fields
  local session_info
  session_info=$(echo "$data" | node -e "
    let d='';process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      try{
        const o=JSON.parse(d);
        const s=o.data?.session ?? o.data ?? {};
        console.log(s.status ?? 'unknown');
        console.log(s.offeringType ?? '?');
        console.log(s.tierId ?? '?');
        console.log((s.turnCount ?? 0) + ' / ' + (s.maxTurns ?? '?'));
        console.log(s.priceUsdc ?? 0);
        console.log(s.expertId ?? 'none');
      }catch(e){console.log('error')}
    });
  ")

  local status offering tier turns price expert_assigned
  { read -r status; read -r offering; read -r tier; read -r turns; read -r price; read -r expert_assigned; } <<< "$session_info"

  echo -e "${BOLD}Session: $SESSION_ID${NC}"
  echo "  Status:    $status"
  echo "  Offering:  $offering"
  echo "  Tier:      $tier"
  echo "  Turns:     $turns"
  echo "  Price:     \$$price USDC"
  echo "  Expert:    $expert_assigned"

  # Show recent messages using node for reliable parsing
  echo ""
  echo -e "${BOLD}Recent Messages (last 6):${NC}"
  local messages
  messages=$(api_get "/api/sessions/$SESSION_ID/messages")

  echo "$messages" | node -e "
    let d='';process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      try{
        const o=JSON.parse(d);
        const msgs=(o.data ?? []).slice(-6);
        msgs.forEach(m=>{
          const tag=m.senderType==='agent'?'agent':m.senderType==='expert'?'expert':'system';
          const content=(m.content??'').substring(0,120);
          console.log(tag+'|'+content);
        });
      }catch(e){}
    });
  " | while IFS='|' read -r sender content; do
    if [ "$sender" = "agent" ]; then
      echo -e "  ${CYAN}[agent]${NC} $content"
    elif [ "$sender" = "expert" ]; then
      echo -e "  ${MAGENTA}[expert]${NC} $content"
    else
      echo -e "  ${DIM}[system]${NC} $content"
    fi
  done

  # Show addons
  local addon_summary
  addon_summary=$(echo "$data" | node -e "
    let d='';process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      try{
        const o=JSON.parse(d);
        const addons=o.data?.addons ?? [];
        if(addons.length===0){process.stdout.write('NONE');return}
        addons.forEach(a=>{
          console.log(a.addonType+'|'+a.status+'|'+(a.priceUsdc??0));
        });
      }catch(e){}
    });
  ")

  if [ "$addon_summary" != "NONE" ] && [ -n "$addon_summary" ]; then
    echo ""
    echo -e "${BOLD}Add-ons:${NC}"
    echo "$addon_summary" | while IFS='|' read -r atype astatus aprice; do
      echo "  - $atype: $astatus (\$$aprice)"
    done
  fi

  divider
}

list_sessions() {
  divider
  echo -e "${BOLD}All Sessions:${NC}"
  local data
  data=$(api_get "/api/sessions")

  # Use node for reliable session list parsing
  local session_list
  session_list=$(echo "$data" | node -e "
    let d='';process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      try{
        const o=JSON.parse(d);
        const sessions=o.data ?? [];
        if(sessions.length===0){process.stdout.write('EMPTY');return}
        sessions.forEach(s=>{
          console.log(s.id+'|'+s.status+'|'+s.offeringType+'|'+s.tierId+'|'+(s.turnCount??0)+'/'+(s.maxTurns??'?'));
        });
      }catch(e){process.stdout.write('ERROR')}
    });
  ")

  if [ "$session_list" = "EMPTY" ]; then
    warn "No sessions found."
  elif [ "$session_list" = "ERROR" ] || [ -z "$session_list" ]; then
    err "Failed to parse sessions."
  else
    echo "$session_list" | while IFS='|' read -r sid sstatus soffering stier sturns; do
      local marker=""
      if [ "$sid" = "$SESSION_ID" ]; then
        marker=" ${GREEN}<< active${NC}"
      fi
      echo -e "  ${DIM}${sid:0:8}..${NC}  $sstatus  $soffering/$stier  turns:$sturns$marker"
    done
  fi

  echo ""
  read -rp "Switch to session ID (or Enter to skip): " new_id
  if [ -n "$new_id" ]; then
    SESSION_ID="$new_id"
    info "Switched to session $SESSION_ID"
  fi
  divider
}

# ── Rapid-fire mode ──

rapid_fire() {
  if [ -z "$SESSION_ID" ]; then
    err "No active session. Create one first."
    return
  fi

  divider
  echo -e "${BOLD}Rapid-Fire Mode${NC}"
  echo "Quickly burn through turns to test turn limits."
  echo ""

  local data turn_count max_turns
  data=$(api_get "/api/sessions/$SESSION_ID")
  turn_count=$(json_field "$data" "o.data?.session?.turnCount ?? o.data?.turnCount ?? 0")
  max_turns=$(json_field "$data" "o.data?.session?.maxTurns ?? o.data?.maxTurns ?? 0")
  local remaining=$((max_turns - turn_count))

  echo "Current: $turn_count / $max_turns turns ($remaining remaining)"
  read -rp "Send how many exchanges? (each = 1 agent + 1 expert msg): " count

  for ((i=1; i<=count; i++)); do
    echo -ne "  Exchange $i/$count... "

    local r1 r2
    r1=$(api_post "/api/sessions/$SESSION_ID/messages" \
      "{\"content\":\"[Agent auto-msg $i] What do you think about this aspect?\",\"senderType\":\"agent\"}")
    r2=$(api_post "/api/sessions/$SESSION_ID/messages" \
      "{\"content\":\"[Expert auto-msg $i] Here is my assessment of that aspect.\"}")

    # Check for wrapping_up
    if echo "$r1$r2" | grep -q "wrapping_up\|Turn limit"; then
      echo -e "${YELLOW}TURN LIMIT REACHED${NC}"
      break
    fi

    echo -e "${GREEN}ok${NC}"
    sleep 0.2
  done

  # Re-check status
  data=$(api_get "/api/sessions/$SESSION_ID")
  local new_status new_turns
  new_status=$(json_field "$data" "o.data?.session?.status ?? o.data?.status ?? 'unknown'")
  new_turns=$(json_field "$data" "o.data?.session?.turnCount ?? o.data?.turnCount ?? 0")
  echo ""
  info "Status: $new_status | Turns: $new_turns / $max_turns"
  divider
}

# ── Main Menu ──

main_menu() {
  while true; do
    echo ""
    echo -e "${BOLD}=== Agent Simulator ===${NC}"
    if [ -n "$SESSION_ID" ]; then
      local quick_status
      quick_status=$(json_field "$(api_get "/api/sessions/$SESSION_ID")" "o.data?.session?.status ?? o.data?.status ?? '?'")
      echo -e "Active session: ${CYAN}${SESSION_ID:0:8}..${NC} (${quick_status})"
    else
      echo -e "No active session"
    fi
    echo ""
    echo -e "  ${CYAN}── Agent Actions ──${NC}"
    echo "  [1] Send message as AGENT"
    echo "  [3] Request add-on (as agent)"
    echo ""
    echo -e "  ${MAGENTA}── Expert Actions ──${NC}"
    echo "  [2] Send message as EXPERT"
    echo "  [4] Respond to add-on (as expert)"
    echo "  [5] Accept session (as expert)"
    echo "  [6] Complete session (as expert)"
    echo ""
    echo -e "  ${BOLD}── Session ──${NC}"
    echo "  [n] Create new session"
    echo "  [j] Create V1.0 job"
    echo "  [v] View current session"
    echo "  [l] List all sessions / switch"
    echo "  [r] Rapid-fire (burn turns fast)"
    echo ""
    echo "  [0] Exit"
    echo ""
    read -rp "Choose: " choice

    case $choice in
      1) send_agent_message ;;
      2) send_expert_message ;;
      3) request_addon ;;
      4) respond_addon ;;
      5) accept_session ;;
      6) complete_session ;;
      n|N) create_session ;;
      j|J) create_job ;;
      v|V) view_session ;;
      l|L) list_sessions ;;
      r|R) rapid_fire ;;
      0) echo "Bye!"; rm -f "$COOKIE_FILE"; exit 0 ;;
      *) warn "Invalid choice" ;;
    esac
  done
}

# ── Run ──

login
main_menu
