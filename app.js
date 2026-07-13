// --- DATA STORE ---
var CURRENT_ROLE = '';
var CAN_SAISIE = true;
const STORE = { engins: [], personnel: [], saisies: [], affectations: [], pannes: [], maintenance: [], carburant: [], tarifs: [], pneuTarifs: [], users: [], budgets: [] };
const charts = {};
var _pneuMarqueMap = {};
function uid() { return '_' + Math.random().toString(36).substr(2, 9); }
// --- FIREBASE HELPERS ---
var FB_DOC = 'parc_engins';
var FB_COLLECTION = 'gestion_parc';

function fbShowStatus(msg, ok) {
  var el = document.getElementById('fbStatus');
  if (!el) return;
  el.textContent = (ok ? '✔ ' : '⚠ ') + msg;
  el.style.display = 'block';
  el.style.color = ok ? '#d4af37' : '#f56565';
  clearTimeout(el._t);
  el._t = setTimeout(function() { el.style.display = 'none'; }, 3000);
}

function saveData() {
  localStorage.setItem('parcEngins', JSON.stringify(STORE));
  if (typeof db === 'undefined') return;
  db.collection(FB_COLLECTION).doc(FB_DOC).set({
    engins: STORE.engins,
    personnel: STORE.personnel,
    saisies: STORE.saisies,
    affectations: STORE.affectations,
    pannes: STORE.pannes,
    maintenance: STORE.maintenance,
    carburant: STORE.carburant,
    tarifs: STORE.tarifs,
    pneuTarifs: STORE.pneuTarifs,
    users: STORE.users,
    budgets: STORE.budgets,
    lastUpdate: new Date().toISOString()
  }).then(function() {
    fbShowStatus('Données sauvegardées', true);
  }).catch(function(err) {
    console.error('Firebase save error:', err);
    fbShowStatus('Erreur sauvegarde Firebase', false);
  });
}

function loadData() {
  var localFallback = function() {
    var d = localStorage.getItem('parcEngins');
    if (d) {
      var p = JSON.parse(d);
      STORE.engins = p.engins || []; STORE.personnel = p.personnel || [];
      STORE.saisies = p.saisies || []; STORE.affectations = p.affectations || [];
      STORE.pannes = p.pannes || []; STORE.maintenance = p.maintenance || [];
      STORE.carburant = p.carburant || []; STORE.tarifs = p.tarifs || []; STORE.pneuTarifs = p.pneuTarifs || [];
      STORE.users = p.users || []; STORE.budgets = p.budgets || [];
    }
  };
  if (typeof db === 'undefined') {
    localFallback();
    return Promise.resolve();
  }
  return db.collection(FB_COLLECTION).doc(FB_DOC).get()
    .then(function(doc) {
      if (doc.exists) {
        var data = doc.data();
        STORE.engins = data.engins || []; STORE.personnel = data.personnel || [];
        STORE.saisies = data.saisies || []; STORE.affectations = data.affectations || [];
        STORE.pannes = data.pannes || []; STORE.maintenance = data.maintenance || [];
        STORE.carburant = data.carburant || []; STORE.tarifs = data.tarifs || []; STORE.pneuTarifs = data.pneuTarifs || [];
        STORE.users = data.users || []; STORE.budgets = data.budgets || [];
        localStorage.setItem('parcEngins', JSON.stringify(STORE));
        fbShowStatus('Firebase connecté', true);
      } else {
        localFallback();
      }
    })
    .catch(function(err) {
      console.error('Firebase load error:', err);
      fbShowStatus('Mode hors-ligne (localStorage)', false);
      localFallback();
    });
}

// --- AUTH ---
function doLogin() {
  var u = document.getElementById('loginUser').value.trim();
  var p = document.getElementById('loginPass').value;
  if (u === 'admin' && p === 'admin') {
    sessionStorage.setItem('user', JSON.stringify({ user: u, role: 'admin', canConsult: true, canSaisie: true }));
    document.getElementById('loginError').style.display = 'none';
    showApp(u, 'admin', true, true);
    return;
  }
  var found = STORE.users.find(function(usr) { return usr.username === u && usr.password === p; });
  if (found) {
    var sess = { user: u, role: 'user', canConsult: found.canConsult !== false, canSaisie: found.canSaisie !== false };
    sessionStorage.setItem('user', JSON.stringify(sess));
    document.getElementById('loginError').style.display = 'none';
    showApp(u, 'user', sess.canConsult, sess.canSaisie);
    return;
  }
  document.getElementById('loginError').style.display = 'block';
}
function doLogout() { CURRENT_ROLE = ''; CAN_SAISIE = true; sessionStorage.removeItem('user'); document.getElementById('appScreen').style.display = 'none'; document.getElementById('loginScreen').style.display = 'flex'; }
function checkAuth() {
  var overlay = document.getElementById('loadingOverlay');
  try {
    const s = sessionStorage.getItem('user');
    if (s) {
      const u = JSON.parse(s);
      showApp(u.user, u.role, u.canConsult !== false, u.canSaisie !== false);
    } else {
      if (overlay) overlay.style.display = 'none';
    }
  } catch(e) {
    sessionStorage.removeItem('user');
    if (overlay) overlay.style.display = 'none';
    console.warn('Session invalide, réinitialisée.', e);
  }
}
function showApp(user, role, canConsult, canSaisie) {
  CURRENT_ROLE = role;
  if (canConsult === undefined) canConsult = true;
  if (canSaisie === undefined) canSaisie = true;
  CAN_SAISIE = (role === 'admin') || (canSaisie === true);
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appScreen').style.display = 'block';
  var permsLabel = role === 'admin' ? 'Admin' : [
    canConsult ? 'Consultation' : '',
    canSaisie  ? 'Saisie'       : ''
  ].filter(Boolean).join(' + ') || 'Lecture seule';
  document.getElementById('userName').textContent = user + ' — ' + permsLabel;
  initApp();
  applyRolePermissions(role, canConsult, canSaisie);
}
function applyRolePermissions(role, canConsult, canSaisie) {
  var isAdmin = (role === 'admin');
  var canC = isAdmin || (canConsult !== false);
  CAN_SAISIE = isAdmin || (canSaisie === true);
  document.querySelectorAll('.admin-only').forEach(function(el) { el.style.display = isAdmin ? '' : 'none'; });
  document.querySelectorAll('.saisie-only').forEach(function(el) { el.style.display = CAN_SAISIE ? '' : 'none'; });
  document.body.classList.toggle('no-saisie', !CAN_SAISIE);
  // Restrict nav based on canConsult
  var consultSections = ['extraction','rapport','mensuel','suiviPneus','affectations'];
  var saisieOnly = ['saisie'];
  document.querySelectorAll('aside nav .nav-link').forEach(function(el) {
    var oc = el.getAttribute('onclick')||'';
    var inConsult = consultSections.some(function(s){return oc.indexOf("'"+s+"'")+oc.indexOf('"'+s+'"')>-2;});
    var inSaisie  = saisieOnly.some(function(s){return oc.indexOf("'"+s+"'")+oc.indexOf('"'+s+'"')>-2;});
    if (!isAdmin) {
      if (inConsult && !canC) { el.style.opacity='0.3'; el.style.pointerEvents='none'; el.title='Accès non autorisé'; }
      else if (inSaisie && !CAN_SAISIE) { el.style.opacity='0.3'; el.style.pointerEvents='none'; el.title='Saisie non autorisée'; }
      else { el.style.opacity=''; el.style.pointerEvents=''; el.title=''; }
    }
  });
}

// --- NAV ---
function navTo(id, el) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  if (el) el.classList.add('active');
  if (id === 'dashboard') updateDashboard();
  if (id === 'rapports') updateRapports();
  if (id === 'mensuel') { initMensuel(); loadMensuel(); }
  if (id === 'admin') updateAdmin();
  if (id === 'suiviPneus') navToSuiviPneus();
  if (id === 'maintenance') {
    updateMaintSelects();
    var _now = new Date(), _y = _now.getFullYear(), _m = ('0'+(_now.getMonth()+1)).slice(-2);
    var _last = new Date(_y, _now.getMonth()+1, 0).getDate();
    var _fd = document.getElementById('maintFilterDeb'), _ff = document.getElementById('maintFilterFin');
    if (_fd && !_fd.value) _fd.value = _y+'-'+_m+'-01';
    if (_ff && !_ff.value) _ff.value = _y+'-'+_m+'-'+('0'+_last).slice(-2);
    renderMaintenance();
  }
  if (id === 'planningEntretien') renderPlanningEntretien();
  if (window.innerWidth < 768) toggleSidebar(true);
}
function toggleSidebar(forceClose) {
  const sb = document.getElementById('sidebar');
  const mc = document.getElementById('mainContent');
  if (forceClose === true) { sb.classList.remove('show'); }
  else { sb.classList.toggle('show'); }
}

// --- PERMISSION HELPER ---
function saisieBtn(editCall, deleteCall) {
  if (!CAN_SAISIE) return '';
  return '<button class="btn btn-sm btn-outline-light btn-sm-action" onclick="'+editCall+'"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-danger btn-sm-action" onclick="'+deleteCall+'"><i class="bi bi-trash"></i></button>';
}

// --- ENGINS ---
function renderEngins() {
  document.getElementById('enginsTable').innerHTML = STORE.engins.map(function(x) {
    var cl = x.statut === 'En service' ? 'status-service' : x.statut === 'En panne' ? 'status-panne' : x.statut === 'Maintenance' ? 'status-maintenance' : 'status-magasin';
    return '<tr><td>'+x.designation+'</td><td>'+x.immatriculation+'</td><td>'+x.type+'</td><td>'+x.marque+'</td><td>'+x.modele+'</td><td>'+x.serie+'</td><td>'+x.dateMec+'</td><td><span class="badge-status '+cl+'">'+x.statut+'</span></td><td>'+x.compteur+'</td><td><button class="btn btn-sm btn-outline-light btn-sm-action" onclick="editEngin(\''+x.id+'\')"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-danger btn-sm-action" onclick="deleteEngin(\''+x.id+'\')"><i class="bi bi-trash"></i></button></td></tr>';
  }).join('');
}
function openEnginModal() {
  document.getElementById('enginId').value = '';
  ['eDesignation','eImmat','eType','eMarque','eModele','eSerie','eDateMec','eCompteur'].forEach(function(id) { document.getElementById(id).value = ''; });
  document.getElementById('eStatut').value = 'En service';
  new bootstrap.Modal(document.getElementById('enginModal')).show();
}
function saveEngin() {
  var id = document.getElementById('enginId').value || uid();
  var obj = { id:id, designation:document.getElementById('eDesignation').value, immatriculation:document.getElementById('eImmat').value, type:document.getElementById('eType').value, marque:document.getElementById('eMarque').value, modele:document.getElementById('eModele').value, serie:document.getElementById('eSerie').value, dateMec:document.getElementById('eDateMec').value, statut:document.getElementById('eStatut').value, compteur:+document.getElementById('eCompteur').value||0 };
  var idx = STORE.engins.findIndex(function(e) { return e.id === id; });
  if (idx >= 0) STORE.engins[idx] = obj; else STORE.engins.push(obj);
  saveData(); renderEngins(); updateSelects(); bootstrap.Modal.getInstance(document.getElementById('enginModal')).hide();
}
function editEngin(id) {
  var x = STORE.engins.find(function(e) { return e.id === id; }); if (!x) return;
  document.getElementById('enginId').value = x.id;
  document.getElementById('eDesignation').value = x.designation;
  document.getElementById('eImmat').value = x.immatriculation;
  document.getElementById('eType').value = x.type;
  document.getElementById('eMarque').value = x.marque;
  document.getElementById('eModele').value = x.modele;
  document.getElementById('eSerie').value = x.serie;
  document.getElementById('eDateMec').value = x.dateMec;
  document.getElementById('eStatut').value = x.statut;
  document.getElementById('eCompteur').value = x.compteur;
  new bootstrap.Modal(document.getElementById('enginModal')).show();
}
function deleteEngin(id) { if (confirm('Supprimer cet engin ?')) { STORE.engins = STORE.engins.filter(function(e) { return e.id !== id; }); saveData(); renderEngins(); updateSelects(); } }

// --- PERSONNEL ---
function renderPersonnel() {
  document.getElementById('personnelTable').innerHTML = STORE.personnel.map(function(x) {
    return '<tr><td>'+x.nom+'</td><td>'+x.prenom+'</td><td>'+x.fonction+'</td><td>'+x.equipe+'</td><td>'+x.telephone+'</td><td>'+(x.affectation||'-')+'</td><td>'+x.dateEmb+'</td><td><button class="btn btn-sm btn-outline-light btn-sm-action" onclick="editPersonnel(\''+x.id+'\')"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-danger btn-sm-action" onclick="deletePersonnel(\''+x.id+'\')"><i class="bi bi-trash"></i></button></td></tr>';
  }).join('');
}
function openPersonnelModal() {
  document.getElementById('personnelId').value = '';
  ['pNom','pPrenom','pTel','pDateEmb'].forEach(function(id) { document.getElementById(id).value = ''; });
  document.getElementById('pFonction').selectedIndex = 0;
  document.getElementById('pEquipe').selectedIndex = 0;
  document.getElementById('pAffectation').value = '';
  new bootstrap.Modal(document.getElementById('personnelModal')).show();
}
function savePersonnel() {
  var id = document.getElementById('personnelId').value || uid();
  var obj = { id:id, nom:document.getElementById('pNom').value, prenom:document.getElementById('pPrenom').value, fonction:document.getElementById('pFonction').value, equipe:document.getElementById('pEquipe').value, telephone:document.getElementById('pTel').value, affectation:document.getElementById('pAffectation').value, dateEmb:document.getElementById('pDateEmb').value };
  var idx = STORE.personnel.findIndex(function(p) { return p.id === id; });
  if (idx >= 0) STORE.personnel[idx] = obj; else STORE.personnel.push(obj);
  saveData(); renderPersonnel(); updateSelects(); bootstrap.Modal.getInstance(document.getElementById('personnelModal')).hide();
}
function editPersonnel(id) {
  var x = STORE.personnel.find(function(p) { return p.id === id; }); if (!x) return;
  document.getElementById('personnelId').value = x.id;
  document.getElementById('pNom').value = x.nom; document.getElementById('pPrenom').value = x.prenom;
  document.getElementById('pFonction').value = x.fonction; document.getElementById('pEquipe').value = x.equipe;
  document.getElementById('pTel').value = x.telephone; document.getElementById('pAffectation').value = x.affectation || '';
  document.getElementById('pDateEmb').value = x.dateEmb;
  new bootstrap.Modal(document.getElementById('personnelModal')).show();
}
function deletePersonnel(id) { if (confirm('Supprimer ?')) { STORE.personnel = STORE.personnel.filter(function(p) { return p.id !== id; }); saveData(); renderPersonnel(); updateSelects(); } }

// --- SELECTS ---
function updateSelects() {
  var eSel = document.getElementById('sEngin');
  var pAff = document.getElementById('pAffectation');
  var cSel = document.getElementById('sConducteur');
  var mSel = document.getElementById('sMecanicien');
  eSel.innerHTML = '<option value="">-- Choisir --</option>' + STORE.engins.map(function(e) { return '<option value="'+e.id+'">'+e.designation+' ('+e.immatriculation+')</option>'; }).join('');
  pAff.innerHTML = '<option value="">-- Aucun --</option>' + STORE.engins.map(function(e) { return '<option value="'+e.designation+'">'+e.designation+'</option>'; }).join('');
  cSel.innerHTML = '<option value="">-- Choisir --</option>' + STORE.personnel.map(function(p) { return '<option value="'+p.id+'">'+p.nom+' '+p.prenom+'</option>'; }).join('');
  if (mSel) mSel.innerHTML = '<option value="">-- Choisir --</option>' + STORE.personnel.filter(function(p) { return p.fonction === 'Mécanicien'; }).map(function(p) { return '<option value="'+p.id+'">'+p.nom+' '+p.prenom+'</option>'; }).join('');
}
function updateFilterSelects() {
  document.getElementById('filtreEngin').innerHTML = '<option value="">Tous engins</option>' + STORE.engins.map(function(e) { return '<option value="'+e.id+'">'+e.designation+'</option>'; }).join('');
  document.getElementById('filtreOperateur').innerHTML = '<option value="">Tous opérateurs</option>' + STORE.personnel.map(function(p) { return '<option value="'+p.id+'">'+p.nom+' '+p.prenom+'</option>'; }).join('');
}

// --- SAISIE JOURNALIERE ---
var saisieNavIdx = -1; // -1 = new

function renderSaisies(list) {
  var data = list || STORE.saisies;
  document.getElementById('saisieTable').innerHTML = data.sort(function(a,b) { return (b.dateDebut||'')>(a.dateDebut||'')?1:-1; }).map(function(x) {
    var eng = STORE.engins.find(function(e) { return e.id === x.enginId; });
    var totalHuile = (x.huiles||[]).reduce(function(a,h) { return a + (h.qte||0); }, 0);
    var hasIncident = (x.huiles||[]).some(function(h){ return h.incident; });
    var huileCell = totalHuile.toFixed(1) + (hasIncident ? ' <span title="Incident huile déclaré" style="color:#dc3545;font-size:.8rem"><i class="bi bi-exclamation-triangle-fill"></i></span>' : '');
    return '<tr'+(hasIncident?' style="border-left:3px solid #dc3545"':'')+'>'+
      '<td>'+(x.dateDebut||'-')+'</td><td>'+(eng?eng.designation.substring(0,20):'-')+'</td><td>'+(x.compteurDebut||'-')+'</td><td>'+(x.compteurFin||'-')+'</td><td><strong>'+(x.difference||'-')+'</strong></td><td>'+(x.mlf>0?(x.mlf+' m'):'-')+'</td><td>'+(x.gasoil||0)+'</td><td>'+huileCell+'</td><td>'+(x.nbArrets||0)+'</td><td>'+(x.heurePanne||0)+'</td><td><button class="btn btn-sm btn-outline-info btn-sm-action" onclick="showDetail(\''+x.id+'\')"><i class="bi bi-eye"></i></button> <button class="btn btn-sm btn-outline-light btn-sm-action" onclick="editSaisie(\''+x.id+'\')"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-danger btn-sm-action" onclick="deleteSaisie(\''+x.id+'\')"><i class="bi bi-trash"></i></button></td></tr>';
  }).join('');
}

