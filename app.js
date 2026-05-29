
// ─── STATE ───
const K = 'chips_pro';
const SB_URL = 'https://nsbkjtosovogetwwrnji.supabase.co';
const SB_KEY = 'sb_publishable_LpIvf0N_7rj75hgJrlGJnQ_dIeCGKlm';
let SB = null;
try { SB = supabase.createClient(SB_URL, SB_KEY); } catch(e) {}
let D = { _schemaVer:8, clients:[], commandes:[], productions:[], montants:[], depenses:[], stockE:[], stockS:[], stockInit:[], employes:[], retraits:[], trash:[] };
let nextId = 1;
let currentPage = 'dash';
let filterRange = { start: '', end: '' };
let theme = localStorage.getItem('chips_theme')||'light';
let userName = localStorage.getItem('chips_user')||'';
let syncStatus = 'ok';
let _prodFilter = 'today';

const PAIE_FEMMES = { jour: { taux: 1800, quotas: { 1: 400, 2: 600, 3: 800, 4: 1000, 5: 1200, 6: 1400 } }, nuit: { taux: 2000 } };
const PAIE_HOMMES = { jour: { tauxParBalle: 389, quotaParJour: 6, quotaSemaine: 36, salaireSemaineObjectif: 14000 }, nuit: { tauxParBalle: 417, quotaParJour: 6, quotaSemaine: 36, salaireSemaineObjectif: 15000 } };

function me() { return userName; }

// ─── SCHÉMA & MIGRATION ───
function migrateSchema() {
  const cur=D._schemaVer||1;
  if(cur<2){
    const now=new Date().toISOString();
    D.clients=D.clients||[]; D.commandes=D.commandes||[]; D.productions=D.productions||[]; D.montants=D.montants||[]; D.depenses=D.depenses||[]; D.stockE=D.stockE||[]; D.stockS=D.stockS||[]; D.employes=D.employes||[]; D.retraits=D.retraits||[]; D.trash=D.trash||[];
    for(const c of D.clients){c.name=c.name||'';c.phone=c.phone||'';c.addr=c.addr||'';c.detteInit=c.detteInit||0;c.detteCur=c.detteCur||0;}
    for(const c of D.commandes){c.client=c.client||'';c.date=c.date||now.slice(0,10);c.produit=c.produit||'Chips';c.qte=c.qte||0;c.prixTotal=c.prixTotal||0;c.paye=c.paye||0;c.reste=c.reste||0;c.statut=c.statut||'En attente';}
    for(const p of D.productions){p.date=p.date||now.slice(0,10);p.shift=p.shift||'Jour';p.type=p.type||'Femme';p.employes=p.employes||(p.employe?[p.employe]:[]);p.reel=p.reel||0;p.quota=p.quota||0;p.paie=p.paie||0;p.notes=p.notes||'';}
    for(const m of D.montants){m.date=m.date||now.slice(0,10);m.desc=m.desc||'';m.type=m.type||'Vente';m.client=m.client||'';m.montant=m.montant||0;}
    for(const d of D.depenses){d.date=d.date||now.slice(0,10);d.categorie=d.categorie||'Autre';d.montant=d.montant||0;d.detail=d.detail||'';d.employe=d.employe||'';}
    for(const s of D.stockE){s.date=s.date||now.slice(0,10);s.categorie=s.categorie||'';s.qte=s.qte||0;s.unite=s.unite||'pièce';s.cout=s.cout||0;s.desc=s.desc||'';}
    for(const s of D.stockS){s.date=s.date||now.slice(0,10);s.categorie=s.categorie||'';s.qte=s.qte||0;s.unite=s.unite||'pièce';s.desc=s.desc||'';}
    for(const e of D.employes){e.name=e.name||'';e.type=e.type||'Autre';e.phone=e.phone||'';e.dateEmbauche=e.dateEmbauche||now.slice(0,10);e.notes=e.notes||'';}
    for(const r of D.retraits){r.date=r.date||now.slice(0,10);r.employe=r.employe||'';r.montant=r.montant||0;r.notes=r.notes||'';}
    D._schemaVer=2;
  }
  if(cur<3){
    D.stockInit=D.stockInit||[];
    for(const s of D.stockInit){s.date=s.date||new Date().toISOString().slice(0,10);s.farine=s.farine||0;s.sachetsR=s.sachetsR||0;s.sachetsG=s.sachetsG||0;s.sachetsP=s.sachetsP||0;s.balles=s.balles||0;}
    D._schemaVer=3;
  }
  if(cur<4){
    for(const c of D.commandes){if(c.unite===undefined)c.unite='Balle';}
    D._schemaVer=4;
  }
  if(cur<5){
    // Fusionner les anciennes entrées multi (N entrées individuelles → 1 session)
    const groups = {};
    const toRemove = [];
    for (const p of D.productions) {
      if (p.type==='Femme' && p.employes && p.employes.length===1 && p.notes && p.notes.startsWith('Équipe:')) {
        const key = p.date + '|' + p.shift + '|' + p.notes;
        if (!groups[key]) groups[key] = [];
        groups[key].push(p);
      }
    }
    for (const entries of Object.values(groups)) {
      if (entries.length < 2) continue;
      const [first] = entries;
      const allNames = entries.map(e => e.employes[0]);
      const totalSachets = first.reel;
      const totalPaie = entries.reduce((s, e) => s + e.paie, 0);
      D.productions.push({id:nextId++, date:first.date, shift:first.shift, employes:allNames, type:'Femme', reel:totalSachets, quota:first.quota, paie:totalPaie, notes:first.notes, createdBy:first.createdBy});
      entries.forEach(e => toRemove.push(e.id));
    }
    D.productions = D.productions.filter(p => !toRemove.includes(p.id));
    D._schemaVer = 5;
  }
  if(cur<6){
    // Bug #3: Normaliser les noms clients dans montants/commandes (case-insensitive)
    const canon = {};
    D.clients.forEach(c => { canon[c.name.toLowerCase().trim()] = c.name; });
    D.montants.forEach(m => {
      if (m.client) {
        const k = m.client.toLowerCase().trim();
        if (canon[k] && canon[k] !== m.client) m.client = canon[k];
      }
    });
    D.commandes.forEach(cmd => {
      if (cmd.client) {
        const k = cmd.client.toLowerCase().trim();
        if (canon[k] && canon[k] !== cmd.client) cmd.client = canon[k];
      }
    });
    // Bug #4: Dédupliquer les stockE balles production (garder 1 par jour)
    const prodBallesParJour = {};
    D.productions.forEach(p => {
      if (p.type === 'Femme') {
        prodBallesParJour[p.date] = (prodBallesParJour[p.date] || 0) + Math.floor(p.reel / 50);
      }
    });
    const gardeBallProd = new Set();
    D.stockE = D.stockE.filter(e => {
      if (e.categorie === 'Balles 🏀' && e.desc && e.desc.includes('Production')) {
        const bon = prodBallesParJour[e.date];
        if (bon && e.qte !== bon) return false;
        if (gardeBallProd.has(e.date)) return false;
        gardeBallProd.add(e.date);
        if (e.qte !== bon) e.qte = bon;
        return true;
      }
      return true;
    });
    // Bug #5: Supprimer les annulations abusives dans stockS
    D.stockS = D.stockS.filter(s => {
      if (s.desc && s.desc.toLowerCase().includes('annulation')) return false;
      return true;
    });
    D._schemaVer = 6;
  }
  if(cur<7){
    // Créer stockS pour chaque commande existante (balles déduites)
    const stockSDesc = new Set(D.stockS.filter(s=>s.categorie==='Balles 🏀').map(s=>(s.desc||'').toLowerCase()));
    for(const cmd of D.commandes){
      const b=cmdStockBalles(cmd);
      if(b>0 && !stockSDesc.has(('Commande '+cmd.client).toLowerCase())){
        D.stockS.push({id:nextId++,date:cmd.date,categorie:'Balles 🏀',qte:b,unite:'pièce',desc:'Commande #'+cmd.id+' — '+cmd.client+' — '+cmd.qte+' '+(cmd.unite||'Balle'),createdBy:cmd.createdBy||'admin'});
        stockSDesc.add(('Commande '+cmd.client).toLowerCase());
      }
    }
    D._schemaVer = 7;
  }
  if(cur<8){
    // Nettoyer les stockS v7 buggés (1 par client au lieu de 1 par commande) et les recréer
    D.stockS = D.stockS.filter(s => !(s.categorie==='Balles 🏀' && (s.desc||'').startsWith('Commande ')));
    for(const cmd of D.commandes){
      const b=cmdStockBalles(cmd);
      if(b>0) D.stockS.push({id:nextId++,date:cmd.date,categorie:'Balles 🏀',qte:b,unite:'pièce',desc:'Commande #'+cmd.id+' — '+cmd.client+' — '+cmd.qte+' '+(cmd.unite||'Balle'),createdBy:cmd.createdBy||'admin'});
    }
    D._schemaVer = 8;
  }
}

function findClient(name) {
  if (!name) return null;
  const n = name.toLowerCase().trim();
  return D.clients.find(c => c.name.toLowerCase().trim() === n) || null;
}

function cmdStockBalles(c) {
  return c.unite==='Sachet' ? Math.floor(c.qte/50) : c.qte;
}

function calcBallesCommandes(cmds) {
  const ballesDirectes = cmds.filter(c => c.unite!=='Sachet').reduce((s,c) => s+c.qte, 0);
  const sachets = cmds.filter(c => c.unite==='Sachet').sort((a,b) => a.date.localeCompare(b.date) || a.id-b.id);
  let cumul = 0, ballesSachets = 0;
  for (const c of sachets) {
    cumul += c.qte;
    const d = Math.floor(cumul / 50);
    ballesSachets += d;
    cumul = cumul % 50;
  }
  return ballesDirectes + ballesSachets;
}

function calcSachetsRestants() {
  const sachets = D.commandes.filter(c => c.unite==='Sachet').sort((a,b) => a.date.localeCompare(b.date) || a.id-b.id);
  let cumul = 0;
  for (const c of sachets) {
    cumul += c.qte;
    cumul = cumul % 50;
  }
  return cumul;
}

function calcSachetsEnStock() {
  const total = D.productions.filter(p => p.type==='Femme').reduce((s, p) => s + p.reel, 0);
  return total % 50;
}

// ─── SYNC STATUS ───
function updateSyncUI() {
  const el=document.getElementById('syncStatus');
  if(!el)return;
  if(syncStatus==='saving'){el.innerHTML='<span style="color:var(--amber)">⟳ Sauvegarde...</span>';return;}
  if(syncStatus==='error'){el.innerHTML='<span style="color:var(--red)">⚠ Échec synchro</span>';return;}
  el.innerHTML='<span style="color:var(--green)">✓ Synchronisé</span>';
}
function saveSB() {
  syncStatus='saving';updateSyncUI();
  if(!SB){syncStatus='error';updateSyncUI();return Promise.resolve();}
  return SB.from('app_state').upsert({id:1,data:D,updated_at:new Date().toISOString()},{onConflict:'id'}).then(()=>{syncStatus='ok';updateSyncUI();}).catch(()=>{
    // Retry once
    return SB.from('app_state').upsert({id:1,data:D,updated_at:new Date().toISOString()},{onConflict:'id'}).then(()=>{syncStatus='ok';updateSyncUI();}).catch(()=>{syncStatus='error';updateSyncUI();});
  });
}

// ─── ERROR HANDLER ───
window.onerror=function(msg,url,line){
  const el=document.createElement('div');
  el.style.cssText='position:fixed;bottom:10px;left:10px;right:10px;background:var(--surface);border:2px solid var(--red);border-radius:8px;padding:10px;font-size:12px;z-index:999;box-shadow:0 4px 12px rgba(0,0,0,.2);max-width:400px';
  el.innerHTML=`<strong>⚠ Erreur</strong><br>${msg.toString().slice(0,200)}<br><button onclick="this.parentElement.remove()" style="margin-top:6px;padding:2px 8px;border:1px solid var(--border);border-radius:4px;background:var(--surface);cursor:pointer">Fermer</button>`;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),8000);
};
window.addEventListener('unhandledrejection',function(e){console.error('Promise error',e.reason);});

// ─── LOCALSTORAGE SIZE CHECK ───
function checkStorageSize() {
  try{
    const sz=new Blob([localStorage.getItem(K)||'']).size;
    const limit=5*1024*1024; // ~5MB
    if(sz>limit*0.8) console.warn('Stockage local presque plein ('+Math.round(sz/1024)+' Ko / '+Math.round(limit/1024)+' Ko)');
  }catch(e){}
}

function updateUserUI() {
  const el=document.getElementById('userInfo'); if(!el)return;
  if(userName){
    el.innerHTML=`<span class="uav uav-n">${esc(userName).charAt(0).toUpperCase()}</span><span onclick="setUserName()">${esc(userName)}</span>`;
    el.className='user-info logged';
  } else {
    el.innerHTML='<button class="btn btn-sm btn-p" onclick="setUserName()">👤 Connexion</button>';
  }
}
function setUserName() {
  const n=prompt(userName?'Changer de nom / Se deconnecter (laisser vide) :':'Entrez votre nom :',userName);
  if(n===null)return;
  userName=n.trim()||'';localStorage.setItem('chips_user',userName);
  updateUserUI();render();
}

function toggleTheme() {
  theme = theme==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',theme);
  localStorage.setItem('chips_theme',theme);
  document.getElementById('themeBtn').innerHTML = theme==='dark'?'☀️ Clair':'🌙 Sombre';
}

function setFilter(preset) {
  const now = new Date(), t = today();
  switch(preset) {
    case 'today': filterRange = { start: t, end: t }; break;
    case 'week': {
      const ws = new Date(now);
      ws.setDate(now.getDate() - (now.getDay()||7));
      filterRange = { start: ws.toISOString().slice(0,10), end: t };
      break;
    }
    case 'month': filterRange = { start: t.slice(0,7)+'-01', end: t }; break;
    case 'year': filterRange = { start: t.slice(0,4)+'-01-01', end: t }; break;
    case 'all': filterRange = { start: '', end: '' }; break;
    case 'custom':
      filterRange = { start: document.getElementById('fStart')?.value||'', end: document.getElementById('fEnd')?.value||'' };
      break;
  }
  document.getElementById('fPreset').value = preset;
  const info = document.getElementById('filterInfo');
  if(info){
    if(!filterRange.start&&!filterRange.end) info.textContent = 'Toute période';
    else if(filterRange.start===filterRange.end) info.textContent = filterRange.start;
    else info.textContent = filterRange.start+' → '+filterRange.end;
  }
  render();
}
function inRange(dateStr) {
  if(!filterRange.start&&!filterRange.end) return true;
  return (!filterRange.start||dateStr>=filterRange.start)&&(!filterRange.end||dateStr<=filterRange.end);
}

