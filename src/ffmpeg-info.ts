import { exec } from 'child_process';

export class FFMPEGInfo {
  private ffmpegPath: string;
  constructor(opts) {
    this.ffmpegPath = opts.ffmpegPath;
  }
  async getVersion() {
    try {
      let s: string = await new Promise((resolve, reject) => {
        exec(`"${this.ffmpegPath}" -version`, function (error, stdout) {
          if (error !== null) {
            reject(error);
          } else {
            resolve(stdout);
          }
        });
      });
      var m = s.match(/version\s+([^\s]+)\s+.*Copyright/);
      if (m == null) {
        console.error(
          'ffmpeg -version command output not in the expected format: ' + s,
        );
        return s;
      }
      return m[1];
    } catch (err) {
      console.error('Error getting ffmpeg version', err);
      return 'Error';
    }
  }
}