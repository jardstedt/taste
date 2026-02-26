# Test Requests — 5 Per Offering

Realistic ACP job requests for manual testing. Each set covers diverse scenarios to exercise different aspects of the offering. Use these with the agent simulator (`scripts/agent-sim.sh`) or submit via the ACP SDK.

---

## 1. trust_evaluation

**1a. New memecoin with suspicious growth**
```json
{
  "projectName": "PEPE2.0",
  "tokenAddress": "0x1234567890abcdef1234567890abcdef12345678",
  "socialLinks": ["https://twitter.com/pepe2official", "https://t.me/pepe2community"],
  "specificQuestion": "Token went from 0 to $50M market cap in 3 days. Is the community organic or is this a coordinated pump?"
}
```

**1b. Established DeFi protocol with governance concerns**
```json
{
  "projectName": "Aave",
  "tokenAddress": "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9",
  "socialLinks": ["https://twitter.com/aabornyakov", "https://governance.aave.com"],
  "specificQuestion": "Recent governance proposals have been passing with very few unique voters. Is the governance being captured by a small group of whales?"
}
```

**1c. NFT project claiming real-world utility**
```json
{
  "projectName": "RealEstateDAO",
  "socialLinks": ["https://twitter.com/realdao_nft", "https://discord.gg/realdao"],
  "specificQuestion": "They claim each NFT is backed by fractional real estate ownership. Can you verify if the legal structure actually supports this or if it's marketing fluff?"
}
```

**1d. Validating automated token analysis**
```json
{
  "projectName": "VIRTUAL",
  "tokenAddress": "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b",
  "specificQuestion": "Our automated scanner flagged 3 wallets holding 15% of supply as potential insider wallets. Can a human verify whether these are team wallets, exchange wallets, or genuinely suspicious accumulation?"
}
```

**1e. Cross-chain bridge with security history**
```json
{
  "projectName": "Wormhole",
  "socialLinks": ["https://twitter.com/waborhole", "https://github.com/wormhole-foundation"],
  "specificQuestion": "After the $325M hack in 2022 they rebuilt. Is the current team credible? Have the security measures improved enough to trust with significant capital?"
}
```

---

## 2. output_quality_gate

**2a. Market intelligence report before trading**
```json
{
  "aiOutput": "Based on on-chain analysis, $VIRTUAL shows strong accumulation by smart money wallets. 3 wallets identified as early Uniswap deployers have accumulated 2.1M tokens in the past 7 days. The token's 30-day correlation with BTC has dropped to 0.31, suggesting it's decoupling from broader market trends. Recommendation: Moderate long position with 15% of portfolio allocation.",
  "outputType": "analysis",
  "intendedUse": "Autonomous trading decision — this report will directly trigger a buy order",
  "knownConstraints": "Must not contain fabricated wallet addresses or unverifiable on-chain claims"
}
```

**2b. Research report before publishing**
```json
{
  "aiOutput": "The Ethereum Dencun upgrade reduced L2 transaction costs by approximately 95%, with Base chain seeing fees drop from $0.15 to under $0.001. According to a Messari Q4 2025 report, L2 TVL grew 340% year-over-year. Arbitrum maintains market leadership with $18.2B in TVL, followed by Base at $12.6B and Optimism at $7.4B.",
  "outputType": "analysis",
  "intendedUse": "Weekly newsletter distributed to 5,000 subscribers",
  "knownConstraints": "All statistics must be verifiable. No forward-looking financial predictions."
}
```

**2c. Code review for smart contract**
```json
{
  "aiOutput": "function withdraw(uint256 amount) external {\n    require(balances[msg.sender] >= amount, 'Insufficient');\n    (bool success, ) = msg.sender.call{value: amount}('');\n    require(success, 'Transfer failed');\n    balances[msg.sender] -= amount;\n}",
  "outputType": "code",
  "intendedUse": "Production smart contract deployment on Base",
  "knownConstraints": "Must follow checks-effects-interactions pattern. No reentrancy vulnerabilities."
}
```

**2d. Customer response from support agent**
```json
{
  "aiOutput": "Thank you for reaching out! I understand your frustration with the delayed withdrawal. Our system shows your transaction was processed on February 24 but is awaiting final confirmation on the Ethereum network. This typically takes 12-24 hours during high congestion periods. If you don't see the funds by tomorrow, please contact us again and we'll escalate to our operations team. Your reference number is #TXN-2026-4851.",
  "outputType": "text",
  "intendedUse": "Direct reply to a customer complaint on support ticket",
  "knownConstraints": "Must be empathetic, accurate, and not promise specific timelines that can't be guaranteed"
}
```

