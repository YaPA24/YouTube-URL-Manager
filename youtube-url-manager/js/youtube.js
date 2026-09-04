/* ============================================================
youtube.js — Модуль извлечения video ID и получения метаданных
YouTube URL Manager
============================================================ */
const YouTube = (() => {
  function extractVideoId(url) {
    if (!url || typeof url !== 'string') return null;
    url = url.trim();
    let m = url.match(/^https?:\/\/(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})(?:\?|&|$)/);
    if (m) return m[1];
    m = url.match(/^https?:\/\/(?:www\.|m\.)?(?:music\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})(?:\?|&|$)/);
    if (m) return m[1];
    m = url.match(/^https?:\/\/(?:www\.|m\.)?(?:music\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})(?:\?|&|$)/);
    if (m) return m[1];
    m = url.match(/^https?:\/\/(?:www\.|m\.)?(?:music\.)?youtube\.com\/live\/([a-zA-Z0-9_-]{11})(?:\?|&|$)/);
    if (m) return m[1];
    m = url.match(/^https?:\/\/(?:www\.|m\.)?(?:music\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})(?:\?|&|$)/);
    if (m) return m[1];
    m = url.match(/(?:youtube\.com\/(?:watch\?.*v=|.*[?&]v=))([a-zA-Z0-9_-]{11})(?:&|$|\s)/);
    if (m) return m[1];
    m = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})$/);
    if (m) return m[1];
    return null;
  }

  async function fetchMetadata(videoId, apiKey) {
    const result = {
      title: '',
      channelTitle: '',
      duration: '',
      durationSeconds: 0,
      publishedAt: '',
      thumbnailUrl: '',
      fetchSource: '',
      fetchError: ''
    };

    if (!videoId) {
      result.fetchError = 'No video ID provided';
      return result;
    }

    if (apiKey && apiKey.trim()) {
      try {
        const data = await _fetchFromYouTubeAPI(videoId, apiKey.trim());
        Object.assign(result, data);
        result.fetchSource = 'youtube_api';
        return result;
      } catch (e) {
        result.fetchError = 'YouTube API error: ' + e.message;
      }
    }

    try {
      const url = 'https://www.youtube.com/watch?v=' + videoId;
      const data = await _fetchFromOEmbed(url);
      Object.assign(result, data);
      result.fetchSource = 'oembed';
      return result;
    } catch (e) {}

    try {
      const url = 'https://www.youtube.com/watch?v=' + videoId;
      const data = await _fetchFromNoEmbed(url);
      Object.assign(result, data);
      result.fetchSource = 'noembed';
      return result;
    } catch (e) {
      result.fetchError = 'All fetch methods failed';
    }

    return result;
  }

  async function _fetchFromYouTubeAPI(videoId, apiKey) {
    const endpoint = 'https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=' +
      encodeURIComponent(videoId) + '&key=' + encodeURIComponent(apiKey);
    const resp = await fetch(endpoint);
    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      throw new Error(errBody.error ? errBody.error.message : 'HTTP ' + resp.status);
    }
    const json = await resp.json();
    if (!json.items || json.items.length === 0) {
      throw new Error('Video not found');
    }
    const item = json.items[0];
    const snippet = item.snippet || {};
    const details = item.contentDetails || {};
    const duration = _parseISO8601Duration(details.duration || '');
    const thumbnail = _getBestThumbnail(snippet.thumbnails);
    return {
      title: snippet.title || '',
      channelTitle: snippet.channelTitle || '',
      duration: duration.formatted,
      durationSeconds: duration.seconds,
      publishedAt: snippet.publishedAt || '',
      thumbnailUrl: thumbnail
    };
  }

  async function _fetchFromOEmbed(videoUrl) {
    const endpoint = 'https://www.youtube.com/oembed?url=' +
      encodeURIComponent(videoUrl) + '&format=json';
    const resp = await fetch(endpoint);
    if (!resp.ok) throw new Error('oembed HTTP ' + resp.status);
    const json = await resp.json();
    return {
      title: json.title || '',
      channelTitle: json.author_name || '',
      thumbnailUrl: json.thumbnail_url || ''
    };
  }

  async function _fetchFromNoEmbed(videoUrl) {
    const endpoint = 'https://noembed.com/embed?url=' +
      encodeURIComponent(videoUrl);
    const resp = await fetch(endpoint);
    if (!resp.ok) throw new Error('noembed HTTP ' + resp.status);
    const json = await resp.json();
    return {
      title: json.title || '',
      channelTitle: json.author_name || '',
      thumbnailUrl: json.thumbnail_url || ''
    };
  }

  function _parseISO8601Duration(iso) {
    if (!iso) return { formatted: '', seconds: 0 };
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return { formatted: '', seconds: 0 };
    const h = parseInt(m[1] || '0', 10);
    const min = parseInt(m[2] || '0', 10);
    const sec = parseInt(m[3] || '0', 10);
    const total = h * 3600 + min * 60 + sec;
    const parts = [];
    if (h > 0) parts.push(h + ':');
    parts.push((min > 0 || h > 0 ? String(min).padStart(2, '0') : '0') + ':');
    parts.push(String(sec).padStart(2, '0'));
    return { formatted: parts.join(''), seconds: total };
  }

  function _getBestThumbnail(thumbnails) {
    if (!thumbnails) return '';
    const order = ['maxres', 'high', 'standard', 'medium', 'default'];
    for (const key of order) {
      if (thumbnails[key] && thumbnails[key].url) {
        return thumbnails[key].url;
      }
    }
    return '';
  }

  function getThumbnailUrl(videoId, quality) {
    quality = quality || 'mqdefault';
    if (!videoId) return '';
    return 'https://img.youtube.com/vi/' + videoId + '/' + quality + '.jpg';
  }

  function getVideoUrl(videoId) {
    if (!videoId) return '';
    return 'https://www.youtube.com/watch?v=' + videoId;
  }

  return {
    extractVideoId,
    fetchMetadata,
    getThumbnailUrl,
    getVideoUrl
  };
})();
