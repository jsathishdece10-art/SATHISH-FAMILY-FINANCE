// Sathish Family Finance — separate Firebase project recommended.
// Replace the firebaseConfig values below with config from your NEW Firebase project.
// Enable Authentication > Email/Password and create a Cloud Firestore database first.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCzU-lxt7Kol5182qyK4Xk6_0GEe422bnM",
  authDomain: "sathish-family-finance.firebaseapp.com",
  projectId: "sathish-family-finance",
  storageBucket: "sathish-family-finance.firebasestorage.app",
  messagingSenderId: "780714035990",
  appId: "1:780714035990:web:21b33605e0a385e6f61e37",
  measurementId: "G-J6RKH9WSXR"
};
const configReady = Object.values(firebaseConfig).every(v => v && !v.startsWith("PASTE_"));
const $ = id => document.getElementById(id);
const setText = (id, value) => { const el = $(id); if (el) el.textContent = value; };
const setMessage = (id, text, error=false) => { const el = $(id); if (el) { el.textContent = text; if (el.classList) el.classList.toggle("error", error); } };
const app = configReady ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
let currentUser = null;
let transactions = [], commitments = [], savings = [], insurances = [];
const currency = n => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(n)||0);
const today = () => new Date().toLocaleDateString("en-CA");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const message = (id, text, error=false) => setMessage(id, text, error);
const path = name => collection(db,"users",currentUser.uid,name);
const showDate = v => v ? esc(v) : "—";
const formVal = id => $(id).value.trim();
function setBusy(btn, busy, label){ if(!btn.dataset.original) btn.dataset.original=btn.textContent; btn.disabled=busy; btn.textContent=busy?"Saving…":(label||btn.dataset.original); }
function clearTxForm(){ $("transactionForm").reset(); $("transactionId").value=""; $("txDate").value=today(); $("saveTxBtn").textContent="Save entry"; $("cancelTxBtn").classList.add("hidden"); }
function clearCommitmentForm(){ $("commitmentForm").reset(); $("commitmentId").value=""; $("cOutstanding").value="0"; $("cancelCommitmentBtn").classList.add("hidden"); }
function clearSavingForm(){ $("savingForm").reset(); $("savingId").value=""; $("sCurrent").value="0"; $("sTarget").value="0"; $("cancelSavingBtn").classList.add("hidden"); }
function clearInsuranceForm(){ $("insuranceForm").reset(); $("insuranceId").value=""; $("iCoverage").value="0"; $("cancelInsuranceBtn").classList.add("hidden"); }
function monthOptions(){
  const select=$("monthFilter"), now=new Date(); select.innerHTML="";
  for(let i=0;i<24;i++){ const d=new Date(now.getFullYear(),now.getMonth()-i,1); const val=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; const opt=document.createElement("option"); opt.value=val; opt.textContent=d.toLocaleDateString("en-IN",{month:"long",year:"numeric"}); select.append(opt); }
}
async function loadAll(){
  const names=[["transactions","transactions"],["commitments","commitments"],["savings","savings"],["insurances","insurances"]];
  const results=await Promise.all(names.map(async ([key,col])=>[key,(await getDocs(path(col))).docs.map(d=>({id:d.id,...d.data()}))]));
  for (const [key, value] of results) {
    if (key === "transactions") transactions = value;
    else if (key === "commitments") commitments = value;
    else if (key === "savings") savings = value;
    else if (key === "insurances") insurances = value;
  }
  renderAll();
}
function selectedTransactions(){
  const month=$("monthFilter").value;
  return transactions.filter(t=>(t.date||"").slice(0,7)===month);
}
function renderDashboard(){
  const list=selectedTransactions();
  const sum=type=>list.filter(t=>t.type===type).reduce((a,t)=>a+Number(t.amount||0),0);
  setText("totalIncome", currency(sum("income")));
  setText("totalExpense", currency(sum("expense")));
  setText("balance", currency(sum("income")-sum("expense")-sum("saving")-sum("emi")));
  setText("savingTotal", currency(sum("saving")));
  setText("emiPaid", currency(sum("emi")));
  setText("emiPending", currency(commitments.filter(c=>c.status==="active").reduce((a,c)=>a+Number(c.outstanding||0),0)));
}
function renderTransactions(){
  const q=$("txSearch").value.toLowerCase();
  const list=[...transactions].filter(t=>[t.date,t.type,t.category,t.method,t.account,t.notes].join(" ").toLowerCase().includes(q)).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  $("transactionsBody").innerHTML=list.map(t=>`<tr><td>${showDate(t.date)}</td><td><span class="pill ${esc(t.type)}">${esc(t.type)}</span></td><td>${esc(t.category)}</td><td class="amount">${currency(t.amount)}</td><td>${esc(t.method||"—")}</td><td>${esc([t.account,t.notes].filter(Boolean).join(" · ")||"—")}</td><td><button class="mini-btn" data-edit-tx="${esc(t.id)}">Edit</button><button class="mini-btn delete" data-delete-tx="${esc(t.id)}">Delete</button></td></tr>`).join("")||'<tr><td colspan="7">No transactions yet. Add your first entry above.</td></tr>';
}
function renderCommitments(){
  $("commitmentsBody").innerHTML=[...commitments].sort((a,b)=>(a.name||"").localeCompare(b.name||"")).map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.lender||"—")}</td><td class="amount">${currency(c.monthly)}</td><td class="amount">${currency(c.outstanding)}</td><td>${showDate(c.due)}</td><td><span class="pill">${esc(c.status)}</span></td><td><button class="mini-btn" data-edit-c="${esc(c.id)}">Edit</button><button class="mini-btn delete" data-delete-c="${esc(c.id)}">Delete</button></td></tr>`).join("")||'<tr><td colspan="7">No EMI or loan commitments added.</td></tr>';
}
function renderSavings(){
  $("savingsBody").innerHTML=[...savings].sort((a,b)=>(a.name||"").localeCompare(b.name||"")).map(s=>`<tr><td>${esc(s.name)}</td><td>${esc(s.provider||"—")}</td><td>${esc(s.frequency)}</td><td class="amount">${currency(s.contribution)}</td><td class="amount">${currency(s.current)}</td><td class="amount">${currency(s.target)}</td><td>${showDate(s.maturity)}</td><td><button class="mini-btn" data-edit-s="${esc(s.id)}">Edit</button><button class="mini-btn delete" data-delete-s="${esc(s.id)}">Delete</button></td></tr>`).join("")||'<tr><td colspan="8">No savings schemes added.</td></tr>';
}
function renderInsurances(){
  $("insuranceBody").innerHTML=[...insurances].sort((a,b)=>(a.renewal||"").localeCompare(b.renewal||"")).map(i=>`<tr><td>${esc(i.name)}</td><td>${esc(i.type)}</td><td>${esc(i.company)}</td><td class="amount">${currency(i.premium)}</td><td>${esc(i.frequency)}</td><td class="amount">${currency(i.coverage)}</td><td>${showDate(i.renewal)}</td><td><span class="pill">${esc(i.status)}</span></td><td><button class="mini-btn" data-edit-i="${esc(i.id)}">Edit</button><button class="mini-btn delete" data-delete-i="${esc(i.id)}">Delete</button></td></tr>`).join("")||'<tr><td colspan="9">No insurance policies added.</td></tr>';
}
function renderOverview(){ /* Full dashboard summary is rendered by renderDashboard() and renderChartsAndPanels(). */ }
function renderTypeLists(){
  const income=transactions.filter(t=>t.type==="income").sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const expenses=transactions.filter(t=>t.type==="expense").sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  $("incomeBody").innerHTML=income.map(t=>`<tr><td>${showDate(t.date)}</td><td>${esc(t.category)}</td><td class="amount">${currency(t.amount)}</td><td>${esc([t.account,t.notes].filter(Boolean).join(" · ")||"—")}</td><td><button class="mini-btn" data-edit-tx="${esc(t.id)}">Edit</button><button class="mini-btn delete" data-delete-tx="${esc(t.id)}">Delete</button></td></tr>`).join("")||'<tr><td colspan="5">No income entries yet.</td></tr>';
  $("expensesBody").innerHTML=expenses.map(t=>`<tr><td>${showDate(t.date)}</td><td>${esc(t.category)}</td><td class="amount">${currency(t.amount)}</td><td>${esc(t.method||"—")}</td><td>${esc([t.account,t.notes].filter(Boolean).join(" · ")||"—")}</td><td><button class="mini-btn" data-edit-tx="${esc(t.id)}">Edit</button><button class="mini-btn delete" data-delete-tx="${esc(t.id)}">Delete</button></td></tr>`).join("")||'<tr><td colspan="6">No expense entries yet.</td></tr>';
}
function renderAll(){renderDashboard();renderTransactions();renderCommitments();renderSavings();renderInsurances();renderOverview();renderTypeLists();renderChartsAndPanels();}

function renderChartsAndPanels(){
  const list=selectedTransactions();
  const incomes=list.filter(t=>t.type==="income").reduce((a,t)=>a+Number(t.amount||0),0);
  const expenses=list.filter(t=>t.type==="expense").reduce((a,t)=>a+Number(t.amount||0),0);
  const max=Math.max(incomes,expenses,1);
  const chart=$("cashflowChart");
  if(chart) chart.innerHTML=`<div class="chart-month"><div class="chart-bars"><div class="chart-bar income" style="height:${Math.max(3,incomes/max*100)}%"></div><div class="chart-bar expense" style="height:${Math.max(3,expenses/max*100)}%"></div></div><small>${esc($("monthFilter").selectedOptions[0]?.textContent||"Selected")}</small></div>`;
  const totals={};
  list.filter(t=>t.type==="expense").forEach(t=>totals[t.category||"Other"]=(totals[t.category||"Other"]||0)+Number(t.amount||0));
  const pairs=Object.entries(totals).sort((a,b)=>b[1]-a[1]);
  const colors=["#4285f4","#f05a82","#45b889","#f6bd4b","#8c62d6","#8aa1ad"];
  const sum=pairs.reduce((a,p)=>a+p[1],0);
  let cursor=0; const stops=pairs.map((p,i)=>{const start=cursor;cursor+=sum?p[1]/sum*100:0;return `${colors[i%colors.length]} ${start}% ${cursor}%`;}).join(",");
  const category=$("categoryChart");
  if(category) category.innerHTML=pairs.length?`<div class="donut" data-total="${currency(sum)}" style="background:conic-gradient(${stops})"></div><div class="category-legend">${pairs.slice(0,6).map((p,i)=>`<div><i style="background:${colors[i%colors.length]}"></i><span>${esc(p[0])}</span><b>${sum?Math.round(p[1]/sum*100):0}%</b></div>`).join("")}</div>`:'<div class="chart-empty">Expense breakdown appears here.</div>';
  const preview=$("savingsPreview");
  if(preview) preview.innerHTML=savings.slice(0,4).map(s=>{const pct=Number(s.target)>0?Math.min(100,Number(s.current||0)/Number(s.target)*100):0;return `<div class="saving-row"><div class="saving-row-head"><span>${esc(s.name)}</span><b>${currency(s.current)}${Number(s.target)>0?" / "+currency(s.target):""}</b></div><div class="saving-track"><span style="width:${pct}%"></span></div></div>`;}).join("")||'<div class="chart-empty">Add your savings schemes to view progress.</div>';
  const recent=[...list].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,6);
  const recentBody=$("recentTransactionsBody");
  if(recentBody) recentBody.innerHTML=recent.map(t=>`<tr><td>${showDate(t.date)}</td><td><span class="pill ${esc(t.type)}">${esc(t.type)}</span></td><td>${esc(t.category)}</td><td class="amount">${currency(t.amount)}</td><td>${esc(t.method||"—")}</td><td>${esc(t.notes||"—")}</td></tr>`).join("")||'<tr><td colspan="6">No entries for this month yet.</td></tr>';
  const cb=$("dashboardCommitmentsBody");
  if(cb) cb.innerHTML=commitments.filter(c=>c.status==="active").slice(0,5).map(c=>`<tr><td>${esc(c.name)}</td><td>${currency(c.monthly)}</td><td>${currency(c.outstanding)}</td><td>${showDate(c.due)}</td><td><span class="pill">${esc(c.status)}</span></td></tr>`).join("")||'<tr><td colspan="5">No active loans.</td></tr>';
  const ib=$("dashboardInsuranceBody");
  if(ib) ib.innerHTML=insurances.filter(i=>i.status==="active").slice(0,4).map(i=>`<tr><td>${esc(i.name)}</td><td>${esc(i.company)}</td><td>${currency(i.premium)}</td><td>${currency(i.coverage)}</td><td>${showDate(i.renewal)}</td><td><span class="pill">${esc(i.status)}</span></td></tr>`).join("")||'<tr><td colspan="6">No active policies.</td></tr>';
  const due=$("dashboardDueBody");
  if(due) due.innerHTML=commitments.filter(c=>c.status==="active"&&c.due).sort((a,b)=>a.due.localeCompare(b.due)).slice(0,5).map(c=>`<tr><td>${showDate(c.due)}</td><td>${esc(c.name)}</td><td>${currency(c.monthly)}</td><td><span class="pill">Pending</span></td></tr>`).join("")||'<tr><td colspan="4">No upcoming due dates.</td></tr>';
  const budget=$("budgetSummary");
  if(budget) budget.innerHTML=pairs.map(p=>`<div class="budget-item"><span>${esc(p[0])}</span><strong>${currency(p[1])}</strong><span>${sum?Math.round(p[1]/sum*100):0}% of expenses this month</span></div>`).join("")||'<p class="chart-empty">Add expense entries to see category totals.</p>';
}
async function saveRecord(collectionName,id,data){
  data.updatedAt=serverTimestamp();
  if(id) await updateDoc(doc(db,"users",currentUser.uid,collectionName,id),data);
  else {data.createdAt=serverTimestamp(); await addDoc(path(collectionName),data);}
}
async function removeRecord(collectionName,id,label){
  if(!confirm(`Delete this ${label}? This cannot be undone.`)) return;
  try{await deleteDoc(doc(db,"users",currentUser.uid,collectionName,id)); await loadAll(); message("appMessage",`${label} deleted.`);}
  catch(e){message("appMessage",e.message,true);}
}
$("authForm").addEventListener("submit",async e=>{e.preventDefault(); if(!configReady){message("authMessage","First add your NEW Firebase project config in app.js. See README.txt.",true);return;} try{await signInWithEmailAndPassword(auth,formVal("email"),$("password").value);message("authMessage","");}catch(err){message("authMessage",err.message,true);}});
$("registerBtn").addEventListener("click",async()=>{if(!configReady){message("authMessage","First add your NEW Firebase project config in app.js. See README.txt.",true);return;}try{await createUserWithEmailAndPassword(auth,formVal("email"),$("password").value);message("authMessage","Account created.");}catch(err){message("authMessage",err.message,true);}});
$("signOutBtn").addEventListener("click",()=>signOut(auth));
onAuthStateChanged(auth,async user=>{
  currentUser=user; $("loginPanel").classList.toggle("hidden",!!user); $("appPanel").classList.toggle("hidden",!user); $("signOutBtn").classList.toggle("hidden",!user); setText("userLabel", user ? user.email : "Not signed in"); setText("sidebarEmail", user ? user.email : "Your account");
  if (user) {
    try {
      await loadAll();
      message("appMessage", "Cloud sync connected.");
    } catch (e) {
      console.error("Firestore load failed:", e);
      if (e.code === "permission-denied" || /insufficient permissions/i.test(e.message || "")) {
        message("appMessage", "Firestore permission denied. Check that firestore.rules is Published in the sathish-family-finance project and that you are signed in to this app. Rules must allow users/{your-uid}/... only.", true);
      } else if (e.code === "unavailable") {
        message("appMessage", "Firestore is temporarily unavailable. Check your internet connection and refresh.", true);
      } else {
        message("appMessage", "Could not load data (" + (e.code || "error") + "): " + e.message, true);
      }
    }
  }
});
$("transactionForm").addEventListener("submit",async e=>{e.preventDefault();const btn=$("saveTxBtn");setBusy(btn,true);try{const id=formVal("transactionId");await saveRecord("transactions",id,{date:formVal("txDate"),type:formVal("txType"),category:formVal("txCategory"),amount:Number(formVal("txAmount")),method:formVal("txMethod"),account:formVal("txAccount"),notes:formVal("txNotes")});clearTxForm();await loadAll();message("appMessage","Transaction saved to cloud.");}catch(err){message("appMessage",(err.code ? err.code + ": " : "") + err.message,true);}finally{setBusy(btn,false,id?"Update entry":"Save entry");}});
$("commitmentForm").addEventListener("submit",async e=>{e.preventDefault();try{const id=formVal("commitmentId");await saveRecord("commitments",id,{name:formVal("cName"),lender:formVal("cLender"),monthly:Number(formVal("cMonthly")),outstanding:Number(formVal("cOutstanding")),due:formVal("cDue"),status:formVal("cStatus"),notes:formVal("cNotes")});clearCommitmentForm();await loadAll();message("appMessage","EMI / loan commitment saved.");}catch(err){message("appMessage",(err.code ? err.code + ": " : "") + err.message,true);}});
$("savingForm").addEventListener("submit",async e=>{e.preventDefault();try{const id=formVal("savingId");await saveRecord("savings",id,{name:formVal("sName"),provider:formVal("sProvider"),frequency:formVal("sFrequency"),contribution:Number(formVal("sContribution")),current:Number(formVal("sCurrent")),target:Number(formVal("sTarget")),start:formVal("sStart"),maturity:formVal("sMaturity")});clearSavingForm();await loadAll();message("appMessage","Savings scheme saved.");}catch(err){message("appMessage",(err.code ? err.code + ": " : "") + err.message,true);}});
$("insuranceForm").addEventListener("submit",async e=>{e.preventDefault();try{const id=formVal("insuranceId");await saveRecord("insurances",id,{name:formVal("iName"),type:formVal("iType"),company:formVal("iCompany"),policy:formVal("iPolicy"),premium:Number(formVal("iPremium")),frequency:formVal("iFrequency"),coverage:Number(formVal("iCoverage")),renewal:formVal("iRenewal"),status:formVal("iStatus"),notes:formVal("iNotes")});clearInsuranceForm();await loadAll();message("appMessage","Insurance policy saved.");}catch(err){message("appMessage",(err.code ? err.code + ": " : "") + err.message,true);}});
$("cancelTxBtn").addEventListener("click",clearTxForm);$("cancelCommitmentBtn").addEventListener("click",clearCommitmentForm);$("cancelSavingBtn").addEventListener("click",clearSavingForm);$("cancelInsuranceBtn").addEventListener("click",clearInsuranceForm);
$("monthFilter").addEventListener("change",()=>{renderDashboard();renderOverview();renderChartsAndPanels();});$("txSearch").addEventListener("input",renderTransactions);
function showSection(tab){
  document.querySelectorAll(".side-link").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  document.querySelectorAll(".tab-panel").forEach(p=>p.classList.toggle("hidden",p.id!==`tab-${tab}`));
}
document.querySelectorAll(".side-link").forEach(btn=>btn.addEventListener("click",()=>showSection(btn.dataset.tab)));
document.querySelectorAll("[data-go]").forEach(btn=>btn.addEventListener("click",()=>showSection(btn.dataset.go)));
document.querySelectorAll("[data-export]").forEach(btn=>btn.addEventListener("click",()=>$("exportBtn").click()));
setText("sidebarEmail", currentUser?.email || "Your account");
const now=new Date();
setText("todayLabel", now.toLocaleDateString("en-IN",{weekday:"short",day:"2-digit",month:"short",year:"numeric"}));
setText("clockLabel", now.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}));
$("transactionsBody").addEventListener("click",async e=>{const edit=e.target.closest("[data-edit-tx]"),del=e.target.closest("[data-delete-tx]");if(del)return removeRecord("transactions",del.dataset.deleteTx,"transaction");if(edit){const t=transactions.find(x=>x.id===edit.dataset.editTx);if(!t)return;$("transactionId").value=t.id;for(const [k,v] of Object.entries({txDate:t.date,txType:t.type,txCategory:t.category,txAmount:t.amount,txMethod:t.method,txAccount:t.account,txNotes:t.notes}))$(k).value=v??"";$("saveTxBtn").textContent="Update entry";$("cancelTxBtn").classList.remove("hidden");window.scrollTo({top:0,behavior:"smooth"});}});
$("incomeBody").addEventListener("click", e=>handleTransactionAction(e));
$("expensesBody").addEventListener("click", e=>handleTransactionAction(e));
function handleTransactionAction(e){
  const edit=e.target.closest("[data-edit-tx]"),del=e.target.closest("[data-delete-tx]");
  if(del) return removeRecord("transactions",del.dataset.deleteTx,"transaction");
  if(edit){
    const t=transactions.find(x=>x.id===edit.dataset.editTx); if(!t)return;
    $("transactionId").value=t.id;
    for(const [k,v] of Object.entries({txDate:t.date,txType:t.type,txCategory:t.category,txAmount:t.amount,txMethod:t.method,txAccount:t.account,txNotes:t.notes}))$(k).value=v??"";
    $("saveTxBtn").textContent="Update entry";$("cancelTxBtn").classList.remove("hidden");
    document.querySelectorAll(".side-link").forEach(b=>b.classList.toggle("active",b.dataset.tab==="entries"));
    document.querySelectorAll(".tab-panel").forEach(p=>p.classList.toggle("hidden",p.id!=="tab-entries"));
    window.scrollTo({top:0,behavior:"smooth"});
  }
}
$("commitmentsBody").addEventListener("click",e=>{const edit=e.target.closest("[data-edit-c]"),del=e.target.closest("[data-delete-c]");if(del)return removeRecord("commitments",del.dataset.deleteC,"commitment");if(edit){const c=commitments.find(x=>x.id===edit.dataset.editC);if(!c)return;$("commitmentId").value=c.id;for(const [k,v] of Object.entries({cName:c.name,cLender:c.lender,cMonthly:c.monthly,cOutstanding:c.outstanding,cDue:c.due,cStatus:c.status,cNotes:c.notes}))$(k).value=v??"";$("cancelCommitmentBtn").classList.remove("hidden");}});
$("savingsBody").addEventListener("click",e=>{const edit=e.target.closest("[data-edit-s]"),del=e.target.closest("[data-delete-s]");if(del)return removeRecord("savings",del.dataset.deleteS,"savings scheme");if(edit){const s=savings.find(x=>x.id===edit.dataset.editS);if(!s)return;$("savingId").value=s.id;for(const [k,v] of Object.entries({sName:s.name,sProvider:s.provider,sFrequency:s.frequency,sContribution:s.contribution,sCurrent:s.current,sTarget:s.target,sStart:s.start,sMaturity:s.maturity}))$(k).value=v??"";$("cancelSavingBtn").classList.remove("hidden");}});
$("insuranceBody").addEventListener("click",e=>{const edit=e.target.closest("[data-edit-i]"),del=e.target.closest("[data-delete-i]");if(del)return removeRecord("insurances",del.dataset.deleteI,"insurance policy");if(edit){const i=insurances.find(x=>x.id===edit.dataset.editI);if(!i)return;$("insuranceId").value=i.id;for(const [k,v] of Object.entries({iName:i.name,iType:i.type,iCompany:i.company,iPolicy:i.policy,iPremium:i.premium,iFrequency:i.frequency,iCoverage:i.coverage,iRenewal:i.renewal,iStatus:i.status,iNotes:i.notes}))$(k).value=v??"";$("cancelInsuranceBtn").classList.remove("hidden");}});
$("exportBtn").addEventListener("click",()=>{
 const rows=[["Record type","Date","Name / category","Type","Amount / premium","Details"]];
 transactions.forEach(t=>rows.push(["Transaction",t.date,t.category,t.type,t.amount,[t.method,t.account,t.notes].filter(Boolean).join(" | ")]));
 commitments.forEach(c=>rows.push(["EMI / Loan",c.due,c.name,c.status,c.outstanding,`Lender: ${c.lender||""}; monthly EMI: ${c.monthly}`]));
 savings.forEach(s=>rows.push(["Savings",s.maturity,s.name,s.frequency,s.current,`Provider: ${s.provider||""}; contribution: ${s.contribution}; target: ${s.target}`]));
 insurances.forEach(i=>rows.push(["Insurance",i.renewal,i.name,i.status,i.premium,`Type: ${i.type}; insurer: ${i.company}; coverage: ${i.coverage}; frequency: ${i.frequency}`]));
 const csv=rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");
 const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8;"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`sathish-family-finance-${today()}.csv`;a.click();URL.revokeObjectURL(url);
});
monthOptions();$("monthFilter").value=today().slice(0,7);$("txDate").value=today();
if(!configReady){message("authMessage","Setup needed: paste the Firebase config for a NEW project into app.js.",true);}
