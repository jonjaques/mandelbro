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
    type?: "text" | "number" | "email" | "password";
  },
) {
  const { field } = useController({ ...props });
  const id = useId();
  const controlId = `${props.name}-${id}`;

  return (
    <div className="mb-3" id={`control-${controlId}`}>
      {props.label && (
        <label
          className="block mb-2 text-sm font-medium text-white"
          htmlFor={controlId}
        >
          {props.label}
        </label>
      )}
      <input
        id={controlId}
        className="border text-sm rounded-lg block w-full p-2.5 bg-zinc-700 border-zinc-600 placeholder-zinc-400 text-white focus:ring-blue-500 focus:border-blue-500"
        type={props.type || "text"}
        {...field}
        placeholder={props.name}
      />

      {/* <Form.Control.Feedback type="invalid">
        {formState.errors[props.name]?.message}
      </Form.Control.Feedback> */}
    </div>
  );
}
