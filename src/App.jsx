import { useState, useEffect, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  Fuel,
  Flame,
  Plus,
  ArrowDownCircle,
  ArrowUpCircle,
  AlertTriangle,
  X,
  Gauge,
  ChevronLeft,
  Trash2,
  Users,
  FileDown,
  Printer,
  LogOut,
  Building2,
  Mail,
} from "lucide-react";
import { supabase } from "./supabaseClient";

const UNITS = ["L", "kg", "m³"];
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = logged out
  const [memberships, setMemberships] = useState(null);
  const [currentWs, setCurrentWs] = useState(null); // {id, name, role}

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        setMemberships(null);
        setCurrentWs(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const fetchMemberships = useCallback(async () => {
    if (!session) return;
    const { data, error } = await supabase
      .from("memberships")
      .select("id, workspace_id, role, name, workspaces(name)")
      .eq("user_id", session.user.id);
    if (!error) setMemberships(data || []);
  }, [session]);

  useEffect(() => {
    if (session) fetchMemberships();
  }, [session, fetchMemberships]);

  if (session === undefined) return <Loading />;
  if (!session) return <AuthScreen />;
  if (memberships === null) return <Loading />;

  if (!currentWs) {
    return (
      <WorkspacePicker
        memberships={memberships}
        onSelect={(m) => setCurrentWs({ id: m.workspace_id, name: m.workspaces?.name, role: m.role })}
        onCreated={fetchMemberships}
        onLogout={() => supabase.auth.signOut()}
      />
    );
  }

  return (
    <WorkspaceApp
      workspace={currentWs}
      onSwitchWorkspace={memberships.length > 1 ? () => setCurrentWs(null) : null}
      onLogout={() => supabase.auth.signOut()}
    />
  );
}

function Loading() {
  return (
    <div className="screen-center">
      <div className="muted mono">Chargement…</div>
    </div>
  );
}

/* ---------------- Auth ---------------- */

function AuthScreen() {
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    setNotice("");
    setBusy(true);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) setError(traduireErreur(error.message));
      else setNotice("Compte créé. Si une confirmation par email est activée, vérifie ta boîte mail avant de te connecter.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(traduireErreur(error.message));
    }
    setBusy(false);
  };

  return (
    <div className="screen-center">
      <div className="auth-box">
        <Brand />
        <div className="tabs">
          <button className={mode === "login" ? "tab active" : "tab"} onClick={() => setMode("login")}>
            Connexion
          </button>
          <button className={mode === "signup" ? "tab active" : "tab"} onClick={() => setMode("signup")}>
            Créer un compte
          </button>
        </div>

        {mode === "signup" && (
          <Field label="Nom complet">
            <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Dali Gogri" />
          </Field>
        )}
        <Field label="Email">
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="toi@exemple.com" />
        </Field>
        <Field label="Mot de passe">
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="6 caractères minimum"
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </Field>

        {error && <div className="error-text">{error}</div>}
        {notice && <div className="notice-text">{notice}</div>}

        <button className="btn-primary full" disabled={busy || !email || password.length < 6} onClick={submit}>
          {mode === "signup" ? "Créer mon compte" : "Se connecter"}
        </button>
      </div>
    </div>
  );
}

function traduireErreur(msg) {
  if (/already registered/i.test(msg)) return "Un compte existe déjà avec cet email.";
  if (/invalid login/i.test(msg)) return "Email ou mot de passe incorrect.";
  if (/password/i.test(msg)) return "Le mot de passe doit contenir au moins 6 caractères.";
  return msg;
}

function Brand() {
  return (
    <div className="brand">
      <div className="brand-icon">
        <Gauge size={20} color="#E8A33D" strokeWidth={2.2} />
      </div>
      <div>
        <div className="brand-name">TankTrack</div>
        <div className="brand-tag mono">stock carburant &amp; gaz</div>
      </div>
    </div>
  );
}

/* ---------------- Workspace picker / creation ---------------- */