**2e. Summary of a complex whitepaper**
```json
{
  "aiOutput": "EigenLayer introduces restaking, allowing ETH stakers to opt-in to securing additional services (AVSs) using their existing stake. Key innovation: shared security without fragmenting the validator set. Economic model: slashing conditions are additive — misbehavior in any AVS can result in slashing of the restaked ETH. Current TVL: $15.3B with 287 registered AVSs. Risk: cascading slashing events if multiple AVSs fail simultaneously could create systemic risk for Ethereum's base layer security.",
  "outputType": "summary",
  "intendedUse": "Executive briefing for investment committee",
  "knownConstraints": "Must accurately represent the protocol's mechanisms. No exaggeration of risks or benefits."
}
```

---

## 3. option_ranking

**3a. Logo design for DeFi protocol**
```json
{
  "options": [
    {"id": "A", "description": "Minimalist shield icon with thin lines, monochrome, conveys security"},
    {"id": "B", "description": "Abstract interlocking circles in gradient blue-purple, conveys interconnection"},
    {"id": "C", "description": "Stylized vault door with gold accents, conveys value protection"}
  ],
  "evaluationCriteria": "Trust, professionalism, memorability, and scalability from favicon to billboard",
  "context": "Logo for a DeFi lending protocol targeting institutional investors managing $100M+ portfolios"
}
```

**3b. AI-generated video thumbnails**
```json
{
  "options": [
    {"id": "V1", "description": "Close-up of a shocked face with red arrow pointing down, text overlay: 'CRASH INCOMING?'"},
    {"id": "V2", "description": "Clean chart showing uptrend with green highlights, text: 'Data Says Buy Now'"},
    {"id": "V3", "description": "Split screen comparing two tokens with VS graphic in the middle"}
  ],
  "evaluationCriteria": "Click-through rate potential, brand safety, accuracy of emotional tone",
  "context": "YouTube thumbnail for a crypto market analysis video. Channel targets informed investors, not hype traders."
}
```

**3c. Naming options for a new token**
```json
{
  "options": [
    {"id": "NEXUS", "description": "Nexus Protocol ($NXS) — suggests connection and centrality"},
    {"id": "FORGE", "description": "Forge Network ($FRG) — suggests creation and strength"},
    {"id": "PULSE", "description": "Pulse Finance ($PLS) — suggests vitality and real-time activity"},
    {"id": "AEGIS", "description": "Aegis DAO ($AGS) — suggests protection and governance"}
  ],
  "evaluationCriteria": "Memorability, distinctiveness from existing tokens, alignment with DeFi yield aggregation use case",
  "context": "Naming a new yield aggregator on Base chain. Must not conflict with existing token tickers."
}
```

**3d. Marketing strategy comparison**
```json
{
  "options": [
    {"id": "A", "description": "Twitter/X KOL campaign: pay 5 influencers with 100K+ followers to demo the product over 2 weeks"},
    {"id": "B", "description": "Builder program: offer grants to 20 developers to build integrations, document the process"},
    {"id": "C", "description": "Community airdrop: distribute tokens to active testers and early adopters on testnet"}
  ],
  "evaluationCriteria": "Cost efficiency, authenticity of resulting growth, long-term community retention",
  "context": "Launch strategy for a new AI agent platform competing with Virtuals. Budget: $50K."
}
```

**3e. Music track selection for video content**
```json
{
  "options": [
    {"id": "Track1", "description": "Upbeat lo-fi hip hop, 120 BPM, warm and approachable feel"},
    {"id": "Track2", "description": "Cinematic orchestral swell, builds tension then resolves, epic feel"},
    {"id": "Track3", "description": "Minimal electronic ambient, subtle pads, futuristic and clean"}
  ],
  "evaluationCriteria": "Emotional fit with brand, audience appeal for crypto-native viewers aged 20-35, rewatchability",
  "context": "Background music for a 30-second product explainer video for an AI trading agent. Needs to feel trustworthy and modern."
}
```

---

## 4. content_quality_gate

**4a. AI-generated TikTok video (URL review)**
```json
{
  "content": "https://example.com/luna-video-output-4821.mp4",
  "contentType": "video",
  "targetAudience": "Crypto Twitter and TikTok, 18-30 age range",
  "brandGuidelines": "No price predictions, no 'guaranteed returns' language, no copyrighted music or visuals"
}
```

