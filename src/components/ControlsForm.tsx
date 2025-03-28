import { useShallow } from "zustand/react/shallow";
import { useForm } from "react-hook-form";
import { Button, Form } from "react-bootstrap";
import Input from "./Input";
import useRendererStore, { pickRendererState } from "../stores/renderer";
import type { RenderOptions } from "../stores/renderer";
import { Algorithm } from "../lib/constants";
import Select from "./Select";
import { colors } from "../lib/colors";
import { useEffect } from "react";

const algoOptions = {
  [Algorithm.Noise]: "Noise",
  [Algorithm.Naive]: "Naive",
  [Algorithm.Revised]: "Revised",
};

export default function ControlsForm() {
  const render = useRendererStore((state) => state.render);
  const rendering = useRendererStore((state) => state.rendering);
  const renderStop = useRendererStore((state) => state.renderStop);
  const { algorithm, cx, cy, zoom, colorScheme, escapeRadius, iterations } =
    useRendererStore(useShallow(pickRendererState));

  const {
    handleSubmit,
    control,
    setValue,
    // formState: { errors },
  } = useForm<RenderOptions>({
    defaultValues: {
      algorithm,
      colorScheme,
      cx,
      cy,
      zoom,
      escapeRadius,
      iterations,
    },
  });

  useEffect(() => {
    setValue("algorithm", algorithm);
    setValue("cx", cx);
    setValue("cy", cy);
    setValue("zoom", zoom);
    setValue("colorScheme", colorScheme);
    setValue("escapeRadius", escapeRadius);
    setValue("iterations", iterations);
  }, [algorithm, cx, cy, zoom, colorScheme, escapeRadius, iterations]);

  const onSubmit = (data: RenderOptions) => {
    if (typeof data.cx !== "undefined") {
      data.cx = parseFloat(data.cx + "");
    }
    if (typeof data.cy !== "undefined") {
      data.cy = parseFloat(data.cy + "");
    }
    if (typeof data.zoom !== "undefined") {
      data.zoom = parseFloat(data.zoom + "");
    }
    if (typeof data.escapeRadius !== "undefined") {
      data.escapeRadius = parseInt(data.escapeRadius + "", 10);
    }
    if (typeof data.iterations !== "undefined") {
      data.iterations = parseInt(data.iterations + "", 10);
    }
    render(data);
  };

  return (
    <Form aria-disabled={rendering} onSubmit={handleSubmit(onSubmit)}>
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
      <Input name="cx" control={control} label="X" size="sm" />
      <Input name="cy" control={control} label="Y" size="sm" />
      <Input name="zoom" control={control} label="Zoom" size="sm" />

      <Input
        name="escapeRadius"
        control={control}
        label="Escape Radius"
        size="sm"
      />
      <Input name="iterations" control={control} label="Iterations" size="sm" />
      {/* errors will return when field validation fails  */}
      {/* {errors.exampleRequired && <span>This field is required</span>} */}
      <Button as="input" type="submit" disabled={rendering} value="Render" />
      <Button variant="danger" disabled={!rendering} onClick={renderStop}>
        Stop
      </Button>
    </Form>
  );
}
