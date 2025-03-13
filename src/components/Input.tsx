import { useId, type ChangeEvent } from "react";
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
    valueAsNumber?: boolean;
  },
) {
  const { field } = useController({ ...props });
  const id = useId();
  const numberChange = (event: ChangeEvent<HTMLInputElement>) => {
    field.onChange(parseInt(event.target.value));
  };

  return (
    <Form.Group className="mb-3" controlId={`${props.name}-${id}`}>
      {props.label && <Form.Label>{props.label}</Form.Label>}
      <Form.Control
        {...field}
        placeholder={props.name}
        size={props.size}
        onChange={props.valueAsNumber ? numberChange : undefined}
      />

      {/* <Form.Control.Feedback type="invalid">
        {formState.errors[props.name]?.message}
      </Form.Control.Feedback> */}
    </Form.Group>
  );
}
