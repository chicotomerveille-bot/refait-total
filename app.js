
// ─── STATE ───
const K = 'chips_pro';
const SB_URL = 'https://nsbkjtosovogetwwrnji.supabase.co';
const SB_KEY = 'sb_publishable_LpIvf0N_7rj75hgJrlGJnQ_dIeCGKlm';
let SB = null;
try { SB = supabase.createClient(SB_URL, SB_KEY); } catch(e) {}
let D = { clients:[], commandes:[], productions:[], montants:[], depenses:[], stockE:[], stockS:[], employes:[], retraits:[], trash:[] };
let nextId = 1;
let currentPage = 'dash';
let filterRange = { start: '', end: '' };
let theme = localStorage.getItem('chips_theme')||'light';
let userName = localStorage.getItem('chips_user')||'';

function me() { return userName; }

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
    if(!D.clients) Object.assign(D,{clients:[],commandes:[],productions:[],montants:[],depenses:[],stockE:[],stockS:[],employes:[],retraits:[],trash:[]});
    const all = [].concat(...['clients','commandes','productions','montants','depenses','stockE','stockS','employes','retraits','trash'].map(k=>D[k]||[]));
    nextId = all.reduce((m,x)=>Math.max(m,x.id||0),0)+1;
  } catch(_){load()}
}
function save() {
  recalcDebts();
  localStorage.setItem(K,JSON.stringify(D));
  if(SB) SB.from('app_state').upsert({id:1,data:D,updated_at:new Date().toISOString()},{onConflict:'id'}).then().catch(()=>{});
}
function today() { return new Date().toISOString().slice(0,10); }
function fmt(n) { return (n||0).toLocaleString('fr-FR')+' FCFA'; }
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
    D.stockE.push({id:nextId++,date:today(),categorie:'Balles 🏀',qte:item.qte,unite:'pièce',cout:0,desc:'Annulation commande '+item.client,createdBy:me()});
  }
  if(type==='productions'&&item.type==='Femme'){
    const bles=Math.floor(item.reel/50);
    if(bles>0)D.stockS.push({id:nextId++,date:today(),categorie:'Balles 🏀',qte:bles,unite:'pièce',desc:'Annulation production '+item.reel+' sachets',createdBy:me()});
  }
  trashIt(type,item,motif);
  D[type]=D[type].filter(x=>x.id!==id);
  closeM();save();render();
}

// ─── COMMANDE ───
function commandeForm(cmd) {
  const e=!!cmd; const clOpts=D.clients.map(c=>`<option value="${esc(c.name)}"${e&&cmd.client===c.name?' selected':''}>${esc(c.name)}</option>`).join('');
  openM(`
    <h3>${e?'✏️ Modifier':'🛒 Nouvelle'} commande</h3>
    <label>Client</label><select id="coCli">${clOpts}<option value="">— Nouveau —</option></select>
    <label>Nouveau client</label><input id="coNew" placeholder="Nom" />
    <div class="m-row"><div><label>Date</label><input type="date" id="coDate" value="${e?cmd.date:today()}" /></div>
    <div><label>Produit</label><input id="coProd" value="${e?esc(cmd.produit):'Chips'}" /></div></div>
    <div class="m-row"><div><label>Quantité</label><input type="number" id="coQte" value="${e?cmd.qte:1}" /></div>
    <div><label>Prix unitaire</label><input type="number" id="coPu" value="${e?Math.round(cmd.prixTotal/(cmd.qte||1)):25000}" /></div></div>
    <div class="m-row"><div><label>Acompte</label><input type="number" id="coPaye" value="${e?cmd.paye:0}" /></div>
    <div><label>Statut</label><select id="coStat"><option value="En attente"${e&&cmd.statut==='En attente'?' selected':''}>⏳ En attente</option>
    <option value="Livrée"${e&&cmd.statut==='Livrée'?' selected':''}>✅ Livrée</option>
    <option value="Annulée"${e&&cmd.statut==='Annulée'?' selected':''}>❌ Annulée</option></select></div></div>
    <div class="m-actions"><button class="btn btn-o" onclick="closeM()">Annuler</button>
    <button class="btn btn-p" onclick="saveCommande(${e?cmd.id:'null'})">${e?'Modifier':'Enregistrer'}</button></div>
  `);
  document.getElementById('coCli').addEventListener('change',function(){document.getElementById('coNew').disabled=!!this.value});
}