function WorkspacePicker({ memberships, onSelect, onCreated, onLogout }) {
  const [showCreate, setShowCreate] = useState(memberships.length === 0);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const create = async () => {
    setBusy(true);
    setError("");
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("workspaces")
      .insert({ name: name.trim(), owner: userData.user.id });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    await onCreated();
    setBusy(false);
  };

  return (
    <div className="screen-center">
      <div className="auth-box">
        <Brand />
        {!showCreate ? (
          <div>
            <div className="muted small mb-3">Choisis ton espace</div>
            <div className="stack">
              {memberships.map((m) => (
                <button key={m.id} className="list-row" onClick={() => onSelect(m)}>
                  <Building2 size={16} className="icon-muted" />
                  <span className="font-medium">{m.workspaces?.name}</span>
                </button>
              ))}
            </div>
            <button className="link" onClick={() => setShowCreate(true)}>
              + Créer un nouvel espace
            </button>
          </div>
        ) : (
          <div>
            <div className="muted small mb-3">Créer un espace pour ton entreprise ou ton site</div>
            <Field label="Nom de l'entreprise / du site">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sundland Rubber — Chantier Guitry" />
            </Field>
            {error && <div className="error-text">{error}</div>}
            <div className="row-gap">
              {memberships.length > 0 && (
                <button className="btn-ghost flex1" onClick={() => setShowCreate(false)}>
                  Annuler
                </button>
              )}
              <button className="btn-primary flex1" disabled={busy || !name.trim()} onClick={create}>
                Créer mon espace
              </button>
            </div>
          </div>
        )}
        <button className="link muted-link" onClick={onLogout}>
          Se déconnecter
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <div className="field-label">{label}</div>
      {children}
    </label>
  );
}

/* ---------------- Main workspace app ---------------- */

