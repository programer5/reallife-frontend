export function useConversationPinUi({
  ref,
  computed,
  router,
  toast,
  conversationId,
  pinsStore,
  loadPins,
  pinDone,
  pinCancel,
  pinDismiss,
  pinUpdate,
  rememberPinAction,
  pinKindMeta,
  reminderTimeText,
  useDockSheet,
  dockOpen,
}) {
  const pinModalOpen = ref(false);
  const pinModalAction = ref("DONE");
  const pinModalPin = ref(null);
  const pinActionLoading = ref(false);

  function openPinActionModal(action, pin) {
    pinModalAction.value = action;
    pinModalPin.value = pin;
    pinModalOpen.value = true;
    if (useDockSheet.value) dockOpen.value = false;
  }

  function closePinActionModal() {
    pinModalOpen.value = false;
    pinModalPin.value = null;
  }

  const pinModalTitle = computed(() => {
    if (pinModalAction.value === "DONE") return "✅ 핀 완료";
    if (pinModalAction.value === "CANCELED") return "❌ 핀 취소";
    return "🙈 핀 숨김";
  });

  const pinModalSubtitle = computed(() => {
    if (pinModalAction.value === "DONE") return "이 핀을 완료 처리할까요? (대화방 전체에 적용)";
    if (pinModalAction.value === "CANCELED") return "이 핀을 취소 처리할까요? (대화방 전체에 적용)";
    return "이 핀을 내 화면에서 숨길까요? (상대방은 그대로 보일 수 있어요)";
  });

  const pinModalConfirmText = computed(() => {
    if (pinModalAction.value === "DONE") return "완료 처리";
    if (pinModalAction.value === "CANCELED") return "취소 처리";
    return "숨김 처리";
  });

  const pinModalConfirmVariant = computed(() => {
    if (pinModalAction.value === "DONE") return "primary";
    if (pinModalAction.value === "CANCELED") return "danger";
    return "ghost";
  });

  function pinTimeText(pin) {
    const s = pin?.startAt ? String(pin.startAt) : "";
    if (!s) return "미정";
    return s.replace("T", " ").slice(0, 16);
  }

  function pinTimelineTimeText(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value).replace('T', ' ').slice(0, 16);
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mi}`;
  }

  async function confirmPinAction() {
    const p = pinModalPin.value;
    if (!p?.pinId) return;

    pinActionLoading.value = true;
    try {
      if (pinModalAction.value === "DONE") await pinDone(p.pinId);
      else if (pinModalAction.value === "CANCELED") await pinCancel(p.pinId);
      else await pinDismiss(p.pinId);

      rememberPinAction(pinModalAction.value, p);
      pinsStore.removePin(conversationId.value, p.pinId);
      closePinActionModal();
    } catch (e) {
      toast.error?.("처리 실패", e?.response?.data?.message || "잠시 후 다시 시도해주세요.");
    } finally {
      pinActionLoading.value = false;
    }
  }

  const pinEditOpen = ref(false);
  const pinEditPin = ref(null);
  const pinEditTitle = ref("");
  const pinEditPlaceText = ref("");
  const pinEditStartAtLocal = ref("");
  const pinEditRemindMinutes = ref(60);
  const REMIND_OPTIONS = [
    { label: "5분 전", value: 5 },
    { label: "10분 전", value: 10 },
    { label: "30분 전", value: 30 },
    { label: "1시간 전", value: 60 },
  ];
  const pinEditLoading = ref(false);

  function guessRemindMinutesFromPin(pin) {
    try {
      const s = pin?.startAt ? Date.parse(pin.startAt) : NaN;
      const r = pin?.remindAt ? Date.parse(pin.remindAt) : NaN;
      const diff = Math.round((s - r) / 60000);
      if ([5, 10, 30, 60].includes(diff)) return diff;
    } catch {}
    return 60;
  }

  function toLocalInput(dt) {
    if (!dt) return "";
    const s = String(dt);
    if (s.includes("T")) return s.slice(0, 16);
    if (s.length >= 16) return s.slice(0, 10) + "T" + s.slice(11, 16);
    return "";
  }

  function fromLocalInput(v) {
    if (!v) return null;
    return v.length === 16 ? `${v}:00` : v;
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

  function sharePinToFeed(pin) {
    try {
      sessionStorage.setItem("reallife:feedShareDraft", JSON.stringify({
        content: feedShareTextForPin(pin),
        visibility: "ALL",
        source: "action-pin",
        pinId: pin?.pinId || null,
        sourceMeta: feedShareMetaForPin(pin),
      }));
      if (useDockSheet.value) dockOpen.value = false;
      toast.success?.("피드 공유 준비", "홈 작성창으로 바로 이동해요.");
      router.push({ path: "/home", query: { compose: "1" } });
    } catch {
      toast.error?.("공유 준비 실패", "잠시 후 다시 시도해 주세요.");
    }
  }

  function sharePinActivityToFeed(item) {
    const pin = item?.pin || item?.rawPin || item;
    if (!pin) {
      toast.error?.("공유 준비 실패", "공유할 액션 정보를 찾지 못했어요.");
      return;
    }
    sharePinToFeed(pin);
  }

  function openPinEdit(pin) {
    pinEditPin.value = pin;
    pinEditTitle.value = pin?.title || "";
    pinEditPlaceText.value = pin?.placeText || "";
    pinEditStartAtLocal.value = toLocalInput(pin?.startAt || "");
    pinEditRemindMinutes.value = guessRemindMinutesFromPin(pin);
    pinEditOpen.value = true;
    if (useDockSheet.value) dockOpen.value = false;
  }

  function closePinEdit() {
    if (pinEditLoading.value) return;
    pinEditOpen.value = false;
    pinEditPin.value = null;
    pinEditTitle.value = "";
    pinEditPlaceText.value = "";
    pinEditStartAtLocal.value = "";
    pinEditRemindMinutes.value = 60;
  }

  async function submitPinEdit() {
    const p = pinEditPin.value;
    if (!p?.pinId) return;

    pinEditLoading.value = true;
    try {
      await pinUpdate(p.pinId, {
        title: pinEditTitle.value.trim() ? pinEditTitle.value.trim() : null,
        placeText: pinEditPlaceText.value.trim() ? pinEditPlaceText.value.trim() : null,
        startAt: fromLocalInput(pinEditStartAtLocal.value),
        remindMinutes: pinEditRemindMinutes.value,
      });

      await loadPins();
      toast.success?.("저장 완료", "핀 정보를 업데이트했습니다.");
      closePinEdit();
    } catch (e) {
      toast.error?.("저장 실패", e?.response?.data?.message || "잠시 후 다시 시도해주세요.");
    } finally {
      pinEditLoading.value = false;
    }
  }

  return {
    pinModalOpen,
    pinModalAction,
    pinModalPin,
    pinActionLoading,
    pinModalTitle,
    pinModalSubtitle,
    pinModalConfirmText,
    pinModalConfirmVariant,
    pinEditOpen,
    pinEditTitle,
    pinEditPlaceText,
    pinEditStartAtLocal,
    pinEditRemindMinutes,
    pinEditLoading,
    REMIND_OPTIONS,
    pinTimeText,
    pinTimelineTimeText,
    openPinActionModal,
    closePinActionModal,
    confirmPinAction,
    sharePinToFeed,
    sharePinActivityToFeed,
    openPinEdit,
    closePinEdit,
    submitPinEdit,
  };
}
