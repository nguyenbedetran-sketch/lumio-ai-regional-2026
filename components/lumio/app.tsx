"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSession, signIn, signOut } from "next-auth/react";
import {
  Plus,
  Search,
  History,
  Folder,
  Library,
  Star,
  Settings,
  HelpCircle,
  ArrowUpRight,
  Upload,
  Link as LinkIcon,
  Clipboard,
  Mic,
  ArrowUp,
  Menu,
  X,
  Sparkles,
  FileText,
  Video,
  Headphones,
  Image as ImageIcon,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  LogIn,
  LogOut,
  Trash2,
  ArrowRight,
  Check,
  Download,
  Globe,
  FolderPlus,
  MoreHorizontal,
  Clock,
  Sun,
  Moon,
  LayoutDashboard,
  CalendarDays,
  BarChart3,
  Layers,
  Timer,
  Shield,
  Compass,
  Wallet,
  Smartphone,
  GraduationCap,
} from "lucide-react";
import { catalogs, languages, Locale, Messages } from "../../lib/lumio/i18n";
import {
  LibraryState,
  LearningItem,
  Space,
  ProviderStatus,
  createItem,
  uid,
} from "../../lib/lumio/types";
import {
  loadLibrarySnapshot,
  LibraryConflictError,
  saveLibrary,
  exportLibrary,
  importLibrary,
} from "../../lib/lumio/storage";
import { productCopy } from "../../lib/lumio/product-copy";
import { desktopCopy } from "../../lib/lumio/desktop-copy";
import { Dialog } from "./dialog";
import { AddContent, AddMode } from "./add-content";
import { LearningView } from "./learning-view";
import { BrandSymbol } from "./brand";
import { enhancements } from "../../lib/lumio/enhancements";
import { learningCopy } from "../../lib/lumio/learning-copy";
import { parseLearning, type StudyTask } from "../../lib/lumio/learning-engine";
import { useLearning } from "./use-learning";
import { Dashboard } from "./dashboard";
import { Planner } from "./planner";
import { Progress } from "./progress";
import { Review } from "./review";
import { FocusTimer } from "./focus-timer";
import { VoiceStudio } from "./voice-studio";
import { ExperienceHub } from "./experience-v2";
import { CommandMenu } from "./command-menu";
import { useMotionSettings } from "./use-motion-settings";
import { MotionPreference } from "./motion-preference";
import { useSurfaceEntrance } from "./use-surface-entrance";
import { AccountConnections } from "./account-connections";
import { Recommendations, personalCopy } from "./recommendations";
import { usePersonalization } from "./use-personalization";
import { parsePreferences } from "../../lib/lumio/recommendations";
import { BillingPanel } from "./billing";
import { billingCopy } from "../../lib/lumio/billing-copy";
import { publicDemoCopy } from "../../lib/lumio/public-demo-copy";
import { competitionCopy } from "../../lib/lumio/competition-copy";
import { stripSkillEvidence } from "../../lib/lumio/skill-evidence";
import { SyncPanel } from "./sync-panel";
import { RAGManager } from "./rag-manager";
import { normalizeSyncEnvelope, type SyncEnvelope } from "../../lib/sync/contracts";
import { learningKey } from "../../lib/lumio/learning-engine";
import { preferenceKey } from "../../lib/lumio/recommendations";
const libraryConflictCopy = {
  vi: {
    title: "Thư viện đã thay đổi ở tab khác",
    status: "Chưa lưu · có xung đột",
    hint: "Bản nháp trong tab này chưa được lưu để tránh ghi đè dữ liệu mới. Bạn có thể xuất bản nháp hoặc tải bản đã lưu; bản nháp sẽ được giữ riêng trong tab này.",
    export: "Xuất bản nháp",
    latest: "Tải bản đã lưu",
    retained:
      "Bản nháp trước vẫn được giữ trong tab này. Xuất bản nháp trước khi đóng trang nếu cần giữ lại; JSON không kèm tệp media/PDF gốc.",
    discard: "Bỏ bản nháp đã giữ",
    confirm:
      "Bỏ bản nháp đã giữ trong tab này? Bản đã lưu trong thư viện không thay đổi.",
    resolve: "Hãy xuất hoặc bỏ bản nháp trước đó rồi tải phiên bản mới.",
  },
  en: {
    title: "The library changed in another tab",
    status: "Unsaved · library conflict",
    hint: "This tab's draft has not been saved, to protect newer data. Export the draft or load the saved version; your draft will remain separately in this tab.",
    export: "Export draft",
    latest: "Load saved version",
    retained:
      "Your previous draft is kept in this tab. Export it before closing if needed; JSON does not include original media/PDF files.",
    discard: "Discard retained draft",
    confirm:
      "Discard this tab's retained draft? The saved library will not change.",
    resolve:
      "Export or discard the previous retained draft before loading another version.",
  },
  "zh-CN": {
    title: "其他标签页已更新资料库",
    status: "未保存 · 资料库冲突",
    hint: "为保护新数据，本页草稿尚未保存。可导出草稿或加载已保存版本；草稿会单独保留在本页。",
    export: "导出草稿",
    latest: "加载已保存版本",
    retained:
      "之前的草稿保留在本页。如需保留，请关闭前导出；JSON 不含原始媒体/PDF 文件。",
    discard: "丢弃保留的草稿",
    confirm: "丢弃本页保留的草稿？已保存的资料库不会改变。",
    resolve: "请先导出或丢弃之前的草稿，再加载新版本。",
  },
  ja: {
    title: "別のタブでライブラリが更新されました",
    status: "未保存 · ライブラリの競合",
    hint: "新しいデータを保護するため、このタブの下書きは未保存です。出力または保存版を読み込めます。下書きはこのタブに別途保持します。",
    export: "下書きを出力",
    latest: "保存版を読込",
    retained:
      "前の下書きはこのタブに保持されています。必要なら閉じる前に出力してください。JSONに元のメディア/PDFは含まれません。",
    discard: "保持した下書きを破棄",
    confirm:
      "このタブに保持した下書きを破棄しますか？保存済みライブラリは変わりません。",
    resolve:
      "前の下書きを出力または破棄してから、新しい版を読み込んでください。",
  },
  ko: {
    title: "다른 탭에서 라이브러리가 변경됐어요",
    status: "저장 안 됨 · 라이브러리 충돌",
    hint: "최신 데이터를 보호하려고 이 탭의 초안을 저장하지 않았어요. 초안을 내보내거나 저장본을 불러오세요. 초안은 이 탭에 별도로 남겨둬요.",
    export: "초안 내보내기",
    latest: "저장본 불러오기",
    retained:
      "이전 초안이 이 탭에 남아 있어요. 필요하면 닫기 전에 내보내세요. JSON에는 원본 미디어/PDF가 포함되지 않아요.",
    discard: "보관한 초안 버리기",
    confirm:
      "이 탭에 보관한 초안을 버릴까요? 저장된 라이브러리는 바뀌지 않아요.",
    resolve: "이전 초안을 내보내거나 버린 다음 새 버전을 불러오세요.",
  },
};
function readPreference(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}
type View =
  | "home"
  | "library"
  | "search"
  | "history"
  | "favorites"
  | "settings"
  | "space"
  | "planner"
  | "progress"
  | "review"
  | "focus"
  | "personal"
  | "billing"
  | "voice"
  | "experience";