function WorkspaceApp({ workspace, onSwitchWorkspace, onLogout }) {
  const isAdmin = workspace.role === "responsable";
  const [view, setView] = useState({ screen: "dashboard" });
  const [filter, setFilter] = useState("tous");
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");

  const fetchAll = useCallback(async () => {
    const [{ data: p }, { data: m }, { data: mem }, { data: userData }] = await Promise.all([
      supabase.from("products").select("*").eq("workspace_id", workspace.id).order("created_at"),
      supabase.from("movements").select("*").eq("workspace_id", workspace.id).order("date", { ascending: false }),
      supabase.from("memberships").select("*").eq("workspace_id", workspace.id).order("created_at"),
      supabase.auth.getUser(),
    ]);
    setProducts(p || []);
    setMovements(m || []);
    setMembers(mem || []);
    const me = (mem || []).find((x) => x.user_id === userData.user.id);
    setUserName(me?.name || userData.user.email);
    setLoading(false);
  }, [workspace.id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Synchronisation temps réel entre appareils
  useEffect(() => {
    const channel = supabase
      .channel(`workspace-${workspace.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "products", filter: `workspace_id=eq.${workspace.id}` }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "movements", filter: `workspace_id=eq.${workspace.id}` }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "memberships", filter: `workspace_id=eq.${workspace.id}` }, fetchAll)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [workspace.id, fetchAll]);

  const stockOf = (productId) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return 0;
    const base = Number(p.initial_stock) || 0;
    const delta = movements
      .filter((m) => m.product_id === productId)
      .reduce((acc, m) => acc + (m.kind === "entree" ? Number(m.quantity) : -Number(m.quantity)), 0);
    return base + delta;
  };

  const visibleProducts = useMemo(() => {
    if (filter === "tous") return products;
    return products.filter((p) => p.type === filter);
  }, [products, filter]);

  const addProduct = async (p) => {
    await supabase.from("products").insert({ ...p, workspace_id: workspace.id });
    fetchAll();
    setView({ screen: "dashboard" });
  };

  const deleteProduct = async (id) => {
    await supabase.from("products").delete().eq("id", id);
    fetchAll();
    setView({ screen: "dashboard" });
  };

  const addMovement = async (mv) => {
    await supabase.from("movements").insert({ ...mv, workspace_id: workspace.id, added_by: userName });
    fetchAll();
  };

  const deleteMovement = async (id) => {
    await supabase.from("movements").delete().eq("id", id);
    fetchAll();
  };

  const setPhysical = async (productId, level) => {
    await supabase.from("products").update({ last_physical: level, last_physical_date: todayStr() }).eq("id", productId);
    fetchAll();
  };

  const inviteMember = async ({ email, name, role }) => {
    return supabase.from("memberships").insert({ workspace_id: workspace.id, invited_email: email, name, role });
  };

  const removeMember = async (id) => {
    await supabase.from("memberships").delete().eq("id", id);
    fetchAll();
  };

  if (loading) return <Loading />;

  return (
    <div className="app">
      <TopBar
        workspace={workspace}
        userName={userName}
        view={view}
        setView={setView}
        onLogout={onLogout}
        onSwitchWorkspace={onSwitchWorkspace}
        isAdmin={isAdmin}
      />
      <main className="main">
        {view.screen === "dashboard" && (
          <Dashboard
            products={visibleProducts}
            stockOf={stockOf}
            filter={filter}
            setFilter={setFilter}
            onSelect={(id) => setView({ screen: "product", id })}
            onNew={() => setView({ screen: "new-product" })}
            isAdmin={isAdmin}
          />
        )}
        {view.screen === "new-product" && isAdmin && (
          <NewProduct onCancel={() => setView({ screen: "dashboard" })} onSave={addProduct} />
        )}
        {view.screen === "product" && (
          <ProductDetail
            product={products.find((p) => p.id === view.id)}
            movements={movements.filter((m) => m.product_id === view.id)}
            stock={stockOf(view.id)}
            onBack={() => setView({ screen: "dashboard" })}
            onAddMovement={(mv) => addMovement({ ...mv, product_id: view.id })}
            onDeleteMovement={deleteMovement}
            onDeleteProduct={() => deleteProduct(view.id)}
            onSetPhysical={(level) => setPhysical(view.id, level)}
            isAdmin={isAdmin}
          />
        )}
        {view.screen === "reports" && (
          <Reports products={products} movements={movements} workspaceName={workspace.name} />
        )}
        {view.screen === "users" && isAdmin && (
          <UsersAdmin members={members} onInvite={inviteMember} onRemove={removeMember} />
        )}
      </main>
    </div>
  );
}

function TopBar({ workspace, userName, view, setView, onLogout, onSwitchWorkspace, isAdmin }) {
  return (
    <header className="topbar no-print">
      <div className="topbar-inner">
        <button className="brand-btn" onClick={() => setView({ screen: "dashboard" })}>
          <div className="brand-icon small">
            <Gauge size={18} color="#E8A33D" strokeWidth={2.2} />
          </div>
          <div className="brand-text">
            <div className="brand-name small">TankTrack</div>
            <div className="brand-tag mono truncate">{workspace.name}</div>
          </div>
        </button>

        <nav className="nav">
          <NavBtn active={["dashboard", "product", "new-product"].includes(view.screen)} onClick={() => setView({ screen: "dashboard" })}>
            Stocks
          </NavBtn>
          <NavBtn active={view.screen === "reports"} onClick={() => setView({ screen: "reports" })}>
            Rapports
          </NavBtn>
          {isAdmin && (
            <NavBtn active={view.screen === "users"} onClick={() => setView({ screen: "users" })}>
              Équipe
            </NavBtn>
          )}
        </nav>

        <div className="topbar-right">
          <div className="user-info">
            <div className="user-name">{userName}</div>
            <div className="user-role mono">{workspace.role}</div>
          </div>
          {onSwitchWorkspace && (
            <button className="icon-btn" title="Changer d'espace" onClick={onSwitchWorkspace}>
              <Building2 size={16} />
            </button>
          )}
          <button className="icon-btn danger" title="Déconnexion" onClick={onLogout}>
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </header>
  );
}

function NavBtn({ active, onClick, children }) {
  return (
    <button className={active ? "nav-btn active" : "nav-btn"} onClick={onClick}>
      {children}
    </button>
  );
}

/* ---------------- Dashboard ---------------- */

function Dashboard({ products, stockOf, filter, setFilter, onSelect, onNew, isAdmin }) {
  return (
    <div>
      <div className="row-between wrap mb-4">
        <div className="pill-group">
          {[
            ["tous", "Tous"],
            ["carburant", "Carburant"],
            ["gaz", "Gaz"],
          ].map(([key, label]) => (
            <button key={key} className={filter === key ? "pill active" : "pill"} onClick={() => setFilter(key)}>
              {label}
            </button>
          ))}
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={onNew}>
            <Plus size={16} strokeWidth={2.5} />
            Nouveau stock
          </button>
        )}
      </div>

      {products.length === 0 ? (
        <EmptyState onNew={onNew} isAdmin={isAdmin} />
      ) : (
        <div className="grid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} stock={stockOf(p.id)} onClick={() => onSelect(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ onNew, isAdmin }) {
  return (
    <div className="empty-state">
      <Gauge size={32} className="icon-faint" strokeWidth={1.5} />
      <div className="empty-title">Aucun stock configuré</div>
      <div className="empty-sub">
        {isAdmin
          ? "Crée ta première cuve ou réserve — carburant ou gaz — pour commencer à suivre les entrées, sorties et niveaux."
          : "Demande à un responsable de configurer un stock."}
      </div>
      {isAdmin && (
        <button className="btn-primary" onClick={onNew}>
          <Plus size={16} strokeWidth={2.5} />
          Configurer un stock
        </button>
      )}
    </div>
  );
}

function levelColor(pct, alertPct) {
  if (pct <= alertPct) return "#E1543F";
  if (pct <= alertPct * 1.6) return "#E8A33D";
  return "#4FAE7A";
}

function ProductCard({ product, stock, onClick }) {
  const capacity = Number(product.capacity);
  const pct = capacity > 0 ? Math.max(0, Math.min(100, (stock / capacity) * 100)) : 0;
  const alertPct = product.alert_threshold && capacity ? (Number(product.alert_threshold) / capacity) * 100 : 15;
  const color = levelColor(pct, alertPct);
  const isGas = product.type === "gaz";
  const low = pct <= alertPct;

  return (
    <button className="card" onClick={onClick}>
      <div className="row-between mb-3">
        <div className="row-gap-sm">
          <div className="type-icon" style={{ background: isGas ? "rgba(61,184,201,0.15)" : "rgba(232,163,61,0.15)" }}>
            {isGas ? <Flame size={15} color="#3DB8C9" /> : <Fuel size={15} color="#E8A33D" />}
          </div>
          <div>
            <div className="card-title">{product.name}</div>
            <div className="card-sub mono">{product.type}</div>
          </div>
        </div>
        {low && <AlertTriangle size={15} color="#E1543F" />}
      </div>

      <div className="row-between">
        <div className="flex1">
          <div className="bar">
            <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
          </div>
          <div className="row-gap-sm mono">
            <span className="stock-num" style={{ color }}>
              {stock.toLocaleString("fr-FR")}
            </span>
            <span className="muted small">
              / {capacity.toLocaleString("fr-FR")} {product.unit}
            </span>
          </div>
        </div>
        <div className="muted small mono">{Math.round(pct)}%</div>
      </div>
    </button>
  );
}

function NewProduct({ onCancel, onSave }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("carburant");
  const [capacity, setCapacity] = useState("");
  const [unit, setUnit] = useState("L");
  const [initialStock, setInitialStock] = useState("");
  const [alertThreshold, setAlertThreshold] = useState("");
  const canSave = name.trim() && Number(capacity) > 0;

  return (
    <div className="panel-narrow">
      <h2 className="h2">Configurer un nouveau stock</h2>
      <p className="muted small mb-4">Une cuve de gasoil, une réserve de gaz — choisis librement.</p>
      <div className="stack">
        <Field label="Nom">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Cuve gasoil principale" />
        </Field>
        <Field label="Type de stock">
          <div className="row-gap">
            {[
              ["carbura
