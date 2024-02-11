import {
  Channel,
  ChannelProgram,
  CondensedChannelProgram,
  ContentGuideProgram,
  ContentProgram,
  CustomShow,
  CustomShowProgramming,
  FillerList,
  FillerListProgramming,
} from '@tunarr/types';
import { isPlexEpisode } from '@tunarr/types/plex';
import { findIndex, inRange, isNil, isUndefined, sumBy } from 'lodash-es';
import { zipWithIndex } from '../../helpers/util.ts';
import { EnrichedPlexMedia } from '../../hooks/plexHooks.ts';
import useStore from '../index.ts';
import { initialChannelEditorState } from './store.ts';

export const resetChannelEditorState = () =>
  useStore.setState((state) => {
    const newState = {
      ...state,
      ...initialChannelEditorState,
    };

    return newState;
  });

type ChannelProgramming = {
  lineup: CondensedChannelProgram[];
  programs: Record<string, ContentProgram>;
};

export const setCurrentChannel = (
  channel: Omit<Channel, 'programs'>,
  programming?: ChannelProgramming,
) =>
  useStore.setState(({ channelEditor }) => {
    channelEditor.currentEntity = channel;
    channelEditor.originalEntity = channel;
    if (programming) {
      const programs = zipWithIndex(programming.lineup);
      channelEditor.originalProgramList = [...programs];
      channelEditor.programList = [...programs];
      channelEditor.programLookup = { ...programming.programs };
    }
  });

export const setCurrentLineup = (
  lineup: CondensedChannelProgram[],
  dirty?: boolean,
) =>
  useStore.setState((state) => {
    state.channelEditor.programList = zipWithIndex(lineup);
    if (!isUndefined(dirty)) {
      state.channelEditor.dirty.programs = dirty;
    }
  });

export const resetCurrentLineup = (
  lineup: CondensedChannelProgram[],
  programs: Record<string, ContentProgram>,
) =>
  useStore.setState((state) => {
    const zippedLineup = zipWithIndex(lineup);
    state.channelEditor.programList = [...zippedLineup];
    state.channelEditor.originalProgramList = [...zippedLineup];
    state.channelEditor.programLookup = { ...programs };
    state.channelEditor.dirty.programs = false;
  });

export const resetLineup = () =>
  useStore.setState((state) => {
    state.channelEditor.programList = [
      ...state.channelEditor.originalProgramList,
    ];
    state.channelEditor.dirty.programs = false;
  });

export const deleteProgram = (idx: number) =>
  useStore.setState(({ channelEditor }) => {
    if (
      channelEditor.programList.length > 0 &&
      idx >= 0 &&
      idx < channelEditor.programList.length
    ) {
      channelEditor.programList.splice(idx, 1);
      channelEditor.dirty.programs = true;
    }
  });

export const removeCustomShowProgram = (idx: number) =>
  useStore.setState(({ customShowEditor }) => {
    if (
      customShowEditor.programList.length > 0 &&
      idx >= 0 &&
      idx < customShowEditor.programList.length
    ) {
      customShowEditor.programList.splice(idx, 1);
      customShowEditor.dirty.programs = true;
    }
  });

export const updateCurrentChannel = (channel: Partial<Channel>) =>
  useStore.setState((state) => {
    if (state.channelEditor.currentEntity) {
      state.channelEditor.currentEntity = {
        ...state.channelEditor.currentEntity,
        ...channel,
      };
    }
  });

export const addProgramsToCurrentChannel = (programs: ChannelProgram[]) =>
  useStore.setState(({ channelEditor }) => {
    channelEditor.programList.push(
      ...zipWithIndex(programs, channelEditor.programList.length),
    );
    channelEditor.dirty.programs =
      channelEditor.dirty.programs || programs.length > 0;
  });

export const moveProgramInCurrentChannel = (
  originalIndex: number,
  toIndex: number,
) =>
  useStore.setState(({ channelEditor }) => {
    const programIdx = findIndex(channelEditor.programList, { originalIndex });
    if (inRange(toIndex, channelEditor.programList.length) && programIdx >= 0) {
      const item = channelEditor.programList.splice(programIdx, 1);
      channelEditor.programList.splice(toIndex, 0, ...item);
    }
  });

export const setChannelStartTime = (startTime: number) =>
  useStore.setState(({ channelEditor }) => {
    if (channelEditor.currentEntity) {
      channelEditor.currentEntity.startTime = startTime;
      channelEditor.dirty.programs = true;
    }
  });

