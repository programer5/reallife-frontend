export function formatPlaybackPosition(value) {
  const total = Number(value || 0);
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function playbackMediaLabel(session) {
  const kind = String(session?.mediaKind || '').toUpperCase();
  if (kind === 'MUSIC') return '같이 듣기';
  if (kind === 'MOVIE' || kind === 'VIDEO') return '같이 보기';
  return '공동 플레이';
}

export function playbackStateLabel(session) {
  if (session?.status === 'ENDED') return '종료됨';
  return session?.playbackState === 'PLAYING' ? '재생 중' : '대기 중';
}

export function playbackPermissionLabel(session) {
  if (session?.status === 'ENDED') return '종료된 세션';
  if (session?.canControl) return '호스트 제어 가능';
  if (session?.myRole === 'HOST') return '호스트 제어 가능';
  return '호스트만 제어 가능';
}
