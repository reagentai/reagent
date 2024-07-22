enum EventType {
  // emitted when a workflow is started
  START = "START",
  INVOKE = "INVOKE",
  OUTPUT = "OUTPUT",
  RENDER = "RENDER",
  NO_BINDINGS = "NO_BINDINGS",
  RUN_COMPLETED = "RUN_COMPLETED",
  RUN_SKIPPED = "RUN_SKIPPED",
  TOOL_CALL = "TOOL_CALL",
}

export { EventType };
