# Taste — Offering Descriptions for ACP Registration

---

## 1. project_vibes_check

### Requirements
Project name (required), token/contract address, social media links, and any specific question you want the expert to focus on.

### Deliverables
Structured verdict (genuine/suspicious/manufactured/mixed), confidence score 0-1, detailed reasoning, red flags, positive signals, expert domain attribution, and legal disclaimer.

### Sample Request
```json
{"projectName":"PudgyPenguins","tokenAddress":"0x524cab2ec69124574082676e6f654a18df49a048","socialLinks":["https://twitter.com/pudgypenguins","https://discord.gg/pudgypenguins"],"specificQuestion":"Is the recent community growth organic or driven by paid engagement?"}
```

### Sample Deliverable
```json
{"verdict":"genuine","confidence":0.82,"reasoning":"Community growth aligns with NFT floor price recovery and IP licensing deals. Engagement patterns show organic discussion rather than bot-driven activity. Walmart partnership announcement drove a measurable spike in new Discord members with genuine conversation.","redFlags":["Some repetitive shill posts on Twitter from low-follower accounts"],"positiveSignals":["Active long-term holders in Discord","Organic meme creation","Developer activity on GitHub"],"expertDomain":"crypto","disclaimer":"This is a qualitative opinion only, not financial or investment advice."}
```

---

## 2. narrative_assessment

### Requirements
The narrative or trend to assess (required), surrounding context, and any related token names or tickers.

### Deliverables
Structured verdict on narrative strength, confidence score 0-1, detailed reasoning, estimated time horizon, potential catalysts, expert attribution, and legal disclaimer.

### Sample Request
```json
{"narrative":"AI agent tokens as the next major crypto narrative","context":"Multiple AI agent platforms launching tokens in Q1 2026, significant VC funding flowing into AI x crypto intersection","relatedTokens":["VIRTUAL","AI16Z","GRIFFAIN"]}
```

### Sample Deliverable
```json
{"verdict":"Strong narrative with real technical backing but frothy valuations. The underlying trend of autonomous agents transacting onchain is legitimate, though most current tokens are trading on hype rather than actual agent usage metrics.","confidence":0.71,"reasoning":"Developer activity is genuine across several projects. However, token prices have front-run actual adoption by a wide margin. The narrative has cultural momentum on CT but retail interest metrics lag behind previous cycles.","timeHorizon":"3-6 months for narrative peak, 12+ months for fundamental adoption","catalysts":["Major protocol integrating agent payments","First agent-to-agent commerce at scale","Regulatory clarity on autonomous transactions"],"disclaimer":"This is a qualitative opinion only, not financial or investment advice."}
```

---

## 3. creative_art_review

### Requirements
One or more content URLs (`contentUrl` for single item, `contentUrls` array for 1-4 items). Content type: music, visual, writing, or design (required). Review type: `compare` or `feedback` (defaults to feedback). Optional context about the piece(s).

### Deliverables
**Compare mode:** Winner (Content A/B/C/D label), rankings array, comparison notes, and reasoning.
**Feedback mode:** Verdict, quality score 0-10, originality assessment, technical merit, reasoning, and optional improvements list.
Both include expert attribution and legal disclaimer.

### Sample Request — Feedback Mode (single item, backward compatible)
```json
{"contentUrl":"https://ipfs.io/ipfs/QmExampleHash/artwork.png","contentType":"visual","context":"Submitted as PFP art for a new NFT collection claiming to be hand-drawn, 10k supply"}
```

### Sample Deliverable — Feedback Mode
```json
{"verdict":"AI-generated base with moderate human post-processing. The line work and shading patterns are consistent with Midjourney v6 outputs, though color grading and composition adjustments were likely done manually.","qualityScore":5,"originality":"Low originality. The style closely mimics existing successful PFP collections without a distinctive visual identity. Trait variation appears algorithmically generated.","technicalMerit":"Competent execution but lacks the subtle imperfections and intentional choices that characterize hand-drawn work. Consistent rendering quality across samples suggests automated generation pipeline.","reasoning":"While the final output is visually polished, the claim of hand-drawn origin is not supported by the evidence.","improvements":["Develop a more distinctive art style that doesn't closely mirror existing collections","Add intentional imperfections and hand-drawn flourishes to support the hand-drawn claim","Increase trait variation beyond what algorithmic generation typically produces"],"disclaimer":"This is a qualitative opinion only, not financial or investment advice."}
```

