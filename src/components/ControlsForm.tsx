import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useForm } from "react-hook-form";
import useRendererStore, { pickRendererState } from "../stores/renderer";
import { colors } from "../lib/colors";
import type { RenderOptions } from "../stores/renderer";
import Button from "./Button";
import Input from "./Input";
import Select from "./Select";
import { Algorithm } from "../lib/constants";

const algoOptions = {
  [Algorithm.Fancy]: "Fancy",
  [Algorithm.Noise]: "Noise",
  [Algorithm.Naive]: "Naive",
  [Algorithm.Revised]: "Revised",
};

export default function ControlsForm() {
  const { algorithm, cx, cy, zoom, colorScheme, escapeRadius, iterations } =
    useRendererStore(useShallow(pickRendererState));
  const { render, rendering, renderCancel, reset } = useRendererStore(
    useShallow((state) => ({
      render: state.render,
      rendering: state.rendering,
      reset: state.reset,
      renderCancel: state.renderCancel,
    })),
  );

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
    <form
      className="max-w-sm mx-auto"
      aria-disabled={rendering}
      onSubmit={handleSubmit(onSubmit)}
    >
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

      <div className="pt-2">
        <Button variant="primary" full type="submit" disabled={rendering}>
          Render
        </Button>
        <Button
          full
          variant="secondary"
          disabled={!rendering}
          onClick={(e) => {
            console.log("stop");
            e.preventDefault();
            renderCancel();
          }}
        >
          Stop
        </Button>
        <Button
          full
          variant="secondary"
          onClick={(e) => {
            console.log("reset");
            e.preventDefault();
            renderCancel();
            reset();
            render();
          }}
        >
          Reset
        </Button>
      </div>
    </form>
  );
}
