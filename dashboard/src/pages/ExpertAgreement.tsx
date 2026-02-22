import { Link } from 'react-router-dom';

export function ExpertAgreement() {
  return (
    <div className="legal-page">
      <Link to="/">Back to Dashboard</Link>
      <h1>Expert Agreement</h1>
      <p className="text-grey text-xs">Last updated: February 2026</p>

      <p>
        This Expert Agreement ("Agreement") is between you ("Expert") and the Taste platform
        ("Platform"). By accepting this Agreement, you agree to the following terms:
      </p>

      <h2>1. Contractor Relationship</h2>
      <p>
        You are an independent contractor, NOT an employee of the Platform. The Platform does
        not provide employment benefits, insurance, or withhold taxes on your behalf. You are
        responsible for your own tax reporting obligations on earnings received through the Platform.
      </p>

      <h2>2. Nature of Work</h2>
      <p>
        You will provide qualitative human opinions and judgments in response to requests from
        AI agents via the Virtuals Protocol ACP. Your opinions are personal views based on your
        expertise and are NOT financial, investment, legal, or professional advice.
      </p>

      <h2>3. Prohibited Conduct</h2>
      <ul>
        <li>You shall NOT provide investment advice, including buy/sell recommendations, price targets, or allocation advice</li>
        <li>You shall NOT use prohibited phrases including but not limited to: "buy", "sell", "invest in", "financial advice", "guaranteed returns"</li>
        <li>You shall NOT misrepresent your qualifications or expertise</li>
        <li>You shall NOT submit AI-generated content as human judgment without disclosure</li>
      </ul>

      <h2>4. Public Attribution</h2>
      <p>
        You consent to public identification on your expert profile, including your name,
        domain expertise areas, reputation scores, and credential links. Each judgment you
        submit will be attributed to your public expert profile and delivered to the requesting
        AI agent. You may withdraw consent for public profile display at any time through the
        dashboard settings.
      </p>

      <h2>5. Intellectual Property</h2>
      <p>
        You own your opinions and judgments. By submitting a judgment through the Platform,
        you grant the Platform a non-exclusive license to deliver the judgment content to the
        requesting agent and to display it as part of your expert track record. The Platform
        is not the author of your opinions.
      </p>

      <h2>6. Compensation</h2>
      <p>
        You will receive 75% of the Platform's share (which is 80% of the total job price after
        Virtuals Protocol's 20% fee). Earnings are tracked in the Platform database and settled
        periodically via USDC transfer to your designated wallet address.
      </p>

      <h2>7. Service Level</h2>
      <p>
        You agree to respond to assigned jobs within the stated SLA period (default: 2 hours).
        Failure to respond within the SLA may result in a reputation score penalty. You may set
        your availability status to "offline" when unavailable — you will not receive assignments
        while offline.
      </p>

      <h2>8. Reputation System</h2>
      <p>
        Your reputation score is calculated per domain and reflects your track record of timely,
        quality responses. The Platform may use reputation scores to prioritize expert assignment.
        Reputation scores are visible on your public profile if you consent to public display.
      </p>

      <h2>9. Indemnification</h2>
      <p>
        You agree to hold the Platform harmless from any claims arising from your opinions or
        judgments. The Platform is a marketplace connecting agents with experts and is not
        responsible for the content of your opinions.
      </p>

      <h2>10. Account Deletion</h2>
      <p>
        You may request account deletion at any time (right to be forgotten). Upon deletion,
        your personal data will be removed within 30 days. Previously submitted judgments will
        be anonymized but not deleted to maintain platform integrity.
      </p>

      <h2>11. Non-Compete</h2>
      <p>
        There is no non-compete clause. You are free to provide opinions and services through
        other platforms or directly to clients.
      </p>

      <h2>12. Termination</h2>
      <p>
        Either party may terminate this Agreement at any time. Outstanding earnings will be
        settled within 30 days of termination.
      </p>
    </div>
  );
}
