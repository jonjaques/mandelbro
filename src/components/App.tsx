import { useState } from "react";
import Controls from "./Controls";
import Header from "./Header";
import Renderer from "./Renderer";
import Status from "./Status";

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleMenu = () => {
    setMenuOpen((prev) => !prev);
  };
  return (
    <main className={menuOpen ? "menu-open" : ""}>
      <Header toggleMenu={toggleMenu} />
      <Renderer />
      <Controls />
      <Status />
    </main>
  );
}
