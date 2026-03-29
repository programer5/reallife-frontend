let youtubeApiPromise = null;

export function loadYouTubeIframeApi() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('window is not available'));
  }
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-youtube-iframe-api="true"]');
    const previousReady = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error('YouTube iframe API loaded without Player'));
    };

    if (existing) return;

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.defer = true;
    script.dataset.youtubeIframeApi = 'true';
    script.onerror = () => reject(new Error('Failed to load YouTube iframe API'));
    document.head.appendChild(script);
  });

  return youtubeApiPromise;
}