function saveCommande(id) {
  const sel=val('coCli'), nc=val('coNew').trim(), client=sel||nc||'Client';
  const date=val('coDate'), prod=val('coProd').trim()||'Chips', qte=num('coQte')||1, pu=num('coPu')||25000;
  const pt=qte*pu, paye=num('coPaye'), stat=val('coStat');
  if(id) {
    const c=D.commandes.find(x=>x.id===id); if(!c)return;
    const oldReste=c.reste, oldClient=c.client, oldQte=c.qte;
    const diff=paye-c.paye; c.client=client;c.date=date;c.produit=prod;c.qte=qte;c.prixTotal=pt;c.paye=paye;c.reste=pt-paye;c.statut=stat;
    if(qte!==oldQte){const dq=qte-oldQte;if(dq>0)D.stockS.push({id:nextId++,date,categorie:'Balles 🏀',qte:dq,unite:'pièce',desc:'Ajustement commande '+client,createdBy:me()});else D.stockE.push({id:nextId++,date,categorie:'Balles 🏀',qte:-dq,unite:'pièce',cout:0,desc:'Ajustement commande '+client,createdBy:me()});}
    // Remove old debt from previous client
    const oldCl=D.clients.find(x=>x.name===oldClient);
    if(oldCl)oldCl.detteCur=Math.max(0,(oldCl.detteCur||0)-oldReste);
    // Add new debt to current client
    let curCl=D.clients.find(x=>x.name===client);
    if(!curCl&&nc&&!sel){D.clients.push({id:nextId++,name:nc,phone:'',addr:'',detteInit:0,detteCur:0,createdBy:me()});curCl=D.clients[D.clients.length-1];}
    if(curCl)curCl.detteCur=(curCl.detteCur||0)+(pt-paye);
    if(diff!==0) D.montants.push({id:nextId++,date,desc:diff>0?'Acompte commande - '+client:'Correction acompte - '+client,type:'Vente',client,montant:diff,createdBy:me()});
  } else {
    D.commandes.push({id:nextId++,client,date,produit:prod,qte,prixTotal:pt,paye,reste:pt-paye,statut:stat,createdBy:me()});
    if(paye>0) D.montants.push({id:nextId++,date,desc:'Acompte commande - '+client,type:'Vente',client,montant:paye,createdBy:me()});
    let cl=D.clients.find(x=>x.name===client);
    if(!cl&&nc&&!sel){D.clients.push({id:nextId++,name:nc,phone:'',addr:'',detteInit:0,detteCur:0,createdBy:me()});cl=D.clients[D.clients.length-1];}
    if(cl)cl.detteCur=(cl.detteCur||0)+(pt-paye);
    D.stockS.push({id:nextId++,date,categorie:'Balles 🏀',qte,unite:'pièce',desc:'Commande '+client,createdBy:me()});
  }
  closeM();save();render();
}

function payerCmd(id) {
  const c=D.commandes.find(x=>x.id===id); if(!c)return;
  const r=c.prixTotal-c.paye; if(r<=0)return alert('Déjà payé');
  const mt=prompt('Montant versé (FCFA) :',r.toString()); if(!mt||+mt<=0)return;
  c.paye+=+mt; c.reste=c.prixTotal-c.paye; if(c.reste<=0)c.statut='Livrée';
  D.montants.push({id:nextId++,date:today(),desc:'Paiement commande - '+c.client,type:'Vente',client:c.client,montant:+mt,createdBy:me()});
  const cl=D.clients.find(x=>x.name===c.client); if(cl)cl.detteCur=Math.max(0,(cl.detteCur||0)-(+mt));
  save();render();
}

