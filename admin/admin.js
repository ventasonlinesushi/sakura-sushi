/* Panel Sakura Sushi v3 */
var SUPABASE_URL = "https://edquyomwiiaawqslsisd.supabase.co";
var SUPABASE_KEY = "sb_publishable_aIIwHt4T8cDIeZjy48hRxQ_sdY7_QIf";
var API = SUPABASE_URL + "/rest/v1/orders";
var HDR = { "apikey":SUPABASE_KEY, "Authorization":"Bearer "+SUPABASE_KEY };
var SESSION = "sakuraAdmin";
var BRAND = (window.PosApp&&window.PosApp.brandConfig)||{business:"Sakura Sushi Paseos Mid",marca:"sakura"};
var $ = function(id){return document.getElementById(id);};
var money = function(n){return "$"+Number(n||0).toLocaleString("es-MX");};
var esc = function(s){return String(s||"").replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});};
var fmtTime = function(iso){if(!iso)return"";var d=new Date(iso);return d.toLocaleDateString("es-MX",{day:"2-digit",month:"2-digit"})+" "+d.toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"});};
var fmtHora = function(d){return d.toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"});};

var state = { orders:[], seen:new Set(), soundOn:true, onlyNew:false, showArch:false, activeTab:"restaurante", pollTimer:null, pCat:0, selectedOrderId:null, newOnlineCount:0, cobradaFilter:"todas" };
var newOrder = null, cancelMode = {}, cobroState = {method:"efectivo",order:null};
var STATUS = { nuevo:{label:"Nuevo",cls:"ob-nuevo"}, recibido:{label:"Recibido",cls:"ob-recibido"}, listo:{label:"Listo",cls:"ob-listo"}, entregado:{label:"Entregado",cls:"ob-entregado"}, cobrado:{label:"Cobrado",cls:"ob-cobrado"}, cancelado:{label:"Cancelado",cls:"ob-cancelado"}, archivado:{label:"Archivado",cls:"ob-cobrado"} };
var FLOW = ["nuevo","recibido","listo","entregado"];
var MENU = (window.PosApp&&window.PosApp.menuData)||[];

/* Roles y permisos */
var PERMISOS = {
  admin:   { todo:1, descuentos:1, cancelar:1, turno:1, reportes:1, usuarios:1, productos:1, cobrar:1, imprimir:1, nuevoPedido:1, reabrir:1, archivar:1, cambiarEstado:1, gastos:1 },
  cajero:  { todo:1, descuentos:1, cancelar:1, turno:1, reportes:1, usuarios:1, productos:1, cobrar:1, imprimir:1, nuevoPedido:1, reabrir:1, archivar:1, cambiarEstado:1, gastos:1 },
  cocina:  { todo:1, descuentos:1, cancelar:1, turno:1, reportes:1, usuarios:1, productos:1, cobrar:1, imprimir:1, nuevoPedido:1, reabrir:1, archivar:1, cambiarEstado:1, gastos:1, verKDS:1 },
  mesero:  { todo:1, descuentos:1, cancelar:1, turno:1, reportes:1, usuarios:1, productos:1, cobrar:1, imprimir:1, nuevoPedido:1, reabrir:1, archivar:1, cambiarEstado:1, gastos:1 }
};
var currentUser = null;
var ROLES = ["admin","cajero","cocina","mesero"];
function canDo(accion){ return currentUser && PERMISOS[currentUser.rol] && PERMISOS[currentUser.rol][accion]; }
function isAdmin(){ return currentUser && currentUser.rol === "admin"; }

function toast(msg){var t=$("toast");t.textContent=msg;t.classList.remove("hidden");clearTimeout(toast._t);toast._t=setTimeout(function(){t.classList.add("hidden")},3500);}
function beep(){if(!state.soundOn)return;try{var ctx=beep._ctx||(beep._ctx=new(window.AudioContext||window.webkitAudioContext)());if(ctx.state==="suspended")ctx.resume();var o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";o.frequency.value=880;g.gain.value=0.2;o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+0.35)}catch(e){}}

/* API */
function apiGet(path){
  var url = "https://edquyomwiiaawqslsisd.supabase.co/rest/v1/" + path;
  return new Promise(function(resolve,reject){
    var xhr=new XMLHttpRequest();
    xhr.open("GET",url,true);
    xhr.setRequestHeader("apikey","sb_publishable_aIIwHt4T8cDIeZjy48hRxQ_sdY7_QIf");
    xhr.setRequestHeader("Authorization","Bearer sb_publishable_aIIwHt4T8cDIeZjy48hRxQ_sdY7_QIf");
    xhr.timeout=8000;
    xhr.onload=function(){if(xhr.status===200){resolve(JSON.parse(xhr.responseText))}else{reject(new Error("HTTP "+xhr.status))}};
    xhr.onerror=function(){reject(new Error("Red"))};
    xhr.ontimeout=function(){reject(new Error("Timeout"))};
    xhr.send();
  });
}
function apiPatch(id,data){
  return new Promise(function(resolve,reject){
    var xhr=new XMLHttpRequest();
    xhr.open("PATCH",API+"?id=eq."+id,true);
    xhr.setRequestHeader("Content-Type","application/json");
    xhr.setRequestHeader("Prefer","return=minimal");
    xhr.setRequestHeader("apikey",SUPABASE_KEY);
    xhr.setRequestHeader("Authorization","Bearer "+SUPABASE_KEY);
    xhr.timeout=8000;
    xhr.onload=function(){if(xhr.status>=200&&xhr.status<300){resolve()}else{reject(new Error("HTTP "+xhr.status))}};
    xhr.onerror=function(){reject(new Error("Red"))};
    xhr.ontimeout=function(){reject(new Error("Timeout"))};
    xhr.send(JSON.stringify(data));
  });
}
function apiPost(data){
  return new Promise(function(resolve,reject){
    var xhr=new XMLHttpRequest();
    xhr.open("POST",API,true);
    xhr.setRequestHeader("Content-Type","application/json");
    xhr.setRequestHeader("Prefer","return=minimal");
    xhr.setRequestHeader("apikey",SUPABASE_KEY);
    xhr.setRequestHeader("Authorization","Bearer "+SUPABASE_KEY);
    xhr.timeout=8000;
    xhr.onload=function(){if(xhr.status===201){resolve()}else{reject(new Error("HTTP "+xhr.status))}};
    xhr.onerror=function(){reject(new Error("Red"))};
    xhr.ontimeout=function(){reject(new Error("Timeout"))};
    xhr.send(JSON.stringify(data));
  });
}
function fetchOrders(){
  var url = "https://edquyomwiiaawqslsisd.supabase.co/rest/v1/orders?select=*&marca=eq." + (BRAND.marca||"sakura") + "&order=created_at.desc&limit=200";
  return new Promise(function(resolve,reject){
    var xhr=new XMLHttpRequest();
    xhr.open("GET",url,true);
    xhr.setRequestHeader("apikey","sb_publishable_aIIwHt4T8cDIeZjy48hRxQ_sdY7_QIf");
    xhr.setRequestHeader("Authorization","Bearer sb_publishable_aIIwHt4T8cDIeZjy48hRxQ_sdY7_QIf");
    xhr.timeout=8000;
    xhr.onload=function(){if(xhr.status===200){resolve(JSON.parse(xhr.responseText))}else{reject(new Error("HTTP "+xhr.status))}};
    xhr.onerror=function(){reject(new Error("Red"))};
    xhr.ontimeout=function(){reject(new Error("Timeout"))};
    xhr.send();
  });
}
function patchOrder(id,data){
  return new Promise(function(resolve,reject){
    var xhr=new XMLHttpRequest();
    xhr.open("PATCH","https://edquyomwiiaawqslsisd.supabase.co/rest/v1/orders?id=eq."+id,true);
    xhr.setRequestHeader("Content-Type","application/json");
    xhr.setRequestHeader("Prefer","return=minimal");
    xhr.setRequestHeader("apikey","sb_publishable_aIIwHt4T8cDIeZjy48hRxQ_sdY7_QIf");
    xhr.setRequestHeader("Authorization","Bearer sb_publishable_aIIwHt4T8cDIeZjy48hRxQ_sdY7_QIf");
    xhr.timeout=8000;
    xhr.onload=function(){if(xhr.status>=200&&xhr.status<300){resolve()}else{reject(new Error("HTTP "+xhr.status))}};
    xhr.onerror=function(){reject(new Error("Red"))};
    xhr.ontimeout=function(){reject(new Error("Timeout"))};
    xhr.send(JSON.stringify(data));
  });
}
function saveApi(data){
  return new Promise(function(resolve,reject){
    var xhr=new XMLHttpRequest();
    xhr.open("POST","https://edquyomwiiaawqslsisd.supabase.co/rest/v1/orders",true);
    xhr.setRequestHeader("Content-Type","application/json");
    xhr.setRequestHeader("Prefer","return=minimal");
    xhr.setRequestHeader("apikey","sb_publishable_aIIwHt4T8cDIeZjy48hRxQ_sdY7_QIf");
    xhr.setRequestHeader("Authorization","Bearer sb_publishable_aIIwHt4T8cDIeZjy48hRxQ_sdY7_QIf");
    xhr.timeout=8000;
    xhr.onload=function(){if(xhr.status===201){resolve()}else{reject(new Error("HTTP "+xhr.status))}};
    xhr.onerror=function(){reject(new Error("Red"))};
    xhr.ontimeout=function(){reject(new Error("Timeout"))};
    xhr.send(JSON.stringify(data));
  });
}

/* Filtros */
function ordersForTab(tab){
  var l=state.orders;
  if(tab==="restaurante")l=l.filter(function(o){return o.status!=="cobrado"&&o.status!=="archivado"&&o.status!=="cancelado"&&o.order_type==="restaurante"});
  else if(tab==="whatsapp")l=l.filter(function(o){return o.status!=="cobrado"&&o.status!=="archivado"&&o.status!=="cancelado"&&o.order_type!=="restaurante"});
  else if(tab==="cobradas"){
    l=l.filter(function(o){return o.status==="cobrado"});
    if(state.cobradaFilter==="hoy"){
      var hoy=new Date().toDateString();
      l=l.filter(function(o){return o.created_at&&new Date(o.created_at).toDateString()===hoy});
    } else if(state.cobradaFilter==="ayer"){
      var ayer=new Date();ayer.setDate(ayer.getDate()-1);var ay=ayer.toDateString();
      l=l.filter(function(o){return o.created_at&&new Date(o.created_at).toDateString()===ay});
    } else if(state.cobradaFilter==="semana"){
      var sem=new Date();sem.setDate(sem.getDate()-7);
      l=l.filter(function(o){return o.created_at&&new Date(o.created_at)>=sem});
    } else if(state.cobradaFilter==="mes"){
      var mes=new Date();mes.setMonth(mes.getMonth()-1);
      l=l.filter(function(o){return o.created_at&&new Date(o.created_at)>=mes});
    } else if(state.cobradaFilter==="personalizado"){
      var ds = document.getElementById("cobradaDesde"); var dh = document.getElementById("cobradaHasta");
      if(ds&&ds.value) l=l.filter(function(o){return o.created_at&&new Date(o.created_at)>=new Date(ds.value)});
      if(dh&&dh.value){ var hh = new Date(dh.value); hh.setHours(23,59,59); l=l.filter(function(o){return o.created_at&&new Date(o.created_at)<=hh}); }
    }
  }
  if(state.onlyNew)l=l.filter(function(o){return o.status==="nuevo"});
  if(state.showArch){var a=state.orders.filter(function(o){return o.status==="archivado"||o.status==="cancelado"});l=l.concat(a)}
  return l;
}

/* Cards */
function cardHtml(o){
  var s=STATUS[o.status]||STATUS.nuevo, open=state.seen.has("open_"+o.id), isCobrado=o.status==="cobrado", isCancel=cancelMode[o.id];
  var pagoBadge = isCobrado ? '<span class="o-badge ob-cobrado">PAGADO</span>' : (o.payment==="Pagado Online" ? '<span class="o-badge ob-cobrado">PAGADO ONLINE</span>' : '<span class="o-badge ob-cancelado" style="background:#fef3c7;color:#b3570e">PENDIENTE</span>');
  var items=(o.items||[]).map(function(i,ix){return'<div class="o-item"><span class="o-item-name"><span class="o-item-qty">'+(i.qty||0)+'</span>'+esc(i.name)+'</span><span class="o-item-total">'+money((i.price||0)*(i.qty||0))+'</span>'+(isCancel?'<button class="o-item-cancel" data-id="'+o.id+'" data-ix="'+ix+'">X</button>':'')+'</div>';}).join("");
  var ti=o.order_type==="domicilio"?"🛵":o.order_type==="restaurante"?"🍽":"🛍";
  var tl=o.order_type==="domicilio"?"A domicilio":o.order_type==="restaurante"?(o.address||"Mesa"):"Para llevar";
  var metodo = isCobrado ? (o.payment||"") : "";
  return'<div class="o-card'+(isCobrado?" cobrada":"")+(open?" open":"")+'" data-id="'+o.id+'">'+
    '<div class="o-card-top" data-toggle="'+o.id+'"><div class="o-card-left"><span class="o-folio">#'+esc(o.folio)+'</span><span class="o-badge '+s.cls+'">'+s.label+'</span>'+pagoBadge+'<span class="o-client-name">'+esc(o.name||"Cliente")+'</span></div><div class="o-time"><span style="font-weight:800;color:var(--primary);margin-right:8px">'+money(o.total||0)+'</span><span>'+fmtTime(o.created_at)+'</span><span class="o-arrow">V</span></div></div>'+
    '<div class="o-card-body"><div class="o-meta"><span class="o-meta-item"><span class="mi-icon">'+ti+'</span>'+tl+'</span>'+(o.phone?'<span class="o-meta-item">T '+esc(o.phone)+'</span>':'')+(o.order_type==="domicilio"&&o.address?'<span class="o-meta-item">L '+esc(o.address)+'</span>':'')+(metodo?'<span class="o-meta-item">Q '+esc(metodo)+'</span>':'')+'</div>'+(items?'<div class="o-items">'+items+'</div>':'')+(isCancel?'<div class="o-cancel-hint">Selecciona producto a cancelar</div>':'')+(o.notes?'<div class="o-notes">P '+esc(o.notes)+'</div>':'')+'</div></div>';
}

function renderCards(){
  var list=ordersForTab(state.activeTab), grid=$("orders");
  if(!grid) return;
  if(!list.length){var m={restaurante:"No hay pedidos en restaurante",whatsapp:"No hay pedidos de WhatsApp",cobradas:"No hay cuentas cobradas"};grid.innerHTML='<div class="empty-state"><span class="es-icon">'+(state.activeTab==="restaurante"?"🍽":state.activeTab==="whatsapp"?"📱":"💰")+'</span><span class="es-text">'+m[state.activeTab]+'</span><span class="es-sub" style="font-size:10px;color:var(--muted)">Tab: '+state.activeTab+' | Total en memoria: '+state.orders.length+'</span></div>';return}
  try {
    grid.innerHTML=list.map(cardHtml).join("");
    /* Wire cards */
    grid.querySelectorAll("[data-toggle]").forEach(function(el){el.addEventListener("click",function(){var card=el.closest(".o-card");if(!card)return;var id=card.dataset.id;card.classList.toggle("open");if(card.classList.contains("open"))state.seen.add("open_"+id);else state.seen.delete("open_"+id);selectOrder(id);});});
    grid.querySelectorAll(".o-item-cancel").forEach(function(btn){btn.addEventListener("click",function(e){e.stopPropagation();var id=btn.dataset.id,ix=parseInt(btn.dataset.ix,10),o=state.orders.find(function(x){return x.id===id});if(!o||!o.items||isNaN(ix)||ix>=o.items.length)return;var rm=o.items[ix];o.items=o.items.filter(function(_,i){return i!==ix});patchOrder(id,{items:o.items,total:o.items.reduce(function(a,i){return a+(i.price||0)*(i.qty||0)},0)}).then(function(){printCancelTicket(o,rm);toast("X "+esc(rm.name)+" cancelado");refresh()});});});
  } catch(e) {
    grid.innerHTML='<div class="empty-state"><span class="es-text" style="color:red">Error al renderizar: '+esc(e.message)+'</span></div>';
  }
}

/* Stats */
function renderStats(){
  var l=ordersForTab(state.activeTab), today=new Date().toDateString();
  var ta=state.orders.filter(function(o){return o.status==="cobrado"&&o.created_at&&new Date(o.created_at).toDateString()===today});
  var ti=ta.reduce(function(a,o){return a+(o.total||0)},0);
  $("stNuevos").textContent=l.filter(function(o){return o.status==="nuevo"}).length;
  $("stActivos").textContent=l.filter(function(o){return o.status!=="cobrado"&&o.status!=="archivado"&&o.status!=="cancelado"&&o.status!=="entregado"}).length;
  var pendientes = state.orders.filter(function(o){return o.status!=="cobrado"&&o.status!=="archivado"&&o.status!=="cancelado"&&o.payment!=="Pagado Online"}).length;
  $("stPendientes").textContent = pendientes;
  $("stHoy").textContent=ta.length;$("stIngresos").textContent=money(ti);
  $("stTicketProm").textContent=ta.length?"Ticket prom. "+money(Math.round(ti/ta.length)):"--";
  var r=state.orders.filter(function(o){return o.order_type==="restaurante"&&o.status!=="cobrado"&&o.status!=="archivado"&&o.status!=="cancelado"}).length;
  var w=state.orders.filter(function(o){return o.order_type!=="restaurante"&&o.status!=="cobrado"&&o.status!=="archivado"&&o.status!=="cancelado"}).length;
  var c=state.orders.filter(function(o){return o.status==="cobrado"}).length;
  $("badgeRest").textContent=r;$("badgeWsp").textContent=w;$("badgeCob").textContent=c;
}

/* Side Panel */
function renderSidePanel(){
  var panel=$("sidePanel"),id=state.selectedOrderId;
  if(!id){panel.classList.add("hidden");return}
  var o=state.orders.find(function(x){return x.id===id});if(!o){panel.classList.add("hidden");return}
  var isCobrado=o.status==="cobrado",isCancel=cancelMode[id],s=STATUS[o.status]||STATUS.nuevo;
  var de=JSON.parse(localStorage.getItem("orderExtra_"+id)||"{}"),disc=de.d||0,extra=de.e||0,idsc=de.items||{},mode=de.mode||"general";
  $("spFolio").textContent="#"+o.folio;$("spBadge").textContent=s.label;$("spBadge").className="sp-badge "+s.cls;
  $("spClient").innerHTML=esc(o.name||"Cliente")+' <button class="sp-btn-slim" onclick="PosEditName(\''+id+'\')">E</button>';
  var flows=FLOW.filter(function(st){return st!==o.status}).map(function(st){var sd=STATUS[st];return'<button class="sp-btn" onclick="PosChangeStatus(\''+id+'\',\''+st+'\')">'+sd.label+'</button>';}).join("");
  var acc = '';
  if(isCobrado){
    acc += '<button class="sp-btn sp-btn-primary" onclick="PosReabrir(\''+id+'\')">Reabrir</button>';
    acc += '<button class="sp-btn" onclick="PosReimprimir(\''+id+'\')">Reimprimir</button>';
  } else {
    if(canDo("cobrar")) acc += '<button class="sp-btn sp-btn-primary" onclick="PosCobrar(\''+id+'\')">Cobrar</button>';
    acc += '<button class="sp-btn" onclick="PosDividir(\''+id+'\')">✂️ Dividir</button>';
    acc += '<button class="sp-btn" onclick="PosEditar(\''+id+'\')">✏️ Editar</button>';
    acc += '<button class="sp-btn" onclick="PosComandar(\''+id+'\')">🖨 Comandar</button>';
    if(canDo("imprimir")) acc += '<button class="sp-btn" onclick="PosReimprimir(\''+id+'\')">Imprimir</button>';
    if(canDo("cancelar")) acc += isCancel?'<button class="sp-btn sp-btn-warn" onclick="PosCancelModeOff(\''+id+'\')">Salir cancelar</button>':'<button class="sp-btn sp-btn-warn" onclick="PosCancelModeOn(\''+id+'\')">Cancelar productos</button>';
    if(canDo("cambiarEstado")) acc += flows;
    if(canDo("archivar")) acc += '<button class="sp-btn" onclick="PosArchivar(\''+id+'\')">Archivar</button>';
  }
  $("spActions").innerHTML=acc;
  var spInputs=canDo("descuentos")?'<label>Descuento</label><div class="seg" style="margin-bottom:8px"><button class="seg-btn'+(mode==="general"?" on":"")+'" onclick="PosDiscMode(\''+id+'\',\'general\')">General</button><button class="seg-btn'+(mode==="producto"?" on":"")+'" onclick="PosDiscMode(\''+id+'\',\'producto\')">A producto</button></div>':'';
  if(mode==="general")spInputs+='<div class="sp-inp-row"><input type="number" class="sp-inp-disc" value="'+(disc||'')+'" placeholder="% desc" min="0" max="100" onchange="PosUpdateDisc(\''+id+'\',this,1)"><input type="number" class="sp-inp-extra" value="'+(extra||'')+'" placeholder="+$ cargo" min="0" onchange="PosUpdateDisc(\''+id+'\',this,0)"></div>';
  else {spInputs+='<div style="display:flex;flex-direction:column;gap:4px">'+(o.items||[]).map(function(it,ix){var idc=idsc[String(ix)]||{},t=idc.t||"%",v=idc.v||0;return'<div style="display:flex;align-items:center;gap:4px;font-size:11px;padding:3px 0;border-bottom:1px solid var(--bg)"><span style="flex:1;font-weight:600">'+(it.qty||0)+'x '+esc(it.name)+'</span><input type="number" value="'+(v||'')+'" placeholder="0" min="0" onchange="PosItemDisc(\''+id+'\','+ix+',this)" style="width:48px;border:1px solid var(--border);border-radius:6px;padding:3px;font-size:11px;text-align:center"><select onchange="PosItemDiscType(\''+id+'\','+ix+',this)" style="width:36px;border:1px solid var(--border);border-radius:6px;padding:2px;font-size:10px;font-weight:700;background:#fff"><option value="%"'+(t==="%"?" selected":"")+'>%</option><option value="$"'+(t==="$"?" selected":"")+'>$</option></select></div>';}).join("")+'<div class="sp-inp-row" style="margin-top:6px"><input type="number" class="sp-inp-disc" value="'+(disc||'')+'" placeholder="% gral" min="0" max="100" onchange="PosUpdateDisc(\''+id+'\',this,1)"><input type="number" class="sp-inp-extra" value="'+(extra||'')+'" placeholder="+$ cargo" min="0" onchange="PosUpdateDisc(\''+id+'\',this,0)"></div></div>';}
  $("spInputs").innerHTML=spInputs;
  var subBruto=(o.items||[]).reduce(function(a,i){return a+(i.price||0)*(i.qty||0)},0),dp=0;
  var subDesc=(o.items||[]).reduce(function(a,i,ix){var p=(i.price||0)*(i.qty||0),idc=idsc[String(ix)]||{},t=idc.t||"%",v=idc.v||0,d=0;if(t==="%")d=Math.round(p*v/100);else d=Math.min(p,v);dp+=d;return a+p-d;},0);
  var discAmt=Math.round(subDesc*disc/100),calc=subDesc-discAmt+extra;
  var tot='<div class="sp-total-row"><span>Subtotal</span><span>'+money(subBruto)+'</span></div>';
  if(dp>0)tot+='<div class="sp-total-row"><span style="color:var(--red)">Desc. productos</span><span style="color:var(--red)">-'+money(dp)+'</span></div><div class="sp-total-row"><span>Sub. c/desc</span><span>'+money(subDesc)+'</span></div>';
  tot+=(disc>0?'<div class="sp-total-row"><span style="color:var(--red)">Desc. gral '+disc+'%</span><span style="color:var(--red)">-'+money(discAmt)+'</span></div>':'')+(extra>0?'<div class="sp-total-row"><span>Cargo extra</span><span>'+money(extra)+'</span></div>':'')+'<div class="sp-total-final"><span>TOTAL</span><span>'+money(calc)+'</span></div>';
  $("spTotals").innerHTML=tot;
  $("spExtras").innerHTML='<div style="font-size:12px;margin-bottom:4px">P '+esc(o.notes||"Sin observaciones")+' <button class="sp-btn-slim" onclick="PosEditNotes(\''+id+'\')">E</button></div><div class="sp-items">'+(o.items||[]).map(function(i,ix){return'<div class="sp-item"><span class="sp-item-name">'+(i.qty||0)+'x '+esc(i.name)+'</span>'+(isCancel?'<button class="sp-btn-slim" onclick="PosCancelItem(\''+id+'\','+ix+')" style="color:var(--red)">X</button>':'')+'</div>';}).join("")+'</div>';
  panel.classList.remove("hidden");
}

/* Global onclick functions */
function selectOrder(id){state.selectedOrderId=state.selectedOrderId===id?null:id;render();}
function switchTab(tab){state.activeTab=tab;state.selectedOrderId=null;$("sidePanel").classList.add("hidden");if(tab==="whatsapp"){state.newOnlineCount=0;document.title=BRAND.business};document.querySelectorAll(".tab-btn").forEach(function(b){b.classList.toggle("active",b.dataset.tab===tab)});var fc=$("filtroCobradas");if(fc)fc.style.display=tab==="cobradas"?"flex":"none";render();}
function render(){renderCards();renderSidePanel();renderStats();}

function abrirCobro(o){
  cobroState.order=o;cobroState.method="efectivo";
  var de=JSON.parse(localStorage.getItem("orderExtra_"+o.id)||"{}"),disc=de.d||0,extra=de.e||0,idsc=de.items||{};
  var sb=(o.items||[]).reduce(function(a,i){return a+(i.price||0)*(i.qty||0)},0),dp=0;
  var sd=(o.items||[]).reduce(function(a,i,ix){var p=(i.price||0)*(i.qty||0),idc=idsc[String(ix)]||{},t=idc.t||"%",v=idc.v||0,d=0;if(t==="%")d=Math.round(p*v/100);else d=Math.min(p,v);dp+=d;return a+p-d;},0);
  var tf=sd-Math.round(sd*disc/100)+extra;
  $("cobroInfo").innerHTML='<div class="cobro-total">'+money(tf)+'</div>'+(dp>0?'<div style="font-size:11px;color:var(--red)">Desc. prod: -'+money(dp)+'</div>':'')+(disc>0?'<div style="font-size:11px;color:var(--red)">Desc. gral '+disc+'%: -'+money(Math.round(sd*disc/100))+'</div>':'')+(extra>0?'<div style="font-size:11px;color:var(--green)">Cargo: +'+money(extra)+'</div>':'')+'<div style="font-size:12px;color:var(--muted);margin-top:4px">Pedido #'+esc(o.folio)+' '+esc(o.name)+'</div>';
  $("cobroModal").classList.remove("hidden");
  document.querySelectorAll(".pay-btn").forEach(function(x){x.classList.remove("on")});
  var db=document.querySelector('.pay-btn[data-m="efectivo"]');if(db)db.classList.add("on");
  cobroFields();
}
function cobroFields(){
  var m=cobroState.method,o=cobroState.order;if(!o)return;
  var de=JSON.parse(localStorage.getItem("orderExtra_"+o.id)||"{}"),disc=de.d||0,extra=de.e||0,idsc=de.items||{};
  var sd=(o.items||[]).reduce(function(a,i,ix){var p=(i.price||0)*(i.qty||0),idc=idsc[String(ix)]||{},t=idc.t||"%",v=idc.v||0,d=0;if(t==="%")d=Math.round(p*v/100);else d=Math.min(p,v);return a+p-d;},0);
  var total=sd-Math.round(sd*disc/100)+extra,h="";
  if(m==="efectivo"){h+='<div class="frow"><label>Monto recibido</label><input type="number" id="cobroMonto" value="'+total+'" min="0" oninput="updateCambio()"></div><div id="cobroCambio" style="text-align:center;font-size:15px;font-weight:700;margin:8px 0;color:var(--green)">Cambio: $0</div><div class="frow"><label>Propina</label><div style="display:flex;gap:4px;margin-bottom:6px"><button class="btn-sm" onclick="setPropina('+Math.round(total*0.10)+')">10% ('+money(Math.round(total*0.10))+')</button><button class="btn-sm" onclick="setPropina('+Math.round(total*0.15)+')">15% ('+money(Math.round(total*0.15))+')</button><button class="btn-sm" onclick="setPropina('+Math.round(total*0.20)+')">20% ('+money(Math.round(total*0.20))+')</button></div><input type="number" id="cobroPropina" value="0" min="0" oninput="updateCambio()"></div>';}
  else if(m==="tarjeta"||m==="transferencia"){h+='<div class="frow"><label>Referencia</label><input type="text" id="cobroRef" placeholder="Ej. 4521"></div><div class="frow"><label>Propina</label><div style="display:flex;gap:4px;margin-bottom:6px"><button class="btn-sm" onclick="setPropina('+Math.round(total*0.10)+')">10% ('+money(Math.round(total*0.10))+')</button><button class="btn-sm" onclick="setPropina('+Math.round(total*0.15)+')">15% ('+money(Math.round(total*0.15))+')</button><button class="btn-sm" onclick="setPropina('+Math.round(total*0.20)+')">20% ('+money(Math.round(total*0.20))+')</button></div><input type="number" id="cobroPropina" value="0" min="0"></div>';}
  else if(m==="online"){h+='<div style="text-align:center;padding:12px;color:var(--muted);font-size:13px">🌐 Este pedido fue pagado por Internet.<br>No se suma como efectivo en caja.</div>';}
  else{h+='<div class="frow"><label>Referencia</label><input type="text" id="cobroRef" placeholder="Ej. Comision 30%"></div>';}
  $("cobroFields").innerHTML=h;
}
function setPropina(val){var el=document.getElementById("cobroPropina");if(el){el.value=val;el.dispatchEvent(new Event("input"));updateCambio()};}
function totalEfec(o){
  var de=JSON.parse(localStorage.getItem("orderExtra_"+o.id)||"{}"),disc=de.d||0,extra=de.e||0,idsc=de.items||{};
  var sd=(o.items||[]).reduce(function(a,i,ix){var p=(i.price||0)*(i.qty||0),idc=idsc[String(ix)]||{},t=idc.t||"%",v=idc.v||0,d=0;if(t==="%")d=Math.round(p*v/100);else d=Math.min(p,v);return a+p-d;},0);
  return sd-Math.round(sd*disc/100)+extra;
}
window.updateCambio=function(){
  var monto=parseInt((document.getElementById("cobroMonto")||{}).value,10)||0;
  var propina=parseInt((document.getElementById("cobroPropina")||{}).value,10)||0;
  var total=totalEfec(cobroState.order),cambio=monto-total-propina;
  var el=document.getElementById("cobroCambio");if(el)el.textContent=cambio>=0?"Cambio: "+money(cambio):"Faltan: "+money(-cambio);
};
function confirmarCobro(){
  var o=cobroState.order;if(!o)return;var m=cobroState.method;
  var ml={efectivo:"Efectivo",tarjeta:"Tarjeta",transferencia:"Transferencia",online:"Pagado Online",didi:"DIDI",uber:"Uber",rappi:"Rappi"}[m]||m;
  var prop=parseInt((document.getElementById("cobroPropina")||{}).value,10)||0,det="",total=totalEfec(o);
  if(m==="efectivo"){var rec=parseInt((document.getElementById("cobroMonto")||{}).value,10)||0,cambio=rec-total-prop;if(cambio<0){toast("Monto no cubre");return}det="Recibido:"+rec+" | Cambio:"+cambio+(prop?" | Propina:"+prop:"");}
  else{var ref=(document.getElementById("cobroRef")||{}).value||"";det=(ref?"Ref:"+ref+" | ":"")+(prop?"Propina:"+prop:"");}
  if(m==="online"){ det="Pago recibido por Internet"; }
  var nota=(o.notes||"");if(nota)nota+=" | ";nota+="PAGO:"+ml+" | "+det+" | PAGO_EN:"+new Date().toISOString();
  patchOrder(o.id,{payment:ml,notes:nota,total:total,status:"cobrado"}).then(function(){$("cobroModal").classList.add("hidden");toast("Cuenta #"+o.folio+" cobrada");state.activeTab="cobradas";refresh()});
}

/* Impresion */
var PRINT_HOST = window.location.hostname;

function printTicket(o){
  var de=JSON.parse(localStorage.getItem("orderExtra_"+o.id)||"{}");
  var items = (o.items||[]).map(function(it){
    var prep = localStorage.getItem("prodPrep_"+it.key) || "";
    return {name:it.name,qty:it.qty,price:it.price,desc:it.desc,comment:it.comment||"",prep:prep};
  });
  var body=JSON.stringify({marca:BRAND.marca,folio:o.folio,items:items,total:o.total,name:o.name,phone:o.phone,order_type:o.order_type,address:o.address,payment:o.payment,notes:o.notes,discount:de.d||0,extra:de.e||0});
  var xhr=new XMLHttpRequest();
  xhr.open("POST","http://"+PRINT_HOST+":5100/print",true);
  xhr.setRequestHeader("Content-Type","application/json");
  xhr.timeout=5000;
  xhr.onload=function(){if(xhr.status===200){var d=JSON.parse(xhr.responseText);if(d.ok)toast("Impreso");else toast("Error")}else{toast("Error")}};
  xhr.onerror=function(){toast("Servidor impresion no disponible")};
  xhr.ontimeout=function(){toast("Timeout impresion")};
  xhr.send(body);
}
function printCancelTicket(order,item){
  var xhr=new XMLHttpRequest();
  xhr.open("POST","http://"+PRINT_HOST+":5100/cancel",true);
  xhr.setRequestHeader("Content-Type","application/json");
  xhr.timeout=3000;
  xhr.send(JSON.stringify({marca:BRAND.marca,folio:order.folio,item:item,name:order.name,order_type:order.order_type,address:order.address}));
}

/* Reimpresion */
var rpState={order:null,selected:{}};
function abrirReimpresion(o){rpState.order=o;rpState.selected={};(o.items||[]).forEach(function(_,i){rpState.selected[i]=true});$("reprintItems").innerHTML=(o.items||[]).map(function(it,i){return'<label class="chk" style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer"><input type="checkbox" data-ri="'+i+'"'+(rpState.selected[i]?' checked':'')+' onchange="rpState.selected['+i+']=this.checked"><span style="flex:1;font-weight:700;font-size:13px">'+(it.qty||0)+'x '+esc(it.name)+'</span><span style="font-weight:700;color:var(--primary)">'+money((it.price||0)*(it.qty||0))+'</span></label>';}).join("");$("reprintModal").classList.remove("hidden");}
function confirmarReimpresion(){var o=rpState.order;if(!o)return;var its=(o.items||[]).filter(function(_,i){return rpState.selected[i]});if(!its.length){toast("Selecciona al menos un producto");return}var sub=its.reduce(function(a,it){return a+(it.price||0)*(it.qty||0)},0);printTicket(Object.assign({},o,{items:its,total:sub}));$("reprintModal").classList.add("hidden");}

/* Nuevo pedido */
function nextFolio(){var max=0;state.orders.forEach(function(o){var n=parseInt(o.folio,10);if(n>max)max=n});var l=parseInt(localStorage.getItem((BRAND.marca||"store")+"AdminFolio")||"0",10);if(l>max)max=l;var n=max+1;localStorage.setItem((BRAND.marca||"store")+"AdminFolio",String(n));return("000"+String(n)).slice(-4);}
function catItems(ci){return(MENU[ci]&&MENU[ci].items)||[];}
function priceOf(it){if(typeof it.price==="number")return money(it.price);var vs=it.variants||[];return"Desde "+money(Math.min.apply(null,vs.map(function(v){return v.price})));}
function renderTabs(){$("noTabs").innerHTML=MENU.map(function(c,i){return'<button class="tab'+(i===state.pCat?" on":"")+'" data-i="'+i+'">'+esc(c.name)+'</button>';}).join("");}
function renderGrid(){var q=($("noSearch").value||"").toLowerCase().trim(),m=[];MENU.forEach(function(c,ci){(c.items||[]).forEach(function(it,ii){if(q){if((it.name+" "+(it.desc||"")+" "+c.name).toLowerCase().indexOf(q)<0)return}else if(state.pCat>=0&&ci!==state.pCat)return;m.push({ci:ci,ii:ii,it:it})})});$("noGrid").innerHTML=m.length?m.map(function(x){return'<button class="p-btn" data-ci="'+x.ci+'" data-ii="'+x.ii+'"><span>'+esc(x.it.name)+'</span><em>'+priceOf(x.it)+'</em></button>';}).join(""):'<div class="empty p-empty">Sin resultados</div>';}
function openVariants(ci,ii){var it=catItems(ci)[ii],vs=it.variants||[];$("noVariantList").innerHTML='<div class="v-title">'+esc(it.name)+'</div>'+vs.map(function(v,vi){return'<button class="v-btn" data-v="'+vi+'"><span>'+esc(v.label)+'</span><em>'+money(v.price)+'</em></button>';}).join("");$("noVariant").dataset.ci=ci;$("noVariant").dataset.ii=ii;$("noVariant").classList.remove("hidden");}
function addToCart(ci,ii,vr){var it=catItems(ci)[ii],nm=it.name+(vr?" "+vr.label:""),pr=vr?vr.price:it.price,key=ci+":"+ii+(vr?":"+vr.label:"");var f=newOrder.cart.find(function(c){return c.key===key});if(f){f.qty+=1}else{newOrder.cart.push({key:key,name:nm,qty:1,price:pr||0,desc:it.desc||"",comment:"",cortesia:false})}renderCart();}
function setItemComment(ix){var c=newOrder.cart[ix];if(!c)return;var v=prompt("Comentario para "+c.name+":",c.comment||"");if(v!==null){c.comment=v.trim();renderCart()}}
function toggleCortesia(ix){var c=newOrder.cart[ix];if(!c)return;c.cortesia=!c.cortesia;renderCart()}
function renderCart(){var el=$("noItems");if(!newOrder.cart.length){el.innerHTML='<div class="empty">Agrega platillos</div>';return}el.innerHTML=newOrder.cart.map(function(c,ix){var p=c.cortesia?0:c.price*c.qty;return'<div class="no-item"><span class="no-name">'+esc(c.name)+(c.comment?'<br><small style="color:var(--primary);font-weight:600">'+esc(c.comment)+'</small>':'')+(c.cortesia?'<br><small style="color:var(--green);font-weight:800">CORTESIA</small>':'')+'</span><button class="no-comment" data-ix="'+ix+'" title="Comentario" style="border:none;background:var(--primary-light);color:var(--primary);border-radius:4px;padding:1px 5px;font-size:10px;cursor:pointer;margin-right:2px">E</button><button class="no-cortesia" data-ix="'+ix+'" title="Cortesia" style="border:none;background:'+(c.cortesia?'var(--green)':'var(--bg)')+';color:'+(c.cortesia?'#fff':'var(--muted)')+';border-radius:4px;padding:1px 5px;font-size:10px;cursor:pointer;margin-right:4px">G</button><div class="no-qty"><button data-ix="'+ix+'" data-d="-1">-</button><b>'+c.qty+'</b><button data-ix="'+ix+'" data-d="1">+</button></div><span class="no-line">'+money(p)+'</span><button class="no-del" data-ix="'+ix+'" data-del="1">X</button></div>';}).join("");$("noTotal").textContent=money(newOrder.cart.reduce(function(a,c){return c.cortesia?a:a+c.price*c.qty},0));}
function setSegType(t){newOrder.type=t;document.querySelectorAll("#segType .seg-btn").forEach(function(b){b.classList.toggle("on",b.dataset.t===t)});$("rowMesa").classList.toggle("hidden",t!=="restaurante");$("rowPhone").classList.toggle("hidden",t==="restaurante");$("rowAddr").classList.toggle("hidden",t!=="domicilio");}
function resetNewOrder(){newOrder={type:"restaurante",cart:[]};$("noMesa").value=1;$("noName").value="";$("noPhone").value="";$("noAddr").value="";$("noPay").value="Efectivo";$("noNotes").value="";$("noSearch").value="";state.pCat=0;renderTabs();renderGrid();renderCart();setSegType("restaurante");}

function saveNewOrder(){
  if(!newOrder||!newOrder.cart.length){toast("Agrega al menos un platillo");return}
  var t=newOrder.type,mesa=parseInt($("noMesa").value||"1",10),name=($("noName").value||"").trim(),addr="";
  if(t==="restaurante"){addr="Mesa "+(mesa||1);if(!name)name=addr}else if(t==="domicilio"){addr=($("noAddr").value||"").trim()}
  var phone=t==="restaurante"?"":($("noPhone").value||"").trim();
  var rec={folio:nextFolio(),name:name||"Cliente",phone:phone,order_type:t,address:addr,payment:$("noPay").value,notes:($("noNotes").value||"").trim(),salsas:"",palitos:"No",marca:BRAND.marca||"",items:newOrder.cart.map(function(c){return{key:c.key,name:c.name,qty:c.qty,price:c.cortesia?0:c.price,desc:c.desc,comment:c.comment||"",cortesia:c.cortesia||false}}),total:newOrder.cart.reduce(function(a,c){return c.cortesia?a:a+c.price*c.qty},0)};
  saveApi(rec).then(function(){$("newOrderModal").classList.add("hidden");toast("Pedido #"+rec.folio+" enviado");printTicket(rec);refresh()
    // Decrementar inventario
    newOrder.cart.forEach(function(c){
      var curr = parseInt(localStorage.getItem("prodStock_"+c.key)) || 0;
      if(curr > 0) localStorage.setItem("prodStock_"+c.key, String(curr - c.qty));
    });
  }).catch(function(){toast("Error al guardar")});
}

/* Side Panel Actions */
function PosCobrar(id){var o=state.orders.find(function(x){return x.id===id});if(o)abrirCobro(o);}
function PosEditar(id){var o=state.orders.find(function(x){return x.id===id});if(!o)return;var tipo=o.order_type||"llevar";var h='<div class="frow"><label>Folio</label><input value="'+esc(o.folio||"")+'" disabled></div>';h+='<div class="frow"><label>Nombre</label><input type="text" id="edName" value="'+esc(o.name||"")+'"></div>';h+='<div class="frow"><label>Telefono</label><input type="text" id="edPhone" value="'+esc(o.phone||"")+'"></div>';h+='<div class="frow"><label>Tipo</label><select id="edType"><option value="llevar"'+(tipo=="llevar"?" selected":"")+'>Para llevar</option><option value="domicilio"'+(tipo=="domicilio"?" selected":"")+'>A domicilio</option><option value="restaurante"'+(tipo=="restaurante"?" selected":"")+'>Restaurante</option></select></div>';h+='<div class="frow"><label>Direccion</label><input type="text" id="edAddr" value="'+esc(o.address||"")+'"></div>';h+='<div class="frow"><label>Pago</label><select id="edPay"><option value="Efectivo"'+(o.payment=="Efectivo"?" selected":"")+'>Efectivo</option><option value="Tarjeta"'+(o.payment=="Tarjeta"?" selected":"")+'>Tarjeta</option><option value="Transferencia"'+(o.payment=="Transferencia"?" selected":"")+'>Transferencia</option></select></div>';h+='<div class="frow"><label>Notas</label><input type="text" id="edNotes" value="'+esc(o.notes||"")+'"></div>';h+='<div class="frow"><label>Salsas</label><input type="text" id="edSalsas" value="'+esc(o.salsas||"")+'"></div>';$("edBody").innerHTML=h;$("editModal").classList.remove("hidden");$("editModal").dataset.oid=id;}
function PosEditSave(){var id=$("editModal").dataset.oid;if(!id)return;var data={};var n=($("edName").value||"").trim();if(n)data.name=n;data.phone=($("edPhone").value||"").trim();data.order_type=$("edType").value;data.address=($("edAddr").value||"").trim();data.payment=$("edPay").value;data.notes=($("edNotes").value||"").trim();data.salsas=($("edSalsas").value||"").trim();patchOrder(id,data).then(function(){$("editModal").classList.add("hidden");toast("Pedido actualizado");refresh();}).catch(function(e){toast("Error: "+e.message);});}
var splitState = {order:null, asignaciones:{}};
function PosDividir(id){
  var o = state.orders.find(function(x){return x.id===id});
  if(!o||!o.items||!o.items.length) return;
  splitState.order = o;
  splitState.asignaciones = {};
  (o.items||[]).forEach(function(_,i){ splitState.asignaciones[i] = 0; });
  $("splitPersonas").value = "2";
  $("splitModal").classList.remove("hidden");
  splitRender();
}
function splitUpdatePersonas(){ splitRender(); }
function splitRender(){
  var o = splitState.order; if(!o) return;
  var items = o.items||[];
  var np = parseInt($("splitPersonas").value)||2;
  $("splitInfo").innerHTML = '<div style="font-weight:800;font-size:15px">#'+esc(o.folio)+' - '+esc(o.name||"Cliente")+'</div><div style="font-size:12px;color:var(--muted)">Asigna cada producto a una persona</div>';
  // Persona selector buttons
  var btns = '';
  for(var p=0; p<np; p++){
    btns += '<button class="btn-sm" style="margin:1px;'+(p===0?'background:var(--primary);color:#fff;border-color:var(--primary);':'')+'" onclick="splitSelPersona('+p+')">P'+(p+1)+'</button>';
  }
  $("splitItems").innerHTML = items.map(function(it,ix){
    var asignado = splitState.asignaciones[ix]||0;
    return '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">'+
      '<span style="flex:1;font-weight:700;font-size:13px">'+(it.qty||0)+'x '+esc(it.name)+'</span>'+
      '<span style="font-weight:700;color:var(--primary);min-width:60px;text-align:right">'+money((it.price||0)*(it.qty||0))+'</span>'+
      '<span style="font-size:11px;font-weight:700;background:'+(asignado>0?'var(--primary-light)':'var(--bg)')+';color:'+(asignado>0?'var(--primary)':'var(--muted)')+';border-radius:8px;padding:3px 8px;cursor:pointer;min-width:32px;text-align:center" onclick="splitToggle('+ix+','+np+')">P'+(asignado||'?')+'</span>'+
    '</div>';
  }).join("");
  // Totals per person
  var totals = [];
  for(var p=1; p<=np; p++) totals.push({p:p, total:0, items:[]});
  items.forEach(function(it,ix){
    var a = splitState.asignaciones[ix]||0;
    if(a>0 && a<=np) totals[a-1].total += (it.price||0)*(it.qty||0);
  });
  var granTotal = items.reduce(function(a,it){return a+(it.price||0)*(it.qty||0)},0);
  var sumParts = totals.reduce(function(a,t){return a+t.total},0);
  $("splitTotales").innerHTML = totals.map(function(t){
    return '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;font-weight:'+(t.total>0?'700':'500')+'"><span>Persona '+t.p+'</span><span style="color:'+(t.total>0?'var(--primary)':'var(--muted)')+'">'+money(t.total)+'</span></div>';
  }).join("") +
    '<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;font-weight:800;border-top:1px solid var(--border);margin-top:4px"><span>Total</span><span>'+money(granTotal)+'</span></div>'+
    (sumParts!==granTotal?'<div style="color:var(--red);font-size:11px;margin-top:2px">⚠️ Los montos no cuadran ('+money(sumParts)+' vs '+money(granTotal)+')</div>':'<div style="color:var(--green);font-size:11px;margin-top:2px">✅ Montos cuadran correctamente</div>');
  // Highlight selected persona buttons
  var allBtns = document.querySelectorAll("#splitItems .btn-sm, #splitInfo .btn-sm");
}
function splitSelPersona(p){
  // Select persona for future clicks
  window._splitPersona = p+1;
}
function splitToggle(ix, np){
  var current = splitState.asignaciones[ix]||0;
  var next = current+1; if(next>np) next=0;
  splitState.asignaciones[ix] = next;
  splitRender();
}
function splitImprimir(){
  var o = splitState.order; if(!o) return;
  var items = o.items||[];
  var np = parseInt($("splitPersonas").value)||2;
  // Build items per person
  var parts = [];
  for(var p=1; p<=np; p++){
    var pitems = [];
    items.forEach(function(it,ix){
      if((splitState.asignaciones[ix]||0)===p) pitems.push(it);
    });
    if(pitems.length) parts.push({persona:p, items:pitems, total:pitems.reduce(function(a,it){return a+(it.price||0)*(it.qty||0)},0)});
  }
  if(!parts.length){ toast("Asigna al menos un producto"); return }
  // Print each part
  parts.forEach(function(part){
    var sub = Object.assign({}, o, {items:part.items, total:part.total, name:(o.name||"Cliente")+" (P"+part.persona+")"});
    printTicket(sub);
  });
  toast("Imprimiendo "+parts.length+" cuentas divididas");
}
function PosReabrir(id){
  var o = state.orders.find(function(x){return x.id===id});
  if(!o) return;
  var raw = localStorage.getItem(SESSION);
  var user = raw ? JSON.parse(raw) : null;
  if(!user||!user.password_hash){ toast("Cierra sesion y vuelve a entrar para usar esta funcion"); return }
  var pass = prompt("Ingresa tu contrasena para reabrir la cuenta #"+o.folio+":","");
  if(!pass||pass.length<4){toast("Contrasena requerida (min 4 caracteres)");return}
  var enc = new TextEncoder();
  crypto.subtle.digest("SHA-256", enc.encode(pass)).then(function(buf){
    var h = Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,"0")}).join("");
    if(user.password_hash!==h){toast("Contrasena incorrecta");return}
  var log = JSON.parse(localStorage.getItem((BRAND.marca||"store")+"ReabrirLog")||"[]");
    log.push({folio:o.folio,orderId:id,usuario:user.nombre,username:user.username,fecha:new Date().toISOString()});
    if(log.length>200) log = log.slice(-200);
    localStorage.setItem((BRAND.marca||"store")+"ReabrirLog",JSON.stringify(log));
    patchOrder(id,{status:"nuevo"}).then(function(){
      toast("Cuenta #"+o.folio+" reabierta por "+user.nombre);
      refresh();
    });
  }).catch(function(){toast("Error al verificar contrasena")});
}
function PosArchivar(id){patchOrder(id,{status:"archivado"}).then(refresh);}
function PosReimprimir(id){var o=state.orders.find(function(x){return x.id===id});if(o)abrirReimpresion(o);}
function PosCancelModeOn(id){cancelMode[id]=true;render();}
function PosCancelModeOff(id){cancelMode[id]=false;render();}
function PosChangeStatus(id,st){var o=state.orders.find(function(x){return x.id===id}),final=st==="entregado"&&o&&o.payment==="Pagado Online"?"cobrado":st;patchOrder(id,{status:final}).then(function(){if(final==="cobrado")toast("Pedido entregado y pago online conciliado");refresh()}).catch(function(e){toast("No se pudo cambiar el estado: "+e.message)});}
function PosEditName(id){var o=state.orders.find(function(x){return x.id===id});if(!o)return;var v=prompt("Nombre:",o.name||"");if(v!==null){patchOrder(id,{name:v}).then(refresh);}}
function PosEditNotes(id){var o=state.orders.find(function(x){return x.id===id});if(!o)return;var v=prompt("Observaciones:",o.notes||"");if(v!==null){patchOrder(id,{notes:v}).then(refresh);}}
function PosCancelItem(id,ix){var o=state.orders.find(function(x){return x.id===id});if(!o||!o.items||ix>=o.items.length)return;var rm=o.items[ix];o.items=o.items.filter(function(_,i){return i!==ix});patchOrder(id,{items:o.items}).then(function(){printCancelTicket(o,rm);toast("X "+esc(rm.name)+" cancelado");refresh()});}
function PosUpdateDisc(id,inp,isDisc){
  var val=isDisc?Math.min(100,Math.max(0,parseInt(inp.value,10)||0)):Math.max(0,parseInt(inp.value,10)||0);
  var de=JSON.parse(localStorage.getItem("orderExtra_"+id)||"{}");if(isDisc)de.d=val;else de.e=val;
  localStorage.setItem("orderExtra_"+id,JSON.stringify(de));render();
}
function PosDiscMode(id,mode){var de=JSON.parse(localStorage.getItem("orderExtra_"+id)||"{}");de.mode=mode;localStorage.setItem("orderExtra_"+id,JSON.stringify(de));render();}
function PosItemDisc(id,ix,inp){var val=Math.max(0,parseInt(inp.value,10)||0);var de=JSON.parse(localStorage.getItem("orderExtra_"+id)||"{}");if(!de.items)de.items={};if(!de.items[ix])de.items[ix]={};de.items[ix].v=val;localStorage.setItem("orderExtra_"+id,JSON.stringify(de));render();}
function PosItemDiscType(id,ix,sel){var de=JSON.parse(localStorage.getItem("orderExtra_"+id)||"{}");if(!de.items)de.items={};if(!de.items[ix])de.items[ix]={};de.items[ix].t=sel.value;localStorage.setItem("orderExtra_"+id,JSON.stringify(de));render();}

/* Refresh */
function refresh(){
  var note = $("refreshNote"); if(note) note.textContent = "Cargando pedidos...";
  var isFirst = state.seen.size === 0;
  fetchOrders().then(function(orders){
    var newOnline = 0;
    try {
      orders.forEach(function(o){
        if(!isFirst && !state.seen.has("notif_"+o.id) && o.status!=="cobrado"&&o.status!=="archivado"&&o.status!=="cancelado"&&(o.order_type==="domicilio"||o.order_type==="llevar")){
          state.seen.add("notif_"+o.id);
          newOnline++;
        }
      });
      state.orders=orders;
      if(newOnline>0){
        state.newOnlineCount+=newOnline;
        if(state.soundOn)beep();
        document.title = "("+state.newOnlineCount+") NUEVO - "+BRAND.business;
        try{if("Notification"in window&&Notification.permission==="granted"){new Notification("Nuevo pedido online",{body:newOnline+" pedido(s) nuevo(s)",icon:"../logo.png"})}}catch(e){}
        toast("NUEVO PEDIDO ONLINE (+"+newOnline+")");
      }
      var n = $("refreshNote"); if(n) n.textContent = "Actualizado "+fmtHora(new Date())+" ("+orders.length+" pedidos)";
      render();
    } catch(e2) {
      var n2 = $("refreshNote"); if(n2) n2.textContent = "ERROR render: "+e2.message;
      var g = $("orders"); if(g) g.innerHTML = '<div class="empty-state"><span class="es-text" style="color:red">Error: '+esc(e2.message)+'</span></div>';
    }
  }).catch(function(e){var n3=$("refreshNote");if(n3){n3.textContent="Sin conexión · reintentando";n3.style.color="var(--red)"}var g=$("orders");if(g&&!state.orders.length)g.innerHTML='<div class="empty-state"><span class="es-icon">⚠️</span><span class="es-text">No se pudieron cargar los pedidos</span><span class="es-sub">Revisa Internet. El sistema volverá a intentar automáticamente.</span><button class="btn btn-primary" onclick="refresh()" style="margin-top:10px">Reintentar ahora</button></div>'});
}
function start(){clearInterval(state.pollTimer);clearInterval(state.printTimer);state.pollTimer=setInterval(refresh,3000);verificarPrintServer();state.printTimer=setInterval(verificarPrintServer,30000);}
function verificarPrintServer(){
  var xhr = new XMLHttpRequest();
  xhr.open("GET","http://"+PRINT_HOST+":5100/ping",true);
  xhr.timeout=3000;
  xhr.onload=function(){var el=$("printStatus");if(el){el.textContent="🖨️ OK";el.style.background="rgba(37,211,102,.3)"}};
  xhr.onerror=function(){var el=$("printStatus");if(el){el.textContent="🖨️ OFF";el.style.background="rgba(239,68,68,.4)"}};
  xhr.ontimeout=function(){var el=$("printStatus");if(el){el.textContent="🖨️ OFF";el.style.background="rgba(239,68,68,.4)"}};
  xhr.send();
}

/* Init App */
function initApp(){
  var raw=localStorage.getItem(SESSION);if(!raw)return;
  try{var user=JSON.parse(raw);if(!user||!user.username)return}catch(e){return}
  currentUser = user;
  document.title = user.nombre + " - " + BRAND.business;
  $("pinScreen").classList.add("hidden");$("app").classList.remove("hidden");
  $("hdTitle").textContent=BRAND.business;
  // User menu
  var av = $("userAvatar"); if(av) av.textContent = (user.nombre||"U").charAt(0).toUpperCase();
  var nm = $("hdUserName2"); if(nm) nm.textContent = user.nombre;
  var rl = $("hdUserRol2"); if(rl) rl.textContent = user.rol;
  if(isAdmin()){$("usersBtn").style.display="";$("productsBtn").style.display=""}
  // Ocultar acciones segun rol
  if(!canDo("usuarios")){$("usersBtn").style.display="none"}
  if(!canDo("productos")){$("productsBtn").style.display="none"}
  if(!canDo("reportes")){$("reportesBtn").style.display="none"}
  if(!canDo("gastos")){$("gastosBtn").style.display="none"}
  if(!canDo("nuevoPedido")){$("newOrderBtn").style.display="none"}
  if(!canDo("turno")){$("turnoBadge").style.display="none"}
  // PWA service worker
  if("serviceWorker" in navigator){navigator.serviceWorker.register("sw.js").catch(function(){})}
  // Cerrar dropdown al hacer clic fuera
  document.addEventListener("click",function(e){if(!e.target.closest(".user-menu")){var um=document.getElementById("userMenu");if(um)um.classList.remove("open")}})
  // Wire UI
  $("noTabs").addEventListener("click",function(e){var b=e.target.closest(".tab");if(b){state.pCat=parseInt(b.dataset.i,10);renderTabs();renderGrid()}});
  $("noGrid").addEventListener("click",function(e){var b=e.target.closest(".p-btn");if(!b)return;var ci=parseInt(b.dataset.ci,10),ii=parseInt(b.dataset.ii,10),it=catItems(ci)[ii];if((it.variants||[]).length)openVariants(ci,ii);else addToCart(ci,ii,null)});
  $("noVariantList").addEventListener("click",function(e){var b=e.target.closest(".v-btn");if(!b)return;var ci=parseInt($("noVariant").dataset.ci,10),ii=parseInt($("noVariant").dataset.ii,10),it=catItems(ci)[ii],v=(it.variants||[])[parseInt(b.dataset.v,10)];addToCart(ci,ii,v);$("noVariant").classList.add("hidden")});
  $("noItems").addEventListener("click",function(e){var b=e.target.closest("button");if(!b)return;var ix=parseInt(b.dataset.ix,10),c=newOrder.cart[ix];if(!c)return;if(b.dataset.del){newOrder.cart.splice(ix,1)}else if(b.classList.contains("no-comment")){setItemComment(ix)}else if(b.classList.contains("no-cortesia")){toggleCortesia(ix)}else if(b.dataset.d==="-1"){c.qty-=1;if(c.qty<=0)newOrder.cart.splice(ix,1)}else{c.qty+=1};renderCart()});
  $("noSearch").addEventListener("input",renderGrid);
  $("noClear").addEventListener("click",function(){newOrder.cart=[];renderCart()});
  $("segType").addEventListener("click",function(e){var b=e.target.closest(".seg-btn");if(b)setSegType(b.dataset.t)});
  $("soundToggle").addEventListener("change",function(e){state.soundOn=e.target.checked});
  $("onlyNew").addEventListener("change",function(e){state.onlyNew=e.target.checked;renderCards()});
  $("showArch").addEventListener("change",function(e){state.showArch=e.target.checked;renderCards()});
  $("payMethods").addEventListener("click",function(e){var b=e.target.closest(".pay-btn");if(!b)return;cobroState.method=b.dataset.m;document.querySelectorAll(".pay-btn").forEach(function(x){x.classList.remove("on")});b.classList.add("on");cobroFields()});
  $("spClose").addEventListener("click",function(){state.selectedOrderId=null;render()});
  // Reportes
  $("closeReportesBtn")&&$("closeReportesBtn").addEventListener("click",function(){$("reportesModal").classList.add("hidden")});
  document.querySelectorAll("#reporteTabs .seg-btn").forEach(function(b){b.addEventListener("click",function(){document.querySelectorAll("#reporteTabs .seg-btn").forEach(function(x){x.classList.remove("on")});b.classList.add("on");cargarReportes(b.dataset.rt)})});
  // Gastos
  $("closeGastosBtn")&&$("closeGastosBtn").addEventListener("click",function(){$("gastosModal").classList.add("hidden")});
  $("saveGastoBtn")&&$("saveGastoBtn").addEventListener("click",guardarGasto);
  // Turno
  $("closeTurnoBtn")&&$("closeTurnoBtn").addEventListener("click",function(){$("cajaModal").classList.add("hidden")});
  // Users/Products
  $("closeUsersBtn")&&$("closeUsersBtn").addEventListener("click",function(){$("usersModal").classList.add("hidden")});
  $("closeProductsBtn")&&$("closeProductsBtn").addEventListener("click",function(){$("productsModal").classList.add("hidden")});
  $("addProductBtn")&&$("addProductBtn").addEventListener("click",addProduct);
  var ps=document.getElementById("pmSearch");ps&&ps.addEventListener("input",function(){renderProducts(window._prodCache||[])});
  $("addUserBtn")&&$("addUserBtn").addEventListener("click",addUser);
  // Wire cobrada date filter
  var fc=$("filtroCobradas");if(fc){fc.addEventListener("click",function(e){var b=e.target.closest("[data-cf]");if(!b)return;if(b.dataset.cf==="personalizado"){var ff=$("filtroFechas");if(ff)ff.style.display=ff.style.display==="none"?"flex":"none";state.cobradaFilter="personalizado";aplicarFiltroFecha();return}var ff=$("filtroFechas");if(ff)ff.style.display="none";state.cobradaFilter=b.dataset.cf;fc.querySelectorAll("button").forEach(function(x){x.style.background=x.dataset.cf===b.dataset.cf?"var(--primary)":"#fff";x.style.color=x.dataset.cf===b.dataset.cf?"#fff":"inherit";x.style.fontWeight=x.dataset.cf===b.dataset.cf?"800":"600";x.style.border=x.dataset.cf===b.dataset.cf?"none":"1px solid var(--border)"});renderCards();});}
function aplicarFiltroFecha(){state.cobradaFilter="personalizado";renderCards();}
  var g0 = $("orders"); if(g0) g0.innerHTML = '<div class="empty-state"><span class="es-text">Iniciando carga de pedidos...</span><span class="es-sub">Conectando a Supabase</span></div>';
  refresh();start();switchTab("restaurante");
  initTurnoBadge();
}

/* ============================================================
   CAJA - Turnos, Cortes, Historial
   ============================================================ */
window.PosTurno = function(){
  $("cajaModal").classList.remove("hidden");
  $("cajaBody").innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted)">Conectando...</div>';
  checkTurno().then(function(turno){
    state.turno = turno;
    if(turno){ renderCajaAbierta($("cajaBody")); }
    else { renderCajaCerrada($("cajaBody")); }
  }).catch(function(){
    $("cajaBody").innerHTML = '<div style="text-align:center;padding:30px;color:var(--red)">Error de conexion</div>'; $("cajaModal").classList.add('hidden');
  });
};
function renderCaja(){
  var body = $("cajaBody");
  if(state.turno){ renderCajaAbierta(body); } else { renderCajaCerrada(body); }
  $("cajaModal").classList.remove("hidden");
}
function renderCajaCerrada(body){
  var raw = localStorage.getItem(SESSION);
  var user = raw ? JSON.parse(raw) : {nombre:"?"};
  body.innerHTML =
    '<div style="text-align:center;padding:14px 0"><div style="font-size:40px;margin-bottom:8px">\u{1F534}</div>' +
    '<div style="font-size:15px;font-weight:800;margin-bottom:4px">NO HAY TURNO ABIERTO</div>' +
    '<div style="font-size:12px;color:var(--muted)">' + esc(user.nombre) + '</div></div>' +
    '<div class="frow"><label>Efectivo inicial</label><input type="number" id="tmEfectivoIni" value="0" min="0" placeholder="$0"></div>' +
    '<button class="btn btn-primary" onclick="abrirTurno()" style="width:100%;margin-top:12px;padding:12px;font-weight:800">\u{1F513} Abrir turno</button>' +
    '<button class="btn ghost" onclick="renderHistorial()" style="width:100%;margin-top:6px">\u{1F4CB} Ver historial</button>';
}
function renderCajaAbierta(body, skipRecalc){
  if(!skipRecalc) calcularVentas(function(){ if(state.turno && !$('cajaModal').classList.contains('hidden')) renderCajaAbierta(body,true); });
  var t = state.turno;
  var de = JSON.parse(localStorage.getItem("turnoData_"+t.abierto_en)||"{}");
  var movs = de.movs || [];
  var v = de.ventas || {efectivo:0,tarjeta:0,transferencia:0,apps:0,total:0};
  var efecIni = t.efectivo_inicial||0;
  var entradas = movs.filter(function(m){return m.tipo==="entrada"}).reduce(function(a,m){return a+m.monto},0);
  var salidas = movs.filter(function(m){return m.tipo==="salida"}).reduce(function(a,m){return a+m.monto},0);
  var efecEsp = efecIni + v.efectivo + entradas - salidas;
  body.innerHTML =
    '<div class="caja-status">' +
      '<div style="text-align:center;font-size:32px;margin-bottom:4px">\u{1F7E2}</div>' +
      '<div style="text-align:center;font-size:13px;font-weight:800;margin-bottom:12px">TURNO ABIERTO</div>' +
      '<div class="corte-row"><span>Empleado</span><span><b>' + esc(t.usuario_nombre) + '</b></span></div>' +
      '<div class="corte-row"><span>Apertura</span><span>' + fmtTime(t.abierto_en) + '</span></div>' +
      '<div class="corte-row"><span>Efectivo inicial</span><span style="font-size:15px;font-weight:800">' + money(efecIni) + '</span></div>' +
    '</div>' +
    '<div class="caja-section-title">VENTAS DEL TURNO</div>' +
    '<div class="corte-box">' +
      '<div class="corte-row"><span>Efectivo</span><span>' + money(v.efectivo) + '</span></div>' +
      '<div class="corte-row"><span>Tarjeta</span><span>' + money(v.tarjeta) + '</span></div>' +
      '<div class="corte-row"><span>Transferencia</span><span>' + money(v.transferencia) + '</span></div>' +
      '<div class="corte-row"><span>Apps / Otros</span><span>' + money(v.apps) + '</span></div>' +
      '<div class="corte-sep"></div>' +
      '<div class="corte-row c-bold" style="font-size:14px"><span>Total ventas</span><span>' + money(v.total) + '</span></div>' +
    '</div>' +
    '<div class="caja-section-title">EFECTIVO EN CAJA</div>' +
    '<div class="corte-box">' +
      '<div class="corte-row" style="font-size:11px"><span>Efectivo inicial</span><span>' + money(efecIni) + '</span></div>' +
      '<div class="corte-row" style="font-size:11px"><span>+ Ventas efectivo</span><span>' + money(v.efectivo) + '</span></div>' +
      (entradas>0?'<div class="corte-row" style="font-size:11px"><span>+ Entradas</span><span style="color:var(--green)">' + money(entradas) + '</span></div>':'') +
      (salidas>0?'<div class="corte-row" style="font-size:11px"><span>- Salidas</span><span style="color:var(--red)">' + money(salidas) + '</span></div>':'') +
      '<div class="corte-sep"></div>' +
      '<div class="corte-row" style="font-size:16px;font-weight:800"><span>Esperado</span><span style="color:var(--primary)">' + money(efecEsp) + '</span></div>' +
    '</div>' +
    '<div style="display:flex;gap:6px;margin-top:12px">' +
      '<button class="sp-btn" onclick="abrirMovimiento()" style="flex:1">\u{1F4B0} Movimientos</button>' +
      '<button class="sp-btn" onclick="renderCorte()" style="flex:1">\u{1F9FE} Corte de caja</button>' +
    '</div>' +
    '<button class="sp-btn sp-btn-primary" onclick="renderCierre()" style="width:100%;margin-top:6px">\u{1F512} Cerrar turno</button>' +
    '<button class="btn ghost" onclick="recalcularCaja()" style="width:100%;margin-top:4px">\u{1F504} Recalcular ventas</button>' +
    '<button class="btn ghost" onclick="renderHistorial()" style="width:100%;margin-top:2px">\u{1F4CB} Historial</button>' +
    '<div style="margin-top:10px;max-height:120px;overflow-y:auto">' +
      '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:700;margin-bottom:4px">Ultimos movimientos</div>' +
      (movs.length ? movs.slice(-8).reverse().map(function(m){
        return '<div style="font-size:11px;padding:3px 0;border-bottom:1px solid var(--bg)"><span style="color:'+(m.tipo==='entrada'?'var(--green)':'var(--red)')+'">'+(m.tipo==='entrada'?'+':'-')+money(m.monto)+'</span> '+esc(m.concepto)+' <span style="color:var(--muted);font-size:9px">'+new Date(m.fecha).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})+'</span></div>';
      }).join("") : '<div style="color:var(--muted);font-size:11px">Sin movimientos</div>') +
    '</div>';
}
function renderCorte(){
  if(!state.turno) return;
  var t = state.turno;
  var de = JSON.parse(localStorage.getItem("turnoData_"+t.abierto_en)||"{}");
  var movs = de.movs||[], v = de.ventas||{efectivo:0,tarjeta:0,transferencia:0,apps:0,total:0};
  var efecIni = t.efectivo_inicial||0;
  var entradas = movs.filter(function(m){return m.tipo==="entrada"}).reduce(function(a,m){return a+m.monto},0);
  var salidas = movs.filter(function(m){return m.tipo==="salida"}).reduce(function(a,m){return a+m.monto},0);
  var efecEsp = efecIni + v.efectivo + entradas - salidas;
  var body = $("cajaBody");
  body.innerHTML =
    '<div style="text-align:center;font-size:24px;font-weight:800;margin-bottom:12px">CORTE DE CAJA</div>' +
    '<div class="caja-section-title">RESUMEN</div>' +
    '<div class="corte-box">' +
      '<div class="corte-row"><span>Empleado</span><span>' + esc(t.usuario_nombre) + '</span></div>' +
      '<div class="corte-row"><span>Apertura</span><span>' + fmtTime(t.abierto_en) + '</span></div>' +
      '<div class="corte-row"><span>Efectivo inicial</span><span>' + money(efecIni) + '</span></div>' +
    '</div>' +
    '<div class="caja-section-title">METODOS DE PAGO</div>' +
    '<div class="corte-box">' +
      '<div class="corte-row"><span>Efectivo</span><span>' + money(v.efectivo) + '</span></div>' +
      '<div class="corte-row"><span>Tarjeta</span><span>' + money(v.tarjeta) + '</span></div>' +
      '<div class="corte-row"><span>Transferencia</span><span>' + money(v.transferencia) + '</span></div>' +
      '<div class="corte-row"><span>Apps / Otros</span><span>' + money(v.apps) + '</span></div>' +
      '<div class="corte-sep"></div>' +
      '<div class="corte-row c-bold"><span>TOTAL</span><span>' + money(v.total) + '</span></div>' +
    '</div>' +
    '<div class="caja-section-title">EFECTIVO</div>' +
    '<div class="corte-box">' +
      '<div class="corte-row"><span>Inicial</span><span>' + money(efecIni) + '</span></div>' +
      '<div class="corte-row"><span>+ Ventas efectivo</span><span>' + money(v.efectivo) + '</span></div>' +
      (entradas>0?'<div class="corte-row"><span>+ Entradas</span><span>' + money(entradas) + '</span></div>':'') +
      (salidas>0?'<div class="corte-row"><span>- Salidas</span><span>' + money(salidas) + '</span></div>':'') +
      '<div class="corte-sep"></div>' +
      '<div class="corte-row" style="font-size:16px;font-weight:800"><span>Efectivo esperado</span><span style="color:var(--primary)">' + money(efecEsp) + '</span></div>' +
    '</div>' +
    '<div class="frow" style="margin-top:12px"><label>Efectivo contado</label><input type="number" id="tmEfectivoReal" value="' + efecEsp + '" min="0" oninput="turnoCalcDiff()"></div>' +
    '<div id="tmDiffResult" style="text-align:center;font-size:16px;font-weight:800;margin:8px 0;padding:10px;border-radius:10px"></div>' +
    '<button class="sp-btn sp-btn-primary" onclick="confirmarCierre()" style="width:100%;margin-top:6px">\u{1F512} Cerrar turno</button>' +
    '<button class="btn ghost" onclick="renderCaja()" style="width:100%;margin-top:4px">Volver a caja</button>';
  turnoCalcDiff();
}
function renderCierre(){
  if(!state.turno) return;
  var t = state.turno;
  var body = $("cajaBody");
  body.innerHTML = '<div style="text-align:center;padding:30px"><div style="font-size:24px;margin-bottom:10px">⏳</div><div style="font-weight:800;margin-bottom:6px">Calculando ventas del turno...</div><div style="font-size:11px;color:var(--muted)">Consultando cuentas cobradas</div></div>';
  // Recalcular ventas y luego mostrar el corte
  var xhr = new XMLHttpRequest();
  var desde = t.abierto_en;
  xhr.open("GET","https://edquyomwiiaawqslsisd.supabase.co/rest/v1/orders?select=payment,total,created_at,notes&marca=eq."+(BRAND.marca||"sakura")+"&status=eq.cobrado&order=created_at.desc&limit=1000",true);
  xhr.setRequestHeader("apikey","sb_publishable_aIIwHt4T8cDIeZjy48hRxQ_sdY7_QIf");
  xhr.setRequestHeader("Authorization","Bearer sb_publishable_aIIwHt4T8cDIeZjy48hRxQ_sdY7_QIf");
  xhr.timeout=8000;
  xhr.onload=function(){
    var v = {efectivo:0,tarjeta:0,transferencia:0,apps:0,total:0,pedidos:0};
    if(xhr.status===200){
      var orders = filtrarCobradasDelTurno(JSON.parse(xhr.responseText), desde);
      orders.forEach(function(o){
        var p = (o.payment||"").toLowerCase();
        v.total += (o.total||0);
        if(p.includes("efect")) v.efectivo += (o.total||0);
        else if(p.includes("tarj")||p.includes("tdc")) v.tarjeta += (o.total||0);
        else if(p.includes("transf")) v.transferencia += (o.total||0);
        else v.apps += (o.total||0);
      });
      v.pedidos = orders.length;
    }
    // Guardar en localStorage
    var de = JSON.parse(localStorage.getItem("turnoData_"+t.abierto_en)||"{}");
    de.ventas = {efectivo:v.efectivo,tarjeta:v.tarjeta,transferencia:v.transferencia,apps:v.apps,total:v.total};
    de.pedidosCount = v.pedidos;
    localStorage.setItem("turnoData_"+t.abierto_en, JSON.stringify(de));
    // Ahora renderizar el formulario
    renderFormularioCierre(t, de);
  };
  xhr.onerror=function(){
    var de = JSON.parse(localStorage.getItem("turnoData_"+t.abierto_en)||"{}");
    renderFormularioCierre(t, de);
  };
  xhr.send();
}
function renderFormularioCierre(t, de){
  var movs = de.movs||[], v = de.ventas||{efectivo:0,tarjeta:0,transferencia:0,apps:0,total:0};
  var pedidos = de.pedidosCount||0;
  if(pedidos===0 && v.total===0){
    var body = $("cajaBody");
    body.innerHTML =
      '<div style="text-align:center;padding:30px"><div style="font-size:40px;margin-bottom:10px">⚠️</div>' +
      '<div style="font-size:16px;font-weight:800;margin-bottom:6px">NO HAY CUENTAS COBRADAS</div>' +
      '<div style="font-size:12px;color:var(--muted);margin-bottom:16px">Debe haber al menos una cuenta cobrada en este turno para poder cerrarlo.</div>' +
      '<button class="btn ghost" onclick="renderCaja()" style="width:100%">Volver a caja</button></div>';
    return;
  }
  var efecIni = t.efectivo_inicial||0;
  var body = $("cajaBody");
  body.innerHTML =
    '<div style="text-align:center;font-size:20px;font-weight:800;margin-bottom:14px">CORTE DE CAJA</div>' +
    '<div style="text-align:center;color:var(--muted);font-size:11px;margin-bottom:14px">Empleado: ' + esc(t.usuario_nombre) + ' | Apertura: ' + fmtTime(t.abierto_en) + '</div>' +
    '<div class="corte-box" style="margin-bottom:12px">' +
      '<div class="frow" style="margin-bottom:8px"><label style="font-weight:700">💵 Efectivo</label><input type="number" class="corte-input" id="ciEfectivo" value="0" min="0" step="0.01" oninput="sumarCorteCiego()"></div>' +
      '<div class="frow" style="margin-bottom:8px"><label style="font-weight:700">💳 Tarjeta</label><input type="number" class="corte-input" id="ciTarjeta" value="0" min="0" step="0.01" oninput="sumarCorteCiego()"></div>' +
      '<div class="frow" style="margin-bottom:8px"><label style="font-weight:700">🏦 Transferencia</label><input type="number" class="corte-input" id="ciTransferencia" value="0" min="0" step="0.01" oninput="sumarCorteCiego()"></div>' +
      '<div class="frow" style="margin-bottom:8px"><label style="font-weight:700">📱 Apps / Otros</label><input type="number" class="corte-input" id="ciApps" value="0" min="0" step="0.01" oninput="sumarCorteCiego()"></div>' +
      '<div class="corte-sep"></div>' +
      '<div class="corte-row" style="font-size:16px;font-weight:800"><span>TOTAL CONTADO</span><span id="ciTotal" style="color:var(--primary)">$0</span></div>' +
    '</div>' +
    '<div class="frow"><label>Notas</label><input type="text" id="tmNotas" placeholder="Opcional"></div>' +
    '<div style="display:flex;gap:6px;margin-top:12px">' +
      '<button class="btn ghost" onclick="renderCaja()" style="flex:1">Cancelar</button>' +
      '<button class="btn btn-primary" onclick="confirmarCierreCiego()" style="flex:1;padding:12px">Confirmar cierre</button>' +
    '</div>';
}
function sumarCorteCiego(){
  var ef = parseInt((document.getElementById("ciEfectivo")||{}).value)||0;
  var tj = parseInt((document.getElementById("ciTarjeta")||{}).value)||0;
  var tr = parseInt((document.getElementById("ciTransferencia")||{}).value)||0;
  var ap = parseInt((document.getElementById("ciApps")||{}).value)||0;
  var tot = ef + tj + tr + ap;
  var el = document.getElementById("ciTotal");
  if(el) el.textContent = money(tot);
}
function confirmarCierreCiego(){
  if(!state.turno) return;
  var t = state.turno;
  var de = JSON.parse(localStorage.getItem("turnoData_"+t.abierto_en)||"{}");
  var movs = de.movs||[], v = de.ventas||{efectivo:0,tarjeta:0,transferencia:0,apps:0,total:0};
  var pedidos = de.pedidosCount||0;
  if(pedidos===0 && v.total===0){ toast("No hay cuentas cobradas en este turno"); return }
  var efecIni = t.efectivo_inicial||0;
  var entradas = movs.filter(function(m){return m.tipo==="entrada"}).reduce(function(a,m){return a+m.monto},0);
  var salidas = movs.filter(function(m){return m.tipo==="salida"}).reduce(function(a,m){return a+m.monto},0);
  var efecEsp = efecIni + v.efectivo + entradas - salidas;
  // Leer montos contados por metodo de pago
  var cEf = parseInt((document.getElementById("ciEfectivo")||{}).value)||0;
  var cTj = parseInt((document.getElementById("ciTarjeta")||{}).value)||0;
  var cTr = parseInt((document.getElementById("ciTransferencia")||{}).value)||0;
  var cAp = parseInt((document.getElementById("ciApps")||{}).value)||0;
  var totalCont = cEf + cTj + cTr + cAp;
  var totalEsp = v.total;
  if(totalCont===0){ toast("Ingresa los montos contados por metodo de pago"); return }
  var dEf = cEf - v.efectivo, dTj = cTj - v.tarjeta, dTr = cTr - v.transferencia, dAp = cAp - v.apps;
  var diffTotal = totalCont - totalEsp;
  var notas = (document.getElementById("tmNotas")||{}).value || "";
  var msg = "RESULTADO DEL CORTE\n\n" +
    "METODO         ESPERADO    CONTADO     DIF\n" +
    "Efectivo       " + padR(money(v.efectivo),11) + padR(money(cEf),11) + (dEf>=0?"+":"") + money(dEf) + "\n" +
    "Tarjeta        " + padR(money(v.tarjeta),11) + padR(money(cTj),11) + (dTj>=0?"+":"") + money(dTj) + "\n" +
    "Transferencia  " + padR(money(v.transferencia),11) + padR(money(cTr),11) + (dTr>=0?"+":"") + money(dTr) + "\n" +
    "Apps / Otros   " + padR(money(v.apps),11) + padR(money(cAp),11) + (dAp>=0?"+":"") + money(dAp) + "\n" +
    "----------------------------------------\n" +
    "TOTAL          " + padR(money(totalEsp),11) + padR(money(totalCont),11) + (diffTotal>=0?"+":"") + money(diffTotal) + "\n\n" +
    "Efectivo esperado en caja: " + money(efecEsp) + "\n" +
    "Efectivo contado:          " + money(cEf) + "\n" +
    "Diferencia efectivo:       " + (cEf-efecEsp>=0?"+":"") + money(cEf-efecEsp) + "\n\n" +
    (diffTotal===0 ? "✅ CAJA CUADRADA" : diffTotal>0 ? "🟡 SOBRANTE: +"+money(diffTotal) : "🔴 FALTANTE: "+money(diffTotal)) + "\n\n" +
    "Al cerrar no podra modificar este turno.";
  if(!confirm(msg)) return;
  var raw = localStorage.getItem(SESSION);
  var user = raw ? JSON.parse(raw) : {username:"?"};
  var xhr = new XMLHttpRequest();
  xhr.open("PATCH","https://edquyomwiiaawqslsisd.supabase.co/rest/v1/turnos?abierto_en=eq."+encodeURIComponent(t.abierto_en),true);
  xhr.setRequestHeader("Content-Type","application/json");
  xhr.setRequestHeader("Prefer","return=minimal");
  xhr.setRequestHeader("apikey","sb_publishable_aIIwHt4T8cDIeZjy48hRxQ_sdY7_QIf");
  xhr.setRequestHeader("Authorization","Bearer sb_publishable_aIIwHt4T8cDIeZjy48hRxQ_sdY7_QIf");
  xhr.onload=function(){
    if(xhr.status>=200&&xhr.status<300){
      var hist = JSON.parse(localStorage.getItem("historialTurnos_"+(BRAND.marca||"store"))||"[]");
      var cierreEn=new Date().toISOString();
      hist.push({id:t.abierto_en,usuario:t.usuario_nombre,abierto:t.abierto_en,cerrado:cierreEn,efecIni:efecIni,ventas:v,movs:movs,efecEsp:efecEsp,efecCont:cEf,efecContado:{efectivo:cEf,tarjeta:cTj,transferencia:cTr,apps:cAp},diff:diffTotal,notas:notas,usuarioCierre:user.username});
      imprimirCorte(datosCorte("CIERRE DE TURNO",v,{cerrado_en:cierreEn,efectivo_esperado:efecEsp,contado:{efectivo:cEf,tarjeta:cTj,transferencia:cTr,apps:cAp,total:totalCont},diferencia:diffTotal,notas:notas}));
      if(hist.length>100) hist = hist.slice(-100);
      localStorage.setItem("historialTurnos_"+(BRAND.marca||"store"), JSON.stringify(hist));
      localStorage.removeItem("turnoData_"+t.abierto_en);
      state.turno = null;
      $("turnoBadge").textContent = "\u{1F534} Abrir caja";
      $("cajaModal").classList.add("hidden");
      toast("Turno cerrado. Total: "+money(totalCont));
    } else { toast("Error al cerrar"); }
  };
  xhr.onerror=function(){toast("Error de red")};
  xhr.send(JSON.stringify({estado:"cerrado",cerrado_en:new Date().toISOString(),efectivo_final:cEf}));
}
function padR(s,len){ while(s.length<len)s+=" "; return s; }
window.turnoCalcDiff = function(){
  var t = state.turno; if(!t)return;
  var de = JSON.parse(localStorage.getItem("turnoData_"+t.abierto_en)||"{}");
  var movs = de.movs||[], v = de.ventas||{efectivo:0,tarjeta:0,transferencia:0,apps:0,total:0};
  var efecIni = t.efectivo_inicial||0;
  var entradas = movs.filter(function(m){return m.tipo==="entrada"}).reduce(function(a,m){return a+m.monto},0);
  var salidas = movs.filter(function(m){return m.tipo==="salida"}).reduce(function(a,m){return a+m.monto},0);
  var efecEsp = efecIni + v.efectivo + entradas - salidas;
  var efecCont = parseInt((document.getElementById("tmEfectivoReal")||{}).value)||efecEsp;
  var diff = efecCont - efecEsp;
  var el = document.getElementById("tmDiffResult");
  if(el){
    el.innerHTML = diff===0 ?
      '<span style="color:var(--green)">\u{2705} CAJA CUADRADA</span><br><span style="font-size:14px">Diferencia: $0</span>' :
      diff>0 ?
        '<span style="color:#f59e0b">\u{1F7E0} SOBRANTE</span><br><span style="font-size:14px">+'+money(diff)+'</span>' :
        '<span style="color:var(--red)">\u{1F534} FALTANTE</span><br><span style="font-size:14px">'+money(diff)+'</span>';
    el.style.background = diff===0?'var(--green-bg)':diff>0?'#fff8e1':'var(--red-bg)';
  }
};
function checkTurno(){
  return new Promise(function(resolve){
    var xhr = new XMLHttpRequest();
    xhr.open("GET","https://edquyomwiiaawqslsisd.supabase.co/rest/v1/turnos?marca=eq."+(BRAND.marca||"sakura")+"&estado=eq.abierto&select=*&order=abierto_en.desc&limit=1",true);
    xhr.setRequestHeader("apikey","sb_publishable_aIIwHt4T8cDIeZjy48hRxQ_sdY7_QIf");
    xhr.setRequestHeader("Authorization","Bearer sb_publishable_aIIwHt4T8cDIeZjy48hRxQ_sdY7_QIf");
    xhr.timeout=8000;
    xhr.onload=function(){if(xhr.status===200){var d=JSON.parse(xhr.responseText);resolve(d[0]||null)}else{resolve(null)}};
    xhr.onerror=function(){resolve(null)};
    xhr.ontimeout=function(){resolve(null)};
    xhr.send();
  });
}
function fechaCobro(o){
  var m=(o.notes||"").match(/(?:^|\s\|\s)PAGO_EN:([^|]+)/g);
  if(m&&m.length){var v=m[m.length-1].replace(/^.*PAGO_EN:/,"").trim();var d=new Date(v);if(!isNaN(d.getTime()))return d;}
  return new Date(o.created_at);
}
function filtrarCobradasDelTurno(orders, desde){
  var inicio=new Date(desde).getTime();
  return orders.filter(function(o){var d=fechaCobro(o);return !isNaN(d.getTime())&&d.getTime()>=inicio;});
}
function recalcularCaja(){
  calcularVentas(function(){renderCaja();});
}
function calcularVentas(done){
  if(!state.turno){if(done)done();return;}
  var desde = state.turno.abierto_en;
  var xhr = new XMLHttpRequest();
  xhr.open("GET","https://edquyomwiiaawqslsisd.supabase.co/rest/v1/orders?select=payment,total,created_at,notes&marca=eq."+(BRAND.marca||"sakura")+"&status=eq.cobrado&order=created_at.desc&limit=1000",true);
  xhr.setRequestHeader("apikey","sb_publishable_aIIwHt4T8cDIeZjy48hRxQ_sdY7_QIf");
  xhr.setRequestHeader("Authorization","Bearer sb_publishable_aIIwHt4T8cDIeZjy48hRxQ_sdY7_QIf");
  xhr.timeout=8000;
  xhr.onload=function(){
    if(xhr.status!==200){if(done)done();return;}
    var orders = filtrarCobradasDelTurno(JSON.parse(xhr.responseText), desde);
    var v = {efectivo:0,tarjeta:0,transferencia:0,apps:0,online:0,total:0};
    orders.forEach(function(o){
      var p = (o.payment||"").toLowerCase();
      v.total += (o.total||0);
      if(p.includes("online")||p.includes("pagado online")){ v.online += (o.total||0); }
      else if(p.includes("efect")){ v.efectivo += (o.total||0); }
      else if(p.includes("tarj")||p.includes("tdc")){ v.tarjeta += (o.total||0); }
      else if(p.includes("transf")){ v.transferencia += (o.total||0); }
      else { v.apps += (o.total||0); }
    });
    var de = JSON.parse(localStorage.getItem("turnoData_"+state.turno.abierto_en)||"{}");
    de.ventas = v; de.pedidosCount = orders.length;
    localStorage.setItem("turnoData_"+state.turno.abierto_en, JSON.stringify(de));
    if(done)done();
  };
  xhr.onerror=function(){if(done)done();};
  xhr.send();
}
function abrirTurno(){
  var ini = parseInt(document.getElementById("tmEfectivoIni").value)||0;
  var raw = localStorage.getItem(SESSION);
  var user = raw ? JSON.parse(raw) : {username:"?",nombre:"?"};
  var ahora = new Date().toISOString();
  // Primero buscar turno existente del usuario
  var gxhr = new XMLHttpRequest();
  gxhr.open("GET","https://edquyomwiiaawqslsisd.supabase.co/rest/v1/turnos?marca=eq."+(BRAND.marca||"sakura")+"&usuario_id=eq."+encodeURIComponent(user.username)+"&order=abierto_en.desc&limit=1",true);
  gxhr.setRequestHeader("apikey","sb_publishable_aIIwHt4T8cDIeZjy48hRxQ_sdY7_QIf");
  gxhr.setRequestHeader("Authorization","Bearer sb_publishable_aIIwHt4T8cDIeZjy48hRxQ_sdY7_QIf");
  gxhr.timeout=8000;
  gxhr.onload=function(){
    if(gxhr.status!==200){ toast("Error al buscar turno"); return }
    var existentes = JSON.parse(gxhr.responseText);
    if(!existentes.length){ toast("No se encontro turno para este usuario"); return }
    var ts = existentes[0].abierto_en;
    // Ahora PATCH con abierto_en
    var pxhr = new XMLHttpRequest();
    pxhr.open("PATCH","https://edquyomwiiaawqslsisd.supabase.co/rest/v1/turnos?abierto_en=eq."+encodeURIComponent(ts),true);
    pxhr.setRequestHeader("Content-Type","application/json");
    pxhr.setRequestHeader("Prefer","return=representation");
    pxhr.setRequestHeader("apikey","sb_publishable_aIIwHt4T8cDIeZjy48hRxQ_sdY7_QIf");
    pxhr.setRequestHeader("Authorization","Bearer sb_publishable_aIIwHt4T8cDIeZjy48hRxQ_sdY7_QIf");
    pxhr.timeout=8000;
    pxhr.onload=function(){
      if(pxhr.status>=200&&pxhr.status<300){
        var t = JSON.parse(pxhr.responseText)[0];
        state.turno = t;
        localStorage.setItem("turnoData_"+t.abierto_en, JSON.stringify({movs:[],ventas:{efectivo:0,tarjeta:0,transferencia:0,apps:0,total:0}}));
        $("turnoBadge").textContent = "\u{1F7E2} Caja abierta";
        toast("Turno abierto. Efectivo: "+money(ini));
        renderCaja();
      } else { toast("Error al abrir turno (HTTP "+pxhr.status+")"); }
    };
    pxhr.onerror=function(){toast("Error de conexion")};
    pxhr.send(JSON.stringify({usuario_nombre:user.nombre,efectivo_inicial:ini,estado:"abierto",cerrado_en:null,efectivo_final:0}));
  };
  gxhr.onerror=function(){toast("Error de conexion")};
  gxhr.send();
}
function confirmarCierre(){
  if(!state.turno) return;
  var t = state.turno;
  var de = JSON.parse(localStorage.getItem("turnoData_"+t.abierto_en)||"{}");
  var movs = de.movs||[], v = de.ventas||{efectivo:0,tarjeta:0,transferencia:0,apps:0,total:0};
  var efecIni = t.efectivo_inicial||0;
  var entradas = movs.filter(function(m){return m.tipo==="entrada"}).reduce(function(a,m){return a+m.monto},0);
  var salidas = movs.filter(function(m){return m.tipo==="salida"}).reduce(function(a,m){return a+m.monto},0);
  var efecEsp = efecIni + v.efectivo + entradas - salidas;
  var efecCont = parseInt((document.getElementById("tmEfectivoReal")||{}).value)||efecEsp;
  var diff = efecCont - efecEsp;
  var notas = (document.getElementById("tmNotas")||{}).value || "";
  if(!confirm("Cerrar turno?\n\nEfectivo esperado: "+money(efecEsp)+"\nEfectivo contado: "+money(efecCont)+"\nDiferencia: "+money(diff)+"\n\nAl cerrar no podra modificar este turno.")) return;
  var raw = localStorage.getItem(SESSION);
  var user = raw ? JSON.parse(raw) : {username:"?"};
  var xhr = new XMLHttpRequest();
  xhr.open("PATCH","https://edquyomwiiaawqslsisd.supabase.co/rest/v1/turnos?abierto_en=eq."+encodeURIComponent(t.abierto_en),true);
  xhr.setRequestHeader("Content-Type","application/json");
  xhr.setRequestHeader("Prefer","return=minimal");
  xhr.setRequestHeader("apikey","sb_publishable_aIIwHt4T8cDIeZjy48hRxQ_sdY7_QIf");
  xhr.setRequestHeader("Authorization","Bearer sb_publishable_aIIwHt4T8cDIeZjy48hRxQ_sdY7_QIf");
  xhr.onload=function(){
    if(xhr.status>=200&&xhr.status<300){
      var hist = JSON.parse(localStorage.getItem("historialTurnos_"+(BRAND.marca||"store"))||"[]");
      hist.push({id:t.abierto_en,usuario:t.usuario_nombre,abierto:t.abierto_en,cerrado:new Date().toISOString(),efecIni:efecIni,ventas:v,movs:movs,efecEsp:efecEsp,efecCont:efecCont,diff:diff,notas:notas,usuarioCierre:user.username});
      if(hist.length>100) hist = hist.slice(-100);
      localStorage.setItem("historialTurnos_"+(BRAND.marca||"store"), JSON.stringify(hist));
      localStorage.removeItem("turnoData_"+t.abierto_en);
      state.turno = null;
      $("turnoBadge").textContent = "\u{1F534} Abrir caja";
      $("cajaModal").classList.add("hidden");
      toast("Turno cerrado. "+money(efecCont));
    } else { toast("Error al cerrar"); }
  };
  xhr.onerror=function(){toast("Error de red")};
  xhr.send(JSON.stringify({estado:"cerrado",cerrado_en:new Date().toISOString(),efectivo_final:efecCont}));
}
function abrirMovimiento(){
  document.getElementById("movMonto").value = "";
  document.getElementById("movConcepto").value = "";
  document.getElementById("movTipo").value = "entrada";
  document.getElementById("movEntrada").classList.add("on");
  document.getElementById("movSalida").classList.remove("on");
  $("movimientoModal").classList.remove("hidden");
}
function guardarMovimiento(){
  if(!state.turno) return;
  var tipo = document.getElementById("movTipo").value;
  var concepto = document.getElementById("movConcepto").value.trim();
  var monto = parseInt(document.getElementById("movMonto").value)||0;
  if(!concepto||!monto){toast("Completa concepto y monto");return}
  var de = JSON.parse(localStorage.getItem("turnoData_"+state.turno.abierto_en)||"{}");
  if(!de.movs) de.movs = [];
  de.movs.push({tipo:tipo, concepto:concepto, monto:monto, fecha:new Date().toISOString()});
  localStorage.setItem("turnoData_"+state.turno.abierto_en, JSON.stringify(de));
  $("movimientoModal").classList.add("hidden");
  toast((tipo==="entrada"?"+":"-")+money(monto)+" registrado");
  renderCaja();
}
function renderHistorial(){
  var hist = JSON.parse(localStorage.getItem("historialTurnos_"+(BRAND.marca||"store"))||"[]");
  var body = $("historialBody");
  if(!hist.length){ body.innerHTML='<div class="empty" style="padding:30px">Sin cortes registrados</div>'; }
  else {
    body.innerHTML = hist.reverse().map(function(h,i){
      return '<div style="padding:10px 12px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;cursor:pointer" onclick="verDetalleTurno('+i+')">' +
        '<div style="display:flex;justify-content:space-between;font-weight:800;margin-bottom:4px"><span>Corte #'+(hist.length-i)+'</span><span>'+esc(h.usuario)+'</span></div>' +
        '<div style="font-size:11px;color:var(--muted)">'+fmtTime(h.abierto)+' \u2192 '+fmtTime(h.cerrado)+'</div>' +
        '<div style="display:flex;justify-content:space-between;margin-top:4px;font-size:13px"><span>Ventas</span><span>'+money(h.ventas.total)+'</span></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:13px"><span>Efectivo</span><span>'+money(h.efecEsp)+'</span></div>' +
        '<div style="display:flex;justify-content:space-between;font-weight:800;font-size:13px;color:'+(h.diff===0?'var(--green)':h.diff>0?'#f59e0b':'var(--red)')+'"><span>Diferencia</span><span>'+(h.diff>=0?'+':'')+money(h.diff)+'</span></div>' +
      '</div>';
    }).join("");
  }
  $("historialModal").classList.remove("hidden");
}
window.verDetalleTurno = function(idx){
  var hist = JSON.parse(localStorage.getItem("historialTurnos_"+(BRAND.marca||"store"))||"[]");
  var h = hist[hist.length-1-idx]; if(!h) return;
  var body = $("historialBody");
  body.innerHTML =
    '<div style="text-align:center;font-size:18px;font-weight:800;margin-bottom:12px">Corte #'+(idx+1)+'</div>' +
    '<div class="corte-box">' +
      '<div class="corte-row"><span>Empleado</span><span>'+esc(h.usuario)+'</span></div>' +
      '<div class="corte-row"><span>Apertura</span><span>'+fmtTime(h.abierto)+'</span></div>' +
      '<div class="corte-row"><span>Cierre</span><span>'+fmtTime(h.cerrado)+'</span></div>' +
      '<div class="corte-row"><span>Efectivo inicial</span><span>'+money(h.efecIni)+'</span></div>' +
    '</div>' +
    '<div class="caja-section-title">VENTAS</div>' +
    '<div class="corte-box">' +
      '<div class="corte-row"><span>Efectivo</span><span>'+money(h.ventas.efectivo)+'</span></div>' +
      '<div class="corte-row"><span>Tarjeta</span><span>'+money(h.ventas.tarjeta)+'</span></div>' +
      '<div class="corte-row"><span>Transferencia</span><span>'+money(h.ventas.transferencia)+'</span></div>' +
      '<div class="corte-row"><span>Apps</span><span>'+money(h.ventas.apps)+'</span></div>' +
      '<div class="corte-sep"></div>' +
      '<div class="corte-row c-bold"><span>Total ventas</span><span>'+money(h.ventas.total)+'</span></div>' +
    '</div>' +
    '<div class="caja-section-title">EFECTIVO</div>' +
    '<div class="corte-box">' +
      '<div class="corte-row"><span>Esperado</span><span>'+money(h.efecEsp)+'</span></div>' +
      '<div class="corte-row"><span>Contado</span><span>'+money(h.efecCont)+'</span></div>' +
      '<div class="corte-row c-bold"><span>Diferencia</span><span style="color:'+(h.diff===0?'var(--green)':h.diff>0?'#f59e0b':'var(--red)')+'">'+(h.diff>=0?'+':'')+money(h.diff)+'</span></div>' +
    '</div>' +
    '<button class="btn ghost" onclick="renderHistorial()" style="width:100%;margin-top:12px">Volver al historial</button>';
}
function initTurnoBadge(){
  checkTurno().then(function(turno){
    state.turno = turno;
    $("turnoBadge").textContent = turno ? "\u{1F7E2} Caja abierta" : "\u{1F534} Abrir caja";
  });
}


