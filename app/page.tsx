"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

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
  const [history, setHistory] = useState<OtpEntry[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState<"rent" | "rerent" | null>(null);
  const [notice, setNotice] = useState("Sẵn sàng thuê Gmail mới.");
  const [error, setError] = useState("");

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
    if (!rental) return;
    const tick = () => setRemaining(secondsRemaining(rental.expires_at));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [rental]);

  const pollCode = useCallback(async () => {
    if (!rental || secondsRemaining(rental.expires_at) <= 0) return;
    try {
      const data = await api<{ email?: string; rental_status?: string; codes?: Array<string | number>; code?: string | number | null }>(`/api/code?order=${encodeURIComponent(rental.order)}`);
      setRental((current) => current ? { ...current, email: data.email || current.email, rental_status: data.rental_status || current.rental_status } : current);
      const received = [...new Set([...(Array.isArray(data.codes) ? data.codes : []), data.code]
        .filter((code): code is string | number => code !== null && code !== undefined && String(code).trim() !== "")
        .map(String))];
      const known = new Set(history.map((item) => item.id));
      const fresh = received.filter((code) => !known.has(`${rental.order}-${rental.cycle}-${code}`));
      if (fresh.length) {
        const additions = fresh.map((code) => ({ id: `${rental.order}-${rental.cycle}-${code}`, code, email: rental.email, order: rental.order, cycle: rental.cycle, receivedAt: new Date().toLocaleTimeString("vi-VN", { hour12: false }) }));
        setHistory((current) => [...current, ...additions]);
        setNotice(`Đã nhận ${fresh.length} mã OTP mới.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không kiểm tra được OTP");
    }
  }, [rental, history]);

  useEffect(() => {
    if (!rental || secondsRemaining(rental.expires_at) <= 0) return;
    const timer = window.setInterval(() => void pollCode(), 3000);
    return () => window.clearInterval(timer);
  }, [rental, pollCode]);

  const rentNew = async () => {
    setBusy("rent"); setError(""); setNotice("Đang thuê Gmail mới…");
    try {
      const data = await api<Omit<Rental, "cycle">>("/api/rent", { method: "POST", body: "{}" });
      setRental({ ...data, cycle: 1, rental_status: data.rental_status || "waiting" });
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
      setRental((current) => current ? { ...current, ...data, cycle: current.cycle + 1, rental_status: "waiting" } : current);
      setNotice("Đã thuê lại Gmail. Hệ thống đang chờ OTP mới.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thuê lại được Gmail");
      setNotice("Thuê lại chưa thành công.");
    } finally { setBusy(null); }
  };

  const logout = async () => {
    await api("/api/logout", { method: "POST", body: "{}" }).catch(() => undefined);
    setAuthState("out"); setRental(null); setHistory([]);
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
                <button className="secondaryButton" onClick={rerent} disabled={!canRerent || busy !== null}>{busy === "rerent" ? "Đang thuê lại…" : "Thuê lại Gmail này"}<small>Chỉ khả dụng sau khi đã nhận OTP · có tính phí</small></button>
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

        <footer><p><span className="statusDot" /> {notice}</p><span>OTP chỉ hiển thị trong phiên này, không lưu vào cơ sở dữ liệu.</span></footer>
      </div>
    </main>
  );
}
