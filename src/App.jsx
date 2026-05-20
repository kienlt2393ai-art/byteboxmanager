import { useState, useMemo, useRef, useEffect } from "react";
import { supabase } from "./supabase";
import {
  Package, Plus, Search, AlertTriangle, ClipboardList,
  ArrowDownToLine, X, Check, Trash2, ChevronDown, TrendingDown,
  SlidersHorizontal, RotateCcw, Edit2, LogOut, ShieldCheck,
  Sparkles, Send, ChevronRight, TrendingUp, Lock, Settings
} from "lucide-react";

const todayVN    = () => new Date().toLocaleDateString("vi-VN");
const vnd        = n  => (n||0).toLocaleString("vi-VN") + "đ";
const parseCur   = s  => parseInt((s||"").replace(/\D/g,""))||0;
const fmtCur     = s  => { const n=s.replace(/\D/g,""); return n?parseInt(n).toLocaleString("vi-VN"):""; };
const stockColor = p  => p.stock===0?"text-red-400":p.stock<=p.threshold?"text-amber-400":"text-emerald-400";
const stockBarClr= p  => p.stock===0?"bg-red-500":p.stock<=p.threshold?"bg-amber-400":"bg-emerald-400";
const stockBorder= p  => p.stock===0?"border-red-500/25 bg-red-500/5":p.stock<=p.threshold?"border-amber-500/25 bg-amber-500/5":"border-gray-700/40 bg-gray-800/30";
const acct       = em => ACCOUNTS.find(a=>a.email===em);

const ACCOUNTS = [
  { name:"Chủ quán", email:"kienlt2393@gmail.com", role:"manager",  ini:"CQ", color:"bg-violet-500" },
  { name:"Minh",     email:"minh@bytebox.com",  role:"employee", ini:"M",  color:"bg-sky-500"    },
  { name:"Tuấn",     email:"tuan@bytebox.com",  role:"employee", ini:"T",  color:"bg-emerald-500"},
];

// DB ↔ App mapping
const dbToLog = l => ({...l, shiftType:l.shift_type, editedBy:l.edited_by, editedAt:l.edited_at});
const dbToImport = i => ({...i, pId:i.p_id});

