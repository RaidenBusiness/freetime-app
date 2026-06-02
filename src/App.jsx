import { useState, useMemo, useEffect } from "react";

// ─── Supabase via CDN global ───────────────────────────────────────────────
const SB_URL = import.meta.env.VITE_SUPABASE_URL  || "";
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

function getSupabase() {
  if (!SB_URL || !SB_KEY) return null;
  if (typeof window === "undefined" || !window.supabase) return null;
  try {
    if (!window._sbClient) window._sbClient = window.supabase.createClient(SB_URL, SB_KEY);
    return window._sbClient;
  } catch(e) {
    console.error("Supabase init failed:", e.message);
    return null;
  }
}

// ─── Constants ────────────────────────────────────────────────────────────
const DAYS      = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const FULL_DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTHS    = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const P_COLORS  = ["#f59e0b","#10b981","#6366f1","#ef4444","#ec4899","#06b6d4"];

// ─── Helpers ──────────────────────────────────────────────────────────────
function wkStart(date) { const d=new Date(date); d.setHours(0,0,0,0); d.setDate(d.getDate()-d.getDay()); return d; }
function addDays(date,n) { const d=new Date(date); d.setDate(d.getDate()+n); return d; }
function sameDay(a,b) { return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate(); }
function fmt12(h,m) { const ap=h>=12?"pm":"am"; const hr=h%12===0?12:h%12; return `${hr}:${String(m).padStart(2,"0")} ${ap}`; }
function shiftHrs(s) { const [sh,sm]=s.startTime.split(":").map(Number),[eh,em]=s.endTime.split(":").map(Number); let m=(eh*60+em)-(sh*60+sm); if(m<0)m+=1440; return Math.round(m/6)/10; }
function fmtDur(h) { return h<1?`${Math.round(h*60)}m`:`${h}h`; }
function todayPlus(n) { const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-d.getDay()+n); return d.toISOString().split("T")[0]; }

const INIT_SHIFTS = [
  {id:1,date:todayPlus(1),startTime:"14:00",endTime:"22:00",label:"Work",travelMins:20},
  {id:2,date:todayPlus(3),startTime:"16:00",endTime:"23:00",label:"Work",travelMins:20},
  {id:3,date:todayPlus(5),startTime:"10:00",endTime:"18:00",label:"Work",travelMins:20},
];
const INIT_PRIS = [
  {id:1,name:"Gym",    color:"#f59e0b",days:["Tue","Thu","Sat"],duration:1.5,travelMins:15},
  {id:2,name:"Reading",color:"#10b981",days:["Mon","Wed","Fri","Sun"],duration:1,travelMins:0},
  {id:3,name:"Gaming", color:"#6366f1",days:["Sat","Sun"],duration:2,travelMins:0},
];

async function sbRest(path,opts={}) {
  const sb=getSupabase(); let token=SB_KEY;
  if(sb){const{data}=await sb.auth.getSession();token=data?.session?.access_token||SB_KEY;}
  const res=await fetch(`${SB_URL}${path}`,{...opts,headers:{"Content-Type":"application/json",apikey:SB_KEY,Authorization:`Bearer ${token}`,...opts.headers}});
  const txt=await res.text(); const json=txt?JSON.parse(txt):{};
  if(!res.ok) throw new Error(json.error_description||json.message||json.error||`Error ${res.status}`);
  return json;
}

