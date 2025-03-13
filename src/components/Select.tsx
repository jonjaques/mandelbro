import { useId } from "react";
import { Form } from "react-bootstrap";
import {
  useController,
  type UseControllerProps,
  type FieldValues,
} from "react-hook-form";

export default function Select<T extends FieldValues>(
  props: UseControllerProps<T> & {
    label?: string;
    size?: "sm" | "lg";
    options: Record<string, string>;
  }
) {
  const { field } = useController(props);
  const id = useId();
  return (
    <Form.Group className="mb-3" controlId={`${props.name}-${id}`}>
      {props.label && <Form.Label>{props.label}</Form.Label>}
      <Form.Select {...field} size={props.size}>
        {Object.entries(props.options).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Form.Select>
      {/* <Form.Control.Feedback type="invalid">
        {formState.errors[props.name]?.message}
      </Form.Control.Feedback> */}
    </Form.Group>
  );
}
