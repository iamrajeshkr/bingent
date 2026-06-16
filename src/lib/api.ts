import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './config';
import type { ItemType, Lang } from './types';
import type { Weather } from './weather';

// Thin client for the Kitab AI backend. Real accounts: username + password.
// The backend mints a long-lived JWT; we persist it so the session survives
// app restarts (no more "starts afresh"). No auto-guest — calls require a session.

const TOKEN_KEY = 'kitab.token';
let token: string | null = null;

async function getToken(): Promise<string | null> {
  if (token) return token;
  token = await AsyncStorage.getItem(TOKEN_KEY);
  return token;
}
async function setToken(t: string): Promise<void> {
  token = t;
  await AsyncStorage.setItem(TOKEN_KEY, t);
}
export async function hasSession(): Promise<boolean> {
  return Boolean(await getToken());
}
export async function signOut(): Promise<void> {
  token = null;
  await AsyncStorage.removeItem(TOKEN_KEY);
}

// Public (pre-session) POST — used by signup/signin.
async function publicPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as any)?.error || `${path} ${res.status}`);
  return json as T;
}

async function authed<T>(path: string, init: RequestInit = {}): Promise<T> {
  const t = await getToken();
  if (!t) throw new Error('no session');
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${t}`, ...(init.headers ?? {}) },
  });
  if (res.status === 401) {
    await signOut(); // stale/expired → force re-auth
    throw new Error('session expired');
  }
  if (!res.ok) throw new Error(`${path} ${res.status}: ${await res.text().catch(() => '')}`);
  return res.json() as Promise<T>;
}

const post = <T>(path: string, body: unknown) =>
  authed<T>(path, { method: 'POST', body: JSON.stringify(body) });
const get = <T>(path: string) => authed<T>(path);

// ---- response shapes (mirror the backend) --------------------------------
export interface ComposedPage {
  title: string;
  paragraphs: string[];
  sources: { kind: ItemType; id: string; heading: string | null }[];
}
export interface CatalogRef {
  kind: ItemType;
  id: string;
  title: string;
  author: string | null;
  cover: string | null;
}
export interface RecItem extends CatalogRef {
  score: number;
  reason: string;
}
export interface BrowseItem extends CatalogRef {
  category: string | null;
}
export interface AskTurn {
  role: 'user' | 'model';
  text: string;
}
export interface ThreadGroup {
  slug: string;
  title: string;
  items: CatalogRef[];
  // editorial metadata for Discover "reading rooms"
  note?: string;
  bg?: string;
  accent?: string;
}
export interface SitPlan {
  id: number;
  for_date: string;
  weather: Weather;
  plan: {
    arrive: string;
    read: { kind: ItemType; id: string; title: string } | null;
    reflect: string;
    carry: string;
  };
}
export interface LineAnswer {
  answer: string;
  grounded: boolean;
}
export interface ReflectionResult {
  id: number;
  safety: { severity: 0 | 1 | 2 | 3; resources?: { message: string; lines: { name: string; contact: string }[] } };
}

export interface FinishedItem extends CatalogRef {
  category: string | null;
  completed_at: string;
}
export interface Garden {
  practices_kept: number;
  pages_read: number;
  days_used: number;
  leaves: { text: string; kept: number; status: 'active' | 'kept' | 'released' }[];
  finished: FinishedItem[];
  in_progress: number;
  streak: number;
}
export interface MirrorSnapshot {
  portrait: string;
  traits: Record<string, number>;
  deltas: { note?: string } | Record<string, never>;
  week_start: string;
  generated_at: string;
}
export interface Letter {
  body: string;
  week_start: string;
  lang: Lang;
  generated_at: string;
}

// Content-type-aware position blob.
export interface Position {
  audioSec?: number;
  durationSec?: number;
  completed?: boolean;
  // journey-only:
  section?: string;
  subsection?: string;
  chapterSeq?: number; // raw chapter seq — used to match/resume the right track
  chapterNum?: number; // 1-based position in the playable queue — used for display
  totalChapters?: number;
}
export interface ContinueItem extends CatalogRef {
  position: Position;
  updated_at: string;
}

export interface Arc {
  id: number;
  slug: string;
  title: Record<string, string>;
  subtitle: Record<string, string>;
  total_steps: number;
  goal_weather: string | null;
  enrollment: { current_step: number; completed_at: string | null } | null;
}
export interface ArcStep {
  step_index: number;
  title: Record<string, string>;
  item_kind: ItemType | null;
  item_id: string | null;
  prompt: Record<string, string>;
  item: { kind: ItemType; id: string; title: string; cover: string | null } | null;
}
export interface HighlightItem {
  id: number;
  item_kind: ItemType;
  item_id: string;
  lang: Lang;
  quote: string;
  note: string | null;
  title: string;
  created_at: string;
}
export interface Resonance {
  count: number;
  samples: { note: string | null; lang: string }[];
}

export interface EventInput {
  type: string;
  kind?: ItemType;
  id?: string;
  payload?: Record<string, unknown>;
}

export const api = {
  signup: async (b: { username: string; password: string; display_name?: string }) => {
    const r = await publicPost<{ userId: string; token: string }>('/v1/auth/signup', b);
    await setToken(r.token);
    return r;
  },
  signin: async (b: { username: string; password: string }) => {
    const r = await publicPost<{ userId: string; token: string }>('/v1/auth/signin', b);
    await setToken(r.token);
    return r;
  },
  previewPage: (b: { weather?: Weather; intent?: string; lang: Lang }) =>
    publicPost<{ title: string; paragraphs: string[] }>('/v1/auth/preview-page', b),
  composePage: (b: { weather: Weather; intent?: string; lang: Lang }) =>
    post<ComposedPage>('/v1/compose-page', b),
  dailySit: (b: { weather: Weather; lang: Lang }) => post<SitPlan>('/v1/sit', b),
  recommend: (b: { weather?: Weather; limit?: number }) =>
    post<{ items: RecItem[] }>('/v1/recommend', b),
  search: (b: { q: string; lang: Lang; limit?: number }) =>
    post<{ items: (RecItem & { similarity: number })[] }>('/v1/search', b),
  askLine: (b: { kind: ItemType; id: string; lang: Lang; quote: string; question?: string }) =>
    post<LineAnswer>('/v1/ask-line', b),
  ask: (b: { query: string; lang: Lang; history?: AskTurn[] }) =>
    post<{ reply: string; items: CatalogRef[] }>('/v1/companion', b),
  reflect: (b: { text: string; lang: Lang; context?: Record<string, unknown> }) =>
    post<ReflectionResult>('/v1/reflections', b),
  setWeather: (b: { weather: Weather; local_hour?: number }) => post<{ ok: true }>('/v1/weather', b),
  createPractice: (b: { text: string; source_kind?: ItemType; source_id?: string; keep?: boolean }) =>
    post<{ id: number }>('/v1/practices', b),
  keepPractice: (id: number) => post<{ ok: true }>(`/v1/practices/${id}/keep`, {}),
  logEvents: (events: EventInput[]) => post<{ accepted: number }>('/v1/events', { events }),

  getCatalog: () => get<{ bites: any[]; journeys: any[]; summaries: any[] }>('/v1/catalog'),
  getBrowse: (kind: 'all' | ItemType, page: number, limit = 30) =>
    get<{ items: BrowseItem[]; page: number; hasMore: boolean }>(
      `/v1/catalog/browse?kind=${kind}&page=${page}&limit=${limit}`
    ),
  getItem: (kind: ItemType, id: string) => get<any>(`/v1/catalog/${kind}/${id}`),

  saveProgress: (kind: ItemType, id: string, position: Position) =>
    post<{ ok: true }>('/v1/progress', { kind, id, position }),
  getProgress: (kind: ItemType, id: string) =>
    get<{ position: Position | null; updated_at: string | null }>(`/v1/progress/${kind}/${id}`),
  getContinue: () => get<{ items: ContinueItem[] }>('/v1/progress'),
  getSimilar: (kind: ItemType, id: string, lang: Lang) =>
    get<{ items: CatalogRef[] }>(`/v1/similar/${kind}/${id}?lang=${lang}`),
  getThreads: (lang: Lang) => get<{ threads: ThreadGroup[] }>(`/v1/threads?lang=${lang}`),

  // marginalia + resonance
  saveHighlight: (b: { kind: ItemType; id: string; lang: Lang; quote: string; note?: string }) =>
    post<{ id: number }>('/v1/highlights', b),
  getHighlights: () => get<{ items: HighlightItem[] }>('/v1/highlights'),
  getResonance: (b: { kind: ItemType; id: string; quote: string }) =>
    post<Resonance>('/v1/highlights/resonance', b),

  // becoming arcs
  getArcs: () => get<{ arcs: Arc[] }>('/v1/arcs'),
  getArc: (slug: string) => get<{ arc: Arc; steps: ArcStep[]; enrollment: Arc['enrollment'] }>(`/v1/arcs/${slug}`),
  enrollArc: (slug: string) => post<{ arcId: number }>(`/v1/arcs/${slug}/enroll`, {}),
  advanceArc: (arcId: number) => post<{ step: number }>('/v1/arcs/advance', { arc_id: arcId }),
  getGarden: () => get<Garden>('/v1/garden'),
  getMirror: () => get<{ latest: MirrorSnapshot | null; first: MirrorSnapshot | null }>('/v1/mirror'),
  generateMirror: () => post<MirrorSnapshot>('/v1/mirror/generate', {}),
  getLetter: () => get<{ letter: Letter | null }>('/v1/letter'),
  generateLetter: (lang: Lang) => post<Letter>(`/v1/letter/generate?lang=${lang}`, {}),
};
