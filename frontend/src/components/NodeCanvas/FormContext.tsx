'use client';

import { createContext, useContext } from 'react';
import type { MapType } from '@/game/constants';
import type { UploadedContextSource } from '@/types/backend';

export interface FormState {
  notesText: string;
  setNotesText: (v: string) => void;
  numNpcs: number;
  setNumNpcs: (v: number) => void;
  numRounds: number;
  setNumRounds: (v: number) => void;
  objective: string;
  setObjective: (v: string) => void;
  mapId: MapType;
  setMapId: (v: MapType) => void;
  primaryPolicy: UploadedContextSource | null;
  trendSources: UploadedContextSource[];
  uploadingPrimary: boolean;
  uploadingTrends: boolean;
  isSimulating: boolean;
  handlePrimaryPolicyFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleTrendFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeTrendSource: (sourceId: string) => void;
  handleSimulate: () => void;
}

export const FormContext = createContext<FormState>(null!);
export const useForm = () => useContext(FormContext);
