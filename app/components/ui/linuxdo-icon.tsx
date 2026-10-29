import * as React from "react";

export function LinuxDoIcon({
  className = "w-5 h-5",
  size,
}: {
  className?: string;
  size?: number;
}) {
  const clipId = React.useId();
  const style = size ? { width: size, height: size } : undefined;

  return (
    <svg
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <clipPath id={clipId}>
        <circle cx="60" cy="60" r="47" />
      </clipPath>
      <circle fill="#f0f0f0" cx="60" cy="60" r="50" />
      <rect
        fill="#1c1c1e"
        clipPath={`url(#${clipId})`}
        x="10"
        y="10"
        width="100"
        height="30"
      />
      <rect
        fill="#f0f0f0"
        clipPath={`url(#${clipId})`}
        x="10"
        y="40"
        width="100"
        height="40"
      />
      <rect
        fill="#ffb003"
        clipPath={`url(#${clipId})`}
        x="10"
        y="80"
        width="100"
        height="30"
      />
    </svg>
  );
}