const upgradeLabels: Record<
  Locale,
  { voice: string; experience: string; transcript: string }
> = {
  vi: {
    voice: "Phòng giọng nói",
    experience: "Lumio trên điện thoại",
    transcript: "Bản chép lời",
  },
  en: {
    voice: "Voice studio",
    experience: "Lumio on mobile",
    transcript: "Transcript",
  },
  "zh-CN": {
    voice: "语音工作室",
    experience: "移动端 Lumio",
    transcript: "转录",
  },
  ja: {
    voice: "音声スタジオ",
    experience: "モバイル Lumio",
    transcript: "文字起こし",
  },
  ko: {
    voice: "음성 스튜디오",
    experience: "모바일 Lumio",
    transcript: "대본",
  },
};
type Profile = { name: string; account: string };
const kindIcons = {
  text: FileText,
  pdf: FileText,
  image: ImageIcon,
  audio: Headphones,
  video: Video,
  link: LinkIcon,
};
export default function LumioApp() {
  const motion = useMotionSettings();
  const [locale, setLocale] = useState<Locale>("vi"),
    [profile, setProfile] = useState<Profile>({ name: "", account: "guest" }),
    [providers, setProviders] = useState<ProviderStatus | null>(null),
    [authError, setAuthError] = useState(false),
    [login, setLogin] = useState(false),
    [ready, setReady] = useState(false),
    [facebookLocalHost, setFacebookLocalHost] = useState(false),
    [theme, setTheme] = useState("light");
  const t = catalogs[locale];
  useEffect(() => {
    try {
      const lang = localStorage.getItem("lumio-language");
      if (lang && lang in languages) setLocale(lang as Locale);
      setProfile({
        name: localStorage.getItem("lumio-name") || "",
        account: "guest",
      });
      setTheme(localStorage.getItem("lumio-theme") || "light");
    } catch {}
    setReady(true);
    setFacebookLocalHost(
      process.env.NODE_ENV !== "production" &&
        location.hostname === "127.0.0.1",
    );
    if (new URLSearchParams(location.search).has("error")) {
      setLogin(true);
      setAuthError(true);
    }
    fetch("/api/config")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(async (config: ProviderStatus) => {
        setProviders(config);
        if (config.google || config.facebook) {
          const session = await getSession();
          const account = (session as unknown as { accountKey?: unknown })
            ?.accountKey;
          if (session?.user && typeof account === "string")
            setProfile({ name: session.user.name || "", account });
        }
      })
      .catch(() => setAuthError(true));
  }, []);
  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = locale;
    try {
      localStorage.setItem("lumio-language", locale);
    } catch {}
  }, [locale, ready]);
  useEffect(() => {
    if (!ready) return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      (document.documentElement.dataset.theme =
        theme === "dark" || (theme === "system" && mq.matches)
          ? "dark"
          : "light");
    apply();
    mq.addEventListener("change", apply);
    try {
      localStorage.setItem("lumio-theme", theme);
    } catch {}
    return () => mq.removeEventListener("change", apply);
  }, [theme, ready]);
  const updateName = (name: string) => {
    setProfile((p) => ({ ...p, name }));
    try {
      localStorage.setItem("lumio-name", name);
    } catch {}
  };
  return (
    <div className="lumio">
      {ready ? (
        <Workspace
          key={profile.account}
          t={t}
          locale={locale}
          setLocale={setLocale}
          profile={profile}
          setName={updateName}
          providers={providers}
          theme={theme}
          setTheme={setTheme}
          motion={motion}
          login={() => setLogin(true)}
        />
      ) : (
        <div className="lm-loading">
          <LumioLogo />
          <p>{t.loading}</p>
        </div>
      )}
      {login && (
        <Dialog title="Lumio AI" close={() => setLogin(false)} label={t.close}>
          <div className="lm-auth">
            <div className="lm-auth-art">
              <BrandSymbol />
              <span>LEARN · UNDERSTAND · GROW</span>
            </div>
            <h2>{productCopy[locale].authTitle}</h2>
            <p>
              {providers?.desktop
                ? desktopCopy[locale].detail
                : productCopy[locale].authDescription}
            </p>
            {providers?.desktop && (
              <a
                className="lm-button"
                href="http://localhost:3000/"
                target="_blank"
                rel="noreferrer"
              >
                {desktopCopy[locale].web}
              </a>
            )}
            {authError && (
              <p className="lm-error">
                {providers ? t.authError : t.authUnavailable}
              </p>
            )}
            {(["google", "facebook"] as const).map((provider) => (
              <button
                key={provider}
                className="lm-oauth"
                disabled={!providers?.[provider]}
                onClick={() => {
                  setAuthError(false);
                  if (provider === "facebook" && facebookLocalHost) {
                    window.location.assign(
                      `http://localhost:${window.location.port || "3000"}/?connections=1`,
                    );
                    return;
                  }
                  void signIn(provider, {
                    callbackUrl: window.location.origin,
                  });
                }}
              >
                <span
                  className={
                    provider === "google" ? "google-letter" : "facebook-letter"
                  }
                >
                  {provider === "google" ? "G" : "f"}
                </span>
                {t[provider]}
                {!providers?.[provider] && (
                  <small>
                    {providers?.desktop
                      ? desktopCopy[locale].unavailable
                      : productCopy[locale].soon}
                  </small>
                )}
              </button>
            ))}
            {facebookLocalHost && providers?.facebook && (
              <p className="lm-help">{learningCopy[locale].facebookHostNote}</p>
            )}
            <p className="lm-help">{productCopy[locale].accountHint}</p>
            <button className="lm-button plain" onClick={() => setLogin(false)}>
              {t.continueLocal}
              <ArrowRight size={16} />
            </button>
            <div className="lm-auth-privacy">
              <ShieldCheck size={15} />
              {t.localDetail}
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
function LumioLogo() {
  return (
    <span className="lm-logo">
      <BrandSymbol />
      Lumio<span className="lm-ai-label">AI</span>
    </span>
  );
}
function Workspace({
  t,
  locale,
  setLocale,
  profile,
  setName,
  providers,
  theme,
  setTheme,
  motion,
  login,
}: {
  t: Messages;
  locale: Locale;
  setLocale: (l: Locale) => void;
  profile: Profile;
  setName: (n: string) => void;
  providers: ProviderStatus | null;
  theme: string;
  setTheme: (v: string) => void;
  motion: ReturnType<typeof useMotionSettings>;
  login: () => void;
}) {
  const [data, setData] = useState<LibraryState | null>(null),
    [view, setView] = useState<View>("home"),
    [spaceId, setSpaceId] = useState(""),
    [selected, setSelected] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [sort, setSort] = useState("newest"),
    [mobile, setMobile] = useState(false),
    [add, setAdd] = useState<AddMode | null>(null),
    [spaceDialog, setSpaceDialog] = useState<Space | true | null>(null),
    [spaceName, setSpaceName] = useState(""),
    [spaceColor, setSpaceColor] = useState("blue"),
    [info, setInfo] = useState(""),
    [confirm, setConfirm] = useState<{
      message: string;
      label?: string;
      action: () => void;
    } | null>(null),
    [status, setStatus] = useState<"saved" | "saving" | "error">("saved"),
    [loadError, setLoadError] = useState(false),
    [libraryConflict, setLibraryConflict] = useState(false),
    [recoveringLibrary, setRecoveringLibrary] = useState(false),
    [recoveryDraft, setRecoveryDraft] = useState<LibraryState | null>(null),
    [toast, setToast] = useState(""),
    [idea, setIdea] = useState("");
  const learning = useLearning(profile.account);
  const contentRef = useRef<HTMLElement>(null);
  useSurfaceEntrance(
    contentRef,
    `${view}:${selected}:${Boolean(data && learning.ready)}`,
    motion.mode,
  );
  const personalization = usePersonalization(profile.account);
  const syncLocalSnapshot = useRef({
    account: profile.account,
    learning: learning.state,
    preferences: personalization.state,
  });
  syncLocalSnapshot.current = {
    account: profile.account,
    learning: learning.state,
    preferences: personalization.state,
  };
  const lc = learningCopy[locale],
    conflictCopy = libraryConflictCopy[locale];
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let active = true;
    if (profile.account !== "guest")
      fetch("/api/account", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((account) => {
          if (active) setIsAdmin(account?.isAdmin === true);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [profile.account]);
  function toggleTask(task: StudyTask) {
    const at = new Date().toISOString();
    learning.update((old) => ({
      ...old,
      tasks: old.tasks.map((t) =>
        t.id === task.id
          ? { ...t, done: !t.done, completedAt: t.done ? undefined : at }
          : t,
      ),
      events: task.done
        ? old.events.filter((e) => e.id !== `goal:${task.id}`)
        : [
            ...old.events.filter((e) => e.id !== `goal:${task.id}`),
            { id: `goal:${task.id}`, at, kind: "goal" as const },
          ].slice(-10000),
    }));
  }
  const saveQueue = useRef(Promise.resolve()),
    pending = useRef(false),
    loaded = useRef(false),
    mounted = useRef(false),
    revision = useRef(0),
    snapshotRevisions = useRef(new WeakMap<LibraryState, number>()),
    blocked = useRef(false),
    retainedDraft = useRef<LibraryState | null>(null),
    libraryChannel = useRef<BroadcastChannel | null>(null),
    editingLibrary = useRef(false),
    currentData = useRef<LibraryState | null>(null),
    importInput = useRef<HTMLInputElement>(null);
  // Source/card/add dialogs can contain child-local drafts not yet submitted to commit.
  editingLibrary.current = !!selected || !!add || !!spaceDialog || !!confirm;
  useEffect(() => {
    if (new URLSearchParams(location.search).get("connections") === "1")
      setView("settings");
    if (new URLSearchParams(location.search).get("billing") === "1")
      setView("billing");
    let live = true;
    mounted.current = true;
    loadLibrarySnapshot(profile.account)
      .then(({ data: d, revision: savedRevision }) => {
        if (live) {
          loaded.current = true;
          revision.current = savedRevision;
          snapshotRevisions.current.set(d, savedRevision);
          setData(d);
          currentData.current = d;
        }
      })
      .catch(() => {
        if (live) setLoadError(true);
      });
    const refresh = () => {
      if (
        !loaded.current ||
        pending.current ||
        blocked.current ||
        editingLibrary.current ||
        document.visibilityState === "hidden"
      )
        return;
      void loadLibrarySnapshot(profile.account)
        .then((snapshot) => {
          if (
            !live ||
            pending.current ||
            blocked.current ||
            editingLibrary.current ||
            snapshot.revision <= revision.current
          )
            return;
          revision.current = snapshot.revision;
          snapshotRevisions.current.set(snapshot.data, snapshot.revision);
          currentData.current = snapshot.data;
          setData(snapshot.data);
        })
        .catch(() => {});
    };
    try {
      const channel = new BroadcastChannel(
        `lumio-library:${encodeURIComponent(profile.account)}`,
      );
      libraryChannel.current = channel;
      channel.onmessage = refresh;
    } catch {}
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      live = false;
      mounted.current = false;
      libraryChannel.current?.close();
      libraryChannel.current = null;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [profile.account]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (pending.current || retainedDraft.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  const commit = useCallback(
    (next: LibraryState, base: LibraryState | null = data) => {
      if (!mounted.current || !loaded.current) return;
      // Bind this edit to its render's base. A stale async callback must never
      // inherit a newer revision merely because another tab refreshed meanwhile.
      const expectedRevision = base
        ? snapshotRevisions.current.get(base)
        : undefined;
      setData(next);
      currentData.current = next;
      pending.current = true;
      if (expectedRevision !== undefined)
        snapshotRevisions.current.set(next, expectedRevision + 1);
      if (blocked.current || expectedRevision === undefined) {
        blocked.current = true;
        setLibraryConflict(true);
        setStatus("error");
        return;
      }
      setStatus("saving");
      saveQueue.current = saveQueue.current
        .catch(() => {})
        .then(async () => {
          if (blocked.current) return;
          const savedRevision = await saveLibrary(
            profile.account,
            next,
            expectedRevision,
          );
          revision.current = savedRevision;
          try {
            libraryChannel.current?.postMessage({ revision: savedRevision });
          } catch {}
          if (!mounted.current) return;
          if (currentData.current === next) {
            setStatus("saved");
            pending.current = false;
          }
        })
        .catch((error: unknown) => {
          if (
            error instanceof LibraryConflictError ||
            (error instanceof Error && error.message === "LIBRARY_CONFLICT")
          ) {
            blocked.current = true;
            if (mounted.current) setLibraryConflict(true);
          }
          if (!mounted.current) return;
          setStatus("error");
          pending.current = true;
        });
    },
    [profile.account, data],
  );
  async function recoverLibrary() {
    if (retainedDraft.current) {
      setToast(conflictCopy.resolve);
      return;
    }
    setRecoveringLibrary(true);
    try {
      await saveQueue.current.catch(() => {});
      const saved = await loadLibrarySnapshot(profile.account);
      if (!mounted.current) return;
      retainedDraft.current = currentData.current;
      setRecoveryDraft(currentData.current);
      currentData.current = saved.data;
      revision.current = saved.revision;
      snapshotRevisions.current.set(saved.data, saved.revision);
      pending.current = false;
      blocked.current = false;
      setLibraryConflict(false);
      setData(saved.data);
      setStatus("saved");
    } catch {
      if (mounted.current) setStatus("error");
    } finally {
      if (mounted.current) setRecoveringLibrary(false);
    }
  }
  function go(next: View, id = "") {
    setSelected("");
    setView(next);
    setSpaceId(id);
    setMobile(false);
    if (next !== "search") setQuery("");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function open(item: LearningItem) {
    if (!data) return;
    setSelected(item.id);
    setMobile(false);
    commit({
      ...data,
      items: data.items.map((i) =>
        i.id === item.id ? { ...i, lastOpenedAt: new Date().toISOString() } : i,
      ),
    });
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function update(item: LearningItem) {
    if (!data) return;
    commit({
      ...data,
      items: data.items.map((i) =>
        i.id === item.id ? { ...item, updatedAt: new Date().toISOString() } : i,
      ),
    });
  }
  function addItems(items: LearningItem[]) {
    if (!data) return;
    commit({ ...data, items: [...items, ...data.items] });
    setAdd(null);
    if (items.length === 1) setSelected(items[0].id);
  }
  function sample() {
    addItems([
      createItem({
        title: t.sampleTitle,
        kind: "text",
        text: t.sampleText,
        spaceId: spaceId || "",
        cards: [{ id: uid(), front: t.sampleFront, back: t.sampleBack }],
        questions: [
          {
            id: uid(),
            prompt: t.sampleQuestion,
            options: t.sampleOptions,
            correct: 0,
            explanation: t.sampleExplanation,
          },
        ],
      }),
    ]);
  }
  function removeItem(item: LearningItem) {
    setConfirm({
      message: `${t.confirmDelete}\n${item.title}\n${t.deleteHint}`,
      label: t.delete,
      action: () => {
        const d = currentData.current;
        if (d)
          commit({ ...d, items: d.items.filter((i) => i.id !== item.id) }, d);
        setSelected("");
      },
    });
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error();
      const raw = await file.text();
      const parsed = importLibrary(raw);
      const backupData = JSON.parse(raw);
      const restoredLearning = backupData.learning
        ? parseLearning(backupData.learning)
        : null;
      const restoredPreferences = backupData.personalization
        ? parsePreferences(backupData.personalization)
        : null;
      setConfirm({
        message: t.importConfirm,
        action: () => {
          commit(parsed, currentData.current);
          if (restoredLearning) learning.update(restoredLearning, true);
          if (restoredPreferences)
            personalization.update(restoredPreferences, true);
          go("library");
        },
      });
    } catch {
      setToast(t.invalidBackup);
    } finally {
      if (importInput.current) importInput.current.value = "";
    }
  }
  function backup(draft?: LibraryState) {
    const source = draft || currentData.current;
    if (!source) return;
    const u = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify({
            ...JSON.parse(exportLibrary(source)),
            ...(learning.error === "read" ? {} : { learning: learning.state }),
            ...(!personalization.error
              ? { personalization: personalization.state }
              : {}),
          }),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = u;
    a.download = `lumio-${draft ? "draft" : "backup"}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(u);
    setToast(t.exportDone);
  }
  if (loadError)
    return (
      <div className="lm-loading">
        <LumioLogo />
        <p role="alert">{t.loadError}</p>
        <button className="lm-button" onClick={() => location.reload()}>
          {t.retry}
        </button>
      </div>
    );
  if (!data || !learning.ready)
    return (
      <div className="lm-loading">
        <LumioLogo />
        <p>{t.loading}</p>
      </div>
    );
  const item = data.items.find((i) => i.id === selected),
    space = data.spaces.find((s) => s.id === spaceId),
    name = profile.name || t.guestName;
  const resumeItem = data.items
    .filter((i) => i.lastOpenedAt)
    .sort((a, b) =>
      (b.lastOpenedAt || "").localeCompare(a.lastOpenedAt || ""),
    )[0];
  const navigation = [
    ["home", LayoutDashboard, lc.dashboard],
    ["planner", CalendarDays, lc.planner],
    ["review", Layers, lc.review],
    ["progress", BarChart3, lc.progress],
    ["focus", Timer, lc.focus],
    ["voice", Headphones, upgradeLabels[locale].voice],
    ["personal", Compass, personalCopy[locale].nav],
    ["search", Search, t.search],
    ["history", History, t.history],
    ["library", Library, t.library],
    ["favorites", Star, t.favorites],
    ["billing", Wallet, billingCopy[locale].nav],
    ["experience", Smartphone, upgradeLabels[locale].experience],
  ] as const;
  const actions = [
    ["upload", Upload, t.upload, t.uploadSub],
    ["link", LinkIcon, t.link, t.linkSub],
    ["paste", Clipboard, t.paste, t.pasteSub],
    ["record", Mic, t.record, t.recordSub],
  ] as const;
  let displayed = data.items.filter(
    (i) =>
      (view !== "space" || i.spaceId === spaceId) &&
      (view !== "favorites" || i.favorite) &&
      (view !== "history" || !!i.lastOpenedAt) &&
      (filter === "all" || i.kind === filter) &&
      (!query ||
        `${i.title} ${i.text} ${i.notes}`
          .toLocaleLowerCase(locale)
          .includes(query.toLocaleLowerCase(locale))),
  );
  displayed = [...displayed].sort((a, b) =>
    sort === "name"
      ? a.title.localeCompare(b.title, locale)
      : sort === "oldest"
        ? a.createdAt.localeCompare(b.createdAt)
        : (view === "history"
            ? b.lastOpenedAt || b.createdAt
            : b.createdAt
          ).localeCompare(
            view === "history" ? a.lastOpenedAt || a.createdAt : a.createdAt,
          ),
  );
  return (
    <>
      <aside
        className={`lm-sidebar ${mobile ? "open" : ""}`}
        aria-label="Lumio"
      >
        <button className="lm-brand-button" onClick={() => go("home")}>
          <LumioLogo />
        </button>
        <button className="lx-sidebar-add" onClick={() => setAdd("upload")}>
          <Plus size={18} />
          {t.add}
          <span>＋</span>
        </button>
        <div className="lx-sidebar-scroll">
          <nav className="lm-nav">
            {navigation.map(([id, Icon, label]) => (
              <button
                key={id}
                title={
                  id === "search" ? enhancements[locale].shortcut : undefined
                }
                className={view === id && !selected ? "active" : ""}
                onClick={() => go(id)}
              >
                <Icon size={18} />
                {label}
                {id === "search" && <kbd>⌕</kbd>}
              </button>
            ))}
          </nav>
          <div className="lm-sidebar-section">
            <div className="lm-sidebar-label">
              {t.spaces}
              <button
                aria-label={t.newSpace}
                className="lm-icon"
                onClick={() => {
                  setSpaceDialog(true);
                  setSpaceName("");
                  setSpaceColor("blue");
                }}
              >
                <Plus size={15} />
              </button>
            </div>
            <button
              className="lm-nav-single"
              onClick={() => {
                setSpaceDialog(true);
                setSpaceName("");
                setSpaceColor("blue");
              }}
            >
              <Plus size={16} />
              {t.newSpace}
            </button>
            {data.spaces.map((s) => (
              <button
                className={`lm-nav-single ${spaceId === s.id && view === "space" ? "active" : ""}`}
                key={s.id}
                onClick={() => go("space", s.id)}
              >
                <span className={`lm-space-dot ${s.color}`} />
                <span>{s.name}</span>
                <small>
                  {data.items.filter((i) => i.spaceId === s.id).length}
                </small>
              </button>
            ))}
          </div>
          {data.items.length > 0 && (
            <div className="lm-sidebar-section">
              <div className="lm-sidebar-label">{t.recent}</div>
              {data.items.slice(0, 4).map((i) => {
                const Icon = kindIcons[i.kind];
                return (
                  <button
                    className={`lm-nav-single ${selected === i.id ? "active" : ""}`}
                    key={i.id}
                    onClick={() => open(i)}
                  >
                    <Icon size={15} />
                    <span>{i.title}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="lm-sidebar-bottom">
          {isAdmin && (
            <a className="lm-nav-single lx-admin-link" href="/admin">
              <Shield size={17} />
              {lc.admin}
              <ArrowUpRight size={14} />
            </a>
          )}
          <a className="lm-nav-single" href="/teacher">
            <GraduationCap size={17} />
            {locale === "vi" ? "Dành cho giáo viên" : "For teachers"}
            <ArrowUpRight size={14} />
          </a>
          <div className="lm-local-card">
            <ShieldCheck size={18} />
            <div>
              <strong>{t.localMode}</strong>
              <p>{t.local}</p>
            </div>
          </div>
          <button
            className="lm-nav-single"
            onClick={() => setInfo(t.guideText)}
          >
            <HelpCircle size={17} />
            {t.help}
          </button>
          <button
            className={`lm-nav-single ${view === "settings" ? "active" : ""}`}
            onClick={() => go("settings")}
          >
            <Settings size={17} />
            {t.settings}
          </button>
          <button
            className="lm-profile"
            onClick={profile.account === "guest" ? login : () => go("settings")}
          >
            <span className="lm-avatar">{name.slice(0, 1).toUpperCase()}</span>
            <span>
              <strong>{name}</strong>
              <small>
                {profile.account === "guest" ? t.guest : lc.account}
              </small>
            </span>
            <ChevronDown size={16} />
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          className="lm-mobile-backdrop"
          aria-label={t.close}
          onClick={() => setMobile(false)}
        />
      )}
      <div className="lm-main">
        <header className="lm-topbar">
          <div className="lm-row">
            <button
              className="lm-icon lm-menu"
              aria-label={mobile ? t.close : t.library}
              onClick={() => setMobile(!mobile)}
            >
              {mobile ? <X /> : <Menu />}
            </button>
            <span className="lm-breadcrumb">
              {item
                ? item.title
                : view === "space"
                  ? space?.name
                  : view === "home"
                    ? lc.dashboard
                    : view === "planner" ||
                        view === "progress" ||
                        view === "review" ||
                        view === "focus"
                      ? lc[view]
                      : view === "personal"
                        ? personalCopy[locale].nav
                        : view === "billing"
                          ? billingCopy[locale].nav
                          : view === "voice" || view === "experience"
                            ? upgradeLabels[locale][view]
                            : t[view]}
            </span>
          </div>
          <div className="lm-row">
            <CommandMenu
              key={profile.account}
              locale={locale}
              items={data.items}
              spaces={data.spaces}
              navigation={[
                ...navigation.map(([id, , label]) => ({ id, label })),
                { id: "settings", label: t.settings },
              ]}
              onNavigate={go}
              onOpenItem={open}
              disabled={!!(add || spaceDialog || info || confirm)}
            />
            <span className={`lm-save-state ${status}`} role="status">
              {!libraryConflict && status === "saved" ? (
                <Check size={13} />
              ) : null}
              {libraryConflict
                ? conflictCopy.status
                : status === "saved"
                  ? t.local
                  : status === "saving"
                    ? t.saving
                    : t.saveError}
            </span>
            <label className="lm-language">
              <Globe size={16} />
              <select
                aria-label={t.uiLanguage}
                value={locale}
                onChange={(e) => setLocale(e.target.value as Locale)}
              >
                {Object.entries(languages).map(([code, label]) => (
                  <option value={code} key={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {profile.account === "guest" && (
              <button className="lm-button lm-login-button" onClick={login}>
                <LogIn size={15} />
                {t.signIn}
              </button>
            )}
          </div>
        </header>
        {providers?.competitionPreview && (
          <section className="lm-competition-banner" aria-label={competitionCopy[locale].title} data-competition-preview>
            <ShieldCheck size={20} aria-hidden="true" />
            <div><strong>{competitionCopy[locale].title}</strong><p>{competitionCopy[locale].detail}</p></div>
          </section>
        )}
        {providers?.publicDemo && (
          <section
            className="lm-public-demo-banner"
            aria-labelledby="lm-public-demo-title"
          >
            <Globe size={22} aria-hidden="true" />
            <div>
              <strong id="lm-public-demo-title">
                {publicDemoCopy[locale].title}
              </strong>
              <p>{publicDemoCopy[locale].description}</p>
            </div>
          </section>
        )}
        <main
          ref={contentRef}
          key={item?.id || view}
          className={item ? "lm-content document" : "lm-content"}
        >
          {libraryConflict && (
            <section className="lm-panel" role="alert">
              <h2>{conflictCopy.title}</h2>
              <p className="lm-help">{conflictCopy.hint}</p>
              <div className="lm-row">
                <button
                  className="lm-button"
                  onClick={() => backup(currentData.current || undefined)}
                >
                  <Download size={16} />
                  {conflictCopy.export}
                </button>
                <button
                  className="lm-button"
                  disabled={recoveringLibrary || !!recoveryDraft}
                  onClick={() => void recoverLibrary()}
                >
                  {recoveringLibrary ? t.loading : conflictCopy.latest}
                </button>
              </div>
              {recoveryDraft && (
                <p className="lm-help">{conflictCopy.resolve}</p>
              )}
            </section>
          )}
          {recoveryDraft && (
            <section className="lm-panel" role="status">
              <p className="lm-help">{conflictCopy.retained}</p>
              <div className="lm-row">
                <button
                  className="lm-button"
                  onClick={() => backup(recoveryDraft)}
                >
                  <Download size={16} />
                  {conflictCopy.export}
                </button>
                <button
                  className="lm-button"
                  onClick={() =>
                    setConfirm({
                      message: conflictCopy.confirm,
                      label: conflictCopy.discard,
                      action: () => {
                        retainedDraft.current = null;
                        setRecoveryDraft(null);
                      },
                    })
                  }
                >
                  {conflictCopy.discard}
                </button>
              </div>
            </section>
          )}
          {learning.error && (
            <p className="lm-error" role="alert">
              {learning.error === "read" ? lc.loadingError : lc.storageError}
            </p>
          )}
          {item ? (
            <LearningView
              key={item.id}
              item={item}
              t={t}
              locale={locale}
              spaces={data.spaces}
              update={update}
              close={() => go("library")}
              onDelete={() => removeItem(item)}
              onAI={() => setInfo(t.aiHint)}
              onActivity={learning.recordActivity}
            />
          ) : view === "voice" ? (
            <VoiceStudio
              key={profile.account}
              locale={locale}
              providers={providers || undefined}
              signedIn={profile.account !== "guest"}
              onLogin={login}
              onSaveRecording={(recording) =>
                addItems([
                  createItem({
                    title: recording.filename,
                    kind: "audio",
                    blob: recording.blob,
                    fileName: recording.filename,
                  }),
                ])
              }
              onSaveTranscript={(text) =>
                addItems([
                  createItem({
                    title: upgradeLabels[locale].transcript,
                    kind: "text",
                    text,
                  }),
                ])
              }
            />
          ) : view === "experience" ? (
            <ExperienceHub
              locale={locale}
              publicDemo={providers?.publicDemo}
              pairingAvailable={!providers?.publicDemo}
            />
          ) : view === "personal" ? (
            <Recommendations
              locale={locale}
              items={data.items}
              learning={learning.state}
              preferences={personalization.state}
              update={personalization.update}
              open={open}
              storageError={personalization.error}
              onClearSkillEvidence={() => commit({...data,items:stripSkillEvidence(data.items)},data)}
            />
          ) : view === "billing" ? (
            <BillingPanel
              locale={locale}
              signedIn={profile.account !== "guest"}
              login={login}
              isAdmin={isAdmin}
            />
          ) : view === "planner" ? (
            <Planner
              locale={locale}
              items={data.items}
              state={learning.state}
              update={learning.update}
              toggleTask={toggleTask}
              open={open}
            />
          ) : view === "progress" ? (
            <Progress
              locale={locale}
              items={data.items}
              state={learning.state}
              open={open}
            />
          ) : view === "review" ? (
            <Review
              locale={locale}
              items={data.items}
              state={learning.state}
              update={learning.update}
              open={open}
              library={() => go("library")}
            />
          ) : view === "focus" ? (
            <FocusTimer
              locale={locale}
              state={learning.state}
              update={learning.update}
              alarm={learning.alarm}
            />
          ) : view === "settings" ? (
            <>
              <div className="lm-page-heading">
                <span className="lm-overline">LUMIO AI</span>
                <h1>{t.settings}</h1>
                <p>{t.localDetail}</p>
              </div>
              <div className="lm-settings-grid">
                <section className="lm-panel">
                  <h3>{t.settings}</h3>
                  <label className="lm-field">
                    {t.displayName}
                    <input
                      value={profile.name}
                      maxLength={60}
                      placeholder={t.guestName}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <label className="lm-field">
                    {t.uiLanguage}
                    <select
                      value={locale}
                      onChange={(e) => setLocale(e.target.value as Locale)}
                    >
                      {Object.entries(languages).map(([l, label]) => (
                        <option value={l} key={l}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="lm-field">
                    {t.aiLanguage}
                    <select
                      defaultValue={readPreference("lumio-ai-language", locale)}
                      onChange={(e) => {
                        try {
                          localStorage.setItem(
                            "lumio-ai-language",
                            e.target.value,
                          );
                        } catch {}
                      }}
                    >
                      {Object.entries(languages).map(([l, label]) => (
                        <option value={l} key={l}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="lm-field">
                    {t.theme}
                    <select
                      value={theme}
                      onChange={(e) => setTheme(e.target.value)}
                    >
                      <option value="light">{t.light}</option>
                      <option value="dark">{t.dark}</option>
                      <option value="system">{t.system}</option>
                    </select>
                  </label>
                  <MotionPreference locale={locale} {...motion} />
                  {profile.account !== "guest" && (
                    <button
                      className="lm-button"
                      onClick={() =>
                        void signOut({ callbackUrl: window.location.origin })
                      }
                    >
                      <LogOut size={16} />
                      {t.signOut}
                    </button>
                  )}
                </section>
                <div>
                  <AccountConnections locale={locale} />
                  <SyncPanel
                    key={`sync:${profile.account}`}
                    account={profile.account}
                    locale={locale}
                    disabled={libraryConflict || status !== "saved" || !learning.ready || !!learning.error || personalization.error}
                    value={{version:1,library:data,learning:learning.state,preferences:personalization.state}}
                    onApply={async (incoming: SyncEnvelope) => {
                      if (currentData.current !== data || blocked.current || pending.current)
                        throw Error("SYNC_LOCAL_CHANGED");
                      const observedLearning = JSON.stringify(learning.state),
                        observedPreferences = JSON.stringify(personalization.state),
                        savedLearningBefore = localStorage.getItem(learningKey(profile.account)),
                        savedPreferencesBefore = localStorage.getItem(preferenceKey(profile.account));
                      if (
                        (savedLearningBefore !== null && JSON.stringify(parseLearning(JSON.parse(savedLearningBefore))) !== observedLearning) ||
                        (savedPreferencesBefore !== null && JSON.stringify(parsePreferences(JSON.parse(savedPreferencesBefore))) !== observedPreferences)
                      ) throw Error("SYNC_LOCAL_CHANGED");
                      const sourceKey = (item: LearningItem) => JSON.stringify([
                        item.kind, item.text, item.url, item.fileName, item.sourceEvidence,
                      ]);
                      const framedItems = data.items.filter(item => item.artifacts?.some(artifact => artifact.frames?.length));
                      // Compare the same normalized, media-free artifact contract that
                      // is sent to sync; a restored page claim is not a new frame source.
                      const comparableFramed = framedItems.length ? normalizeSyncEnvelope({
                        ...incoming,
                        library: { ...data, items: framedItems },
                      }).library.items : [];
                      const sansFrames = (artifact: NonNullable<LearningItem["artifacts"]>[number]) => {
                        const { frames, ...content } = artifact;
                        return content;
                      };
                      // Sync never destroys a device-only attachment or attaches it to a changed source.
                      for (const item of data.items.filter(i => i.blob || i.artifacts?.some(artifact => artifact.frames?.length))) {
                        const next = incoming.library.items.find(i => i.id === item.id);
                        if (!next || data.items.filter(i => i.id === item.id).length !== 1 || incoming.library.items.filter(i => i.id === item.id).length !== 1 || sourceKey(next) !== sourceKey(item))
                          throw Error("SYNC_LOCAL_ATTACHMENTS_CONFLICT");
                        for (const artifact of item.artifacts || []) {
                          if (!artifact.frames?.length) continue;
                          const matches = next.artifacts?.filter(a => a.id === artifact.id) || [];
                          const oldMatches = item.artifacts?.filter(a => a.id === artifact.id) || [];
                          const expected = comparableFramed.find(i => i.id === item.id)?.artifacts?.find(a => a.id === artifact.id);
                          if (matches.length !== 1 || oldMatches.length !== 1 || !expected || JSON.stringify(sansFrames(matches[0])) !== JSON.stringify(sansFrames(expected)))
                            throw Error("SYNC_LOCAL_ATTACHMENTS_CONFLICT");
                        }
                      }
                      const nextLibrary = {
                        ...incoming.library,
                        items: incoming.library.items.map(item => ({
                          ...item,
                          blob: data.items.find(i => i.id === item.id)?.blob,
                          ...(item.artifacts ? {
                            artifacts: item.artifacts.map(artifact => {
                              const old = data.items.find(i => i.id === item.id)?.artifacts?.find(a => a.id === artifact.id);
                              return { ...sansFrames(artifact), ...(old?.frames?.length ? { frames: old.frames } : {}) };
                            }),
                          } : {}),
                        })),
                      };
                      commit(nextLibrary, data);
                      await saveQueue.current;
                      if (blocked.current || pending.current || currentData.current !== nextLibrary)
                        throw Error("SYNC_LOCAL_SAVE_FAILED");
                      // Library persistence yields to focus completion and other-tab edits.
                      // Recompare both the latest render and storage before restoring either.
                      const latestLocal = syncLocalSnapshot.current;
                      if (
                        latestLocal.account !== profile.account ||
                        JSON.stringify(latestLocal.learning) !== observedLearning ||
                        JSON.stringify(latestLocal.preferences) !== observedPreferences ||
                        localStorage.getItem(learningKey(profile.account)) !== savedLearningBefore ||
                        localStorage.getItem(preferenceKey(profile.account)) !== savedPreferencesBefore
                      ) throw Error("SYNC_LOCAL_CHANGED");
                      const nextLearning = {
                        ...incoming.learning,
                        focus: latestLocal.learning.focus,
                        alarm: latestLocal.learning.alarm,
                        lastAlarmId: latestLocal.learning.lastAlarmId,
                      };
                      learning.update(nextLearning, true);
                      try {
                        if (
                          JSON.stringify(parseLearning(JSON.parse(localStorage.getItem(learningKey(profile.account)) || "null"))) !==
                          JSON.stringify(parseLearning(nextLearning))
                        ) throw Error("SYNC_LOCAL_SAVE_FAILED");
                      } catch { throw Error("SYNC_LOCAL_SAVE_FAILED"); }
                      personalization.update(incoming.preferences, true);
                      try {
                        const saved = normalizeSyncEnvelope({
                          version: 1,
                          library: nextLibrary,
                          learning: JSON.parse(localStorage.getItem(learningKey(profile.account)) || "null"),
                          preferences: JSON.parse(localStorage.getItem(preferenceKey(profile.account)) || "null"),
                        });
                        if (JSON.stringify(saved) !== JSON.stringify(normalizeSyncEnvelope(incoming)))
                          throw Error("SYNC_LOCAL_SAVE_FAILED");
                      } catch { throw Error("SYNC_LOCAL_SAVE_FAILED"); }
                    }}
                  />
                  <RAGManager key={`rag:${profile.account}:${spaceId}`} items={data.items} spaces={data.spaces} workspaceId={spaceId||"main"} locale={locale}/>
                  <section className="lm-panel">
                    <h3>{t.featureStatus}</h3>
                    {(
                      [
                        [lc.tutor, providers?.capabilities?.tutor],
                        [lc.multimodal, providers?.capabilities?.media],
                        [
                          lc.speech,
                          providers?.capabilities?.speech ||
                            providers?.capabilities?.transcription,
                        ],
                      ] as const
                    ).map(([label, available]) => (
                      <div className="lm-service" key={label}>
                        <strong>{label}</strong>
                        <span className={available ? "ready" : ""}>
                          {available
                            ? productCopy[locale].available
                            : lc.notAvailable}
                        </span>
                      </div>
                    ))}
                  </section>
                  <section className="lm-panel">
                    <h3>{t.storage}</h3>
                    <p className="lm-help">
                      {t.backupHint} {lc.learningBackup}
                    </p>
                    <div className="lm-row">
                      <button className="lm-button" onClick={() => backup()}>
                        <Download size={16} />
                        {t.export}
                      </button>
                      <button
                        className="lm-button"
                        onClick={() => importInput.current?.click()}
                      >
                        <Upload size={16} />
                        {t.import}
                      </button>
                    </div>
                    <input
                      hidden
                      ref={importInput}
                      type="file"
                      accept=".json"
                      onChange={(e) => void importFile(e.target.files?.[0])}
                    />
                  </section>
                  <section className="lm-panel">
                    <h3>{t.privacy}</h3>
                    <p className="lm-help">{t.privacyText}</p>
                  </section>
                </div>
              </div>
            </>
          ) : (
            <>
              {view === "home" ? (
                <>
                  <Dashboard
                    locale={locale}
                    name={profile.name}
                    items={data.items}
                    state={learning.state}
                    navigate={go}
                    toggleTask={toggleTask}
                    open={open}
                  />
                  <section className="lm-welcome lx-materials">
                    <div className="lx-section-title">
                      <div>
                        <span className="lx-kicker">LUMIO / STUDIO</span>
                        <h2>{lc.addMaterial}</h2>
                        <p>{lc.addMaterialHint}</p>
                      </div>
                      <Sparkles size={24} />
                    </div>
                    <div className="lm-action-grid">
                      {actions.map(([id, Icon, title, sub]) => (
                        <button key={id} onClick={() => setAdd(id)}>
                          <span className={`lm-action-icon ${id}`}>
                            <Icon size={23} />
                          </span>
                          <strong>{title}</strong>
                          <small>{sub}</small>
                          <ArrowUpRight className="lm-action-arrow" size={16} />
                        </button>
                      ))}
                    </div>
                    <form
                      className="lm-idea"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (idea.trim()) {
                          addItems([
                            createItem({
                              title: idea.trim().slice(0, 160),
                              kind: "text",
                              text: idea.trim(),
                              spaceId: "",
                            }),
                          ]);
                          setIdea("");
                        }
                      }}
                    >
                      <Sparkles size={18} />
                      <input
                        aria-label={t.learn}
                        placeholder={t.learn}
                        value={idea}
                        maxLength={500}
                        onChange={(e) => setIdea(e.target.value)}
                      />
                      <button aria-label={t.create} disabled={!idea.trim()}>
                        <ArrowUp size={19} />
                      </button>
                    </form>
                  </section>
                  <section className="lm-spaces-section">
                    {resumeItem && (
                      <button
                        className="lm-resume"
                        onClick={() => open(resumeItem)}
                      >
                        <span>
                          <FileText size={21} />
                        </span>
                        <span className="lm-resume-copy">
                          <small>{productCopy[locale].continue}</small>
                          <strong>{resumeItem.title}</strong>
                        </span>
                        <span className="lm-resume-cta">
                          {productCopy[locale].open}
                          <ArrowRight size={17} />
                        </span>
                      </button>
                    )}
                    <div className="lm-section-head">
                      <h2>{t.spaces}</h2>
                      <span>
                        {data.spaces.length}{" "}
                        {t.spaces.toLocaleLowerCase(locale)}
                      </span>
                    </div>
                    <div className="lm-spaces-grid">
                      <button
                        className="lm-new-space"
                        onClick={() => {
                          setSpaceDialog(true);
                          setSpaceName("");
                          setSpaceColor("blue");
                        }}
                      >
                        <span>
                          <Plus size={23} />
                        </span>
                        {t.newSpace}
                      </button>
                      {data.spaces.slice(0, 5).map((s) => (
                        <button
                          className={`lm-space-card ${s.color}`}
                          key={s.id}
                          onClick={() => go("space", s.id)}
                        >
                          <span className="lm-space-visual">
                            <Folder size={30} />
                            <span className="lm-space-mini">
                              <FileText size={16} />
                            </span>
                          </span>
                          <div>
                            <strong>{s.name}</strong>
                            <small>
                              {
                                data.items.filter((i) => i.spaceId === s.id)
                                  .length
                              }{" "}
                              {t.items}
                            </small>
                            <ArrowUpRight size={17} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                </>
              ) : (
                <div className="lm-page-heading">
                  <span className="lm-overline">LUMIO AI</span>
                  <div className="lm-row lm-between">
                    <h1>{view === "space" ? space?.name : t[view]}</h1>
                    {view === "space" ? (
                      <div className="lm-row">
                        <button
                          className="lm-button"
                          onClick={() => {
                            if (space) {
                              setSpaceName(space.name);
                              setSpaceColor(space.color);
                              setSpaceDialog(space);
                            }
                          }}
                        >
                          {t.rename}
                        </button>
                        <button
                          className="lm-icon danger"
                          aria-label={t.delete}
                          onClick={() =>
                            setConfirm({
                              message: t.spaceDeleteHint,
                              label: t.delete,
                              action: () => {
                                const d = currentData.current;
                                if (d)
                                  commit({
                                    ...d,
                                    spaces: d.spaces.filter(
                                      (s) => s.id !== spaceId,
                                    ),
                                    items: d.items.map((i) =>
                                      i.spaceId === spaceId
                                        ? { ...i, spaceId: "" }
                                        : i,
                                    ),
                                  });
                                go("home");
                              },
                            })
                          }
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ) : (
                      <button
                        className="lm-button primary"
                        onClick={() => setAdd("upload")}
                      >
                        <Plus size={17} />
                        {t.add}
                      </button>
                    )}
                  </div>
                  <p>{t.localDetail}</p>
                </div>
              )}
              {view === "search" && (
                <div className="lm-search-box">
                  <Search size={20} />
                  <input
                    autoFocus
                    aria-label={t.search}
                    placeholder={t.searchPlaceholder}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button
                      className="lm-icon"
                      aria-label={t.clearSearch}
                      onClick={() => setQuery("")}
                    >
                      <X size={17} />
                    </button>
                  )}
                </div>
              )}
              <section className="lm-library-section">
                <div className="lm-section-head">
                  <h2>
                    {view === "home"
                      ? t.recent
                      : view === "history"
                        ? t.history
                        : t.content}
                  </h2>
                  <div className="lm-row">
                    <select
                      aria-label={t.sourceType}
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="all">{t.all}</option>
                      {Object.keys(kindIcons).map((k) => (
                        <option value={k} key={k}>
                          {k === "text" ? t.sourceText : k.toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label={t.newest}
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="newest">{t.newest}</option>
                      <option value="oldest">{t.oldest}</option>
                      <option value="name">{t.name}</option>
                    </select>
                    {view === "home" && (
                      <button
                        className="lm-text-button"
                        onClick={() => go("library")}
                      >
                        {t.viewAll}
                        <ArrowRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
                {displayed.length ? (
                  <div className="lm-content-grid">
                    {(view === "home" ? displayed.slice(0, 6) : displayed).map(
                      (i) => (
                        <ContentCard
                          key={i.id}
                          item={i}
                          t={t}
                          locale={locale}
                          open={() => open(i)}
                          favorite={() =>
                            update({ ...i, favorite: !i.favorite })
                          }
                        />
                      ),
                    )}
                  </div>
                ) : (
                  <div className="lm-empty">
                    <div className="lm-empty-illustration">
                      <FileText size={37} />
                      <span>
                        <Sparkles size={15} />
                      </span>
                    </div>
                    <h3>{data.items.length ? t.noResults : t.emptyTitle}</h3>
                    <p>
                      {view === "space"
                        ? t.spaceEmpty
                        : data.items.length
                          ? t.searchPlaceholder
                          : t.emptyText}
                    </p>
                    <div className="lm-row lm-center">
                      <button
                        className="lm-button primary"
                        onClick={() => setAdd("paste")}
                      >
                        <Plus size={16} />
                        {t.add}
                      </button>
                      {!data.items.length && (
                        <button className="lm-button" onClick={sample}>
                          {t.sample}
                          <ArrowUpRight size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </section>
              {view === "history" && (
                <section className="lm-activity">
                  <h2>{t.progress}</h2>
                  <div className="lm-stats">
                    {[
                      [t.totalContent, data.items.length],
                      [
                        t.totalNotes,
                        data.items.filter((i) => i.notes.trim()).length,
                      ],
                      [
                        t.totalAttempts,
                        data.items.reduce(
                          (sum, i) => sum + i.attempts.length,
                          0,
                        ),
                      ],
                    ].map(([label, val]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <strong>{val}</strong>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </main>
        <footer className="lm-footer">
          <LumioLogo />
          <span>{t.localDetail}</span>
          <nav className="lx-policy-links" aria-label={t.privacy}>
            <a href="/privacy">{t.privacy}</a>
            <a href="/terms">{lc.terms}</a>
            <a href="/data-deletion">{lc.deleteData}</a>
          </nav>
          <span>v3.0 · {lc.localNote}</span>
        </footer>
      </div>
      {add && (
        <Dialog title={t[add]} close={() => setAdd(null)} label={t.close}>
          <AddContent
            mode={add}
            t={t}
            spaces={data.spaces}
            spaceId={view === "space" ? spaceId : ""}
            onSave={addItems}
          />
        </Dialog>
      )}
      {spaceDialog && (
        <Dialog
          title={spaceDialog === true ? t.newSpace : t.rename}
          close={() => setSpaceDialog(null)}
          label={t.close}
        >
          <p className="lm-help">{t.createSpaceHint}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!spaceName.trim()) return;
              commit({
                ...data,
                spaces:
                  spaceDialog === true
                    ? [
                        ...data.spaces,
                        {
                          id: uid(),
                          name: spaceName.trim(),
                          color: spaceColor,
                        },
                      ]
                    : data.spaces.map((s) =>
                        s.id === spaceDialog.id
                          ? { ...s, name: spaceName.trim(), color: spaceColor }
                          : s,
                      ),
              });
              setSpaceDialog(null);
            }}
          >
            <label className="lm-field">
              {t.title}
              <input
                required
                maxLength={100}
                value={spaceName}
                onChange={(e) => setSpaceName(e.target.value)}
              />
            </label>
            <div className="lm-color-picker">
              {["blue", "green", "orange", "pink"].map((color) => (
                <button
                  type="button"
                  aria-label={color}
                  aria-pressed={spaceColor === color}
                  className={color}
                  key={color}
                  onClick={() => setSpaceColor(color)}
                >
                  {spaceColor === color && <Check size={17} />}
                </button>
              ))}
            </div>
            <button className="lm-button primary">
              {spaceDialog === true ? t.create : t.save}
            </button>
          </form>
        </Dialog>
      )}
      {info && (
        <Dialog title="Lumio AI" close={() => setInfo("")} label={t.close}>
          <p className="lm-info-copy">{info}</p>
          <button className="lm-button primary" onClick={() => setInfo("")}>
            {t.close}
          </button>
        </Dialog>
      )}
      {confirm && (
        <Dialog title="Lumio AI" close={() => setConfirm(null)} label={t.close}>
          <p className="lm-info-copy">{confirm.message}</p>
          <div className="lm-row">
            <button className="lm-button" onClick={() => setConfirm(null)}>
              {t.cancel}
            </button>
            <button
              className="lm-button danger-fill"
              onClick={() => {
                confirm.action();
                setConfirm(null);
              }}
            >
              {confirm.label || t.import}
            </button>
          </div>
        </Dialog>
      )}
      {toast && (
        <div className="lm-toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </>
  );
}
function ContentCard({
  item,
  t,
  locale,
  open,
  favorite,
}: {
  item: LearningItem;
  t: Messages;
  locale: Locale;
  open: () => void;
  favorite: () => void;
}) {
  const Icon = kindIcons[item.kind];
  const [image, setImage] = useState("");
  useEffect(() => {
    if (item.kind !== "image" || !item.blob) return;
    const u = URL.createObjectURL(item.blob);
    setImage(u);
    return () => URL.revokeObjectURL(u);
  }, [item.blob, item.kind]);
  return (
    <article className="lm-content-card">
      <button className="lm-card-open" onClick={open}>
        <div className={`lm-thumbnail ${item.kind}`}>
          {image ? (
            <img src={image} alt="" />
          ) : item.kind === "text" ? (
            <div className="lm-paper-preview">
              <span>{item.title}</span>
              <p>{item.text.slice(0, 270)}</p>
            </div>
          ) : (
            <>
              <Icon size={38} />
              <span>{item.kind.toUpperCase()}</span>
            </>
          )}
          <span className="lm-card-kind">
            <Icon size={12} />
            {item.kind.toUpperCase()}
          </span>
        </div>
        <div className="lm-card-details">
          <h3>{item.title || t.title}</h3>
          <span>
            <Clock size={12} />
            {new Intl.DateTimeFormat(locale, {
              month: "short",
              day: "numeric",
            }).format(new Date(item.createdAt))}
          </span>
        </div>
      </button>
      <button
        className={`lm-card-favorite ${item.favorite ? "is-favorite" : ""}`}
        aria-label={item.favorite ? t.removeFavorite : t.addFavorite}
        onClick={favorite}
      >
        <Star size={16} />
      </button>
    </article>
  );
}
