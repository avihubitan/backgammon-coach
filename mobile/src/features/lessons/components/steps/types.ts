export type StepStatus = 'active' | 'correct' | 'wrong';

export interface StepResultDetail {
  /** The kind of mistake recognised in a wrong answer (for learning analytics). */
  mistakeCategory?: string;
}

export interface StepViewProps<S> {
  step: S;
  boardWidth: number;
  status: StepStatus;
  /** Wrong attempts so far on this step. */
  mistakes: number;
  onResult: (correct: boolean, message: string, detail?: StepResultDetail) => void;
}
