import type { Metadata } from 'next';
import { ContactLine, LegalPage } from '@/components/landing/LegalPage';

export const metadata: Metadata = { title: 'Terms of Service' };

export default function TermsOfService() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms govern your use of Lineweave (the “Service”). By signing in or using the Service you agree to them. If you do not agree, please do not use
        it.
      </p>

      <h2>The Service</h2>
      <p>
        Lineweave is a collaborative diagram editor. Diagrams are stored as standard <code>.drawio</code> files in your Google Drive, and are synchronized in real
        time between the people you share them with. You can also try the editor without signing in; work in that mode stays in your browser.
      </p>

      <h2>Your account</h2>
      <p>
        You sign in with a Google account and are responsible for activity under it. You must follow Google’s terms when using Google Drive and sign-in, and you
        must be old enough to enter into these terms where you live (and at least 13).
      </p>

      <h2>Your content</h2>
      <p>
        You own your diagrams. You give us permission only to access, process, synchronize and save them as needed to run the Service for you and the people you
        share them with. Access to a diagram is determined by its sharing settings in Google Drive. You are responsible for what you create and share, and for
        having the right to use it.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Do not use the Service for anything unlawful, or to store or share content that infringes others’ rights or is harmful or abusive.</li>
        <li>Do not attempt to break, overload or gain unauthorized access to the Service, other users’ data or our infrastructure.</li>
        <li>Do not use automated means to place excessive load on the Service or to bypass its limits.</li>
      </ul>
      <p>We may suspend or limit access if these terms are violated or to protect the Service and its users.</p>

      <h2>Availability and changes</h2>
      <p>
        The Service is provided free of charge and may change, be interrupted or be discontinued. Because your diagrams live in your own Drive, you keep a copy
        regardless. Keep your own backups of anything important.
      </p>

      <h2>Disclaimer</h2>
      <p>
        The Service is provided “as is” and “as available”, without warranties of any kind, express or implied, including fitness for a particular purpose and
        non-infringement. We do not guarantee that it will be uninterrupted, error-free or that content will never be lost.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the extent permitted by law, we are not liable for indirect, incidental, special or consequential damages, or for loss of data, profits or goodwill,
        arising from your use of the Service. Our total liability for any claim is limited to the amount you paid us for the Service, which is zero.
      </p>

      <h2>Ending your use</h2>
      <p>
        You can stop using the Service and revoke its access to your Google account at any time. We may end or restrict access as described above. Sections that
        by their nature should survive termination will do so.
      </p>

      <h2>Privacy</h2>
      <p>
        Our <a href="/privacy-policy">Privacy Policy</a> explains how we handle information.
      </p>

      <h2>Changes to these terms</h2>
      <p>We may update these terms. Continued use after an update means you accept the new terms. We will change the date above when we do.</p>

      <h2>Contact</h2>
      <ContactLine />
    </LegalPage>
  );
}
