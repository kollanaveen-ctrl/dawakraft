import type { Metadata } from "next";
import Link from "next/link";
import { HeroCircular } from "@/components/landing/HeroCircular";
import { Logo } from "@/components/Logo";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

const STEPS = [
  ["Photograph every side", "Front, side panels and top: on any phone, no special setup."],
  ["Tap the corners", "Dawakraft suggests each panel's corners and straightens it, so small print stays sharp."],
  ["AI reads, you confirm", "Every detail shows the panel and the exact printed text it came from. Strength is cross-checked."],
  ["Compliance check", "Claim words like “cure”, “guaranteed” or “100%” are blocked, and Schedule H, H1 and X products get trade-only warnings."],
  ["Share the circular", "A branded 1080 × 1350 image with a ready message, sent straight to WhatsApp."],
];

const FEATURES = [
  ["Guardrails, not just templates", "Trade-only footer on every circular, banned claim words caught before anything is shared, and a confirm-against-the-carton step that can't be skipped."],
  ["Evidence, not guesses", "The AI must quote the printed text it read and name the panel. If the front says 250 and the side says 500 mg, Dawakraft stops and asks."],
  ["Real 3D pack shots", "Your own photos, straightened and wrapped onto a 3D box. The product image is never drawn by AI, so the pack on the circular is the real pack."],
  ["A catalog that sorts itself", "Filter by category, company and new launch. Launches move to Existing after 60 days, and the “New launch” badge drops off by itself."],
  ["WhatsApp-first", "One tap shares the circular image and message on a phone. Copy a whole company's list or just the new launches."],
  ["Works like an app", "Add it to the home screen. Fast on mid-range Android phones, readable in bright light, usable with one thumb."],
];

const FAQ = [
  ["Is Dawakraft free to try?", "Yes. The demo needs no sign-up: products and company details are saved only in your browser on your device."],
  ["Does the AI make up product details?", "It is told to copy only printed text and to show where it read each detail. You check every field against the carton before a circular can be made, and composition is always flagged for review."],
  ["Which products work best?", "Cartons and boxes: photograph the front, a side panel and the top. Bottles, tubes and strips use a flat front photo instead."],
  ["Can I share Schedule H products?", "Circulars are for registered medical practitioners, hospitals and the licensed trade. Dawakraft warns you on Schedule H, H1 and X products to share them only with that audience."],
  ["Is this legal advice?", "No. The check catches common problems, not the full law. The licence holder stays responsible for the final content."],
];

function jsonLd() {
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      url: SITE_URL,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, Android, iOS",
      description: SITE_DESCRIPTION,
      offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    },
  ];
  // Static content only; "<" is escaped so the JSON can't close the script tag.
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}

export default function HomePage() {
  return (
    <>
      <header className="bar landing-bar">
        <div className="wrap">
          <Link href="/" className="brand">
            <Logo />
          </Link>
          <nav className="tabs" aria-label="Home page">
            <a className="tab" href="#how">How it works</a>
            <a className="tab" href="#faq">FAQ</a>
            <Link className="tab primary" href="/catalog">Open the app</Link>
          </nav>
        </div>
      </header>

      <main id="main" className="landing">
        <section className="hero wrap" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">For pharma distributors, PCD companies &amp; medical agents</p>
            <h1 id="hero-title">From medicine box to WhatsApp-ready circular in two minutes.</h1>
            <p className="lede">
              Photograph the carton. Dawakraft straightens every panel, reads the label with AI and shows you where each detail came from,
              checks the claims, and designs a branded trade circular.
            </p>
            <div className="row">
              <Link className="btn primary lg" href="/catalog">Try the free demo</Link>
              <a className="btn lg" href="#how">See how it works</a>
            </div>
            <ul className="trust">
              <li>No sign-up for the demo</li>
              <li>Demo catalog stays on your device</li>
              <li>Trade-only by design</li>
            </ul>
          </div>
          <HeroCircular />
        </section>

        <section id="how" className="wrap section" aria-labelledby="how-title">
          <p className="eyebrow">How it works</p>
          <h2 id="how-title">Five steps, one thumb</h2>
          <ol className="steps-list">
            {STEPS.map(([title, text], i) => (
              <li key={title}>
                <span className="step-n" aria-hidden="true">{i + 1}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="wrap section" aria-labelledby="features-title">
          <p className="eyebrow">Why Dawakraft</p>
          <h2 id="features-title">Built for the pharma trade, not generic design</h2>
          <div className="feature-list">
            {FEATURES.map(([title, text]) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="wrap section who" aria-labelledby="who-title">
          <h2 id="who-title">Who uses it</h2>
          <div className="who-grid">
            <p><b>Distributors</b> launching a new product to chemists in their area.</p>
            <p><b>PCD and franchise companies</b> keeping one consistent catalog across every partner.</p>
            <p><b>Medical agents</b> sending a clean circular to a doctor in the time a call takes.</p>
          </div>
        </section>

        <section id="faq" className="wrap section" aria-labelledby="faq-title">
          <p className="eyebrow">Questions</p>
          <h2 id="faq-title">Frequently asked</h2>
          <div className="faq">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="wrap section cta" aria-labelledby="cta-title">
          <h2 id="cta-title">Make your first circular now</h2>
          <p>The demo works in your browser. Nothing to install.</p>
          <Link className="btn primary lg" href="/catalog">Try the free demo</Link>
        </section>
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <Logo />
          <p className="muted">
            Dawakraft makes factual, trade-only product circulars. It checks common problems, not the full law; the licence holder stays responsible for
            the final content.
          </p>
        </div>
      </footer>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd()} />
    </>
  );
}