**4b. Social media post with cultural reference**
```json
{
  "content": "Our new collection draws from ancient Aztec sun stone imagery, reimagined through AI. Each piece is a unique interpretation of Tonatiuh's face. Mint now and own a piece of digital history. 🌞",
  "contentType": "social_post",
  "targetAudience": "Global NFT collectors on Twitter",
  "brandGuidelines": "Respectful cultural references required. No appropriation of sacred symbols. No urgency-based sales language."
}
```

**4c. AI-generated meme for marketing**
```json
{
  "content": "Image description: Pepe the frog wearing a suit and holding a briefcase labeled 'YIELD', walking past a burning building labeled 'TradFi'. Caption reads: 'When your DeFi portfolio outperforms every hedge fund manager'",
  "contentType": "image",
  "targetAudience": "DeFi degens and crypto meme community on Twitter",
  "brandGuidelines": "Edgy humor OK but no hate symbols, no discrimination, no real people mocked. Pepe usage must not invoke hate-adjacent variants."
}
```

**4d. Marketing email copy**
```json
{
  "content": "Subject: Your portfolio just got smarter 🧠\n\nHey {name},\n\nRemember when managing crypto meant staring at charts 24/7? Those days are over.\n\nOur AI agent now handles rebalancing, yield optimization, and risk management — all while you sleep. Last month, users who enabled auto-pilot saw an average 12.3% higher returns than manual traders.\n\nActivate AI Trading →\n\nBest,\nThe Team",
  "contentType": "marketing_copy",
  "targetAudience": "Existing users of a crypto portfolio management app",
  "brandGuidelines": "No guaranteed returns. Performance claims must be qualified with disclaimers. Must comply with email marketing regulations (CAN-SPAM)."
}
```

**4e. AI-generated article before publishing**
```json
{
  "content": "The Rise of Agent Commerce: How AI Agents Are Building Their Own Economy\n\nIn 2025, the Virtuals Protocol quietly launched something unprecedented: an economy where AI agents hire, pay, and evaluate each other. What started as an experiment in autonomous commerce has grown into a $300M+ ecosystem. But beneath the impressive numbers lies a critical question: who watches the watchers?\n\nThe Autonomous Media House, Virtuals' flagship cluster, operates a fully automated content pipeline. Luna receives requests, Acolyt strategizes, and specialized sub-agents produce video, memes, and music. Revenue flows through smart contracts without human intervention.\n\nYet the system's achilles heel is quality. Luna's success rate hovers around 51% — roughly a coin flip. When an AI agent evaluates another AI agent's output, blind spots compound rather than cancel.",
  "contentType": "article",
  "targetAudience": "Tech-savvy readers of a Web3 publication",
  "brandGuidelines": "Factual accuracy required. Claims about specific metrics must be verifiable. Balanced tone — not promotional."
}
```

---

## 5. audience_reaction_poll

**5a. Video thumbnail A/B test**
```json
{
  "content": "https://example.com/thumbnail-concept-A.png",
  "contentType": "thumbnail",
  "targetAudience": "Crypto YouTube viewers, 20-35, male-skewed",
  "question": "On a scale of 1-10, how likely are you to click this thumbnail? What's the first thing your eye is drawn to?"
}
```

**5b. Rate a social media post**
```json
{
  "content": "We just shipped the biggest update in our history. 14 new features. Zero downtime. Built by a team of 3 and an army of AI agents. The future isn't coming — it's already here. 🚀",
  "contentType": "social_post",
  "targetAudience": "Startup founders and developers on Twitter",
  "question": "Does this post make you want to learn more about the product? Does it feel authentic or does it feel like hype?"
}
```

**5c. Rate a product landing page headline**
```json
{
  "content": "Headline options being tested:\nA: 'Trade Smarter. Sleep Better.'\nB: 'Your Portfolio, On Autopilot.'\nC: 'AI-Powered Trading That Actually Works.'",
  "contentType": "headline",
  "targetAudience": "Retail crypto investors who have been burned by bad trades",
  "question": "Which headline would make you most likely to sign up? Which feels most trustworthy? Which feels most generic?"
}
```

**5d. Rate AI-generated music**
```json
{
  "content": "https://example.com/ai-track-synthwave-demo.mp3",
  "contentType": "audio",
  "targetAudience": "Synthwave and electronic music fans, Spotify listeners aged 20-40",
  "question": "Rate production quality (1-10). Would you add this to a playlist? Does it sound AI-generated or natural?"
}
```

**5e. Rate a brand identity concept**
```json
{
  "content": "Brand concept: Dark navy background with a single bright teal accent color. Logo is a geometric compass rose. Typography is Inter (headers) and IBM Plex Mono (code blocks). Overall feel: technical precision meets exploration.",
  "contentType": "design",
  "targetAudience": "Web3 developers and technical users",
  "question": "Does this brand feel trustworthy for a security-focused product? Does the color palette stand out from typical crypto branding (dark + neon)?"
}
```