/* Reportes (simple) */
var rchart=null;
function cargarReportes(modo){
  $("reporteContent").classList.remove("hidden");$("topsTable").style.display="none";var cc=$("reporteChart");cc.parentElement.style.display="";var desde=new Date();
  if(modo==="hoy")desde.setHours(0,0,0,0);else if(modo==="semana")desde.setDate(desde.getDate()-7);else if(modo==="mes")desde.setDate(desde.getDate()-30);
  apiGet("orders?select=*&marca=eq."+encodeURIComponent(BRAND.marca||"")+"&status=eq.cobrado&created_at=gte."+desde.toISOString()+"&order=created_at.asc&limit=500").then(function(orders){
    var t=orders.reduce(function(a,o){return a+(o.total||0)},0);$("rPedidos").textContent=orders.length;$("rIngresos").textContent=money(t);$("rTicket").textContent=orders.length?money(Math.round(t/orders.length)):"$0";
    var mt={Efectivo:0,Tarjeta:0,Transferencia:0};orders.forEach(function(o){var p=(o.payment||"").toLowerCase();if(p.includes("efect"))mt.Efectivo+=(o.total||0);else if(p.includes("tarj")||p.includes("tdc"))mt.Tarjeta+=(o.total||0);else if(p.includes("transf"))mt.Transferencia+=(o.total||0)});
    $("rEfectivo").textContent=money(mt.Efectivo);$("rTarjeta").textContent=money(mt.Tarjeta);$("rTransf").textContent=money(mt.Transferencia);
    if(rchart)rchart.destroy();
    if(modo==="tops"){cc.parentElement.style.display="none";var ic={};orders.forEach(function(o){(o.items||[]).forEach(function(i){var k=i.name;if(!ic[k])ic[k]={name:i.name,qty:0,rev:0};ic[k].qty+=(i.qty||0);ic[k].rev+=(i.price||0)*(i.qty||0)})});var tops=Object.values(ic).sort(function(a,b){return b.qty-a.qty}).slice(0,20);$("topsTable").style.display="block";$("topsTable").innerHTML=tops.length?'<table style="width:100%;border-collapse:collapse"><thead><tr style="font-size:11px;color:var(--muted)"><th style="text-align:left;padding:6px 8px">Producto</th><th style="text-align:right;padding:6px 8px">Vendido</th><th style="text-align:right;padding:6px 8px">Ingreso</th></tr></thead><tbody>'+tops.map(function(t,i){return'<tr style="border-top:1px solid var(--border);font-size:13px"><td style="padding:6px 8px;font-weight:700">'+(i+1)+'. '+esc(t.name)+'</td><td style="text-align:right;padding:6px 8px">'+t.qty+'</td><td style="text-align:right;padding:6px 8px;color:var(--primary);font-weight:700">'+money(t.rev)+'</td></tr>'}).join("")+'</tbody></table>':'<div class="empty">Sin datos</div>';return}
    var dias={},fmt=modo==="hoy"?function(d){return d.toLocaleTimeString("es-MX",{hour:"2-digit"})}:function(d){return d.toLocaleDateString("es-MX",{day:"2-digit",month:"2-digit"})};
    if(modo==="hoy"){for(var h=8;h<=23;h++){var k=h+":00";dias[k]={label:k,total:0,count:0}}}else{var s=new Date(desde);for(var d=new Date(s);d<=new Date();d.setDate(d.getDate()+1)){var k=d.toISOString().slice(0,10);dias[k]={label:fmt(d),total:0,count:0}}}
    orders.forEach(function(o){var d=new Date(o.created_at),k;if(modo==="hoy")k=d.getHours()+":00";else k=d.toISOString().slice(0,10);if(dias[k]){dias[k].total+=(o.total||0);dias[k].count++}});
    var labels=Object.values(dias).map(function(d){return d.label}),data=Object.values(dias).map(function(d){return d.total});
    rchart=new Chart(cc,{type:"bar",data:{labels:labels,datasets:[{label:"Ingresos",data:data,backgroundColor:"#e8367c",borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{ticks:{callback:function(v){return"$"+v.toLocaleString()}}},x:{ticks:{maxRotation:45,font:{size:10}}}}}});
  }).catch(function(){$("rPedidos").textContent="ERR"});
}

/* Gastos */
var gastosList=[];
function fetchGastos(){try{var r=localStorage.getItem((BRAND.marca||"store")+"Gastos");return r?JSON.parse(r):[]}catch(e){return[]}}
function cargarGastos(){
  gastosList=fetchGastos();var hoy=new Date().toDateString();
  var hoyGas=gastosList.filter(function(g){return new Date(g.creado_en).toDateString()===hoy}).reduce(function(a,g){return a+(g.monto||0)},0);
  var sf=new Date();sf.setDate(sf.getDate()-7);var semGas=gastosList.filter(function(g){return new Date(g.creado_en)>=sf}).reduce(function(a,g){return a+(g.monto||0)},0);
  $("gHoy").textContent=money(hoyGas);$("gSemana").textContent=money(semGas);
  $("gastosList").innerHTML=gastosList.length?gastosList.slice(0,40).map(function(g){return'<div class="user-row"><span><span class="u-name">'+esc(g.categoria)+'</span> '+money(g.monto)+'</span><span class="u-btns"><span style="font-size:10px;color:var(--muted)">'+new Date(g.creado_en).toLocaleDateString("es-MX")+'</span><button class="btn-sm danger" onclick="window._delGasto(\''+g.id+'\')">X</button></span></div>'}).join(""):'<div class="empty">Sin gastos</div>';
}
window._delGasto=function(id){var g=JSON.parse(localStorage.getItem((BRAND.marca||"store")+"Gastos")||"[]");localStorage.setItem((BRAND.marca||"store")+"Gastos",JSON.stringify(g.filter(function(x){return x.id!==id})));cargarGastos();};
function guardarGasto(){var cat=$("gmCat").value,monto=parseInt($("gmMonto").value,10),desc=$("gmDesc").value.trim();if(!monto||monto<=0){toast("Ingresa un monto");return}var g=fetchGastos();g.push({id:Date.now().toString(),categoria:cat,monto:monto,descripcion:desc||"",creado_en:new Date().toISOString()});localStorage.setItem((BRAND.marca||"store")+"Gastos",JSON.stringify(g));$("gmMonto").value="";$("gmDesc").value="";toast("Gasto: "+money(monto));cargarGastos();}

/* Productos */
function fetchProducts(){apiGet("menu_items?marca=eq."+encodeURIComponent(BRAND.marca||"")+"&select=*&order=categoria,orden").then(function(rows){window._prodCache=rows;renderProducts(rows);$("pmEstList").innerHTML=[...new Set(rows.map(function(r){return r.estacion||""}).filter(Boolean))].map(function(e){return'<option value="'+esc(e)+'">'}).join("");verificarInventarios()}).catch(function(){})}
 function renderProducts(rows){var q=($("pmSearch").value||"").toLowerCase(),f=q?rows.filter(function(r){return r.nombre.toLowerCase().includes(q)||r.categoria.toLowerCase().includes(q)}):rows,lc="";$("productsList").innerHTML=f.map(function(p){var sk=parseInt(localStorage.getItem("prodStock_"+p.id))||0,st=sk>0?" (Stock:"+sk+")":localStorage.getItem("prodStock_"+p.id)?" (AGOTADO)":"",cl=p.categoria!==lc?'<div style="font-weight:800;margin:10px 0 4px;color:var(--primary)">'+esc(p.categoria)+'</div>':'';lc=p.categoria;return cl+'<div class="user-row"><span><span class="u-name">'+esc(p.nombre)+'</span> $'+p.precio+st+(p.estacion?'<span class="u-rol">'+esc(p.estacion)+'</span>':'')+(!p.disponible?' <span style="color:var(--red)">AGOTADO</span>':'')+'</span><span class="u-btns"><button class="btn-sm" onclick="PosEditProd(\''+p.id+'\')">E</button><button class="btn-sm" onclick="PosStock(\''+p.id+'\')">📦</button><button class="btn-sm danger" onclick="PosToggleProd(\''+p.id+'\','+!p.disponible+')">'+(p.disponible?'Desactivar':'Activar')+'</button></span></div>'}).join("")}
function PosEditProd(pid){var p=(window._prodCache||[]).find(function(r){return r.id===pid});if(!p)return;$("pmCat").value=p.categoria;$("pmName").value=p.nombre;$("pmPrice").value=p.precio;$("pmDesc").value=p.descripcion||"";$("pmEstacion").value=p.estacion||"";var sk=localStorage.getItem("prodStock_"+pid)||"";$("pmStock").value=sk;$("pmPrep").value=localStorage.getItem("prodPrep_"+pid)||"";$("addProductBtn").textContent="Guardar cambios";$("addProductBtn").dataset.editId=pid;}
function PosStock(pid){var stock=prompt("Cantidad en inventario:",localStorage.getItem("prodStock_"+pid)||"0");if(stock!==null){var n=parseInt(stock)||0;if(n>0)localStorage.setItem("prodStock_"+pid,String(n));else localStorage.removeItem("prodStock_"+pid);fetchProducts();toast("Stock actualizado")}}
function PosToggleProd(pid,val){
  var xhr=new XMLHttpRequest();
  xhr.open("PATCH","https://edquyomwiiaawqslsisd.supabase.co/rest/v1/menu_items?id=eq."+pid,true);
  xhr.setRequestHeader("Content-Type","application/json");
  xhr.setRequestHeader("Prefer","return=minimal");
  xhr.setRequestHeader("apikey","sb_publishable_aIIwHt4T8cDIeZjy48hRxQ_sdY7_QIf");
  xhr.setRequestHeader("Authorization","Bearer sb_publishable_aIIwHt4T8cDIeZjy48hRxQ_sdY7_QIf");
  xhr.onload=function(){fetchProducts()};
  xhr.send(JSON.stringify({disponible:val}));
}
function addProduct(){var cat=$("pmCat").value.trim(),name=$("pmName").value.trim(),price=parseInt($("pmPrice").value,10),desc=$("pmDesc").value.trim(),est=$("pmEstacion").value.trim(),stock=$("pmStock").value.trim(),prep=$("pmPrep").value.trim();if(!cat||!name||isNaN(price)){toast("Completa datos");return}var eid=$("addProductBtn").dataset.editId,body=JSON.stringify({categoria:cat,nombre:name,precio:price,descripcion:desc,estacion:est,marca:BRAND.marca||""});var url=eid?API.replace("/rest/v1/orders","/rest/v1/menu_items")+"?id=eq."+eid:API.replace("/rest/v1/orders","/rest/v1/menu_items");fetch(url,{method:eid?"PATCH":"POST",headers:{"Content-Type":"application/json","Prefer":"return=minimal","apikey":SUPABASE_KEY,"Authorization":"Bearer "+SUPABASE_KEY},body:body}).then(function(){if(eid){toast("Actualizado")}else{toast("Creado")}$("pmCat").value="";$("pmName").value="";$("pmPrice").value="";$("pmDesc").value="";$("pmEstacion").value="";$("pmStock").value="";$("pmPrep").value="";$("addProductBtn").textContent="Agregar producto";delete $("addProductBtn").dataset.editId;fetchProducts()}).catch(function(){toast("Error")})}
function fetchUsers(){apiGet("usuarios?select=*&order=username").then(function(rows){
  $("usersList").innerHTML=rows.map(function(u){return'<div class="user-row"><span><span class="u-name">'+esc(u.username)+'</span> '+esc(u.nombre)+' <span class="u-rol">'+esc(u.rol)+'</span>'+(u.activo?'':' <span class="u-rol" style="color:var(--red)">INACTIVO</span>')+'</span><span class="u-btns"><button class="btn-sm" onclick="PosToggleUser(\''+u.id+'\','+!u.activo+')">'+(u.activo?'Desactivar':'Activar')+'</button><button class="btn-sm" onclick="PosChangePass(\''+u.id+'\',\''+esc(u.username)+'\')" title="Cambiar contraseña">🔑</button></span></div>'}).join("")
})}
function PosToggleUser(uid,val){
  fetch(API.replace("/rest/v1/orders","/rest/v1/usuarios")+"?id=eq."+uid,{method:"PATCH",headers:{"Content-Type":"application/json","Prefer":"return=minimal","apikey":SUPABASE_KEY,"Authorization":"Bearer "+SUPABASE_KEY},body:JSON.stringify({activo:val})}).then(function(){toast(val?"Usuario activado":"Usuario desactivado");fetchUsers()}).catch(function(){toast("Error")});
}
function PosChangePass(uid,username){
  var pass=prompt("Nueva contraseña para "+username+":","");if(!pass||pass.length<4){if(pass!==null)toast("Minimo 4 caracteres");return}
  crypto.subtle.digest("SHA-256",new TextEncoder().encode(pass)).then(function(buf){var h=Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,"0")}).join("");return fetch(API.replace("/rest/v1/orders","/rest/v1/usuarios")+"?id=eq."+uid,{method:"PATCH",headers:{"Content-Type":"application/json","Prefer":"return=minimal","apikey":SUPABASE_KEY,"Authorization":"Bearer "+SUPABASE_KEY},body:JSON.stringify({password_hash:h})})}).then(function(){toast("Contraseña actualizada")}).catch(function(){toast("Error al cambiar contraseña")});
}
function addUser(){var username=$("umUser").value.trim(),nombre=$("umName").value.trim(),pass=$("umPass").value,rol=$("umRol").value;if(!username||!nombre||!pass){toast("Completa campos");return}if(pass.length<4){toast("Minimo 4 caracteres");return}crypto.subtle.digest("SHA-256",new TextEncoder().encode(pass)).then(function(buf){var h=Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,"0")}).join("");return fetch(API.replace("/rest/v1/orders","/rest/v1/usuarios"),{method:"POST",headers:{"Content-Type":"application/json","Prefer":"return=minimal","apikey":SUPABASE_KEY,"Authorization":"Bearer "+SUPABASE_KEY},body:JSON.stringify({username:username,nombre:nombre,rol:rol,password_hash:h,activo:true})})}).then(function(){toast("Usuario creado");$("umUser").value="";$("umName").value="";$("umPass").value="";fetchUsers()}).catch(function(){toast("Error al crear usuario")})}

