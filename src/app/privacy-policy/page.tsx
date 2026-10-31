import type { Metadata } from 'next';
import { ContactLine, LegalPage } from '@/components/landing/LegalPage';

export const metadata: Metadata = { title: 'Privacy Policy' };

export default function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        Lineweave (“we”, “us”) is a real-time collaborative diagram editor that saves your diagrams to your own Google Drive. This policy explains what
        information we handle and why. In short: your diagrams live in your Google Drive, and we keep only what is needed to sign you in and let people
        edit together.
      </p>

      <h2>Information we access</h2>
      <ul>
        <li>
          <strong>Google account basics.</strong> When you sign in with Google we receive your name, email address and profile picture. We use them to identify
          you in the app, for example to show your name and cursor to collaborators.
        </li>
        <li>
          <strong>Google Drive files you open or create with Lineweave.</strong> We request only the <code>drive.file</code> scope, which limits access to files
          that Lineweave created or that you explicitly pick. We cannot see or change the rest of your Drive.
        </li>
        <li>
          <strong>Diagram content during collaboration.</strong> While a diagram is open, edits are synchronized between collaborators through Firebase
          Realtime Database. This includes the diagram data, who is currently present, their cursor positions and their role (editor or viewer).
        </li>
        <li>
          <strong>Cookies.</strong> We use two cookies, described below. We do not use advertising or analytics cookies.
        </li>
      </ul>

      <h2>How we use information</h2>
      <ul>
        <li>To sign you in and keep you signed in.</li>
        <li>To open, display, synchronize and save the diagrams you choose to work on.</li>
        <li>To check with Google Drive whether you may view or edit a diagram before letting you join it.</li>
        <li>To keep the service secure and working.</li>
      </ul>
      <p>
        We do not sell your information, use it for advertising, or use it to train machine-learning models. Our use of information received from Google APIs
        adheres to the{' '}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>

      <h2>Cookies</h2>
      <ul>
        <li>
          <strong>Session cookie (<code>gd_session</code>).</strong> An encrypted, httpOnly cookie holding the token that lets Lineweave keep saving to your Drive
          without asking you to sign in again. It is sent only to our sign-in endpoints and lasts up to 180 days or until you sign out.
        </li>
        <li>
          <strong>Sign-in marker (<code>lw_signed_in</code>).</strong> A cookie with no personal data that lets us send you straight to your files when you
          return. It is removed when you sign out.
        </li>
      </ul>

      <h2>Where information is stored and who processes it</h2>
      <ul>
        <li><strong>Google Drive:</strong> your diagram files, under your control and Google’s terms.</li>
        <li>
          <strong>Google Firebase (Authentication and Realtime Database):</strong> your sign-in identity and the temporary real-time copy of open diagrams.
        </li>
        <li><strong>Vercel:</strong> hosts the application and processes requests to it.</li>
      </ul>
      <p>We share information with these providers only to operate Lineweave, and we do not share it with anyone else except where required by law.</p>

      <h2>Retention</h2>
      <p>
        The real-time copy of a diagram is deleted after it has been idle for 30 days; the file in your Drive is unaffected and the diagram is re-created from
        Drive the next time it is opened. Presence and cursor data are removed when you disconnect. Signing out deletes the session cookie and revokes our
        stored Google token.
      </p>

      <h2>Your choices and rights</h2>
      <ul>
        <li>Sign out at any time from the files page.</li>
        <li>
          Revoke Lineweave’s access at{' '}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">myaccount.google.com/permissions</a>.
        </li>
        <li>Delete diagrams directly in Google Drive. Ask us if you want data associated with your account removed from our systems.</li>
      </ul>

      <h2>Children</h2>
      <p>Lineweave is not directed to children under 13, and we do not knowingly collect their information.</p>

      <h2>Changes</h2>
      <p>If we change this policy we will update the date above and, for material changes, notify you in the app.</p>

      <h2>Contact</h2>
      <ContactLine />
    </LegalPage>
  );
}