// ─── PRODUCTION ───
function prodForm(p) {
  const e=!!p; const femEmp=D.employes.filter(x=>x.type==='Femme'); const otherEmp=D.employes.filter(x=>x.type!=='Femme');
  const checked=e?(p.employes||(p.employe?[p.employe]:[])):[];
  openM(`
    <h3>${e?'✏️ Modifier':'🏭 Nouvelle'} production</h3>
    <div class="m-row"><div><label>Date</label><input type="date" id="prDate" value="${e?p.date:today()}" /></div>
    <div><label>Shift</label><select id="prShift"><option value="Jour"${e&&p.shift==='Jour'?' selected':''}>☀️ Jour</option>
    <option value="Nuit"${e&&p.shift==='Nuit'?' selected':''}>🌙 Nuit</option></select></div></div>
    <div id="prEmpSection"></div>
    <div class="m-row"><div><label>Type</label><select id="prType"><option value="Femme"${e&&p.type==='Femme'?' selected':''}>👩 Femme</option>
    <option value="Homme"${e&&p.type==='Homme'?' selected':''}>👨 Homme</option></select></div>
    <div><label>Réalisé <span id="prU">(sachets)</span></label><input type="number" id="prReel" value="${e?p.reel:''}" /></div></div>
    <div class="m-row"><div><label>Quota</label><input type="number" id="prQuota" value="${e?p.quota:''}" /></div><div><label>💰 Paie</label><input type="number" id="prPaie" value="${e?p.paie:''}" readonly style="font-weight:700;color:var(--accent)" /></div></div>
    <div id="prCalc" class="calc"></div>
    <label>Notes</label><textarea id="prNotes">${e?esc(p.notes||''):''}</textarea>
    <div class="m-actions"><button class="btn btn-o" onclick="closeM()">Annuler</button>
    <button class="btn btn-p" onclick="saveProd(${e?p.id:'null'})">${e?'Modifier':'Enregistrer'}</button></div>
  `);
  function upd() {
    const type=val('prType'),sec=document.getElementById('prEmpSection');
    if(type==='Femme'){
      sec.innerHTML='<label>Employées</label>'+femEmp.map(x=>`<label style="display:flex;align-items:center;gap:6px;font-weight:400;text-transform:none;font-size:13px;margin-bottom:3px;cursor:pointer"><input type="checkbox" class="prFem" value="${esc(x.name)}"${checked.includes(x.name)?' checked':''}>${esc(x.name)}</label>`).join('');
      sec.querySelectorAll('.prFem').forEach(cb=>cb.addEventListener('change',calcP));
    } else {
      const cur=e&&(p.type==='Homme'||p.type==='Autre')?(p.employes?p.employes[0]:p.employe):'';
      sec.innerHTML=`<div class="m-row"><div><label>Employé</label><select id="prEmp"><option value="">— Choisir —</option>${otherEmp.map(x=>`<option value="${esc(x.name)}"${cur===x.name?' selected':''}>${esc(x.name)}</option>`).join('')}</select></div><div><label>Manuel</label><input id="prEmpM" value="${cur&&!otherEmp.find(x=>x.name===cur)?esc(cur):''}" /></div></div>`;
    }
  }
  document.getElementById('prType').addEventListener('change',upd);upd();
  ['prShift','prType','prReel','prQuota'].forEach(id=>{
    const el=document.getElementById(id);if(el){el.addEventListener('change',calcP);el.addEventListener('input',calcP);}
  });
  calcP();
}

