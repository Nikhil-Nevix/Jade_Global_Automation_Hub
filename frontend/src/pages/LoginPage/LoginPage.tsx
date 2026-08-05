import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Mail, UserPlus, Eye, EyeOff, ShieldCheck, Server, Zap, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api/api';
import type { LoginRequest } from '../../types';
import projectLogo from '../../assets/Infra Automation Hub.png';
import jadeLogo from '../../assets/JadeLogo-bg.png';

/* ─── Light, professional palette (teal · cyan · emerald) ─── */
const C = {
  accent:  '#0E9E96',
  accent2: '#1FB6D6',
  accent3: '#2FC98C',
  grad:    'linear-gradient(140deg,#0E9E96 0%,#159BC0 45%,#2FC98C 100%)',
  ink:     '#0E2E33',
  sub:     '#5A757A',
  line:    '#E3EEEE',
  soft:    '#F5FAFA',
  ring:    'rgba(14,158,150,0.16)',
};
const DOT_COLORS = ['14,158,150', '31,182,214', '47,201,140'];

const getPasswordStrength = (pw: string): number => {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
};

const STRENGTH: { label: string; color: string }[] = [
  { label: '',            color: 'transparent' },
  { label: 'Very Weak',   color: '#EF4444' },
  { label: 'Weak',        color: '#F97316' },
  { label: 'Fair',        color: '#F59E0B' },
  { label: 'Strong',      color: '#0E9E96' },
  { label: 'Very Strong', color: '#10B981' },
];

const FEATURES = [
  { Icon: ShieldCheck, title: 'Vulnerability Scanning', desc: 'Continuous CVE detection across every asset' },
  { Icon: Server,      title: 'Server Management',      desc: 'One console for your entire fleet'          },
  { Icon: Zap,         title: 'Real-time Monitoring',   desc: 'Live job tracking over WebSockets'          },
];