function load() {
  try {
    const r = localStorage.getItem(K);
    if (r) { const p = JSON.parse(r); D = p; 
      migrateSchema();
      const all = [...p.clients,...p.commandes,...p.productions,...p.montants,...p.depenses,...p.stockE,...p.stockS,...p.employes,...p.retraits,...p.trash];
      nextId = all.reduce((m,x)=>Math.max(m,x.id||0),0)+1;
    }
  } catch(_) {}
}
async function loadSB() {
  if(!SB)return load();
  try {
    const {data,error} = await SB.from('app_state').select('data').eq('id',1).single();
    if(error||!data||!data.data||!Object.keys(data.data).length){load();return;}
    D = data.data;
    migrateSchema();
    if(!D.clients) Object.assign(D,{clients:[],commandes:[],productions:[],montants:[],depenses:[],stockE:[],stockS:[],employes:[],retraits:[],trash:[]});
    const all = [].concat(...['clients','commandes','productions','montants','depenses','stockE','stockS','employes','retraits','trash'].map(k=>D[k]||[]));
    nextId = all.reduce((m,x)=>Math.max(m,x.id||0),0)+1;
  } catch(_){load()}
}
function save() {
  recalcDebts();
  localStorage.setItem(K,JSON.stringify(D));
  saveSB();
  checkStorageSize();
}
function today() { return new Date().toISOString().slice(0,10); }
function fmt(n) { return (n||0).toLocaleString('fr-FR')+' FCFA'; }
function fmtN(n) { return Number(n||0).toLocaleString('fr-FR'); }
function esc(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
function prodEmps(p){return p.employes||(p.employe?[p.employe]:['Employé']);}

// ─── NAV ───
function nav(p) {
  currentPage = p;
  document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('active',a.dataset.p===p));
  document.querySelectorAll('.page').forEach(el => el.classList.toggle('active',el.id==='p-'+p));
  document.querySelectorAll('.mobile-nav a').forEach(a => a.classList.toggle('active',a.dataset.p===p));
  const labels={'dash':'📊 Tableau de Bord','clients':'👥 Clients','commandes':'🛒 Commandes','prod':'🏭 Production','montants':'💰 Montants','depenses':'💸 Dépenses','stock':'📦 Stock','finances':'📈 Finances','analyses':'🧠 Analyses','employes':'👷 Employés','exporter':'📥 Exporter','corbeille':'🗑️ Corbeille'};
  const pt=document.getElementById('pageTitleMob');
  if(pt)pt.textContent=labels[p]||p;
  closeNav();
  if(document.getElementById('mobileNav')?.classList.contains('o')) {
    document.getElementById('mobileNav').classList.remove('o');
  }
}
function toggleNav() { const mn=document.getElementById('mobileNav'); mn.classList.toggle('o'); }
function closeNav() { document.getElementById('mobileNav').classList.remove('o'); }
document.addEventListener('click',function(e){const mn=document.getElementById('mobileNav');if(mn.classList.contains('o')&&!e.target.closest('#hamburger')&&!e.target.closest('#mobileNav'))closeNav();});

function renderTabs() {
  const items = [
    ['dash','📊','Tableau de Bord'],['clients','👥','Clients'],['commandes','🛒','Commandes'],
    ['prod','🏭','Production'],['montants','💰','Montants'],['depenses','💸','Dépenses'],
    ['stock','📦','Stock'],['finances','📈','Finances'],['analyses','🧠','Analyses'],
    ['employes','👷','Employés'],['exporter','📥','Exporter'],['corbeille','🗑️','Corbeille']
  ];
  document.getElementById('tabs').innerHTML = items.map(([id,ico,label]) =>
    `<a data-p="${id}" class="${id===currentPage?'active':''}" onclick="nav('${id}');render()">${ico} ${label}</a>`
  ).join('');
  document.getElementById('mobileNav').innerHTML = items.map(([id,ico,label]) =>
    `<a data-p="${id}" class="${id===currentPage?'active':''}" onclick="nav('${id}');render()">${ico} ${label}</a>`
  ).join('');
}

// ─── MODAL ───
let modalCtx = null;
function openM(html,cb) { document.getElementById('modalBody').innerHTML=html; document.getElementById('modal').classList.add('o'); modalCtx=cb||null; }
function closeM() { document.getElementById('modal').classList.remove('o'); modalCtx=null; }
document.getElementById('modal').addEventListener('click',function(e){if(e.target===this)closeM()});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeM()});
function val(id) { return document.getElementById(id)?.value||''; }
function num(id) { return +document.getElementById(id)?.value||0; }

// ─── TRASH ───
function trashIt(type,item,motif) { D.trash.push({id:nextId++,type,content:item,deletedAt:Date.now(),motif:motif||'',createdBy:me()}); }
function cleanTrash() { const S=7*86400000; const b=D.trash.length; D.trash=D.trash.filter(t=>Date.now()-t.deletedAt<S); if(D.trash.length!==b)save(); }
function restoreT(id) { const t=D.trash.find(x=>x.id===id); if(!t)return; D[t.type].push(t.content); D.trash=D.trash.filter(x=>x.id!==id); save(); render(); }

// ─── CLIENT ───
function clientForm(c) {
  const edit=!!c;
  openM(`
    <h3>${edit?'✏️ Modifier':'👥 Nouveau'} client</h3>
    <label>Nom</label><input id="cName" value="${edit?esc(c.name):''}" />
    <label>Téléphone</label><input id="cPhone" value="${edit?esc(c.phone||''):''}" />
    <label>Adresse</label><input id="cAddr" value="${edit?esc(c.addr||''):''}" />
    <div class="m-row"><div><label>Dette initiale</label><input type="number" id="cDi" value="${edit?c.detteInit:0}" /></div>
    <div>${edit?`<label>Dette actuelle</label><input type="number" id="cDc" value="${c.detteCur}" />`:'<label></label><div></div>'}</div></div>
    <div class="m-actions"><button class="btn btn-o" onclick="closeM()">Annuler</button>
    <button class="btn btn-p" onclick="saveClient(${edit?c.id:'null'})">${edit?'Modifier':'Enregistrer'}</button></div>
  `);
}

function saveClient(id) {
  const n=val('cName').trim(); if(!n)return alert('Nom requis');
  if(!id&&D.clients.find(c=>c.name===n))return alert('Ce nom existe deja');
  const di=num('cDi');
  if(id) { const c=D.clients.find(x=>x.id===id); if(c){c.name=n;c.phone=val('cPhone');c.addr=val('cAddr');c.detteInit=di;c.detteCur=num('cDc');} }
  else D.clients.push({id:nextId++,name:n,phone:val('cPhone'),addr:val('cAddr'),detteInit:di,detteCur:di,createdBy:me()});
  closeM();save();render();
}

function payerDette(id) {
  const c=D.clients.find(x=>x.id===id); if(!c)return;
  const mt=prompt('Montant recu (FCFA) :',(c.detteCur||0).toString()); if(!mt||+mt<=0)return;
  const reste=+mt; c.detteCur=Math.max(0,(c.detteCur||0)-reste);
  D.montants.push({id:nextId++,date:today(),desc:'Paiement dette - '+c.name,type:'Dette reçue',client:c.name,montant:reste,createdBy:me()});
  // Reduce commande restes proportionally (oldest first)
  const cmds=D.commandes.filter(x=>x.client===c.name&&x.reste>0).sort((a,b)=>a.date.localeCompare(b.date));
  let left=reste;
  for(const cmd of cmds){
    if(left<=0)break;
    const pay=Math.min(left,cmd.reste);
    cmd.paye+=pay; cmd.reste=cmd.prixTotal-cmd.paye; left-=pay;
    if(cmd.reste<=0)cmd.statut='Livrée';
  }
  save();render();
}

function confirmDel(msg,type,item) {
  const n=item.name||item.client||item.desc||item.detail||item.produit||'(?)';
  openM(`
    <h3>🗑️ Supprimer</h3>
    <p>${msg}</p>
    <p class="fs"><strong>${esc(n)}</strong></p>
    <label>Motif de suppression</label>
    <textarea id="delMotif" rows="3" placeholder="Raison..." style="width:100%"></textarea>
    <div class="m-actions"><button class="btn btn-o" onclick="closeM()">Annuler</button>
    <button class="btn btn-r" onclick="execDel('${type}',${item.id})">Supprimer</button></div>
  `);
}
function execDel(type,id) {
  const item=D[type].find(x=>x.id===id); if(!item)return;
  const motif=val('delMotif').trim();
  if(type==='commandes'){
    const cl=D.clients.find(x=>x.name===item.client);
    if(cl)cl.detteCur=Math.max(0,(cl.detteCur||0)-item.reste);
    const b=cmdStockBalles(item);
    if(b>0)D.stockE.push({id:nextId++,date:today(),categorie:'Balles 🏀',qte:b,unite:'pièce',cout:0,desc:'Annulation suppression commande '+item.client,createdBy:me()});
  }
  if(type==='productions'&&item.type==='Femme'){
    // Production annulée: on ne rend pas les balles au stock car le calcul stockBalles
    // se base sur la somme des productions actuelles. En supprimant la production,
    // le stock remonte naturellement.
  }
  trashIt(type,item,motif);
  D[type]=D[type].filter(x=>x.id!==id);
  closeM();save();render();
}

// ─── COMMANDE ───
function commandeForm(cmd) {
  const e=!!cmd; const clOpts=D.clients.map(c=>`<option value="${esc(c.name)}"${e&&cmd.client===c.name?' selected':''}>${esc(c.name)}</option>`).join('');
  const uniteVal=e?cmd.unite||'Balle':'Balle';
  const puDef=e?Math.round(cmd.prixTotal/(cmd.qte||1)):(uniteVal==='Sachet'?500:25000);
  openM(`
    <h3>${e?'✏️ Modifier':'🛒 Nouvelle'} commande</h3>
    <label>Client</label><select id="coCli">${clOpts}<option value="">— Nouveau —</option></select>
    <label>Nouveau client</label><input id="coNew" placeholder="Nom" />
    <div class="m-row"><div><label>Date</label><input type="date" id="coDate" value="${e?cmd.date:today()}" /></div>
    <div><label>Produit</label><input id="coProd" value="${e?esc(cmd.produit):'Chips'}" /></div></div>
    <div class="m-row"><div><label>Quantité</label><input type="number" id="coQte" value="${e?cmd.qte:1}" oninput="onCoQteChange()" /></div>
    <div><label>Unité</label><select id="coUnite" onchange="onCoUniteChange()">
      <option value="Balle"${uniteVal==='Balle'?' selected':''}>Balle (50 sachets)</option>
      <option value="Sachet"${uniteVal==='Sachet'?' selected':''}>Sachet</option>
    </select></div></div>
    <div class="m-row"><div><label>Prix unitaire</label><input type="number" id="coPu" value="${puDef}" /></div>
    <div><label>Acompte</label><input type="number" id="coPaye" value="${e?cmd.paye:0}" /></div></div>
    <div id="coBallesInfo" style="font-size:.75rem;color:var(--muted);margin-bottom:.5rem"></div>
    <div class="m-row"><div><label>Statut</label><select id="coStat"><option value="En attente"${e&&cmd.statut==='En attente'?' selected':''}>⏳ En attente</option>
    <option value="Livrée"${e&&cmd.statut==='Livrée'?' selected':''}>✅ Livrée</option>
    <option value="Annulée"${e&&cmd.statut==='Annulée'?' selected':''}>❌ Annulée</option></select></div></div>
    <div class="m-actions"><button class="btn btn-o" onclick="closeM()">Annuler</button>
    <button class="btn btn-p" onclick="saveCommande(${e?cmd.id:'null'})">${e?'Modifier':'Enregistrer'}</button></div>
  `);
  document.getElementById('coCli').addEventListener('change',function(){document.getElementById('coNew').disabled=!!this.value});
  onCoQteChange();
}
function onCoUniteChange() {
  const u=document.getElementById('coUnite').value;
  document.getElementById('coPu').value=u==='Sachet'?500:25000;
  onCoQteChange();
}
function onCoQteChange() {
  const qte=parseFloat(document.getElementById('coQte').value)||0;
  const u=document.getElementById('coUnite').value;
  const el=document.getElementById('coBallesInfo');
  if(u==='Sachet'){
    const balles=Math.floor(qte/50);
    el.innerHTML=balles>0?`📦 <strong>${balles}</strong> balle(s) déduite(s) du stock<br>🔄 ${qte-balles*50} sachet(s) restant(s) non comptés`:'📦 < 50 sachets, aucune balle déduite du stock';
  } else {
    el.innerHTML=`📦 <strong>${qte}</strong> balle(s) = <strong>${qte*50}</strong> sachets`;
  }
}

function saveCommande(id) {
  const sel=val('coCli'), nc=val('coNew').trim(), rawClient=sel||nc||'Client';
  const cl=rawClient && !nc ? findClient(rawClient) : null;
  const client = cl ? cl.name : rawClient;
  const date=val('coDate'), prod=val('coProd').trim()||'Chips', qte=num('coQte')||1, unite=val('coUnite')||'Balle', pu=num('coPu')||(unite==='Sachet'?500:25000);
  const pt=qte*pu, paye=num('coPaye'), stat=val('coStat');
  const ballesEq=unite==='Sachet'?Math.floor(qte/50):qte;
  if(rawClient && !cl && !nc && !confirm('⚠️ "'+rawClient+'" ne correspond à aucun client. Continuer ?')) return;
  if(id) {
    const c=D.commandes.find(x=>x.id===id); if(!c)return;
    const oldReste=c.reste, oldClient=c.client, oldBalles=cmdStockBalles(c);
    const diff=paye-c.paye; c.client=client;c.date=date;c.produit=prod;c.qte=qte;c.unite=unite;c.prixTotal=pt;c.paye=paye;c.reste=pt-paye;c.statut=stat;
    const oldCl=findClient(oldClient);
    if(oldCl)oldCl.detteCur=Math.max(0,(oldCl.detteCur||0)-oldReste);
    let curCl=findClient(client);
    if(!curCl&&nc&&!sel){D.clients.push({id:nextId++,name:nc,phone:'',addr:'',detteInit:0,detteCur:0,createdBy:me()});curCl=D.clients[D.clients.length-1];}
    if(curCl)curCl.detteCur=(curCl.detteCur||0)+(pt-paye);
    if(diff!==0) D.montants.push({id:nextId++,date,desc:diff>0?'Acompte commande - '+client:'Correction acompte - '+client,type:'Vente',client,montant:diff,createdBy:me()});
    if(oldBalles>0)D.stockE.push({id:nextId++,date,categorie:'Balles 🏀',qte:oldBalles,unite:'pièce',cout:0,desc:'Annulation modif commande '+oldClient,createdBy:me()});
    if(ballesEq>0)D.stockS.push({id:nextId++,date,categorie:'Balles 🏀',qte:ballesEq,unite:'pièce',desc:'Commande modifiée '+client+' — '+qte+' '+unite,createdBy:me()});
  } else {
    D.commandes.push({id:nextId++,client,date,produit:prod,qte,unite,prixTotal:pt,paye,reste:pt-paye,statut:stat,createdBy:me()});
    if(paye>0) D.montants.push({id:nextId++,date,desc:'Acompte commande - '+client,type:'Vente',client,montant:paye,createdBy:me()});
    let cl=findClient(client);
    if(!cl&&nc&&!sel){D.clients.push({id:nextId++,name:nc,phone:'',addr:'',detteInit:0,detteCur:0,createdBy:me()});cl=D.clients[D.clients.length-1];}
    if(cl)cl.detteCur=(cl.detteCur||0)+(pt-paye);
    if(ballesEq>0)D.stockS.push({id:nextId++,date,categorie:'Balles 🏀',qte:ballesEq,unite:'pièce',desc:'Commande '+client+' — '+qte+' '+unite,createdBy:me()});
  }
  closeM();save();render();
}

function payerCmd(id) {
  const c=D.commandes.find(x=>x.id===id); if(!c)return;
  const r=c.prixTotal-c.paye; if(r<=0)return alert('Déjà payé');
  const mt=prompt('Montant versé (FCFA) :',r.toString()); if(!mt||+mt<=0)return;
  c.paye+=+mt; c.reste=c.prixTotal-c.paye; if(c.reste<=0)c.statut='Livrée';
  D.montants.push({id:nextId++,date:today(),desc:'Paiement commande - '+c.client,type:'Vente',client:c.client,montant:+mt,createdBy:me()});
  const cl=findClient(c.client); if(cl)cl.detteCur=Math.max(0,(cl.detteCur||0)-(+mt));
  save();render();
}

