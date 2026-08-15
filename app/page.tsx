"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Product = { id: number; name: string; price: number | string; stock?: number };
type Rental = {
  order: string;
  email: string;
  expires_at: string;
  balance?: number | string;
  rental_status?: string;
  cycle: number;
};
type OtpEntry = {
  id: string;
  code: string;
  email: string;
  order: string;
  cycle: number;
  receivedAt: string;
};
type ApiErrorPayload = { error?: string; message?: string };

const DEVICE_STORAGE_KEY = "vunvo36-gmail-otp-history-v1";

type DeviceHistory = {
  activeOrder?: string;
  rentals?: Rental[];
  codes?: OtpEntry[];
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const payload = (await response.json().catch(() => ({}))) as T & ApiErrorPayload;
  if (!response.ok) throw new Error(payload.error || payload.message || `Lỗi ${response.status}`);
  return payload;
}

function aliases(email: string) {
  const at = email.lastIndexOf("@");
  if (at < 1) return ["—", "—"];
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return [`${local}+ducsieudz1@${domain}`, `${local}+ducsieudz2@${domain}`];
}

function formatMoney(value: number | string | undefined) {
  if (value === undefined || value === null || value === "") return "—";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString("vi-VN") : String(value);
}

function secondsRemaining(expiresAt?: string) {
  if (!expiresAt) return 0;
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function formatTimer(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function expiryOrFallback(value?: string) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date(Date.now() + 15 * 60 * 1000).toISOString();
}

function displayExpiry(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(time) : "—";
}

function CopyButton({ value, label = "Sao chép" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };
  return <button className="copyButton" type="button" onClick={copy} aria-label={`${label}: ${value}`}>{copied ? "Đã chép" : label}</button>;
}

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api("/api/login", { method: "POST", body: JSON.stringify({ password }) });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể đăng nhập");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="loginShell">
      <section className="loginCard">
        <div className="brandMark" aria-hidden="true">A</div>
        <p className="eyebrow">Không gian riêng tư</p>
        <h1>Gmail OTP</h1>
        <p className="loginLead">Đăng nhập để thuê Gmail, theo dõi thời gian và nhận OTP trên một màn hình.</p>
        <form onSubmit={submit}>
          <label htmlFor="password">Mật khẩu truy cập</label>
          <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nhập mật khẩu" autoComplete="current-password" autoFocus required />
          {error ? <p className="formError" role="alert">{error}</p> : null}
          <button className="primaryButton fullWidth" disabled={loading}>{loading ? "Đang kiểm tra…" : "Mở bảng điều khiển"}</button>
        </form>
        <p className="privacyNote"><span className="statusDot" /> API key được giữ kín ở máy chủ</p>
      </section>
    </main>
  );
}

