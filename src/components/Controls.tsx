import { useState } from "react";
import { Button, Collapse } from "react-bootstrap";
import ControlsForm from "./ControlsForm";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars } from "@fortawesome/free-solid-svg-icons";

export default function Controls() {
  const [open, setOpen] = useState(false);
  return (
    <div id="controls">
      <div className="d-flex flex-row justify-content-between align-items-center">
        <div>Mandelbro</div>
        <Button
          variant="outline-secondary"
          onClick={() => setOpen(!open)}
          aria-controls="Menu"
          aria-expanded={open}
        >
          <FontAwesomeIcon icon={faBars} />
        </Button>
      </div>
      <Collapse in={open}>
        <div>
          <ControlsForm />
        </div>
      </Collapse>
    </div>
  );
}