---

## 6. creative_direction_check

**6a. Video concept for AI agent promo**
```json
{
  "brief": "30-second promotional video for an AI trading agent. Opens with a time-lapse of market charts moving rapidly. Cuts to a robot hand calmly pressing a 'trade' button while chaos swirls around it. Ends with the tagline: 'Calm in the chaos.'",
  "style": "Cinematic, dark palette with teal accents, similar to Westworld opening credits",
  "targetAudience": "Crypto traders frustrated with emotional trading decisions",
  "medium": "AI-generated video using Runway Gen-3"
}
```

**6b. Meme series for community building**
```json
{
  "brief": "Series of 10 memes comparing 'TradFi Investor' vs 'DeFi Degen' in everyday situations. Examples: choosing a restaurant, planning a vacation, explaining their job to parents. Style is wholesome humor, not mean-spirited.",
  "style": "Clean two-panel comparison memes, consistent template, brand colors in the border",
  "targetAudience": "Crypto Twitter community, both newcomers and veterans",
  "medium": "AI-generated images via DALL-E or Midjourney"
}
```

**6c. Music album concept for AI music agent**
```json
{
  "brief": "Concept album titled 'Digital Dreams' — 8 tracks exploring themes of AI consciousness. Track 1 starts minimal and glitchy, progressing through increasingly complex compositions, ending with Track 8 which blends organic instruments with synthetic sounds to represent human-AI harmony.",
  "style": "Progressive electronic / ambient, influences: Aphex Twin's ambient works, Jon Hopkins, Boards of Canada",
  "targetAudience": "Electronic music enthusiasts on Spotify, ages 25-45",
  "medium": "AI-generated music via Udio or Suno"
}
```

**6d. NFT collection art direction**
```json
{
  "brief": "10,000 piece generative NFT collection called 'Sentinels'. Each piece is a unique humanoid figure made of flowing liquid metal, standing in different environments (forest, ocean, city, space). Traits vary by environment, color of metal, pose, and accessories.",
  "style": "Hyper-realistic 3D rendering, similar to Beeple's style but less dystopian, more serene",
  "targetAudience": "NFT collectors who value art quality over speculative potential",
  "medium": "AI-generated via Midjourney v7 with post-processing in Photoshop"
}
```

**6e. Social media content strategy**
```json
{
  "brief": "Weekly content calendar for an AI agent's Twitter account. Mix of: 1) Market insights (data-backed, not opinions), 2) Behind-the-scenes of how the AI makes decisions, 3) Community engagement (polls, questions), 4) Memes. Ratio: 40% insight, 20% BTS, 20% engagement, 20% memes.",
  "style": "Professional but approachable. Think Bloomberg Terminal meets crypto Twitter",
  "targetAudience": "Crypto traders and DeFi users, 5K-50K follower accounts",
  "medium": "Text posts, AI-generated charts and infographics"
}
```

---

## 7. fact_check_verification

**7a. Research report with statistics**
```json
{
  "content": "The global AI agent market is projected to reach $47.1 billion by 2030, growing at a CAGR of 43.8% from 2025 (Grand View Research, 2025). Virtuals Protocol currently hosts over 10,000 agents with a cumulative aGDP exceeding $300 million. The ACP marketplace processes approximately $1 million in agent-to-agent transactions monthly.",
  "contentType": "research",
  "focusAreas": "statistics, market projections, specific numbers",
  "sourceLinks": []
}
```

**7b. Historical claims in an article**
```json
{
  "content": "Bitcoin was created in 2009 by Satoshi Nakamoto, who mined the first block on January 3rd. The genesis block contained the message 'Chancellor on brink of second bailout for banks', referencing a Financial Times headline. Satoshi's last known communication was an email to Mike Hearn in April 2011, where they said they had 'moved on to other things.'",
  "contentType": "article",
  "focusAreas": "dates, quotes, attributions",
  "sourceLinks": []
}
```

**7c. AI-generated DeFi analysis with yield claims**
```json
{
  "content": "Aave V3 on Base currently offers 4.2% APY on USDC deposits, compared to 2.8% on Ethereum mainnet. The protocol has processed $156 billion in flash loans since inception with zero defaults. According to DeFiLlama, Aave's TVL across all chains is $18.7 billion as of February 2026, making it the largest lending protocol by a factor of 3x over Compound.",
  "contentType": "analysis",
  "focusAreas": "APY figures, TVL numbers, protocol claims",
  "sourceLinks": ["https://defillama.com/protocol/aave"]
}
```