function calcP() {
  const shift=val('prShift')||'Jour', type=val('prType')||'Femme', reel=num('prReel');
  const u=document.getElementById('prU'); if(u)u.textContent=type==='Femme'?'(sachets)':'(balles)';
  const qi=document.getElementById('prQuota'); const pi=document.getElementById('prPaie'); const el=document.getElementById('prCalc');
  if(!qi||!pi||!el)return;
  const nbFem=type==='Femme'?document.querySelectorAll('.prFem:checked').length:0;
  if(type==='Femme'){
    const defQuota=shift==='Jour'?200*(nbFem||1)+200:null;
    if(!qi.value||qi.value==='N/A'||qi.dataset.lastNb!==String(nbFem)){qi.value=defQuota?String(defQuota):'N/A';qi.dataset.lastNb=String(nbFem);}
    if(shift==='Nuit'){
      const paieTot=2000*(nbFem||1);pi.value=paieTot;
      el.innerHTML=`<div class="r"><span>🌙 Nuit fixe</span><span class="v">2000 F/personne</span></div>
      <div class="r"><span>👩 Employées</span><span class="v">${nbFem||1}</span></div>
      <div class="r" style="font-size:15px;color:var(--accent)"><span>💰 Paie totale</span><span class="v">${paieTot.toLocaleString()} FCFA</span></div>`;
    } else {
      const quota=+qi.value||200*(nbFem||1)+200;const taux=1800;
      const paiePar=quota?Math.round((reel/quota)*taux):0;const paieTot=paiePar*(nbFem||1);const pct=quota?Math.round(reel/quota*100):0;
      pi.value=paieTot;
      el.innerHTML=`<div class="r"><span>📋 Taux</span><span class="v">1800 FCFA</span></div>
      <div class="r"><span>📐 Règle de 3</span><span class="v">${quota} sach → ${taux.toLocaleString()} F</span></div>
      <div class="r"><span>📦 ${reel}/${quota} sachets</span><span>${pct}%</span></div>
      <div class="prog"><div class="prog-f" style="width:${Math.min(pct,100)}%"></div></div>
      <div class="r"><span>💰 Paie / personne</span><span class="v">${paiePar.toLocaleString()} FCFA</span></div>
      <div class="r" style="font-size:15px;color:var(--accent)"><span>💰 Paie totale (${nbFem||1} pers)</span><span class="v">${paieTot.toLocaleString()} FCFA</span></div>`;
    }
  } else {
    if(!qi.value)qi.value='6';const quota=+qi.value||6;const taux=shift==='Jour'?389:417;const paie=reel*taux;const pct=quota?Math.round(reel/quota*100):0;
    pi.value=paie;
    el.innerHTML=`<div class="r"><span>💰 Taux</span><span class="v">${taux.toLocaleString()} F/balle</span></div>
    <div class="r"><span>🎯 ${reel}/${quota} balles</span><span>${pct}%</span></div>
    <div class="prog"><div class="prog-f" style="width:${Math.min(pct,100)}%"></div></div>
    <div class="r" style="font-size:15px;color:var(--accent)"><span>💰 Paie</span><span class="v">${paie.toLocaleString()} FCFA</span></div>`;
  }
}