/* Turno */
function mostrarReabiertas(){
  var log = JSON.parse(localStorage.getItem((BRAND.marca||"store")+"ReabrirLog")||"[]");
  var el = $("reabiertasTable");
  if(!el) return;
  if(!log.length){ el.style.display="block"; el.innerHTML='<div class="empty-state"><span class="es-text" style="font-size:12px">Sin cuentas reabiertas</span></div>'; return }
  el.style.display="block";
  el.innerHTML = '<table style="width:100%;border-collapse:collapse"><thead><tr style="font-size:11px;color:var(--muted)"><th style="text-align:left;padding:4px 8px">Folio</th><th style="text-align:left;padding:4px 8px">Usuario</th><th style="text-align:left;padding:4px 8px">Fecha</th></tr></thead><tbody>'+
    log.slice().reverse().map(function(l){return'<tr style="border-top:1px solid var(--border);font-size:12px"><td style="padding:4px 8px;font-weight:700">#'+esc(l.folio)+'</td><td style="padding:4px 8px">'+esc(l.usuario)+' ('+esc(l.username)+')</td><td style="padding:4px 8px;color:var(--muted)">'+fmtTime(l.fecha)+'</td></tr>'}).join("")+'</tbody></table>';
}
/* ========== COMANDAS POR ESTACION ========== */
function PosComandar(id){
  var o = state.orders.find(function(x){return x.id===id});
  if(!o||!o.items) return;
  var estaciones = {};
  (o.items||[]).forEach(function(it){
    var est = localStorage.getItem("prodEstacion_"+it.key) || "General";
    if(!estaciones[est]) estaciones[est] = [];
    estaciones[est].push(it);
  });
  var names = Object.keys(estaciones);
  if(names.length<=1){ printTicket(o); toast("Comanda enviada"); return }
  // Print per station
  names.forEach(function(est){
    var its = estaciones[est];
    var sub = Object.assign({}, o, {items:its, total:its.reduce(function(a,it){return a+(it.price||0)*(it.qty||0)},0), name:(o.name||"Cliente")+" ["+est+"]"});
    printTicket(sub);
  });
  toast("Comandas enviadas: "+names.join(", "));
}
/* ========== INVENTARIOS ========== */
function verificarInventarios(){
  var alertas = [];
  try {
    var rows = window._prodCache || [];
    rows.forEach(function(p){
      var stock = parseInt(localStorage.getItem("prodStock_"+p.id)) || 0;
      if(stock <= 5 && stock >= 0 && p.disponible !== false){
        alertas.push({nombre:p.nombre, stock:stock, id:p.id});
      }
    });
  } catch(e){}
  if(alertas.length && $("invAlert")){
    $("invAlert").innerHTML = '⚠️ '+alertas.length+' productos con stock bajo';
    $("invAlert").style.display = "block";
  }
}
/* ========== CRM / CLIENTES ========== */
function abrirCRM(){
  var clientes = {};
  state.orders.forEach(function(o){
    if(!o.name||o.name==="Cliente"||o.name==="Mesa") return;
    var key = (o.name||"").toLowerCase().trim();
    if(!clientes[key]) clientes[key] = {nombre:o.name, telefono:o.phone||"", pedidos:0, total:0, ultimo:o.created_at};
    clientes[key].pedidos++;
    clientes[key].total += (o.total||0);
    if(o.created_at > clientes[key].ultimo) clientes[key].ultimo = o.created_at;
  });
  var lista = Object.values(clientes).sort(function(a,b){return b.pedidos-a.pedidos}).slice(0,50);
  var body = $("crmBody");
  if(!body) return;
  if(!lista.length){ body.innerHTML='<div class="empty-state"><span class="es-text">Sin clientes registrados</span></div>'; $("crmModal").classList.remove("hidden"); return }
  body.innerHTML = '<table style="width:100%;border-collapse:collapse"><thead><tr style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px"><th style="text-align:left;padding:6px 8px">Cliente</th><th style="text-align:left;padding:6px 8px">Tel</th><th style="text-align:right;padding:6px 8px">Pedidos</th><th style="text-align:right;padding:6px 8px">Total</th><th style="text-align:right;padding:6px 8px">Ultimo</th></tr></thead><tbody>'+
    lista.map(function(c,i){return'<tr style="border-top:1px solid var(--border);font-size:12px;cursor:pointer" onclick="abrirHistorialCliente(\''+esc(c.nombre)+'\')"><td style="padding:6px 8px;font-weight:700">'+(i+1)+'. '+esc(c.nombre)+'</td><td style="padding:6px 8px;font-size:11px">'+esc(c.telefono)+'</td><td style="text-align:right;padding:6px 8px;font-weight:700">'+c.pedidos+'</td><td style="text-align:right;padding:6px 8px;color:var(--primary);font-weight:700">'+money(c.total)+'</td><td style="text-align:right;padding:6px 8px;font-size:11px;color:var(--muted)">'+fmtTime(c.ultimo)+'</td></tr>'}).join("")+'</tbody></table>';
  $("crmModal").classList.remove("hidden");
}
function abrirHistorialCliente(nombre){
  var pedidos = state.orders.filter(function(o){return (o.name||"").toLowerCase().trim()===nombre.toLowerCase().trim()});
  var body = $("crmBody");
  body.innerHTML = '<button class="btn ghost" onclick="abrirCRM()" style="margin-bottom:10px">← Volver</button><div style="font-weight:800;font-size:15px;margin-bottom:10px">'+esc(nombre)+' - '+pedidos.length+' pedidos</div>'+
    pedidos.sort(function(a,b){return new Date(b.created_at)-new Date(a.created_at)}).map(function(o){
      var s=STATUS[o.status]||STATUS.nuevo;
      return '<div class="o-card" style="margin-bottom:8px"><div class="o-card-top" style="cursor:default"><div class="o-card-left"><span class="o-folio">#'+esc(o.folio)+'</span><span class="o-badge '+s.cls+'">'+s.label+'</span></div><div class="o-time"><span>'+fmtTime(o.created_at)+'</span><span style="font-weight:700;color:var(--primary)">'+money(o.total||0)+'</span></div></div></div>';
    }).join("");
}
/* ========== REPORTES AVANZADOS ========== */
function cargarReporteAvanzado(tipo){
  $("reporteAvanzadoContent").classList.remove("hidden");
  var desde = new Date();
  if(tipo==="hora") desde.setHours(desde.getHours()-24);
  else if(tipo==="mesero") desde.setDate(desde.getDate()-30);
  else if(tipo==="pago") desde.setDate(desde.getDate()-30);
  apiGet("orders?select=*&marca=eq."+encodeURIComponent(BRAND.marca||"")+"&status=eq.cobrado&created_at=gte."+desde.toISOString()+"&order=created_at.desc&limit=500").then(function(orders){
    var html = '';
    if(tipo==="hora"){
      var horas = {}; for(var h=0;h<24;h++) horas[h]={h:h,count:0,total:0};
      orders.forEach(function(o){var h=new Date(o.created_at).getHours();if(horas[h]){horas[h].count++;horas[h].total+=(o.total||0)}});
      html='<table style="width:100%;border-collapse:collapse"><thead><tr style="font-size:11px;color:var(--muted)"><th style="text-align:left;padding:4px 8px">Hora</th><th style="text-align:right;padding:4px 8px">Pedidos</th><th style="text-align:right;padding:4px 8px">Total</th></tr></thead><tbody>'+
        Object.values(horas).filter(function(h){return h.count>0}).map(function(h){return'<tr style="border-top:1px solid var(--border);font-size:13px"><td style="padding:4px 8px;font-weight:700">'+h.h+':00 - '+(h.h+1)+':00</td><td style="text-align:right;padding:4px 8px">'+h.count+'</td><td style="text-align:right;padding:4px 8px;color:var(--primary);font-weight:700">'+money(h.total)+'</td></tr>'}).join("")+'</tbody></table>';
    } else if(tipo==="mesero"){
      var meseros = {};
      orders.forEach(function(o){
        var m = o.name||"Sin nombre";
        if(!meseros[m]) meseros[m]={nombre:m,count:0,total:0};
        meseros[m].count++; meseros[m].total+=(o.total||0);
      });
      var lista = Object.values(meseros).sort(function(a,b){return b.total-a.total});
      html='<table style="width:100%;border-collapse:collapse"><thead><tr style="font-size:11px;color:var(--muted)"><th style="text-align:left;padding:4px 8px">Mesero</th><th style="text-align:right;padding:4px 8px">Pedidos</th><th style="text-align:right;padding:4px 8px">Total</th></tr></thead><tbody>'+
        lista.map(function(m){return'<tr style="border-top:1px solid var(--border);font-size:13px"><td style="padding:4px 8px;font-weight:700">'+esc(m.nombre)+'</td><td style="text-align:right;padding:4px 8px">'+m.count+'</td><td style="text-align:right;padding:4px 8px;color:var(--primary);font-weight:700">'+money(m.total)+'</td></tr>'}).join("")+'</tbody></table>';
    } else if(tipo==="pago"){
      var pagos = {};
      orders.forEach(function(o){
        var p = o.payment||"Otro";
        if(!pagos[p]) pagos[p]={nombre:p,count:0,total:0};
        pagos[p].count++; pagos[p].total+=(o.total||0);
      });
      var lista = Object.values(pagos).sort(function(a,b){return b.total-a.total});
      html='<table style="width:100%;border-collapse:collapse"><thead><tr style="font-size:11px;color:var(--muted)"><th style="text-align:left;padding:4px 8px">Método</th><th style="text-align:right;padding:4px 8px">Pedidos</th><th style="text-align:right;padding:4px 8px">Total</th></tr></thead><tbody>'+
        lista.map(function(p){return'<tr style="border-top:1px solid var(--border);font-size:13px"><td style="padding:4px 8px;font-weight:700">'+esc(p.nombre)+'</td><td style="text-align:right;padding:4px 8px">'+p.count+'</td><td style="text-align:right;padding:4px 8px;color:var(--primary);font-weight:700">'+money(p.total)+'</td></tr>'}).join("")+'</tbody></table>';
    }
    $("reporteAvanzadoContent").innerHTML = html;
  }).catch(function(){$("reporteAvanzadoContent").innerHTML='<div class="empty">Error al cargar</div>'});
}
/* Auto-init */
/* Caja simplificada: resumen, conteo y cierre en un solo recorrido. */
function renderCajaAbierta(body, skipRecalc){
  if(!skipRecalc) calcularVentas(function(){if(state.turno&&!$("cajaModal").classList.contains("hidden"))renderCajaAbierta(body,true)});
  var t=state.turno,de=JSON.parse(localStorage.getItem("turnoData_"+t.abierto_en)||"{}"),movs=de.movs||[],v=de.ventas||{efectivo:0,tarjeta:0,transferencia:0,apps:0,total:0};
  var ini=t.efectivo_inicial||0,ent=movs.filter(function(m){return m.tipo==="entrada"}).reduce(function(a,m){return a+m.monto},0),sal=movs.filter(function(m){return m.tipo==="salida"}).reduce(function(a,m){return a+m.monto},0),esperado=ini+v.efectivo+ent-sal;
  body.innerHTML='<div class="caja-hero"><div><span class="caja-live"><i></i> Caja abierta</span><h3>'+esc(t.usuario_nombre)+'</h3><p>Desde '+fmtTime(t.abierto_en)+' · '+(de.pedidosCount||0)+' cuentas cobradas</p></div><div class="caja-hero-total"><small>Ventas del turno</small><strong>'+money(v.total)+'</strong></div></div>'+
  '<div class="caja-method-grid"><div class="caja-method efectivo"><span>💵 Efectivo</span><strong>'+money(v.efectivo)+'</strong></div><div class="caja-method tarjeta"><span>💳 Tarjeta</span><strong>'+money(v.tarjeta)+'</strong></div><div class="caja-method transferencia"><span>🏦 Transferencia</span><strong>'+money(v.transferencia)+'</strong></div><div class="caja-method apps"><span>📱 Apps / otros</span><strong>'+money(v.apps)+'</strong></div></div>'+
  '<div class="caja-cash-card"><div><small>EFECTIVO QUE DEBE HABER</small><strong>'+money(esperado)+'</strong></div><button class="caja-link" onclick="this.parentElement.classList.toggle(\'open\')">Ver cálculo</button><div class="caja-cash-detail"><span>Fondo inicial <b>'+money(ini)+'</b></span><span>+ Ventas <b>'+money(v.efectivo)+'</b></span><span>+ Entradas <b>'+money(ent)+'</b></span><span>− Salidas <b>'+money(sal)+'</b></span></div></div>'+
  '<div class="tipos-corte"><button class="corte-tipo x" onclick="hacerCorteX()"><b>CORTE X</b><span>Reporte del turno</span><small>No cierra la caja</small></button><button class="corte-tipo z" onclick="hacerCorteZ()"><b>CORTE Z</b><span>Reporte de todo el día</span><small>Todos los turnos</small></button><button class="corte-tipo cerrar" onclick="renderCierre()"><b>CERRAR TURNO</b><span>Contar y cerrar caja</span><small>Imprime al terminar</small></button><button class="corte-tipo diario" onclick="hacerCierreDiario()"><b>CIERRE DIARIO</b><span>Validar el día</span><small>Revisa cuentas y turnos</small></button></div><div class="caja-secondary"><button onclick="abrirMovimiento()">💰 Entrada / salida</button><button onclick="recalcularCaja()">↻ Actualizar</button><button onclick="renderHistorial()">📋 Historial</button></div>'+
  (movs.length?'<details class="caja-movs"><summary>Últimos movimientos ('+movs.length+')</summary>'+movs.slice(-5).reverse().map(function(m){return '<div><span>'+(m.tipo==='entrada'?'+':'−')+money(m.monto)+' · '+esc(m.concepto)+'</span><time>'+new Date(m.fecha).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})+'</time></div>'}).join('')+'</details>':'');
}
function arqueoInput(id,icono,nombre,ayuda,esperado){return '<label class="arqueo-item"><span class="arqueo-icon">'+icono+'</span><span class="arqueo-name"><strong>'+nombre+'</strong><small>'+ayuda+' · Sistema: '+money(esperado)+'</small></span><span class="arqueo-money">$ <input type="number" id="'+id+'" value="" min="0" step="0.01" inputmode="decimal" placeholder="0" oninput="sumarCorteCiego()"></span><em id="dif'+id+'"></em></label>'}
function renderFormularioCierre(t,de){
  var v=de.ventas||{efectivo:0,tarjeta:0,transferencia:0,apps:0,total:0},pedidos=de.pedidosCount||0,body=$("cajaBody");
  if(pedidos===0&&v.total===0){body.innerHTML='<div class="caja-empty"><b>Sin cuentas cobradas</b><p>Primero cobra al menos una cuenta de este turno.</p><button class="btn ghost" onclick="renderCaja()">Volver a caja</button></div>';return}
  body.innerHTML='<div class="cierre-head"><button onclick="renderCaja()">←</button><div><h3>Cerrar caja</h3><p>'+esc(t.usuario_nombre)+' · '+pedidos+' cuentas · '+money(v.total)+' vendidos</p></div></div><div class="cierre-guide"><b>1</b><span><strong>Cuenta lo que recibiste</strong><small>Escribe cada total. El sistema compara por ti.</small></span></div><div class="arqueo-list">'+arqueoInput('ciEfectivo','💵','Efectivo','Dinero físico en caja',v.efectivo)+arqueoInput('ciTarjeta','💳','Tarjeta','Total de la terminal',v.tarjeta)+arqueoInput('ciTransferencia','🏦','Transferencia','Depósitos recibidos',v.transferencia)+arqueoInput('ciApps','📱','Apps / otros','DIDI, Uber, Rappi y otros',v.apps)+'</div><div class="arqueo-result" id="arqueoResult"><span>Total capturado</span><strong id="ciTotal">$0</strong><small>Captura los métodos para ver el resultado.</small></div><div class="frow cierre-notas"><label>Nota del cierre <span>(opcional)</span></label><input type="text" id="tmNotas" placeholder="Ej. falta comprobar una transferencia"></div><div class="cierre-actions"><button class="btn ghost" onclick="renderCaja()">Volver</button><button class="btn btn-primary" onclick="confirmarCierreCiego()">Revisar y cerrar →</button></div>';
  sumarCorteCiego();
}
function sumarCorteCiego(){
  var ids=['ciEfectivo','ciTarjeta','ciTransferencia','ciApps'],vals=ids.map(function(id){return parseFloat(($(id)||{}).value)||0}),tot=vals.reduce(function(a,n){return a+n},0),el=$("ciTotal");if(el)el.textContent=money(tot);if(!state.turno)return;
  var de=JSON.parse(localStorage.getItem("turnoData_"+state.turno.abierto_en)||"{}"),v=de.ventas||{efectivo:0,tarjeta:0,transferencia:0,apps:0,total:0},esp=[v.efectivo,v.tarjeta,v.transferencia,v.apps];
  ids.forEach(function(id,i){var d=vals[i]-esp[i],n=$("dif"+id);if(n){n.textContent=d===0?'✓ Coincide':(d>0?'+':'')+money(d);n.className=d===0?'ok':d>0?'plus':'minus'}});
  var diff=tot-v.total,r=$("arqueoResult");if(r){r.className='arqueo-result '+(diff===0?'ok':diff>0?'plus':'minus');var s=r.querySelector('small');if(s)s.textContent=diff===0?'✓ Todo coincide. Ya puedes cerrar.':diff>0?'Hay un sobrante de '+money(diff):'Hay un faltante de '+money(-diff)}
}

