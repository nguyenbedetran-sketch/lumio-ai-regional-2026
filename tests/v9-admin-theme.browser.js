// Actual AdminConsole/AdminGate, no local app server or real network.
async (page) => {
  const checks = [], observations = [], findings = [], errors = [], requests = [], baseline = [];
  const check = (ok, label) => { if (!ok) throw Error(label); checks.push(label); };
  let teacherEmpty = true, failJobs = false, failUsage = false;
  const application = {
    id: "qa-theme-application", userId: "qa-theme-teacher", applicantName: "KIỂM THỬ GIÁO VIÊN", status: "pending", revision: 1,
    submittedAt: "2026-10-17T02:00:00.000Z", updatedAt: "2026-10-17T02:00:00.000Z", reviewedAt: null, reviewNote: null,
    profile: { applicantName: "KIỂM THỬ GIÁO VIÊN", countryCode: "VN", country: "Việt Nam", provinceCity: "Đà Nẵng",
      ward: "Phường kiểm thử", school: "Trường KIỂM THỬ", teachingLevel: "lower_secondary", subjects: ["Toán"],
      teacherDeclaration: true, storageConsent: true, workEmail: "fixture@example.test", publicEvidenceUrl: null }
  };
  const job = { scope: "stored-summary-job-metadata", generatedAt: "2026-10-17T03:00:00.000Z", retainedJobs: 3,
    statuses: { queued: 1, running: 1, retry_wait: 1, paused: 0, completed: 0, cancelled: 0, failed: 0 }, eligiblePending: 2,
    readyNow: 1, delayedRetries: 1, expiredRetained: 0, revokedPending: 1, oldestEligibleWaitSeconds: 300, runningParts: 1,
    expiredRunningLeases: 1, missingRunningLeases: 0, nextRetryAt: "2026-10-17T03:01:00.000Z", backgroundJobsConfigured: true,
    recovery: "owner-access-driven" };
  const aggregate = { requests: 2, errors: 1, inputTokens: null, outputTokens: 0, tokenRecords: 0,
    recordedEstimatedCostUsd: null, costRecords: 0, unpricedRequests: 2, averageLatencyMs: 1200 };
  const attempts = { attempts: 2, responses: 1, unresolved: 1, transportUnknown: 0, httpErrors: 1, inputTokens: null,
    outputTokens: 0, inputTokenRecords: 0, outputTokenRecords: 1, totalTokens: null, totalTokenRecords: 0,
    responseModelRecords: 1, changedModelRecords: 1, averageLatencyMs: 1200, estimatedCostUsd: null, unpricedAttempts: 2 };
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (!url.startsWith("http://localhost:3000/")) return route.abort();
    if (url.endsWith("/__teacher-admin-fixture")) return route.fulfill({ path: "work/v9-admin-theme/fixture.html", contentType: "text/html" });
    if (url.endsWith("/__teacher-admin-fixture.js")) return route.fulfill({ path: "work/v9-admin-theme/fixture.js", contentType: "text/javascript" });
    if (url.endsWith("/__teacher-admin-fixture.css")) return route.fulfill({ path: "work/v9-admin-theme/fixture.css", contentType: "text/css" });
    if (url.endsWith("/__teacher-admin-baseline.css")) return route.fulfill({ path: "work/v9-admin-theme/baseline-admin.css", contentType: "text/css" });
    if (url.includes("/api/")) {
      requests.push({ url: url.replace("http://localhost:3000", ""), method: route.request().method() });
      if (route.request().method() !== "GET") return route.fulfill({ status: 409, json: { error: "FIXTURE_NO_MUTATION" } });
      if (url.includes("/api/admin/teachers")) return route.fulfill({ json: { items: teacherEmpty ? [] : [application], total: teacherEmpty ? 0 : 1, offset: 0, limit: 30 } });
      if (url.includes("/api/admin/jobs")) return route.fulfill(failJobs ? { status: 500, json: { error: "FIXTURE_FAILURE" } } : { json: job });
      if (url.includes("/api/admin/usage")) {
        if (failUsage) return route.fulfill({ status: 500, json: { error: "FIXTURE_FAILURE" } });
        const isAttempts = url.includes("scope=attempts");
        return route.fulfill({ json: isAttempts ? { scope: "recorded-text-provider-attempts", dimension: "model", days: 7,
          firstRetainedAttemptAt: null, retainedAllAges: { attempts: 2, unresolved: 1, unresolvedOutsideWindow: 0 },
          limits: { total: 100000, unresolvedGlobal: 2048, unresolvedPerAccount: 64 }, totals: attempts,
          groups: [{ ...attempts, key: "qa-observed-model", provider: "qa-provider" }], truncated: false, limitations: [] }
          : { scope: "recorded-request-outcomes", dimension: "model", days: 7, totals: aggregate,
              groups: [{ ...aggregate, key: "qa-requested-model", provider: "qa-provider" }], truncated: false, limitations: [] } });
      }
      return route.fulfill({ status: 409, json: { error: "UNPLANNED_SYNTHETIC_REQUEST" } });
    }
    return route.abort();
  });
  async function boot(preference, system) {
    await page.emulateMedia({ colorScheme: system, reducedMotion: "reduce" });
    await page.goto("http://localhost:3000/__teacher-admin-fixture");
    await page.evaluate((preference) => localStorage.setItem("lumio-theme", preference), preference);
    await page.reload();
    await page.locator(".ad-shell").waitFor();
    const value = await page.evaluate(() => ({ saved: localStorage.getItem("lumio-theme"), resolved: document.documentElement.dataset.theme }));
    check(value.saved === preference && value.resolved === (preference === "system" ? system : preference), `Actual bootstrap preserves ${preference} and resolves ${system}`);
  }
  async function observe(label, theme, widths = [320, 390, 768, 1440], selector = ".ad-shell") {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      const scope = page.locator(selector).first(); await scope.waitFor();
      const metrics = await scope.evaluate((root) => {
        const parse = (str) => { const m = /^rgba?\(([^)]+)\)$/.exec(str); return m ? m[1].split(",").map(Number) : null; };
        const luminance = (c) => c.slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
        const ratio = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
        function backgrounds(el) {
          for (let n = el; n; n = n.parentElement) {
            const s = getComputedStyle(n), c = parse(s.backgroundColor);
            const stops = [...s.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map(m => parse(m[0])).filter(c => c && (c.length < 4 || c[3] === 1));
            if (stops.length) return stops;
            if (c && (c.length < 4 || c[3] === 1)) return [c];
          }
          return [[255,255,255]];
        }
        function visible(e) {
          if (!e || e.closest('[aria-hidden="true"],button:disabled,select:disabled,input:disabled,textarea:disabled,svg title,svg defs')) return false;
          for (let n=e;n;n=n.parentElement) { const s=getComputedStyle(n); if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0) return false; }
          return e.getBoundingClientRect().width > 0;
        }
        const text = [], walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node=walker.currentNode,e=node.parentElement, value=node.textContent.trim();
          if(!value||!visible(e)||e.tagName==='OPTION'||e.tagName==='SCRIPT'||e.closest('.ad-sr-only'))continue;
          const s=getComputedStyle(e),c=parse(e instanceof SVGElement?s.fill:s.color);if(!c)continue;
          const minimum=parseFloat(s.fontSize)>=24||(parseFloat(s.fontSize)>=18.67&&Number(s.fontWeight)>=700)?3:4.5;
          text.push({text:value.slice(0,65),selector:e.className?.baseVal||e.className||e.tagName,ratio:Math.min(...backgrounds(e).map(b=>ratio(c,b))),minimum});
        }
        const controls=[...root.querySelectorAll('input,textarea,select,button')].filter(visible), controlSamples=[];
        for(const e of controls){const s=getComputedStyle(e);if(parseFloat(s.borderTopWidth)<=0||s.borderTopStyle==='none')continue;
          const border=parse(s.borderTopColor),fill=parse(s.backgroundColor),outer=backgrounds(e.parentElement);
          if(!border)continue;
          const contrast=Math.min(...outer.map(b=>Math.max(ratio(border,b),fill&&(fill.length<4||fill[3]===1)?ratio(fill,b):1)));
          controlSamples.push({name:e.getAttribute('aria-label')||e.textContent.trim().slice(0,45)||e.placeholder||e.tagName,ratio:contrast});}
        const st=getComputedStyle(root),chart=root.querySelector('.ad-chart svg polyline'), header=root.querySelector('.ad-topbar');
        return {background:st.backgroundColor,text:st.color,colorScheme:st.colorScheme,canonicalCanvas:st.getPropertyValue('--lm-canvas').trim(),
          pageWidth:document.documentElement.scrollWidth,clientWidth:innerWidth,textCount:text.length,controlCount:controlSamples.length,
          protruding:document.documentElement.scrollWidth>innerWidth+2?[...root.querySelectorAll('*')].filter(visible).filter(e=>!e.closest('.ad-table-scroll,.ad-sidebar nav')&&e.getBoundingClientRect().right>innerWidth+2).slice(0,12).map(e=>({tag:e.tagName,cls:e.className,position:getComputedStyle(e).position,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right,text:e.textContent.trim().slice(0,30)})):[],
          minimumText:text.reduce((a,b)=>a.ratio<b.ratio?a:b,{ratio:Infinity}),
          failedText:text.filter(x=>x.ratio+.001<x.minimum).map(x=>({...x,ratio:Math.round(x.ratio*100)/100})),
          failedControls:controlSamples.filter(x=>x.ratio+.001<3).map(x=>({...x,ratio:Math.round(x.ratio*100)/100})),
          minimumControl:controlSamples.reduce((a,b)=>a.ratio<b.ratio?a:b,{ratio:Infinity}),
          clippedHeader:[...(header?.querySelectorAll('button,select')||[])].filter(visible).filter(e=>{const r=e.getBoundingClientRect();return r.left<0||r.right>innerWidth+1}).length,
          chart:chart?{stroke:getComputedStyle(chart).stroke,ratio:Math.min(...backgrounds(chart.parentElement).map(b=>ratio(parse(getComputedStyle(chart).stroke),b)))}:null};
      });
      const focusRoot = page.locator('[role=dialog]').count().then(n=>n?page.locator('[role=dialog]'):scope),
        focusable=(await focusRoot).locator('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary').filter({visible:true}).first();
      let focus=null;
      if(await focusable.count()) {await focusable.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');focus=await page.evaluate(()=>{const e=document.activeElement,s=getComputedStyle(e);return {tag:e.tagName,outline:s.outlineStyle,width:parseFloat(s.outlineWidth),color:s.outlineColor,background:s.backgroundColor};});}
      const record={label,theme,width,...metrics,focus}; observations.push(record);
      for(const [bad,code]of[[metrics.pageWidth>width+2,'PAGE_OVERFLOW'],[metrics.clippedHeader>0,'HEADER_CLIPPED'],[metrics.failedText.length>0,'TEXT_CONTRAST'],[metrics.failedControls.length>0,'CONTROL_CONTRAST'],[!focus||focus.outline==='none'||focus.width<2,'FOCUS'],[metrics.chart&&metrics.chart.ratio<3,'CHART_CONTRAST']])if(bad)findings.push({label,theme,width,code,samples:code==='TEXT_CONTRAST'?metrics.failedText:code==='CONTROL_CONTRAST'?metrics.failedControls:undefined});
      if([390,1440].includes(width)) {await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`docs/v9/role-theme/admin-${label}-${theme}-${width}.png`,fullPage:true});}
    }
  }
  for(const theme of ['light','dark']){
    teacherEmpty=true;await boot(theme,theme==='light'?'dark':'light');
    const initial=await page.evaluate(()=>structuredClone(window.__teacherFixture));
    // Authored nonempty chart and second user exercise existing chart/dialog components.
    initial.dashboard.days=initial.dashboard.days.map((d,i)=>({...d,requests:i%4+1,errors:i%3===0?1:0}));
    initial.dashboard.usage.requests=initial.dashboard.days.reduce((n,d)=>n+d.requests,0);
    initial.dashboard.usage.errors=initial.dashboard.days.reduce((n,d)=>n+d.errors,0);
    initial.users.users.push({...initial.users.users[0],id:'qa-theme-user',name:'TÀI KHOẢN KIỂM THỬ',email:'fixture@example.test',role:'USER'});
    initial.users.total++;
    initial.dashboard.users.total=initial.users.total;
    initial.dashboard.users.active=initial.users.users.filter(u=>!u.disabled).length;
    initial.dashboard.users.disabled=initial.users.users.filter(u=>u.disabled).length;
    initial.dashboard.users.new=initial.users.total;
    await page.evaluate(v=>window.__mountTeacherAdmin('admin',v),initial);
    await page.waitForFunction((count)=>document.querySelector('.ad-chart svg')?.getAttribute('aria-label')===`Hoạt động AI 14 ngày: ${count} yêu cầu`,initial.dashboard.usage.requests);
    await page.waitForFunction((count)=>document.querySelector('.ad-account-summary strong')?.textContent===String(count),initial.dashboard.users.active);
    check(await page.locator('.ad-stats .ad-metric').nth(1).locator('strong').textContent()===String(initial.dashboard.usage.requests),'Authored chart sum matches displayed request aggregate');
    await observe('overview',theme);
    await page.getByRole('button',{name:'Kiểm tra hàng đợi',exact:true}).click();
    await page.getByText('Trạng thái tác vụ còn lưu, bao gồm bản đã hết hạn chờ dọn',{exact:true}).waitFor();
    await observe('jobs',theme,[390,1440]);
    failJobs=true;await page.getByRole('button',{name:'Kiểm tra hàng đợi',exact:true}).click();
    await page.getByText('Chưa đọc được trạng thái hàng đợi. Thử lại sau.',{exact:true}).waitFor();
    await observe('jobs-error',theme,[390,1440]);failJobs=false;
    await page.getByRole('button',{name:/^Người dùng/}).click();
    await page.locator('tr').filter({hasText:'TÀI KHOẢN KIỂM THỬ'}).getByRole('button',{name:'Tạm khóa',exact:true}).click();
    await page.getByRole('textbox',{name:'Lý do thay đổi',exact:true}).fill('Lý do KIỂM THỬ, không thay đổi tài khoản thật.');
    await observe('access-dialog',theme,[320,390,768,1440]);
    check((await page.getByRole('dialog').innerText()).includes('KIỂM THỬ'),'Actual account-review dialog retains authored identity');
    await page.getByRole('button',{name:'Hủy',exact:true}).click();
    await page.getByRole('button',{name:'Xét duyệt giáo viên',exact:true}).click();
    await page.getByText('Không có hồ sơ đang chờ',{exact:true}).waitFor();
    await observe('teacher-empty',theme,[390,1440]);
    teacherEmpty=false;await page.getByRole('button',{name:'Làm mới hồ sơ giáo viên',exact:true}).click();
    await page.getByRole('button',{name:'Xem hồ sơ KIỂM THỬ GIÁO VIÊN',exact:true}).click();
    await page.getByRole('button',{name:'Duyệt hồ sơ',exact:true}).click();
    await page.getByRole('textbox',{name:'Ghi chú xét duyệt',exact:true}).fill('Đối chiếu hồ sơ KIỂM THỬ, chưa gửi quyết định.');
    // Accepted CSS is loaded only in this isolated fixture to distinguish an
    // existing clipped-table absolute-position leak from the new theme work.
    await page.evaluate(()=>new Promise((resolve,reject)=>{const l=document.createElement('link');l.id='accepted-admin-css';l.rel='stylesheet';l.href='/__teacher-admin-baseline.css';l.onload=()=>{document.querySelector('link[href="/__teacher-admin-fixture.css"]').disabled=true;resolve();};l.onerror=reject;document.head.append(l);}));
    for(const width of [320,390]){await page.setViewportSize({width,height:1000});baseline.push({theme,width,...await page.evaluate(()=>({pageWidth:document.documentElement.scrollWidth,hiddenLabels:[...document.querySelectorAll('.ad-sr-only')].map(e=>({text:e.textContent,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right,position:getComputedStyle(e).position}))}))});}
    await page.evaluate(()=>{document.querySelector('link[href="/__teacher-admin-fixture.css"]').disabled=false;document.getElementById('accepted-admin-css').remove();});
    await observe('teacher-review',theme);
    await page.getByRole('button',{name:'Hoạt động AI',exact:true}).click();
    await page.locator('.ad-usage-breakdown>summary').click();
    await page.getByRole('button',{name:'Xem báo cáo',exact:true}).click();
    await page.getByText('qa-requested-model',{exact:true}).waitFor();
    await observe('usage-outcomes',theme,[320,390,768,1440]);
    await page.getByRole('combobox',{name:'Loại báo cáo',exact:false}).selectOption('attempts');
    await page.getByRole('button',{name:'Xem báo cáo',exact:true}).click();
    await page.getByText('qa-observed-model',{exact:true}).waitFor();
    await observe('usage-attempts',theme,[390,1440]);
    failUsage=true;await page.getByRole('button',{name:'Xem báo cáo',exact:true}).click();
    await page.getByText('Chưa tải được báo cáo. Bạn có thể thử lại.',{exact:true}).waitFor();
    await observe('usage-error',theme,[390,1440]);failUsage=false;
    await page.evaluate(()=>window.__mountGate());
    await observe('gate',theme,[320,390,768,1440],'.ad-gate');
  }
  for(const system of ['light','dark']){
    await boot('system',system);await observe('system',system,[390,1440]);
  }
  check(errors.length===0,'No React/browser page errors in actual rendered fixture');
  check(requests.every(r=>r.method==='GET'),'Theme and confirmations do not cause any mutation');
  const compared=observations.filter(r=>r.label==='overview'&&r.width===1440);
  check(compared[0].background!==compared[1].background,'Admin root changes between canonical light and dark surfaces');
  check(observations.every(r=>r.colorScheme===r.theme),'Native controls inherit the resolved theme color-scheme');
  return {status:findings.length?'FINDINGS':'PASS',passed:checks.length,cases:checks,observations,baseline,findings,errors,
    requestCount:requests.length,realProviderCalls:0,scope:'Actual components/CSS, local intercepted HTTP and authored synthetic data; no real account, private database, provider, public server, device or screen-reader proof.'};
}
