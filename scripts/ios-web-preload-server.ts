/** Local-only Safari harness. Run Vite on 5173, then this on 8789. It serves the
 * real app with controlled HLS bytes and the production revalidation policy. */
import { fixture } from "@mofied/fixtures";
import { createServer } from "node:http";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
const plan = fixture();
const source = plan.items.find((item) => item.kind === "media")!;
plan.items = Array.from({ length: 5 }, (_, n) => ({
  ...source,
  id: `qa-${n}`,
  mediaId: `qa-${n}`,
  title: `Preload QA ${n + 1}`,
  durationMs: 12000,
  posterUrl: "https://qa.mofied.test/poster.svg",
  playback: {
    url: `https://qa.mofied.test/hls/${n}/master.m3u8`,
    mimeType: "application/vnd.apple.mpegurl" as const,
  },
}));
plan.replacements = [];
const states = new Map<string, unknown>();
mkdirSync("artifacts/preload-research", { recursive: true });
const script = `<script>
const run=new URL(location.href).searchParams.get('qa-run');
if(new URL(location.href).searchParams.get('qa-native')==='1')for(const name of ['MediaSource','ManagedMediaSource','WebKitMediaSource'])Object.defineProperty(window,name,{value:undefined});
const originalFetch=window.fetch.bind(window);
const counts={},completed=new Set(),notices={};let playErrors=0,loadedPlan=null;
const live=new URL(location.href).searchParams.get("qa-live")==="1";
const tracked=url=>url.includes("/hls/")||url.startsWith("https://shorts.faqieh.com/");
const mapped=url=>live&&String(url).includes('/__test/session')?'/__test/session?live=1':typeof url==='string'&&url.startsWith('https://qa.mofied.test/')?location.origin+new URL(url).pathname+'?run='+run:url;
window.fetch=async(url,options)=>{
 const key=String(url);if(tracked(key))counts[key]=(counts[key]||0)+1;
 const response=await originalFetch(mapped(url),options);
 if(mapped(url)!==url)Object.defineProperty(response,'url',{value:url});
 if(key.includes('/__test/session'))response.clone().json().then(value=>loadedPlan=value);
 // Cloning observes completion without changing the application's reader.
 if(tracked(key))response.clone().arrayBuffer().then(()=>completed.add(key)).catch(()=>{});
 return response;
};
const open=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(method,url,...rest){
 const key=String(url);if(tracked(key))counts[key]=(counts[key]||0)+1;
 return open.call(this,method,mapped(url),...rest);
};
const src=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'src');
Object.defineProperty(HTMLMediaElement.prototype,'src',{...src,set(value){src.set.call(this,mapped(value))}});
const imgSrc=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
Object.defineProperty(HTMLImageElement.prototype,'src',{...imgSrc,set(value){imgSrc.set.call(this,mapped(value))}});
const play=HTMLMediaElement.prototype.play;
HTMLMediaElement.prototype.play=function(){const p=play.call(this);p.catch(e=>{if(e.name==='NotAllowedError')playErrors++});return p};
const ids=new WeakMap();let id=0;
setInterval(()=>{
 const video=document.querySelector('video'),main=document.querySelector('main');if(!video||!main)return;
 if(!ids.has(video))ids.set(video,++id);
 const item=main.dataset.itemId;
 const planIndex=loadedPlan?.items.findIndex(entry=>entry.id===item)??-1;
 const current=loadedPlan?.items[planIndex];
 const next=loadedPlan?.items.slice(planIndex+1).find(entry=>entry.kind==='media');
 const currentPrefix=current?.playback?.url.replace(/[^/]+$/,'');
 const nextPrefix=next?.playback?.url.replace(/[^/]+$/,'');
 const segments=path=>path.endsWith('segment-00.ts')||path.endsWith('segment-01.ts')||path.endsWith('segment-00000.m4s')||path.endsWith('segment-00001.m4s');
 const warm=nextPrefix&&[...completed].filter(path=>path.startsWith(nextPrefix)&&segments(path)).length>=2;
 const duplicates=currentPrefix?Object.keys(counts).filter(path=>path.startsWith(currentPrefix)&&(segments(path)||path.endsWith('.m3u8')||path.endsWith('init.mp4'))).reduce((n,path)=>n+Math.max(0,counts[path]-1),0):0;
 if(document.querySelector('.player-status'))notices[item]=(notices[item]||0)+1;
 const state={run,item,video:ids.get(video),time:video.currentTime,muted:video.muted,paused:video.paused,src:video.currentSrc,managed:typeof ManagedMediaSource!=='undefined',cover:!!document.querySelector('[data-page=current] .media-cover'),itemNotices:notices[item]||0,playErrors,status:main.dataset.status,warm:!next||!!warm,nextId:next?.id,duplicateOpeningRequests:duplicates,counts,at:performance.now()};
 originalFetch('/qa/trace',{method:'POST',body:JSON.stringify(state)});
},50);
</script>`;
async function serve(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/__test/session") {
    if (url.searchParams.get("live") === "1") {
      const response = await fetch(
        "https://faqieh.com/api/v1/mofied/session?locale=ar",
        {
          headers: { Origin: "https://mofied.com", Accept: "application/json" },
        },
      );
      return new Response(response.body, {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    return Response.json(plan);
  }
  if (url.pathname === "/qa/state")
    return Response.json(states.get(url.searchParams.get("run")!) ?? {});
  if (url.pathname === "/qa/trace") {
    const raw = await request.text();
    const state = JSON.parse(raw);
    states.set(state.run, state);
    appendFileSync("artifacts/preload-research/ios-trace.jsonl", raw + "\n");
    return new Response("ok");
  }
  if (url.pathname === "/poster.svg")
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="500"><rect width="300" height="500" fill="#674c27"/></svg>',
      { headers: { "Content-Type": "image/svg+xml" } },
    );
  if (url.pathname.startsWith("/hls/")) {
    const name = url.pathname.split("/").at(-1)!;
    return new Response(
      name === "master.m3u8"
        ? "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=400000\nindex.m3u8\n"
        : readFileSync("tests/assets/hls/" + name),
      {
        headers: {
          "Content-Type": name.endsWith("m3u8")
            ? "application/vnd.apple.mpegurl"
            : "video/mp2t",
          "Cache-Control": "public,max-age=0,s-maxage=31536000,must-revalidate",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
  const response = await fetch(
    "http://127.0.0.1:5173" + url.pathname + url.search,
  );
  if (url.pathname === "/")
    return new Response(
      (await response.text()).replace("<head>", "<head>" + script),
      {
        headers: { "Content-Type": "text/html", "Cache-Control": "no-store" },
      },
    );
  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
}
createServer(async (request, response) => {
  try {
    let body = "";
    for await (const chunk of request) body += chunk.toString();
    const result = await serve(
      new Request("http://127.0.0.1:8789" + request.url, {
        method: request.method,
        ...(body ? { body } : {}),
      }),
    );
    const headers = new Headers(result.headers);
    headers.delete("content-encoding");
    headers.delete("content-length");
    response.writeHead(result.status, Object.fromEntries(headers));
    response.end(Buffer.from(await result.arrayBuffer()));
  } catch {
    response.writeHead(500);
    response.end("QA request failed");
  }
}).listen(8789, "127.0.0.1");
console.log("Safari preload QA available on http://127.0.0.1:8789");
