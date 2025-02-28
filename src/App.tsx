import React, { useState } from 'react';
import { Youtube, AlertCircle, Loader2, Copy, List, User, Play, FastForward, Clock } from 'lucide-react';
import axios from 'axios';

interface PlaylistInfo {
  title: string;
  creator: string;
  videoCount: number;
  unavailableCount: number;
  averageDuration: {
    hours: number;
    minutes: number;
    seconds: number;
  };
  totalDuration: {
    hours: number;
    minutes: number;
    seconds: number;
  };
  speedTimes: {
    [key: string]: {
      hours: number;
      minutes: number;
      seconds: number;
    };
  };
}

function App() {
  // Analyzer state
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [playlistInfo, setPlaylistInfo] = useState<PlaylistInfo | null>(null);
  const [analyzingPlaylist, setAnalyzingPlaylist] = useState(false);
  const [playlistError, setPlaylistError] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  const extractPlaylistId = (url: string): string | null => {
    const regExp = /[&?]list=([^&]+)/;
    const match = url.match(regExp);
    return match ? match[1] : null;
  };

  const analyzePlaylist = async () => {
    setPlaylistError('');
    setPlaylistInfo(null);
    setCopySuccess(false);
    
    const playlistId = extractPlaylistId(playlistUrl);
    
    if (!playlistId) {
      setPlaylistError('Invalid YouTube playlist URL. Please enter a valid playlist URL.');
      return;
    }
    
    setAnalyzingPlaylist(true);
    
    try {
      const API_KEY = 'AIzaSyAPUeKlx-cwLtnnOIIz9V3WihryjS-lSu0';
      
      // First, get playlist details
      const playlistResponse = await axios.get(
        `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}&key=${API_KEY}`
      );
      
      if (!playlistResponse.data.items || playlistResponse.data.items.length === 0) {
        throw new Error('Playlist not found');
      }
      
      const playlistTitle = playlistResponse.data.items[0].snippet.title;
      const channelTitle = playlistResponse.data.items[0].snippet.channelTitle;
      
      // Get all playlist items (videos)
      let nextPageToken = '';
      let allItems: any[] = [];
      let unavailableCount = 0;
      
      do {
        const playlistItemsResponse = await axios.get(
          `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,status&maxResults=50&playlistId=${playlistId}&key=${API_KEY}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`
        );
        
        const items = playlistItemsResponse.data.items || [];
        allItems = [...allItems, ...items];
        
        // Count unavailable videos
        unavailableCount += items.filter((item: any) => 
          item.snippet.title === 'Private video' || 
          item.snippet.title === 'Deleted video' ||
          item.status?.privacyStatus === 'private'
        ).length;
        
        nextPageToken = playlistItemsResponse.data.nextPageToken || '';
      } while (nextPageToken);
      
      // Get durations for all available videos
      const availableVideoIds = allItems
        .filter(item => 
          item.snippet.title !== 'Private video' && 
          item.snippet.title !== 'Deleted video' &&
          item.status?.privacyStatus !== 'private'
        )
        .map(item => item.snippet.resourceId.videoId);
      
      let totalDurationSeconds = 0;
      
      // Fetch durations in batches of 50 (API limit)
      for (let i = 0; i < availableVideoIds.length; i += 50) {
        const batchIds = availableVideoIds.slice(i, i + 50);
        
        const videosResponse = await axios.get(
          `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${batchIds.join(',')}&key=${API_KEY}`
        );
        
        // Calculate total duration
        for (const item of videosResponse.data.items || []) {
          const duration = item.contentDetails.duration; // PT1H30M15S format
          const seconds = parseDurationToSeconds(duration);
          totalDurationSeconds += seconds;
        }
      }
      
      // Calculate average duration
      const availableCount = availableVideoIds.length;
      const averageDurationSeconds = availableCount > 0 ? Math.round(totalDurationSeconds / availableCount) : 0;
      
      // Calculate different speed times
      const speedFactors = [1.25, 1.5, 1.75, 2.0];
      const speedTimes: {[key: string]: {hours: number, minutes: number, seconds: number}} = {};
      
      speedFactors.forEach(factor => {
        const adjustedSeconds = Math.round(totalDurationSeconds / factor);
        speedTimes[`${factor}x`] = secondsToHMS(adjustedSeconds);
      });
      
      // Set playlist info
      setPlaylistInfo({
        title: playlistTitle,
        creator: channelTitle,
        videoCount: allItems.length,
        unavailableCount,
        averageDuration: secondsToHMS(averageDurationSeconds),
        totalDuration: secondsToHMS(totalDurationSeconds),
        speedTimes
      });
      
    } catch (error) {
      console.error('Error analyzing playlist:', error);
      setPlaylistError('Failed to analyze playlist. Please check the URL and try again.');
    } finally {
      setAnalyzingPlaylist(false);
    }
  };
  
  const parseDurationToSeconds = (duration: string): number => {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    
    if (!match) return 0;
    
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');
    
    return hours * 3600 + minutes * 60 + seconds;
  };
  
  const secondsToHMS = (totalSeconds: number): {hours: number, minutes: number, seconds: number} => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return { hours, minutes, seconds };
  };
  
  const formatTime = (time: {hours: number, minutes: number, seconds: number}): string => {
    return `${time.hours}h ${time.minutes}m ${time.seconds}s`;
  };
  
  const copyResults = () => {
    if (!playlistInfo) return;
    
    const results = `
Playlist Analysis Results:
------------------------
Title: ${playlistInfo.title}
Creator: ${playlistInfo.creator}
Total Videos: ${playlistInfo.videoCount} (${playlistInfo.unavailableCount} unavailable)
Average Video Length: ${formatTime(playlistInfo.averageDuration)}
Total Duration: ${formatTime(playlistInfo.totalDuration)}

Estimated Watching Time:
- At 1.25x speed: ${formatTime(playlistInfo.speedTimes['1.25x'])}
- At 1.50x speed: ${formatTime(playlistInfo.speedTimes['1.5x'])}
- At 1.75x speed: ${formatTime(playlistInfo.speedTimes['1.75x'])}
- At 2.00x speed: ${formatTime(playlistInfo.speedTimes['2x'])}
    `.trim();
    
    navigator.clipboard.writeText(results)
      .then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy results:', err);
      });
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
        <div className="bg-red-600 p-4 flex items-center">
          <Youtube className="text-white mr-2" size={24} />
          <h1 className="text-xl font-bold text-white">YouTube Playlist Analyzer</h1>
        </div>
        
        <div className="p-6">
          <div className="mb-6">
            <label htmlFor="playlistUrl" className="block text-sm font-medium text-gray-700 mb-1">
              Paste your YouTube playlist URL here:
            </label>
            <div className="flex">
              <input
                type="text"
                id="playlistUrl"
                value={playlistUrl}
                onChange={(e) => setPlaylistUrl(e.target.value)}
                className="flex-1 p-2 border rounded-l-md focus:ring-red-500 focus:border-red-500"
                placeholder="https://www.youtube.com/playlist?list=..."
                disabled={analyzingPlaylist}
              />
              <button
                onClick={analyzePlaylist}
                disabled={analyzingPlaylist || !playlistUrl}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-r-md transition-colors disabled:bg-red-400"
              >
                {analyzingPlaylist ? (
                  <div className="flex items-center">
                    <Loader2 size={18} className="animate-spin mr-2" />
                    Analyzing...
                  </div>
                ) : (
                  'Analyze'
                )}
              </button>
            </div>
            
            {playlistError && (
              <div className="mt-2 text-sm text-red-600 flex items-center">
                <AlertCircle size={14} className="mr-1" />
                {playlistError}
              </div>
            )}
          </div>
          
          {playlistInfo && (
            <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-gray-800">{playlistInfo.title}</h2>
                <button
                  onClick={copyResults}
                  className="flex items-center text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded transition-colors"
                >
                  <Copy size={14} className="mr-1" />
                  {copySuccess ? 'Copied!' : 'Copy Results'}
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center">
                  <User className="text-gray-500 mr-2" size={18} />
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">Creator:</span> {playlistInfo.creator}
                  </div>
                </div>
                
                <div className="flex items-center">
                  <Play className="text-gray-500 mr-2" size={18} />
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">Total Videos:</span> {playlistInfo.videoCount}
                    {playlistInfo.unavailableCount > 0 && (
                      <span className="text-amber-600 ml-1">
                        ({playlistInfo.unavailableCount} unavailable)
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center">
                  <Clock className="text-gray-500 mr-2" size={18} />
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">Average Video Length:</span> {formatTime(playlistInfo.averageDuration)}
                  </div>
                </div>
                
                <div className="flex items-start">
                  <Clock className="text-gray-500 mr-2 mt-0.5" size={18} />
                  <div className="text-sm">
                    <div className="font-medium text-gray-700 mb-1">Total Duration:</div>
                    <div className="text-lg font-bold text-gray-800 mb-1">
                      {formatTime(playlistInfo.totalDuration)}
                    </div>
                    <div className="text-gray-600">
                      {playlistInfo.totalDuration.hours > 0 && `${playlistInfo.totalDuration.hours} hour${playlistInfo.totalDuration.hours !== 1 ? 's' : ''} `}
                      {playlistInfo.totalDuration.minutes > 0 && `${playlistInfo.totalDuration.minutes} minute${playlistInfo.totalDuration.minutes !== 1 ? 's' : ''} `}
                      {playlistInfo.totalDuration.seconds > 0 && `${playlistInfo.totalDuration.seconds} second${playlistInfo.totalDuration.seconds !== 1 ? 's' : ''}`}
                    </div>
                  </div>
                </div>
                
                <div className="pt-2 border-t border-gray-200">
                  <div className="flex items-start mb-2">
                    <FastForward className="text-gray-500 mr-2 mt-0.5" size={18} />
                    <div className="text-sm font-medium text-gray-700">Estimated Watching Time at Different Speeds:</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 ml-7">
                    {Object.entries(playlistInfo.speedTimes).map(([speed, time]) => (
                      <div key={speed} className="bg-white p-3 rounded border border-gray-200">
                        <div className="text-sm font-medium text-gray-700 mb-1">At {speed} speed:</div>
                        <div className="text-base font-bold text-gray-800">{formatTime(time)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {!playlistInfo && !playlistError && !analyzingPlaylist && (
            <div className="text-center py-8 text-gray-500">
              <List size={48} className="mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium mb-2">Analyze any YouTube playlist</p>
              <p className="text-sm">
                Enter a YouTube playlist URL above to see detailed information about the playlist,
                including total duration and estimated watching times at different speeds.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;