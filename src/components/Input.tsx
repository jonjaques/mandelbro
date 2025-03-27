import { useId } from "react";
import { Form } from "react-bootstrap";
import {
  useController,
  type UseControllerProps,
  type FieldValues,
} from "react-hook-form";

export default function Input<T extends FieldValues>(
  props: UseControllerProps<T> & {
    label?: string;
    size?: "sm" | "lg";
  },
) {
  const { field } = useController({ ...props });
  const id = useId();

  return (
    <Form.Group className="mb-3" controlId={`${props.name}-${id}`}>
      {props.label && <Form.Label>{props.label}</Form.Label>}
      <Form.Control {...field} placeholder={props.name} size={props.size} />

      {/* <Form.Control.Feedback type="invalid">
        {formState.errors[props.name]?.message}
      </Form.Control.Feedback> */}
    </Form.Group>
  );
}
