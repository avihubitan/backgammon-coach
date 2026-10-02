export type StepStatus = 'active' | 'correct' | 'wrong';

export interface StepViewProps<S> {
  step: S;
  boardWidth: number;
  status: StepStatus;
  /** Wrong attempts so far on this step. */
  mistakes: number;
  onResult: (correct: boolean, message: string) => void;
}
