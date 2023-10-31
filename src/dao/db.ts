import { find, findIndex, isUndefined, once, sortBy } from 'lodash-es';
import { Low } from 'lowdb';
import { JSONPreset } from 'lowdb/node';
import path from 'path';
import { DeepReadonly } from 'ts-essentials';
import { v4 as uuidv4 } from 'uuid';
import constants from '../constants.js';
import { globalOptions } from '../globals.js';
import { Maybe } from '../types.js';
import { migrateFromLegacyDb } from './legacy-db-migration.js';

const CURRENT_VERSION = 1;

export type ProgramType =
  | 'movie'
  | 'episode'
  | 'track'
  | 'redirect'
  | 'custom'
  | 'flex';

export type Program = {
  title: string;
  key: string;
  ratingKey: string;
  icon: string;
  type: ProgramType;
  duration: number;
  summary: string;
  plexFile: string;
  file: string;
  showTitle?: string; // Unclear if this is necessary
  episode?: number;
  season?: number;
  episodeIcon?: string;
  seasonIcon?: string;
  showIcon?: string;
  serverKey: string;
  rating?: string;
  date?: string;
  year?: number;
  channel?: number; // Redirect
  isOffline: boolean; // Flex
  customShowId?: string;
  customShowName?: string;
  customOrder?: number;
};

// Temporary until we figure out how to properly represent the Program
// type in an extensible and accurate way
export const offlineProgram = (duration: number): Program => {
  return {
    isOffline: true,
    duration,
    // Bogus fields...
    title: 'Offline',
    key: '',
    ratingKey: '',
    icon: '',
    type: 'flex',
    summary: '',
    plexFile: '',
    file: '',
    serverKey: '',
  };
};

// Should this really be separate?
export type CustomProgram = Program;

export type CustomShow = {
  id: string;
  name: string;
  content: CustomProgram[];
};

export type FillerProgram = Program;

export type FillerList = {
  id: string;
  name: string;
  content: FillerProgram[];
};

export type Watermark = {
  enabled: boolean;
  position: string;
  width: number;
  verticalMargin: number;
  horizontalMargin: number;
  duration: number;
};

export type FillerCollection = {
  id: string;
  weight: number;
  cooldownSeconds: number;
};

export type ChannelTranscodingOptions = {
  targetResolution: Resolution;
};

export type ChannelOffline = {
  picture?: string;
  soundtrack?: string;
  mode: string;
};

export type ChannelIcon = {
  path: string;
  width: number;
  duration: number;
  position: string;
};

export type Channel = {
  number: number;
  watermark?: Watermark;
  fillerCollections?: FillerCollection[];
  programs: Program[];
  icon: ChannelIcon;
  guideMinimumDurationSeconds: number;
  groupTitle: string;
  disableFillerOverlay: boolean;
  // iconWidth: number;
  // iconDuration: number;
  // iconPosition: string;
  // startTime: Date;
  startTimeEpoch: number;
  offline: ChannelOffline;
  // offlinePicture: string;
  // offlineSoundtrack: string;
  // offlineMode: string;
  name: string;
  transcoding?: ChannelTranscodingOptions;
  duration: number;
  fallback: Program[];
  stealth: boolean;
  guideFlexPlaceholder?: string;
};

export type ImmutableChannel = DeepReadonly<Channel>;

export type FfmpegSettings = {
  configVersion: number;
  ffmpegExecutablePath: string;
  numThreads: number;
  concatMuxDelay: string;
  enableLogging: boolean;
  enableTranscoding: boolean;
  audioVolumePercent: number;
  videoEncoder: string;
  audioEncoder: string;
  targetResolution: Resolution;
  videoBitrate: number;
  videoBufferSize: number;
  audioBitrate: number;
  audioBufferSize: number;
  audioSampleRate: number;
  audioChannels: number;
  errorScreen: string;
  errorAudio: string;
  normalizeVideoCodec: boolean;
  normalizeAudioCodec: boolean;
  normalizeResolution: boolean;
  normalizeAudio: boolean;
  maxFPS: number;
  scalingAlgorithm: 'bicubic' | 'fast_bilinear' | 'lanczos' | 'spline';
  deinterlaceFilter:
    | 'none'
    | 'bwdif=0'
    | 'bwdif=1'
    | 'w3fdif'
    | 'yadif=0'
    | 'yadif=1';
};

