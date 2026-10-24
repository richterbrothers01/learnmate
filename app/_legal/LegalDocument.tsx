import Link from "next/link";

import { LegalHeading, LegalThemeSync } from "./LegalClient";
import { LEGAL_LAST_UPDATED, type LegalDocData } from "./legal-content";

type LegalDocumentProps = {
  doc: LegalDocData;
  otherHref: string;
  otherLabel: string;
};

export default function LegalDocument({
  doc,
  otherHref,
  otherLabel,
}: LegalDocumentProps) {
  return (
    <>
      <style>{CSS}</style>

      <LegalThemeSync />

      <div className="lm-legal">
        <div className="legal-wrap">
          <div className="reveal d1">
            <Link href="/dashboard" className="back-link">
              ← Back to dashboard
            </Link>
          </div>

          <header className="legal-head">
            <LegalHeading text={doc.title} />

            <p className="sub reveal d2">{doc.intro}</p>

            <p className="legal-updated reveal d2">
              Last updated {LEGAL_LAST_UPDATED}
            </p>
          </header>

          <article className="legal-card reveal d3">
            {doc.sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                aria-labelledby={`${section.id}-title`}
                className="legal-section"
              >
                <h2 id={`${section.id}-title`}>{section.title}</h2>

                {section.blocks.map((block, index) =>
                  block.type === "p" ? (
                    <p key={index}>{block.text}</p>
                  ) : (
                    <ul key={index}>
                      {block.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ),
                )}
              </section>
            ))}
          </article>

          <nav
            className="legal-foot reveal d3"
            aria-label="Legal pages"
          >
            <Link href={otherHref}>{otherLabel}</Link>

            <Link href="/dashboard">Dashboard</Link>
          </nav>
        </div>
      </div>
    </>
  );
}

/* Colour tokens, type scale, .reveal / fadeUp, the typewriter
   cursor and the back link are copied from the dashboard CSS in
   app/dashboard/page.tsx. Everything is scoped to .lm-legal so
   nothing here can touch the dashboard. */
const CSS = `
.lm-legal{
  --bg:#FAF4E8;
  --card:#FFFDF7;
  --border:#E8DBC0;
  --border-soft:#EFE3C9;
  --text:#3D220F;
  --text-2:#6B4A2E;
  --muted:#8A6F52;
  --brown:#7A2F00;
  --cream:#E9C689;
  --legal-link:#7A2F00;
  --radius:16px;
  --shadow:
    0 1px 2px rgba(122,47,0,.06),
    0 8px 24px rgba(122,47,0,.06);
  font-family:'Inter',system-ui,-apple-system,'SF Pro Text',Segoe UI,Roboto,Arial,sans-serif;
  background:var(--bg);
  color:var(--text);
  min-height:100vh;
  overflow-x:hidden;
  -webkit-font-smoothing:antialiased;
  padding:28px
}

[data-theme="dark"] .lm-legal{
  --bg:#17100A;
  --card:#221609;
  --border:#3A2512;
  --border-soft:#3A2512;
  --text:#F6E8D0;
  --text-2:#D8BE95;
  --muted:#A68A65;
  --legal-link:#E9C689;
  --shadow:0 1px 2px rgba(0,0,0,.4)
}

html:has(.lm-legal){
  background:#FAF4E8
}

html[data-theme="dark"]:has(.lm-legal){
  background:#17100A
}

.lm-legal *{
  box-sizing:border-box
}

.lm-legal .legal-wrap{
  max-width:760px;
  margin:0 auto;
  padding-bottom:48px
}

.lm-legal .legal-sr{
  position:absolute;
  width:1px;
  height:1px;
  overflow:hidden;
  clip:rect(0 0 0 0);
  white-space:nowrap
}

.lm-legal .back-link{
  display:inline-block;
  color:var(--text-2);
  font-size:13px;
  padding:0 0 14px;
  text-decoration:none;
  transition:transform .22s cubic-bezier(.2,.8,.2,1),opacity .22s
}

.lm-legal .back-link:hover{
  opacity:.72;
  transform:translateX(-2px)
}

.lm-legal .legal-head{
  margin:6px 0 22px
}

.lm-legal .h1{
  font-size:34px;
  letter-spacing:-.02em;
  font-weight:800;
  line-height:1.1;
  margin:0
}

.lm-legal .legal-title{
  min-height:1.1em
}

.lm-legal .type-cursor{
  opacity:.45;
  animation:cursorBlink 1s steps(1) infinite
}

@keyframes cursorBlink{
  50%{opacity:0}
}

.lm-legal .sub{
  color:var(--text-2);
  margin:6px 0 0;
  font-size:15px;
  line-height:1.6
}

.lm-legal .legal-updated{
  color:var(--muted);
  margin:10px 0 0;
  font-size:13px
}

.lm-legal .reveal{
  opacity:0;
  transform:translateY(8px);
  animation:fadeUp .55s ease forwards
}

@keyframes fadeUp{
  to{
    opacity:1;
    transform:none
  }
}

.lm-legal .d1{animation-delay:.05s}
.lm-legal .d2{animation-delay:.12s}
.lm-legal .d3{animation-delay:.19s}

.lm-legal .legal-card{
  background:var(--card);
  border:1px solid var(--border);
  border-radius:var(--radius);
  box-shadow:var(--shadow);
  padding:clamp(22px,4vw,40px)
}

.lm-legal .legal-section + .legal-section{
  margin-top:30px
}

.lm-legal .legal-section h2{
  font-size:17px;
  font-weight:650;
  line-height:1.35;
  margin:0 0 10px;
  color:var(--text)
}

.lm-legal .legal-section p,
.lm-legal .legal-section li{
  font-size:15px;
  line-height:1.75;
  color:var(--text-2)
}

.lm-legal .legal-section p + p,
.lm-legal .legal-section p + ul,
.lm-legal .legal-section ul + p{
  margin-top:10px
}

.lm-legal .legal-section ul{
  padding-left:20px
}

.lm-legal .legal-section li{
  margin-top:6px
}

.lm-legal .legal-section li::marker{
  color:var(--muted)
}

.lm-legal a{
  color:var(--legal-link);
  text-decoration:underline;
  text-underline-offset:3px
}

.lm-legal .back-link{
  color:var(--text-2);
  text-decoration:none
}

.lm-legal a:focus-visible{
  outline:2px solid var(--legal-link);
  outline-offset:3px;
  border-radius:4px
}

.lm-legal .legal-foot{
  display:flex;
  flex-wrap:wrap;
  gap:6px 22px;
  margin-top:22px;
  padding:0 4px;
  font-size:13px
}

.lm-legal .legal-foot a{
  color:var(--text-2);
  text-decoration:none;
  padding:6px 0
}

.lm-legal .legal-foot a:hover{
  color:var(--legal-link);
  text-decoration:underline;
  text-underline-offset:3px
}

@media(max-width:860px){
  .lm-legal{
    padding:18px 16px
  }

  .lm-legal .h1{
    font-size:26px
  }
}

@media(prefers-reduced-motion:reduce){
  .lm-legal .reveal{
    opacity:1;
    transform:none;
    animation:none
  }

  .lm-legal .type-cursor{
    animation:none
  }

  .lm-legal .back-link{
    transition:none
  }
}
`;
