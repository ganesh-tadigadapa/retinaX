import Link from "next/link";
import Shell from "@/components/Shell";
import PageHeader from "@/components/PageHeader";
import ContactLine from "@/components/ContactLine";

export const metadata = { title: "Terms of Use — RETINEX" };

export default function TermsPage() {
  return (
    <Shell>
      <PageHeader eyebrow="Legal" title="Terms of Use">
        Last updated 23 November 2026. By using RETINEX you agree to these terms.
      </PageHeader>

      <article className="legal">
        <h2 className="section-title">1. Not a diagnostic device</h2>
        <p>RETINEX is a research and education prototype that gives a <strong>screening triage
          result</strong>. It can be wrong. It does not diagnose disease and must not be used as a
          substitute for examination by a qualified eye-care professional. If you have symptoms
          or a referable result, see an eye doctor.</p>

        <h2 className="section-title">2. Your account</h2>
        <p>You sign in with your own Google account and are responsible for activity under it.
          Choosing “Doctor” does not grant doctor access; doctor accounts must be verified by an
          administrator.</p>

        <h2 className="section-title">3. Acceptable use</h2>
        <ul>
          <li>Upload only retinal photographs you are entitled to share, with the consent of the
            person photographed.</li>
          <li>Do not attempt to access other people’s records, overload the service, or interfere
            with its security.</li>
        </ul>

        <h2 className="section-title">4. Availability</h2>
        <p>The service is provided free of charge, “as is”, without guarantees of availability or
          accuracy, and may change or stop at any time.</p>

        <h2 className="section-title">5. Liability</h2>
        <p>To the extent permitted by law, the RETINEX team is not liable for decisions made on the
          basis of its output or for loss arising from use of the service.</p>

        <h2 className="section-title">6. Privacy</h2>
        <p>How we handle data is described in the <Link href="/privacy">Privacy Policy</Link>.</p>

        <h2 className="section-title">7. Contact</h2>
        <p>Questions about these terms: <ContactLine />.</p>
      </article>
    </Shell>
  );
}
