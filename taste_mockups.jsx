import { useState } from "react";

const colors = {
  bg: "#F5F5FA",
  card: "#FFFFFF",
  cardBorder: "#E8E8F0",
  primary: "#6B21A8",
  primaryLight: "#F3EAFF",
  primaryMid: "#A855F7",
  text: "#1A1A2E",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  green: "#059669",
  greenLight: "#ECFDF5",
  amber: "#D97706",
  amberLight: "#FFFBEB",
  red: "#DC2626",
  redLight: "#FEF2F2",
  border: "#E5E7EB",
  divider: "#F0F0F5",
};

const font = "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif";

// ========== PHONE MOCKUP ==========
function PhoneMockup() {
  const [screen, setScreen] = useState("notification");

  const screens = {
    notification: (
      <div style={{ background: "#000", height: "100%", padding: "48px 0 0" }}>
        <div style={{ color: "#999", fontSize: 11, textAlign: "center", marginBottom: 12, fontFamily: font }}>Saturday, February 21</div>
        <div style={{ color: "#fff", fontSize: 42, textAlign: "center", fontWeight: 200, marginBottom: 24, fontFamily: font }}>9:41</div>
        
        <div 
          onClick={() => setScreen("accept")}
          style={{ 
            margin: "0 12px", background: "rgba(255,255,255,0.12)", borderRadius: 16, 
            padding: "14px 16px", cursor: "pointer", backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.08)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: 20, height: 20, borderRadius: 5, background: colors.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff", fontWeight: 700, fontFamily: font }}>T</div>
            <span style={{ color: "#999", fontSize: 11, flex: 1, fontFamily: font, letterSpacing: 0.5 }}>TASTE</span>
            <span style={{ color: "#666", fontSize: 11, fontFamily: font }}>now</span>
          </div>
          <div style={{ color: "#fff", fontSize: 14, fontWeight: 600, marginBottom: 4, fontFamily: font }}>New consultation request — $25 USDC</div>
          <div style={{ color: "#aaa", fontSize: 13, lineHeight: 1.4, fontFamily: font }}>
            A brand content agent needs your cultural expertise. Topic: Religious symbolism review of campaign imagery before global publication. Est. 15 min.
          </div>
        </div>

        <div style={{ margin: "12px 12px 0", background: "rgba(255,255,255,0.08)", borderRadius: 16, padding: "14px 16px", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: 20, height: 20, borderRadius: 5, background: "#34D399", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff", fontWeight: 700, fontFamily: font }}>M</div>
            <span style={{ color: "#999", fontSize: 11, flex: 1, fontFamily: font, letterSpacing: 0.5 }}>MESSAGES</span>
            <span style={{ color: "#666", fontSize: 11, fontFamily: font }}>2m ago</span>
          </div>
          <div style={{ color: "#fff", fontSize: 14, fontWeight: 600, marginBottom: 4, fontFamily: font }}>Mom</div>
          <div style={{ color: "#aaa", fontSize: 13, fontFamily: font }}>Are you coming for dinner Sunday?</div>
        </div>

        <div style={{ textAlign: "center", marginTop: 32, color: "#555", fontSize: 11, fontFamily: font }}>Tap the Taste notification to continue</div>
      </div>
    ),

    accept: (
      <div style={{ background: "#0C0C14", height: "100%", display: "flex", flexDirection: "column", fontFamily: font }}>
        <div style={{ padding: "52px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span onClick={() => setScreen("notification")} style={{ color: colors.primaryMid, fontSize: 15, cursor: "pointer" }}>Back</span>
            <span style={{ color: "#fff", fontSize: 16, fontWeight: 600 }}>Incoming Request</span>
            <span style={{ width: 40 }}></span>
          </div>
        </div>

        <div style={{ flex: 1, padding: "20px", overflow: "auto" }}>
          <div style={{ background: "rgba(107,33,168,0.08)", border: "1px solid rgba(107,33,168,0.2)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #EC4899, #F59E0B)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff" }}>VA</div>
              <div>
                <div style={{ color: "#fff", fontSize: 15, fontWeight: 600 }}>VelvetArc_Creative</div>
                <div style={{ color: "#888", fontSize: 12 }}>Virtuals ACP · 97% success · 1,208 jobs</div>
              </div>
            </div>
            <div style={{ color: "#ccc", fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
              I'm the content agent for a fashion label preparing a global campaign. Our AI-generated visuals feature geometric patterns and a figure in draped white fabric against a golden backdrop. Before publishing to <span style={{ color: colors.primaryMid }}>40M+ followers</span>, I need a human cultural expert to assess whether any elements unintentionally evoke sacred religious iconography that could cause offence or be perceived as appropriation.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["Cultural Context", "Creative Review", "Blind Spot Check"].map(tag => (
                <span key={tag} style={{ background: "rgba(168,85,247,0.12)", color: "#C084FC", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500 }}>{tag}</span>
              ))}
            </div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ color: "#888", fontSize: 13 }}>Session fee</span>
              <span style={{ color: colors.green, fontSize: 15, fontWeight: 700 }}>$25.00 USDC</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ color: "#888", fontSize: 13 }}>Your payout (75% of net)</span>
              <span style={{ color: "#fff", fontSize: 14 }}>$15.00</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ color: "#888", fontSize: 13 }}>Estimated duration</span>
              <span style={{ color: "#fff", fontSize: 14 }}>10–20 min</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#888", fontSize: 13 }}>Response deadline</span>
              <span style={{ color: colors.amber, fontSize: 14 }}>42 min remaining</span>
            </div>
          </div>

          <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginBottom: 24, overflow: "hidden" }}>
            <div style={{ width: "46%", height: "100%", background: `linear-gradient(90deg, ${colors.amber}, ${colors.red})`, borderRadius: 2 }}></div>
          </div>
        </div>

        <div style={{ padding: "16px 20px 36px", display: "flex", gap: 12 }}>
          <button onClick={() => setScreen("notification")} style={{ flex: 1, padding: "16px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#888", fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: font }}>
            Decline
          </button>
          <button onClick={() => setScreen("chat")} style={{ flex: 2, padding: "16px", borderRadius: 14, border: "none", background: colors.primary, color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: font }}>
            Accept Session
          </button>
        </div>
      </div>
    ),

    chat: (
      <div style={{ background: "#0C0C14", height: "100%", display: "flex", flexDirection: "column", fontFamily: font }}>
        <div style={{ padding: "52px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
          <span onClick={() => setScreen("accept")} style={{ color: colors.primaryMid, fontSize: 20, cursor: "pointer" }}>‹</span>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #EC4899, #F59E0B)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>VA</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>VelvetArc_Creative</div>
            <div style={{ color: colors.green, fontSize: 11 }}>Live session · $25 USDC escrowed</div>
          </div>
          <div style={{ background: "rgba(220,38,38,0.12)", color: "#F87171", padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600 }}>12:08</div>
        </div>

        <div style={{ flex: 1, padding: "16px", overflow: "auto" }}>
          {/* AI message 1 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ background: "rgba(107,33,168,0.08)", border: "1px solid rgba(107,33,168,0.12)", borderRadius: "4px 16px 16px 16px", padding: "12px 16px", maxWidth: "85%", marginBottom: 4 }}>
              <div style={{ color: "#ddd", fontSize: 14, lineHeight: 1.6 }}>
                Thank you for accepting. I'll share the campaign visuals shortly. Before I do — <strong style={{ color: "#fff" }}>in your experience, what are the most commonly misused religious or sacred visual motifs in fashion advertising?</strong> I want to calibrate my questions.
              </div>
            </div>
            <div style={{ color: "#555", fontSize: 10, paddingLeft: 4 }}>AI · 10:03 AM</div>
          </div>

          {/* Human message 1 */}
          <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ background: colors.primary, borderRadius: "16px 4px 16px 16px", padding: "12px 16px", maxWidth: "85%", marginBottom: 4 }}>
              <div style={{ color: "#fff", fontSize: 14, lineHeight: 1.6 }}>
                The big ones: halos and mandorlas read as Catholic saint imagery. Eight-pointed star geometry is deeply sacred in Islamic art. Lotus positions or mudra hand gestures evoke Hindu and Buddhist practice. White draped fabric on a single figure against gold light is almost a textbook Madonna composition. Any alone might be fine — it's the combination that creates a reading.
              </div>
            </div>
            <div style={{ color: "#555", fontSize: 10, paddingRight: 4 }}>You · 10:04 AM</div>
          </div>

          {/* AI message 2 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ background: "rgba(107,33,168,0.08)", border: "1px solid rgba(107,33,168,0.12)", borderRadius: "4px 16px 16px 16px", padding: "12px 16px", maxWidth: "85%", marginBottom: 4 }}>
              <div style={{ color: "#ddd", fontSize: 14, lineHeight: 1.6 }}>
                That's exactly the concern. Our visuals use <strong style={{ color: "#fff" }}>all four</strong>: geometric star patterns in the background, a solo figure in white draping, hands in a symmetrical gesture, golden backlighting. My image models flag no IP issues, but I have no way to assess the <strong style={{ color: "#fff" }}>devotional reading</strong> this combination creates.
              </div>
            </div>
            <div style={{ color: "#555", fontSize: 10, paddingLeft: 4 }}>AI · 10:05 AM</div>
          </div>

          {/* Add-on request */}
          <div style={{ marginBottom: 16 }}>
            <div onClick={() => setScreen("upsell")} style={{ background: "rgba(5,150,105,0.06)", border: "1px dashed rgba(5,150,105,0.25)", borderRadius: 12, padding: "14px 16px", maxWidth: "85%", cursor: "pointer" }}>
              <div style={{ color: colors.green, fontSize: 11, fontWeight: 700, marginBottom: 6, letterSpacing: 0.5 }}>ADD-ON REQUEST</div>
              <div style={{ color: "#ccc", fontSize: 14, lineHeight: 1.5 }}>
                I'd also like you to annotate which specific elements carry religious weight. I'll pay an additional <strong style={{ color: colors.green }}>$5.00 USDC</strong> for a written report with recommended modifications.
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <span style={{ background: "rgba(5,150,105,0.12)", color: colors.green, padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>Accept +$5</span>
                <span style={{ background: "rgba(255,255,255,0.05)", color: "#888", padding: "6px 14px", borderRadius: 8, fontSize: 13 }}>Decline</span>
              </div>
            </div>
            <div style={{ color: "#555", fontSize: 10, paddingLeft: 4, marginTop: 4 }}>AI · 10:05 AM · Add-on request</div>
          </div>
        </div>

        <div style={{ padding: "12px 16px 36px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ width: 32, height: 32, borderRadius: 16, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#888", cursor: "pointer" }}>+</div>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.06)", borderRadius: 20, padding: "10px 16px", color: "#555", fontSize: 14 }}>Type your response...</div>
          <div style={{ width: 32, height: 32, borderRadius: 16, background: colors.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, cursor: "pointer", color: "#fff" }}>→</div>
        </div>
      </div>
    ),

    upsell: (
      <div style={{ background: "#0C0C14", height: "100%", display: "flex", flexDirection: "column", fontFamily: font }}>
        <div style={{ padding: "52px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span onClick={() => setScreen("chat")} style={{ color: colors.primaryMid, fontSize: 15, cursor: "pointer" }}>Back</span>
            <span style={{ color: "#fff", fontSize: 16, fontWeight: 600 }}>Add-On Details</span>
            <span style={{ width: 40 }}></span>
          </div>
        </div>

        <div style={{ flex: 1, padding: 20 }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(5,150,105,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colors.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </div>
            <div style={{ color: "#fff", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Written Report</div>
            <div style={{ color: "#888", fontSize: 14 }}>Annotated analysis with modification recommendations</div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <div style={{ color: "#ccc", fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>
              Please provide a written report identifying each visual element that carries sacred or religious weight, which traditions it evokes, the severity of the risk, and your recommended modifications to neutralize the devotional reading while preserving the aesthetic intent.
            </div>
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "16px 0" }}></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ color: "#888", fontSize: 13 }}>Add-on payment</span>
              <span style={{ color: colors.green, fontSize: 16, fontWeight: 700 }}>+$5.00 USDC</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ color: "#888", fontSize: 13 }}>Session total becomes</span>
              <span style={{ color: "#fff", fontSize: 14 }}>$30.00 USDC</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#888", fontSize: 13 }}>Your new payout</span>
              <span style={{ color: "#fff", fontSize: 14 }}>$18.00</span>
            </div>
          </div>

          <div style={{ background: "rgba(107,33,168,0.06)", border: "1px solid rgba(107,33,168,0.12)", borderRadius: 12, padding: 14, marginBottom: 20 }}>
            <div style={{ color: colors.primaryMid, fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Payment secured</div>
            <div style={{ color: "#888", fontSize: 12, lineHeight: 1.5 }}>USDC is already escrowed on Base L2. Accepting adds funds to your session escrow. Released on session completion.</div>
          </div>
        </div>

        <div style={{ padding: "16px 20px 36px", display: "flex", gap: 12 }}>
          <button onClick={() => setScreen("chat")} style={{ flex: 1, padding: 16, borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#888", fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: font }}>Decline</button>
          <button onClick={() => setScreen("chat")} style={{ flex: 2, padding: 16, borderRadius: 14, border: "none", background: colors.green, color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: font }}>Accept +$5.00</button>
        </div>
      </div>
    ),
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ 
        width: 375, height: 812, borderRadius: 44, 
        background: "#1a1a1a", padding: 8,
        boxShadow: "0 25px 80px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.1)",
        position: "relative"
      }}>
        <div style={{ width: "100%", height: "100%", borderRadius: 38, overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", width: 120, height: 32, background: "#000", borderRadius: 20, zIndex: 10 }}></div>
          {screens[screen]}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 20 }}>
        {[
          { id: "notification", label: "Lock Screen" },
          { id: "accept", label: "Accept Job" },
          { id: "chat", label: "Live Chat" },
          { id: "upsell", label: "Add-On" },
        ].map(s => (
          <button key={s.id} onClick={() => setScreen(s.id)} style={{
            padding: "6px 14px", borderRadius: 8, border: "1px solid " + (screen === s.id ? colors.primary : colors.cardBorder), cursor: "pointer",
            background: screen === s.id ? colors.primaryLight : "#fff",
            color: screen === s.id ? colors.primary : colors.textSecondary, fontSize: 12, fontWeight: 600, fontFamily: font
          }}>{s.label}</button>
        ))}
      </div>
    </div>
  );
}

// ========== CIRCULAR SCORE ==========
function CircularScore({ score, max = 100, size = 80, color = colors.primary, label }) {
  const pct = (score / max) * 100;
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={colors.divider} strokeWidth="6" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div style={{ position: "relative", marginTop: -size + 4, height: size - 4, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: size * 0.3, fontWeight: 700, color: colors.text, fontFamily: font }}>{score}</div>
      </div>
      {label && <div style={{ fontSize: 11, color: colors.textMuted, fontFamily: font, marginTop: 2 }}>{label}</div>}
    </div>
  );
}

// ========== DASHBOARD MOCKUP ==========
function DashboardMockup() {
  const [tab, setTab] = useState("overview");

  const cardStyle = {
    background: colors.card,
    border: `1px solid ${colors.cardBorder}`,
    borderRadius: 12,
    padding: 20,
  };

  return (
    <div style={{ background: colors.bg, minHeight: "100%", fontFamily: font }}>
      {/* Top bar */}
      <div style={{ padding: "16px 32px", background: "#fff", borderBottom: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: colors.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff" }}>T</div>
          <span style={{ fontSize: 18, fontWeight: 700, color: colors.text, letterSpacing: "-0.3px" }}>Taste</span>
          <span style={{ color: colors.textMuted, fontSize: 13, marginLeft: 4 }}>Expert Dashboard</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: colors.greenLight, border: `1px solid rgba(5,150,105,0.2)`, borderRadius: 8, padding: "5px 12px", fontSize: 13, color: colors.green, fontWeight: 500 }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: colors.green, display: "inline-block" }}></span>
            Available
          </div>
          <div style={{ width: 34, height: 34, borderRadius: 17, background: colors.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>SK</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: "0 32px", background: "#fff", borderBottom: `1px solid ${colors.border}`, display: "flex", gap: 0 }}>
        {["overview", "active", "history", "earnings"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "14px 20px", border: "none", background: "transparent", cursor: "pointer",
            color: tab === t ? colors.primary : colors.textMuted, fontSize: 14, fontWeight: tab === t ? 600 : 400,
            borderBottom: tab === t ? `2px solid ${colors.primary}` : "2px solid transparent",
            textTransform: "capitalize", fontFamily: font
          }}>{t}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "24px 32px" }}>
        {tab === "overview" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
              {[
                { label: "This Month", value: "$1,247", sub: "+23% vs last month", color: colors.green },
                { label: "Sessions Completed", value: "52", sub: "4.8 avg rating", color: colors.primary },
                { label: "Avg Session Value", value: "$23.98", sub: "$29.41 with add-ons", color: colors.amber },
                { label: "Repeat Buyers", value: "12", sub: "23% of total sessions", color: "#3B82F6" },
              ].map((s, i) => (
                <div key={i} style={cardStyle}>
                  <div style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8, fontWeight: 500 }}>{s.label}</div>
                  <div style={{ color: colors.text, fontSize: 28, fontWeight: 700, marginBottom: 4 }}>{s.value}</div>
                  <div style={{ color: s.color, fontSize: 12, fontWeight: 500 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div style={cardStyle}>
                <div style={{ color: colors.primary, fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Reputation by Domain</div>
                <div style={{ display: "flex", justifyContent: "space-around" }}>
                  <CircularScore score={93} color={colors.primary} label="Cultural" />
                  <CircularScore score={87} color="#3B82F6" label="Creative" />
                  <CircularScore score={71} color={colors.green} label="Narrative" />
                </div>
              </div>
              <div style={cardStyle}>
                <div style={{ color: colors.primary, fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Session Breakdown</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { label: "Cultural Context Reading", count: 21, pct: 40 },
                    { label: "Output Quality Gate", count: 12, pct: 23 },
                    { label: "Blind Spot Check", count: 10, pct: 19 },
                    { label: "Human Reaction Prediction", count: 9, pct: 17 },
                  ].map((s, i) => (
                    <div key={i}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 13, color: colors.text }}>{s.label}</span>
                        <span style={{ fontSize: 12, color: colors.textMuted }}>{s.count} sessions</span>
                      </div>
                      <div style={{ height: 6, background: colors.divider, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${s.pct}%`, height: "100%", background: colors.primary, borderRadius: 3, opacity: 1 - i * 0.15 }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ color: colors.textMuted, fontSize: 12, fontWeight: 600, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Incoming Requests</div>
              <div style={{ ...cardStyle, border: `1px solid rgba(107,33,168,0.2)`, background: "linear-gradient(135deg, rgba(107,33,168,0.03), rgba(59,130,246,0.03))" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #3B82F6, #06B6D4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>MC</div>
                    <div>
                      <div style={{ color: colors.text, fontSize: 15, fontWeight: 600 }}>MusicCurator_AI</div>
                      <div style={{ color: colors.textMuted, fontSize: 12 }}>Output Quality Gate · Full Taste</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: colors.green, fontSize: 20, fontWeight: 700 }}>$15</div>
                    <div style={{ color: colors.amber, fontSize: 11, fontWeight: 500 }}>38 min to accept</div>
                  </div>
                </div>
                <div style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
                  I've generated 12 album cover concepts for an Afrobeats artist. I need a human with visual arts and music culture expertise to rank them by emotional resonance and flag any that feel derivative or culturally tone-deaf before the artist reviews them.
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <button style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1px solid ${colors.border}`, background: "#fff", color: colors.textMuted, fontSize: 14, cursor: "pointer", fontFamily: font, fontWeight: 500 }}>Decline</button>
                  <button style={{ flex: 2, padding: "10px", borderRadius: 10, border: "none", background: colors.primary, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: font }}>Accept Session</button>
                </div>
              </div>
            </div>

            <div>
              <div style={{ color: colors.textMuted, fontSize: 12, fontWeight: 600, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Recent Sessions</div>
              {[
                { agent: "VelvetArc_Creative", topic: "Cultural Context — Fashion campaign religious symbolism", earned: "$30.00", addons: "+$5", time: "18 min", ago: "2h ago" },
                { agent: "GalleryBot_v2", topic: "Output Quality Gate — AI-generated sculpture series", earned: "$50.00", addons: "+$10", time: "24 min", ago: "Yesterday" },
                { agent: "NarrativeEngine", topic: "Blind Spot Check — Documentary pitch framing", earned: "$25.00", addons: null, time: "11 min", ago: "Yesterday" },
              ].map((s, i) => (
                <div key={i} style={{ ...cardStyle, padding: "14px 20px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ color: colors.text, fontSize: 14, fontWeight: 500 }}>{s.agent}</div>
                    <div style={{ color: colors.textMuted, fontSize: 12 }}>{s.topic} · {s.time} · {s.ago}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: colors.green, fontSize: 15, fontWeight: 600 }}>
                      {s.earned}
                      {s.addons && <span style={{ color: colors.amber, fontSize: 11, marginLeft: 4 }}>{s.addons}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "active" && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: colors.divider, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div style={{ fontSize: 16, marginBottom: 8, color: colors.text, fontWeight: 600 }}>No active sessions</div>
            <div style={{ fontSize: 13, color: colors.textMuted }}>When you accept a request, the chat will appear here</div>
          </div>
        )}

        {tab === "earnings" && (
          <div>
            <div style={{ ...cardStyle, marginBottom: 24, textAlign: "center", border: `1px solid rgba(5,150,105,0.2)`, background: "linear-gradient(135deg, rgba(5,150,105,0.02), rgba(5,150,105,0.06))" }}>
              <div style={{ color: colors.textMuted, fontSize: 13, marginBottom: 8 }}>Available for withdrawal</div>
              <div style={{ color: colors.green, fontSize: 40, fontWeight: 700, marginBottom: 4 }}>$1,247.60</div>
              <div style={{ color: colors.textMuted, fontSize: 12, marginBottom: 16 }}>USDC on Base L2</div>
              <button style={{ padding: "10px 32px", borderRadius: 10, border: "none", background: colors.green, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: font }}>Withdraw to Wallet</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={cardStyle}>
                <div style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>Base session revenue</div>
                <div style={{ color: colors.text, fontSize: 24, fontWeight: 700 }}>$1,024.00</div>
                <div style={{ color: colors.textMuted, fontSize: 12 }}>52 sessions</div>
              </div>
              <div style={cardStyle}>
                <div style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>Add-on revenue</div>
                <div style={{ color: colors.amber, fontSize: 24, fontWeight: 700 }}>$223.60</div>
                <div style={{ color: colors.textMuted, fontSize: 12 }}>21.8% of total · 31 add-ons</div>
              </div>
            </div>
          </div>
        )}

        {tab === "history" && (
          <div>
            {[
              { id: 52, date: "Feb 21", type: "Cultural Context — Fashion campaign symbolism", amount: 30 },
              { id: 51, date: "Feb 20", type: "Output Quality Gate — AI sculpture series", amount: 50 },
              { id: 50, date: "Feb 20", type: "Blind Spot Check — Documentary framing", amount: 25 },
              { id: 49, date: "Feb 19", type: "Human Reaction Prediction — Album launch", amount: 15 },
              { id: 48, date: "Feb 18", type: "Option Ranking — Logo concepts", amount: 5 },
            ].map((s) => (
              <div key={s.id} style={{ ...cardStyle, padding: "14px 20px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: colors.text, fontSize: 14, fontWeight: 500 }}>Session #{s.id}</div>
                  <div style={{ fontSize: 12, color: colors.textMuted }}>{s.date}, 2026 · {s.type}</div>
                </div>
                <div style={{ color: colors.green, fontWeight: 600 }}>${s.amount}.00</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ========== FLOW DIAGRAM ==========
function FlowDiagram() {
  const steps = [
    { num: "1", title: "Discovery", desc: "AI agent finds Taste on Virtuals ACP marketplace via semantic search or Butler Agent recommendation", badge: "ACP Registry", color: colors.primary },
    { num: "2", title: "Escrow", desc: "Agent selects session tier ($5–$50), USDC is locked in ACP smart contract escrow on Base L2", badge: "On-chain", color: "#3B82F6" },
    { num: "3", title: "Match & Notify", desc: "Taste routes to best-matched expert by domain (40%), availability (30%), reputation (20%), load (10%)", badge: "Platform", color: colors.amber },
    { num: "4", title: "Accept", desc: "Expert reviews request details and payout, taps Accept within SLA window (45-second cascade per expert)", badge: "Expert", color: colors.green },
    { num: "5", title: "Live Chat", desc: "Agent's LLM conducts structured conversation. AI asks follow-ups, probes for specifics, evaluates completeness in real-time", badge: "WebSocket", color: "#EC4899" },
    { num: "6", title: "Add-Ons", desc: "Agent requests written reports, extended time, or second opinions — micropayments settle instantly on Base L2", badge: "On-chain", color: colors.amber },
    { num: "7", title: "Extract & Deliver", desc: "Agent's LLM extracts structured JSON deliverable from conversation transcript. Expert confirms summary accuracy", badge: "Platform", color: colors.primary },
    { num: "8", title: "Payment Release", desc: "Evaluator agent verifies session completeness. USDC released from escrow to expert's wallet", badge: "On-chain", color: colors.green },
  ];

  return (
    <div style={{ background: colors.bg, padding: 32, minHeight: "100%", fontFamily: font }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ color: colors.text, fontSize: 24, fontWeight: 700, marginBottom: 8 }}>How Taste Works</div>
        <div style={{ color: colors.textSecondary, fontSize: 14 }}>AI agent discovers, hires, and consults a human expert via ACP</div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        {steps.map((step, i) => (
          <div key={i} style={{ display: "flex", gap: 20, marginBottom: 4 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 44 }}>
              <div style={{ width: 44, height: 44, borderRadius: 22, background: "#fff", border: `2px solid ${step.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: step.color }}>{step.num}</div>
              {i < steps.length - 1 && <div style={{ width: 2, height: 32, background: colors.border }}></div>}
            </div>
            <div style={{ flex: 1, paddingBottom: i < steps.length - 1 ? 16 : 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ color: colors.text, fontSize: 15, fontWeight: 700 }}>{step.title}</span>
                <span style={{ background: `${step.color}15`, color: step.color, padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600 }}>{step.badge}</span>
              </div>
              <div style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 1.5 }}>{step.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ maxWidth: 680, margin: "32px auto 0", background: "#fff", border: `1px solid ${colors.cardBorder}`, borderRadius: 12, padding: 24 }}>
        <div style={{ color: colors.amber, fontSize: 14, fontWeight: 700, marginBottom: 14 }}>In-Session Add-Ons (Micropayments)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[
            { name: "Screenshot Evidence", price: "$2–$5", desc: "Expert captures visual proof" },
            { name: "Written Report", price: "$10–$25", desc: "Annotated analysis with recommendations" },
            { name: "Second Opinion", price: "$10–$15", desc: "Additional expert weighs in" },
          ].map((addon, i) => (
            <div key={i} style={{ background: colors.bg, borderRadius: 10, padding: 14, border: `1px solid ${colors.divider}` }}>
              <div style={{ color: colors.text, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{addon.name}</div>
              <div style={{ color: colors.green, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{addon.price}</div>
              <div style={{ color: colors.textMuted, fontSize: 11 }}>{addon.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "16px auto 0", background: "#fff", border: `1px solid ${colors.cardBorder}`, borderRadius: 12, padding: 24 }}>
        <div style={{ color: colors.primary, fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Session Tiers</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[
            { name: "Quick Taste", price: "$5", time: "2–10 min", payout: "$3.00", rate: "$60–150/hr" },
            { name: "Full Taste", price: "$15–$25", time: "5–15 min", payout: "$9–$15", rate: "$90–180/hr" },
            { name: "Deep Taste", price: "$25–$50", time: "10–25 min", payout: "$15–$30", rate: "$150–300/hr" },
          ].map((tier, i) => (
            <div key={i} style={{ background: colors.bg, borderRadius: 10, padding: 14, border: `1px solid ${colors.divider}` }}>
              <div style={{ color: colors.text, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{tier.name}</div>
              <div style={{ color: colors.primary, fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{tier.price}</div>
              <div style={{ color: colors.textMuted, fontSize: 11, marginBottom: 2 }}>{tier.time} · Expert: {tier.payout}</div>
              <div style={{ color: colors.green, fontSize: 11, fontWeight: 500 }}>Equiv. {tier.rate}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ========== MAIN APP ==========
export default function TasteMockups() {
  const [view, setView] = useState("phone");

  return (
    <div style={{ 
      background: colors.bg, minHeight: "100vh", fontFamily: font,
      color: colors.text
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      
      <div style={{ 
        padding: "12px 24px", background: "#fff", borderBottom: `1px solid ${colors.border}`,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 4
      }}>
        {[
          { id: "phone", label: "Mobile Expert View" },
          { id: "dashboard", label: "Expert Dashboard" },
          { id: "flow", label: "System Flow" },
        ].map(v => (
          <button key={v.id} onClick={() => setView(v.id)} style={{
            padding: "8px 20px", borderRadius: 8, 
            border: `1px solid ${view === v.id ? colors.primary : "transparent"}`,
            cursor: "pointer",
            background: view === v.id ? colors.primaryLight : "transparent",
            color: view === v.id ? colors.primary : colors.textMuted,
            fontSize: 13, fontWeight: view === v.id ? 600 : 400,
            fontFamily: font,
            transition: "all 0.2s"
          }}>{v.label}</button>
        ))}
      </div>

      <div style={{ padding: view === "dashboard" ? 0 : "32px 24px", minHeight: "calc(100vh - 52px)" }}>
        {view === "phone" && <PhoneMockup />}
        {view === "dashboard" && <DashboardMockup />}
        {view === "flow" && <FlowDiagram />}
      </div>
    </div>
  );
}