export const defaultFfmpegSettings: FfmpegSettings = {
  configVersion: 5,
  ffmpegExecutablePath: '/usr/bin/ffmpeg',
  numThreads: 4,
  concatMuxDelay: '0',
  enableLogging: false,
  enableTranscoding: true,
  audioVolumePercent: 100,
  videoEncoder: 'mpeg2video',
  audioEncoder: 'ac3',
  targetResolution: {
    heightPx: 1920,
    widthPx: 1080,
  },
  videoBitrate: 2000,
  videoBufferSize: 2000,
  audioBitrate: 192,
  audioBufferSize: 50,
  audioSampleRate: 48,
  audioChannels: 2,
  errorScreen: 'pic',
  errorAudio: 'silent',
  normalizeVideoCodec: true,
  normalizeAudioCodec: true,
  normalizeResolution: true,
  normalizeAudio: true,
  maxFPS: 60,
  scalingAlgorithm: 'bicubic',
  deinterlaceFilter: 'none',
};

export type Resolution = {
  widthPx: number;
  heightPx: number;
};

export type PlexStreamSettings = {
  streamPath: string;
  enableDebugLogging: boolean;
  directStreamBitrate: number;
  transcodeBitrate: number;
  mediaBufferSize: number;
  transcodeMediaBufferSize: number;
  maxPlayableResolution: Resolution;
  maxTranscodeResolution: Resolution;
  videoCodecs: string[];
  audioCodecs: string[];
  maxAudioChannels: number;
  audioBoost: number;
  enableSubtitles: boolean;
  subtitleSize: number;
  updatePlayStatus: boolean;
  streamProtocol: string;
  forceDirectPlay: boolean;
  pathReplace: string;
  pathReplaceWith: string;
};

export type PlexServerSettings = {
  id?: string;
  name: string;
  uri: string;
  accessToken: string;
  sendGuideUpdates: boolean;
  sendChannelUpdates: boolean;
  index: number;
};

export const defaultPlexStreamSettings: PlexStreamSettings = {
  streamPath: 'plex',
  enableDebugLogging: true,
  directStreamBitrate: 20000, // These were previously numnbers in dizque DB - migrate!
  transcodeBitrate: 2000,
  mediaBufferSize: 1000,
  transcodeMediaBufferSize: 20000,
  maxPlayableResolution: {
    widthPx: 1920,
    heightPx: 1080,
  },
  maxTranscodeResolution: {
    widthPx: 1920,
    heightPx: 1080,
  },
  videoCodecs: ['h264', 'hevc', 'mpeg2video', 'av1'],
  audioCodecs: ['ac3'],
  maxAudioChannels: 2,
  audioBoost: 100,
  enableSubtitles: false,
  subtitleSize: 100,
  updatePlayStatus: false,
  streamProtocol: 'http',
  forceDirectPlay: false,
  pathReplace: '',
  pathReplaceWith: '',
};

export type HdhrSettings = {
  autoDiscoveryEnabled: boolean;
  tunerCount: number;
};

export const defaultHdhrSettings: HdhrSettings = {
  autoDiscoveryEnabled: true,
  tunerCount: 2,
};

export type XmlTvSettings = {
  programmingHours: number;
  refreshHours: number;
  outputPath: string;
  enableImageCache: boolean;
};

const defaultXmlTvSettings: XmlTvSettings = {
  programmingHours: 12,
  refreshHours: 4,
  outputPath: path.resolve(constants.DEFAULT_DATA_DIR, 'xmltv.xml'),
  enableImageCache: false,
};

export type Settings = {
  clientId: string;
  hdhr: HdhrSettings;
  xmltv: XmlTvSettings;
  plexStream: PlexStreamSettings;
  plexServers: PlexServerSettings[];
  ffmpeg: FfmpegSettings;
};

type MigrationState = {
  legacyMigration: boolean;
};

export type Schema = {
  version: number;
  migration: MigrationState;
  channels: Channel[];
  settings: Settings;
  customShows: CustomShow[];
  fillerLists: FillerList[];
};

const defaultData: Schema = {
  version: 1,
  migration: {
    legacyMigration: false,
  },
  channels: [],
  customShows: [],
  fillerLists: [],
  settings: {
    clientId: uuidv4(),
    hdhr: defaultHdhrSettings,
    xmltv: defaultXmlTvSettings,
    plexStream: defaultPlexStreamSettings,
    plexServers: [],
    ffmpeg: defaultFfmpegSettings,
  },
};

