const fs=require('fs');
const tpl=fs.readFileSync('template.html','utf8');
const three=fs.readFileSync('three.min.js','utf8').replace(/^console\.warn\(/,'void (');
const game=fs.readdirSync('src').sort().map(f=>`// ---- ${f}\n`+fs.readFileSync('src/'+f,'utf8')).join('\n');
const sbjs=fs.readFileSync('supabase.umd.js','utf8');
const cfgPath=process.env.MR_CONFIG||'online/config.json'; const cfg=fs.existsSync(cfgPath)?JSON.parse(fs.readFileSync(cfgPath,'utf8')):{url:'',key:''};
const game2=game.replace("'/*SB_URL*/'", ()=>JSON.stringify(cfg.url||'')).replace("'/*SB_KEY*/'", ()=>JSON.stringify(cfg.key||''));
fs.writeFileSync('malang-race.html', tpl.replace('<script>/*THREE*/</script>', ()=>'<script>'+three+'</script>').replace('<script>/*SUPABASE*/</script>', ()=>'<script>'+sbjs+'</script>').replace('<script>/*GAME*/</script>', ()=>'<script>\n'+game2+'\n</script>'));
console.log('ok', fs.statSync('malang-race.html').size);
// artifact variant: skeleton is provided by the host
let a=fs.readFileSync('malang-race.html','utf8');
a=a.replace(/<!DOCTYPE html>\s*<html lang="ko">\s*<head>\s*<meta charset="utf-8">\s*<meta name="viewport"[^>]*>\s*/,'').replace(/<\/head>\s*<body>/,'').replace(/<\/body>\s*<\/html>\s*$/,'');
a=a.replace('<title>말랑 레이스</title>','<title>말랑 레이스</title>');
fs.writeFileSync('artifact.html', a); console.log('artifact', a.length, a.slice(0,60));