// ─── PRODUCTION ───
function getQuotaAttendu(typeEmp, shift, nb) {
  if(typeEmp==='Femme'){
    if(shift==='Nuit') return null;
    return PAIE_FEMMES.jour.quotas[nb] || null;
  }
  if(typeEmp==='Homme'){
    return 6;
  }
  return null;
}
function calcPaieFromProd(typeEmp, fem, hom, shift, nb) {
  if(typeEmp==='Femme'){
    if(shift==='Nuit') return PAIE_FEMMES.nuit.taux;
    const quota=PAIE_FEMMES.jour.quotas[nb]||400;
    return Math.round((fem/quota)*PAIE_FEMMES.jour.taux);
  }
  if(typeEmp==='Homme'){
    const rule=PAIE_HOMMES[shift==='Nuit'?'nuit':'jour'];
    return hom*rule.tauxParBalle;
  }
  return 0;
}
let _prodMode='solo';
function setProdMode(m) {
  _prodMode=m;
  const soloBtn=document.getElementById('btn-mode-solo'), multiBtn=document.getElementById('btn-mode-multi');
  const soloSec=document.getElementById('p-solo-section'), multiSec=document.getElementById('p-multi-section');
  const active='linear-gradient(135deg,var(--orange),var(--accent))', inactive='background:var(--hover);color:var(--text2);border-color:transparent';
  if(m==='solo'){
    soloBtn.style.cssText='flex:1;padding:.5rem;border-radius:.55rem;font-size:.78rem;font-weight:700;border:2px solid var(--accent);background:'+active+';color:#fff;cursor:pointer';
    multiBtn.style.cssText='flex:1;padding:.5rem;border-radius:.55rem;font-size:.78rem;font-weight:700;border:2px solid var(--border);background:var(--hover);color:var(--text2);cursor:pointer';
    soloSec.style.display='grid'; multiSec.style.display='none';
  } else {
    multiBtn.style.cssText='flex:1;padding:.5rem;border-radius:.55rem;font-size:.78rem;font-weight:700;border:2px solid var(--accent);background:'+active+';color:#fff;cursor:pointer';
    soloBtn.style.cssText='flex:1;padding:.5rem;border-radius:.55rem;font-size:.78rem;font-weight:700;border:2px solid var(--border);background:var(--hover);color:var(--text2);cursor:pointer';
    soloSec.style.display='none'; multiSec.style.display='';
    renderEmpCheckboxes();
  }
}
function renderEmpCheckboxes() {
  const c=document.getElementById('p-employe-checkboxes'); if(!c)return;
  c.innerHTML=D.employes.filter(x=>x.type==='Femme').map(e=>`
    <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;padding:3px 0">
      <input type="checkbox" value="${esc(e.name)}" onchange="onMultiEmpChange()">${esc(e.name)}
    </label>`).join('')||'<div style="color:var(--muted);font-size:12px">Aucune employée femme</div>';
  onMultiEmpChange();
}
function onMultiEmpChange() {
  const checks=document.querySelectorAll('#p-employe-checkboxes input:checked');
  document.getElementById('p-multi-count').textContent=checks.length+' sélectionné(s)';
  const nb=checks.length;
  if(nb>=2){
    document.getElementById('p-multi-sachets-grp').style.display='';
    if(shiftVal()==='Jour'){const q=PAIE_FEMMES.jour.quotas[nb]||(nb*300);document.getElementById('p-quota-attendu').textContent=q+' sach';}
  } else {
    document.getElementById('p-multi-sachets-grp').style.display='none';
    document.getElementById('p-paie-result').style.display='none';
  }
}
function shiftVal(){const el=document.getElementById('p-shift');return el?el.value:'Jour';}
function onProdShiftChange() {
  const shift=shiftVal();
  if(_prodMode==='multi'){
    const nb=document.querySelectorAll('#p-employe-checkboxes input:checked').length;
    if(nb>=2&&shift==='Jour'){const q=PAIE_FEMMES.jour.quotas[nb]||(nb*300);document.getElementById('p-quota-attendu').textContent=q+' sach';}
    calcMultiProdPaie();
  } else {
    onProdEmployeChange();
  }
}
function onProdEmployeChange() {
  const empId=document.getElementById('p-employe').value;
  const emp=empId?D.employes.find(e=>e.id===+empId):null;
  const typeEmp=emp?emp.type:'Femme';
  const shift=shiftVal();
  const qi=document.getElementById('p-quota-info-grp');
  if(typeEmp==='Femme'){
    document.getElementById('p-fem-grp').style.display='';
    document.getElementById('p-hom-grp').style.display='none';
    const q=getQuotaAttendu(typeEmp,shift,1);
    if(q!==null){qi.style.display='';document.getElementById('p-quota-info').textContent=q+' sachets';}
    else qi.style.display='none';
  } else {
    document.getElementById('p-fem-grp').style.display='none';
    document.getElementById('p-hom-grp').style.display='';
    qi.style.display='';document.getElementById('p-quota-info').textContent='6 balles/jour';
  }
  calcProdPaie();
}
function calcProdPaie() {
  const empId=document.getElementById('p-employe').value;
  const emp=empId?D.employes.find(e=>e.id===+empId):null;
  const typeEmp=emp?emp.type:'Femme';
  const shift=shiftVal();
  const fem=parseFloat(document.getElementById('p-fem').value)||0;
  const hom=parseFloat(document.getElementById('p-hom').value)||0;
  const reel=typeEmp==='Femme'?fem:hom;
  if(!reel){document.getElementById('p-paie-result').style.display='none';return;}
  const quota=getQuotaAttendu(typeEmp,shift,1);
  const qb=document.getElementById('p-quota-block');
  const r3=document.getElementById('p-paie-regle3');
  if(quota!==null){
    document.getElementById('p-quota-attendu').textContent=fmtN(quota)+(typeEmp==='Femme'?' sach':' bal');
    document.getElementById('p-quota-reel').textContent=fmtN(reel)+(typeEmp==='Femme'?' sach':' bal');
    const ec=reel-quota;
    const ecEl=document.getElementById('p-quota-ecart');
    if(ec>0){ecEl.textContent='+'+fmtN(ec);ecEl.style.color='var(--green)';}
    else if(ec<0){ecEl.textContent=fmtN(ec);ecEl.style.color='var(--red)';}
    else{ecEl.textContent='Exact ✓';ecEl.style.color='var(--green)';}
    qb.style.display='grid';
  } else qb.style.display='none';
  const paie=calcPaieFromProd(typeEmp,fem,hom,shift,1);
  if(typeEmp==='Femme'&&shift==='Jour'&&quota&&fem>0)
    r3.innerHTML='📐 Règle de 3 : '+fmtN(quota)+' sachets → 1 800 FCFA | '+fmtN(fem)+' sachets → <strong>'+fmt(paie)+'</strong>';
  else if(typeEmp==='Femme'&&shift==='Nuit')
    r3.innerHTML='🌙 Nuit : taux fixe '+fmt(2000)+' / personne';
  else if(typeEmp==='Homme'&&hom>0)
    r3.innerHTML='📐 1 balle → '+(shift==='Nuit'?'417':'389')+' FCFA | '+fmtN(hom)+' balles → <strong>'+fmt(paie)+'</strong>';
  else r3.style.display='none';
  const balles=typeEmp==='Femme'?Math.floor(fem/50):hom;
  const resteSach=typeEmp==='Femme'?fem%50:0;
  const soloLive=document.getElementById('p-solo-balles-live');
  if(soloLive){
    soloLive.style.display='';
    if(balles>0)soloLive.innerHTML='🏀 <strong>'+balles+'</strong> balle'+(balles>1?'s':'')+' <span style="color:var(--muted);font-size:11px;font-weight:400">('+fmtN(reel)+' sach ÷ 50)</span>';
    else soloLive.innerHTML='🏀 0 balle (pas encore 50 sachets)';
    if(typeEmp==='Femme'){soloLive.innerHTML+=' <span style="color:var(--muted);font-size:10px">| <span style="color:'+(resteSach>0?'var(--amber)':'var(--green)')+'">'+resteSach+'</span>/50 vers prochaine balle</span>';}
  }
  document.getElementById('p-balles-preview').textContent=typeEmp==='Femme'?fmtN(balles)+' balles ('+fmtN(fem)+' ÷ 50)':fmtN(hom)+' balles';
  document.getElementById('p-paie-calc').textContent=fmt(paie);
  document.getElementById('p-paie-result').style.display='';
}
function calcMultiProdPaie() {
  const checks=document.querySelectorAll('#p-employe-checkboxes input:checked');
  const nb=checks.length;
  if(nb<2){document.getElementById('p-paie-result').style.display='none';return;}
  const shift=shiftVal();
  const sachets=parseFloat(document.getElementById('p-multi-sachets').value)||0;
  const multiLive=document.getElementById('p-multi-balles-live');
  const balles=sachets>0?Math.floor(sachets/50):0;
  const resteSach=sachets%50;
  if(multiLive){
    multiLive.style.display='';
    if(balles>0)multiLive.innerHTML='🏀 <strong>'+balles+'</strong> balle'+(balles>1?'s':'')+' <span style="color:var(--muted);font-size:11px;font-weight:400">('+fmtN(sachets)+' sach ÷ 50)</span>';
    else multiLive.innerHTML='🏀 0 balle (pas encore 50 sachets)';
    multiLive.innerHTML+=' <span style="color:var(--muted);font-size:10px">| <span style="color:'+(resteSach>0?'var(--amber)':'var(--green)')+'">'+resteSach+'</span>/50 vers prochaine balle</span>';
  }
  document.getElementById('p-multi-sachets-grp').style.display='';
  let totalPaie;
  if(shift==='Nuit'){
    totalPaie = PAIE_FEMMES.nuit.taux * nb;
  } else {
    if(!sachets){document.getElementById('p-paie-result').style.display='none';return;}
    const quota=PAIE_FEMMES.jour.quotas[nb]||(nb*300);
    totalPaie = Math.round((sachets / quota) * PAIE_FEMMES.jour.taux * nb);
  }
  const paiePar = Math.round(totalPaie / nb);
  document.getElementById('p-balles-preview').textContent=fmtN(balles)+' balles ('+fmtN(sachets)+' ÷ 50)';
  document.getElementById('p-paie-calc').textContent = fmt(totalPaie);
  document.getElementById('p-paie-result').style.display='';
  const dl=document.getElementById('p-multi-paie-detail');dl.style.display='';
  document.getElementById('p-multi-paie-list').innerHTML=[].map.call(checks,c=>
    '<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;border-bottom:1px solid var(--border)"><span>'+esc(c.value)+'</span><span style="font-weight:600;color:var(--green)">'+fmt(paiePar)+'</span></div>'
  ).join('');
}

function prodForm(p) {
  const e=!!p; _prodMode='solo';
  const empOpts=D.employes.map(x=>`<option value="${x.id}"${e&&p.employes&&p.employes[0]===x.name?' selected':''}>${esc(x.name)}</option>`).join('');
  const checked=e?(p.employes||[]):[];
  openM(`
    <h3>${e?'✏️ Modifier':'🏭 Nouvelle'} production</h3>
    <div class="m-row"><div><label>Date</label><input type="date" id="p-date" value="${e?p.date:today()}" /></div>
    <div><label>Shift</label><select id="p-shift" onchange="onProdShiftChange()"><option value="Jour"${e&&p.shift==='Jour'?' selected':''}>☀️ Jour</option>
    <option value="Nuit"${e&&p.shift==='Nuit'?' selected':''}>🌙 Nuit</option></select></div></div>
    <label>Mode de saisie</label>
    <div style="display:flex;gap:.5rem;margin:.2rem 0">
      <button type="button" id="btn-mode-solo" onclick="setProdMode('solo')" style="flex:1;padding:.5rem;border-radius:.55rem;font-size:.78rem;font-weight:700;border:2px solid var(--accent);background:linear-gradient(135deg,var(--orange),var(--accent));color:#fff;cursor:pointer">👤 1 Employé</button>
      <button type="button" id="btn-mode-multi" onclick="setProdMode('multi')" style="flex:1;padding:.5rem;border-radius:.55rem;font-size:.78rem;font-weight:700;border:2px solid var(--border);background:var(--hover);color:var(--text2);cursor:pointer">👥 Équipe (≥ 2)</button>
    </div>

    <!-- SOLO -->
    <div id="p-solo-section" style="display:grid;gap:.7rem">
      <div class="m-row"><div><label>Employé</label><select id="p-employe" onchange="onProdEmployeChange()"><option value="">— Choisir —</option>${empOpts}</select></div>
      <div id="p-quota-info-grp" style="display:none"><label>Quota attendu</label><div id="p-quota-info" style="padding:.6rem .8rem;background:var(--hover);border-radius:.55rem;font-weight:600;font-size:.82rem">—</div></div></div>
      <div class="m-row"><div id="p-fem-grp"><label>Sachets produits 👩</label><input type="number" id="p-fem" value="${e&&p.type==='Femme'?p.reel:''}" oninput="calcProdPaie()" />
      <div id="p-solo-balles-live" style="font-size:13px;font-weight:700;color:var(--orange);margin-top:4px;display:none">🏀 0 balle</div></div>
      <div id="p-hom-grp" style="display:none"><label>Balles produites 👨</label><input type="number" id="p-hom" value="${e&&p.type==='Homme'?p.reel:''}" oninput="calcProdPaie()" /></div></div>
    </div>

    <!-- MULTI -->
    <div id="p-multi-section" style="display:none">
      <div style="background:var(--hover);border-radius:.55rem;padding:.75rem;font-size:.75rem;color:var(--accent);margin-bottom:.75rem;line-height:1.7">
        ☀️ Jour : quota <strong>${PAIE_FEMMES.jour.quotas[2]} sachets</strong> pour 2 pers → <strong>1 800 FCFA chacune</strong> (règle de 3)<br>
        🌙 Nuit : <strong>2 000 FCFA fixe</strong> par personne
      </div>
      <div style="margin-bottom:.5rem">
        <div style="display:flex;justify-content:space-between;margin-bottom:.35rem">
          <label style="font-weight:600;font-size:.8rem">Sélectionner les employées <span style="color:var(--red)">(min. 2)</span></label>
          <span id="p-multi-count" style="font-size:.7rem;font-weight:700;padding:.15rem .55rem;border-radius:99px;background:var(--hover)">0 sélectionné(s)</span>
        </div>
        <div id="p-employe-checkboxes" style="display:flex;flex-direction:column;gap:.3rem;max-height:180px;overflow-y:auto;padding:.5rem;background:var(--hover);border-radius:.55rem"></div>
      </div>
      <div id="p-multi-sachets-grp" style="display:none;margin-bottom:.5rem">
        <label>Sachets totaux produits</label><input type="number" id="p-multi-sachets" oninput="calcMultiProdPaie()" />
        <div id="p-multi-balles-live" style="font-size:13px;font-weight:700;color:var(--orange);margin-top:4px;display:none">🏀 0 balle</div>
      </div>
    </div>

    <!-- RÉSULTAT -->
    <div id="p-paie-result" style="display:none;background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1.5px solid #86efac;border-radius:.75rem;padding:1rem">
      <div id="p-paie-regle3" style="display:none;background:#d1fae5;border-radius:.5rem;padding:.55rem .75rem;font-size:.75rem;font-weight:600;margin-bottom:.75rem"></div>
      <div id="p-quota-block" style="display:none;grid-template-columns:1fr 1fr 1fr;gap:.5rem;margin-bottom:.75rem;text-align:center">
        <div style="background:#fff;border-radius:.55rem;padding:.5rem;border:1px solid #bbf7d0">
          <div style="font-size:.62rem;font-weight:600;text-transform:uppercase;margin-bottom:.2rem;color:var(--muted)">Quota attendu</div>
          <div id="p-quota-attendu" style="font-weight:800;font-size:.9rem">—</div>
        </div>
        <div style="background:#fff;border-radius:.55rem;padding:.5rem;border:1px solid #bbf7d0">
          <div style="font-size:.62rem;font-weight:600;text-transform:uppercase;margin-bottom:.2rem;color:var(--muted)">Réel produit</div>
          <div id="p-quota-reel" style="font-weight:800;font-size:.9rem">—</div>
        </div>
        <div style="background:#fff;border-radius:.55rem;padding:.5rem;border:1px solid #bbf7d0">
          <div style="font-size:.62rem;font-weight:600;text-transform:uppercase;margin-bottom:.2rem;color:var(--muted)">Écart</div>
          <div id="p-quota-ecart" style="font-weight:800;font-size:.9rem">—</div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:.45rem;font-size:.78rem">
        <span style="color:var(--muted)">📦 Balles comptabilisées :</span>
        <span id="p-balles-preview" style="font-weight:700;color:var(--orange);font-size:.85rem">—</span>
      </div>
      <div id="p-multi-paie-detail" style="display:none;margin-bottom:.55rem">
        <div style="font-size:.72rem;font-weight:700;margin-bottom:.35rem;text-transform:uppercase">💳 Paie par employé</div>
        <div id="p-multi-paie-list" style="display:flex;flex-direction:column;gap:.3rem"></div>
      </div>
      <div style="height:1px;background:#86efac;margin-bottom:.55rem"></div>
      <div style="display:flex;justify-content:space-between;background:#fff;border-radius:.6rem;padding:.6rem .85rem;border:2px solid #4ade80">
        <span style="font-weight:700">💰 Paie :</span>
        <span id="p-paie-calc" style="font-size:1.2rem;font-weight:800;color:#15803d">—</span>
      </div>
    </div>
    <label>Notes</label><textarea id="p-notes">${e?esc(p.notes||''):''}</textarea>
    <div class="m-actions"><button class="btn btn-o" onclick="closeM()">Annuler</button>
    <button class="btn btn-p" onclick="saveProd(${e?p.id:'null'})">${e?'Modifier':'Enregistrer'}</button></div>
  `);
  if(e){
    const allEmps=prodEmps(p);
    if(allEmps.length>1){
      _prodMode='multi';document.getElementById('p-solo-section').style.display='none';document.getElementById('p-multi-section').style.display='';
      renderEmpCheckboxes();
      allEmps.forEach(n=>{const cb=document.querySelector(`#p-employe-checkboxes input[value="${esc(n)}"]`);if(cb)cb.checked=true;});
      document.getElementById('p-multi-count').textContent=allEmps.length+' sélectionné(s)';
      if(p.type==='Femme'){document.getElementById('p-multi-sachets-grp').style.display='';document.getElementById('p-multi-sachets').value=p.reel;}
      calcMultiProdPaie();
    } else {
      if(p.type==='Femme'){document.getElementById('p-fem').value=p.reel;calcProdPaie();}
      else{document.getElementById('p-hom-grp').style.display='';document.getElementById('p-hom').value=p.reel;onProdEmployeChange();}
    }
  } else {
    renderEmpCheckboxes();onProdEmployeChange();
  }
}

