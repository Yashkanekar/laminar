export type StreamToken =
  | { type: "text"; content: string }
  | { type: "done"; content: "" }
  | { type: "error"; content: string };
