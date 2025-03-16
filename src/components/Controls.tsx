import { useShallow } from "zustand/react/shallow";
import { useForm } from "react-hook-form";
import { Button, Form } from "react-bootstrap";
import Input from "./Input";
import useRendererStore from "../stores/renderer";
import type { RenderOptions } from "../stores/renderer";
import { Algorithm } from "../lib/constants";
import Select from "./Select";
import { colors } from "../lib/colors";
import { useEffect } from "react";

const algoOptions = {
  [Algorithm.Noise]: "Noise",
  [Algorithm.Naive]: "Naive",
};

export default function Controls() {
  const render = useRendererStore((state) => state.render);
  const { rendering, cx, cy, zoom, iterations } = useRendererStore(
    useShallow((state) => ({
      cx: state.cx,
      cy: state.cy,
      zoom: state.zoom,
      iterations: state.iterations,
      rendering: state.rendering,
    })),
  );

  const {
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<RenderOptions>({
    defaultValues: {
      algorithm: Algorithm.Naive,
      colorScheme: "turbo",
      cx,
      cy,
      zoom,
      iterations,
    },
  });

  useEffect(() => {
    setValue("cx", cx);
    setValue("cy", cy);
    setValue("zoom", zoom);
    setValue("iterations", iterations);
  }, [cx, cy, zoom, iterations]);

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
        <Select
          name="colorScheme"
          control={control}
          label="Color Scheme"
          size="sm"
          options={colors}
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
        <Input
          name="iterations"
          control={control}
          label="Iterations"
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