function saveProd(id) {
  const date=val('p-date'), shift=shiftVal();
  if(!date)return alert('Date requise');
  if(_prodMode==='multi'){
    const checks=document.querySelectorAll('#p-employe-checkboxes input:checked');
    if(checks.length<2)return alert('Sélectionnez au moins 2 employées');
    const sachets=parseFloat(document.getElementById('p-multi-sachets').value)||0;
    const notes=val('p-notes').trim();
    if(!sachets && shift!=='Nuit') return alert('Nombre de sachets requis');
    const balles=sachets>0?Math.floor(sachets/50):0;
    const noms=[].map.call(checks,c=>c.value).join(', ');
    const empNames=[].map.call(checks,c=>c.value);
    const totalPaie = shift==='Nuit' ? PAIE_FEMMES.nuit.taux * checks.length : Math.round((sachets / (PAIE_FEMMES.jour.quotas[checks.length]||(checks.length*300))) * PAIE_FEMMES.jour.taux * checks.length);
    if(id){const idx=D.productions.findIndex(x=>x.id===id);if(idx>=0)D.productions.splice(idx,1);}
    D.productions.push({id:nextId++,date,shift,employes:empNames,type:'Femme',reel:sachets,quota:PAIE_FEMMES.jour.quotas[checks.length]||0,paie:totalPaie,notes:notes||'Équipe: '+noms,createdBy:me()});
    if(balles>0)D.stockE.push({id:nextId++,date,categorie:'Balles 🏀',qte:balles,unite:'pièce',cout:0,desc:'Production équipe '+sachets+' sachets',createdBy:me()});
    closeM();save();render();return;
  }
  const empId=val('p-employe')||null;
  const emp=empId?D.employes.find(e=>e.id===+empId):null;
  if(!emp)return alert('Choisissez un employé');
  const typeEmp=emp.type;
  const fem=parseFloat(document.getElementById('p-fem').value)||0;
  const hom=parseFloat(document.getElementById('p-hom').value)||0;
  if(!fem&&!hom)return alert('Production requise');
  const reel=typeEmp==='Femme'?fem:hom;
  const paie=calcPaieFromProd(typeEmp,fem,hom,shift,1);
  const balles=typeEmp==='Femme'?Math.floor(fem/50):hom;
  if(id){const p=D.productions.find(x=>x.id===id);if(p){Object.assign(p,{date,shift,employes:[emp.name],type:typeEmp,reel,quota:getQuotaAttendu(typeEmp,shift,1)||0,paie,notes:val('p-notes').trim()});}}
  else {
    D.productions.push({id:nextId++,date,shift,employes:[emp.name],type:typeEmp,reel,quota:getQuotaAttendu(typeEmp,shift,1)||0,paie,notes:val('p-notes').trim(),createdBy:me()});
    if(typeEmp==='Femme'&&balles>0)D.stockE.push({id:nextId++,date,categorie:'Balles 🏀',qte:balles,unite:'pièce',cout:0,desc:'Production '+reel+' sachets',createdBy:me()});
  }
  closeM();save();render();
}

// ─── MONTANT ───
function montantForm(m) {
  const e=!!m; const clOpts=D.clients.map(c=>`<option value="${esc(c.name)}"${e&&m.client===c.name?' selected':''}>${esc(c.name)}</option>`).join('');
  openM(`
    <h3>${e?'✏️ Modifier':'💰 Nouveau'} montant</h3>
    <div class="m-row"><div><label>Date</label><input type="date" id="mDate" value="${e?m.date:today()}" /></div>
    <div><label>Montant</label><input type="number" id="mMt" value="${e?m.montant:''}" /></div></div>
    <label>Description</label><input id="mDesc" value="${e?esc(m.desc):''}" />
    <div class="m-row"><div><label>Type</label><select id="mType"><option value="Vente"${e&&m.type==='Vente'?' selected':''}>Vente</option>
    <option value="Dette reçue"${e&&m.type==='Dette reçue'?' selected':''}>Dette reçue</option>
    <option value="Autre"${e&&m.type==='Autre'?' selected':''}>Autre</option></select></div>
    <div><label>Client</label><select id="mClient"><option value="">—</option>${clOpts}</select></div></div>
    <div class="m-actions"><button class="btn btn-o" onclick="closeM()">Annuler</button>
    <button class="btn btn-p" onclick="saveMontant(${e?m.id:'null'})">${e?'Modifier':'Enregistrer'}</button></div>
  `);
}

function saveMontant(id) {
  const mt=num('mMt'); if(!mt)return alert('Montant requis');
  const type=val('mType'), rawClient=val('mClient');
  const cl=rawClient ? findClient(rawClient) : null;
  const client = cl ? cl.name : rawClient;
  if(rawClient && !cl && !confirm('⚠️ "'+rawClient+'" ne correspond à aucun client existant. Continuer ?')) return;
  if(id){const m=D.montants.find(x=>x.id===id);if(m){m.date=val('mDate');m.montant=mt;m.desc=val('mDesc');m.type=type;m.client=client;}}
  else {
    D.montants.push({id:nextId++,date:val('mDate'),montant:mt,desc:val('mDesc'),type,client,createdBy:me()});
    if(type==='Dette reçue'&&client){
      const cmds=D.commandes.filter(x=>x.client===client&&x.reste>0).sort((a,b)=>a.date.localeCompare(b.date));
      let left=mt;
      for(const cmd of cmds){
        if(left<=0)break;
        const pay=Math.min(left,cmd.reste);
        cmd.paye+=pay; cmd.reste=cmd.prixTotal-cmd.paye; left-=pay;
        if(cmd.reste<=0)cmd.statut='Livrée';
      }
    }
  }
  closeM();save();render();
}
function recalcDebts() {
  for(const c of D.clients){
    let debt=c.detteInit||0;
    for(const cmd of D.commandes.filter(x=>x.client===c.name))
      debt+=cmd.reste;
    c.detteCur=Math.max(0,debt);
  }
}

// ─── DÉPENSE ───
const CATD=['Électricité','Eau','Salaire journalier','Salaire mensuel','Réparation tricycle','Réparation moto','Essence tricycle','Essence moto','Matière première','Emballage','Autre'];
function depForm(d) {
  const e=!!d; const catOpts=CATD.map(c=>`<option value="${c}"${e&&d.categorie===c?' selected':''}>${c}</option>`).join('');
  const empOpts=D.employes.map(x=>`<option value="${esc(x.name)}"${e&&d.employe===x.name?' selected':''}>${esc(x.name)}</option>`).join('');
  openM(`
    <h3>${e?'✏️ Modifier':'💸 Nouvelle'} dépense</h3>
    <div class="m-row"><div><label>Date</label><input type="date" id="dDate" value="${e?d.date:today()}" /></div>
    <div><label>Montant</label><input type="number" id="dMt" value="${e?d.montant:''}" /></div></div>
    <div class="m-row"><div><label>Catégorie</label><select id="dCat">${catOpts}</select></div>
    <div><label>Détail</label><input id="dDet" value="${e?esc(d.detail||''):''}" /></div></div>
    <div id="dEmpContainer"><label>Employé</label><input id="dEmp" value="${e?esc(d.employe||''):''}" /></div>
    <div id="dEmpInfo" class="fs" style="margin-top:-8px;margin-bottom:8px"></div>
    <div class="m-actions"><button class="btn btn-o" onclick="closeM()">Annuler</button>
    <button class="btn btn-p" onclick="saveDep(${e?d.id:'null'})">${e?'Modifier':'Enregistrer'}</button></div>
  `);
  const catEl=document.getElementById('dCat');
  const upd=()=>{const cat=catEl.value,ct=document.getElementById('dEmpContainer'),info=document.getElementById('dEmpInfo');
    if(cat==='Salaire journalier'||cat==='Salaire mensuel'){
      const cur=document.getElementById('dEmp')?.value||'';
      ct.innerHTML=`<label>Employé</label><select id="dEmp">${empOpts}<option value="">— Sélectionner —</option></select>`;
      if(cur)document.getElementById('dEmp').value=cur;
      const sel=document.getElementById('dEmp');
      sel.onchange=function(){const emp=this.value;if(!emp){info.textContent='';return;}
        const paie=D.productions.filter(p=>p.employe===emp).reduce((s,p)=>s+p.paie,0);
        const retire=D.retraits.filter(r=>r.employe===emp).reduce((s,r)=>s+r.montant,0);
        info.innerHTML=`💰 Paie: ${fmt(paie)} | ↩️ Retiré: ${fmt(retire)} | 🏦 Solde: <strong>${fmt(paie-retire)}</strong>`;};
      sel.onchange();}else{ct.innerHTML='<label>Employé</label><input id="dEmp" value="" />';info.textContent='';}};
  catEl.addEventListener('change',upd);upd();
}

function saveDep(id) {
  const mt=num('dMt'); if(!mt)return alert('Montant requis');
  const cat=val('dCat'),emp=val('dEmp');
  if(id){const d=D.depenses.find(x=>x.id===id);if(d){d.date=val('dDate');d.montant=mt;d.categorie=cat;d.detail=val('dDet');d.employe=emp;}}
  else {
    D.depenses.push({id:nextId++,date:val('dDate'),montant:mt,categorie:cat,detail:val('dDet'),employe:emp,createdBy:me()});
    if((cat==='Salaire journalier'||cat==='Salaire mensuel')&&emp) {
      D.retraits.push({id:nextId++,date:val('dDate'),employe:emp,montant:mt,notes:'Salaire: '+(val('dDet')||cat),createdBy:me()});
    }
  }
  closeM();save();render();
}

// ─── STOCK ───
const STK=['Farine','Sachets rouleaux','Sachets grand','Sachets petit','Balles 🏀'];
function stockForm(type,item) {
  const e=!!item; const isIn=type==='E'; const catOpts=STK.map(c=>`<option value="${c}"${e&&item.categorie===c?' selected':''}>${c}</option>`).join('');
  openM(`
    <h3>${e?'✏️':'📦'} ${isIn?'Entrée':'Sortie'} stock</h3>
    <div class="m-row"><div><label>Date</label><input type="date" id="sDate" value="${e?item.date:today()}" /></div>
    <div><label>Catégorie</label><select id="sCat">${catOpts}</select></div></div>
    <div class="m-row"><div><label>Quantité</label><input type="number" id="sQte" value="${e?item.qte:''}" /></div>
    <div><label>Unité</label><select id="sUn"><option value="kg"${e&&item.unite==='kg'?' selected':''}>kg</option>
    <option value="rouleau"${e&&item.unite==='rouleau'?' selected':''}>rouleau</option>
    <option value="sac"${e&&item.unite==='sac'?' selected':''}>sac</option>
    <option value="pièce"${e&&item.unite==='pièce'?' selected':''}>pièce</option></select></div></div>
    ${isIn?`<label>Coût</label><input type="number" id="sCout" value="${e?item.cout||'':''}" />`:''}
    <label>Description</label><textarea id="sDesc">${e?esc(item.desc||''):''}</textarea>
    <div class="m-actions"><button class="btn btn-o" onclick="closeM()">Annuler</button>
    <button class="btn btn-p" onclick="saveStock('${type}',${e?item.id:'null'})">Enregistrer</button></div>
  `);
}

function saveStock(type,id) {
  const qte=num('sQte'); if(!qte)return alert('Quantité requise');
  const list=type==='E'?D.stockE:D.stockS;
  const obj={date:val('sDate'),categorie:val('sCat'),qte,unite:val('sUn'),desc:val('sDesc')};
  if(type==='E')obj.cout=num('sCout');
  if(id){const x=list.find(i=>i.id===id);if(x)Object.assign(x,obj);}
  else list.push({id:nextId++,...obj,createdBy:me()});
  closeM();save();render();
}

function stockInitForm(item) {
  const e=!!item;
  openM(`
    <h3>${e?'✏️':'📋'} Stock initial</h3>
    <p style="font-size:12px;color:var(--muted);margin:0 0 10px">Stock de départ à une date précise (en unités)</p>
    <div class="m-row"><div><label>Date</label><input type="date" id="siDate" value="${e?item.date:today()}" /></div></div>
    ${STK.map(c=>{
      const key={Farine:'farine','Sachets rouleaux':'sachetsR','Sachets grand':'sachetsG','Sachets petit':'sachetsP','Balles 🏀':'balles'}[c];
      return `<label>${c}</label><input type="number" id="si_${key}" value="${e?item[key]||'':''}" />`;
    }).join('')}
    <div style="font-size:11px;color:var(--muted);margin:5px 0">💡 1 balle = 50 sachets</div>
    <div class="m-actions"><button class="btn btn-o" onclick="closeM()">Annuler</button>
    <button class="btn btn-p" onclick="saveStockInit(${e?item.id:'null'})">Enregistrer</button></div>
  `);
}

