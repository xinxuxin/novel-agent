import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

import type { ChapterWorkflowNode } from "@contracts/workflow";

interface WrappedState<State extends Record<string, unknown>> {
  stateJson: State;
}

interface DynamicStateGraphBuilder {
  addNode(
    name: string,
    action: (
      state: WrappedState<Record<string, unknown>>
    ) => Promise<WrappedState<Record<string, unknown>>>
  ): DynamicStateGraphBuilder;
  addEdge(from: string, to: string): DynamicStateGraphBuilder;
  compile(): {
    invoke(
      input: WrappedState<Record<string, unknown>>
    ): Promise<WrappedState<Record<string, unknown>>>;
  };
}

const WrappedStateAnnotation = Annotation.Root({
  stateJson: Annotation<Record<string, unknown>>()
});

export async function runLangGraphSegment<State extends Record<string, unknown>>(
  nodes: ChapterWorkflowNode[],
  initialState: State,
  executeNode: (node: ChapterWorkflowNode, state: State) => Promise<State>
): Promise<State> {
  if (nodes.length === 0) {
    return initialState;
  }

  const builder = new StateGraph(WrappedStateAnnotation) as unknown as DynamicStateGraphBuilder;
  for (const node of nodes) {
    builder.addNode(node, async (wrapped) => ({
      stateJson: await executeNode(node, wrapped.stateJson as State)
    }));
  }
  builder.addEdge(START, nodes[0] as string);
  for (let index = 0; index < nodes.length - 1; index += 1) {
    builder.addEdge(nodes[index] as string, nodes[index + 1] as string);
  }
  builder.addEdge(nodes[nodes.length - 1] as string, END);

  const compiled = builder.compile();
  const result = await compiled.invoke({ stateJson: initialState });
  return result.stateJson as State;
}
