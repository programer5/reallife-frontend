export function useConversationDetailDockPresentation(options = {}) {
  const {
    classifyPin,
    pinKindMeta,
    pinTimelineState,
    pinTimeText,
    reminderTimeText,
  } = options;

  function pinActivityLabel(item) {
    if (item?.action === "DONE") return "완료";
    if (item?.action === "CANCELED") return "취소";
    return "숨김";
  }

  function pinActivityTone(item) {
    if (item?.action === "DONE") return "done";
    if (item?.action === "CANCELED") return "cancel";
    return "hide";
  }

  function pinActivityMeta(item) {
    const when = item?.startAt ? pinTimeText(item) : "방금 처리";
    const place = item?.placeText ? ` · ${item.placeText}` : "";
    return `${when}${place}`;
  }

  function pinTimelineTimeText(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value).replace("T", " ").slice(0, 16);
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mi}`;
  }

  function pinTimelineEvents(pin) {
    const events = [];
    if (pin?.createdAt) {
      events.push({
        key: `created-${pin.pinId || pin.id || ""}`,
        time: pin.createdAt,
        label: "액션 생성",
        tone: "create",
      });
    }

    const status = String(pin?.status || "").toUpperCase();
    if (status === "DONE" && pin?.updatedAt) {
      events.push({
        key: `done-${pin.pinId || pin.id || ""}`,
        time: pin.updatedAt,
        label: "완료 처리",
        tone: "done",
      });
    } else if ((status === "CANCELED" || status === "CANCELLED") && pin?.updatedAt) {
      events.push({
        key: `cancel-${pin.pinId || pin.id || ""}`,
        time: pin.updatedAt,
        label: "취소 처리",
        tone: "cancel",
      });
    }

    return events
      .filter((event) => event.time)
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }

  function pinPrimarySummary(pin) {
    const kind = classifyPin(pin);
    const state = pinTimelineState(pin);
    if (kind === "PROMISE") {
      if (pin?.startAt) return `${state.label} · ${pinTimeText(pin)}`;
      return "시간을 정하면 약속 흐름이 더 선명해져요";
    }
    if (kind === "TODO") {
      return pin?.remindAt ? `리마인드 예정 · ${reminderTimeText(pin)}` : "체크 전 상태예요";
    }
    return pin?.placeText ? `${pin.placeText} 저장됨` : "다음에 다시 꺼낼 장소예요";
  }

  function pinSecondarySummary(pin) {
    const kind = classifyPin(pin);
    if (kind === "PROMISE") {
      return pin?.placeText ? "장소와 시간을 확인한 뒤 완료 또는 일정 조정" : "시간과 장소를 보강해 약속 맥락 완성";
    }
    if (kind === "TODO") {
      return pin?.startAt ? "시간에 맞춰 처리하거나 완료로 정리" : "완료 처리하거나 필요하면 리마인드 추가";
    }
    return pin?.remindAt ? "리마인드 시점 전에 다시 확인" : "필요하면 메모를 덧붙여 공유하기";
  }

  function pinCtaHint(pin) {
    const kind = classifyPin(pin);
    if (kind === "PROMISE") return "시간 변경, 완료 처리, 피드 공유까지 한 카드에서 이어갈 수 있어요";
    if (kind === "TODO") return "할 일은 완료 처리와 리마인드 정리가 가장 빠른 다음 액션이에요";
    return "장소는 수정 후 공유해 두면 나중에 다시 찾기 쉬워져요";
  }

  function feedShareTextForPin(pin) {
    const meta = pinKindMeta(pin);
    const title = String(pin?.title || meta.label || "액션").trim();
    const time = pin?.startAt ? pinTimeText(pin) : "";
    const place = String(pin?.placeText || "").trim();
    const remind = pin?.remindAt ? reminderTimeText(pin) : "";

    return [
      `${meta.emoji} ${title}`,
      time ? `🕒 ${time}` : "",
      place ? `📍 ${place}` : "",
      remind && remind !== "리마인드 없음" ? `⏰ ${remind}` : "",
      "",
      "#RealLife",
    ]
      .filter((line, idx, arr) => {
        if (line) return true;
        return idx === arr.length - 2;
      })
      .join("\n");
  }

  function feedShareMetaForPin(pin) {
    const meta = pinKindMeta(pin);
    const title = String(pin?.title || meta.label || "액션").trim();
    const time = pin?.startAt ? pinTimeText(pin) : "시간 미정";
    const place = String(pin?.placeText || "장소 미정").trim();
    const remind = pin?.remindAt ? reminderTimeText(pin) : "리마인드 없음";

    const chips = [
      time ? `🕒 ${time}` : "",
      place ? `📍 ${place}` : "",
      remind && remind !== "리마인드 없음" ? `⏰ ${remind}` : "",
    ].filter(Boolean);

    return {
      badge: "액션 공유",
      title,
      subtitle: [meta.label, place !== "장소 미정" ? place : ""].filter(Boolean).join(" · "),
      description: [time, place].filter(Boolean).join(" · "),
      state: remind && remind !== "리마인드 없음" ? "리마인더 설정됨" : meta.label,
      status: remind && remind !== "리마인드 없음" ? remind : meta.label,
      kind: meta.label,
      emoji: meta.emoji,
      time,
      place,
      remindAt: remind && remind !== "리마인드 없음" ? remind : "",
      chips,
    };
  }

  return {
    pinActivityLabel,
    pinActivityTone,
    pinActivityMeta,
    pinTimelineTimeText,
    pinTimelineEvents,
    pinPrimarySummary,
    pinSecondarySummary,
    pinCtaHint,
    feedShareTextForPin,
    feedShareMetaForPin,
  };
}
