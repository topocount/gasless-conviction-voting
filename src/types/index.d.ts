import {Signer} from "@ethersproject/abstract-signer";

export type ConvictionState = {
  context: string;
  blockHeight?: number;
  participants: Participants[];
  proposals: ProposalConvictions;
  supply: string;
};

export type Participants = {
  account: string;
  balance: string;
  convictions: string;
};

export type ProposalConvictions = ProposalConviction[];

export type ProposalConviction = {
  proposal: string; // DID for the Proposal document
  totalConviction: string;
  triggered: boolean;
};

export type Convictions = {
  context: string;
  convictions: ConvictionElement[];
  proposals: string[];
};

export type ConvictionElement = {
  allocation: number;
  proposal: string;
};

export type Proposal = {
  amount: string;
  beneficiary: string;
  context: string;
  currency: string;
  description?: string;
  title: string;
  url: string;
};

/**
 * This interface exists in @ethersproject's codebase but
 * it is not exported anywhere easily for consumption.
 */
export interface SignerWithAddress extends Signer {
  address: string;
}
