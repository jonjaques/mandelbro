import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars } from "@fortawesome/free-solid-svg-icons";
import { useRendererStore } from "../stores/renderer.ts";
import { getHeaderGradient } from "../lib/colors.ts";

interface HeaderProps {
  toggleMenu: () => void;
}

export default function Header(props: HeaderProps) {
  const headerGradient = useRendererStore(getHeaderGradient);
  return (
    <header className="fixed w-full bg-zinc-900/80 backdrop-blur-sm shadow-md py-3 z-50 transition-colors duration-300">
      <div className="logo-container container mx-auto px-6 flex flex-row justify-between">
        <a
          title="Mandelbro"
          href="/"
          style={{ backgroundImage: headerGradient }}
          className="logo text-3xl font-macula text-transparent bg-clip-text transition-colors duration-300"
        >
          Mandelbro
        </a>
        <button
          id="menu-toggle"
          title="Toggle Navigation"
          aria-controls="mobile-menu"
          aria-expanded="false"
          className="focus:outline-none text-white"
          onClick={props.toggleMenu}
        >
          <FontAwesomeIcon icon={faBars} />
        </button>
      </div>
    </header>
  );
}
