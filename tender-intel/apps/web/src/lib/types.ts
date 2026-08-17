export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  tenant_id: string;
  created_at: string;
}

export interface LoginResponse {
  user: User;
  tenant_name: string;
}

export interface Tender {
  id: string;
  source_id: string;
  external_id: string;
  title: string;
  reference_no: string;
  agency: string;
  category: string;
  province: string;
  city: string;
  tender_type: string;
  status: string;
  published_at?: string | null;
  closing_at?: string | null;
  estimated_value?: number | null;
  currency: string;
  bid_count?: number | null;
  awardee_name?: string | null;
  source_slug: string;
  description?: string | null;
  department: string;
  sub_category: string;
  country: string;
  procurement_method: string;
  opening_at?: string | null;
  bid_security?: string | null;
  validity_period?: string | null;
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  eligibility?: string | null;
  attachments: { name: string; url: string; size: number; type: string }[];
  document_downloads: number;
  bidder_names: string[];
  opening_minutes_url: string;
  award_amount?: number | null;
  award_date?: string | null;
  ai_summary?: string | null;
  source_url: string;
  first_seen_at: string;
  updated_at: string;
  changes_count: number;
  documents: {
    id: string;
    name: string;
    url: string;
    doc_type: string;
    pages?: number | null;
    text_excerpt?: string | null;
    ocr_used: boolean;
  }[];
}

export interface TenderPage {
  total: number;
  page: number;
  page_size: number;
  items: Tender[];
}

export interface Facets {
  agencies: string[];
  categories: string[];
  provinces: string[];
  statuses: string[];
  sources: string[];
}

export interface ChangeOut {
  id: string;
  tender_id: string;
  change_type: string;
  field: string;
  old_value?: string | null;
  new_value?: string | null;
  detected_at: string;
}

export interface Watchlist {
  id: string;
  name: string;
  keywords: string[];
  agencies: string[];
  categories: string[];
  provinces: string[];
  min_value?: number | null;
  max_value?: number | null;
  statuses: string[];
  notify_new: boolean;
  notify_change: boolean;
  notify_deadline: boolean;
  deadline_hours: number;
  is_active: boolean;
  created_at: string;
  matched_count: number;
}

export interface AlertItem {
  id: string;
  watchlist_id?: string | null;
  tender_id?: string | null;
  kind: string;
  severity: string;
  title: string;
  message: string;
  payload: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface AnalyticsSummary {
  total_tenders: number;
  open_tenders: number;
  closing_24h: number;
  closing_72h: number;
  total_value_open: number;
  awarded_count: number;
  sources_active: number;
  total_watchlists: number;
  unread_alerts: number;
}

export interface SeriesPoint {
  key: string;
  value: number;
  extra?: Record<string, unknown> | null;
}

export interface CompetitorStat {
  name: string;
  wins: number;
  total_value: number;
  avg_discount?: number | null;
  win_rate: number;
}

export interface SourceHealth {
  id: string;
  slug: string;
  name: string;
  base_url: string;
  connector_type: string;
  enabled: boolean;
  fixture_mode: boolean;
  fetch_interval_minutes: number;
  status: string;
  last_run_at?: string | null;
  last_success_at?: string | null;
  next_run_at?: string | null;
  last_error?: string | null;
  last_items_found: number;
}

export interface ConnectorRun {
  id: string;
  source_id: string;
  started_at: string;
  finished_at?: string | null;
  status: string;
  items_found: number;
  items_new: number;
  items_updated: number;
  items_changed: number;
  error?: string | null;
}

export interface HealthStatus {
  status: string;
  database: string;
  redis: string;
  worker_heartbeat?: string | null;
  sources: SourceHealth[];
  pending_alerts: number;
  version: string;
}

export interface AuditEntry {
  id: string;
  user_id?: string | null;
  action: string;
  entity: string;
  entity_id?: string | null;
  details: Record<string, unknown>;
  ip: string;
  created_at: string;
}


