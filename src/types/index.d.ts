export interface ConvictionState {
    context:      string;
    participants: Participants[];
    proposals:    Proposals[];
    supply:       number;
}

export interface Participants {
    account:     string;
    balance:     number;
    convictions: string;
}

export interface Proposals {
    proposal:        string;
    totalConviction: number;
    triggered:       boolean;
}

export interface Convictions {
    context:     string;
    convictions: ConvictionElement[];
    proposals:   string[];
    supply?:     number;
}

export interface ConvictionElement {
    allocation: number;
    proposal:   string;
}

export interface Proposal {
    amount:       number;
    beneficiary:  string;
    context:      string;
    currency:     string;
    description?: string;
    title:        string;
    url:          string;
}
