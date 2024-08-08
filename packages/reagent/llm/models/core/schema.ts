import z from "zod";

export const metadata = z.object({
  provider: z.string(),
  family: z.enum([
    "openai:gpt-3.5",
    "openai:gpt-4",
    "anthropic:claude-3",
    "meta:llama-2",
    "meta:llama-3",
    "meta:llama-3.1",
    "mistral:mixtral",
    "google:gemma",
    "unknown",
  ]),
  contextLength: z.number(),
  supportedFeatures: z
    .array(
      z.enum([
        "chat-completion",
        "image-url",
        "tool-use",
        // supports streaming response
        "streaming",
        // if the model provider supports streaming when using tools
        "stream-tool-use",
      ])
    )
    .nonempty(),
  request: z
    .object({
      url: z.string(),
      headers: z.record(z.string(), z.string()),
      body: z.object({}).passthrough(),
    })
    .or(z.literal("custom")),
});

export const chatCompletionResponse = z
  .object({
    choices: z.array(
      z.object({
        message: z
          .object({
            role: z.string(),
          })
          .and(
            z.union([
              z.object({
                content: z.string(),
              }),
              z.object({
                tool_calls: z
                  .array(
                    z.object({
                      id: z.string().optional(),
                      type: z.enum(["function"]),
                      function: z.object({
                        name: z.string(),
                        arguments: z.string(),
                      }),
                    })
                  )
                  .optional(),
              }),
            ])
          ),
        finish_reason: z.string(),
      })
    ),
  })
  .passthrough();

export type Metadata = z.infer<typeof metadata>;
export type ChatCompletionResponse = z.infer<typeof chatCompletionResponse>;
