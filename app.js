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
let transactions = [], commitments = [], savings = [], insurances = [], monthlyBalances = [], creditCards = [], bankAccounts = [];
let openReportMonth = null;
let openReportDate = null;
const currency = n => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",minimumFractionDigits:0,maximumFractionDigits:0}).format(Number(n)||0);
const today = () => new Date().toLocaleDateString("en-CA");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const message = (id, text, error=false) => setMessage(id, text, error);
const path = name => collection(db,"users",currentUser.uid,name);
const showDate = v => v ? esc(v) : "—";
const formVal = id => $(id).value.trim();
function setBusy(btn, busy, label){ if(!btn.dataset.original) btn.dataset.original=btn.textContent; btn.disabled=busy; btn.textContent=busy?"Saving…":(label||btn.dataset.original); }
function clearTxForm(){ $("transactionForm").reset(); $("transactionId").value=""; if($("txLinkedEmi"))$("txLinkedEmi").value=""; if($("txLinkedCreditCard"))$("txLinkedCreditCard").value=""; if($("txBillPaymentCard"))$("txBillPaymentCard").value=""; $("txDate").value=today(); $("saveTxBtn").textContent="Save entry"; $("cancelTxBtn").classList.add("hidden"); }
function clearCommitmentForm(){ $("commitmentForm").reset(); $("commitmentId").value=""; $("cOutstanding").value="0"; $("cTotalAmount").value=""; $("cStart").value=today(); $("cMaturity").value=""; $("cancelCommitmentBtn").classList.add("hidden"); }
function clearSavingForm(){ $("savingForm").reset(); $("savingId").value=""; $("sCurrent").value="0"; $("sTarget").value="0"; $("cancelSavingBtn").classList.add("hidden"); }
function clearInsuranceForm(){ $("insuranceForm").reset(); $("insuranceId").value=""; $("iCoverage").value="0"; $("iStart").value=today(); $("iMaturity").value=""; $("cancelInsuranceBtn").classList.add("hidden"); }
function monthOptions(){
  const select=$("monthFilter"), now=new Date(); select.innerHTML=""; const all=document.createElement("option"); all.value="all"; all.textContent="All Months — Overall Summary"; select.append(all);
  for(let i=0;i<24;i++){ const d=new Date(now.getFullYear(),now.getMonth()-i,1); const val=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; const opt=document.createElement("option"); opt.value=val; opt.textContent=d.toLocaleDateString("en-IN",{month:"long",year:"numeric"}); select.append(opt); }
}
async function loadAll(){
  const names=[["transactions","transactions"],["commitments","commitments"],["savings","savings"],["insurances","insurances"],["monthlyBalances","monthlyBalances"],["creditCards","creditCards"],["bankAccounts","bankAccounts"]];
  const results=await Promise.all(names.map(async ([key,col])=>[key,(await getDocs(path(col))).docs.map(d=>({id:d.id,...d.data()}))]));
  for (const [key, value] of results) {
    if (key === "transactions") transactions = value;
    else if (key === "commitments") commitments = value;
    else if (key === "savings") savings = value;
    else if (key === "insurances") insurances = value;
    else if (key === "monthlyBalances") monthlyBalances = value;
    else if (key === "creditCards") creditCards = value;
    else if (key === "bankAccounts") bankAccounts = value;
  }
  populateLinkedPaymentOptions();
  renderAll();
}
function selectedTransactions(){
  const month=$("monthFilter").value;
  return month==="all" ? [...transactions] : transactions.filter(t=>(t.date||"").slice(0,7)===month);
}

