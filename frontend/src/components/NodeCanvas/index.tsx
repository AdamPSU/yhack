"use client";

import {
  type Edge,
  type Node,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { useCallback, useMemo, useState } from "react";
import "@xyflow/react/dist/style.css";
import { useRouter } from "next/navigation";
import { type MapType, setSelectedMap } from "@/game/constants";
import { setReplayData } from "@/lib/replayStore";
import { startSimulation, uploadContextSource } from "@/services/wsClient";
import type { SavedSimulation, UploadedContextSource } from "@/types/backend";
import ConfigNode from "./ConfigNode";
import { FormContext } from "./FormContext";
import PolicyNode from "./PolicyNode";
import RunNode from "./RunNode";

function isSavedSimulation(data: unknown): data is SavedSimulation {
  if (!data || typeof data !== "object") return false;
  const candidate = data as Partial<SavedSimulation>;
  return (
    candidate.initMsg?.type === "init" &&
    Array.isArray(candidate.initMsg.npcs) &&
    Array.isArray(candidate.rounds)
  );
}

const nodeTypes = {
  policyNode: PolicyNode,
  configNode: ConfigNode,
  runNode: RunNode,
};

const initialNodes: Node[] = [
  {
    id: "policy",
    type: "policyNode",
    position: { x: 50, y: 200 },
    data: {},
    draggable: false,
  },
  {
    id: "config",
    type: "configNode",
    position: { x: 600, y: 140 },
    data: {},
    draggable: false,
  },
  {
    id: "run",
    type: "runNode",
    position: { x: 1050, y: 220 },
    data: {},
    draggable: false,
  },
];

const edgeStyle = {
  stroke: "#D4A520",
  strokeWidth: 2.5,
};

const initialEdges: Edge[] = [
  {
    id: "e1-2",
    source: "policy",
    target: "config",
    type: "smoothstep",
    style: edgeStyle,
    animated: true,
  },
  {
    id: "e2-3",
    source: "config",
    target: "run",
    type: "smoothstep",
    style: edgeStyle,
    animated: true,
  },
];

interface NodeCanvasProps {
  onSimulateStart?: () => void;
}

export default function NodeCanvas({ onSimulateStart }: NodeCanvasProps) {
  const router = useRouter();
  const [notesText, setNotesText] = useState("");
  const [numNpcs, setNumNpcs] = useState(25);
  const [numRounds, setNumRounds] = useState(5);
  const [objective, setObjective] = useState("");
  const mapId: MapType = "citypack";
  const setMapId = useCallback((_: MapType) => {}, []);
  const [uploadingPrimary, setUploadingPrimary] = useState(false);
  const [uploadingTrends, setUploadingTrends] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [primaryPolicy, setPrimaryPolicy] =
    useState<UploadedContextSource | null>(null);
  const [trendSources, setTrendSources] = useState<UploadedContextSource[]>([]);
  const [record, setRecord] = useState(false);
  const [loadingCustomRun, setLoadingCustomRun] = useState(false);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const handlePrimaryPolicyFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploadingPrimary(true);
      try {
        const uploaded = await uploadContextSource(file, "Primary Policy PDF");
        setPrimaryPolicy(uploaded);
      } catch {
        alert("Could not upload the policy PDF.");
      } finally {
        setUploadingPrimary(false);
        e.target.value = "";
      }
    },
    [],
  );

  const handleTrendFiles = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (!files.length) return;

      setUploadingTrends(true);
      try {
        const uploaded = await Promise.all(
          files.map((file) => uploadContextSource(file, file.name)),
        );
        setTrendSources((prev) => [...prev, ...uploaded]);
      } catch {
        alert("Could not upload one or more CSV trend files.");
      } finally {
        setUploadingTrends(false);
        e.target.value = "";
      }
    },
    [],
  );

  const removeTrendSource = useCallback((sourceId: string) => {
    setTrendSources((prev) => prev.filter((source) => source.id !== sourceId));
  }, []);

  const handleSimulate = useCallback(async () => {
    if (!primaryPolicy || isSimulating || uploadingPrimary || uploadingTrends)
      return;

    onSimulateStart?.();
    setIsSimulating(true);
    setSelectedMap(mapId);

    const recordParam = record ? "&record=true" : "";

    try {
      const simId = await startSimulation({
        primary_policy_source_id: primaryPolicy.id,
        notes_text: notesText,
        trend_source_ids: trendSources.map((source) => source.id),
        num_rounds: numRounds,
        num_npcs: numNpcs,
        objective,
        map_id: mapId,
      });

      router.push(`/simulate?id=${simId}${recordParam}`);
    } catch (err) {
      console.error("Failed to start simulation:", err);
      alert("Failed to start simulation. Is the backend running?");
      setIsSimulating(false);
    }
  }, [
    primaryPolicy,
    notesText,
    trendSources,
    numNpcs,
    numRounds,
    objective,
    record,
    router,
    isSimulating,
    uploadingPrimary,
    uploadingTrends,
    onSimulateStart,
  ]);

  const handleLoadCustomRun = useCallback(async () => {
    if (loadingCustomRun) return;
    setLoadingCustomRun(true);
    try {
      const module = await import("@/custom_run.json");
      const bundledReplay = module.default as unknown;
      if (!isSavedSimulation(bundledReplay)) {
        console.error("Bundled custom run is invalid");
        setLoadingCustomRun(false);
        return;
      }
      setReplayData(bundledReplay);
      router.push("/simulate?mode=replay&map=citypack");
    } catch (err) {
      console.error("Failed to load bundled custom run:", err);
      setLoadingCustomRun(false);
    }
  }, [loadingCustomRun, router]);

  const handleLoadFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result as string) as SavedSimulation;
          if (!isSavedSimulation(parsed)) {
            console.error("Invalid simulation file: missing initMsg or rounds");
            return;
          }
          setReplayData(parsed);
          router.push(`/simulate?mode=replay&map=${mapId}`);
        } catch (err) {
          console.error("Failed to parse simulation file:", err);
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [router],
  );

  const formValue = useMemo(
    () => ({
      notesText,
      setNotesText,
      numNpcs,
      setNumNpcs,
      numRounds,
      setNumRounds,
      objective,
      setObjective,
      mapId,
      setMapId,
      primaryPolicy,
      trendSources,
      uploadingPrimary,
      uploadingTrends,
      isSimulating,
      record,
      setRecord,
      handlePrimaryPolicyFile,
      handleTrendFiles,
      removeTrendSource,
      handleSimulate,
      handleLoadCustomRun,
      handleLoadFile,
      loadingCustomRun,
    }),
    [
      notesText,
      numNpcs,
      numRounds,
      objective,
      primaryPolicy,
      trendSources,
      uploadingPrimary,
      uploadingTrends,
      isSimulating,
      record,
      handlePrimaryPolicyFile,
      handleTrendFiles,
      removeTrendSource,
      handleSimulate,
      handleLoadCustomRun,
      handleLoadFile,
      loadingCustomRun,
      setMapId,
    ],
  );

  return (
    <FormContext.Provider value={formValue}>
      <style>{`
        .react-flow, .react-flow__pane, .react-flow__renderer, .react-flow__background { background: transparent !important; }
        .react-flow__edge-path { stroke-linecap: round; }
        .react-flow__edge.animated path { animation-duration: 1.5s; }
      `}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        proOptions={{ hideAttribution: true }}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        nodesDraggable={false}
        nodesConnectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        minZoom={1}
        maxZoom={1}
      />
    </FormContext.Provider>
  );
}
