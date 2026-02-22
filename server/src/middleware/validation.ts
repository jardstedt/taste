import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

// ── Request Body Schemas ──

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const credentialsSchema = z.object({
  bio: z.string().max(1000).optional(),
  profileImageUrl: z.string().url().optional().or(z.literal('')),
  twitterHandle: z.string().max(50).optional(),
  linkedinUrl: z.string().url().optional().or(z.literal('')),
  portfolioUrl: z.string().url().optional().or(z.literal('')),
  location: z.string().max(100).optional(),
  tagline: z.string().max(200).optional(),
}).optional();

export const createExpertSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  domains: z.array(z.enum(['crypto', 'music', 'art', 'design', 'narrative', 'community', 'general'])).min(1),
  credentials: credentialsSchema,
});

export const updateExpertSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  domains: z.array(z.enum(['crypto', 'music', 'art', 'design', 'narrative', 'community', 'general'])).min(1).optional(),
  credentials: credentialsSchema,
  availability: z.enum(['online', 'offline', 'busy']).optional(),
  consentToPublicProfile: z.boolean().optional(),
});

export const acceptAgreementSchema = z.object({
  accepted: z.literal(true),
});

export const setPasswordSchema = z.object({
  password: z.string().min(8).max(128),
});

export const submitJudgmentSchema = z.object({
  jobId: z.string().min(1),
  content: z.record(z.unknown()),
});

export const updateJobStatusSchema = z.object({
  status: z.enum(['assigned', 'in_progress', 'delivered', 'rejected', 'timeout']),
});

// ── Wallet & Withdrawal Schemas (v1.3) ──

export const setWalletSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address (must be 0x + 40 hex chars)'),
  walletChain: z.enum(['base', 'ethereum']).default('base'),
});

export const requestWithdrawalSchema = z.object({
  amountUsdc: z.number().min(1, 'Minimum withdrawal is $1'),
});

export const completeWithdrawalSchema = z.object({
  txHash: z.string().min(1, 'Transaction hash is required'),
});

export const rejectWithdrawalSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required').max(500),
});

// ── Session Schemas (v1.1) ──

export const createSessionSchema = z.object({
  offeringType: z.string().min(1),
  tierId: z.enum(['quick', 'full', 'deep']).optional(),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string()).optional(),
  buyerAgent: z.string().optional(),
  buyerAgentDisplay: z.string().optional(),
  priceUsdc: z.number().min(0).optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
  senderType: z.enum(['agent', 'expert']).optional(),
});

export const createAddonSchema = z.object({
  addonType: z.enum(['screenshot', 'extended_time', 'written_report', 'second_opinion', 'image_upload', 'follow_up', 'crowd_poll']),
  priceUsdc: z.number().min(0),
  description: z.string().max(1000).optional(),
});

export const respondAddonSchema = z.object({
  accepted: z.boolean(),
});

// ── Validation Middleware Factory ──

export function validate<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
      res.status(400).json({ success: false, error: 'Validation failed', details: errors });
      return;
    }
    req.body = result.data;
    next();
  };
}