function monthKeyFromDate(date){
  return String(date||"").slice(0,7);
}
function addMonthsPreserveDay(dateString, count=1){
  if(!dateString) return "";
  const d=new Date(dateString+"T00:00:00");
  if(Number.isNaN(d.getTime())) return dateString;
  const day=d.getDate();
  const target=new Date(d.getFullYear(),d.getMonth()+count,1);
  const last=new Date(target.getFullYear(),target.getMonth()+1,0).getDate();
  target.setDate(Math.min(day,last));
  return `${target.getFullYear()}-${String(target.getMonth()+1).padStart(2,"0")}-${String(target.getDate()).padStart(2,"0")}`;
}
function shiftMonth(month, count=1){
  const [y,m]=month.split("-").map(Number);
  const d=new Date(y,m-1+count,1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function getMonthLedger(month){
  const months=new Set([month,shiftMonth(month,-1)]);
  transactions.forEach(t=>{const m=monthKeyFromDate(t.date);if(/^\d{4}-\d{2}$/.test(m))months.add(m);});
  monthlyBalances.forEach(b=>{if(/^\d{4}-\d{2}$/.test(b.month||""))months.add(b.month);});
  const ordered=[...months].sort();
  let result=null;
  for(const m of ordered){
    const saved=monthlyBalances.find(b=>b.month===m);
    const previous=monthlyBalances.find(b=>b.month===shiftMonth(m,-1));
    // Carry-forward is applied only after the user confirms a transfer from the prior month.
    const transferredOpening=previous?.transferredToMonth===m ? Number(previous.transferredClosing||0) : 0;
    const opening=saved && saved.openingBalance!==undefined ? Number(saved.openingBalance||0) : transferredOpening;
    const rows=transactions.filter(t=>monthKeyFromDate(t.date)===m);
    const income=rows.filter(t=>t.type==="income").reduce((n,t)=>n+Number(t.amount||0),0);
    const expense = rows
.filter(t =>
    t.type==="expense" &&
    t.paymentFlow!=="credit_card_purchase"
)
.reduce(
    (n,t)=>n+Number(t.amount||0),
    0
);

    const emi=rows.filter(t=>t.type==="emi").reduce((n,t)=>n+Number(t.amount||0),0);
    const saving=rows.filter(t=>t.type==="saving").reduce((n,t)=>n+Number(t.amount||0),0);
    const closing=opening+income-expense-emi-saving;
    if(m===month) result={month:m,opening,income,expense,emi,saving,closing,transferredOut:saved?.transferredToMonth===shiftMonth(m,1),transferredToMonth:saved?.transferredToMonth||""};
  }
  return result || {month,opening:0,income:0,expense:0,emi:0,saving:0,closing:0,transferredOut:false,transferredToMonth:""};
}
function nextMonthDue(record, paymentDate=today()){
  // Preserve the contractual due-day even when a payment is recorded late.
  return addMonthsPreserveDay(record.due || paymentDate,1);
}
function getCommitmentRemainingMonths(c, asOf=today()){
  // The remaining count is derived only from Next Due Date through Maturity Date.
  // Legacy remainingMonths values are intentionally ignored to prevent stale counts.
  const due=c.due||c.start;
  const maturity=c.maturity;
  if(!due||!maturity) return 0;
  const first=new Date(due+"T00:00:00");
  const end=new Date(maturity+"T00:00:00");
  const todayDate=new Date(asOf+"T00:00:00");
  if([first,end,todayDate].some(d=>Number.isNaN(d.getTime()))||end<first) return 0;
  const anchorDay=first.getDate();
  const totalMonths=(end.getFullYear()-first.getFullYear())*12+(end.getMonth()-first.getMonth());
  let count=0;
  for(let offset=0;offset<=totalMonths;offset++){
    const monthIndex=first.getMonth()+offset;
    const year=first.getFullYear()+Math.floor(monthIndex/12);
    const month=monthIndex%12;
    const lastDay=new Date(year,month+1,0).getDate();
    const installment=new Date(year,month,Math.min(anchorDay,lastDay));
    if(installment>=todayDate&&installment<=end) count++;
  }
  return count;
}
async function applyCommitmentPayment(record, amount, paymentDate, transactionId){
  const updatedOutstanding=Math.max(0,Number(record.outstanding||0)-amount);
  const nextDue=nextMonthDue(record,paymentDate);
  const nextRecord={...record,due:nextDue};
  const remaining=getCommitmentRemainingMonths(nextRecord,paymentDate);
  await saveRecord("commitments",record.id,{
    outstanding:updatedOutstanding,
    paidAmount:Number(record.paidAmount||Math.max(0,Number(record.totalAmount||0)-Number(record.outstanding||0)))+amount,
    due:nextDue,
    status:updatedOutstanding<=0 || remaining<=0 ? "closed" : record.status,
    lastPaidDate:paymentDate,
    lastPaymentTransactionId:transactionId||""
  });
}

function bankOpeningRecord(){ return bankAccounts.find(a=>a.accountType==="main") || bankAccounts[0] || null; }
function isBankMethod(method){ return ["UPI","Auto debit","Bank transfer","Debit card"].includes(method||""); }
function recordedAfterBaseline(t, record){
  if(Number(record?.baselineAtMs)>0){
    const created=typeof t.createdAt?.toMillis==="function"?t.createdAt.toMillis():(t.createdAt instanceof Date?t.createdAt.getTime():0);
    return created>Number(record.baselineAtMs);
  }
  return (t.date||"")>=(record?.effectiveFrom||"0000-01-01");
}
function mainBankCurrentBalance(){
  const account=bankOpeningRecord(); if(!account) return 0;
  const movement=transactions.filter(t=>t.bankImpactApplied && recordedAfterBaseline(t,account)).reduce((n,t)=>n+Number(t.bankImpactAmount||0),0);
  return Number(account.openingBalance||0)+movement;
}
function cardCurrentOutstanding(card){
  const movement=transactions.filter(t=>t.cardImpactApplied && t.linkedCreditCardId===card.id && recordedAfterBaseline(t,card)).reduce((n,t)=>n+Number(t.cardImpactAmount||0),0);
  return Math.max(0,Number(card.openingOutstanding??card.outstanding??0)+movement);
}
function cardAvailableBalance(card){ return Math.max(0,Number(card.creditLimit||0)-cardCurrentOutstanding(card)); }
function transactionTypeLabel(t){ return t.type==="cardPayment"?"Credit Card Bill Payment":t.type; }
function renderDashboardCardBreakdown(){
  const details=$("dashboardCardAvailableDetails");
  if(!details)return;
  const active=creditCards.filter(c=>c.status!=="closed");
  details.innerHTML=active.length?active.map(card=>{
    const outstanding=cardCurrentOutstanding(card);
    const available=cardAvailableBalance(card);
    return `<div class="dashboard-card-row">
      <span><b>${esc(card.name)}</b> · ${esc(card.bank||"")}</span>
      <strong>${currency(available)} available</strong>
      <small>Credit limit ${currency(card.creditLimit||0)} · Outstanding ${currency(outstanding)}</small>
    </div>`;
  }).join(""):'<small>No active credit cards added.</small>';
}
function renderDashboard(){
  const list=selectedTransactions();
  const sum=type=>list.filter(t=>t.type===type).reduce((a,t)=>a+Number(t.amount||0),0);
  const selectedMonth=$("monthFilter").value;
  const ledger=selectedMonth==="all" ? null : getMonthLedger(selectedMonth);
  const allMonths=[...new Set([today().slice(0,7),...transactions.map(t=>monthKeyFromDate(t.date)).filter(m=>/^\d{4}-\d{2}$/.test(m)),...monthlyBalances.map(b=>b.month).filter(Boolean)])].sort();
  const overallLedger=getMonthLedger(allMonths[allMonths.length-1]);
  const balanceValue=selectedMonth==="all"
    ? overallLedger.closing
    : (ledger?.transferredOut ? 0 : ledger.closing);
  setText("totalIncome", currency(sum("income")));
  const normalExpense =
list
.filter(t =>
    t.type==="expense" &&
    t.paymentFlow!=="credit_card_purchase"
)
.reduce(
   (a,t)=>a+Number(t.amount||0),
   0
);

setText(
   "totalExpense",
   currency(normalExpense + sum("emi"))
);
  setText("balance", currency(balanceValue));
  const balanceHint=document.querySelector("#balance")?.parentElement?.querySelector("small");
  if(balanceHint) balanceHint.textContent=selectedMonth==="all"?"Overall monthly net position":(ledger?.transferredOut?`Transferred to ${ledger.transferredToMonth}`:"");
  setText("savingTotal", currency(sum("saving")));
  setText("emiPaid", currency(sum("emi")));
  setText("emiPending", currency(commitments.filter(c=>c.status==="active").reduce((a,c)=>a+Number(c.outstanding||0),0)));
  setText("dashboardMainBankBalance", bankAccounts.length?currency(mainBankCurrentBalance()):"Set opening balance");
  setText("dashboardCardAvailable",currency(creditCards.filter(c=>c.status!=="closed").reduce((n,c)=>n+cardAvailableBalance(c),0)));
  renderDashboardCardBreakdown();
}
function toggleDashboardCardBreakdown(){
  const card=$("dashboardCardAvailableToggle"),details=$("dashboardCardAvailableDetails");
  if(!card||!details)return;
  const open=details.classList.contains("hidden");
  details.classList.toggle("hidden",!open);
  card.setAttribute("aria-expanded",String(open));
}
$("dashboardCardAvailableToggle")?.addEventListener("click",e=>{
  if(e.target.closest("button,a"))return;
  toggleDashboardCardBreakdown();
});
$("dashboardCardAvailableToggle")?.addEventListener("keydown",e=>{
  if(e.key==="Enter"||e.key===" "){e.preventDefault();toggleDashboardCardBreakdown();}
});
function renderTransactions(){
  const q=$("txSearch").value.toLowerCase();
  const list=[...transactions].filter(t=>[t.date,t.type,t.category,t.method,t.account,t.notes].join(" ").toLowerCase().includes(q)).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  $("transactionsBody").innerHTML=list.map(t=>`<tr><td>${showDate(t.date)}</td><td><span class="pill ${esc(t.type)}">${esc(transactionTypeLabel(t))}</span></td><td>${esc(t.category)}</td><td class="amount">${currency(t.amount)}</td><td>${esc(t.method||"—")}</td><td>${esc([t.account,t.notes].filter(Boolean).join(" · ")||"—")}</td><td><button class="mini-btn" data-edit-tx="${esc(t.id)}">Edit</button><button class="mini-btn delete" data-delete-tx="${esc(t.id)}">Delete</button></td></tr>`).join("")||'<tr><td colspan="7">No transactions yet. Add your first entry above.</td></tr>';
}
function renderCommitments(){
  $("commitmentsBody").innerHTML=[...commitments].sort((a,b)=>(a.name||"").localeCompare(b.name||"")).map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.lender||"—")}</td><td class="amount">${currency(c.monthly)}</td><td class="amount">${currency(c.paidAmount||0)}</td><td class="amount">${currency(c.outstanding)}</td><td>${getCommitmentRemainingMonths(c)}</td><td>${showDate(c.start)}</td><td>${showDate(c.maturity)}</td><td>${showDate(c.due)}</td><td><span class="pill">${esc(c.status)}</span></td><td><button class="mini-btn" data-pay-c="${esc(c.id)}">Add to Daily Entry</button><button class="mini-btn" data-edit-c="${esc(c.id)}">Edit</button><button class="mini-btn delete" data-delete-c="${esc(c.id)}">Delete</button></td></tr>`).join("")||'<tr><td colspan="11">No EMI or loan commitments added.</td></tr>';
}

function renderCreditCards(){
  const body=$("creditCardsBody"); if(!body)return;
  body.innerHTML=[...creditCards].sort((a,b)=>(a.dueDate||a.nextDue||"").localeCompare(b.dueDate||b.nextDue||"")).map(c=>{
    const outstanding=cardCurrentOutstanding(c), available=cardAvailableBalance(c);
    const paid=transactions.filter(t=>t.type==="cardPayment"&&t.linkedCreditCardId===c.id&&monthKeyFromDate(t.date)===today().slice(0,7)).reduce((n,t)=>n+Number(t.amount||0),0);
    return `<tr><td>${esc(c.name)}</td><td>${esc(c.bank||"—")}</td><td class="amount">${currency(c.creditLimit||0)}</td><td class="amount">${currency(available)}</td><td class="amount">${currency(outstanding)}</td><td class="amount">${currency(paid)}</td><td class="amount">${currency(c.monthlyPayment||0)}</td><td>${showDate(c.dueDate||c.nextDue)}</td><td><span class="pill">${esc(c.status||"active")}</span></td><td><button class="mini-btn" data-pay-card="${esc(c.id)}">Add Bill Payment</button><button class="mini-btn" data-edit-card="${esc(c.id)}">Edit</button><button class="mini-btn delete" data-delete-card="${esc(c.id)}">Delete</button></td></tr>`;
  }).join("")||'<tr><td colspan="10">No credit cards added yet.</td></tr>';
  const active=creditCards.filter(c=>c.status!=="closed");
  setText("ccOutstandingTotal",currency(active.reduce((n,c)=>n+cardCurrentOutstanding(c),0)));
  setText("ccMonthlyTotal",currency(active.reduce((n,c)=>n+Number(c.monthlyPayment||c.minimumDue||0),0)));
  setText("ccCount",String(active.length));
  setText("ccLimitTotal",currency(active.reduce((n,c)=>n+Number(c.creditLimit||0),0)));
  setText("ccAvailableTotal",currency(active.reduce((n,c)=>n+cardAvailableBalance(c),0)));
  setText("mainBankBalance",bankAccounts.length?currency(mainBankCurrentBalance()):"Not configured");
  const bankInput=$("mainBankOpening"); if(bankInput && bankAccounts.length && document.activeElement!==bankInput) bankInput.value=mainBankCurrentBalance();
}

function renderSavings(){
  $("savingsBody").innerHTML=[...savings].sort((a,b)=>(a.name||"").localeCompare(b.name||"")).map(s=>`<tr><td>${esc(s.name)}</td><td>${esc(s.provider||"—")}</td><td>${esc(s.frequency)}</td><td class="amount">${currency(s.contribution)}</td><td class="amount">${currency(s.current)}</td><td class="amount">${currency(s.target)}</td><td>${showDate(s.start)}</td><td>${showDate(s.maturity)}</td><td><button class="mini-btn" data-pay-s="${esc(s.id)}">Add to Daily Entry</button><button class="mini-btn" data-edit-s="${esc(s.id)}">Edit</button><button class="mini-btn delete" data-delete-s="${esc(s.id)}">Delete</button></td></tr>`).join("")||'<tr><td colspan="9">No savings schemes added.</td></tr>';
}
function insurancePaidToDate(policy, asOf=today()){
  // Estimate installments due from the policy start date through today.
  // This is display-only: it does not rewrite existing Firestore records.
  const start=policy.start, end=policy.maturity;
  const premium=Math.max(0,Number(policy.premium||0));
  if(!start || !(premium>0)) return Math.max(0,Number(policy.paidAmount||0));
  const first=new Date(start+"T00:00:00");
  const todayDate=new Date(asOf+"T00:00:00");
  const endDate=end?new Date(end+"T00:00:00"):todayDate;
  if([first,todayDate,endDate].some(d=>Number.isNaN(d.getTime())) || first>todayDate) return Math.max(0,Number(policy.paidAmount||0));
  const stop=endDate<todayDate?endDate:todayDate;
  const frequencyMonths={"Monthly":1,"Quarterly":3,"Half-yearly":6,"Yearly":12};
  const interval=frequencyMonths[policy.frequency]||1;
  const anchorDay=first.getDate();
  let count=0;
  for(let offset=0; ; offset+=interval){
    const monthIndex=first.getMonth()+offset;
    const year=first.getFullYear()+Math.floor(monthIndex/12);
    const month=monthIndex%12;
    const lastDay=new Date(year,month+1,0).getDate();
    const due=new Date(year,month,Math.min(anchorDay,lastDay));
    if(due>stop) break;
    count++;
    if(offset>1200) break;
  }
  const dateBasedTotal=count*premium;
  // If manually recorded payments exceed the date-based estimate, preserve them.
  return Math.max(dateBasedTotal,Math.max(0,Number(policy.paidAmount||0)));
}
function renderInsurances(){
  $("insuranceBody").innerHTML=[...insurances].sort((a,b)=>(a.renewal||"").localeCompare(b.renewal||"")).map(i=>`<tr><td>${esc(i.name)}</td><td>${esc(i.type)}</td><td>${esc(i.company)}</td><td class="amount">${currency(i.premium)}</td><td>${esc(i.frequency)}</td><td class="amount">${currency(insurancePaidToDate(i))}</td><td>${Number(i.premium)>0?Math.max(0,monthsBetween(today(),i.maturity)):0}</td><td>${showDate(i.start)}</td><td>${showDate(i.maturity)}</td><td class="amount">${currency(i.coverage)}</td><td>${showDate(i.renewal)}</td><td><span class="pill">${esc(i.status)}</span></td><td><button class="mini-btn" data-pay-i="${esc(i.id)}">Add to Daily Entry</button><button class="mini-btn" data-edit-i="${esc(i.id)}">Edit</button><button class="mini-btn delete" data-delete-i="${esc(i.id)}">Delete</button></td></tr>`).join("")||'<tr><td colspan="13">No insurance policies added.</td></tr>';
}
function renderOverview(){ /* Full dashboard summary is rendered by renderDashboard() and renderChartsAndPanels(). */ }
function renderTypeLists(){
  const income=transactions.filter(t=>t.type==="income").sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const expenses=transactions.filter(t=>t.type==="expense"||t.type==="emi").sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  $("incomeBody").innerHTML=income.map(t=>`<tr><td>${showDate(t.date)}</td><td>${esc(t.category)}</td><td class="amount">${currency(t.amount)}</td><td>${esc([t.account,t.notes].filter(Boolean).join(" · ")||"—")}</td><td><button class="mini-btn" data-edit-tx="${esc(t.id)}">Edit</button><button class="mini-btn delete" data-delete-tx="${esc(t.id)}">Delete</button></td></tr>`).join("")||'<tr><td colspan="5">No income entries yet.</td></tr>';
  $("expensesBody").innerHTML=expenses.map(t=>`<tr><td>${showDate(t.date)}</td><td>${esc(t.category)}</td><td class="amount">${currency(t.amount)}</td><td>${esc(t.method||"—")}</td><td>${esc([t.account,t.notes].filter(Boolean).join(" · ")||"—")}</td><td><button class="mini-btn" data-edit-tx="${esc(t.id)}">Edit</button><button class="mini-btn delete" data-delete-tx="${esc(t.id)}">Delete</button></td></tr>`).join("")||'<tr><td colspan="6">No expense entries yet.</td></tr>';
}
function renderSectionTotals(){
  const sumType=(type,list=transactions)=>list.filter(t=>t.type===type).reduce((a,t)=>a+Number(t.amount||0),0);
  const monthList=selectedTransactions();
  const set=(id,value)=>setText(id,value);
  set("incomeScreenTotal",currency(sumType("income")));
  set("incomeScreenMonthTotal",currency(sumType("income",monthList)));
  set("incomeScreenCount",transactions.filter(t=>t.type==="income").length.toLocaleString("en-IN"));
  const actualExpense =
transactions
.filter(t =>
   t.type==="expense" &&
   t.paymentFlow!=="credit_card_purchase"
)
.reduce(
   (a,t)=>a+Number(t.amount||0),
   0
);

set(
 "expenseScreenTotal",
 currency(actualExpense + sumType("emi"))
);

  set("expenseScreenMonthTotal",currency(sumType("expense",monthList)+sumType("emi",monthList)));
  set("expenseScreenCount",transactions.filter(t=>t.type==="expense"||t.type==="emi").length.toLocaleString("en-IN"));
  set("dailyEntryCount",transactions.length.toLocaleString("en-IN"));
  set("dailyIncomeTotal",currency(sumType("income")));
  set("dailyExpenseTotal",currency(sumType("expense")+sumType("emi")));
  set("dailySavingEmiTotal",currency(sumType("saving")+sumType("emi")));
  const activeLoans=commitments.filter(c=>c.status==="active");
  set("emiScreenMonthlyTotal",currency(activeLoans.reduce((a,c)=>a+Number(c.monthly||0),0)));
  set("emiScreenOutstandingTotal",currency(activeLoans.reduce((a,c)=>a+Number(c.outstanding||0),0)));
  set("emiScreenCount",activeLoans.length.toLocaleString("en-IN"));
  set("savingsScreenCurrentTotal",currency(savings.reduce((a,s)=>a+Number(s.current||0),0)));
  set("savingsScreenContributionTotal",currency(savings.reduce((a,s)=>a+Number(s.contribution||0),0)));
  set("savingsScreenTargetTotal",currency(savings.reduce((a,s)=>a+Number(s.target||0),0)));
  set("insuranceScreenPremiumTotal",currency(insurances.reduce((a,i)=>a+Number(i.premium||0),0)));
  set("insuranceScreenCoverageTotal",currency(insurances.reduce((a,i)=>a+Number(i.coverage||0),0)));
  set("insuranceScreenActiveCount",insurances.filter(i=>i.status==="active").length.toLocaleString("en-IN"));
}
function renderAll(){renderDashboard();renderTransactions();renderCommitments();renderCreditCards();renderSavings();renderInsurances();renderOverview();renderTypeLists();renderChartsAndPanels();renderSectionTotals();fillReportMonths();renderMonthlyReport();}

function renderChartsAndPanels(){
  const list=selectedTransactions();
  const incomes=list.filter(t=>t.type==="income").reduce((a,t)=>a+Number(t.amount||0),0);
  const expenses=list
.filter(t =>
   t.type==="emi" ||
   (
      t.type==="expense" &&
      t.paymentFlow!=="credit_card_purchase"
   )
)
.reduce(
   (a,t)=>a+Number(t.amount||0),
   0
);
  const max=Math.max(incomes,expenses,1);
  const chart=$("cashflowChart");
  if(chart) chart.innerHTML=`
  <div class="chart-month">
    <div class="chart-bars">
      <div class="chart-bar income"
        title="Income: ${currency(incomes)}"
        aria-label="Income: ${currency(incomes)}"
        style="height:${Math.max(3,incomes/max*100)}%">
      </div>
      <div class="chart-bar expense"
        title="Expenses: ${currency(expenses)}"
        aria-label="Expenses: ${currency(expenses)}"
        style="height:${Math.max(3,expenses/max*100)}%">
      </div>
    </div>
    <small>${esc($("monthFilter").selectedOptions[0]?.textContent||"Selected")}</small>
  </div>`;
  const totals={};
  list.filter(t=>t.type==="expense"||t.type==="emi").forEach(t=>{const cat=t.type==="emi"?(t.category||"EMI / Loan"): (t.category||"Other");totals[cat]=(totals[cat]||0)+Number(t.amount||0);});
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
  if(recentBody) recentBody.innerHTML=recent.map(t=>`<tr><td>${showDate(t.date)}</td><td><span class="pill ${esc(t.type)}">${esc(transactionTypeLabel(t))}</span></td><td>${esc(t.category)}</td><td class="amount">${currency(t.amount)}</td><td>${esc(t.method||"—")}</td><td>${esc(t.notes||"—")}</td></tr>`).join("")||'<tr><td colspan="6">No entries for this month yet.</td></tr>';
  const cb=$("dashboardCommitmentsBody");
  if(cb) cb.innerHTML=commitments.filter(c=>c.status==="active").slice(0,5).map(c=>`<tr><td>${esc(c.name)}</td><td>${currency(c.monthly)}</td><td>${currency(c.outstanding)}</td><td>${showDate(c.due)}</td><td><span class="pill">${esc(c.status)}</span></td></tr>`).join("")||'<tr><td colspan="5">No active loans.</td></tr>';
  const ib=$("dashboardInsuranceBody");
  if(ib) ib.innerHTML=insurances.filter(i=>i.status==="active").slice(0,4).map(i=>`<tr><td>${esc(i.name)}</td><td>${esc(i.company)}</td><td>${currency(i.premium)}</td><td>${currency(i.coverage)}</td><td>${showDate(i.renewal)}</td><td><span class="pill">${esc(i.status)}</span></td></tr>`).join("")||'<tr><td colspan="6">No active policies.</td></tr>';
  const due=$("dashboardDueBody");
  if(due) due.innerHTML=commitments.filter(c=>c.status==="active"&&c.due).sort((a,b)=>a.due.localeCompare(b.due)).slice(0,5).map(c=>`<tr><td>${showDate(c.due)}</td><td>${esc(c.name)}</td><td>${currency(c.monthly)}</td><td><span class="pill">Pending</span></td></tr>`).join("")||'<tr><td colspan="4">No upcoming due dates.</td></tr>';
  const methods=$("paymentMethodSummary");
  if(methods) {
    const byMethod={};
    list.filter(t=>t.type==="expense"||t.type==="emi").forEach(t=>{const m=t.method||"Other";byMethod[m]=(byMethod[m]||0)+Number(t.amount||0);});
    const methodPairs=Object.entries(byMethod).sort((a,b)=>b[1]-a[1]);
    methods.innerHTML = methodPairs.map(([name, total]) => `
  <div class="budget-item payment-method-card"
       data-payment-method="${esc(name)}"
       role="button"
       tabindex="0"
       aria-expanded="false">
    <span>💳 ${esc(name)}</span>
    <strong>${currency(total)}</strong>
    <span>${sum ? Math.round(total / sum * 100) : 0}% of expenses</span>
    <div class="payment-method-details hidden"></div>
  </div>
`).join("") || '<p class="chart-empty">No expense payment methods for this period.</p>';
  }
  const budget=$("budgetSummary");
  if(budget) budget.innerHTML=pairs.map(p=>`<div class="budget-item budget-clickable" tabindex="0" role="button" data-budget-category="${esc(p[0])}" aria-expanded="false"><span>${/shop/i.test(p[0])?"🛒":/grocer/i.test(p[0])?"🛍️":"📊"} ${esc(p[0])}</span><strong>${currency(p[1])}</strong><span>${sum?Math.round(p[1]/sum*100):0}% of expenses · Click to view details</span><div class="budget-details hidden"></div></div>`).join("")||'<p class="chart-empty">Add expense entries to see category totals.</p>';
}
$("paymentMethodSummary").addEventListener("click", e => {
  const card = e.target.closest(".payment-method-card");
  if (!card) return;

  const details = card.querySelector(".payment-method-details");
  const isOpen = !details.classList.contains("hidden");

  if (isOpen) {
    details.classList.add("hidden");
    card.setAttribute("aria-expanded", "false");
    return;
  }

  $("paymentMethodSummary")
    .querySelectorAll(".payment-method-card")
    .forEach(item => {
      item.querySelector(".payment-method-details")
        .classList.add("hidden");
      item.setAttribute("aria-expanded", "false");
    });

  const method = card.dataset.paymentMethod;

  const items = selectedTransactions().filter(t =>
    (t.type === "expense" || t.type === "emi") && t.method === method
  );

  details.innerHTML = items.length
    ? items.map(t => `
        <div class="payment-detail-row">
          <span>${esc(t.date || "—")} · ${esc(t.category || "Other")}</span>
          <strong>${currency(t.amount)}</strong>
        </div>
      `).join("")
    : "<p>No transactions found.</p>";

  details.classList.remove("hidden");
  card.setAttribute("aria-expanded", "true");
});

function monthsBetween(start,end){
  // Whole elapsed calendar months between two dates; does not count both
  // the starting and ending calendar months automatically.
  if(!start||!end) return 0;
  const a=new Date(start+"T00:00:00"), b=new Date(end+"T00:00:00");
  if(Number.isNaN(a.getTime())||Number.isNaN(b.getTime())||b<a) return 0;
  let months=(b.getFullYear()-a.getFullYear())*12+(b.getMonth()-a.getMonth());
  if(b.getDate()<a.getDate()) months--;
  return Math.max(0,months);
}
function remainingEmiMonths(start,end,asOf=today()){
  // Count actual monthly EMI due dates from the start-date day through
  // maturity, counting only installments due today or in the future.
  if(!start||!end) return 0;
  const a=new Date(start+"T00:00:00"), b=new Date(end+"T00:00:00"), now=new Date(asOf+"T00:00:00");
  if([a,b,now].some(d=>Number.isNaN(d.getTime()))||b<a||b<now) return 0;
  const anchorDay=a.getDate();
  let count=0;
  const totalMonths=(b.getFullYear()-a.getFullYear())*12+(b.getMonth()-a.getMonth());
  for(let offset=0;offset<=totalMonths;offset++){
    const year=a.getFullYear()+Math.floor((a.getMonth()+offset)/12);
    const month=(a.getMonth()+offset)%12;
    const lastDay=new Date(year,month+1,0).getDate();
    const due=new Date(year,month,Math.min(anchorDay,lastDay));
    if(due>=now&&due<=b) count++;
  }
  return count;
}
function frequencyMonths(freq){
  return ({Monthly:1,Weekly:0.25,Quarterly:3,"Half-yearly":6,Yearly:12,"One-time":1200})[freq]||1;
}
function fillReportMonths(){
  const sel=$("reportMonth"); if(!sel)return;
  const current=today().slice(0,7), vals=new Set([current]);
  transactions.forEach(t=>{if(t.date) vals.add(t.date.slice(0,7));});
  monthlyBalances.forEach(b=>{if(b.month) vals.add(b.month);});
  sel.innerHTML=[...vals].sort().reverse().map(m=>`<option value="${m}">${new Date(m+"-01T00:00:00").toLocaleDateString("en-IN",{month:"long",year:"numeric"})}</option>`).join("");
  if(!sel.value)sel.value=current;
}
function renderMonthlyReport(){
  const sel=$("reportMonth"); if(!sel)return;
  const month=sel.value||today().slice(0,7);
  const rows=transactions.filter(t=>(t.date||"").slice(0,7)===month)
    .sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  // Month buttons only represent months that actually contain saved transactions.
  const monthSet=new Set(transactions
    .filter(t=>/^\d{4}-\d{2}-\d{2}$/.test(t.date||""))
    .map(t=>t.date.slice(0,7)));
  monthlyBalances.forEach(b=>{if(b.month)monthSet.add(b.month);});
  const monthLabels=[...monthSet].sort().reverse();
  const listEl=$("monthlyReportList");
  if(listEl){
    listEl.innerHTML=monthLabels.map(m=>{
      const monthRows=transactions.filter(t=>(t.date||"").slice(0,7)===m);
      const totalExpense=monthRows.filter(t=>t.type==="expense"||t.type==="emi")
        .reduce((n,t)=>n+Number(t.amount||0),0);
      const label=new Date(m+"-01T00:00:00").toLocaleDateString("en-IN",{month:"long",year:"numeric"});
      return `<button type="button" class="month-report-button ${openReportMonth===m?"active":""}" data-month-card="${m}" aria-expanded="${openReportMonth===m}">
        <span class="month-report-name">📅 ${esc(label)}</span>
        <span class="month-report-meta">${monthRows.length} ${monthRows.length===1?"entry":"entries"}</span>
        <strong>${currency(totalExpense)} expense</strong>
        <span class="month-report-action">${openReportMonth===m?"Hide details":"View date-wise details"} ↘</span>
      </button>`;
    }).join("") || '<p class="chart-empty">No saved transactions yet. Month buttons will appear here after you add entries.</p>';
  }
  const sum=types=>rows.filter(t=>types.includes(t.type)).reduce((n,t)=>n+Number(t.amount||0),0);
  const income=sum(["income"]), expenses=sum(["expense"]), emi=sum(["emi"]), saving=sum(["saving"]);
  // Opening balance is the previous month's closing balance unless this month has an explicitly saved opening adjustment.
  const ledger=getMonthLedger(month);
  const opening=ledger.opening;
  const closing=ledger.closing;
  $("manualOpeningBalance").value=opening;
  $("monthlyReportSummary").classList.toggle("hidden",openReportMonth!==month);
  $("monthlyReportDetails").classList.toggle("hidden",openReportMonth!==month);
  $("monthlyReportSummary").innerHTML=[
    ["Opening / Carry-forward",opening],["Income",income],["Expenses + EMI",expenses+emi],["Savings",saving],["Closing Balance",closing]
  ].map(([label,val])=>`<article class="section-total"><span>${label}</span><strong>${currency(val)}</strong><small>${label==="Closing Balance"?"Carried to next month":"Selected month"}</small></article>`).join("");

  // Group every transaction by date and show daily totals plus the individual entries.
  const byDate={};
  rows.forEach(t=>{const d=t.date||"Undated";(byDate[d] ||= []).push(t);});
  const dateGroups=Object.entries(byDate).sort((a,b)=>b[0].localeCompare(a[0]));
  const monthLabel=new Date(month+"-01T00:00:00").toLocaleDateString("en-IN",{month:"long",year:"numeric"});
  // Dates are shown as compact clickable rows. Transaction details expand only
  // when the user clicks a specific date; this is display-only and reads saved records.
  const dateHtml=dateGroups.map(([date,items])=>{
    const dailyIncome=items.filter(t=>t.type==="income").reduce((n,t)=>n+Number(t.amount||0),0);
    const dailyExpense=items.filter(t=>t.type==="expense").reduce((n,t)=>n+Number(t.amount||0),0);
    const dailyEmi=items.filter(t=>t.type==="emi").reduce((n,t)=>n+Number(t.amount||0),0);
    const dailySaving=items.filter(t=>t.type==="saving").reduce((n,t)=>n+Number(t.amount||0),0);
    const expenseTotal=dailyExpense+dailyEmi;
    const dateKey=`${month}|${date}`;
    const expanded=openReportDate===dateKey && openReportMonth===month;
    return `<section class="daily-report-group ${expanded?"expanded":""}">
      <button type="button" class="daily-report-toggle" data-date-card="${esc(date)}" aria-expanded="${expanded}">
        <span class="daily-report-date"><strong>${date==="Undated"?"Date not set":esc(date)}</strong><small>${items.length} ${items.length===1?"entry":"entries"}</small></span>
        <span class="daily-report-totals"><span>Expense + EMI<strong>${currency(expenseTotal)}</strong></span><span>Income<strong>${currency(dailyIncome)}</strong></span></span>
        <span class="daily-report-action">${expanded?"Hide entries ↑":"View entries ↓"}</span>
      </button>
      <div class="daily-report-content ${expanded?"":"hidden"}">
        <div class="table-wrap"><table><thead><tr><th>Type</th><th>Category</th><th>Amount</th><th>Method</th><th>Account / Notes</th></tr></thead><tbody>
        ${items.map(t=>`<tr><td><span class="pill ${esc(t.type)}">${esc(transactionTypeLabel(t)==="emi"?"EMI / Loan":transactionTypeLabel(t)==="saving"?"Savings":transactionTypeLabel(t))}</span></td><td>${esc(t.category||"—")}</td><td class="amount">${currency(t.amount)}</td><td>${esc(t.method||"—")}</td><td>${esc([t.account,t.notes].filter(Boolean).join(" · ")||"—")}</td></tr>`).join("")}
        <tr class="daily-subtotal-row"><td colspan="2">Daily totals</td><td class="amount">${currency(expenseTotal)} expense + EMI</td><td colspan="2">Savings: ${currency(dailySaving)} · Income: ${currency(dailyIncome)}</td></tr>
        </tbody></table></div>
      </div>
    </section>`;
  }).join("");
  $("monthlyReportDetails").innerHTML=`<div class="panel-heading"><div><h3>${esc(monthLabel)} — Date-wise summary</h3><p>Click any date to expand and see the individual entries for that day.</p></div></div>
    ${dateHtml||'<p class="chart-empty">No entries saved for this month.</p>'}`;
}
async function addLinkedEntry(kind,id){
  try{
    const record=({emi:commitments,saving:savings,insurance:insurances,creditCard:creditCards})[kind]?.find(x=>x.id===id); if(!record)return;
    const amount=kind==="emi"?Number(record.monthly||0):kind==="saving"?Number(record.contribution||0):kind==="insurance"?Number(record.premium||0):Number(record.monthlyPayment||record.minimumDue||0);
    if(!(amount>0)){message("appMessage","Enter an amount greater than zero first.",true);return;}
    if((kind==="creditCard"||kind==="emi"||kind==="saving"||kind==="insurance") && !bankAccounts.length){message("appMessage","Set your Main Bank opening balance before recording an Auto debit payment.",true);return;}
    if(kind==="creditCard" && amount>cardCurrentOutstanding(record)){message("appMessage",`Payment exceeds outstanding balance ${currency(cardCurrentOutstanding(record))}.`,true);return;}
    const type=kind==="emi"?"emi":kind==="saving"?"saving":kind==="creditCard"?"cardPayment":"expense";
    const category=kind==="emi"?`${record.name} EMI`:kind==="saving"?`${record.name} contribution`:kind==="insurance"?`${record.name} premium`:`Credit Card Bill Payment - ${record.name}`;
    const transactionData={date:today(),type,category,amount,method:"Auto debit",account:record.lender||record.provider||record.company||record.bank||"",bankImpactApplied:kind!=="creditCard",bankImpactAmount:kind!=="creditCard"?-amount:0,notes:`Added from ${kind==="emi"?"EMI & Loans":kind==="saving"?"Savings Schemes":kind==="insurance"?"Insurance":"Credit Cards"} screen`,...(kind==="emi"?{linkedCommitmentId:id,commitmentApplied:true}:{}),...(kind==="creditCard"?{linkedCreditCardId:id,cardImpactApplied:true,cardImpactAmount:-amount,bankImpactApplied:true,bankImpactAmount:-amount}:{})};
    const transactionRef=await addDoc(path("transactions"),{...transactionData,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    if(kind==="emi") await applyCommitmentPayment(record,amount,today(),transactionRef.id);
    else if(kind==="saving") await saveRecord("savings",id,{current:Number(record.current||0)+amount});
    else if(kind==="insurance") await saveRecord("insurances",id,{paidAmount:Number(record.paidAmount||0)+amount});
    await loadAll(); showSection("entries"); message("appMessage",`${category} recorded. Bank and card balances updated without adding a duplicate expense.`);
  }catch(err){message("appMessage","Could not add payment: "+err.message,true);}
}
function toggleCreditCardFields(){

    const type = $("txType")?.value;
    const method = $("txMethod")?.value;

    const purchaseCard =
        $("txLinkedCreditCard")
        ?.parentElement;

    const billCard =
        $("txBillPaymentCard")
        ?.parentElement;

    if(type === "cardPayment"){

        if(purchaseCard)
            purchaseCard.style.display="none";

        if(billCard)
            billCard.style.display="block";
    }
    else if(
        type==="expense" &&
        method==="Credit card"
    ){

        if(purchaseCard)
            purchaseCard.style.display="block";

        if(billCard)
            billCard.style.display="none";
    }
    else{

        if(purchaseCard)
            purchaseCard.style.display="none";

        if(billCard)
            billCard.style.display="none";
    }
}
function populateLinkedPaymentOptions(){
  const emiSelect=$("txLinkedEmi"), cardSelect=$("txLinkedCreditCard"), billSelect=$("txBillPaymentCard");
  if(emiSelect) emiSelect.innerHTML='<option value="">Not linked</option>'+commitments.filter(c=>c.status==="active").map(c=>`<option value="${esc(c.id)}">${esc(c.name)} · ${currency(c.monthly)}</option>`).join("");
  if(cardSelect) cardSelect.innerHTML='<option value="">Select card used</option>'+creditCards.filter(c=>c.status!=="closed").map(c=>`<option value="${esc(c.id)}">${esc(c.name)} · Available ${currency(cardAvailableBalance(c))}</option>`).join("");
  if(billSelect) billSelect.innerHTML='<option value="">Select card bill</option>'+creditCards.filter(c=>c.status!=="closed").map(c=>`<option value="${esc(c.id)}">${esc(c.name)} · Outstanding ${currency(cardCurrentOutstanding(c))}</option>`).join("");
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
  currentUser=user; $("authScreen").classList.toggle("hidden",!!user); $("appShell").classList.toggle("hidden",!user); $("appPanel").classList.toggle("hidden",!user); $("signOutBtn").classList.toggle("hidden",!user); setText("userLabel", user ? user.email : "Not signed in"); setText("sidebarEmail", user ? user.email : "Your account");
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
let transactionSaving = false;
$("transactionForm").addEventListener("submit",async e=>{
 e.preventDefault(); if(transactionSaving) return;
 const btn=$("saveTxBtn"), id=formVal("transactionId"); transactionSaving=true; setBusy(btn,true);
 try {
   const selectedType=formVal("txType"), amount=Number(formVal("txAmount")), method=formVal("txMethod"), date=formVal("txDate");
   if(!(amount>0)) throw new Error("Enter an amount greater than zero.");
   const type=selectedType==="cardPayment"?"cardPayment":selectedType;
   const linkedEmiId=$("txLinkedEmi")?.value||"";
   const linkedCardId=$("txLinkedCreditCard")?.value||"";
   const billCardId=$("txBillPaymentCard")?.value||"";
   if(type==="expense" && method==="Credit card" && !linkedCardId) throw new Error("Select which credit card was used for this purchase.");
   if(type==="cardPayment" && !billCardId) throw new Error("Select the credit card whose bill you are paying.");
   if(type==="cardPayment" && !isBankMethod(method)) throw new Error("Credit card bill payment must use UPI, Auto debit, Bank transfer or Debit card from your Main Bank.");
   if((type==="income"||type==="expense"||type==="emi"||type==="saving"||type==="cardPayment") && isBankMethod(method) && !bankAccounts.length) throw new Error("First save your Main Bank opening balance in the Credit Cards screen.");
   const payload={date,type,category:formVal("txCategory"),amount,method,account:formVal("txAccount"),notes:formVal("txNotes")};
   if(type==="emi"&&linkedEmiId){const linked=commitments.find(c=>c.id===linkedEmiId);if(linked){payload.linkedCommitmentId=linkedEmiId;payload.commitmentApplied=true;}}
   if(type==="expense"&&method==="Credit card"){
     const card=creditCards.find(c=>c.id===linkedCardId); if(!card) throw new Error("Selected credit card was not found.");
     if(amount>cardAvailableBalance(card)) throw new Error(`Insufficient available limit on ${card.name}. Available: ${currency(cardAvailableBalance(card))}.`);
     payload.linkedCreditCardId=linkedCardId;payload.cardImpactApplied=true;payload.cardImpactAmount=amount;payload.bankImpactApplied=false;payload.paymentFlow="credit_card_purchase";
   } else if(type==="cardPayment"){
     const card=creditCards.find(c=>c.id===billCardId); if(!card) throw new Error("Selected credit card was not found.");
     if(amount>cardCurrentOutstanding(card)) throw new Error(`Payment exceeds ${card.name} outstanding ${currency(cardCurrentOutstanding(card))}.`);
     payload.linkedCreditCardId=billCardId;payload.cardImpactApplied=true;payload.cardImpactAmount=-amount;payload.bankImpactApplied=true;payload.bankImpactAmount=-amount;payload.paymentFlow="credit_card_bill_payment";
     if(!payload.category) payload.category=`Credit Card Bill Payment - ${card.name}`;
   } else {
     payload.bankImpactApplied=isBankMethod(method);
     payload.bankImpactAmount=payload.bankImpactApplied?(type==="income"?amount:(type==="expense"||type==="emi"||type==="saving"?-amount:0)):0;
   }
   if(id){
const existing = transactions.find(t => t.id === id) || {};
     if(existing.linkedCommitmentId&&!payload.linkedCommitmentId){payload.linkedCommitmentId=existing.linkedCommitmentId;payload.commitmentApplied=existing.commitmentApplied;}
     await saveRecord("transactions",id,payload);
   }else{
     const ref=await addDoc(path("transactions"),{...payload,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
     if(payload.linkedCommitmentId){const linked=commitments.find(c=>c.id===payload.linkedCommitmentId);if(linked) await applyCommitmentPayment(linked,amount,date,ref.id);}
   }
   clearTxForm(); await loadAll(); message("appMessage",id?"Transaction updated. Account balances recalculated.":"Transaction saved. Main Bank / Credit Card balances updated separately.");
 } catch(err){message("appMessage",(err.code ? err.code + ": " : "") + err.message,true);}
 finally { transactionSaving=false; setBusy(btn,false,$("transactionId").value?"Update entry":"Save Entry"); }
});
$("commitmentForm").addEventListener("submit",async e=>{e.preventDefault();try{const id=formVal("commitmentId");const old=commitments.find(c=>c.id===id)||{}; await saveRecord("commitments",id,{name:formVal("cName"),lender:formVal("cLender"),totalAmount:Number(formVal("cTotalAmount")||old.totalAmount||0),monthly:Number(formVal("cMonthly")),outstanding:Number(formVal("cOutstanding")),paidAmount:Number(old.paidAmount||Math.max(0,Number(old.totalAmount||0)-Number(old.outstanding||0))),start:formVal("cStart"),maturity:formVal("cMaturity"),due:formVal("cDue"),status:formVal("cStatus"),notes:formVal("cNotes")});clearCommitmentForm();await loadAll();message("appMessage","EMI / loan commitment saved.");}catch(err){message("appMessage",(err.code ? err.code + ": " : "") + err.message,true);}});

$("creditCardForm")?.addEventListener("submit",async e=>{
  e.preventDefault();
  try{
    const id=formVal("creditCardId"),old=creditCards.find(c=>c.id===id)||{};
    await saveRecord("creditCards",id,{
      name:formVal("ccName"),bank:formVal("ccBank"),
      creditLimit:Number(formVal("ccCreditLimit")),outstanding:Number(formVal("ccOutstanding")),openingOutstanding:Number(formVal("ccOutstanding")),effectiveFrom:today(),baselineAtMs:Date.now(),
      monthlyPayment:Number(formVal("ccMonthlyPayment")||0),
      minimumDue:Number(formVal("ccMinimumDue")||0),
      dueDate:formVal("ccDueDate"),status:formVal("ccStatus"),
      paidThisMonth:Number(old.paidThisMonth||0)
    });
    $("creditCardForm").reset();$("creditCardId").value="";$("cancelCreditCardBtn").classList.add("hidden");
    await loadAll();message("appMessage","Credit card details saved.");
  }catch(err){message("appMessage",err.message,true);}
});
$("cancelCreditCardBtn")?.addEventListener("click",()=>{$("creditCardForm").reset();$("creditCardId").value="";$("cancelCreditCardBtn").classList.add("hidden");});
$("creditCardsBody")?.addEventListener("click",e=>{
  const pay=e.target.closest("[data-pay-card]"),del=e.target.closest("[data-delete-card]"),edit=e.target.closest("[data-edit-card]");
  if(pay)return addLinkedEntry("creditCard",pay.dataset.payCard);
  if(del)return removeRecord("creditCards",del.dataset.deleteCard,"credit card");
  if(edit){const c=creditCards.find(x=>x.id===edit.dataset.editCard);if(!c)return;
    $("creditCardId").value=c.id;
    for(const [k,v] of Object.entries({ccName:c.name,ccBank:c.bank,ccCreditLimit:c.creditLimit,ccOutstanding:cardCurrentOutstanding(c),ccMonthlyPayment:c.monthlyPayment,ccMinimumDue:c.minimumDue,ccDueDate:c.dueDate||c.nextDue,ccStatus:c.status}))$(k).value=v??"";
    $("cancelCreditCardBtn").classList.remove("hidden");
  }
});
$("mainBankForm")?.addEventListener("submit",async e=>{
  e.preventDefault();
  try{
    const opening=Number(formVal("mainBankOpening"));
    if(!Number.isFinite(opening)||opening<0) throw new Error("Enter a valid Main Bank balance.");
    const existing=bankOpeningRecord();
    const payload={accountType:"main",name:"Main Bank",openingBalance:opening,effectiveFrom:today(),baselineAtMs:Date.now(),updatedAt:serverTimestamp()};
    if(existing?.id) await updateDoc(doc(db,"users",currentUser.uid,"bankAccounts",existing.id),payload);
    else {payload.createdAt=serverTimestamp();await addDoc(path("bankAccounts"),payload);}
    bankAccounts=(await getDocs(path("bankAccounts"))).docs.map(d=>({id:d.id,...d.data()}));
    renderAll();message("appMessage",`Main Bank opening balance saved as ${currency(opening)}. New bank-linked entries will update it automatically.`);
  }catch(err){message("appMessage","Could not save Main Bank balance: "+err.message,true);}
});
$("savingForm").addEventListener("submit",async e=>{e.preventDefault();try{const id=formVal("savingId");await saveRecord("savings",id,{name:formVal("sName"),provider:formVal("sProvider"),frequency:formVal("sFrequency"),contribution:Number(formVal("sContribution")),current:Number(formVal("sCurrent")),target:Number(formVal("sTarget")),start:formVal("sStart"),maturity:formVal("sMaturity")});clearSavingForm();await loadAll();message("appMessage","Savings scheme saved.");}catch(err){message("appMessage",(err.code ? err.code + ": " : "") + err.message,true);}});
$("insuranceForm").addEventListener("submit",async e=>{e.preventDefault();try{const id=formVal("insuranceId");const old=insurances.find(i=>i.id===id)||{}; await saveRecord("insurances",id,{name:formVal("iName"),type:formVal("iType"),company:formVal("iCompany"),policy:formVal("iPolicy"),premium:Number(formVal("iPremium")),frequency:formVal("iFrequency"),coverage:Number(formVal("iCoverage")),start:formVal("iStart"),maturity:formVal("iMaturity"),paidAmount:Number(old.paidAmount||0),renewal:formVal("iRenewal"),status:formVal("iStatus"),notes:formVal("iNotes")});clearInsuranceForm();await loadAll();message("appMessage","Insurance policy saved.");}catch(err){message("appMessage",(err.code ? err.code + ": " : "") + err.message,true);}});
$("cancelTxBtn").addEventListener("click",clearTxForm);$("cancelCommitmentBtn").addEventListener("click",clearCommitmentForm);$("cancelSavingBtn").addEventListener("click",clearSavingForm);$("cancelInsuranceBtn").addEventListener("click",clearInsuranceForm);
$("monthFilter").addEventListener("change",()=>{renderDashboard();renderOverview();renderChartsAndPanels();renderSectionTotals();});$("txSearch").addEventListener("input",renderTransactions);$("budgetSummary").addEventListener("click",e=>{const item=e.target.closest("[data-budget-category]");if(!item)return;const details=item.querySelector(".budget-details");const open=details.classList.contains("hidden");details.classList.toggle("hidden",!open);item.setAttribute("aria-expanded",String(open));if(open){const cat=item.dataset.budgetCategory;const list=selectedTransactions().filter(t=>(t.type==="expense"||t.type==="emi")&&((t.type==="emi"?(t.category||"EMI / Loan"):(t.category||"Other"))===cat)).sort((a,b)=>(b.date||"").localeCompare(a.date||""));details.innerHTML=list.map(t=>`<div class="budget-detail-row"><span>${showDate(t.date)} · ${esc(t.method||"—")}</span><b>${currency(t.amount)}</b></div>`).join("")||"<small>No details</small>";}});

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
$("transactionsBody").addEventListener("click",async e=>{const edit=e.target.closest("[data-edit-tx]"),del=e.target.closest("[data-delete-tx]");if(del)return removeRecord("transactions",del.dataset.deleteTx,"transaction");if(edit){const t=transactions.find(x=>x.id===edit.dataset.editTx);if(!t)return;$("transactionId").value=t.id;for(const [k,v] of Object.entries({txDate:t.date,txType:t.paymentFlow==="credit_card_bill_payment"?"cardPayment":t.type,txCategory:t.category,txAmount:t.amount,txMethod:t.method,txAccount:t.account,txNotes:t.notes}))$(k).value=v??"";$("saveTxBtn").textContent="Update entry";if($("txLinkedEmi"))$("txLinkedEmi").value=t.linkedCommitmentId||"";if($("txLinkedCreditCard"))$("txLinkedCreditCard").value=t.paymentFlow==="credit_card_purchase"?t.linkedCreditCardId||"":"";if($("txBillPaymentCard"))$("txBillPaymentCard").value=t.paymentFlow==="credit_card_bill_payment"?t.linkedCreditCardId||"":"";$("cancelTxBtn").classList.remove("hidden");toggleCreditCardFields();window.scrollTo({top:0,behavior:"smooth"});}});
$("incomeBody").addEventListener("click", e=>handleTransactionAction(e));
$("expensesBody").addEventListener("click", e=>handleTransactionAction(e));
function handleTransactionAction(e){
  const edit=e.target.closest("[data-edit-tx]"),del=e.target.closest("[data-delete-tx]");
  if(del) return removeRecord("transactions",del.dataset.deleteTx,"transaction");
  if(edit){
    const t=transactions.find(x=>x.id===edit.dataset.editTx); if(!t)return;
    $("transactionId").value=t.id;
    for(const [k,v] of Object.entries({txDate:t.date,txType:t.paymentFlow==="credit_card_bill_payment"?"cardPayment":t.type,txCategory:t.category,txAmount:t.amount,txMethod:t.method,txAccount:t.account,txNotes:t.notes}))$(k).value=v??"";
    $("saveTxBtn").textContent="Update entry";if($("txLinkedEmi"))$("txLinkedEmi").value=t.linkedCommitmentId||"";if($("txLinkedCreditCard"))$("txLinkedCreditCard").value=t.paymentFlow==="credit_card_purchase"?t.linkedCreditCardId||"":"";if($("txBillPaymentCard"))$("txBillPaymentCard").value=t.paymentFlow==="credit_card_bill_payment"?t.linkedCreditCardId||"":"";$("cancelTxBtn").classList.remove("hidden");
    toggleCreditCardFields();
    document.querySelectorAll(".side-link").forEach(b=>b.classList.toggle("active",b.dataset.tab==="entries"));
    document.querySelectorAll(".tab-panel").forEach(p=>p.classList.toggle("hidden",p.id!=="tab-entries"));
    window.scrollTo({top:0,behavior:"smooth"});
  }
}
$("commitmentsBody").addEventListener("click",e=>{const pay=e.target.closest("[data-pay-c]");if(pay)return addLinkedEntry("emi",pay.dataset.payC);const edit=e.target.closest("[data-edit-c]"),del=e.target.closest("[data-delete-c]");if(del)return removeRecord("commitments",del.dataset.deleteC,"commitment");if(edit){const c=commitments.find(x=>x.id===edit.dataset.editC);if(!c)return;$("commitmentId").value=c.id;for(const [k,v] of Object.entries({cName:c.name,cLender:c.lender,cTotalAmount:c.totalAmount,cMonthly:c.monthly,cOutstanding:c.outstanding,cStart:c.start,cMaturity:c.maturity,cDue:c.due,cStatus:c.status,cNotes:c.notes}))$(k).value=v??"";$("cancelCommitmentBtn").classList.remove("hidden");}});
$("savingsBody").addEventListener("click",e=>{const pay=e.target.closest("[data-pay-s]");if(pay)return addLinkedEntry("saving",pay.dataset.payS);const edit=e.target.closest("[data-edit-s]"),del=e.target.closest("[data-delete-s]");if(del)return removeRecord("savings",del.dataset.deleteS,"savings scheme");if(edit){const s=savings.find(x=>x.id===edit.dataset.editS);if(!s)return;$("savingId").value=s.id;for(const [k,v] of Object.entries({sName:s.name,sProvider:s.provider,sFrequency:s.frequency,sContribution:s.contribution,sCurrent:s.current,sTarget:s.target,sStart:s.start,sMaturity:s.maturity}))$(k).value=v??"";$("cancelSavingBtn").classList.remove("hidden");}});
$("insuranceBody").addEventListener("click",e=>{const pay=e.target.closest("[data-pay-i]");if(pay)return addLinkedEntry("insurance",pay.dataset.payI);const edit=e.target.closest("[data-edit-i]"),del=e.target.closest("[data-delete-i]");if(del)return removeRecord("insurances",del.dataset.deleteI,"insurance policy");if(edit){const i=insurances.find(x=>x.id===edit.dataset.editI);if(!i)return;$("insuranceId").value=i.id;for(const [k,v] of Object.entries({iName:i.name,iType:i.type,iCompany:i.company,iPolicy:i.policy,iPremium:i.premium,iFrequency:i.frequency,iCoverage:i.coverage,iStart:i.start,iMaturity:i.maturity,iRenewal:i.renewal,iStatus:i.status,iNotes:i.notes}))$(k).value=v??"";$("cancelInsuranceBtn").classList.remove("hidden");}});
$("exportBtn").addEventListener("click",()=>{
 const rows=[["Record type","Date","Name / category","Type","Amount / premium","Details"]];
 transactions.forEach(t=>rows.push(["Transaction",t.date,t.category,t.type,t.amount,[t.method,t.account,t.notes].filter(Boolean).join(" | ")]));
 commitments.forEach(c=>rows.push(["EMI / Loan",c.due,c.name,c.status,c.outstanding,`Lender: ${c.lender||""}; monthly EMI: ${c.monthly}`]));
 savings.forEach(s=>rows.push(["Savings",s.maturity,s.name,s.frequency,s.current,`Provider: ${s.provider||""}; contribution: ${s.contribution}; target: ${s.target}`]));
 insurances.forEach(i=>rows.push(["Insurance",i.renewal,i.name,i.status,i.premium,`Type: ${i.type}; insurer: ${i.company}; coverage: ${i.coverage}; frequency: ${i.frequency}`]));
 const csv=rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");
 const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8;"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`sathish-family-finance-${today()}.csv`;a.click();URL.revokeObjectURL(url);
});
$("txType")?.addEventListener(
    "change",
    toggleCreditCardFields
);

$("txMethod")?.addEventListener(
    "change",
    toggleCreditCardFields
);
monthOptions();$("monthFilter").value=today().slice(0,7);$("txDate").value=today();
if($("cStart"))$("cStart").value=today();
if($("iStart"))$("iStart").value=today();
if($("sStart"))$("sStart").value=today();
if($("reportMonth")){$("reportMonth").value=today().slice(0,7);$("reportMonth").addEventListener("change",()=>{openReportMonth=$("reportMonth").value;renderMonthlyReport();});}
if($("monthlyReportList"))$("monthlyReportList").addEventListener("click",e=>{const card=e.target.closest("[data-month-card]");if(!card)return;const m=card.dataset.monthCard;openReportMonth=openReportMonth===m?null:m;openReportDate=null;if(openReportMonth){$("reportMonth").value=m;}renderMonthlyReport();});
if($("monthlyReportDetails"))$("monthlyReportDetails").addEventListener("click",e=>{const dateButton=e.target.closest("[data-date-card]");if(!dateButton)return;const key=`${$("reportMonth").value}|${dateButton.dataset.dateCard}`;openReportDate=openReportDate===key?null:key;renderMonthlyReport();});
async function transferClosingBalance(){
  const btn=$("transferClosingBalance");
  if(!currentUser || !db){message("appMessage","Please sign in again before transferring the balance.",true);return;}
  const month=$("reportMonth")?.value||"";
  if(!/^\d{4}-\d{2}$/.test(month)){message("appMessage","Please select a valid report month.",true);return;}
  const nextMonth=shiftMonth(month,1);
  const ledger=getMonthLedger(month);
  const nextLabel=new Date(nextMonth+"-01T00:00:00").toLocaleDateString("en-IN",{month:"long",year:"numeric"});
  if(!window.confirm(`Transfer closing balance ${currency(ledger.closing)} from ${new Date(month+"-01T00:00:00").toLocaleDateString("en-IN",{month:"long",year:"numeric"})} to ${nextLabel} as opening balance?\n\nThis will replace the saved opening balance for ${nextLabel}.`)) return;
  try{
    setBusy(btn,true);
    const source=monthlyBalances.find(b=>b.month===month);
    const sourcePayload={month,transferredToMonth:nextMonth,transferredClosing:ledger.closing,transferConfirmedAt:serverTimestamp(),updatedAt:serverTimestamp()};
    if(source?.id) await updateDoc(doc(db,"users",currentUser.uid,"monthlyBalances",source.id),sourcePayload);
    else {sourcePayload.openingBalance=ledger.opening;sourcePayload.createdAt=serverTimestamp();await addDoc(path("monthlyBalances"),sourcePayload);}
    const target=monthlyBalances.find(b=>b.month===nextMonth);
    const targetPayload={month:nextMonth,openingBalance:ledger.closing,openingSourceMonth:month,updatedAt:serverTimestamp()};
    if(target?.id) await updateDoc(doc(db,"users",currentUser.uid,"monthlyBalances",target.id),targetPayload);
    else {targetPayload.createdAt=serverTimestamp();await addDoc(path("monthlyBalances"),targetPayload);}
    monthlyBalances=(await getDocs(path("monthlyBalances"))).docs.map(d=>({id:d.id,...d.data()}));
    fillReportMonths();$("reportMonth").value=month;renderMonthlyReport();renderDashboard();
    message("appMessage",`${currency(ledger.closing)} transferred to ${nextLabel} opening balance. Previous month history is preserved.`);
  }catch(err){console.error("Closing balance transfer failed:",err);message("appMessage","Could not transfer balance: "+(err?.code?err.code+" — ":"")+(err?.message||String(err)),true);}
  finally{setBusy(btn,false,"Transfer Closing to Next Month");}
}

async function saveOpeningBalance(){
  const btn=$("saveOpeningBalance");
  if(!btn) return;
  if(!currentUser || !db){
    message("appMessage","Please sign in again before saving the opening balance.",true);
    return;
  }
  const month=$("reportMonth")?.value || "";
  const input=$("manualOpeningBalance");
  const raw=input ? input.value.trim() : "";
  const opening=Number(raw);
  if(!/^\d{4}-\d{2}$/.test(month)){
    message("appMessage","Please select a valid report month.",true);
    return;
  }
  if(raw==="" || !Number.isFinite(opening) || opening<0){
    message("appMessage","Enter a valid opening balance (zero or greater).",true);
    input?.focus();
    return;
  }
  try{
    setBusy(btn,true);
    const existing=monthlyBalances.find(b=>b.month===month);
    const payload={month,openingBalance:opening,updatedAt:serverTimestamp()};
    if(existing?.id){
      await updateDoc(doc(db,"users",currentUser.uid,"monthlyBalances",existing.id),payload);
    }else{
      payload.createdAt=serverTimestamp();
      await addDoc(path("monthlyBalances"),payload);
    }
    // Reload the saved balance records from Firestore and retain the selected month.
    monthlyBalances=(await getDocs(path("monthlyBalances"))).docs.map(d=>({id:d.id,...d.data()}));
    fillReportMonths();
    $("reportMonth").value=month;
    renderMonthlyReport();
    renderDashboard();
    message("appMessage",`Opening balance ${currency(opening)} saved for ${new Date(month+"-01T00:00:00").toLocaleDateString("en-IN",{month:"long",year:"numeric"})}.`);
  }catch(err){
    console.error("Opening balance save failed:",err);
    message("appMessage","Could not save opening balance: "+(err?.code ? err.code+" — " : "")+(err?.message||String(err)),true);
  }finally{
    setBusy(btn,false,"Save Balance");
  }
}
$("saveOpeningBalance")?.addEventListener("click",e=>{
  e.preventDefault();
  saveOpeningBalance();
});
$("transferClosingBalance")?.addEventListener("click",e=>{e.preventDefault();transferClosingBalance();});
$("manualOpeningBalance")?.addEventListener("keydown",e=>{
  if(e.key==="Enter"){
    e.preventDefault();
    saveOpeningBalance();
  }
});

if(!configReady){message("authMessage","Setup needed: paste the Firebase config for a NEW project into app.js.",true);}
