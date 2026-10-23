import Image from "next/image";

/** The unretouched PNG downloaded from the real studio, with its demonstration source disclosed. */
export function HeroCircular() {
  return <figure className="workflow-showcase">
    <a className="workflow-output" href="/showcase/citriva-story-editorial.png" target="_blank" rel="noopener noreferrer" aria-label="Open the full-size flyer exported from Dawakraft">
      <Image src="/showcase/citriva-story-editorial.png" width={1080} height={1920} sizes="(max-width: 720px) 80vw, 310px" alt="Actual Dawakraft Story export for fictional Citriva C: original source bottle, vitamin C wording, continuous citrus-garden photograph, matching navy and orange accents, and a compact price ticket" priority />
    </a>
    <figcaption>
      <Image src="/showcase/citriva-source.png" width={54} height={68} alt="AI-generated fictional source product used in the demonstration" />
      <div><strong>Source photo → finished flyer</strong><p>AI-generated demo input. Exported by the app.</p><a href="/showcase/citriva-story-editorial.png" download="Dawakraft-demo-story.png">Download the actual export ↗</a></div>
    </figcaption>
  </figure>;
}


