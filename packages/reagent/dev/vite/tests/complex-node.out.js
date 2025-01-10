import { Loader, CircleCheckBig } from "lucide-react";
import ky from "ky";

const CopilotNode = {
  id: "input",
  name: "Copilot",
  version: "0.1.0",
  components: [
    [
      "fetch",
      ({ key, data, submit, React }) => {
        React.useEffect(() => {
          ky(data.url, {
            method: data.method,
            headers: data.headers,
            body: data.body,
            json: data.json,
          }).then(async (res) => {
            submit({
              headers: {},
              error: null,
              data: data.json ? await res.json() : await res.text(),
              // body: await res.text(),
            });
          });
        }, [key]);
        return <div></div>;
      },
    ],
    [
      "status",
      (props) => {
        return (
          <div className="status flex items-center py-3 px-3 font-medium rounded-md border border-gray-100 space-x-2">
            {props.data.status == "IN_PROGRESS" && (
              <Loader className="w-3 h-3 animate-spin" />
            )}
            {props.data.status == "DONE" && (
              <CircleCheckBig className="w-3 h-3 text-green-700" />
            )}
            <div>{props.data.text}</div>
          </div>
        );
      },
    ],
  ],
};
export { CopilotNode };
export const __reagentai_exports__ = true;
