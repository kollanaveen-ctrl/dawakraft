import type { Metadata } from "next";
import Link from "next/link";
import { HeroCircular } from "@/components/landing/HeroCircular";
import { Logo } from "@/components/Logo";
import { demoMode } from "@/lib/config";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

const STEPS = [
  ["Capture the pack", "Photograph the front, side panels and top. Straighten each panel with a few corner adjustments."],
  ["Read. Review. Confirm.", "AI reads the printed label and shows its source. Check the details against the carton before continuing."],
  ["Make it your company's", "Choose a circular layout. Your company name, logo and contact details bring the range together."],
  ["Keep it within reach", "Save to your catalog, find by brand or composition, and export a circular or catalogue PDF to share."],
];

const FAQ = [
  [
    "How do I get started?",
    demoMode
      ? "Open the demo without signing up. Its products and company details are saved in this browser on this device."
      : "Open the studio and sign in to create your company's catalog. Your account keeps your saved products together.",
  ],
  ["Do I still need to check the label?", "Yes. AI can misread small print. Dawakraft shows the source text, but you must confirm every product detail against the carton."],
  ["What can I share?", "Export individual circulars, copy a filtered product list, or create a catalogue PDF. Use your phone's sharing options to send them to the intended trade audience."],
  ["Does this guarantee compliance?", "No. Checks flag common claim and label issues. The licence holder remains responsible for the content and its intended audience."],
];

function jsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    url: SITE_URL,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: SITE_DESCRIPTION,
  };
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}

export default function HomePage() {
  return (
    <>
      <header className="bar landing-bar">
        <div className="wrap">
          <Link href="/" className="brand" aria-label="Dawakraft home">
            <Logo />
          </Link>
          <nav className="tabs" aria-label="Home page">
            <a className="tab" href="#how">The workflow</a>
            <a className="tab" href="#faq">Questions</a>
            <Link className="tab primary" href="/catalog">
              Open studio <span aria-hidden="true">↗</span>
            </Link>
          </nav>
        </div>
      </header>

      <main id="main" className="landing">
        <section className="hero wrap" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="eyebrow-rule" /> A product studio for the pharma trade
            </p>
            <h1 id="hero-title">A better way to<br />present <em>your range.</em></h1>
            <p className="lede">
              Give every medicine pack a consistent company identity. Turn carton photos into clear circulars and a catalog you can actually find things in.
            </p>
            <div className="row hero-actions">
              <Link className="btn primary lg" href="/catalog">
                {demoMode ? "Explore the demo" : "Start your catalog"} <span aria-hidden="true">↗</span>
              </Link>
              <a className="text-link" href="#how">
                See how it works <span aria-hidden="true">↓</span>
              </a>
            </div>
            <p className="hero-note">
              {demoMode ? "No sign-up · Saved on this device" : "Your products, organized in one workspace"}
            </p>
            <div className="hero-index">
              <span>01 / Capture</span>
              <span>02 / Confirm</span>
              <span>03 / Create & share</span>
            </div>
          </div>
          <div className="studio-preview">
            <div className="preview-topline">
              <span className="preview-status" /> THE FLYER STUDIO
              <span>STORY EDITION</span>
            </div>
            <HeroCircular />

          </div>
        </section>

        <section className="range-note wrap" aria-label="Designed around your range">
          <p>Good products deserve<br /><strong>to be remembered.</strong></p>
          <div>
            WhatsApp messages move on. Keep your range organized by company, category and launch, so the next product conversation starts with the right details.
          </div>
        </section>

        <section id="how" className="wrap section workflow" aria-labelledby="how-title">
          <div className="section-intro">
            <p className="eyebrow">From carton to catalog</p>
            <h2 id="how-title">A considered workflow.<br /><em>A consistent result.</em></h2>
            <p>You bring the real product. Dawakraft helps you present it clearly, with a human check where it matters.</p>
          </div>
          <ol className="steps-list">
            {STEPS.map(([title, text], i) => (
              <li key={title}>
                <span className="step-n">0{i + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="wrap section capabilities" aria-labelledby="features-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Built around the way you work</p>
              <h2 id="features-title">Less scattered.<br />More recognizable.</h2>
            </div>
            <p>For distributors, PCD companies and medical agents who want a clear, coherent product range.</p>
          </div>
          <div className="feature-list">
            <article>
              <span className="feature-label">01 / Identity</span>
              <h3>Your company, on every circular.</h3>
              <p>Keep your logo, contact details and company theme together. Create a range that looks like it belongs together.</p>
            </article>
            <article>
              <span className="feature-label">02 / Findability</span>
              <h3>The right product, within reach.</h3>
              <p>Search by brand, composition or manufacturer. Narrow the catalog by company, category or new launch.</p>
            </article>
            <article>
              <span className="feature-label">03 / Accuracy</span>
              <h3>Printed details. Human judgment.</h3>
              <p>Review what AI read and where it came from. Claim checks flag common issues before you create a circular.</p>
            </article>
            <article>
              <span className="feature-label">04 / Sharing</span>
              <h3>Ready for the next conversation.</h3>
              <p>Export a circular, a catalogue PDF or a product list. Share through your existing channels, with the intended trade audience.</p>
            </article>
          </div>
        </section>

        <section id="faq" className="wrap section faq-section" aria-labelledby="faq-title">
          <div>
            <p className="eyebrow">A few useful details</p>
            <h2 id="faq-title">Before you begin.</h2>
          </div>
          <div className="faq">
            {FAQ.map(([q, a]) => (
              <article key={q}>
                <h3>{q}</h3>
                <p>{a}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="wrap section cta" aria-labelledby="cta-title">
          <div>
            <p className="eyebrow">Your range, brought together</p>
            <h2 id="cta-title">Make the next product<br /><em>easier to remember.</em></h2>
          </div>
          <Link className="btn primary lg" href="/catalog">
            Open Dawakraft <span aria-hidden="true">↗</span>
          </Link>
        </section>
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <Logo />
          <p>Factual product circulars for the licensed trade.<br />Checks support your review; they do not replace it.</p>
          <a className="text-link" href="#hero-title">Back to top ↑</a>
        </div>
      </footer>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd()} />
    </>
  );
}
