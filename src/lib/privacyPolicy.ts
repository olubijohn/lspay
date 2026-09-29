// Data privacy, compliance & payment notice shown to parents before they link a child.
// Bump PRIVACY_POLICY_VERSION whenever the wording changes; the accepted version is sent
// with the linking request so there is a record of what the parent agreed to.
// Have this text reviewed by your legal / data-protection officer before going live.

export const PRIVACY_POLICY_VERSION = "2026-09-29";

export const PRIVACY_POLICY_TITLE = "Data Privacy, Compliance & Payment Gateway Architecture";

export const PRIVACY_CHARTER_URL = "https://www.umusa.cloud/privacypolicy";

export interface PolicySection {
  title: string;
  body?: string[];
  bullets?: string[];
  link?: { label: string; href: string };
}

export const PRIVACY_POLICY_SECTIONS: PolicySection[] = [
  {
    title: "Who we are",
    body: [
      "LSPay is the cashless wallet and student card service of UMUSA Education Cloud (LSA Series), operated by Umusa Digital Solutions for your child's school. The school and LSPay process your child's information together so the card and wallet can work.",
    ],
  },
  {
    title: "PCI-DSS payment security (Paystack)",
    body: [
      "All monetary processing, direct card transactions, and automated settlements are conducted strictly via our certified payment gateway partner, Paystack.",
    ],
    bullets: [
      "No cardholder debit/credit card details or banking credentials are ever held or stored on Umusa Digital Solutions servers.",
      "Fully compliant with Central Bank of Nigeria (CBN) and PCI-DSS Level 1 specifications.",
      "Automated reconciliation between parent bank debits and school accounts.",
    ],
  },
  {
    title: "What we keep about your payments",
    body: [
      "Every top-up is managed and processed by Paystack. LSPay does not hold, process or keep the card or bank details you use to top up your child's wallet.",
      "For each payment we only keep:",
    ],
    bullets: [
      "Who made the payment.",
      "What it was paid for, and which child's wallet it was paid to.",
      "The amount paid.",
      "The date and time of the payment.",
    ],
  },
  {
    title: "What we never keep",
    bullets: [
      "Card numbers, expiry dates, CVV or PINs.",
      "Bank account numbers, banking logins or other banking credentials.",
      "Any details of the payment instrument used to make the payment.",
    ],
  },
  {
    title: "Top-up charges",
    body: [
      "There is no fee to link a child to your account.",
      "An enrollment charge applies to every wallet top-up. It covers infrastructure, payment gateway and transaction costs, and the exact amount is shown to you before you confirm each payment.",
    ],
  },
  {
    title: "Student data privacy & NDPR compliance",
    body: [
      "Student biometrics and registration records are treated as strictly confidential under the Nigeria Data Protection Act (NDPA/NDPR).",
    ],
    bullets: [
      "Zero unauthorized third-party commercial marketing, data aggregation, or student profiling.",
      "Data minimization: Only relevant academic identifiers required for verification are handled.",
    ],
  },
  {
    title: "What we collect and why",
    body: [
      "About you: your name, email address and phone number.",
      "About your child: name, student ID, class, school, photo (if the school provides one), card number, wallet balance, spending limits and a record of purchases and top-ups.",
      "We use this to link your child to your account, run their wallet and card, show you their spending, send you alerts (for example when a card is ready or a limit is reached), and keep the service secure.",
    ],
  },
  {
    title: "Who we share it with",
    bullets: [
      "Your child's school, which manages enrolment, cards and the tuck shop or canteen.",
      "Paystack, which processes your wallet top-ups.",
      "Our hosting and infrastructure providers, under contracts that require them to keep the data secure.",
      "Authorities, only where the law requires it.",
    ],
  },
  {
    title: "Consent for your child",
    body: [
      "Because your child is a minor, we rely on your consent as their parent or legal guardian. By linking an account you confirm that you have the authority to give that consent.",
      "You can withdraw consent at any time by asking the school to unlink the account. Withdrawing does not affect anything done before.",
    ],
  },
  {
    title: "Your rights",
    body: [
      "You can ask to see, correct or delete your data and your child's data, object to or restrict how it is used, and receive a copy of it. Contact your child's school administrator to make a request. If you are not satisfied with the response, you can complain to the Nigeria Data Protection Commission (NDPC).",
    ],
    link: { label: "Review our complete privacy charter online", href: PRIVACY_CHARTER_URL },
  },
];

export const PRIVACY_CONSENT_STATEMENTS = [
  "I have read and understood the LSPay data privacy, compliance & payment notice.",
  "I understand that all payments are processed by Paystack, that LSPay never keeps my card or bank details, and that an enrollment charge applies to every wallet top-up.",
  "I am the parent or legal guardian of the child I am linking and I consent to their data being processed as described.",
];