function saveStockInit(id) {
  const obj={
    date:val('siDate'),
    farine:num('si_farine')||0,
    sachetsR:num('si_sachetsR')||0,
    sachetsG:num('si_sachetsG')||0,
    sachetsP:num('si_sachetsP')||0,
    balles:num('si_balles')||0
  };
  if(id){const x=D.stockInit.find(i=>i.id===id);if(x)Object.assign(x,obj);}
  else D.stockInit.push({id:nextId++,...obj,createdBy:me()});
  closeM();save();render();
}

// ─── EMPLOYÉ ───
function empForm(e) {
  const edit=!!e;
  openM(`
    <h3>${edit?'✏️ Modifier':'👷 Nouvel'} employé</h3>
    <label>Nom</label><input id="eName" value="${edit?esc(e.name):''}" />
    <div class="m-row"><div><label>Rôle / Poste</label><input id="eRole" value="${edit?esc(e.role||''):''}" /></div>
    <div><label>Type</label><select id="eType"><option value="Femme"${edit&&e.type==='Femme'?' selected':''}>👩 Femme</option>
    <option value="Homme"${edit&&e.type==='Homme'?' selected':''}>👨 Homme</option>
    <option value="Autre"${edit&&e.type==='Autre'?' selected':''}>👤 Autre</option></select></div></div>
    <div class="m-row"><div><label>Téléphone</label><input id="ePhone" value="${edit?esc(e.phone||''):''}" /></div>
    <div><label>Date d'embauche</label><input type="date" id="eDate" value="${edit?e.dateEmbauche:today()}" /></div></div>
    <label>Notes</label><textarea id="eNotes">${edit?esc(e.notes||''):''}</textarea>
    <div class="m-actions"><button class="btn btn-o" onclick="closeM()">Annuler</button>
    <button class="btn btn-p" onclick="saveEmp(${edit?e.id:'null'})">${edit?'Modifier':'Enregistrer'}</button></div>
  `);
}
function saveEmp(id) {
  const n=val('eName').trim(); if(!n)return alert('Nom requis');
  if(!id&&D.employes.find(e=>e.name===n))return alert('Ce nom existe deja');
  if(id){const e=D.employes.find(x=>x.id===id);if(e){e.name=n;e.role=val('eRole');e.type=val('eType');e.phone=val('ePhone');e.dateEmbauche=val('eDate');e.notes=val('eNotes');}}
  else D.employes.push({id:nextId++,name:n,role:val('eRole'),type:val('eType'),phone:val('ePhone'),dateEmbauche:val('eDate'),notes:val('eNotes'),createdBy:me()});
  closeM();save();render();
}
function retraitForm(id) {
  const e=D.employes.find(x=>x.id===id); if(!e)return;
  const paie=D.productions.reduce((s,p)=>prodEmps(p).includes(e.name)?s+(p.type==='Femme'?Math.round(p.paie/prodEmps(p).length):p.paie):s,0);
  const retire=D.retraits.filter(r=>r.employe===e.name).reduce((s,r)=>s+r.montant,0);
  const solde=paie-retire;
  openM(`
    <h3>💸 Retrait — ${esc(e.name)}</h3>
    <div class="calc"><div class="r"><span>💰 Paie gagnée</span><span class="v">${fmt(paie)}</span></div>
    <div class="r"><span>↩️ Déjà retiré</span><span class="v">${fmt(retire)}</span></div>
    <div class="r" style="font-size:16px;color:${solde>=0?'var(--accent)':'var(--red)'}"><span>🏦 Solde</span><span class="v">${fmt(solde)}</span></div></div>
    <div class="m-row"><div><label>Date</label><input type="date" id="rDate" value="${today()}" /></div>
    <div><label>Montant</label><input type="number" id="rMt" value="" oninput="retraitWarn(${solde})" /></div></div>
    <div id="rWarn" style="display:none;background:var(--surface);border:1px solid var(--red);border-radius:6px;padding:8px;font-size:12px;margin-bottom:8px"></div>
    <label>Notes</label><textarea id="rNotes"></textarea>
    <div class="m-actions"><button class="btn btn-o" onclick="closeM()">Annuler</button>
    <button class="btn btn-p" onclick="saveRetrait(${id},${solde})">Retirer</button></div>
  `);
  setTimeout(()=>{const el=document.getElementById('rMt');if(el)el.value=solde>0?solde:'';},50);
}
function retraitWarn(solde) {
  const mt=num('rMt'),w=document.getElementById('rWarn');
  if(!w)return;
  if(mt>Math.max(0,solde)){
    const d=mt-Math.max(0,solde);
    w.style.display='block';
    w.innerHTML=`⚠️ Dépassement de <b>${fmt(d)}</b> sur le solde disponible.${solde<0?' (Compte déjà en déficit de '+fmt(-solde)+')':''}`;
  } else w.style.display='none';
}
function saveRetrait(id,maxS) {
  const e=D.employes.find(x=>x.id===id); if(!e)return alert('Erreur');
  const mt=num('rMt'); if(mt<=0)return alert('Montant invalide');
  D.retraits.push({id:nextId++,date:val('rDate'),employe:e.name,montant:mt,notes:val('rNotes'),createdBy:me()});
  closeM();save();render();
}

function saveEmp(id) {
  const n=val('eName').trim(); if(!n)return alert('Nom requis');
  if(!id&&D.employes.find(e=>e.name===n))return alert('Ce nom existe deja');
  if(id){const e=D.employes.find(x=>x.id===id);if(e){e.name=n;e.type=val('eType');e.phone=val('ePhone');e.dateEmbauche=val('eDate');e.notes=val('eNotes');}}
  else D.employes.push({id:nextId++,name:n,type:val('eType'),phone:val('ePhone'),dateEmbauche:val('eDate'),notes:val('eNotes'),createdBy:me()});
  closeM();save();render();
}

function retraitForm(id) {
  const e=D.employes.find(x=>x.id===id); if(!e)return;
  const paie=D.productions.reduce((s,p)=>prodEmps(p).includes(e.name)?s+(p.type==='Femme'?Math.round(p.paie/prodEmps(p).length):p.paie):s,0);
  const retire=D.retraits.filter(r=>r.employe===e.name).reduce((s,r)=>s+r.montant,0);
  const solde=paie-retire;
  openM(`
    <h3>💸 Retrait — ${esc(e.name)}</h3>
    <div class="calc"><div class="r"><span>💰 Paie gagnée</span><span class="v">${fmt(paie)}</span></div>
    <div class="r"><span>↩️ Déjà retiré</span><span class="v">${fmt(retire)}</span></div>
    <div class="r" style="font-size:16px;color:var(--accent)"><span>🏦 Solde</span><span class="v">${fmt(solde)}</span></div></div>
    <div class="m-row"><div><label>Date</label><input type="date" id="rDate" value="${today()}" /></div>
    <div><label>Montant</label><input type="number" id="rMt" value="${solde}" max="${solde}" /></div></div>
    <label>Notes</label><textarea id="rNotes"></textarea>
    <div class="m-actions"><button class="btn btn-o" onclick="closeM()">Annuler</button>
    <button class="btn btn-p" onclick="saveRetrait(${id},${solde})">Retirer</button></div>
  `);
}

function saveRetrait(id,maxS) {
  const e=D.employes.find(x=>x.id===id); if(!e)return alert('Erreur');
  const mt=num('rMt'); if(mt<=0||mt>maxS)return alert('Montant invalide');
  D.retraits.push({id:nextId++,date:val('rDate'),employe:e.name,montant:mt,notes:val('rNotes'),createdBy:me()});
  closeM();save();render();
}

// ─── EXPORT ───
function exportData() {
  const b=new Blob([JSON.stringify(D,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='chips-data.json';a.click();
}
function exportToExcel(section) {
  if(typeof XLSX==='undefined')return alert('Bibliothèque Excel non chargée');
  const wb=XLSX.utils.book_new();
  const dateSections=['commandes','productions','montants','depenses','retraits','stockE','stockS'];
  const fil=(key,arr)=>dateSections.includes(key)?arr.filter(x=>inRange(x.date)):arr;
  const map={
    clients:{data:D.clients,h:['Nom','Téléphone','Adresse','Dette initiale','Dette actuelle'],f:c=>[c.name,c.phone||'',c.addr||'',c.detteInit||0,c.detteCur||0]},
    commandes:{data:fil('commandes',D.commandes),h:['Client','Date','Produit','Quantité','Unité','🏀 Balles','Prix total','Payé','Reste','Statut'],f:c=>[c.client,c.date,c.produit,c.qte,c.unite||'Balle',cmdStockBalles(c),c.prixTotal,c.paye,c.reste,c.statut]},
    productions:{data:fil('productions',D.productions),h:['Date','Shift','Type','Employés','Réel','Quota','Paie','Balles','Sachets'],f:p=>[p.date,p.shift,p.type,(p.employes||[p.employe||'']).join(', '),p.reel,p.quota||'',p.paie,Math.floor(p.reel/50),p.type==='Femme'?p.reel:'']},
    montants:{data:fil('montants',D.montants),h:['Date','Description','Type','Client','Montant'],f:m=>[m.date,m.desc,m.type,m.client||'',m.montant]},
    depenses:{data:fil('depenses',D.depenses),h:['Date','Catégorie','Montant','Détail','Employé'],f:d=>[d.date,d.categorie,d.montant,d.detail||'',d.employe||'']},
    retraits:{data:fil('retraits',D.retraits),h:['Date','Employé','Montant','Notes'],f:r=>[r.date,r.employe,r.montant,r.notes||'']},
    stockE:{data:fil('stockE',D.stockE),h:['Date','Catégorie','Quantité','Unité','Coût','Description'],f:s=>[s.date,s.categorie,s.qte,s.unite||'',s.cout||0,s.desc||'']},
    stockS:{data:fil('stockS',D.stockS),h:['Date','Catégorie','Quantité','Unité','Description'],f:s=>[s.date,s.categorie,s.qte,s.unite||'',s.desc||'']},
    employes:{data:D.employes,h:['Nom','Type','Téléphone','Date embauche','Notes'],f:e=>[e.name,e.type,e.phone||'',e.dateEmbauche||'',e.notes||'']},
  };
  // Récapitulatif financier
  const cmd=fil('commandes',D.commandes),prod=fil('productions',D.productions),mont=fil('montants',D.montants),dep=fil('depenses',D.depenses);
  const totRevenus=mont.reduce((s,m)=>s+m.montant,0),totDepenses=dep.reduce((s,d)=>s+d.montant,0);
  const prodBalles=prod.filter(p=>p.type==='Femme').reduce((s,p)=>s+Math.floor(p.reel/50),0);
  const cmdBalles=calcBallesCommandes(cmd);
  const recap=[
    ['RÉCAPITULATIF - Période',filterRange.start&&filterRange.end?`${filterRange.start} → ${filterRange.end}`:'Toute période'],
    [],['Indicateur','Valeur'],
    ['👥 Clients',D.clients.length],
    ['🏀 Balles produites',prodBalles],
    ['📦 Balles vendues',cmdBalles],
    ['💰 Total revenus',totRevenus],
    ['💸 Total dépenses',totDepenses],
    ['📋 Bilan net',totRevenus-totDepenses],
    ['🏦 Dettes clients total',D.clients.reduce((s,c)=>s+(c.detteCur||0),0)],
    ['👷 Employés',D.employes.length],
    ['🛒 Commandes (période)',cmd.length],
    ['🏭 Productions (période)',prod.length],
  ];
  const wsRecap=XLSX.utils.aoa_to_sheet(recap);
  XLSX.utils.book_append_sheet(wb,wsRecap,'Récapitulatif');
  if(section==='all'){
    for(const [key,{data,h,f}] of Object.entries(map)){
      const rows=[h,...data.map(f)];
      const ws=XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb,ws,key.charAt(0).toUpperCase()+key.slice(1).replace('E',' (Entrées)').replace('S',' (Sorties)'));
    }
  } else {
    const {data,h,f}=map[section]||{data:[],h:[],f:()=>[]};
    let rows=[h,...data.map(f)];
    if(section==='montants')rows.push([],['TOTAL',totRevenus]);
    if(section==='depenses')rows.push([],['TOTAL',totDepenses]);
    const ws=XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb,ws,'Données');
  }
  XLSX.writeFile(wb,section==='all'?'chips_comptabilite.xlsx':`chips_${section}.xlsx`);
}

// ─── RENDER ───
function render() {
  cleanTrash(); renderTabs();
  try {
  document.getElementById('p-dash').innerHTML = dashHTML();
  document.getElementById('p-clients').innerHTML = clientsHTML();
  document.getElementById('p-commandes').innerHTML = commandesHTML();
  document.getElementById('p-prod').innerHTML = prodHTML();
  document.getElementById('p-montants').innerHTML = montantsHTML();
  document.getElementById('p-depenses').innerHTML = depensesHTML();
  document.getElementById('p-stock').innerHTML = stockHTML();
  document.getElementById('p-finances').innerHTML = financesHTML();
  document.getElementById('p-analyses').innerHTML = analysesHTML();
  document.getElementById('p-employes').innerHTML = employesHTML();
  document.getElementById('p-exporter').innerHTML = exporterHTML();
  document.getElementById('p-corbeille').innerHTML = corbeilleHTML();
  dashCharts(); updateSyncUI();
  } catch(e){console.error('Render error',e);}
}

function dashHTML() {
  const montants=D.montants.filter(m=>inRange(m.date)), depenses=D.depenses.filter(d=>inRange(d.date));
  const prodsAll=D.productions.filter(p=>inRange(p.date));
  const totM=montants.reduce((s,m)=>s+m.montant,0), totD=depenses.reduce((s,d)=>s+d.montant,0);
  const bilan=totM-totD;
  const totalSachets=prodsAll.filter(p=>p.type==='Femme').reduce((s,p)=>s+p.reel,0);
  const totalBalles=Math.floor(totalSachets/50);
  const cmdPeriod=D.commandes.filter(c=>inRange(c.date));
  const cmdPeriodBalles=calcBallesCommandes(cmdPeriod);
  const stockEntrees=D.stockE.filter(e=>e.categorie==='Balles 🏀').reduce((s,e)=>s+e.qte,0);
  const stockSorties=D.stockS.filter(s=>s.categorie==='Balles 🏀').reduce((s,s2)=>s+s2.qte,0);
  const stockBalles=D.stockInit.reduce((s,si)=>s+(si.balles||0),0) + stockEntrees - stockSorties;
  const prods=[...prodsAll].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  const byCat={}; depenses.forEach(d=>{byCat[d.categorie]=(byCat[d.categorie]||0)+d.montant;});
  const byType={}; montants.forEach(m=>{byType[m.type]=(byType[m.type]||0)+m.montant;});

  const weekAgo=new Date();weekAgo.setDate(weekAgo.getDate()-7);
  const wkProds=D.productions.filter(p=>new Date(p.date)>=weekAgo&&p.type==='Femme');
  const wkBalles=Math.floor(wkProds.reduce((s,p)=>s+p.reel,0)/50);

  return `<h1>📊 Tableau de Bord</h1><p class="desc">Vue d'ensemble</p>
  <div class="grid" style="grid-template-columns:1fr 1fr 1fr">
    <div class="card accent tc"><div class="big">${totalBalles}</div><div class="lbl">🏀 Balles produites</div></div>
    <div class="card tc"><div class="big">${cmdPeriodBalles}</div><div class="lbl">📦 Balles vendues</div></div>
    <div class="card tc"><div class="big" style="color:${stockBalles>=0?'var(--green)':'var(--red)'}">${stockBalles}</div><div class="lbl">📦 Stock balles dispo${calcSachetsEnStock()>0?` <span style="color:var(--amber);font-size:9px">+ ${calcSachetsEnStock()} sach.</span>`:''}</div></div>
  </div>
  <div class="grid">
    <div class="card"><div class="big">${D.clients.length}</div><div class="lbl">👥 Clients</div></div>
    <div class="card"><div class="big" style="color:var(--green)">${fmt(totM)}</div><div class="lbl">💰 Reçus (période)</div></div>
    <div class="card"><div class="big" style="color:var(--red)">${fmt(totD)}</div><div class="lbl">💸 Dépenses (période)</div></div>
  </div>
  <div class="grid" style="grid-template-columns:1fr 1fr">
    <div class="card"><canvas id="chartFin" height="180"></canvas></div>
    <div class="card"><canvas id="chartDep" height="180"></canvas></div>
  </div>
  <div class="grid" style="grid-template-columns:1fr 1fr 1fr">
    <div class="card tc"><div class="big" style="color:${bilan>=0?'var(--green)':'var(--red)'}">${fmt(bilan)}</div><div class="lbl">📋 Bilan net</div></div>
    <div class="card tc"><div class="big">${wkBalles}</div><div class="lbl">🏀 Balles (7j)</div></div>
    <div class="card tc"><div class="big">${fmt(D.clients.reduce((s,c)=>s+(c.detteCur||0),0))}</div><div class="lbl">📌 Dettes clients</div></div>
  </div>
  <div class="card"><h2>🏭 Dernières productions</h2>${prods.length?prods.map(p=>`
    <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:12.5px">
      <span>${esc(p.date)} · ${esc(prodEmps(p).join(', '))}</span>
      <span class="badge ${p.type==='Femme'?'bg-k':'bg-b'}">${esc(p.type)}</span>
      <span>${esc(p.reel)} ${p.type==='Femme'?'sach → '+Math.floor(p.reel/50)+' balles':'ball'}</span>
      <span style="font-weight:600">${fmt(p.paie)}</span>
    </div>`).join(''):'<div class="empty">Aucune production</div>'}</div>`;
}

function dashCharts() {
  const montants=D.montants.filter(m=>inRange(m.date)), depenses=D.depenses.filter(d=>inRange(d.date));
  const totM=montants.reduce((s,m)=>s+m.montant,0), totD=depenses.reduce((s,d)=>s+d.montant,0);
  const byCat={}; depenses.forEach(d=>{byCat[d.categorie]=(byCat[d.categorie]||0)+d.montant;});
  const catE=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const catO=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(6).reduce((s,[,v])=>s+v,0);

  const COLORS=['#3b3bfa','#22c55e','#f59e0b','#ef4444','#a78bfa','#ec4899','#14b8a6','#f97316'];

  const c1=document.getElementById('chartFin'); if(c1&&Chart.getChart(c1))Chart.getChart(c1).destroy();
  if(c1){
    new Chart(c1,{type:'doughnut',data:{labels:['Revenus','Depenses'],datasets:[{data:[totM,totD],backgroundColor:['#22c55e','#ef4444'],borderWidth:0}]},options:{cutout:'70%',responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{padding:12,font:{size:11,family:'Inter'}}},title:{display:true,text:'Revenus vs Depenses',font:{size:13,family:'Inter',weight:'600'},padding:{bottom:8}}}}});
  }
  const c2=document.getElementById('chartDep'); if(c2&&Chart.getChart(c2))Chart.getChart(c2).destroy();
  if(c2){
    const labels=catE.map(([k])=>k); const data=catE.map(([,v])=>v);
    if(catO>0){labels.push('Autres');data.push(catO);}
    new Chart(c2,{type:'doughnut',data:{labels,datasets:[{data,backgroundColor:COLORS.slice(0,labels.length),borderWidth:0}]},options:{cutout:'70%',responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{padding:10,font:{size:10,family:'Inter'},boxWidth:10,boxHeight:10}},title:{display:true,text:'Depenses par categorie',font:{size:13,family:'Inter',weight:'600'},padding:{bottom:8}}}}});
  }
}