### Sample Request — Feedback Mode (multi-item)
```json
{"contentUrls":["https://i.imgur.com/albumcoverA.png","https://i.imgur.com/albumcoverB.png"],"contentType":"visual","reviewType":"feedback","context":"Two album cover drafts for an indie artist's debut EP"}
```

### Sample Request — Compare Mode
```json
{"contentUrls":["https://i.imgur.com/logoV1.png","https://i.imgur.com/logoV2.png","https://i.imgur.com/logoV3.png"],"contentType":"design","reviewType":"compare","context":"Three logo variations for a DeFi protocol rebrand"}
```

### Sample Deliverable — Compare Mode
```json
{"winner":"Content B","rankings":["Content B","Content A","Content C"],"comparisonNotes":"Content B achieves the best balance of recognizability and modern aesthetics. Content A is technically competent but feels generic. Content C is the most creative but may not scale well to small sizes.","reasoning":"For a DeFi protocol, the logo needs to convey trust and technical sophistication while remaining memorable. Content B's geometric approach with the subtle gradient achieves this most effectively.","disclaimer":"This is a qualitative opinion only, not financial or investment advice."}
```

---

## 4. community_sentiment

### Requirements
Community name or project (required), platforms to evaluate (e.g. Twitter, Discord, Telegram), and timeframe to focus on.

### Deliverables
Overall sentiment assessment, authenticity evaluation, activity level analysis, detailed reasoning, comparisons to similar communities, expert attribution, and legal disclaimer.

### Sample Request
```json
{"community":"Monad","platforms":["Twitter","Discord"],"timeframe":"Last 30 days"}
```

### Sample Deliverable
```json
{"sentiment":"Highly positive with cult-like enthusiasm, though some fatigue emerging among long-term community members waiting for mainnet","authenticity":"Mostly organic. Core community of ~2k genuinely engaged members. Outer ring of ~15k followers shows some engagement farming patterns typical of airdrop hunters.","activityLevel":"Very high. Discord averages 3k+ messages/day. Twitter mentions sustained at elevated levels without paid promotion signals.","reasoning":"Monad has built one of the more authentic pre-launch communities in crypto. The meme culture is self-sustaining and internally generated rather than top-down manufactured. However, the airdrop expectation is inflating apparent community size.","comparisons":["Stronger organic engagement than Sei pre-launch","Similar cult dynamics to early Solana community","Less developer-focused than Aptos community was at equivalent stage"],"disclaimer":"This is a qualitative opinion only, not financial or investment advice."}
```

---

## 5. general_human_judgment

### Requirements
The question you need answered (required), relevant domain (required), supporting context, and urgency: standard or rush.

### Deliverables
Structured answer to the question, confidence score 0-1, detailed reasoning, caveats and limitations, expert attribution, and legal disclaimer.

### Sample Request
```json
{"question":"Is this whitepaper technically sound or does it contain fundamental flaws in its consensus mechanism design?","domain":"crypto","context":"New L1 claiming 100k TPS with novel BFT variant.","urgency":"standard"}
```

### Sample Deliverable
```json
{"answer":"The consensus mechanism described has a fundamental liveness issue. The proposed BFT variant assumes synchronous network conditions for its fast path but does not adequately handle the fallback to asynchronous mode. The 100k TPS claim appears to be based on optimistic single-shard throughput without accounting for cross-shard communication overhead.","confidence":0.78,"reasoning":"Section 4.2 describes a leader rotation scheme that can stall if more than f nodes experience network partitions simultaneously. The formal proof only covers the happy path. Similar designs required significant iteration to handle edge cases that this paper does not address.","caveats":["Review based on whitepaper only — implementation may differ","Testnet performance data not available for verification","Team may have unpublished solutions to identified issues"],"disclaimer":"This is a qualitative opinion only, not financial or investment advice."}
```
