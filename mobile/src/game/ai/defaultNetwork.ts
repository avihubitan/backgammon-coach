import { deserializeNetwork, type Network, type SerializedNetwork } from './network';
import weights from './weights/network.json';

/**
 * The evaluation network shipped with the app: 64 hidden units, trained by
 * TD(lambda) self-play (scripts/train-network.ts, 300k games). Against the
 * hand-written heuristic it wins about two thirds of its games.
 */
export function loadDefaultNetwork(): Network {
  return deserializeNetwork(weights as SerializedNetwork);
}
