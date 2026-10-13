/* Fort Greene Park Gardens: the whole app. Data files load first (see index.html). */
(function(){
'use strict';
var DATA=window.FGP_DATA, CFG=window.FGP_CONFIG||{};
var E=DATA.E, ALIAS=DATA.ALIAS, NYC=DATA.NYC, FIX=DATA.FIX;
var SHEET_ID=CFG.sheetId||'';
var SHEET_URL='https://docs.google.com/spreadsheets/d/'+SHEET_ID+'/edit';
var GUIDE_URL='https://www.nycgovparks.org/pagefiles/76/nrg-native-species-planting-guide-091714.pdf';
var MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
var MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var MLET=['J','F','M','A','M','J','J','A','S','O','N','D'];
var SEASONS=[{k:'sp',name:'Spring',short:'Spr',months:[3,4,5],range:'Mar–May'},{k:'su',name:'Summer',short:'Sum',months:[6,7,8],range:'Jun–Aug'},
  {k:'au',name:'Autumn',short:'Aut',months:[9,10,11],range:'Sep–Nov'},{k:'wi',name:'Winter',short:'Win',months:[12,1,2],range:'Dec–Feb'}];
var SRC_SEASON={spring:[3,4,5],summer:[6,7,8],fall:[9,10,11],autumn:[9,10,11],winter:[12,1,2]};
var KIND={f:'in bloom',s:'foliage, berries or stems',n:'nothing to see',u:'no season data'};
var NOW=new Date(), CUR=NOW.getMonth()+1;

/* ---------- small helpers ---------- */
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function slug(s){return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'x';}
function clean(s){return String(s==null?'':s).replace(/\s+/g,' ').trim();}
function plural(n,one,many){return n+' '+(n===1?one:(many||one+'s'));}
function seasonOf(m){for(var i=0;i<4;i++) if(SEASONS[i].months.indexOf(m)>=0) return SEASONS[i]; return SEASONS[0];}
function monthRanges(ms){ // [8,9,10] -> "Aug–Oct"; wraps over the year end
  if(!ms||!ms.length) return '';
  var set={}; ms.forEach(function(m){set[m]=1;});
  if(Object.keys(set).length===12) return 'All year';
  var start=1; for(var m=1;m<=12;m++){ var prev=m===1?12:m-1; if(set[m]&&!set[prev]){start=m;break;} }
  var out=[],i=0,cur=start;
  while(i<12){ if(set[cur]){ var a=cur,b=cur; while(i<11&&set[cur%12+1]){cur=cur%12+1;b=cur;i++;} out.push(a===b?MON[a-1]:MON[a-1]+'–'+MON[b-1]); } cur=cur%12+1;i++; }
  return out.join(', ');
}
function listNames(arr,max){ if(arr.length<=max) return arr.join(' · '); return arr.slice(0,max).join(' · ')+' · +'+(arr.length-max)+' more'; }
function ago(t){ var s=Math.max(0,(Date.now()-t)/1000); if(s<60) return 'just now'; var m=Math.round(s/60); if(m<60) return m+' min ago'; var h=Math.round(m/60); if(h<24) return h+' h ago'; return Math.round(h/24)+' d ago'; }
function parseWhen(t){ t=String(t||''); var m=t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/); if(m) return new Date(+m[3],+m[1]-1,+m[2],+(m[4]||0),+(m[5]||0)).getTime(); var d=Date.parse(t); return isNaN(d)?0:d; }
function noteWhen(n){ return n.createdAt?fmtDate(n.createdAt):(n.dateText||''); }
function store(k,v){ try{ if(v===undefined) return localStorage.getItem('fgp.'+k)||''; localStorage.setItem('fgp.'+k,v); }catch(e){ return ''; } }
function fmtDate(t){ var d=new Date(t); return isNaN(d)?'':d.getDate()+' '+MON[d.getMonth()]+' '+d.getFullYear(); }

/* ---------- reading the sheet ---------- */
function baseKey(latin){
  var s=clean(latin).replace(/[‘’“”"]/g,"'");
  s=s.split("'")[0].trim().replace(/\bvar\..*$/,'').replace(/\s+or\s+.*$/,'').trim();
  var w=s.split(' ').filter(Boolean).map(function(x){x=x.toLowerCase(); return FIX[x]||x;});
  if(!w.length) return '';
  if(w.length>=3&&(w[1]==='x'||w[1]==='×')) return w[0]+' x '+w[2];
  if(w.length>=2&&(w[1]==='x'||w[1]==='×')) return w[0];
  if(w.length===1||['spp.','spp','sp.','/'].indexOf(w[1])>=0) return w[0];
  if(w[0]==='azalea') return 'rhododendron';
  return w[0]+' '+w[1];
}
function findTab(tabs,test){ var k=Object.keys(tabs).filter(function(n){return test(n.toLowerCase());})[0]; return k?tabs[k]:null; }
function table(rows,headerTest){ // -> {cols:{name:index}, body:[rows]}
  if(!rows) return null;
  var h=-1; for(var i=0;i<Math.min(rows.length,8);i++){ if((rows[i]||[]).some(function(c){return headerTest.test(String(c||''));})){h=i;break;} }
  if(h<0) return null;
  var head=rows[h].map(function(c){return clean(c).toLowerCase();});
  return {head:head, body:rows.slice(h+1), col:function(re){ for(var i=0;i<head.length;i++) if(re.test(head[i])) return i; return -1; }};
}
function cell(r,i){ return i<0?'':clean(r[i]); }

function buildModel(tabs){
  var tp=table(findTab(tabs,function(n){return n.indexOf('intentional')>=0&&n.indexOf('unintentional')<0;})||tabs[Object.keys(tabs)[0]],/common name/i);
  if(!tp) throw new Error('layout');
  var c={common:tp.col(/common/),latin:tp.col(/latin/),type:tp.col(/^type/),loc:tp.col(/location/),intent:tp.col(/intentional/),notes:tp.col(/note/),source:tp.col(/source/),verified:tp.col(/verif/),cultivar:tp.col(/cultivar/)};
  if(c.common<0) throw new Error('layout');
  var plants=[],gardens={},ids={};
  tp.body.forEach(function(r){
    var common=cell(r,c.common); if(!common) return;
    var latin=cell(r,c.latin), key=baseKey(latin);
    if(!key&&/^yellowwood/i.test(common)) key='cladrastis kentukea';
    var ekey=Object.prototype.hasOwnProperty.call(ALIAS,key)?ALIAS[key]:key;
    var e=ekey&&E[ekey]?E[ekey]:null;
    var id=slug(common), base=id, n=2; while(ids[id]) id=base+'-'+(n++); ids[id]=1;
    var note=cell(r,c.notes), intent=cell(r,c.intent);
    var locs=[]; cell(r,c.loc).split(',').forEach(function(x){x=clean(x); if(x&&locs.indexOf(x)<0) locs.push(x);});
    var ym=note.match(/plan(?:t)?ed[^0-9]{0,24}((?:19|20)\d{2})/i);
    var p={id:id,common:common,latin:latin,key:key,ekey:ekey,e:e,aliased:!!(e&&ekey!==key&&!(key==='osmunda cinnamomea')),
      sheetType:cell(r,c.type),intent:intent,note:note,source:cell(r,c.source),verified:/^(true|yes|y|x|1)$/i.test(cell(r,c.verified)),cultivar:cell(r,c.cultivar),
      year:ym?ym[1]:'',gardens:[],locs:locs};
    p.type=simpleType(p);
    p.nyc=NYC[key]||null;
    p.na=!p.nyc&&e&&!p.aliased&&/^[a-z-]+ [a-z-]+$/.test(key)&&/north america|united states|u\.s\.a|\bus\b|\busa\b|canada|appalachian|nova scotia|ontario|rocky mountains/i.test(e.origin)&&!/europe|asia|cultivar|hybrid|hemisphere/i.test(e.origin);
    p.int=interestOf(e);
    p.dispute=/dispute|tbd/i.test(intent);
    p.check=p.dispute||/verif|confirm|still there|still have|do we (still )?have|don'?t (think|have)|not sure|need to id|maybe|is this true|\?/i.test(note);
    p.fail=null;
    plants.push(p);
    locs.forEach(function(name){ var gid=slug(name); if(!gardens[gid]) gardens[gid]={id:gid,name:name,plants:[],cond:null}; gardens[gid].plants.push(p); p.gardens.push(gardens[gid]); });
  });
  if(!plants.length) throw new Error('layout');
  var glist=Object.keys(gardens).map(function(k){return gardens[k];}).sort(function(a,b){return a.name.localeCompare(b.name);});

  // optional Gardens tab: name, type, soil, light, moisture, risk
  var tg=table(findTab(tabs,function(n){return /^gardens?$/.test(n.trim());}),/^(name|garden)/i), hasCond=false;
  if(tg){ var gc={name:tg.col(/^(name|garden)/),type:tg.col(/^type/),soil:tg.col(/soil/),light:tg.col(/light/),moist:tg.col(/moist/),risk:tg.col(/risk/)};
    tg.body.forEach(function(r){ var nm=cell(r,gc.name); if(!nm) return; var gid=slug(nm); if(!gardens[gid]){gardens[gid]={id:gid,name:nm,plants:[],cond:null}; glist.push(gardens[gid]);}
      var cd={type:cell(r,gc.type),soil:cell(r,gc.soil),light:cell(r,gc.light),moist:cell(r,gc.moist),risk:cell(r,gc.risk)};
      if(cd.type||cd.soil||cd.light||cd.moist||cd.risk){gardens[gid].cond=cd;hasCond=true;} });
    glist.sort(function(a,b){return a.name.localeCompare(b.name);});
  }

  // gardens drawn on the park map: number them, and add any the sheet has no plants for
  (DATA.MAP.g||[]).forEach(function(mg){ if(!mg.id) return;
    if(!gardens[mg.id]){ gardens[mg.id]={id:mg.id,name:mg.name,plants:[],cond:null}; glist.push(gardens[mg.id]); }
    gardens[mg.id].num=mg.n; });
  glist.sort(function(a,b){return a.name.localeCompare(b.name);});

  // high failure rate tab
  var failures=[], tf=table(findTab(tabs,function(n){return n.indexOf('fail')>=0;}),/plant/i);
  if(tf){ tf.body.forEach(function(r){ var txt=clean(r[0]), why=clean(r[1]); if(!txt) return;
    var toks=txt.toLowerCase().replace(/[^a-z ]+/g,' ').split(' ').filter(function(w){return w.length>2&&['and','many','varieties','variety','the'].indexOf(w)<0;})
      .map(function(w){w=FIX[w]||w; return w.length>5&&/s$/.test(w)&&!/(is|us|ss)$/.test(w)?w.slice(0,-1):w;});
    var hit=plants.filter(function(p){ var kw=p.key.split(' '), genus=kw[0], sp=kw[1]||'';
      if(genus&&toks[0]===genus&&(toks.length===1||(sp&&toks.indexOf(sp)>0))) return true;
      var hay=(p.common+' '+p.latin).toLowerCase().replace(/-/g,' ');
      return toks.length>1&&toks.every(function(t){return hay.indexOf(t)>=0;}); });
    hit.forEach(function(p){p.fail={why:why,row:txt};});
    failures.push({text:txt,why:why,plants:hit}); }); }

  // reference lists
  function refList(test,headRe){ var t=table(findTab(tabs,test),headRe), out=[]; if(!t) return out;
    var k={common:t.col(/common/),latin:t.col(/latin/),cult:t.col(/cultivar/),loc:t.col(/location/),intent:t.col(/intentional/),notes:t.col(/note/)};
    t.body.forEach(function(r){ var common=cell(r,k.common), latin=cell(r,k.latin); if(!common||(!latin&&r.filter(function(x){return clean(x);}).length<2)) return;
      var key=baseKey(latin); out.push({common:common,latin:latin,cultivar:cell(r,k.cult),loc:cell(r,k.loc),intent:cell(r,k.intent),note:cell(r,k.notes),nyc:NYC[key]||null}); });
    return out; }
  var trees=refList(function(n){return n.indexOf('tree')>=0;},/common name/i);
  var weeds=refList(function(n){return n.indexOf('unintentional')>=0;},/common name/i);

  glist.forEach(function(g){
    g.plants.sort(function(a,b){return a.common.localeCompare(b.common);});
    g.cells=[]; g.by=[];
    for(var m=1;m<=12;m++){ var f=[],s=[];
      g.plants.forEach(function(p){ if(!p.int) return; var k=p.int.cells[m-1]; if(k==='f') f.push(p); else if(k==='s') s.push(p); });
      g.cells.push(f.length?'f':s.length?'s':'n'); g.by.push({f:f,s:s}); }
    g.known=g.plants.filter(function(p){return p.int;}).length;
    if(!g.known) g.cells=g.cells.map(function(){return 'u';});
    g.gaps=SEASONS.filter(function(se){return g.known&&se.months.every(function(m){return g.cells[m-1]==='n';});});
    g.nyc=g.plants.filter(function(p){return p.nyc;}).length;
  });
  // Notes tab: Date | Garden | Note | Author
  var notes=[], tn=table(findTab(tabs,function(n){return n.trim()==='notes';}),/^(note|text)/i);
  if(tn){ var nc={date:tn.col(/date|when/),garden:tn.col(/garden/),text:tn.col(/^(note|text)/),author:tn.col(/author|who|name/)};
    tn.body.forEach(function(r,i){ var text=cell(r,nc.text), gname=cell(r,nc.garden); if(!text||!gname) return; var dt=cell(r,nc.date);
      notes.push({id:'row'+i,gardenId:slug(gname),gardenName:gname,text:text,author:cell(r,nc.author),dateText:dt,createdAt:parseWhen(dt)}); });
    notes.sort(function(a,b){return a.createdAt-b.createdAt;}); }
  var byId={}; plants.forEach(function(p){byId[p.id]=p;});
  var species={}; plants.forEach(function(p){ if(p.key) species[p.key]=1; });
  return {notes:notes,plants:plants,gardens:glist,gById:gardens,pById:byId,failures:failures,trees:trees,weeds:weeds,hasCond:hasCond,species:Object.keys(species).length};
}
function simpleType(p){
  var t=p.sheetType; if(/tree/i.test(t)) return 'Tree'; if(t) return t;
  var et=p.e?p.e.type:''; if(!et) return '';
  if(/fern/i.test(et)) return 'Fern'; if(/grass|sedge/i.test(et)) return 'Grass'; if(/bulb/i.test(et)) return 'Bulb';
  if(/shrub/i.test(et)) return 'Shrub'; if(/tree/i.test(et)) return 'Tree'; if(/vine/i.test(et)) return 'Vine'; if(/annual/i.test(et)&&!/perennial/i.test(et)) return 'Annual'; if(/perennial/i.test(et)) return 'Perennial'; return '';
}
function interestOf(e){
  if(!e) return null;
  var bm=e.m, approx=false;
  if(!bm&&e.b&&e.b.length){ bm=[]; approx=true; e.b.forEach(function(s){ (SRC_SEASON[s.toLowerCase()]||[]).forEach(function(m){bm.push(m);}); }); }
  if((!bm||!bm.length)&&!(e.o&&e.o.length)) return null;
  var cells=[],why=[]; for(var i=0;i<12;i++){cells.push('n');why.push([]);}
  (bm||[]).forEach(function(m){cells[m-1]='f';why[m-1].push('in bloom');});
  (e.o||[]).forEach(function(it){ it[0].forEach(function(m){ if(cells[m-1]!=='f') cells[m-1]='s'; why[m-1].push(it[1]); }); });
  return {cells:cells,why:why,bloom:bm||[],approx:approx};
}
function seasonKinds(cells){ return SEASONS.map(function(se){ var ks=se.months.map(function(m){return cells[m-1];}); return ks.indexOf('f')>=0?'f':ks.indexOf('s')>=0?'s':ks.indexOf('u')>=0?'u':'n'; }); }

/* ---------- state ---------- */
var S={ model:null, route:{name:'dash'}, q:'', ddIndex:-1,
  gf:{gap:'',noNotes:false,noPlants:false,sort:'name',dir:1}, pf:{list:'garden',native:'',type:'',flags:{},q:'',sort:'name',dir:1}, sf:{month:CUR,sort:'name'}, mf:{layer:'interest',sel:''},
  sync:{mode:'snap',at:Date.parse(DATA.SNAP.takenAt),msg:'',busy:false}, notes:[], pending:[], notesState:'ready', drafts:{}, noteMsg:'' };
try{ S.model=buildModel(DATA.SNAP.tabs); }catch(err){ S.model={notes:[],plants:[],gardens:[],gById:{},pById:{},failures:[],trees:[],weeds:[],hasCond:false,species:0}; }
var M=function(){return S.model;};
function mergeNotes(){ var have={}; S.model.notes.forEach(function(n){have[n.gardenId+'|'+n.text]=1;}); S.pending=S.pending.filter(function(n){return !have[n.gardenId+'|'+n.text];}); S.notes=S.model.notes.concat(S.pending); }
mergeNotes();
function notesFor(gid){ return S.notes.filter(function(n){return n.gardenId===gid;}); }

/* ---------- pieces ---------- */
function strip(cells,labels,tall){
  var aria=cells.map(function(k,i){return MON[i]+' '+KIND[k];}).join(', ');
  return '<span class="strip'+(tall?' tall':'')+'" role="img" aria-label="'+esc(aria)+'">'+cells.map(function(k,i){
    return '<i class="'+k+'" title="'+esc(MON[i]+': '+(labels&&labels[i]?labels[i]:KIND[k]))+'"></i>';}).join('')+'</span>';
}
function gardenLabels(g){ return g.by.map(function(b,i){ if(g.cells[i]==='u') return KIND.u; if(b.f.length) return 'in bloom — '+listNames(b.f.map(function(p){return p.common;}),4); if(b.s.length) return listNames(b.s.map(function(p){return p.common;}),4); return KIND.n; }); }
function plantLabels(p){ return p.int.why.map(function(w,i){ return w.length?w.join('; '):KIND.n; }); }
function legend(extra){ return '<div class="legend"><span><i class="f"></i>In bloom</span><span><i class="s"></i>Foliage, berries, stems</span><span><i class="n"></i>Nothing to see</span>'+(extra?'<span><i class="u"></i>No season data</span>':'')+'</div>'; }
function nativePills(p,big){ var c=big?' big':''; return (p.nyc?'<span class="pill good'+c+'" title="Listed in the NYC Parks Native Species Planting Guide">NYC native</span>':'')+(p.na?'<span class="pill good'+c+'" title="Native range per the plant profile: '+esc(p.e.origin)+'">N. American</span>':''); }
function flagPills(p){ var h=''; if(p.fail) h+='<span class="pill bad" title="'+esc(p.fail.why)+'">High failure rate</span>'; if(p.check) h+='<span class="pill amber" title="'+esc(p.note||p.intent)+'">Needs checking</span>'; if(!p.gardens.length) h+='<span class="pill">No garden recorded</span>'; return h; }
function seasonPills(p){ if(!p.int) return '<span class="hint">No season data yet</span>'; var ks=seasonKinds(p.int.cells);
  return '<span class="pills">'+SEASONS.map(function(se,i){ var k=ks[i]; return '<span class="pill '+(k==='f'?'good':k==='s'?'':'off')+'" title="'+esc(se.name+': '+KIND[k])+'">'+se.short+'</span>'; }).join('')+'</span>'; }
function ext(url,label){ return '<a href="'+esc(url)+'" target="_blank" rel="noopener">'+esc(label)+' ↗</a>'; }
function goA(tok,html,cls){ return '<a href="#'+tok+'" data-go="'+tok+'"'+(cls?' class="'+cls+'"':'')+'>'+html+'</a>'; }
function sourceName(e){ return e.src==='wiki'?'Wikipedia':'NC State Extension Plant Toolbox'; }

/* ---------- views ---------- */
function vDash(){
  var m=M(), G=m.gardens, total=G.length, cov=[];
  for(var i=0;i<12;i++) cov.push(G.filter(function(g){return g.cells[i]==='f'||g.cells[i]==='s';}).length);
  var blo=[]; for(i=0;i<12;i++) blo.push(G.filter(function(g){return g.cells[i]==='f';}).length);
  var se=seasonOf(CUR), max=Math.max(total,1);
  var minB=Math.min.apply(null,blo), lowB=[]; blo.forEach(function(v,i){ if(v===minB) lowB.push(i+1); });
  var non=[]; for(i=0;i<12;i++) non.push(G.filter(function(g){return g.cells[i]==='n';}).length);
  var maxN=Math.max.apply(null,non), lowM=[]; non.forEach(function(v,i){ if(v===maxN) lowM.push(i+1); });
  var thin=total?'Fewest gardens in bloom in '+monthRanges(lowB)+' ('+minB+' of '+total+').'+(maxN>0?' Most gardens with nothing at all to see: '+maxN+' in '+monthRanges(lowM)+'.':''):'';
  var noNotes=S.notesState==='ready'?G.filter(function(g){return !notesFor(g.id).length;}).length:null;
  var bloomG=G.map(function(g){return {g:g,f:g.by[CUR-1].f};}).filter(function(x){return x.f.length;}).sort(function(a,b){return b.f.length-a.f.length||a.g.name.localeCompare(b.g.name);});
  var h='<div class="head"><div><div class="eyebrow">'+esc(['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][NOW.getDay()]+' '+NOW.getDate()+' '+MONTHS[CUR-1]+' '+NOW.getFullYear())+'</div><h1>The gardens in '+se.name.toLowerCase()+'</h1></div></div>';
  h+='<div class="grid stats">'
    +'<a class="stat" href="#gardens" data-go="gardens"><b class="num">'+total+'</b><span>gardens</span></a>'
    +'<a class="stat" href="#plants" data-go="plants"><b class="num">'+m.plants.length+'</b><span>plant records · '+m.species+' species and hybrids</span></a>'
    +'<a class="stat" href="#seasons.'+CUR+'" data-go="seasons.'+CUR+'"><b class="num">'+blo[CUR-1]+'</b><span>gardens with something to see in '+MONTHS[CUR-1]+'</span></a>'
    +'</div>';
  h+='<div class="grid two"><section class="card"><div class="cardhead"><h2>Seasonal interest across the park</h2><span class="hint">of '+total+' gardens · click a month</span></div>'
    +'<div class="bars">'+cov.map(function(v,i){ var f=blo[i], o=v-f;
      return '<a class="bar'+(i+1===CUR?' cur':'')+'" href="#seasons.'+(i+1)+'" data-go="seasons.'+(i+1)+'" title="'+esc(MONTHS[i]+': '+f+' in bloom, '+o+' with foliage, berries or stems only, '+non[i]+' with nothing to see')+'"><span class="num">'+f+'</span><span class="col"><i class="seg s" style="height:'+(o/max*100).toFixed(1)+'%"></i><i class="seg f" style="height:'+(f/max*100).toFixed(1)+'%"></i></span></a>'; }).join('')+'</div>'
    +'<div class="barlabels">'+MON.map(function(x,i){return '<span'+(i+1===CUR?' class="cur"':'')+'>'+x+'</span>';}).join('')+'</div>'
    +'<div class="legend"><span><i class="f"></i>Gardens in bloom (number shown)</span><span><i class="s"></i>Foliage, berries or stems only</span></div><p class="warn" style="margin:12px 0 0;font-size:14px">'+esc(thin)+'</p></section>';
  h+='<section class="card"><div class="cardhead"><h2>In bloom · '+MONTHS[CUR-1]+'</h2><span class="hint">'+plural(bloomG.length,'garden')+'</span></div><div class="rows">'
    +(bloomG.length?bloomG.slice(0,6).map(function(x){ return goA('g.'+x.g.id,'<b>'+esc(x.g.name)+'</b><span class="r">'+esc(listNames(x.f.map(function(p){return p.common;}),2))+'</span>','row'); }).join(''):'<div class="empty">Nothing recorded as in bloom this month.</div>')
    +'</div>'+(bloomG.length>6?'<p style="margin:10px 0 0;font-size:14px">'+goA('seasons.'+CUR,'See all '+bloomG.length+' gardens')+'</p>':'')+'</section></div>';
  // high failure rate
  h+='<div class="grid two"><section class="card"><div class="cardhead"><h2>High failure rate</h2><span class="hint">from the sheet’s “High failure rate plants” tab</span></div>';
  if(m.failures.length){ h+='<div class="scroll"><table class="t tight"><thead><tr><th>As recorded</th><th>On the plant list</th><th>Recorded reason</th></tr></thead><tbody>';
    m.failures.forEach(function(f){ h+='<tr><td><span class="nm">'+esc(f.text)+'</span></td><td>'+(f.plants.length?f.plants.map(function(p){ return goA('p.'+p.id,esc(p.common),'ul')+' <span class="hint num" title="'+esc(p.gardens.map(function(g){return g.name;}).join(' · ')||'No garden recorded')+'">('+p.gardens.length+')</span>'; }).join('<br>'):'<span class="dash">not on the plant list</span>')+'</td><td>'+esc(f.why)+'</td></tr>'; });
    h+='</tbody></table></div><p class="hint" style="margin:10px 0 0">The number after each plant is how many gardens it is recorded in.</p>'; } else h+='<div class="empty">No high-failure plants are listed in the sheet.</div>';
  h+='</section>';
  var P=m.plants, cnt=function(fn){return P.filter(fn).length;};
  var gaps=[['Verified in the field',cnt(function(p){return p.verified;})+' of '+P.length,'plants','unverified',cnt(function(p){return !p.verified;})>0],
    ['Flagged for checking in the sheet notes',cnt(function(p){return p.check;}),'plants','check',true],
    ['Plants with no garden recorded',cnt(function(p){return !p.gardens.length;}),'plants','nogarden',true],
    ['Plants with no season data yet',cnt(function(p){return !p.int;}),'plants','nodata',true],
    ['Gardens with a whole season of nothing to see',G.filter(function(g){return g.gaps.length;}).length,'gardens','gap',true],
    ['Gardens on the map with no plants recorded',G.filter(function(g){return !g.plants.length;}).length,'gardens','noplants',true]];
  h+='<div class="stack"><section class="card"><div class="cardhead"><h2>Gaps in the record</h2><span class="hint">what the next person would have to guess</span></div><div class="rows">'
    +gaps.map(function(r){ return '<a class="row" href="#'+r[2]+'" data-go="'+r[2]+'" data-set="'+r[3]+'"><b>'+esc(r[0])+'</b><span class="r num'+(r[4]&&r[1]!==0?' warn':'')+'">'+esc(r[1])+'</span></a>'; }).join('')+'</div></section>';
  var nNyc=cnt(function(p){return p.nyc;}), nNa=cnt(function(p){return p.na;}), tc={}; P.forEach(function(p){ var t=p.type||'Not recorded'; tc[t]=(tc[t]||0)+1; });
  var toneSets=[['var(--bloom)','var(--foliage)','var(--nodata)'],['var(--bloom)','var(--foliage)','var(--clay-bar)','var(--nodata)','var(--border-strong)','var(--ink)']];
  var comp=[{label:'By origin',parts:[['NYC native',nNyc,'nyc'],['Other N. American',nNa,'na'],['Elsewhere or not known',P.length-nNyc-nNa,'']]},
    {label:'By type',parts:Object.keys(tc).sort(function(a,b){return tc[b]-tc[a];}).slice(0,6).map(function(t){return [t,tc[t],t==='Not recorded'?'':'type:'+t];})}];
  h+='<section class="card"><div class="cardhead"><h2>What is planted</h2><span class="hint">'+P.length+' plant records</span></div>'+comp.map(function(c,ci){ var tones=toneSets[ci];
      return '<div class="comp"><div class="hint">'+c.label+'</div><div class="stackbar">'+c.parts.map(function(x,i){return x[1]?'<span style="flex:'+x[1]+';background:'+tones[i]+'" title="'+esc(x[0]+': '+x[1])+'"></span>':'';}).join('')+'</div><div class="legend" style="margin-top:8px">'
        +c.parts.map(function(x,i){ var inner='<i style="background:'+tones[i]+';border-radius:50%;width:9px;height:9px"></i>'+esc(x[0])+' · <b class="num" style="font-weight:500">'+x[1]+'</b>'; return x[2]?'<a href="#plants" data-go="plants" data-set="'+esc(x[2])+'" style="display:flex;gap:6px;align-items:center;color:var(--ink)">'+inner+'</a>':'<span>'+inner+'</span>'; }).join('')+'</div></div>'; }).join('')+'</section></div></div>';
  return h;
}

function gardenRows(){
  var f=S.gf, G=M().gardens.slice();
  if(f.gap) G=G.filter(function(g){ return f.gap==='any'?g.gaps.length:g.gaps.some(function(s){return s.k===f.gap;}); });
  if(f.noNotes&&S.notesState==='ready') G=G.filter(function(g){return !notesFor(g.id).length;});
  if(f.noPlants) G=G.filter(function(g){return !g.plants.length;});
  var key={name:function(g){return g.name.toLowerCase();},plants:function(g){return g.plants.length;},nyc:function(g){return g.nyc;},gaps:function(g){return g.gaps.length;},notes:function(g){return notesFor(g.id).length;}}[f.sort];
  G.sort(function(a,b){ var x=key(a),y=key(b); return (x<y?-1:x>y?1:a.name.localeCompare(b.name))*f.dir; });
  return G;
}
function th(label,key,st,act){ var on=st.sort===key; return '<th'+(on?' aria-sort="'+(st.dir>0?'ascending':'descending')+'"':'')+'><button data-act="'+act+'" data-key="'+key+'">'+esc(label)+(on?(st.dir>0?' ↑':' ↓'):'')+'</button></th>'; }
function chip(label,act,val,on){ return '<button class="chip" aria-pressed="'+(on?'true':'false')+'" data-act="'+act+'" data-val="'+esc(val)+'">'+esc(label)+'</button>'; }
function vGardens(){
  var m=M(), f=S.gf, G=gardenRows(), c=m.hasCond;
  var h='<div class="head"><div><h1>Gardens</h1><div class="sub">Showing '+G.length+' of '+m.gardens.length+'</div></div>'+ext(SHEET_URL,'Edit in Google Sheet').replace('<a ','<a class="btn" ')+'</div>';
  h+='<div class="chips"><div class="chipgroup"><span>Nothing to see in</span>'+chip('All','ggap','',!f.gap)+chip('Any season','ggap','any',f.gap==='any')+SEASONS.map(function(s){return chip(s.name,'ggap',s.k,f.gap===s.k);}).join('')+'</div>'
    +'<div class="chipgroup">'+chip('No notes yet','gnotes','',f.noNotes)+chip('No plants recorded','gnoplants','',f.noPlants)+'</div></div>';
  h+='<div class="card flush"><div class="scroll"><table class="t" style="min-width:'+(c?980:760)+'px"><thead><tr>'+th('Garden','name',f,'gsort')
    +(c?'<th>Type</th><th>Soil</th><th>Light</th><th>Moisture</th><th>Risk</th>':'')+th('Plants','plants',f,'gsort')+th('NYC native','nyc',f,'gsort')+'<th>Interest, Jan → Dec</th>'+th('Season gaps','gaps',f,'gsort')+th('Notes','notes',f,'gsort')+'</tr></thead><tbody>';
  if(!G.length) h+='<tr><td colspan="'+(c?11:6)+'" class="empty">No gardens match these filters.</td></tr>';
  G.forEach(function(g){ var n=notesFor(g.id).length, cd=g.cond||{};
    h+='<tr data-go="g.'+g.id+'"><td>'+goA('g.'+g.id,esc(g.name),'nm')+'</td>'
      +(c?'<td>'+esc(cd.type||'')+'</td><td>'+esc(cd.soil||'')+'</td><td>'+esc(cd.light||'')+'</td><td>'+esc(cd.moist||'')+'</td><td class="warn">'+esc(cd.risk||'')+'</td>':'')
      +'<td class="num">'+g.plants.length+'</td><td class="num">'+g.nyc+'</td><td style="min-width:180px">'+strip(g.cells,gardenLabels(g))+'</td>'
      +'<td'+(g.gaps.length?' class="warn"':' class="dash"')+'>'+(g.gaps.length?esc(g.gaps.map(function(s){return s.name;}).join(', ')):'–')+'</td>'
      +'<td class="num'+(S.notesState==='ready'&&!n?' warn':'')+'">'+(S.notesState==='ready'?(n||'None'):'–')+'</td></tr>'; });
  h+='</tbody></table></div></div>';
  h+='<p class="hint" style="margin-top:12px">Interest runs January to December and comes from each plant’s profile.'+(c?'':' Soil, light, moisture and risk are not in the sheet yet: add a tab named “Gardens” with those columns and they will show here.')+'</p>'+legend(true);
  return h;
}

function plantRows(){
  var f=S.pf, P=M().plants.slice(), q=f.q.toLowerCase();
  if(f.native==='nyc') P=P.filter(function(p){return p.nyc;}); else if(f.native==='na') P=P.filter(function(p){return p.nyc||p.na;});
  if(f.type) P=P.filter(function(p){return p.type===f.type;});
  if(f.flags.fail) P=P.filter(function(p){return p.fail;});
  if(f.flags.check) P=P.filter(function(p){return p.check;});
  if(f.flags.nogarden) P=P.filter(function(p){return !p.gardens.length;});
  if(f.flags.nodata) P=P.filter(function(p){return !p.int;});
  if(f.flags.unverified) P=P.filter(function(p){return !p.verified;});
  if(q) P=P.filter(function(p){return (p.common+' '+p.latin).toLowerCase().indexOf(q)>=0;});
  var key={name:function(p){return p.common.toLowerCase();},type:function(p){return p.type||'~';},gardens:function(p){return p.gardens.length;}}[f.sort];
  P.sort(function(a,b){ var x=key(a),y=key(b); return (x<y?-1:x>y?1:a.common.localeCompare(b.common))*f.dir; });
  return P;
}
function plantTable(){
  var f=S.pf, m=M(), h='';
  if(f.list==='garden'){ var P=plantRows();
    h+='<table class="t" style="min-width:860px"><thead><tr>'+th('Plant','name',f,'psort')+th('Type','type',f,'psort')+th('Gardens','gardens',f,'psort')+'<th>Seasons of interest</th><th>On record</th></tr></thead><tbody>';
    if(!P.length) h+='<tr><td colspan="5" class="empty">No plants match. Clear a filter or the search box.</td></tr>';
    P.forEach(function(p){ h+='<tr data-go="p.'+p.id+'"><td>'+goA('p.'+p.id,esc(p.common),'nm')+'<span class="lt">'+esc(p.latin)+'</span></td>'
      +'<td><div class="pills" style="flex-direction:column;align-items:flex-start"><span'+(p.sheetType?'':' class="hint" title="From the plant profile; the sheet has no type"')+'>'+esc(p.type||'–')+'</span>'+nativePills(p)+'</div></td>'
      +'<td class="num">'+(p.gardens.length||'<span class="dash">–</span>')+'</td><td>'+seasonPills(p)+'</td>'
      +'<td><span class="pills">'+flagPills(p)+'</span>'+(p.note?'<span class="snip">'+esc(p.note.length>90?p.note.slice(0,88)+'…':p.note)+'</span>':'')+'</td></tr>'; });
    h+='</tbody></table>'; S._count=P.length+' of '+m.plants.length+' garden plants';
  } else { var L=f.list==='trees'?m.trees:m.weeds, q=f.q.toLowerCase(); if(q) L=L.filter(function(x){return (x.common+' '+x.latin).toLowerCase().indexOf(q)>=0;});
    var isT=f.list==='trees';
    h+='<table class="t" style="min-width:720px"><thead><tr><th>'+(isT?'Tree':'Plant')+'</th><th>'+(isT?'Cultivar':'Status')+'</th><th>'+(isT?'Where':'Notes')+'</th>'+(isT?'<th>Notes</th>':'')+'</tr></thead><tbody>';
    if(!L.length) h+='<tr><td colspan="4" class="empty">Nothing matches.</td></tr>';
    L.forEach(function(x){ var where=/^https?:\/\//i.test(x.loc)?ext(x.loc,'NYC Tree Map'):esc(x.loc);
      h+='<tr><td><span class="nm">'+esc(x.common)+'</span><span class="lt">'+esc(x.latin)+'</span>'+(x.nyc?'<span class="pill good" style="margin-top:4px" title="Listed in the NYC Parks Native Species Planting Guide">NYC native</span>':'')+'</td>'
        +(isT?'<td>'+esc(x.cultivar)+'</td><td>'+where+'</td><td>'+esc(x.note)+'</td>':'<td>'+(/dispute|tbd/i.test(x.intent)?'<span class="pill amber">In dispute / TBD</span>':esc(x.intent))+'</td><td>'+esc(x.note)+'</td>')+'</tr>'; });
    h+='</tbody></table>'; S._count=L.length+' '+(isT?'trees':'unintentional plants');
  }
  return h;
}
function vPlants(){
  var f=S.pf, m=M(), types={}; m.plants.forEach(function(p){ if(p.type) types[p.type]=1; });
  var tbl=plantTable();
  var h='<div class="head"><div><h1>Plants</h1><div class="sub" id="pcount">'+esc(S._count)+'</div></div><input class="inlist" id="plant-filter" type="search" placeholder="Filter this list" aria-label="Filter this list" value="'+esc(f.q)+'"></div>';
  h+='<div class="chips"><div class="chipgroup"><span>List</span>'+chip('Garden plants','plist','garden',f.list==='garden')+chip('Trees','plist','trees',f.list==='trees')+chip('Unintentional','plist','weeds',f.list==='weeds')+'</div>';
  if(f.list==='garden'){
    h+='<div class="chipgroup"><span>Native</span>'+chip('All','pnative','',!f.native)+chip('NYC native','pnative','nyc',f.native==='nyc')+chip('N. American','pnative','na',f.native==='na')+'</div>'
      +'<div class="chipgroup"><span>Type</span>'+chip('All','ptype','',!f.type)+Object.keys(types).sort().map(function(t){return chip(t,'ptype',t,f.type===t);}).join('')+'</div>'
      +'<div class="chipgroup"><span>Show only</span>'+chip('High failure rate','pflag','fail',f.flags.fail)+chip('Needs checking','pflag','check',f.flags.check)+chip('No garden recorded','pflag','nogarden',f.flags.nogarden)+chip('No season data','pflag','nodata',f.flags.nodata)+chip('Not verified','pflag','unverified',f.flags.unverified)+'</div>';
  }
  h+='</div><div class="card flush"><div class="scroll" id="ptable">'+tbl+'</div></div>';
  if(f.list==='garden') h+='<p class="hint" style="margin-top:12px">Season pills: filled green = in bloom, grey = foliage, berries or stems, outline = nothing. “NYC native” means the species is in the plant-community lists of the NYC Parks Native Species Planting Guide.</p>';
  return h;
}

function seasonGardens(){ var G=M().gardens.slice(); if(S.sf.sort==='gaps') G.sort(function(a,b){ var x=a.cells.filter(function(k){return k==='n';}).length, y=b.cells.filter(function(k){return k==='n';}).length; return y-x||a.name.localeCompare(b.name); }); return G; }
function vSeasons(){
  var G=seasonGardens(), mo=S.sf.month, total=G.length;
  var h='<div class="head"><div><h1>Seasons</h1><div class="sub">Which gardens have something to see, month by month. Click a month.</div></div></div>';
  h+='<div class="chips"><div class="chipgroup"><span>Order</span>'+chip('A to Z','ssort','name',S.sf.sort==='name')+chip('Most gaps first','ssort','gaps',S.sf.sort==='gaps')+'</div></div>';
  h+='<div class="grid side"><section class="card"><div class="scroll"><div class="sg">'
    +'<div class="sgrow band"><span style="border:0"></span><span style="grid-column:span 2">Winter</span><span style="grid-column:span 3">Spring</span><span style="grid-column:span 3">Summer</span><span style="grid-column:span 3">Autumn</span><span>Win.</span></div>'
    +'<div class="sgrow" style="margin-top:8px"><span></span>'+MLET.map(function(l,i){return '<button class="mbtn" aria-pressed="'+(i+1===mo)+'" data-act="smonth" data-val="'+(i+1)+'" title="'+MONTHS[i]+'" aria-label="'+MONTHS[i]+'">'+l+'</button>';}).join('')+'</div>'
    +'<div style="display:flex;flex-direction:column;gap:4px;margin-top:8px">'+G.map(function(g){ var lab=gardenLabels(g);
      return '<div class="sgrow">'+goA('g.'+g.id,esc(g.name))+g.cells.map(function(k,i){return '<span class="cell '+k+(i+1===mo?' sel':'')+'" title="'+esc(MON[i]+': '+lab[i])+'"></span>';}).join('')+'</div>'; }).join('')+'</div>'
    +'</div></div>'+legend(true)+'</section>';
  var withI=G.filter(function(g){return g.cells[mo-1]==='f';}).length;
  var D=G.slice().sort(function(a,b){ var o={f:0,s:1,n:2,u:3}; return o[a.cells[mo-1]]-o[b.cells[mo-1]]||a.name.localeCompare(b.name); });
  h+='<section class="card"><h2 style="font-size:26px">'+MONTHS[mo-1]+'</h2><p class="hint" style="margin:4px 0 14px;font-size:14px">'+withI+' of '+total+' gardens have something to see</p><div class="rows">'
    +D.map(function(g){ var b=g.by[mo-1], k=g.cells[mo-1], what=k==='f'?listNames(b.f.map(function(p){return p.common;}),3):k==='s'?'Not in bloom · foliage, berries or stems: '+listNames(b.s.map(function(p){return p.common;}),2):k==='u'?'No season data':'Nothing to see';
      return goA('g.'+g.id,(k==='f'?'<b>'+esc(g.name)+'</b>':'<span class="dim">'+esc(g.name)+'</span>')+'<span class="r'+(k==='n'?' warn':'')+'">'+esc(what)+'</span>','row'); }).join('')+'</div></section></div>';
  return h;
}

function notesBlock(g){
  var ns=notesFor(g.id), h='<section class="card"><div class="cardhead"><h2>Notes and know-how</h2></div>';
  if(!ns.length) h+='<p class="warn" style="margin:0 0 12px;font-size:14px">Nothing recorded yet. What should the next person know about this garden?</p>';
  ns.forEach(function(n){ h+='<div class="note"><p>'+esc(n.text)+'</p><small>'+esc(n.author||'Unknown')+' · '+esc(noteWhen(n))+(n.pending?' · saved; others will see it within a few minutes':'')+'</small></div>'; });
  if(CFG.notesWebAppUrl){
    var who=store('name'), pass=store('pass');
    h+='<form class="addnote" data-form="note" data-g="'+g.id+'" style="flex-wrap:wrap">'
      +(who&&pass?'':'<input id="note-name" type="text" maxlength="80" placeholder="Your name" aria-label="Your name" value="'+esc(who)+'" style="flex:1 1 140px"><input id="note-pass" type="password" placeholder="Notes passcode" aria-label="Notes passcode" style="flex:1 1 140px">')
      +'<input id="note-input" type="text" maxlength="1500" placeholder="Add a note for this garden" aria-label="Add a note for this garden" value="'+esc(S.drafts[g.id]||'')+'" style="flex:3 1 260px"><button class="btn primary" type="submit"'+(S._saving?' disabled':'')+'>'+(S._saving?'Saving…':'Add')+'</button></form>'
      +(who&&pass?'<p class="hint" style="margin:8px 0 0">Adding notes as '+esc(who)+'. <button class="ul" data-act="forget" style="font-size:13px">Not you?</button></p>':'');
  } else h+='<p class="hint" style="margin:8px 0 0">To add a note, add a row to the Notes tab of the <a href="'+SHEET_URL+'" target="_blank" rel="noopener">Google Sheet</a>: Date, Garden, Note, Author.</p>';
  if(S.noteMsg) h+='<p class="warn" style="margin:8px 0 0;font-size:13px">'+esc(S.noteMsg)+'</p>';
  var pn=g.plants.filter(function(p){return p.note;});
  if(pn.length){ h+='<h3>From the sheet: notes on plants here</h3><div class="rows">'+pn.map(function(p){ return '<div class="row"><span>'+goA('p.'+p.id,esc(p.common),'ul')+'</span><span class="r">'+esc(p.note)+'</span></div>'; }).join('')+'</div>'; }
  return h+'</section>';
}
function tally(g,field){ var c={}; g.plants.forEach(function(p){ if(!p.e) return; p.e[field].forEach(function(v){ v=v.replace(/^Dappled$/,'Dappled shade'); c[v]=(c[v]||0)+1; }); }); return Object.keys(c).sort(function(a,b){return c[b]-c[a];}).slice(0,4).map(function(k){return k+' '+c[k];}).join(' · '); }
function vGarden(g){
  var h='<div class="head"><div>'+goA('gardens','‹ All gardens','back')+'<h1>'+esc(g.name)+'</h1><div class="sub">'+plural(g.plants.length,'plant')+' on record · '+g.nyc+' NYC native'+(g.cond&&g.cond.type?' · '+esc(g.cond.type):'')+(g.num?' · No. '+g.num+' on the park map':'')+'</div></div><div class="pills" style="gap:8px">'+(g.num?goA('map.'+g.id,'Show on map','btn'):'')+ext(SHEET_URL,'Edit in Google Sheet').replace('<a ','<a class="btn" ')+'</div></div>';
  if(!g.plants.length) h+='<div class="card" style="margin-bottom:16px"><p class="warn" style="margin:0">No plants are recorded for this garden yet. It is on the park map, but no row in the sheet lists it in the Location column.</p></div>';
  h+='<div class="tiles">'+SEASONS.map(function(se){ var f={},s={};
      se.months.forEach(function(m){ g.by[m-1].f.forEach(function(p){f[p.id]=p;}); g.by[m-1].s.forEach(function(p){ if(!f[p.id]) s[p.id]=p; }); });
      Object.keys(f).forEach(function(k){delete s[k];});
      var fl=Object.keys(f).map(function(k){return f[k].common;}).sort(), sl=Object.keys(s).map(function(k){return s[k].common;}).sort(), gap=!fl.length&&!sl.length, unk=!g.known;
      return '<div class="tile'+(gap&&!unk?' gapt':'')+'"><div class="th"><b>'+se.name+'</b><span>'+se.range+'</span></div><div class="st">'+(unk?'No season data':gap?'Nothing to see':'Has interest')+'</div>'
        +(gap&&!unk?'<p>A gap to plan for.</p>':'')+(fl.length?'<p>In bloom: '+esc(listNames(fl,6))+'</p>':'')+(sl.length?'<p>Foliage, berries, stems: '+esc(listNames(sl,5))+'</p>':'')+'</div>'; }).join('')+'</div>';
  var cd=g.cond, light=tally(g,'light'), drain=tally(g,'drain'), nodata=g.plants.length-g.known;
  h+='<div class="grid side left"><div class="stack"><section class="card"><h2 style="margin-bottom:10px">'+(cd?'Conditions':'At a glance')+'</h2>'
    +(cd?[['Soil',cd.soil],['Light',cd.light],['Moisture',cd.moist],['Risk',cd.risk]].filter(function(x){return x[1];}).map(function(x){return '<div class="kv"><span>'+x[0]+'</span><span'+(x[0]==='Risk'?' class="warn"':'')+'>'+esc(x[1])+'</span></div>';}).join(''):'')
    +'<div class="kv"><span>Plants on record</span><span class="num">'+g.plants.length+'</span></div>'
    +'<div class="kv"><span>NYC native</span><span class="num">'+g.nyc+'</span></div>'
    +'<div class="kv"><span>High failure rate</span><span class="num'+(g.plants.some(function(p){return p.fail;})?' warn':'')+'">'+g.plants.filter(function(p){return p.fail;}).length+'</span></div>'
    +'<div class="kv"><span>Needs checking</span><span class="num">'+g.plants.filter(function(p){return p.check;}).length+'</span></div>'
    +(nodata?'<div class="kv"><span>No season data</span><span class="num">'+nodata+'</span></div>':'')
    +'<h3>Interest, Jan → Dec</h3><div class="mletters">'+MLET.map(function(l){return '<span>'+l+'</span>';}).join('')+'</div>'+strip(g.cells,gardenLabels(g),true)
    +(light?'<h3>What these plants take</h3><div class="kv"><span>Light</span><span>'+esc(light)+'</span></div><div class="kv"><span>Soil</span><span>'+esc(drain)+'</span></div><p class="hint" style="margin:8px 0 0">Counted from plant profiles, not a survey of this bed.'+(cd?'':' Site soil, light and moisture are not in the sheet yet.')+'</p>':'')
    +'</section></div><div class="stack">';
  h+='<section class="card"><div class="cardhead"><h2>Plants in this garden</h2><span class="hint">'+g.plants.length+' on record</span></div><div class="scroll"><table class="t tight" style="min-width:560px"><thead><tr><th>Plant</th><th>Planted</th>'+SEASONS.map(function(s){return '<th class="dotc">'+s.short+'</th>';}).join('')+'<th>On record</th></tr></thead><tbody>'
    +g.plants.map(function(p){ var ks=p.int?seasonKinds(p.int.cells):null;
      return '<tr><td>'+goA('p.'+p.id,esc(p.common),'ul nm')+'</td><td class="num hint">'+esc(p.year||'')+'</td>'+SEASONS.map(function(se,i){ return '<td class="dotc">'+(ks?'<span class="dot4 '+(ks[i]==='n'?'':ks[i])+'" title="'+esc(se.name+': '+KIND[ks[i]])+'"></span>':'<span class="dash" title="No season data">–</span>')+'</td>'; }).join('')+'<td><span class="pills">'+(flagPills(p).replace('<span class="pill">No garden recorded</span>','')||(p.nyc?'<span class="pill good">NYC native</span>':''))+'</span></td></tr>'; }).join('')
    +'</tbody></table></div><p class="hint" style="margin:10px 0 0;font-size:12px">Dark green dot = in bloom that season; pale green = foliage, berries or stems; ring = nothing; dash = no season data.</p></section>';
  h+=notesBlock(g)+'</div></div>';
  return h;
}

function vPlant(p){
  var m=M(), e=p.e, h='<div class="head"><div>'+goA('plants','‹ All plants','back')+'<h1>'+esc(p.common)+'</h1><div class="latin">'+esc(p.latin||'Latin name not recorded')+'</div></div><div class="pills">'+(p.type?'<span class="pill line">'+esc(p.type)+'</span>':'')+nativePills(p,true)+(p.fail?'<span class="pill bad big">High failure rate</span>':'')+(p.check?'<span class="pill amber big">Needs checking</span>':'')+'</div></div>';
  h+='<div class="grid side"><div class="stack"><section class="card"><div class="cardhead"><h2>Through the year</h2>'+(e?'<span class="hint">from '+esc(sourceName(e))+'</span>':'')+'</div>';
  if(p.int){ h+='<div class="mletters">'+MLET.map(function(l){return '<span>'+l+'</span>';}).join('')+'</div>'+strip(p.int.cells,plantLabels(p),true)+legend(false)+'<ul class="lines">'
      +(p.int.bloom.length?'<li><span>In bloom</span><span>'+esc(monthRanges(p.int.bloom))+(p.int.approx?' (by season; the profile gives no months)':'')+'</span></li>':'<li><span>In bloom</span><span>Not grown for flowers</span></li>')
      +e.o.map(function(it){return '<li><span>'+esc(monthRanges(it[0]))+'</span><span>'+esc(it[1].charAt(0).toUpperCase()+it[1].slice(1))+'</span></li>';}).join('')+'</ul>'
      +(e.q?'<p class="quote">“'+esc(e.q)+'”</p>':'')
      +'<p class="hint" style="margin:10px 0 0">'+(p.aliased||e.page?'Uses the profile for <i>'+esc(e.page||p.ekey.replace(/^./,function(c){return c.toUpperCase();}).replace(' x ',' × '))+'</i>. ':'')+(e.src==='ncsu'?'Timing is from North Carolina; Brooklyn usually runs a little later in spring.':'Timing is as described on Wikipedia and is not specific to Brooklyn.')+'</p>';
  } else h+='<p class="hint" style="margin:0">No season data yet for this plant'+(e?': the profile gives no flowering or foliage timing.':'. No plant profile was found for “'+esc(p.latin||p.common)+'”.')+'</p>';
  h+='</section>';
  var inSet={}; p.gardens.forEach(function(g){inSet[g.id]=1;});
  var offMap=p.gardens.filter(function(g){return !g.num;});
  h+='<section class="card"><div class="cardhead"><h2>Where it grows</h2><span class="hint">'+(p.gardens.length?'planted in '+p.gardens.length+' of '+m.gardens.length+' gardens':'no garden recorded')+'</span></div>'
    +mapSvg({small:true,style:function(g){ return g&&inSet[g.id]?'kf':'out'; },go:true,title:function(g){ return g.name+(inSet[g.id]?': planted here':': not planted here'); }})
    +'<div class="legend"><span><i class="f"></i>Planted here</span><span><i class="o"></i>Not planted</span></div>'
    +(offMap.length?'<p class="hint" style="margin:10px 0 0">Also in '+offMap.map(function(g){return goA('g.'+g.id,esc(g.name),'ul');}).join(', ')+', which is not on the map yet.</p>':'')
    +(p.gardens.length?'':'<p class="warn" style="margin:10px 0 0;font-size:14px">The sheet lists this plant without a location. Add its gardens to the Location column.</p>')+'</section>';
  var kv=function(k,v,cls){ return v?'<div class="kv"><span>'+k+'</span><span'+(cls?' class="'+cls+'"':'')+'>'+v+'</span></div>':''; };
  h+='<section class="card"><h2 style="margin-bottom:10px">From the sheet</h2>'+kv('Type',esc(p.sheetType))+kv('Planting',esc(p.intent))+kv('Verified in the field',p.verified?'Yes':'Not yet',p.verified?'':'warn')+kv('Planted',esc(p.year))+kv('Cultivar note',esc(p.cultivar))+kv('ID source',esc(p.source))
    +(p.note?'<div class="note" style="margin:12px 0 0"><p>'+esc(p.note)+'</p><small>Note in the sheet</small></div>':'')+'</section></div>';
  // side column
  h+='<div class="stack"><section class="card"><h2 style="margin-bottom:12px">Seasons of interest</h2>'+seasonPills(p).replace(/class="pill /g,'class="pill big ')+(p.int?'<p class="hint" style="margin:10px 0 0">Green = in bloom. Grey = foliage, berries or stems. Outline = nothing.</p>':'')+'</section>';
  h+='<section class="card"><div class="cardhead"><h2>Found in</h2><span class="hint">'+plural(p.gardens.length,'garden')+'</span></div>';
  if(p.gardens.length) h+='<div class="rows">'+p.gardens.map(function(g){ return '<a class="row" style="align-items:center" href="#g.'+g.id+'" data-go="g.'+g.id+'"><b>'+esc(g.name)+'</b><span class="r" style="flex:0 1 130px">'+strip(g.cells,gardenLabels(g))+'</span></a>'; }).join('')+'</div><p class="hint" style="margin:10px 0 0">Each strip is that garden’s interest, January to December.</p>';
  else h+='<p class="hint" style="margin:0">No garden recorded.</p>';
  h+='</section>';
  if(p.fail) h+='<section class="card"><h2 style="margin-bottom:8px">High failure rate</h2><p class="warn" style="margin:0">'+esc(p.fail.why)+'</p><p class="hint" style="margin:8px 0 0">Recorded for “'+esc(p.fail.row)+'” in the sheet.</p></section>';
  if(e) h+='<section class="card"><h2 style="margin-bottom:10px">Growing notes</h2>'+kv('Light',esc(e.light.join(', ').replace(/Dappled(?! shade)/,'Dappled shade')))+kv('Soil',esc(e.drain.join(', ')))+kv('Leaf',esc(e.leaf))+kv('Fall colour',esc(e.fall==='Insignificant'?'':e.fall))+kv('Native range',esc(e.origin))+'<p class="hint" style="margin:8px 0 0">From the plant profile, not from this park.</p></section>';
  if(p.nyc) h+='<section class="card"><h2 style="margin-bottom:6px">NYC plant communities</h2><p class="hint" style="margin:0 0 8px">The NYC Parks guide recommends this species for:</p><div class="pills">'+p.nyc.map(function(c){return '<span class="pill">'+esc(c)+'</span>';}).join('')+'</div></section>';
  var names=[p.common.toLowerCase()]; var parts=p.common.split(','); if(parts.length===2) names.push(clean(parts[1]+' '+parts[0]).toLowerCase()); if(p.key.indexOf(' ')>0) names.push(p.key);
  var men=S.notes.filter(function(n){ var t=String(n.text||'').toLowerCase(); return names.some(function(x){return x.length>3&&t.indexOf(x)>=0;}); });
  if(men.length) h+='<section class="card"><h2 style="margin-bottom:10px">Mentioned in notes</h2>'+men.map(function(n){ var g=m.gById[n.gardenId]; return '<div class="note"><p>'+esc(n.text)+'</p><small>'+(g?goA('g.'+g.id,esc(g.name)):'')+' · '+esc(fmtDate(n.createdAt))+'</small></div>'; }).join('')+'</section>';
  var qn=encodeURIComponent(p.key&&p.key.indexOf(' ')>0?p.key.replace(' x ',' × '):(p.latin||p.common));
  h+='<section class="card"><h2 style="margin-bottom:12px">Look it up</h2><div class="links">'+(e?ext(e.url,e.src==='wiki'?'Wikipedia article':'NC State plant profile'):'')+ext('https://en.wikipedia.org/wiki/Special:Search?search='+qn,'Search Wikipedia')+ext('https://www.inaturalist.org/taxa/search?q='+qn,'Photos and sightings on iNaturalist')+(p.nyc?ext(GUIDE_URL,'NYC Parks Native Species Planting Guide'):'')+ext(SHEET_URL,'Edit in Google Sheet')+'</div></section></div></div>';
  return h;
}

function mapSvg(o){
  var MP=DATA.MAP, m=M(), f=MP.feats, h='<svg class="map'+(o.small?' small':'')+'" viewBox="0 0 '+MP.vb[0]+' '+MP.vb[1]+'" role="group" aria-label="Plan of Fort Greene Park with garden outlines"><path class="park" d="'+MP.park+'" fill-rule="evenodd"/>';
  if(f&&f.length>1) h+='<rect class="water" x="'+(f[0][0]-11)+'" y="'+(f[0][1]-11)+'" width="22" height="22" transform="rotate(35 '+f[0][0]+' '+f[0][1]+')"/><circle class="water" cx="'+f[1][0]+'" cy="'+f[1][1]+'" r="13"/>';
  MP.labels.forEach(function(l){ h+='<text class="street" x="'+l[1]+'" y="'+l[2]+'" transform="rotate('+l[3]+' '+l[1]+' '+l[2]+')">'+esc(l[0])+'</text>'; });
  var nums='';
  MP.g.forEach(function(mg){ var g=mg.id?m.gById[mg.id]:null;
    mg.d.forEach(function(d,i){
      if(!g){ h+='<path class="gs none" d="'+d+'"><title>No. '+mg.n+': outlined on the park map, not named in the garden list</title></path>'; }
      else { var sel=o.sel===g.id; h+='<path id="gs-'+g.id+'-'+i+'" class="gs '+o.style(g)+(sel?' sel':'')+'" d="'+d+'" tabindex="0" role="button" aria-label="'+esc(o.title(g))+'"'+(sel?' aria-pressed="true"':'')+(o.go?' data-go="g.'+g.id+'"':' data-act="msel" data-val="'+g.id+'"')+'><title>'+esc('No. '+mg.n+' · '+o.title(g))+'</title></path>'; }
      nums+='<text class="gnum" x="'+mg.lab[i][0]+'" y="'+mg.lab[i][1]+'">'+mg.n+'</text>'; }); });
  return h+nums+'</svg>';
}
function mapLayers(){ var mo=S.sf.month, L=[
  {k:'interest',label:'Interest in '+MON[mo-1],style:function(g){return 'k'+g.cells[mo-1];},leg:[['kf','In bloom'],['ks','Foliage, berries, stems'],['kn','Nothing to see'],['ku','No season data']],
    say:function(g){ var b=g.by[mo-1],k=g.cells[mo-1]; return k==='f'?'in bloom: '+listNames(b.f.map(function(p){return p.common;}),3):k==='s'?'foliage, berries or stems':KIND[k]; }},
  {k:'plants',label:'Plants on record',style:function(g){var n=g.plants.length; return n===0?'q0':n<=5?'q1':n<=15?'q2':'q3';},leg:[['q0','None'],['q1','1 to 5'],['q2','6 to 15'],['q3','16 or more']],say:function(g){return plural(g.plants.length,'plant')+' on record';}},
  {k:'native',label:'NYC native share',style:function(g){ if(!g.plants.length) return 'ku'; var x=g.nyc/g.plants.length; return x===0?'q0':x<0.25?'q1':x<0.5?'q2':'q3'; },leg:[['q0','None'],['q1','Under a quarter'],['q2','A quarter to half'],['q3','Half or more'],['ku','No plants recorded']],say:function(g){return g.nyc+' of '+g.plants.length+' plants NYC native';}},
  {k:'gaps',label:'Season gaps',style:function(g){ return !g.known?'ku':g.gaps.length===0?'ks':g.gaps.length===1?'c1':'c2'; },leg:[['ks','Something in every season'],['c1','One season with nothing'],['c2','Two or more'],['ku','No season data']],say:function(g){return g.gaps.length?'nothing to see in '+g.gaps.map(function(x){return x.name.toLowerCase();}).join(', '):(g.known?'something in every season':'no season data');}},
  {k:'notes',label:'Notes',style:function(g){ return S.notesState!=='ready'?'ku':notesFor(g.id).length?'kf':'kn'; },leg:[['kf','Has notes'],['kn','No notes yet']],say:function(g){ return S.notesState!=='ready'?'notes not available':plural(notesFor(g.id).length,'note'); }}];
  if(M().hasCond){ var cd=function(g,k){return g.cond&&g.cond[k]?g.cond[k].toLowerCase():'';};
    L.push({k:'light',label:'Light',style:function(g){var v=cd(g,'light'); return !v?'ku':/part/.test(v)?'q2':/shade/.test(v)?'q1':'q3';},leg:[['q3','Sun'],['q2','Part shade'],['q1','Shade'],['ku','Not recorded']],say:function(g){return cd(g,'light')||'light not recorded';}});
    L.push({k:'moist',label:'Moisture',style:function(g){var v=cd(g,'moist'); return !v?'ku':/dry/.test(v)?'m1':/wet/.test(v)?'m3':'m2';},leg:[['m1','Dry'],['m2','Moist'],['m3','Wet'],['ku','Not recorded']],say:function(g){return cd(g,'moist')||'moisture not recorded';}});
    L.push({k:'risk',label:'Risk',style:function(g){return !g.cond?'ku':g.cond.risk?'c2':'ks';},leg:[['c2','Risk recorded'],['ks','None recorded'],['ku','Not recorded']],say:function(g){return cd(g,'risk')||'no risk recorded';}}); }
  return L; }
function vMap(){
  var m=M(), mo=S.sf.month, L=mapLayers(), lay=L.filter(function(x){return x.k===S.mf.layer;})[0]||L[0], sel=m.gById[S.mf.sel]||null;
  var h='<div class="head"><div><h1>Map</h1><div class="sub">Every garden on the park plan. Click one to see what is on record.</div></div></div>';
  h+='<div class="grid side"><section class="card flush"><div class="maptools"><div class="chipgroup"><span>Colour by</span>'+L.map(function(x){return chip(x.label,'mlayer',x.k,x.k===lay.k);}).join('')+'</div>'
    +(lay.k==='interest'?'<div class="monthrow" role="group" aria-label="Month">'+MLET.map(function(l,i){return '<button class="mbtn" aria-pressed="'+(i+1===mo)+'" data-act="mmonth" data-val="'+(i+1)+'" title="'+MONTHS[i]+'" aria-label="'+MONTHS[i]+'">'+l+'</button>';}).join('')+'</div>':'')+'</div>'
    +'<div class="mapwrap">'+mapSvg({sel:sel?sel.id:'',style:lay.style,title:function(g){return g.name+': '+lay.say(g);}})+'</div>'
    +'<div class="maplegend legend">'+lay.leg.map(function(x){return '<span><i class="lg '+x[0]+'"></i>'+esc(x[1])+'</span>';}).join('')+'</div></section>';
  // side panel
  h+='<section class="card">';
  if(sel){ var n=notesFor(sel.id).length, b=sel.by[mo-1];
    h+='<h2 style="font-size:26px">'+esc(sel.name)+'</h2><p class="hint" style="margin:4px 0 12px;font-size:14px">No. '+sel.num+' on the park map · '+plural(sel.plants.length,'plant')+' on record</p>'
      +(sel.cond?[['Soil',sel.cond.soil],['Light',sel.cond.light],['Moisture',sel.cond.moist],['Risk',sel.cond.risk]].filter(function(x){return x[1];}).map(function(x){return '<div class="kv"><span>'+x[0]+'</span><span'+(x[0]==='Risk'?' class="warn"':'')+'>'+esc(x[1])+'</span></div>';}).join(''):'')
      +'<div class="kv"><span>NYC native</span><span class="num">'+sel.nyc+'</span></div>'
      +'<div class="kv"><span>Season gaps</span><span'+(sel.gaps.length?' class="warn"':'')+'>'+(sel.gaps.length?esc(sel.gaps.map(function(x){return x.name;}).join(', ')):(sel.known?'None':'No season data'))+'</span></div>'
      +'<div class="kv"><span>High failure rate</span><span class="num">'+sel.plants.filter(function(p){return p.fail;}).length+'</span></div>'
      +'<div class="kv"><span>Notes</span><span class="num'+(S.notesState==='ready'&&!n?' warn':'')+'">'+(S.notesState==='ready'?(n||'None'):'–')+'</span></div>'
      +'<h3>Interest, Jan → Dec</h3><div class="mletters">'+MLET.map(function(l){return '<span>'+l+'</span>';}).join('')+'</div>'+strip(sel.cells,gardenLabels(sel),true)
      +(sel.known?'<h3>'+MONTHS[mo-1]+'</h3><p style="margin:0;font-size:14px">'+(b.f.length?'In bloom: '+esc(listNames(b.f.map(function(p){return p.common;}),6)):b.s.length?'Foliage, berries, stems: '+esc(listNames(b.s.map(function(p){return p.common;}),6)):'<span class="warn">Nothing to see</span>')+'</p>':'')
      +'<p style="margin:18px 0 0">'+goA('g.'+sel.id,'Open garden record','btn primary')+'</p>';
  } else {
    var tally={}; m.gardens.forEach(function(g){ if(!g.num) return; var c=lay.style(g); tally[c]=(tally[c]||0)+1; });
    h+='<h2 style="margin-bottom:6px">'+esc(lay.label)+'</h2><p class="hint" style="margin:0 0 12px;font-size:14px">Click a garden on the map to see its record.</p>'
      +lay.leg.map(function(x){ return '<div class="kv"><span style="display:flex;gap:8px;align-items:center;color:var(--ink)"><i class="lg '+x[0]+'"></i>'+esc(x[1])+'</span><span class="num">'+(tally[x[0]]||0)+'</span></div>'; }).join('');
  }
  var off=m.gardens.filter(function(g){return !g.num;});
  if(off.length) h+='<h3>Not on the map yet</h3><p style="margin:0;font-size:14px">'+off.map(function(g){return goA('g.'+g.id,esc(g.name),'ul');}).join(', ')+'</p>';
  if((DATA.MAP.g||[]).some(function(x){return !x.id;})) h+='<p class="hint" style="margin:12px 0 0">'+DATA.MAP.g.filter(function(x){return !x.id;}).map(function(x){return 'No. '+x.n;}).join(', ')+' is outlined on the park map but has no name in the garden list.</p>';
  h+='</section></div>';
  return h;
}
function footer(){ return '<footer>Plant list and locations come from the <a href="'+SHEET_URL+'" target="_blank" rel="noopener">Fort Greene Park Flora master list</a>. Bloom times, foliage and berry interest, light, soil and native range come from the <a href="https://plants.ces.ncsu.edu/" target="_blank" rel="noopener">NC State Extension Gardener Plant Toolbox</a>, and from Wikipedia for the few plants it does not cover. “NYC native” follows the plant-community lists in the <a href="'+GUIDE_URL+'" target="_blank" rel="noopener">NYC Parks Native Species Planting Guide</a> (2nd edition). Timing is not measured in the park: treat it as a starting point and correct it from what you see.</footer>'; }

/* ---------- routing and render ---------- */
function parseRoute(tok){
  tok=String(tok||'').replace(/^#/,'');
  if(tok.indexOf('g.')===0) return {name:'garden',id:tok.slice(2)};
  if(tok.indexOf('p.')===0) return {name:'plant',id:tok.slice(2)};
  if(tok.indexOf('seasons')===0){ var n=parseInt(tok.split('.')[1],10); if(n>=1&&n<=12) S.sf.month=n; return {name:'seasons'}; }
  if(tok==='gardens'||tok==='plants') return {name:tok};
  if(tok.indexOf('map')===0){ S.mf.sel=tok.indexOf('map.')===0?tok.slice(4):''; return {name:'map'}; }
  return {name:'dash'};
}
function applySet(set){
  if(!set) return;
  if(set==='nonotes'){ S.gf.gap=''; S.gf.noNotes=true; S.gf.noPlants=false; }
  if(set==='gap'){ S.gf.gap='any'; S.gf.noNotes=false; S.gf.noPlants=false; }
  if(set==='noplants'){ S.gf.gap=''; S.gf.noNotes=false; S.gf.noPlants=true; }
  var fresh=function(){ S.pf={list:'garden',native:'',type:'',flags:{},q:'',sort:'name',dir:1}; };
  if(['check','nogarden','nodata','unverified','fail'].indexOf(set)>=0){ fresh(); S.pf.flags[set]=true; }
  if(set==='nyc'||set==='na'){ fresh(); S.pf.native=set; }
  if(set.indexOf('type:')===0){ fresh(); S.pf.type=set.slice(5); }
}
function go(tok,set){
  applySet(set); S.route=parseRoute(tok); S.noteMsg='';
  S._tok=tok; try{ if(location.hash.replace(/^#/,'')!==tok) location.hash=tok; }catch(e){}
  render(); window.scrollTo(0,0);
}
function render(){
  var r=S.route, m=M(), app=document.getElementById('app'), html;
  var ae=document.activeElement, fid=ae&&ae.id&&app.contains(ae)?ae.id:null, sel=fid&&ae.selectionStart!=null?[ae.selectionStart,ae.selectionEnd]:null;
  if(r.name==='garden'){ var g=m.gById[r.id]; html=g?vGarden(g):'<div class="head"><div>'+goA('gardens','‹ All gardens','back')+'<h1>Garden not found</h1><div class="sub">It may have been renamed in the sheet.</div></div></div>'; }
  else if(r.name==='plant'){ var p=m.pById[r.id]; html=p?vPlant(p):'<div class="head"><div>'+goA('plants','‹ All plants','back')+'<h1>Plant not found</h1><div class="sub">It may have been renamed in the sheet.</div></div></div>'; }
  else if(r.name==='gardens') html=vGardens(); else if(r.name==='plants') html=vPlants(); else if(r.name==='seasons') html=vSeasons(); else if(r.name==='map') html=vMap(); else html=vDash();
  app.innerHTML=html+footer();
  var cur={dash:'dash',gardens:'gardens',garden:'gardens',plants:'plants',plant:'plants',seasons:'seasons',map:'map'}[r.name];
  [].forEach.call(document.querySelectorAll('.tab'),function(a){ if(a.getAttribute('data-tab')===cur) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
  if(fid){ var el=document.getElementById(fid); if(el){ el.focus(); if(sel&&el.setSelectionRange){ try{el.setSelectionRange(sel[0],sel[1]);}catch(e){} } } }
}
function renderSync(){
  var el=document.getElementById('sync'), s=S.sync; if(!el) return;
  el.className='sync'+(s.mode==='live'?'':' snap')+(s.busy?' busy':'');
  var txt=s.busy?'Checking the Google Sheet…':s.mode==='live'?'Synced from Google Sheet · '+ago(s.at):'Sheet as of '+fmtDate(s.at)+(s.msg?' · '+s.msg:'');
  el.innerHTML='<span class="dot"></span><span>'+esc(txt)+'</span>'+(s.busy||!CFG.publishedXlsxUrl?'':'<button data-act="refresh" title="Read the sheet again now">Refresh</button>');
}

/* ---------- search ---------- */
function searchResults(q){ q=q.toLowerCase(); var m=M();
  var P=m.plants.filter(function(p){return (p.common+' '+p.latin).toLowerCase().indexOf(q)>=0;}).slice(0,7).map(function(p){return {tok:'p.'+p.id,name:p.common,sub:p.gardens.length?'in '+plural(p.gardens.length,'garden'):'no garden recorded'};});
  var G=m.gardens.filter(function(g){return g.name.toLowerCase().indexOf(q)>=0;}).slice(0,6).map(function(g){return {tok:'g.'+g.id,name:g.name,sub:plural(g.plants.length,'plant')};});
  return {P:P,G:G,all:P.concat(G)}; }
function renderDD(){
  var dd=document.getElementById('dd'), inp=document.getElementById('q'), q=clean(S.q);
  if(!q){ dd.hidden=true; inp.setAttribute('aria-expanded','false'); return; }
  var r=searchResults(q), i=0, h='';
  var item=function(x){ var on=(i===S.ddIndex); var s='<a href="#'+x.tok+'" data-go="'+x.tok+'" role="option" id="opt'+i+'"'+(on?' class="on" aria-selected="true"':'')+'><b>'+esc(x.name)+'</b><span>'+esc(x.sub)+'</span></a>'; i++; return s; };
  if(r.P.length) h+='<h4>Plants</h4>'+r.P.map(item).join('');
  if(r.G.length) h+='<h4>Gardens</h4>'+r.G.map(item).join('');
  if(!r.all.length) h='<div class="none">Nothing matches “'+esc(q)+'”</div>';
  dd.innerHTML=h; dd.hidden=false; inp.setAttribute('aria-expanded','true');
  S._dd=r.all;
}
function closeDD(){ S.q=''; S.ddIndex=-1; var inp=document.getElementById('q'); inp.value=''; renderDD(); }

/* ---------- events ---------- */
document.addEventListener('click',function(ev){
  var t=ev.target, a=t.closest?t.closest('[data-act]'):null;
  if(a){ var act=a.getAttribute('data-act'), v=a.getAttribute('data-val'), k=a.getAttribute('data-key');
    if(act==='refresh'){ syncSheet(true); return; }
    if(act==='forget'){ store('name',''); store('pass',''); }
    if(act==='gsort'||act==='psort'){ var st=act==='gsort'?S.gf:S.pf; if(st.sort===k) st.dir=-st.dir; else {st.sort=k; st.dir=(k==='name'||k==='type')?1:-1;} }
    if(act==='ggap') S.gf.gap=v; if(act==='gnotes') S.gf.noNotes=!S.gf.noNotes; if(act==='gnoplants') S.gf.noPlants=!S.gf.noPlants;
    if(act==='mlayer') S.mf.layer=v; if(act==='mmonth') S.sf.month=parseInt(v,10);
    if(act==='msel'){ S.mf.sel=(S.mf.sel===v?'':v); S._tok=S.mf.sel?'map.'+S.mf.sel:'map'; try{ location.hash=S._tok; }catch(e){} }
    if(act==='plist'){ S.pf.list=v; S.pf.q=''; } if(act==='pnative') S.pf.native=v; if(act==='ptype') S.pf.type=v; if(act==='pflag') S.pf.flags[v]=!S.pf.flags[v];
    if(act==='smonth'){ S.sf.month=parseInt(v,10); S._tok='seasons.'+v; try{ location.hash=S._tok; }catch(e){} } if(act==='ssort') S.sf.sort=v;
    render(); return; }
  var g=t.closest?t.closest('[data-go]'):null;
  if(g){ if(t.closest('a[target="_blank"]')) return; ev.preventDefault(); var tok=g.getAttribute('data-go'), set=g.getAttribute('data-set'); if(g.closest('#dd')) closeDD(); go(tok,set); return; }
  if(!t.closest||!t.closest('.search')){ if(S.q){ document.getElementById('dd').hidden=true; } }
});
document.addEventListener('input',function(ev){
  var t=ev.target;
  if(t.id==='q'){ S.q=t.value; S.ddIndex=-1; renderDD(); }
  if(t.id==='plant-filter'){ S.pf.q=t.value; document.getElementById('ptable').innerHTML=plantTable(); document.getElementById('pcount').textContent=S._count; }
  if(t.id==='note-input'){ var f=t.closest('form'); if(f) S.drafts[f.getAttribute('data-g')]=t.value; }
});
document.addEventListener('keydown',function(ev){
  var t=ev.target, inField=/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
  if((ev.key==='Enter'||ev.key===' ')&&t.classList&&t.classList.contains('gs')){ ev.preventDefault(); t.dispatchEvent(new MouseEvent('click',{bubbles:true})); return; }
  if(ev.key==='/'&&!inField&&!ev.metaKey&&!ev.ctrlKey){ ev.preventDefault(); document.getElementById('q').focus(); return; }
  if(t.id==='q'){ var n=(S._dd||[]).length;
    if(ev.key==='ArrowDown'&&n){ ev.preventDefault(); S.ddIndex=(S.ddIndex+1)%n; renderDD(); }
    else if(ev.key==='ArrowUp'&&n){ ev.preventDefault(); S.ddIndex=(S.ddIndex-1+n)%n; renderDD(); }
    else if(ev.key==='Enter'&&n){ ev.preventDefault(); var x=S._dd[Math.max(0,S.ddIndex)]; closeDD(); t.blur(); go(x.tok); }
    else if(ev.key==='Escape'){ closeDD(); t.blur(); } }
});
document.addEventListener('focusin',function(ev){ if(ev.target.id==='q'&&S.q) renderDD(); });
document.addEventListener('submit',function(ev){ var f=ev.target; if(f.getAttribute&&f.getAttribute('data-form')==='note'){ ev.preventDefault(); addNote(f.getAttribute('data-g')); } });
window.addEventListener('hashchange',function(){ var tok=location.hash.replace(/^#/,''); if(tok===S._tok) return; S._tok=tok; S.route=parseRoute(tok); render(); window.scrollTo(0,0); });

/* ---------- live sheet (published Google Sheet) ---------- */
function parseCsv(text){ var rows=[],row=[],cur='',q=false; for(var i=0;i<text.length;i++){ var ch=text[i];
    if(q){ if(ch==='"'){ if(text[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=ch; }
    else if(ch==='"') q=true; else if(ch===','){row.push(cur);cur='';} else if(ch==='\n'){row.push(cur);rows.push(row);row=[];cur='';} else if(ch!=='\r') cur+=ch; }
  if(cur||row.length){row.push(cur);rows.push(row);} return rows; }
function xlsxReady(){ return new Promise(function(r){ var n=0; (function t(){ if(window.XLSX||n++>80) r(!!window.XLSX); else setTimeout(t,100); })(); }); }
function tabsFromWorkbook(buf){
  if(!window.XLSX) throw new Error('noxlsx');
  var wb=window.XLSX.read(new Uint8Array(buf),{type:'array'}), out={};
  wb.SheetNames.forEach(function(n){ out[n]=window.XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:false,defval:'',blankrows:false}); });
  return out;
}
function syncSheet(force){
  if(S.sync.busy) return Promise.resolve();
  if(!CFG.publishedXlsxUrl){ S.sync.msg=''; renderSync(); return Promise.resolve(); }
  S.sync.busy=true; renderSync();
  var url=CFG.publishedXlsxUrl+(force?(CFG.publishedXlsxUrl.indexOf('?')<0?'?':'&')+'t='+Date.now():'');
  return xlsxReady().then(function(){ return fetch(url,{cache:force?'no-store':'default'}); })
    .then(function(res){ if(!res.ok) throw new Error('http'); return res.arrayBuffer(); })
    .then(function(buf){ var model=buildModel(tabsFromWorkbook(buf)); S.model=model; mergeNotes(); S.sync={mode:'live',at:Date.now(),msg:'',busy:false}; render(); renderSync(); })
    .catch(function(err){ var c=err&&err.message;
      S.sync.busy=false; S.sync.msg=c==='layout'?'the sheet’s layout was not recognised':c==='noxlsx'?'the sheet reader did not load':'could not reach the Google Sheet just now';
      renderSync(); });
}

/* ---------- adding notes (Google Apps Script web app writes to the Notes tab) ---------- */
function addNote(gid){
  var text=clean(S.drafts[gid]||''), g=M().gById[gid]; if(!text||!g||S._saving) return;
  var nm=document.getElementById('note-name'), pw=document.getElementById('note-pass');
  var who=nm?clean(nm.value):store('name'), pass=pw?pw.value:store('pass');
  if(!who||!pass){ S.noteMsg='Add your name and the notes passcode first.'; render(); return; }
  store('name',who); S._saving=true; S.noteMsg=''; render();
  fetch(CFG.notesWebAppUrl,{method:'POST',body:JSON.stringify({passcode:pass,garden:g.name,text:text.slice(0,1500),author:who})})
    .then(function(res){ return res.json(); })
    .then(function(r){ S._saving=false;
      if(r&&r.ok){ store('name',who); store('pass',pass); S.drafts[gid]=''; S.pending.push({id:'p'+Date.now(),gardenId:gid,text:text.slice(0,1500),author:who,createdAt:Date.now(),pending:true}); mergeNotes(); }
      else if(r&&r.error==='passcode'){ store('pass',''); S.noteMsg='That passcode was not accepted.'; }
      else S.noteMsg='That note was not saved. Try again in a moment.';
      render(); })
    .catch(function(){ S._saving=false; S.noteMsg='That note was not saved. Check your connection and try again.'; render(); });
}

if(window.__FGP_TEST__){ window.__FGP_TEST__({buildModel:buildModel,monthRanges:monthRanges,baseKey:baseKey,S:S,DATA:DATA,go:go,parseCsv:parseCsv}); }
/* ---------- start ---------- */
S.route=parseRoute(location.hash);
render(); renderSync();
setInterval(function(){ if(S.sync.mode==='live'&&!S.sync.busy) renderSync(); },60000);
syncSheet(false);
})();