abstract class IdBasedCollection<T, IdType extends string | number = string> {
  private name: string;
  protected db: Low<Schema>;

  constructor(name: string, db: Low<Schema>) {
    this.name = name;
    this.db = db;
  }

  getAll(): DeepReadonly<T[]> {
    return [...this.getAllMutable().map((x) => x as DeepReadonly<T>)];
  }

  protected abstract getAllMutable(): T[];

  protected abstract getId(item: T | DeepReadonly<T>): IdType;

  getById(id: IdType): Maybe<DeepReadonly<T>> {
    return find(this.getAll(), (x) => this.getId(x) === id);
  }

  async insertOrUpdate(item: T) {
    const all = this.getAllMutable();
    const idx = findIndex(all, (x) => this.getId(x) === this.getId(item));
    if (isUndefined(idx) || idx < 0 || idx >= all.length) {
      all.push(item);
    } else {
      all[idx] = item;
    }
    return this.db.write();
  }

  async delete(id: IdType) {
    const all = this.getAllMutable();
    const idx = findIndex(all, (x) => this.getId(x) === id);

    if (idx === -1) {
      console.warn(
        `${this.name} Collection with ID = ${id} missing when attempting delete`,
      );
      return void 0;
    }

    all.splice(idx, 1);

    return this.db.write();
  }
}

export class FillerListCollection extends IdBasedCollection<FillerList> {
  constructor(db: Low<Schema>) {
    super('FillerList', db);
  }

  protected getAllMutable(): FillerList[] {
    return this.db.data.fillerLists;
  }

  protected getId(item: FillerList | DeepReadonly<FillerList>): string {
    return item.id;
  }
}

export class CustomShowCollection extends IdBasedCollection<CustomShow> {
  constructor(db: Low<Schema>) {
    super('CustomShow', db);
  }

  protected getAllMutable(): CustomShow[] {
    return this.db.data.customShows;
  }

  protected getId(item: CustomShow | DeepReadonly<CustomShow>): string {
    return item.id;
  }
}

export class ChannelCollection extends IdBasedCollection<Channel, number> {
  constructor(db: Low<Schema>) {
    super('Channel', db);
  }

  protected getAllMutable(): Channel[] {
    return this.db.data.channels;
  }

  protected getId(item: Channel | DeepReadonly<Channel>): number {
    return item.number;
  }
}

export class PlexServerSettingsCollection extends IdBasedCollection<PlexServerSettings> {
  constructor(db: Low<Schema>) {
    super('PlexServer', db);
  }

  protected getAllMutable(): PlexServerSettings[] {
    return sortBy(this.db.data.settings.plexServers, 'index');
  }

  protected getId(
    item: PlexServerSettings | DeepReadonly<PlexServerSettings>,
  ): string {
    return item.name; // Is this right?
  }
}

export class DbAccess {
  private db: Low<Schema>;

  constructor(db: Low<Schema>) {
    this.db = db;
  }

  needsLegacyMigration() {
    return this.db.data.migration.legacyMigration;
  }

  async migrateFromLegacyDb() {
    return migrateFromLegacyDb(this.db);
  }

  plexServers(): PlexServerSettingsCollection {
    return new PlexServerSettingsCollection(this.db);
  }

  xmlTvSettings(): DeepReadonly<XmlTvSettings> {
    return this.db.data.settings.xmltv;
  }

  channels(): ChannelCollection {
    return new ChannelCollection(this.db);
  }

  fillerLists(): FillerListCollection {
    return new FillerListCollection(this.db);
  }

  customShows(): CustomShowCollection {
    return new CustomShowCollection(this.db);
  }

  hdhrSettings(): HdhrSettings {
    return this.db.data.settings.hdhr;
  }
}

export const getDBRaw = () => {
  return JSONPreset<Schema>(
    path.resolve(globalOptions().database, 'db.json'),
    defaultData,
  );
};

export const getDB = once(async () => {
  const db = await getDBRaw();
  await db.read();

  const access = new DbAccess(db);

  if (!access.needsLegacyMigration()) {
    await access.migrateFromLegacyDb();
  }

  if (db.data.version < CURRENT_VERSION) {
    // We need to perform a migration
  }

  return access;
});