import { Link } from 'react-router-dom';

export function Privacy() {
  return (
    <div className="legal-page">
      <Link to="/">Back to Dashboard</Link>
      <h1>Privacy Policy</h1>
      <p className="text-grey text-xs">Last updated: February 2026</p>

      <h2>1. Data Controller</h2>
      <p>
        Taste ("the Platform") is the data controller for personal data collected through this service.
        Contact: the administrator email provided during your registration.
      </p>

      <h2>2. Data We Collect</h2>
      <ul>
        <li><strong>Expert profile data:</strong> Name, email address, domain expertise tags, credential links (social profiles, portfolio URLs), bio</li>
        <li><strong>Service data:</strong> Reputation scores, judgment history, earnings records, response times</li>
        <li><strong>Technical data:</strong> Session cookies (JWT authentication tokens)</li>
      </ul>

      <h2>3. Data We Do NOT Collect</h2>
      <ul>
        <li>Home address or physical location</li>
        <li>Government-issued identification</li>
        <li>Financial information beyond USDC wallet addresses used for ACP transactions</li>
        <li>Tracking cookies or third-party analytics</li>
      </ul>

      <h2>4. Legal Basis for Processing</h2>
      <ul>
        <li><strong>Consent:</strong> Explicit opt-in during expert registration and agreement acceptance</li>
        <li><strong>Legitimate interest:</strong> Platform operation, security, and fraud prevention</li>
        <li><strong>Contractual necessity:</strong> Processing required to fulfill the Expert Agreement</li>
      </ul>

      <h2>5. How We Use Your Data</h2>
      <ul>
        <li>Match you with relevant judgment requests based on your domain expertise</li>
        <li>Display your public expert profile to requesting agents (with your consent)</li>
        <li>Track your reputation scores and earnings for platform operation</li>
        <li>Communicate with you about job assignments and platform updates</li>
      </ul>

      <h2>6. Data Sharing</h2>
      <ul>
        <li><strong>Requesting agents:</strong> Your public profile name and judgment content are delivered to the AI agent that requested the judgment</li>
        <li><strong>Public profile:</strong> If you consent, your name, domains, and reputation scores are visible on your public expert profile page</li>
        <li><strong>No third-party sales:</strong> We never sell your personal data to third parties</li>
      </ul>

      <h2>7. Data Retention</h2>
      <ul>
        <li>Active account data is retained while your account exists</li>
        <li>Upon account deletion request, personal data is deleted within 30 days</li>
        <li>Judgment content is anonymized (not deleted) to maintain platform integrity</li>
        <li>On-chain ACP transaction data is immutable and cannot be deleted</li>
      </ul>

      <h2>8. Your Rights (GDPR)</h2>
      <ul>
        <li><strong>Right to access:</strong> You can export all your data via the dashboard</li>
        <li><strong>Right to rectification:</strong> You can update your profile information at any time</li>
        <li><strong>Right to erasure:</strong> You can request full account deletion (judgments will be anonymized)</li>
        <li><strong>Right to data portability:</strong> Your data can be exported in a standard format</li>
        <li><strong>Right to withdraw consent:</strong> You can withdraw consent for public profile display at any time</li>
      </ul>

      <h2>9. Data Processors</h2>
      <ul>
        <li><strong>Azure (Microsoft):</strong> Cloud hosting provider — data stored in EU data centers</li>
        <li><strong>Virtuals Protocol:</strong> ACP transaction data processed on Base L2 blockchain (immutable, public)</li>
      </ul>

      <h2>10. Cookies</h2>
      <p>
        We use only essential session cookies (JWT authentication tokens) with httpOnly and
        SameSite attributes. We do not use tracking cookies, analytics cookies, or any
        third-party cookies.
      </p>

      <h2>11. Data Security</h2>
      <p>
        Expert email addresses are encrypted at rest. All communications use HTTPS encryption.
        Access to personal data is restricted to authorized administrators only.
      </p>

      <h2>12. Contact</h2>
      <p>
        For privacy-related inquiries, data access requests, or account deletion requests,
        contact the Platform administrator at the email address provided during your registration.
      </p>
    </div>
  );
}
