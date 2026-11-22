// node build.js                          -> malang-race.html (the normal game)
// node build.js --brand brands/cafe.json -> ../demo/<id>.html (event version for one brand, offline)
const fs=require('fs'), path=require('path');
const bi=process.argv.indexOf('--brand'), brandPath=bi>0?process.argv[bi+1]:null;
let brand=null;
if(brandPath){
  brand=JSON.parse(fs.readFileSync(brandPath,'utf8'));
  const bad=(m)=>{console.error('브랜드 파일 오류: '+m);process.exit(1);};
  if(!/^[a-z0-9-]+$/.test(brand.id||'')) bad('id는 영어 소문자, 숫자, - 만 써 주세요');
  if(!brand.name) bad('name이 없어요');
  if(!Array.isArray(brand.questions)||brand.questions.length<8) bad('문제(questions)는 8개 이상 넣어 주세요');
  brand.questions.forEach((q,i)=>{ const n=i+1;
    if(!q.q||!q.a) bad(`${n}번 문제에 q(문제) 또는 a(정답)가 없어요`);
    if(!Array.isArray(q.wrong)||q.wrong.length!==4) bad(`${n}번 문제의 wrong(오답)은 정확히 4개여야 해요 (문이 5개라서)`);
    if(new Set([q.a,...q.wrong]).size!==5) bad(`${n}번 문제에 정답과 오답이 겹쳐요`);
    if([q.a,...q.wrong].some((x)=>String(x).length>14)) bad(`${n}번 문제의 보기가 너무 길어요 (14글자 이하)`);
  });
  if(brand.logo&&!/^data:|^https?:/.test(brand.logo)){ // a local image file: put it inside the html
    const f=path.resolve(path.dirname(brandPath),brand.logo), ext=path.extname(f).slice(1).toLowerCase();
    brand.logo=`data:image/${ext==='svg'?'svg+xml':ext==='jpg'?'jpeg':ext};base64,`+fs.readFileSync(f).toString('base64');
  }
}
const tpl=fs.readFileSync('template.html','utf8');
const three=fs.readFileSync('three.min.js','utf8').replace(/^console\.warn\(/,'void (');
const game=(brand?`const BRAND = ${JSON.stringify(brand)};\n`:'')+fs.readdirSync('src').sort().map(f=>`// ---- ${f}\n`+fs.readFileSync('src/'+f,'utf8')).join('\n');
const sbjs=fs.readFileSync('supabase.umd.js','utf8');
const cfgPath=process.env.MR_CONFIG||'online/config.json'; const cfg=brand?{url:'',key:''}:fs.existsSync(cfgPath)?JSON.parse(fs.readFileSync(cfgPath,'utf8')):{url:'',key:''};
const game2=game.replace("'/*SB_URL*/'", ()=>JSON.stringify(cfg.url||'')).replace("'/*SB_KEY*/'", ()=>JSON.stringify(cfg.key||''));
const esc=(s)=>String(s).replace(/[&<>"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let html=tpl.replace('<script>/*THREE*/</script>', ()=>'<script>'+three+'</script>').replace('<script>/*SUPABASE*/</script>', ()=>brand?'':'<script>'+sbjs+'</script>').replace('<script>/*GAME*/</script>', ()=>'<script>\n'+game2+'\n</script>');
if(brand){
  html=html.replace('<title>말랑 레이스</title>',()=>`<title>${esc(brand.title||brand.name)}</title>`);
  fs.mkdirSync('../demo',{recursive:true}); const out=`../demo/${brand.id}.html`;
  fs.writeFileSync(out,html); console.log('ok',out,fs.statSync(out).size);
  process.exit(0);
}
fs.writeFileSync('malang-race.html', html);
console.log('ok', fs.statSync('malang-race.html').size);
// artifact variant: skeleton is provided by the host
let a=fs.readFileSync('malang-race.html','utf8');
a=a.replace(/<!DOCTYPE html>\s*<html lang="ko">\s*<head>\s*<meta charset="utf-8">\s*<meta name="viewport"[^>]*>\s*/,'').replace(/<\/head>\s*<body>/,'').replace(/<\/body>\s*<\/html>\s*$/,'');
a=a.replace('<title>말랑 레이스</title>','<title>말랑 레이스</title>');
fs.writeFileSync('artifact.html', a); console.log('artifact', a.length, a.slice(0,60));