function clientsHTML() {
  return `<h1>👥 Clients & Dettes</h1><p class="desc">Suivi des clients — dettes et progression des paiements</p>
  <div class="toolbar"><button class="btn btn-p" onclick="clientForm()">+ Ajouter</button></div>
  <div class="table-wrap"><table><thead><tr><th>Client</th><th>📞 Contact</th><th>💳 Dette</th><th>📊 Progression</th><th>📦 Commandes</th><th></th></tr></thead>
  <tbody>${D.clients.length?D.clients.map(c=>{
    const cmds=D.commandes.filter(x=>x.client===c.name);
    const pending=cmds.filter(x=>x.reste>0);
    const totalCmd=cmds.reduce((s,x)=>s+x.prixTotal,0);
    const payeCmd=cmds.reduce((s,x)=>s+x.paye,0);
    const pctPaye=totalCmd>0?Math.round((payeCmd/totalCmd)*100):0;
    const pctDette=c.detteInit>0?Math.round(((c.detteInit-(c.detteCur||0))/c.detteInit)*100):(c.detteCur>0?0:100);
    return `<tr><td><strong>${esc(c.name)}</strong>${c.phone?`<br><span class="fs">${esc(c.phone)}</span>`:''}</td>
    <td>${esc(c.phone||'—')}</td>
    <td style="color:${(c.detteCur||0)>0?'var(--red)':'var(--green)'}">
      <strong>${fmt(c.detteCur||0)}</strong>
      ${c.detteInit>0?`<br><span class="fs">Init: ${fmt(c.detteInit)}</span>`:''}
    </td>
    <td style="min-width:120px">
      ${c.detteInit>0?`<div style="display:flex;align-items:center;gap:4px;margin-bottom:2px"><span class="fs">Dette</span><div class="prog" style="flex:1"><div class="prog-f" style="width:${pctDette}%;background:${pctDette>=100?'var(--green)':'var(--amber)'}"></div></div><span class="fs">${pctDette}%</span></div>`:''}
      ${totalCmd>0?`<div style="display:flex;align-items:center;gap:4px"><span class="fs">Commandes</span><div class="prog" style="flex:1"><div class="prog-f" style="width:${pctPaye}%;background:linear-gradient(90deg,var(--accent),#a78bfa)"></div></div><span class="fs">${pctPaye}%</span></div>`:''}
    </td>
    <td>${pending.length?`<span style="color:var(--red);font-weight:600">${pending.length} en attente<br>${fmt(pending.reduce((s,x)=>s+x.reste,0))}</span>`:'<span style="color:var(--green)">✓ Aucune</span>'}</td>
    <td class="gap-4">
      <button class="btn btn-sm btn-gh" onclick="clientDetail(D.clients.find(x=>x.id===${c.id}))" title="Détails"><i class="ti ti-info-circle"></i></button>
      <button class="btn btn-sm btn-gh" onclick="clientForm(D.clients.find(x=>x.id===${c.id}))"><i class="ti ti-pencil"></i></button>
      <button class="btn btn-sm btn-g" onclick="payerDette(${c.id})"><i class="ti ti-cash"></i></button>
      <button class="btn btn-sm btn-r" onclick="confirmDel('Supprimer ce client?','clients',D.clients.find(x=>x.id===${c.id}))"><i class="ti ti-trash"></i></button>
    </td></tr>`;
  }).join(''):'<tr><td colspan="6" class="empty">Aucun client</td></tr>'}</tbody></table></div>`;
}

