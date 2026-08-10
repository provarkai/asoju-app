import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

// ---------------------------------------------------------------------------
// ASOJU domain enums (mirrors backend/prisma/schema.prisma — Section 3 & 5.2)
// ---------------------------------------------------------------------------

export const serviceTypeValidator = v.union(
  v.literal("PROPERTY_INSPECTION"),
  v.literal("CONSTRUCTION_SUPERVISION"),
  v.literal("ASSET_INSPECTION"),
  v.literal("FAMILY_SUPPORT"),
  v.literal("PROCUREMENT"),
  v.literal("BUSINESS_VERIFICATION"),
  v.literal("INVESTMENT_SUPPORT"),
  v.literal("BEREAVEMENT_SUPPORT"),
);
export type ServiceType = Infer<typeof serviceTypeValidator>;

export const casePriorityValidator = v.union(
  v.literal("STANDARD"),
  v.literal("PRIORITY"),
  v.literal("URGENT"),
);
export type CasePriority = Infer<typeof casePriorityValidator>;

export const caseTierValidator = v.union(
  v.literal("ESSENTIAL"),
  v.literal("CONCIERGE"),
);
export type CaseTier = Infer<typeof caseTierValidator>;

export const caseStatusValidator = v.union(
  v.literal("SUBMITTED"),
  v.literal("UNDER_REVIEW"),
  v.literal("QUOTED"),
  v.literal("AWAITING_PAYMENT"),
  v.literal("SCHEDULED"),
  v.literal("ASSIGNED"),
  v.literal("IN_PROGRESS"),
  v.literal("EVIDENCE_SUBMITTED"),
  v.literal("QUALITY_CONTROL"),
  v.literal("CUSTOMER_REVIEW"),
  v.literal("ADDITIONAL_WORK"),
  v.literal("APPROVED"),
  v.literal("COMPLETED"),
  v.literal("CLOSED"),
  v.literal("ON_HOLD"),
);
export type CaseStatus = Infer<typeof caseStatusValidator>;

export const paymentStatusValidator = v.union(
  v.literal("PENDING"),
  v.literal("PROCESSING"),
  v.literal("PAID"),
  v.literal("FAILED"),
  v.literal("REFUNDED"),
  v.literal("PARTIALLY_REFUNDED"),
);
export type PaymentStatus = Infer<typeof paymentStatusValidator>;

export const quoteLineCategoryValidator = v.union(
  v.literal("ASOJU_SERVICE_FEE"),
  v.literal("EXTERNAL_COST"),
  v.literal("THIRD_PARTY_PROFESSIONAL"),
  v.literal("TAX_STATUTORY"),
);
export type QuoteLineCategory = Infer<typeof quoteLineCategoryValidator>;

export const evidenceTypeValidator = v.union(
  v.literal("PHOTO"),
  v.literal("VIDEO"),
  v.literal("DOCUMENT"),
  v.literal("NOTE"),
);
export type EvidenceType = Infer<typeof evidenceTypeValidator>;

export const trustLabelValidator = v.union(
  v.literal("ASOJU_VERIFIED"),
  v.literal("PROFESSIONALLY_REVIEWED"),
  v.literal("CUSTOMER_PROVIDED"),
  v.literal("THIRD_PARTY_STATEMENT"),
  v.literal("NOT_INDEPENDENTLY_VERIFIED"),
);
export type TrustLabel = Infer<typeof trustLabelValidator>;

export const evidenceLevelValidator = v.union(
  v.literal("OBSERVED"),
  v.literal("REPORTED"),
  v.literal("PROFESSIONALLY_ASSESSED"),
  v.literal("PLATFORM_VERIFIED"),
);
export type EvidenceLevel = Infer<typeof evidenceLevelValidator>;

export const reviewStatusValidator = v.union(
  v.literal("PENDING"),
  v.literal("APPROVED"),
  v.literal("REJECTED"),
);
export type ReviewStatus = Infer<typeof reviewStatusValidator>;

export const leadTagValidator = v.union(
  v.literal("HOT"),
  v.literal("WARM"),
  v.literal("COLD"),
);
export type LeadTag = Infer<typeof leadTagValidator>;

export const quoteLineValidator = v.object({
  category: quoteLineCategoryValidator,
  label: v.string(),
  amount: v.number(),
});

