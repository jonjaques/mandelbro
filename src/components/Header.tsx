import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars } from "@fortawesome/free-solid-svg-icons";

export default function Header() {
  return (
    <header className="fixed w-full bg-zinc-900/80 backdrop-blur-sm shadow-md py-3 z-50 transition-colors duration-300">
      <div className="container mx-auto px-6 flex flex-col md:flex-row md:justify-between md:items-center">
        <div className="flex items-center justify-between">
          <a
            title="Mandelbro"
            href="/"
            className="text-3xl font-macula text-transparent bg-clip-text bg-gradient-to-br from-sky-300 to-indigo-600 transition-colors duration-300"
          >
            Mandelbro
          </a>
          <button
            id="menu-toggle"
            title="Toggle Navigation"
            aria-controls="mobile-menu"
            aria-expanded="false"
            className="md:hidden focus:outline-none"
          >
            <FontAwesomeIcon icon={faBars} />
          </button>
        </div>

        <nav
          id="mobile-menu"
          aria-label="Main Navigation"
          className="hidden md:flex flex-col md:flex-row mt-4 md:mt-0 space-y-2 md:space-y-0 md:space-x-6 text-lg"
        >
          stuff and things
        </nav>
      </div>
    </header>
  );
}

// const menuToggle = document.getElementById("menu-toggle");
// const mobileMenu = document.getElementById("mobile-menu");

// menuToggle.addEventListener("click", () => {
//   const isExpanded = menuToggle.getAttribute("aria-expanded") === "true";
//   menuToggle.setAttribute("aria-expanded", !isExpanded);
//   mobileMenu.classList.toggle("hidden");
// });
