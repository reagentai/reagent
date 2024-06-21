import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import hljs from "highlight.js/lib/core";
import jsonGrammar from "highlight.js/lib/languages/json";
import jsGrammar from "highlight.js/lib/languages/javascript";
import tsGrammar from "highlight.js/lib/languages/typescript";
import cssGrammar from "highlight.js/lib/languages/css";
import xmlGrammar from "highlight.js/lib/languages/xml";
import pythonGrammar from "highlight.js/lib/languages/python";
import rustGrammar from "highlight.js/lib/languages/rust";
import cGrammar from "highlight.js/lib/languages/c";

hljs.registerLanguage("json", jsonGrammar);
hljs.registerLanguage("javascript", jsGrammar);
hljs.registerLanguage("typescript", tsGrammar);
hljs.registerLanguage("css", cssGrammar);
hljs.registerLanguage("html", xmlGrammar);
hljs.registerLanguage("xml", xmlGrammar);
hljs.registerLanguage("python", pythonGrammar);
hljs.registerLanguage("rust", rustGrammar);
hljs.registerLanguage("c", cGrammar);
hljs.registerLanguage("python", pythonGrammar);

import "highlight.js/styles/atom-one-dark.css";

const Markdown = (props: { markdown: string; remarkPlugins?: any[] }) => {
  return (
    <ReactMarkdown
      remarkPlugins={props.remarkPlugins}
      components={{
        code({ node, className, children, ...props }) {
          const html = useMemo(() => {
            const match = /language-(\w+)/.exec(className || "");
            const language = match && match[1];
            const text = String(children);
            const highlighted =
              language && hljs.listLanguages().includes(language);
            if (highlighted) {
              return hljs.highlight(text || "", {
                language,
              });
            } else {
              return hljs.highlightAuto(text);
            }
          }, [children]);
          return (
            <code
              className={className}
              {...props}
              dangerouslySetInnerHTML={{
                __html: html.value!,
              }}
            ></code>
          );
        },
      }}
      children={props.markdown}
    />
  );
};

export { Markdown };
