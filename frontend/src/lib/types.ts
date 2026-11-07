export type Role = 'CUSTOMER' | 'CONTRACTOR' | 'ADMIN';
export interface User { id: string; email: string; phone: string; fullName: string; role: Role }
export interface Category { id: string; name: string; slug: string; parentId: string | null }
export interface Problem {
  id: string; title: string; description: string; city: string; area: string; urgency: string; status: string;
  budgetMin: number | null; budgetMax: number | null; expiresAt: string; createdAt: string; customerId: string;
  category: { id: string; name: string; slug: string };
  media: { id: string; url: string }[];
  customer: { id: string; fullName: string };
  _count: { quotes: number };
  quotes?: { id: string; status: string; price: number }[];
  booking?: { id: string; status: string; contractorId: string } | null;
}
export interface Quote {
  id: string; price: number; estimatedDurationHours: number; message: string; status: string; proposedStartAt: string | null;
  contractor?: { id: string; fullName: string; contractorProfile: { avgRating: number; reviewCount: number; completedJobs: number; yearsExperience: number; city: string } | null };
  problem?: { id: string; title: string; city: string; status: string };
  booking?: { id: string; status: string } | null;
}
export interface Party { id: string; fullName: string; phone: string }
export interface Booking {
  id: string; status: string; agreedPrice: number; paymentStatus: string; scheduledAt: string; customerId: string; contractorId: string;
  problem: { id: string; title: string; city: string; area: string; category: { name: string } };
  customer: Party; contractor: Party;
  statusHistory?: { id: string; fromStatus: string | null; toStatus: string; note: string | null; createdAt: string }[];
  review?: { id: string; rating: number; comment: string | null } | null;
}
export interface AdminStats {
  totalProblems: number;
  openProblems: number;
  totalBookings: number;
  activeBookings: number;
  completedBookings: number;
  pendingContractors: number;
  verifiedContractors: number;
  totalCustomers: number;
}

export interface ContractorProfile {
  id: string; userId: string; bio: string; yearsExperience: number; city: string; serviceAreas: string[];
  verificationStatus: 'UNSUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED'; rejectionReason: string | null;
  avgRating: number; reviewCount: number; completedJobs: number; cancelledJobs: number;
  categories: { category: { id: string; name: string; slug: string } }[];
  user?: { id: string; fullName: string; email: string; phone: string };
}

export type NotificationType =
  | 'NEW_PROBLEM'
  | 'NEW_QUOTE'
  | 'QUOTE_ACCEPTED'
  | 'QUOTE_REJECTED'
  | 'BOOKING_STATUS'
  | 'REVIEW_RECEIVED'
  | 'NEW_MESSAGE';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: 'PROBLEM' | 'BOOKING' | null;
  entityId?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  bookingId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender: {
    id: string;
    fullName: string;
    role: Role;
  };
}