interface Dot { bx: number; by: number; c: string; ph: number; }

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading, error, clearError } = useAuthStore();

  const [isSignupMode, setIsSignupMode] = useState(false);
  const [credentials, setCredentials] = useState<LoginRequest>({ username: '', password: '' });
  const [signupData, setSignupData] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [signupError, setSignupError]     = useState('');
  const [signupSuccess, setSignupSuccess] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);
  const [showPassword, setShowPassword]             = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [formKey, setFormKey] = useState(0);

  /* ── interactive refs (pointer = mouse + touch + pen) ── */
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const tiltRef      = useRef<HTMLDivElement>(null);
  const pointer      = useRef({ x: -9999, y: -9999, active: false });
  const rects        = useRef<{ card?: DOMRect }>({});

  const pwStrength = getPasswordStrength(signupData.password);

  /* ─────────── Interactive reactive dot-grid (canvas) ─────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0, W = 0, H = 0, t = 0;
    const dots: Dot[] = [];
    const GAP = 38;

    const build = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots.length = 0;
      let idx = 0;
      for (let y = GAP / 2; y < H; y += GAP) {
        for (let x = GAP / 2; x < W; x += GAP) {
          dots.push({ bx: x, by: y, c: DOT_COLORS[idx % DOT_COLORS.length], ph: (x + y) * 0.01 });
          idx++;
        }
      }
    };

    const step = () => {
      t += 0.016;
      ctx.clearRect(0, 0, W, H);
      const { x: px, y: py, active } = pointer.current;
      const R = 165;

      for (const d of dots) {
        let r = 1.15 + Math.sin(t * 1.4 + d.ph) * 0.35;
        let ox = 0, oy = 0, alpha = 0.26;

        if (active) {
          const dx = d.bx - px, dy = d.by - py;
          const dist = Math.hypot(dx, dy);
          if (dist < R) {
            const f = (R - dist) / R;
            const push = f * 14;
            if (dist > 0.001) { ox = (dx / dist) * push; oy = (dy / dist) * push; }
            r += f * 2.6;
            alpha = 0.26 + f * 0.55;
          }
        }

        ctx.beginPath();
        ctx.arc(d.bx + ox, d.by + oy, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${d.c},${alpha})`;
        ctx.fill();
      }

      if (active && px > 0 && py > 0) {
        const g = ctx.createRadialGradient(px, py, 0, px, py, R);
        g.addColorStop(0, 'rgba(31,182,214,0.10)');
        g.addColorStop(1, 'rgba(31,182,214,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(px, py, R, 0, Math.PI * 2); ctx.fill();
      }

      raf = requestAnimationFrame(step);
    };

    build();
    step();
    window.addEventListener('resize', build);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', build); };
  }, []);

  /* ─────────── Pointer-driven spotlight + card tilt (touch-friendly) ─────────── */
  useEffect(() => {
    const measure = () => {
      if (tiltRef.current) {
        const prev = tiltRef.current.style.transform;
        tiltRef.current.style.transform = 'none';
        rects.current.card = tiltRef.current.getBoundingClientRect();
        tiltRef.current.style.transform = prev;
      }
    };

    const onMove = (e: PointerEvent) => {
      pointer.current.x = e.clientX;
      pointer.current.y = e.clientY;
      pointer.current.active = true;

      if (spotlightRef.current) {
        spotlightRef.current.style.opacity = '1';
        spotlightRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      }

      const cr = rects.current.card;
      if (cr && tiltRef.current) {
        const cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
        const dx = (e.clientX - cx) / cr.width, dy = (e.clientY - cy) / cr.height;
        const rotY = Math.max(-4, Math.min(4, dx * 7));
        const rotX = Math.max(-4, Math.min(4, -dy * 7));
        tiltRef.current.style.transform = `perspective(1400px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
      }
    };

    const reset = () => {
      pointer.current.active = false;
      pointer.current.x = -9999; pointer.current.y = -9999;
      if (spotlightRef.current) spotlightRef.current.style.opacity = '0';
      if (tiltRef.current) tiltRef.current.style.transform = 'perspective(1400px) rotateX(0deg) rotateY(0deg)';
    };

    measure();
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onMove, { passive: true });
    window.addEventListener('pointerup', reset);
    window.addEventListener('pointercancel', reset);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
      window.removeEventListener('pointerup', reset);
      window.removeEventListener('pointercancel', reset);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) navigate('/');
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    return () => { clearError(); setSignupError(''); setSignupSuccess(''); };
  }, [clearError, isSignupMode]);

  useEffect(() => {
    if (error || signupError) {
      setShaking(true);
      const t = setTimeout(() => setShaking(false), 520);
      return () => clearTimeout(t);
    }
  }, [error, signupError]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(credentials);
    } catch (err: any) {
      console.error('Login failed with error:', err);
      return false;
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError(''); setSignupSuccess('');
    if (signupData.password !== signupData.confirmPassword) { setSignupError('Passwords do not match'); return; }
    if (signupData.password.length < 8) { setSignupError('Password must be at least 8 characters'); return; }
    setSignupLoading(true);
    try {
      await authApi.signup({ username: signupData.username, email: signupData.email, password: signupData.password });
      setSignupSuccess('Account created successfully! You can now sign in.');
      setSignupData({ username: '', email: '', password: '', confirmPassword: '' });
      setTimeout(() => { setIsSignupMode(false); setSignupSuccess(''); }, 2000);
    } catch (err: any) {
      console.error('Signup error:', err);
      if (err.code === 'ERR_NETWORK' || !err.response) setSignupError('Cannot connect to server. Please check if the backend is running.');
      else if (err.response?.data?.message) setSignupError(err.response.data.message);
      else setSignupError('Failed to create account. Please try again.');
    } finally { setSignupLoading(false); }
  };

  const handleLoginChange  = (e: React.ChangeEvent<HTMLInputElement>) => { const { name, value } = e.target; setCredentials(p => ({ ...p, [name]: value })); };
  const handleSignupChange = (e: React.ChangeEvent<HTMLInputElement>) => { const { name, value } = e.target; setSignupData(p => ({ ...p, [name]: value })); };

  const toggleMode = () => {
    setIsSignupMode(v => !v);
    clearError(); setSignupError(''); setSignupSuccess('');
    setFormKey(k => k + 1);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden', padding: '32px 20px', fontFamily: '"Inter",system-ui,sans-serif',
      background: `
        radial-gradient(at 12% 18%, rgba(31,182,214,0.16), transparent 45%),
        radial-gradient(at 88% 14%, rgba(47,201,140,0.15), transparent 45%),
        radial-gradient(at 82% 86%, rgba(14,158,150,0.13), transparent 46%),
        radial-gradient(at 18% 84%, rgba(120,214,236,0.14), transparent 46%),
        linear-gradient(140deg,#F3FBFB 0%,#EEF8FF 50%,#F1FDF7 100%)`,
    }}>

      {/* ─── styles ─── */}
      <style>{`
        @keyframes gx-shake { 0%,100%{transform:translateX(0);} 15%{transform:translateX(-7px);} 30%{transform:translateX(7px);} 45%{transform:translateX(-5px);} 60%{transform:translateX(5px);} 75%{transform:translateX(-2px);} 90%{transform:translateX(2px);} }
        @keyframes gx-fadein { from{opacity:0;transform:translateY(10px);} to{opacity:1;transform:translateY(0);} }
        @keyframes gx-rise { from{opacity:0;transform:translateY(24px);} to{opacity:1;transform:translateY(0);} }
        @keyframes gx-spin { to{transform:rotate(360deg);} }
        @keyframes gx-sheen { 0%{background-position:0% 50%;} 100%{background-position:200% 50%;} }
        @keyframes gx-slidein { from{opacity:0;transform:translateX(14px);} to{opacity:1;transform:translateX(0);} }

        .gx-shake  { animation: gx-shake 0.52s ease-in-out; }
        .gx-fadein { animation: gx-fadein 0.32s ease-out forwards; }

        .gx-input {
          width:100%; box-sizing:border-box; background:${C.soft}; border:1.5px solid ${C.line}; border-radius:12px;
          padding:12px 44px 12px 42px; color:${C.ink}; font-size:14px; font-weight:500; outline:none;
          transition:border-color .2s, background .2s, box-shadow .2s; font-family:inherit;
        }
        .gx-input::placeholder { color:#9DB4B6; font-weight:400; }
        .gx-input:hover { border-color:#BFDDDD; background:#fff; }
        .gx-input:focus { border-color:${C.accent}; background:#fff; box-shadow:0 0 0 4px ${C.ring}; }
        .gx-input-pr { padding-right:44px; }

        .gx-wrap { position:relative; }
        .gx-wrap:focus-within .gx-icon { color:${C.accent}; }
        .gx-icon { position:absolute; left:14px; top:50%; transform:translateY(-50%); color:#9DB4B6; pointer-events:none; transition:color .2s; }
        .gx-eye { position:absolute; right:12px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; padding:4px; color:#9DB4B6; transition:color .2s; line-height:0; }
        .gx-eye:hover { color:${C.accent}; }

        .gx-label { display:block; margin-bottom:7px; font-size:12px; font-weight:700; letter-spacing:.2px; color:#3C5155; }

        .gx-btn {
          width:100%; padding:14px; border:none; border-radius:12px; cursor:pointer; font-size:15px; font-weight:700;
          color:#fff; letter-spacing:.2px; background:${C.grad}; background-size:200% 200%;
          transition:transform .2s, box-shadow .2s, background-position .5s; display:flex; align-items:center;
          justify-content:center; gap:8px; font-family:inherit; box-shadow:0 10px 24px rgba(14,158,150,0.30);
        }
        .gx-btn:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 16px 36px rgba(31,182,214,0.38); background-position:right center; }
        .gx-btn:active:not(:disabled) { transform:translateY(0); }
        .gx-btn:disabled { opacity:.55; cursor:not-allowed; }

        .gx-link { background:none; border:none; padding:0; cursor:pointer; font-family:inherit; font-size:13.5px; font-weight:700; color:${C.accent}; transition:color .2s; }
        .gx-link:hover { color:${C.accent2}; text-decoration:underline; }

        .gx-alert-err { background:#FEF2F2; border:1px solid #FECACA; border-left:3px solid #EF4444; color:#B91C1C; padding:11px 14px; border-radius:12px; font-size:13px; display:flex; align-items:flex-start; gap:9px; }
        .gx-alert-ok  { background:#F0FDF9; border:1px solid #A7F3D0; border-left:3px solid #10B981; color:#047857; padding:11px 14px; border-radius:12px; font-size:13px; display:flex; align-items:flex-start; gap:9px; }

        .gx-sbar { height:4px; flex:1; border-radius:4px; transition:background .35s; }

        .gx-brandfeat { display:flex; align-items:flex-start; gap:13px; }
        .gx-brandfeat .ic { width:38px; height:38px; border-radius:11px; flex-shrink:0; background:rgba(255,255,255,0.18); border:1px solid rgba(255,255,255,0.25); display:flex; align-items:center; justify-content:center; backdrop-filter:blur(4px); }
      `}</style>

      {/* interactive reactive dot-grid */}
      <canvas ref={canvasRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%', zIndex:0, pointerEvents:'none' }} />

      {/* pointer-tracking spotlight */}
      <div ref={spotlightRef} style={{
        position:'fixed', top:0, left:0, width:520, height:520, marginLeft:-260, marginTop:-260, zIndex:0,
        borderRadius:'50%', pointerEvents:'none', opacity:0, transition:'opacity .3s',
        background:'radial-gradient(circle, rgba(31,182,214,0.14) 0%, rgba(47,201,140,0.06) 40%, transparent 70%)',
      }}/>

      {/* ─── UNIFIED SPLIT CARD ─── */}
      <div ref={tiltRef} style={{
        position:'relative', zIndex:1, width:'100%', maxWidth:'940px',
        display:'flex', borderRadius:'26px', overflow:'hidden',
        background:'rgba(255,255,255,0.90)', backdropFilter:'blur(20px)',
        border:'1px solid rgba(255,255,255,0.9)',
        boxShadow:'0 40px 90px rgba(14,158,150,0.18), 0 10px 30px rgba(14,46,51,0.07)',
        transition:'transform .18s ease-out', transformStyle:'preserve-3d',
        animation:'gx-rise .6s ease-out both',
      }}>

        {/* ── LEFT: FORM PANEL ── */}
        <div className={shaking ? 'gx-shake' : ''} style={{ flex:'1 1 0', minWidth:0, padding:'40px 40px 34px', display:'flex', flexDirection:'column' }}>

          {/* Mobile logos (brand panel hidden on small screens) */}
          <div className="flex lg:hidden" style={{ alignItems:'center', gap:'10px', marginBottom:'26px' }}>
            <LogoImg src={jadeLogo} alt="Jade Global" />
            <div style={{ width:1, height:34, background:C.line }} />
            <LogoImg src={projectLogo} alt="Infra Automation Hub" />
          </div>

          <div style={{ marginBottom:'22px' }}>
            <h2 style={{ color:C.ink, fontSize:'27px', fontWeight:800, marginBottom:'6px', letterSpacing:'-0.5px' }}>
              {isSignupMode ? 'Create your account' : 'Sign in'}
            </h2>
            <p style={{ color:C.sub, fontSize:'14px' }}>
              {isSignupMode ? 'Set up access to the automation hub' : 'Welcome back — enter your credentials to continue'}
            </p>
          </div>

          {/* Form */}
          <div key={formKey} style={{ animation:'gx-slidein .32s ease-out both' }}>
            {isSignupMode ? (
              <form onSubmit={handleSignupSubmit} style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                {signupError   && <div className="gx-alert-err gx-fadein"><AlertIcon/><span>{signupError}</span></div>}
                {signupSuccess && <div className="gx-alert-ok gx-fadein"><CheckIcon/><span>{signupSuccess}</span></div>}

                <div>
                  <label className="gx-label">Username</label>
                  <div className="gx-wrap">
                    <User size={16} className="gx-icon"/>
                    <input id="signup-username" name="username" type="text" required value={signupData.username} onChange={handleSignupChange} className="gx-input" placeholder="Choose a username"/>
                  </div>
                </div>

                <div>
                  <label className="gx-label">Email Address</label>
                  <div className="gx-wrap">
                    <Mail size={16} className="gx-icon"/>
                    <input id="signup-email" name="email" type="email" required value={signupData.email} onChange={handleSignupChange} className="gx-input" placeholder="your@email.com"/>
                  </div>
                </div>

                <div>
                  <label className="gx-label">Password</label>
                  <div className="gx-wrap">
                    <Lock size={16} className="gx-icon"/>
                    <input id="signup-password" name="password" type={showSignupPassword?'text':'password'} required value={signupData.password} onChange={handleSignupChange} className="gx-input gx-input-pr" placeholder="At least 8 characters"/>
                    <button type="button" className="gx-eye" onClick={()=>setShowSignupPassword(v=>!v)}>{showSignupPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button>
                  </div>
                  {signupData.password && (
                    <div className="gx-fadein" style={{ marginTop:'8px' }}>
                      <div style={{ display:'flex', gap:'4px', marginBottom:'5px' }}>
                        {[1,2,3,4,5].map(i=>(<div key={i} className="gx-sbar" style={{ background: i<=pwStrength ? STRENGTH[pwStrength].color : '#E3EEEE' }}/>))}
                      </div>
                      <span style={{ fontSize:'11px', fontWeight:700, color:STRENGTH[pwStrength].color }}>{STRENGTH[pwStrength].label}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="gx-label">Confirm Password</label>
                  <div className="gx-wrap">
                    <Lock size={16} className="gx-icon"/>
                    <input id="signup-confirm-password" name="confirmPassword" type={showConfirmPassword?'text':'password'} required value={signupData.confirmPassword} onChange={handleSignupChange} className="gx-input gx-input-pr" placeholder="Confirm your password"/>
                    <button type="button" className="gx-eye" onClick={()=>setShowConfirmPassword(v=>!v)}>{showConfirmPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button>
                  </div>
                  {signupData.confirmPassword && (
                    <div className="gx-fadein" style={{ marginTop:'5px', fontSize:'11px', fontWeight:700, color: signupData.password===signupData.confirmPassword ? '#059669' : '#DC2626' }}>
                      {signupData.password===signupData.confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                    </div>
                  )}
                </div>

                <button type="submit" disabled={signupLoading} className="gx-btn" style={{ marginTop:'6px' }}>
                  {signupLoading ? <><Spinner/> Creating account...</> : <><UserPlus size={17}/> Create Account</>}
                </button>
              </form>
            ) : (
              <form onSubmit={handleLoginSubmit} style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                {error && <div className="gx-alert-err gx-fadein"><AlertIcon/><span>{error}</span></div>}

                <div>
                  <label className="gx-label">Username</label>
                  <div className="gx-wrap">
                    <User size={16} className="gx-icon"/>
                    <input id="username" name="username" type="text" required value={credentials.username} onChange={handleLoginChange} className="gx-input" placeholder="Enter your username" autoComplete="username"/>
                  </div>
                </div>

                <div>
                  <label className="gx-label">Password</label>
                  <div className="gx-wrap">
                    <Lock size={16} className="gx-icon"/>
                    <input id="password" name="password" type={showPassword?'text':'password'} required value={credentials.password} onChange={handleLoginChange} className="gx-input gx-input-pr" placeholder="Enter your password" autoComplete="current-password"/>
                    <button type="button" className="gx-eye" onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button>
                  </div>
                </div>

                <button type="submit" disabled={isLoading} className="gx-btn" style={{ marginTop:'6px' }}>
                  {isLoading ? <><Spinner/> Signing in...</> : <>Sign In <ArrowRight size={17}/></>}
                </button>
              </form>
            )}
          </div>

          {/* bottom toggle */}
          <div style={{ marginTop:'auto', paddingTop:'22px', textAlign:'center', fontSize:'13.5px', color:C.sub }}>
            {isSignupMode ? 'Already have an account? ' : "Don't have an account? "}
            <button className="gx-link" onClick={toggleMode}>
              {isSignupMode ? 'Sign in' : 'Create one'}
            </button>
          </div>
        </div>

        {/* ── RIGHT: GRADIENT BRAND PANEL (lg+) ── */}
        <div className="hidden lg:flex" style={{
          flex:'0 0 44%', position:'relative', overflow:'hidden', color:'#fff',
          padding:'44px 40px', flexDirection:'column',
          background:C.grad, backgroundSize:'160% 160%',
        }}>
          {/* subtle overlay glows */}
          <div style={{ position:'absolute', top:'-20%', right:'-15%', width:280, height:280, borderRadius:'50%', background:'radial-gradient(circle, rgba(255,255,255,0.18), transparent 70%)', pointerEvents:'none' }}/>
          <div style={{ position:'absolute', bottom:'-18%', left:'-12%', width:240, height:240, borderRadius:'50%', background:'radial-gradient(circle, rgba(255,255,255,0.12), transparent 70%)', pointerEvents:'none' }}/>

          {/* logos on frosted strip */}
          <div style={{
            display:'inline-flex', alignSelf:'flex-start', alignItems:'center', gap:'12px',
            background:'rgba(255,255,255,0.95)', borderRadius:'12px', padding:'9px 14px',
            boxShadow:'0 8px 22px rgba(0,0,0,0.12)', marginBottom:'34px', position:'relative', zIndex:1,
          }}>
            <LogoImg src={jadeLogo} alt="Jade Global" h={30} />
            <div style={{ width:1, height:26, background:'#E3EEEE' }} />
            <LogoImg src={projectLogo} alt="Infra Automation Hub" h={30} />
          </div>

          <h1 style={{ fontSize:'32px', fontWeight:800, lineHeight:1.15, letterSpacing:'-0.6px', marginBottom:'12px', position:'relative', zIndex:1 }}>
            Infrastructure automation,<br/>simplified.
          </h1>
          <p style={{ fontSize:'14.5px', lineHeight:1.6, color:'rgba(255,255,255,0.88)', marginBottom:'34px', maxWidth:'340px', position:'relative', zIndex:1 }}>
            Detect vulnerabilities, run playbooks, and monitor every server in real time — from one secure hub.
          </p>

          <div style={{ display:'flex', flexDirection:'column', gap:'20px', position:'relative', zIndex:1 }}>
            {FEATURES.map(({ Icon, title, desc })=>(
              <div key={title} className="gx-brandfeat">
                <div className="ic"><Icon size={18} color="#fff"/></div>
                <div>
                  <div style={{ fontWeight:700, fontSize:'14px', marginBottom:'2px' }}>{title}</div>
                  <div style={{ fontSize:'12.5px', lineHeight:1.5, color:'rgba(255,255,255,0.82)' }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop:'auto', paddingTop:'28px', display:'flex', alignItems:'center', gap:'8px', fontSize:'12px', color:'rgba(255,255,255,0.85)', position:'relative', zIndex:1 }}>
            <CheckCircle2 size={15}/> Secured enterprise access · © 2026 Jade Global
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Helpers ─── */
const LogoImg = ({ src, alt, h = 40 }: { src: string; alt: string; h?: number }) => (
  <img src={src} alt={alt} style={{ height:h, width:'auto', objectFit:'contain', display:'block' }}/>
);

const Spinner = () => (
  <svg style={{ animation:'gx-spin 0.8s linear infinite', flexShrink:0 }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
  </svg>
);

const AlertIcon = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor" style={{ flexShrink:0, marginTop:'1px' }}>
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor" style={{ flexShrink:0, marginTop:'1px' }}>
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
  </svg>
);
