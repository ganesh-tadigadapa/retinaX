import Link from "next/link";
import Shell from "@/components/Shell";
import PageHeader from "@/components/PageHeader";
import ContactLine from "@/components/ContactLine";

export const metadata = { title: "Privacy Policy — RETINEX" };

export default function PrivacyPage() {
  return (
    <Shell>
      <PageHeader eyebrow="Legal" title="Privacy Policy">
        Last updated 23 November 2026. RETINEX is a student-built screening prototype
        (Smart India Hackathon SIH26038). This page explains exactly what it stores and why.
      </PageHeader>

      <article className="legal">
        <h2 className="section-title">1. What RETINEX is</h2>
        <p>RETINEX analyses retinal (fundus) photographs and returns a diabetic retinopathy
          screening result. It is a <strong>screening triage aid, not a diagnostic device</strong>,
          and it does not replace an eye examination by a qualified professional.</p>

        <h2 className="section-title">2. What we collect</h2>
        <ul>
          <li><strong>From Sign in with Google:</strong> your name, email address, profile picture
            and Google account identifier. We never see or store your Google password.</li>
          <li><strong>Your account:</strong> your role (patient or doctor) and, for doctor accounts,
            the name, medical registration number and hospital you enter for verification.</li>
          <li><strong>Screenings:</strong> the retinal photographs you upload, the results produced
            from them (grade, referral decision, heatmaps, lesion findings), the PDF report, any
            optional patient reference you type, and notes a reviewing doctor adds.</li>
          <li><strong>Location (only if you ask):</strong> when you press “Use my location” or type a
            place on the eye-hospital map, that position or place name is used to search for
            nearby hospitals. It is not saved to your account.</li>
          <li><strong>On your device only:</strong> your language choice and display preferences are
            kept in your browser. Read-aloud uses your device’s own speech engine.</li>
        </ul>
        <p>We do not use advertising, tracking pixels or third-party analytics.</p>

        <h2 className="section-title">3. How we use it</h2>
        <ul>
          <li>To run the screening and show you your result, history and follow-up suggestions.</li>
          <li>To let a doctor review your screenings <strong>only after you give them a sharing
            code</strong>; you can remove their access at any time.</li>
          <li>To let an administrator verify doctor accounts.</li>
          <li>To keep the service secure and working.</li>
        </ul>
        <p>We do <strong>not</strong> sell your data or use it for advertising. Your images are not
          used to train models without your separate, explicit consent.</p>

        <h2 className="section-title">4. Where it is stored</h2>
        <p>Data is stored on our server hosted by Amazon Web Services in the Sydney (Australia)
          region, and is sent to and from your browser over encrypted HTTPS connections.</p>

        <h2 className="section-title">5. Services we rely on</h2>
        <ul>
          <li><strong>Google</strong> — sign-in.</li>
          <li><strong>Amazon Web Services</strong> — hosting.</li>
          <li><strong>OpenStreetMap / Nominatim and CARTO</strong> — place search and map tiles on
            the eye-hospital map (they receive the place name or map area, not your account).</li>
        </ul>

        <h2 className="section-title">6. How long we keep it, and deleting it</h2>
        <p>We keep your account and screenings until you ask us to delete them, or until this
          prototype is shut down. To access, correct or delete your data, contact <ContactLine />.
          We will act on verified requests within 30 days.</p>

        <h2 className="section-title">7. Children</h2>
        <p>RETINEX is not intended for people under 18 without the involvement of a parent,
          guardian or health worker.</p>

        <h2 className="section-title">8. Changes</h2>
        <p>If this policy changes, the date at the top of this page changes with it.</p>

        <h2 className="section-title">9. Contact</h2>
        <p>Questions about privacy: <ContactLine />. See also our <Link href="/terms">Terms of Use</Link>.</p>
      </article>
    </Shell>
  );
}
