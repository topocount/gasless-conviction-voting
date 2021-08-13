import {Signer} from "@ethersproject/abstract-signer";

export type ConvictionState = {
  context: string;
  blockHeight?: number;
  participants: Participants[];
  proposals: Proposals;
  supply: number;
};

export type Participants = {
  account: string;
  balance: number;
  convictions: string;
};

export type Proposals = ProposalConviction[];

export type ProposalConviction = {
  proposal: string; // DID for the Proposal document
  totalConviction: number;
  triggered: boolean;
};

export type Convictions = {
  context: string;
  convictions: ConvictionElement[];
  proposals: string[];
  supply?: number;
};

export type ConvictionElement = {
  allocation: number;
  proposal: string;
};

export type Proposal = {
  amount: number;
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
