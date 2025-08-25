// fraud-detection.test.ts
import { describe, expect, it, beforeEach, vi } from "vitest";

// Interfaces for type safety
interface ClarityResponse<T> {
  ok: boolean;
  value: T | number; // number for error codes
}

interface FraudRule {
  name: string;
  maxClaims: number;
  minAmount: number;
  maxAmount: number;
  weight: number;
  active: boolean;
}

interface ClaimFlag {
  patientId: string;
  score: number;
  status: string;
  notes: string;
  timestamp: number;
  reviewer?: string;
}

interface PatientClaimCount {
  count: number;
  lastClaimTimestamp: number;
}

interface ContractState {
  fraudRules: Map<number, FraudRule>;
  claimFlags: Map<string, ClaimFlag>;
  patientClaimCount: Map<string, PatientClaimCount>;
  blockHeight: number;
  claimSubmissionMock: Map<string, { amount: number; patientId: string }>;
  patientRegistryMock: Set<string>;
}

// Mock contract implementation
class FraudDetectionMock {
  private state: ContractState = {
    fraudRules: new Map(),
    claimFlags: new Map(),
    patientClaimCount: new Map(),
    blockHeight: 1000,
    claimSubmissionMock: new Map(),
    patientRegistryMock: new Set(),
  };

  private ERR_UNAUTHORIZED = 300;
  private ERR_INVALID_RULE = 301;
  private ERR_CLAIM_NOT_FOUND = 302;
  private ERR_PATIENT_NOT_FOUND = 303;
  private ERR_INVALID_SCORE = 304;
  private ERR_INVALID_PARAMETER = 305;
  private ERR_RULE_EXISTS = 306;
  private MAX_RULES = 10;
  private TIME_WINDOW = 1440;
  private MAX_NOTES_LENGTH = 200;
  private ADMIN = "deployer";

  private incrementBlockHeight() {
    this.state.blockHeight += 1;
  }

  // Mock external contract calls
  mockClaimSubmission(claimId: string, amount: number, patientId: string) {
    this.state.claimSubmissionMock.set(claimId, { amount, patientId });
  }

  mockPatientRegistry(patientId: string) {
    this.state.patientRegistryMock.add(patientId);
  }

  addRule(
    caller: string,
    ruleId: number,
    name: string,
    maxClaims: number,
    minAmount: number,
    maxAmount: number,
    weight: number
  ): ClarityResponse<boolean> {
    this.incrementBlockHeight();
    if (caller !== this.ADMIN) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (name.length === 0 || maxClaims === 0 || weight === 0 || weight > 500 || ruleId > this.MAX_RULES) {
      return { ok: false, value: this.ERR_INVALID_RULE };
    }
    if (this.state.fraudRules.has(ruleId)) {
      return { ok: false, value: this.ERR_RULE_EXISTS };
    }
    this.state.fraudRules.set(ruleId, {
      name,
      maxClaims,
      minAmount,
      maxAmount,
      weight,
      active: true,
    });
    return { ok: true, value: true };
  }

  disableRule(caller: string, ruleId: number): ClarityResponse<boolean> {
    this.incrementBlockHeight();
    if (caller !== this.ADMIN) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    const rule = this.state.fraudRules.get(ruleId);
    if (!rule) {
      return { ok: false, value: this.ERR_INVALID_RULE };
    }
    this.state.fraudRules.set(ruleId, { ...rule, active: false });
    return { ok: true, value: true };
  }

  analyzeClaim(caller: string, claimId: string, patientId: string): ClarityResponse<number> {
    this.incrementBlockHeight();
    if (!this.state.claimSubmissionMock.has(claimId)) {
      return { ok: false, value: this.ERR_CLAIM_NOT_FOUND };
    }
    if (!this.state.patientRegistryMock.has(patientId)) {
      return { ok: false, value: this.ERR_PATIENT_NOT_FOUND };
    }
    const claim = this.state.claimSubmissionMock.get(claimId)!;
    const score = this.calculateAnomalyScore(claimId, patientId, claim.amount);
    if (score > 1000) {
      return { ok: false, value: this.ERR_INVALID_SCORE };
    }
    const windowStart = this.state.blockHeight - this.TIME_WINDOW;
    const currentCount = this.getClaimCount(patientId);
    this.state.claimFlags.set(claimId, {
      patientId,
      score,
      status: score >= 700 ? "flagged" : "pending",
      notes: "Automated fraud analysis",
      timestamp: this.state.blockHeight,
    });
    this.state.patientClaimCount.set(`${patientId}_${windowStart}`, {
      count: currentCount + 1,
      lastClaimTimestamp: this.state.blockHeight,
    });
    return { ok: true, value: score };
  }

  reviewClaim(caller: string, claimId: string, newStatus: string, notes: string): ClarityResponse<boolean> {
    this.incrementBlockHeight();
    if (caller !== this.ADMIN) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (!["pending", "flagged", "cleared"].includes(newStatus)) {
      return { ok: false, value: this.ERR_INVALID_STATUS };
    }
    if (notes.length > this.MAX_NOTES_LENGTH) {
      return { ok: false, value: this.ERR_INVALID_PARAMETER };
    }
    const flag = this.state.claimFlags.get(claimId);
    if (!flag) {
      return { ok: false, value: this.ERR_CLAIM_NOT_FOUND };
    }
    this.state.claimFlags.set(claimId, {
      ...flag,
      status: newStatus,
      notes,
      timestamp: this.state.blockHeight,
      reviewer: caller,
    });
    return { ok: true, value: true };
  }

