import {
  inline,
  pagePath,
  type Locale,
  type Page,
  type PageId,
} from "@mofied/design";

const latin = /^[\x20-\x7e]+$/;

/** One of the About pages, with its links: another page opens in place. */
export function PageText({
  page,
  locale,
  open,
}: {
  page: Page;
  locale: Locale;
  open: (page: PageId) => void;
}) {
  return (
    <div className="page-text">
      {page.updated && <p className="page-updated">{page.updated}</p>}
      {page.sections.map((section, index) => (
        <section key={index}>
          {section.heading && <h3>{section.heading}</h3>}
          {section.paragraphs.map((paragraph, index) => (
            <p key={index}>
              {inline(paragraph).map((part, index) =>
                "page" in part ? (
                  <a
                    key={index}
                    href={pagePath(part.page, locale)}
                    onClick={(event) => {
                      event.preventDefault();
                      open(part.page);
                    }}
                  >
                    {part.text}
                  </a>
                ) : "href" in part ? (
                  <a
                    key={index}
                    href={part.href}
                    // An address or a Latin name keeps its own direction.
                    dir={latin.test(part.text) ? "ltr" : undefined}
                    {...(part.href.startsWith("mailto:")
                      ? {}
                      : { target: "_blank", rel: "noopener noreferrer" })}
                  >
                    {part.text}
                  </a>
                ) : (
                  part.text
                ),
              )}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}
