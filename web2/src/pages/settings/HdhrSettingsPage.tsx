import React, { useEffect } from 'react';
import {
  Button,
  Checkbox,
  FormControl,
  FormLabel,
  FormHelperText,
  Stack,
  TextField,
  Snackbar,
} from '@mui/material';
import { useHdhrSettings } from '../../hooks/settingsHooks.ts';
import { defaultHdhrSettings, HdhrSettings } from 'dizquetv-types';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export default function HdhrSettingsPage() {
  const { data, isPending, error } = useHdhrSettings();
  const [snackStatus, setSnackStatus] = React.useState<boolean>(false);
  const [enableSsdpServer, setEnableSsdpServer] = React.useState<boolean>(
    defaultHdhrSettings.enableSsdpServer,
  );
  const [tunerCount, setTunerCount] = React.useState<string>(
    defaultHdhrSettings.tunerCount.toString(),
  );

  const queryClient = useQueryClient();

  const updateHdhrSettingsMutation = useMutation({
    mutationFn: (updateSettings: HdhrSettings) => {
      return fetch('http://localhost:8000/api/hdhr-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateSettings),
      });
    },
    onSuccess: () => {
      setSnackStatus(true);
      return queryClient.invalidateQueries({
        queryKey: ['settings', 'hdhr-settings'],
      });
    },
  });

  const updateHdhrSettings = () => {
    updateHdhrSettingsMutation.mutate({
      enableSsdpServer,
      tunerCount: Number(tunerCount),
    });
  };

  const handleResetOptions = () => {
    updateHdhrSettingsMutation.mutate({
      ...defaultHdhrSettings,
    });
    setEnableSsdpServer(defaultHdhrSettings.enableSsdpServer);
    setTunerCount(defaultHdhrSettings.tunerCount.toString());
  };

  const handleEnableSsdpServer = () => {
    setEnableSsdpServer(!enableSsdpServer);
  };

  const handleTunerCount = (value: string) => {
    setTunerCount(value);
  };

  const handleSnackClose = () => {
    setSnackStatus(false);
  };

  useEffect(() => {
    setEnableSsdpServer(
      data?.enableSsdpServer || defaultHdhrSettings.enableSsdpServer,
    );
    setTunerCount(
      data?.tunerCount.toString() || defaultHdhrSettings.tunerCount.toString(),
    );
  }, [data]);

  if (isPending) {
    return <h1>XML: Loading...</h1>;
  } else if (error) {
    return <h1>XML: {error.message}</h1>;
  }

  return (
    <>
      <Snackbar
        open={snackStatus}
        autoHideDuration={6000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        onClose={handleSnackClose}
        message="Settings Saved!"
      />
      <FormControl>
        <Checkbox
          value={enableSsdpServer}
          onChange={() => handleEnableSsdpServer()}
        />
        <FormLabel>Enable SSDP server</FormLabel>
        <FormHelperText>* Restart required</FormHelperText>
      </FormControl>
      <TextField
        fullWidth
        id="output-path"
        label="Tuner Count"
        value={tunerCount}
        onChange={(event) => handleTunerCount(event.target.value)}
        variant="filled"
        sx={{ mt: 2, mb: 2 }}
      />
      <Stack spacing={2} direction="row" justifyContent="right" sx={{ mt: 2 }}>
        <Button variant="outlined" onClick={() => handleResetOptions()}>
          Reset Options
        </Button>
        <Button variant="contained" onClick={() => updateHdhrSettings()}>
          Save
        </Button>
      </Stack>
    </>
  );
}