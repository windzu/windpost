import * as React from "react";
import { useCallback, useRef } from "react";
import { PhoneMockup } from "./PhoneMockup";
import iframeShell from "../iframe-shell.html";

interface Props {
  html: string;
  status: "idle" | "rendering" | "ready" | "error";
  emptyHint?: React.ReactNode;
  errorMessage?: string | null;
  device?: "phone" | "page";
}

export function Preview({ html, status, emptyHint, errorMessage, device = "phone" }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const onIframeLoad = useCallback(() => {
    // 拦截 iframe 里的链接点击，外链丢到系统浏览器，锚点做平滑滚动
    const iframeDoc = iframeRef.current?.contentDocument;
    if (iframeDoc) {
      iframeDoc.addEventListener("click", (e: MouseEvent) => {
        const link = (e.target as HTMLElement).closest("a");
        if (!link) return;
        const href = link.getAttribute("href");
        if (!href) return;
        e.preventDefault();

        if (href.startsWith("#")) {
          let targetHref = href;
          if (href.includes("-fnref-")) targetHref = href.replace("-fnref-", "-fn-");
          else if (href.includes("-fn-")) targetHref = href.replace("-fn-", "-fnref-");
          const target = iframeDoc.querySelector(
            `[href="${CSS.escape(targetHref)}"]`,
          );
          if (target) target.scrollIntoView({ behavior: "auto" });
          return;
        }

        window.open(href, "_blank", "noopener");
      });
    }
  }, []);

  const content = (
    <>
        {status === "idle" ? (
          <div className="windpost-preview-empty">{emptyHint}</div>
        ) : status === "error" ? (
          <div className="windpost-preview-error">{errorMessage || "出错了"}</div>
        ) : (
          <iframe
            ref={iframeRef}
            title="WindPost preview"
            className="windpost-preview-iframe"
            sandbox="allow-same-origin allow-modals"
            srcDoc={createIframeDocument(html)}
            onLoad={onIframeLoad}
          />
        )}
    </>
  );

  return (
    <div className={`windpost-preview-wrapper is-${device}`}>
      {device === "phone" ? <PhoneMockup>{content}</PhoneMockup> : (
        <div className="windpost-page-frame">{content}</div>
      )}
    </div>
  );
}

function createIframeDocument(html: string): string {
  return iframeShell.replace("<body></body>", `<body>${html}</body>`);
}