  getRule(ruleId: number): ClarityResponse<FraudRule | undefined> {
    return { ok: true, value: this.state.fraudRules.get(ruleId) };
  }

  getClaimFlag(claimId: string): ClarityResponse<ClaimFlag | undefined> {
    return { ok: true, value: this.state.claimFlags.get(claimId) };
  }

  getPatientClaimCount(patientId: string): ClarityResponse<number> {
    return { ok: true, value: this.getClaimCount(patientId) };
  }

  isClaimFlagged(claimId: string): ClarityResponse<boolean> {
    const flag = this.state.claimFlags.get(claimId);
    return { ok: true, value: flag ? flag.status === "flagged" : false };
  }

  private getClaimCount(patientId: string): number {
    const windowStart = this.state.blockHeight - this.TIME_WINDOW;
    const countEntry = this.state.patientClaimCount.get(`${patientId}_${windowStart}`);
    return countEntry ? countEntry.count : 0;
  }

  private calculateAnomalyScore(claimId: string, patientId: string, amount: number): number {
    let score = 0;
    for (let ruleId = 1; ruleId <= this.MAX_RULES; ruleId++) {
      const rule = this.state.fraudRules.get(ruleId);
      if (rule && rule.active) {
        const claimCount = this.getClaimCount(patientId);
        if (
          claimCount >= rule.maxClaims &&
          amount >= rule.minAmount &&
          amount <= rule.maxAmount
        ) {
          score += rule.weight;
        }
      }
    }
    return score > 1000 ? 1000 : score;
  }
}

// Test setup
const accounts = {
  admin: "deployer",
  unauthorized: "wallet_1",
};

describe("FraudDetection Contract", () => {
  let contract: FraudDetectionMock;

  beforeEach(() => {
    contract = new FraudDetectionMock();
    vi.resetAllMocks();
  });

  it("should allow admin to add a fraud rule", () => {
    const result = contract.addRule(
      accounts.admin,
      1,
      "High Claim Frequency",
      3,
      1000,
      5000,
      200
    );
    expect(result).toEqual({ ok: true, value: true });

    const rule = contract.getRule(1);
    expect(rule.ok).toBe(true);
    expect(rule.value).toEqual(expect.objectContaining({
      name: "High Claim Frequency",
      maxClaims: 3,
      weight: 200,
      active: true,
    }));
  });

  it("should prevent unauthorized rule addition", () => {
    const result = contract.addRule(
      accounts.unauthorized,
      1,
      "High Claim Frequency",
      3,
      1000,
      5000,
      200
    );
    expect(result).toEqual({ ok: false, value: 300 });
  });

  it("should prevent duplicate rule addition", () => {
    contract.addRule(accounts.admin, 1, "Rule 1", 3, 1000, 5000, 200);
    const duplicate = contract.addRule(accounts.admin, 1, "Rule 2", 2, 2000, 6000, 300);
    expect(duplicate).toEqual({ ok: false, value: 306 });
  });

  it("should disable a rule", () => {
    contract.addRule(accounts.admin, 1, "Rule 1", 3, 1000, 5000, 200);
    const disable = contract.disableRule(accounts.admin, 1);
    expect(disable).toEqual({ ok: true, value: true });

    const rule = contract.getRule(1);
    expect(rule.ok).toBe(true);
    expect(rule.value?.active).toBe(false);
  });

  it("should prevent analysis for non-existent claim", () => {
    contract.mockPatientRegistry("patient123");
    const result = contract.analyzeClaim(accounts.admin, "claim123", "patient123");
    expect(result).toEqual({ ok: false, value: 302 });
  });

  it("should prevent analysis for non-existent patient", () => {
    contract.mockClaimSubmission("claim123", 2000, "patient123");
    const result = contract.analyzeClaim(accounts.admin, "claim123", "patient123");
    expect(result).toEqual({ ok: false, value: 303 });
  });

  it("should allow admin to review and update claim status", () => {
    contract.mockPatientRegistry("patient123");
    contract.mockClaimSubmission("claim123", 2000, "patient123");
    contract.analyzeClaim(accounts.admin, "claim123", "patient123");

    const review = contract.reviewClaim(accounts.admin, "claim123", "cleared", "Manual review passed");
    expect(review).toEqual({ ok: true, value: true });

    const flag = contract.getClaimFlag("claim123");
    expect(flag.ok).toBe(true);
    expect(flag.value).toEqual(expect.objectContaining({
      status: "cleared",
      notes: "Manual review passed",
      reviewer: accounts.admin,
    }));
  });

  it("should prevent unauthorized claim review", () => {
    contract.mockPatientRegistry("patient123");
    contract.mockClaimSubmission("claim123", 2000, "patient123");
    contract.analyzeClaim(accounts.admin, "claim123", "patient123");

    const review = contract.reviewClaim(accounts.unauthorized, "claim123", "cleared", "Unauthorized");
    expect(review).toEqual({ ok: false, value: 300 });
  });

  it("should track patient claim count correctly", () => {
    contract.mockPatientRegistry("patient123");
    contract.mockClaimSubmission("claim123", 2000, "patient123");
    contract.analyzeClaim(accounts.admin, "claim123", "patient123");

    const count = contract.getPatientClaimCount("patient123");
    expect(count).toEqual({ ok: true, value: 1 });
  });
});