export const timelineValidator = v.union(
  v.literal("immediate"),
  v.literal("near_term"),
  v.literal("exploring"),
);
export type Timeline = Infer<typeof timelineValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // -----------------------------------------------------------------------
    // ASOJU domain tables
    // -----------------------------------------------------------------------

    // Customer profile — progressive disclosure onboarding (PRD 5.1)
    profiles: defineTable({
      userId: v.string(),
      fullName: v.optional(v.string()),
      countryOfResidence: v.optional(v.string()),
      phone: v.optional(v.string()),
      preferredChannel: v.optional(v.string()), // whatsapp | email | sms
      city: v.optional(v.string()),
      onboarded: v.boolean(),
      onboardedAt: v.optional(v.number()),
      updatedAt: v.optional(v.number()),
    }).index("by_user", ["userId"]),

    // Raw inbound request (pre-case) — created by AI Concierge or manual intake
    serviceRequests: defineTable({
      userId: v.string(),
      serviceType: v.optional(serviceTypeValidator),
      rawDescription: v.string(),
      location: v.optional(v.string()),
      channel: v.string(), // web | whatsapp
      leadScore: v.optional(v.number()),
      leadTag: v.optional(leadTagValidator),
      timeline: v.optional(timelineValidator),
      convertedCaseId: v.optional(v.id("cases")),
      createdAt: v.number(),
    }).index("by_user", ["userId"]),

    // THE CENTRAL OBJECT (PRD Section 3.1) — every request becomes a Case
    cases: defineTable({
      userId: v.string(), // owning customer
      caseNumber: v.string(), // e.g. ASJ-000184
      serviceType: serviceTypeValidator,
      description: v.string(),
      location: v.string(),
      city: v.optional(v.string()),
      state: v.optional(v.string()),
      priority: casePriorityValidator,
      riskLevel: v.number(), // 1-4
      tier: caseTierValidator,
      status: caseStatusValidator,
      paymentStatus: paymentStatusValidator,
      // Commercial
      quoteId: v.optional(v.id("quotes")),
      invoiceId: v.optional(v.id("invoices")),
      // Execution
      assignedAgentName: v.optional(v.string()),
      assignedAgentPhone: v.optional(v.string()),
      scheduledFor: v.optional(v.number()),
      nextAction: v.optional(v.string()),
      nextActionDueAt: v.optional(v.number()),
      slaTargetAt: v.optional(v.number()),
      // Evidence / deliverable
      reportId: v.optional(v.id("reports")),
      heldFromStatus: v.optional(caseStatusValidator),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_status", ["status"])
      .index("by_caseNumber", ["caseNumber"]),

    // Append-only per-case status trail (drives the timeline UI)
    caseStatusHistory: defineTable({
      caseId: v.id("cases"),
      fromStatus: v.optional(caseStatusValidator),
      toStatus: caseStatusValidator,
      reason: v.optional(v.string()),
      actorName: v.optional(v.string()), // e.g. "ASOJU Team", "You"
      createdAt: v.number(),
    }).index("by_case", ["caseId"]),

    // Quote with categorized lines (PRD P0 Quote Line Categories)
    quotes: defineTable({
      caseId: v.id("cases"),
      userId: v.string(),
      currency: v.string(), // NGN
      amount: v.number(),
      baseAmount: v.number(), // sum of ASOJU_SERVICE_FEE lines (discount-eligible)
      nonServiceFeeAmount: v.number(), // everything else, passes through
      discountAmount: v.number(),
      discountLabel: v.optional(v.string()),
      lines: v.array(quoteLineValidator),
      expiresAt: v.number(),
      acceptedAt: v.optional(v.number()),
      createdAt: v.number(),
    }).index("by_case", ["caseId"]),

    invoices: defineTable({
      caseId: v.id("cases"),
      userId: v.string(),
      quoteId: v.id("quotes"),
      amount: v.number(),
      currency: v.string(),
      createdAt: v.number(),
    }).index("by_case", ["caseId"]),

    payments: defineTable({
      caseId: v.id("cases"),
      userId: v.string(),
      invoiceId: v.id("invoices"),
      amount: v.number(),
      currency: v.string(),
      provider: v.string(), // paystack (demo)
      providerReference: v.string(),
      status: paymentStatusValidator,
      paidAt: v.optional(v.number()),
      createdAt: v.number(),
    }).index("by_case", ["caseId"]),

    // Evidence — chain of custody (PRD Section 8.4)
    evidence: defineTable({
      caseId: v.id("cases"),
      userId: v.string(),
      type: evidenceTypeValidator,
      title: v.string(),
      description: v.optional(v.string()),
      trustLabel: trustLabelValidator,
      evidenceLevel: evidenceLevelValidator,
      reviewStatus: reviewStatusValidator,
      // demo media reference; production would be a private object-storage key
      mediaUrl: v.optional(v.string()),
      capturedAt: v.number(),
    }).index("by_case", ["caseId"]),

    // Customer-facing deliverable
    reports: defineTable({
      caseId: v.id("cases"),
      userId: v.string(),
      summary: v.string(),
      findings: v.array(v.object({ label: v.string(), detail: v.string() })),
      confidence: v.array(
        v.object({ label: v.string(), state: v.string() }), // e.g. Identity: Complete
      ),
      qcOutcome: v.optional(v.string()),
      limitation: v.optional(v.string()),
      deliveredAt: v.optional(v.number()),
      createdAt: v.number(),
    }).index("by_case", ["caseId"]),

    // Case-scoped conversation
    messages: defineTable({
      caseId: v.id("cases"),
      senderId: v.optional(v.string()),
      senderName: v.string(),
      senderRole: v.optional(v.string()), // customer | asoju-team
      body: v.string(),
      createdAt: v.number(),
    }).index("by_case", ["caseId"]),

    notifications: defineTable({
      userId: v.string(),
      title: v.string(),
      body: v.string(),
      caseId: v.optional(v.id("cases")),
      readAt: v.optional(v.number()),
      createdAt: v.number(),
    }).index("by_user", ["userId"]),

    // Saved assets (PRD 5.1 P1)
    properties: defineTable({
      userId: v.string(),
      address: v.string(),
      city: v.optional(v.string()),
      state: v.optional(v.string()),
      description: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_user", ["userId"]),

    beneficiaries: defineTable({
      userId: v.string(),
      fullName: v.string(),
      relationship: v.optional(v.string()),
      phone: v.optional(v.string()),
      notes: v.optional(v.string()),
      hasPortalAccess: v.boolean(),
      createdAt: v.number(),
    }).index("by_user", ["userId"]),

    // Single-row counter for sequential case numbers
    counters: defineTable({
      name: v.string(),
      value: v.number(),
    }).index("by_name", ["name"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
