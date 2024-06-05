import React, { useEffect, useState } from "react";
import ReactFlow, {
  ConnectionLineType,
  Handle,
  MarkerType,
  Position,
  useEdgesState,
  useNodesState,
} from "reactflow";
import dagre from "dagre";
import style from "reactflow/dist/style.css?inline";
import clsx from "clsx";

const AgentGraph = (props: { agentId: string; nodes: any[] }) => {
  const [graph, setGraph] = useState({
    nodes: [] as any[],
    edges: [] as any[],
  });

  useEffect(() => {
    const edges: any[] = [];
    props.nodes.forEach((n: any) => {
      n.dependencies.forEach((dep: any) => {
        edges.push({
          id: `${dep.id}-${n.id}-${dep.field}`,
          source: dep.id,
          target: n.id,
          markerEnd: {
            type: MarkerType.ArrowClosed,
          },
        });
      });
    });
    const graph = {
      nodes: props.nodes.map((n: any) => {
        return {
          id: n.id,
          type: "node",
          data: { id: n.id, label: n.label, type: n.type },
        };
      }),
      edges,
    };
    setGraph(graph);
  }, [props.nodes]);

  return (
    <div>
      <style>{style}</style>
      <Graph nodes={graph.nodes} edges={graph.edges} />
    </div>
  );
};

const NodeComponent = (props: any) => {
  return (
    <div className="relative">
      <div
        className={clsx(
          "flex max-w-52 px-3 py-2 justify-center rounded border border-gray-400",
          props.data.type.id == "@core/input"
            ? "bg-indigo-300"
            : props.data.type.id == "@core/user"
              ? "bg-slate-300"
              : "bg-gray-50"
        )}
      >
        <div>{props.data.label}</div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="relative top-auto w-2 h-2 rounded !bg-slate-500"
        isConnectable={true}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="relative top-auto w-2 h-2 rounded !bg-indigo-500"
        isConnectable={true}
      />
    </div>
  );
};

const nodeTypes = {
  node: NodeComponent,
};

const Graph = (props: { nodes: any[]; edges: any[] }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    const { nodes, edges } = getLayoutedElements(props.nodes, props.edges);
    setNodes([...nodes]);
    setEdges([...edges]);
  }, [props.nodes, props.edges]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      defaultViewport={{ x: 0, y: 0, zoom: 1.5 }}
      connectionLineType={ConnectionLineType.SimpleBezier}
      fitView
      attributionPosition="bottom-left"
    />
  );
};

const dagreGraph = new dagre.graphlib.Graph({
  directed: true,
});
dagreGraph.setDefaultEdgeLabel(() => ({}));
const nodeWidth = 200;
const nodeHeight = 40;
const getLayoutedElements = (nodes: any[], edges: any[], direction = "LR") => {
  const isHorizontal = direction === "LR";
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);
  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = isHorizontal ? "left" : "top";
    node.sourcePosition = isHorizontal ? "right" : "bottom";

    // We are shifting the dagre node position (anchor=center center) to the top left
    // so it matches the React Flow node anchor point (top left).
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    return node;
  });

  return { nodes, edges };
};

export default AgentGraph;
