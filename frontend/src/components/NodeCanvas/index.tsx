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
import { extractFile, startSimulation } from '@/services/wsClient';
import { type MapType, setSelectedMap } from '@/game/constants';
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
  const [text, setText] = useState('');
  const [numNpcs, setNumNpcs] = useState(25);
  const [numRounds, setNumRounds] = useState(5);
  const [objective, setObjective] = useState('');
  const [mapId, setMapId] = useState<MapType>('ccity');
  const [extracting, setExtracting] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setExtracting(true);
    try {
      const extracted = await extractFile(file);
      setText((prev) => (prev ? `${prev}\n\n---\n\n${extracted}` : extracted));
    } catch {
      alert('Could not extract text from this file.');
    } finally {
      setExtracting(false);
    }
  }, []);

  const handleSimulate = useCallback(async () => {
    if (text.trim().length < 20 || isSimulating) return;
    
    setIsSimulating(true);
    setSelectedMap(mapId);
    
    try {
      const simId = await startSimulation(
        text,
        numRounds,
        numNpcs,
        objective,
        mapId
      );
      
      sessionStorage.setItem('agora-policy', text);
      sessionStorage.setItem('agora-num-npcs', numNpcs.toString());
      sessionStorage.setItem('agora-num-rounds', numRounds.toString());
      sessionStorage.setItem('agora-objective', objective);
      sessionStorage.setItem('agora-map-id', mapId);
      
      router.push(`/simulate?id=${simId}`);
    } catch (err) {
      console.error('Failed to start simulation:', err);
      alert('Failed to start simulation. Is the backend running?');
      setIsSimulating(false);
    }
  }, [text, numNpcs, numRounds, objective, mapId, router, isSimulating]);

  const formValue = useMemo(() => ({
    text, setText,
    numNpcs, setNumNpcs,
    numRounds, setNumRounds,
    objective, setObjective,
    mapId, setMapId,
    fileName, extracting,
    isSimulating,
    handleFile, handleSimulate,
  }), [text, numNpcs, numRounds, objective, mapId, fileName, extracting, isSimulating, handleFile, handleSimulate]);

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
