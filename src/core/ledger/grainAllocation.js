// @flow

/**
 * In SourceCred, projects regularly distribute Grain to contributors based on
 * their Cred scores. This is called a "Distribution". This module contains the
 * logic for computing distributions.
 */
import * as G from "./grain";
import * as P from "../../util/combo";
import {type CredGrainView} from "../credGrainView";
import {type TimestampMs} from "../../util/timestamp";

import {
  type Uuid,
  random as randomUuid,
  parser as uuidParser,
} from "../../util/uuid";
import {type IdentityId, type Identity} from "../identity";
import {
  type AllocationPolicy,
  allocationPolicyParser,
  balancedReceipts,
  immediateReceipts,
  recentReceipts,
  specialReceipts,
} from "./policies";

export type AllocationId = Uuid;

export type GrainReceipt = {|
  +id: IdentityId,
  +amount: G.Grain,
|};

export type Allocation = {|
  +id: AllocationId,
  +policy: AllocationPolicy,
  +receipts: $ReadOnlyArray<GrainReceipt>,
|};

export function computeAllocation(
  policy: AllocationPolicy,
  credGrainView: CredGrainView,
  effectiveTimestamp: TimestampMs
): Allocation {
  const validatedPolicy = _validatePolicy(policy);
  credGrainView.validateForGrainAllocation();
  return _validateAllocationBudget({
    policy,
    receipts: receipts(validatedPolicy, credGrainView, effectiveTimestamp),
    id: randomUuid(),
  });
}

/* This is a simplified case that should not require a credGrainView */
export function computeAllocationSpecial(
  policy: AllocationPolicy,
  identities: $ReadOnlyArray<Identity>
): Allocation {
  const validatedPolicy = _validatePolicy(policy);
  if (validatedPolicy.policyType === "SPECIAL") {
    return _validateAllocationBudget({
      policy,
      receipts: specialReceipts(validatedPolicy, identities),
      id: randomUuid(),
    });
  } else {
    throw new Error(
      `SpecialPolicyRequired. Got: ${validatedPolicy.policyType}`
    );
  }
}

function _validatePolicy(p: AllocationPolicy) {
  allocationPolicyParser.parseOrThrow(p);
  if (G.lt(p.budget, G.ZERO)) {
    throw new Error(`invalid budget: ${p.budget}`);
  }
  return p;
}

// Exported for test purposes.
export function _validateAllocationBudget(a: Allocation): Allocation {
  const amt = G.sum(a.receipts.map((a) => a.amount));
  if (amt !== a.policy.budget) {
    throw new Error(
      `allocation has budget of ${a.policy.budget} but distributed ${amt}`
    );
  }
  return a;
}

function receipts(
  policy: AllocationPolicy,
  credGrainView: CredGrainView,
  effectiveTimestamp: TimestampMs
): $ReadOnlyArray<GrainReceipt> {
  switch (policy.policyType) {
    case "IMMEDIATE":
      return immediateReceipts(policy, credGrainView, effectiveTimestamp);
    case "RECENT":
      return recentReceipts(policy, credGrainView, effectiveTimestamp);
    case "BALANCED":
      return balancedReceipts(policy, credGrainView, effectiveTimestamp);
    case "SPECIAL":
      const identities = credGrainView
        .activeParticipants()
        .map((participant) => participant.identity);
      return specialReceipts(policy, identities);
    // istanbul ignore next: unreachable per Flow
    default:
      throw new Error(`Unknown policyType: ${(policy.policyType: empty)}`);
  }
}

const grainReceiptParser: P.Parser<GrainReceipt> = P.object({
  id: uuidParser,
  amount: G.parser,
});
export const allocationParser: P.Parser<Allocation> = P.object({
  policy: allocationPolicyParser,
  id: uuidParser,
  receipts: P.array(grainReceiptParser),
});
