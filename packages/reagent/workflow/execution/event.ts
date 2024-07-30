enum EventType {
  // emitted when a workflow is started
  START = "START",
  INVOKE = "INVOKE",
  NO_BINDINGS = "NO_BINDINGS",
  SKIP_INVOKE = "SKIP_INVOKE",
  SKIP_RUN = "SKIP_RUN",
  TOOL_CALL = "TOOL_CALL",
  OUTPUT = "OUTPUT",
  RENDER = "RENDER",
  RUN_COMPLETED = "RUN_COMPLETED",
}

export { EventType };
