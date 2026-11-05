import { Mail } from "lucide-react";
import { contactLinks, copy, type Locale } from "@mofied/design";

export function ContactLinks({ locale }: { locale: Locale }) {
  return (
    <nav className="contact-links" aria-label={copy[locale].support}>
      {contactLinks.map((link) => (
        <a
          key={link.id}
          className="contact-link"
          href={link.href}
          aria-label={link.label[locale]}
          title={link.label[locale]}
          target={link.id === "email" ? undefined : "_blank"}
          rel={link.id === "email" ? undefined : "noopener noreferrer"}
        >
          {link.path ? (
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path d={link.path} fill="currentColor" />
            </svg>
          ) : (
            <Mail size={20} aria-hidden="true" />
          )}
        </a>
      ))}
    </nav>
  );
}
