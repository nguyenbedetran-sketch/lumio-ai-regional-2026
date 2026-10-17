async (page) => {
  const checks=[],errors=[],outbound=[],layouts=[],screenshots=[];
  const check=(value,label)=>{if(!value)throw Error(label);checks.push(label)};
  page.on('pageerror',error=>errors.push(error.message));
  try {
    await page.route('**/*',route=>{outbound.push(route.request().url());return route.fulfill({status:409,body:'FIXTURE_NO_NETWORK'})});
    for(const [url,file,type]of [['**/__renderer','fixture.html','text/html'],['**/__renderer.css','fixture.css','text/css']])await page.route(url,route=>route.fulfill({path:'work/content-renderer/'+file,contentType:type}));
    await page.route('**/fonts/KaTeX*',route=>{const match=route.request().url().match(/\/fonts\/(KaTeX[^/?]+\.(?:woff2?|ttf))(?:\?|$)/);return match?route.fulfill({path:'node_modules/katex/dist/fonts/'+match[1]}):route.fulfill({status:404,body:''})});
    await page.setViewportSize({width:1440,height:1000});await page.goto('http://renderer.fixture.test/__renderer');await page.evaluate(()=>document.fonts.ready);
    check(await page.locator('[data-case=lesson] h2').count()===1,'Semantic lesson heading renders once');
    check(await page.locator('[data-case=lesson] ol li').count()===2,'Ordered solution steps are real list items');
    check(await page.locator('[data-case=lesson] table th[scope=col]').count()===2,'Table has accessible column headers');
    check(await page.locator('[data-case=currency] .katex').count()===0,'Currency and escaped dollar text produce no formula');
    check((await page.locator('[data-case=currency]').innerText()).includes('$12.50'),'Currency decimals remain readable');
    check(await page.locator('[data-case=code] .katex').count()===0,'Code examples do not become math');
    check((await page.locator('[data-case=code]').innerText()).includes('\\frac{1}{2}'),'Intentional code retains raw backslash syntax');
    check(await page.locator('[data-case=unsupported] [data-math-fallback]').count()===2,'Unsupported and URL-command math have safe readable fallbacks');
    check(!(await page.locator('[data-case=unsupported]').innerText()).includes('\\href'),'Blocked math command is not default visible fallback');
    check(await page.locator('img,iframe,script').count()===0,'Untrusted fixture content creates no image iframe or script');
    check(await page.locator('[data-case=inline] div,[data-case=inline] p').count()===0,'Inline heading consumer keeps phrasing-only markup');
    check(await page.locator('.katex-mathml math').count()===await page.locator('.katex').count(),'Every rendered formula retains one MathML representation');
    check(await page.locator('.katex-html:not([aria-hidden=true])').count()===0,'Visual KaTeX spans are hidden from duplicate speech');
    const lessonText=await page.locator('[data-case=lesson]').innerText();
    check(!/\\(?:frac|cdot|begin)|\*\*|##|\$/.test(lessonText),'Visible educational prose has no raw formula/Markdown delimiters');
    check(lessonText.includes('Điều kiện')||lessonText.includes('Phương trình'),'Vietnamese lesson accents remain present');
    const nestedGrid=await page.evaluate(()=>{const host=document.createElement('div');host.style.cssText='position:fixed;left:-10000px;top:0;display:grid;grid-template-columns:1fr;width:220px;visibility:hidden;contain:paint';const slot=document.createElement('section'),content=document.querySelector('[data-case=lesson] .lm-rich-content').cloneNode(true);content.append(document.querySelector('[data-case=code] pre').cloneNode(true));slot.append(content);host.append(slot);document.body.append(host);const shape={host:host.getBoundingClientRect().width,slot:slot.getBoundingClientRect().width,content:content.getBoundingClientRect().width,regions:[...content.querySelectorAll('.lm-rich-table-scroll,.lm-math--display,pre')].map(e=>({left:e.getBoundingClientRect().left-content.getBoundingClientRect().left,right:e.getBoundingClientRect().right-content.getBoundingClientRect().right}))};host.remove();return shape});
    check(nestedGrid.slot<=nestedGrid.host+1&&nestedGrid.regions.every(e=>e.left>=-1&&e.right<=1),'Renderer wrappers remain inside nested narrow grid content without shell box-sizing rules '+JSON.stringify(nestedGrid));
    const long=page.locator('[data-case=long] .lm-math--display');
    for(const theme of ['light','dark'])for(const width of [1440,768,390,320]){
      await page.evaluate(theme=>{document.documentElement.dataset.theme=theme},theme);await page.setViewportSize({width,height:1000});
      const shape=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,math:[...document.querySelectorAll('.lm-math--display')].map(e=>({client:e.clientWidth,scroll:e.scrollWidth,overflow:getComputedStyle(e).overflowX,tab:e.tabIndex})),table:[...document.querySelectorAll('.lm-rich-table-scroll')].map(e=>({client:e.clientWidth,scroll:e.scrollWidth,overflow:getComputedStyle(e).overflowX}))}));
      layouts.push({theme,...shape});check(shape.scroll<=shape.client+1,theme+' no page overflow at'+width);
      check(shape.math.every(e=>e.scroll<=e.client+1||['auto','scroll'].includes(e.overflow)),theme+' display equations own their overflow at'+width);
      check(shape.table.every(e=>e.scroll<=e.client+1||['auto','scroll'].includes(e.overflow)),theme+' tables own their overflow at'+width);
      check(await long.evaluate(e=>e.scrollWidth>e.clientWidth),theme+' long equation remains scrollable at'+width);
      if(width===390||width===1440){const file='docs/next/reports/content-renderer/'+theme+'-'+width+'.png';await page.screenshot({path:file,fullPage:true});screenshots.push(file)}
    }
    await long.focus();check(await long.evaluate(e=>document.activeElement===e&&getComputedStyle(e).outlineStyle!=='none'),'Long formula has keyboard focus and visible focus ring');
    const contrasts=[];
    for(const theme of ['light','dark']){
    await page.evaluate(theme=>{document.documentElement.dataset.theme=theme},theme);
    const themeContrasts=await page.evaluate(()=>{
      function rgba(v){const n=v.match(/[\d.]+/g)?.map(Number)||[0,0,0];return[n[0],n[1],n[2],n.length>3?n[3]:1]}
      function blend(a,b){const k=a[3];return[a[0]*k+b[0]*(1-k),a[1]*k+b[1]*(1-k),a[2]*k+b[2]*(1-k),1]}
      function lum(c){return c.slice(0,3).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((s,n,i)=>s+n*[.2126,.7152,.0722][i],0)}
      return ['[data-case=lesson] h2','[data-case=lesson] p','[data-case=lesson] th','[data-case=lesson] caption','[data-case=lesson] .katex-display','[data-case=unsupported] .lm-math-fallback'].map(selector=>{const e=document.querySelector(selector),parents=[];for(let p=e;p;p=p.parentElement)parents.push(p);let bg=[255,255,255,1];for(const p of parents.reverse())bg=blend(rgba(getComputedStyle(p).backgroundColor),bg);const fg=blend(rgba(getComputedStyle(e).color),bg),a=lum(fg),b=lum(bg);return{selector,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)}})
    });
    contrasts.push({theme,samples:themeContrasts});
    check(themeContrasts.every(c=>c.ratio>=4.5),'Actual '+theme+' theme educational text meets4.5contrast in sampled heading/body/table/caption/math/fallback');
    }
    await page.emulateMedia({media:'print'});
    const print=await page.locator('[data-case=lesson]').evaluate(e=>({body:getComputedStyle(e.querySelector('p')).color,math:getComputedStyle(e.querySelector('.katex-display')).color,background:getComputedStyle(e.querySelector('.katex-display')).backgroundColor,overflow:getComputedStyle(e.querySelector('.lm-math--display')).overflowX}));
    check(print.body==='rgb(17, 17, 17)'&&print.math==='rgb(17, 17, 17)'&&print.background==='rgb(255, 255, 255)','Dark-screen content prints with explicit dark ink on white math surfaces');
    check(print.overflow==='visible','Print math region does not retain screen overflow clipping');
    await page.emulateMedia({media:'screen'});
    await page.reload();await page.evaluate(()=>document.fonts.ready);check(await page.locator('[data-case=lesson] .katex').count()>0,'Reloaded SSR lesson retains rendered math');
    check(errors.length===0,'No browser runtime errors');check(outbound.length===0,'No external or provider request was attempted');
    return{status:'PASS',passed:checks.length,checks,errors,outbound,layouts,contrasts,print,screenshots,scope:'Actual shared renderer SSR in real browser with application CSS/localKaTeXfonts and authored fixtures; no server routes, OAuth, user records, model requests, screenreader hardware or all-consumer acceptance. Print checks cover computed styles, not exported PDF pagination.'};
  }catch(error){await page.screenshot({path:'docs/next/reports/content-renderer/failure.png',fullPage:true});return{status:'FAIL',passed:checks.length,checks,error:error.message,errors,outbound,layouts,snapshot:(await page.locator('body').innerText()).slice(-6000)}}
}
