'use client';

import { createContext, useContext } from 'react';

export interface FormState {
  text: string;
  setText: (v: string) => void;
  numNpcs: number;
  setNumNpcs: (v: number) => void;
  numRounds: number;
  setNumRounds: (v: number) => void;
  objective: string;
  setObjective: (v: string) => void;
  fileName: string | null;
  extracting: boolean;
  handleFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSimulate: () => void;
}

export const FormContext = createContext<FormState>(null!);
export const useForm = () => useContext(FormContext);