function saveProd(id) {
  const date=val('prDate'), shift=val('prShift'), type=val('prType');
  let employes;
  if(type==='Femme'){
    const cbs=document.querySelectorAll('.prFem:checked');
    employes=[].map.call(cbs,c=>c.value);
    if(!employes.length)return alert('Sélectionnez au moins une employée');
  } else {
    const emp=val('prEmp')||val('prEmpM').trim()||'Employé';
    employes=[emp];
  }
  const reel=num('prReel'), quota=type==='Femme'?num('prQuota')||0:(num('prQuota')||6);
  const notes=val('prNotes').trim();
  let paie;
  if(type==='Femme'){
    const nb=employes.length;
    if(shift==='Nuit')paie=2000*nb;
    else{const q=quota||200*(nb||1)+200;paie=Math.round((reel/q)*1800)*nb;}
  } else paie=reel*(shift==='Jour'?389:417);
  if(reel<=0)return alert('Production invalide');
  if(id){const p=D.productions.find(x=>x.id===id);if(p){const oldBles=Math.floor(p.reel/50);const newBles=Math.floor(reel/50);Object.assign(p,{date,shift,employes,type,reel,quota,paie,notes});if(type==='Femme'&&newBles!==oldBles){const d=newBles-oldBles;if(d>0)D.stockE.push({id:nextId++,date,categorie:'Balles 🏀',qte:d,unite:'pièce',cout:0,desc:'Ajustement production '+reel+' sachets',createdBy:me()});else D.stockS.push({id:nextId++,date,categorie:'Balles 🏀',qte:-d,unite:'pièce',desc:'Ajustement production '+reel+' sachets',createdBy:me()});}}}
  else {
    D.productions.push({id:nextId++,date,shift,employes,type,reel,quota,paie,notes,createdBy:me()});
    if(type==='Femme'){const bles=Math.floor(reel/50);if(bles>0)D.stockE.push({id:nextId++,date,categorie:'Balles 🏀',qte:bles,unite:'pièce',cout:0,desc:'Production '+reel+' sachets',createdBy:me()});}
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
  const type=val('mType'), client=val('mClient');
  if(id){const m=D.montants.find(x=>x.id===id);if(m){m.date=val('mDate');m.montant=mt;m.desc=val('mDesc');m.type=type;m.client=client;}}
  else D.montants.push({id:nextId++,date:val('mDate'),montant:mt,desc:val('mDesc'),type,client,createdBy:me()});
  closeM();save();render();
}
function recalcDebts() {
  for(const c of D.clients){
    let debt=c.detteInit||0;
    for(const cmd of D.commandes.filter(x=>x.client===c.name))
      debt+=cmd.reste;
    for(const mt of D.montants.filter(x=>x.client===c.name&&x.type==='Dette reçue'))
      debt-=mt.montant;
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

// ─── EMPLOYÉ ───
function empForm(e) {
  const edit=!!e;
  openM(`
    <h3>${edit?'✏️ Modifier':'👷 Nouvel'} employé</h3>
    <label>Nom</label><input id="eName" value="${edit?esc(e.name):''}" />
    <div class="m-row"><div><label>Type</label><select id="eType"><option value="Femme"${edit&&e.type==='Femme'?' selected':''}>👩 Femme</option>
    <option value="Homme"${edit&&e.type==='Homme'?' selected':''}>👨 Homme</option>
    <option value="Autre"${edit&&e.type==='Autre'?' selected':''}>👤 Autre</option></select></div>
    <div><label>Téléphone</label><input id="ePhone" value="${edit?esc(e.phone||''):''}" /></div></div>
    <label>Date d'embauche</label><input type="date" id="eDate" value="${edit?e.dateEmbauche:today()}" />
    <label>Notes</label><textarea id="eNotes">${edit?esc(e.notes||''):''}</textarea>
    <div class="m-actions"><button class="btn btn-o" onclick="closeM()">Annuler</button>
    <button class="btn btn-p" onclick="saveEmp(${edit?e.id:'null'})">${edit?'Modifier':'Enregistrer'}</button></div>
  `);
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
    commandes:{data:fil('commandes',D.commandes),h:['Client','Date','Produit','Quantité','Prix total','Payé','Reste','Statut'],f:c=>[c.client,c.date,c.produit,c.qte,c.prixTotal,c.paye,c.reste,c.statut]},
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
  const cmdBalles=cmd.reduce((s,c)=>s+c.qte,0);
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
  dashCharts();
}

function dashHTML() {
  const montants=D.montants.filter(m=>inRange(m.date)), depenses=D.depenses.filter(d=>inRange(d.date));
  const prodsAll=D.productions.filter(p=>inRange(p.date));
  const totM=montants.reduce((s,m)=>s+m.montant,0), totD=depenses.reduce((s,d)=>s+d.montant,0);
  const bilan=totM-totD;
  const totalSachets=prodsAll.filter(p=>p.type==='Femme').reduce((s,p)=>s+p.reel,0);
  const totalBalles=Math.floor(totalSachets/50);
  const cmdPeriod=D.commandes.filter(c=>inRange(c.date));
  const cmdPeriodBalles=cmdPeriod.reduce((s,c)=>s+c.qte,0);
  const prods=[...prodsAll].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  const byCat={}; depenses.forEach(d=>{byCat[d.categorie]=(byCat[d.categorie]||0)+d.montant;});
  const byType={}; montants.forEach(m=>{byType[m.type]=(byType[m.type]||0)+m.montant;});

  const weekAgo=new Date();weekAgo.setDate(weekAgo.getDate()-7);
  const wkProds=D.productions.filter(p=>new Date(p.date)>=weekAgo&&p.type==='Femme');
  const wkBalles=Math.floor(wkProds.reduce((s,p)=>s+p.reel,0)/50);

  return `<h1>📊 Tableau de Bord</h1><p class="desc">Vue d'ensemble</p>
  <div class="grid" style="grid-template-columns:1fr 1fr">
    <div class="card accent tc"><div class="big">${totalBalles}</div><div class="lbl">🏀 Balles produites</div></div>
    <div class="card tc"><div class="big">${cmdPeriodBalles}</div><div class="lbl">📦 Balles vendues</div></div>
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
  return `<h1>👥 Clients & Dettes</h1><p class="desc">Suivi des clients et dettes</p>
  <div class="toolbar"><button class="btn btn-p" onclick="clientForm()">+ Ajouter</button></div>
  <div class="table-wrap"><table><thead><tr><th>Client</th><th>Tél</th><th>Dette init.</th><th>Dette actuelle</th><th>Progression</th><th>Actions</th></tr></thead>
  <tbody>${D.clients.length?D.clients.map(c=>{
    const pct=c.detteInit?Math.round(((c.detteInit-(c.detteCur||0))/c.detteInit)*100):0;
    return `<tr><td><strong>${esc(c.name)}</strong></td><td>${esc(c.phone||'—')}</td><td>${fmt(c.detteInit)}</td>
    <td style="color:${(c.detteCur||0)>0?'var(--red)':'var(--green)'}">${fmt(c.detteCur||0)}</td>
    <td><div class="prog" style="width:80px;display:inline-block;vertical-align:middle;margin-right:6px"><div class="prog-f" style="width:${pct}%;background:${pct>=100?'var(--green)':'var(--amber)'}"></div></div>${pct}%</td>
    <td class="gap-4"><button class="btn btn-sm btn-gh" onclick="clientForm(D.clients.find(x=>x.id===${c.id}))"><i class="ti ti-pencil"></i></button>
    <button class="btn btn-sm btn-g" onclick="payerDette(${c.id})"><i class="ti ti-cash"></i></button>
    <button class="btn btn-sm btn-r" onclick="confirmDel('Supprimer ce client?','clients',D.clients.find(x=>x.id===${c.id}))"><i class="ti ti-trash"></i></button></td></tr>`;
  }).join(''):'<tr><td colspan="6" class="empty">Aucun client</td></tr>'}</tbody></table></div>`;
}

function commandesHTML() {
  const cmdList=D.commandes.filter(c=>inRange(c.date));
  return `<h1>🛒 Commandes</h1><p class="desc">Suivi des commandes clients. ${!filterRange.start&&!filterRange.end?'':cmdList.length+' sur la période'}</p>
  <div class="toolbar"><button class="btn btn-p" onclick="commandeForm()">+ Nouvelle</button></div>
  <div class="table-wrap"><table><thead><tr><th>Client</th><th>Produit</th><th>Qté</th><th>Total</th><th>✅ Payé</th><th>⏳ Reste</th><th>Statut</th><th>Actions</th></tr></thead>
  <tbody>${cmdList.length?[...cmdList].sort((a,b)=>b.date.localeCompare(a.date)).map(c=>{
    const r=c.prixTotal-c.paye;
    return `<tr><td>${esc(c.client)}<br><span class="fs">${esc(c.date)}</span></td><td>${esc(c.produit)}</td><td>${esc(c.qte)}</td>
    <td><strong>${fmt(c.prixTotal)}</strong></td><td style="color:var(--green)">${fmt(c.paye)}</td>
    <td style="color:${r>0?'var(--red)':'var(--green)'}">${fmt(r)}</td>
    <td><span class="badge ${c.statut==='Livrée'?'bg-g':c.statut==='Annulée'?'bg-r':'bg-y'}">${esc(c.statut)}</span></td>
    <td class="gap-4"><button class="btn btn-sm btn-gh" onclick="commandeForm(D.commandes.find(x=>x.id===${c.id}))"><i class="ti ti-pencil"></i></button>
    ${r>0?`<button class="btn btn-sm btn-g" onclick="payerCmd(${c.id})"><i class="ti ti-cash"></i></button>`:''}
    <button class="btn btn-sm btn-r" onclick="confirmDel('Supprimer cette commande?','commandes',D.commandes.find(x=>x.id===${c.id}))"><i class="ti ti-trash"></i></button></td></tr>`;
  }).join(''):'<tr><td colspan="8" class="empty">Aucune commande</td></tr>'}</tbody></table></div>`;
}

// Week calculation
function getWeek(d){const t=new Date(d);t.setHours(0,0,0,0);t.setDate(t.getDate()+3-(t.getDay()+6)%7);return Math.ceil(((t-new Date(t.getFullYear(),0,4))/86400000+1)/7);}
function weekRange(w,y){const d=new Date(y,0,1+((w-1)*7));d.setDate(d.getDate()+(1-d.getDay()+7)%7-3);return d;}
let curWeek=0, curYear=0;

function prodHTML() {
  if(!curWeek){const n=new Date();curWeek=getWeek(n);curYear=n.getFullYear();}
  const wStart=weekRange(curWeek,curYear);wStart.setHours(0,0,0,0);
  const wEnd=new Date(wStart);wEnd.setDate(wEnd.getDate()+6);
  const fmtD=d=>d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
  const prods=D.productions.filter(p=>{
    const d=new Date(p.date);return d>=wStart&&d<=wEnd;
  });
  const empPaie={};
  prods.forEach(p=>{const emps=prodEmps(p),s=p.type==='Femme'?Math.round(p.paie/emps.length):p.paie;emps.forEach(n=>{empPaie[n]=(empPaie[n]||0)+s;});});
  const stats=prods.reduce((a,p)=>{a.paie+=p.paie;if(p.type==='Femme')a.sachets+=p.reel;return a;},{paie:0,sachets:0});
  const balles=Math.floor(stats.sachets/50);

  return `<h1>🏭 Production</h1><p class="desc">Semaine du ${fmtD(wStart)} au ${fmtD(wEnd)}</p>
  <div class="week-nav">
    <button onclick="curWeek--;if(curWeek<1){curWeek=52;curYear--}render()">←</button>
    <div><div class="wn-label">Semaine ${curWeek} — ${curYear}</div><div class="wn-sub">${fmtD(wStart)} → ${fmtD(wEnd)}</div></div>
    <button onclick="curWeek++;if(curWeek>52){curWeek=1;curYear++}render()">→</button>
    <button onclick="{const n=new Date();curWeek=getWeek(n);curYear=n.getFullYear();render()}">📅 Aujourd'hui</button>
    <span class="sp"></span><button class="btn btn-p" onclick="prodForm()">+ Ajouter</button>
  </div>
  <div class="grid">
    <div class="card accent"><div class="big">${balles}</div><div class="lbl">🏀 Balles produites</div></div>
    <div class="card"><div class="big">${stats.sachets}</div><div class="lbl">📦 Sachets (femmes)</div></div>
    <div class="card"><div class="big" style="color:var(--green)">${fmt(stats.paie)}</div><div class="lbl">💰 Paies semaine</div></div>
    <div class="card"><div class="big">${prods.length}</div><div class="lbl">📋 Entrées total</div></div>
  </div>
  ${Object.keys(empPaie).length?`<div class="card mb-12"><h2>💳 Paies par employé</h2>${Object.entries(empPaie).map(([name,paie])=>`
    <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:13px">
      <span>${esc(name)}</span><span style="font-weight:600">${fmt(paie)}</span></div>`).join('')}</div>`:''}
  <div class="table-wrap"><table><thead><tr><th>Date</th><th>Employé</th><th>Shift</th><th>Type</th><th>Quota</th><th>Réel</th><th>🏀 Balles</th><th>Écart</th><th>💰 Paie</th><th></th></tr></thead>
  <tbody>${prods.length?[...prods].sort((a,b)=>b.date.localeCompare(a.date)).map(p=>{
    const ec=p.reel-p.quota;
    return `<tr><td>${esc(p.date)}</td><td>${esc(prodEmps(p).join(', '))}</td><td><span class="badge ${p.shift==='Jour'?'bg-y':'bg-b'}">${esc(p.shift)}</span></td>
    <td><span class="badge ${p.type==='Femme'?'bg-k':'bg-b'}">${esc(p.type)}</span></td><td>${esc(p.quota)}</td>
    <td style="font-weight:600">${esc(p.reel)}</td><td>${p.type==='Femme'?Math.floor(p.reel/50):'—'}</td><td style="color:${ec>=0?'var(--green)':'var(--red)'}">${ec>=0?'+':''}${ec}</td>
    <td style="font-weight:600;color:var(--accent)">${fmt(p.paie)}</td>
    <td><button class="btn btn-sm btn-r" onclick="confirmDel('Supprimer cette production?','productions',D.productions.find(x=>x.id===${p.id}))"><i class="ti ti-trash"></i></button></td></tr>`;
  }).join(''):'<tr><td colspan="10" class="empty">Aucune production cette semaine</td></tr>'}</tbody></table></div>`;
}

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
  // Balles calculées depuis les données réelles (productions - commandes)
  const prodBalles=D.productions.filter(p=>p.type==='Femme').reduce((s,p)=>s+Math.floor(p.reel/50),0);
  const cmdBalles=D.commandes.reduce((s,c)=>s+c.qte,0);
  cur['Balles 🏀']=prodBalles-cmdBalles;
  return `<h1>📦 Stock</h1><p class="desc">Gestion des entrées et sorties</p>
  <div class="toolbar"><button class="btn btn-p" onclick="stockForm('E')">+ Entrée</button><button class="btn btn-o" onclick="stockForm('S')">- Sortie</button></div>
  <div class="grid">${STK.map(c=>`<div class="card" style="text-align:center;padding:.7rem">
    <div class="big" style="font-size:20px;color:${(cur[c]||0)>=0?'var(--green)':'var(--red)'}">${cur[c]||0}</div>
    <div class="lbl" style="font-size:10px">${c}</div></div>`).join('')}</div>
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
  return `<h1>👷 Employés</h1><p class="desc">Registre et suivi des paies</p>
  <div class="toolbar"><button class="btn btn-p" onclick="empForm()">+ Ajouter</button></div>
  <div class="table-wrap mb-12"><table><thead><tr><th>Nom</th><th>Type</th><th>💰 Paie gagnée</th><th>↩️ Retiré</th><th>🏦 Solde</th><th>Actions</th></tr></thead>
  <tbody>${empData.length?empData.map(e=>`<tr><td><strong>${esc(e.name)}</strong></td>
  <td><span class="badge ${e.type==='Femme'?'bg-k':e.type==='Homme'?'bg-b':'bg-n'}">${e.type}</span></td>
  <td style="font-weight:600;color:var(--accent)">${fmt(e.paie)}</td><td>${fmt(e.retire)}</td>
  <td style="font-weight:600;color:${e.solde>0?'var(--green)':'var(--text3)'}">${fmt(e.solde)}</td>
  <td class="gap-4"><button class="btn btn-sm btn-gh" onclick="empForm(D.employes.find(x=>x.id===${e.id}))"><i class="ti ti-pencil"></i></button>
  <button class="btn btn-sm btn-g" onclick="retraitForm(${e.id})"><i class="ti ti-cash"></i></button>
  <button class="btn btn-sm btn-r" onclick="confirmDel('Supprimer cet employé?','employes',D.employes.find(x=>x.id===${e.id}))"><i class="ti ti-trash"></i></button></td></tr>`).join(''):'<tr><td colspan="6" class="empty">Aucun employé</td></tr>'}</tbody></table></div>
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
  <div class="card mt-12"><h2>Aperçu</h2><pre style="font-size:11px;max-height:300px;overflow:auto;background:var(--bg);padding:10px;border-radius:8px">${JSON.stringify(D,null,2).slice(0,2000)}...</pre></div>`;
}

function corbeilleHTML() {
  const items=[...D.trash].sort((a,b)=>b.deletedAt-a.deletedAt);
  const S=7*86400000;
  return `<h1>🗑️ Corbeille</h1><p class="desc">Rétention 7 jours avant suppression définitive</p>
  <div class="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Contenu</th><th>Motif</th><th>Supprimé par</th><th>Suppression dans</th><th>Actions</th></tr></thead>
  <tbody>${items.length?items.map(t=>{const r=Math.max(0,S-(Date.now()-t.deletedAt));const j=Math.ceil(r/86400000);const nm=t.content.name||t.content.client||t.content.desc||t.content.detail||t.content.produit||'(?)';
  return `<tr><td>${new Date(t.deletedAt).toLocaleDateString('fr-FR')}</td><td><span class="badge bg-n">${t.type}</span></td>
  <td>${esc(nm).slice(0,40)}</td><td>${esc(t.motif||'').slice(0,30)}</td><td>${esc(t.createdBy||'—').slice(0,20)}</td><td>${j}j</td>
  <td class="gap-4"><button class="btn btn-sm btn-g" onclick="restoreT(${t.id})">Restaurer</button>
  <button class="btn btn-sm btn-r" onclick="D.trash=D.trash.filter(x=>x.id!==${t.id});save();render()">Effacer</button></td></tr>`;}).join(''):'<tr><td colspan="7" class="empty">Corbeille vide</td></tr>'}</tbody></table></div>
  <p class="fs mt-8"><i class="ti ti-info-circle"></i> Les éléments sont automatiquement supprimés après 7 jours.</p>`;
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
  dashCharts();
});
