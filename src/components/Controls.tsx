import { useForm } from "react-hook-form";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Input from "./Input";
import useRendererStore from "../stores/renderer";
import type { RenderOptions } from "../stores/renderer";
import {
  Algorithm,
  INITIAL_ORIGIN_X,
  INITIAL_ORIGIN_Y,
  INITIAL_ZOOM,
} from "../lib/constants";
import Select from "./Select";

const algoOptions = {
  [Algorithm.Noise]: "Noise",
  [Algorithm.Naive]: "Naive",
};

export default function Controls() {
  const render = useRendererStore((state) => state.render);
  const rendering = useRendererStore((state) => state.rendering);
  const {
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RenderOptions>({
    defaultValues: {
      algorithm: Algorithm.Naive,
      cx: INITIAL_ORIGIN_X,
      cy: INITIAL_ORIGIN_Y,
      zoom: INITIAL_ZOOM,
    },
  });

  return (
    <div id="controls">
      <Form aria-disabled={rendering} onSubmit={handleSubmit(render)}>
        <Select
          name="algorithm"
          control={control}
          label="Algorithm"
          size="sm"
          options={algoOptions}
        />
        <Input name="cx" control={control} label="X" size="sm" valueAsNumber />
        <Input name="cy" control={control} label="Y" size="sm" valueAsNumber />
        <Input
          name="zoom"
          control={control}
          label="Zoom"
          size="sm"
          valueAsNumber
        />
        {/* errors will return when field validation fails  */}
        {/* {errors.exampleRequired && <span>This field is required</span>} */}
        <Button as="input" type="submit" disabled={rendering} value="Render" />
      </Form>
    </div>
  );
}
