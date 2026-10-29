import { avatarUrl } from "~/lib/format";

export function Avatar({
  template,
  username,
  size = 24,
}: {
  template: string | null | undefined;
  username: string;
  size?: number;
}) {
  const src = avatarUrl(template, size * 2);
  const style = { width: size, height: size };
  if (!src) {
    return (
      <span
        style={style}
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-raised text-[11px] font-medium text-muted"
      >
        {username.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      style={style}
      className="shrink-0 rounded-full bg-raised"
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}
