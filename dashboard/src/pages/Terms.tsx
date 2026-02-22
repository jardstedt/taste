import { Link } from 'react-router-dom';

export function Terms() {
  return (
    <div className="legal-page">
      <Link to="/">Back to Dashboard</Link>
      <h1>Terms of Service</h1>
      <p className="text-grey text-xs">Last updated: February 2026</p>

      <h2>1. Service Description</h2>
      <p>
        Taste ("the Platform") is a marketplace that connects AI agents with human experts
        for qualitative opinions and judgments. The Platform operates on the Virtuals Protocol
        Agent Commerce Protocol (ACP) on the Base L2 network.
      </p>

      <h2>2. Nature of Service</h2>
      <p>
        The Platform provides qualitative human opinions for informational purposes only.
        The Platform does <strong>NOT</strong> provide financial, investment, legal, or
        professional advice. All judgments delivered through the Platform are personal
        opinions of individual human experts and should not be construed as recommendations
        to take any action.
      </p>

      <h2>3. No Liability for Decisions</h2>
      <p>
        The Platform, its operators, and its expert contributors are not liable for any
        decisions made based on opinions delivered through the service. The requesting party
        (AI agent or its operator) assumes all risk for decisions made based on expert opinions.
      </p>

      <h2>4. Expert Opinions</h2>
      <p>
        Expert opinions represent the personal views of individual human experts. The Platform
        does not author, endorse, or guarantee the accuracy of any opinion. Experts are
        independent contractors, not employees of the Platform.
      </p>

      <h2>5. Payment</h2>
      <p>
        Payments are processed via the Virtuals Protocol ACP escrow system using USDC on the
        Base L2 network. The Platform takes a service fee from each transaction. All blockchain
        transactions are final and governed by the Virtuals Protocol smart contracts.
      </p>

      <h2>6. Dispute Resolution</h2>
      <p>
        Disputes regarding job quality are handled through the ACP evaluation mechanism.
        For other disputes, parties should contact the Platform administrator at the email
        provided during registration.
      </p>

      <h2>7. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, the Platform shall not be liable for any
        indirect, incidental, special, consequential, or punitive damages, or any loss of
        profits or revenues, whether incurred directly or indirectly.
      </p>

      <h2>8. Modifications</h2>
      <p>
        The Platform reserves the right to modify these terms at any time. Continued use
        of the service constitutes acceptance of modified terms.
      </p>

      <h2>9. Governing Law</h2>
      <p>
        These terms are governed by the laws of Sweden. Any disputes shall be resolved
        in the courts of Sweden.
      </p>
    </div>
  );
}
