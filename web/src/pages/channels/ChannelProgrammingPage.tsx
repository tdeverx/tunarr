import {
  Box,
  Button,
  CircularProgress,
  Snackbar,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UpdateChannelProgrammingRequest } from '@tunarr/types/api';
import { ZodiosError } from '@zodios/core';
import { chain, findIndex, first, isUndefined, map } from 'lodash-es';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import { ChannelProgrammingConfig } from '../../components/channel_config/ChannelProgrammingConfig.tsx';
import { apiClient } from '../../external/api.ts';
import { channelProgramUniqueId } from '../../helpers/util.ts';
import { usePreloadedChannelEdit } from '../../hooks/usePreloadedChannel.ts';
import { resetCurrentLineup } from '../../store/channelEditor/actions.ts';

type MutateArgs = {
  channelId: string;
  lineupRequest: UpdateChannelProgrammingRequest;
};

type SnackBar = {
  display: boolean;
  message: string;
  color: string;
};

export default function ChannelProgrammingPage() {
  const { currentEntity: channel, programList: newLineup } =
    usePreloadedChannelEdit();

  const queryClient = useQueryClient();
  const theme = useTheme();

  const [snackStatus, setSnackStatus] = useState<SnackBar>({
    display: false,
    color: '',
    message: '',
  });

  const updateLineupMutation = useMutation({
    mutationFn: ({ channelId, lineupRequest }: MutateArgs) => {
      return apiClient.post('/api/v2/channels/:id/programming', lineupRequest, {
        params: { id: channelId },
      });
    },
    onSuccess: async (data, { channelId: channelNumber }) => {
      resetCurrentLineup(data.lineup, data.programs);
      setSnackStatus({
        display: true,
        message: 'Programs Saved!',
        color: theme.palette.success.main,
      });
      await queryClient.invalidateQueries({
        queryKey: ['channels', channelNumber],
      });
    },
    onError: (error) => {
      setSnackStatus({
        display: true,
        message: error.message,
        color: theme.palette.error.main,
      });
      if (error instanceof ZodiosError) {
        console.error(error.data);
        console.error(error, error.cause);
      }
    },
  });

  const handleSnackClose = () => {
    setSnackStatus({ display: false, message: '', color: '' });
  };

  const onSave = () => {
    // Group programs by their unique ID. This will disregard their durations,
    // but we will keep the durations when creating the minimal lineup below
    const uniquePrograms = chain(newLineup)
      .groupBy((lineupItem) => channelProgramUniqueId(lineupItem))
      .values()
      .map(first)
      .compact()
      .value();

    // Create the in-order lineup which is a lookup array - we have the index
    // to the actual program (in the unique programs list) and then the
    // duration of the lineup item.
    const lineup = map(newLineup, (lineupItem) => {
      const index = findIndex(
        uniquePrograms,
        (uniq) =>
          channelProgramUniqueId(lineupItem) === channelProgramUniqueId(uniq),
      );
      return { duration: lineupItem.duration, index };
    });

    updateLineupMutation
      .mutateAsync({
        channelId: channel!.id,
        lineupRequest: { type: 'manual', lineup, programs: uniquePrograms },
      })
      .then(console.log)
      .catch(console.error);
  };

  return isUndefined(channel) ? (
    <div>
      <CircularProgress />
    </div>
  ) : (
    <div>
      <Snackbar
        open={snackStatus.display}
        autoHideDuration={6000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        onClose={handleSnackClose}
        message={snackStatus.message}
        sx={{ backgroundColor: snackStatus.color }}
      />
      <Breadcrumbs />
      <Typography variant="h4" sx={{ mb: 2 }}>
        Channel {channel.number} Programming
      </Typography>
      <ChannelProgrammingConfig />
      <Box sx={{ display: 'flex', justifyContent: 'end', pt: 1, columnGap: 1 }}>
        <Button variant="contained" to="/channels" component={RouterLink}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => onSave()}>
          Save
        </Button>
      </Box>
    </div>
  );
}
