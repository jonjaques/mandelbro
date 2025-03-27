import { useShallow } from "zustand/react/shallow";
import { useForm } from "react-hook-form";
import { Button, Form } from "react-bootstrap";
import Input from "./Input";
import useRendererStore from "../stores/renderer";
import type { RenderOptions } from "../stores/renderer";
import { Algorithm, INITIAL_COLOR_SCHEME } from "../lib/constants";
import Select from "./Select";
import { colors } from "../lib/colors";
import { useEffect } from "react";

const algoOptions = {
  [Algorithm.Noise]: "Noise",
  [Algorithm.Naive]: "Naive",
  [Algorithm.Revised]: "Revised",
};

export default function Controls() {
  const render = useRendererStore((state) => state.render);
  const renderStop = useRendererStore((state) => state.renderStop);
  const { algorithm, rendering, cx, cy, zoom, iterations } = useRendererStore(
    useShallow((state) => ({
      cx: state.cx,
      cy: state.cy,
      zoom: state.zoom,
      iterations: state.iterations,
      rendering: state.rendering,
      algorithm: state.algorithm,
    })),
  );

  const {
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<RenderOptions>({
    defaultValues: {
      algorithm,
      colorScheme: INITIAL_COLOR_SCHEME,
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
        <Button variant="danger" disabled={!rendering} onClick={renderStop}>
          Stop
        </Button>
      </Form>
    </div>
  );
}
