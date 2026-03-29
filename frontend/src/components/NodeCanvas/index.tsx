'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useRouter } from 'next/navigation';
import { startSimulation, uploadContextSource } from '@/services/wsClient';
import { type MapType, setSelectedMap } from '@/game/constants';
import type { UploadedContextSource } from '@/types/backend';
import { FormContext } from './FormContext';
import PolicyNode from './PolicyNode';
import ConfigNode from './ConfigNode';
import ObjectiveNode from './ObjectiveNode';
import RunNode from './RunNode';

const nodeTypes = {
  policyNode: PolicyNode,
  configNode: ConfigNode,
  objectiveNode: ObjectiveNode,
  runNode: RunNode,
};

const initialNodes: Node[] = [
  { id: 'policy',    type: 'policyNode',    position: { x: 0,    y: 0  }, data: {} },
  { id: 'config',    type: 'configNode',    position: { x: 450,  y: 40 }, data: {} },
  { id: 'objective', type: 'objectiveNode', position: { x: 760,  y: 40 }, data: {} },
  { id: 'run',       type: 'runNode',       position: { x: 1070, y: 80 }, data: {} },
];

const edgeStyle = { stroke: 'rgba(168,85,247,0.5)', strokeWidth: 2 };

const initialEdges: Edge[] = [
  { id: 'e1-2', source: 'policy',    target: 'config',    type: 'smoothstep', style: edgeStyle },
  { id: 'e2-3', source: 'config',    target: 'objective', type: 'smoothstep', style: edgeStyle },
  { id: 'e3-4', source: 'objective', target: 'run',       type: 'smoothstep', style: edgeStyle },
];

export default function NodeCanvas() {
  const router = useRouter();
  const [notesText, setNotesText] = useState('');
  const [numNpcs, setNumNpcs] = useState(25);
  const [numRounds, setNumRounds] = useState(5);
  const [objective, setObjective] = useState('');
  const mapId: MapType = 'citypack';
  const setMapId = (_v: MapType) => {};
  const [uploadingPrimary, setUploadingPrimary] = useState(false);
  const [uploadingTrends, setUploadingTrends] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [primaryPolicy, setPrimaryPolicy] = useState<UploadedContextSource | null>(null);
  const [trendSources, setTrendSources] = useState<UploadedContextSource[]>([]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const handlePrimaryPolicyFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPrimary(true);
    try {
      const uploaded = await uploadContextSource(file, 'Primary Policy PDF');
      setPrimaryPolicy(uploaded);
    } catch {
      alert('Could not upload the policy PDF.');
    } finally {
      setUploadingPrimary(false);
      e.target.value = '';
    }
  }, []);

  const handleTrendFiles = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    setUploadingTrends(true);
    try {
      const uploaded = await Promise.all(
        files.map((file) => uploadContextSource(file, file.name)),
      );
      setTrendSources((prev) => [...prev, ...uploaded]);
    } catch {
      alert('Could not upload one or more CSV trend files.');
    } finally {
      setUploadingTrends(false);
      e.target.value = '';
    }
  }, []);

  const removeTrendSource = useCallback((sourceId: string) => {
    setTrendSources((prev) => prev.filter((source) => source.id !== sourceId));
  }, []);

  const handleSimulate = useCallback(async () => {
    if (!primaryPolicy || isSimulating || uploadingPrimary || uploadingTrends) return;

    setIsSimulating(true);
    setSelectedMap(mapId);

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

      sessionStorage.setItem('agora-policy', primaryPolicy.filename);
      sessionStorage.setItem('agora-policy-source-id', primaryPolicy.id);
      sessionStorage.setItem('agora-notes', notesText);
      sessionStorage.setItem('agora-num-npcs', numNpcs.toString());
      sessionStorage.setItem('agora-num-rounds', numRounds.toString());
      sessionStorage.setItem('agora-objective', objective);
      sessionStorage.setItem('agora-map-id', mapId);
      sessionStorage.setItem(
        'agora-trend-sources',
        JSON.stringify(trendSources.map((source) => source.filename)),
      );

      router.push(`/simulate?id=${simId}`);
    } catch (err) {
      console.error('Failed to start simulation:', err);
      alert('Failed to start simulation. Is the backend running?');
      setIsSimulating(false);
    }
  }, [
    primaryPolicy,
    notesText,
    trendSources,
    numNpcs,
    numRounds,
    objective,
    mapId,
    router,
    isSimulating,
    uploadingPrimary,
    uploadingTrends,
  ]);

  const formValue = useMemo(() => ({
    notesText, setNotesText,
    numNpcs, setNumNpcs,
    numRounds, setNumRounds,
    objective, setObjective,
    mapId, setMapId,
    primaryPolicy,
    trendSources,
    uploadingPrimary,
    uploadingTrends,
    isSimulating,
    handlePrimaryPolicyFile,
    handleTrendFiles,
    removeTrendSource,
    handleSimulate,
  }), [
    notesText,
    numNpcs,
    numRounds,
    objective,
    mapId,
    primaryPolicy,
    trendSources,
    uploadingPrimary,
    uploadingTrends,
    isSimulating,
    handlePrimaryPolicyFile,
    handleTrendFiles,
    removeTrendSource,
    handleSimulate,
  ]);

  return (
    <FormContext.Provider value={formValue}>
      <style>{`
        .react-flow, .react-flow__pane, .react-flow__renderer, .react-flow__background { background: transparent !important; }
        .react-flow__edge-path { stroke-linecap: round; }
      `}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        proOptions={{ hideAttribution: true }}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        panOnDrag
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        minZoom={0.5}
        maxZoom={1.2}
      />
    </FormContext.Provider>
  );
}