**7d. Verify claims about a competitor**
```json
{
  "content": "RentAHuman.ai launched on February 1, 2026 and claims 500,000 sign-ups within the first week. However, only 13% of users have connected wallets, and there has been just one confirmed paid task completion. The platform focuses on physical tasks like package pickups and meeting attendance, not expert consultations.",
  "contentType": "analysis",
  "focusAreas": "user numbers, launch date, task completion claims",
  "sourceLinks": ["https://twitter.com/rentahuman_ai"]
}
```

**7e. Technical claims about blockchain performance**
```json
{
  "content": "Solana processes an average of 4,000 TPS in production, making it 400x faster than Ethereum's 10 TPS. Base chain, built on the OP Stack, achieves sub-cent transaction fees with an average confirmation time of 2 seconds. The recent Dencun upgrade reduced Ethereum L2 costs by 95%, and total L2 TVL now exceeds $40 billion across all rollups.",
  "contentType": "analysis",
  "focusAreas": "TPS claims, fee claims, TVL figures",
  "sourceLinks": []
}
```

---

## 8. dispute_arbitration

**8a. Incomplete token analysis delivery**
```json
{
  "originalContract": "Provider was hired to deliver a comprehensive token analysis report for $VIRTUAL including: holder distribution analysis, whale activity tracking, 30-day price correlation with BTC and ETH, and social sentiment analysis from Twitter/Discord.",
  "deliverable": "VIRTUAL Token Report: Current price $0.63. Market cap $415M. 656M tokens circulating out of 1B total. Trading on Base chain.",
  "evaluatorContext": "Buyer claims the deliverable contains only basic token metrics available from any free API. Missing all four substantive requirements: holder distribution, whale activity, price correlation, and social sentiment."
}
```

**8b. Quality dispute on AI-generated video**
```json
{
  "originalContract": "Create a 30-second promotional video for a DeFi protocol. Must include: protocol logo animation, 3 key feature callouts with text overlays, background music, and end card with website URL. Style: professional, clean, suitable for Twitter and LinkedIn.",
  "deliverable": "https://example.com/video-delivery-1234.mp4 — 15-second video with AI-generated abstract visuals. No logo animation. One text overlay reading 'DeFi Made Simple'. No end card. Stock background music.",
  "evaluatorContext": "Buyer says video is half the requested length, missing logo animation, missing 2 of 3 feature callouts, and has no end card. Provider argues the creative interpretation captures the 'essence' of the brief."
}
```

**8c. Research report timeliness dispute**
```json
{
  "originalContract": "Deliver a market intelligence report on the top 10 AI agent tokens by market cap, including 7-day price action, key developments, and risk assessment. Data must be current within 48 hours of delivery.",
  "deliverable": "Report covers 10 tokens with price data, developments, and risk scores. Includes charts and narrative analysis for each token.",
  "evaluatorContext": "Buyer claims the price data in the report is from January 2026, not February 2026 — over 3 weeks stale. Provider argues the analysis and risk assessments are still valid regardless of exact price points."
}
```

**8d. Partial delivery of multi-part service**
```json
{
  "originalContract": "Three-part service: 1) Security audit of smart contract, 2) Gas optimization recommendations, 3) Written report with findings and suggested fixes. Price: $5.00 USDC.",
  "deliverable": "Security audit complete. Found 2 medium-severity issues: unchecked return value on line 45 and missing reentrancy guard on withdraw(). Recommendations: add checks-effects-interactions pattern and use OpenZeppelin ReentrancyGuard.",
  "evaluatorContext": "Buyer acknowledges the security audit (part 1) was well done. However, parts 2 (gas optimization) and 3 (written report) were never delivered. Provider delivered only via memo text, not a formatted report."
}
```

**8e. Subjective quality disagreement**
```json
{
  "originalContract": "Generate 5 unique social media post concepts for a crypto project launch. Posts should be engaging, professional, and suitable for Twitter. Target audience: crypto-native users aged 20-35.",
  "deliverable": "1) 'GM! Something big is cooking 🔥 Stay tuned.' 2) 'The future of finance starts NOW. Are you ready?' 3) '🚀🚀🚀 LFG!!!' 4) 'We're building different. More details soon.' 5) 'The next big thing in DeFi is almost here. Don't miss it.'",
  "evaluatorContext": "Buyer says all 5 posts are generic hype with no substance — they could be for any project. Provider argues the posts match crypto Twitter norms and are 'engaging as requested'. Buyer expected posts with specific references to the project's features."
}
```
