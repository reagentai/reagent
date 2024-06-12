import { Execution } from "@e2b/code-interpreter";
import { Spinner } from "@reagentai/react/components/Spinner.js";
import { CollapsibleCode } from "@reagentai/react/components/CollapsibleCode";

export type CodeInterpreterData = Partial<
  Pick<Execution, "results" | "logs" | "error">
> & { code: string };

const CodeInterpreterComponent = (props: { data: CodeInterpreterData }) => {
  return (
    <div>
      {
        <div>
          <CollapsibleCode
            title={
              <div className="flex font-medium text-gray-700 items-center space-x-2">
                {!props.data.results && <div>Executing code</div>}
                {props.data.results && <div>Code execution result</div>}
                <div></div>
                {!props.data.results && (
                  <Spinner className="text-gray-500 animate-spin" />
                )}
              </div>
            }
            language="python"
            code={props.data.code}
          />
        </div>
      }
      {props.data.results?.map((result, index) => {
        return (
          <div key={index}>
            {result.png && <img src={`data:image/png;base64,${result.png}`} />}
          </div>
        );
      })}
      {/* TODO: render error and logs */}
    </div>
  );
};

export { CodeInterpreterComponent };
