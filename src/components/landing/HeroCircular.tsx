import Link from "next/link";

/** A fictional design specimen, never presented as an uploaded or verified medicine pack. */
export function HeroCircular() {
  return (
    <figure className="hero-specimen">
      <div className="specimen-stage">
        <div className="specimen-margin" aria-hidden="true"><span>DAWAKRAFT / DESIGN STUDY</span><span>01 — NUTRITION</span></div>
        <div className="specimen-story" role="img" aria-label="Illustrative WhatsApp Story flyer: Calvia D3, calcium and vitamin D3, with a sample carton and an editorial walking illustration">
          <div className="specimen-brand"><span>THE DAILY FORMULA</span><span>09:16</span></div>
          <div className="specimen-title">Calvia<span>D3</span></div>
          <p className="specimen-formula">Calcium + Vitamin D3<br />An illustrative formulation</p>
          <div className="specimen-headline">Good design.<br /><em>In every detail.</em></div>
          <svg className="specimen-illustration" viewBox="0 0 340 340" aria-hidden="true">
            <circle cx="242" cy="103" r="91" fill="#EBDDC8" />
            <circle cx="261" cy="74" r="40" fill="#C8663F" />
            <path d="M96 296H340V340H56V319H96Z" fill="#B7C8BC" />
            <path d="M195 145 219 144 222 206 199 260 175 254 194 200Z" fill="#174B42" />
            <path d="M217 185 248 212 263 269 241 275 220 231 199 218Z" fill="#286455" />
            <path d="m177 251 22 7-2 16-38-2q-7-6 4-11Z" fill="#263D34" />
            <path d="m241 269 22-6 13 16q3 6-4 8l-33 1Z" fill="#263D34" />
            <path d="M190 111q19-20 37-1l9 80-48 4-9-47Z" fill="#D37850" />
            <path d="m185 119-26 32-30 3-2 11 43-2 29-29M220 117l22 27 30-8 4 9-38 15-29-24" fill="none" stroke="#C48D69" strokeWidth="12" strokeLinecap="round" />
            <path d="m207 94-1 18 13 1 1-18" fill="#C48D69" />
            <ellipse cx="214" cy="77" rx="18" ry="23" fill="#D4A17D" />
            <path d="M196 81q-12-35 15-34 30-3 23 32l-9-14q-17 3-21-4Z" fill="#253E35" />
            <path d="M302 298q-16-64 12-113M309 244q-33-2-27-27 22 3 27 27M312 226q-2-32 20-34 6 25-20 34M303 274q-35-3-32-29 25 4 32 29" stroke="#6C8B70" strokeWidth="3" fill="#829D7D" />
            <path d="M105 305H305" stroke="#174B42" strokeWidth="1" opacity=".35" />
          </svg>
          <div className="specimen-pack" aria-hidden="true">
            <div className="specimen-pack-side">CALVIA D3<span>ILLUSTRATIVE PACK</span></div>
            <div className="specimen-pack-front"><small>THE DAILY FORMULA</small><strong>Calvia<span>D3</span></strong><p>Calcium +<br />Vitamin D3</p><div className="specimen-pack-orbit">C<span>+</span></div><footer>30 TABLETS<span>SAMPLE</span></footer></div>
          </div>
          <div className="specimen-product-note"><span>01 / THE PRODUCT</span><p>Distinctive packaging.<br />A place of its own.</p></div>
          <div className="specimen-story-footer"><strong>YOUR BRAND, BEAUTIFULLY PRESENTED.</strong><span>Fictional product · Design illustration only</span></div>
        </div>
        <div className="specimen-format"><span>1080 × 1920</span><strong>Made for WhatsApp.</strong><span>Ready to share ↗</span></div>
      </div>
      <figcaption><div><span className="specimen-caption-label">THE FINISHED LOOK</span><strong>A small screen.<br />A stronger impression.</strong></div><Link href="/new" className="specimen-create" aria-label="Create your own product flyer">Create yours <span aria-hidden="true">↗</span></Link></figcaption>
    </figure>
  );
}
