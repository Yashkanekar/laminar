export type StreamToken = {
  type: "text" | "json" | "error" | "done";
  content: string;
};
