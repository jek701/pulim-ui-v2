export type CommunicationLanguage = 'ru' | 'uz' | 'en';
export type CommunicationChannel = 'in_app' | 'telegram';
export type CommunicationPresentation = 'inbox' | 'banner' | 'modal';
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'paused' | 'completed' | 'failed';

export interface LocalizedCampaignContent { title: string; body: string; ctaLabel?: string }
export interface CampaignAudience {
  tier: 'all' | 'free' | 'premium' | 'trial';
  languages: CommunicationLanguage[];
  telegram: 'any' | 'linked' | 'unlinked';
}
export interface CampaignStats {
  audience: number; inAppDelivered: number; telegramQueued: number; telegramSent: number;
  telegramFailed: number; seen: number; clicked: number; dismissed: number;
}
export interface CommunicationCampaign {
  id: string; name: string; content: Record<CommunicationLanguage, LocalizedCampaignContent>;
  channels: CommunicationChannel[]; presentation: CommunicationPresentation; audience: CampaignAudience;
  ctaUrl?: string; status: CampaignStatus; scheduledAt: number | null; stats: CampaignStats;
  createdAt: number; updatedAt: number; lastError: string | null;
}
export interface CommunicationPreferences { marketing: { inApp: boolean; telegram: boolean } }
export interface InAppMessage {
  id: string; campaignId: string; userId: string; presentation: CommunicationPresentation;
  title: string; body: string; ctaLabel?: string; ctaUrl?: string; createdAt: number;
  readAt: number | null; clickedAt: number | null; dismissedAt: number | null;
}
export interface CampaignDraft {
  name: string; content: Record<CommunicationLanguage, LocalizedCampaignContent>;
  channels: CommunicationChannel[]; presentation: CommunicationPresentation; audience: CampaignAudience;
  ctaUrl?: string;
}
