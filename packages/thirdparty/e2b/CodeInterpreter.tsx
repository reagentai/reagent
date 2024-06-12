import { Execution } from "@e2b/code-interpreter";
import { Spinner } from "@reagentai/react/components/Spinner.js";

const CodeInterpreterComponent = (props: {
  data: Pick<Execution, "results" | "logs" | "error"> | undefined;
}) => {
  return (
    <div>
      {!props.data && (
        <div className="flex font-medium text-gray-700 items-center space-x-2">
          <div>Running code interpreter</div>
          <Spinner className="text-gray-500 animate-spin" />
        </div>
      )}
      {props.data &&
        props.data.results.map((result, index) => {
          return (
            <div key={index}>
              {result.png && (
                <img src={`data:image/png;base64,${result.png}`} />
              )}
            </div>
          );
        })}
      {/* TODO: render error and logs */}
    </div>
  );
};

export { CodeInterpreterComponent };
