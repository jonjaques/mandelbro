import classnames from "classnames";
import { useRendererStore } from "../stores/renderer";
import { getHeaderGradient } from "../lib/colors";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "tertiary";
  full?: boolean;
}

export default function Button(props: ButtonProps) {
  const { full, variant, children, ...rest } = props;
  const headerGradient = useRendererStore(getHeaderGradient);
  const buttonClasses = [
    "text-white",
    "bg-gradient-to-br",
    "focus:ring-4",
    "focus:outline-none",
    "focus:ring-blue-300",
    "font-medium",
    "rounded-lg",
    "text-sm",
    "px-3",
    "py-1.5",
    "text-center",
    "mb-1.5",
    "me-1.5",
  ];

  if (full) {
    buttonClasses.push("w-full");
  }

  if (variant === "secondary") {
    buttonClasses.push(
      "bg-zinc-500",
      "hover:bg-zinc-600",
      "focus:ring-zinc-300",
    );
  }

  return (
    <button
      style={{
        backgroundImage: variant !== "primary" ? undefined : headerGradient,
      }}
      className={classnames(buttonClasses)}
      {...rest}
    >
      {children}
    </button>
  );
}
