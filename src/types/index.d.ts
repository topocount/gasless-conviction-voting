import {Signer} from "@ethersproject/abstract-signer";

export interface ConvictionState {
  context: string;
  participants: Participants[];
  proposals: Proposals[];
  supply: number;
}

export interface Participants {
  account: string;
  balance: number;
  convictions: string;
}

export type Proposals = ProposalConvction[];

export interface ProposalConviction {
  proposal: string;
  totalConviction: number;
  triggered: boolean;
}

export interface Convictions {
  context: string;
  convictions: ConvictionElement[];
  proposals: string[];
  supply?: number;
}

export interface ConvictionElement {
  allocation: number;
  proposal: string;
}

export interface Proposal {
  amount: number;
  blockHeight: number;
  beneficiary: string;
  context: string;
  currency: string;
  description?: string;
  title: string;
  url: string;
}

/**
 * This interface exists in @ethersproject's codebase but
 * it is not exported anywhere easily for consumption.
 */
export interface SignerWithAddress extends Signer {
  address: string;
}
