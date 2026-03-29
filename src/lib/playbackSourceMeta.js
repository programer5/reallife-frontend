function safeUrl(raw) {
  try {
    return raw ? new URL(raw) : null;
  } catch {
    return null;
  }
}

function readYouTubeId(url) {
  if (!url) return '';
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') return url.pathname.slice(1);
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (url.pathname === '/watch') return url.searchParams.get('v') || '';
    if (url.pathname.startsWith('/shorts/')) return url.pathname.split('/')[2] || '';
    if (url.pathname.startsWith('/embed/')) return url.pathname.split('/')[2] || '';
  }
  return '';
}

function readSpotifyInfo(url) {
  if (!url) return null;
  const host = url.hostname.replace(/^open\./, '').replace(/^play\./, '');
  if (host !== 'spotify.com') return null;
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] === 'intl-ko' || parts[0] === 'intl-en') parts.shift();
  if (parts[0] === 'embed') parts.shift();
  const kind = parts[0];
  const id = parts[1];
  if (!kind || !id) return null;
  return { kind, id };
}

export function getPlaybackSourceMeta(rawUrl, fallbackThumbnail = '') {
  const url = safeUrl(rawUrl);
  const thumbnail = fallbackThumbnail || '';
  if (!url) {
    return {
      provider: 'link',
      label: '링크',
      cleanUrl: rawUrl || '',
      embedUrl: '',
      previewKind: thumbnail ? 'image' : 'link',
      thumbnailUrl: thumbnail,
    };
  }

  const youtubeId = readYouTubeId(url);
  if (youtubeId) {
    return {
      provider: 'youtube',
      label: 'YouTube',
      cleanUrl: url.toString(),
      embedUrl: `https://www.youtube.com/embed/${youtubeId}`,
      previewKind: 'iframe',
      thumbnailUrl: thumbnail || `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
    };
  }

  const spotify = readSpotifyInfo(url);
  if (spotify) {
    return {
      provider: 'spotify',
      label: 'Spotify',
      cleanUrl: url.toString(),
      embedUrl: `https://open.spotify.com/embed/${spotify.kind}/${spotify.id}`,
      previewKind: 'iframe',
      thumbnailUrl: thumbnail,
    };
  }

  return {
    provider: url.hostname.replace(/^www\./, ''),
    label: url.hostname.replace(/^www\./, ''),
    cleanUrl: url.toString(),
    embedUrl: '',
    previewKind: thumbnail ? 'image' : 'link',
    thumbnailUrl: thumbnail,
  };
}