function calcCompteur() {
  var d = (+document.getElementById('sCompteurFin').value||0) - (+document.getElementById('sCompteurDebut').value||0);
  document.getElementById('sDifference').value = d >= 0 ? d.toFixed(1) : '0';
  updateEntretienInfo();
}
function autoFillCompteurDebut() {
  var enginId = document.getElementById('sEngin').value;
  var saisieId = document.getElementById('saisieId').value;
  if (saisieId) return;
  if (!enginId) { document.getElementById('sCompteurDebut').value = ''; calcCompteur(); return; }
  var enginSaisies = STORE.saisies.filter(function(s) { return s.enginId === enginId; });
  if (!enginSaisies.length) return;
  enginSaisies.sort(function(a, b) { return (b.dateDebut||'') > (a.dateDebut||'') ? 1 : -1; });
  var last = enginSaisies[0];
  if (last && last.compteurFin != null && last.compteurFin !== '') {
    document.getElementById('sCompteurDebut').value = last.compteurFin;
    calcCompteur();
  }
}
var ENTRETIEN_CYCLE = ['250','500','750','1000'];
function getEntretienTypeStyle(type) {
  var s = {
    '250':  {bg:'#0d3b1a', color:'#5adb7a', border:'#28a745', label:'250h — Vidange'},
    '500':  {bg:'#0d2a4a', color:'#5bc8ff', border:'17a2b8',  label:'500h — Filtres'},
    '750':  {bg:'#2a0d4a', color:'#c084fc', border:'#7c3aed', label:'750h — Vidange+'},
    '1000': {bg:'#3b2c00', color:'#d4af37', border:'#ffc107', label:'1000h — Révision'}
  };
  return s[type] || {bg:'#1a1a1a', color:'#888', border:'#444', label:'?h'};
}
function getEnginEntretienHistory(enginId) {
  var hist = [];
  STORE.saisies.forEach(function(s) {
    if (s.enginId === enginId && s.entretienFait && s.entretienCompteur)
      hist.push({cpt: +s.entretienCompteur, type: s.entretienFait, date: s.dateDebut || ''});
  });
  hist = hist.filter(function(v,i,a){ return a.findIndex(function(x){return x.cpt===v.cpt;})===i; });
  hist.sort(function(a,b){ return a.cpt - b.cpt; });
  var lastType = hist.length > 0 ? (hist[hist.length-1].type || '') : '';
  var lastIdx  = ENTRETIEN_CYCLE.indexOf(lastType);
  var nextType = ENTRETIEN_CYCLE[(lastIdx + 1) % ENTRETIEN_CYCLE.length];
  var lastAt   = hist.length > 0 ? hist[hist.length-1].cpt : 0;
  return {hist: hist, lastAt: lastAt, nextAt: lastAt + 250, lastType: lastType, nextType: nextType};
}
function updateEntretienInfo() {
  var enginId = document.getElementById('sEngin').value;
  var compteur = +document.getElementById('sCompteurFin').value || 0;
  var el = document.getElementById('entretienInfo');
  if (!el) return;
  if (!enginId) {
    el.style.cssText = 'background:#100e00;font-size:.85rem;color:#9a8f6a;border-left:none';
    el.innerHTML = '<i class="bi bi-info-circle"></i> Sélectionnez un engin pour voir l\'état d\'entretien.';
    return;
  }
  var eng = STORE.engins.find(function(e) { return e.id === enginId; });
  if (!compteur && eng) compteur = eng.compteur || 0;
  if (!compteur) {
    el.style.cssText = 'background:#100e00;font-size:.85rem;color:#9a8f6a;border-left:none';
    el.innerHTML = '<i class="bi bi-info-circle"></i> Saisissez le compteur fin pour calculer le prochain entretien.';
    return;
  }
  var eh = getEnginEntretienHistory(enginId);
  var lastEntretienAt = eh.lastAt;
  var nextEntretienAt = eh.nextAt;
  var nextType        = eh.nextType;
  var remaining = +(nextEntretienAt - compteur).toFixed(1);
  var dernierLabel = lastEntretienAt ? lastEntretienAt + 'h (' + (eh.lastType||'?') + 'h)' : 'Aucun enregistré';
  // --- Badges historique avec couleurs par type de service ---
  var ntc = getEntretienTypeStyle(nextType);
  var milestonesHtml = '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:8px;align-items:center">';
  eh.hist.forEach(function(e, idx) {
    var tc = getEntretienTypeStyle(e.type);
    milestonesHtml += '<div style="background:'+tc.bg+';color:'+tc.color+';border:1px solid '+tc.border+';border-radius:7px;padding:4px 10px;text-align:center;font-size:.77rem">';
    milestonesHtml += '<div style="font-size:.7rem"><i class="bi bi-check-lg"></i></div>';
    milestonesHtml += '<div style="font-weight:800">'+e.cpt+'h</div>';
    milestonesHtml += '<div style="font-size:.6rem;opacity:.85">'+e.type+'h svc</div>';
    milestonesHtml += '</div>';
    milestonesHtml += '<span style="color:#333;font-size:.7rem">+250h</span>';
  });
  // Badge prochain avec couleur du type suivant dans le cycle
  var alertBg = remaining < 0 ? 'background:#3b0d0d;color:#ff6b6b;border:2px solid #dc3545'
              : remaining <= 50 ? 'background:#3b2e00;color:#ffc107;border:2px solid #ffc107'
              : 'background:'+ntc.bg+';color:'+ntc.color+';border:2px solid '+ntc.border;
  var iconNext = remaining < 0 ? '<i class="bi bi-exclamation-triangle-fill"></i>'
               : remaining <= 50 ? '<i class="bi bi-exclamation-circle-fill"></i>'
               : '<i class="bi bi-arrow-right-circle-fill"></i>';
  var subNext = remaining < 0 ? 'DÉPASSÉ' : remaining <= 50 ? 'IMMINENT' : 'Svc '+nextType+'h';
  milestonesHtml += '<div style="'+alertBg+';border-radius:7px;padding:4px 10px;text-align:center;font-size:.77rem">';
  milestonesHtml += '<div style="font-size:.7rem">'+iconNext+'</div>';
  milestonesHtml += '<div style="font-weight:800">'+nextEntretienAt+'h</div>';
  milestonesHtml += '<div style="font-size:.6rem;opacity:.85">'+subNext+'</div>';
  milestonesHtml += '</div>';
  milestonesHtml += '</div>';
  // Mini indicateur du cycle courant 250→500→750→1000→↩
  var cycleHtml = '<div style="display:flex;gap:3px;margin-top:5px;align-items:center;flex-wrap:wrap">';
  cycleHtml += '<span style="font-size:.65rem;color:#666;margin-right:3px">Cycle :</span>';
  ENTRETIEN_CYCLE.forEach(function(t, i) {
    var tc2 = getEntretienTypeStyle(t);
    var isNext = (t === nextType);
    var sty = isNext
      ? 'background:'+tc2.bg+';color:'+tc2.color+';border:2px solid '+tc2.border+';font-weight:800'
      : 'background:#111;color:#444;border:1px solid #222';
    cycleHtml += '<span style="'+sty+';border-radius:4px;padding:1px 6px;font-size:.7rem">'+(isNext?'→ ':'')+t+'h</span>';
    if (i < 3) cycleHtml += '<span style="color:#333;font-size:.65rem">→</span>';
  });
  cycleHtml += '<span style="color:#555;font-size:.65rem;margin-left:2px">↩</span></div>';
  // Barre de progression vers le prochain jalon
  var fromPrev = lastEntretienAt;
  var pct = Math.min(100, Math.max(0, Math.round((compteur - fromPrev) / 250 * 100)));
  var progColor = remaining < 0 ? '#dc3545' : (remaining <= 50 ? '#ffc107' : '#28a745');
  var progHtml = '<div style="margin-top:8px">';
  progHtml += '<div style="display:flex;justify-content:space-between;font-size:.72rem;color:#9a8f6a;margin-bottom:3px">';
  progHtml += '<span>Dernier : '+(lastEntretienAt||0)+'h</span><span>Prochain : <strong style="color:'+progColor+';font-size:.9rem">'+nextEntretienAt+'h</strong></span></div>';
  progHtml += '<div style="background:#1a1a1a;border-radius:4px;height:8px;overflow:hidden">';
  progHtml += '<div style="width:'+pct+'%;height:100%;background:'+progColor+';border-radius:4px;transition:width .4s"></div></div>';
  progHtml += '<div style="font-size:.7rem;color:#9a8f6a;margin-top:2px">'+pct+'% — '+(remaining>0?remaining.toFixed(0)+'h restantes':'Dépassé de '+Math.abs(remaining).toFixed(0)+'h')+'</div>';
  progHtml += '</div>';
  el.style.padding = '.6rem .75rem';
  if (remaining < 0) {
    el.style.background = 'rgba(220,53,69,.1)'; el.style.borderLeft = '4px solid #dc3545'; el.style.color = '#f8d7da';
    el.innerHTML = '<div><i class="bi bi-exclamation-triangle-fill" style="color:#dc3545"></i> <strong style="color:#ff6b6b">ENTRETIEN DÉPASSÉ de '+Math.abs(remaining).toFixed(0)+'h !</strong> — Prochain : <strong style="font-size:1.05rem">'+nextEntretienAt+'h</strong> (service '+nextType+'h)</div>'+progHtml+cycleHtml+milestonesHtml;
  } else if (remaining <= 50) {
    el.style.background = 'rgba(255,193,7,.1)'; el.style.borderLeft = '4px solid #ffc107'; el.style.color = '#fff3cd';
    el.innerHTML = '<div><i class="bi bi-exclamation-circle-fill" style="color:#ffc107"></i> <strong style="color:#ffc107">Entretien imminent !</strong> Prochain : <strong style="font-size:1.05rem">'+nextEntretienAt+'h</strong> (service '+nextType+'h) — dans <strong>'+remaining.toFixed(0)+'h</strong></div>'+progHtml+cycleHtml+milestonesHtml;
  } else {
    el.style.background = 'rgba(40,167,69,.07)'; el.style.borderLeft = '4px solid #28a745'; el.style.color = '#d4edda';
    el.innerHTML = '<div><i class="bi bi-check-circle-fill" style="color:#28a745"></i> Prochain : <strong style="font-size:1.1rem;color:'+ntc.color+'">'+nextEntretienAt+'h</strong> <span style="font-size:.8rem;color:'+ntc.color+'">(service '+nextType+'h)</span> — dans <strong style="color:#5adb7a">'+remaining.toFixed(0)+'h</strong></div>'+progHtml+cycleHtml+milestonesHtml;
  }
  fillCurrentPneusRefs(enginId);
  calcPneusVie();
}
function renderProchainEntretiens() {
  var el = document.getElementById('prochainEntretiensBody');
  if (!el) return;
  if (!STORE.engins.length) { el.innerHTML = '<tr><td colspan="6" class="text-center" style="color:#666">Aucun engin.</td></tr>'; return; }
  el.innerHTML = STORE.engins.map(function(eng) {
    var curCpt = +(eng.compteur||0);
    STORE.saisies.forEach(function(s){ if (s.enginId===eng.id && (s.compteurFin||0)>curCpt) curCpt=s.compteurFin; });
    var eh2 = getEnginEntretienHistory(eng.id);
    var nextAt = eh2.nextAt, lastAt = eh2.lastAt, nextType2 = eh2.nextType;
    var rem = +(nextAt - curCpt).toFixed(1);
    var pct = Math.min(100, Math.max(0, Math.round((curCpt - lastAt) / 250 * 100)));
    var progC = rem < 0 ? '#dc3545' : (rem <= 50 ? '#ffc107' : '#28a745');
    var ntc2 = getEntretienTypeStyle(nextType2);
    var badge = rem < 0
      ? '<span class="badge bg-danger"><i class="bi bi-exclamation-triangle-fill"></i> DÉPASSÉ '+Math.abs(rem).toFixed(0)+'h</span>'
      : (rem <= 50
        ? '<span class="badge bg-warning text-dark"><i class="bi bi-exclamation-circle-fill"></i> IMMINENT '+rem.toFixed(0)+'h</span>'
        : '<span class="badge bg-success">Dans '+rem.toFixed(0)+'h</span>');
    // Cycle mini 250→500→750→1000→↩
    var cycleRow = ENTRETIEN_CYCLE.map(function(t){
      var tc3 = getEntretienTypeStyle(t);
      var isNx = (t===nextType2);
      var sty = isNx ? 'background:'+tc3.bg+';color:'+tc3.color+';border:1px solid '+tc3.border+';font-weight:800'
                     : 'color:#444;font-size:.68rem';
      return '<span style="'+sty+';border-radius:3px;padding:0 4px;font-size:.68rem;margin-right:1px">'+(isNx?'→':'')+t+'h</span>';
    }).join('<span style="color:#333;font-size:.6rem">›</span>');
    var prog = '<div style="background:#222;border-radius:3px;height:4px;overflow:hidden;margin-top:3px"><div style="width:'+pct+'%;height:100%;background:'+progC+'"></div></div>';
    var nextCell = '<strong style="color:'+ntc2.color+';font-size:1rem">'+nextAt+'h</strong>'
      +'<div style="font-size:.65rem;color:'+ntc2.color+'">Svc '+nextType2+'h</div>'+prog;
    return '<tr>'
      +'<td><strong>'+eng.designation+'</strong><br><small style="color:#888">'+(eng.type||'')+'</small></td>'
      +'<td style="color:#d4af37;font-weight:700">'+curCpt.toFixed(0)+'h</td>'
      +'<td>'+(lastAt?'<span style="color:#5adb7a">'+lastAt+'h</span>':'<span style="color:#666">—</span>')+'</td>'
      +'<td>'+nextCell+'</td>'
      +'<td>'+cycleRow+'</td>'
      +'<td>'+badge+'</td>'
      +'</tr>';
  }).join('');
}
function switchPlanningTab(tab) {
  var isWeek      = (tab === 'week');
  var isImminent  = (tab === 'imminent');
  var isGlobal    = (!isWeek && !isImminent);
  document.getElementById('planningFiltresGlobal').style.display    = isGlobal    ? '' : 'none';
  document.getElementById('planningFiltresSemaine').style.display   = isWeek      ? '' : 'none';
  document.getElementById('planningWeekView').style.display         = isWeek      ? '' : 'none';
  document.getElementById('planningFiltresImminent').style.display  = isImminent  ? '' : 'none';
  document.getElementById('planningImminentView').style.display     = isImminent  ? '' : 'none';
  document.getElementById('tabPlanningGlobal').className   = isGlobal   ? 'btn btn-sm btn-warning'         : 'btn btn-sm btn-outline-warning';
  document.getElementById('tabPlanningWeek').className     = isWeek     ? 'btn btn-sm btn-info'             : 'btn btn-sm btn-outline-info';
  document.getElementById('tabPlanningImminent').className = isImminent ? 'btn btn-sm btn-danger'           : 'btn btn-sm btn-outline-danger';
  var legend  = document.querySelector('#planningEntretien .card-dark[style*="font-size:.78rem"]');
  var mainTbl = document.getElementById('planningTable');
  var alertsEl = document.getElementById('planningAlerts');
  if (legend)  legend.style.display  = (isWeek||isImminent) ? 'none' : '';
  if (mainTbl) mainTbl.closest('.card-dark').style.display = (isWeek||isImminent) ? 'none' : '';
  if (alertsEl) alertsEl.style.display = (isWeek||isImminent) ? 'none' : '';
  if (isWeek) {
    if (!document.getElementById('planningWeekInput').value) planningWeekNav(0);
    else renderPlanningWeek();
  }
}
function runPlanImminents() {
  var dateDeb  = document.getElementById('planningImminentDeb').value;
  var dateFin  = document.getElementById('planningImminentFin').value;
  var typeF    = (document.getElementById('planningImminentType').value||'').toLowerCase();
  var seuil    = +(document.getElementById('planningImminentSeuil').value||50);
  var today    = new Date().toISOString().slice(0,10);
  var refDate  = dateFin || today;
  var results  = [];
  STORE.engins.forEach(function(eng) {
    if (eng.statut === 'Au magasin') return;
    if (typeF && (eng.type||'').toLowerCase().indexOf(typeF) === -1) return;
    // Get latest compteur up to refDate
    var curCpt = +(eng.compteur || 0);
    var saisiesForEng = STORE.saisies.filter(function(s) {
      return s.enginId === eng.id && (!refDate || (s.dateDebut||'') <= refDate);
    });
    saisiesForEng.forEach(function(s) {
      if ((s.compteurFin||0) > curCpt) curCpt = +(s.compteurFin||0);
    });
    // Compute next maintenance
    var eh = getEnginEntretienHistory(eng.id);
    var nextAt   = eh.nextAt;
    var lastAt   = eh.lastAt;
    var nextType = eh.nextType;
    var remaining = +(nextAt - curCpt).toFixed(1);
    if (remaining > seuil) return; // not urgent enough
    // Estimate predicted maintenance date using avg HM/day over last 30 days
    var refDateObj = new Date(refDate);
    var d30 = new Date(refDateObj); d30.setDate(d30.getDate() - 30);
    var d30Str = d30.toISOString().slice(0,10);
    var recentSaisies = saisiesForEng.filter(function(s){ return (s.dateDebut||'') >= d30Str; });
    var totalHM30 = recentSaisies.reduce(function(a,s){
      return a + (+(s.difference||0) || Math.max(0,(+(s.compteurFin||0))-(+(s.compteurDebut||0))));
    },0);
    var avgHMday = recentSaisies.length > 0 ? totalHM30 / 30 : 0;
    var predictedDays = (avgHMday > 0 && remaining > 0) ? Math.round(remaining / avgHMday) : null;
    var predictedDate = null;
    if (predictedDays !== null) {
      var pd = new Date(refDateObj);
      pd.setDate(pd.getDate() + predictedDays);
      predictedDate = pd.toISOString().slice(0,10);
    }
    // Check if predicted date falls within date range
    var inRange = true;
    if (dateDeb && predictedDate && predictedDate < dateDeb) inRange = false;
    if (dateFin && predictedDate && predictedDate > dateFin) inRange = false;
    // If no date filter, or remaining <= 0 (already overdue), always include
    if (remaining <= 0) inRange = true;
    if (!inRange) return;
    results.push({
      eng: eng, curCpt: curCpt, nextAt: nextAt, lastAt: lastAt,
      nextType: nextType, remaining: remaining, predictedDate: predictedDate,
      predictedDays: predictedDays, avgHMday: avgHMday
    });
  });
  // Sort: most urgent first (lowest remaining)
  results.sort(function(a,b){ return a.remaining - b.remaining; });
  var wrap = document.getElementById('planningImminentView');
  if (!results.length) {
    wrap.innerHTML = '<div style="padding:20px;text-align:center;background:rgba(40,167,69,.08);border:1px solid rgba(40,167,69,.3);border-radius:8px;color:#5adb7a">'
      +'<i class="bi bi-check-circle-fill" style="font-size:1.8rem"></i>'
      +'<div style="font-size:.95rem;font-weight:700;margin-top:8px">Aucun entretien imminent</div>'
      +'<div style="font-size:.78rem;color:#888;margin-top:4px">Tous les engins ont plus de '+seuil+'h avant leur prochain entretien sur cette période.</div></div>';
    return;
  }
  // Build summary header
  var overdue = results.filter(function(r){ return r.remaining <= 0; }).length;
  var critical = results.filter(function(r){ return r.remaining > 0 && r.remaining <= 20; }).length;
  var warning  = results.filter(function(r){ return r.remaining > 20 && r.remaining <= seuil; }).length;
  var sumHtml = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">';
  sumHtml += '<div style="background:rgba(220,53,69,.12);border:1px solid #dc3545;border-radius:8px;padding:12px;text-align:center"><div style="font-size:1.6rem;font-weight:800;color:#dc3545">'+overdue+'</div><div style="font-size:.72rem;color:#dc3545">D\u00e9pass\u00e9(s)</div></div>';
  sumHtml += '<div style="background:rgba(255,87,34,.12);border:1px solid #ff5722;border-radius:8px;padding:12px;text-align:center"><div style="font-size:1.6rem;font-weight:800;color:#ff5722">'+critical+'</div><div style="font-size:.72rem;color:#ff5722">Critique (\u226420h)</div></div>';
  sumHtml += '<div style="background:rgba(255,193,7,.1);border:1px solid #ffc107;border-radius:8px;padding:12px;text-align:center"><div style="font-size:1.6rem;font-weight:800;color:#ffc107">'+warning+'</div><div style="font-size:.72rem;color:#ffc107">Attention (\u226450h)</div></div>';
  sumHtml += '</div>';
  // Build cards for each engine
  var cardsHtml = results.map(function(r) {
    var rem = r.remaining;
    var isOver    = rem <= 0;
    var isCrit    = !isOver && rem <= 20;
    var isWarn    = !isOver && !isCrit;
    var borderCol = isOver ? '#dc3545' : isCrit ? '#ff5722' : '#ffc107';
    var bgCol     = isOver ? 'rgba(220,53,69,.07)' : isCrit ? 'rgba(255,87,34,.06)' : 'rgba(255,193,7,.05)';
    var textCol   = isOver ? '#ff6b6b' : isCrit ? '#ff7043' : '#ffc107';
    var icon      = isOver ? '<i class="bi bi-exclamation-triangle-fill"></i>' : '<i class="bi bi-exclamation-circle-fill"></i>';
    var statusTxt = isOver ? 'D\u00c9PASS\u00c9 de '+Math.abs(rem).toFixed(0)+'h' : rem.toFixed(0)+'h restantes';
    var pct = Math.min(100, Math.max(0, r.lastAt > 0 ? Math.round((r.curCpt - r.lastAt)/250*100) : 0));
    var ntc = getEntretienTypeStyle(r.nextType);
    var progHtml = '<div style="background:#2a2a2a;border-radius:4px;height:10px;overflow:hidden;margin:6px 0">'
      +'<div style="width:'+pct+'%;height:100%;background:'+borderCol+';border-radius:4px;transition:width .4s"></div></div>';
    var dateLine = '';
    if (r.predictedDate) {
      dateLine = '<div style="font-size:.72rem;color:#9a8f6a;margin-top:4px">'
        +'<i class="bi bi-calendar-event"></i> Date pr\u00e9vue entretien : <strong style="color:'+textCol+'">'+r.predictedDate+'</strong>'
        +(r.predictedDays!==null?' (dans '+r.predictedDays+' j)':'')
        +(r.avgHMday>0?' — Moy. '+r.avgHMday.toFixed(1)+' HM/jour':'')
        +'</div>';
    }
    return '<div style="border:1px solid '+borderCol+';border-left:5px solid '+borderCol+';border-radius:8px;padding:12px 14px;margin-bottom:10px;background:'+bgCol+'">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:6px">'
      +'<div>'
      +'<div style="font-size:.92rem;font-weight:800;color:#fff">'+icon+' '+r.eng.designation+'</div>'
      +'<div style="font-size:.72rem;color:#888">'+( r.eng.type||'\u2014')+' &nbsp;|&nbsp; '+( r.eng.immatriculation||'\u2014')+'</div>'
      +'</div>'
      +'<div style="text-align:right">'
      +'<div style="font-size:1.1rem;font-weight:800;color:'+textCol+'">'+statusTxt+'</div>'
      +'<div style="font-size:.72rem;color:'+ntc.color+'">Prochain : <strong>'+r.nextAt+'h</strong> — Service '+r.nextType+'h</div>'
      +'</div>'
      +'</div>'
      +'<div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:6px;font-size:.75rem">'
      +'<span style="color:#aaa">Compteur actuel : <strong style="color:#d4af37">'+r.curCpt.toFixed(0)+'h</strong></span>'
      +'<span style="color:#aaa">Dernier entretien : <strong style="color:#5adb7a">'+(r.lastAt?r.lastAt+'h':'Aucun')+'</strong></span>'
      +'<span style="color:#aaa">Avancement : <strong style="color:'+borderCol+'">'+pct+'%</strong></span>'
      +'</div>'
      + progHtml + dateLine
      +'</div>';
  }).join('');
  // Period header
  var periodTxt = (dateDeb||'…')+' → '+(dateFin||'…');
  wrap.innerHTML = '<div style="background:rgba(220,53,69,.08);border:1px solid rgba(220,53,69,.3);border-radius:8px;padding:10px 14px;margin-bottom:14px">'
    +'<div style="font-size:.85rem;font-weight:700;color:#dc3545"><i class="bi bi-exclamation-triangle-fill"></i> Plan des Entretiens Imminents — P\u00e9riode : '+periodTxt+'</div>'
    +'<div style="font-size:.72rem;color:#888;margin-top:2px">'+results.length+' engin(s) avec \u2264'+seuil+'h avant prochain entretien</div>'
    +'</div>'
    + sumHtml + cardsHtml;
}
function planningWeekNav(dir) {
  var inp = document.getElementById('planningWeekInput');
  var today = new Date();
  var base;
  if (dir === 0 || !inp.value) {
    // set to current week
    var d = new Date(today);
    d.setDate(d.getDate() - d.getDay() + 1); // Monday
    base = d;
  } else {
    // parse current week value "2026-W26"
    var parts = inp.value.split('-W');
    var yr = +parts[0], wk = +parts[1];
    var jan4 = new Date(yr, 0, 4);
    var startOfWeek = new Date(jan4);
    startOfWeek.setDate(jan4.getDate() - ((jan4.getDay()||7) - 1) + (wk - 1) * 7);
    base = new Date(startOfWeek);
    base.setDate(base.getDate() + dir * 7);
  }
  // Build week string
  var yr2 = base.getFullYear();
  var startOfYear = new Date(yr2, 0, 1);
  var dayOfYear = Math.floor((base - startOfYear) / 86400000);
  var weekNum = Math.ceil((dayOfYear + ((startOfYear.getDay()||7) - 1) + 1) / 7);
  inp.value = yr2 + '-W' + String(weekNum).padStart(2, '0');
  // Also update date input
  var dateInp = document.getElementById('planningWeekDate');
  if (dateInp) dateInp.value = base.toISOString().slice(0, 10);
  renderPlanningWeek();
}
function syncWeekFromDate() {
  var dateVal = document.getElementById('planningWeekDate').value;
  if (!dateVal) return;
  var d = new Date(dateVal);
  var yr = d.getFullYear();
  var startOfYear = new Date(yr, 0, 1);
  var dayOfYear = Math.floor((d - startOfYear) / 86400000);
  var weekNum = Math.ceil((dayOfYear + ((startOfYear.getDay()||7) - 1) + 1) / 7);
  document.getElementById('planningWeekInput').value = yr + '-W' + String(weekNum).padStart(2, '0');
  renderPlanningWeek();
}
function renderPlanningWeek() {
  var el = document.getElementById('planningWeekView');
  if (!el) return;
  var weekVal = document.getElementById('planningWeekInput').value;
  var typeFilter = (document.getElementById('planningWeekType')||{}).value || '';
  if (!weekVal) { el.innerHTML = '<p style="color:#666;font-style:italic">Sélectionnez une semaine.</p>'; return; }
  // Parse week to get Monday–Sunday
  var parts = weekVal.split('-W');
  var yr = +parts[0], wk = +parts[1];
  var jan4 = new Date(yr, 0, 4);
  var monday = new Date(jan4);
  monday.setDate(jan4.getDate() - ((jan4.getDay()||7) - 1) + (wk - 1) * 7);
  var sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  var fmtDate = function(d) { return d.toLocaleDateString('fr-FR', {day:'2-digit', month:'2-digit', year:'numeric'}); };
  var DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  // Per engine: estimate date of next maintenance
  var today = new Date(); today.setHours(0,0,0,0);
  var engins = STORE.engins.filter(function(e) {
    if (!typeFilter) return true;
    return (e.type||'').toLowerCase().indexOf(typeFilter.toLowerCase()) > -1;
  });
  // For each engine compute: curCpt, lastAt, nextAt, avgHPerDay, estimatedDate
  var engineData = engins.map(function(eng) {
    var curCpt = +(eng.compteur||0);
    STORE.saisies.forEach(function(s){ if (s.enginId===eng.id && (s.compteurFin||0)>curCpt) curCpt=s.compteurFin; });
    var lastAt = 0;
    STORE.saisies.forEach(function(s){ if (s.enginId===eng.id && s.entretienFait && (s.entretienCompteur||0)>lastAt) lastAt=s.entretienCompteur; });
    var nextAt = lastAt + 250;
    var rem = +(nextAt - curCpt).toFixed(1);
    // Average hours per day (last 30 days)
    var cutoff = new Date(today); cutoff.setDate(today.getDate() - 30);
    var cutoffStr = cutoff.toISOString().slice(0,10);
    var totalH = 0, totalDays = 0;
    STORE.saisies.forEach(function(s){
      if (s.enginId===eng.id && (s.dateDebut||'') >= cutoffStr) {
        totalH += +(s.difference||s.duree||0);
        totalDays++;
      }
    });
    var avgHPerDay = (totalDays > 0 && totalH > 0) ? totalH / totalDays : 0;
    var estDate = null;
    if (avgHPerDay > 0 && rem > 0) {
      var daysNeeded = Math.ceil(rem / avgHPerDay);
      estDate = new Date(today); estDate.setDate(today.getDate() + daysNeeded);
    } else if (rem <= 0) {
      estDate = today; // already due
    }
    return { eng: eng, curCpt: curCpt, lastAt: lastAt, nextAt: nextAt, rem: rem, avgHPerDay: avgHPerDay, estDate: estDate };
  });
  // Group engines by day of week (Monday=0 ... Sunday=6)
  var byDay = [{},{},{},{},{},{},{}]; // 7 days
  var overdueList = [];
  engineData.forEach(function(d) {
    if (!d.estDate) return;
    var est = new Date(d.estDate); est.setHours(0,0,0,0);
    if (d.rem < 0) { overdueList.push(d); return; }
    for (var i=0; i<7; i++) {
      var day = new Date(monday); day.setDate(monday.getDate() + i);
      if (est.getTime() === day.getTime()) { if (!byDay[i][d.eng.id]) byDay[i][d.eng.id]=d; }
      else if (est >= monday && est <= sunday && est.getTime() <= day.getTime() && !byDay[i][d.eng.id]) {
        // falls somewhere in this week - put it on closest day
        if (i === 0 || new Date(monday).setDate(monday.getDate()+i-1) < est.getTime()) {
          if (!Object.values(byDay).some(function(dd){ return dd[d.eng.id]; }))
            byDay[i][d.eng.id] = d;
        }
      }
    }
  });
  // Simpler grouping: just check if estDate falls within each day
  for (var i=0;i<7;i++) byDay[i]={};
  engineData.forEach(function(d){
    if (!d.estDate || d.rem < 0) return;
    var est = new Date(d.estDate); est.setHours(0,0,0,0);
    if (est < monday || est > sunday) return;
    var dayIdx = Math.round((est - monday) / 86400000);
    if (dayIdx >= 0 && dayIdx < 7) byDay[dayIdx][d.eng.id] = d;
  });
  // Count total this week
  var totalWeek = engineData.filter(function(d){ return d.estDate && d.rem >= 0 && d.estDate >= monday && d.estDate <= sunday; }).length;
  // Build header
  var html = '<div class="card-dark p-3 mb-3" style="border-left:3px solid #17a2b8">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
    + '<span style="font-size:1rem;font-weight:700;color:#5bc8ff"><i class="bi bi-calendar-week"></i> Semaine du <strong>'+fmtDate(monday)+'</strong> au <strong>'+fmtDate(sunday)+'</strong></span>'
    + '<span class="badge bg-info" style="font-size:.85rem">'+totalWeek+' entretien(s) cette semaine</span>'
    + '</div>';
  // 7-day grid
  html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px">';
  for (var i=0;i<7;i++) {
    var dayDate = new Date(monday); dayDate.setDate(monday.getDate()+i);
    var isToday = (dayDate.toDateString() === today.toDateString());
    var entries = Object.values(byDay[i]);
    var dayBg = isToday ? 'background:rgba(23,162,184,.18);border:1px solid #17a2b8'
                        : 'background:#111;border:1px solid #222';
    html += '<div style="'+dayBg+';border-radius:6px;padding:6px;min-height:80px">';
    html += '<div style="font-size:.72rem;font-weight:700;color:'+(isToday?'#5bc8ff':'#888')+';margin-bottom:5px;text-align:center">'
      + DAYS_FR[i]+'<br><span style="font-size:.68rem">'+dayDate.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})+'</span></div>';
    if (entries.length === 0) {
      html += '<div style="color:#333;font-size:.68rem;text-align:center;margin-top:8px">—</div>';
    } else {
      entries.forEach(function(d) {
        var col = d.rem < 0 ? '#ff6b6b' : (d.rem <= 50 ? '#ffc107' : '#5bc8ff');
        var icon = d.rem < 0 ? '⚠' : (d.rem <= 50 ? '!' : '🔧');
        html += '<div style="background:rgba(23,162,184,.1);border:1px solid rgba(23,162,184,.3);border-radius:4px;padding:3px 5px;margin-bottom:3px;font-size:.68rem">'
          + '<div style="color:'+col+';font-weight:700">'+icon+' '+d.nextAt+'h</div>'
          + '<div style="color:#ccc;word-break:break-word">'+d.eng.designation+'</div>'
          + '<div style="color:#888">~'+d.rem.toFixed(0)+'h restant</div>'
          + '</div>';
      });
    }
    html += '</div>';
  }
  html += '</div>';
  // Overdue
  if (overdueList.length) {
    html += '<div style="margin-top:12px;padding:8px;background:rgba(220,53,69,.1);border:1px solid #dc3545;border-radius:6px">'
      + '<div style="color:#ff6b6b;font-weight:700;margin-bottom:6px"><i class="bi bi-exclamation-triangle-fill"></i> Entretiens en retard ('+overdueList.length+')</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:6px">'
      + overdueList.map(function(d){
          return '<span style="background:rgba(220,53,69,.2);border:1px solid #dc3545;border-radius:4px;padding:3px 8px;font-size:.75rem;color:#f8d7da">'
            + d.eng.designation+' — <strong style="color:#ff6b6b">'+d.nextAt+'h</strong> (dépassé de '+Math.abs(d.rem).toFixed(0)+'h)</span>';
        }).join('')
      + '</div></div>';
  }
  // Engines not this week
  var notThisWeek = engineData.filter(function(d){ return d.estDate && d.rem > 0 && (d.estDate < monday || d.estDate > sunday); });
  if (notThisWeek.length) {
    html += '<div style="margin-top:12px">'
      + '<div style="font-size:.78rem;color:#888;margin-bottom:6px"><i class="bi bi-clock"></i> Prochains entretiens hors semaine :</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:5px">'
      + notThisWeek.map(function(d){
          return '<span style="background:#1a1a1a;border:1px solid #333;border-radius:4px;padding:2px 7px;font-size:.72rem;color:#999">'
            + d.eng.designation+' — <strong>'+d.nextAt+'h</strong> le '+fmtDate(d.estDate)+'</span>';
        }).join('')
      + '</div></div>';
  }
  html += '<div style="margin-top:10px;font-size:.68rem;color:#555"><i class="bi bi-info-circle"></i> Dates estimées basées sur la moyenne des heures des 30 derniers jours. Engins sans historique = date non estimable.</div>';
  html += '</div>';
  el.innerHTML = html;
}
function renderPlanningEntretien() {
  var thead = document.getElementById('planningHead');
  var tbody = document.getElementById('planningBody');
  var alertsEl = document.getElementById('planningAlerts');
  if (!thead || !tbody) return;
  var typeFilter = (document.getElementById('planningTypeFilter')||{}).value || '';
  var engins = STORE.engins.filter(function(e) {
    if (!typeFilter) return true;
    return (e.type||'').toLowerCase().indexOf(typeFilter.toLowerCase()) > -1;
  });
  if (!engins.length) {
    thead.innerHTML = '';
    tbody.innerHTML = '<tr><td colspan="7" class="text-center p-4" style="color:#666">Aucun engin trouvé.</td></tr>';
    if (alertsEl) alertsEl.innerHTML = '';
    return;
  }
  thead.innerHTML = '<tr style="background:#0d0b00;color:#d4af37">'
    + '<th style="min-width:130px">Engin</th>'
    + '<th>Type</th>'
    + '<th class="text-center">Compteur actuel</th>'
    + '<th>Historique entretiens <small style="font-weight:400;color:#888">(ordre chronologique)</small></th>'
    + '<th class="text-center" style="color:#5bc8ff">Prochain <small style="font-weight:400">(dernier+250h)</small></th>'
    + '<th class="text-center">Restant</th>'
    + '<th class="text-center">Statut</th>'
    + '</tr>';
  var depasseList = [], imminentList = [];
  var rows = engins.map(function(eng) {
    var curCpt = +(eng.compteur || 0);
    STORE.saisies.forEach(function(s) {
      if (s.enginId === eng.id && (s.compteurFin || 0) > curCpt) curCpt = s.compteurFin;
    });
    var ehP = getEnginEntretienHistory(eng.id);
    var hist = ehP.hist, lastAt = ehP.lastAt, nextAt = ehP.nextAt, nextType = ehP.nextType;
    var rem = +(nextAt - curCpt).toFixed(1);
    // History chips avec couleur par type de service
    var histHtml = hist.length === 0
      ? '<span style="color:#444;font-size:.75rem;font-style:italic">Aucun entretien enregistré</span>'
      : hist.map(function(e, idx) {
          var tc = getEntretienTypeStyle(e.type);
          return '<span style="display:inline-flex;align-items:center;gap:3px;background:'+tc.bg+';color:'+tc.color+';border:1px solid '+tc.border+';border-radius:5px;padding:2px 8px;font-size:.73rem;margin:2px;white-space:nowrap">'
            + '<i class="bi bi-check-lg"></i><strong>'+e.cpt+'h</strong>'
            + '<span style="opacity:.75;font-size:.62rem">'+e.type+'h</span>'
            + (e.date?'<span style="color:#888;font-size:.62rem">'+e.date+'</span>':'')
            + '</span>'
            + (idx < hist.length-1 ? '<span style="color:#333;font-size:.68rem;margin:0 1px">+250h›</span>' : '');
        }).join('');
    // Next cell avec type de service suivant dans le cycle
    var nextColor = rem < 0 ? '#ff6b6b' : (rem <= 50 ? '#ffc107' : '#5adb7a');
    var ntcP = getEntretienTypeStyle(nextType);
    var nextHtml = '<div style="font-size:.7rem;color:#888">'+(lastAt?lastAt+'h':'0h')+' + 250h =</div>'
      + '<strong style="color:'+ntcP.color+';font-size:1.05rem">'+nextAt+'h</strong>'
      + '<div style="font-size:.65rem;color:'+ntcP.color+'">Service '+nextType+'h</div>';
    // Progress bar
    var pct = Math.min(100, Math.max(0, Math.round((curCpt - lastAt) / 250 * 100)));
    var progColor = rem < 0 ? '#dc3545' : (rem <= 50 ? '#ffc107' : '#28a745');
    var bar = '<div style="background:#222;border-radius:2px;height:5px;margin-top:4px"><div style="width:'+pct+'%;height:100%;background:'+progColor+';border-radius:2px"></div></div><div style="font-size:.62rem;color:#666;margin-top:1px">'+pct+'%</div>';
    var remText = rem < 0
      ? '<span style="color:#ff6b6b;font-weight:700">Dépassé<br>'+Math.abs(rem).toFixed(0)+'h</span>'
      : '<span style="color:'+nextColor+';font-weight:700">'+rem.toFixed(0)+'h</span>';
    var badge = rem < 0
      ? '<span class="badge bg-danger"><i class="bi bi-exclamation-triangle-fill"></i> DÉPASSÉ</span>'
      : (rem <= 50
        ? '<span class="badge bg-warning text-dark"><i class="bi bi-exclamation-circle-fill"></i> IMMINENT</span>'
        : '<span class="badge bg-success">OK</span>');
    if (rem < 0) depasseList.push(eng.designation+' → '+nextAt+'h (dépassé de '+Math.abs(rem).toFixed(0)+'h)');
    else if (rem <= 50) imminentList.push(eng.designation+' → '+nextAt+'h (dans '+rem.toFixed(0)+'h)');
    return '<tr>'
      + '<td><strong>'+eng.designation+'</strong></td>'
      + '<td><span style="font-size:.75rem;color:#888">'+(eng.type||'—')+'</span></td>'
      + '<td class="text-center" style="color:#d4af37;font-weight:700">'+curCpt.toFixed(0)+'h'+bar+'</td>'
      + '<td>'+histHtml+'</td>'
      + '<td class="text-center">'+nextHtml+'</td>'
      + '<td class="text-center">'+remText+'</td>'
      + '<td class="text-center">'+badge+'</td>'
      + '</tr>';
  });
  tbody.innerHTML = rows.join('');
  // Alerts summary
  if (alertsEl) {
    var alertHtml = '';
    if (depasseList.length) {
      alertHtml += '<div class="card-dark p-3 mb-2" style="border-left:4px solid #dc3545;background:rgba(220,53,69,.08)">'
        + '<strong style="color:#ff6b6b"><i class="bi bi-exclamation-triangle-fill"></i> Entretiens DÉPASSÉS (' + depasseList.length + ')</strong>'
        + '<ul style="margin:6px 0 0;padding-left:18px;font-size:.82rem;color:#f8d7da">'
        + depasseList.map(function(e){return '<li>'+e+'</li>';}).join('')
        + '</ul></div>';
    }
    if (imminentList.length) {
      alertHtml += '<div class="card-dark p-3 mb-2" style="border-left:4px solid #ffc107;background:rgba(255,193,7,.08)">'
        + '<strong style="color:#ffc107"><i class="bi bi-exclamation-circle-fill"></i> Entretiens IMMINENTS (' + imminentList.length + ')</strong>'
        + '<ul style="margin:6px 0 0;padding-left:18px;font-size:.82rem;color:#fff3cd">'
        + imminentList.map(function(e){return '<li>'+e+'</li>';}).join('')
        + '</ul></div>';
    }
    if (!depasseList.length && !imminentList.length) {
      alertHtml = '<div class="card-dark p-3" style="border-left:4px solid #28a745;color:#5adb7a;font-size:.85rem"><i class="bi bi-check-circle-fill"></i> Tous les entretiens sont à jour.</div>';
    }
    alertsEl.innerHTML = alertHtml;
  }
}
function fillCurrentPneusRefs(enginId) {
  var positions = [
    {store:'pneuAvg', domId:'sPneuAvgRefActuel'},
    {store:'pneuAvd', domId:'sPneuAvdRefActuel'},
    {store:'pneuArg', domId:'sPneuArgRefActuel'},
    {store:'pneuArd', domId:'sPneuArdRefActuel'}
  ];
  positions.forEach(function(pos) {
    var el = document.getElementById(pos.domId);
    if (!el) return;
    if (!enginId) { el.value = ''; return; }
    var lastRef = '', lastRefDate = '', lastCpt = -1;
    STORE.saisies.forEach(function(s) {
      if (s.enginId === enginId) {
        var p = s[pos.store];
        if (p && p.ref) {
          var cpt = s.compteurFin || 0;
          var isChanged = (p.statut === 'Changé');
          var beats = (cpt > lastCpt) || (cpt === lastCpt && isChanged);
          if (beats) { lastCpt = cpt; lastRef = p.ref; lastRefDate = s.dateDebut || ''; }
        }
      }
    });
    el.value = lastRef || '';
    el.title = lastRef ? (lastRefDate ? 'Enregistré le ' + lastRefDate : '') : '';
    el.placeholder = lastRef ? '' : 'Aucun enregistré';
  });
}
function calcPneusVie() {
  var enginId = document.getElementById('sEngin').value;
  var compteur = +document.getElementById('sCompteurFin').value || 0;
  var el = document.getElementById('pneusVieInfo');
  if (!el) return;
  if (!enginId || !compteur) { el.innerHTML = ''; return; }
  var positions = [
    {dom:'Avg', store:'pneuAvg', label:'AVG'},
    {dom:'Avd', store:'pneuAvd', label:'AVD'},
    {dom:'Arg', store:'pneuArg', label:'ARG'},
    {dom:'Ard', store:'pneuArd', label:'ARD'}
  ];
  var html = '<div class="row g-2">';
  positions.forEach(function(pos) {
    var lastCompteur = 0, lastDate = '';
    STORE.saisies.forEach(function(s) {
      if (s.enginId === enginId) {
        var p = s[pos.store];
        if (p && p.statut === 'Changé' && (s.compteurFin||0) > lastCompteur) {
          lastCompteur = s.compteurFin; lastDate = s.dateDebut||'';
        }
      }
    });
    var badge;
    if (!lastCompteur) {
      badge = '<span class="badge bg-secondary" style="font-size:.7rem">Pas de changement</span>';
    } else {
      var duree = +(compteur - lastCompteur).toFixed(0);
      if (duree < 0) duree = 0;
      if (duree >= 500) {
        badge = '<span class="badge bg-success" style="font-size:.7rem"><i class="bi bi-check-circle"></i> Usure normale — '+duree+'h</span>';
      } else {
        var pct = Math.min(100, (duree/500*100)).toFixed(0);
        badge = '<span class="badge bg-warning text-dark" style="font-size:.7rem"><i class="bi bi-clock"></i> En cours — '+duree+'h / 500h ('+pct+'%)</span>';
      }
      if (lastDate) badge += '<div style="font-size:.68rem;color:#9a8f6a;margin-top:2px">Changé le '+lastDate+'</div>';
    }
    html += '<div class="col-md-3" style="background:rgba(212,175,55,.04);border:1px solid rgba(212,175,55,.15);border-radius:.4rem;padding:.4rem .5rem;text-align:center"><div style="font-weight:700;color:#d4af37;font-size:.8rem;margin-bottom:3px">'+pos.label+'</div>'+badge+'</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}
function onPneuStatutChange(domKey, storeKey) {
  var enginId = document.getElementById('sEngin').value;
  var compteur = +document.getElementById('sCompteurFin').value || 0;
  var statut = document.getElementById('sPneu'+domKey+'Statut').value;
  var etatEl = document.getElementById('sPneu'+domKey+'Etat');
  if (etatEl && enginId && compteur && (statut === 'Changé' || statut === 'Usé' || statut === 'À changer')) {
    var lastCompteur = 0;
    STORE.saisies.forEach(function(s) {
      if (s.enginId === enginId) {
        var p = s[storeKey];
        if (p && p.statut === 'Changé' && (s.compteurFin||0) > lastCompteur) lastCompteur = s.compteurFin;
      }
    });
    if (lastCompteur > 0) {
      var duree = compteur - lastCompteur;
      etatEl.value = duree >= 500 ? 'Usure normale' : 'Incident';
    }
  }
  calcPneusVie();
  updatePneuSvg();
}
function updatePneuSvg() {
  var colors = {'OK':'#28a745','Usé':'#ffc107','À changer':'#fd7e14','Changé':'#0dcaf0'};
  var borders = {'OK':'rgba(40,167,69,.35)','Usé':'rgba(255,193,7,.5)','À changer':'rgba(253,126,20,.6)','Changé':'rgba(13,202,240,.5)'};
  var bg = {'OK':'rgba(40,167,69,.05)','Usé':'rgba(255,193,7,.07)','À changer':'rgba(253,126,20,.08)','Changé':'rgba(13,202,240,.07)'};
  [['avg','sPneuAvgStatut'],['avd','sPneuAvdStatut'],['arg','sPneuArgStatut'],['ard','sPneuArdStatut']].forEach(function(pair) {
    var key = pair[0], selId = pair[1];
    var val = (document.getElementById(selId)||{}).value || 'OK';
    var svgEl = document.getElementById('pneu-svg-'+key);
    if (svgEl) svgEl.querySelector('rect').setAttribute('fill', colors[val]||'#28a745');
    var card = document.getElementById('pneuRow-'+key);
    if (card) {
      var inner = card.querySelector('div');
      if (inner) { inner.style.borderColor = borders[val]||'rgba(40,167,69,.35)'; inner.style.background = bg[val]||'rgba(40,167,69,.05)'; }
    }
  });
}
function scrollToPneu(key) {
  var el = document.getElementById('pneuRow-'+key);
  if (el) { el.scrollIntoView({behavior:'smooth',block:'center'}); el.querySelector('div').style.boxShadow='0 0 0 3px rgba(212,175,55,.5)'; setTimeout(function(){ el.querySelector('div').style.boxShadow=''; },1500); }
}
function calcGasoilCout() {
  var qte = +document.getElementById('sGasoil').value || 0;
  var prix = getTarifActuel('Gasoil');
  if (prix > 0) document.getElementById('sGasoilCout').value = (qte * prix).toFixed(2);
}
function calcHuileCout(el) {
  var row = el.closest('.row');
  var type = row.querySelector('.huile-type').value;
  var qte = +row.querySelector('.huile-qte').value || 0;
  var coutEl = row.querySelector('.huile-cout');
  if (coutEl) {
    var prix = getTarifActuel(type);
    coutEl.value = (prix > 0 && qte > 0) ? (qte * prix).toFixed(2) : '';
  }
  calcTotaux();
}
function addGasoilLine(data) {
  var c = document.getElementById('gasoilContainer'); if (!c) return;
  var d = document.createElement('div');
  d.className = 'row g-2 mb-2 align-items-end';
  var qteVal = data ? (data.qte || 0) : 0;
  var coutVal = data ? (data.cout || '') : '';
  var obsVal = data ? (data.obs || '') : '';
  d.innerHTML =
    '<div class="col-md-4"><label class="form-label small">Quantité (L)</label><input type="number" class="form-control form-control-sm gasoil-qte" step="0.5" placeholder="Qté (L)" value="'+qteVal+'" oninput="calcGasoilLigne(this)"></div>'
    +'<div class="col-md-4"><label class="form-label small">Coût (DH) <small class="text-warning"><i class="bi bi-calculator"></i> auto</small></label><input type="number" class="form-control form-control-sm gasoil-cout" placeholder="Coût DH" value="'+coutVal+'" readonly style="background:rgba(212,175,55,.08);color:#d4af37"></div>'
    +'<div class="col-md-3"><label class="form-label small">Observation</label><input type="text" class="form-control form-control-sm gasoil-obs" placeholder="Observation" value="'+obsVal+'"></div>'
    +'<div class="col-md-1"><button class="btn btn-sm btn-outline-danger mt-4" onclick="this.closest(\'.row\').remove(); calcTotaux()"><i class="bi bi-x"></i></button></div>';
  c.appendChild(d);
}
function calcGasoilLigne(el) {
  var row = el.closest('.row');
  var qte = +row.querySelector('.gasoil-qte').value || 0;
  var coutEl = row.querySelector('.gasoil-cout');
  var prix = getTarifActuel('Gasoil');
  if (coutEl) coutEl.value = (prix > 0 && qte > 0) ? (qte * prix).toFixed(2) : '';
  calcTotaux();
}
function getGasoilLines() {
  var arr = [];
  document.querySelectorAll('#gasoilContainer .row').forEach(function(r) {
    var qte = +r.querySelector('.gasoil-qte').value || 0;
    arr.push({ qte: qte, cout: +r.querySelector('.gasoil-cout').value || 0, obs: r.querySelector('.gasoil-obs').value });
  });
  return arr;
}
function calcTotaux() {
  var totalQteGasoil = 0, totalCoutGasoil = 0;
  document.querySelectorAll('#gasoilContainer .row').forEach(function(r) {
    totalQteGasoil += +r.querySelector('.gasoil-qte').value || 0;
    totalCoutGasoil += +r.querySelector('.gasoil-cout').value || 0;
  });
  document.getElementById('sGasoil').value = totalQteGasoil.toFixed(1);
  document.getElementById('sGasoilCout').value = totalCoutGasoil.toFixed(2);
  var tgEl = document.getElementById('totalGasoilSpan');
  if (tgEl) tgEl.textContent = totalQteGasoil.toFixed(1) + ' L — ' + totalCoutGasoil.toFixed(2) + ' DH';
  var totalsHuiles = {}, totalCoutHuiles = 0;
  document.querySelectorAll('#huilesContainer .row').forEach(function(r) {
    var type = r.querySelector('.huile-type').value || '?';
    var qte = +r.querySelector('.huile-qte').value || 0;
    var cout = +r.querySelector('.huile-cout').value || 0;
    if (!totalsHuiles[type]) totalsHuiles[type] = { qte: 0, cout: 0 };
    totalsHuiles[type].qte += qte;
    totalsHuiles[type].cout += cout;
    totalCoutHuiles += cout;
  });
  var thEl = document.getElementById('totalHuilesBox');
  if (thEl) {
    var types = Object.keys(totalsHuiles).filter(function(t) { return t !== '?'; });
    if (!types.length) {
      thEl.innerHTML = '0 L — 0 DH';
    } else {
      thEl.innerHTML = types.map(function(t) {
        return '<span style="margin-right:10px"><strong>' + t + '</strong> : ' + totalsHuiles[t].qte.toFixed(1) + ' L — ' + totalsHuiles[t].cout.toFixed(2) + ' DH</span>';
      }).join('<span style="color:rgba(255,255,255,.3);margin-right:10px">|</span>');
    }
  }
}

function newSaisie() {
  saisieNavIdx = -1;
  document.getElementById('saisieId').value = '';
  document.getElementById('sDate').value = new Date().toISOString().slice(0,10);
  document.getElementById('sEngin').selectedIndex = 0;
  document.getElementById('sConducteur').selectedIndex = 0;
  var m = document.getElementById('sMecanicien'); if (m) m.selectedIndex = 0;
  document.getElementById('sCompteurDebut').value = '';
  document.getElementById('sCompteurFin').value = '';
  document.getElementById('sDifference').value = '';
  document.getElementById('sMLF').value = '0';
  document.getElementById('sEntretienFait').value = '';
  document.getElementById('sEntretienCompteur').value = '';
  document.getElementById('sGasoil').value = '0';
  document.getElementById('sGasoilCout').value = '0';
  document.getElementById('gasoilContainer').innerHTML = '';
  document.getElementById('huilesContainer').innerHTML = '';
  calcTotaux();
  ['sPneuAvgStatut','sPneuAvdStatut','sPneuArgStatut','sPneuArdStatut'].forEach(function(id) { document.getElementById(id).value='OK'; });
  ['sPneuAvgRef','sPneuAvdRef','sPneuArgRef','sPneuArdRef'].forEach(function(id) { document.getElementById(id).value=''; });
  ['sPneuAvgPrix','sPneuAvdPrix','sPneuArgPrix','sPneuArdPrix'].forEach(function(id) { document.getElementById(id).value=''; });
  ['sPneuAvgRefActuel','sPneuAvdRefActuel','sPneuArgRefActuel','sPneuArdRefActuel'].forEach(function(id){ var el=document.getElementById(id); if(el){el.value='';el.placeholder='Aucun enregistré';} });
  ['sPneuAvgFourn','sPneuAvdFourn','sPneuArgFourn','sPneuArdFourn'].forEach(function(id) { document.getElementById(id).value=''; });
  ['sPneuAvgMarque','sPneuAvdMarque','sPneuArgMarque','sPneuArdMarque'].forEach(function(id) { var el=document.getElementById(id); if(el) el.value=''; });
  ['sPneuAvgEtat','sPneuAvdEtat','sPneuArgEtat','sPneuArdEtat'].forEach(function(id) { document.getElementById(id).value=''; });
  updatePneuSvg();
  document.getElementById('flexiblesContainer').innerHTML = '';
  document.getElementById('sNbArrets').value = '0';
  document.getElementById('sHeurePanne').value = '0';
  document.getElementById('sHeureArret').value = '0';
  document.getElementById('interventionsContainer').innerHTML = '';
  document.getElementById('sObs').value = '';
  document.getElementById('btnRectifier').style.display = 'none';
  document.getElementById('saisieNavInfo').textContent = 'Nouvelle saisie';
  var banner = document.getElementById('editModeBanner'); if (banner) banner.style.display = 'none';
}

// Dynamic huiles
function addHuileLine(data) {
  var c = document.getElementById('huilesContainer');
  var idx = c.children.length;
  var d = document.createElement('div');
  d.className = 'row g-2 mb-2 align-items-end';
  var coutVal = data ? (data.cout || '') : '';
  var incidentChecked = (data && data.incident) ? 'checked' : '';
  d.innerHTML =
    '<div class="col-md-3"><select class="form-select form-select-sm huile-type" onchange="calcHuileCout(this)"><option value="">-- Type --</option><option>HV 68</option><option>S30</option><option>S50</option><option>S15W40</option><option>15W40 Normal</option><option>AUTRAN</option><option>85W140</option></select></div>'
    +'<div class="col-md-2"><input type="number" class="form-control form-control-sm huile-qte" step="0.5" placeholder="Qté (L)" value="'+(data?data.qte:0)+'" oninput="calcHuileCout(this)"></div>'
    +'<div class="col-md-2"><input type="number" class="form-control form-control-sm huile-cout" placeholder="Coût DH" value="'+coutVal+'" readonly style="background:rgba(212,175,55,.08);color:#d4af37"></div>'
    +'<div class="col-md-2"><input type="text" class="form-control form-control-sm huile-obs" placeholder="Observation" value="'+(data?data.obs:'')+'"></div>'
    +'<div class="col-md-2"><div class="form-check d-flex align-items-center gap-1 mt-1" title="Cocher si cet apport d\'huile est lié à un incident"><input class="form-check-input huile-incident" type="checkbox" '+incidentChecked+' id="hInc'+idx+'" onchange="this.closest(\'.row\').style.background=this.checked?\'rgba(220,53,69,.08)\':\'\'" style="cursor:pointer;width:1.1rem;height:1.1rem"><label class="form-check-label text-danger" for="hInc'+idx+'" style="font-size:.72rem;cursor:pointer"><i class="bi bi-exclamation-triangle-fill"></i> Incident</label></div></div>'
    +'<div class="col-md-1"><button class="btn btn-sm btn-outline-danger" onclick="this.closest(\'.row\').remove()"><i class="bi bi-x"></i></button></div>';
  if (data && data.type) d.querySelector('.huile-type').value = data.type;
  if (data && data.incident) d.style.background = 'rgba(220,53,69,.08)';
  c.appendChild(d);
}
function getHuiles() {
  var rows = document.getElementById('huilesContainer').querySelectorAll('.row');
  var arr = [];
  rows.forEach(function(r) {
    var type = r.querySelector('.huile-type').value;
    var qte = +r.querySelector('.huile-qte').value || 0;
    var obs = r.querySelector('.huile-obs').value;
    var coutEl = r.querySelector('.huile-cout');
    var cout = coutEl ? (+coutEl.value || 0) : 0;
    var incidentEl = r.querySelector('.huile-incident');
    var incident = incidentEl ? incidentEl.checked : false;
    if (type || qte) arr.push({type:type, qte:qte, obs:obs, cout:cout, incident:incident});
  });
  return arr;
}

// Dynamic flexibles
var FLEX_DIAMS = ['','1/4"','3/8"','1/2"','5/8"','3/4"','7/8"','1"','1"1/4','1"1/2','2"','2"1/2','3"','3"1/2','4"','5"','6"','7"','8"','9"','10"','12"','14"','16"','18"','20"','22"','24"','26"'];
var FLEX_EMBOUTS = ['','Droit','Coudé 45°','Coudé 90°','T (3 voies)','BSP Mâle','BSP Femelle','NPT Mâle','NPT Femelle','JIC 37°','ORFS','Bride SAE','Pivot Mâle','Pivot Femelle','Banjo'];
var FLEX_JUPES = ['','Standard acier','Double acier','Inox 304','Inox 316','Laiton','Aluminium','Renforcée','Spiralée','Tressée','Thermoplastique'];
function addFlexibleLine(data) {
  var c = document.getElementById('flexiblesContainer');
  var d = document.createElement('div');
  d.className = 'row g-2 mb-2 align-items-end';
  var dVal = data ? (data.diam||'') : '';
  var eVal = data ? (data.embout||'') : '';
  var jVal = data ? (data.jupe||'') : '';
  function opts(list, sel) { return list.map(function(o){ return '<option'+(o===sel?' selected':'')+'>'+o+'</option>'; }).join(''); }
  d.innerHTML =
    '<div class="col-md-2"><label class="form-label form-label-sm mb-0" style="font-size:.7rem;color:#9a8f6a">Diamètre</label><select class="form-select form-select-sm flex-diam">'+opts(FLEX_DIAMS,dVal)+'</select></div>' +
    '<div class="col-md-3"><label class="form-label form-label-sm mb-0" style="font-size:.7rem;color:#9a8f6a">Embout</label><select class="form-select form-select-sm flex-embout">'+opts(FLEX_EMBOUTS,eVal)+'</select></div>' +
    '<div class="col-md-2"><label class="form-label form-label-sm mb-0" style="font-size:.7rem;color:#9a8f6a">Jupe</label><select class="form-select form-select-sm flex-jupe">'+opts(FLEX_JUPES,jVal)+'</select></div>' +
    '<div class="col-md-1"><label class="form-label form-label-sm mb-0" style="font-size:.7rem;color:#9a8f6a">Qté</label><input type="number" class="form-control form-control-sm flex-qte" min="0" value="'+(data?data.qte:1)+'"></div>' +
    '<div class="col-md-3"><label class="form-label form-label-sm mb-0" style="font-size:.7rem;color:#9a8f6a">Observation</label><input type="text" class="form-control form-control-sm flex-obs" placeholder="Obs..." value="'+(data?data.obs:'')+'"></div>' +
    '<div class="col-md-1 d-flex align-items-end"><button class="btn btn-sm btn-outline-danger w-100" onclick="this.closest(\'.row\').remove()"><i class="bi bi-x"></i></button></div>';
  c.appendChild(d);
}
function getFlexibles() {
  var rows = document.getElementById('flexiblesContainer').querySelectorAll('.row');
  var arr = [];
  rows.forEach(function(r) {
    arr.push({diam:r.querySelector('.flex-diam').value, embout:r.querySelector('.flex-embout').value, jupe:r.querySelector('.flex-jupe').value, qte:+r.querySelector('.flex-qte').value||0, obs:r.querySelector('.flex-obs').value});
  });
  return arr;
}

// Dynamic interventions
function addInterventionLine(data) {
  var c = document.getElementById('interventionsContainer');
  var d = document.createElement('div');
  d.className = 'row g-2 mb-2 align-items-end';
  var statuts = ['-- Statut --','Fait','Non fait','À programmer','Programmé','Programmé non fait','Programmé et fait'];
  var sVal = data ? (data.statut||'') : '';
  function sOpts() { return statuts.map(function(o){ return '<option'+(o===sVal?' selected':'')+'>'+o+'</option>'; }).join(''); }
  var fmChecked = data && data.faitMarquant ? 'checked' : '';
  d.innerHTML =
    '<div class="col-md-3"><select class="form-select form-select-sm inter-type"><option value="">-- Type --</option><option>Maintenance préventive</option><option>Maintenance corrective</option><option>Réparation</option><option>Contrôle</option><option>Graissage</option><option>Vidange</option><option>Remplacement pièce</option><option>Inspection</option><option>Autre</option></select></div>' +
    '<div class="col-md-2"><select class="form-select form-select-sm inter-statut">'+sOpts()+'</select></div>' +
    '<div class="col-md-3"><input type="text" class="form-control form-control-sm inter-desc" placeholder="Description" value="'+(data?data.description:'')+'"></div>' +
    '<div class="col-md-1"><input type="text" class="form-control form-control-sm inter-pieces" placeholder="Pièces" value="'+(data?data.pieces:'')+'"></div>' +
    '<div class="col-md-2 d-flex align-items-center gap-1" style="padding:.25rem .5rem;background:rgba(220,53,69,.07);border:1px solid rgba(220,53,69,.25);border-radius:.4rem"><input type="checkbox" class="form-check-input inter-fm flex-shrink-0" '+fmChecked+' style="width:1rem;height:1rem;accent-color:#dc3545"><label style="font-size:.72rem;color:#f08080;margin:0;cursor:pointer">Fait marquant</label></div>' +
    '<div class="col-md-1"><button class="btn btn-sm btn-outline-danger w-100" onclick="this.closest(\'.row\').remove()"><i class="bi bi-x"></i></button></div>';
  if (data && data.type) d.querySelector('.inter-type').value = data.type;
  c.appendChild(d);
}
function getInterventions() {
  var rows = document.getElementById('interventionsContainer').querySelectorAll('.row');
  var arr = [];
  rows.forEach(function(r) {
    var statEl = r.querySelector('.inter-statut');
    var fmEl = r.querySelector('.inter-fm');
    arr.push({type:r.querySelector('.inter-type').value, statut: statEl ? statEl.value : '', description:r.querySelector('.inter-desc').value, pieces:r.querySelector('.inter-pieces').value, faitMarquant: fmEl ? fmEl.checked : false});
  });
  return arr;
}

// Save saisie
function saveSaisie() {
  if (!document.getElementById('sEngin').value) { alert('Sélectionnez un engin.'); return; }
  if (!document.getElementById('sDate').value) { alert('Sélectionnez une date.'); return; }
  var id = document.getElementById('saisieId').value || uid();
  var diff = (+document.getElementById('sCompteurFin').value||0) - (+document.getElementById('sCompteurDebut').value||0);
  var obj = {
    id: id,
    dateDebut: document.getElementById('sDate').value,
    enginId: document.getElementById('sEngin').value,
    conducteurId: document.getElementById('sConducteur').value,
    mecanicienId: (document.getElementById('sMecanicien')||{}).value || '',
    compteurDebut: +document.getElementById('sCompteurDebut').value || 0,
    compteurFin: +document.getElementById('sCompteurFin').value || 0,
    difference: diff >= 0 ? +diff.toFixed(1) : 0,
    duree: diff >= 0 ? +diff.toFixed(1) : 0,
    mlf: +document.getElementById('sMLF').value || 0,
    entretienFait: document.getElementById('sEntretienFait').value,
    entretienCompteur: +document.getElementById('sEntretienCompteur').value || 0,
    gasoil: +document.getElementById('sGasoil').value || 0,
    gasoilCout: +document.getElementById('sGasoilCout').value || 0,
    gasoilLines: getGasoilLines(),
    huiles: getHuiles(),
    pneuAvg: {statut:document.getElementById('sPneuAvgStatut').value, ref:document.getElementById('sPneuAvgRef').value, marque:document.getElementById('sPneuAvgMarque').value, fourn:document.getElementById('sPneuAvgFourn').value, etat:document.getElementById('sPneuAvgEtat').value, prix:+(document.getElementById('sPneuAvgPrix').value||0)},
    pneuAvd: {statut:document.getElementById('sPneuAvdStatut').value, ref:document.getElementById('sPneuAvdRef').value, marque:document.getElementById('sPneuAvdMarque').value, fourn:document.getElementById('sPneuAvdFourn').value, etat:document.getElementById('sPneuAvdEtat').value, prix:+(document.getElementById('sPneuAvdPrix').value||0)},
    pneuArg: {statut:document.getElementById('sPneuArgStatut').value, ref:document.getElementById('sPneuArgRef').value, marque:document.getElementById('sPneuArgMarque').value, fourn:document.getElementById('sPneuArgFourn').value, etat:document.getElementById('sPneuArgEtat').value, prix:+(document.getElementById('sPneuArgPrix').value||0)},
    pneuArd: {statut:document.getElementById('sPneuArdStatut').value, ref:document.getElementById('sPneuArdRef').value, marque:document.getElementById('sPneuArdMarque').value, fourn:document.getElementById('sPneuArdFourn').value, etat:document.getElementById('sPneuArdEtat').value, prix:+(document.getElementById('sPneuArdPrix').value||0)},
    flexibles: getFlexibles(),
    nbArrets: +document.getElementById('sNbArrets').value || 0,
    heurePanne: +document.getElementById('sHeurePanne').value || 0,
    heureArret: +document.getElementById('sHeureArret').value || 0,
    panne: +document.getElementById('sHeurePanne').value || 0,
    arret: +document.getElementById('sHeureArret').value || 0,
    heuresFonct: diff >= 0 ? +diff.toFixed(1) : 0,
    interventions: getInterventions(),
    obs: document.getElementById('sObs').value
  };
  var idx = STORE.saisies.findIndex(function(s) { return s.id === id; });
  if (idx >= 0) STORE.saisies[idx] = obj; else STORE.saisies.push(obj);
  document.getElementById('saisieId').value = id;
  saveData(); renderSaisies(); updateFilterSelects();
  var banner = document.getElementById('editModeBanner'); if (banner) banner.style.display = 'none';
  alert('Saisie enregistrée !');
  // Update entretien compteur on engin if applicable
  if (obj.entretienFait && obj.entretienCompteur) {
    var eng = STORE.engins.find(function(e) { return e.id === obj.enginId; });
    if (eng) { eng.compteur = obj.compteurFin || eng.compteur; saveData(); }
  }
}

function loadSaisieToForm(x) {
  document.getElementById('saisieId').value = x.id;
  document.getElementById('sDate').value = x.dateDebut || '';
  document.getElementById('sEngin').value = x.enginId || '';
  document.getElementById('sConducteur').value = x.conducteurId || '';
  var m = document.getElementById('sMecanicien'); if (m) m.value = x.mecanicienId || '';
  document.getElementById('sCompteurDebut').value = x.compteurDebut || '';
  document.getElementById('sCompteurFin').value = x.compteurFin || '';
  document.getElementById('sDifference').value = x.difference || '';
  document.getElementById('sMLF').value = x.mlf || 0;
  document.getElementById('sEntretienFait').value = x.entretienFait || '';
  document.getElementById('sEntretienCompteur').value = x.entretienCompteur || '';
  document.getElementById('sGasoil').value = x.gasoil || 0;
  document.getElementById('sGasoilCout').value = x.gasoilCout || 0;
  // Gasoil lignes
  document.getElementById('gasoilContainer').innerHTML = '';
  if (x.gasoilLines && x.gasoilLines.length) {
    x.gasoilLines.forEach(function(g) { addGasoilLine(g); });
  } else if (x.gasoil > 0) {
    addGasoilLine({ qte: x.gasoil, cout: x.gasoilCout || 0, obs: '' });
  }
  calcTotaux();
  // Huiles
  document.getElementById('huilesContainer').innerHTML = '';
  (x.huiles || []).forEach(function(h) { addHuileLine(h); });
  // Pneus
  var pAvg = x.pneuAvg || {}; var pAvd = x.pneuAvd || {}; var pArg = x.pneuArg || {}; var pArd = x.pneuArd || {};
  document.getElementById('sPneuAvgStatut').value = pAvg.statut||'OK'; document.getElementById('sPneuAvgRef').value = pAvg.ref||'';
  document.getElementById('sPneuAvgFourn').value = pAvg.fourn||''; document.getElementById('sPneuAvgEtat').value = pAvg.etat||''; document.getElementById('sPneuAvgPrix').value = pAvg.prix||''; document.getElementById('sPneuAvgMarque').value = pAvg.marque||'';
  document.getElementById('sPneuAvdStatut').value = pAvd.statut||'OK'; document.getElementById('sPneuAvdRef').value = pAvd.ref||'';
  document.getElementById('sPneuAvdFourn').value = pAvd.fourn||''; document.getElementById('sPneuAvdEtat').value = pAvd.etat||''; document.getElementById('sPneuAvdPrix').value = pAvd.prix||''; document.getElementById('sPneuAvdMarque').value = pAvd.marque||'';
  document.getElementById('sPneuArgStatut').value = pArg.statut||'OK'; document.getElementById('sPneuArgRef').value = pArg.ref||'';
  document.getElementById('sPneuArgFourn').value = pArg.fourn||''; document.getElementById('sPneuArgEtat').value = pArg.etat||''; document.getElementById('sPneuArgPrix').value = pArg.prix||''; document.getElementById('sPneuArgMarque').value = pArg.marque||'';
  document.getElementById('sPneuArdStatut').value = pArd.statut||'OK'; document.getElementById('sPneuArdRef').value = pArd.ref||'';
  document.getElementById('sPneuArdFourn').value = pArd.fourn||''; document.getElementById('sPneuArdEtat').value = pArd.etat||''; document.getElementById('sPneuArdPrix').value = pArd.prix||''; document.getElementById('sPneuArdMarque').value = pArd.marque||'';
  // Flexibles
  document.getElementById('flexiblesContainer').innerHTML = '';
  (x.flexibles || []).forEach(function(f) { addFlexibleLine(f); });
  // Arrêts
  document.getElementById('sNbArrets').value = x.nbArrets || 0;
  document.getElementById('sHeurePanne').value = x.heurePanne || x.panne || 0;
  document.getElementById('sHeureArret').value = x.heureArret || x.arret || 0;
  // Interventions
  document.getElementById('interventionsContainer').innerHTML = '';
  (x.interventions || []).forEach(function(i) { addInterventionLine(i); });
  document.getElementById('sObs').value = x.obs || '';
  document.getElementById('btnRectifier').style.display = 'inline-block';
  updateEntretienInfo();
  fillCurrentPneusRefs(x.enginId);
  calcPneusVie();
  updatePneuSvg();
}

function editSaisie(id) {
  var x = STORE.saisies.find(function(s) { return s.id === id; }); if (!x) return;
  saisieNavIdx = STORE.saisies.indexOf(x);
  loadSaisieToForm(x);
  document.getElementById('saisieNavInfo').textContent = 'Saisie ' + (saisieNavIdx+1) + '/' + STORE.saisies.length;
  navTo('saisie');
  setTimeout(function() {
    var form = document.querySelector('#saisie .card-dark');
    if (form) form.scrollIntoView({behavior:'smooth', block:'start'});
  }, 80);
  var banner = document.getElementById('editModeBanner');
  if (banner) {
    banner.style.display = 'flex';
    banner.querySelector('#editBannerDate').textContent = (x.dateDebut||'') + (STORE.engins.find(function(e){return e.id===x.enginId;})||{designation:''}).designation ? ' — ' + ((STORE.engins. find(function(e){return e.id===x.enginId;})||{designation:''}).designation||'') : '';
  }
}

function saisieNav(dir) {
  if (!STORE.saisies.length) return;
  if (saisieNavIdx === -1) saisieNavIdx = dir > 0 ? 0 : STORE.saisies.length - 1;
  else saisieNavIdx += dir;
  if (saisieNavIdx < 0) saisieNavIdx = STORE.saisies.length - 1;
  if (saisieNavIdx >= STORE.saisies.length) saisieNavIdx = 0;
  var x = STORE.saisies[saisieNavIdx];
  loadSaisieToForm(x);
  document.getElementById('saisieNavInfo').textContent = 'Saisie ' + (saisieNavIdx+1) + '/' + STORE.saisies.length;
}

function deleteSaisie(id) { if (confirm('Supprimer ?')) { STORE.saisies = STORE.saisies.filter(function(s) { return s.id !== id; }); saveData(); renderSaisies(); newSaisie(); } }
function deleteAllSaisies() { if (confirm('Supprimer TOUTES les saisies ?')) { STORE.saisies = []; saveData(); renderSaisies(); newSaisie(); } }

function showDetail(id) {
  var x = STORE.saisies.find(function(s) { return s.id === id; }); if (!x) return;
  var eng = STORE.engins.find(function(e) { return e.id === x.enginId; });
  var pers = STORE.personnel.find(function(p) { return p.id === x.conducteurId; });
  var h = '<table class="table table-dark table-sm">';
  h += '<tr><td><strong>Date</strong></td><td>'+(x.dateDebut||'-')+'</td></tr>';
  h += '<tr><td><strong>Engin</strong></td><td>'+(eng?eng.designation:'-')+'</td></tr>';
  h += '<tr><td><strong>Opérateur</strong></td><td>'+(pers?pers.nom+' '+pers.prenom:'-')+'</td></tr>';
  h += '<tr><td><strong>Compteur</strong></td><td>'+(x.compteurDebut||0)+' → '+(x.compteurFin||0)+' (Diff: '+(x.difference||0)+')</td></tr>';
  h += '<tr><td><strong>MLF</strong></td><td>'+(x.mlf>0?(x.mlf+' m'):'-')+'</td></tr>';
  h += '<tr><td><strong>Gasoil</strong></td><td>'+(x.gasoil||0)+' L (Coût: '+(x.gasoilCout||0)+' DH)</td></tr>';
  if (x.huiles && x.huiles.length) {
    h += '<tr><td><strong>Huiles</strong></td><td>' + x.huiles.map(function(hu) { return hu.type+': '+hu.qte+'L'+(hu.obs?' ('+hu.obs+')':''); }).join('<br>') + '</td></tr>';
  }
  var pPos = ['pneuAvg','pneuAvd','pneuArg','pneuArd'];
  var pLabels = ['AVG','AVD','ARG','ARD'];
  var pneuLines = [];
  pPos.forEach(function(k,i) { var p = x[k]; if (p && p.statut !== 'OK') pneuLines.push(pLabels[i]+': '+p.statut+(p.fourn?' - '+p.fourn:'')+(p.ref?' ('+p.ref+')':'')); });
  if (pneuLines.length) h += '<tr><td><strong>Pneus</strong></td><td>'+pneuLines.join('<br>')+'</td></tr>';
  if (x.flexibles && x.flexibles.length) h += '<tr><td><strong>Flexibles</strong></td><td>'+x.flexibles.map(function(f) { return 'D:'+f.diam+' E:'+f.embout+' J:'+f.jupe+' Q:'+f.qte; }).join('<br>')+'</td></tr>';
  h += '<tr><td><strong>Arrêts</strong></td><td>'+(x.nbArrets||0)+' | Panne: '+(x.heurePanne||0)+'h | Arrêt: '+(x.heureArret||0)+'h</td></tr>';
  if (x.interventions && x.interventions.length) h += '<tr><td><strong>Interventions</strong></td><td>'+x.interventions.map(function(i) { return (i.type||'-')+': '+(i.description||'-'); }).join('<br>')+'</td></tr>';
  h += '<tr><td><strong>Observations</strong></td><td>'+(x.obs||'-')+'</td></tr></table>';
  document.getElementById('detailContent').innerHTML = h;
  new bootstrap.Modal(document.getElementById('detailModal')).show();
}

function applyFilters() {
  var eId = document.getElementById('filtreEngin').value;
  var pId = document.getElementById('filtreOperateur').value;
  var date = document.getElementById('filtreDate').value;
  var res = STORE.saisies;
  if (eId) res = res.filter(function(s) { return s.enginId === eId; });
  if (pId) res = res.filter(function(s) { return s.conducteurId === pId; });
  if (date) res = res.filter(function(s) { return s.dateDebut === date; });
  renderSaisies(res);
}
function resetFilters() {
  document.getElementById('filtreEngin').value = '';
  document.getElementById('filtreOperateur').value = '';
  document.getElementById('filtreDate').value = '';
  renderSaisies();
}

// --- KPIs ---
function computeKPIs() {
  var totalE = STORE.engins.length;
  var actifs = STORE.engins.filter(function(e) { return e.statut === 'En service'; }).length;
  var pannes = STORE.engins.filter(function(e) { return e.statut === 'En panne'; }).length;
  var maint = STORE.engins.filter(function(e) { return e.statut === 'Maintenance'; }).length;
  var totalFonct = 0, totalPanne = 0, totalArret = 0, totalPannesCount = 0;
  STORE.saisies.forEach(function(s) {
    totalFonct += s.heuresFonct || s.duree || 0;
    totalPanne += s.panne || 0;
    totalArret += s.arret || 0;
    if (s.panne > 0) totalPannesCount++;
  });
  var totalHours = totalFonct + totalPanne + totalArret || 1;
  return {
    totalE: totalE, actifs: actifs, pannes: pannes, maint: maint,
    dispo: ((totalFonct / totalHours) * 100).toFixed(1),
    util: ((totalFonct / totalHours) * 100).toFixed(1),
    mtbf: totalPannesCount ? (totalFonct / totalPannesCount).toFixed(1) : 0,
    mttr: totalPannesCount ? (totalPanne / totalPannesCount).toFixed(1) : 0
  };
}

// --- DASHBOARD ---
function updateDashboard() {
  var k = computeKPIs();
  document.getElementById('kpiTotalEngins').textContent = k.totalE;
  document.getElementById('kpiActifs').textContent = k.actifs;
  document.getElementById('kpiPannes').textContent = k.pannes;
  document.getElementById('kpiMaintenance').textContent = k.maint;
  document.getElementById('kpiDispo').textContent = k.dispo + '%';
  document.getElementById('kpiUtil').textContent = k.util + '%';
  document.getElementById('kpiMtbf').textContent = k.mtbf + 'h';
  document.getElementById('kpiMttr').textContent = k.mttr + 'h';
  updateCharts();
  updateDashFlotteTable();
}
function updateDashFlotteTable() {
  function normalize(t) { return (t||'').toLowerCase().replace(/[^a-z0-9]/g,''); }
  function is10t(eng)  { var n=normalize(eng.type); return n.indexOf('10t')>-1 || n.indexOf('10')>-1; }
  function isDump(eng) { var n=normalize(eng.type); return n.indexOf('dump')>-1; }
  // Agrégation par engin
  var byEngin = {};
  STORE.saisies.forEach(function(s) {
    var eng = STORE.engins.find(function(e){ return e.id===s.enginId; });
    if (!eng) return;
    if (!byEngin[s.enginId]) byEngin[s.enginId] = {eng:eng, hm:0, td:0, tu:0, gas:0, hui:0};
    var g = byEngin[s.enginId];
    // HM = différence compteur ou heures fonctionnement
    var cF=+(s.compteurFin||0), cD=+(s.compteurDebut||0);
    var hm = (cD>0 && cF>cD) ? (cF-cD) : Math.max(0, +(s.difference||s.duree||s.heuresFonct||0));
    // TD = heures de panne/arrêt
    var td = +(s.heurePanne||s.panne||0) + +(s.heureArret||s.arret||0);
    // TU = HM - TD (temps utilisation effectif)
    var tu = Math.max(0, hm - td);
    g.hm  += hm;
    g.td  += td;
    g.tu  += tu;
    g.gas += +(s.gasoil||0);
    if (s.huiles && s.huiles.length) {
      s.huiles.forEach(function(h){ g.hui += +(h.qte||0); });
    } else {
      g.hui += (+(s.hv68||0))+(+(s.s30||0))+(+(s.s50||0))+(+(s.w15w40||0))+(+(s.autran||0))+(+(s.w85w140||0));
    }
  });
  function trgColor(val) {
    if (val === null) return '#888';
    return val >= 85 ? '#27ae60' : val >= 70 ? '#f39c12' : '#c0392b';
  }
  function renderGroup(bodyId, footId, filterFn, accentColor) {
    var tbody = document.getElementById(bodyId);
    var tfoot = document.getElementById(footId);
    if (!tbody || !tfoot) return;
    var items = Object.values(byEngin).filter(function(x){ return filterFn(x.eng); });
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding:14px;font-style:italic;font-size:.78rem;color:#888">Aucune saisie enregistrée</td></tr>';
      tfoot.innerHTML = '';
      return;
    }
    var totHm=0, totTd=0, totTu=0, totGas=0, totHui=0;
    tbody.innerHTML = items.map(function(x, i) {
      var trg = x.hm > 0 ? +Math.min(100, (x.tu / x.hm * 100)).toFixed(1) : null;
      totHm += x.hm; totTd += x.td; totTu += x.tu; totGas += x.gas; totHui += x.hui;
      return '<tr style="background:'+(i%2===0?'transparent':'rgba(255,255,255,.04)')+'">'
        +'<td style="font-weight:600;font-size:.82rem">'+x.eng.designation+'</td>'
        +'<td class="text-center" style="color:#d4af37">'+x.hm.toFixed(1)+'</td>'
        +'<td class="text-center" style="color:#e74c3c">'+x.td.toFixed(1)+'</td>'
        +'<td class="text-center" style="color:#27ae60">'+x.tu.toFixed(1)+'</td>'
        +'<td class="text-center" style="color:'+trgColor(trg)+';font-weight:700">'+(trg!==null?trg+'%':'—')+'</td>'
        +'<td class="text-center" style="color:#e67e22">'+x.gas.toFixed(0)+'</td>'
        +'<td class="text-center" style="color:#9b59b6">'+x.hui.toFixed(1)+'</td>'
        +'</tr>';
    }).join('');
    var totTrg = totHm > 0 ? +Math.min(100, (totTu / totHm * 100)).toFixed(1) : null;
    tfoot.innerHTML = '<tr style="border-top:2px solid '+accentColor+'">'
      +'<td style="color:'+accentColor+';font-weight:800;font-size:.82rem">TOTAL</td>'
      +'<td class="text-center" style="color:#d4af37;font-weight:700">'+totHm.toFixed(1)+'</td>'
      +'<td class="text-center" style="color:#e74c3c;font-weight:700">'+totTd.toFixed(1)+'</td>'
      +'<td class="text-center" style="color:#27ae60;font-weight:700">'+totTu.toFixed(1)+'</td>'
      +'<td class="text-center" style="color:'+trgColor(totTrg)+';font-weight:800">'+(totTrg!==null?totTrg+'%':'—')+'</td>'
      +'<td class="text-center" style="color:#e67e22;font-weight:700">'+totGas.toFixed(0)+'</td>'
      +'<td class="text-center" style="color:#9b59b6;font-weight:700">'+totHui.toFixed(1)+'</td>'
      +'</tr>';
  }
  renderGroup('dash10tBody',  'dash10tFoot',  is10t,  '#e67e22');
  renderGroup('dashDumpBody', 'dashDumpFoot', isDump, '#2980b9');
  function renderFlotteChart(canvasId, filterFn, colors) {
    var c = document.getElementById(canvasId); if (!c || typeof Chart === 'undefined') return;
    if (c._chart) { c._chart.destroy(); }
    var items = Object.values(byEngin).filter(function(x){ return filterFn(x.eng); });
    if (!items.length) return;
    var labels = items.map(function(x){ return x.eng.designation; });
    var dtData = items.map(function(x){ return +x.td.toFixed(1); });
    var tuData = items.map(function(x){ return +x.tu.toFixed(1); });
    var trgData = items.map(function(x){ return x.hm>0 ? +Math.min(100,(x.tu/x.hm*100)).toFixed(1) : 0; });
    c._chart = new Chart(c.getContext('2d'), {
      data: {
        labels: labels,
        datasets: [
          { type:'bar', label:'DT (h)', data:dtData, backgroundColor:colors.dt, borderRadius:4, yAxisID:'y' },
          { type:'bar', label:'TU (h)', data:tuData, backgroundColor:colors.tu, borderRadius:4, yAxisID:'y' },
          { type:'line', label:'TRG (%)', data:trgData, borderColor:colors.trg, backgroundColor:'transparent', borderWidth:2, pointRadius:4, pointBackgroundColor:colors.trg, yAxisID:'y2', tension:0.3 }
        ]
      },
      options: {
        responsive:true, animation:{duration:400},
        plugins:{
          legend:{ position:'top', labels:{ font:{size:9}, boxWidth:10, color:'#ccc', padding:6 } },
          tooltip:{ callbacks:{ label:function(ctx){ return ctx.dataset.label+': '+ctx.parsed.y+(ctx.dataset.yAxisID==='y2'?'%':'h'); } } }
        },
        scales:{
          x:{ ticks:{ font:{size:9}, color:'#aaa' }, grid:{ color:'rgba(255,255,255,.05)' } },
          y:{ beginAtZero:true, position:'left', ticks:{ font:{size:9}, color:'#aaa' }, grid:{ color:'rgba(255,255,255,.05)' }, title:{ display:true, text:'Heures', font:{size:8}, color:'#888' } },
          y2:{ beginAtZero:true, max:100, position:'right', ticks:{ font:{size:9}, color:colors.trg, callback:function(v){ return v+'%'; } }, grid:{ drawOnChartArea:false }, title:{ display:true, text:'TRG %', font:{size:8}, color:colors.trg } }
        }
      }
    });
  }
  renderFlotteChart('chart10tDTTU', is10t,  { dt:'rgba(231,76,60,.75)', tu:'rgba(39,174,96,.75)', trg:'#f39c12' });
  renderFlotteChart('chartDumpDTTU', isDump, { dt:'rgba(231,76,60,.75)', tu:'rgba(52,152,219,.75)', trg:'#f39c12' });
}
function updateRapports() {
  var k = computeKPIs();
  document.getElementById('rDispo').textContent = k.dispo + '%';
  document.getElementById('rUtil').textContent = k.util + '%';
  document.getElementById('rMtbf').textContent = k.mtbf + 'h';
  document.getElementById('rMttr').textContent = k.mttr + 'h';
  updateRapportCharts();
}

function updateCharts() {
  var labels = STORE.engins.map(function(e) { return e.designation.substring(0,12); });
  var dispoData = STORE.engins.map(function(e) {
    var rows = STORE.saisies.filter(function(s) { return s.enginId === e.id; });
    var fonct = rows.reduce(function(a,s) { return a + (s.heuresFonct||s.duree||0); }, 0);
    var panne = rows.reduce(function(a,s) { return a + (s.panne||0); }, 0);
    var arret = rows.reduce(function(a,s) { return a + (s.arret||0); }, 0);
    var tot = fonct + panne + arret || 1;
    return ((fonct/tot)*100).toFixed(1);
  });
  var panneData = STORE.engins.map(function(e) { return STORE.saisies.filter(function(s) { return s.enginId === e.id && s.panne > 0; }).length; });
  var gasoilData = STORE.engins.map(function(e) { return STORE.saisies.filter(function(s) { return s.enginId === e.id; }).reduce(function(a,s) { return a + (s.gasoil||0); }, 0); });
  var heuresData = STORE.engins.map(function(e) { return STORE.saisies.filter(function(s) { return s.enginId === e.id; }).reduce(function(a,s) { return a + (s.heuresFonct||s.duree||0); }, 0); });
  var common = { responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:'#e2e8f0'}}}, scales:{x:{ticks:{color:'#94a3b8'}}, y:{ticks:{color:'#94a3b8'}, grid:{color:'#334155'}}} };
  if (charts.dispo) charts.dispo.destroy();
  if (charts.gasoil) charts.gasoil.destroy();
  if (charts.pannes) charts.pannes.destroy();
  if (charts.heures) charts.heures.destroy();
  charts.dispo = new Chart(document.getElementById('chartDispo'), { type:'bar', data:{labels:labels, datasets:[{label:'Disponibilité %', data:dispoData, backgroundColor:'#63b3ed'}]}, options:common });
  charts.gasoil = new Chart(document.getElementById('chartGasoil'), { type:'bar', data:{labels:labels, datasets:[{label:'Gasoil (L)', data:gasoilData, backgroundColor:'#f6ad55'}]}, options:common });
  charts.pannes = new Chart(document.getElementById('chartPannes'), { type:'bar', data:{labels:labels, datasets:[{label:'Pannes', data:panneData, backgroundColor:'#f56565'}]}, options:common });
  charts.heures = new Chart(document.getElementById('chartHeures'), { type:'bar', data:{labels:labels, datasets:[{label:'Heures fonct.', data:heuresData, backgroundColor:'#48bb78'}]}, options:common });
}

