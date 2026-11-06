import { copy, type Locale } from "@mofied/design";
import logo from "@mofied/design/assets/icons/icon-white.svg";

export function LaunchArtwork({ locale }: { locale: Locale }) {
  return (
    <div
      className="launch-artwork"
      role="status"
      aria-label={copy[locale].starting}
    >
      <img className="launch-mark" src={logo} alt="" />
      <span className="launch-spinner" aria-hidden="true" />
    </div>
  );
}