function LoginScreen({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      }
    });
    if (error) setError(error.message);
    setLoading(false);
  };
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6" style={{fontFamily:"system-ui,sans-serif"}}>
      <div className="text-center mb-10">
        <div className="text-6xl mb-4">🎮</div>
        <h1 className="text-2xl font-bold text-white">Game Shop Manager</h1>
        <p className="text-gray-500 mt-2 text-sm">Bytebox Gaming</p>
      </div>
      <button onClick={handleGoogleLogin} disabled={loading}
        className="w-full max-w-xs flex items-center justify-center gap-3 bg-white text-gray-700 font-semibold text-sm py-3.5 px-5 rounded-2xl shadow-lg hover:bg-gray-50 disabled:opacity-50">
        <svg width="18" height="18" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        {loading ? "Đang đăng nhập..." : "Đăng nhập bằng Google"}
      </button>
      {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
    </div>
  );
}
function InventoryApp({ user, onLogout }) {
  const isManager = user.role==="manager";
  const [tingeeLoading, setTingeeLoading] = useState(false);
  const [checkTs, setCheckTs] = useState(null);
  const [shiftStartedAt] = useState(() => Date.now());
  const [tingeeResult,  setTingeeResult]  = useState(null);
  const [tab,         setTab]         = useState(0);
  const [products,    setProducts]    = useState([]);
  const [logs,        setLogs]        = useState([]);
  const [imports,     setImports]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [lastCheckTs, setLastCheckTs] = useState(0);
  const [search,      setSearch]      = useState("");
  const [filterLow,   setFilter]      = useState(false);
  const [modal,       setModal]       = useState(null);
  const [pForm,       setPForm]       = useState({name:"",unit:"",threshold:"",stock:"",price:""});
  const [iForm,       setIForm]       = useState({pId:"",qty:"",note:""});
  const [iSuccess,    setISuccess]    = useState(false);
  const [scStep,      setScStep]      = useState(0);
  const [scData,      setScData]      = useState({shiftType:"Sáng",closes:{},openingStocks:{},importedInShift:{}});
  const [tempItems,   setTempItems]   = useState([]);
  const [revData,     setRevData]     = useState({cash:"",tingee:"",netbarbox:""});
  const [expandedLog, setExpanded]    = useState(null);
  const [histDate,    setHistDate]    = useState("");
  const [editLog,     setEditLog]     = useState(null);
  const [editCloses,  setEditCloses]  = useState({});
  const [revDate,     setRevDate]     = useState("");
  const [expandedRev, setExpandedRev] = useState(null);
  const [aiMessages,  setAiMessages]  = useState([]);
  const [aiInput,     setAiInput]     = useState("");
  const [aiLoading,   setAiLoading]   = useState(false);
  const [apiKey,      setApiKey]      = useState(()=>localStorage.getItem("gsm_api_key")||"");
  const [showApiModal,setShowApiModal]= useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const aiBottomRef = useRef(null);
  useEffect(()=>{aiBottomRef.current?.scrollIntoView({behavior:"smooth"});},[aiMessages,aiLoading]);

  // ── Load data from Supabase ──────────────────────────────────
  useEffect(()=>{ loadData(); },[]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: prods }, { data: shiftLogs }, { data: imps }] = await Promise.all([
        supabase.from("products").select("*").order("id"),
        supabase.from("shift_logs").select("*").order("created_at", { ascending: false }),
        supabase.from("imports").select("*").order("created_at", { ascending: false }),
      ]);
      if (prods) setProducts(prods);
      if (shiftLogs) {
        setLogs(shiftLogs.map(dbToLog));
        if (shiftLogs.length > 0)
          setLastCheckTs(new Date(shiftLogs[0].created_at).getTime());
      }
      if (imps) setImports(imps.map(dbToImport));
    } catch(err) { console.error("Load error:", err); }
    setLoading(false);
  };

  // Derived
  const lowCount         = products.filter(p=>p.stock<=p.threshold).length;
  const anyImportInShift = Object.values(scData.importedInShift||{}).some(v=>v>0);
  const filtered   = useMemo(()=>products.filter(p=>!filterLow||p.stock<=p.threshold).filter(p=>!search||p.name.toLowerCase().includes(search.toLowerCase())),[products,filterLow,search]);
  const histDates  = useMemo(()=>[...new Set(logs.map(l=>l.date))],[logs]);
  const filteredLogs     = useMemo(()=>histDate?logs.filter(l=>l.date===histDate):logs,[logs,histDate]);
  const logsWithRev      = useMemo(()=>logs.filter(l=>l.revenue),[logs]);
  const revDates         = useMemo(()=>[...new Set(logsWithRev.map(l=>l.date))],[logsWithRev]);
  const filteredRevLogs  = useMemo(()=>revDate?logsWithRev.filter(l=>l.date===revDate):logsWithRev,[logsWithRev,revDate]);
  const totalNetbarbox   = useMemo(()=>logsWithRev.reduce((s,l)=>s+(l.revenue?.netbarbox||0),0),[logsWithRev]);
  const totalEmployeeCash= useMemo(()=>logsWithRev.reduce((s,l)=>s+(l.revenue?.cash||0),0),[logsWithRev]);
  const shiftDiscrepancies=useMemo(()=>logsWithRev.filter(l=>{const exp=(l.revenue?.netbarbox||0)-(l.revenue?.tingee||0);return exp!==(l.revenue?.cash||0);}),[logsWithRev]);

  const getP = id => products.find(p=>p.id===id);

  const revCash=parseCur(revData.cash),revTingee=parseCur(revData.tingee),revNB=parseCur(revData.netbarbox);
  const revExpected=revNB-revTingee, revDiff=revExpected>0?revExpected-revCash:0;
  const goodsRevenue=tempItems.reduce((s,i)=>{const p=getP(i.pId);return s+i.sold*(p?.price||0);},0);

  // ── AI ───────────────────────────────────────────────────────
  const QUICK_AI=[
    {icon:"📦",label:"Tồn kho hôm nay",     prompt:"Tổng kết tình trạng tồn kho và sản phẩm cần nhập thêm"},
    {icon:"💰",label:"Phân tích doanh thu",  prompt:"Phân tích doanh thu các ca gần nhất, ca nào có vấn đề?"},
    {icon:"⚠️",label:"Ca nào bất thường?",  prompt:"Ca nào có dấu hiệu bất thường về tiền mặt hoặc tồn kho?"},
    {icon:"👥",label:"So sánh nhân viên",    prompt:"So sánh hiệu suất các nhân viên dựa trên dữ liệu ca"},
  ];
 const buildAIPrompt = () => {
  const low = products.filter(p => p.stock <= p.threshold);
  
  const stockLines = products.map(p =>
    `  ${p.name}: ${p.stock}${p.unit} (ngưỡng ${p.threshold}) ${p.stock===0?"🔴HẾT":p.stock<=p.threshold?"⚠️SẮP HẾT":"✅"} Giá:${vnd(p.price)}`
  ).join("\n");

  const shiftLines = logs.slice(0,10).map(l => {
    const sold = l.items?.map(i => { const p=getP(i.pId); return `${p?.name||"?"}×${i.sold}`; }).join(",") || "không có";
    const rev = l.revenue ? `TM:${vnd(l.revenue.cash)} Tingee:${vnd(l.revenue.tingee)} NB:${vnd(l.revenue.netbarbox)} Hàng:${vnd(l.revenue.goodsRevenue)}` : "";
    const total = l.revenue ? l.revenue.cash+l.revenue.tingee+(l.revenue.netbarbox||0)+(l.revenue.goodsRevenue||0) : 0;
    const isOk = l.isOk;
    return `  ${l.date} Ca ${l.shiftType}(${l.employee}) ${isOk?"✅":"⚠️LỆCH"} Tổng:${vnd(total)} | ${rev} | Bán:${sold}`;
  }).join("\n");

  const importLines = imports.slice(0,5).map(i =>
    `  ${i.date} ${i.employee}: ${i.items?.map(x=>{ const p=getP(x.pId); return `${p?.name||"?"}+${x.qty}`; }).join(",") || ""} Chi:${vnd(i.totalCost)}`
  ).join("\n");

  const totalRev = logs.reduce((s,l) => s+(l.revenue?(l.revenue.cash+l.revenue.tingee+(l.revenue.netbarbox||0)+(l.revenue.goodsRevenue||0)):0), 0);
  const totalTingee = logs.reduce((s,l) => s+(l.revenue?.tingee||0), 0);
  const totalCash = logs.reduce((s,l) => s+(l.revenue?.cash||0), 0);

  return `Bạn là trợ lý quản lý quán game Bytebox Gaming (36 máy, 2 nhân viên).
NGÀY HÔM NAY: ${todayVN()}

📦 TỒN KHO HIỆN TẠI:
${stockLines}
${low.length>0 ? `⚠️ CẦN NHẬP NGAY: ${low.map(p=>p.name).join(", ")}` : "✅ Tồn kho ổn định"}

📊 10 CA GẦN NHẤT:
${shiftLines || "Chưa có dữ liệu"}

📥 NHẬP KHO GẦN ĐÂY:
${importLines || "Chưa có"}

💰 TỔNG DOANH THU (${logs.length} ca):
  Tổng: ${vnd(totalRev)} | Tiền mặt: ${vnd(totalCash)} | Tingee: ${vnd(totalTingee)}
  Ca lệch: ${shiftDiscrepancies.length}/${logs.length} ca

Trả lời bằng tiếng Việt, ngắn gọn, thực tế. Có thể tư vấn về tồn kho, doanh thu, xu hướng bán hàng.`;
};
const sendAI = async (text) => {
  const t = text.trim(); if(!t||aiLoading) return;
  const next = [...aiMessages,{role:"user",content:t}];
  setAiMessages(next);setAiInput("");setAiLoading(true);
  try {
    const contents = next.map(m=>({
      role: m.role==="assistant"?"model":"user",
      parts:[{text:m.content}]
    }));
    const res = await fetch("/api/gemini", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({contents, systemPrompt:buildAIPrompt()})
    });
    const data = await res.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text||data.error?.message||"Không có phản hồi.";
    setAiMessages(prev=>[...prev,{role:"assistant",content:data.error?`❌ ${reply}`:reply}]);
  } catch {
    setAiMessages(prev=>[...prev,{role:"assistant",content:"❌ Lỗi kết nối."}]);
  }
  setAiLoading(false);
};
  // ── Product CRUD ─────────────────────────────────────────────
  const openAdd  = () => { setPForm({name:"",unit:"lon",threshold:"12",stock:"0",price:""}); setModal("add"); };
  const openEdit = p  => { setPForm({name:p.name,unit:p.unit,threshold:String(p.threshold),stock:String(p.stock),price:String(p.price||"")}); setModal(p); };

  const saveProduct = async () => {
    if(!pForm.name||!pForm.unit) return;
    const data={name:pForm.name,unit:pForm.unit,threshold:parseInt(pForm.threshold)||10,stock:parseInt(pForm.stock)||0,price:parseCur(pForm.price)};
    if(modal==="add"){
      const {data:newP}=await supabase.from("products").insert(data).select().single();
      if(newP) setProducts(prev=>[...prev,newP]);
    } else {
      await supabase.from("products").update(data).eq("id",modal.id);
      setProducts(prev=>prev.map(p=>p.id===modal.id?{...p,...data}:p));
    }
    setModal(null);
  };

  const deleteProduct = async id => {
    await supabase.from("products").delete().eq("id",id);
    setProducts(prev=>prev.filter(p=>p.id!==id));
    setModal(null);
  };

  // ── Import ───────────────────────────────────────────────────
  const submitImport = async () => {
    if(!iForm.pId||!iForm.qty) return;
    const qty=parseInt(iForm.qty), pId=parseInt(iForm.pId), ts=Date.now();
    const product=products.find(p=>p.id===pId);
    await supabase.from("products").update({stock:product.stock+qty}).eq("id",pId);
    const {data:newImp}=await supabase.from("imports").insert({p_id:pId,qty,note:iForm.note,date:todayVN(),ts}).select().single();
    setProducts(prev=>prev.map(p=>p.id===pId?{...p,stock:p.stock+qty}:p));
    if(newImp) setImports(prev=>[dbToImport(newImp),...prev]);
    setIForm({pId:"",qty:"",note:""});setISuccess(true);setTimeout(()=>setISuccess(false),2000);
  };

  // ── Shift check ──────────────────────────────────────────────
  const startCheck = () => {
    const closes={},openingStocks={},importedInShift={};
    products.forEach(p=>{
      const impQty=imports.filter(i=>i.pId===p.id&&i.ts>lastCheckTs).reduce((s,i)=>s+i.qty,0);
      importedInShift[p.id]=impQty;openingStocks[p.id]=p.stock-impQty;closes[p.id]="";
    });
    setScData(d=>({...d,closes,openingStocks,importedInShift}));setScStep(1);
  };

  const goToRevenue = () => {
    const items=products.map(p=>{
      const close=parseInt(scData.closes[p.id]);if(isNaN(close))return null;
      const open=scData.openingStocks[p.id]??p.stock,imp=scData.importedInShift[p.id]??0;
      return{pId:p.id,open,imported:imp,close,sold:Math.max(0,open+imp-close)};
    }).filter(Boolean);
const ts = Date.now();
setCheckTs(ts);
setTempItems(items);setRevData({cash:"",tingee:"",netbarbox:""});setScStep(2);fetchTingee(ts);
  };

  const submitCheck = async () => {
  const rev={cash:parseCur(revData.cash),tingee:parseCur(revData.tingee),netbarbox:parseCur(revData.netbarbox),goodsRevenue};
  try {
    const {data:newLog,error}=await supabase.from("shift_logs").insert({
      date:todayVN(),shift_type:scData.shiftType,employee:user.name,items:tempItems,revenue:rev,check_time:checkTs,edited_by:null,edited_at:null
    }).select().single();
    if(error) console.error("Supabase error:",error);
    for(const item of tempItems)
      await supabase.from("products").update({stock:item.close}).eq("id",item.pId);
    if(newLog) setLogs(prev=>[dbToLog(newLog),...prev]);
    setProducts(prev=>prev.map(p=>{const it=tempItems.find(i=>i.pId===p.id);return it?{...p,stock:it.close}:p;}));
  } catch(err) {
    console.error("Submit failed:",err);
  }
  // Gửi Telegram
const fmt = n => (n||0).toLocaleString("vi-VN") + "đ";
const checkTime = new Date(checkTs);
const timeStr = `${checkTime.toLocaleDateString("vi-VN")} ${String(checkTime.getHours()).padStart(2,"0")}:${String(checkTime.getMinutes()).padStart(2,"0")}`;
// Tin 1: Tổng kết ca
const soldItems = tempItems.filter(i => i.sold > 0).map(p => {
  const prod = products.find(x => x.id === p.pId);
  return "• " + (prod?.name || p.pId) + ": " + p.sold + " " + (prod?.unit || "");
}).join("\n") || "• Không có";

const msg1 = "📋 <b>Kiểm kê ca hoàn tất</b>\n" +
  "🏪 Bytebox Gaming\n" +
  "📅 " + timeStr + "\n" +
  "👤 " + user.name + " · " + scData.shiftType + "\n\n" +
  "💰 <b>Doanh thu:</b>\n" +
  "• Tiền mặt: " + fmt(rev.cash) + "\n" +
  "• Tingee (QR): " + fmt(rev.tingee) + "\n" +
  "• Netbarbox: " + fmt(rev.netbarbox) + "\n" +
  "• Hàng hóa: " + fmt(rev.goodsRevenue) + "\n" +
  "• Tổng: " + fmt(rev.cash+rev.tingee+rev.netbarbox+rev.goodsRevenue) + "\n\n" +
  "📦 <b>Hàng hóa đã bán:</b>\n" + soldItems;

fetch("/api/telegram", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({message:msg1}) });
// Tin 2: Cảnh báo tồn kho thấp
const lowStock = products.filter(p => p.stock <= p.threshold);
if (lowStock.length > 0) {
  const msg2 = `⚠️ <b>Cảnh báo tồn kho thấp</b>
🏪 Bytebox Gaming · ${timeStr}

${lowStock.map(p => `${p.stock === 0 ? "❌" : "🔴"} ${p.name}: còn ${p.stock} ${p.unit} (ngưỡng: ${p.threshold})`).join("\n")}`;
  fetch("/api/telegram", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({message:msg2}) });
}