function updateRapportCharts() {
  var labels = ['HV68','S30','S50','15W40','AUTRAN','85W140'];
  var data = [
    STORE.saisies.reduce(function(a,s) { return a + (s.hv68||0); }, 0),
    STORE.saisies.reduce(function(a,s) { return a + (s.s30||0); }, 0),
    STORE.saisies.reduce(function(a,s) { return a + (s.s50||0); }, 0),
    STORE.saisies.reduce(function(a,s) { return a + (s.w15w40||0); }, 0),
    STORE.saisies.reduce(function(a,s) { return a + (s.autran||0); }, 0),
    STORE.saisies.reduce(function(a,s) { return a + (s.w85w140||0); }, 0)
  ];
  var pneuData = [
    STORE.saisies.filter(function(s) { return s.pneuAvgMarque; }).length,
    STORE.saisies.filter(function(s) { return s.pneuAvdMarque; }).length,
    STORE.saisies.filter(function(s) { return s.pneuArgMarque; }).length,
    STORE.saisies.filter(function(s) { return s.pneuArdMarque; }).length
  ];
  var common = { responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:'#e2e8f0'}}}, scales:{x:{ticks:{color:'#94a3b8'}}, y:{ticks:{color:'#94a3b8'}, grid:{color:'#334155'}}} };
  if (charts.huiles) charts.huiles.destroy();
  if (charts.pneus) charts.pneus.destroy();
  charts.huiles = new Chart(document.getElementById('chartHuiles'), { type:'bar', data:{labels:labels, datasets:[{label:'Litres', data:data, backgroundColor:['#63b3ed','#48bb78','#f6ad55','#f56565','#9f7aea','#38b2ac']}]}, options:common });
  charts.pneus = new Chart(document.getElementById('chartPneus'), { type:'doughnut', data:{labels:['AVG','AVD','ARG','ARD'], datasets:[{data:pneuData, backgroundColor:['#63b3ed','#48bb78','#f6ad55','#f56565']}]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:'#e2e8f0'}}}} });
}