const generatePrograms = (programs: EnrichedPlexMedia[]): ContentProgram[] => {
  return programs.map((program) => {
    let ephemeralProgram: ContentProgram;
    if (isPlexEpisode(program)) {
      ephemeralProgram = {
        id: program.id,
        persisted: !isNil(program.id),
        originalProgram: program,
        duration: program.duration,
        externalSourceName: program.serverName,
        externalSourceType: 'plex',
        externalKey: program.key,
        uniqueId: `plex|${program.serverName}|${program.key}`,
        type: 'content',
        subtype: 'episode',
        title: program.grandparentTitle,
        episodeTitle: program.title,
        episodeNumber: program.index,
        seasonNumber: program.parentIndex,
      };
    } else {
      ephemeralProgram = {
        id: program.id,
        persisted: !isNil(program.id),
        originalProgram: program,
        duration: program.duration,
        externalSourceName: program.serverName,
        externalSourceType: 'plex',
        uniqueId: `plex|${program.serverName}|${program.key}`,
        type: 'content',
        subtype: 'movie',
        title: program.title,
      };
    }

    return ephemeralProgram;
  });
};

export const addPlexMediaToCurrentChannel = (programs: EnrichedPlexMedia[]) =>
  useStore.setState(({ channelEditor }) => {
    if (channelEditor.currentEntity && programs.length > 0) {
      channelEditor.dirty.programs = true;
      const ephemeralPrograms = generatePrograms(programs);

      const oldDuration = channelEditor.currentEntity.duration;
      const newDuration =
        oldDuration + sumBy(ephemeralPrograms, (p) => p.duration);

      // Set the new channel duration based on the new program durations
      channelEditor.currentEntity.duration = newDuration;

      // Set the new channel start time to "now". We can play with this later
      // if we don't want to interrupt current programming when updating the lineup
      let lastStartTime = new Date().getTime();

      // Update the start time for all existing programs
      for (const program of channelEditor.programList) {
        const endTime = lastStartTime + program.duration;
        // program.start = lastStartTime;
        // program.stop = endTime;
        lastStartTime = endTime;
      }

      // Add start/end times for all incoming programs
      const programsWithStart: ContentGuideProgram[] = [];
      for (const program of ephemeralPrograms) {
        const endTime = lastStartTime + program.duration;
        programsWithStart.push({
          ...program,
          start: lastStartTime,
          stop: endTime,
        });
        lastStartTime = endTime;
      }

      channelEditor.programList.push(
        ...zipWithIndex(programsWithStart, channelEditor.programList.length),
      );
    }
  });

export const setCurrentCustomShow = (
  show: CustomShow,
  programs: CustomShowProgramming,
) =>
  useStore.setState(({ customShowEditor }) => {
    customShowEditor.currentEntity = show;
    customShowEditor.originalEntity = show;
    customShowEditor.dirty.programs = false;
    const zippedPrograms = zipWithIndex(programs);
    customShowEditor.originalProgramList = [...zippedPrograms];
    customShowEditor.programList = [...zippedPrograms];
  });

export const addPlexMediaToCurrentCustomShow = (
  programs: EnrichedPlexMedia[],
) =>
  useStore.setState(({ customShowEditor }) => {
    if (customShowEditor.currentEntity && programs.length > 0) {
      customShowEditor.dirty.programs = true;
      const convertedPrograms = generatePrograms(programs);
      customShowEditor.programList = customShowEditor.programList.concat(
        zipWithIndex(convertedPrograms, customShowEditor.programList.length),
      );
    }
  });

export const setCurrentFillerList = (
  show: FillerList,
  programs: FillerListProgramming,
) =>
  useStore.setState(({ fillerListEditor }) => {
    fillerListEditor.currentEntity = show;
    fillerListEditor.originalEntity = show;
    fillerListEditor.dirty.programs = false;
    const zippedPrograms = zipWithIndex(programs);
    fillerListEditor.originalProgramList = [...zippedPrograms];
    fillerListEditor.programList = [...zippedPrograms];
  });

export const addPlexMediaToCurrentFillerList = (
  programs: EnrichedPlexMedia[],
) =>
  useStore.setState(({ fillerListEditor }) => {
    if (fillerListEditor.currentEntity && programs.length > 0) {
      fillerListEditor.dirty.programs = true;
      const convertedPrograms = generatePrograms(programs);
      fillerListEditor.programList = fillerListEditor.programList.concat(
        zipWithIndex(convertedPrograms, fillerListEditor.programList.length),
      );
    }
  });
