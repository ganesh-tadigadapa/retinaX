/** Where to send privacy and deletion requests. Set NEXT_PUBLIC_CONTACT_EMAIL at build. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "";

export default function ContactLine() {
  return CONTACT_EMAIL ? (
    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
  ) : (
    <span>the support email shown on the Google sign-in screen for RETINEX</span>
  );
}
