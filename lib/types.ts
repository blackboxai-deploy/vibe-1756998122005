import { type UIMessage } from 'ai'
import { ReactElement } from 'react';

export interface Chat extends Record<string, any> {
  id: string
  title: string
  createdAt: Date
  userId: string
  path: string
  messages: UIMessage[]
  sharePath?: string
  sharedWorkspace?: string
  numberOfFiles?: number
  workspaceIds?: string[]
}

export interface AgentChat extends Record<string, any> {
  id: string
  title: string
  path: string
  isAgent?: boolean
}

export type ServerActionResult<Result> = Promise<
  | Result
  | {
    error: string
  }
>

declare global {
  interface Window {
    google: any;
    [key: string]: any;
  }
}

export interface IGoogleOneTapLogin extends IUseGoogleOneTapLogin {
  children?: ReactElement | null;
}

export interface IUseGoogleOneTapLogin {
  disabled?: boolean;
  disableCancelOnUnmount?: boolean;
  onError?: (error?: Error | string) => void;
  googleAccountConfigs: IGoogleOneTapLoginProps;
  onSuccess?: (response: IGoogleEndPointResponse) => void;
}

export interface IGoogleOneTapLoginProps {
  nonce?: string;
  context?: string;
  client_id: string;
  auto_select?: boolean;
  prompt_parent_id?: string;
  state_cookie_domain?: string;
  cancel_on_tap_outside?: boolean;
  callback?: (...args: any) => any;
  native_callback?: (...args: any) => any;
}

export interface IGoogleCallbackResponse {
  credential?: string;
}

export interface IGoogleEndPointResponse {
  iss: string;
  sub: string;
  azp: string;
  aud: string;
  iat: string;
  exp: string;
  name: string;
  email: string;
  local: string;
  picture: string;
  given_name: string;
  family_name: string;
  email_verified: string;
}

export interface Session {
  user: {
    id: string
    email: string
  }
}

export interface User extends Record<string, any> {
  id: string
  email: string
  password: string
  salt: string
}

export interface Room {
  id: string
  createdBy: string
  updatedAt: {
    seconds: number
    nanoseconds: number
  }
  createdAt: {
    seconds: number
    nanoseconds: number
  }
  memberDetails: Array<User>
  members: Array<string>
}

export interface LiveChatMessage {
  id: string
  senderId: string
  content: string
  timestamp: any
  readBy: string[]
  senderDetails: User
}

export interface HistoryEntry {
  userId?: string;
  createdAt: number
  isPrivate: boolean
  name: string
  url: string
  customerId?: string
  screenshotUrl?: string
  screenshotTimestamp?: number
  creatorName?: string;
  creatorAvatar?: string;
  github?: {
    repo: string;
    branch: string;
  }
  gallery?: {
    id?: string;
    type?: string;
    appUrl?: string;
    cloneUrl?: string;
    published?: boolean
    title?: string
    thumbnailUrl?: string
    videoUrl?: string
    likes?: number
    forks?: number
    creatorEmail?: string
    creatorName?: string;
    creatorAvatar?: string;
    codeBlockId?: string
  }
}


export interface GalleryItemData extends HistoryEntry {
  id: number;
}

export interface DemoCard {
  title: string;
  description: string;
  category: string;
  image?: string;
  video?: string;
  urlClone?: string;
  appUrl?: string;
}

export interface PublishedApp {
  _id?: string;
  title: string;
  appUrl: string;
  screenshotUrl?: string;
  creatorEmail: string;
  creatorName?: string;
  creatorAvatar?: string;
  createdAt: Date;
  updatedAt: Date;
  likes?: number;
  views?: number;
  sandboxId?: string;
  deploymentUrl?: string;
}

export interface PublishFormData {
  title: string;
}

export const APP_CATEGORIES = [
  'ai',
  'productivity', 
  'design',
  'finance',
  'games',
  'tools',
  'social',
  'education',
  'entertainment',
  'business'
] as const;

export type AppCategory = typeof APP_CATEGORIES[number];