setLastCheckTs(Date.now());setScStep(3);
  };

  // ── Manager edit ─────────────────────────────────────────────
  const openEditLog = log => {const c={};log.items?.forEach(i=>{c[i.pId]=String(i.close);});setEditCloses(c);setEditLog(log);};

  const saveEditLog = async () => {
    const items=editLog.items.map(item=>{
      const close=parseInt(editCloses[item.pId]??item.close);
      return{...item,close,sold:Math.max(0,item.open+item.imported-close)};
    });
    const newGR=items.reduce((s,item)=>{const p=getP(item.pId);return s+item.sold*(p?.price||0);},0);
    const update={items,revenue:editLog.revenue?{...editLog.revenue,goodsRevenue:newGR}:editLog.revenue,edited_by:user.name,edited_at:todayVN()};
    await supabase.from("shift_logs").update(update).eq("id",editLog.id);
    const updated={...editLog,...update,editedBy:user.name,editedAt:todayVN()};
    setLogs(prev=>prev.map(l=>l.id===editLog.id?updated:l));
    if(logs.length>0&&logs[0].id===editLog.id){
      for(const item of items)
        await supabase.from("products").update({stock:item.close}).eq("id",item.pId);
      setProducts(prev=>prev.map(p=>{const it=items.find(i=>i.pId===p.id);return it?{...p,stock:it.close}:p;}));
    }
    setEditLog(null);
  };