function clientDetail(c) {
  if(!c)return;
  const cmds=D.commandes.filter(x=>x.client===c.name).sort((a,b)=>b.date.localeCompare(a.date));
  const mts=D.montants.filter(x=>x.client===c.name).sort((a,b)=>b.date.localeCompare(a.date));
  const totalCmd=cmds.reduce((s,x)=>s+x.prixTotal,0);
  const payeCmd=cmds.reduce((s,x)=>s+x.paye,0);
  const detteMts=mts.filter(x=>x.type==='Dette reçue').reduce((s,x)=>s+x.montant,0);
  openM(`
    <h3>👤 ${esc(c.name)}</h3>
    <div style="font-size:.78rem;color:var(--muted);margin-bottom:.75rem">
      ${c.phone?`📞 ${esc(c.phone)}<br>`:''}${c.addr?`📍 ${esc(c.addr)}<br>`:''}
      Créé par ${esc(c.createdBy||'—')}
    </div>
    <div class="grid" style="grid-template-columns:1fr 1fr 1fr;gap:.5rem;margin-bottom:.75rem">
      <div class="card tc" style="padding:.5rem"><div class="big" style="font-size:16px;color:var(--red)">${fmt(c.detteInit)}</div><div class="lbl" style="font-size:9px">Dette initiale</div></div>
      <div class="card tc" style="padding:.5rem"><div class="big" style="font-size:16px;color:var(--accent)">${fmt(totalCmd)}</div><div class="lbl" style="font-size:9px">Total commandes</div></div>
      <div class="card tc" style="padding:.5rem"><div class="big" style="font-size:16px;color:${(c.detteCur||0)>0?'var(--red)':'var(--green)'}">${fmt(c.detteCur||0)}</div><div class="lbl" style="font-size:9px">Dette actuelle</div></div>
    </div>
    <div style="font-size:.8rem;font-weight:600;margin-bottom:.4rem">📦 Commandes (${cmds.length})</div>
    ${cmds.length?`<div class="table-wrap" style="margin-bottom:.75rem"><table><thead><tr><th>Date</th><th>Produit</th><th>Total</th><th>✅ Payé</th><th>⏳ Reste</th></tr></thead>
    <tbody>${cmds.map(cmd=>`<tr><td>${esc(cmd.date)}</td><td>${esc(cmd.produit)}</td><td>${fmt(cmd.prixTotal)}</td>
    <td style="color:var(--green)">${fmt(cmd.paye)}</td><td style="color:${cmd.reste>0?'var(--red)':'var(--green)'}">${fmt(cmd.reste)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty" style="margin-bottom:.75rem">Aucune commande</div>'}
    <div style="font-size:.8rem;font-weight:600;margin-bottom:.4rem">💰 Paiements reçus (${mts.length})</div>
    ${mts.length?`<div class="table-wrap" style="margin-bottom:.75rem"><table><thead><tr><th>Date</th><th>Montant</th><th>Type</th><th>Description</th></tr></thead>
    <tbody>${mts.map(m=>`<tr><td>${esc(m.date)}</td><td style="font-weight:600;color:${m.type==='Dette reçue'?'var(--green)':'var(--accent)'}">${fmt(m.montant)}</td>
    <td><span class="badge ${m.type==='Dette reçue'?'bg-g':'bg-b'}">${esc(m.type)}</span></td>
    <td>${esc(m.desc||'')}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty" style="margin-bottom:.75rem">Aucun paiement</div>'}
    <div style="background:var(--hover);border-radius:.55rem;padding:.6rem .75rem;font-size:.78rem">
      <strong>🧮 Calcul dette :</strong> ${fmt(c.detteInit)} (init) + ${fmt(totalCmd)} (commandes) − ${fmt(detteMts)} (reçus) = <strong style="color:${(c.detteCur||0)>0?'var(--red)':'var(--green)'}">${fmt(c.detteCur||0)}</strong>
    </div>
    <div class="m-actions" style="margin-top:.75rem"><button class="btn btn-o" onclick="closeM()">Fermer</button></div>
  `);
}

function commandesHTML() {
  const cmdList=D.commandes.filter(c=>inRange(c.date));
  const totalBallesCmd=calcBallesCommandes(D.commandes);
  const ballesDirectes=D.commandes.filter(c=>c.unite!=='Sachet').reduce((s,c)=>s+c.qte,0);
  const ballesViaSachets=totalBallesCmd-ballesDirectes;
  const sachetsEnAttente=calcSachetsRestants();
  return `<h1>🛒 Commandes</h1>
  <p class="desc">Suivi des commandes clients. ${!filterRange.start&&!filterRange.end?'':cmdList.length+' sur la période'}</p>
  <div class="grid" style="grid-template-columns:1fr 1fr 1fr 1fr;margin-bottom:12px">
    <div class="card tc"><div class="big">${totalBallesCmd}</div><div class="lbl">🏀 Balles vendues (total)</div></div>
    <div class="card tc"><div class="big">${ballesDirectes}</div><div class="lbl">📦 Balles directes</div></div>
    <div class="card tc"><div class="big">${ballesViaSachets}</div><div class="lbl">🔄 Balles via sachets</div></div>
    <div class="card tc"><div class="big" style="color:${sachetsEnAttente>0?'var(--amber)':'var(--green)'}">${sachetsEnAttente}</div><div class="lbl">🧮 Sachets non convertis</div></div>
  </div>
  <div class="toolbar"><button class="btn btn-p" onclick="commandeForm()">+ Nouvelle</button></div>
  <div class="table-wrap">
  <table>
    <thead><tr>
      <th>Client</th><th>Produit</th><th>Qté</th><th>🏀 Stock</th><th>Total</th><th>✅ Payé</th><th>⏳ Reste</th><th>Statut</th><th>Actions</th>
    </tr></thead>
    <tbody>${
      cmdList.length
      ? [...cmdList].sort((a,b)=>b.date.localeCompare(a.date)).map(c=>{
          const r=c.prixTotal-c.paye;
          const un=c.unite||'Balle';
          const bEq=cmdStockBalles(c);
          const qteLabel=un==='Sachet'?c.qte+' sach':c.qte+' bal';
          return `<tr>
            <td>${esc(c.client)}<br><span class="fs">${esc(c.date)}</span></td>
            <td>${esc(c.produit)}</td>
            <td><strong>${qteLabel}</strong></td>
            <td style="color:var(--orange);font-weight:600">${bEq>0?'🏀 '+bEq:'<span class="fs">—</span>'}</td>
            <td><strong>${fmt(c.prixTotal)}</strong></td>
            <td style="color:var(--green)">${fmt(c.paye)}</td>
            <td style="color:${r>0?'var(--red)':'var(--green)'}">${fmt(r)}</td>
            <td><span class="badge ${c.statut==='Livrée'?'bg-g':c.statut==='Annulée'?'bg-r':'bg-y'}">${esc(c.statut)}</span></td>
            <td class="gap-4">
              <button class="btn btn-sm btn-gh" onclick="commandeForm(D.commandes.find(x=>x.id===${c.id}))"><i class="ti ti-pencil"></i></button>
              ${r>0?`<button class="btn btn-sm btn-g" onclick="payerCmd(${c.id})"><i class="ti ti-cash"></i></button>`:''}
              <button class="btn btn-sm btn-r" onclick="confirmDel('Supprimer cette commande?','commandes',D.commandes.find(x=>x.id===${c.id}))"><i class="ti ti-trash"></i></button>
            </td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="9" class="empty">Aucune commande</td></tr>'
    }</tbody>
  </table>
  </div>`;
}

// Week calculation
function getWeek(d){const t=new Date(d);t.setHours(0,0,0,0);t.setDate(t.getDate()+3-(t.getDay()+6)%7);return Math.ceil(((t-new Date(t.getFullYear(),0,4))/86400000+1)/7);}
function weekRange(w,y){const d=new Date(y,0,1+((w-1)*7));d.setDate(d.getDate()+(1-d.getDay()+7)%7-3);return d;}
let curWeek=0, curYear=0;

function prodHTML() {
  const totF=D.productions.reduce((s,p)=>s+(p.type==='Femme'?p.reel:0),0);
  const totH=D.productions.reduce((s,p)=>s+(p.type==='Homme'?p.reel:0),0);
  const totBalles=Math.floor(totF/50);
  const totPaie=D.productions.reduce((s,p)=>s+p.paie,0);

  const prodsFiltered=getProdsFiltered();
  const moisCourant=new Date().toISOString().slice(0,7);
  const byEmp={};
  prodsFiltered.forEach(p=>{
    const emps=prodEmps(p);
    const nb=emps.length;
    const paiePar=nb>1?Math.round(p.paie/nb):p.paie;
    const reelPar=nb>1?Math.round(p.reel/nb):p.reel;
    const quotaPar=nb>1&&p.quota?Math.round(p.quota/nb):p.quota||0;
    const ballesPar=p.type==='Femme'?Math.floor(reelPar/50):reelPar;
    emps.forEach(n=>{
      if(!byEmp[n])byEmp[n]={nom:n,typeEmp:p.type,totFem:0,totHom:0,totB:0,totPaie:0,moisPaie:0,totQuota:0,nbJours:0};
      const r=byEmp[n];
      if(p.type==='Femme')r.totFem+=reelPar;else r.totHom+=reelPar;
      r.totB+=ballesPar;r.totPaie+=paiePar;r.totQuota+=quotaPar;r.nbJours+=1;
      if(p.date&&p.date.slice(0,7)===moisCourant)r.moisPaie+=paiePar;
    });
  });
  const empRows=Object.values(byEmp).filter(e=>e.nom!=='—').sort((a,b)=>b.totPaie-a.totPaie);

  const filterLabel=_prodFilter==='today'?"Aujourd'hui":_prodFilter==='week'?'Cette semaine':'Tout';

  return `<h1>🏭 Production</h1><p class="desc">${filterLabel}</p>
  <div class="grid" style="grid-template-columns:1fr 1fr 1fr 1fr">
    <div class="card tc"><div class="big" style="color:#1d4ed8">${fmtN(totF)}</div><div class="lbl">👩 Sachets femmes</div></div>
    <div class="card tc"><div class="big" style="color:#0e7490">${fmtN(totH)}</div><div class="lbl">👨 Balles hommes</div></div>
    <div class="card tc"><div class="big" style="color:#b45309">${fmtN(totBalles)}</div><div class="lbl">📦 Balles totales</div></div>
    <div class="card tc accent"><div class="big">${fmt(totPaie)}</div><div class="lbl">💰 Total paies</div></div>
  </div>

  <!-- Filtre -->
  <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.75rem;flex-wrap:wrap">
    <span style="font-size:.78rem;font-weight:700;color:var(--muted)">Afficher :</span>
    ${['today','week','all'].map(f=>`<button onclick="setProdFilter('${f}')" style="font-size:.72rem;font-weight:600;padding:.3rem .75rem;border-radius:.5rem;border:none;cursor:pointer;background:${_prodFilter===f?'linear-gradient(135deg,var(--orange),var(--accent))':'var(--hover)'};color:${_prodFilter===f?'#fff':'var(--text2)'}">${f==='today'?'📅 Aujourd\'hui':f==='week'?'📆 Cette semaine':'🗂️ Tout'}</button>`).join('')}
  </div>

  <!-- Paies par employé -->
  <div class="card mb-12"><h2 style="font-size:14px">💳 Paies par employé <span style="font-size:.65rem;color:var(--muted);margin-left:8px">${empRows.length} employé(s) — ${filterLabel}</span></h2>
  <div class="table-wrap"><table><thead><tr><th>Employé</th><th>Type</th><th class="tr">Prod.</th><th class="tr">Quota</th><th class="tr">Écart</th><th class="tr">🏀 Balles</th><th class="tr">💰 Paie mois</th><th class="tr">💰 Total</th></tr></thead>
  <tbody>${empRows.length?empRows.map(e=>{
    const reel=e.typeEmp==='Femme'?e.totFem:e.totHom;
    const unite=e.typeEmp==='Femme'?'sach':'bal';
    const ecart=reel-(e.totQuota||0);
    const ecTxt=e.totQuota?ecart>0?'<span style="color:var(--green)">+'+fmtN(ecart)+'</span>':ecart<0?'<span style="color:var(--red)">'+fmtN(ecart)+'</span>':'<span style="color:var(--green)">= 0</span>':'<span style="color:var(--muted)">—</span>';
    return `<tr><td style="font-weight:600">${esc(e.nom)}</td>
    <td><span class="badge ${e.typeEmp==='Femme'?'bg-k':'bg-b'}">${esc(e.typeEmp)}</span></td>
    <td class="tr">${fmtN(reel)} ${unite}</td>
    <td class="tr" style="color:var(--muted)">${e.totQuota?fmtN(e.totQuota)+' '+unite:'—'}</td>
    <td class="tr">${ecTxt}</td>
    <td class="tr"><b style="color:var(--orange)">${fmtN(e.totB)}</b></td>
    <td class="tr"><b style="color:#059669">${fmt(e.moisPaie)}</b></td>
    <td class="tr"><b style="color:#7c3aed">${fmt(e.totPaie)}</b></td></tr>`;
  }).join(''):'<tr><td colspan="8" class="empty">Aucune production</td></tr>'}</tbody></table></div></div>

  <!-- Détail journalier -->
  <div class="card"><h2 style="font-size:14px">📋 Détail journalier — Quota vs Réel vs Paie</h2>
  <div class="toolbar" style="margin-bottom:8px"><button class="btn btn-p btn-sm" onclick="prodForm()">+ Ajouter production</button></div>
  <div class="table-wrap"><table><thead><tr><th>Date</th><th>Employé</th><th class="tc">Shift</th><th class="tr">Quota</th><th class="tr">Réel</th><th class="tr">Écart</th><th class="tr">🏀 Balles</th><th class="tr">💰 Paie</th><th></th></tr></thead>
  <tbody>${prodsFiltered.length?[...prodsFiltered].sort((a,b)=>b.date.localeCompare(a.date)).map(p=>{
    const q=getQuotaAttendu(p.type,p.shift,1);
    const reel=p.reel;
    const ec=reel-(q||0);
    const ecTxt=q!==null?ec>0?'<span style="color:var(--green)">+'+fmtN(ec)+'</span>':ec<0?'<span style="color:var(--red)">'+fmtN(ec)+'</span>':'<span style="color:var(--green)">✓</span>':'<span style="color:var(--muted)">—</span>';
    const balles=p.type==='Femme'?Math.floor(p.reel/50):p.reel;
    return `<tr><td>${esc(p.date)}</td><td style="font-weight:600">${esc(p.employes?p.employes.join(', '):'')}</td>
    <td class="tc"><span class="badge ${p.shift==='Jour'?'bg-y':'bg-b'}">${esc(p.shift)}</span></td>
    <td class="tr" style="color:var(--muted)">${q!==null?fmtN(q)+(p.type==='Femme'?' sach':' bal'):'—'}</td>
    <td class="tr" style="color:${p.type==='Femme'?'#db2777':'#2563eb'};font-weight:600">${fmtN(reel)} ${p.type==='Femme'?'sach':'bal'}</td>
    <td class="tr">${ecTxt}</td>
    <td class="tr"><b style="color:var(--orange)">${fmtN(balles)}</b></td>
    <td class="tr"><b style="color:#059669">${fmt(p.paie)}</b></td>
    <td><button class="btn btn-sm btn-r" onclick="confirmDel('Supprimer cette production?','productions',D.productions.find(x=>x.id===${p.id}))"><i class="ti ti-trash"></i></button></td></tr>`;
  }).join(''):'<tr><td colspan="9" class="empty">Aucune production</td></tr>'}</tbody></table></div></div>`;
}
function getProdsFiltered() {
  const now=new Date(), todayStr=today();
  const day=now.getDay();const mon=new Date(now);mon.setDate(now.getDate()-(day===0?6:day-1));mon.setHours(0,0,0,0);
  const monStr=mon.toISOString().slice(0,10);
  return D.productions.filter(p=>{if(_prodFilter==='today')return p.date===todayStr;if(_prodFilter==='week')return p.date>=monStr;return true;});
}
function setProdFilter(f){_prodFilter=f;render();}

function montantsHTML() {
  const mList=D.montants.filter(m=>inRange(m.date));
  const items=[...mList].sort((a,b)=>b.date.localeCompare(a.date));
  return `<h1>💰 Montants reçus</h1><p class="desc">Total: ${fmt(mList.reduce((s,m)=>s+m.montant,0))}</p>
  <div class="toolbar"><button class="btn btn-p" onclick="montantForm()">+ Ajouter</button></div>
  <div class="table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Client</th><th>Montant</th><th></th></tr></thead>
  <tbody>${items.length?items.map(m=>`<tr><td>${esc(m.date)}</td><td>${esc(m.desc||'—')}</td>
  <td><span class="badge ${m.type==='Vente'?'bg-g':m.type==='Dette reçue'?'bg-b':'bg-n'}">${esc(m.type)}</span></td>
  <td>${esc(m.client||'—')}</td><td style="font-weight:600;color:var(--green)">${fmt(m.montant)}</td>
  <td><button class="btn btn-sm btn-r" onclick="confirmDel('Supprimer ce montant?','montants',D.montants.find(x=>x.id===${m.id}))"><i class="ti ti-trash"></i></button></td></tr>`).join(''):'<tr><td colspan="6" class="empty">Aucun montant sur cette période</td></tr>'}</tbody></table></div>`;
}

function depensesHTML() {
  const dList=D.depenses.filter(d=>inRange(d.date));
  const items=[...dList].sort((a,b)=>b.date.localeCompare(a.date));
  const byCat={}; dList.forEach(d=>{byCat[d.categorie]=(byCat[d.categorie]||0)+d.montant;});
  const tot=dList.reduce((s,d)=>s+d.montant,0);
  return `<h1>💸 Dépenses</h1><p class="desc">Total: ${fmt(tot)}</p>
  <div class="toolbar"><button class="btn btn-p" onclick="depForm()">+ Ajouter</button></div>
  ${Object.keys(byCat).length?`<div class="card mb-12"><h2>📊 Répartition</h2>${Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`
    <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:13px">
      <span>${esc(k)}</span><span style="font-weight:600;color:var(--red)">${fmt(v)}</span></div>`).join('')}</div>`:''}
  <div class="table-wrap"><table><thead><tr><th>Date</th><th>Catégorie</th><th>Détail</th><th>Montant</th><th></th></tr></thead>
  <tbody>${items.length?items.map(d=>`<tr><td>${esc(d.date)}</td>
  <td><span class="badge ${d.categorie==='Électricité'||d.categorie==='Eau'?'bg-b':d.categorie.includes('Salaire')?'bg-p':d.categorie.includes('Réparation')?'bg-r':d.categorie.includes('Essence')?'bg-y':d.categorie==='Matière première'?'bg-g':d.categorie==='Emballage'?'bg-b':'bg-n'}">${esc(d.categorie)}</span></td>
  <td>${esc(d.detail||'')}${d.employe?`<br><span class="fs">${esc(d.employe)}</span>`:''}</td>
  <td style="font-weight:600;color:var(--red)">${fmt(d.montant)}</td>
  <td><button class="btn btn-sm btn-r" onclick="confirmDel('Supprimer cette dépense?','depenses',D.depenses.find(x=>x.id===${d.id}))"><i class="ti ti-trash"></i></button></td></tr>`).join(''):'<tr><td colspan="5" class="empty">Aucune dépense</td></tr>'}</tbody></table></div>`;
}

function stockHTML() {
  const cur={}; STK.forEach(c=>cur[c]=0);
  D.stockE.forEach(e=>{cur[e.categorie]=(cur[e.categorie]||0)+e.qte;});
  D.stockS.forEach(s=>{cur[s.categorie]=(cur[s.categorie]||0)-s.qte;});
  D.stockInit.forEach(si=>{
    cur.Farine=(cur.Farine||0)+(si.farine||0);
    cur['Sachets rouleaux']=(cur['Sachets rouleaux']||0)+(si.sachetsR||0);
    cur['Sachets grand']=(cur['Sachets grand']||0)+(si.sachetsG||0);
    cur['Sachets petit']=(cur['Sachets petit']||0)+(si.sachetsP||0);
    cur['Balles 🏀']=(cur['Balles 🏀']||0)+(si.balles||0);
  });
  const prodBalles=Math.floor(D.productions.filter(p=>p.type==='Femme').reduce((s,p)=>s+p.reel,0)/50);
  const cmdBalles=calcBallesCommandes(D.commandes);
  const sachetsRestants=calcSachetsRestants();
  const sachetsEnStock=calcSachetsEnStock();
  const initItems=[...D.stockInit].sort((a,b)=>b.date.localeCompare(a.date));
  return `<h1>📦 Stock</h1><p class="desc">Gestion des entrées, sorties et stock initial</p>
  <div class="toolbar"><button class="btn btn-p" onclick="stockForm('E')">+ Entrée</button><button class="btn btn-o" onclick="stockForm('S')">- Sortie</button><button class="btn btn-g" onclick="stockInitForm()">📋 Stock initial</button></div>
  <div class="grid">${STK.map(c=>`<div class="card" style="text-align:center;padding:.7rem">
    <div class="big" style="font-size:20px;color:${(cur[c]||0)>=0?'var(--green)':'var(--red)'}">${cur[c]||0}</div>
    <div class="lbl" style="font-size:10px">${c}${c==='Balles 🏀'?` <span style="color:var(--amber);font-size:9px">(prod: ${prodBalles} | cmd: ${cmdBalles} | sach : ${sachetsEnStock} rest.)</span>`:''}</div></div>`).join('')}</div>
  ${initItems.length?`<div class="card mb-12"><h2>📋 Stock initial</h2>
  <div class="table-wrap"><table><thead><tr><th>Date</th><th>Farine</th><th>Sach. rouleaux</th><th>Sach. grand</th><th>Sach. petit</th><th>Balles 🏀</th><th></th></tr></thead>
  <tbody>${initItems.map(si=>`<tr><td>${esc(si.date)}</td><td>${si.farine||0}</td><td>${si.sachetsR||0}</td><td>${si.sachetsG||0}</td><td>${si.sachetsP||0}</td><td>${si.balles||0}</td>
  <td><button class="btn btn-sm btn-r" onclick="confirmDel('Supprimer ce stock initial?','stockInit',D.stockInit.find(x=>x.id===${si.id}))"><i class="ti ti-trash"></i></button></td></tr>`).join('')}</tbody></table></div></div>`:''}
  <div class="card mb-12"><h2>📥 Entrées</h2><div class="table-wrap">${makeStockTable(D.stockE,'E')}</div></div>
  <div class="card"><h2>📤 Sorties</h2><div class="table-wrap">${makeStockTable(D.stockS,'S')}</div></div>`;
}

function makeStockTable(list,type) {
  const items=[...list].sort((a,b)=>b.date.localeCompare(a.date));
  if(!items.length)return'<div class="empty">Aucune</div>';
  return `<table><thead><tr><th>Date</th><th>Catégorie</th><th>Quantité</th>${type==='E'?'<th>Coût</th>':''}<th>Description</th><th></th></tr></thead>
  <tbody>${items.map(i=>`<tr><td>${esc(i.date)}</td><td>${esc(i.categorie)}</td><td>${esc(i.qte)} ${esc(i.unite||'')}</td>${type==='E'?`<td>${fmt(i.cout||0)}</td>`:''}<td>${esc(i.desc||'')}</td>
  <td><button class="btn btn-sm btn-r" onclick="confirmDel('Supprimer?','stock${type==='E'?'E':'S'}',D.stock${type==='E'?'E':'S'}.find(x=>x.id===${i.id}))"><i class="ti ti-trash"></i></button></td></tr>`).join('')}</tbody></table>`;
}

function financesHTML() {
  const montants=D.montants.filter(m=>inRange(m.date)), depenses=D.depenses.filter(d=>inRange(d.date));
  const totR=montants.reduce((s,m)=>s+m.montant,0), totD=depenses.reduce((s,d)=>s+d.montant,0);
  const bilan=totR-totD, dettes=D.clients.reduce((s,c)=>s+(c.detteCur||0),0);
  const byType={}; montants.forEach(m=>{byType[m.type]=(byType[m.type]||0)+m.montant;});
  const byCat={}; depenses.forEach(d=>{byCat[d.categorie]=(byCat[d.categorie]||0)+d.montant;});
  return `<h1>📈 Finances</h1><p class="desc">Bilan financier global</p>
  <div class="grid">
    <div class="card accent"><div class="big">${fmt(totR)}</div><div class="lbl">Revenus</div></div>
    <div class="card"><div class="big" style="color:var(--red)">${fmt(totD)}</div><div class="lbl">Dépenses</div></div>
    <div class="card"><div class="big" style="color:${bilan>=0?'var(--green)':'var(--red)'}">${fmt(bilan)}</div><div class="lbl">Résultat net</div></div>
    <div class="card"><div class="big" style="color:var(--red)">${fmt(dettes)}</div><div class="lbl">Dettes clients</div></div>
  </div>
  <div class="card mb-12"><h2>💰 Revenus par type</h2>${Object.keys(byType).length?Object.entries(byType).map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:13px"><span>${esc(k)}</span><span style="font-weight:600;color:var(--green)">${fmt(v)}</span></div>`).join(''):'<div class="empty">Aucun revenu</div>'}</div>
  <div class="card mb-12"><h2>💸 Dépenses par catégorie</h2>${Object.keys(byCat).length?Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:13px"><span>${esc(k)}</span><span style="font-weight:600;color:var(--red)">${fmt(v)}</span></div>`).join(''):'<div class="empty">Aucune dépense</div>'}</div>
  <div class="card"><h2>👥 Dettes clients</h2>${D.clients.filter(c=>(c.detteCur||0)>0).length?[...D.clients].filter(c=>(c.detteCur||0)>0).sort((a,b)=>(b.detteCur||0)-(a.detteCur||0)).map(c=>{
    const pct=c.detteInit?Math.round(((c.detteInit-(c.detteCur||0))/c.detteInit)*100):0;
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--border);font-size:13px">
      <span><strong>${esc(c.name)}</strong></span><span style="color:var(--red)">${fmt(c.detteCur)}</span>
      <div class="prog" style="width:80px"><div class="prog-f" style="width:${pct}%;background:${pct>=100?'var(--green)':'var(--amber)'}"></div></div><span>${pct}%</span></div>`;
  }).join(''):'<div class="empty">Aucune dette</div>'}</div>`;
}

function analysesHTML() {
  const montants=D.montants.filter(m=>inRange(m.date)), depenses=D.depenses.filter(d=>inRange(d.date));
  const prods=D.productions.filter(p=>inRange(p.date));
  const totR=montants.reduce((s,m)=>s+m.montant,0), totD=depenses.reduce((s,d)=>s+d.montant,0);
  const bilan=totR-totD, marge=totR?Math.round((totR-totD)/totR*100):0;
  const weekAgo=new Date();weekAgo.setDate(weekAgo.getDate()-7);
  const wk=D.productions.filter(p=>new Date(p.date)>=weekAgo&&p.type==='Femme');
  const byDay={}; wk.forEach(p=>{const b=Math.floor(p.reel/50);byDay[p.date]=(byDay[p.date]||0)+b;});
  const recos=[];
  if(totD>totR)recos.push('🔴 Dépenses > Revenus. Réduisez les coûts.');
  if(D.clients.some(c=>(c.detteCur||0)>0))recos.push('🟡 Relancez les clients avec dettes impayées.');
  if(totR>0&&totD/totR>0.8)recos.push('🟡 Ratio dépenses/revenus élevé (>80%). Optimisez.');
  if(prods.length===0)recos.push('🟡 Aucune production sur cette période.');
  if(!recos.length)recos.push('✅ Bonne gestion !');
  return `<h1>🧠 Analyses PME</h1><p class="desc">Indicateurs de performance (période)</p>
  <div class="grid">
    <div class="card accent"><div class="big">${fmt(bilan)}</div><div class="lbl">Résultat net période</div></div>
    <div class="card"><div class="big" style="color:${marge>=0?'var(--green)':'var(--red)'}">${marge}%</div><div class="lbl">Marge nette période</div></div>
    <div class="card"><div class="big">${prods.length}</div><div class="lbl">Productions période</div></div>
    <div class="card"><div class="big">${D.employes.length}</div><div class="lbl">Effectif</div></div>
  </div>
  <div class="card mb-12"><h2>🏭 Production (7 jours)</h2>${Object.keys(byDay).length?Object.keys(byDay).sort().map(d=>`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:13px"><span>${esc(d)}</span><span style="font-weight:600">${esc(byDay[d])} balles</span></div>`).join(''):'<div class="empty">Aucune donnée</div>'}</div>
  <div class="card"><h2>💡 Recommandations</h2>${recos.map(r=>`<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">${r}</div>`).join('')}</div>`;
}

function employesHTML() {
  const empData = D.employes.map(e=>{
    const paie=D.productions.reduce((s,p)=>prodEmps(p).includes(e.name)?s+(p.type==='Femme'?Math.round(p.paie/prodEmps(p).length):p.paie):s,0);
    const retire=D.retraits.filter(r=>r.employe===e.name).reduce((s,r)=>s+r.montant,0);
    return {...e,paie,retire,solde:paie-retire};
  });
  const retraits=[...D.retraits].sort((a,b)=>b.date.localeCompare(a.date));
  const totPaie=empData.reduce((s,e)=>s+e.paie,0);
  const totRetire=empData.reduce((s,e)=>s+e.retire,0);
  const totSolde=totPaie-totRetire;
  return `<h1>👷 Employés</h1><p class="desc">Registre et suivi des paies</p>
  <div class="grid">
    <div class="card" style="text-align:center"><div class="big">${D.employes.length}</div><div class="lbl">👥 Employés</div></div>
    <div class="card" style="text-align:center"><div class="big" style="color:var(--green)">${fmt(totPaie)}</div><div class="lbl">💰 Paies gagnées</div></div>
    <div class="card" style="text-align:center"><div class="big" style="color:var(--red)">${fmt(totRetire)}</div><div class="lbl">↩️ Retiré</div></div>
    <div class="card" style="text-align:center"><div class="big" style="color:${totSolde>=0?'var(--green)':'var(--red)'}">${fmt(totSolde)}</div><div class="lbl">🏦 Solde net</div></div>
  </div>
  <div class="toolbar"><button class="btn btn-p" onclick="empForm()">+ Ajouter</button></div>
  <div class="table-wrap mb-12"><table><thead><tr><th>Nom</th><th>Type</th><th>💰 Paie gagnée</th><th>↩️ Retiré</th><th>🏦 Solde</th><th>Actions</th></tr></thead>
  <tbody>${empData.length?empData.map(e=>{const pct=e.paie>0?Math.round(Math.min(e.retire/e.paie,1)*100):0;
  return `<tr><td><strong>${esc(e.name)}</strong>${e.role?`<div style="font-size:10px;color:var(--text3)">${esc(e.role)}</div>`:''}</td>
  <td><span class="badge ${e.type==='Femme'?'bg-k':e.type==='Homme'?'bg-b':'bg-n'}">${e.type}</span></td>
  <td style="font-weight:600;color:var(--accent)">${fmt(e.paie)}</td><td>${fmt(e.retire)}</td>
  <td>${(()=>{if(e.solde>0)return `<div style="font-weight:700;color:var(--green);font-size:14px">${fmt(e.solde)}</div><div style="background:var(--border);border-radius:99px;height:4px;width:70px;margin-top:3px"><div style="background:var(--green);height:4px;border-radius:99px;width:${pct}%"></div></div><div style="font-size:9px;color:var(--text3)">${pct}% retiré</div>`;if(e.solde===0)return `<span style="color:var(--text3);font-weight:600">0 FCFA</span><div style="font-size:9px;color:var(--text3)">Tout retiré</div>`;return `<div style="background:var(--surface);border:1px solid var(--red);border-radius:6px;padding:4px 6px;display:inline-block"><span style="font-weight:700;color:var(--red);font-size:13px">-${fmt(-e.solde)}</span><div style="font-size:9px;color:var(--red);font-weight:600">⚠ Dépassement</div></div>`;})()}</td>
  <td class="gap-4"><button class="btn btn-sm btn-gh" onclick="empForm(D.employes.find(x=>x.id===${e.id}))"><i class="ti ti-pencil"></i></button>
  <button class="btn btn-sm btn-g" onclick="retraitForm(${e.id})"><i class="ti ti-cash"></i></button>
  <button class="btn btn-sm btn-r" onclick="confirmDel('Supprimer cet employé?','employes',D.employes.find(x=>x.id===${e.id}))"><i class="ti ti-trash"></i></button></td></tr>`;}).join(''):'<tr><td colspan="6" class="empty">Aucun employé</td></tr>'}</tbody></table></div>
  <div class="card"><h2>📋 Retraits caisse</h2><div class="table-wrap"><table><thead><tr><th>Date</th><th>Employé</th><th>Montant</th><th>Notes</th><th></th></tr></thead>
  <tbody>${retraits.length?retraits.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.employe)}</td><td style="font-weight:600">${fmt(r.montant)}</td><td>${esc(r.notes||'')}</td>
  <td><button class="btn btn-sm btn-r" onclick="confirmDel('Supprimer ce retrait?','retraits',D.retraits.find(x=>x.id===${r.id}))"><i class="ti ti-trash"></i></button></td></tr>`).join(''):'<tr><td colspan="5" class="empty">Aucun retrait</td></tr>'}</tbody></table></div></div>`;
}

function exporterHTML() {
  const sections=[
    ['all','📦 Tout le classeur','btn-p'],
    ['clients','👥 Clients','btn-g'],
    ['commandes','🛒 Commandes','btn-g'],
    ['productions','🏭 Productions','btn-g'],
    ['montants','💰 Montants','btn-g'],
    ['depenses','💸 Dépenses','btn-g'],
    ['employes','👷 Employés','btn-g'],
    ['retraits','↩️ Retraits','btn-g'],
    ['stockE','📥 Entrées stock','btn-g'],
    ['stockS','📤 Sorties stock','btn-g'],
  ];
  return `<h1>📥 Exporter</h1><p class="desc">Téléchargez vos données en Excel (.xlsx)</p>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px;margin-bottom:1rem">${sections.map(([k,label,cls])=>`<button class="btn ${cls}" onclick="exportToExcel('${k}')" style="justify-content:center;padding:.8rem">${label}</button>`).join('')}</div>
  <div class="card"><h2>📋 Export JSON (sauvegarde brute)</h2><p class="desc">Pour restauration future</p>
  <button class="btn btn-p" onclick="exportData()"><i class="ti ti-download"></i> Exporter JSON</button></div>
  <div class="card mt-12"><h2>Aperçu</h2><pre style="font-size:11px;max-height:300px;overflow:auto;background:var(--bg);padding:10px;border-radius:8px">${JSON.stringify(D,null,2).slice(0,2000)}...</pre></div>
  <div class="card" style="border-color:var(--red)">
    <h2 style="color:var(--red)">🗑️ Réinitialiser l'application</h2>
    <p class="desc">Supprime toutes les données (clients, commandes, productions, etc.)</p>
    <button class="btn btn-r" onclick="resetApp()"><i class="ti ti-trash"></i> Tout effacer</button>
  </div>`;
}

function resetApp() {
  if(!confirm('⚠️ SUPPRIMER TOUTES LES DONNÉES ? Cette action est irréversible.'))return;
  if(!confirm('⚠️⚠️ Confirmer : plus aucun client, commande, production ni paie ne sera conservé.'))return;
  D = { _schemaVer:8, clients:[], commandes:[], productions:[], montants:[], depenses:[], stockE:[], stockS:[], stockInit:[], employes:[], retraits:[], trash:[] };
  nextId = 1; save(); render();
  alert('✅ Application réinitialisée. Toutes les données ont été effacées.');
}

function corbeilleHTML() {
  const items=[...D.trash].sort((a,b)=>b.deletedAt-a.deletedAt);
  const S=7*86400000;
  return `<h1>🗑️ Corbeille</h1><p class="desc">Rétention 7 jours avant suppression définitive</p>
  <div class="toolbar">${items.length?`<button class="btn btn-r btn-sm" onclick="if(confirm('Vider la corbeille ? Cette action est irréversible.')){D.trash=[];save();render()}">🗑️ Vider la corbeille</button>`:''}</div>
  <div class="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Contenu</th><th>Motif</th><th>Supprimé par</th><th>Suppression dans</th><th>Actions</th></tr></thead>
  <tbody>${items.length?items.map(t=>{const r=Math.max(0,S-(Date.now()-t.deletedAt));const j=Math.ceil(r/86400000);const nm=t.content.name||t.content.client||t.content.desc||t.content.detail||t.content.produit||'(?)';
  return `<tr><td>${new Date(t.deletedAt).toLocaleDateString('fr-FR')}</td><td><span class="badge bg-n">${t.type}</span></td>
  <td>${esc(nm).slice(0,40)}</td><td>${esc(t.motif||'').slice(0,30)}</td><td>${esc(t.createdBy||'—').slice(0,20)}</td><td>${j}j</td>
  <td class="gap-4"><button class="btn btn-sm btn-g" onclick="restoreT(${t.id})">Restaurer</button>
  <button class="btn btn-sm btn-r" onclick="D.trash=D.trash.filter(x=>x.id!==${t.id});save();render()">Effacer</button></td></tr>`;}).join(''):'<tr><td colspan="7" class="empty">Corbeille vide</td></tr>'}</tbody></table></div>
  <p class="fs mt-8"><i class="ti ti-info-circle"></i> Les éléments sont automatiquement supprimés après 7 jours.</p>`;
}

// ─── SEED DATA ───
function seedEmployees() {
  const existing=D.employes.map(e=>e.name.toLowerCase().trim());
  const names=[
    {name:'B3 LUDOVIC',type:'Homme'},{name:'B2 François',type:'Homme'},
    {name:'A1 Hortence',type:'Femme'},{name:'A2 Marie',type:'Femme'},
    {name:'A3 Honorine',type:'Femme'},{name:'A4 Naomie',type:'Femme'},
    {name:'A5 José',type:'Femme'},{name:'A6 Nathalie',type:'Femme'},
    {name:'A7 Marie Claire',type:'Femme'},{name:'A8 Jertruie',type:'Femme'},
    {name:'A9 Gwladys',type:'Femme'},{name:'B1 Audrey',type:'Femme'},
  ];
  let added=false;
  for(const {name:n,type:t} of names){
    if(!existing.includes(n.toLowerCase().trim())){
      D.employes.push({id:nextId++,name:n,role:'',type:t,phone:'',dateEmbauche:today(),notes:'',createdBy:'admin'});
      added=true;
    }
  }
  if(added){save();render();}
}

// ─── INIT ───
renderTabs(); updateUserUI();
loadSB().then(()=>{
  recalcDebts();save();
  document.documentElement.setAttribute('data-theme',theme);
  document.getElementById('themeBtn').innerHTML = theme==='dark'?'☀️ Clair':'🌙 Sombre';
  document.getElementById('filterInfo').textContent = 'Toute période';
  document.getElementById('p-dash').innerHTML = dashHTML();
  document.getElementById('p-clients').innerHTML = clientsHTML();
  document.getElementById('p-commandes').innerHTML = commandesHTML();
  document.getElementById('p-prod').innerHTML = prodHTML();
  document.getElementById('p-montants').innerHTML = montantsHTML();
  document.getElementById('p-depenses').innerHTML = depensesHTML();
  document.getElementById('p-stock').innerHTML = stockHTML();
  document.getElementById('p-finances').innerHTML = financesHTML();
  document.getElementById('p-analyses').innerHTML = analysesHTML();
  document.getElementById('p-employes').innerHTML = employesHTML();
  document.getElementById('p-exporter').innerHTML = exporterHTML();
  document.getElementById('p-corbeille').innerHTML = corbeilleHTML();
  dashCharts(); updateSyncUI(); checkStorageSize();
  // seedEmployees();
});