function datosCorte(tipo,v,extra){var t=state.turno||{},de=t.abierto_en?JSON.parse(localStorage.getItem("turnoData_"+t.abierto_en)||"{}"):{};return Object.assign({tipo:tipo,marca:BRAND.marca||"sakura",negocio:BRAND.business||"Sakura Sushi",fecha:new Date().toISOString(),usuario:t.usuario_nombre||"Administrador",abierto_en:t.abierto_en||"",pedidos:de.pedidosCount||0,ventas:v||de.ventas||{efectivo:0,tarjeta:0,transferencia:0,apps:0,total:0},movimientos:de.movs||[],efectivo_inicial:t.efectivo_inicial||0},extra||{})}
function imprimirCorte(data,done){var xhr=new XMLHttpRequest();xhr.open("POST","http://"+PRINT_HOST+":5100/corte",true);xhr.setRequestHeader("Content-Type","application/json");xhr.timeout=6000;xhr.onload=function(){if(xhr.status===200){toast(data.tipo+" impreso");if(done)done(true)}else{toast("No se pudo imprimir "+data.tipo);if(done)done(false)}};xhr.onerror=function(){toast("Impresora no disponible. Abre el receptor de impresión");if(done)done(false)};xhr.ontimeout=function(){toast("La impresora tardó demasiado");if(done)done(false)};xhr.send(JSON.stringify(data))}
function hacerCorteX(){if(!state.turno){toast("Primero abre una caja");return}calcularVentas(function(){var de=JSON.parse(localStorage.getItem("turnoData_"+state.turno.abierto_en)||"{}");imprimirCorte(datosCorte("CORTE X",de.ventas))})}
function resumenDia(done){var ini=new Date();ini.setHours(0,0,0,0);apiGet("orders?select=payment,total,created_at,notes,status&marca=eq."+encodeURIComponent(BRAND.marca||"")+"&status=eq.cobrado&order=created_at.desc&limit=1000").then(function(rows){rows=rows.filter(function(o){return fechaCobro(o)>=ini});var v={efectivo:0,tarjeta:0,transferencia:0,apps:0,online:0,total:0};rows.forEach(function(o){var p=(o.payment||"").toLowerCase(),n=o.total||0;v.total+=n;if(p.includes("online")){v.online+=n}else if(p.includes("efect")){v.efectivo+=n}else if(p.includes("tarj")){v.tarjeta+=n}else if(p.includes("transf")){v.transferencia+=n}else{v.apps+=n}});done(v,rows,ini)}).catch(function(){toast("No se pudo calcular el día")})}
function hacerCorteZ(){resumenDia(function(v,rows,ini){imprimirCorte(datosCorte("CORTE Z",v,{pedidos:rows.length,desde:ini.toISOString()}))})}
function hacerCierreDiario(){var pendientes=state.orders.filter(function(o){return o.status!=="cobrado"&&o.status!=="archivado"&&o.status!=="cancelado"}).length;if(state.turno){toast("Primero cierra el turno abierto");return}if(pendientes){toast("Faltan "+pendientes+" cuentas por cobrar o cancelar");return}resumenDia(function(v,rows,ini){imprimirCorte(datosCorte("CIERRE DIARIO",v,{pedidos:rows.length,desde:ini.toISOString(),validado:true}))})}