// ─── Styles ───────────────────────────────────────────────────────────────
const S={
  root:{minHeight:"100vh",background:"#0d0d14",display:"flex",justifyContent:"center",fontFamily:"'DM Sans',sans-serif"},
  app:{width:"100%",maxWidth:430,minHeight:"100vh",background:"#0d0d14",display:"flex",flexDirection:"column"},
  header:{padding:"52px 24px 20px",background:"linear-gradient(180deg,#13131f 0%,#0d0d14 100%)"},
  logo:{fontSize:13,fontWeight:600,letterSpacing:"0.18em",color:"#f59e0b",textTransform:"uppercase",marginBottom:12},
  greeting:{fontSize:26,fontWeight:700,color:"#fff",lineHeight:1.2,marginBottom:4},
  sub:{fontSize:14,color:"#6b6b8a"},
  weekNav:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 24px",marginTop:24,marginBottom:16},
  weekLbl:{fontSize:15,fontWeight:600,color:"#fff"},
  navBtn:{background:"#1e1e2e",border:"none",color:"#9090aa",borderRadius:10,width:34,height:34,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"},
  strip:{display:"flex",padding:"0 16px",gap:6,marginBottom:4},
  pill:(sel,tod)=>({flex:1,textAlign:"center",padding:"8px 0 6px",borderRadius:12,cursor:"pointer",background:sel?"#f59e0b":tod?"#1e1e2e":"transparent",border:tod&&!sel?"1px solid #2a2a3e":"1px solid transparent"}),
  pillName:(sel)=>({fontSize:10,color:sel?"#0d0d14":"#6b6b8a",fontWeight:600,letterSpacing:"0.05em",display:"block",marginBottom:3}),
  pillNum:(sel)=>({fontSize:16,fontWeight:700,color:sel?"#0d0d14":"#fff",display:"block"}),
  dot:(sel,has)=>({width:has?6:4,height:has?6:4,borderRadius:"50%",background:sel?"#0d0d14":has?"#f59e0b":"transparent",margin:"3px auto 0",boxShadow:!sel&&has?"0 0 5px #f59e0b":"none"}),
  body:{flex:1,padding:"16px 16px 90px",display:"flex",flexDirection:"column",gap:16,overflowY:"auto"},
  secLbl:{fontSize:11,fontWeight:700,letterSpacing:"0.1em",color:"#4a4a6a",textTransform:"uppercase",marginBottom:8},
  card:{background:"#13131f",borderRadius:16,border:"1px solid #1e1e2e",padding:"14px 16px"},
  badge:{fontSize:11,fontWeight:700,color:"#f59e0b",background:"rgba(245,158,11,.12)",borderRadius:20,padding:"3px 10px"},
  statGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10},
  statCard:{background:"#13131f",border:"1px solid #1e1e2e",borderRadius:14,padding:"14px 16px"},
  track:{background:"#1e1e2e",borderRadius:20,height:6,marginTop:10,overflow:"hidden"},
  fill:(pct,col)=>({height:"100%",width:`${Math.min(100,pct)}%`,background:col,borderRadius:20,transition:"width .4s"}),
  addBtn:{background:"#f59e0b",color:"#0d0d14",border:"none",borderRadius:14,padding:"14px",width:"100%",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8},
  ghostBtn:{background:"#13131f",color:"#9090aa",border:"1px solid #1e1e2e",borderRadius:14,padding:"12px",width:"100%",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8},
  tabBar:{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:"#13131f",borderTop:"1px solid #1e1e2e",display:"flex",padding:"10px 0 20px",zIndex:100},
  tabItem:(a)=>({flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,fontSize:10,fontWeight:600,color:a?"#f59e0b":"#3a3a5a",cursor:"pointer",border:"none",background:"transparent"}),
  modal:{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200},
  sheet:{width:"100%",maxWidth:430,background:"#13131f",borderRadius:"20px 20px 0 0",padding:"24px 20px 40px",border:"1px solid #1e1e2e",borderBottom:"none"},
  mTitle:{fontSize:18,fontWeight:700,color:"#fff",marginBottom:20},
  fLbl:{fontSize:11,fontWeight:600,color:"#6b6b8a",marginBottom:6,display:"block",letterSpacing:"0.05em",textTransform:"uppercase"},
  inp:{width:"100%",background:"#0d0d14",border:"1px solid #1e1e2e",borderRadius:10,padding:"11px 14px",color:"#fff",fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"'DM Sans',sans-serif"},
  colDot:(col,sel)=>({width:28,height:28,borderRadius:"50%",background:col,cursor:"pointer",border:sel?"3px solid #fff":"3px solid transparent",boxSizing:"border-box"}),
  dayTog:(a)=>({flex:1,padding:"8px 0",borderRadius:10,background:a?"#f59e0b":"#0d0d14",color:a?"#0d0d14":"#6b6b8a",border:"1px solid #1e1e2e",fontSize:11,fontWeight:700,cursor:"pointer",textAlign:"center"}),
  delBtn:{background:"transparent",border:"none",color:"#3a3a5a",cursor:"pointer",fontSize:17,padding:"4px 6px",borderRadius:6,lineHeight:1},
  editBtn:{background:"transparent",border:"none",color:"#4a4a7a",cursor:"pointer",fontSize:13,padding:"4px 6px",borderRadius:6,lineHeight:1},
};
const A={
  root:{minHeight:"100vh",background:"#0d0d14",display:"flex",justifyContent:"center",alignItems:"center",fontFamily:"'DM Sans',sans-serif"},
  card:{width:"100%",maxWidth:390,padding:"0 24px 40px",display:"flex",flexDirection:"column"},
  logo:{fontSize:13,fontWeight:700,letterSpacing:"0.18em",color:"#f59e0b",textTransform:"uppercase",marginBottom:32,textAlign:"center"},
  tagline:{fontSize:26,fontWeight:700,color:"#fff",lineHeight:1.25,marginBottom:8,textAlign:"center"},
  sub:{fontSize:14,color:"#6b6b8a",textAlign:"center",marginBottom:36},
  tabRow:{display:"flex",background:"#13131f",borderRadius:12,padding:4,marginBottom:24,border:"1px solid #1e1e2e"},
  tabBtn:(a)=>({flex:1,padding:"9px 0",borderRadius:9,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:a?"#f59e0b":"transparent",color:a?"#0d0d14":"#4a4a6a"}),
  field:{marginBottom:14},
  label:{fontSize:11,fontWeight:700,letterSpacing:"0.08em",color:"#4a4a6a",textTransform:"uppercase",display:"block",marginBottom:6},
  inp:{width:"100%",background:"#13131f",border:"1px solid #1e1e2e",borderRadius:12,padding:"13px 16px",color:"#fff",fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"'DM Sans',sans-serif"},
  keepRow:{display:"flex",alignItems:"center",gap:10,marginBottom:22,cursor:"pointer"},
  chk:(c)=>({width:20,height:20,borderRadius:6,border:c?"none":"2px solid #2a2a3e",background:c?"#f59e0b":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer"}),
  submit:{width:"100%",background:"#f59e0b",color:"#0d0d14",border:"none",borderRadius:14,padding:"15px",fontSize:15,fontWeight:700,cursor:"pointer",marginBottom:16},
  error:{fontSize:13,color:"#ef4444",textAlign:"center",marginBottom:14,minHeight:20},
  divRow:{display:"flex",alignItems:"center",gap:12,margin:"4px 0 20px"},
  divLine:{flex:1,height:1,background:"#1e1e2e"},
  divTxt:{fontSize:11,color:"#3a3a5a",fontWeight:600},
  swTxt:{fontSize:13,color:"#4a4a6a",textAlign:"center"},
  swLink:{color:"#f59e0b",cursor:"pointer",fontWeight:600,background:"none",border:"none",fontSize:13,fontFamily:"'DM Sans',sans-serif"},
};

export default function FreeTime() {
  const today=useMemo(()=>{const d=new Date();d.setHours(0,0,0,0);return d;},[]);
  const [tab,setTab]=useState("home");
  const [weekOff,setWeekOff]=useState(0);
  const [selDay,setSelDay]=useState(today);
  const [shifts, setShifts] = useState([]);
  const [pris,   setPris]   = useState([]);
  const [sleepH,setSleepH]=useState(8);
  const [showAddSh,setShowAddSh]=useState(false);
  const [editShId,setEditShId]=useState(null);
  const [delShId,setDelShId]=useState(null);
  const [newSh,setNewSh]=useState({date:today.toISOString().split("T")[0],startTime:"09:00",endTime:"17:00",label:"Work",travelMins:0});
  const [showAddP,setShowAddP]=useState(false);
  const [editPId,setEditPId]=useState(null);
  const [durUnit,setDurUnit]=useState("hrs");
  const [newP,setNewP]=useState({name:"",color:"#f59e0b",days:[],duration:1,travelMins:0});
  const [authed,setAuthed]=useState(false);
  const [authMode,setAuthMode]=useState("login");
  const [authName,setAuthName]=useState("");
  const [authEmail,setAuthEmail]=useState("");
  const [authPass,setAuthPass]=useState("");
  const [keepIn,setKeepIn]=useState(false);
  const [showPw,setShowPw]=useState(false);
  const [authErr,setAuthErr]=useState("");
  const [authLoading,setAuthLoading]=useState(false);
  const [signupDone,setSignupDone]=useState(false);
  const [user,setUser]=useState(null);
  const [onboarding,setOnboarding]=useState(false);
  const [onboardStep,setOnboardStep]=useState(0);

  useEffect(()=>{
    const sb=getSupabase(); if(!sb) return;
    sb.auth.getSession().then(({data:{session}})=>{
      if(session?.user){
        const name=session.user.user_metadata?.name||session.user.email.split("@")[0];
        setUser({name,email:session.user.email,id:session.user.id});setAuthed(true);
      }
    });
    const {data:{subscription}}=sb.auth.onAuthStateChange((_e,session)=>{
      if(session?.user){const name=session.user.user_metadata?.name||session.user.email.split("@")[0];setUser({name,email:session.user.email,id:session.user.id});setAuthed(true);}
    });
    return ()=>subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    if(!authed||!user?.id) return;
    (async()=>{
      try{
        const[sr,pr,st]=await Promise.all([
          sbRest(`/rest/v1/shifts?user_id=eq.${user.id}&order=date.asc`),
          sbRest(`/rest/v1/priorities?user_id=eq.${user.id}&order=sort_order.asc`),
          sbRest(`/rest/v1/user_settings?user_id=eq.${user.id}`),
        ]);
        if(Array.isArray(sr)&&sr.length) setShifts(sr.map(s=>({id:s.id,date:s.date,startTime:s.start_time,endTime:s.end_time,label:s.label,travelMins:s.travel_mins})));
        if(Array.isArray(pr)&&pr.length) setPris(pr.map(p=>({id:p.id,name:p.name,color:p.color,days:p.days,duration:p.duration,travelMins:p.travel_mins})));
        if(Array.isArray(st)&&st.length) setSleepH(st[0].sleep_hours);
      }catch(e){console.error("Load error",e);}
    })();
  },[authed,user?.id]);

  async function doAuth(){
    setAuthErr("");
    const rx=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if(!authEmail.trim()||!authPass.trim()){setAuthErr("Please fill in all fields.");return;}
    if(!rx.test(authEmail.trim())){setAuthErr("Please enter a valid email address.");return;}
    if(authMode==="signup"&&!authName.trim()){setAuthErr("Please enter your name.");return;}
    if(authPass.length<6){setAuthErr("Password must be at least 6 characters.");return;}
    const sb=getSupabase();
    if(!sb){setAuthErr("App not configured. Please check Vercel environment variables.");return;}
    setAuthLoading(true);
    try{
      if(authMode==="signup"){
        const{error}=await sb.auth.signUp({email:authEmail.trim(),password:authPass,options:{data:{name:authName.trim()}}});
        if(error) throw error;
        setSignupDone(true);
      }else{
        const{data,error}=await sb.auth.signInWithPassword({email:authEmail.trim(),password:authPass});
        if(error) throw error;
        const name=data.user?.user_metadata?.name||authEmail.split("@")[0];
        setUser({name,email:data.user.email,id:data.user.id});
        const seenKey=`ft_onboarded_${data.user.id}`;
        if(!localStorage.getItem(seenKey)){
          setOnboarding(true);setOnboardStep(0);
        } else {
          setAuthed(true);
        }
      }
    }catch(e){
      const m=(e.message||"").toLowerCase();
      if(m.includes("not confirmed")) setAuthErr("Please confirm your email first. Check your inbox.");
      else if(m.includes("invalid")||m.includes("credentials")) setAuthErr("Incorrect email or password.");
      else if(m.includes("already")) setAuthErr("An account with this email already exists. Try logging in.");
      else setAuthErr(e.message||"Something went wrong. Please try again.");
    }
    setAuthLoading(false);
  }

  async function doSignOut(){
    const sb=getSupabase(); if(sb) await sb.auth.signOut().catch(()=>{});
    setAuthed(false);setUser(null);setShifts([]);setPris([]);setSleepH(8);
    setAuthEmail("");setAuthPass("");setAuthName("");setAuthErr("");
  }

  async function saveSh(){
    if(!newSh.date||!newSh.startTime||!newSh.endTime) return;
    if(user?.id){
      const pl={user_id:user.id,date:newSh.date,start_time:newSh.startTime,end_time:newSh.endTime,label:newSh.label,travel_mins:newSh.travelMins};
      try{
        if(editShId){
          await sbRest(`/rest/v1/shifts?id=eq.${editShId}`,{method:"PATCH",body:JSON.stringify(pl),headers:{Prefer:"return=representation"}});
          setShifts(p=>p.map(s=>s.id===editShId?{...newSh,id:editShId}:s));
        }else{
          const res=await sbRest("/rest/v1/shifts",{method:"POST",body:JSON.stringify(pl),headers:{Prefer:"return=representation"}});
          const c=Array.isArray(res)?res[0]:res; setShifts(p=>[...p,{...newSh,id:c.id}]);
        }
      }catch(e){console.error(e);}
    }else{
      if(editShId) setShifts(p=>p.map(s=>s.id===editShId?{...newSh,id:editShId}:s));
      else setShifts(p=>[...p,{...newSh,id:Date.now()}]);
    }
    setEditShId(null);setShowAddSh(false);
    setNewSh({date:today.toISOString().split("T")[0],startTime:"09:00",endTime:"17:00",label:"Work",travelMins:0});
  }

  async function delSh(id){
    if(user?.id){try{await sbRest(`/rest/v1/shifts?id=eq.${id}`,{method:"DELETE"});}catch(e){console.error(e);}}
    setShifts(p=>p.filter(s=>s.id!==id));setDelShId(null);
  }

  function openEditSh(s){setNewSh({date:s.date,startTime:s.startTime,endTime:s.endTime,label:s.label,travelMins:s.travelMins??0});setEditShId(s.id);setShowAddSh(true);}

  async function saveP(){
    if(!newP.name.trim()) return;
    if(user?.id){
      const pl={user_id:user.id,name:newP.name,color:newP.color,days:newP.days,duration:newP.duration,travel_mins:newP.travelMins,sort_order:0};
      try{
        if(editPId){
          await sbRest(`/rest/v1/priorities?id=eq.${editPId}`,{method:"PATCH",body:JSON.stringify(pl),headers:{Prefer:"return=representation"}});
          setPris(p=>p.map(x=>x.id===editPId?{...newP,id:editPId}:x));
        }else{
          const res=await sbRest("/rest/v1/priorities",{method:"POST",body:JSON.stringify(pl),headers:{Prefer:"return=representation"}});
          const c=Array.isArray(res)?res[0]:res; setPris(p=>[...p,{...newP,id:c.id}]);
        }
      }catch(e){console.error(e);}
    }else{
      if(editPId) setPris(p=>p.map(x=>x.id===editPId?{...newP,id:editPId}:x));
      else setPris(p=>[...p,{...newP,id:Date.now()}]);
    }
    setEditPId(null);setShowAddP(false);setNewP({name:"",color:"#f59e0b",days:[],duration:1,travelMins:0});
  }

  function delP(id){setPris(p=>p.filter(x=>x.id!==id));}
  function openEditP(p){setNewP({name:p.name,color:p.color,days:p.days,duration:p.duration??1,travelMins:p.travelMins??0});setEditPId(p.id);setDurUnit("hrs");setShowAddP(true);}
  function togDay(d){setNewP(p=>({...p,days:p.days.includes(d)?p.days.filter(x=>x!==d):[...p.days,d]}));}

  const ws=useMemo(()=>addDays(wkStart(today),weekOff*7),[today,weekOff]);
  const wDays=useMemo(()=>Array.from({length:7},(_,i)=>addDays(ws,i)),[ws]);
  const selDs=selDay.toISOString().split("T")[0];
  const selAbbr=DAYS[selDay.getDay()];
  const wShifts=useMemo(()=>shifts.filter(s=>{const d=new Date(s.date+"T00:00:00");return wDays.some(w=>sameDay(w,d));}),[shifts,wDays]);
  const workDays=useMemo(()=>new Set(wShifts.map(s=>s.date)),[wShifts]);
  const freeDays=7-workDays.size;
  const totWorkH=useMemo(()=>wShifts.reduce((a,s)=>a+shiftHrs(s),0),[wShifts]);
  const totTravW=useMemo(()=>wShifts.reduce((a,s)=>a+(s.travelMins??0)/60,0),[wShifts]);
  const wakingH=24-sleepH;
  const totPriH=useMemo(()=>pris.reduce((a,p)=>{const n=p.days.length===0?7:p.days.length;return a+(p.duration??1)*n;},0),[pris]);
  const totPriT=useMemo(()=>pris.reduce((a,p)=>{const n=p.days.length===0?7:p.days.length;return a+((p.travelMins??0)/60)*n;},0),[pris]);
  const trueFree=Math.max(0,Math.round((7*wakingH-totWorkH-totTravW-totPriH-totPriT)*10)/10);
  const daySh=shifts.filter(s=>s.date===selDs);
  const dayP=pris.filter(p=>p.days.length===0||p.days.includes(selAbbr));
  function greet(){const h=new Date().getHours();return h<12?"Good morning":h<17?"Good afternoon":"Good evening";}
  const isCurWeek=weekOff===0;
  const wkLbl=(()=>{const e=addDays(ws,6);if(ws.getMonth()===e.getMonth())return `${MONTHS[ws.getMonth()]} ${ws.getDate()}\u2013${e.getDate()}`;return `${MONTHS[ws.getMonth()].slice(0,3)} ${ws.getDate()} \u2013 ${MONTHS[e.getMonth()].slice(0,3)} ${e.getDate()}`;})();

  if(!authed){
    return (
      <>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
        <div style={A.root}>
          <div style={A.card}>
            {signupDone?(
              <div style={{textAlign:"center",paddingTop:80}}>
                <div style={{fontSize:64,marginBottom:20}}>📬</div>
                <div style={{fontSize:22,fontWeight:700,color:"#fff",marginBottom:10}}>Check your email</div>
                <div style={{fontSize:14,color:"#6b6b8a",lineHeight:1.6,marginBottom:32}}>
                  We sent a confirmation link to <span style={{color:"#f59e0b",fontWeight:600}}>{authEmail}</span>. Click it to activate your account, then log in.
                </div>
                <button style={A.submit} onClick={()=>{setSignupDone(false);setAuthMode("login");setAuthPass("");setAuthErr("");}}>Back to log in</button>
                <div style={{fontSize:12,color:"#3a3a5a",marginTop:16}}>Didn&#39;t get it? Check your spam folder.</div>
              </div>
            ):(
              <>
                <div style={{textAlign:"center",marginBottom:40,paddingTop:40}}>
                  <div style={{fontSize:48,marginBottom:12}}>⏳</div>
                  <div style={A.logo}>FreeTime</div>
                  <div style={A.tagline}>{authMode==="login"?"Welcome back":"Take back your time"}</div>
                  <div style={A.sub}>{authMode==="login"?"Sign in to your account":"Create your free account"}</div>
                </div>
                <div style={A.tabRow}>
                  <button style={A.tabBtn(authMode==="login")}  onClick={()=>{setAuthMode("login"); setAuthErr("");}}>Log in</button>
                  <button style={A.tabBtn(authMode==="signup")} onClick={()=>{setAuthMode("signup");setAuthErr("");}}>Sign up</button>
                </div>
                {authMode==="signup"&&(
                  <div style={A.field}>
                    <label style={A.label}>Your name</label>
                    <input style={A.inp} placeholder="Alex" value={authName} onChange={e=>setAuthName(e.target.value)}/>
                  </div>
                )}
                <div style={A.field}>
                  <label style={A.label}>Email</label>
                  <input style={A.inp} type="email" placeholder="you@email.com" value={authEmail}
                    onChange={e=>setAuthEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doAuth()}/>
                </div>
                <div style={{...A.field,marginBottom:18}}>
                  <label style={A.label}>Password</label>
                  <div style={{position:"relative"}}>
                    <input style={{...A.inp,paddingRight:48}} type={showPw?"text":"password"} placeholder="&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;"
                      value={authPass} onChange={e=>setAuthPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doAuth()}/>
                    <button onClick={()=>setShowPw(v=>!v)}
                      style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:18,lineHeight:1,color:showPw?"#f59e0b":"#3a3a5a",padding:0}}>
                      {showPw?"🙈":"👁"}
                    </button>
                  </div>
                </div>
                <div style={A.keepRow} onClick={()=>setKeepIn(v=>!v)}>
                  <div style={A.chk(keepIn)}>{keepIn&&<span style={{fontSize:13,fontWeight:900,color:"#0d0d14"}}>✓</span>}</div>
                  <span style={{fontSize:13,color:keepIn?"#fff":"#4a4a6a",userSelect:"none"}}>Keep me signed in</span>
                </div>
                <div style={A.error}>{authErr}</div>
                <button style={{...A.submit,opacity:authLoading?0.6:1}} onClick={doAuth} disabled={authLoading}>
                  {authLoading?"Please wait...":authMode==="login"?"Log in":"Create account"}
                </button>
                <div style={A.divRow}><div style={A.divLine}/><span style={A.divTxt}>OR</span><div style={A.divLine}/></div>
                <button style={{...A.submit,background:"#13131f",color:"#9090aa",border:"1px solid #1e1e2e",marginBottom:20}}
                  onClick={()=>{setUser({name:"Guest",email:"",id:null});setShifts(INIT_SHIFTS);setPris(INIT_PRIS);setOnboarding(true);setOnboardStep(0);}}>
                  Continue as guest
                </button>
                <div style={A.swTxt}>
                  {authMode==="login"
                    ?<span>No account? <button style={A.swLink} onClick={()=>{setAuthMode("signup");setAuthErr("");}}>Sign up free</button></span>
                    :<span>Have an account? <button style={A.swLink} onClick={()=>{setAuthMode("login");setAuthErr("");}}>Log in</button></span>
                  }
                </div>
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  // ── Onboarding screen ─────────────────────────────────────────────────
  function finishOnboarding(){
    if(user?.id) localStorage.setItem(`ft_onboarded_${user.id}`,"1");
    setOnboarding(false);setAuthed(true);
  }
    {
      icon:"👋",
      title:"Welcome, " + (user?.name?.split(" ")[0] || "") + "!",
      sub:"Have you used FreeTime before?",
      isChoice: true,
    },
    {
      icon:"📅",
      title:"Add your work shifts",
      sub:"Tap any day in the strip or hit \"+ Add shift\" to log when you work. FreeTime tracks your hours automatically.",
      tip:"You can edit or delete shifts anytime with the ✎ button.",
    },
    {
      icon:"⭐",
      title:"Set your priorities",
      sub:"Head to the Focus tab to add things that matter to you — gym, reading, family time. Pick which days and how long each session is.",
      tip:"Priorities are factored into your free time calculation.",
    },
    {
      icon:"🧮",
      title:"See your true free time",
      sub:"The Home tab calculates exactly how much free time you have after work, sleep, travel, and priorities are all accounted for.",
      tip:"Adjust your sleep hours in the More tab to fine-tune the calculation.",
    },
    {
      icon:"📊",
      title:"Check your week at a glance",
      sub:"The Week tab shows all 7 days in one view — work days in amber, days off in green — with your priorities shown below each day.",
      tip:"Tap any day to jump straight to it on the Home tab.",
    },
  ];

  if(onboarding){
    const step=STEPS[onboardStep];
    const isLast=onboardStep===STEPS.length-1;
    const progress=onboardStep>0?(onboardStep-1)/(STEPS.length-2)*100:0;
    return(
      <>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
        <div style={{minHeight:"100vh",background:"#0d0d14",display:"flex",justifyContent:"center",alignItems:"center",fontFamily:"'DM Sans',sans-serif"}}>
          <div style={{width:"100%",maxWidth:390,padding:"0 24px 48px",display:"flex",flexDirection:"column",alignItems:"center"}}>

            {/* Progress dots — only show after first screen */}
            {onboardStep>0&&(
              <div style={{display:"flex",gap:6,marginBottom:40}}>
                {STEPS.slice(1).map((_,i)=>(
                  <div key={i} style={{width:i===onboardStep-1?24:8,height:8,borderRadius:20,background:i===onboardStep-1?"#f59e0b":"#1e1e2e",transition:"all .3s"}}/>
                ))}
              </div>
            )}
            {onboardStep===0&&<div style={{height:48}}/>}

            {/* Icon */}
            <div style={{fontSize:72,marginBottom:24,lineHeight:1}}>{step.icon}</div>

            {/* Title */}
            <div style={{fontSize:24,fontWeight:700,color:"#fff",textAlign:"center",marginBottom:12,lineHeight:1.3}}>{step.title}</div>

            {/* Sub */}
            <div style={{fontSize:15,color:"#6b6b8a",textAlign:"center",lineHeight:1.7,marginBottom:step.tip?16:40}}>{step.sub}</div>

            {/* Tip */}
            {step.tip&&(
              <div style={{background:"#13131f",border:"1px solid #1e1e2e",borderRadius:14,padding:"12px 16px",marginBottom:40,width:"100%",boxSizing:"border-box"}}>
                <span style={{fontSize:12,color:"#f59e0b",fontWeight:700}}>TIP  </span>
                <span style={{fontSize:13,color:"#6b6b8a"}}>{step.tip}</span>
              </div>
            )}

            {/* Choice buttons (first screen) */}
            {step.isChoice?(
              <div style={{display:"flex",flexDirection:"column",gap:12,width:"100%"}}>
                <button
                  style={{background:"#13131f",color:"#fff",border:"1px solid #1e1e2e",borderRadius:14,padding:"16px",fontSize:15,fontWeight:600,cursor:"pointer",width:"100%"}}
                  onClick={()=>setOnboardStep(1)}>
                  No — show me how it works
                </button>
                <button
                  style={{background:"#f59e0b",color:"#0d0d14",border:"none",borderRadius:14,padding:"16px",fontSize:15,fontWeight:700,cursor:"pointer",width:"100%"}}
                  onClick={()=>finishOnboarding()}>
                  Yes — take me to the app
                </button>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:12,width:"100%"}}>
                <button
                  style={{background:"#f59e0b",color:"#0d0d14",border:"none",borderRadius:14,padding:"16px",fontSize:15,fontWeight:700,cursor:"pointer",width:"100%"}}
                  onClick={()=>{ if(isLast) finishOnboarding(); else setOnboardStep(s=>s+1); }}>
                  {isLast?"Let's go →":"Next →"}
                </button>
                {onboardStep>1&&(
                  <button
                    style={{background:"transparent",color:"#4a4a6a",border:"none",fontSize:13,cursor:"pointer",padding:"8px"}}
                    onClick={()=>setOnboardStep(s=>s-1)}>
                    ← Back
                  </button>
                )}
                <button
                  style={{background:"transparent",color:"#3a3a5a",border:"none",fontSize:13,cursor:"pointer",padding:"8px"}}
                  onClick={()=>finishOnboarding()}>
                  Skip tutorial
                </button>
              </div>
            )}

          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      <div style={S.root}>
        <div style={S.app}>
          <div style={S.header}>
            <div style={S.logo}>FreeTime</div>
            <div style={S.greeting}>{isCurWeek?`${greet()}, ${user?.name?.split(" ")[0]||""}`:weekOff<0?"Past week":"Upcoming week"}</div>
            <div style={S.sub}>{wkLbl}</div>
          </div>
          <div style={S.weekNav}>
            <button style={S.navBtn} onClick={()=>setWeekOff(w=>w-1)}>&#8249;</button>
            <span style={S.weekLbl}>{isCurWeek?"This week":weekOff<0?`${Math.abs(weekOff)}w ago`:`In ${weekOff}w`}</span>
            <button style={S.navBtn} onClick={()=>setWeekOff(w=>w+1)}>&#8250;</button>
          </div>
          <div style={S.strip}>
            {wDays.map((day,i)=>{
              const ds=day.toISOString().split("T")[0];
              const isTod=sameDay(day,today),isSel=sameDay(day,selDay),hasSh=shifts.some(s=>s.date===ds);
              return(
                <div key={i} style={S.pill(isSel,isTod)} onClick={()=>{setSelDay(day);setTab("home");}}>
                  <span style={S.pillName(isSel)}>{DAYS[i]}</span>
                  <span style={S.pillNum(isSel)}>{day.getDate()}</span>
                  <div style={S.dot(isSel,hasSh)}/>
                </div>
              );
            })}
          </div>
          <div style={S.body}>

            {tab==="home"&&(
              <>
                <div>
                  <div style={S.secLbl}>{sameDay(selDay,today)?"Today":FULL_DAYS[selDay.getDay()]} &#xB7; {MONTHS[selDay.getMonth()]} {selDay.getDate()}</div>
                  <div style={S.card}>
                    {daySh.length===0?(
                      <div style={{display:"flex",alignItems:"center",gap:12,padding:"4px 0"}}>
                        <div style={{width:38,height:38,borderRadius:10,background:"rgba(16,185,129,.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>🌿</div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:14,fontWeight:600,color:"#10b981",marginBottom:2}}>Free day</div>
                          <div style={{fontSize:12,color:"#6b6b8a"}}>No shifts scheduled</div>
                        </div>
                        <span style={{fontSize:11,fontWeight:700,color:"#10b981",background:"rgba(16,185,129,.12)",borderRadius:20,padding:"3px 10px"}}>Open</span>
                      </div>
                    ):daySh.map((sh,idx)=>{
                      const[shh,shm]=sh.startTime.split(":").map(Number),[ehh,ehm]=sh.endTime.split(":").map(Number);
                      return(
                        <div key={sh.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:idx<daySh.length-1?"1px solid #1a1a2a":"none"}}>
                          <div style={{width:38,height:38,borderRadius:10,background:"#1e1e2e",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>💼</div>
                          <div style={{flex:1}}>
                            <div style={{fontSize:14,fontWeight:600,color:"#fff",marginBottom:2}}>{sh.label}</div>
                            <div style={{fontSize:12,color:"#6b6b8a"}}>{fmt12(shh,shm)} &#8211; {fmt12(ehh,ehm)}{(sh.travelMins??0)>0&&<span style={{color:"#4a4a6a",marginLeft:6}}>🚗 {sh.travelMins}m</span>}</div>
                          </div>
                          <span style={S.badge}>{shiftHrs(sh)}h</span>
                          <button style={S.editBtn} onClick={()=>openEditSh(sh)}>&#9998;</button>
                          <button style={S.delBtn}  onClick={()=>setDelShId(sh.id)}>&#215;</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div style={S.secLbl}>Week overview</div>
                  <div style={S.statGrid}>
                    {[[freeDays,"Free days","#10b981",freeDays/7],[workDays.size,"Work days","#f59e0b",workDays.size/7],[totWorkH+"h","Work hours","#f59e0b",totWorkH/(7*wakingH)],[totPriH+"h","Priority hrs","#6366f1",totPriH/(7*wakingH)]].map(([val,lbl,col,pct])=>(
                      <div key={lbl} style={S.statCard}>
                        <div style={{fontSize:typeof val==="number"?28:22,fontWeight:700,color:"#fff",lineHeight:1}}>{val}</div>
                        <div style={{fontSize:12,color:"#6b6b8a",marginTop:4}}>{lbl}</div>
                        <div style={S.track}><div style={S.fill(pct*100,col)}/></div>
                      </div>
                    ))}
                  </div>
                  <div style={{...S.card,marginTop:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <div>
                        <div style={{fontSize:14,fontWeight:600,color:"#fff"}}>True free time</div>
                        <div style={{fontSize:11,color:"#4a4a6a",marginTop:2}}>After work, travel &#38; priorities</div>
                      </div>
                      <div style={{fontSize:28,fontWeight:700,color:"#10b981"}}>{trueFree}h</div>
                    </div>
                    <div style={S.track}>
                      <div style={{display:"flex",height:"100%",borderRadius:20,overflow:"hidden"}}>
                        <div style={{width:`${(totWorkH/(7*wakingH))*100}%`,background:"#f59e0b",transition:"width .4s"}}/>
                        <div style={{width:`${(totPriH/(7*wakingH))*100}%`,background:"#6366f1",transition:"width .4s"}}/>
                        <div style={{flex:1,background:"#10b981"}}/>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:12,marginTop:8}}>
                      {[["#f59e0b","Work"],["#6366f1","Priorities"],["#10b981","Free"]].map(([col,lbl])=>(
                        <div key={lbl} style={{display:"flex",alignItems:"center",gap:4}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:col}}/>
                          <span style={{fontSize:11,color:"#4a4a6a"}}>{lbl}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {pris.length>0&&(
                  <div>
                    <div style={S.secLbl}>{sameDay(selDay,today)?"Today":FULL_DAYS[selDay.getDay()]+"&#39;s"} priorities</div>
                    {dayP.length===0
                      ?<div style={{...S.card,textAlign:"center",color:"#3a3a5a",fontSize:13,padding:"20px"}}>No priorities scheduled</div>
                      :<div style={S.card}>
                        {dayP.map((p,i)=>(
                          <div key={p.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:i<dayP.length-1?"1px solid #1a1a2a":"none"}}>
                            <div style={{width:4,borderRadius:4,alignSelf:"stretch",background:p.color,flexShrink:0}}/>
                            <div style={{flex:1,marginLeft:4}}>
                              <div style={{fontSize:14,color:"#fff",fontWeight:500}}>{p.name}</div>
                              <div style={{fontSize:12,color:"#4a4a6a",marginTop:2}}>{fmtDur(p.duration??1)} dedicated{(p.travelMins??0)>0?` · 🚗 ${p.travelMins}m`:""}</div>
                            </div>
                            <span style={{fontSize:11,fontWeight:700,color:p.color,background:`${p.color}18`,borderRadius:20,padding:"3px 10px"}}>{fmtDur(p.duration??1)}</span>
                          </div>
                        ))}
                      </div>
                    }
                  </div>
                )}
                <button style={S.addBtn} onClick={()=>{setNewSh(s=>({...s,date:selDs}));setEditShId(null);setShowAddSh(true);}}>+ Add shift</button>
              </>
            )}

            {tab==="week"&&(
              <>
                <div style={S.secLbl}>Week at a glance</div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {wDays.map(day=>{
                    const ds=day.toISOString().split("T")[0];
                    const daySh2=shifts.filter(s=>s.date===ds),isWork=daySh2.length>0,isTod=sameDay(day,today);
                    const abbr=DAYS[day.getDay()],dayP2=pris.filter(p=>p.days.length===0||p.days.includes(abbr));
                    const totH2=daySh2.reduce((a,s)=>a+shiftHrs(s),0);
                    return(
                      <div key={ds} onClick={()=>{setSelDay(day);setTab("home");}}
                        style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:13,cursor:"pointer",background:isTod?"#1e1e2e":"#13131f",border:isTod?"1px solid #2a2a4a":"1px solid #1a1a2a"}}>
                        <div style={{width:36,flexShrink:0}}>
                          <div style={{fontSize:11,fontWeight:700,color:isWork?"#f59e0b":"#10b981",letterSpacing:"0.04em"}}>{DAYS[day.getDay()].toUpperCase()}</div>
                          <div style={{fontSize:13,fontWeight:600,color:isTod?"#fff":"#6b6b8a"}}>{day.getDate()}</div>
                        </div>
                        <span style={{fontSize:18,flexShrink:0}}>{isWork?"💼":"🌿"}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:600,color:isWork?"#fff":"#10b981",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                            {isWork?daySh2.map(s=>{const[sh,sm]=s.startTime.split(":").map(Number),[eh,em]=s.endTime.split(":").map(Number);return`${fmt12(sh,sm)}–${fmt12(eh,em)}`;}).join(", "):"Day off"}
                          </div>
                          {dayP2.length>0&&<div style={{fontSize:11,color:"#4a4a6a",marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{dayP2.map(p=>p.name).join(" · ")}</div>}
                        </div>
                        {isWork?<span style={S.badge}>{totH2}h</span>:<span style={{fontSize:11,fontWeight:700,color:"#10b981",background:"rgba(16,185,129,.1)",borderRadius:20,padding:"3px 10px"}}>Free</span>}
                        <button style={{background:"transparent",border:"none",color:"#2a2a4a",cursor:"pointer",fontSize:16,padding:"4px 6px"}}
                          onClick={e=>{e.stopPropagation();setSelDay(day);setNewSh(s=>({...s,date:ds}));setEditShId(null);setShowAddSh(true);}}>+</button>
                      </div>
                    );
                  })}
                </div>
                <div style={{display:"flex",gap:8,marginTop:4}}>
                  {[["#f59e0b",totWorkH+"h","work"],["#6366f1",totPriH+"h","priorities"],["#10b981",trueFree+"h","free"]].map(([col,val,lbl])=>(
                    <div key={lbl} style={{flex:1,background:"#13131f",border:"1px solid #1a1a2a",borderRadius:12,padding:"10px 14px",textAlign:"center"}}>
                      <div style={{fontSize:20,fontWeight:700,color:col}}>{val}</div>
                      <div style={{fontSize:11,color:"#4a4a6a",marginTop:2}}>{lbl}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {tab==="priorities"&&(
              <>
                <div style={S.secLbl}>My priorities</div>
                {pris.length===0?<div style={{...S.card,textAlign:"center",padding:"32px 0",color:"#3a3a5a",fontSize:14}}>No priorities yet</div>:(
                  <div style={S.card}>
                    {pris.map((p,i)=>(
                      <div key={p.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:i<pris.length-1?"1px solid #1a1a2a":"none"}}>
                        <div style={{width:4,borderRadius:4,alignSelf:"stretch",background:p.color,flexShrink:0}}/>
                        <div style={{flex:1,marginLeft:4}}>
                          <div style={{fontSize:14,color:"#fff",fontWeight:500}}>{p.name}</div>
                          <div style={{fontSize:11,color:"#4a4a6a",marginTop:2}}>{p.days.length>0?p.days.join(" · "):"Every day"} · {fmtDur(p.duration??1)}{(p.travelMins??0)>0?` · 🚗 ${p.travelMins}m`:""}</div>
                        </div>
                        <button style={S.editBtn} onClick={()=>openEditP(p)}>&#9998;</button>
                        <button style={S.delBtn}  onClick={()=>delP(p.id)}>&#215;</button>
                      </div>
                    ))}
                  </div>
                )}
                <button style={S.addBtn} onClick={()=>{setEditPId(null);setDurUnit("hrs");setNewP({name:"",color:"#f59e0b",days:[],duration:1,travelMins:0});setShowAddP(true);}}>+ Add priority</button>
              </>
            )}

            {tab==="settings"&&(
              <>
                <div style={S.secLbl}>Account</div>
                <div style={S.card}>
                  <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0",borderBottom:"1px solid #1a1a2a"}}>
                    <span style={{fontSize:14,color:"#6b6b8a"}}>Name</span>
                    <span style={{fontSize:13,color:"#fff",fontWeight:500}}>{user?.name}</span>
                  </div>
                  {user?.email&&(
                    <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0"}}>
                      <span style={{fontSize:14,color:"#6b6b8a"}}>Email</span>
                      <span style={{fontSize:13,color:"#fff",fontWeight:500}}>{user.email}</span>
                    </div>
                  )}
                </div>
                <button style={{...S.ghostBtn,color:"#ef4444",borderColor:"#2a1a1a"}} onClick={doSignOut}>Sign out</button>
                <div style={S.secLbl}>Sleep settings</div>
                <div style={S.card}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:600,color:"#fff"}}>Average sleep</div>
                      <div style={{fontSize:12,color:"#6b6b8a",marginTop:2}}>Used to calculate free time</div>
                    </div>
                    <div><span style={{fontSize:26,fontWeight:700,color:"#f59e0b"}}>{sleepH}</span><span style={{fontSize:13,color:"#6b6b8a",marginLeft:4}}>hrs</span></div>
                  </div>
                  <input type="range" min="4" max="12" step="0.5" value={sleepH} onChange={e=>setSleepH(Number(e.target.value))} style={{width:"100%",accentColor:"#f59e0b"}}/>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
                    <span style={{fontSize:11,color:"#3a3a5a"}}>4 hrs</span><span style={{fontSize:11,color:"#3a3a5a"}}>12 hrs</span>
                  </div>
                  <div style={{marginTop:14,padding:"10px 12px",background:"#0d0d14",borderRadius:10,display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontSize:13,color:"#6b6b8a"}}>Waking hours/day</span>
                    <span style={{fontSize:13,fontWeight:700,color:"#10b981"}}>{wakingH} hrs</span>
                  </div>
                </div>
                <div style={S.secLbl}>About</div>
                <div style={S.card}>
                  {[["Version","0.1.0"],["Built for","Shift workers"],["Shifts logged",shifts.length+""]].map(([k,v])=>(
                    <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"12px 0",borderBottom:"1px solid #1a1a2a"}}>
                      <span style={{fontSize:14,color:"#6b6b8a"}}>{k}</span>
                      <span style={{fontSize:13,color:"#fff",fontWeight:500}}>{v}</span>
                    </div>
                  ))}
                </div>
                <button style={S.ghostBtn} onClick={()=>setShifts([])}>Clear all shifts</button>
              </>
            )}

          </div>

          <div style={S.tabBar}>
            {[["home","⊡","HOME"],["week","◫","WEEK"],["priorities","◈","FOCUS"],["settings","⊙","MORE"]].map(([id,icon,lbl])=>(
              <button key={id} style={S.tabItem(tab===id)} onClick={()=>setTab(id)}>
                <span style={{fontSize:20,lineHeight:1}}>{icon}</span><span>{lbl}</span>
              </button>
            ))}
          </div>

          {showAddSh&&(
            <div style={S.modal} onClick={e=>{if(e.target===e.currentTarget){setShowAddSh(false);setEditShId(null);}}}>
              <div style={S.sheet}>
                <div style={S.mTitle}>{editShId?"Edit shift":"Add shift"}</div>
                <div style={{display:"flex",flexDirection:"column",gap:16}}>
                  <div><label style={S.fLbl}>Label</label><input style={S.inp} value={newSh.label} onChange={e=>setNewSh(s=>({...s,label:e.target.value}))} placeholder="Work, On-call..."/></div>
                  <div><label style={S.fLbl}>Date</label><input type="date" style={S.inp} value={newSh.date} onChange={e=>setNewSh(s=>({...s,date:e.target.value}))}/></div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <div><label style={S.fLbl}>Start</label><input type="time" style={S.inp} value={newSh.startTime} onChange={e=>setNewSh(s=>({...s,startTime:e.target.value}))}/></div>
                    <div><label style={S.fLbl}>End</label><input type="time" style={S.inp} value={newSh.endTime} onChange={e=>setNewSh(s=>({...s,endTime:e.target.value}))}/></div>
                  </div>
                  <div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <label style={S.fLbl}>Round-trip travel</label>
                      <div style={{display:"flex",alignItems:"center",gap:4}}>
                        <input type="number" min="0" max="300" step="5" value={newSh.travelMins}
                          onChange={e=>setNewSh(s=>({...s,travelMins:Math.max(0,Math.min(300,Number(e.target.value)||0))}))}
                          style={{...S.inp,width:60,textAlign:"center",padding:"5px 8px",fontSize:14,fontWeight:700,color:"#f59e0b"}}/>
                        <span style={{fontSize:12,color:"#4a4a6a"}}>min</span>
                      </div>
                    </div>
                    <input type="range" min="0" max="120" step="5" value={Math.min(newSh.travelMins,120)}
                      onChange={e=>setNewSh(s=>({...s,travelMins:Number(e.target.value)}))} style={{width:"100%",accentColor:"#f59e0b"}}/>
                  </div>
                  <button style={S.addBtn} onClick={saveSh}>{editShId?"Save changes":"Save shift"}</button>
                  <button style={S.ghostBtn} onClick={()=>{setShowAddSh(false);setEditShId(null);}}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {showAddP&&(
            <div style={S.modal} onClick={e=>{if(e.target===e.currentTarget){setShowAddP(false);setEditPId(null);}}}>
              <div style={S.sheet}>
                <div style={S.mTitle}>{editPId?"Edit priority":"Add priority"}</div>
                <div style={{display:"flex",flexDirection:"column",gap:16}}>
                  <div><label style={S.fLbl}>Name</label><input style={S.inp} value={newP.name} onChange={e=>setNewP(p=>({...p,name:e.target.value}))} placeholder="Gym, Reading..."/></div>
                  <div>
                    <label style={S.fLbl}>Color</label>
                    <div style={{display:"flex",gap:10,marginTop:4}}>
                      {P_COLORS.map(c=><div key={c} style={S.colDot(c,newP.color===c)} onClick={()=>setNewP(p=>({...p,color:c}))}/>)}
                    </div>
                  </div>
                  <div>
                    <label style={S.fLbl}>Preferred days</label>
                    <div style={{display:"flex",gap:5,marginTop:4}}>
                      {DAYS.map(d=><div key={d} style={S.dayTog(newP.days.includes(d))} onClick={()=>togDay(d)}>{d[0]}</div>)}
                    </div>
                    <div style={{fontSize:11,color:"#3a3a5a",marginTop:6}}>{newP.days.length===0?"No days selected — shows every day":`${newP.days.length} day${newP.days.length!==1?"s":""} selected`}</div>
                  </div>
                  <div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <label style={S.fLbl}>Time per session</label>
                      <div style={{display:"flex",borderRadius:8,overflow:"hidden",border:"1px solid #2a2a3e"}}>
                        {["hrs","mins"].map(u=>(
                          <button key={u} onClick={()=>setDurUnit(u)}
                            style={{padding:"4px 10px",fontSize:11,fontWeight:700,border:"none",cursor:"pointer",background:durUnit===u?newP.color:"#0d0d14",color:durUnit===u?"#0d0d14":"#4a4a6a"}}>
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <input type="number" min="0" step={durUnit==="hrs"?0.5:5}
                        value={durUnit==="hrs"?newP.duration:Math.round(newP.duration*60)}
                        onChange={e=>{const raw=Number(e.target.value)||0;setNewP(p=>({...p,duration:Math.round((durUnit==="hrs"?Math.max(0,raw):Math.max(0,raw)/60)*100)/100}));}}
                        style={{...S.inp,flex:1,textAlign:"center",padding:"8px",fontSize:16,fontWeight:700,color:newP.color}}/>
                      <span style={{fontSize:13,color:"#4a4a6a",flexShrink:0}}>{durUnit}</span>
                    </div>
                    <input type="range" min="0" max={durUnit==="hrs"?12:720} step={durUnit==="hrs"?0.5:5}
                      value={durUnit==="hrs"?Math.min(newP.duration,12):Math.min(Math.round(newP.duration*60),720)}
                      onChange={e=>{const raw=Number(e.target.value);setNewP(p=>({...p,duration:Math.round((durUnit==="hrs"?raw:raw/60)*100)/100}));}}
                      style={{width:"100%",accentColor:newP.color,marginTop:8}}/>
                  </div>
                  <div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <label style={S.fLbl}>Round-trip travel</label>
                      <div style={{display:"flex",alignItems:"center",gap:4}}>
                        <input type="number" min="0" max="300" step="5" value={newP.travelMins}
                          onChange={e=>setNewP(p=>({...p,travelMins:Math.max(0,Math.min(300,Number(e.target.value)||0))}))}
                          style={{...S.inp,width:60,textAlign:"center",padding:"5px 8px",fontSize:14,fontWeight:700,color:newP.color}}/>
                        <span style={{fontSize:12,color:"#4a4a6a"}}>min</span>
                      </div>
                    </div>
                    <input type="range" min="0" max="120" step="5" value={Math.min(newP.travelMins,120)}
                      onChange={e=>setNewP(p=>({...p,travelMins:Number(e.target.value)}))} style={{width:"100%",accentColor:newP.color}}/>
                  </div>
                  <button style={S.addBtn} onClick={saveP}>{editPId?"Save changes":"Save priority"}</button>
                  <button style={S.ghostBtn} onClick={()=>{setShowAddP(false);setEditPId(null);}}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {delShId&&(
            <div style={S.modal} onClick={e=>{if(e.target===e.currentTarget)setDelShId(null);}}>
              <div style={S.sheet}>
                <div style={S.mTitle}>Remove shift?</div>
                <p style={{color:"#6b6b8a",fontSize:14,marginBottom:20}}>This shift will be removed from your schedule.</p>
                <button style={{...S.addBtn,background:"#ef4444",marginBottom:10}} onClick={()=>delSh(delShId)}>Remove</button>
                <button style={S.ghostBtn} onClick={()=>setDelShId(null)}>Cancel</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
