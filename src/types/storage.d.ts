import { ConvictionState } from "./index.d";
export interface Storage {
  setStateDocument: (state: ConvictionState) => Promise<ConvictionState>;
  fetchOrCreateStateDocument: () => Promise<ConvictionState>;
}
