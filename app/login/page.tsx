"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    setMessage(null);
    const response = mode === "sign-in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
    setBusy(false);
    if (response.error) setMessage(response.error.message);
    else if (mode === "sign-up" && !response.data.session) setMessage("Check your email to confirm the account, then return here to sign in.");
    else window.location.assign("/dashboard");
  };

  const google = async () => {
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } });
    if (error) {
      setMessage(error.message);
      setBusy(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <a href="/" className="wordmark wordmark-large">Arkhe</a>
        <div className="login-statement">
          <p className="overline">Material specification workspace</p>
          <h1>Every finish, fixture, and decision in one place.</h1>
          <p>Built for spatial design teams moving from early selections to client-ready schedules.</p>
        </div>
        <span className="login-edition">Soho Residence · Project study 01</span>
      </section>
      <section className="login-form-panel">
        <form className="login-form" onSubmit={submit}>
          <div>
            <h2>{mode === "sign-in" ? "Open your workspace" : "Create your workspace"}</h2>
            <p>{isSupabaseConfigured ? "Use your Arkhe account to continue." : "Sign in to your private material workspace. Your first project opens with a complete Soho Residence sample schedule."}</p>
          </div>
          {isSupabaseConfigured ? (
            <>
              <label className="field"><span>Email address</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="studio@example.com" required autoComplete="email" /></label>
              <label className="field"><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" minLength={8} required autoComplete={mode === "sign-in" ? "current-password" : "new-password"} /></label>
              {message && <p className={message.startsWith("Check") ? "form-message" : "form-error"} role="status">{message}</p>}
              <button className="button button-primary button-full" disabled={busy}>{busy && <LoaderCircle className="spinner" size={17} />}<span>{busy ? "Working" : mode === "sign-in" ? "Sign in" : "Create account"}</span></button>
              <button className="button button-secondary button-full" type="button" onClick={google} disabled={busy}>Continue with Google</button>
              <button className="text-button" type="button" onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}>{mode === "sign-in" ? "New to Arkhe? Create an account" : "Already have an account? Sign in"}</button>
            </>
          ) : (
            <><a className="button button-primary button-full" href="/signin-with-chatgpt?return_to=%2Fdashboard" target="_top">Continue with ChatGPT <ArrowRight size={17} /></a><p className="login-privacy">Your materials and notes are private. Clients only see the approved selections you choose to share.</p></>
          )}
        </form>
      </section>
    </main>
  );
}