// --- EXPORT ---
function exportAllToExcel() {
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(STORE.engins), 'Engins');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(STORE.personnel), 'Personnel');
  var rows = STORE.saisies.map(function(s) {
    var eng = STORE.engins.find(function(e) { return e.id === s.enginId; });
    var pers = STORE.personnel.find(function(p) { return p.id === s.conducteurId; });
    return { DateDebut:s.dateDebut, HeureDebut:s.heureDebut, DateFin:s.dateFin, HeureFin:s.heureFin, Duree:s.duree, Engin:eng?eng.designation:'', Operateur:pers?pers.nom+' '+pers.prenom:'', Type:s.typeInter, HeuresFonct:s.heuresFonct, MLF:s.mlf, Panne:s.panne, Arret:s.arret, Activite:s.activite, Pieces:s.pieces, CausePanne:s.causePanne, Solution:s.solution, Gasoil:s.gasoil, GasoilCout:s.gasoilCout, HV68:s.hv68, S30:s.s30, S50:s.s50, '15W40':s.w15w40, AUTRAN:s.autran, '85W140':s.w85w140, FaitMarquant:s.faitMarquant, Etat:s.etatActivite, Observations:s.obs };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Interventions');
  XLSX.writeFile(wb, 'Export_Gestion_Parc_' + new Date().toISOString().slice(0,10) + '.xlsx');
}

// --- SEED DEMO ---
function seedDemoData() {
  var E = {};
  var enginsList = [
    {designation:'CAT R1600 H N°10', immatriculation:'', type:'Pelles 10T', marque:'CATERPILLAR', modele:'R 1600 H', serie:'9SD00210', dateMec:'2016-03-08', statut:'En service', compteur:0},
    {designation:'CAT R1600 H N°11', immatriculation:'', type:'Pelles 10T', marque:'CATERPILLAR', modele:'R 1600 H', serie:'9SD00241', dateMec:'2016-09-19', statut:'En service', compteur:0},
    {designation:'CAT R1600 H N°12', immatriculation:'', type:'Pelles 10T', marque:'CATERPILLAR', modele:'R 1600 H', serie:'9SD00270', dateMec:'2017-04-26', statut:'En service', compteur:0},
    {designation:'CAT R1600 H N°13', immatriculation:'', type:'Pelles 10T', marque:'CATERPILLAR', modele:'R 1600 H', serie:'9SD00269', dateMec:'2017-05-13', statut:'En service', compteur:0},
    {designation:'CAT R1600 G N°14', immatriculation:'1627330', type:'Pelles 10T', marque:'CATERPILLAR', modele:'R 1600 G', serie:'9YZ00928', dateMec:'2018-01-28', statut:'En service', compteur:0},
    {designation:'CAT R1600 H N°15', immatriculation:'1627331', type:'Pelles 10T', marque:'CATERPILLAR', modele:'R 1600 H', serie:'9SD00445', dateMec:'2018-11-15', statut:'En service', compteur:0},
    {designation:'CAT R1600 H N°16', immatriculation:'1627333', type:'Pelles 10T', marque:'CATERPILLAR', modele:'R 1600 H', serie:'9SD00509', dateMec:'2019-08-01', statut:'En service', compteur:0},
    {designation:'CAT R1600 H N°17', immatriculation:'1627334', type:'Pelles 10T', marque:'CATERPILLAR', modele:'R 1600 H', serie:'9SD00511', dateMec:'2019-09-19', statut:'En service', compteur:0},
    {designation:'CAT R1600 H N°18', immatriculation:'1627336', type:'Pelles 10T', marque:'CATERPILLAR', modele:'R 1600 H', serie:'9SD00575', dateMec:'2021-03-12', statut:'En service', compteur:0},
    {designation:'CAT R1600 H N°19', immatriculation:'1627337', type:'Pelles 10T', marque:'CATERPILLAR', modele:'R 1600 H', serie:'9SD00601', dateMec:'2021-04-01', statut:'En service', compteur:0},
    {designation:'CAT R1600 H N°20', immatriculation:'1627338', type:'Pelles 10T', marque:'CATERPILLAR', modele:'R 1600 H', serie:'9SD00538', dateMec:'2021-08-02', statut:'En service', compteur:0},
    {designation:'CAT R1600 H N°21', immatriculation:'1627339', type:'Pelles 10T', marque:'CATERPILLAR', modele:'R 1600 H', serie:'9SD00539', dateMec:'2021-08-02', statut:'En service', compteur:0},
    {designation:'CAT R1600 H N°22', immatriculation:'1627341', type:'Pelles 10T', marque:'CATERPILLAR', modele:'R 1600 H', serie:'9SD00752', dateMec:'2022-12-23', statut:'En service', compteur:0},
    {designation:'CAT R1600 H N°23', immatriculation:'', type:'Pelles 10T', marque:'CATERPILLAR', modele:'R 1600 H', serie:'9SD00753', dateMec:'', statut:'Magasin', compteur:0},
    {designation:'TORO LH 307/1 (M6 N4)', immatriculation:'', type:'Pelles 6T', marque:'SANDICK', modele:'LH 307', serie:'L207D547', dateMec:'2017-05-01', statut:'En service', compteur:0},
    {designation:'R 1300-1', immatriculation:'', type:'Pelles 6T', marque:'CATERPILLAR', modele:'R 1300', serie:'NJB00357', dateMec:'2017-05-11', statut:'En service', compteur:0},
    {designation:'R 1300-2', immatriculation:'', type:'Pelles 6T', marque:'CATERPILLAR', modele:'R 1300', serie:'', dateMec:'2022-03-01', statut:'En service', compteur:0},
    {designation:'ST2G n1', immatriculation:'', type:'Pelles 3T', marque:'WAGNER', modele:'ST2G', serie:'PBEA405756', dateMec:'2012-04-28', statut:'En service', compteur:0},
    {designation:'ST2G n2', immatriculation:'', type:'Pelles 3T', marque:'WAGNER', modele:'ST2G', serie:'PBEA', dateMec:'2012-05-06', statut:'En service', compteur:0},
    {designation:'Yantai 3T N°1', immatriculation:'', type:'Pelles 3T', marque:'YANTAI', modele:'XYWJ-1.5D', serie:'15057', dateMec:'2017-05-04', statut:'En service', compteur:0},
    {designation:'Yantai 3T N°2', immatriculation:'', type:'Pelles 3T', marque:'YANTAI', modele:'XYWJ-1.5', serie:'15097', dateMec:'2021-07-28', statut:'En service', compteur:0},
    {designation:'DUMPER MT 2000 (recu de hajjar)', immatriculation:'', type:'Dumpers', marque:'WAGNER', modele:'MT 2000', serie:'', dateMec:'', statut:'En service', compteur:0},
    {designation:'DUMPER MT 2000 (samine)', immatriculation:'', type:'Dumpers', marque:'WAGNER', modele:'MT 2001', serie:'', dateMec:'2022-06-01', statut:'En service', compteur:0},
    {designation:'DUMPER MT 2010-3', immatriculation:'', type:'Dumpers', marque:'WAGNER', modele:'MT 2010-3', serie:'AV007X095/73288035', dateMec:'2012-03-06', statut:'En service', compteur:0},
    {designation:'MT 420 (recu de hajjar)', immatriculation:'', type:'Dumpers', marque:'WAGNER', modele:'MT 420', serie:'', dateMec:'', statut:'En service', compteur:0},
    {designation:'DUMPER YUNTAI (KODIAT)', immatriculation:'', type:'Dumpers', marque:'YUNTAI', modele:'YUNTAI', serie:'17572', dateMec:'2023-02-01', statut:'En service', compteur:0},
    {designation:'AD 30 N1', immatriculation:'', type:'Dumpers', marque:'CATERPILLAR', modele:'AD 30', serie:'CAT0AD30HGXR00780', dateMec:'2016-07-14', statut:'En service', compteur:0},
    {designation:'AD 30 N2', immatriculation:'', type:'Dumpers', marque:'CATERPILLAR', modele:'AD 30', serie:'CAT0AD30HGXR00835', dateMec:'2017-04-15', statut:'En service', compteur:0},
    {designation:'AD 30 N3', immatriculation:'', type:'Dumpers', marque:'CATERPILLAR', modele:'AD 30', serie:'CAT0AD30HGXR00960', dateMec:'2019-09-01', statut:'En service', compteur:0},
    {designation:'AD 30 N3 (bis)', immatriculation:'', type:'Dumpers', marque:'', modele:'AD 30', serie:'', dateMec:'2022-05-01', statut:'En service', compteur:0},
    {designation:'PLATE FOR. N°5', immatriculation:'', type:'Plate forme', marque:'', modele:'ANFO CHARGER', serie:'020-004', dateMec:'2010-10-09', statut:'En service', compteur:0},
    {designation:'PLATE FOR. N°7', immatriculation:'', type:'Plate forme', marque:'GETMAN A64 SL CISCOR', modele:'ANFO CHARGER', serie:'023-075', dateMec:'2013-02-26', statut:'En service', compteur:0},
    {designation:'PURGEUSE N°7', immatriculation:'', type:'Purgeuse', marque:'GETMAN S-32.NL', modele:'SCALER', serie:'', dateMec:'2021-05-09', statut:'En service', compteur:0},
    {designation:'PURGEUSE N°5', immatriculation:'', type:'Purgeuse', marque:'GETMAN S-32.NL', modele:'SCALER', serie:'061-002', dateMec:'2012-03-26', statut:'En service', compteur:0},
    {designation:'SIMBA N°1', immatriculation:'', type:'Simba', marque:'ATLAS COPCO', modele:'H 281', serie:'AV003A075', dateMec:'2003-07-28', statut:'En service', compteur:0},
    {designation:'SIMBA N°7 (recu de hajjar)', immatriculation:'', type:'Jumbo', marque:'ATLAS COPCO', modele:'H 281', serie:'', dateMec:'2005-06-23', statut:'En service', compteur:0},
    {designation:'SIMBA LH/1', immatriculation:'', type:'Simba', marque:'CMAC', modele:'LH 108', serie:'INCONNU', dateMec:'2012-01-31', statut:'En service', compteur:0},
    {designation:'SIMBA LH/2', immatriculation:'', type:'Simba', marque:'CMAC', modele:'LH 213', serie:'INCONNU', dateMec:'2012-01-31', statut:'En service', compteur:0},
    {designation:'SIMBA LH/3', immatriculation:'', type:'Simba', marque:'CMAC', modele:'SPLH', serie:'INCONNU', dateMec:'2015-07-06', statut:'En service', compteur:0},
    {designation:'SIMBA LH/4', immatriculation:'', type:'Simba', marque:'CMAC', modele:'LH 108', serie:'INCONNU', dateMec:'2018-01-01', statut:'En service', compteur:0},
    {designation:'Robolt 7-3-4', immatriculation:'', type:'Rebolt', marque:'SANDVICK', modele:'DS 311', serie:'L15B6469', dateMec:'2015-10-26', statut:'En service', compteur:0},
    {designation:'Robolt 7-3-5', immatriculation:'', type:'Rebolt', marque:'SANDVICK', modele:'DS 311', serie:'L20B7301', dateMec:'2020-08-12', statut:'En service', compteur:0}
  ];
  enginsList.forEach(function(eg) { eg.id = uid(); STORE.engins.push(eg); E[eg.designation] = eg.id; });
  var personnelList = [
    {nom:'AIT HADDOUCH', prenom:'OMAR', fonction:'Conducteur', equipe:'Équipe A', telephone:'', affectation:'', dateEmb:'2006-07-01'},
    {nom:'IGHMOUR', prenom:'MOHAMED', fonction:'Conducteur', equipe:'Équipe A', telephone:'', affectation:'', dateEmb:'2008-02-01'},
    {nom:'LADIBE', prenom:'MOHAMMED', fonction:'Conducteur', equipe:'Équipe A', telephone:'', affectation:'', dateEmb:'2008-02-01'},
    {nom:'AIT MBAREK', prenom:'DRISS', fonction:'Conducteur', equipe:'Équipe A', telephone:'', affectation:'', dateEmb:'2008-02-01'},
    {nom:'BAMOU', prenom:'RACHID', fonction:'Conducteur', equipe:'Équipe A', telephone:'', affectation:'', dateEmb:'2008-02-01'},
    {nom:'GHANEM', prenom:'Moulay Nour eddine', fonction:'Conducteur', equipe:'Équipe B', telephone:'', affectation:'', dateEmb:'2011-01-01'},
    {nom:'OUARDAK', prenom:'Nordine', fonction:'Conducteur', equipe:'Équipe B', telephone:'', affectation:'', dateEmb:'2011-01-01'},
    {nom:'HAJI', prenom:'Mohamed', fonction:'Conducteur', equipe:'Équipe B', telephone:'', affectation:'', dateEmb:'2011-01-01'},
    {nom:'EL ATTAOUI', prenom:'ABDELLAH', fonction:'Conducteur', equipe:'Équipe B', telephone:'', affectation:'', dateEmb:'2011-01-01'},
    {nom:'EL JELAL', prenom:'EL MAHDI', fonction:'Conducteur', equipe:'Équipe B', telephone:'', affectation:'', dateEmb:'2011-01-01'},
    {nom:'KIDI', prenom:'SALAH', fonction:'Conducteur', equipe:'Équipe C', telephone:'', affectation:'', dateEmb:'2011-01-01'},
    {nom:'OULAIDI', prenom:'Mohamed', fonction:'Conducteur', equipe:'Équipe C', telephone:'', affectation:'', dateEmb:'2011-01-01'},
    {nom:'ZEROUALI', prenom:'MOHAMED', fonction:'Conducteur', equipe:'Équipe C', telephone:'', affectation:'', dateEmb:'2011-10-01'},
    {nom:'BOUGHAL', prenom:'OMAR', fonction:'Conducteur', equipe:'Équipe C', telephone:'', affectation:'', dateEmb:'2012-06-01'},
    {nom:'HAMMOUD', prenom:'Jalal', fonction:'Conducteur', equipe:'Équipe A', telephone:'', affectation:'', dateEmb:'2012-06-01'},
    {nom:'LECHGUER', prenom:'ADIL', fonction:'Conducteur', equipe:'Équipe A', telephone:'', affectation:'', dateEmb:'2012-06-01'},
    {nom:'OUHSSAIN', prenom:'HASSAN', fonction:'Conducteur', equipe:'Équipe A', telephone:'', affectation:'', dateEmb:'2012-06-01'},
    {nom:'AZNAG', prenom:'ABDERRAHIM', fonction:'Conducteur', equipe:'Équipe A', telephone:'', affectation:'', dateEmb:'2012-06-01'},
    {nom:'NAAMANE', prenom:'SAID', fonction:'Conducteur', equipe:'Équipe B', telephone:'', affectation:'', dateEmb:'2012-06-01'},
    {nom:'QUISSEM', prenom:'MOHAMED', fonction:'Conducteur', equipe:'Équipe B', telephone:'', affectation:'', dateEmb:'2012-06-01'},
    {nom:'WIDDAR', prenom:'HASSAN', fonction:'Conducteur', equipe:'Équipe B', telephone:'', affectation:'', dateEmb:'2012-06-01'},
    {nom:'OUNACEUR', prenom:'ABDELLATIF', fonction:'Conducteur', equipe:'Équipe B', telephone:'', affectation:'', dateEmb:'2012-06-01'},
    {nom:'El moatassim', prenom:'Khalid', fonction:'Conducteur', equipe:'Équipe C', telephone:'', affectation:'', dateEmb:'2012-06-01'},
    {nom:'KHACHOUNE', prenom:'SLIMANE', fonction:'Conducteur', equipe:'Équipe C', telephone:'', affectation:'', dateEmb:'2012-06-01'},
    {nom:'SOUDRI', prenom:'ABDELATIF', fonction:'Conducteur', equipe:'Équipe C', telephone:'', affectation:'', dateEmb:'2012-06-01'},
    {nom:'AZEMMAR', prenom:'Said', fonction:'Conducteur', equipe:'Équipe C', telephone:'', affectation:'', dateEmb:'2012-06-01'},
    {nom:'Ladibi', prenom:'driss', fonction:'Conducteur', equipe:'Équipe A', telephone:'', affectation:'', dateEmb:'2012-11-01'},
    {nom:'ABAJBAJ', prenom:'ABDELLKABIR', fonction:'Conducteur', equipe:'Équipe A', telephone:'', affectation:'', dateEmb:'2012-11-01'},
    {nom:'OUMHIND', prenom:'ABDELAZIZ', fonction:'Conducteur', equipe:'Équipe A', telephone:'', affectation:'', dateEmb:'2013-11-01'},
    {nom:'QECHAI', prenom:'Smail', fonction:'Conducteur', equipe:'Équipe B', telephone:'', affectation:'', dateEmb:'2013-11-01'},
    {nom:'CHAGER BAGGARI', prenom:'ADIL', fonction:'Conducteur', equipe:'Équipe B', telephone:'', affectation:'', dateEmb:'2013-11-01'},
    {nom:'AMEZZANE', prenom:'MOHAMED', fonction:'Conducteur', equipe:'Équipe B', telephone:'', affectation:'', dateEmb:'2013-11-01'},
    {nom:'HADDI', prenom:'ABDELKARIM', fonction:'Conducteur', equipe:'Équipe B', telephone:'', affectation:'', dateEmb:'2013-11-01'},
    {nom:'GUEROUAZI', prenom:'HASSAN', fonction:'Conducteur', equipe:'Équipe C', telephone:'', affectation:'', dateEmb:'2013-11-01'},
    {nom:'FORATY', prenom:'MUSTAPHA', fonction:'Conducteur', equipe:'Équipe C', telephone:'', affectation:'', dateEmb:'2013-11-01'},
    {nom:'KASSI', prenom:'ABDERRAHIM', fonction:'Conducteur', equipe:'Équipe C', telephone:'', affectation:'', dateEmb:'2013-11-01'},
    {nom:'OUMHAND', prenom:'BRAHIM', fonction:'Conducteur', equipe:'Équipe C', telephone:'', affectation:'', dateEmb:'2015-02-01'},
    {nom:'TAKNIOUINE', prenom:'ABDELLAH', fonction:'Conducteur', equipe:'Équipe A', telephone:'', affectation:'', dateEmb:'2015-02-01'},
    {nom:'EDDAHANI', prenom:'Rdouane', fonction:'Conducteur', equipe:'Équipe A', telephone:'', affectation:'', dateEmb:'2015-02-01'},
    {nom:'LUIZI', prenom:'ABDERRAZAK', fonction:'Conducteur', equipe:'Équipe A', telephone:'', affectation:'', dateEmb:'2015-02-01'},
    {nom:'IBAALAL', prenom:'SAID', fonction:'Conducteur', equipe:'Équipe B', telephone:'', affectation:'', dateEmb:'2015-02-01'},
    {nom:'TABRANI', prenom:'MOHAMED', fonction:'Conducteur', equipe:'Équipe B', telephone:'', affectation:'', dateEmb:'2015-02-01'},
    {nom:'BOULAYOUNE', prenom:'Brahim', fonction:'Conducteur', equipe:'Équipe B', telephone:'', affectation:'', dateEmb:'2015-02-01'},
    {nom:'RAZKI', prenom:'MOHAMED', fonction:'Conducteur', equipe:'Équipe C', telephone:'', affectation:'', dateEmb:'2015-03-01'},
    {nom:'SAMOUDI', prenom:'ISMAIL', fonction:'Conducteur', equipe:'Équipe C', telephone:'', affectation:'', dateEmb:'2015-03-01'},
    {nom:'ZHIRI', prenom:'OMAR', fonction:'Conducteur', equipe:'Équipe C', telephone:'', affectation:'', dateEmb:'2015-03-01'},
    {nom:'TAOUI', prenom:'ABDERRAHIM', fonction:'Conducteur', equipe:'Équipe A', telephone:'', affectation:'', dateEmb:'2015-03-01'},
    {nom:'CHMALI', prenom:'Mohammed', fonction:'Conducteur', equipe:'Équipe A', telephone:'', affectation:'', dateEmb:'2015-03-01'},
    {nom:'ZOHAIRI', prenom:'RACHID', fonction:'Conducteur', equipe:'Équipe A', telephone:'', affectation:'', dateEmb:'2015-03-01'},
    {nom:'JELMOUSSI', prenom:'AHMED', fonction:'Conducteur', equipe:'Équipe B', telephone:'', affectation:'', dateEmb:'2015-03-01'},
    {nom:'BETOT', prenom:'ANOUAR', fonction:'Conducteur', equipe:'Équipe B', telephone:'', affectation:'', dateEmb:'2015-03-01'},
    {nom:'MOUTMIR', prenom:'el houssaine', fonction:'Conducteur', equipe:'Équipe B', telephone:'', affectation:'', dateEmb:'2016-02-01'},
    {nom:'FARIK', prenom:'MOHAMED', fonction:'Conducteur', equipe:'Équipe C', telephone:'', affectation:'', dateEmb:'2016-02-01'},
    {nom:'EL BAZ', prenom:'SABER', fonction:'Conducteur', equipe:'Équipe C', telephone:'', affectation:'', dateEmb:'2016-04-01'},
    {nom:'NAIT LHAJ', prenom:'KAMAL', fonction:'Conducteur', equipe:'Équipe C', telephone:'', affectation:'', dateEmb:'2016-04-01'},
    {nom:'NIFQUIRANE', prenom:'MOHAMED', fonction:'Conducteur', equipe:'Équipe A', telephone:'', affectation:'', dateEmb:'2016-04-01'},
    {nom:'DEHANI', prenom:'YASSINE', fonction:'Conducteur', equipe:'Équipe A', telephone:'', affectation:'', dateEmb:'2016-04-01'},
    {nom:'EL BAHJAOUI', prenom:'LAHCEN', fonction:'Conducteur', equipe:'Équipe A', telephone:'', affectation:'', dateEmb:'2016-04-01'},
    {nom:'BOUMESHOUL', prenom:'MOHAMED', fonction:'Conducteur', equipe:'Équipe B', telephone:'', affectation:'', dateEmb:'2016-04-01'},
    {nom:'BENAKKA', prenom:'HASSAN', fonction:'Conducteur', equipe:'Équipe B', telephone:'', affectation:'', dateEmb:'2016-05-01'},
    {nom:'ASGUAYANE', prenom:'ES-SAID', fonction:'Conducteur', equipe:'Équipe B', telephone:'', affectation:'', dateEmb:'2016-05-01'},
    {nom:'AIT BRIK', prenom:'RACHID', fonction:'Conducteur', equipe:'Équipe C', telephone:'', affectation:'', dateEmb:'2016-05-01'},
    {nom:'CHARHBILI', prenom:'MOHAMME', fonction:'Conducteur', equipe:'Équipe C', telephone:'', affectation:'', dateEmb:'2016-05-01'},
    {nom:'AIT EL CAID', prenom:'MOHAMED', fonction:'Conducteur', equipe:'Équipe C', telephone:'', affectation:'', dateEmb:'2016-12-01'},
    {nom:'ES-SABERY', prenom:'YCHOU', fonction:'Conducteur', equipe:'Équipe A', telephone:'', affectation:'', dateEmb:'2016-12-01'},
    {nom:'BOUHSSAINE', prenom:'ABDELLATIF', fonction:'Conducteur', equipe:'Équipe A', telephone:'', affectation:'', dateEmb:'2016-12-01'}
  ];
  personnelList.forEach(function(p) { p.id = uid(); });
  STORE.personnel = personnelList;
  var d = new Date().toISOString().slice(0,10);
  var e1 = STORE.engins[0].id, e2 = STORE.engins[4].id;
  var pp1 = STORE.personnel[0].id, pp2 = STORE.personnel[2].id;
  STORE.saisies = [
    {id:uid(), dateDebut:d, heureDebut:'06:00', dateFin:d, heureFin:'14:00', duree:8, enginId:e1, conducteurId:pp1, typeInter:'Maintenance préventive', heuresFonct:7, panne:0, arret:1, activite:'Graissage complet', pieces:'', obsTech:'Niveaux OK', causePanne:'', solution:'', gasoil:180, gasoilCout:144000, dateRav:d, hv68:0, hv68Com:'', s30:2, s30Com:'Vidange', s50:0, s50Com:'', w15w40:0, w15w40Com:'', autran:0, autranCom:'', w85w140:0, w85w140Com:'', flexDiam:'', flexEmbout:'', flexJupe:'', flexQte:0, flexObs:'', pneuAvgMarque:'', pneuAvgType:'', pneuAvgDate:'', pneuAvgFourn:'', pneuAvgObs:'', pneuAvdMarque:'', pneuAvdType:'', pneuAvdDate:'', pneuAvdFourn:'', pneuAvdObs:'', pneuArgMarque:'', pneuArgType:'', pneuArgDate:'', pneuArgFourn:'', pneuArgObs:'', pneuArdMarque:'', pneuArdType:'', pneuArdDate:'', pneuArdFourn:'', pneuArdObs:'', faitMarquant:'Non', etatActivite:'Fait', obs:'RAS'},
    {id:uid(), dateDebut:d, heureDebut:'06:00', dateFin:d, heureFin:'15:00', duree:9, enginId:e2, conducteurId:pp2, typeInter:'Réparation', heuresFonct:8, panne:1, arret:0, activite:'Changement pneu AVD', pieces:'Pneu AVD', obsTech:'Pression OK', causePanne:'Crevaison', solution:'Remplacement', gasoil:220, gasoilCout:176000, dateRav:d, hv68:0, hv68Com:'', s30:0, s30Com:'', s50:1, s50Com:'Appoint', w15w40:0, w15w40Com:'', autran:0, autranCom:'', w85w140:0, w85w140Com:'', flexDiam:'', flexEmbout:'', flexJupe:'', flexQte:0, flexObs:'', pneuAvgMarque:'', pneuAvgType:'', pneuAvgDate:'', pneuAvgFourn:'', pneuAvgObs:'', pneuAvdMarque:'MICHELIN', pneuAvdType:'Neuf', pneuAvdDate:d, pneuAvdFourn:'SOGEPA', pneuAvdObs:'', pneuArgMarque:'', pneuArgType:'', pneuArgDate:'', pneuArgFourn:'', pneuArgObs:'', pneuArdMarque:'', pneuArdType:'', pneuArdDate:'', pneuArdFourn:'', pneuArdObs:'', faitMarquant:'Oui', etatActivite:'Fait', obs:'Changement pneu AVD'}
  ];
  saveData();
}

// --- INIT ---
function purgeEnginesByDesignation(designations) {
  var flag = 'purged_' + designations.join('_').replace(/\//g,'');
  if (localStorage.getItem(flag)) return;
  var toRemove = STORE.engins.filter(function(e) {
    return designations.some(function(d){ return e.designation === d; });
  }).map(function(e){ return e.id; });
  if (!toRemove.length) { localStorage.setItem(flag,'1'); return; }
  STORE.engins      = STORE.engins.filter(function(e){ return toRemove.indexOf(e.id) < 0; });
  STORE.saisies     = STORE.saisies.filter(function(s){ return toRemove.indexOf(s.enginId) < 0; });
  STORE.pannes      = STORE.pannes.filter(function(p){ return toRemove.indexOf(p.enginId) < 0; });
  STORE.maintenance = STORE.maintenance.filter(function(m){ return toRemove.indexOf(m.enginId) < 0; });
  STORE.affectations= STORE.affectations.filter(function(a){ return toRemove.indexOf(a.enginId) < 0; });
  if (STORE.carburant) STORE.carburant = STORE.carburant.filter(function(c){ return toRemove.indexOf(c.enginId) < 0; });
  saveData();
  localStorage.setItem(flag,'1');
  console.log('Engins supprimés :', designations.join(', '));
}
function initApp() {
  document.getElementById('currentDate').textContent = new Date().toLocaleDateString('fr-FR', {weekday:'long', year:'numeric', month:'long', day:'numeric'});
  var overlay = document.getElementById('loadingOverlay');
  loadData().then(function() {
    if (!STORE.engins.length) seedDemoData();
    purgeEnginesByDesignation(['CAT R1600 H N°10','CAT R1600 H N°11','CAT R1600 H N°12','CAT R1600 H N°13']);
    renderAll(); initMensuel();
    if (overlay) overlay.style.display = 'none';
  }).catch(function() {
    if (!STORE.engins.length) seedDemoData();
    purgeEnginesByDesignation(['CAT R1600 H N°10','CAT R1600 H N°11','CAT R1600 H N°12','CAT R1600 H N°13']);
    renderAll(); initMensuel();
    if (overlay) overlay.style.display = 'none';
  });
}

// --- AFFECTATIONS ---
function updateAffectSelects() {
  var ap = document.getElementById('affectPersonnel');
  var ae = document.getElementById('affectEngin');
  if (ap) ap.innerHTML = '<option value="">-- Personnel --</option>' + STORE.personnel.map(function(p) { return '<option value="'+p.id+'">'+p.nom+' '+p.prenom+'</option>'; }).join('');
  if (ae) ae.innerHTML = '<option value="">-- Engin --</option>' + STORE.engins.map(function(e) { return '<option value="'+e.id+'">'+e.designation+'</option>'; }).join('');
}
function renderAffectations() {
  var tb = document.getElementById('affectationsTable'); if (!tb) return;
  tb.innerHTML = STORE.affectations.map(function(a) {
    var p = STORE.personnel.find(function(x) { return x.id === a.personnelId; });
    var e = STORE.engins.find(function(x) { return x.id === a.enginId; });
    return '<tr><td>'+(p?p.nom+' '+p.prenom:'-')+'</td><td>'+(e?e.designation:'-')+'</td><td>'+a.poste+'</td><td>'+a.equipe+'</td><td>'+a.dateDebut+'</td><td><span class="badge bg-success">Active</span></td><td><button class="btn btn-sm btn-outline-danger btn-sm-action" onclick="deleteAffectation(\''+a.id+'\')"><i class="bi bi-trash"></i></button></td></tr>';
  }).join('');
}
function saveAffectation() {
  var pId = document.getElementById('affectPersonnel').value;
  var eId = document.getElementById('affectEngin').value;
  if (!pId || !eId) { alert('Sélectionnez personnel et engin.'); return; }
  STORE.affectations.push({ id: uid(), personnelId: pId, enginId: eId, poste: document.getElementById('affectPoste').value, equipe: document.getElementById('affectEquipe').value, dateDebut: document.getElementById('affectDate').value || new Date().toISOString().slice(0,10) });
  saveData(); renderAffectations();
}
function deleteAffectation(id) { if (confirm('Supprimer ?')) { STORE.affectations = STORE.affectations.filter(function(a) { return a.id !== id; }); saveData(); renderAffectations(); } }

// --- PANNES ---
function updatePanneSelects() {
  var pe = document.getElementById('panneEngin');
  var pm = document.getElementById('panneMecanicien');
  if (pe) pe.innerHTML = '<option value="">-- Engin --</option>' + STORE.engins.map(function(e) { return '<option value="'+e.id+'">'+e.designation+'</option>'; }).join('');
  if (pm) pm.innerHTML = '<option value="">-- Mécanicien / Opérateur --</option>' + STORE.personnel.filter(function(p) { return p.fonction === 'Mécanicien' || p.fonction === 'Opérateur'; }).map(function(p) { return '<option value="'+p.id+'">'+p.nom+' '+p.prenom+' ('+p.fonction+')</option>'; }).join('');
}
function renderPannes() {
  var tb = document.getElementById('pannesTable'); if (!tb) return;
  tb.innerHTML = STORE.pannes.map(function(p) {
    var e = STORE.engins.find(function(x) { return x.id === p.enginId; });
    var m = STORE.personnel.find(function(x) { return x.id === p.mecanicienId; });
    var sc = p.statut === 'Résolue' ? 'bg-success' : p.statut === 'En cours' ? 'bg-danger' : 'bg-warning text-dark';
    return '<tr><td>'+p.date+'</td><td>'+(e?e.designation:'-')+'</td><td>'+p.type+'</td><td>'+(p.description||'-')+'</td><td>'+(m?m.nom:'-')+'</td><td>'+p.duree+'h</td><td><span class="badge '+sc+'">'+p.statut+'</span></td><td><button class="btn btn-sm btn-outline-light btn-sm-action" onclick="editPanne(\''+p.id+'\')"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-danger btn-sm-action" onclick="deletePanne(\''+p.id+'\')"><i class="bi bi-trash"></i></button></td></tr>';
  }).join('');
}
function savePanne() {
  var id = document.getElementById('panneId').value || uid();
  var obj = { id:id, date:document.getElementById('panneDate').value, enginId:document.getElementById('panneEngin').value, type:document.getElementById('panneType').value, mecanicienId:document.getElementById('panneMecanicien').value, duree:+document.getElementById('panneDuree').value||0, statut:document.getElementById('panneStatut').value, description:document.getElementById('panneDesc').value };
  var idx = STORE.pannes.findIndex(function(p) { return p.id === id; });
  if (idx >= 0) STORE.pannes[idx] = obj; else STORE.pannes.push(obj);
  document.getElementById('panneId').value = '';
  saveData(); renderPannes();
}
function editPanne(id) {
  var p = STORE.pannes.find(function(x) { return x.id === id; }); if (!p) return;
  document.getElementById('panneId').value = p.id;
  document.getElementById('panneDate').value = p.date;
  document.getElementById('panneEngin').value = p.enginId;
  document.getElementById('panneType').value = p.type;
  document.getElementById('panneMecanicien').value = p.mecanicienId || '';
  document.getElementById('panneDuree').value = p.duree;
  document.getElementById('panneStatut').value = p.statut;
  document.getElementById('panneDesc').value = p.description || '';
  navTo('pannes');
}
function deletePanne(id) { if (confirm('Supprimer ?')) { STORE.pannes = STORE.pannes.filter(function(p) { return p.id !== id; }); saveData(); renderPannes(); } }

// --- MAINTENANCE ---
function updateMaintSelects() {
  var me = document.getElementById('maintEngin');
  if (me) me.innerHTML = '<option value="">-- Engin --</option>' + STORE.engins.map(function(e) { return '<option value="'+e.id+'">'+e.designation+'</option>'; }).join('');
  var mfe = document.getElementById('maintFilterEngin');
  if (mfe) { var cur = mfe.value; mfe.innerHTML = '<option value="">Tous les engins</option>' + STORE.engins.map(function(e) { return '<option value="'+e.id+'"'+(e.id===cur?' selected':'')+'>'+e.designation+'</option>'; }).join(''); }
}
function renderMaintenance() {
  renderProchainEntretiens();
  var deb=(document.getElementById('maintFilterDeb')||{}).value||'';
  var fin=(document.getElementById('maintFilterFin')||{}).value||'';
  var engF=(document.getElementById('maintFilterEngin')||{}).value||'';
  var stF=(document.getElementById('maintFilterStatut')||{}).value||'';
  var data=STORE.maintenance.filter(function(m){
    var mFin=m.dateFin||m.date||'';
    if(deb&&mFin<deb)return false;
    if(fin&&(m.date||'')>fin)return false;
    if(engF&&m.enginId!==engF)return false;
    if(stF&&m.statut!==stF)return false;
    return true;
  });
  data.sort(function(a,b){return (a.date||'')<(b.date||'')?-1:1;});
  var tb=document.getElementById('maintenanceTable'); if(!tb) return;
  tb.innerHTML=data.length?data.map(function(m){
    var e=STORE.engins.find(function(x){return x.id===m.enginId;});
    var sc=m.statut==='Terminé'?'bg-success':m.statut==='En cours'?'bg-info':m.statut==='Annulé'?'bg-secondary':'bg-warning text-dark';
    return '<tr><td>'+m.date+'</td><td>'+(m.dateFin||'—')+'</td><td>'+(e?e.designation:'-')+'</td><td>'+m.type+'</td><td>'+(m.description||'-')+'</td><td>'+m.compteur+'</td><td><span class="badge '+sc+'">'+m.statut+'</span></td><td><button class="btn btn-sm btn-outline-light btn-sm-action" onclick="editMaintenance(\''+m.id+'\')"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-danger btn-sm-action" onclick="deleteMaintenance(\''+m.id+'\')"><i class="bi bi-trash"></i></button></td></tr>';
  }).join(''):'<tr><td colspan="8" class="text-center text-muted p-3">Aucune maintenance dans cette période.</td></tr>';
  if((document.getElementById('maintGanttView')||{}).style&&document.getElementById('maintGanttView').style.display!=='none') renderMaintenanceGantt(data);
}
function saveMaintenance() {
  var id = document.getElementById('maintId').value || uid();
  var obj = { id:id, date:document.getElementById('maintDate').value, dateFin:document.getElementById('maintDateFin').value, enginId:document.getElementById('maintEngin').value, type:document.getElementById('maintType').value, compteur:+document.getElementById('maintCompteur').value||0, description:document.getElementById('maintDesc').value, statut:document.getElementById('maintStatut').value };
  var idx = STORE.maintenance.findIndex(function(m) { return m.id === id; });
  if (idx >= 0) STORE.maintenance[idx] = obj; else STORE.maintenance.push(obj);
  document.getElementById('maintId').value = ''; document.getElementById('maintDateFin').value = '';
  saveData(); renderMaintenance();
}
function editMaintenance(id) {
  var m = STORE.maintenance.find(function(x) { return x.id === id; }); if (!m) return;
  document.getElementById('maintId').value = m.id;
  document.getElementById('maintDate').value = m.date;
  document.getElementById('maintDateFin').value = m.dateFin || '';
  document.getElementById('maintEngin').value = m.enginId;
  document.getElementById('maintType').value = m.type;
  document.getElementById('maintCompteur').value = m.compteur;
  document.getElementById('maintDesc').value = m.description || '';
  document.getElementById('maintStatut').value = m.statut;
  navTo('maintenance');
}
function switchMaintenanceView(v) {
  var tv=document.getElementById('maintTableView'), gv=document.getElementById('maintGanttView');
  var bt=document.getElementById('btnMaintTable'), bg=document.getElementById('btnMaintGantt');
  if (v==='gantt') {
    if(tv) tv.style.display='none'; if(gv) gv.style.display='';
    if(bt) bt.className='btn btn-sm btn-outline-warning'; if(bg) bg.className='btn btn-sm btn-info';
    var deb=(document.getElementById('maintFilterDeb')||{}).value||'';
    var fin=(document.getElementById('maintFilterFin')||{}).value||'';
    var engF=(document.getElementById('maintFilterEngin')||{}).value||'';
    var stF=(document.getElementById('maintFilterStatut')||{}).value||'';
    var data=STORE.maintenance.filter(function(m){
      var mFin=m.dateFin||m.date||'';
      if(deb&&mFin<deb)return false; if(fin&&(m.date||'')>fin)return false;
      if(engF&&m.enginId!==engF)return false; if(stF&&m.statut!==stF)return false; return true;
    });
    renderMaintenanceGantt(data);
  } else {
    if(tv) tv.style.display=''; if(gv) gv.style.display='none';
    if(bt) bt.className='btn btn-sm btn-warning'; if(bg) bg.className='btn btn-sm btn-outline-info';
  }
}
function renderMaintenanceGantt(filteredData) {
  var container=document.getElementById('maintGantt'); if(!container) return;
  var deb=(document.getElementById('maintFilterDeb')||{}).value;
  var fin=(document.getElementById('maintFilterFin')||{}).value;
  if(!deb||!fin){container.innerHTML='<p class="text-center p-4" style="color:#888">Sélectionnez une période pour afficher le planning Gantt.</p>';return;}
  var startD=new Date(deb+'T00:00:00'), endD=new Date(fin+'T00:00:00');
  if(startD>endD){container.innerHTML='<p class="text-center p-4" style="color:#e53e3e">Date début doit être avant date fin.</p>';return;}
  var totalMs=endD-startD+86400000, totalDays=Math.round(totalMs/86400000);
  var sColors={'Planifié':'#ecc94b','En cours':'#63b3ed','Terminé':'#48bb78','Annulé':'#718096'};
  var sTColors={'Planifié':'#000','En cours':'#fff','Terminé':'#fff','Annulé':'#fff'};
  var today=new Date(); today.setHours(0,0,0,0);
  var LW=200;
  var byEngin={}, engOrder=[];
  (filteredData||[]).forEach(function(m){if(!byEngin[m.enginId]){byEngin[m.enginId]=[];engOrder.push(m.enginId);}byEngin[m.enginId].push(m);});
  // Month header
  var monthHtml='', curMo=-1, curMoStart=0, curMoDays=0;
  var MNAMES=['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  for(var i=0;i<=totalDays;i++){
    var dd=new Date(startD.getTime()+i*86400000);
    if(dd.getMonth()!==curMo){
      if(curMo>=0) monthHtml+='<span style="position:absolute;left:'+(curMoStart/totalDays*100).toFixed(2)+'%;width:'+(curMoDays/totalDays*100).toFixed(2)+'%;text-align:center;font-size:.63rem;font-weight:700;color:#d4af37;border-right:1px solid rgba(212,175,55,.25);padding:1px 0;overflow:hidden">'+MNAMES[curMo]+' '+new Date(startD.getTime()+curMoStart*86400000).getFullYear()+'</span>';
      curMo=dd.getMonth(); curMoStart=i; curMoDays=0;
    } curMoDays++;
  }
  if(curMoDays>0) monthHtml+='<span style="position:absolute;left:'+(curMoStart/totalDays*100).toFixed(2)+'%;width:'+(curMoDays/totalDays*100).toFixed(2)+'%;text-align:center;font-size:.63rem;font-weight:700;color:#d4af37;border-right:1px solid rgba(212,175,55,.25);padding:1px 0;overflow:hidden">'+MNAMES[curMo]+' '+new Date(startD.getTime()+curMoStart*86400000).getFullYear()+'</span>';
  // Days header
  var daysHtml='';
  for(var i=0;i<totalDays;i++){
    var dd=new Date(startD.getTime()+i*86400000);
    var isWk=dd.getDay()===0||dd.getDay()===6;
    var isTod=dd.getTime()===today.getTime();
    var pct=(i/totalDays*100).toFixed(3), w=(1/totalDays*100).toFixed(3);
    var bg2=isTod?'rgba(212,175,55,.3)':isWk?'rgba(255,255,255,.04)':'transparent';
    var col2=isTod?'#d4af37':isWk?'#666':'#555';
    daysHtml+='<span style="position:absolute;left:'+pct+'%;width:'+w+'%;height:100%;background:'+bg2+';border-left:1px solid rgba(255,255,255,.04);text-align:center;font-size:.58rem;color:'+col2+';overflow:hidden;line-height:18px">'+dd.getDate()+'</span>';
  }
  var todayPct=-1;
  if(today>=startD&&today<=endD) todayPct=((today-startD)/(totalMs-86400000)*100).toFixed(2);
  // Rows
  var rowsHtml='';
  engOrder.forEach(function(engId,ri){
    var eng=STORE.engins.find(function(e){return e.id===engId;});
    var tasks=byEngin[engId];
    var rowBg=ri%2===0?'#0f0f08':'#131309';
    rowsHtml+='<div style="display:flex;border-bottom:1px solid rgba(255,255,255,.05);background:'+rowBg+'">';
    rowsHtml+='<div style="min-width:'+LW+'px;max-width:'+LW+'px;padding:5px 8px;font-size:.72rem;font-weight:600;color:#e2e8f0;border-right:1px solid rgba(212,175,55,.12);display:flex;align-items:center;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+(eng?eng.designation:'?')+'</div>';
    rowsHtml+='<div style="flex:1;position:relative;height:34px">';
    for(var i=0;i<totalDays;i++){var dd=new Date(startD.getTime()+i*86400000);if(dd.getDay()===0||dd.getDay()===6){var pct=(i/totalDays*100).toFixed(3);var w=(1/totalDays*100).toFixed(3);rowsHtml+='<div style="position:absolute;left:'+pct+'%;width:'+w+'%;height:100%;background:rgba(255,255,255,.025)"></div>';}}
    tasks.forEach(function(task){
      var ts=new Date((task.date||'')+'T00:00:00');
      var te=task.dateFin?new Date(task.dateFin+'T00:00:00'):new Date(ts);
      if(ts>endD||te<startD)return;
      if(ts<startD)ts=startD; if(te>endD)te=endD;
      var sp=((ts-startD)/totalMs*100).toFixed(2);
      var ep=(((te-startD)+86400000)/totalMs*100).toFixed(2);
      var wp=Math.max(1,parseFloat(ep)-parseFloat(sp));
      var col=sColors[task.statut]||'#d4af37', tcol=sTColors[task.statut]||'#000';
      rowsHtml+='<div title="'+task.type+(task.description?' — '+task.description:'')+' | Du '+task.date+' au '+(task.dateFin||task.date)+' | '+task.statut+'" style="position:absolute;left:'+sp+'%;width:'+wp+'%;height:22px;top:6px;background:'+col+';border-radius:4px;font-size:.61rem;color:'+tcol+';font-weight:400;padding:0 5px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;display:flex;align-items:center;box-shadow:0 1px 4px rgba(0,0,0,.5);cursor:default">'+(task.description||task.type)+'</div>';
    });
    if(todayPct>=0) rowsHtml+='<div style="position:absolute;left:'+todayPct+'%;width:2px;height:100%;background:rgba(212,175,55,.75);z-index:9"></div>';
    rowsHtml+='</div></div>';
  });
  if(!engOrder.length) rowsHtml='<div class="text-center p-4" style="color:#888">Aucune maintenance planifiée dans cette période.</div>';
  var legend='<div style="display:flex;gap:14px;padding:8px 4px;flex-wrap:wrap;border-top:1px solid rgba(255,255,255,.07);margin-top:4px">';
  Object.keys(sColors).forEach(function(s){legend+='<span style="display:inline-flex;align-items:center;gap:5px;font-size:.72rem;color:#bbb"><span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:'+sColors[s]+'"></span>'+s+'</span>';});
  legend+='<span style="display:inline-flex;align-items:center;gap:5px;font-size:.72rem;color:#bbb"><span style="display:inline-block;width:3px;height:13px;background:rgba(212,175,55,.75)"></span>Aujourd\'hui</span></div>';
  container.innerHTML=
    '<div style="overflow-x:auto"><div style="min-width:700px">'+
    '<div style="display:flex;border-bottom:1px solid rgba(212,175,55,.15)"><div style="min-width:'+LW+'px;border-right:1px solid rgba(212,175,55,.12);background:#0d0b00"></div><div style="flex:1;position:relative;height:18px">'+monthHtml+'</div></div>'+
    '<div style="display:flex;border-bottom:2px solid rgba(212,175,55,.3)"><div style="min-width:'+LW+'px;padding:2px 8px;font-size:.65rem;font-weight:700;color:#d4af37;border-right:1px solid rgba(212,175,55,.12);background:#0d0b00">Engin</div><div style="flex:1;position:relative;height:18px">'+daysHtml+'</div></div>'+
    rowsHtml+'</div></div>'+legend;
}
function deleteMaintenance(id) { if (confirm('Supprimer ?')) { STORE.maintenance = STORE.maintenance.filter(function(m) { return m.id !== id; }); saveData(); renderMaintenance(); } }

// --- CARBURANT ---
function updateCarbSelects() {
  var ce = document.getElementById('carbEngin');
  if (ce) ce.innerHTML = '<option value="">-- Engin --</option>' + STORE.engins.map(function(e) { return '<option value="'+e.id+'">'+e.designation+'</option>'; }).join('');
}
function renderCarburant() {
  var tb = document.getElementById('carburantTable'); if (!tb) return;
  tb.innerHTML = STORE.carburant.map(function(c) {
    var e = STORE.engins.find(function(x) { return x.id === c.enginId; });
    return '<tr><td>'+c.date+'</td><td>'+(e?e.designation:'-')+'</td><td>'+c.type+'</td><td>'+c.quantite+' L</td><td>'+c.compteur+'</td><td>'+(c.observations||'-')+'</td><td><button class="btn btn-sm btn-outline-light btn-sm-action" onclick="editCarburant(\''+c.id+'\')"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-danger btn-sm-action" onclick="deleteCarburant(\''+c.id+'\')"><i class="bi bi-trash"></i></button></td></tr>';
  }).join('');
}
function saveCarburant() {
  var id = document.getElementById('carbId').value || uid();
  var obj = { id:id, date:document.getElementById('carbDate').value, enginId:document.getElementById('carbEngin').value, type:document.getElementById('carbType').value, quantite:+document.getElementById('carbQte').value||0, compteur:+document.getElementById('carbCompteur').value||0, observations:document.getElementById('carbObs').value };
  var idx = STORE.carburant.findIndex(function(c) { return c.id === id; });
  if (idx >= 0) STORE.carburant[idx] = obj; else STORE.carburant.push(obj);
  document.getElementById('carbId').value = '';
  saveData(); renderCarburant();
}
function editCarburant(id) {
  var c = STORE.carburant.find(function(x) { return x.id === id; }); if (!c) return;
  document.getElementById('carbId').value = c.id;
  document.getElementById('carbDate').value = c.date;
  document.getElementById('carbEngin').value = c.enginId;
  document.getElementById('carbType').value = c.type;
  document.getElementById('carbQte').value = c.quantite;
  document.getElementById('carbCompteur').value = c.compteur;
  document.getElementById('carbObs').value = c.observations || '';
  navTo('carburant');
}
function deleteCarburant(id) { if (confirm('Supprimer ?')) { STORE.carburant = STORE.carburant.filter(function(c) { return c.id !== id; }); saveData(); renderCarburant(); } }

// --- TARIFS ---
function renderTarifs() {
  var actuels = {};
  STORE.tarifs.forEach(function(t) {
    if (!actuels[t.produit] || t.dateEffet > actuels[t.produit].dateEffet) actuels[t.produit] = t;
  });
  var ta = document.getElementById('tarifsActuelsTable');
  var th = document.getElementById('tarifsHistoriqueTable');
  if (ta) ta.innerHTML = Object.values(actuels).map(function(t) {
    return '<tr><td>'+t.produit+'</td><td>'+t.prix+' DH</td><td>'+t.dateEffet+'</td><td><button class="btn btn-sm btn-outline-danger btn-sm-action" onclick="deleteTarif(\''+t.id+'\')"><i class="bi bi-trash"></i></button></td></tr>';
  }).join('');
  if (th) th.innerHTML = STORE.tarifs.sort(function(a,b) { return b.dateEffet > a.dateEffet ? 1 : -1; }).map(function(t) {
    return '<tr><td>'+t.produit+'</td><td>'+t.prix+' DH</td><td>'+t.dateEffet+'</td><td>'+(t.dateEnreg||'-')+'</td></tr>';
  }).join('');
}
function saveTarif() {
  var produit = document.getElementById('tarifProduit').value;
  var prix = +document.getElementById('tarifPrix').value;
  var dateEffet = document.getElementById('tarifDate').value;
  if (!produit || !prix || !dateEffet) { alert('Remplissez tous les champs.'); return; }
  STORE.tarifs.push({ id: uid(), produit: produit, prix: prix, dateEffet: dateEffet, dateEnreg: new Date().toISOString().slice(0,10) });
  document.getElementById('tarifProduit').value = '';
  document.getElementById('tarifPrix').value = '0';
  document.getElementById('tarifDate').value = '';
  saveData(); renderTarifs();
}
function deleteTarif(id) { if (confirm('Supprimer ?')) { STORE.tarifs = STORE.tarifs.filter(function(t) { return t.id !== id; }); saveData(); renderTarifs(); } }

// --- TARIFS PNEUS ---
function toggleAutreDimension() {
  var sel = document.getElementById('pneuDimension');
  var wrap = document.getElementById('autreDimensionWrap');
  if (!sel || !wrap) return;
  wrap.style.display = sel.value === 'autre' ? '' : 'none';
  if (sel.value !== 'autre') document.getElementById('pneuAutreDimension').value = '';
}
function savePneuTarif() {
  var dimSel = document.getElementById('pneuDimension').value;
  var dimAutre = document.getElementById('pneuAutreDimension').value.trim();
  var dimension = dimSel === 'autre' ? dimAutre : dimSel;
  var fournisseur = document.getElementById('pneuFournisseur').value;
  var prix = +document.getElementById('pneuPrix').value;
  var dateEffet = document.getElementById('pneuTarifDate').value;
  var obs = document.getElementById('pneuObs').value.trim();
  if (!dimension) { alert('Veuillez sélectionner ou saisir une dimension.'); return; }
  if (!fournisseur) { alert('Veuillez choisir un fournisseur.'); return; }
  if (!prix || prix <= 0) { alert('Prix invalide.'); return; }
  if (!dateEffet) { alert('Date d\'effet obligatoire.'); return; }
  STORE.pneuTarifs.push({ id: uid(), dimension: dimension, fournisseur: fournisseur, prix: prix, dateEffet: dateEffet, obs: obs, dateEnreg: new Date().toISOString().slice(0,10) });
  document.getElementById('pneuDimension').value = '';
  document.getElementById('pneuAutreDimension').value = '';
  document.getElementById('pneuFournisseur').value = '';
  document.getElementById('pneuPrix').value = '0';
  document.getElementById('pneuTarifDate').value = '';
  document.getElementById('pneuObs').value = '';
  document.getElementById('autreDimensionWrap').style.display = 'none';
  saveData(); renderPneuTarifs();
}
function renderPneuTarifs() {
  var actuels = {};
  STORE.pneuTarifs.forEach(function(t) {
    var key = t.dimension + '|' + t.fournisseur;
    if (!actuels[key] || t.dateEffet > actuels[key].dateEffet) actuels[key] = t;
  });
  var ta = document.getElementById('pneuTarifsActuelsTable');
  var th = document.getElementById('pneuTarifsHistTable');
  if (ta) ta.innerHTML = Object.values(actuels).length
    ? Object.values(actuels).map(function(t) {
        return '<tr><td><span class="badge bg-warning text-dark">'+t.dimension+'</span></td><td>'+t.fournisseur+'</td><td class="text-warning fw-bold">'+Number(t.prix).toLocaleString('fr-FR')+' DH</td><td>'+t.dateEffet+'</td><td><small class="text-muted">'+( t.obs||'—')+'</small></td>'
          +'<td><button class="btn btn-sm btn-outline-danger btn-sm-action" onclick="deletePneuTarif(\''+t.id+'\')"><i class="bi bi-trash"></i></button></td></tr>';
      }).join('')
    : '<tr><td colspan="6" class="text-center text-muted p-3">Aucun tarif pneu enregistré.</td></tr>';
  if (th) {
    var hist = STORE.pneuTarifs.slice().sort(function(a,b){ return b.dateEffet > a.dateEffet ? 1 : -1; });
    th.innerHTML = hist.length
      ? hist.map(function(t) {
          return '<tr><td><span class="badge bg-warning text-dark">'+t.dimension+'</span></td><td>'+t.fournisseur+'</td><td>'+Number(t.prix).toLocaleString('fr-FR')+' DH</td><td>'+t.dateEffet+'</td><td>'+(t.dateEnreg||'—')+'</td><td><small class="text-muted">'+(t.obs||'—')+'</small></td></tr>';
        }).join('')
      : '<tr><td colspan="6" class="text-center text-muted p-3">Aucun historique.</td></tr>';
  }
}
function deletePneuTarif(id) { if (confirm('Supprimer ce tarif pneu ?')) { STORE.pneuTarifs = STORE.pneuTarifs.filter(function(t){ return t.id !== id; }); saveData(); renderPneuTarifs(); } }
function getPneuTarifActuel(dimension, fournisseur) {
  var match = null;
  STORE.pneuTarifs.forEach(function(t) {
    if (t.dimension === dimension && (!fournisseur || t.fournisseur === fournisseur) && (!match || t.dateEffet > match.dateEffet)) match = t;
  });
  return match ? match.prix : 0;
}

function getTarifActuel(produit) {
  var match = null;
  STORE.tarifs.forEach(function(t) { if (t.produit === produit && (!match || t.dateEffet > match.dateEffet)) match = t; });
  return match ? match.prix : 0;
}

// --- VUE MENSUELLE ---
function initMensuel() {
  var sel = document.getElementById('mensuelAnnee');
  if (!sel) return;
  var y = new Date().getFullYear();
  sel.innerHTML = '';
  for (var i = y; i >= y - 5; i--) sel.innerHTML += '<option value="'+i+'">'+i+'</option>';
  document.getElementById('mensuelMois').value = ('0' + (new Date().getMonth()+1)).slice(-2);
  var me = document.getElementById('mensuelEngin');
  me.innerHTML = '<option value="">Tous les engins</option>' + STORE.engins.map(function(e) { return '<option value="'+e.id+'">'+e.designation+'</option>'; }).join('');
}
function loadMensuel() {
  var mois = document.getElementById('mensuelMois').value;
  var annee = document.getElementById('mensuelAnnee').value;
  var enginId = document.getElementById('mensuelEngin').value;
  var prefix = annee + '-' + mois;
  var daysInMonth = new Date(annee, +mois, 0).getDate();
  var engins = enginId ? STORE.engins.filter(function(e) { return e.id === enginId; }) : STORE.engins;
  // Build header
  var thead = document.getElementById('mensuelThead');
  var hRow = '<tr><th>Engin</th>';
  for (var d = 1; d <= daysInMonth; d++) hRow += '<th>' + d + '</th>';
  hRow += '<th>Total</th></tr>';
  thead.innerHTML = hRow;
  // Build body
  var tbody = document.getElementById('mensuelTbody');
  tbody.innerHTML = engins.map(function(eng) {
    var row = '<tr><td style="white-space:nowrap;font-size:.75rem">'+eng.designation.substring(0,18)+'</td>';
    var total = 0;
    for (var d = 1; d <= daysInMonth; d++) {
      var dateStr = prefix + '-' + ('0'+d).slice(-2);
      var val = STORE.saisies.filter(function(s) { return s.enginId === eng.id && s.dateDebut === dateStr; }).reduce(function(a,s) { return a + (s.duree||0); }, 0);
      total += val;
      row += '<td style="font-size:.7rem">' + (val ? val.toFixed(1) : '-') + '</td>';
    }
    row += '<td style="font-weight:bold;font-size:.75rem">' + total.toFixed(1) + '</td></tr>';
    return row;
  }).join('');
  updateMensuelCharts(prefix, daysInMonth, engins);
}
function updateMensuelCharts(prefix, daysInMonth, engins) {
  var labels = [];
  var heuresData = [], gasoilData = [], huilesData = [];
  for (var d = 1; d <= daysInMonth; d++) {
    labels.push(d);
    var dateStr = prefix + '-' + ('0'+d).slice(-2);
    var dayS = STORE.saisies.filter(function(s) { return engins.some(function(e) { return e.id === s.enginId; }) && s.dateDebut === dateStr; });
    heuresData.push(dayS.reduce(function(a,s) { return a + (s.duree||0); }, 0));
    gasoilData.push(dayS.reduce(function(a,s) { return a + (s.gasoil||0); }, 0));
    huilesData.push(dayS.reduce(function(a,s) { return a + (s.hv68||0)+(s.s30||0)+(s.s50||0)+(s.w15w40||0)+(s.autran||0)+(s.w85w140||0); }, 0));
  }
  var opt = { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{ticks:{color:'#94a3b8'}}, y:{ticks:{color:'#94a3b8'}, grid:{color:'#334155'}}} };
  if (charts.mHeures) charts.mHeures.destroy();
  if (charts.mGasoil) charts.mGasoil.destroy();
  if (charts.mHuiles) charts.mHuiles.destroy();
  charts.mHeures = new Chart(document.getElementById('chartMensuelHeures'), { type:'bar', data:{labels:labels, datasets:[{data:heuresData, backgroundColor:'#63b3ed'}]}, options:opt });
  charts.mGasoil = new Chart(document.getElementById('chartMensuelGasoil'), { type:'bar', data:{labels:labels, datasets:[{data:gasoilData, backgroundColor:'#f6ad55'}]}, options:opt });
  charts.mHuiles = new Chart(document.getElementById('chartMensuelHuiles'), { type:'bar', data:{labels:labels, datasets:[{data:huilesData, backgroundColor:'#48bb78'}]}, options:opt });
}

// --- ADMIN ---
function updateAdmin() {
  var ae = document.getElementById('adminTotalEngins');
  if (ae) ae.textContent = STORE.engins.length;
  var ap = document.getElementById('adminTotalPersonnel');
  if (ap) ap.textContent = STORE.personnel.length;
  var as = document.getElementById('adminTotalSaisies');
  if (as) as.textContent = STORE.saisies.length;
  var apn = document.getElementById('adminTotalPannes');
  if (apn) apn.textContent = STORE.pannes.length;
}
function exportJSON() {
  var blob = new Blob([JSON.stringify(STORE, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'export_parc_' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
}
function importJSON(ev) {
  var file = ev.target.files[0]; if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = JSON.parse(e.target.result);
      if (data.engins) STORE.engins = data.engins;
      if (data.personnel) STORE.personnel = data.personnel;
      if (data.saisies) STORE.saisies = data.saisies;
      if (data.affectations) STORE.affectations = data.affectations;
      if (data.pannes) STORE.pannes = data.pannes;
      if (data.maintenance) STORE.maintenance = data.maintenance;
      if (data.carburant) STORE.carburant = data.carburant;
      if (data.tarifs) STORE.tarifs = data.tarifs;
      saveData(); renderAll();
      alert('Import réussi !');
    } catch(err) { alert('Erreur: fichier invalide.'); }
  };
  reader.readAsText(file);
}
// --- UTILISATEURS ---
function renderUsers() {
  var tb = document.getElementById('usersTable'); if (!tb) return;
  tb.innerHTML = STORE.users.map(function(u) {
    var consult = u.canConsult !== false;
    var saisie  = u.canSaisie === true;
    var btnC = '<button onclick="toggleUserPerm(\''+u.id+'\',\'canConsult\')" title="Cliquer pour activer/désactiver" style="border:none;background:'+(consult?'rgba(212,175,55,.18)':'rgba(100,100,100,.15)')+';color:'+(consult?'#d4af37':'#666')+';border-radius:20px;padding:3px 10px;font-size:.78rem;cursor:pointer;transition:all .2s"><i class="bi bi-eye'+(consult?'-fill':'')+'" style="margin-right:3px"></i>Consultation</button>';
    var btnS = '<button onclick="toggleUserPerm(\''+u.id+'\',\'canSaisie\')" title="Cliquer pour activer/désactiver" style="border:none;background:'+(saisie?'rgba(72,187,120,.18)':'rgba(100,100,100,.15)')+';color:'+(saisie?'#48bb78':'#666')+';border-radius:20px;padding:3px 10px;font-size:.78rem;cursor:pointer;transition:all .2s"><i class="bi bi-pencil'+(saisie?'-fill':'')+'" style="margin-right:3px"></i>Saisie</button>';
    return '<tr><td><strong>'+u.username+'</strong></td><td>'+(u.nom||'-')+'</td><td class="d-flex gap-1 flex-wrap py-1">'+btnC+' '+btnS+'</td><td><button class="btn btn-sm btn-outline-light btn-sm-action" onclick="editUser(\''+u.id+'\')" title="Modifier"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-danger btn-sm-action" onclick="deleteUser(\''+u.id+'\')" title="Supprimer"><i class="bi bi-trash"></i></button></td></tr>';
  }).join('');
}
function toggleUserPerm(id, perm) {
  var u = STORE.users.find(function(x){return x.id===id;}); if(!u) return;
  if (perm === 'canConsult') u.canConsult = !(u.canConsult !== false);
  else if (perm === 'canSaisie') u.canSaisie = !u.canSaisie;
  saveData(); renderUsers();
}
function openUserModal() {
  document.getElementById('userId').value = '';
  document.getElementById('uUsername').value = '';
  document.getElementById('uPassword').value = '';
  document.getElementById('uNom').value = '';
  document.getElementById('uCanConsult').checked = true;
  document.getElementById('uCanSaisie').checked = false;
  new bootstrap.Modal(document.getElementById('userModal')).show();
}
function saveUser() {
  var id = document.getElementById('userId').value || uid();
  var username = document.getElementById('uUsername').value.trim();
  var password = document.getElementById('uPassword').value;
  if (!username || !password) { alert('Identifiant et mot de passe obligatoires.'); return; }
  if (username === 'admin') { alert('Ce nom est réservé.'); return; }
  var dup = STORE.users.find(function(u) { return u.username === username && u.id !== id; });
  if (dup) { alert('Cet identifiant existe déjà.'); return; }
  var obj = { id:id, username:username, password:password, nom:document.getElementById('uNom').value, canConsult:document.getElementById('uCanConsult').checked, canSaisie:document.getElementById('uCanSaisie').checked };
  var idx = STORE.users.findIndex(function(u) { return u.id === id; });
  if (idx >= 0) STORE.users[idx] = obj; else STORE.users.push(obj);
  saveData(); renderUsers();
  bootstrap.Modal.getInstance(document.getElementById('userModal')).hide();
}
function editUser(id) {
  var u = STORE.users.find(function(x) { return x.id === id; }); if (!u) return;
  document.getElementById('userId').value = u.id;
  document.getElementById('uUsername').value = u.username;
  document.getElementById('uPassword').value = u.password;
  document.getElementById('uNom').value = u.nom || '';
  document.getElementById('uCanConsult').checked = u.canConsult !== false;
  document.getElementById('uCanSaisie').checked = u.canSaisie === true;
  new bootstrap.Modal(document.getElementById('userModal')).show();
}
function deleteUser(id) { if (confirm('Supprimer cet utilisateur ?')) { STORE.users = STORE.users.filter(function(u) { return u.id !== id; }); saveData(); renderUsers(); } }

// --- EXTRACTION ---
function updateExtSelects() {
  var typeFilter = (document.getElementById('extType') || {}).value || '';
  // Types dropdown — dynamically from actual engin types
  var et = document.getElementById('extType');
  if (et) {
    var savedType = et.value;
    var types = [];
    STORE.engins.forEach(function(e) { if (e.type && types.indexOf(e.type) === -1) types.push(e.type); });
    types.sort();
    et.innerHTML = '<option value="">Tous les types</option>' + types.map(function(t) { return '<option'+(t===savedType?' selected':'')+'>'+t+'</option>'; }).join('');
  }
  // Engins dropdown — filtered by selected type
  var el = document.getElementById('extEngin');
  if (el) {
    var savedEngin = el.value;
    var engins = STORE.engins.filter(function(e) { return !typeFilter || e.type === typeFilter; });
    el.innerHTML = '<option value="">Tous les engins</option>' + engins.map(function(e) { return '<option value="'+e.id+'"'+(e.id===savedEngin?' selected':'')+'>'+e.designation+'</option>'; }).join('');
  }
}
function runExtraction() {
  var dateDeb = document.getElementById('extDateDeb').value;
  var dateFin = document.getElementById('extDateFin').value;
  var typeFilter = document.getElementById('extType').value;
  var enginFilter = document.getElementById('extEngin').value;
  var etatFilter = document.getElementById('extEtat').value;
  var fmFilter = document.getElementById('extFaitMarquant').checked;
  var filtered = STORE.saisies.filter(function(s) {
    var d = s.dateDebut || '';
    if (dateDeb && d < dateDeb) return false;
    if (dateFin && d > dateFin) return false;
    var eng = STORE.engins.find(function(e) { return e.id === s.enginId; });
    if (!eng) return false;
    if (typeFilter && (eng.type||'').trim() !== typeFilter.trim()) return false;
    if (enginFilter && s.enginId !== enginFilter) return false;
    var intv = s.interventions || [];
    if (etatFilter && !intv.some(function(i){ return i.statut === etatFilter; })) return false;
    if (fmFilter && !intv.some(function(i){ return i.faitMarquant; })) return false;
    return true;
  });
  var byEngin = {};
  filtered.forEach(function(s) {
    var eng = STORE.engins.find(function(e) { return e.id === s.enginId; });
    if (!eng) return;
    if (!byEngin[s.enginId]) byEngin[s.enginId] = { eng:eng, heures:0, gasoil:0, huiles:0, pneus:{avg:0,avd:0,arg:0,ard:0,total:0}, flex:0 };
    var g = byEngin[s.enginId];
    var _cF=+(s.compteurFin||0), _cD=+(s.compteurDebut||0);
    var _hm = (_cD>0 && _cF>_cD) ? (_cF-_cD) : Math.max(0, +(s.difference||s.duree||s.heuresFonct||0));
    g.heures += _hm;
    g.gasoil += +(s.gasoil || 0);
    if (s.huiles && s.huiles.length) {
      s.huiles.forEach(function(h) { g.huiles += +(h.qte || 0); });
    } else {
      g.huiles += (+(s.hv68||0))+(+(s.s30||0))+(+(s.s50||0))+(+(s.w15w40||0))+(+(s.autran||0))+(+(s.w85w140||0));
    }
    [['pneuAvg','avg'],['pneuAvd','avd'],['pneuArg','arg'],['pneuArd','ard']].forEach(function(p){ if (s[p[0]] && s[p[0]].statut === 'Changé') { g.pneus[p[1]]++; g.pneus.total++; } });
    g.flex += (s.flexibles || []).length;
  });
  var entries = Object.values(byEngin);
  var totH=0, totG=0, totHu=0, totP=0, totF=0;
  entries.forEach(function(g) { totH+=g.heures; totG+=g.gasoil; totHu+=g.huiles; totP+=g.pneus.total; totF+=g.flex; });
  document.getElementById('extKpi').innerHTML = [
    {v:entries.length,          l:'Engins concernés',  i:'bi-truck-front-fill', c:''},
    {v:totH.toFixed(1)+'h',    l:'Heures de marche',  i:'bi-clock-fill',       c:'text-info'},
    {v:totG.toFixed(0)+'L',    l:'Gasoil total',       i:'bi-fuel-pump',        c:'text-warning'},
    {v:totH>0?(totG/totH).toFixed(2)+' L/HM':'-', l:'Ratio Gasoil', i:'bi-calculator', c:'text-warning'},
    {v:totHu.toFixed(1)+'L',   l:'Huiles total',       i:'bi-droplet-half',     c:'text-primary'},
    {v:totH>0?(totHu/totH).toFixed(3)+' L/HM':'-', l:'Ratio Huiles', i:'bi-calculator', c:'text-primary'},
    {v:totP, l:'Pneus changés',    i:'bi-disc',             c:'text-success'},
    {v:totF, l:'Flexibles changés', i:'bi-hammer',           c:'text-danger'}
  ].map(function(k) { return '<div class="col-6 col-md-3"><div class="kpi-card"><div class="kpi-value '+k.c+'">'+k.v+'</div><div class="kpi-label"><i class="bi '+k.i+'"></i> '+k.l+'</div></div></div>'; }).join('');
  var rows = entries.map(function(g) {
    var rG = g.heures>0?(g.gasoil/g.heures).toFixed(2):'-';
    var rH = g.heures>0?(g.huiles/g.heures).toFixed(3):'-';
    return '<tr><td>'+g.eng.designation+'</td><td>'+(g.eng.type||'-')+'</td><td>'+g.heures.toFixed(1)+'</td><td>'+g.gasoil.toFixed(0)+'</td><td>'+rG+'</td><td>'+g.huiles.toFixed(1)+'</td><td>'+rH+'</td><td>'+g.pneus.total+'</td><td>'+g.flex+'</td></tr>';
  }).join('');
  document.getElementById('extTableBody').innerHTML = rows || '<tr><td colspan="9" class="text-center text-muted py-3">Aucune donnée pour ces filtres</td></tr>';
  var rGT = totH>0?(totG/totH).toFixed(2):'-', rHT = totH>0?(totHu/totH).toFixed(3):'-';
  document.getElementById('extTableFoot').innerHTML = '<tr style="color:#d4af37"><td><strong>TOTAL</strong></td><td>—</td><td><strong>'+totH.toFixed(1)+'</strong></td><td><strong>'+totG.toFixed(0)+'</strong></td><td><strong>'+rGT+'</strong></td><td><strong>'+totHu.toFixed(1)+'</strong></td><td><strong>'+rHT+'</strong></td><td><strong>'+totP+'</strong></td><td><strong>'+totF+'</strong></td></tr>';
  document.getElementById('extTableWrap').style.display = '';
  window._extData = entries;
  renderBudgetCompTable(entries);
  renderFicheJournaliere(filtered);
  renderExtractionCharts(entries);
}
function renderFicheJournaliere(saisies) {
  var etatFilter = document.getElementById('extEtat').value;
  var fmFilter = document.getElementById('extFaitMarquant').checked;
  var statusBadge = {
    'Fait': 'background:rgba(40,167,69,.2);color:#5adb7a',
    'Non fait': 'background:rgba(220,53,69,.2);color:#ff6b6b',
    'À programmer': 'background:rgba(255,193,7,.15);color:#ffc107',
    'Programmé': 'background:rgba(54,162,235,.2);color:#36a2eb',
    'Programmé non fait': 'background:rgba(220,53,69,.15);color:#ff9f40',
    'Programmé et fait': 'background:rgba(40,167,69,.15);color:#4bc0c0'
  };
  var rows = [];
  var sorted = saisies.slice().sort(function(a,b){ return (a.dateDebut||'') < (b.dateDebut||'') ? -1 : 1; });
  sorted.forEach(function(s) {
    var eng = STORE.engins.find(function(e){ return e.id === s.enginId; });
    if (!eng) return;
    var intv = (s.interventions || []).filter(function(i){
      if (etatFilter && i.statut !== etatFilter) return false;
      if (fmFilter && !i.faitMarquant) return false;
      return true;
    });
    var totalHuiles = (s.huiles||[]).reduce(function(sum,h){ return sum + +(h.qte||0); }, 0);
    var hm = +(s.difference || s.duree || 0);
    if (intv.length === 0) {
      if (etatFilter || fmFilter) return;
      rows.push('<tr style="font-size:.78rem">'+
        '<td style="color:#9a8f6a">'+( s.dateDebut||'—')+'</td>'+
        '<td style="color:#d4af37;font-weight:600">'+eng.designation+'</td>'+
        '<td style="color:#9a8f6a">'+( eng.type||'—')+'</td>'+
        '<td class="text-center">'+( hm ? hm.toFixed(1) : '—' )+'</td>'+
        '<td colspan="4" class="text-muted" style="font-style:italic">Aucune intervention</td>'+
        '<td class="text-center">'+( s.gasoil||0 )+'</td>'+
        '<td class="text-center">'+( totalHuiles.toFixed(1) )+'</td>'+
        '<td class="text-center">—</td></tr>');
    } else {
      intv.forEach(function(i, idx) {
        var stBadge = i.statut ? '<span style="font-size:.7rem;padding:.1rem .35rem;border-radius:.3rem;'+(statusBadge[i.statut]||'background:rgba(255,255,255,.08);color:#ccc')+'">'+i.statut+'</span>' : '—';
        var fmCell = i.faitMarquant ? '<span style="color:#dc3545;font-size:.9rem" title="Fait marquant">&#9733;</span>' : '';
        rows.push('<tr style="font-size:.78rem'+(i.faitMarquant?';background:rgba(220,53,69,.06)':'')+'">'+
          (idx===0 ? '<td style="color:#9a8f6a" rowspan="'+intv.length+'">'+( s.dateDebut||'—')+'</td><td style="color:#d4af37;font-weight:600" rowspan="'+intv.length+'">'+eng.designation+'</td><td style="color:#9a8f6a" rowspan="'+intv.length+'">'+( eng.type||'—')+'</td><td class="text-center" rowspan="'+intv.length+'">'+( hm ? hm.toFixed(1) : '—' )+'</td>' : '')+
          '<td style="color:#aaa">'+( i.type||'—')+'</td>'+
          '<td>'+stBadge+'</td>'+
          '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+(i.description||'')+'">'+( i.description||'—')+'</td>'+
          '<td style="color:#9a8f6a;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+( i.pieces||'—')+'</td>'+
          (idx===0 ? '<td class="text-center" rowspan="'+intv.length+'">'+( s.gasoil||0 )+'</td><td class="text-center" rowspan="'+intv.length+'">'+totalHuiles.toFixed(1)+'</td>' : '')+
          '<td class="text-center">'+fmCell+'</td></tr>');
      });
    }
  });
  document.getElementById('extFicheBody').innerHTML = rows.join('') || '<tr><td colspan="11" class="text-center text-muted py-3">Aucune fiche pour ces filtres</td></tr>';
  document.getElementById('extFicheWrap').style.display = '';
  window._ficheData = sorted;
}
function exportFicheCSV() {
  var data = window._ficheData;
  if (!data || !data.length) { alert('Générez d\'abord le rapport.'); return; }
  var etatFilter = document.getElementById('extEtat').value;
  var fmFilter = document.getElementById('extFaitMarquant').checked;
  var lines = ['Date;Engin;Type;HM (h);Type Interv.;État;Description;Pièces;Gasoil (L);Huiles (L);Fait Marquant'];
  data.forEach(function(s) {
    var eng = STORE.engins.find(function(e){ return e.id === s.enginId; });
    if (!eng) return;
    var hm = +(s.difference || s.duree || 0);
    var totalHuiles = (s.huiles||[]).reduce(function(sum,h){ return sum + +(h.qte||0); }, 0);
    var intv = (s.interventions||[]).filter(function(i){
      if (etatFilter && i.statut !== etatFilter) return false;
      if (fmFilter && !i.faitMarquant) return false;
      return true;
    });
    if (intv.length === 0) {
      lines.push([s.dateDebut||'', eng.designation, eng.type||'', hm.toFixed(1), '', '', '', '', s.gasoil||0, totalHuiles.toFixed(1), ''].join(';'));
    } else {
      intv.forEach(function(i){
        lines.push([s.dateDebut||'', eng.designation, eng.type||'', hm.toFixed(1), i.type||'', i.statut||'', (i.description||'').replace(/;/g,','), (i.pieces||'').replace(/;/g,','), s.gasoil||0, totalHuiles.toFixed(1), i.faitMarquant?'OUI':''].join(';'));
      });
    }
  });
  var blob = new Blob(['\ufeff'+lines.join('\n')], {type:'text/csv;charset=utf-8;'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href=url; a.download='fiche_journaliere_'+new Date().toISOString().slice(0,10)+'.csv'; a.click();
  URL.revokeObjectURL(url);
}
function renderBudgetFormRows() {
  var fb = document.getElementById('budgetFormBody'); if (!fb) return;
  var types = [];
  STORE.engins.forEach(function(e){ if(e.type && types.indexOf(e.type)===-1) types.push(e.type); });
  types.sort();
  fb.innerHTML = types.map(function(t){
    var b = STORE.budgets.find(function(x){ return x.type===t; }) || {};
    return '<tr>'+
      '<td><strong style="color:#d4af37">'+t+'</strong></td>'+
      '<td><input type="number" step="0.1" class="form-control form-control-sm bg-dark text-white bgt-hm" data-type="'+t+'" value="'+(b.hm||'')+'"></td>'+
      '<td><input type="number" step="0.01" class="form-control form-control-sm bg-dark text-white bgt-gasoil" data-type="'+t+'" value="'+(b.gasoil||'')+'"></td>'+
      '<td><input type="number" step="0.001" class="form-control form-control-sm bg-dark text-white bgt-huile" data-type="'+t+'" value="'+(b.huile||'')+'"></td>'+
      '</tr>';
  }).join('');
}
function saveBudgets() {
  var rows = document.getElementById('budgetFormBody').querySelectorAll('tr');
  rows.forEach(function(r){
    var t = r.querySelector('.bgt-hm').dataset.type;
    var hm = +r.querySelector('.bgt-hm').value || 0;
    var gasoil = +r.querySelector('.bgt-gasoil').value || 0;
    var huile = +r.querySelector('.bgt-huile').value || 0;
    var idx = STORE.budgets.findIndex(function(x){ return x.type===t; });
    if (idx>=0) STORE.budgets[idx] = {type:t, hm:hm, gasoil:gasoil, huile:huile};
    else STORE.budgets.push({type:t, hm:hm, gasoil:gasoil, huile:huile});
  });
  saveData();
  alert('Budgets enregistrés !');
}
function renderBudgetCompTable(entries) {
  var fb = document.getElementById('budgetFormBody');
  if (fb && !fb.children.length) renderBudgetFormRows();
  var byType = {};
  entries.forEach(function(g){
    var t = g.eng.type || 'Autre';
    if (!byType[t]) byType[t] = {heures:0, gasoil:0, huiles:0, count:0};
    byType[t].heures += g.heures;
    byType[t].gasoil += g.gasoil;
    byType[t].huiles += g.huiles;
    byType[t].count++;
  });
  function arrow(ecart, inverse) {
    var bad = inverse ? ecart < 0 : ecart > 0;
    if (ecart === 0 || isNaN(ecart)) return '<span style="color:#9a8f6a">—</span>';
    return bad
      ? '<span style="color:#e53e3e;font-size:1rem">&#9660;</span>'
      : '<span style="color:#38a169;font-size:1rem">&#9650;</span>';
  }
  var rows = Object.keys(byType).map(function(t){
    var d = byType[t];
    var b = STORE.budgets.find(function(x){ return x.type===t; }) || {};
    var hmReal = d.heures, hmBudg = b.hm || 0;
    var hmEcart = hmReal - hmBudg;
    var rgReal = hmReal>0 ? +(d.gasoil/d.heures).toFixed(2) : 0;
    var rgBudg = b.gasoil || 0;
    var rgEcart = +(rgReal - rgBudg).toFixed(2);
    var rhReal = hmReal>0 ? +(d.huiles/d.heures).toFixed(3) : 0;
    var rhBudg = b.huile || 0;
    var rhEcart = +(rhReal - rhBudg).toFixed(3);
    var hmEcartColor = hmEcart >= 0 ? '#38a169' : '#e53e3e';
    var rgEcartColor = rgEcart > 0 ? '#e53e3e' : (rgEcart < 0 ? '#38a169' : '#9a8f6a');
    var rhEcartColor = rhEcart > 0 ? '#e53e3e' : (rhEcart < 0 ? '#38a169' : '#9a8f6a');
    return '<tr style="font-size:.82rem;border-bottom:1px solid #dee2e6;background:#fff">'+
      '<td style="background:#2c3e50;color:#f0c040;font-weight:700;padding:.45rem .75rem">'+t.toUpperCase()+'</td>'+
      '<td class="text-center" style="color:#000;font-weight:700">'+hmReal.toFixed(0)+'</td>'+
      '<td class="text-center" style="color:#444">'+(hmBudg||'—')+'</td>'+
      '<td class="text-center" style="color:'+hmEcartColor+';font-weight:600">'+(hmBudg?(hmEcart>0?'+':'')+hmEcart.toFixed(0)+' '+arrow(hmEcart,true):'—')+'</td>'+
      '<td class="text-center" style="color:#000">'+rgReal+'</td>'+
      '<td class="text-center" style="color:#444">'+(rgBudg||'—')+'</td>'+
      '<td class="text-center" style="color:'+rgEcartColor+';font-weight:600">'+(rgBudg?(rgEcart>0?'+':'')+rgEcart:'—')+' '+arrow(rgEcart)+'</td>'+
      '<td class="text-center" style="color:#000">'+rhReal+'</td>'+
      '<td class="text-center" style="color:#444">'+(rhBudg||'—')+'</td>'+
      '<td class="text-center" style="color:'+rhEcartColor+';font-weight:600">'+(rhBudg?(rhEcart>0?'+':'')+rhEcart:'—')+' '+arrow(rhEcart)+'</td>'+
      '</tr>';
  }).join('');
  // Ligne TOTAL
  var totTypes = Object.values(byType);
  var totHMReal  = totTypes.reduce(function(s,d){ return s+d.heures; }, 0);
  var totHMBudg  = Object.keys(byType).reduce(function(s,t){ var b=STORE.budgets.find(function(x){return x.type===t;})||{}; return s+(b.hm||0); }, 0);
  var totHMEcart = totHMReal - totHMBudg;
  var totGReal   = totTypes.reduce(function(s,d){ return s+d.gasoil; }, 0);
  var totHuReal  = totTypes.reduce(function(s,d){ return s+d.huiles; }, 0);
  var totRGReal  = totHMReal>0 ? +(totGReal/totHMReal).toFixed(2) : 0;
  var totRHReal  = totHMReal>0 ? +(totHuReal/totHMReal).toFixed(3) : 0;
  var hmEcartColor = totHMEcart>=0?'#38a169':'#e53e3e';
  var totalRow = '<tr style="font-size:.82rem;border-top:2px solid #2c3e50;background:#eaf0fb">'+
    '<td style="background:#2c3e50;color:#fff;font-weight:800;padding:.45rem .75rem">TOTAL</td>'+
    '<td class="text-center" style="color:#000;font-weight:800">'+totHMReal.toFixed(0)+'</td>'+
    '<td class="text-center" style="color:#444;font-weight:600">'+(totHMBudg||'—')+'</td>'+
    '<td class="text-center" style="color:'+hmEcartColor+';font-weight:800">'+(totHMBudg?(totHMEcart>0?'+':'')+totHMEcart.toFixed(0):'—')+'</td>'+
    '<td class="text-center" style="color:#000;font-weight:700">'+totRGReal+'</td>'+
    '<td class="text-center" style="color:#444">—</td><td class="text-center">—</td>'+
    '<td class="text-center" style="color:#000;font-weight:700">'+totRHReal+'</td>'+
    '<td class="text-center" style="color:#444">—</td><td class="text-center">—</td>'+
    '</tr>';
  document.getElementById('extBudgetBody').innerHTML = (rows || '<tr><td colspan="10" class="text-center text-muted py-3">Aucune donnée</td></tr>') + totalRow;
  document.getElementById('extBudgetWrap').style.display = '';
}
function _drawTireIcon(ctx, cx, cy, r) {
  if (r < 5) return;
  ctx.save();
  // Outer rubber
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.fillStyle = '#111'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = r * 0.34; ctx.stroke();
  // Tread marks
  for (var i = 0; i < 6; i++) {
    var a = (i/6)*Math.PI*2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a)*r*0.55, cy + Math.sin(a)*r*0.55);
    ctx.lineTo(cx + Math.cos(a)*r*0.88, cy + Math.sin(a)*r*0.88);
    ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = r*0.09; ctx.stroke();
  }
  // Rim
  ctx.beginPath(); ctx.arc(cx, cy, r*0.32, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(210,210,220,.15)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.2; ctx.stroke();
  // Spokes
  for (var j = 0; j < 5; j++) {
    var b = (j/5)*Math.PI*2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(b)*r*0.3, cy + Math.sin(b)*r*0.3);
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; ctx.stroke();
  }
  // Hub
  ctx.beginPath(); ctx.arc(cx, cy, r*0.1, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fill();
  ctx.restore();
}
var _tireBarsPlugin = {
  id: 'tireBars',
  afterDraw: function(chart) {
    var ctx = chart.ctx;
    chart.data.datasets.forEach(function(ds, di) {
      var meta = chart.getDatasetMeta(di);
      if (!meta.visible) return;
      meta.data.forEach(function(bar) {
        var x = bar.x, top = bar.y, base = bar.base, w = bar.width || 30;
        var h = Math.abs(base - top);
        if (h < 14) return;
        var r = Math.min(h * 0.32, w * 0.32, 14);
        _drawTireIcon(ctx, x, (top + base) / 2, r);
      });
    });
  }
};
var _chartExtHM=null, _chartExtGasoil=null, _chartExtHuiles=null, _chartExtPneusEngin=null, _chartExtPneusType=null;
function renderExtractionCharts(entries) {
  if (!entries.length) { document.getElementById('extChartsWrap').style.display='none'; return; }
  // Disable datalabels globally to avoid affecting dashboard charts
  if (window.ChartDataLabels) {
    try { Chart.defaults.plugins.datalabels = { display: false }; } catch(e){}
  }
  var labels = entries.map(function(g){ return g.eng.designation; });
  var palette = ['#f5a623','#4bc0c0','#9966ff','#ff6384','#36a2eb','#ffce56','#ff9f40','#c9cbcf','#74d7c4','#e8a0bf'];
  function col(i){ return palette[i % palette.length]; }
  var bgColors = labels.map(function(_,i){ return col(i)+'bb'; });
  var bdColors = labels.map(function(_,i){ return col(i); });
  var gridColor = 'rgba(255,255,255,.07)';
  var tickColor = '#9a8f6a';
  var dlBase = window.ChartDataLabels ? [ChartDataLabels] : [];

  // 1. Barres horizontales — HM avec valeurs
  if (_chartExtHM) _chartExtHM.destroy();
  _chartExtHM = new Chart(document.getElementById('chartExtHM').getContext('2d'), {
    type: 'bar',
    plugins: dlBase,
    data: { labels: labels, datasets: [{ label:'Heures (h)', data: entries.map(function(g){ return +g.heures.toFixed(1); }), backgroundColor: bgColors, borderColor: bdColors, borderWidth: 1.5, borderRadius: 5 }] },
    options: {
      indexAxis:'y', responsive:true,
      plugins:{
        legend:{display:false},
        datalabels:{ display:true, color:'#fff', font:{weight:'bold', size:11}, anchor:'end', align:'end',
          formatter: function(v){ return v+'h'; } }
      },
      scales:{ x:{beginAtZero:true, grid:{color:gridColor}, ticks:{color:tickColor}}, y:{grid:{color:'transparent'}, ticks:{color:tickColor}} }
    }
  });

  // 2. Widget Gauge — Gasoil (demi-doughnut + centre total)
  if (_chartExtGasoil) _chartExtGasoil.destroy();
  var totGasoil = entries.reduce(function(s,g){ return s + g.gasoil; }, 0);
  var gaugePlugin = {
    id:'gaugeCenter',
    afterDraw: function(chart) {
      var ctx = chart.ctx, w = chart.width, h = chart.chartArea ? chart.chartArea.bottom : chart.height;
      ctx.save();
      ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = '#f5a623';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(totGasoil.toFixed(0)+' L', w/2, h * .78);
      ctx.font = '11px sans-serif'; ctx.fillStyle = '#9a8f6a';
      ctx.fillText('Total Gasoil', w/2, h * .78 + 18);
      ctx.restore();
    }
  };
  _chartExtGasoil = new Chart(document.getElementById('chartExtGasoil').getContext('2d'), {
    type: 'doughnut',
    plugins: dlBase.concat([gaugePlugin]),
    data: { labels: labels, datasets: [{ data: entries.map(function(g){ return +g.gasoil.toFixed(0); }), backgroundColor: bgColors, borderColor: bdColors, borderWidth: 2, hoverOffset:10,
      borderRadius: 4
    }] },
    options: {
      rotation: -90, circumference: 180, cutout:'65%', responsive:true,
      plugins:{
        legend:{ position:'bottom', labels:{ color:tickColor, boxWidth:10, padding:8 } },
        datalabels:{ display:true, color:'#fff', font:{weight:'bold', size:10},
          formatter: function(v, ctx2){
            var total = ctx2.chart.data.datasets[0].data.reduce(function(a,b){ return a+b; }, 0);
            return total > 0 ? Math.round(v/total*100)+'%' : ''; }
        }
      }
    }
  });

  // 3. Radar/Spider — Huiles avec valeurs sur points
  if (_chartExtHuiles) _chartExtHuiles.destroy();
  _chartExtHuiles = new Chart(document.getElementById('chartExtHuiles').getContext('2d'), {
    type: 'radar',
    plugins: dlBase,
    data: { labels: labels, datasets: [{ label:'Huiles (L)', data: entries.map(function(g){ return +g.huiles.toFixed(1); }), backgroundColor:'rgba(75,192,192,.18)', borderColor:'#4bc0c0', pointBackgroundColor:'#4bc0c0', pointRadius:5, borderWidth:2 }] },
    options: {
      responsive:true,
      plugins:{
        legend:{display:false},
        datalabels:{ display:true, color:'#4bc0c0', font:{weight:'bold', size:10}, anchor:'end', align:'end',
          formatter: function(v){ return v>0 ? v+'L' : ''; } }
      },
      scales:{ r:{ angleLines:{color:gridColor}, grid:{color:gridColor}, pointLabels:{color:tickColor, font:{size:11}}, ticks:{display:false}, beginAtZero:true } }
    }
  });

  // 4a. Barres empilées — Pneus changés par engin
  if (_chartExtPneusEngin) _chartExtPneusEngin.destroy();
  var pnDs = [
    {label:'AVG', key:'avg', bg:'rgba(40,167,69,.82)',  bd:'#28a745'},
    {label:'AVD', key:'avd', bg:'rgba(13,202,240,.82)', bd:'#0dcaf0'},
    {label:'ARG', key:'arg', bg:'rgba(253,126,20,.82)', bd:'#fd7e14'},
    {label:'ARD', key:'ard', bg:'rgba(255,99,132,.82)', bd:'#ff6384'}
  ];
  _chartExtPneusEngin = new Chart(document.getElementById('chartExtPneusEngin').getContext('2d'), {
    type:'bar', plugins: dlBase.concat([_tireBarsPlugin]),
    data:{ labels:labels, datasets: pnDs.map(function(d){
      return { label:d.label, data:entries.map(function(g){ return g.pneus[d.key]; }),
        backgroundColor:d.bg, borderColor:d.bd, borderWidth:1, borderRadius:2 };
    })},
    options:{ responsive:true, scales:{
        x:{ stacked:true, grid:{color:'transparent'}, ticks:{color:tickColor, font:{size:10}} },
        y:{ stacked:true, beginAtZero:true, grid:{color:gridColor}, ticks:{color:tickColor, stepSize:1} }
      },
      plugins:{ legend:{ position:'bottom', labels:{color:tickColor, boxWidth:10, padding:8,
        generateLabels:function(chart){ return chart.data.datasets.map(function(ds,i){
          return {text:'■ '+ds.label, fillStyle:pnDs[i].bd, strokeStyle:pnDs[i].bd, fontColor:tickColor, hidden:false, datasetIndex:i};
        }); } } },
        datalabels:{
          display: function(ctx){ return ctx.datasetIndex === pnDs.length-1; },
          formatter: function(v,ctx){
            var tot = ctx.chart.data.datasets.reduce(function(s,d){ return s+(Number(d.data[ctx.dataIndex])||0); },0);
            return tot > 0 ? tot : '';
          },
          color:'#fff', anchor:'end', align:'top', font:{weight:'bold', size:13}
        }
      }
    }
  });
  // 4b. Barres empilées — Pneus changés par type d'engin
  if (_chartExtPneusType) _chartExtPneusType.destroy();
  var byTypePn = {};
  entries.forEach(function(g){ var t=g.eng.type||'Autre';
    if (!byTypePn[t]) byTypePn[t]={avg:0,avd:0,arg:0,ard:0};
    byTypePn[t].avg+=g.pneus.avg; byTypePn[t].avd+=g.pneus.avd; byTypePn[t].arg+=g.pneus.arg; byTypePn[t].ard+=g.pneus.ard;
  });
  var typeLabels = Object.keys(byTypePn);
  _chartExtPneusType = new Chart(document.getElementById('chartExtPneusType').getContext('2d'), {
    type:'bar', plugins: dlBase.concat([_tireBarsPlugin]),
    data:{ labels:typeLabels, datasets: pnDs.map(function(d){
      return { label:d.label, data:typeLabels.map(function(t){ return byTypePn[t][d.key]; }),
        backgroundColor:d.bg, borderColor:d.bd, borderWidth:1, borderRadius:2 };
    })},
    options:{ responsive:true, scales:{
        x:{ stacked:true, grid:{color:'transparent'}, ticks:{color:tickColor} },
        y:{ stacked:true, beginAtZero:true, grid:{color:gridColor}, ticks:{color:tickColor, stepSize:1} }
      },
      plugins:{ legend:{ position:'bottom', labels:{color:tickColor, boxWidth:10, padding:8,
        generateLabels:function(chart){ return chart.data.datasets.map(function(ds,i){
          return {text:'■ '+ds.label, fillStyle:pnDs[i].bd, strokeStyle:pnDs[i].bd, fontColor:tickColor, hidden:false, datasetIndex:i};
        }); } } },
        datalabels:{
          display: function(ctx){ return ctx.datasetIndex === pnDs.length-1; },
          formatter: function(v,ctx){
            var tot = ctx.chart.data.datasets.reduce(function(s,d){ return s+(Number(d.data[ctx.dataIndex])||0); },0);
            return tot > 0 ? tot : '';
          },
          color:'#fff', anchor:'end', align:'top', font:{weight:'bold', size:13}
        }
      }
    }
  });

  document.getElementById('extChartsWrap').style.display = '';
}
function exportExtractionCSV() {
  var data = window._extData;
  if (!data || !data.length) { alert('Générez d\'abord le rapport.'); return; }
  var lines = ['Engin;Type;Heures de marche;Gasoil (L);Ratio Gasoil L/HM;Huiles (L);Ratio Huiles L/HM;Pneus changés;Flexibles changés'];
  data.forEach(function(g) {
    var rG = g.heures>0?(g.gasoil/g.heures).toFixed(2):'-';
    var rH = g.heures>0?(g.huiles/g.heures).toFixed(3):'-';
    lines.push([g.eng.designation, g.eng.type||'', g.heures.toFixed(1), g.gasoil.toFixed(0), rG, g.huiles.toFixed(1), rH, g.pneus.total, g.flex].join(';'));
  });
  var blob = new Blob(['\ufeff'+lines.join('\n')], {type:'text/csv;charset=utf-8;'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href=url; a.download='extraction_'+new Date().toISOString().slice(0,10)+'.csv'; a.click();
  URL.revokeObjectURL(url);
}

// --- RAPPORT GANTT ---
function buildReportGanttHtml(dateDeb, dateFin) {
  var data = STORE.maintenance.filter(function(m) {
    if (!m.date) return false;
    var mFin = m.dateFin || m.date;
    if (dateDeb && mFin < dateDeb) return false;
    if (dateFin && m.date > dateFin) return false;
    return true;
  });
  data.sort(function(a,b){ return (a.date||'')<(b.date||'')?-1:1; });
  if (!data.length) return '';
  var allD = data.map(function(m){return m.date;}).concat(data.map(function(m){return m.dateFin||m.date;})).filter(Boolean).sort();
  var sD = dateDeb||allD[0], eD = dateFin||allD[allD.length-1];
  var startD = new Date(sD+'T00:00:00'), endD = new Date(eD+'T00:00:00');
  var totalMs = endD - startD + 86400000;
  var totalDays = Math.round(totalMs/86400000);
  if (totalDays<=0||totalDays>366) return '';
  var sC={'Planifi\u00e9':'#f39c12','En cours':'#3498db','Termin\u00e9':'#27ae60','Annul\u00e9':'#95a5a6'};
  var today=new Date(); today.setHours(0,0,0,0);
  var LW=185;
  var MN=['Jan','F\u00e9v','Mar','Avr','Mai','Jun','Jul','Ao\u00fb','Sep','Oct','Nov','D\u00e9c'];
  // Months
  var mHtml='',cMo=-1,cMs=0,cMd=0;
  for(var i=0;i<=totalDays;i++){var dd=new Date(startD.getTime()+i*86400000);if(dd.getMonth()!==cMo){if(cMo>=0)mHtml+='<span style="position:absolute;left:'+(cMs/totalDays*100).toFixed(2)+'%;width:'+(cMd/totalDays*100).toFixed(2)+'%;text-align:center;font-size:.63rem;font-weight:700;color:#e67e22;border-right:1px solid #e0e0e0;overflow:hidden;background:#fff9f0">'+MN[cMo]+' '+new Date(startD.getTime()+cMs*86400000).getFullYear()+'</span>';cMo=dd.getMonth();cMs=i;cMd=0;}cMd++;}
  if(cMd>0)mHtml+='<span style="position:absolute;left:'+(cMs/totalDays*100).toFixed(2)+'%;width:'+(cMd/totalDays*100).toFixed(2)+'%;text-align:center;font-size:.63rem;font-weight:700;color:#e67e22;border-right:1px solid #e0e0e0;overflow:hidden;background:#fff9f0">'+MN[cMo]+' '+new Date(startD.getTime()+cMs*86400000).getFullYear()+'</span>';
  // Days
  var dHtml='';
  for(var i=0;i<totalDays;i++){var dd=new Date(startD.getTime()+i*86400000);var wk=dd.getDay()===0||dd.getDay()===6;var tod=dd.getTime()===today.getTime();var pct=(i/totalDays*100).toFixed(3),w=(1/totalDays*100).toFixed(3);dHtml+='<span style="position:absolute;left:'+pct+'%;width:'+w+'%;height:100%;background:'+(tod?'rgba(230,126,34,.18)':wk?'#f5f5f5':'#fff')+';border-left:1px solid #f0f0f0;text-align:center;font-size:.55rem;color:'+(tod?'#e67e22':wk?'#bbb':'#aaa')+';overflow:hidden;line-height:16px">'+dd.getDate()+'</span>';}
  var tP=-1; if(today>=startD&&today<=endD) tP=((today-startD)/(totalMs-86400000)*100).toFixed(2);
  // Group by engine
  var byE={},eO=[];
  data.forEach(function(m){if(!byE[m.enginId]){byE[m.enginId]=[];eO.push(m.enginId);}byE[m.enginId].push(m);});
  var rows='';
  eO.forEach(function(eid,ri){
    var eng=STORE.engins.find(function(e){return e.id===eid;});
    var bg=ri%2===0?'#fff':'#fafaf8';
    rows+='<div style="display:flex;border-bottom:1px solid #eee;background:'+bg+'">';
    rows+='<div style="min-width:'+LW+'px;max-width:'+LW+'px;padding:4px 8px;font-size:.68rem;font-weight:600;color:#333;border-right:1px solid #ddd;display:flex;align-items:center;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+(eng?eng.designation:'?')+'</div>';
    rows+='<div style="flex:1;position:relative;height:28px">';
    for(var i=0;i<totalDays;i++){var dd=new Date(startD.getTime()+i*86400000);if(dd.getDay()===0||dd.getDay()===6)rows+='<div style="position:absolute;left:'+(i/totalDays*100).toFixed(3)+'%;width:'+(1/totalDays*100).toFixed(3)+'%;height:100%;background:#f5f5f5"></div>';}
    byE[eid].forEach(function(t){
      var ts=new Date((t.date||'')+'T00:00:00');
      var te=t.dateFin?new Date(t.dateFin+'T00:00:00'):new Date(ts);
      if(ts>endD||te<startD)return;
      if(ts<startD)ts=startD;if(te>endD)te=endD;
      var sp=((ts-startD)/totalMs*100).toFixed(2);
      var ep=(((te-startD)+86400000)/totalMs*100).toFixed(2);
      var wp=Math.max(0.8,parseFloat(ep)-parseFloat(sp));
      var c=sC[t.statut]||'#f5a623';
      rows+='<div title="'+t.type+' \u2014 '+(t.description||'')+' | '+t.date+' \u2192 '+(t.dateFin||t.date)+'" style="position:absolute;left:'+sp+'%;width:'+wp+'%;height:18px;top:5px;background:'+c+';border-radius:3px;font-size:.58rem;color:#fff;font-weight:400;padding:0 3px;overflow:hidden;white-space:nowrap;display:flex;align-items:center">'+(t.description||t.type)+'</div>';
    });
    if(tP>=0)rows+='<div style="position:absolute;left:'+tP+'%;width:2px;height:100%;background:rgba(230,126,34,.7)"></div>';
    rows+='</div></div>';
  });
  var leg='<div style="display:flex;gap:12px;padding:5px 0;flex-wrap:wrap;margin-top:4px">';
  Object.keys(sC).forEach(function(s){leg+='<span style="display:inline-flex;align-items:center;gap:4px;font-size:.68rem;color:#555"><span style="display:inline-block;width:11px;height:11px;border-radius:2px;background:'+sC[s]+'"></span>'+s+'</span>';});
  leg+='<span style="display:inline-flex;align-items:center;gap:4px;font-size:.68rem;color:#555"><span style="display:inline-block;width:2px;height:11px;background:rgba(230,126,34,.7)"></span>Aujourd\'hui</span></div>';
  return '<div style="overflow-x:auto"><div style="min-width:580px">'
    +'<div style="display:flex;border-bottom:1px solid #ddd"><div style="min-width:'+LW+'px;border-right:1px solid #ddd;background:#fff9f0"></div><div style="flex:1;position:relative;height:18px">'+mHtml+'</div></div>'
    +'<div style="display:flex;border-bottom:2px solid #e67e22"><div style="min-width:'+LW+'px;padding:2px 8px;font-size:.63rem;font-weight:700;color:#e67e22;border-right:1px solid #ddd;background:#fff9f0">Engin</div><div style="flex:1;position:relative;height:16px">'+dHtml+'</div></div>'
    +rows+'</div></div>'+leg;
}

// --- RAPPORTS ---
function updateRptSelects() {
  var el = document.getElementById('rptType'); if (!el) return;
  var saved = Array.from(el.selectedOptions||[]).map(function(o){return o.value;});
  var types = [];
  STORE.engins.forEach(function(e){ if(e.type && types.indexOf(e.type)===-1) types.push(e.type); });
  types.sort();
  el.innerHTML = types.map(function(t){ return '<option value="'+t+'"'+(saved.indexOf(t)>-1?' selected':'')+'>'+t+'</option>'; }).join('');
}
function rptSelectAll(val) {
  var el = document.getElementById('rptType'); if (!el) return;
  for (var i=0; i<el.options.length; i++) el.options[i].selected = val;
}
function buildAnalyseHtml(entries, byTypeMap, period) {
  var hasBudget = STORE.budgets && STORE.budgets.length > 0;
  var lines = [];
  // ── Helpers ──
  function badge(txt, col, bg) {
    return '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:.68rem;font-weight:700;background:'+bg+';color:'+col+';border:1px solid '+col+'">'+txt+'</span>';
  }
  function statusBadge(pct, inverse) {
    if (pct === null) return badge('Pas de budget','#888','#f5f5f5');
    var absP = Math.abs(pct);
    if (!inverse) {
      if (pct > 25)  return badge('⚠ CRITIQUE +'+pct+'%','#fff','#c0392b');
      if (pct > 10)  return badge('↑ ATTENTION +'+pct+'%','#fff','#e67e22');
      if (pct > 0)   return badge('→ Légère hausse +'+pct+'%','#b7510a','#fdebd0');
      if (pct >= -5) return badge('✓ Conforme','#fff','#27ae60');
      return badge('↓ Sous budget '+pct+'%','#fff','#2980b9');
    } else {
      if (pct > 25)  return badge('⚠ CRITIQUE +'+pct+'%','#fff','#c0392b');
      if (pct > 10)  return badge('↑ ATTENTION +'+pct+'%','#fff','#e67e22');
      if (pct > 0)   return badge('→ Légère hausse +'+pct+'%','#b7510a','#fdebd0');
      return badge('✓ Conforme','#fff','#27ae60');
    }
  }
  function ecartPct(reel, budget) {
    if (!budget || budget === 0) return null;
    return Math.round((reel - budget) / budget * 100);
  }
  // ── Recommendations catalogue ──
  function recosGasoil(pct) {
    if (pct === null) return ['Définir un budget gasoil L/HM pour ce type d\'engin afin d\'activer l\'analyse.'];
    if (pct > 25) return [
      'Inspection immédiate du moteur (injecteurs, turbo, filtre à air colmaté).',
      'Vérifier l\'absence de fuites sur le circuit carburant.',
      'Analyser les itinéraires : trajets à vide excessifs ou sur-régime.',
      'Former les conducteurs à l\'éco-conduite et à la coupure moteur à l\'arrêt.',
      'Contrôler l\'état des pneus (sous-gonflage = +10% de conso).',
      'Planifier une vidange et remplacement filtre gasoil si dépassé.'
    ];
    if (pct > 10) return [
      'Contrôler les injecteurs et la pression d\'injection.',
      'Vérifier la pression des pneus et l\'état des filtres.',
      'Sensibiliser les opérateurs sur la conduite économique.',
      'Suivre l\'évolution sur les 2 prochaines semaines.'
    ];
    if (pct > 0) return [
      'Surveillance accrue : surveiller l\'évolution sur le mois.',
      'Vérifier que les compteurs de gasoil sont bien relevés.',
      'Contrôler la pression des pneus.'
    ];
    if (pct >= -5) return ['Consommation dans les normes. Continuer le suivi régulier.'];
    return ['Consommation inférieure au budget. Vérifier l\'exactitude des relevés ou une sous-utilisation de l\'engin.'];
  }
  function recosHuile(pct) {
    if (pct === null) return ['Définir un budget huile L/HM pour ce type d\'engin afin d\'activer l\'analyse.'];
    if (pct > 30) return [
      'Analyse d\'huile urgente : envoyer un échantillon au laboratoire.',
      'Vérifier les fuites extérieures (joints spi, bagues, raccords).',
      'Contrôler le niveau et l\'aspect de l\'huile moteur (mousse = eau).',
      'Inspecter le filtre à huile et remplacer si nécessaire.',
      'Envisager une révision moteur complète si consommation persistante.',
      'Vérifier la compatibilité de la nuance d\'huile utilisée.'
    ];
    if (pct > 10) return [
      'Contrôler les niveaux et rechercher des fuites mineures.',
      'Vérifier les joints et raccords du circuit huile.',
      'S\'assurer que la nuance d\'huile est conforme au constructeur.',
      'Programmer une analyse d\'huile préventive.'
    ];
    if (pct > 0) return [
      'Légère hausse : surveiller les niveaux à chaque prise de service.',
      'Vérifier visuellement l\'absence de suintements.'
    ];
    return ['Consommation huile correcte. Maintenir le rythme de vidange préventif.'];
  }
  // ── Global summary ──
  var totalGasEcart = 0, totalHuiEcart = 0, cntGas = 0, cntHui = 0;
  var critGas = [], critHui = [], warnGas = [], warnHui = [], okGas = [], okHui = [];
  entries.forEach(function(g) {
    if (g.heures <= 0) return;
    var b = STORE.budgets.find(function(x){ return x.type === g.eng.type; }) || {};
    var rrG = +(g.gasoil / g.heures).toFixed(2);
    var rrH = +(g.huiles / g.heures).toFixed(3);
    var pG = ecartPct(rrG, b.gasoil||0);
    var pH = ecartPct(rrH, b.huile||0);
    if (pG !== null) { totalGasEcart += pG; cntGas++; if (pG > 25) critGas.push(g); else if (pG > 10) warnGas.push(g); else okGas.push(g); }
    if (pH !== null) { totalHuiEcart += pH; cntHui++; if (pH > 30) critHui.push(g); else if (pH > 10) warnHui.push(g); else okHui.push(g); }
  });
  var avgGasEcart = cntGas > 0 ? Math.round(totalGasEcart / cntGas) : null;
  var avgHuiEcart = cntHui > 0 ? Math.round(totalHuiEcart / cntHui) : null;
  // ── Build HTML ──
  var H2 = function(txt,col){ return '<div style="font-size:.85rem;font-weight:800;color:'+(col||'#1a1a1a')+';border-bottom:2px solid '+(col||'#ddd')+';padding-bottom:4px;margin:14px 0 8px;text-transform:uppercase;letter-spacing:.5px">'+txt+'</div>'; };
  var CARD = function(content,border){ return '<div style="border:1px solid #e0e0e0;border-left:4px solid '+(border||'#ccc')+';border-radius:6px;padding:10px 14px;margin-bottom:10px;background:#fafafa">'+content+'</div>'; };
  // Synthèse globale
  var synthHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">';
  var makeKpi = function(label, val, pct, col, icon) {
    return '<div style="border-radius:8px;border:1px solid #e0e0e0;padding:12px;background:#fff;border-top:4px solid '+col+'">'
      +'<div style="font-size:.7rem;color:#888;margin-bottom:3px">'+icon+' '+label+'</div>'
      +'<div style="font-size:1.2rem;font-weight:800;color:'+col+'">'+val+'</div>'
      +(pct!==null?'<div style="font-size:.7rem;color:'+(pct>10?'#c0392b':pct>0?'#e67e22':'#27ae60')+'">Écart moyen : '+(pct>0?'+':'')+pct+'%</div>':'<div style="font-size:.7rem;color:#aaa">Aucun budget défini</div>')
      +'</div>';
  };
  synthHtml += makeKpi('Gasoil : Engins en écart critique', critGas.length+' engin(s)', avgGasEcart, critGas.length>0?'#c0392b':'#27ae60','⛽');
  synthHtml += makeKpi('Huiles : Engins en écart critique', critHui.length+' engin(s)', avgHuiEcart, critHui.length>0?'#c0392b':'#27ae60','🛢');
  synthHtml += '</div>';
  // Analyse par type d'engin
  var typeHtml = '';
  Object.keys(byTypeMap).forEach(function(t) {
    var d = byTypeMap[t];
    var b = STORE.budgets.find(function(x){ return x.type === t; }) || {};
    var rrG = d.heures>0 ? +(d.gasoil/d.heures).toFixed(2) : 0;
    var rrH = d.heures>0 ? +(d.huiles/d.heures).toFixed(3) : 0;
    var pG = ecartPct(rrG, b.gasoil||0);
    var pH = ecartPct(rrH, b.huile||0);
    var bG = statusBadge(pG); var bH = statusBadge(pH);
    var borderCol = (pG!==null&&pG>25)||(pH!==null&&pH>30) ? '#c0392b' : (pG!==null&&pG>10)||(pH!==null&&pH>10) ? '#e67e22' : '#27ae60';
    typeHtml += CARD(
      '<div style="font-size:.82rem;font-weight:700;margin-bottom:6px;color:#333">'+t.toUpperCase()+' — '+d.count+' engin(s) — '+d.heures.toFixed(0)+'h cumulées</div>'
      +'<div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:6px">'
      +'<span style="font-size:.75rem">⛽ Gasoil : <strong>'+rrG+' L/HM</strong> (budget : '+(b.gasoil||'—')+') '+bG+'</span>'
      +'<span style="font-size:.75rem">🛢 Huiles : <strong>'+rrH+' L/HM</strong> (budget : '+(b.huile||'—')+') '+bH+'</span>'
      +'</div>'
    , borderCol);
  });
  // Analyse détaillée par engin
  var detailHtml = '';
  var enginesWithData = entries.filter(function(g){ return g.heures > 0; });
  enginesWithData.forEach(function(g) {
    var b = STORE.budgets.find(function(x){ return x.type === g.eng.type; }) || {};
    var rrG = +(g.gasoil / g.heures).toFixed(2);
    var rrH = +(g.huiles / g.heures).toFixed(3);
    var pG = ecartPct(rrG, b.gasoil||0);
    var pH = ecartPct(rrH, b.huile||0);
    var bG = statusBadge(pG); var bH = statusBadge(pH);
    var isCrit = (pG!==null&&pG>25)||(pH!==null&&pH>30);
    var isWarn = !isCrit&&((pG!==null&&pG>10)||(pH!==null&&pH>10));
    var borderCol = isCrit?'#c0392b':isWarn?'#e67e22':'#27ae60';
    var rG = recosGasoil(pG); var rH = recosHuile(pH);
    var recoHtml = '';
    if (isCrit||isWarn) {
      recoHtml += '<div style="margin-top:7px;font-size:.72rem">';
      recoHtml += '<div style="font-weight:700;color:#333;margin-bottom:4px">📋 Recommandations :</div>';
      if (pG!==null&&pG>0) {
        recoHtml += '<div style="color:#e67e22;font-weight:600;font-size:.7rem;margin-bottom:2px">Gasoil :</div>';
        recoHtml += '<ul style="margin:0 0 6px;padding-left:16px">'
          + rG.map(function(r){ return '<li style="margin-bottom:2px">'+r+'</li>'; }).join('')
          + '</ul>';
      }
      if (pH!==null&&pH>0) {
        recoHtml += '<div style="color:#9b59b6;font-weight:600;font-size:.7rem;margin-bottom:2px">Huiles :</div>';
        recoHtml += '<ul style="margin:0 0 4px;padding-left:16px">'
          + rH.map(function(r){ return '<li style="margin-bottom:2px">'+r+'</li>'; }).join('')
          + '</ul>';
      }
      recoHtml += '</div>';
    }
    detailHtml += CARD(
      '<div style="display:flex;justify-content:space-between;align-items:flex-start">'
      +'<div><div style="font-size:.82rem;font-weight:700;color:#1a1a1a">'+g.eng.designation+'</div>'
      +'<div style="font-size:.7rem;color:#888">'+( g.eng.type||'—')+' — '+g.heures.toFixed(0)+'h — '+(g.eng.immatriculation||'')+'</div></div>'
      +'<div style="text-align:right;font-size:.72rem;color:#555">Gasoil : '+g.gasoil.toFixed(0)+'L &nbsp;|&nbsp; Huiles : '+g.huiles.toFixed(1)+'L</div>'
      +'</div>'
      +'<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:6px">'
      +'<span style="font-size:.75rem">⛽ <strong>'+rrG+' L/HM</strong> vs '+(b.gasoil||'—')+' budget '+bG+'</span>'
      +'<span style="font-size:.75rem">🛢 <strong>'+rrH+' L/HM</strong> vs '+(b.huile||'—')+' budget '+bH+'</span>'
      +'</div>'
      + recoHtml
    , borderCol);
  });
  if (!enginesWithData.length) detailHtml = '<p style="color:#999;font-style:italic;font-size:.78rem">Aucune donnée d\'activité sur cette période.</p>';
  // Conclusion générale
  var concluHtml = '';
  var nbCrit = critGas.length + critHui.length;
  var nbWarn = warnGas.length + warnHui.length;
  if (!hasBudget) {
    concluHtml = '<div style="padding:12px;background:#fff8e1;border:1px solid #f5a623;border-radius:6px;font-size:.78rem;color:#b7510a">'
      +'<strong>⚠ Aucun budget paramétré.</strong> Pour activer l\'analyse comparative, allez dans la section <em>Extraction de Données → Paramétrer Budgets</em> et saisissez les ratios cibles par type d\'engin.</div>';
  } else if (nbCrit > 0) {
    concluHtml = '<div style="padding:12px;background:#fdf0ef;border:1px solid #c0392b;border-radius:6px;font-size:.78rem;color:#c0392b">'
      +'<strong>🚨 Situation critique :</strong> '+nbCrit+' engin(s) dépassent les seuils d\'alerte. Une intervention technique et un contrôle des pratiques opérationnelles sont nécessaires en priorité.</div>';
  } else if (nbWarn > 0) {
    concluHtml = '<div style="padding:12px;background:#fef9e7;border:1px solid #e67e22;border-radius:6px;font-size:.78rem;color:#7d4e02">'
      +'<strong>⚠ Vigilance requise :</strong> '+nbWarn+' engin(s) montrent une tendance à la hausse. Un suivi renforcé et des vérifications préventives sont recommandés.</div>';
  } else if (enginesWithData.length > 0) {
    concluHtml = '<div style="padding:12px;background:#eafaf1;border:1px solid #27ae60;border-radius:6px;font-size:.78rem;color:#1e8449">'
      +'<strong>✅ Bonne performance globale :</strong> Toutes les consommations sont dans les objectifs sur la période '+period+'. Maintenir le programme de maintenance préventive.</div>';
  }
  return '<div>'
    + H2('🔍 Analyse Consommation — Gasoil & Huiles','#1a5276')
    + '<p style="font-size:.72rem;color:#777;margin-bottom:10px">Analyse automatique basée sur les données de la période <strong>'+period+'</strong>. Les recommandations sont générées par rapport aux budgets paramétrés.</p>'
    + synthHtml
    + H2('Par Famille d\'Engin','#2471a3')
    + typeHtml
    + H2('Détail par Engin — Commentaires & Recommandations','#1a5276')
    + detailHtml
    + concluHtml
    + '</div>';
}
function generateReport() {
  var dateDeb    = document.getElementById('rptDateDeb').value;
  var dateFin    = document.getElementById('rptDateFin').value;
  var title      = document.getElementById('rptTitle').value || 'Rapport Gestion Parc Engins';
  var rptTypeEl  = document.getElementById('rptType');
  var selectedTypes = Array.from(rptTypeEl.selectedOptions || []).map(function(o){ return o.value; });
  var allTypes = [];
  STORE.engins.forEach(function(e){ if(e.type && allTypes.indexOf(e.type)===-1) allTypes.push(e.type); });
  var activeTypes = selectedTypes.length ? selectedTypes : allTypes;
  var filtered   = STORE.saisies.filter(function(s) {
    var d = s.dateDebut || '';
    if (dateDeb && d < dateDeb) return false;
    if (dateFin && d > dateFin) return false;
    var eng = STORE.engins.find(function(e){ return e.id === s.enginId; });
    if (!eng) return false;
    return activeTypes.indexOf(eng.type) > -1;
  });
  // Aggregate by engin
  var byEnginMap = {};
  var statusCounts = {};
  filtered.forEach(function(s) {
    var eng = STORE.engins.find(function(e){ return e.id === s.enginId; });
    if (!eng) return;
    if (!byEnginMap[s.enginId]) byEnginMap[s.enginId] = {eng:eng, heures:0, gasoil:0, huiles:0, huilesByType:{}, pneus:{total:0,avg:0,avd:0,arg:0,ard:0}, flex:0, fms:[]};
    var g = byEnginMap[s.enginId];
    var _cF2=+(s.compteurFin||0), _cD2=+(s.compteurDebut||0);
    var _hm2 = (_cD2>0 && _cF2>_cD2) ? (_cF2-_cD2) : Math.max(0, +(s.difference||s.duree||s.heuresFonct||0));
    g.heures += _hm2;
    g.gasoil  += +(s.gasoil || 0);
    if (s.huiles && s.huiles.length) {
      s.huiles.forEach(function(h){ var ht=h.type||'?'; g.huiles += +(h.qte||0); g.huilesByType[ht]=(g.huilesByType[ht]||0)+(+(h.qte||0)); });
    } else {
      var _oils={HV68:+(s.hv68||0),S30:+(s.s30||0),S50:+(s.s50||0),'15W40':+(s.w15w40||0),AUTRAN:+(s.autran||0),'85W140':+(s.w85w140||0)};
      Object.keys(_oils).forEach(function(k){ if(_oils[k]>0){ g.huiles+=_oils[k]; g.huilesByType[k]=(g.huilesByType[k]||0)+_oils[k]; } });
    }
    var pMap = {avg:'pneuAvg', avd:'pneuAvd', arg:'pneuArg', ard:'pneuArd'};
    var sCpt = +(s.compteurFin || s.compteur || 0);
    Object.keys(pMap).forEach(function(pos){
      var pn = s[pMap[pos]]; if (!pn) return;
      if (pn.statut === 'Chang\u00e9') {
        g.pneus[pos]++; g.pneus.total++;
        if (!g.pneus.lastCh) g.pneus.lastCh = {};
        if (!g.pneus.lastCh[pos] || sCpt >= (g.pneus.lastCh[pos].cpt||0))
          g.pneus.lastCh[pos] = {cpt:sCpt, four:pn.fourn||'\u2014', ref:pn.ref||'\u2014', date:s.dateDebut||'\u2014'};
      }
    });
    g.flex += (s.flexibles||[]).length;
    (s.interventions||[]).forEach(function(i){
      var st = i.statut || 'Non d\u00e9fini';
      statusCounts[st] = (statusCounts[st]||0) + 1;
      if (i.faitMarquant) g.fms.push({date:s.dateDebut, desc:i.description||'', type:i.type||'', statut:st, pieces:i.pieces||''});
    });
  });
  var entries = Object.values(byEnginMap);
  // Inclure les engins "En service" sans saisie dans la période (affichés à 0) — uniquement les types sélectionnés
  STORE.engins.forEach(function(eng) {
    if (!byEnginMap[eng.id] && eng.statut === 'En service' && activeTypes.indexOf(eng.type) > -1) {
      entries.push({eng:eng, heures:0, gasoil:0, huiles:0, pneus:{total:0,avg:0,avd:0,arg:0,ard:0}, flex:0, fms:[]});
    }
  });
  var curCptMap = {};
  STORE.saisies.forEach(function(s){ var cf=+(s.compteurFin||s.compteur||0); if(cf>(curCptMap[s.enginId]||0)) curCptMap[s.enginId]=cf; });
  entries.forEach(function(g){ g.pneus.curCpt = curCptMap[g.eng.id]||+(g.eng.compteur||0); });
  var allFms  = [];
  entries.forEach(function(g){ g.fms.forEach(function(f){ allFms.push({eng:g.eng.designation, engType:g.eng.type||'', date:f.date, desc:f.desc, type:f.type, statut:f.statut, pieces:f.pieces||''}); }); });
  var fmStatusCounts = {};
  allFms.forEach(function(f){ var s=f.statut||'Non défini'; fmStatusCounts[s]=(fmStatusCounts[s]||0)+1; });
  // Group entries dynamically by selected type
  function buildByTypeMap(ents){
    var m={};
    ents.forEach(function(g){ var t=g.eng.type||'Autre'; if(!m[t]) m[t]={heures:0,gasoil:0,huiles:0,pneus:0,count:0}; m[t].heures+=g.heures; m[t].gasoil+=g.gasoil; m[t].huiles+=g.huiles; m[t].pneus+=g.pneus.total; m[t].count++; });
    return m;
  }
  var byTypeMap = buildByTypeMap(entries);
  var typeGroups = {};
  activeTypes.forEach(function(t){ typeGroups[t] = entries.filter(function(g){ return g.eng.type === t; }); });
  var typeGroupMaps = {};
  Object.keys(typeGroups).forEach(function(t){ typeGroupMaps[t] = buildByTypeMap(typeGroups[t]); });
  var totH  = entries.reduce(function(s,g){return s+g.heures;},0);
  var totG  = entries.reduce(function(s,g){return s+g.gasoil;},0);
  var totHu = entries.reduce(function(s,g){return s+g.huiles;},0);
  var totP  = entries.reduce(function(s,g){return s+g.pneus.total;},0);
  var groupTotals = {};
  Object.keys(typeGroups).forEach(function(t){
    var g = typeGroups[t];
    groupTotals[t] = {
      h: g.reduce(function(s,x){return s+x.heures;},0),
      g: g.reduce(function(s,x){return s+x.gasoil;},0),
      hu: g.reduce(function(s,x){return s+x.huiles;},0),
      p: g.reduce(function(s,x){return s+x.pneus.total;},0)
    };
  });
  var period  = (dateDeb||'\u2014') + ' au ' + (dateFin||'\u2014');
  var genDate = new Date().toLocaleDateString('fr-FR');
  // Helpers
  var TH  = 'padding:7px 10px;border:1px solid #ddd;font-size:.75rem;text-align:center;background:#f5f5f5';
  var THL = 'padding:7px 10px;border:1px solid #ddd;font-size:.75rem;text-align:left;background:#f5f5f5';
  var TD  = 'padding:6px 10px;border:1px solid #eee;font-size:.75rem;text-align:center';
  var TDL = 'padding:6px 10px;border:1px solid #eee;font-size:.75rem;text-align:left;font-weight:600';
  var TDF = 'padding:7px 10px;border:1px solid #ddd;font-size:.75rem;text-align:center;font-weight:700;background:#f5a623;color:#fff';
  function sHead(t, c) { return '<div style="background:'+(c||'#f5a623')+';color:#fff;padding:9px 14px;margin-top:20px;border-radius:4px 4px 0 0"><strong style="font-size:.9rem;text-transform:uppercase;letter-spacing:1px">'+t+'</strong></div><div style="background:#fff;border:1px solid #ddd;border-top:none;padding:12px">'; }
  function tbl(hdr, rows, foot) { return '<div style="overflow-x:auto;margin-bottom:10px"><table style="width:100%;border-collapse:collapse">'+hdr+rows+(foot||'')+'</table></div>'; }
  function ecartTd(ecart, inverse) {
    if (ecart===null||isNaN(ecart)) return '<td style="'+TD+'">—</td>';
    var bad = inverse ? ecart<0 : ecart>0;
    var c   = bad ? '#c0392b' : (ecart===0?'#666':'#27ae60');
    var arr = bad ? ' ▼' : (ecart===0?'':' ▲');
    return '<td style="'+TD+';color:'+c+';font-weight:700">'+(ecart>0?'+':'')+ecart+arr+'</td>';
  }
  // Helper: build one part section (10t or Dumper)
  function buildPartHtml(label, color, ents, btMap, totHp, totGp, totHup, totPp, suffix) {
    var kpi = [{v:ents.length,l:'Engins',c:color},{v:totHp.toFixed(1)+'h',l:'HM',c:'#4bc0c0'},{v:totGp.toFixed(0)+'L',l:'Gasoil',c:'#e67e22'},{v:totHup.toFixed(1)+'L',l:'Huiles',c:'#9966ff'},{v:totPp,l:'Pneus',c:'#ff6384'}]
      .map(function(k){return '<div style="background:#f9f6ef;border-radius:8px;padding:10px 6px;text-align:center;border-top:4px solid '+k.c+'"><div style="font-size:1.15rem;font-weight:800;color:'+k.c+'">'+k.v+'</div><div style="font-size:.68rem;color:#666;margin-top:2px">'+k.l+'</div></div>';}).join('');
    var hmEHdr='<thead><tr><th style="'+THL+'">Engin</th><th style="'+TH+'">HM Réel (h)</th><th style="'+TH+'">Budget / engin (h)</th><th style="'+TH+'">Écart</th></tr></thead>';
    var hmERows='<tbody>'+ents.map(function(g,i){var b=STORE.budgets.find(function(x){return x.type===g.eng.type;})||{};var cnt=ents.filter(function(x){return x.eng.type===g.eng.type;}).length||1;var bh=b.hm?+(b.hm/cnt).toFixed(1):0;var ec=bh?+(g.heures-bh).toFixed(1):null;return '<tr style="background:'+(i%2===0?'#fff':'#fafaf8')+'"><td style="'+TDL+'">'+g.eng.designation+'</td><td style="'+TD+';font-weight:700">'+g.heures.toFixed(1)+'</td><td style="'+TD+'">'+(bh?bh+'h <small style="color:#999">(÷'+cnt+')</small>':'—')+'</td>'+ecartTd(ec,false)+'</tr>';}).join('')+'</tbody>';
    var gasEHdr='<thead><tr><th style="'+THL+'">Engin</th><th style="'+TH+'">Conso (L)</th><th style="'+TH+'">Ratio L/HM</th><th style="'+TH+'">Budget</th><th style="'+TH+'">Écart</th></tr></thead>';
    var gasERows='<tbody>'+ents.map(function(g,i){var b=STORE.budgets.find(function(x){return x.type===g.eng.type;})||{};var br=b.gasoil||0;var rr=g.heures>0?+(g.gasoil/g.heures).toFixed(2):0;var ec=br?+(rr-br).toFixed(2):null;return '<tr style="background:'+(i%2===0?'#fff':'#fafaf8')+'"><td style="'+TDL+'">'+g.eng.designation+'</td><td style="'+TD+'">'+g.gasoil.toFixed(0)+'</td><td style="'+TD+';font-weight:700">'+rr+'</td><td style="'+TD+'">'+( br||'—')+'</td>'+ecartTd(ec,true)+'</tr>';}).join('')+'</tbody>';
    var huiEHdr='<thead><tr><th style="'+THL+'">Engin</th><th style="'+TH+'">Conso (L)</th><th style="'+TH+'">Ratio L/HM</th><th style="'+TH+'">Budget</th><th style="'+TH+'">Écart</th></tr></thead>';
    var huiERows='<tbody>'+ents.map(function(g,i){var b=STORE.budgets.find(function(x){return x.type===g.eng.type;})||{};var br=b.huile||0;var rr=g.heures>0?+(g.huiles/g.heures).toFixed(3):0;var ec=br?+(rr-br).toFixed(3):null;return '<tr style="background:'+(i%2===0?'#fff':'#fafaf8')+'"><td style="'+TDL+'">'+g.eng.designation+'</td><td style="'+TD+'">'+g.huiles.toFixed(1)+'</td><td style="'+TD+';font-weight:700">'+rr+'</td><td style="'+TD+'">'+( br||'—')+'</td>'+ecartTd(ec,true)+'</tr>';}).join('')+'</tbody>';
    var pnEW=ents.filter(function(g){return g.pneus.total>0;});
    var pnEHdr='<thead><tr><th style="'+THL+'">Engin</th><th style="'+TH+'">AVG</th><th style="'+TH+'">AVD</th><th style="'+TH+'">ARG</th><th style="'+TH+'">ARD</th><th style="'+TH+'">Total</th><th style="'+TH+'">Durée vie moy.</th></tr></thead>';
    var pnERows='<tbody>'+pnEW.map(function(g,i){return '<tr style="background:'+(i%2===0?'#fff':'#f0fff8')+'"><td style="'+TDL+'">'+g.eng.designation+'</td><td style="'+TD+'">'+g.pneus.avg+'</td><td style="'+TD+'">'+g.pneus.avd+'</td><td style="'+TD+'">'+g.pneus.arg+'</td><td style="'+TD+'">'+g.pneus.ard+'</td><td style="'+TD+';font-weight:700">'+g.pneus.total+'</td><td style="'+TD+'">'+(g.heures>0&&g.pneus.total>0?(g.heures/g.pneus.total).toFixed(0)+'h/pneu':'—')+'</td></tr>';}).join('')+'</tbody>';
    if (!ents.length) return '<div style="background:#f8f8f8;border-left:4px solid '+color+';padding:14px 18px;margin:10px 0;border-radius:4px;color:#999;font-style:italic">Aucune donnée pour '+label+' sur cette période.</div>';
    return '<div style="border:2px solid '+color+';border-radius:8px;margin-bottom:28px;overflow:hidden">'
      +'<div style="background:'+color+';color:#fff;padding:10px 16px;font-size:1rem;font-weight:800;text-transform:uppercase;letter-spacing:2px">'
      +'<i class="bi bi-truck-front-fill"></i> Partie '+suffix+' — '+label+'</div>'
      +'<div style="padding:14px">'
      +'<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:14px">'+kpi+'</div>'
      +sHead('HM — Heures de Marche')+tbl(hmEHdr,hmERows)+'<canvas id="rptChartHM'+suffix+'" height="70"></canvas></div>'
      +sHead('Gasoil','#e67e22')+tbl(gasEHdr,gasERows)+'<canvas id="rptChartGas'+suffix+'" height="70"></canvas></div>'
      +sHead('Huiles','#9b59b6')+tbl(huiEHdr,huiERows)+'<canvas id="rptChartHui'+suffix+'" height="70"></canvas></div>'
      +sHead('Pneumatiques','#16a085')+(pnEW.length>0?tbl(pnEHdr,pnERows):'<p style="color:#999;font-style:italic;font-size:.78rem">Aucun pneu changé.</p>')+'</div>'
      +'</div></div>';
  }
  // KPIs globaux
  var kpiHtml = [{v:entries.length,l:'Engins Total',c:'#f5a623'},{v:totH.toFixed(1)+'h',l:'HM Total',c:'#4bc0c0'},{v:totG.toFixed(0)+'L',l:'Gasoil Total',c:'#e67e22'},{v:totHu.toFixed(1)+'L',l:'Huiles Total',c:'#9966ff'},{v:totP,l:'Pneus Changés',c:'#ff6384'}]
    .map(function(k){ return '<div style="background:#f9f6ef;border-radius:8px;padding:12px 8px;text-align:center;border-top:4px solid '+k.c+'"><div style="font-size:1.3rem;font-weight:800;color:'+k.c+'">'+k.v+'</div><div style="font-size:.7rem;color:#666;margin-top:2px">'+k.l+'</div></div>'; }).join('');
  // --- S1: HM ---
  var hmTypeHdr = '<thead><tr><th style="'+THL+'">Type Engin</th><th style="'+TH+'">Nb</th><th style="'+TH+'">HM R\u00e9el (h)</th><th style="'+TH+'">Budget (h)</th><th style="'+TH+'">\u00c9cart (h)</th><th style="'+TH+'">\u00c9cart %</th></tr></thead>';
  var hmTypeRows = '<tbody>'+Object.keys(byTypeMap).map(function(t){var d=byTypeMap[t];var b=STORE.budgets.find(function(x){return x.type===t;})||{};var bh=b.hm||0;var ec=bh?+(d.heures-bh).toFixed(1):null;var c=ec===null?'#666':(ec>=0?'#27ae60':'#c0392b');return '<tr><td style="'+TDL+'">'+t.toUpperCase()+'</td><td style="'+TD+'">'+d.count+'</td><td style="'+TD+';font-weight:700">'+d.heures.toFixed(1)+'</td><td style="'+TD+'">'+( bh||'—')+'</td>'+ecartTd(ec,false)+'<td style="'+TD+';color:'+c+'">'+(ec!==null&&bh?Math.round(ec/bh*100)+'%':'—')+'</td></tr>';}).join('')+'</tbody>';
  var hmEngHdr  = '<thead><tr><th style="'+THL+'">Engin</th><th style="'+TH+'">Type</th><th style="'+TH+'">HM R\u00e9el (h)</th><th style="'+TH+'">Budget / engin (h)</th><th style="'+TH+'">\u00c9cart (h)</th><th style="'+TH+'">\u00c9cart %</th></tr></thead>';
  var hmEngRows = '<tbody>'+entries.map(function(g,i){var b=STORE.budgets.find(function(x){return x.type===g.eng.type;})||{};var cnt=entries.filter(function(x){return x.eng.type===g.eng.type;}).length||1;var bh=b.hm?+(b.hm/cnt).toFixed(1):0;var ec=bh?+(g.heures-bh).toFixed(1):null;var c=ec===null?'#666':(ec>=0?'#27ae60':'#c0392b');return '<tr style="background:'+(i%2===0?'#fff':'#fafaf8')+'"><td style="'+TDL+'">'+g.eng.designation+'</td><td style="'+TD+';color:#666">'+( g.eng.type||'—')+'</td><td style="'+TD+';font-weight:700">'+g.heures.toFixed(1)+'</td><td style="'+TD+'">'+(bh?bh+'h <small style="color:#999">(÷'+cnt+')</small>':'—')+'</td>'+ecartTd(ec,false)+'<td style="'+TD+';color:'+c+'">'+(ec!==null&&bh?Math.round(ec/bh*100)+'%':'—')+'</td></tr>';}).join('')+'</tbody>';
  // --- S2: Gasoil ---
  var gasTypeHdr = '<thead><tr><th style="'+THL+'">Type Engin</th><th style="'+TH+'">Conso (L)</th><th style="'+TH+'">Ratio R\u00e9el L/HM</th><th style="'+TH+'">Budget L/HM</th><th style="'+TH+'">\u00c9cart</th></tr></thead>';
  var gasTypeRows= '<tbody>'+Object.keys(byTypeMap).map(function(t){var d=byTypeMap[t];var b=STORE.budgets.find(function(x){return x.type===t;})||{};var br=b.gasoil||0;var rr=d.heures>0?+(d.gasoil/d.heures).toFixed(2):0;var ec=br?+(rr-br).toFixed(2):null;return '<tr><td style="'+TDL+'">'+t.toUpperCase()+'</td><td style="'+TD+'">'+d.gasoil.toFixed(0)+'</td><td style="'+TD+';font-weight:700">'+rr+'</td><td style="'+TD+'">'+( br||'—')+'</td>'+ecartTd(ec,true)+'</tr>';}).join('')+'</tbody>';
  var gasEngHdr  = '<thead><tr><th style="'+THL+'">Engin</th><th style="'+TH+'">Type</th><th style="'+TH+'">Conso (L)</th><th style="'+TH+'">Ratio L/HM</th><th style="'+TH+'">Budget L/HM</th><th style="'+TH+'">\u00c9cart</th></tr></thead>';
  var gasEngRows = '<tbody>'+entries.map(function(g,i){var b=STORE.budgets.find(function(x){return x.type===g.eng.type;})||{};var br=b.gasoil||0;var rr=g.heures>0?+(g.gasoil/g.heures).toFixed(2):0;var ec=br?+(rr-br).toFixed(2):null;return '<tr style="background:'+(i%2===0?'#fff':'#fafaf8')+'"><td style="'+TDL+'">'+g.eng.designation+'</td><td style="'+TD+';color:#666">'+( g.eng.type||'—')+'</td><td style="'+TD+'">'+g.gasoil.toFixed(0)+'</td><td style="'+TD+';font-weight:700">'+rr+'</td><td style="'+TD+'">'+( br||'—')+'</td>'+ecartTd(ec,true)+'</tr>';}).join('')+'</tbody>';
  // --- S3: Huiles ---
  var huiTypeHdr = '<thead><tr><th style="'+THL+'">Type Engin</th><th style="'+TH+'">Conso (L)</th><th style="'+TH+'">Ratio R\u00e9el L/HM</th><th style="'+TH+'">Budget L/HM</th><th style="'+TH+'">\u00c9cart</th></tr></thead>';
  var huiTypeRows= '<tbody>'+Object.keys(byTypeMap).map(function(t){var d=byTypeMap[t];var b=STORE.budgets.find(function(x){return x.type===t;})||{};var br=b.huile||0;var rr=d.heures>0?+(d.huiles/d.heures).toFixed(3):0;var ec=br?+(rr-br).toFixed(3):null;return '<tr><td style="'+TDL+'">'+t.toUpperCase()+'</td><td style="'+TD+'">'+d.huiles.toFixed(1)+'</td><td style="'+TD+';font-weight:700">'+rr+'</td><td style="'+TD+'">'+( br||'—')+'</td>'+ecartTd(ec,true)+'</tr>';}).join('')+'</tbody>';
  var huiEngHdr  = '<thead><tr><th style="'+THL+'">Engin</th><th style="'+TH+'">Type</th><th style="'+TH+'">Conso (L)</th><th style="'+TH+'">Ratio L/HM</th><th style="'+TH+'">Budget L/HM</th><th style="'+TH+'">\u00c9cart</th></tr></thead>';
  var huiEngRows = '<tbody>'+entries.map(function(g,i){var b=STORE.budgets.find(function(x){return x.type===g.eng.type;})||{};var br=b.huile||0;var rr=g.heures>0?+(g.huiles/g.heures).toFixed(3):0;var ec=br?+(rr-br).toFixed(3):null;return '<tr style="background:'+(i%2===0?'#fff':'#fafaf8')+'"><td style="'+TDL+'">'+g.eng.designation+'</td><td style="'+TD+';color:#666">'+( g.eng.type||'—')+'</td><td style="'+TD+'">'+g.huiles.toFixed(1)+'</td><td style="'+TD+';font-weight:700">'+rr+'</td><td style="'+TD+'">'+( br||'—')+'</td>'+ecartTd(ec,true)+'</tr>';}).join('')+'</tbody>';
  // --- S3b: Huiles par type d'huile ---
  // Calculer totaux huiles par type pour tout le rapport
  var oilTypeTotalsGlobal = {};
  var oilTypeTotalsByEngType = {};
  entries.forEach(function(g){
    var etype = g.eng.type||'Autre';
    if (!oilTypeTotalsByEngType[etype]) oilTypeTotalsByEngType[etype] = {};
    Object.keys(g.huilesByType||{}).forEach(function(ot){
      var qte = g.huilesByType[ot]||0;
      oilTypeTotalsGlobal[ot] = (oilTypeTotalsGlobal[ot]||0) + qte;
      oilTypeTotalsByEngType[etype][ot] = (oilTypeTotalsByEngType[etype][ot]||0) + qte;
    });
  });
  var oilNames = Object.keys(oilTypeTotalsGlobal).sort(function(a,b){ return oilTypeTotalsGlobal[b]-oilTypeTotalsGlobal[a]; });
  // Recommandations par type d'huile
  var oilRecos = {
    'HV68': ['Vérifier l\'état des circuits hydrauliques (fuites, joints).','Contrôler les filtres hydrauliques, les remplacer si nécessaire.','Réduire les cycles en charge excessive qui augmentent la consommation hydraulique.'],
    'S30':  ['Vérifier le joint de culasse et la bague de piston (traces blanches = eau dans l\'huile).','Contrôler les niveaux quotidiennement et analyser l\'huile si hausse persistante.','Respecter les intervalles de vidange constructeur.'],
    'S50':  ['Inspecter les joints-spi de transmission et les bagues.','Vérifier l\'absence de fuites au niveau des différentiels.','Contrôler le filtre à huile transmission.'],
    '15W40':['Vérifier le joint de culasse (mousse dans l\'huile = eau).','Contrôler la segmentation moteur si consommation élevée.','Respecter la périodicité de vidange.'],
    'AUTRAN':['Inspecter les joints de la transmission automatique.','Vérifier le niveau régulièrement en chaud et à régime normal.','Filtrer l\'Autran si coloration foncée ou odeur de brûlé.'],
    '85W140':['Vérifier les fuites aux pont-arrière et réducteurs.','Contrôler les niveaux à chaque entretien périodique.','Surveiller les jeux de roulement (usure accélérée = perte d\'étanchéité).']
  };
  function getOilReco(ot) {
    return oilRecos[ot] || ['Vérifier les circuits et joints associés à cette huile.','Contrôler les niveaux régulièrement.','Analyser un échantillon d\'huile en laboratoire si consommation anormale.'];
  }
  function buildOilSection() {
    if (!oilNames.length) return '<p style="color:#999;font-style:italic;font-size:.78rem">Aucune donnée d\'huile enregistrée sur cette période.</p>';
    var html = '';
    // Tableau global par type d'huile
    html += '<div style="margin-bottom:14px">';
    html += '<div style="font-size:.78rem;font-weight:700;color:#8e44ad;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">🛢 Classement global par type d\'huile (du plus consommé)</div>';
    html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">';
    html += '<thead><tr><th style="'+THL+'">Type d\'huile</th><th style="'+TH+'">Total (L)</th><th style="'+TH+'">% du total</th><th style="'+TH+'">Barre</th></tr></thead><tbody>';
    var totalOilGlobal = oilNames.reduce(function(s,k){return s+(oilTypeTotalsGlobal[k]||0);},0);
    oilNames.forEach(function(ot,i){
      var qte = oilTypeTotalsGlobal[ot]||0;
      var pct = totalOilGlobal>0 ? Math.round(qte/totalOilGlobal*100) : 0;
      var barColor = i===0?'#c0392b':i===1?'#e67e22':'#8e44ad';
      html += '<tr style="background:'+(i%2===0?'#fff':'#fdf5ff')+'">';
      html += '<td style="'+TDL+';border-left:4px solid '+barColor+'">'+ot+'</td>';
      html += '<td style="'+TD+';font-weight:700;color:'+barColor+'">'+qte.toFixed(1)+' L</td>';
      html += '<td style="'+TD+'">'+pct+'%</td>';
      html += '<td style="padding:6px 10px;border:1px solid #eee"><div style="background:#eee;border-radius:3px;height:7px"><div style="background:'+barColor+';width:'+pct+'%;height:7px;border-radius:3px"></div></div></td>';
      html += '</tr>';
    });
    html += '</tbody></table></div></div>';
    // Tableau par type d'engin
    html += '<div style="margin-bottom:14px">';
    html += '<div style="font-size:.78rem;font-weight:700;color:#8e44ad;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">📊 Consommation par type d\'engin</div>';
    html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">';
    var oilHdrCols = '<thead><tr><th style="'+THL+'">Type Engin</th>'+oilNames.map(function(o){return '<th style="'+TH+';">'+o+' (L)</th>';}).join('')+'<th style="'+TH+'">Total (L)</th></tr></thead>';
    html += oilHdrCols+'<tbody>';
    Object.keys(oilTypeTotalsByEngType).forEach(function(et,i){
      var row = oilTypeTotalsByEngType[et];
      var rowTotal = oilNames.reduce(function(s,k){return s+(row[k]||0);},0);
      html += '<tr style="background:'+(i%2===0?'#fff':'#fdf5ff')+'">';
      html += '<td style="'+TDL+'">'+et.toUpperCase()+'</td>';
      oilNames.forEach(function(o){
        var v = row[o]||0;
        html += '<td style="'+TD+(v>0?';font-weight:700;color:#8e44ad':'')+'">'+( v>0?v.toFixed(1)+'L':'—')+'</td>';
      });
      html += '<td style="'+TD+';font-weight:700">'+rowTotal.toFixed(1)+' L</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div></div>';
    // Tableau détail par engin
    var engsWithOil = entries.filter(function(g){return Object.keys(g.huilesByType||{}).length>0;});
    if (engsWithOil.length) {
      html += '<div style="margin-bottom:14px">';
      html += '<div style="font-size:.78rem;font-weight:700;color:#8e44ad;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">🔧 Détail par engin</div>';
      html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">';
      html += '<thead><tr><th style="'+THL+'">Engin</th><th style="'+TH+'">Type</th>'+oilNames.map(function(o){return '<th style="'+TH+';">'+o+' (L)</th>';}).join('')+'<th style="'+TH+'">Total (L)</th></tr></thead><tbody>';
      engsWithOil.forEach(function(g,i){
        var rowTotal = oilNames.reduce(function(s,k){return s+((g.huilesByType||{})[k]||0);},0);
        html += '<tr style="background:'+(i%2===0?'#fff':'#fdf5ff')+'">';
        html += '<td style="'+TDL+'">'+g.eng.designation+'</td><td style="'+TD+';color:#888;font-size:.72rem">'+( g.eng.type||'—')+'</td>';
        oilNames.forEach(function(o){
          var v = (g.huilesByType||{})[o]||0;
          html += '<td style="'+TD+(v>0?';font-weight:700;color:#8e44ad':'')+'">'+( v>0?v.toFixed(1)+'L':'—')+'</td>';
        });
        html += '<td style="'+TD+';font-weight:700">'+rowTotal.toFixed(1)+' L</td>';
        html += '</tr>';
      });
      html += '</tbody></table></div></div>';
    }
    // Recommandations par type d'huile le plus consommé
    html += '<div style="margin-bottom:6px;font-size:.78rem;font-weight:700;color:#1a5276;text-transform:uppercase;letter-spacing:.5px">📋 Recommandations pour réduire la consommation</div>';
    oilNames.slice(0,4).forEach(function(ot){
      var qte = oilTypeTotalsGlobal[ot]||0;
      var recos = getOilReco(ot);
      var borderCol = oilNames.indexOf(ot)===0?'#c0392b':oilNames.indexOf(ot)===1?'#e67e22':'#8e44ad';
      html += '<div style="border:1px solid #e0e0e0;border-left:4px solid '+borderCol+';border-radius:6px;padding:10px 14px;margin-bottom:8px;background:#fafafa">';
      html += '<div style="font-size:.8rem;font-weight:700;color:'+borderCol+';margin-bottom:4px">🛢 '+ot+' — '+qte.toFixed(1)+' L consommés</div>';
      html += '<ul style="margin:0;padding-left:16px;font-size:.73rem;color:#444">';
      recos.forEach(function(r){ html += '<li style="margin-bottom:3px">'+r+'</li>'; });
      html += '</ul></div>';
    });
    return html;
  }
  // --- S4: Pneus ---
  var pnEngWithData = entries.filter(function(g){return g.pneus.total>0;});
  var pnEngHdr  = '<thead><tr><th style="'+THL+'">Engin</th><th style="'+TH+'">Type</th><th style="'+TH+'">AVG</th><th style="'+TH+'">AVD</th><th style="'+TH+'">ARG</th><th style="'+TH+'">ARD</th><th style="'+TH+'">Total</th><th style="'+TH+'">Dur\u00e9e vie moy.</th></tr></thead>';
  var pnEngRows = '<tbody>'+pnEngWithData.map(function(g,i){return '<tr style="background:'+(i%2===0?'#fff':'#f0fff8')+'"><td style="'+TDL+'">'+g.eng.designation+'</td><td style="'+TD+';color:#666">'+( g.eng.type||'—')+'</td><td style="'+TD+'">'+g.pneus.avg+'</td><td style="'+TD+'">'+g.pneus.avd+'</td><td style="'+TD+'">'+g.pneus.arg+'</td><td style="'+TD+'">'+g.pneus.ard+'</td><td style="'+TD+';font-weight:700">'+g.pneus.total+'</td><td style="'+TD+'">'+(g.heures>0&&g.pneus.total>0?(g.heures/g.pneus.total).toFixed(0)+'h/pneu':'—')+'</td></tr>';}).join('')+'</tbody>';
  var pnTypeHdr = '<thead><tr><th style="'+THL+'">Type Engin</th><th style="'+TH+'">Pneus Chang\u00e9s</th><th style="'+TH+'">Dur\u00e9e vie moy. (h/pneu)</th></tr></thead>';
  var pnTypeRows= '<tbody>'+Object.keys(byTypeMap).map(function(t){var d=byTypeMap[t];return '<tr><td style="'+TDL+'">'+t.toUpperCase()+'</td><td style="'+TD+';font-weight:700">'+d.pneus+'</td><td style="'+TD+'">'+(d.heures>0&&d.pneus>0?(d.heures/d.pneus).toFixed(0)+'h/pneu':'—')+'</td></tr>';}).join('')+'</tbody>';
  // --- S5: Statuts ---
  var totalIntv = Object.values(statusCounts).reduce(function(a,b){return a+b;},0);
  var stColors = {'Fait':'#27ae60','Non fait':'#c0392b','\u00c0 programmer':'#f39c12','Programm\u00e9':'#3498db','Programm\u00e9 non fait':'#e67e22','Programm\u00e9 et fait':'#16a085'};
  var statRows = '<tbody>'+Object.keys(statusCounts).map(function(s){var c=statusCounts[s];var pct=totalIntv>0?Math.round(c/totalIntv*100):0;var col=stColors[s]||'#888';return '<tr><td style="'+TDL+';border-left:4px solid '+col+'">'+s+'</td><td style="'+TD+';color:'+col+';font-weight:700">'+c+'</td><td style="'+TD+'">'+pct+'%</td><td style="padding:6px 10px;border:1px solid #eee"><div style="background:#eee;border-radius:3px;height:7px"><div style="background:'+col+';width:'+pct+'%;height:7px;border-radius:3px"></div></div></td></tr>';}).join('')+'</tbody>';
  var statHdr   = '<thead><tr><th style="'+THL+'">Statut</th><th style="'+TH+'">Nb</th><th style="'+TH+'">%</th><th style="'+TH+'">Barre</th></tr></thead>';
  // --- S6: Faits marquants ---
  var stColors2={'Fait':'#27ae60','Non fait':'#c0392b','\u00c0 programmer':'#f39c12','Programm\u00e9':'#3498db','Programm\u00e9 non fait':'#e67e22','Programm\u00e9 et fait':'#16a085'};
  var fmHdr='<thead><tr><th style="'+TH+'">Date</th><th style="'+THL+'">Engin</th><th style="'+TH+'">Type Engin</th><th style="'+TH+'">Type Interv.</th><th style="'+TH+'">\u00c9tat</th><th style="'+THL+'">Description</th><th style="'+THL+'">Pi\u00e8ces</th></tr></thead>';
  var fmRows2='<tbody>'+(allFms.length>0
    ? allFms.map(function(f,i){var stCol=stColors2[f.statut]||'#888';return '<tr style="background:'+(i%2===0?'#fff':'#fff5f5')+';border-left:3px solid #c0392b"><td style="'+TD+';color:#888;white-space:nowrap">'+(f.date||'\u2014')+'</td><td style="'+TDL+';color:#c0392b">&#9733; '+f.eng+'</td><td style="'+TD+';color:#666;font-size:.7rem">'+(f.engType||'\u2014')+'</td><td style="'+TD+'">'+(f.type||'\u2014')+'</td><td style="'+TD+';color:'+stCol+';font-weight:700">'+(f.statut||'\u2014')+'</td><td style="'+TDL+'">'+(f.desc||'\u2014')+'</td><td style="'+TDL+';color:#555;font-size:.73rem">'+(f.pieces||'\u2014')+'</td></tr>';}).join('')
    : '<tr><td colspan="7" style="padding:14px;text-align:center;color:#aaa;font-style:italic">Aucun fait marquant enregistr\u00e9 sur cette p\u00e9riode.</td></tr>'
  )+'</tbody>';
  // Build full HTML
  var html = '<div>'
    // HEADER
    +'<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #f5a623;padding-bottom:14px;margin-bottom:18px">'
    +'<img src="logo.png.png" style="height:54px;object-fit:contain" onerror="this.style.display=\'none\'">'
    +'<div style="text-align:center"><h1 style="margin:0;font-size:1.4rem;color:#1a1a1a;text-transform:uppercase;letter-spacing:2px">'+title+'</h1>'
    +'<p style="margin:4px 0 0;color:#777;font-size:.85rem">P\u00e9riode : <strong>'+period+'</strong></p></div>'
    +'<div style="text-align:right"><div style="font-size:1.2rem;font-weight:800;color:#f5a623;letter-spacing:3px">MANAGEM</div>'
    +'<div style="font-size:.72rem;color:#999">Gestion Parc Engins Mini\u00e8res</div>'
    +'<div style="font-size:.7rem;color:#bbb;margin-top:3px">G\u00e9n\u00e9r\u00e9 le '+genDate+'</div></div></div>'
    // KPIs globaux
    +'<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:18px">'+kpiHtml+'</div>'
    // Parties dynamiques par type sélectionné
    + (function(){
      var colors = ['#e67e22','#2980b9','#27ae60','#8e44ad','#c0392b','#16a085','#f39c12','#3498db'];
      var htmlParts = '';
      Object.keys(typeGroups).forEach(function(t, i){
        var g = typeGroups[t];
        var m = typeGroupMaps[t];
        var gt = groupTotals[t];
        var color = colors[i % colors.length];
        var suffix = '_'+t.replace(/[^a-zA-Z0-9]/g,'').toUpperCase();
        htmlParts += buildPartHtml(t, color, g, m, gt.h, gt.g, gt.hu, gt.p, suffix);
      });
      return htmlParts;
    })()
    // Statuts
    +sHead('Statuts des Interventions','#555')
    +(totalIntv>0
      ? tbl(statHdr,statRows)
      : '<p style="color:#999;font-style:italic;font-size:.78rem">Aucune intervention enregistr\u00e9e.</p>')
    +'</div>'
    // Faits marquants
    +sHead('Faits Marquants \u2605 ('+(allFms.length||'Aucun')+')','#c0392b')
    +(allFms.length>0
      ? '<p style="font-size:.72rem;color:#c0392b;margin:0 0 10px"><i class="bi bi-exclamation-triangle-fill"></i> '+allFms.length+' fait(s) marquant(s) enregistr\u00e9(s) sur la p\u00e9riode.</p>'
        +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px;align-items:start">'
        +'<canvas id="rptChartFM" height="180"></canvas>'
        +'<div>'
        +Object.keys(fmStatusCounts).map(function(s){
            var cnt=fmStatusCounts[s];
            var pct=allFms.length>0?Math.round(cnt/allFms.length*100):0;
            var stCols2={'Fait':'#27ae60','Non fait':'#c0392b','\u00c0 programmer':'#f39c12','Programm\u00e9':'#3498db','Programm\u00e9 non fait':'#e67e22','Programm\u00e9 et fait':'#16a085'};
            var col=stCols2[s]||'#888';
            return '<div style="margin-bottom:7px"><div style="display:flex;justify-content:space-between;font-size:.75rem;margin-bottom:2px"><span style="font-weight:600;color:'+col+'">'+s+'</span><span style="color:#555">'+cnt+' ('+pct+'%)</span></div><div style="background:#eee;border-radius:4px;height:9px"><div style="background:'+col+';width:'+pct+'%;height:9px;border-radius:4px"></div></div></div>';
          }).join('')
        +'</div></div>'
      : '')
    +tbl(fmHdr,fmRows2)+'</div>'
    // Planning Maintenance Gantt
    +(function(){
      var gHtml = buildReportGanttHtml(dateDeb, dateFin);
      return gHtml
        ? sHead('Planning Maintenance \u2014 Gantt','#e67e22')
          + '<p style="font-size:.72rem;color:#888;margin:0 0 8px">P\u00e9riode\u00a0: '+(dateDeb||'début')+'  \u2192  '+(dateFin||'fin')+'</p>'
          + gHtml + '</div>'
        : '';
    })()
    // Section Huiles détaillées par type
    +sHead('Détail Consommation Huiles par Type 🛢','#8e44ad')
    +buildOilSection()+'</div>'
    // Analyse Consommation
    +sHead('Analyse Consommation — Gasoil & Huiles \uD83D\uDD0D','#1a5276')
    +buildAnalyseHtml(entries, byTypeMap, period)+'</div>'
    // FOOTER
    +'<div style="margin-top:22px;padding-top:8px;border-top:1px solid #ddd;display:flex;justify-content:space-between;font-size:.7rem;color:#aaa">'
    +'<span>MANAGEM \u2014 Gestion Parc Engins Mini\u00e8res</span>'
    +'<span>Rapport g\u00e9n\u00e9r\u00e9 le '+genDate+'</span></div></div>';
  document.getElementById('rptPreview').innerHTML = html;
  document.getElementById('rptPreviewWrap').style.display = '';
  document.getElementById('rptExportBtns').style.display = '';
  var chartGroups = [];
  Object.keys(typeGroups).forEach(function(t){
    chartGroups.push({type:t, entries:typeGroups[t], map:typeGroupMaps[t], totals:groupTotals[t]});
  });
  window._rptData = {entries:entries, typeGroups:typeGroups, typeGroupMaps:typeGroupMaps, groupTotals:groupTotals, byTypeMap:byTypeMap, statusCounts:statusCounts, totH:totH, totG:totG, totHu:totHu, totP:totP, totF:0, allFms:allFms, fmStatusCounts:fmStatusCounts, title:title, period:period, genDate:genDate};
  setTimeout(function(){ _renderRptCharts(chartGroups, statusCounts, fmStatusCounts, allFms.length); }, 120);
}
function _renderRptCharts(chartGroups, statusCounts, fmStatusCounts, fmTotal) {
  var gridC = 'rgba(0,0,0,.07)';
  var tickF  = {size:9, color:'#555'};
  function mkChart(id, cfg) {
    var c = document.getElementById(id); if (!c||typeof Chart==='undefined') return;
    if (c._chart) c._chart.destroy();
    c._chart = new Chart(c.getContext('2d'), cfg);
  }
  var DL = window.ChartDataLabels ? [ChartDataLabels] : [];
  var baseOpts = function(title, horiz) {
    var o = {responsive:true,animation:{duration:500},
      plugins:{
        legend:{position:'top',labels:{font:tickF,boxWidth:10,padding:6}},
        title:{display:!!title,text:title||'',font:{size:10,weight:'bold'},color:'#333'},
        datalabels:{
          display:function(ctx){ return ctx.dataset.type!=='line' && ctx.parsed[horiz?'x':'y']>0; },
          anchor: horiz ? 'end' : 'end',
          align: horiz ? 'right' : 'top',
          color:'#333',
          font:{weight:'bold',size:9},
          formatter:function(v){ return v>0 ? (Number.isInteger(v)?v:v) : ''; }
        }
      },
      scales:{x:{grid:{color:gridC},ticks:{font:tickF}},y:{beginAtZero:true,grid:{color:gridC},ticks:{font:tickF}}}};
    if (horiz) { o.indexAxis='y'; o.scales.x.beginAtZero=true; o.scales.y.grid={color:'transparent'}; o.layout={padding:{right:40}}; }
    return o;
  };
  function drawGroupCharts(ents, suffix, hmColor, gasColor, huiColor) {
    if (!ents.length) return;
    var lbE = ents.map(function(g){return g.eng.designation;});
    // HM
    mkChart('rptChartHM'+suffix,{type:'bar',data:{labels:lbE,datasets:[
      {label:'HM R\u00e9el',data:ents.map(function(g){return +g.heures.toFixed(1);}),backgroundColor:hmColor,borderRadius:3},
      {label:'Budget / engin',data:ents.map(function(g){var b=STORE.budgets.find(function(x){return x.type===g.eng.type;})||{};var cnt=ents.filter(function(x){return x.eng.type===g.eng.type;}).length||1;return b.hm?+(b.hm/cnt).toFixed(1):0;}),backgroundColor:'rgba(150,150,150,.18)',borderColor:'#bbb',borderWidth:1,borderRadius:3}
    ],plugins:DL},options:baseOpts('HM R\u00e9el vs Budget',true)});
    // Gasoil
    mkChart('rptChartGas'+suffix,{type:'bar',data:{labels:lbE,datasets:[
      {label:'Ratio R\u00e9el L/HM',data:ents.map(function(g){return g.heures>0?+(g.gasoil/g.heures).toFixed(2):0;}),backgroundColor:gasColor,borderRadius:3},
      {type:'line',label:'Budget L/HM',data:ents.map(function(g){var b=STORE.budgets.find(function(x){return x.type===g.eng.type;})||{};return b.gasoil||0;}),borderColor:'#e74c3c',borderWidth:2,borderDash:[5,4],pointRadius:4,pointBackgroundColor:'#e74c3c',fill:false}
    ],plugins:DL},options:baseOpts('Gasoil L/HM — R\u00e9el vs Budget')});
    // Huiles
    mkChart('rptChartHui'+suffix,{type:'bar',data:{labels:lbE,datasets:[
      {label:'Ratio R\u00e9el L/HM',data:ents.map(function(g){return g.heures>0?+(g.huiles/g.heures).toFixed(3):0;}),backgroundColor:huiColor,borderRadius:3},
      {type:'line',label:'Budget L/HM',data:ents.map(function(g){var b=STORE.budgets.find(function(x){return x.type===g.eng.type;})||{};return b.huile||0;}),borderColor:'#8e44ad',borderWidth:2,borderDash:[5,4],pointRadius:4,pointBackgroundColor:'#8e44ad',fill:false}
    ],plugins:DL},options:baseOpts('Huiles L/HM — R\u00e9el vs Budget')});
  }
  var chartColors = ['rgba(230,126,34,.8)','rgba(41,128,185,.8)','rgba(39,174,96,.8)','rgba(142,68,173,.8)','rgba(192,57,43,.8)','rgba(22,160,133,.8)','rgba(243,156,18,.8)','rgba(52,152,219,.8)'];
  chartGroups.forEach(function(grp, i){
    var c = chartColors[i % chartColors.length];
    var c2 = c.replace('.8)', '.7)');
    var suffix = '_'+grp.type.replace(/[^a-zA-Z0-9]/g,'').toUpperCase();
    drawGroupCharts(grp.entries, suffix, c, c2, c2);
  });
  // FM statuts bar chart
  if (fmStatusCounts && Object.keys(fmStatusCounts).length>0) {
    var fmLbls = Object.keys(fmStatusCounts);
    var fmData = fmLbls.map(function(s){ return fmStatusCounts[s]; });
    var fmPcts = fmLbls.map(function(s){ return fmTotal>0?Math.round(fmStatusCounts[s]/fmTotal*100):0; });
    var fmColMap = {'Fait':'rgba(39,174,96,.85)','Non fait':'rgba(192,57,43,.85)','\u00c0 programmer':'rgba(243,156,18,.85)','Programm\u00e9':'rgba(52,152,219,.85)','Programm\u00e9 non fait':'rgba(230,126,34,.85)','Programm\u00e9 et fait':'rgba(22,160,133,.85)'};
    var fmBgColors = fmLbls.map(function(s){ return fmColMap[s]||'rgba(136,136,136,.8)'; });
    mkChart('rptChartFM',{type:'bar',plugins:DL,data:{labels:fmLbls,datasets:[{
      label:'Faits Marquants par Statut',
      data:fmData,
      backgroundColor:fmBgColors,
      borderRadius:5,
      borderSkipped:false
    }]},options:{
      responsive:true,
      animation:{duration:600},
      plugins:{
        legend:{display:false},
        title:{display:true,text:'R\u00e9partition des Faits Marquants par Statut',font:{size:11,weight:'bold'},color:'#c0392b'},
        datalabels:{
          display:true,
          anchor:'end',align:'top',
          color:function(ctx){ return fmColMap[fmLbls[ctx.dataIndex]]||'#555'; },
          font:{weight:'bold',size:10},
          formatter:function(v,ctx){ return v+' ('+fmPcts[ctx.dataIndex]+'%)'; }
        }
      },
      scales:{
        x:{grid:{color:'rgba(0,0,0,.05)'},ticks:{font:{size:9},color:'#555'}},
        y:{beginAtZero:true,grid:{color:'rgba(0,0,0,.07)'},ticks:{font:{size:9},stepSize:1}}
      },
      layout:{padding:{top:20}}
    }});
  }
}

function exportReportPDF() {
  var el = document.getElementById('rptPreview');
  if (!el || !el.innerHTML.trim()) { alert('Pr\u00e9visualisez d\'abord le rapport.'); return; }
  if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') { alert('Biblioth\u00e8ques PDF non charg\u00e9es. V\u00e9rifiez votre connexion internet.'); return; }
  html2canvas(el, {scale:2, useCORS:true, allowTaint:true, backgroundColor:'#ffffff'}).then(function(canvas) {
    var jsPDF = window.jspdf.jsPDF;
    var pdf = new jsPDF({orientation:'portrait', unit:'mm', format:'a4'});
    var pw = pdf.internal.pageSize.getWidth();
    var ph = pdf.internal.pageSize.getHeight();
    var imgH = canvas.height * pw / canvas.width;
    var left = imgH;
    var pos = 0;
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, pos, pw, imgH);
    left -= ph;
    while (left > 0) { pos -= ph; pdf.addPage(); pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, pos, pw, imgH); left -= ph; }
    pdf.save('rapport_parc_engins_' + new Date().toISOString().slice(0,10) + '.pdf');
  });
}
function printSection(elementId, title) {
  var el = document.getElementById(elementId);
  if (!el) { alert('Contenu introuvable.'); return; }
  var w = window.open('', '_blank', 'width=1100,height=800');
  w.document.write('<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">');
  w.document.write('<title>'+(title||'Impression')+'</title>');
  w.document.write('<style>');
  w.document.write('*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}');
  w.document.write('body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;background:#fff;margin:0;padding:20px}');
  w.document.write('h5,h6{color:#1a1a1a;margin-bottom:8px}');
  w.document.write('table{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:11px}');
  w.document.write('th{background:#f5a623;color:#fff;padding:6px 8px;border:1px solid #ddd;text-align:left}');
  w.document.write('td{padding:5px 8px;border:1px solid #ddd}');
  w.document.write('tr:nth-child(even) td{background:#f9f9f9}');
  w.document.write('.card-dark{background:#f4f4f4;border:1px solid #ddd;border-radius:6px;padding:10px;margin-bottom:10px}');
  w.document.write('.section-title{background:#f5a623;color:#fff;padding:5px 10px;border-radius:4px;font-weight:700;margin:10px 0 6px;font-size:12px}');
  w.document.write('.badge{display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700}');
  w.document.write('.text-warning{color:#c27800!important}.text-danger{color:#c0392b!important}.text-success{color:#27ae60!important}.text-muted{color:#666!important}');
  w.document.write('.btn{display:none!important}');
  w.document.write('.no-print{display:none!important}');
  w.document.write('.table-dark{background:#fff!important;color:#111!important}');
  w.document.write('.table-dark th{background:#555!important;color:#fff!important}');
  w.document.write('.table-dark td{color:#111!important;border-color:#ccc!important}');
  w.document.write('.table-dark tr:nth-child(even) td{background:#f0f0f0!important}');
  w.document.write('canvas{max-width:100%!important;height:auto!important}');
  w.document.write('.print-header{text-align:center;border-bottom:3px solid #f5a623;padding-bottom:10px;margin-bottom:16px}');
  w.document.write('.print-header h2{margin:0;font-size:16px;text-transform:uppercase;letter-spacing:1px}');
  w.document.write('.print-header p{margin:4px 0 0;color:#777;font-size:11px}');
  w.document.write('@media print{body{padding:10px}button{display:none!important}canvas{page-break-inside:avoid}}');
  w.document.write('</style></head><body>');
  w.document.write('<div class="print-header"><h2><i></i> '+(title||'Rapport')+'</h2>');
  w.document.write('<p>MANAGEM &mdash; Gestion Parc Engins Minières &nbsp;|&nbsp; Imprimé le '+new Date().toLocaleDateString('fr-FR')+'</p></div>');
  w.document.write(el.innerHTML);
  w.document.write('</body></html>');
  w.document.close();
  setTimeout(function(){ w.focus(); w.print(); }, 600);
}
function printRapport() {
  var el = document.getElementById('rptPreview');
  if (!el || !el.innerHTML.trim()) { alert('Prévisualisez d\'abord le rapport.'); return; }
  printSection('rptPreview', document.getElementById('rptTitle').value || 'Rapport Gestion Parc Engins');
}
function exportReportWord() {
  var el = document.getElementById('rptPreview');
  if (!el || !el.innerHTML.trim()) { alert('Pr\u00e9visualisez d\'abord le rapport.'); return; }
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
    +'<style>body{font-family:Arial,sans-serif;margin:2cm;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #ccc;padding:6px 10px;}th{background:#f5a623;color:#fff;}</style>'
    +'</head><body>'+el.innerHTML+'</body></html>';
  var blob = new Blob(['\ufeff', html], {type:'application/msword'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href=url; a.download='rapport_parc_engins_'+new Date().toISOString().slice(0,10)+'.doc'; a.click();
  URL.revokeObjectURL(url);
}
function exportReportPPT() {
  var d = window._rptData;
  if (!d) { alert('Pr\u00e9visualisez d\'abord le rapport.'); return; }
  if (typeof PptxGenJS === 'undefined') { alert('Biblioth\u00e8que PowerPoint non charg\u00e9e. V\u00e9rifiez votre connexion internet.'); return; }
  var pptx = new PptxGenJS();
  var GOLD='F5A623', WHITE='FFFFFF', DARK='1A1A1A', GRAY='666666', RED='C0392B';
  // Slide 1 — Couverture
  var s1 = pptx.addSlide();
  s1.background = {color:DARK};
  s1.addShape(pptx.ShapeType.rect, {x:0, y:2.8, w:13.33, h:1.9, fill:{color:'2A1A00'}});
  s1.addText(d.title.toUpperCase(), {x:1, y:3.0, w:11.33, h:1, fontSize:32, bold:true, color:GOLD, align:'center'});
  s1.addText('MANAGEM', {x:1, y:1.5, w:11.33, h:0.8, fontSize:26, bold:true, color:WHITE, align:'center'});
  s1.addText('Gestion Parc Engins Mini\u00e8res', {x:1, y:2.2, w:11.33, h:0.5, fontSize:14, color:'AAAAAA', align:'center'});
  s1.addText('P\u00e9riode : '+d.period, {x:1, y:4.1, w:11.33, h:0.5, fontSize:14, color:'CCCCCC', align:'center'});
  s1.addText('G\u00e9n\u00e9r\u00e9 le '+d.genDate, {x:1, y:6.5, w:11.33, h:0.4, fontSize:11, color:'888888', align:'center'});
  // Slide 2 — KPIs
  var s2 = pptx.addSlide();
  s2.background = {color:'FFFDF7'};
  s2.addText('R\u00c9SUM\u00c9 G\u00c9N\u00c9RAL', {x:0.4, y:0.2, w:12, h:0.6, fontSize:22, bold:true, color:GOLD});
  s2.addShape(pptx.ShapeType.line, {x:0.4, y:0.85, w:12.5, h:0, line:{color:GOLD, width:2}});
  var kpis = [
    {v:String(d.entries.length), l:'Engins', c:GOLD},
    {v:d.totH.toFixed(1)+'h',    l:'Heures marche', c:'4BC0C0'},
    {v:d.totG.toFixed(0)+'L',    l:'Gasoil total',  c:'FF9F40'},
    {v:d.totHu.toFixed(1)+'L',   l:'Huiles total',  c:'9966FF'},
    {v:String(d.totP),           l:'Pneus chang\u00e9s', c:'FF6384'}
  ];
  kpis.forEach(function(k,i) {
    var x = 0.4 + i*2.5;
    s2.addShape(pptx.ShapeType.rect, {x:x, y:1.1, w:2.2, h:2, fill:{color:'FFF8EE'}, line:{color:k.c, width:2}});
    s2.addText(k.v, {x:x, y:1.3, w:2.2, h:1, fontSize:26, bold:true, color:k.c, align:'center'});
    s2.addText(k.l, {x:x, y:2.55, w:2.2, h:0.45, fontSize:11, color:GRAY, align:'center'});
  });
  // Slide 3 — Tableau engins
  var s3 = pptx.addSlide();
  s3.background = {color:'FFFDF7'};
  s3.addText('D\u00c9TAIL PAR ENGIN', {x:0.4, y:0.15, w:12, h:0.5, fontSize:18, bold:true, color:GOLD});
  var hdr = ['Engin','Type','HM (h)','Gasoil (L)','Ratio Gas.','Huiles (L)','Ratio Huile','Pneus','Flex.'];
  var tblData = [hdr.map(function(h){ return {text:h, options:{bold:true, color:WHITE, fill:{color:GOLD}, align:'center'}}; })];
  d.entries.forEach(function(g){
    var rG = g.heures>0?(g.gasoil/g.heures).toFixed(2):'\u2014';
    var rH = g.heures>0?(g.huiles/g.heures).toFixed(3):'\u2014';
    tblData.push([g.eng.designation, g.eng.type||'\u2014', g.heures.toFixed(1), g.gasoil.toFixed(0), rG, g.huiles.toFixed(1), rH, String(g.pneus), String(g.flex)]);
  });
  s3.addTable(tblData, {x:0.3, y:0.8, w:12.7, fontSize:10, border:{type:'solid', color:'E0D0B0', pt:0.5}, autoPage:true});
  // Slide 4 — Faits marquants
  if (d.allFms.length > 0) {
    var s4 = pptx.addSlide();
    s4.background = {color:'FFF9F9'};
    s4.addText('\u2605 FAITS MARQUANTS', {x:0.4, y:0.15, w:12, h:0.5, fontSize:18, bold:true, color:RED});
    var fmHdr = ['Date','Engin','Type','État','Description'];
    var fmTbl = [fmHdr.map(function(h){ return {text:h, options:{bold:true, color:WHITE, fill:{color:RED}, align:'center'}}; })];
    d.allFms.forEach(function(f){ fmTbl.push([f.date||'\u2014', f.eng, f.type||'\u2014', f.statut||'\u2014', f.desc||'\u2014']); });
    s4.addTable(fmTbl, {x:0.3, y:0.8, w:12.7, fontSize:10, border:{type:'solid', color:'FDE8E8', pt:0.5}, autoPage:true});
  }
  pptx.writeFile({fileName:'rapport_parc_engins_'+new Date().toISOString().slice(0,10)+'.pptx'});
}

function renderAll() {
  renderEngins(); renderPersonnel(); renderSaisies(); renderAffectations(); renderPannes(); renderMaintenance(); renderCarburant(); renderTarifs(); renderPneuTarifs(); renderUsers();
  updateSelects(); updateFilterSelects(); updateAffectSelects(); updatePanneSelects(); updateMaintSelects(); updateCarbSelects(); updateExtSelects(); updateRptSelects();
  updateDashboard(); updateAdmin();
}

// --- RESET DATA ---
function resetAppData() {
  if (confirm('Voulez-vous réinitialiser toutes les données ? Les données actuelles seront remplacées par les données de démonstration.')) {
    localStorage.removeItem('parcEngins');
    STORE.engins = []; STORE.personnel = []; STORE.saisies = []; STORE.affectations = []; STORE.pannes = []; STORE.maintenance = []; STORE.carburant = []; STORE.tarifs = [];
    seedDemoData();
    renderAll();
    alert('Données réinitialisées avec succès !');
  }
}

// --- SUIVI PNEUS ---
function navToSuiviPneus() {
  var types = [];
  STORE.engins.forEach(function(e){ if(e.type && types.indexOf(e.type)===-1) types.push(e.type); });
  types.sort();
  var spType = document.getElementById('spType');
  if (spType) spType.innerHTML = '<option value="">Tous les types</option>'+types.map(function(t){return '<option>'+t+'</option>';}).join('');
  var spEngin = document.getElementById('spEngin');
  if (spEngin) spEngin.innerHTML = '<option value="">Tous les engins</option>'+STORE.engins.map(function(e){return '<option value="'+e.id+'">'+e.designation+'</option>';}).join('');
}
function spSwitchTab(tab, el) {
  ['Ref','Type','Engin','Histo','Graph'].forEach(function(t){ var d=document.getElementById('spTab'+t); if(d) d.style.display=(t===tab?'':'none'); });
  document.querySelectorAll('#spTabs .nav-link').forEach(function(l){l.classList.remove('active');});
  if (el) el.classList.add('active');
  if (tab==='Graph') setTimeout(function(){ renderPneuMarqueCharts(_pneuMarqueMap); }, 60);
  return false;
}
function pneuMarque(pn){ return ((pn&&(pn.marque||pn.fourn))||'').toString().trim() || 'Non sp\u00e9cifi\u00e9e'; }
function renderPneuMarqueCharts(map){
  map = map || {};
  var entries = Object.keys(map).map(function(k){ return map[k]; }).sort(function(a,b){ return b.changes-a.changes; });
  var labels = entries.map(function(e){ return e.marque; });
  var usage = entries.map(function(e){ return e.changes; });
  var totalPrix = entries.map(function(e){ return Math.round(e.totalPrix); });
  var prixMoy = entries.map(function(e){ return e.changes>0?Math.round(e.totalPrix/e.changes):0; });
  var palette = ['#d4af37','#3498db','#e74c3c','#27ae60','#9b59b6','#f39c12','#16a085','#e67e22','#63b3ed','#f56565','#48bb78','#ecc94b'];
  var bg = labels.map(function(_,i){ return palette[i%palette.length]; });
  var ids = ['chartSpMarqueUsage','chartSpMarqueRepartition','chartSpMarquePrix','chartSpMarquePrixMoy'];
  if (!labels.length || typeof Chart==='undefined') { ids.forEach(function(id){ if(charts[id]){ charts[id].destroy(); delete charts[id]; } }); return; }
  var DL = window.ChartDataLabels ? [ChartDataLabels] : [];
  function mkBar(id,data,color,unit){
    var cv=document.getElementById(id); if(!cv) return;
    if(charts[id]) charts[id].destroy();
    charts[id]=new Chart(cv,{type:'bar',plugins:DL,data:{labels:labels,datasets:[{data:data,backgroundColor:bg,borderColor:color,borderWidth:1}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},datalabels:{display:true,color:'#fff',anchor:'end',align:'end',font:{weight:'bold',size:10},formatter:function(v){return unit?v.toLocaleString('fr-FR')+unit:v;}}},scales:{x:{ticks:{color:'#94a3b8'},grid:{color:'rgba(212,175,55,.1)'}},y:{ticks:{color:'#e2e8f0'},grid:{color:'rgba(212,175,55,.1)'}}}}});
  }
  var cvR=document.getElementById('chartSpMarqueRepartition');
  if(cvR){ if(charts['chartSpMarqueRepartition']) charts['chartSpMarqueRepartition'].destroy();
    charts['chartSpMarqueRepartition']=new Chart(cvR,{type:'doughnut',data:{labels:labels,datasets:[{data:usage,backgroundColor:bg}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:'#e2e8f0'}},datalabels:{display:false}}}});
  }
  mkBar('chartSpMarqueUsage',usage,'#d4af37','');
  mkBar('chartSpMarquePrix',totalPrix,'#f39c12',' DA');
  mkBar('chartSpMarquePrixMoy',prixMoy,'#9b59b6',' DA');
}
function runSuiviPneus() {
  var dateDeb = document.getElementById('spDateDeb').value;
  var dateFin = document.getElementById('spDateFin').value;
  var typeF   = document.getElementById('spType').value;
  var enginF  = document.getElementById('spEngin').value;
  var refF    = (document.getElementById('spRef').value||'').trim().toLowerCase();
  var allSaisies = STORE.saisies.slice().sort(function(a,b){ return (a.dateDebut||'') < (b.dateDebut||'') ? -1 : 1; });
  var saisies = allSaisies.filter(function(s) {
    if (dateDeb && (s.dateDebut||'') < dateDeb) return false;
    if (dateFin && (s.dateDebut||'') > dateFin) return false;
    if (enginF && s.enginId !== enginF) return false;
    var eng = STORE.engins.find(function(e){return e.id===s.enginId;});
    if (!eng) return false;
    if (typeF && eng.type !== typeF) return false;
    return true;
  });
  var pPos = ['pneuAvg','pneuAvd','pneuArg','pneuArd'];
  var pLbl = {pneuAvg:'AVG',pneuAvd:'AVD',pneuArg:'ARG',pneuArd:'ARD'};
  var refMap={}, typeMap={}, enginMap={}, histoList=[], marqueMap={};
  // For durée de vie: track last change compteur per engin+position
  var lastChgCpt = {}; // key: enginId+'_'+pos => {cpt, ref, prix, date}
  // Build last change from ALL history (not just filtered) to seed durée de vie
  allSaisies.forEach(function(s) {
    var eng = STORE.engins.find(function(e){return e.id===s.enginId;}); if(!eng) return;
    pPos.forEach(function(pos) {
      var pn=s[pos]; if(!pn||(pn.statut!=='Chang\u00e9')) return;
      var key=s.enginId+'_'+pos;
      lastChgCpt[key]={cpt:+(s.compteurFin||0), ref:(pn.ref||'').trim(), prix:+(pn.prix||0), date:s.dateDebut||''};
    });
  });
  // Reset for filtered run — but keep history of last change before filtered period for durée calc
  var lastChgBeforeFilter = {};
  allSaisies.forEach(function(s) {
    if (dateDeb && (s.dateDebut||'') >= dateDeb) return;
    var eng = STORE.engins.find(function(e){return e.id===s.enginId;}); if(!eng) return;
    pPos.forEach(function(pos) {
      var pn=s[pos]; if(!pn||(pn.statut!=='Chang\u00e9')) return;
      var key=s.enginId+'_'+pos;
      lastChgBeforeFilter[key]={cpt:+(s.compteurFin||0), ref:(pn.ref||'').trim(), prix:+(pn.prix||0), date:s.dateDebut||''};
    });
  });
  var lastChgInFilter = {};
  saisies.forEach(function(s) {
    var eng = STORE.engins.find(function(e){return e.id===s.enginId;}); if(!eng) return;
    var h = +(s.difference||0) || Math.max(0,(+s.compteurFin||0)-(+s.compteurDebut||0));
    var t = eng.type||'Inconnu';
    if (!typeMap[t]) typeMap[t]={type:t,engins:[],heures:0,changes:0,refs:[]};
    if (typeMap[t].engins.indexOf(eng.id)===-1) typeMap[t].engins.push(eng.id);
    typeMap[t].heures += h;
    pPos.forEach(function(pos) {
      var pn=s[pos]; if(!pn) return;
      var ref=(pn.ref||'').trim(); if(!ref) return;
      if (refF && ref.toLowerCase().indexOf(refF)===-1) return;
      var fourn=pn.fourn||'\u2014', isChg=(pn.statut==='Chang\u00e9'), prix=+(pn.prix||0);
      if (!refMap[ref]) refMap[ref]={ref:ref,fourn:fourn,heures:0,engins:[],positions:{},changes:0,totalPrix:0,lastEngin:'',lastDate:'',lastEtat:''};
      refMap[ref].heures += h;
      if (refMap[ref].engins.indexOf(eng.id)===-1) refMap[ref].engins.push(eng.id);
      refMap[ref].positions[pLbl[pos]]=(refMap[ref].positions[pLbl[pos]]||0)+1;
      if (isChg) {
        refMap[ref].changes++;
        refMap[ref].totalPrix += prix;
        if ((s.dateDebut||'')>=(refMap[ref].lastDate||'')) {
          refMap[ref].lastDate=s.dateDebut||''; refMap[ref].lastEngin=eng.designation;
          refMap[ref].lastEtat=pn.etat||''; refMap[ref].fourn=fourn;
        }
      }
      if (typeMap[t].refs.indexOf(ref)===-1) typeMap[t].refs.push(ref);
      if (isChg) typeMap[t].changes++;
      var eKey=s.enginId+'_'+pos;
      if (!enginMap[eKey]) enginMap[eKey]={eng:eng,pos:pLbl[pos],ref:ref,fourn:fourn,heures:0,changes:0,totalPrix:0,lastDate:'',lastEtat:''};
      enginMap[eKey].heures += h;
      if (isChg) {
        enginMap[eKey].changes++;
        enginMap[eKey].totalPrix += prix;
        if((s.dateDebut||'')>=(enginMap[eKey].lastDate||'')){enginMap[eKey].lastDate=s.dateDebut;enginMap[eKey].lastEtat=pn.etat||'';}
        // Durée de vie = compteurFin - compteurFin du changement précédent
        var prevCpt = (lastChgInFilter[eKey]||lastChgBeforeFilter[eKey]||{cpt:0}).cpt;
        var curCpt = +(s.compteurFin||0);
        var dureeVie = (prevCpt>0 && curCpt>prevCpt) ? Math.round(curCpt-prevCpt) : null;
        // Build historique entry
        var cptMontage = +(s.compteurFin||0);
        var prevEntry = lastChgInFilter[eKey]||lastChgBeforeFilter[eKey]||null;
        var cptDemontage = prevEntry ? prevEntry.cpt : null;
        var mq = pneuMarque(pn);
        if (!marqueMap[mq]) marqueMap[mq]={marque:mq, changes:0, totalPrix:0, heures:0};
        marqueMap[mq].changes++;
        marqueMap[mq].totalPrix += prix;
        if (dureeVie) marqueMap[mq].heures += dureeVie;
        histoList.push({
          date: s.dateDebut||'',
          eng: eng.designation,
          type: eng.type||'\u2014',
          pos: pLbl[pos],
          ref: ref,
          marque: mq,
          fourn: fourn,
          prix: prix,
          dureeVie: dureeVie,
          etat: pn.etat||'\u2014',
          cptMontage: cptMontage,
          cptDemontage: cptDemontage
        });
        lastChgInFilter[eKey]={cpt:+(s.compteurFin||0), ref:ref, prix:prix, date:s.dateDebut||''};
      }
    });
  });
  var refList=Object.values(refMap);
  var totH=refList.reduce(function(a,r){return a+r.heures;},0);
  var totC=refList.reduce(function(a,r){return a+r.changes;},0);
  var totPrix=refList.reduce(function(a,r){return a+r.totalPrix;},0);
  var avgDv=totC>0?Math.round(totH/totC):0;
  var avgPrixHM=(totH>0&&totPrix>0)?+(totPrix/totH).toFixed(1):0;
  // KPIs
  document.getElementById('spKpis').innerHTML=[
    ['bi-tag-fill','#d4af37',refList.length,'R\u00e9f\u00e9rences'],
    ['bi-clock-fill','#16a085',Math.round(totH)+' h','Total Heures'],
    ['bi-arrow-repeat','#e74c3c',totC,'Changements'],
    ['bi-speedometer','#3498db',avgDv+' h','Dur\u00e9e vie moy.'],
    ['bi-cash-stack','#f39c12',totPrix>0?totPrix.toLocaleString('fr-FR')+' DA':'\u2014','Co\u00fbt total pneus'],
    ['bi-graph-up','#9b59b6',avgPrixHM>0?avgPrixHM+' DA/h':'\u2014','Prix moyen / HM']
  ].map(function(k){return '<div class="col-6 col-md-2"><div class="kpi-card" style="border-color:'+k[1]+'40"><div class="kpi-value" style="color:'+k[1]+';font-size:1rem"><i class="bi '+k[0]+'"></i> '+k[2]+'</div><div class="kpi-label">'+k[3]+'</div></div></div>';}).join('');
  // Ref table
  document.getElementById('spRefTable').innerHTML=refList.length?refList.sort(function(a,b){return b.heures-a.heures;}).map(function(r,i){
    var dv=r.changes>0?Math.round(r.heures/r.changes)+' h':'\u2014';
    var moy=r.changes>0?Math.round(r.totalPrix/r.changes).toLocaleString('fr-FR'):'\u2014';
    var pHM=(r.heures>0&&r.totalPrix>0)?+(r.totalPrix/r.heures).toFixed(1):'\u2014';
    return '<tr style="background:'+(i%2===0?'rgba(255,255,255,.03)':'transparent')+'">'
      +'<td><strong style="color:#d4af37">'+r.ref+'</strong></td>'
      +'<td style="color:#3498db">'+r.fourn+'</td>'
      +'<td><strong style="color:#e74c3c">'+Math.round(r.heures)+' h</strong></td>'
      +'<td style="color:#e67e22;font-weight:700">'+dv+'</td>'
      +'<td style="text-align:center">'+r.engins.length+'</td>'
      +'<td><small>'+Object.keys(r.positions).join(', ')+'</small></td>'
      +'<td style="text-align:center;font-weight:700">'+r.changes+'</td>'
      +'<td style="color:#f39c12;font-weight:600">'+(r.totalPrix>0?moy+' DA':'\u2014')+'</td>'
      +'<td style="color:#9b59b6;font-weight:600">'+(pHM!=='\u2014'?pHM+' DA/h':'\u2014')+'</td>'
      +'<td style="color:#888;font-size:.85rem">'+r.lastEngin+'</td>'
      +'<td style="color:#888;font-size:.85rem">'+r.lastDate+'</td>'
      +'</tr>';
  }).join(''):'<tr><td colspan="11" class="text-center text-muted py-3">Aucune donn\u00e9e (v\u00e9rifiez que les r\u00e9f\u00e9rences sont saisies)</td></tr>';
  // Type table
  document.getElementById('spTypeTable').innerHTML=Object.values(typeMap).length?Object.values(typeMap).sort(function(a,b){return b.heures-a.heures;}).map(function(t,i){
    var dv=t.changes>0?Math.round(t.heures/t.changes)+' h/pneu':'\u2014';
    return '<tr style="background:'+(i%2===0?'rgba(255,255,255,.03)':'transparent')+'">'
      +'<td><strong>'+t.type+'</strong></td>'
      +'<td style="text-align:center">'+t.engins.length+'</td>'
      +'<td><strong style="color:#16a085">'+Math.round(t.heures)+' h</strong></td>'
      +'<td style="color:#e67e22;font-weight:700">'+t.changes+'</td>'
      +'<td><small style="color:#888">'+t.refs.join(', ')+'</small></td>'
      +'<td style="color:#3498db">'+dv+'</td>'
      +'</tr>';
  }).join(''):'<tr><td colspan="6" class="text-center text-muted py-3">Aucune donn\u00e9e</td></tr>';
  // Engin table
  document.getElementById('spEnginTable').innerHTML=Object.values(enginMap).length?Object.values(enginMap).sort(function(a,b){return b.heures-a.heures;}).map(function(e,i){
    var ec=e.lastEtat==='Usure normale'?'#27ae60':(e.lastEtat==='Incident'?'#e74c3c':'#888');
    var pHM=(e.heures>0&&e.totalPrix>0)?+(e.totalPrix/e.heures).toFixed(1):'\u2014';
    return '<tr style="background:'+(i%2===0?'rgba(255,255,255,.03)':'transparent')+'">'
      +'<td><strong>'+e.eng.designation+'</strong></td>'
      +'<td style="color:#888">'+( e.eng.type||'\u2014')+'</td>'
      +'<td style="font-weight:700;color:#16a085">'+e.pos+'</td>'
      +'<td style="color:#d4af37;font-weight:600">'+e.ref+'</td>'
      +'<td style="color:#3498db">'+e.fourn+'</td>'
      +'<td><strong style="color:#e74c3c">'+Math.round(e.heures)+' h</strong></td>'
      +'<td style="text-align:center;color:#e67e22">'+e.changes+'</td>'
      +'<td style="color:#f39c12;font-weight:600">'+(e.totalPrix>0?e.totalPrix.toLocaleString('fr-FR')+' DA':'\u2014')+'</td>'
      +'<td style="color:#9b59b6;font-weight:600">'+(pHM!=='\u2014'?pHM+' DA/h':'\u2014')+'</td>'
      +'<td style="color:#888;font-size:.85rem">'+( e.lastDate||'\u2014')+'</td>'
      +'<td style="color:'+ec+'">'+( e.lastEtat||'\u2014')+'</td>'
      +'</tr>';
  }).join(''):'<tr><td colspan="11" class="text-center text-muted py-3">Aucune donn\u00e9e</td></tr>';
  // Historique table
  histoList.sort(function(a,b){ return b.date < a.date ? -1 : 1; });
  document.getElementById('spHistoTable').innerHTML=histoList.length?histoList.map(function(h,i){
    var dvTxt = h.dureeVie!==null ? '<strong style="color:#3498db">'+h.dureeVie+' h</strong>' : '<span style="color:#888">\u2014</span>';
    var pHM = (h.dureeVie&&h.dureeVie>0&&h.prix>0) ? +(h.prix/h.dureeVie).toFixed(1)+' DA/h' : '\u2014';
    var ec=h.etat==='Usure normale'?'#27ae60':(h.etat==='Incident'?'#e74c3c':'#888');
    var cptDemTxt = h.cptDemontage ? '<span style="color:#e74c3c;font-weight:700">'+h.cptDemontage.toLocaleString('fr-FR')+'</span>' : '<span style="color:#888">\u2014</span>';
    var cptMonTxt = h.cptMontage ? '<span style="color:#27ae60;font-weight:700">'+h.cptMontage.toLocaleString('fr-FR')+'</span>' : '<span style="color:#888">\u2014</span>';
    return '<tr style="background:'+(i%2===0?'rgba(255,255,255,.03)':'transparent')+'">'
      +'<td style="white-space:nowrap;color:#888">'+h.date+'</td>'
      +'<td><strong style="color:#d4af37">'+h.eng+'</strong></td>'
      +'<td style="color:#888;font-size:.82rem">'+h.type+'</td>'
      +'<td style="font-weight:700;color:#16a085">'+h.pos+'</td>'
      +'<td style="color:#d4af37;font-weight:600">'+h.ref+'</td>'
      +'<td style="color:#e67e22;font-weight:600">'+(h.marque||'\u2014')+'</td>'
      +'<td style="color:#3498db">'+h.fourn+'</td>'
      +'<td style="color:#f39c12;font-weight:700">'+(h.prix>0?h.prix.toLocaleString('fr-FR')+' DA':'\u2014')+'</td>'
      +'<td class="text-center">'+cptDemTxt+'</td>'
      +'<td class="text-center">'+cptMonTxt+'</td>'
      +'<td>'+dvTxt+'</td>'
      +'<td style="color:#9b59b6;font-weight:600">'+pHM+'</td>'
      +'<td style="color:'+ec+'">'+h.etat+'</td>'
      +'</tr>';
  }).join(''):'<tr><td colspan="13" class="text-center text-muted py-3">Aucun changement de pneu enregistr\u00e9 sur cette p\u00e9riode.</td></tr>';
  // Graphiques par marque
  _pneuMarqueMap = marqueMap;
  renderPneuMarqueCharts(marqueMap);
}

// Pre-charger les utilisateurs depuis localStorage avant l'écran de login
(function() {
  var d = localStorage.getItem('parcEngins');
  if (d) { try { var p = JSON.parse(d); STORE.users = p.users || []; } catch(e) {} }
})();
checkAuth();
