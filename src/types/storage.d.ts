import {ConvictionState} from "./index.d";
export interface Storage {
  setStateDocument: (state: ConvictionState) => Promise<ConvictionState>;
  fetchOrCreateStateDocument: () => Promise<ConvictionState>;
  fetchConvictionDoc: (string) => Promise<TileDocument<Convictions> | null>;
  addProposals: (string) => Promise<this>;
  fetchProposal: (string) => Promise<Proposal>;
}