const fetchTingee = async (endTs) => {
  setTingeeLoading(true);
  try {
    const res = await fetch("/api/tingee",{method:"POST",headers:{"Content-Type":"application/json"},body: JSON.stringify({
  startTimestamp: lastCheckTs,
  endTimestamp: endTs || Date.now(),
})});
    const data = await res.json();
    if(data.error){alert("Lỗi: "+data.error);return;}
    setTingeeResult(data);
    setRevData(d=>({...d,tingee:data.total.toLocaleString("vi-VN")}));
  } catch{alert("Không kết nối được Tingee");}
  finally{setTingeeLoading(false);}
};
  const ua=acct(user.email);
  const TABS=[
    {label:"Tổng quan",Icon:Package},{label:"Nhập kho",Icon:ArrowDownToLine},
    {label:"Kiểm kê ca",Icon:ClipboardList},{label:"Doanh thu",Icon:TrendingUp},{label:"Trợ lý AI",Icon:Sparkles},
  ];

  // ── Loading screen ───────────────────────────────────────────
  if(loading) return(
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4" style={{fontFamily:"system-ui,sans-serif"}}>
      <div className="text-5xl">🎮</div>
      <p className="text-gray-400 text-sm">Đang tải dữ liệu...</p>
      <div className="flex gap-1.5">{[0,1,2].map(i=><div key={i} className="w-2 h-2 rounded-full bg-violet-400" style={{animation:`bounce 0.9s ${i*0.2}s infinite`}}/>)}</div>
    </div>
  );

  return(
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col max-w-md mx-auto relative select-none" style={{fontFamily:"system-ui,sans-serif"}}>
      {/* Header */}
      <div className="px-4 pt-5 pb-3 bg-gray-950 sticky top-0 z-10 border-b border-gray-800/60">
        <div className="flex items-center justify-between">
          <div><h1 className="text-base font-bold text-white">{["📦 Tổng quan","📦 Nhập kho","📋 Kiểm kê ca","💰 Doanh thu","🤖 Trợ lý AI"][tab]}</h1><p className="text-xs text-gray-500 mt-0.5">Bytebox Gaming · {todayVN()}</p></div>
          <div className="flex items-center gap-2">
            {lowCount>0&&<div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/25 rounded-full px-2.5 py-1"><AlertTriangle size={11} className="text-amber-400"/><span className="text-xs font-semibold text-amber-400">{lowCount}</span></div>}
            <div className="flex items-center gap-1.5 bg-gray-800/80 border border-gray-700/50 rounded-full pl-1 pr-2.5 py-1">
              <div className={`w-6 h-6 rounded-full ${ua?.color||"bg-gray-500"} flex items-center justify-center text-white text-xs font-bold`}>{user.ini}</div>
              <span className="text-xs font-medium text-gray-300">{user.name}</span>
              {isManager&&<ShieldCheck size={11} className="text-violet-400"/>}
              <button onClick={onLogout} className="ml-1 text-gray-600 hover:text-gray-400"><LogOut size={12}/></button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-20">
        {/* TAB 0: Overview */}
        {tab===0&&(
          <div className="px-4 pt-4 space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm sản phẩm..." className="w-full bg-gray-800/80 border border-gray-700/60 rounded-xl pl-8 pr-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 outline-none focus:border-violet-500"/></div>
              <button onClick={()=>setFilter(f=>!f)} className={`px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 ${filterLow?"bg-amber-500/15 border-amber-500/35 text-amber-400":"bg-gray-800/80 border-gray-700/60 text-gray-500"}`}><SlidersHorizontal size={13}/>{filterLow?"Sắp hết":"Lọc"}</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[{label:"Sản phẩm",val:products.length,color:"text-violet-400"},{label:"Sắp hết",val:lowCount,color:"text-amber-400"},{label:"Hết hàng",val:products.filter(p=>p.stock===0).length,color:"text-red-400"}].map(s=>(
                <div key={s.label} className="rounded-xl p-3 border border-gray-700/40 bg-gray-800/20 text-center"><div className={`text-2xl font-bold ${s.color}`}>{s.val}</div><div className="text-xs text-gray-500 mt-0.5">{s.label}</div></div>
              ))}
            </div>
            {products.length===0?(
              <div className="text-center py-12">
                <p className="text-gray-500 text-sm mb-3">Chưa có sản phẩm nào</p>
                <button onClick={openAdd} className="px-4 py-2 bg-violet-600 rounded-xl text-white text-sm font-semibold">Thêm sản phẩm đầu tiên</button>
              </div>
            ):(
              <div className="space-y-2">
                {filtered.map(p=>(
                  <div key={p.id} onClick={()=>openEdit(p)} className={`flex items-center justify-between rounded-xl p-3.5 border cursor-pointer ${stockBorder(p)}`}>
                    <div className="flex items-center gap-3"><div className={`w-1.5 h-9 rounded-full ${stockBarClr(p)}`}/><div><div className="text-sm font-semibold text-white">{p.name}</div><div className="text-xs text-gray-500 mt-0.5">{vnd(p.price)} · Ngưỡng: {p.threshold} {p.unit}</div></div></div>
                    <div className="text-right"><div className={`text-xl font-bold ${stockColor(p)}`}>{p.stock}</div><div className="text-xs text-gray-500">{p.unit}</div></div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={openAdd} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-violet-500/30 text-violet-400 text-sm hover:bg-violet-500/5"><Plus size={15}/>Thêm sản phẩm mới</button>
          </div>
        )}

        {/* TAB 1: Import */}
        {tab===1&&(
          <div className="px-4 pt-4 space-y-4">
            <div className="bg-gray-800/40 rounded-2xl border border-gray-700/50 p-4 space-y-3">
              <h2 className="font-bold text-white text-sm">Nhập hàng mới</h2>
              <select value={iForm.pId} onChange={e=>setIForm(f=>({...f,pId:e.target.value}))} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-100 outline-none focus:border-violet-500">
                <option value="">— Chọn sản phẩm —</option>
                {products.map(p=><option key={p.id} value={p.id}>{p.name} (Tồn: {p.stock} {p.unit})</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500 mb-1.5 block">Số lượng</label><input type="number" value={iForm.qty} onChange={e=>setIForm(f=>({...f,qty:e.target.value}))} placeholder="0" className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"/></div>
                <div><label className="text-xs text-gray-500 mb-1.5 block">Ghi chú</label><input value={iForm.note} onChange={e=>setIForm(f=>({...f,note:e.target.value}))} placeholder="Tùy chọn..." className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"/></div>
              </div>
              <button onClick={submitImport} disabled={!iForm.pId||!iForm.qty} className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 ${iSuccess?"bg-emerald-500 text-white":iForm.pId&&iForm.qty?"bg-violet-600 hover:bg-violet-500 text-white":"bg-gray-800 text-gray-600"}`}>
                {iSuccess?<><Check size={15}/>Đã nhập!</>:<><ArrowDownToLine size={15}/>Xác nhận nhập kho</>}
              </button>
            </div>
            <div className="space-y-2">
              {imports.slice(0,10).map(imp=>{const p=getP(imp.pId),isNew=imp.ts>lastCheckTs;return(
                <div key={imp.id} className="flex items-center justify-between bg-gray-800/30 rounded-xl px-3.5 py-3 border border-gray-700/30">
                  <div><div className="flex items-center gap-2"><span className="text-sm font-semibold text-white">{p?.name||"?"}</span>{isNew&&<span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">Ca này</span>}</div><div className="text-xs text-gray-500">{imp.date}{imp.note?` · ${imp.note}`:""}</div></div>
                  <div className="text-emerald-400 font-bold text-sm">+{imp.qty} {p?.unit}</div>
                </div>
              );})}
            </div>
          </div>
        )}

        {/* TAB 2: Shift check */}
        {tab===2&&(
          <div className="px-4 pt-4">
            {scStep===0&&(
              <div className="space-y-4">
                <div className="bg-gray-800/40 rounded-2xl border border-gray-700/50 p-4 space-y-3">
                  <h2 className="font-bold text-white text-sm">Kiểm kê cuối ca</h2>
                  <div className="w-full bg-gray-900/60 border border-gray-700/50 rounded-xl px-3 py-2.5 text-sm text-gray-300 flex items-center gap-2">
                    <div className={`w-5 h-5 rounded-full ${ua?.color||"bg-gray-500"} flex items-center justify-center text-white text-xs font-bold`}>{user.ini}</div>
                    {user.name}<span className="ml-auto text-xs text-gray-600">Tự động điền</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {["Sáng","Chiều tối"].map(s=>(
                      <button key={s} onClick={()=>setScData(d=>({...d,shiftType:s}))} className={`py-2.5 rounded-xl text-sm font-semibold border ${scData.shiftType===s?"bg-violet-600/70 border-violet-500/60 text-white":"bg-gray-900 border-gray-700 text-gray-500"}`}>
                        {s==="Sáng"?"☀️ Sáng (8–15h)":"🌙 Tối (15–23h)"}
                      </button>
                    ))}
                  </div>
                  <button onClick={startCheck} className="w-full py-3 bg-violet-600 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2"><ClipboardList size={15}/>Bắt đầu kiểm kê</button>
                </div>
                {logs.length>0&&<div className="bg-gray-800/20 rounded-xl border border-gray-700/30 p-3.5"><p className="text-xs text-gray-600 mb-1">Kiểm kê gần nhất</p><p className="text-sm text-gray-300 font-medium">Ca {logs[0].shiftType} · {logs[0].date}</p><p className="text-xs text-gray-500">NV: {logs[0].employee}</p></div>}
              </div>
            )}
            {scStep===1&&(
              <div className="space-y-3">
                <div className="flex items-center justify-between"><div><h2 className="font-bold text-white text-sm">Bước 1 — Tồn kho</h2><p className="text-xs text-gray-500">Ca {scData.shiftType} · {user.name}</p></div><button onClick={()=>setScStep(0)} className="text-gray-600 p-1"><X size={18}/></button></div>
                {anyImportInShift&&<div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2.5 flex gap-2"><span>ℹ️</span><p className="text-xs text-blue-300">Có hàng nhập — Bán ra = Đầu + Nhập − Cuối</p></div>}
                <div className="grid grid-cols-12 text-xs text-gray-600 px-2 pb-0.5"><div className="col-span-4">Sản phẩm</div><div className="col-span-2 text-center">Đầu</div><div className="col-span-2 text-center">+Nhập</div><div className="col-span-4 text-center">Cuối</div></div>
                <div className="space-y-2">
                  {products.map(p=>{
                    const cs=scData.closes[p.id]??"",cn=parseInt(cs),open=scData.openingStocks[p.id]??p.stock,imp=scData.importedInShift[p.id]??0,sold=!isNaN(cn)?Math.max(0,open+imp-cn):null;
                    return(
                      <div key={p.id} className="bg-gray-800/30 rounded-xl border border-gray-700/40 p-3">
                        <div className="grid grid-cols-12 items-center gap-1">
                          <div className="col-span-4"><div className="text-sm font-semibold text-white leading-tight">{p.name}</div><div className="text-xs text-gray-600">{p.unit}</div></div>
                          <div className="col-span-2 text-center text-base font-bold text-gray-300">{open}</div>
                          <div className="col-span-2 text-center"><span className={`text-sm font-semibold ${imp>0?"text-emerald-400":"text-gray-700"}`}>{imp>0?`+${imp}`:"—"}</span></div>
                          <div className="col-span-4"><input type="number" value={cs} onChange={e=>setScData(d=>({...d,closes:{...d.closes,[p.id]:e.target.value}}))} placeholder="—" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-2 text-sm text-center text-white outline-none focus:border-violet-500"/></div>
                        </div>
                        {sold!==null&&<div className="mt-2 flex items-center gap-1.5"><TrendingDown size={11} className="text-gray-600"/><span className="text-xs text-gray-500">Bán ra: <span className={`font-bold ${sold>0?"text-amber-400":"text-gray-600"}`}>{sold} {p.unit}</span>{p.price>0&&sold>0&&<span className="text-gray-600 ml-1">= {vnd(sold*p.price)}</span>}</span></div>}
                      </div>
                    );
                  })}
                </div>
                <button onClick={goToRevenue} className="w-full py-3.5 bg-violet-600 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2"><Check size={16}/>Tiếp theo: Nhập doanh thu</button>
              </div>
            )}
            {scStep===2&&(
              <div className="space-y-4">
                <div className="flex items-center justify-between"><div><h2 className="font-bold text-white text-sm">Bước 2 — Doanh thu</h2><p className="text-xs text-gray-500">Ca {scData.shiftType} · {user.name}</p></div><button onClick={()=>setScStep(1)} className="text-gray-600 p-1"><X size={18}/></button></div>
                {goodsRevenue>0&&(
                  <div className="bg-gray-800/40 rounded-xl border border-gray-700/50 p-3.5">
                    <div className="flex justify-between mb-2"><p className="text-xs text-gray-400">Doanh thu hàng hóa</p><span className="text-sm font-bold text-emerald-400">{vnd(goodsRevenue)}</span></div>
                    {tempItems.filter(i=>{const p=getP(i.pId);return i.sold>0&&(p?.price||0)>0;}).map(i=>{const p=getP(i.pId);return<div key={i.pId} className="flex justify-between text-xs text-gray-500"><span>{p?.name}×{i.sold}</span><span>{vnd(i.sold*(p?.price||0))}</span></div>;})}
                  </div>
                )}
                <div className="bg-gray-800/40 rounded-2xl border border-gray-700/50 p-4 space-y-3">
                <div>
  <label className="text-xs text-gray-500 mb-1.5 block">💵 Tiền mặt</label>
  <input type="text" value={revData.cash} onChange={e=>setRevData(d=>({...d,cash:fmtCur(e.target.value)}))} placeholder="0" className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"/>
</div>
<div>
  <label className="text-xs text-gray-500 mb-1.5 block">📱 Tingee (QR)</label>
  <div>
    <input type="text" value={revData.tingee} onChange={e=>setRevData(d=>({...d,tingee:fmtCur(e.target.value)}))} placeholder="0" className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"/>
  </div>
  {checkTs && <p className="text-xs text-gray-400 mb-3">🕐 Thời gian giao ca: {new Date(checkTs).toLocaleDateString("vi-VN")} {String(new Date(checkTs).getHours()).padStart(2,"0")}:{String(new Date(checkTs).getMinutes()).padStart(2,"0")}</p>}
  {tingeeResult&&<p className="text-xs text-emerald-400 mt-1.5">✅ {tingeeResult.count} GD · {vnd(tingeeResult.total)}</p>}
</div>
<div>
  <label className="text-xs text-gray-500 mb-1.5 block">💻 Netbarbox</label>
  <input type="text" value={revData.netbarbox} onChange={e=>setRevData(d=>({...d,netbarbox:fmtCur(e.target.value)}))} placeholder="0" className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"/>
</div>
                </div>
                {revNB>0&&(
                  <div className={`rounded-xl border p-4 space-y-2 ${revDiff===0?"bg-emerald-500/8 border-emerald-500/25":"bg-amber-500/8 border-amber-500/25"}`}>
                    <div className="flex justify-between text-xs"><span className="text-gray-400">Kỳ vọng (NB−Tingee)</span><span className="text-gray-200">{vnd(revExpected)}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-gray-400">Thực tế</span><span className="text-gray-200">{vnd(revCash)}</span></div>
                    <div className={`flex justify-between text-sm font-bold border-t border-gray-700/40 pt-2 ${revDiff===0?"text-emerald-400":"text-amber-400"}`}><span>Chênh lệch</span><span>{revDiff===0?"✅ Khớp":`⚠️ ${vnd(revDiff)}`}</span></div>
                  </div>
                )}
                <button onClick={submitCheck} className="w-full py-3.5 bg-violet-600 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2"><Check size={16}/>Hoàn tất kiểm kê</button>
                <p className="text-xs text-gray-600 text-center">Có thể bỏ qua nếu chưa có số liệu</p>
              </div>
            )}
            {scStep===3&&(
              <div className="flex flex-col items-center justify-center py-14 space-y-5">
                <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center"><Check size={32} className="text-emerald-400"/></div>
                <div className="text-center"><h2 className="text-xl font-bold text-white">Kiểm kê hoàn tất!</h2><p className="text-sm text-gray-400 mt-1.5">Đã lưu vào hệ thống</p></div>
                <div className="flex gap-3 w-full">
                  <button onClick={()=>{setScStep(0);setTab(3);}} className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-300 text-sm font-semibold">Xem doanh thu</button>
                  <button onClick={()=>setScStep(0)} className="flex-1 py-3 rounded-xl bg-violet-600 text-white text-sm font-bold flex items-center justify-center gap-1.5"><RotateCcw size={14}/>Kiểm kê mới</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Revenue */}
        {tab===3&&(
          <div className="px-4 pt-4 space-y-5">
            {!isManager?(
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <div className="w-16 h-16 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center"><Lock size={24} className="text-gray-500"/></div>
                <p className="text-white font-semibold">Chỉ dành cho quản lý</p>
              </div>
            ):(
              <>
                <div className="grid grid-cols-2 gap-2">
                  {[{label:"Tổng NB",val:vnd(totalNetbarbox),color:"text-violet-400"},{label:"Ca có lệch",val:String(shiftDiscrepancies.length),color:shiftDiscrepancies.length>0?"text-amber-400":"text-emerald-400"}].map(s=>(
                    <div key={s.label} className="rounded-xl p-3.5 border border-gray-700/40 bg-gray-800/20"><div className={`text-lg font-bold ${s.color}`}>{s.val}</div><div className="text-xs text-gray-500 mt-0.5">{s.label}</div></div>
                  ))}
                </div>
                <div>
                  <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
                    <button onClick={()=>setRevDate("")} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border ${!revDate?"bg-violet-600/70 border-violet-500/50 text-white":"bg-gray-800/60 border-gray-700/50 text-gray-500"}`}>Tất cả</button>
                    {revDates.map(d=><button key={d} onClick={()=>setRevDate(revDate===d?"":d)} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border ${revDate===d?"bg-violet-600/70 border-violet-500/50 text-white":"bg-gray-800/60 border-gray-700/50 text-gray-500"}`}>{d}</button>)}
                  </div>
                  {filteredRevLogs.length===0?<p className="text-center text-gray-600 text-sm py-8">Chưa có dữ liệu doanh thu</p>:(
                    <div className="space-y-2">
                      {filteredRevLogs.map(log=>{
                        const expCash=(log.revenue?.netbarbox||0)-(log.revenue?.tingee||0),diff=expCash-(log.revenue?.cash||0),isOk=diff===0;
                        return(
                          <div key={log.id} className="bg-gray-800/30 rounded-2xl border border-gray-700/40 overflow-hidden">
                            <button className="w-full flex items-center justify-between p-4 text-left" onClick={()=>setExpandedRev(expandedRev===log.id?null:log.id)}>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-bold text-white">Ca {log.shiftType}</span>
                                  <span className="text-xs bg-violet-500/15 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded-full">{log.employee}</span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full border ${isOk?"bg-emerald-500/15 text-emerald-400 border-emerald-500/20":"bg-amber-500/15 text-amber-400 border-amber-500/20"}`}>{isOk?"✅ Khớp":`⚠️ ${diff>0?"−":"+"}${vnd(Math.abs(diff))}`}</span>
                                </div>
                                <div className="text-xs text-gray-500 mt-1">{log.date}{log.check_time ? ` ${String(new Date(log.check_time).getHours()).padStart(2,"0")}:${String(new Date(log.check_time).getMinutes()).padStart(2,"0")}` : ""} · NB: {vnd(log.revenue?.netbarbox)}</div>
                              </div>
                              <ChevronDown size={16} className={`text-gray-500 transition-transform ${expandedRev===log.id?"rotate-180":""}`}/>
                            </button>
                            {expandedRev===log.id&&(
                              <div className="border-t border-gray-700/40 px-4 pb-4 pt-3 space-y-2">
                                {[["Tiền mặt NV",vnd(log.revenue?.cash),"text-gray-200"],["Netbarbox",vnd(log.revenue?.netbarbox),"text-gray-200"],["Tingee",vnd(log.revenue?.tingee),"text-gray-200"],["Kỳ vọng",vnd(expCash),"text-gray-200"],["Chênh lệch",isOk?"✅ Khớp":`${diff>0?"−":"+"}${vnd(Math.abs(diff))}`,isOk?"text-emerald-400":"text-amber-400"],["Hàng hóa",vnd(log.revenue?.goodsRevenue),"text-violet-400"]].map(([k,v,c])=>(
                                  <div key={k} className="flex justify-between text-xs"><span className="text-gray-500">{k}</span><span className={`font-semibold ${c}`}>{v}</span></div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Lịch sử kiểm kê</h3>
                  <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
                    <button onClick={()=>setHistDate("")} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border ${!histDate?"bg-violet-600/70 border-violet-500/50 text-white":"bg-gray-800/60 border-gray-700/50 text-gray-500"}`}>Tất cả</button>
                    {histDates.map(d=><button key={d} onClick={()=>setHistDate(histDate===d?"":d)} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border ${histDate===d?"bg-violet-600/70 border-violet-500/50 text-white":"bg-gray-800/60 border-gray-700/50 text-gray-500"}`}>{d}</button>)}
                  </div>
                  <div className="space-y-2">
                    {filteredLogs.map(log=>{
                      const hasImports=log.items?.some(i=>i.imported>0);
                      return(
                        <div key={log.id} className="bg-gray-800/30 rounded-2xl border border-gray-700/40 overflow-hidden">
                          <div className="flex items-center justify-between p-4">
                            <button className="flex-1 text-left" onClick={()=>setExpanded(expandedLog===log.id?null:log.id)}>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-white">Ca {log.shiftType}</span>
                                <span className="text-xs bg-violet-500/15 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded-full">{log.employee}</span>
                                {log.editedBy&&<span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">✏️ Đã sửa</span>}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">{log.date} · {log.items?.length||0} sp</div>
                            </button>
                            <div className="flex items-center gap-2 ml-2">
                              <button onClick={()=>openEditLog(log)} className="p-2 rounded-lg bg-gray-700/60 hover:bg-violet-600/40 text-gray-400 hover:text-violet-300"><Edit2 size={14}/></button>
                              <button onClick={()=>setExpanded(expandedLog===log.id?null:log.id)} className="text-gray-500 p-1"><ChevronDown size={16} className={`transition-transform ${expandedLog===log.id?"rotate-180":""}`}/></button>
                            </div>
                          </div>
                          {expandedLog===log.id&&(
                            <div className="border-t border-gray-700/40 px-4 pb-4 pt-3">
                              <div className={`grid text-xs text-gray-600 mb-2 ${hasImports?"grid-cols-5":"grid-cols-4"}`}><div className="col-span-2">Sản phẩm</div><div className="text-center">Đầu</div>{hasImports&&<div className="text-center">+Nhập</div>}<div className="text-center">Bán</div></div>
                              {log.items?.map(item=>{const p=getP(item.pId);return(
                                <div key={item.pId} className={`grid py-2 border-b border-gray-700/20 last:border-0 text-sm ${hasImports?"grid-cols-5":"grid-cols-4"}`}>
                                  <div className="col-span-2 text-gray-200">{p?.name||"?"}</div>
                                  <div className="text-center text-gray-400">{item.open}</div>
                                  {hasImports&&<div className={`text-center ${item.imported>0?"text-emerald-400":"text-gray-700"}`}>{item.imported>0?`+${item.imported}`:"—"}</div>}
                                  <div className={`text-center font-bold ${item.sold>0?"text-amber-400":"text-gray-600"}`}>{item.sold}</div>
                                </div>
                              );})}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 4: AI */}
        {tab===4&&(
          <div className="flex flex-col">
            <div className="px-4 py-4 space-y-4 min-h-96">
              {aiMessages.length===0&&(
                <div className="space-y-4">
                  {!apiKey&&<div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4"><p className="text-sm font-bold text-amber-300 mb-1">⚙️ Cần API Key</p><p className="text-xs text-amber-200/70 mb-3">Lấy tại console.anthropic.com</p><button onClick={()=>{setApiKeyInput("");setShowApiModal(true);}} className="px-4 py-2 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-300 text-xs font-semibold">Nhập API Key</button></div>}
                  <div className="bg-gradient-to-br from-violet-500/10 to-blue-500/10 border border-violet-500/20 rounded-2xl p-4">
                    <p className="text-sm font-bold text-white mb-3">Tôi có thể giúp bạn:</p>
                    {[["💰","Đối chiếu tiền mặt"],["📊","Phân tích doanh thu"],["📦","Gợi ý nhập hàng"],["🔍","Phát hiện bất thường"]].map(([i,t])=>(
                      <div key={t} className="flex items-center gap-2.5 mt-2"><span>{i}</span><span className="text-xs text-gray-300">{t}</span></div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {QUICK_AI.map((q,i)=>(
                      <button key={i} onClick={()=>sendAI(q.prompt)} className="w-full flex items-center gap-3 bg-gray-800/40 border border-gray-700/40 rounded-xl px-3.5 py-3 text-left">
                        <span className="text-lg">{q.icon}</span><span className="text-sm text-gray-200 flex-1">{q.label}</span><ChevronRight size={14} className="text-gray-600"/>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {aiMessages.map((msg,i)=>(
                <div key={i} className={`flex gap-2.5 ${msg.role==="user"?"flex-row-reverse":""}`}>
                  <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5 ${msg.role==="user"?`${ua?.color||"bg-sky-500"} text-white`:"bg-violet-600/25 border border-violet-500/30"}`}>
                    {msg.role==="user"?user.ini:<Sparkles size={12} className="text-violet-400"/>}
                  </div>
                  <div className={`max-w-xs rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${msg.role==="user"?"bg-violet-600/70 text-white rounded-tr-sm":"bg-gray-800/80 border border-gray-700/50 text-gray-100 rounded-tl-sm"}`}>{msg.content}</div>
                </div>
              ))}
              {aiLoading&&<div className="flex gap-2.5"><div className="w-7 h-7 rounded-full bg-violet-600/25 border border-violet-500/30 flex items-center justify-center"><Sparkles size={12} className="text-violet-400"/></div><div className="bg-gray-800/80 border border-gray-700/50 rounded-2xl px-4 py-3.5 flex gap-1.5">{[0,1,2].map(i=><div key={i} className="w-2 h-2 rounded-full bg-violet-400/70" style={{animation:`bounce 0.9s ${i*0.18}s infinite`}}/>)}</div></div>}
              <div ref={aiBottomRef}/>
            </div>
            <div className="px-4 pb-2 pt-3 border-t border-gray-800/60">
              <div className="flex gap-2 items-end">
                <textarea value={aiInput} onChange={e=>setAiInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendAI(aiInput);}}} placeholder="Nhắn tin với trợ lý..." rows={1} className="flex-1 bg-gray-800/80 border border-gray-700/60 rounded-xl px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 outline-none focus:border-violet-500"/>
                <button onClick={()=>sendAI(aiInput)} disabled={!aiInput.trim()||aiLoading} className="w-10 h-10 rounded-xl bg-violet-600 disabled:bg-gray-800 flex items-center justify-center flex-shrink-0">
                  <Send size={15} className={!aiInput.trim()||aiLoading?"text-gray-600":"text-white"}/>
                </button>
              </div>
              <div className="flex justify-between mt-2">
                {aiMessages.length>0&&<button onClick={()=>setAiMessages([])} className="text-xs text-gray-600 flex items-center gap-1"><RotateCcw size={10}/>Xóa chat</button>}
                <button onClick={()=>{setApiKeyInput(apiKey);setShowApiModal(true);}} className="ml-auto text-xs text-gray-600 flex items-center gap-1"><Settings size={10}/>{apiKey?"API Key đã cài":"Cài API Key"}</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-gray-900/95 backdrop-blur-xl border-t border-gray-800/80 flex z-20">
        {TABS.map(({label,Icon},i)=>(
          <button key={i} onClick={()=>setTab(i)} className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 relative ${tab===i?"text-violet-400":"text-gray-600"}`}>
            {i===0&&lowCount>0&&<span className="absolute top-1.5 right-1/4 w-3.5 h-3.5 bg-amber-500 rounded-full text-xs text-white flex items-center justify-center font-bold">{lowCount}</span>}
            {i===3&&shiftDiscrepancies.length>0&&<span className="absolute top-1.5 right-1/4 w-3.5 h-3.5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center font-bold">{shiftDiscrepancies.length}</span>}
            <Icon size={17}/><span className="font-semibold leading-tight" style={{fontSize:"9px"}}>{label}</span>
            {tab===i&&<span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-violet-400 rounded-full"/>}
          </button>
        ))}
      </div>

      {/* Product modal */}
      {modal&&(
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-end justify-center z-30" onClick={()=>setModal(null)}>
          <div className="bg-gray-900 border border-gray-700/80 rounded-t-3xl w-full max-w-md p-5 space-y-4" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-bold text-white">{modal==="add"?"Thêm sản phẩm":"Chỉnh sửa"}</h3><button onClick={()=>setModal(null)} className="text-gray-500 p-1"><X size={20}/></button></div>
            <div className="space-y-3">
              <div><label className="text-xs text-gray-500 mb-1.5 block">Tên sản phẩm</label><input value={pForm.name} onChange={e=>setPForm(f=>({...f,name:e.target.value}))} placeholder="VD: Pepsi lon" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500 mb-1.5 block">Đơn vị</label><input value={pForm.unit} onChange={e=>setPForm(f=>({...f,unit:e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"/></div>
                <div><label className="text-xs text-gray-500 mb-1.5 block">Giá bán</label><input type="text" value={pForm.price} onChange={e=>setPForm(f=>({...f,price:fmtCur(e.target.value)}))} placeholder="15,000" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500 mb-1.5 block">Ngưỡng cảnh báo</label><input type="number" value={pForm.threshold} onChange={e=>setPForm(f=>({...f,threshold:e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"/></div>
                {modal==="add"&&<div><label className="text-xs text-gray-500 mb-1.5 block">Tồn ban đầu</label><input type="number" value={pForm.stock} onChange={e=>setPForm(f=>({...f,stock:e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"/></div>}
              </div>
            </div>
            <div className="flex gap-3">
              {modal!=="add"&&<button onClick={()=>deleteProduct(modal.id)} className="px-4 py-3 rounded-xl border border-red-500/30 text-red-400"><Trash2 size={16}/></button>}
              <button onClick={saveProduct} disabled={!pForm.name||!pForm.unit} className="flex-1 py-3 bg-violet-600 disabled:bg-gray-800 disabled:text-gray-600 rounded-xl text-white font-bold text-sm">{modal==="add"?"Thêm":"Lưu"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit log modal */}
      {editLog&&(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end justify-center z-30" onClick={()=>setEditLog(null)}>
          <div className="bg-gray-900 border border-gray-700/80 rounded-t-3xl w-full max-w-md p-5 max-h-screen overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-white">Chỉnh sửa kiểm kê</h3><button onClick={()=>setEditLog(null)} className="text-gray-500 p-1"><X size={20}/></button></div>
            {logs.length>0&&logs[0].id===editLog.id&&<div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5 mb-4 flex gap-2"><span>⚠️</span><p className="text-xs text-amber-300">Ca gần nhất — lưu sẽ cập nhật tồn kho và doanh thu HH</p></div>}
            <div className="space-y-2 mb-4">
              {editLog.items?.map(item=>{
                const p=getP(item.pId),cs=editCloses[item.pId]??"",cn=parseInt(cs),sold=!isNaN(cn)?Math.max(0,item.open+item.imported-cn):null;
                return(
                  <div key={item.pId} className="bg-gray-800/30 rounded-xl border border-gray-700/40 p-3">
                    <div className="grid grid-cols-12 items-center gap-1">
                      <div className="col-span-4"><div className="text-sm font-semibold text-white">{p?.name||"?"}</div><div className="text-xs text-gray-600">{p?.unit}</div></div>
                      <div className="col-span-2 text-center text-gray-400 font-semibold">{item.open}</div>
                      <div className="col-span-2 text-center"><span className={`text-sm font-semibold ${item.imported>0?"text-emerald-400":"text-gray-700"}`}>{item.imported>0?`+${item.imported}`:"—"}</span></div>
                      <div className="col-span-4"><input type="number" value={cs} onChange={e=>setEditCloses(c=>({...c,[item.pId]:e.target.value}))} placeholder={String(item.close)} className="w-full bg-gray-900 border border-violet-500/40 rounded-lg px-2 py-2 text-sm text-center text-white outline-none"/></div>
                    </div>
                    {sold!==null&&<div className="mt-2 text-xs text-gray-500">Bán ra: <span className={`font-bold ${sold>0?"text-amber-400":"text-gray-600"}`}>{sold}</span>{sold!==item.sold&&<span className="ml-2 text-gray-600 line-through">{item.sold}</span>}</div>}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3">
              <button onClick={()=>setEditLog(null)} className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-400 text-sm font-semibold">Hủy</button>
              <button onClick={saveEditLog} className="flex-1 py-3 bg-violet-600 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2"><Check size={15}/>Lưu</button>
            </div>
          </div>
        </div>
      )}

      {/* API Key modal */}
      {showApiModal&&(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-6">
          <div className="bg-gray-900 border border-gray-700/80 rounded-2xl w-full max-w-xs p-5 space-y-4">
            <h3 className="font-bold text-white">⚙️ Gemini API Key</h3>
            <p className="text-xs text-gray-400">Lấy key tại <span className="text-violet-400">console.anthropic.com</span></p>
            <input value={apiKeyInput} onChange={e=>setApiKeyInput(e.target.value)} placeholder="AIza..." type="password" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"/>
            <div className="flex gap-3">
              <button onClick={()=>setShowApiModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 text-sm">Hủy</button>
              <button onClick={()=>{const k=apiKeyInput.trim();setApiKey(k);localStorage.setItem("gsm_api_key",k);setShowApiModal(false);}} className="flex-1 py-2.5 bg-violet-600 rounded-xl text-white text-sm font-bold">Lưu</button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes bounce{0%,100%{transform:translateY(0);opacity:.4}50%{transform:translateY(-5px);opacity:1}}`}</style>
    </div>
  );
}

export default function Root() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const mapUser = async (u) => {
    const email = u.email || "";
    const { data } = await supabase.from("allowed_users").select("*").eq("email", email).single();
    if (!data) {
      await supabase.auth.signOut();
      alert("Tài khoản không được phép truy cập!");
      return null;
    }
    return {
      name: data.name || u.user_metadata?.full_name || email,
      email,
      role: data.role || "employee",
      ini: (data.name || email)[0].toUpperCase(),
      color: data.role === "manager" ? "bg-violet-500" : "bg-sky-500"
    };
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const mapped = await mapUser(session.user);
        setUser(mapped);
      }
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        const mapped = await mapUser(session.user);
        setUser(mapped);
      } else {
        setUser(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-5xl">🎮</div>
    </div>
  );

  return user
    ? <InventoryApp user={user} onLogout={() => supabase.auth.signOut()} />
    : <LoginScreen onLogin={setUser} />;
}
