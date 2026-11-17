import { StatusBadge, type BadgeTone } from '@/components/StatusBadge';
import { STATUS_LABEL } from '@/features/applications/applicationRules';
import type { ApplicationStatus } from '@/features/applications/types';

const TONE: Record<ApplicationStatus, BadgeTone> = { submitted: 'info', under_review: 'warning', accepted: 'success', rejected: 'danger', withdrawn: 'neutral' };

export const ApplicationStatusBadge = ({ status }: { status: ApplicationStatus }) => <StatusBadge label={STATUS_LABEL[status]} tone={TONE[status]} />;
