import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "~/lib/utils";

/**
 * Markdown from a submission or prompt. Raw HTML is not rendered, so model
 * output cannot inject markup into the app shell.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("markdown", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => (
            <a href={props.href} target="_blank" rel="noreferrer nofollow">
              {props.children}
            </a>
          ),
          img: (props) => (
            <img
              src={props.src}
              alt={props.alt ?? ""}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