export default function Home() {
  const [authState, setAuthState] = useState<"loading" | "in" | "out">("loading");
  const [product, setProduct] = useState<Product | null>(null);
  const [rental, setRental] = useState<Rental | null>(null);
  const [rentalHistory, setRentalHistory] = useState<Rental[]>([]);
  const [history, setHistory] = useState<OtpEntry[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState<"rent" | "rerent" | null>(null);
  const [notice, setNotice] = useState("Sẵn sàng thuê Gmail mới.");
  const [error, setError] = useState("");
  const restoredDeviceHistory = useRef(false);

  const loadProduct = useCallback(async () => {
    try {
      const data = await api<{ product: Product }>("/api/product");
      setProduct(data.product);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lấy được sản phẩm");
    }
  }, []);

  const checkSession = useCallback(async () => {
    try {
      const data = await api<{ authenticated: boolean }>("/api/session");
      setAuthState(data.authenticated ? "in" : "out");
      if (data.authenticated) void loadProduct();
    } catch {
      setAuthState("out");
    }
  }, [loadProduct]);

  useEffect(() => {
    const timer = window.setTimeout(() => void checkSession(), 0);
    return () => window.clearTimeout(timer);
  }, [checkSession]);

  useEffect(() => {
    if (authState !== "in" || restoredDeviceHistory.current) return;
    restoredDeviceHistory.current = true;
    const restore = window.setTimeout(() => {
      try {
        const saved = JSON.parse(window.localStorage.getItem(DEVICE_STORAGE_KEY) || "{}") as DeviceHistory;
        const rentals = Array.isArray(saved.rentals) ? saved.rentals : [];
        const codes = Array.isArray(saved.codes) ? saved.codes : [];
        const active = rentals.find((item) => item.order === saved.activeOrder) || rentals[0] || null;
        setRentalHistory(rentals);
        setHistory(codes);
        setRental(active);
        if (active) setNotice("Đã khôi phục lịch sử thuê trên máy này.");
      } catch {
        window.localStorage.removeItem(DEVICE_STORAGE_KEY);
      }
    }, 0);
    return () => window.clearTimeout(restore);
  }, [authState]);

  useEffect(() => {
    if (authState !== "in" || !restoredDeviceHistory.current) return;
    const saved: DeviceHistory = { activeOrder: rental?.order, rentals: rentalHistory, codes: history };
    window.localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(saved));
  }, [authState, rental, rentalHistory, history]);

  useEffect(() => {
    if (!rental) return;
    const tick = () => setRemaining(secondsRemaining(rental.expires_at));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [rental]);

  const pollCode = useCallback(async (allowExpired = false) => {
    if (!rental || (!allowExpired && secondsRemaining(rental.expires_at) <= 0)) return;
    try {
      const data = await api<{ email?: string; rental_status?: string; codes?: Array<string | number>; code?: string | number | null }>(`/api/code?order=${encodeURIComponent(rental.order)}`);
      const currentEmail = data.email || rental.email;
      setRental((current) => {
        if (!current) return current;
        const email = data.email || current.email;
        const rental_status = data.rental_status || current.rental_status;
        return email === current.email && rental_status === current.rental_status ? current : { ...current, email, rental_status };
      });
      setRentalHistory((current) => current.map((item) => item.order === rental.order ? { ...item, email: currentEmail, rental_status: data.rental_status || item.rental_status } : item));
      const received = [...new Set([...(Array.isArray(data.codes) ? data.codes : []), data.code]
        .filter((code): code is string | number => code !== null && code !== undefined && String(code).trim() !== "")
        .map(String))];
      setHistory((current) => {
        const known = new Set(current.map((item) => item.id));
        const fresh = received.filter((code) => !known.has(`${rental.order}-${rental.cycle}-${code}`));
        if (!fresh.length) return current;
        const additions = fresh.map((code) => ({ id: `${rental.order}-${rental.cycle}-${code}`, code, email: currentEmail, order: rental.order, cycle: rental.cycle, receivedAt: new Date().toLocaleTimeString("vi-VN", { hour12: false }) }));
        setNotice(`Đã nhận ${fresh.length} mã OTP mới.`);
        return [...current, ...additions];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không kiểm tra được OTP");
    }
  }, [rental]);

  useEffect(() => {
    if (!rental || secondsRemaining(rental.expires_at) <= 0) return;
    const immediate = window.setTimeout(() => void pollCode(), 0);
    const timer = window.setInterval(() => void pollCode(), 3000);
    return () => { window.clearTimeout(immediate); window.clearInterval(timer); };
  }, [rental, pollCode]);

  const rentNew = async () => {
    setBusy("rent"); setError(""); setNotice("Đang thuê Gmail mới…");
    try {
      const data = await api<Omit<Rental, "cycle">>("/api/rent", { method: "POST", body: "{}" });
      const next = { ...data, expires_at: expiryOrFallback(data.expires_at), cycle: 1, rental_status: data.rental_status || "waiting" };
      setRental(next);
      setRentalHistory((current) => [next, ...current.filter((item) => item.order !== next.order)]);
      setNotice("Đã thuê Gmail mới. Hệ thống đang chờ OTP.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thuê được Gmail");
      setNotice("Thuê Gmail chưa thành công.");
    } finally { setBusy(null); }
  };

  const rerent = async () => {
    if (!rental) return;
    setBusy("rerent"); setError(""); setNotice("Đang thuê lại Gmail…");
    try {
      const data = await api<Omit<Rental, "cycle">>("/api/rerent", { method: "POST", body: JSON.stringify({ order: rental.order }) });
      const next = { ...rental, ...data, expires_at: expiryOrFallback(data.expires_at), cycle: rental.cycle + 1, rental_status: "waiting" };
      setRental(next);
      setRentalHistory((current) => [next, ...current.filter((item) => item.order !== next.order)]);
      setNotice("Đã thuê lại Gmail. Hệ thống đang chờ OTP mới.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thuê lại được Gmail");
      setNotice("Thuê lại chưa thành công.");
    } finally { setBusy(null); }
  };

  const logout = async () => {
    await api("/api/logout", { method: "POST", body: "{}" }).catch(() => undefined);
    setAuthState("out"); setRental(null); setHistory([]);
    restoredDeviceHistory.current = false;
  };

  const [alias1, alias2] = useMemo(() => aliases(rental?.email || ""), [rental?.email]);
  const canRerent = rental?.rental_status?.toLowerCase() === "received";

  if (authState === "loading") return <main className="loadingShell"><div className="spinner" /><p>Đang mở bảng điều khiển…</p></main>;
  if (authState === "out") return <Login onSuccess={() => { setAuthState("in"); void loadProduct(); }} />;

  return (
    <main className="appShell">
      <header className="topBar">
        <div className="brand"><div className="brandMark small" aria-hidden="true">A</div><span>Gmail OTP</span></div>
        <div className="topActions"><span className="securePill"><span className="statusDot" /> Riêng tư</span><button className="textButton" type="button" onClick={logout}>Đăng xuất</button></div>
      </header>

      <div className="dashboard">
        <section className="heroPanel">
          <div><p className="eyebrow">Bảng điều khiển cá nhân</p><h1>Một lần bấm.<br />Hai Gmail biến thể.</h1><p className="heroLead">Thuê Gmail ChatGPT, theo dõi OTP và thời hạn trên cùng một màn hình.</p></div>
          <button className="primaryButton rentButton" onClick={rentNew} disabled={busy !== null}><span className="buttonIcon">＋</span><span><strong>{busy === "rent" ? "Đang thuê…" : "Thuê Gmail mới"}</strong><small>Có tính phí theo API</small></span></button>
        </section>

        <section className="statsGrid" aria-label="Thông tin dịch vụ">
          <article className="statCard"><span>Sản phẩm</span><strong>{product?.name || "Đang tải…"}</strong></article>
          <article className="statCard"><span>Giá mỗi lượt</span><strong>{formatMoney(product?.price)} <small>đ</small></strong></article>
          <article className="statCard"><span>Tồn kho</span><strong>{formatMoney(product?.stock)}</strong></article>
          <article className="statCard"><span>Số dư</span><strong>{formatMoney(rental?.balance)} <small>đ</small></strong></article>
        </section>

        {error ? <div className="errorBanner" role="alert"><span>!</span><p>{error}</p><button onClick={() => setError("")} aria-label="Đóng">×</button></div> : null}

        <div className="mainGrid">
          <section className="rentalCard">
            <div className="sectionHeading"><div><p className="eyebrow">Gmail đang thuê</p><h2>{rental ? "Sẵn sàng nhận mã" : "Chưa có phiên thuê"}</h2></div><div className={`timer ${remaining === 0 && rental ? "expired" : ""}`}><span>Thời gian còn lại</span><strong>{rental ? formatTimer(remaining) : "15:00"}</strong></div></div>
            {rental ? (
              <>
                <div className="emailRows">
                  <div className="emailRow original"><span><small>Gmail gốc</small><strong>{rental.email}</strong></span><CopyButton value={rental.email} /></div>
                  <div className="emailRow"><span><small>Biến thể 1</small><strong>{alias1}</strong></span><CopyButton value={alias1} /></div>
                  <div className="emailRow"><span><small>Biến thể 2</small><strong>{alias2}</strong></span><CopyButton value={alias2} /></div>
                </div>
                <div className="rentalMeta"><span><small>Mã đơn</small><strong>{rental.order}</strong></span><span><small>Trạng thái</small><strong className="statusValue"><i />{rental.rental_status || "waiting"}</strong></span><span><small>Lượt thuê</small><strong>#{rental.cycle}</strong></span></div>
                <p className="expiryLine">Hết hạn lúc <strong>{displayExpiry(rental.expires_at)}</strong> · đồng hồ tự dừng khi về 00:00.</p>
                <div className="rentalButtons"><button className="checkButton" onClick={() => void pollCode(true)} disabled={busy !== null}>Kiểm tra trạng thái/OTP</button><button className="secondaryButton" onClick={rerent} disabled={!canRerent || busy !== null}>{busy === "rerent" ? "Đang thuê lại…" : "Thuê lại Gmail này"}<small>Chỉ khả dụng sau khi đã nhận OTP · có tính phí</small></button></div>
              </>
            ) : <div className="emptyRental"><div className="emptyIcon">@</div><p>Nhấn <strong>Thuê Gmail mới</strong> để bắt đầu.</p><span>Hai biến thể sẽ được tạo tự động.</span></div>}
          </section>

          <aside className="otpCard">
            <div className="sectionHeading compact"><div><p className="eyebrow">Mã xác minh</p><h2>OTP đã nhận</h2></div><span className="liveBadge"><i /> Tự động</span></div>
            <div className="otpList">
              {history.length ? [...history].reverse().map((item, index) => (
                <article className="otpItem" key={item.id}><div className="otpTop"><span>OTP {history.length - index}</span><time>{item.receivedAt}</time></div><div className="otpCode"><strong>{item.code}</strong><CopyButton value={item.code} label="Copy" /></div><p>Lượt {item.cycle} · {item.order}</p></article>
              )) : <div className="emptyOtp"><div className="pulseRings"><i /><i /><i /></div><p>Đang chờ OTP</p><span>Hệ thống tự kiểm tra mỗi 3 giây</span></div>}
            </div>
          </aside>
        </div>

        <section className="historyCard">
          <div className="historyHeading"><div><p className="eyebrow">Lưu trên máy này</p><h2>Lịch sử Gmail đã thuê</h2></div><span>{rentalHistory.length} đơn</span></div>
          {rentalHistory.length ? <div className="rentalHistoryList">{rentalHistory.map((item) => {
            const isActive = item.order === rental?.order;
            const itemRemaining = secondsRemaining(item.expires_at);
            return <article className={`historyRental ${isActive ? "active" : ""}`} key={item.order}>
              <div><strong>{item.email}</strong><span>Đơn {item.order} · lượt #{item.cycle} · {item.rental_status || "waiting"}</span></div>
              <div className="historyActions"><time className={itemRemaining === 0 ? "expired" : ""}>{itemRemaining ? formatTimer(itemRemaining) : "Đã hết hạn"}</time><button type="button" onClick={() => { setRental(item); setNotice("Đã mở lại đơn thuê đã lưu trên máy này. Hãy kiểm tra trạng thái để thuê lại."); }}> {isActive ? "Đang mở" : "Mở đơn"}</button></div>
            </article>;
          })}</div> : <p className="historyEmpty">Các Gmail bạn thuê sẽ tự lưu tại trình duyệt này, kể cả khi bạn tải lại trang.</p>}
        </section>

        <footer><p><span className="statusDot" /> {notice}</p><span>Lịch sử và OTP được lưu cục bộ trên máy này; không gửi vào cơ sở dữ liệu.</span></footer>
      </div>
    </main>
  );
}