/* Apertura robusta: crea un turno nuevo y recupera uno abierto si ya existe. */
function abrirTurno(){
  var campo=$("tmEfectivoIni"),ini=parseFloat(campo&&campo.value)||0,raw=localStorage.getItem(SESSION),user=raw?JSON.parse(raw):null;
  if(!user){toast("Vuelve a iniciar sesión");return}
  if(state.turno){toast("Ya existe una caja abierta");renderCaja();return}
  var btn=campo&&campo.closest(".modal-body")?campo.closest(".modal-body").querySelector(".btn-primary"):null;if(btn){btn.disabled=true;btn.textContent="Abriendo caja..."}
  checkTurno().then(function(existente){
    if(existente){state.turno=existente;toast("Se recuperó la caja que ya estaba abierta");$("turnoBadge").textContent="🟢 Caja abierta";renderCaja();return}
    return new Promise(function(resolve,reject){
      var ahora=new Date().toISOString(),xhr=new XMLHttpRequest();xhr.open("POST",SUPABASE_URL+"/rest/v1/turnos",true);xhr.setRequestHeader("Content-Type","application/json");xhr.setRequestHeader("Prefer","return=representation");xhr.setRequestHeader("apikey",SUPABASE_KEY);xhr.setRequestHeader("Authorization","Bearer "+SUPABASE_KEY);xhr.timeout=8000;
      xhr.onload=function(){if(xhr.status>=200&&xhr.status<300){var rows=JSON.parse(xhr.responseText||"[]");resolve(rows[0]||{marca:BRAND.marca||"sakura",usuario_id:user.username,usuario_nombre:user.nombre,abierto_en:ahora,efectivo_inicial:ini,estado:"abierto"})}else reject(new Error("HTTP "+xhr.status))};xhr.onerror=function(){reject(new Error("Sin conexión"))};xhr.ontimeout=function(){reject(new Error("Tiempo agotado"))};
      xhr.send(JSON.stringify({marca:BRAND.marca||"sakura",usuario_id:user.username,usuario_nombre:user.nombre,abierto_en:ahora,efectivo_inicial:ini,efectivo_final:0,estado:"abierto",cerrado_en:null}));
    }).then(function(t){state.turno=t;localStorage.setItem("turnoData_"+t.abierto_en,JSON.stringify({movs:[],ventas:{efectivo:0,tarjeta:0,transferencia:0,apps:0,online:0,total:0},pedidosCount:0}));$("turnoBadge").textContent="🟢 Caja abierta";toast("Caja abierta con "+money(ini));renderCaja()});
  }).catch(function(err){toast("No se pudo abrir caja: "+err.message)}).finally(function(){if(btn){btn.disabled=false;btn.textContent="🔓 Abrir turno"}});
}

try { if(localStorage.getItem(SESSION))initApp(); } catch(e) { var g = $("orders"); if(g) g.innerHTML = '<div class="empty-state"><span class="es-text" style="color:red">Error al iniciar: '+esc(e.message)+'</span><span class="es-sub">Recarga la pagina (F5)</span></div>'; }
