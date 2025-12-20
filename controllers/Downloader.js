const { exec } = require('youtube-dl-exec');
const path = require('path');
const fs = require('fs').promises;

const ffmpegLocation = path.join(__dirname, '../plugin/ffmpeg.exe');

class MediaDownloader {
  constructor() {
    this.ffmpegLocation = ffmpegLocation;
  }

  async downloadVideo(url, outputFilePath, options = {}) {
    const defaultOptions = {
      output: outputFilePath,
      ffmpegLocation: this.ffmpegLocation,
      format: options.format || 'mp4',
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
    };

    try {
      await exec(url, { ...defaultOptions, ...options });
      return { success: true, filePath: outputFilePath };
    } catch (error) {
      console.error(`Error downloading video: ${error.message}`);
      throw error;
    }
  }

  async downloadAudio(url, outputFilePath, options = {}) {
    const defaultOptions = {
      output: outputFilePath,
      ffmpegLocation: this.ffmpegLocation,
      extractAudio: true,
      audioFormat: options.audioFormat || 'mp3',
      audioQuality: options.quality || 0,
      noCheckCertificates: true,
      noWarnings: true,
    };

    try {
      await exec(url, { ...defaultOptions, ...options });
      return { success: true, filePath: outputFilePath };
    } catch (error) {
      console.error(`Error downloading audio: ${error.message}`);
      throw error;
    }
  }

  async getVideoInfo(url) {
    try {
      const result = await exec(url, {
        dumpJson: true,
        noWarnings: true,
      });
      return JSON.parse(result);
    } catch (error) {
      console.error(`Error getting video info: ${error.message}`);
      throw error;
    }
  }

  // Platform-specific methods with optimized settings
  youtube = {
    video: (url, outputPath) => this.downloadVideo(url, outputPath, { format: 'best[height<=1080]' }),
    audio: (url, outputPath) => this.downloadAudio(url, outputPath, { quality: 0 }),
  };

  facebook = {
    video: (url, outputPath) => this.downloadVideo(url, outputPath),
    audio: (url, outputPath) => this.downloadAudio(url, outputPath),
  };

  twitter = {
    video: (url, outputPath) => this.downloadVideo(url, outputPath),
    audio: (url, outputPath) => this.downloadAudio(url, outputPath),
  };

  instagram = {
    video: (url, outputPath) => this.downloadVideo(url, outputPath),
    audio: (url, outputPath) => this.downloadAudio(url, outputPath),
  };

  tiktok = {
    video: (url, outputPath) => this.downloadVideo(url, outputPath),
    audio: (url, outputPath) => this.downloadAudio(url, outputPath),
  };

  vimeo = {
    video: (url, outputPath) => this.downloadVideo(url, outputPath),
    audio: (url, outputPath) => this.downloadAudio(url, outputPath),
  };
}

// Alternative: Keep your original interface but with the new class
const downloader = new MediaDownloader();

module.exports = {
  // Original exports for backward compatibility
  YoutubeVideo: downloader.youtube.video,
  YoutubeAudio: downloader.youtube.audio,
  FacebookVideo: downloader.facebook.video,
  FacebookAudio: downloader.facebook.audio,
  TwitterVideo: downloader.twitter.video,
  TwitterAudio: downloader.twitter.audio,
  InstagramVideo: downloader.instagram.video,
  InstagramAudio: downloader.instagram.audio,
  TikTokVideo: downloader.tiktok.video,
  TikTokAudio: downloader.tiktok.audio,
  VimeoVideo: downloader.vimeo.video,
  VimeoAudio: downloader.vimeo.audio,
  
  // Export the class for advanced usage
  MediaDownloader,
  getVideoInfo: downloader.getVideoInfo.bind(downloader),
};
