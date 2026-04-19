// Pattern Pilot — Plugin Backend
// Figma nodes are created ONLY when "Insert into Figma" is clicked.

figma.showUI(__html__, { width: 720, height: 640, title: "Pattern Pilot" });

// ─── Font loader ───────────────────────────────────────────────────────────
async function loadFonts() {
  for (const f of [
    {family:"Inter",style:"Regular"},
    {family:"Inter",style:"Medium"},
    {family:"Inter",style:"Semi Bold"},
    {family:"Inter",style:"Bold"},
  ]) {
    try { await figma.loadFontAsync(f); } catch(e) {}
  }
}

// ─── Colour helpers ────────────────────────────────────────────────────────
function rgb(hex) {
  const h = hex.replace("#","");
  return { r:parseInt(h.slice(0,2),16)/255, g:parseInt(h.slice(2,4),16)/255, b:parseInt(h.slice(4,6),16)/255 };
}
function solid(hex, a) {
  return [{ type:"SOLID", color:rgb(hex), opacity:a===undefined?1:a }];
}
function border(hex, weight) {
  return { strokes:[{type:"SOLID",color:rgb(hex)}], strokeWeight:weight||1, strokeAlign:"INSIDE" };
}

// ─── Auto Layout frame factory ─────────────────────────────────────────────
// Returns a frame already appended to parent (if given) with Auto Layout set.
function alFrame(opts) {
  // opts: { name, w, h, bg, dir, gap, pl, pr, pt, pb, main, cross, wrap, clip, radius }
  const f = figma.createFrame();
  f.name        = opts.name || "Frame";
  f.layoutMode  = opts.dir || "VERTICAL";
  f.itemSpacing = opts.gap !== undefined ? opts.gap : 0;
  f.paddingLeft   = opts.pl !== undefined ? opts.pl : (opts.pad || 0);
  f.paddingRight  = opts.pr !== undefined ? opts.pr : (opts.pad || 0);
  f.paddingTop    = opts.pt !== undefined ? opts.pt : (opts.pad || 0);
  f.paddingBottom = opts.pb !== undefined ? opts.pb : (opts.pad || 0);
  f.primaryAxisAlignItems   = opts.main  || "MIN";
  f.counterAxisAlignItems   = opts.cross || "MIN";
  f.primaryAxisSizingMode   = opts.w ? "FIXED" : "AUTO";
  f.counterAxisSizingMode   = opts.h ? "FIXED" : "AUTO";
  if (opts.w) f.resize(opts.w, f.height || 1);
  if (opts.h) f.resize(f.width, opts.h);
  if (opts.w && opts.h) f.resize(opts.w, opts.h);
  f.fills       = (opts.bg && opts.bg !== "transparent") ? solid(opts.bg) : [];
  f.clipsContent = opts.clip !== false;
  if (opts.radius) f.cornerRadius = opts.radius;
  if (opts.parent) opts.parent.appendChild(f);
  return f;
}

// Child sizing helpers — guarded so they never throw when parent lacks Auto Layout
function fill(node) {
  try { node.layoutSizingHorizontal = "FILL"; } catch(e) {}
  return node;
}
function hug(node) {
  try { node.layoutSizingHorizontal = "HUG"; } catch(e) {}
  return node;
}
function fillV(node) {
  try { node.layoutSizingVertical = "FILL"; } catch(e) {}
  return node;
}

// Text node
function txt(str, size, weight, hex, opts) {
  const map = {Regular:"Regular", Medium:"Medium", SemiBold:"Semi Bold", Bold:"Bold"};
  const t = figma.createText();
  t.fontName  = {family:"Inter", style:map[weight]||"Regular"};
  t.characters = String(str);
  t.fontSize  = size;
  t.fills     = solid(hex);
  if (opts && opts.lineHeight) t.lineHeight = {value:opts.lineHeight, unit:"PIXELS"};
  if (opts && opts.align)      t.textAlignHorizontal = opts.align;
  return t;
}

// Rect node
function rect(w, h, hex, radius, alpha) {
  const r = figma.createRectangle();
  r.resize(w, h);
  r.fills = solid(hex, alpha);
  if (radius) r.cornerRadius = radius;
  return r;
}

// Image placeholder
function imgBlock(name, bg) {
  const f = alFrame({name:name||"Image Placeholder", bg:bg||"#E2E8F0", dir:"VERTICAL", main:"CENTER", cross:"CENTER"});
  try { f.layoutSizingHorizontal = "FILL"; } catch(e) {}
  try { f.layoutSizingVertical   = "FILL"; } catch(e) {}
  const em = txt("🖼", 24, "Regular", bg||"#CBD5E1");
  em.name = "Placeholder Icon";
  em.textAlignHorizontal = "CENTER";
  try { em.layoutSizingHorizontal = "FILL"; } catch(e) {}
  f.appendChild(em);
  return f;
}

// Button (auto-sized)
function btnNode(label, bg, textHex, pl, pt, radius) {
  const f = alFrame({name:"Button", dir:"HORIZONTAL", main:"CENTER", cross:"CENTER",
    bg:bg&&bg!=="none"?bg:undefined, pl:pl||20, pr:pl||20, pt:pt||10, pb:pt||10,
    radius:radius!==undefined?radius:6});
  if (!bg || bg==="none") {
    f.fills = [];
    f.strokeWeight = 1.5;
    f.strokes = [{type:"SOLID",color:rgb(textHex||"#111827")}];
  }
  f.appendChild(txt(label, 14, "SemiBold", textHex||"#FFFFFF"));
  return f;
}

// Pill badge
function pillNode(label, bg, textHex) {
  const f = alFrame({name:"Badge", dir:"HORIZONTAL", main:"CENTER", cross:"CENTER",
    bg:bg, pl:10, pr:10, pt:4, pb:4, radius:9999});
  f.appendChild(txt(label, 12, "Medium", textHex||"#111827"));
  return f;
}

// ─── NAV helper ────────────────────────────────────────────────────────────
function buildNav(W, bg, logoBg, linkColor, btnBg, btnText, borderColor) {
  const nav = alFrame({name:"Nav", dir:"HORIZONTAL", bg, w:W,
    pl:40, pr:40, pt:16, pb:16,
    main:"SPACE_BETWEEN", cross:"CENTER"});
  if (borderColor) {
    nav.strokes = [{type:"SOLID",color:rgb(borderColor)}];
    nav.strokeWeight = 1; nav.strokeAlign = "INSIDE";
  }

  // Logo (always shown)
  const logo = alFrame({name:"Logo", dir:"HORIZONTAL", cross:"CENTER", gap:8, pl:0, pr:0, pt:0, pb:0});
  if(logoBg && logoBg !== "transparent") logo.appendChild(rect(28,28,logoBg,8));
  logo.appendChild(txt("Brand", 16, "Bold", logoBg==="transparent"?"#111827":logoBg||"#111827"));
  nav.appendChild(logo);

  if(W <= 480) {
    // Mobile: hamburger only
    const burger = alFrame({name:"Menu", dir:"VERTICAL", gap:5, pl:8, pr:8, pt:6, pb:6, main:"CENTER", cross:"CENTER"});
    [0,1,2].forEach(()=>{ const line=figma.createRectangle(); line.resize(20,2); line.fills=solid(linkColor||"#6B7280"); burger.appendChild(line); });
    nav.appendChild(burger);
    return nav;
  }

  // Links
  const links = alFrame({name:"NavLinks", dir:"HORIZONTAL", gap:28, pl:0,pr:0,pt:0,pb:0, cross:"CENTER"});
  ["Features","Pricing","About","Blog"].forEach(l => links.appendChild(txt(l,14,"Medium",linkColor||"#6B7280")));
  nav.appendChild(links);

  // CTA
  nav.appendChild(btnNode("Get started", btnBg||"#111827", btnText||"#FFFFFF",18,9,6));
  return nav;
}

// ─── Section builders — one function per style key ─────────────────────────
// Each receives W (width number) and returns a Frame.

const BUILDERS = {

  // ── NAV BAR ──────────────────────────────────────────────────────────────
  "nav-1": W => buildNav(W,"#FFFFFF","transparent","#6B7280","#111827","#FFFFFF","#E5E7EB"),
  "nav-2": W => buildNav(W,"#0F172A","#6366F1","#94A3B8","#6366F1","#FFFFFF","#1E293B"),
  "nav-3": W => {
    const nav = alFrame({name:"Nav — Centred Logo", dir:"HORIZONTAL", bg:"#FFFFFF", w:W,
      pl:40, pr:40, pt:16, pb:16, main:"SPACE_BETWEEN", cross:"CENTER"});
    nav.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; nav.strokeWeight=1; nav.strokeAlign="INSIDE";
    if(W <= 480) {
      nav.appendChild(txt("ACME", 18, "Bold", "#111827"));
      const burger = alFrame({name:"Menu", dir:"VERTICAL", gap:5, pl:8, pr:8, pt:6, pb:6, main:"CENTER", cross:"CENTER"});
      [0,1,2].forEach(()=>{ const line=figma.createRectangle(); line.resize(20,2); line.fills=solid("#374151"); burger.appendChild(line); });
      nav.appendChild(burger);
      return nav;
    }
    const leftLinks = alFrame({name:"Left", dir:"HORIZONTAL", gap:28, pl:0,pr:0,pt:0,pb:0, cross:"CENTER"});
    ["Work","About"].forEach(l=>leftLinks.appendChild(txt(l,14,"Medium","#374151")));
    nav.appendChild(leftLinks);
    nav.appendChild(txt("ACME", 18, "Bold", "#111827"));
    const rightLinks = alFrame({name:"Right", dir:"HORIZONTAL", gap:20, pl:0,pr:0,pt:0,pb:0, cross:"CENTER"});
    ["Blog","Careers"].forEach(l=>rightLinks.appendChild(txt(l,14,"Medium","#374151")));
    rightLinks.appendChild(btnNode("Login","none","#374151",14,8,6));
    nav.appendChild(rightLinks);
    return nav;
  },
  "nav-4": W => buildNav(W,"#7C3AED","#FFFFFF","#DDD6FE","#FFFFFF","#7C3AED",undefined),
  "nav-5": W => {
    const nav = buildNav(W,"#F8FAFC","transparent","#475569","#0F172A","#FFFFFF","#E2E8F0");
    if(W > 480) {
      // Insert badge before CTA
      const badge = pillNode("New v3.0","#EDE9FE","#7C3AED");
      nav.insertChild(nav.children.length-1, badge);
    }
    return nav;
  },
  "nav-6": W => {
    const wrapper = alFrame({name:"Nav — Announcement", dir:"VERTICAL", bg:"#FFFFFF", w:W});
    wrapper.primaryAxisSizingMode="AUTO"; wrapper.counterAxisSizingMode="FIXED";
    // Announcement bar
    const bar = alFrame({name:"AnnouncementBar", dir:"HORIZONTAL", bg:"#1D4ED8",
      w:W, h:32, main:"CENTER", cross:"CENTER"});
    bar.primaryAxisSizingMode = "FIXED"; bar.counterAxisSizingMode = "FIXED";
    const barTxt = txt("🎉  New feature just launched — read the announcement →", 12, "Medium", "#BFDBFE");
    barTxt.textAlignHorizontal = "CENTER";
    bar.appendChild(barTxt);
    try{ barTxt.layoutSizingHorizontal = "FILL"; }catch(e){}
    wrapper.appendChild(bar);
    wrapper.appendChild(buildNav(W,"#FFFFFF","transparent","#6B7280","#111827","#FFFFFF","#E5E7EB"));
    return wrapper;
  },

  // ── FOOTER ───────────────────────────────────────────────────────────────
  "footer-1": W => {
    const f = alFrame({name:"Footer — 4 Col", dir:"VERTICAL", bg:"#111827", w:W,
      pl:40, pr:40, pt:40, pb:40, gap:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const cols = alFrame({name:"Columns", dir:"HORIZONTAL", gap:32, pt:0,pb:0,pl:0,pr:0, main:"SPACE_BETWEEN"});
    [["Product",["Features","Pricing","Changelog","Roadmap"]],
     ["Company",["About","Blog","Careers","Press"]],
     ["Resources",["Docs","API","Community","Status"]],
     ["Legal",["Privacy","Terms","Cookies","Security"]]
    ].forEach(([title,items])=>{
      const col = alFrame({name:title, dir:"VERTICAL", gap:10, pl:0,pr:0,pt:0,pb:0});
      col.appendChild(txt(title,12,"Bold","#9CA3AF"));
      items.forEach(i=>col.appendChild(txt(i,14,"Regular","#6B7280")));
      cols.appendChild(col);
      fill(col);
    });
    f.appendChild(cols);
    fill(cols);
    const bottom = alFrame({name:"Bottom", dir:"HORIZONTAL", pt:24,pb:0,pl:0,pr:0, main:"SPACE_BETWEEN", cross:"CENTER"});
    bottom.strokes=[{type:"SOLID",color:rgb("#1F2937")}]; bottom.strokeTopWeight=1; bottom.strokeRightWeight=0; bottom.strokeBottomWeight=0; bottom.strokeLeftWeight=0;
    bottom.appendChild(txt("© 2025 Brand Inc.", 12, "Regular", "#4B5563"));
    f.appendChild(bottom); fill(bottom);
    return f;
  },
  "footer-2": W => {
    const stack = W <= 768;
    const f = alFrame({name:"Footer — Slim Rule", dir:stack?"VERTICAL":"HORIZONTAL", bg:"#F9FAFB", w:W,
      pl:40, pr:40, pt:40, pb:40, gap:stack?12:0, main:stack?"MIN":"SPACE_BETWEEN", cross:"CENTER"});
    if(stack){ f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED"; }
    f.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; f.strokeWeight=1; f.strokeAlign="OUTSIDE";
    f.appendChild(txt("Brand",14,"Bold","#111827"));
    const links = alFrame({name:"Links",dir:"HORIZONTAL",gap:32,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"});
    ["Privacy","Terms","Contact","Status"].forEach(l=>links.appendChild(txt(l,14,"Regular","#6B7280")));
    f.appendChild(links);
    f.appendChild(txt("© 2025",12,"Regular","#9CA3AF"));
    return f;
  },
  "footer-3": W => {
    const f = alFrame({name:"Footer — Newsletter", dir:"VERTICAL", bg:"#0F172A", w:W,
      pl:40, pr:40, pt:40, pb:40, gap:24, cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    f.counterAxisAlignItems = "CENTER";
    f.appendChild(txt("Stay in the loop",22,"Bold","#FFFFFF",{align:"CENTER"}));
    f.appendChild(txt("Get updates on new features and releases.",14,"Regular","#94A3B8",{align:"CENTER"}));
    const row = alFrame({name:"Subscribe", dir:W<=480?"VERTICAL":"HORIZONTAL", gap:10, pl:0,pr:0,pt:0,pb:0, cross:"CENTER"});
    const input = alFrame({name:"Input", dir:"HORIZONTAL", bg:"#1E293B", gap:0, pl:16,pr:16,pt:10,pb:10, cross:"CENTER", radius:6});
    input.strokes=[{type:"SOLID",color:rgb("#334155")}]; input.strokeWeight=1;
    const ph = txt("Enter your email",14,"Regular","#475569");
    ph.resize(W>900?300:200, 20);
    input.appendChild(ph);
    row.appendChild(input); if(W<=480) fill(input);
    const subBtn = btnNode("Subscribe","#6366F1","#FFFFFF",18,10,6);
    row.appendChild(subBtn); if(W<=480) fill(subBtn);
    f.appendChild(row); if(W<=480) fill(row);
    const bottom = alFrame({name:"Bottom", dir:"VERTICAL", gap:12, pl:0,pr:0,pt:20,pb:0, cross:"CENTER"});
    bottom.strokes=[{type:"SOLID",color:rgb("#1E293B")}]; bottom.strokeTopWeight=1; bottom.strokeRightWeight=0; bottom.strokeBottomWeight=0; bottom.strokeLeftWeight=0;
    const linkRow = alFrame({name:"Links",dir:"HORIZONTAL",gap:28,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"});
    ["Privacy","Terms","About","Blog"].forEach(l=>linkRow.appendChild(txt(l,12,"Regular","#6B7280")));
    bottom.appendChild(linkRow);
    bottom.appendChild(txt("© 2025 Brand Inc. All rights reserved.",12,"Regular","#374151",{align:"CENTER"}));
    f.appendChild(bottom); fill(bottom);
    return f;
  },
  "footer-4": W => {
    const mobile = W <= 480;
    const f = alFrame({name:"Footer — Social", dir:mobile?"VERTICAL":"HORIZONTAL", bg:"#FFFFFF", w:W,
      pl:40, pr:40, pt:40, pb:40, gap:40, main:mobile?"MIN":"SPACE_BETWEEN"});
    if(mobile){ f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED"; }
    f.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; f.strokeWeight=1; f.strokeAlign="OUTSIDE";
    // Brand block
    const left = alFrame({name:"Brand", dir:"VERTICAL", gap:12, pl:0,pr:0,pt:0,pb:0});
    left.appendChild(txt("Brand",18,"Bold","#111827"));
    left.appendChild(txt("Making the internet a better place.",14,"Regular","#6B7280"));
    const socials = alFrame({name:"Socials",dir:"HORIZONTAL",gap:8,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"});
    ["𝕏","in","gh","yt"].forEach(s=>{
      const ic = alFrame({name:s,dir:"HORIZONTAL",bg:"#F3F4F6",pl:8,pr:8,pt:6,pb:6,radius:6,main:"CENTER",cross:"CENTER"});
      ic.appendChild(txt(s,12,"Medium","#374151"));
      socials.appendChild(ic);
    });
    left.appendChild(socials);
    f.appendChild(left); fill(left);
    // Cols
    const cols = alFrame({name:"Cols",dir:"HORIZONTAL",gap:40,pl:0,pr:0,pt:0,pb:0,main:"SPACE_BETWEEN"});
    [["Product",["Features","Pricing","Changelog"]],
     ["Company",["About","Blog","Careers"]],
     ["Support",["Docs","Status","Contact"]]
    ].forEach(([title,items])=>{
      const col = alFrame({name:title,dir:"VERTICAL",gap:10,pl:0,pr:0,pt:0,pb:0});
      col.appendChild(txt(title,12,"Bold","#9CA3AF"));
      items.forEach(i=>col.appendChild(txt(i,14,"Regular","#6B7280")));
      cols.appendChild(col); fill(col);
    });
    f.appendChild(cols); fill(cols);
    return f;
  },
  "footer-5": W => {
    const f = alFrame({name:"Footer — Centred", dir:"VERTICAL", bg:"#0F172A", w:W,
      pl:40, pr:40, pt:40, pb:40, gap:20, cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    f.counterAxisAlignItems = "CENTER";
    f.appendChild(txt("Brand",19,"Bold","#FFFFFF",{align:"CENTER"}));
    const linkRow = alFrame({name:"Links",dir:"HORIZONTAL",gap:28,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"});
    ["Features","Pricing","About","Blog","Docs","Contact"].forEach(l=>linkRow.appendChild(txt(l,14,"Regular","#9CA3AF")));
    if(W<=480) linkRow.layoutWrap="WRAP";
    f.appendChild(linkRow);
    if(W<=480){ fill(linkRow); linkRow.primaryAxisAlignItems="CENTER"; }
    const div = rect(Math.round(W*.7),1,"#1E1B4B"); f.appendChild(div);
    f.appendChild(txt("Built with care. © 2025 Brand Inc.",12,"Regular","#4B5563",{align:"CENTER"}));
    return f;
  },
  "footer-6": W => {
    const f = alFrame({name:"Footer — Mega", dir:"VERTICAL", bg:"#111827", w:W,
      pl:40, pr:40, pt:40, pb:40, gap:32});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const top = alFrame({name:"Top",dir:W<=480?"VERTICAL":"HORIZONTAL",gap:W<=480?24:48,pl:0,pr:0,pt:0,pb:0,main:W<=480?"MIN":"SPACE_BETWEEN"});
    const brand = alFrame({name:"Brand",dir:"VERTICAL",gap:12,pl:0,pr:0,pt:0,pb:0});
    const brandTitle=txt("Brand",18,"Bold","#FFFFFF"); fill(brandTitle); brand.appendChild(brandTitle);
    const brandSub=txt("Build better, ship faster.",14,"Regular","#6B7280"); fill(brandSub); brand.appendChild(brandSub);
    const tags = alFrame({name:"Tags",dir:"HORIZONTAL",gap:6,pl:0,pr:0,pt:0,pb:0});
    ["#product","#design","#dev"].forEach(t=>tags.appendChild(pillNode(t,"#1F2937","#6B7280")));
    fill(tags); brand.appendChild(tags);
    top.appendChild(brand); fill(brand);
    const cols = alFrame({name:"Cols",dir:"HORIZONTAL",gap:36,pl:0,pr:0,pt:0,pb:0});
    [["Product",["Features","Pricing","Changelog","Integrations"]],
     ["Company",["About","Blog","Careers","Press"]],
     ["Resources",["Docs","API","Status","Community"]],
     ["Legal",["Privacy","Terms","Cookies","Security"]]
    ].forEach(([title,items])=>{
      const col=alFrame({name:title,dir:"VERTICAL",gap:10,pl:0,pr:0,pt:0,pb:0});
      col.appendChild(txt(title,10,"Bold","#9CA3AF"));
      items.forEach(i=>col.appendChild(txt(i,14,"Regular","#6B7280")));
      cols.appendChild(col); fill(col);
    });
    top.appendChild(cols); fill(cols);
    f.appendChild(top); fill(top);
    const bot = alFrame({name:"Bottom",dir:W<=480?"VERTICAL":"HORIZONTAL",pt:20,pb:0,pl:0,pr:0,main:W<=480?"MIN":"SPACE_BETWEEN",cross:"CENTER"});
    bot.strokes=[{type:"SOLID",color:rgb("#1F2937")}]; bot.strokeTopWeight=1; bot.strokeRightWeight=0; bot.strokeBottomWeight=0; bot.strokeLeftWeight=0;
    bot.appendChild(txt("© 2025 Brand Inc. All rights reserved.",12,"Regular","#4B5563"));
    const botLinks=alFrame({name:"BotLinks",dir:"HORIZONTAL",gap:20,pl:0,pr:0,pt:0,pb:0});
    ["Privacy","Terms","Sitemap"].forEach(l=>botLinks.appendChild(txt(l,12,"Regular","#6B7280")));
    bot.appendChild(botLinks);
    f.appendChild(bot); fill(bot);
    return f;
  },

  // ── HERO SPLIT ───────────────────────────────────────────────────────────
  "split-1": W => {
    const mobile=W<=480;
    const f = alFrame({name:"Hero — Split Horizon", dir:mobile?"VERTICAL":"HORIZONTAL", bg:"#FFFFFF", w:W});
    if(mobile){ f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED"; } else { f.counterAxisSizingMode="AUTO"; }
    const left = alFrame({name:"Copy",dir:"VERTICAL",gap:24,pl:40,pr:40,pt:40,pb:40});
    f.appendChild(left); fill(left);
    left.appendChild(pillNode("✨ New release","#EFF6FF","#2563EB"));
    const h1=txt("Ship faster\nthan ever before.",48,"Bold","#111827",{lineHeight:56}); left.appendChild(h1); fill(h1);
    const sd1=txt("The platform that helps modern teams\ncollaborate and deliver.",18,"Regular","#6B7280",{lineHeight:26}); left.appendChild(sd1); fill(sd1);
    const ctaRow = alFrame({name:"CTA",dir:"HORIZONTAL",gap:10,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"});
    ctaRow.appendChild(btnNode("Start free →","#111827","#FFFFFF",22,12,6));
    ctaRow.appendChild(btnNode("Watch demo","none","#374151",22,12,6));
    left.appendChild(ctaRow);
    const imgF = imgBlock("Image Placeholder","#F1F5F9");
    f.appendChild(imgF); if(mobile){ imgF.resize(1,300); imgF.primaryAxisSizingMode="FIXED"; fill(imgF); } else { fill(imgF); fillV(imgF); }
    return f;
  },
  "split-2": W => {
    const mobile=W<=480;
    const f = alFrame({name:"Hero — Mirror Shift", dir:mobile?"VERTICAL":"HORIZONTAL", bg:"#0F172A", w:W});
    if(mobile){ f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED"; } else { f.counterAxisSizingMode="AUTO"; }
    const imgF = imgBlock("Image Placeholder","#1E293B");
    f.appendChild(imgF); if(mobile){ imgF.resize(1,300); imgF.primaryAxisSizingMode="FIXED"; fill(imgF); } else { fill(imgF); fillV(imgF); }
    const right = alFrame({name:"Copy",dir:"VERTICAL",gap:24,pl:40,pr:40,pt:40,pb:40});
    f.appendChild(right); fill(right);
    const h2=txt("Design systems\nthat scale.",48,"Bold","#F1F5F9",{lineHeight:56}); right.appendChild(h2); fill(h2);
    const sd2=txt("Built for teams that care about craft,\nconsistency and speed.",18,"Regular","#94A3B8",{lineHeight:26}); right.appendChild(sd2); fill(sd2);
    right.appendChild(btnNode("Explore work →","#6366F1","#FFFFFF",22,12,6));
    return f;
  },
  "split-3": W => {
    const mobile=W<=480;
    const f = alFrame({name:"Hero — Bold Ratio", dir:mobile?"VERTICAL":"HORIZONTAL", bg:"#FAFAFA", w:W});
    if(mobile){ f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED"; } else { f.counterAxisSizingMode="AUTO"; }
    const left = alFrame({name:"Copy",dir:"VERTICAL",gap:24,pl:40,pr:40,pt:40,pb:40});
    f.appendChild(left); fill(left);
    left.appendChild(pillNode("New","#EDE9FE","#7C3AED"));
    const h3=txt("Creative solutions\nfor bold brands.",44,"Bold","#111827",{lineHeight:52}); left.appendChild(h3); fill(h3);
    const sd3=txt("We partner with ambitious teams\nto build products that matter.",16,"Regular","#6B7280",{lineHeight:24}); left.appendChild(sd3); fill(sd3);
    left.appendChild(btnNode("Get started","#7C3AED","#FFFFFF",22,12,8));
    const imgF = imgBlock("Image Placeholder","#E5E7EB");
    f.appendChild(imgF); if(mobile){ imgF.resize(1,300); imgF.primaryAxisSizingMode="FIXED"; fill(imgF); } else { fill(imgF); fillV(imgF); }
    return f;
  },
  "split-4": W => {
    const mobile=W<=480;
    const f = alFrame({name:"Hero — Editorial Cut", dir:mobile?"VERTICAL":"HORIZONTAL", bg:"#111827", w:W});
    if(mobile){ f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED"; }
    else { f.counterAxisSizingMode="AUTO"; f.counterAxisAlignItems="CENTER"; }
    const imgF = imgBlock("Image Placeholder","#1F2937");
    f.appendChild(imgF); if(mobile){ imgF.resize(1,300); imgF.primaryAxisSizingMode="FIXED"; fill(imgF); } else { fill(imgF); fillV(imgF); }
    const right = alFrame({name:"Copy",dir:"VERTICAL",gap:24,pl:40,pr:40,pt:40,pb:40});
    right.fills = solid("#0F172A");
    f.appendChild(right); fill(right); right.primaryAxisSizingMode="AUTO";
    const h4=txt("Visual stories\nthat move people.",42,"Bold","#FFFFFF",{lineHeight:50}); right.appendChild(h4); fill(h4);
    const sd4=txt("Photography · Film · Direction",14,"Regular","#6B7280"); right.appendChild(sd4); fill(sd4);
    right.appendChild(btnNode("View portfolio →","#FFFFFF","#0F172A",22,12,0));
    return f;
  },
  "split-5": W => {
    const mobile=W<=480;
    const f = alFrame({name:"Hero — Colour Divide", dir:mobile?"VERTICAL":"HORIZONTAL", bg:"#6366F1", w:W});
    if(mobile){ f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED"; } else { f.counterAxisSizingMode="AUTO"; }
    const left = alFrame({name:"Copy",dir:"VERTICAL",gap:24,pl:40,pr:40,pt:40,pb:40});
    f.appendChild(left); fill(left);
    const h5=txt("Intelligent tools\nfor smart teams.",46,"Bold","#FFFFFF",{lineHeight:54}); left.appendChild(h5); fill(h5);
    const sd5=txt("Automate the boring. Focus on what matters.",16,"Regular","#C7D2FE",{lineHeight:24}); left.appendChild(sd5); fill(sd5);
    const ctaRow=alFrame({name:"CTA",dir:"HORIZONTAL",gap:10,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"});
    ctaRow.appendChild(btnNode("Try for free","#FFFFFF","#6366F1",22,12,6));
    ctaRow.appendChild(btnNode("Talk to sales","none","#FFFFFF",22,12,6));
    left.appendChild(ctaRow);
    const imgF=imgBlock("Image Placeholder","#4F46E5");
    f.appendChild(imgF); if(mobile){ imgF.resize(1,300); imgF.primaryAxisSizingMode="FIXED"; fill(imgF); } else { fill(imgF); fillV(imgF); }
    return f;
  },
  "split-6": W => {
    const mobile=W<=480;
    const f = alFrame({name:"Hero — Stat Drop", dir:"VERTICAL", bg:"#FFFFFF", w:W});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const top = alFrame({name:"Top",dir:mobile?"VERTICAL":"HORIZONTAL",pl:0,pr:0,pt:0,pb:0});
    f.appendChild(top); fill(top);
    if(mobile){ top.primaryAxisSizingMode="AUTO"; top.counterAxisSizingMode="FIXED"; } else { top.counterAxisSizingMode="AUTO"; }
    const left = alFrame({name:"Copy",dir:"VERTICAL",gap:24,pl:40,pr:40,pt:40,pb:40});
    top.appendChild(left); fill(left);
    const h6=txt("The OS for\nmodern companies.",46,"Bold","#111827",{lineHeight:54}); left.appendChild(h6); fill(h6);
    const sd6=txt("Manage people, projects and process\nfrom one workspace.",16,"Regular","#6B7280",{lineHeight:24}); left.appendChild(sd6); fill(sd6);
    left.appendChild(btnNode("Get started free","#111827","#FFFFFF",22,12,8));
    const imgF=imgBlock("Image Placeholder","#F1F5F9");
    top.appendChild(imgF); if(mobile){ imgF.resize(1,300); imgF.primaryAxisSizingMode="FIXED"; fill(imgF); } else { fill(imgF); fillV(imgF); }
    // Stats strip
    const statsRow=alFrame({name:"Stats",dir:"HORIZONTAL",bg:"#F8FAFC",pl:40,pr:40,pt:24,pb:24,main:"SPACE_BETWEEN",cross:"CENTER"});
    f.appendChild(statsRow); fill(statsRow);
    statsRow.strokes=[{type:"SOLID",color:rgb("#E2E8F0")}]; statsRow.strokeWeight=1; statsRow.strokeAlign="INSIDE";
    [["12k+","Teams"],["99.9%","Uptime"],["4.9★","Rating"],["< 100ms","Latency"]].forEach(([v,l])=>{
      const stat=alFrame({name:l,dir:"VERTICAL",gap:4,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"});
      stat.appendChild(txt(v,20,"Bold","#111827",{align:"CENTER"}));
      stat.appendChild(txt(l,12,"Regular","#9CA3AF",{align:"CENTER"}));
      statsRow.appendChild(stat);
    });
    return f;
  },

  // ── HERO TEXT ────────────────────────────────────────────────────────────
  "text-1": W => {
    const f=alFrame({name:"Hero — Open Stage",dir:"VERTICAL",bg:"#FFFFFF",w:W,pl:40,pr:40,pt:40,pb:40,gap:24,cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    f.appendChild(pillNode("Now in public beta","#EFF6FF","#2563EB"));
    const h=txt("The future of work\nis here.",58,"Bold","#111827",{lineHeight:66,align:"CENTER"}); f.appendChild(h); fill(h);
    const sd=txt("Build, collaborate and ship — all in one place.",19,"Regular","#6B7280",{align:"CENTER"}); f.appendChild(sd); fill(sd);
    f.appendChild(btnNode("Start building free →","#111827","#FFFFFF",26,14,8));
    return f;
  },
  "text-2": W => {
    const f=alFrame({name:"Hero — Stacked Pulse",dir:"VERTICAL",bg:"#0F172A",w:W,pl:40,pr:40,pt:40,pb:40,gap:24});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const h=txt("We make\ncreative work\nbetter.",58,"Bold","#FFFFFF",{lineHeight:66}); f.appendChild(h); fill(h);
    const sd=txt("Tools and templates for designers,\ndevelopers and teams.",18,"Regular","#94A3B8",{lineHeight:26}); f.appendChild(sd); fill(sd);
    const row=alFrame({name:"CTA",dir:"HORIZONTAL",gap:12,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"});
    row.appendChild(btnNode("Explore now","#6366F1","#FFFFFF",22,12,6));
    row.appendChild(btnNode("See examples →","none","#94A3B8",22,12,6));
    f.appendChild(row);
    return f;
  },
  "text-3": W => {
    const f=alFrame({name:"Hero — Grid Canvas",dir:"VERTICAL",bg:"#FAFAFA",w:W,pl:40,pr:40,pt:40,pb:40,gap:24,cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    f.appendChild(pillNode("Product launch","#FEF3C7","#92400E"));
    const h=txt("Less noise.\nMore signal.",58,"Bold","#111827",{lineHeight:66,align:"CENTER"}); f.appendChild(h); fill(h);
    const sd=txt("A smarter inbox for your team.",18,"Regular","#6B7280",{align:"CENTER"}); f.appendChild(sd); fill(sd);
    f.appendChild(btnNode("Join waitlist","#F59E0B","#FFFFFF",22,12,8));
    return f;
  },
  "text-4": W => {
    const f=alFrame({name:"Hero — Ink Block",dir:"VERTICAL",bg:"#09090B",w:W,pl:40,pr:40,pt:40,pb:40,gap:24});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const h=txt("Design\nSystems\nDone Right.",56,"Bold","#FFFFFF",{lineHeight:64}); f.appendChild(h); fill(h);
    const sd=txt("A systematic approach to UI consistency\nacross every product you ship.",16,"Regular","#71717A",{lineHeight:24}); f.appendChild(sd); fill(sd);
    f.appendChild(btnNode("Read the guide →","#FFFFFF","#09090B",22,12,0));
    return f;
  },
  "text-5": W => {
    const f=alFrame({name:"Hero — Gradient Rise",dir:"VERTICAL",bg:"#4F46E5",w:W,pl:40,pr:40,pt:40,pb:40,gap:24,cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const h=txt("Build products\nyour users love.",56,"Bold","#FFFFFF",{lineHeight:64,align:"CENTER"}); f.appendChild(h); fill(h);
    const sd=txt("The all-in-one design and engineering platform.",18,"Regular","#C7D2FE",{align:"CENTER"}); f.appendChild(sd); fill(sd);
    f.appendChild(btnNode("Get started — it's free","#FFFFFF","#4F46E5",24,14,8));
    return f;
  },
  "text-6": W => {
    const f=alFrame({name:"Hero — Type Only",dir:"VERTICAL",bg:"#FFFFFF",w:W,pl:40,pr:40,pt:40,pb:40,gap:24});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const h=txt("We craft digital\nexperiences.",60,"Bold","#111827",{lineHeight:68}); f.appendChild(h); fill(h);
    const sd=txt("Design studio based in London — working with brands\nthat want to stand out in a crowded world.",16,"Regular","#6B7280",{lineHeight:24}); f.appendChild(sd); fill(sd);
    f.appendChild(btnNode("Our work ↓","none","#111827",20,10,4));
    const ey=txt("Est. 2019",12,"Regular","#9CA3AF"); f.appendChild(ey); fill(ey);
    return f;
  },

  // ── STATS ────────────────────────────────────────────────────────────────
  "stats-1": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Stats — Metric Cards",dir:"VERTICAL",bg:"#FFFFFF",w:W,pt:40,pb:40,pl:40,pr:40,gap:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const title=txt("By the numbers",30,"Bold","#111827",{align:"CENTER"}); f.appendChild(title); fill(title);
    const items=[["12,400+","Active users"],["99.9%","Uptime SLA"],["4.9/5","Rating"],["180+","Countries"]];
    const buildCard=([v,l],parent)=>{
      const card=alFrame({name:l,dir:"VERTICAL",bg:"#F9FAFB",gap:8,pl:20,pr:20,pt:20,pb:20,radius:8}); parent.appendChild(card); fill(card); fillV(card);
      card.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; card.strokeWeight=1;
      const vt=txt(v,26,"Bold","#111827"); card.appendChild(vt); fill(vt);
      const lt=txt(l,14,"Regular","#6B7280"); card.appendChild(lt); fill(lt);
    };
    const makeRow=(parent)=>{
      const row=alFrame({name:"Cards",dir:"HORIZONTAL",gap:40,pl:0,pr:0,pt:0,pb:0}); parent.appendChild(row); row.resize(1,120); row.counterAxisSizingMode="FIXED"; fill(row);
      return row;
    };
    if(mobile){
      const grid=alFrame({name:"Cards",dir:"VERTICAL",gap:40,pl:0,pr:0,pt:0,pb:0}); f.appendChild(grid); fill(grid);
      [[0,1],[2,3]].forEach(pair=>{ const row=makeRow(grid); pair.forEach(i=>buildCard(items[i],row)); });
    } else {
      const row=makeRow(f); items.forEach(item=>buildCard(item,row));
    }
    return f;
  },
  "stats-2": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Stats — Dark Rail",dir:"VERTICAL",bg:"#111827",w:W,pt:40,pb:40,pl:40,pr:40,gap:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const items=[["$2.4B","Revenue"],["50M+","Transactions"],["140ms","Latency"],["ISO 27001","Certified"]];
    const buildStat=([v,l],parent)=>{
      const s=alFrame({name:l,dir:"VERTICAL",gap:6,pl:0,pr:0,pt:0,pb:0}); parent.appendChild(s); fill(s); fillV(s);
      const vt=txt(v,28,"Bold","#FFFFFF"); s.appendChild(vt); fill(vt);
      const lt=txt(l,14,"Regular","#6B7280"); s.appendChild(lt); fill(lt);
    };
    const makeRow=(parent)=>{
      const row=alFrame({name:"Stats",dir:"HORIZONTAL",gap:40,pl:0,pr:0,pt:0,pb:0}); parent.appendChild(row); row.resize(1,80); row.counterAxisSizingMode="FIXED"; fill(row);
      return row;
    };
    if(mobile){
      const grid=alFrame({name:"Stats",dir:"VERTICAL",gap:40,pl:0,pr:0,pt:0,pb:0}); f.appendChild(grid); fill(grid);
      [[0,1],[2,3]].forEach(pair=>{ const row=makeRow(grid); pair.forEach(i=>buildStat(items[i],row)); });
    } else {
      const row=makeRow(f); items.forEach(item=>buildStat(item,row));
    }
    return f;
  },
  "stats-3": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Stats — Accent Line",dir:"VERTICAL",bg:"#F5F3FF",w:W,pt:40,pb:40,pl:40,pr:40,gap:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const items=[["10x","Faster builds"],["300%","ROI average"],["< 5min","Setup time"],["24/7","Support"]];
    const buildStat=([v,l],parent)=>{
      const s=alFrame({name:l,dir:"VERTICAL",gap:8,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); parent.appendChild(s); fill(s); fillV(s);
      const vt=txt(v,34,"Bold","#7C3AED",{align:"CENTER"}); s.appendChild(vt); fill(vt);
      const lt=txt(l,14,"Regular","#6B7280",{align:"CENTER"}); s.appendChild(lt); fill(lt);
    };
    const makeRow=(parent)=>{
      const row=alFrame({name:"Stats",dir:"HORIZONTAL",gap:40,pl:0,pr:0,pt:0,pb:0}); parent.appendChild(row); row.resize(1,80); row.counterAxisSizingMode="FIXED"; fill(row);
      return row;
    };
    if(mobile){
      const grid=alFrame({name:"Stats",dir:"VERTICAL",gap:40,pl:0,pr:0,pt:0,pb:0}); f.appendChild(grid); fill(grid);
      [[0,1],[2,3]].forEach(pair=>{ const row=makeRow(grid); pair.forEach(i=>buildStat(items[i],row)); });
    } else {
      const row=makeRow(f); items.forEach(item=>buildStat(item,row));
    }
    return f;
  },
  "stats-4": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Stats — Divider Row",dir:"VERTICAL",bg:"#FFFFFF",w:W,pt:40,pb:40,pl:40,pr:40,gap:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    f.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; f.strokeWeight=1; f.strokeAlign="OUTSIDE";
    const items=[["3.2M","Developers"],["98%","Satisfaction"],["60s","Deploy time"],["500+","Integrations"]];
    const buildStat=([v,l],parent)=>{
      const s=alFrame({name:l,dir:"VERTICAL",gap:6,pl:0,pr:0,pt:0,pb:0}); parent.appendChild(s); fill(s); fillV(s);
      const vt=txt(v,30,"Bold","#0F172A"); s.appendChild(vt); fill(vt);
      const lt=txt(l,14,"Regular","#94A3B8"); s.appendChild(lt); fill(lt);
    };
    const makeRow=(parent)=>{
      const row=alFrame({name:"Stats",dir:"HORIZONTAL",gap:40,pl:0,pr:0,pt:0,pb:0}); parent.appendChild(row); row.resize(1,80); row.counterAxisSizingMode="FIXED"; fill(row);
      return row;
    };
    if(mobile){
      const grid=alFrame({name:"Stats",dir:"VERTICAL",gap:40,pl:0,pr:0,pt:0,pb:0}); f.appendChild(grid); fill(grid);
      [[0,1],[2,3]].forEach(pair=>{ const row=makeRow(grid); pair.forEach(i=>buildStat(items[i],row)); });
    } else {
      const row=makeRow(f); items.forEach(item=>buildStat(item,row));
    }
    return f;
  },
  "stats-5": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Stats — Icon Stat",dir:"VERTICAL",bg:"#0F172A",w:W,pt:40,pb:40,pl:40,pr:40,gap:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const items=[{icon:"⚡",v:"0.3s",l:"Load time"},{icon:"🔒",v:"SOC2",l:"Compliant"},{icon:"🌍",v:"40+",l:"Regions"},{icon:"📈",v:"10M+",l:"Events/day"}];
    const buildStat=(d,parent)=>{
      const s=alFrame({name:d.l,dir:"VERTICAL",gap:8,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); parent.appendChild(s); fill(s); fillV(s);
      s.appendChild(txt(d.icon,24,"Regular","#FFFFFF",{align:"CENTER"}));
      const vt=txt(d.v,28,"Bold","#FFFFFF",{align:"CENTER"}); s.appendChild(vt); fill(vt);
      const lt=txt(d.l,14,"Regular","#64748B",{align:"CENTER"}); s.appendChild(lt); fill(lt);
    };
    const makeRow=(parent)=>{
      const row=alFrame({name:"Stats",dir:"HORIZONTAL",gap:40,pl:0,pr:0,pt:0,pb:0}); parent.appendChild(row); row.resize(1,100); row.counterAxisSizingMode="FIXED"; fill(row);
      return row;
    };
    if(mobile){
      const grid=alFrame({name:"Stats",dir:"VERTICAL",gap:40,pl:0,pr:0,pt:0,pb:0}); f.appendChild(grid); fill(grid);
      [[0,1],[2,3]].forEach(pair=>{ const row=makeRow(grid); pair.forEach(i=>buildStat(items[i],row)); });
    } else {
      const row=makeRow(f); items.forEach(item=>buildStat(item,row));
    }
    return f;
  },
  "stats-6": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Stats — Colour Tiles",dir:"VERTICAL",bg:"#FFFFFF",w:W,pt:40,pb:40,pl:40,pr:40,gap:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const items=[["99.9%","Availability","#EFF6FF","#1D4ED8"],["<100ms","Response","#F0FDF4","#15803D"],["10PB","Data stored","#FFF7ED","#C2410C"],["5K+","Enterprises","#FDF4FF","#7E22CE"]];
    const buildCard=([v,l,bg,tc],parent)=>{
      const card=alFrame({name:l,dir:"VERTICAL",bg,gap:8,pl:20,pr:20,pt:20,pb:20,radius:8}); parent.appendChild(card); fill(card); fillV(card);
      const vt=txt(v,26,"Bold",tc); card.appendChild(vt); fill(vt);
      const lt=txt(l,12,"Regular","#374151"); card.appendChild(lt); fill(lt);
    };
    const makeRow=(parent)=>{
      const row=alFrame({name:"Cards",dir:"HORIZONTAL",gap:40,pl:0,pr:0,pt:0,pb:0}); parent.appendChild(row); row.resize(1,120); row.counterAxisSizingMode="FIXED"; fill(row);
      return row;
    };
    if(mobile){
      const grid=alFrame({name:"Cards",dir:"VERTICAL",gap:40,pl:0,pr:0,pt:0,pb:0}); f.appendChild(grid); fill(grid);
      [[0,1],[2,3]].forEach(pair=>{ const row=makeRow(grid); pair.forEach(i=>buildCard(items[i],row)); });
    } else {
      const row=makeRow(f); items.forEach(item=>buildCard(item,row));
    }
    return f;
  },

  // ── FEATURES ─────────────────────────────────────────────────────────────
  "feat-1": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Features — Card Trio",dir:"VERTICAL",bg:"#FFFFFF",w:W,pt:40,pb:40,pl:40,pr:40,gap:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const title=txt("Everything you need",32,"Bold","#111827",{align:"CENTER"}); f.appendChild(title); fill(title);
    const row=alFrame({name:"Cards",dir:mobile?"VERTICAL":"HORIZONTAL",gap:40,pl:0,pr:0,pt:0,pb:0}); f.appendChild(row); fill(row);
    [{icon:"⚡",t:"Lightning Fast",d:"Zero-compromise performance."},{icon:"🔒",t:"Secure by default",d:"Enterprise-grade security built in."},{icon:"🔗",t:"200+ Integrations",d:"Works with tools you already use."}].forEach(feat=>{
      const card=alFrame({name:feat.t,dir:"VERTICAL",bg:"#F9FAFB",gap:12,pl:20,pr:20,pt:20,pb:20,radius:12}); row.appendChild(card); fill(card);
      card.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; card.strokeWeight=1;
      const ic=alFrame({name:"Icon",dir:"HORIZONTAL",bg:"#EDE9FE",pl:8,pr:8,pt:8,pb:8,radius:8,main:"CENTER",cross:"CENTER"});
      ic.appendChild(txt(feat.icon,18,"Regular","#7C3AED")); card.appendChild(ic);
      const tt=txt(feat.t,16,"SemiBold","#111827"); card.appendChild(tt); fill(tt);
      const d=txt(feat.d,14,"Regular","#6B7280",{lineHeight:20}); card.appendChild(d); fill(d);
    });
    return f;
  },
  "feat-2": W => {
    const mobile=W<=480;
    const tablet=!mobile&&W<=768;
    const cols=mobile?1:tablet?2:3;
    const f=alFrame({name:"Features — Icon Matrix",dir:"VERTICAL",bg:"#FAFAFA",w:W,pt:40,pb:40,pl:40,pr:40,gap:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const title=txt("Built for every team",30,"Bold","#111827",{align:"CENTER"}); f.appendChild(title); fill(title);
    const feats=[{icon:"⚡",t:"Fast",d:"Zero compromise."},{icon:"🔒",t:"Secure",d:"Enterprise grade."},{icon:"🔗",t:"Connected",d:"200+ integrations."},{icon:"📊",t:"Analytics",d:"Real-time data."},{icon:"🤝",t:"Collaboration",d:"Async-first."},{icon:"🎨",t:"Custom",d:"Your brand."}];
    let row=null;
    feats.forEach((feat,i)=>{
      if(i%cols===0){
        row=alFrame({name:"Row",dir:"HORIZONTAL",gap:mobile?16:24,pl:0,pr:0,pt:0,pb:0}); f.appendChild(row); fill(row);
      }
      const item=alFrame({name:feat.t,dir:"HORIZONTAL",bg:"#FFFFFF",gap:12,pl:16,pr:16,pt:16,pb:16,radius:8,cross:"CENTER"}); row.appendChild(item); fill(item);
      item.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; item.strokeWeight=1;
      const ic=alFrame({name:"ic",dir:"HORIZONTAL",bg:"#EDE9FE",pl:8,pr:8,pt:8,pb:8,radius:6,main:"CENTER",cross:"CENTER"});
      ic.appendChild(txt(feat.icon,16,"Regular","#7C3AED")); item.appendChild(ic);
      const col=alFrame({name:"col",dir:"VERTICAL",gap:3,pl:0,pr:0,pt:0,pb:0}); item.appendChild(col); fill(col);
      const tt=txt(feat.t,14,"SemiBold","#111827"); col.appendChild(tt); fill(tt);
      const dt=txt(feat.d,12,"Regular","#6B7280"); col.appendChild(dt); fill(dt);
    });
    return f;
  },
  "feat-3": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Features — Split Proof",dir:mobile?"VERTICAL":"HORIZONTAL",bg:"#FFFFFF",w:W,pl:40,pr:40,pt:40,pb:40,gap:40,cross:"CENTER"});
    if(mobile){ f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED"; } else { f.counterAxisSizingMode="AUTO"; }
    const left=alFrame({name:"Copy",dir:"VERTICAL",gap:16,pl:0,pr:0,pt:0,pb:0}); f.appendChild(left); fill(left);
    const hd=txt("Everything\nyou need",38,"Bold","#111827",{lineHeight:46}); left.appendChild(hd); fill(hd);
    [{icon:"⚡",t:"Lightning Fast",d:"Zero-compromise performance."},{icon:"🔒",t:"Secure by default",d:"Enterprise-grade security."},{icon:"🔗",t:"Integrations",d:"200+ tools you already use."},{icon:"📊",t:"Analytics",d:"Real-time actionable insights."}].forEach(feat=>{
      const row=alFrame({name:feat.t,dir:"HORIZONTAL",gap:12,pl:0,pr:0,pt:8,pb:8,cross:"CENTER"}); left.appendChild(row); fill(row);
      const ck=alFrame({name:"ck",dir:"HORIZONTAL",bg:"#D1FAE5",pl:4,pr:4,pt:4,pb:4,radius:9999,main:"CENTER",cross:"CENTER"});
      ck.appendChild(txt("✓",12,"Bold","#059669")); row.appendChild(ck);
      const col=alFrame({name:"t",dir:"VERTICAL",gap:2,pl:0,pr:0,pt:0,pb:0}); row.appendChild(col); fill(col);
      const tt=txt(feat.t,14,"SemiBold","#111827"); col.appendChild(tt); fill(tt);
      const dt=txt(feat.d,14,"Regular","#6B7280"); col.appendChild(dt); fill(dt);
    });
    const imgF=imgBlock("Feature Image","#F1F5F9"); f.appendChild(imgF);
    if(mobile){ imgF.resize(1,300); imgF.counterAxisSizingMode="FIXED"; fill(imgF); }
    else { imgF.resize(Math.round(W*.4),400); imgF.primaryAxisSizingMode="FIXED"; imgF.counterAxisSizingMode="FIXED"; }
    return f;
  },
  "feat-4": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Features — Dark Grid",dir:"VERTICAL",bg:"#0F172A",w:W,pt:40,pb:40,pl:40,pr:40,gap:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const title=txt("Built to perform",32,"Bold","#F1F5F9",{align:"CENTER"}); f.appendChild(title); fill(title);
    const row=alFrame({name:"Cards",dir:mobile?"VERTICAL":"HORIZONTAL",gap:40,pl:0,pr:0,pt:0,pb:0}); f.appendChild(row); fill(row);
    [{icon:"⚡",t:"Lightning Fast",d:"Zero-compromise performance."},{icon:"🔒",t:"Secure by default",d:"Enterprise-grade security."},{icon:"🔗",t:"200+ Integrations",d:"Works with tools you already use."}].forEach(feat=>{
      const card=alFrame({name:feat.t,dir:"VERTICAL",bg:"#1E293B",gap:12,pl:20,pr:20,pt:20,pb:20,radius:12}); row.appendChild(card); fill(card);
      const ic=alFrame({name:"Icon",dir:"HORIZONTAL",bg:"#334155",pl:8,pr:8,pt:8,pb:8,radius:8,main:"CENTER",cross:"CENTER"});
      ic.appendChild(txt(feat.icon,18,"Regular","#FFFFFF")); card.appendChild(ic);
      const tt=txt(feat.t,16,"SemiBold","#F1F5F9"); card.appendChild(tt); fill(tt);
      const d=txt(feat.d,14,"Regular","#64748B",{lineHeight:20}); card.appendChild(d); fill(d);
    });
    return f;
  },
  "feat-5": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Features — Numbered Steps",dir:"VERTICAL",bg:"#0F172A",w:W,pt:40,pb:40,pl:40,pr:40,gap:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const hd=txt("How it works",30,"Bold","#FFFFFF"); f.appendChild(hd); fill(hd);
    const stepsL=[{t:"Sign up in seconds",d:"Create your account — no credit card required."},{t:"Connect your tools",d:"Integrate with 200+ tools your team already uses."},{t:"Start collaborating",d:"Invite your team and ship your first project."},{t:"Scale with confidence",d:"Enterprise-grade security and 99.9% uptime SLA."}];
    const stepsR=[{t:"Customize your workspace",d:"Tailor layouts, themes, and workflows to your style."},{t:"Automate repetitive tasks",d:"Set up triggers and rules to save hours every week."},{t:"Monitor performance",d:"Track KPIs and get alerts before issues escalate."},{t:"Export and share",d:"Publish reports, snapshots, and assets in one click."}];
    const buildStep=(step,idx,parent)=>{
      const row=alFrame({name:step.t,dir:"HORIZONTAL",gap:16,pl:0,pr:0,pt:0,pb:0,cross:"MIN"}); parent.appendChild(row); fill(row);
      const num=alFrame({name:"num",dir:"HORIZONTAL",bg:"#1E293B",pl:0,pr:0,pt:0,pb:0,radius:8,main:"CENTER",cross:"CENTER"});
      num.resize(36,36); num.primaryAxisSizingMode="FIXED"; num.counterAxisSizingMode="FIXED";
      num.appendChild(txt(String(idx+1).padStart(2,"0"),12,"Bold","#6366F1")); row.appendChild(num);
      const col=alFrame({name:"col",dir:"VERTICAL",gap:4,pl:0,pr:0,pt:2,pb:0}); row.appendChild(col); fill(col);
      const tt=txt(step.t,16,"SemiBold","#F1F5F9"); col.appendChild(tt); fill(tt);
      const d=txt(step.d,14,"Regular","#64748B",{lineHeight:20}); col.appendChild(d); fill(d);
    };
    if(mobile){
      stepsL.forEach((s,i)=>buildStep(s,i,f));
      stepsR.forEach((s,i)=>buildStep(s,i+stepsL.length,f));
    } else {
      const cols=alFrame({name:"Columns",dir:"HORIZONTAL",gap:40,pl:0,pr:0,pt:0,pb:0,cross:"MIN"}); f.appendChild(cols); fill(cols);
      const leftCol=alFrame({name:"Left",dir:"VERTICAL",gap:32,pl:0,pr:0,pt:0,pb:0}); cols.appendChild(leftCol); fill(leftCol);
      stepsL.forEach((s,i)=>buildStep(s,i,leftCol));
      const rightCol=alFrame({name:"Right",dir:"VERTICAL",gap:32,pl:0,pr:0,pt:0,pb:0}); cols.appendChild(rightCol); fill(rightCol);
      stepsR.forEach((s,i)=>buildStep(s,i+stepsL.length,rightCol));
    }
    return f;
  },
  "feat-6": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Features — Alt Flow",dir:"VERTICAL",bg:"#FFFFFF",w:W,pt:40,pb:40,pl:40,pr:40,gap:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    [{icon:"⚡",t:"Lightning Fast",d:"Zero-compromise performance on every device.",side:"right"},{icon:"🔒",t:"Secure by default",d:"Enterprise-grade security built in from day one.",side:"left"},{icon:"🔗",t:"200+ Integrations",d:"Connect tools your team already loves and uses.",side:"right"}].forEach(feat=>{
      const row=alFrame({name:feat.t,dir:mobile?"VERTICAL":"HORIZONTAL",gap:40,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); f.appendChild(row); fill(row);
      const buildCol=()=>{
        const col=alFrame({name:"copy",dir:"VERTICAL",gap:10,pl:0,pr:0,pt:0,pb:0}); row.appendChild(col); fill(col);
        const ic=alFrame({name:"ic",dir:"HORIZONTAL",bg:"#EDE9FE",pl:10,pr:10,pt:10,pb:10,radius:8,main:"CENTER",cross:"CENTER"});
        ic.appendChild(txt(feat.icon,22,"Regular","#7C3AED")); col.appendChild(ic);
        const tt=txt(feat.t,18,"Bold","#111827"); col.appendChild(tt); fill(tt);
        const d=txt(feat.d,14,"Regular","#6B7280",{lineHeight:22}); col.appendChild(d); fill(d);
      };
      const buildImg=()=>{
        const imgF=imgBlock("","#F1F5F9"); row.appendChild(imgF);
        if(mobile){ imgF.resize(1,200); imgF.counterAxisSizingMode="FIXED"; fill(imgF); }
        else { imgF.resize(Math.round(W*.42),180); imgF.primaryAxisSizingMode="FIXED"; imgF.counterAxisSizingMode="FIXED"; }
      };
      if(feat.side==="right"||mobile){ buildCol(); buildImg(); } else { buildImg(); buildCol(); }
    });
    return f;
  },

  // ── CTA ──────────────────────────────────────────────────────────────────
  "cta-1": W => {
    const f=alFrame({name:"CTA — Centre Stage",dir:"VERTICAL",bg:"#111827",w:W,pl:40,pr:40,pt:40,pb:40,gap:24,cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const h=txt("Ready to get started?",34,"Bold","#FFFFFF",{align:"CENTER"}); f.appendChild(h); fill(h);
    const sd=txt("Join thousands of teams already using Brand.",16,"Regular","#94A3B8",{align:"CENTER"}); f.appendChild(sd); fill(sd);
    f.appendChild(btnNode("Start for free →","#6366F1","#FFFFFF",24,14,8));
    return f;
  },
  "cta-2": W => {
    const mobile=W<=480;
    const f=alFrame({name:"CTA — Half Split",dir:mobile?"VERTICAL":"HORIZONTAL",bg:"#6366F1",w:W,pl:40,pr:40,pt:40,pb:40,gap:40,cross:"CENTER"});
    if(mobile){ f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED"; } else { f.counterAxisSizingMode="AUTO"; }
    const left=alFrame({name:"Copy",dir:"VERTICAL",gap:24,pl:0,pr:0,pt:0,pb:0});
    f.appendChild(left); fill(left);
    const h=txt("Start building today.",34,"Bold","#FFFFFF",{lineHeight:42}); left.appendChild(h); fill(h);
    const sd=txt("No credit card required. Cancel anytime.",16,"Regular","#C7D2FE"); left.appendChild(sd); fill(sd);
    left.appendChild(btnNode("Get started free","#FFFFFF","#6366F1",22,12,8));
    const img=imgBlock("Image Placeholder","#4F46E5");
    f.appendChild(img); img.resize(1,300); img.primaryAxisSizingMode="FIXED"; fill(img);
    return f;
  },
  "cta-3": W => {
    const mobile=W<=480;
    const f=alFrame({name:"CTA — Email Gate",dir:"VERTICAL",bg:"#F9FAFB",w:W,pl:40,pr:40,pt:40,pb:40,gap:24,cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    f.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; f.strokeWeight=1; f.strokeAlign="OUTSIDE";
    const h=txt("Stay ahead of the curve.",30,"Bold","#111827",{align:"CENTER"}); f.appendChild(h); fill(h);
    const sd=txt("Get weekly tips, templates and tools delivered to your inbox.",16,"Regular","#6B7280",{align:"CENTER"}); f.appendChild(sd); fill(sd);
    const row=alFrame({name:"Subscribe",dir:mobile?"VERTICAL":"HORIZONTAL",gap:16,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"});
    f.appendChild(row); fill(row);
    if(mobile){ row.primaryAxisSizingMode="AUTO"; row.counterAxisSizingMode="FIXED"; }
    else { row.primaryAxisAlignItems="CENTER"; }
    const input=alFrame({name:"Input",dir:"HORIZONTAL",bg:"#FFFFFF",pl:16,pr:16,pt:11,pb:11,cross:"CENTER",radius:6});
    input.strokes=[{type:"SOLID",color:rgb("#D1D5DB")}]; input.strokeWeight=1;
    const ph=txt("Enter your email address…",14,"Regular","#9CA3AF"); ph.resize(280,20); input.appendChild(ph);
    row.appendChild(input); if(mobile) fill(input);
    row.appendChild(btnNode("Subscribe","#111827","#FFFFFF",20,12,0));
    return f;
  },
  "cta-4": W => {
    const f=alFrame({name:"CTA — Colour Pop",dir:"HORIZONTAL",bg:"#FBBF24",w:W,pl:40,pr:40,pt:40,pb:40,main:"SPACE_BETWEEN",cross:"CENTER"});
    f.counterAxisSizingMode="AUTO";
    const left=alFrame({name:"Copy",dir:"VERTICAL",gap:24,pl:0,pr:0,pt:0,pb:0});
    f.appendChild(left); fill(left);
    const h=txt("Transform your workflow today.",32,"Bold","#111827",{lineHeight:40}); left.appendChild(h); fill(h);
    const sd=txt("Join 10,000+ teams and ship faster.",16,"Regular","#78350F"); left.appendChild(sd); fill(sd);
    left.appendChild(btnNode("Get early access","#111827","#FFFFFF",22,12,6));
    f.appendChild(txt("→",72,"Bold","#F59E0B"));
    return f;
  },
  "cta-5": W => {
    const f=alFrame({name:"CTA — Dark Edge",dir:"HORIZONTAL",bg:"#09090B",w:W,pl:40,pr:40,pt:40,pb:40,main:"SPACE_BETWEEN",cross:"CENTER"});
    f.counterAxisSizingMode="AUTO";
    f.strokes=[{type:"SOLID",color:rgb("#27272A")}]; f.strokeWeight=1; f.strokeAlign="OUTSIDE";
    const left=alFrame({name:"Copy",dir:"VERTICAL",gap:24,pl:0,pr:0,pt:0,pb:0});
    f.appendChild(left); fill(left);
    const h=txt("Let's build something\ngreat together.",28,"Bold","#FFFFFF",{lineHeight:36}); left.appendChild(h); fill(h);
    const em=txt("hello@brand.io",14,"Regular","#71717A"); left.appendChild(em); fill(em);
    left.appendChild(btnNode("Start a project →","none","#FFFFFF",22,12,0));
    return f;
  },
  "cta-6": W => {
    const f=alFrame({name:"CTA — Dual Action",dir:"VERTICAL",bg:"#1E1B4B",w:W,pl:40,pr:40,pt:40,pb:40,gap:24,cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const h=txt("Power up your team.",36,"Bold","#FFFFFF",{align:"CENTER"}); f.appendChild(h); fill(h);
    const sd=txt("Start free — no credit card needed. Upgrade anytime.",16,"Regular","#A5B4FC",{align:"CENTER"}); f.appendChild(sd); fill(sd);
    const row=alFrame({name:"CTAs",dir:"HORIZONTAL",gap:12,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"});
    row.appendChild(btnNode("Start free","#6366F1","#FFFFFF",22,12,6));
    row.appendChild(btnNode("Talk to sales","none","#A5B4FC",22,12,6));
    f.appendChild(row);
    return f;
  },

  // ── TESTIMONIALS ─────────────────────────────────────────────────────────
  "test-1": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Testimonials — Card Wall",dir:"VERTICAL",bg:"#FFFFFF",w:W,pt:40,pb:40,pl:40,pr:40,gap:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const title=txt("What our customers say",30,"Bold","#111827",{align:"CENTER"}); f.appendChild(title); fill(title);
    const row=alFrame({name:"Cards",dir:mobile?"VERTICAL":"HORIZONTAL",gap:40,pl:0,pr:0,pt:0,pb:0}); f.appendChild(row); fill(row);
    [{q:"This product completely changed how we ship.",who:"Alex J",role:"CTO, Acme"},
     {q:"The best investment we made this year.",who:"Maria G",role:"CEO, Nova"},
     {q:"Incredibly intuitive and powerful.",who:"James L",role:"Lead Eng, Arc"}].forEach(q=>{
      const card=alFrame({name:q.who,dir:"VERTICAL",bg:"#F9FAFB",gap:12,pl:20,pr:20,pt:20,pb:20,radius:12}); row.appendChild(card); fill(card);
      card.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; card.strokeWeight=1;
      const st=txt("★★★★★",14,"Regular","#F59E0B"); card.appendChild(st); fill(st);
      const qt=txt('"'+q.q+'"',14,"Regular","#374151",{lineHeight:20}); card.appendChild(qt); fill(qt);
      const wt=txt(q.who,14,"Bold","#111827"); card.appendChild(wt); fill(wt);
      const rt=txt(q.role,12,"Regular","#6B7280"); card.appendChild(rt); fill(rt);
    });
    return f;
  },
  "test-2": W => {
    const f=alFrame({name:"Testimonials — Grand Quote",dir:"VERTICAL",bg:"#0F172A",w:W,pl:40,pr:40,pt:40,pb:40,gap:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const qm=txt('"',96,"Bold","#1E293B",{lineHeight:80}); f.appendChild(qm); fill(qm);
    const qt=txt("This completely changed\nhow we build products.",38,"Bold","#FFFFFF",{lineHeight:46}); f.appendChild(qt); fill(qt);
    const at=txt("— Alex J, CTO at Acme",16,"Regular","#94A3B8"); f.appendChild(at); fill(at);
    return f;
  },
  "test-3": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Testimonials — Dark Panels",dir:"VERTICAL",bg:"#111827",w:W,pt:40,pb:40,pl:40,pr:40,gap:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const title=txt("Trusted by builders worldwide",30,"Bold","#F9FAFB",{align:"CENTER"}); f.appendChild(title); fill(title);
    const row=alFrame({name:"Cards",dir:mobile?"VERTICAL":"HORIZONTAL",gap:40,pl:0,pr:0,pt:0,pb:0}); f.appendChild(row); fill(row);
    [{q:"This product changed how we ship.",who:"Alex J",role:"CTO, Acme"},
     {q:"Best investment we made this year.",who:"Maria G",role:"CEO, Nova"},
     {q:"Incredibly intuitive and powerful.",who:"James L",role:"Lead Eng, Arc"}].forEach(q=>{
      const card=alFrame({name:q.who,dir:"VERTICAL",bg:"#1F2937",gap:12,pl:20,pr:20,pt:20,pb:20,radius:12}); row.appendChild(card); fill(card);
      const st=txt("★★★★★",14,"Regular","#F59E0B"); card.appendChild(st); fill(st);
      const qt=txt('"'+q.q+'"',14,"Regular","#D1D5DB",{lineHeight:20}); card.appendChild(qt); fill(qt);
      const wt=txt(q.who,14,"Bold","#F9FAFB"); card.appendChild(wt); fill(wt);
      const rt=txt(q.role,12,"Regular","#6B7280"); card.appendChild(rt); fill(rt);
    });
    return f;
  },
  "test-4": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Testimonials — Avatar Strip",dir:"VERTICAL",bg:"#FFFFFF",w:W,pt:40,pb:40,pl:40,pr:40,gap:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const title=txt("Loved by teams everywhere",28,"Bold","#111827",{align:"CENTER"}); f.appendChild(title); fill(title);
    const row=alFrame({name:"Items",dir:mobile?"VERTICAL":"HORIZONTAL",gap:40,pl:0,pr:0,pt:0,pb:0}); f.appendChild(row); fill(row);
    [{who:"Alex J",role:"CTO, Acme",q:"Changed how we ship."},
     {who:"Maria G",role:"CEO, Nova",q:"Best investment ever."},
     {who:"James L",role:"Lead Eng, Arc",q:"Intuitive and powerful."},
     {who:"Priya P",role:"PM, Loop",q:"Velocity tripled."}].forEach(q=>{
      const col=alFrame({name:q.who,dir:"VERTICAL",gap:8,pl:0,pr:0,pt:0,pb:0}); row.appendChild(col); fill(col);
      const av=alFrame({name:"av",dir:"HORIZONTAL",bg:"#E5E7EB",pl:0,pr:0,pt:0,pb:0,radius:9999,main:"CENTER",cross:"CENTER"});
      av.resize(44,44); av.primaryAxisSizingMode="FIXED"; av.counterAxisSizingMode="FIXED";
      av.appendChild(txt(q.who[0],18,"Bold","#6B7280",{align:"CENTER"})); col.appendChild(av);
      const wt=txt(q.who,14,"Bold","#111827"); col.appendChild(wt); fill(wt);
      const rt=txt(q.role,12,"Regular","#6B7280"); col.appendChild(rt); fill(rt);
      const qt=txt('"'+q.q+'"',14,"Regular","#374151",{lineHeight:20}); col.appendChild(qt); fill(qt);
    });
    return f;
  },
  "test-5": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Testimonials — Logo Trust",dir:"VERTICAL",bg:"#F9FAFB",w:W,pt:40,pb:40,pl:40,pr:40,gap:40,cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const tt=txt("Trusted by teams at",14,"Regular","#9CA3AF",{align:"CENTER"}); f.appendChild(tt); fill(tt);
    const row=alFrame({name:"Logos",dir:mobile?"VERTICAL":"HORIZONTAL",gap:40,pl:0,pr:0,pt:0,pb:0}); f.appendChild(row); fill(row);
    ["Acme","Nova","Loop","Arc","Prism","Delta"].forEach(l=>{
      const b=alFrame({name:l,dir:"HORIZONTAL",bg:"#E5E7EB",pl:16,pr:16,pt:10,pb:10,radius:6,main:"CENTER",cross:"CENTER"}); row.appendChild(b); fill(b);
      const lt=txt(l,14,"Bold","#9CA3AF"); b.appendChild(lt); fill(lt);
    });
    return f;
  },
  "test-6": W => {
    const f=alFrame({name:"Testimonials — Rating Glow",dir:"VERTICAL",bg:"#FFF7ED",w:W,pl:40,pr:40,pt:40,pb:40,gap:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const st=txt("★★★★★",20,"Regular","#F59E0B"); f.appendChild(st); fill(st);
    const rt=txt("4.9 / 5 from 2,400+ reviews",14,"Regular","#92400E"); f.appendChild(rt); fill(rt);
    const qt=txt('"The best investment we made this year."',24,"Bold","#111827",{lineHeight:32}); f.appendChild(qt); fill(qt);
    const at=txt("— Maria G, CEO at Nova",14,"Regular","#6B7280"); f.appendChild(at); fill(at);
    return f;
  },

  // ── TEAM ─────────────────────────────────────────────────────────────────
  "team-1": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Team — Card Grid",dir:"VERTICAL",bg:"#FFFFFF",w:W,pt:40,pb:40,pl:40,pr:40,gap:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const hdr=alFrame({name:"Header",dir:"VERTICAL",gap:12,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); f.appendChild(hdr); fill(hdr);
    const eyebrow=txt("OUR TEAM",12,"SemiBold","#F97316"); eyebrow.name="Eyebrow"; eyebrow.textAlignHorizontal="CENTER"; hdr.appendChild(eyebrow); fill(eyebrow);
    const heading=txt("Meet the People Behind the Product",32,"Bold","#111827",{align:"CENTER"}); heading.name="Heading"; hdr.appendChild(heading); fill(heading);
    const sub=txt("A talented group of creators, thinkers, and builders.",16,"Regular","#6B7280",{align:"CENTER"}); sub.name="Subheading"; hdr.appendChild(sub); fill(sub);
    const row=alFrame({name:"Members",dir:mobile?"VERTICAL":"HORIZONTAL",gap:40,pl:0,pr:0,pt:0,pb:0}); f.appendChild(row); fill(row);
    [["Alex Rivera","CEO & Founder"],["Jordan Lee","Head of Design"],["Sam Chen","Lead Engineer"],["Casey Park","Product Manager"]].forEach(([n,r])=>{
      const card=alFrame({name:"Member — "+n,dir:"VERTICAL",bg:"#F9FAFB",gap:8,pl:20,pr:20,pt:20,pb:20,radius:12,cross:"CENTER"}); row.appendChild(card); fill(card);
      card.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; card.strokeWeight=1;
      const av=alFrame({name:"Avatar",dir:"HORIZONTAL",bg:"#E5E7EB",pl:0,pr:0,pt:0,pb:0,radius:9999,main:"CENTER",cross:"CENTER"});
      av.resize(72,72); av.primaryAxisSizingMode="FIXED"; av.counterAxisSizingMode="FIXED";
      av.appendChild(txt(n[0],24,"Bold","#9CA3AF",{align:"CENTER"})); card.appendChild(av);
      const nm=txt(n,14,"Bold","#111827",{align:"CENTER"}); nm.name="Name"; card.appendChild(nm); fill(nm);
      const rl=txt(r,12,"Regular","#6B7280",{align:"CENTER"}); rl.name="Role"; card.appendChild(rl); fill(rl);
      const socials=alFrame({name:"Socials",dir:"HORIZONTAL",gap:6,pl:0,pr:0,pt:4,pb:0,cross:"CENTER"}); card.appendChild(socials);
      ["𝕏","in","◈"].forEach(s=>{
        const ic=alFrame({name:"Social Icon",dir:"HORIZONTAL",bg:"#F3F4F6",pl:6,pr:6,pt:4,pb:4,radius:4,main:"CENTER",cross:"CENTER"});
        ic.appendChild(txt(s,10,"Regular","#6B7280")); socials.appendChild(ic);
      });
    });
    return f;
  },
  "team-2": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Team — Dark Roster",dir:"VERTICAL",bg:"#111827",w:W,pt:40,pb:40,pl:40,pr:40,gap:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const hdr=alFrame({name:"Header",dir:"VERTICAL",gap:12,pl:0,pr:0,pt:0,pb:0}); f.appendChild(hdr); fill(hdr);
    const ht=txt("Our Team",32,"Bold","#F9FAFB"); hdr.appendChild(ht); fill(ht);
    const st=txt("The people building the future with us.",16,"Regular","#6B7280"); hdr.appendChild(st); fill(st);
    const row=alFrame({name:"Members",dir:mobile?"VERTICAL":"HORIZONTAL",gap:40,pl:0,pr:0,pt:0,pb:0}); f.appendChild(row); fill(row);
    [["Alex R.","Engineering"],["Jordan L.","Design"],["Sam C.","Product"],["Casey P.","Marketing"]].forEach(([n,dept])=>{
      const card=alFrame({name:"Member — "+n,dir:"VERTICAL",bg:"#1F2937",gap:10,pl:20,pr:20,pt:20,pb:20,radius:8}); row.appendChild(card); fill(card);
      const av=alFrame({name:"Avatar",dir:"HORIZONTAL",bg:"#374151",pl:0,pr:0,pt:0,pb:0,radius:9999,main:"CENTER",cross:"CENTER"});
      av.resize(56,56); av.primaryAxisSizingMode="FIXED"; av.counterAxisSizingMode="FIXED";
      av.appendChild(txt(n[0],20,"Bold","#9CA3AF",{align:"CENTER"})); card.appendChild(av);
      const nt=txt(n,14,"SemiBold","#F9FAFB"); card.appendChild(nt); fill(nt);
      const dt=txt(dept,12,"Regular","#6B7280"); card.appendChild(dt); fill(dt);
    });
    return f;
  },
  "team-3": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Team — Photo Spread",dir:"VERTICAL",bg:"#FAFAFA",w:W,pt:40,pb:40,pl:40,pr:40,gap:40,cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const ht=txt("The Founders",36,"Bold","#111827",{align:"CENTER"}); f.appendChild(ht); fill(ht);
    const row=alFrame({name:"Members",dir:mobile?"VERTICAL":"HORIZONTAL",gap:40,pl:0,pr:0,pt:0,pb:0}); f.appendChild(row); fill(row);
    [["Alex Rivera","CEO","#FEF3C7"],["Jordan Lee","Design","#EDE9FE"],["Sam Chen","Eng","#ECFDF5"],["Casey Park","PM","#FEE2E2"]].forEach(([n,r,bg])=>{
      const card=alFrame({name:"Member — "+n,dir:"VERTICAL",gap:10,pl:0,pr:0,pt:0,pb:16,radius:12,cross:"CENTER"});
      card.clipsContent=true; row.appendChild(card); fill(card);
      const img=alFrame({name:"Member Photo",bg,dir:"VERTICAL",main:"CENTER",cross:"CENTER"});
      img.resize(Math.round(W*.2),Math.round(W*.2)); img.primaryAxisSizingMode="FIXED"; img.counterAxisSizingMode="FIXED";
      img.appendChild(txt("🖼",28,"Regular",bg)); card.appendChild(img);
      const nm=txt(n,14,"Bold","#111827",{align:"CENTER"}); nm.name="Name"; card.appendChild(nm); fill(nm);
      const rl=txt(r,12,"Regular","#6B7280",{align:"CENTER"}); rl.name="Role"; card.appendChild(rl); fill(rl);
    });
    return f;
  },
  "team-4": W => {
    const split=W>768;
    const f=alFrame({name:"Team — Minimal List",dir:split?"HORIZONTAL":"VERTICAL",bg:"#FFFFFF",w:W,pt:40,pb:40,pl:40,pr:40,gap:40});
    if(split){ f.counterAxisSizingMode="AUTO"; } else { f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED"; }
    const members=alFrame({name:"Members",dir:"VERTICAL",gap:0,pl:0,pr:0,pt:0,pb:0}); f.appendChild(members); fill(members);
    const ht=txt("Our Team",30,"Bold","#111827"); members.appendChild(ht); fill(ht);
    [["Alex Rivera","CEO & Founder","Building at the intersection of design and engineering."],
     ["Jordan Lee","Head of Design","Previously at Figma and Notion. Design systems obsessive."],
     ["Sam Chen","Lead Engineer","Full-stack builder who ships fast and breaks nothing."],
     ["Casey Park","Product Manager","User research and roadmapping are my superpowers."]].forEach(([n,r,bio])=>{
      const dv=alFrame({name:"Divider",dir:"HORIZONTAL",bg:"#F3F4F6",pl:0,pr:0,pt:0,pb:0}); members.appendChild(dv); fill(dv); dv.resize(1,1); dv.counterAxisSizingMode="FIXED";
      const row=alFrame({name:"Member — "+n,dir:"HORIZONTAL",gap:20,pl:0,pr:0,pt:20,pb:20,cross:"MIN"}); members.appendChild(row); fill(row);
      const av=alFrame({name:"Avatar",dir:"HORIZONTAL",bg:"#F3F4F6",pl:0,pr:0,pt:0,pb:0,radius:9999,main:"CENTER",cross:"CENTER"});
      av.resize(48,48); av.primaryAxisSizingMode="FIXED"; av.counterAxisSizingMode="FIXED";
      av.appendChild(txt(n[0],16,"Bold","#6B7280",{align:"CENTER"})); row.appendChild(av);
      const info=alFrame({name:"Info",dir:"VERTICAL",gap:4,pl:0,pr:0,pt:0,pb:0}); row.appendChild(info); fill(info);
      const nt=txt(n,14,"Bold","#111827"); info.appendChild(nt); fill(nt);
      const rt=txt(r,12,"Medium","#6B7280"); info.appendChild(rt); fill(rt);
      const bt=txt(bio,14,"Regular","#9CA3AF",{lineHeight:20}); bt.name="Bio"; info.appendChild(bt); fill(bt);
    });
    const img=alFrame({name:"Image Placeholder",dir:"VERTICAL",bg:"#F3F4F6",main:"CENTER",cross:"CENTER",pl:0,pr:0,pt:0,pb:0,radius:12});
    f.appendChild(img); img.resize(1,300); img.counterAxisSizingMode="FIXED"; fill(img);
    img.appendChild(txt("🖼",40,"Regular","#D1D5DB",{align:"CENTER"}));
    return f;
  },
  "team-5": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Team — Bio Cards",dir:"VERTICAL",bg:"#F9FAFB",w:W,pt:40,pb:40,pl:40,pr:40,gap:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const hdr=alFrame({name:"Header",dir:"VERTICAL",gap:10,pl:0,pr:0,pt:0,pb:0}); f.appendChild(hdr); fill(hdr);
    const ht=txt("Who we are",30,"Bold","#111827"); hdr.appendChild(ht); fill(ht);
    const sh=txt("Meet the team behind the product.",16,"Regular","#6B7280"); hdr.appendChild(sh); fill(sh);
    const row=alFrame({name:"Members",dir:mobile?"VERTICAL":"HORIZONTAL",gap:40,pl:0,pr:0,pt:0,pb:0}); f.appendChild(row); fill(row);
    [["Alex Rivera","CEO","Believer in great design. 10+ years building products people love.","#7C3AED"],
     ["Jordan Lee","Design","Making complex things feel simple, one pixel at a time.","#0EA5E9"],
     ["Sam Chen","Engineering","Systems thinker. Builds things that last.","#10B981"],
     ["Casey Park","Product","Obsessed with understanding users and building what they need.","#F59E0B"]].forEach(([n,r,bio,ac])=>{
      const card=alFrame({name:"Member — "+n,dir:"VERTICAL",bg:"#FFFFFF",gap:12,pl:24,pr:24,pt:24,pb:24,radius:12}); row.appendChild(card); fill(card);
      card.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; card.strokeWeight=1;
      const topRow=alFrame({name:"Top",dir:"HORIZONTAL",gap:12,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); card.appendChild(topRow); fill(topRow);
      const av=alFrame({name:"Avatar",dir:"HORIZONTAL",bg:ac,pl:0,pr:0,pt:0,pb:0,radius:9999,main:"CENTER",cross:"CENTER"});
      av.resize(44,44); av.primaryAxisSizingMode="FIXED"; av.counterAxisSizingMode="FIXED";
      av.appendChild(txt(n[0],16,"Bold","#FFFFFF",{align:"CENTER"})); topRow.appendChild(av);
      const nc=alFrame({name:"Name Col",dir:"VERTICAL",gap:2,pl:0,pr:0,pt:0,pb:0}); topRow.appendChild(nc); fill(nc);
      const nt=txt(n,14,"Bold","#111827"); nc.appendChild(nt); fill(nt);
      const rt=txt(r,12,"Medium",ac); nc.appendChild(rt); fill(rt);
      const bt=txt(bio,14,"Regular","#6B7280",{lineHeight:20}); bt.name="Bio"; card.appendChild(bt); fill(bt);
    });
    return f;
  },
  "team-6": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Team — Split Panel",dir:mobile?"VERTICAL":"HORIZONTAL",bg:"#111827",w:W,pl:40,pr:40,pt:40,pb:40,gap:40,cross:"MIN"});
    if(mobile){ f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED"; } else { f.counterAxisSizingMode="AUTO"; }
    const left=alFrame({name:"Intro",dir:"VERTICAL",gap:20,pl:0,pr:0,pt:0,pb:0}); f.appendChild(left); fill(left);
    const lt=txt("The team.",40,"Bold","#FFFFFF",{lineHeight:48}); left.appendChild(lt); fill(lt);
    const ld=txt("Small team. Big ambitions. We move fast and care deeply about the work.",16,"Regular","#6B7280",{lineHeight:24}); left.appendChild(ld); fill(ld);
    left.appendChild(btnNode("Join us →","none","#FFFFFF",0,0,0));
    const right=alFrame({name:"Members",dir:"VERTICAL",gap:12,pl:0,pr:0,pt:0,pb:0}); f.appendChild(right); fill(right);
    [["Alex Rivera","CEO & Founder"],["Jordan Lee","Head of Design"],["Sam Chen","Lead Engineer"],["Casey Park","Product Manager"],["Morgan Wu","Head of Growth"]].forEach(([n,r])=>{
      const item=alFrame({name:"Member — "+n,dir:"HORIZONTAL",gap:12,pl:16,pr:16,pt:12,pb:12,cross:"CENTER",bg:"#1F2937",radius:8}); right.appendChild(item); fill(item);
      const av=alFrame({name:"Avatar",dir:"HORIZONTAL",bg:"#374151",pl:0,pr:0,pt:0,pb:0,radius:9999,main:"CENTER",cross:"CENTER"});
      av.resize(36,36); av.primaryAxisSizingMode="FIXED"; av.counterAxisSizingMode="FIXED";
      av.appendChild(txt(n[0],14,"Bold","#9CA3AF",{align:"CENTER"})); item.appendChild(av);
      const info=alFrame({name:"Info",dir:"VERTICAL",gap:2,pl:0,pr:0,pt:0,pb:0}); item.appendChild(info); fill(info);
      const nt=txt(n,14,"SemiBold","#F9FAFB"); info.appendChild(nt); fill(nt);
      const rt=txt(r,12,"Regular","#6B7280"); info.appendChild(rt); fill(rt);
    });
    return f;
  },

  // ── FAQ ──────────────────────────────────────────────────────────────────
  "faq-1": W => {
    const f=alFrame({name:"FAQ — Accordion Light",dir:"VERTICAL",bg:"#FFFFFF",w:W,pt:40,pb:40,pl:40,pr:40,gap:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const hdr=alFrame({name:"Header",dir:"VERTICAL",gap:10,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"});
    f.appendChild(hdr); fill(hdr);
    const ey=txt("FAQ",12,"SemiBold","#F97316"); ey.name="Eyebrow"; ey.textAlignHorizontal="CENTER"; hdr.appendChild(ey); fill(ey);
    const hd=txt("Frequently Asked Questions",32,"Bold","#111827",{align:"CENTER"}); hd.name="Heading"; hdr.appendChild(hd); fill(hd);
    const items=alFrame({name:"Accordion",dir:"VERTICAL",gap:0,pl:0,pr:0,pt:0,pb:0});
    f.appendChild(items); fill(items);
    [["How do I get started?","Sign up for free and you'll be designing in minutes. No credit card required.",true],
     ["Can I collaborate with my team?","Invite unlimited team members and work in real-time on any project.",false],
     ["What happens when my trial ends?","Continue on the free tier, or upgrade to Pro for advanced features.",false],
     ["Do you offer refunds?","We offer a 30-day money-back guarantee, no questions asked.",false]
    ].forEach(([q,a,open],i)=>{
      if(i>0){const dv=alFrame({name:"Divider",dir:"HORIZONTAL",bg:"#E5E7EB",pl:0,pr:0,pt:0,pb:0}); items.appendChild(dv); fill(dv); dv.resize(1,1); dv.counterAxisSizingMode="FIXED";}
      const item=alFrame({name:"FAQ Item",dir:"VERTICAL",gap:0,pl:0,pr:0,pt:0,pb:0}); items.appendChild(item); fill(item);
      const qRow=alFrame({name:"Question Row",dir:"HORIZONTAL",gap:12,pl:0,pr:0,pt:16,pb:16,cross:"CENTER",main:"SPACE_BETWEEN"});
      item.appendChild(qRow); fill(qRow);
      const qt=txt(q,16,"SemiBold","#111827"); qRow.appendChild(qt); fill(qt);
      qRow.appendChild(txt(open?"▲":"▾",12,"Regular","#6B7280"));
      if(open){
        const aw=alFrame({name:"Answer",dir:"VERTICAL",pl:0,pr:0,pt:0,pb:16,gap:0}); item.appendChild(aw); fill(aw);
        const at=txt(a,14,"Regular","#6B7280",{lineHeight:22}); aw.appendChild(at); fill(at);
      }
    });
    return f;
  },
  "faq-2": W => {
    const mobile=W<=480;
    const f=alFrame({name:"FAQ — Two Column",dir:"VERTICAL",bg:"#F9FAFB",w:W,pt:40,pb:40,pl:40,pr:40,gap:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const hd=txt("Frequently Asked Questions",32,"Bold","#111827"); f.appendChild(hd); fill(hd);
    const cols=alFrame({name:"Columns",dir:mobile?"VERTICAL":"HORIZONTAL",gap:40,pl:0,pr:0,pt:0,pb:0,cross:"MIN"});
    f.appendChild(cols); fill(cols);
    [[["How do I get started?","Sign up for free in minutes. No credit card required."],["Can I collaborate?","Invite unlimited team members and work together in real-time."]],
     [["What about billing?","Monthly and annual plans. Cancel anytime."],["Is my data secure?","Enterprise-grade encryption and SOC2 certified."]]
    ].forEach(qs=>{
      const col=alFrame({name:"Column",dir:"VERTICAL",gap:24,pl:0,pr:0,pt:0,pb:0}); cols.appendChild(col); fill(col);
      qs.forEach(([q,a])=>{
        const item=alFrame({name:"FAQ — "+q.slice(0,18),dir:"VERTICAL",gap:8,pl:0,pr:0,pt:0,pb:0}); col.appendChild(item); fill(item);
        const qt=txt(q,16,"SemiBold","#111827"); item.appendChild(qt); fill(qt);
        const at=txt(a,14,"Regular","#6B7280",{lineHeight:22}); item.appendChild(at); fill(at);
      });
    });
    return f;
  },
  "faq-3": W => {
    const f=alFrame({name:"FAQ — Dark Stacked",dir:"VERTICAL",bg:"#0F172A",w:W,pt:40,pb:40,pl:40,pr:40,gap:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const hd=txt("Common Questions",32,"Bold","#F1F5F9"); f.appendChild(hd); fill(hd);
    const items=alFrame({name:"Items",dir:"VERTICAL",gap:0,pl:0,pr:0,pt:0,pb:0}); f.appendChild(items); fill(items);
    [["What is Pattern Pilot?","A Figma plugin for generating production-ready section layouts instantly."],
     ["How many sections are included?","30+ section types with 6 variations each — nav, hero, content, and more."],
     ["Does it work with my design system?","Yes. All sections use Auto Layout and adapt to any design tokens."],
     ["Can I customise the sections?","Absolutely. Every layer is named and structured for easy editing."]
    ].forEach(([q,a],i)=>{
      if(i>0){const dv=alFrame({name:"Divider",dir:"HORIZONTAL",bg:"#1E293B",pl:0,pr:0,pt:0,pb:0}); items.appendChild(dv); fill(dv); dv.resize(1,1); dv.counterAxisSizingMode="FIXED";}
      const item=alFrame({name:"FAQ Item",dir:"VERTICAL",gap:10,pl:0,pr:0,pt:20,pb:20}); items.appendChild(item); fill(item);
      const qt=txt(q,16,"SemiBold","#F1F5F9"); item.appendChild(qt); fill(qt);
      const at=txt(a,14,"Regular","#64748B",{lineHeight:22}); item.appendChild(at); fill(at);
    });
    return f;
  },
  "faq-4": W => {
    const f=alFrame({name:"FAQ — Numbered List",dir:"VERTICAL",bg:"#FFFFFF",w:W,pt:40,pb:40,pl:40,pr:40,gap:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const hd=txt("Everything you need to know",30,"Bold","#111827"); f.appendChild(hd); fill(hd);
    const items=alFrame({name:"Items",dir:"VERTICAL",gap:20,pl:0,pr:0,pt:0,pb:0}); f.appendChild(items); fill(items);
    [["01","Is there a free plan?","Yes — our free tier includes 3 projects with no time limit."],
     ["02","How does billing work?","Monthly or annually. Save 30% with an annual plan."],
     ["03","Can I export to code?","Yes. All sections export to clean HTML/CSS and React."],
     ["04","Do you offer team plans?","Team plans start from 3 seats with centralised billing."]
    ].forEach(([num,q,a])=>{
      const row=alFrame({name:"FAQ "+num,dir:"HORIZONTAL",gap:20,pl:0,pr:0,pt:0,pb:0,cross:"MIN"});
      items.appendChild(row); fill(row);
      const nb=alFrame({name:"Number Badge",dir:"HORIZONTAL",bg:"#FFFBEB",pl:10,pr:10,pt:6,pb:6,radius:6,main:"CENTER",cross:"CENTER"});
      nb.appendChild(txt(num,12,"Bold","#F97316")); row.appendChild(nb);
      const col=alFrame({name:"Content",dir:"VERTICAL",gap:6,pl:0,pr:0,pt:0,pb:0}); row.appendChild(col); fill(col);
      const qt=txt(q,16,"SemiBold","#111827"); col.appendChild(qt); fill(qt);
      const at=txt(a,14,"Regular","#6B7280",{lineHeight:20}); col.appendChild(at); fill(at);
    });
    return f;
  },
  "faq-5": W => {
    const mobile=W<=480;
    const f=alFrame({name:"FAQ — Side Header",dir:mobile?"VERTICAL":"HORIZONTAL",bg:"#FFFFFF",w:W,pl:40,pr:40,pt:40,pb:40,gap:40,cross:"MIN"});
    if(mobile){ f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED"; } else { f.counterAxisSizingMode="AUTO"; }
    const left=alFrame({name:"Header Side",dir:"VERTICAL",gap:16,pl:0,pr:0,pt:0,pb:0});
    f.appendChild(left); fill(left);
    const lh=txt("Frequently Asked\nQuestions",30,"Bold","#111827",{lineHeight:38}); left.appendChild(lh); fill(lh);
    const ld=txt("Can't find the answer? Reach out to our support team.",14,"Regular","#6B7280",{lineHeight:22}); left.appendChild(ld); fill(ld);
    left.appendChild(btnNode("Contact us →","none","#111827",0,0,4));
    const right=alFrame({name:"Questions",dir:"VERTICAL",gap:0,pl:0,pr:0,pt:0,pb:0}); f.appendChild(right); fill(right);
    [["What payment methods do you accept?","All major credit cards, PayPal, and bank transfers for annual plans."],
     ["Can I change my plan later?","Yes, upgrade or downgrade at any time from your account settings."],
     ["Is there a student discount?","Students and educators get 50% off with a valid .edu email."],
     ["How do I cancel?","Cancel anytime from Settings → Billing. No penalties or fees."]
    ].forEach(([q,a],i)=>{
      if(i>0){const dv=alFrame({name:"Divider",dir:"HORIZONTAL",bg:"#F3F4F6",pl:0,pr:0,pt:0,pb:0}); right.appendChild(dv); fill(dv); dv.resize(1,1); dv.counterAxisSizingMode="FIXED";}
      const item=alFrame({name:"Q Item",dir:"VERTICAL",gap:8,pl:0,pr:0,pt:18,pb:18}); right.appendChild(item); fill(item);
      const qt=txt(q,14,"SemiBold","#111827"); item.appendChild(qt); fill(qt);
      const at=txt(a,14,"Regular","#6B7280",{lineHeight:20}); item.appendChild(at); fill(at);
    });
    return f;
  },
  "faq-6": W => {
    const mobile=W<=480;
    const f=alFrame({name:"FAQ — Card Grid",dir:"VERTICAL",bg:"#F5F3FF",w:W,pt:40,pb:40,pl:40,pr:40,gap:40,cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const hd=txt("Got Questions?",32,"Bold","#111827",{align:"CENTER"}); f.appendChild(hd); fill(hd);
    const sd=txt("Everything you need to know about the product.",16,"Regular","#6B7280",{align:"CENTER"}); f.appendChild(sd); fill(sd);
    const grid=alFrame({name:"Cards",dir:mobile?"VERTICAL":"HORIZONTAL",gap:16,pl:0,pr:0,pt:0,pb:0,cross:"MIN"}); f.appendChild(grid);
    if(!mobile){ grid.resize(1,240); grid.counterAxisSizingMode="FIXED"; }
    fill(grid);
    [["🔓","Getting Started","Sign up free, pick a plan, invite your team. Live in minutes."],
     ["💳","Billing & Plans","Flexible monthly or annual. Upgrade or cancel anytime."],
     ["🛡","Privacy & Security","SOC2 certified. Encrypted at rest and in transit."],
     ["💬","Support","24/7 live chat. Average response under 2 hours."]
    ].forEach(([ic,q,a])=>{
      const card=alFrame({name:"Card — "+q,dir:"VERTICAL",bg:"#FFFFFF",gap:10,pl:16,pr:16,pt:16,pb:16,radius:12}); grid.appendChild(card); fill(card); if(!mobile) fillV(card);
      card.strokes=[{type:"SOLID",color:rgb("#DDD6FE")}]; card.strokeWeight=1;
      card.appendChild(txt(ic,24,"Regular","#7C3AED"));
      const qt=txt(q,14,"Bold","#111827"); card.appendChild(qt); fill(qt);
      const at=txt(a,14,"Regular","#6B7280",{lineHeight:20}); card.appendChild(at); fill(at);
    });
    return f;
  },

  // ── NEWSLETTER ───────────────────────────────────────────────────────────
  "news-1": W => {
    const f=alFrame({name:"Newsletter — Calm Capture",dir:"VERTICAL",bg:"#F9FAFB",w:W,pt:40,pb:40,pl:40,pr:40,gap:40,cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    f.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; f.strokeWeight=1; f.strokeAlign="OUTSIDE";
    const ey=txt("STAY UPDATED",12,"SemiBold","#F97316"); ey.name="Eyebrow"; ey.textAlignHorizontal="CENTER"; f.appendChild(ey); fill(ey);
    const hd=txt("Get the Latest News",30,"Bold","#111827",{align:"CENTER"}); hd.name="Heading"; f.appendChild(hd); fill(hd);
    const sd=txt("Subscribe and stay up-to-date with the latest features, tips, and insights.",16,"Regular","#6B7280",{align:"CENTER"}); sd.name="Subheading"; f.appendChild(sd); fill(sd);
    f.appendChild(btnNode("Subscribe","#F97316","#FFFFFF",28,13,8));
    const fn=txt("No spam, unsubscribe at any time.",12,"Regular","#9CA3AF",{align:"CENTER"}); fn.name="Fine Print"; f.appendChild(fn); fill(fn);
    return f;
  },
  "news-2": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Newsletter — Dark Signal",dir:"VERTICAL",bg:"#0F172A",w:W,pt:40,pb:40,pl:40,pr:40,gap:40,cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const hd=txt("Stay in the loop.",36,"Bold","#FFFFFF",{align:"CENTER"}); f.appendChild(hd); fill(hd);
    const sd=txt("Get weekly product updates and design tips delivered to your inbox.",16,"Regular","#94A3B8",{align:"CENTER"}); f.appendChild(sd); fill(sd);
    const row=alFrame({name:"Subscribe Row",dir:mobile?"VERTICAL":"HORIZONTAL",gap:0,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); f.appendChild(row); fill(row);
    const input=alFrame({name:"Email Input",dir:"HORIZONTAL",bg:"#1E293B",pl:16,pr:16,pt:12,pb:12,cross:"CENTER",radius:0}); row.appendChild(input); fill(input);
    input.strokes=[{type:"SOLID",color:rgb("#334155")}]; input.strokeWeight=1;
    const ph=txt("Enter your email",14,"Regular","#475569"); ph.name="Placeholder"; input.appendChild(ph); fill(ph);
    const btn=btnNode("Subscribe","#F97316","#FFFFFF",20,12,0); row.appendChild(btn); if(mobile) fill(btn);
    return f;
  },
  "news-3": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Newsletter — Inline Strip",dir:mobile?"VERTICAL":"HORIZONTAL",bg:"#F97316",w:W,pl:40,pr:40,pt:40,pb:40,gap:40,cross:"CENTER"});
    if(mobile){ f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED"; } else { f.counterAxisSizingMode="AUTO"; }
    const left=alFrame({name:"Copy",dir:"VERTICAL",gap:6,pl:0,pr:0,pt:0,pb:0}); f.appendChild(left); fill(left);
    const lt=txt("Get product updates",18,"Bold","#FFFFFF"); left.appendChild(lt); fill(lt);
    const st=txt("Weekly digest. No spam, ever.",14,"Regular","#FEE2E2"); left.appendChild(st); fill(st);
    const row=alFrame({name:"Subscribe Row",dir:"HORIZONTAL",gap:0,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); f.appendChild(row); fill(row);
    const input=alFrame({name:"Email Input",dir:"HORIZONTAL",bg:"#FFFFFF",pl:16,pr:16,pt:10,pb:10,cross:"CENTER"}); row.appendChild(input); fill(input);
    input.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; input.strokeWeight=1;
    const ph=txt("your@email.com",14,"Regular","#9CA3AF"); ph.name="Placeholder"; input.appendChild(ph); fill(ph);
    row.appendChild(btnNode("Join","#111827","#FFFFFF",20,10,0));
    return f;
  },
  "news-4": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Newsletter — Card Float",dir:"VERTICAL",bg:"#EFF6FF",w:W,pt:40,pb:40,pl:40,pr:40,gap:40,cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const card=alFrame({name:"Card",dir:"VERTICAL",bg:"#FFFFFF",gap:40,pl:40,pr:40,pt:40,pb:40,radius:16,cross:"CENTER"}); f.appendChild(card); fill(card);
    card.strokes=[{type:"SOLID",color:rgb("#DBEAFE")}]; card.strokeWeight=1;
    const et=txt("✉️",32,"Regular","#2563EB",{align:"CENTER"}); card.appendChild(et); fill(et);
    const hd=txt("Subscribe to our newsletter",24,"Bold","#111827",{align:"CENTER"}); card.appendChild(hd); fill(hd);
    const sd=txt("Join 5,000+ readers. Weekly insights on product, design, and growth.",14,"Regular","#6B7280",{align:"CENTER"}); card.appendChild(sd); fill(sd);
    const row=alFrame({name:"Subscribe Row",dir:mobile?"VERTICAL":"HORIZONTAL",gap:10,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); card.appendChild(row); fill(row);
    const input=alFrame({name:"Email Input",dir:"HORIZONTAL",bg:"#F9FAFB",pl:14,pr:14,pt:10,pb:10,cross:"CENTER",radius:8}); row.appendChild(input); fill(input);
    input.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; input.strokeWeight=1;
    const ph=txt("Enter your email",14,"Regular","#9CA3AF"); ph.name="Placeholder"; input.appendChild(ph); fill(ph);
    const btn=btnNode("Subscribe","#2563EB","#FFFFFF",18,10,8); row.appendChild(btn); if(mobile) fill(btn);
    return f;
  },
  "news-5": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Newsletter — Bold Ask",dir:mobile?"VERTICAL":"HORIZONTAL",bg:"#111827",w:W,pl:40,pr:40,pt:40,pb:40,gap:40,cross:"CENTER"});
    if(mobile){ f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED"; } else { f.counterAxisSizingMode="AUTO"; }
    const left=alFrame({name:"Copy",dir:"VERTICAL",gap:16,pl:0,pr:0,pt:0,pb:0}); f.appendChild(left); fill(left);
    const hd=txt("Don't miss a thing.",36,"Bold","#FFFFFF",{lineHeight:44}); left.appendChild(hd); fill(hd);
    const sd=txt("Weekly newsletter trusted by 12,000+ designers and builders.",16,"Regular","#94A3B8",{lineHeight:24}); left.appendChild(sd); fill(sd);
    const right=alFrame({name:"Form",dir:"VERTICAL",gap:12,pl:0,pr:0,pt:0,pb:0,cross:"MIN"}); f.appendChild(right); fill(right);
    const input=alFrame({name:"Email Input",dir:"HORIZONTAL",bg:"#1F2937",pl:16,pr:16,pt:12,pb:12,cross:"CENTER",radius:8}); right.appendChild(input); fill(input);
    input.strokes=[{type:"SOLID",color:rgb("#374151")}]; input.strokeWeight=1;
    const ph=txt("Your email address",14,"Regular","#4B5563"); ph.name="Placeholder"; input.appendChild(ph); fill(ph);
    const btn=btnNode("Get the newsletter →","#F97316","#FFFFFF",20,12,8); right.appendChild(btn); fill(btn);
    const fn=txt("No spam. Unsubscribe anytime.",12,"Regular","#4B5563"); right.appendChild(fn); fill(fn);
    return f;
  },
  "news-6": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Newsletter — Minimal Line",dir:mobile?"VERTICAL":"HORIZONTAL",bg:"#FFFFFF",w:W,pl:40,pr:40,pt:40,pb:40,gap:40,cross:"CENTER"});
    if(mobile){ f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED"; } else { f.counterAxisSizingMode="AUTO"; }
    f.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; f.strokeWeight=1; f.strokeAlign="OUTSIDE";
    const left=alFrame({name:"Copy",dir:"VERTICAL",gap:4,pl:0,pr:0,pt:0,pb:0}); f.appendChild(left); fill(left);
    const ht=txt("Subscribe to our newsletter",16,"SemiBold","#111827"); left.appendChild(ht); fill(ht);
    const st=txt("Monthly product updates and design inspiration.",14,"Regular","#6B7280"); left.appendChild(st); fill(st);
    const row=alFrame({name:"Subscribe Row",dir:"HORIZONTAL",gap:0,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); f.appendChild(row); fill(row);
    const input=alFrame({name:"Email Input",dir:"HORIZONTAL",bg:"#F9FAFB",pl:14,pr:14,pt:9,pb:9,cross:"CENTER"}); row.appendChild(input); fill(input);
    input.strokes=[{type:"SOLID",color:rgb("#D1D5DB")}]; input.strokeWeight=1;
    const ph=txt("you@email.com",14,"Regular","#9CA3AF"); ph.name="Placeholder"; input.appendChild(ph); fill(ph);
    row.appendChild(btnNode("Subscribe","#111827","#FFFFFF",16,9,0));
    return f;
  },

  // ── PRICING ──────────────────────────────────────────────────────────────
  "price-1": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Pricing — Clean Trio",dir:"VERTICAL",bg:"#FFFFFF",w:W,pt:40,pb:40,pl:40,pr:40,gap:40,cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const hd=txt("Simple Pricing",32,"Bold","#111827",{align:"CENTER"}); f.appendChild(hd); fill(hd);
    const sd=txt("No hidden fees. Switch plans anytime.",16,"Regular","#6B7280",{align:"CENTER"}); f.appendChild(sd); fill(sd);
    const row=alFrame({name:"Plans",dir:mobile?"VERTICAL":"HORIZONTAL",gap:20,pl:0,pr:0,pt:0,pb:0}); f.appendChild(row); fill(row);
    [{plan:"Free",price:"$0",period:"/month",desc:"For individuals getting started.",features:["3 projects","Basic analytics","Community support"],btn:"Get Started",btnBg:"none",btnTxt:"#374151"},
     {plan:"Pro",price:"$29",period:"/month",desc:"For growing teams and businesses.",features:["Unlimited projects","Advanced analytics","Priority support","Custom domains"],btn:"Start Free Trial",btnBg:"#F97316",btnTxt:"#FFFFFF",hi:true},
     {plan:"Enterprise",price:"Custom",period:"",desc:"For large organisations.",features:["Everything in Pro","SSO & SAML","SLA guarantee","Dedicated support"],btn:"Contact Sales",btnBg:"#111827",btnTxt:"#FFFFFF"}
    ].forEach(({plan,price,period,desc,features,btn,btnBg,btnTxt,hi})=>{
      const card=alFrame({name:"Plan — "+plan,dir:"VERTICAL",bg:hi?"#FFFFFF":"#F9FAFB",gap:16,pl:24,pr:24,pt:24,pb:24,radius:12}); row.appendChild(card); fill(card);
      if(hi){card.strokes=[{type:"SOLID",color:rgb("#F97316")}]; card.strokeWeight=2;}
      else{card.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; card.strokeWeight=1;}
      if(hi) card.appendChild(pillNode("Popular","#FFFBEB","#F97316"));
      card.appendChild(txt(plan,14,"SemiBold","#6B7280"));
      const pr=alFrame({name:"Price",dir:"HORIZONTAL",gap:2,pl:0,pr:0,pt:0,pb:0,cross:"BASELINE"});
      card.appendChild(pr);
      pr.appendChild(txt(price,36,"Bold","#111827"));
      if(period) pr.appendChild(txt(period,14,"Regular","#9CA3AF"));
      const dt=txt(desc,14,"Regular","#6B7280",{lineHeight:20}); card.appendChild(dt); fill(dt);
      const dv=alFrame({name:"Divider",dir:"HORIZONTAL",bg:"#E5E7EB",pl:0,pr:0,pt:0,pb:0}); card.appendChild(dv); fill(dv); dv.resize(1,1); dv.counterAxisSizingMode="FIXED";
      features.forEach(f2=>{
        const fr=alFrame({name:"Feature",dir:"HORIZONTAL",gap:8,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); card.appendChild(fr); fill(fr);
        fr.appendChild(txt("✓",12,"SemiBold","#16A34A"));
        const ft=txt(f2,14,"Regular","#374151"); fr.appendChild(ft); fill(ft);
      });
      const bb=btnNode(btn,btnBg,btnTxt,16,10,8); card.appendChild(bb); fill(bb);
    });
    return f;
  },
  "price-2": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Pricing — Dark Tiers",dir:"VERTICAL",bg:"#0F172A",w:W,pt:40,pb:40,pl:40,pr:40,gap:40,cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const hd=txt("Choose your plan",32,"Bold","#F1F5F9",{align:"CENTER"}); f.appendChild(hd); fill(hd);
    const row=alFrame({name:"Plans",dir:mobile?"VERTICAL":"HORIZONTAL",gap:16,pl:0,pr:0,pt:0,pb:0}); f.appendChild(row); fill(row);
    [{plan:"Starter",price:"$0",features:["3 projects","5GB storage","Email support"]},
     {plan:"Growth",price:"$19",features:["10 projects","20GB storage","Priority support","Analytics"],hi:true},
     {plan:"Scale",price:"$49",features:["Unlimited","100GB storage","24/7 support","Custom integrations"]}
    ].forEach(({plan,price,features,hi})=>{
      const card=alFrame({name:"Plan — "+plan,dir:"VERTICAL",bg:hi?"#1E293B":"#0F172A",gap:16,pl:20,pr:20,pt:20,pb:20,radius:12}); row.appendChild(card); fill(card);
      card.strokes=[{type:"SOLID",color:rgb(hi?"#F97316":"#1E293B")}]; card.strokeWeight=hi?2:1;
      card.appendChild(txt(plan,12,"SemiBold","#94A3B8"));
      card.appendChild(txt(price,34,"Bold","#FFFFFF"));
      const dv=alFrame({name:"Divider",dir:"HORIZONTAL",bg:"#1E293B",pl:0,pr:0,pt:0,pb:0}); card.appendChild(dv); fill(dv); dv.resize(1,1); dv.counterAxisSizingMode="FIXED";
      features.forEach(f2=>{
        const fr=alFrame({name:"Feature",dir:"HORIZONTAL",gap:8,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); card.appendChild(fr); fill(fr);
        fr.appendChild(txt("→",12,"Regular","#F97316"));
        const ft=txt(f2,14,"Regular","#94A3B8"); fr.appendChild(ft); fill(ft);
      });
      const bb=btnNode(hi?"Get started":"Choose",hi?"#F97316":"none",hi?"#FFFFFF":"#94A3B8",16,10,8); card.appendChild(bb); fill(bb);
    });
    return f;
  },
  "price-3": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Pricing — Highlight Mid",dir:"VERTICAL",bg:"#FFFFFF",w:W,pt:40,pb:40,pl:40,pr:40,gap:40,cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const hd=txt("Pick the plan that fits",32,"Bold","#111827",{align:"CENTER"}); f.appendChild(hd); fill(hd);
    const row=alFrame({name:"Plans",dir:mobile?"VERTICAL":"HORIZONTAL",gap:24,pl:0,pr:0,pt:0,pb:0,cross:"MIN"}); f.appendChild(row); fill(row);
    [{plan:"Basic",price:"$9",desc:"For freelancers",bg:"#F9FAFB",border:"#E5E7EB",tc:"#111827"},
     {plan:"Pro",price:"$29",desc:"Best for growing teams",bg:"#F97316",border:"#F97316",tc:"#FFFFFF",hi:true},
     {plan:"Business",price:"$79",desc:"For enterprise teams",bg:"#F9FAFB",border:"#E5E7EB",tc:"#111827"}
    ].forEach(({plan,price,desc,bg,border,tc,hi})=>{
      const card=alFrame({name:"Plan — "+plan,dir:"VERTICAL",bg,gap:12,pl:24,pr:24,pt:24,pb:24}); row.appendChild(card); fill(card);
      if(!hi){card.strokes=[{type:"SOLID",color:rgb(border)}]; card.strokeWeight=1;}
      card.appendChild(txt(plan,12,"SemiBold",hi?"#FEE2E2":"#6B7280"));
      card.appendChild(txt(price,36,"Bold",tc));
      card.appendChild(txt(desc,14,"Regular",hi?"#FEE2E2":"#6B7280"));
      const bb=btnNode(hi?"Start Now":"Get started",hi?"#FFFFFF":"none",hi?"#F97316":tc,16,10,6); card.appendChild(bb); fill(bb);
    });
    return f;
  },
  "price-4": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Pricing — Toggle Plan",dir:"VERTICAL",bg:"#F9FAFB",w:W,pt:40,pb:40,pl:40,pr:40,gap:40,cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const hd=txt("Flexible Plans",32,"Bold","#111827",{align:"CENTER"}); f.appendChild(hd); fill(hd);
    const toggle=alFrame({name:"Billing Toggle",dir:"HORIZONTAL",bg:"#E5E7EB",gap:0,pl:4,pr:4,pt:4,pb:4,radius:9999,cross:"CENTER"});
    f.appendChild(toggle);
    const monthly=alFrame({name:"Monthly (Active)",dir:"HORIZONTAL",bg:"#FFFFFF",pl:16,pr:16,pt:6,pb:6,radius:9999,main:"CENTER",cross:"CENTER"});
    monthly.appendChild(txt("Monthly",12,"SemiBold","#111827")); toggle.appendChild(monthly);
    const annual=alFrame({name:"Annual",dir:"HORIZONTAL",pl:16,pr:16,pt:6,pb:6,radius:9999,main:"CENTER",cross:"CENTER"});
    annual.appendChild(txt("Annual — Save 30%",12,"Regular","#6B7280")); toggle.appendChild(annual);
    const row=alFrame({name:"Plans",dir:mobile?"VERTICAL":"HORIZONTAL",gap:16,pl:0,pr:0,pt:0,pb:0}); f.appendChild(row); fill(row);
    [{plan:"Solo",price:"$12",features:["1 seat","10 projects","Email support"]},
     {plan:"Team",price:"$29",features:["5 seats","Unlimited projects","Chat support","Analytics"],hi:true},
     {plan:"Agency",price:"$79",features:["20 seats","Unlimited everything","Dedicated support","White label"]}
    ].forEach(({plan,price,features,hi})=>{
      const card=alFrame({name:"Plan — "+plan,dir:"VERTICAL",bg:"#FFFFFF",gap:14,pl:20,pr:20,pt:20,pb:20,radius:12}); row.appendChild(card); fill(card);
      if(hi){card.strokes=[{type:"SOLID",color:rgb("#F97316")}]; card.strokeWeight=2;}
      else{card.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; card.strokeWeight=1;}
      card.appendChild(txt(plan,14,"SemiBold","#6B7280"));
      const pr=alFrame({name:"Price Row",dir:"HORIZONTAL",gap:2,pl:0,pr:0,pt:0,pb:0,cross:"BASELINE"}); card.appendChild(pr);
      pr.appendChild(txt(price,32,"Bold","#111827")); pr.appendChild(txt("/mo",14,"Regular","#9CA3AF"));
      features.forEach(f2=>{
        const fr=alFrame({name:"Feature",dir:"HORIZONTAL",gap:8,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); card.appendChild(fr); fill(fr);
        fr.appendChild(txt("✓",12,"Bold",hi?"#F97316":"#16A34A"));
        const ft=txt(f2,14,"Regular","#374151"); fr.appendChild(ft); fill(ft);
      });
      const bb=btnNode(hi?"Start free trial":"Choose "+plan,hi?"#F97316":"none",hi?"#FFFFFF":"#374151",14,9,8); card.appendChild(bb); fill(bb);
    });
    return f;
  },
  "price-5": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Pricing — Simple Two",dir:"VERTICAL",bg:"#FFFFFF",w:W,pt:40,pb:40,pl:40,pr:40,gap:40,cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const hd=txt("Two Plans. No Confusion.",32,"Bold","#111827",{align:"CENTER"}); f.appendChild(hd); fill(hd);
    const sd=txt("Free forever. Upgrade when you're ready.",16,"Regular","#6B7280",{align:"CENTER"}); f.appendChild(sd); fill(sd);
    const row=alFrame({name:"Plans",dir:mobile?"VERTICAL":"HORIZONTAL",gap:24,pl:0,pr:0,pt:0,pb:0,cross:"MIN"}); f.appendChild(row); fill(row);
    [{plan:"Free",price:"$0",desc:"Start building for free.",features:["3 active projects","1GB storage","Community support","Basic analytics"],btn:"Start Free",btnBg:"#F3F4F6",btnTxt:"#111827"},
     {plan:"Pro",price:"$25",desc:"Everything you need to grow.",features:["Unlimited projects","50GB storage","Priority support","Advanced analytics","Custom domain","Team collaboration"],btn:"Start 14-day Trial",btnBg:"#F97316",btnTxt:"#FFFFFF",hi:true}
    ].forEach(({plan,price,desc,features,btn,btnBg,btnTxt,hi})=>{
      const card=alFrame({name:"Plan — "+plan,dir:"VERTICAL",bg:"#FFFFFF",gap:16,pl:32,pr:32,pt:32,pb:32,radius:16}); row.appendChild(card); fill(card);
      if(hi){card.strokes=[{type:"SOLID",color:rgb("#F97316")}]; card.strokeWeight=2;}
      else{card.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; card.strokeWeight=1;}
      card.appendChild(txt(plan,14,"Bold","#111827"));
      const pr=alFrame({name:"Price Row",dir:"HORIZONTAL",gap:2,pl:0,pr:0,pt:0,pb:0,cross:"BASELINE"}); card.appendChild(pr);
      pr.appendChild(txt(price,40,"Bold","#111827")); pr.appendChild(txt("/month",14,"Regular","#9CA3AF"));
      const dt=txt(desc,14,"Regular","#6B7280"); card.appendChild(dt); fill(dt);
      const dv=alFrame({name:"Divider",dir:"HORIZONTAL",bg:"#F3F4F6",pl:0,pr:0,pt:0,pb:0}); card.appendChild(dv); fill(dv); dv.resize(1,1); dv.counterAxisSizingMode="FIXED";
      features.forEach(f2=>{
        const fr=alFrame({name:"Feature",dir:"HORIZONTAL",gap:8,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); card.appendChild(fr); fill(fr);
        fr.appendChild(txt(hi?"✦":"✓",12,"SemiBold",hi?"#F97316":"#16A34A"));
        const ft=txt(f2,14,"Regular","#374151"); fr.appendChild(ft); fill(ft);
      });
      const bb=btnNode(btn,btnBg,btnTxt,18,12,8); card.appendChild(bb); fill(bb);
    });
    return f;
  },
  "price-6": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Pricing — Feature Grid",dir:"VERTICAL",bg:"#F9FAFB",w:W,pt:40,pb:40,pl:40,pr:40,gap:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const hd=txt("Why Choose Us",28,"Bold","#111827"); f.appendChild(hd); fill(hd);
    const features=["AI-Powered Design","Real-time Collaboration","Unlimited Projects","Custom Components","Priority Support"];
    if(mobile){
      // Mobile: stacked feature cards
      const list=alFrame({name:"Feature List",dir:"VERTICAL",bg:"#FFFFFF",gap:0,pl:0,pr:0,pt:0,pb:0,radius:12}); f.appendChild(list); fill(list);
      list.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; list.strokeWeight=1;
      features.forEach((feat,i)=>{
        if(i>0){
          const dv=alFrame({name:"Row Divider",dir:"HORIZONTAL",bg:"#F3F4F6",pl:0,pr:0,pt:0,pb:0}); list.appendChild(dv); fill(dv); dv.resize(1,1); dv.counterAxisSizingMode="FIXED";
        }
        const card=alFrame({name:"Row — "+feat,dir:"VERTICAL",gap:8,pl:20,pr:20,pt:16,pb:16,bg:"#FFFFFF"}); list.appendChild(card); fill(card);
        const ft=txt(feat,14,"SemiBold","#111827"); card.appendChild(ft); fill(ft);
        const vals=alFrame({name:"Values",dir:"HORIZONTAL",gap:16,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); card.appendChild(vals);
        const usVal=i<3?"✓":"✓"; const othVal=i<3?"✗":"✓";
        const usC=i<3?"#16A34A":"#16A34A"; const othC=i<3?"#EF4444":"#9CA3AF";
        // US badge
        const usBadge=alFrame({name:"US",dir:"HORIZONTAL",gap:4,pl:8,pr:8,pt:4,pb:4,bg:"#F0FDF4",radius:6,cross:"CENTER"}); vals.appendChild(usBadge);
        usBadge.appendChild(txt("US",10,"Bold","#16A34A")); usBadge.appendChild(txt(usVal,12,"Bold",usC));
        // Others badge
        const othBg=i<3?"#FEF2F2":"#F9FAFB"; const othLblC=i<3?"#EF4444":"#9CA3AF";
        const othBadge=alFrame({name:"Others",dir:"HORIZONTAL",gap:4,pl:8,pr:8,pt:4,pb:4,bg:othBg,radius:6,cross:"CENTER"}); vals.appendChild(othBadge);
        othBadge.appendChild(txt("Others",10,"Bold",othLblC)); othBadge.appendChild(txt(othVal,12,"Bold",othC));
      });
    } else {
      // Tablet / Desktop: standard 3-column table
      const table=alFrame({name:"Comparison Table",dir:"VERTICAL",bg:"#FFFFFF",gap:0,pl:0,pr:0,pt:0,pb:0,radius:12}); f.appendChild(table); fill(table);
      table.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; table.strokeWeight=1;
      const colW=100;
      const hRow=alFrame({name:"Header Row",dir:"HORIZONTAL",gap:0,pl:24,pr:24,pt:16,pb:16,bg:"#F9FAFB",cross:"CENTER"}); table.appendChild(hRow); fill(hRow);
      const fhdr=alFrame({name:"Feature Col",dir:"HORIZONTAL",pl:0,pr:0,pt:0,pb:0}); hRow.appendChild(fhdr); fill(fhdr);
      fhdr.appendChild(txt("FEATURE",10,"Bold","#9CA3AF"));
      ["US","OTHERS"].forEach(label=>{
        const col=alFrame({name:label+" Header",dir:"HORIZONTAL",pl:0,pr:0,pt:0,pb:0,cross:"CENTER",main:"CENTER"}); hRow.appendChild(col);
        col.resize(colW,1); col.primaryAxisSizingMode="FIXED"; col.counterAxisSizingMode="AUTO";
        col.appendChild(txt(label,12,"Bold",label==="US"?"#F97316":"#9CA3AF"));
      });
      features.forEach((feat,i)=>{
        const dv=alFrame({name:"Row Divider",dir:"HORIZONTAL",bg:"#F3F4F6",pl:0,pr:0,pt:0,pb:0}); table.appendChild(dv); fill(dv); dv.resize(1,1); dv.counterAxisSizingMode="FIXED";
        const row=alFrame({name:"Row — "+feat,dir:"HORIZONTAL",gap:0,pl:24,pr:24,pt:14,pb:14,bg:"#FFFFFF",cross:"CENTER"}); table.appendChild(row); fill(row);
        const fc=alFrame({name:"Feature Cell",dir:"VERTICAL",pl:0,pr:0,pt:0,pb:0}); row.appendChild(fc); fill(fc);
        fc.primaryAxisSizingMode="AUTO"; fc.counterAxisSizingMode="AUTO";
        const ft=txt(feat,14,"Regular","#374151"); fc.appendChild(ft); fill(ft);
        const uc=alFrame({name:"Us Cell",dir:"HORIZONTAL",pl:0,pr:0,pt:0,pb:0,cross:"CENTER",main:"CENTER"}); row.appendChild(uc);
        uc.resize(colW,1); uc.primaryAxisSizingMode="FIXED"; uc.counterAxisSizingMode="AUTO";
        uc.appendChild(txt("✓",14,"Bold","#16A34A"));
        const tc=alFrame({name:"Others Cell",dir:"HORIZONTAL",pl:0,pr:0,pt:0,pb:0,cross:"CENTER",main:"CENTER"}); row.appendChild(tc);
        tc.resize(colW,1); tc.primaryAxisSizingMode="FIXED"; tc.counterAxisSizingMode="AUTO";
        tc.appendChild(txt(i<3?"✗":"✓",14,"Regular",i<3?"#EF4444":"#9CA3AF"));
      });
    }
    return f;
  },

  // ── HERO BENTO ───────────────────────────────────────────────────────────
  "bento-1": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Hero — Bento Dark",dir:"VERTICAL",bg:"#0F172A",w:W,pt:40,pb:40,pl:40,pr:40,gap:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const hdr=alFrame({name:"Header",dir:"VERTICAL",gap:16,pl:0,pr:0,pt:0,pb:0}); f.appendChild(hdr); fill(hdr);
    hdr.appendChild(pillNode("New","#1E293B","#94A3B8"));
    const h=txt("Everything You Need\nin One Place",mobile?28:44,"Bold","#FFFFFF",{lineHeight:mobile?36:52}); hdr.appendChild(h); fill(h);
    const sd=txt("The all-in-one platform for modern product teams.",16,"Regular","#94A3B8"); hdr.appendChild(sd); fill(sd);
    const ctaRow=alFrame({name:"CTA Row",dir:"HORIZONTAL",gap:10,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); hdr.appendChild(ctaRow);
    ctaRow.appendChild(btnNode("Get Started","#F97316","#FFFFFF",20,11,8));
    ctaRow.appendChild(btnNode("Learn More","#1E293B","#94A3B8",20,11,8));
    const grid=alFrame({name:"Bento Grid",dir:mobile?"VERTICAL":"HORIZONTAL",gap:24,pl:0,pr:0,pt:0,pb:0,cross:"MIN"}); f.appendChild(grid); fill(grid);
    [{name:"Analytics",icon:"📊",desc:"Real-time insights",bg:"#1E293B"},{name:"Collaboration",icon:"🤝",desc:"Work together",bg:"#1E3A8A"},{name:"Security",icon:"🔒",desc:"Enterprise grade",bg:"#1E293B"}].forEach(({name,icon,desc,bg})=>{
      const card=alFrame({name:"Bento — "+name,dir:"VERTICAL",bg,gap:8,pl:20,pr:20,pt:24,pb:24,radius:12});
      grid.appendChild(card);
      if(!mobile){card.resize(1,180); card.primaryAxisSizingMode="FIXED";}
      fill(card);
      card.appendChild(txt(icon,24,"Regular","#FFFFFF"));
      const cn=txt(name,16,"Bold","#FFFFFF"); card.appendChild(cn); fill(cn);
      const cd=txt(desc,12,"Regular","#64748B"); card.appendChild(cd); fill(cd);
    });
    return f;
  },
  "bento-2": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Hero — Bento Light",dir:"VERTICAL",bg:"#FFFFFF",w:W,pt:40,pb:40,pl:40,pr:40,gap:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const hdr=alFrame({name:"Header",dir:"VERTICAL",gap:16,pl:0,pr:0,pt:0,pb:0}); f.appendChild(hdr); fill(hdr);
    const h=txt("Build Something\nAmazing",mobile?32:48,"Bold","#111827",{lineHeight:mobile?40:56}); hdr.appendChild(h); fill(h);
    const sd=txt("Powerful tools that help you ship faster and collaborate better.",16,"Regular","#6B7280"); hdr.appendChild(sd); fill(sd);
    hdr.appendChild(btnNode("Start Building →","#111827","#FFFFFF",22,12,8));
    const grid=alFrame({name:"Bento Grid",dir:mobile?"VERTICAL":"HORIZONTAL",gap:24,pl:0,pr:0,pt:0,pb:0,cross:"MIN"}); f.appendChild(grid); fill(grid);
    [{name:"Speed",icon:"⚡",bg:"#FFFBEB",border:"#FDE68A"},{name:"Design",icon:"🎨",bg:"#EDE9FE",border:"#DDD6FE"},{name:"Scale",icon:"📈",bg:"#ECFDF5",border:"#A7F3D0"}].forEach(({name,icon,bg,border})=>{
      const card=alFrame({name:"Bento — "+name,dir:"VERTICAL",bg,gap:8,pl:20,pr:20,pt:24,pb:24,radius:12});
      card.strokes=[{type:"SOLID",color:rgb(border)}]; card.strokeWeight=1;
      grid.appendChild(card);
      if(!mobile){card.resize(1,160); card.primaryAxisSizingMode="FIXED";}
      fill(card);
      card.appendChild(txt(icon,28,"Regular","#111827"));
      const cn=txt(name,16,"Bold","#111827"); card.appendChild(cn); fill(cn);
    });
    return f;
  },
  "bento-3": W => {
    const mobile=W<=480;
    const tablet=!mobile&&W<=768;
    const stacked=mobile||tablet;
    // Desktop: HORIZONTAL frame — alFrame({w:W}) already sets primaryAxisSizingMode="FIXED" (width=W) and counterAxisSizingMode="AUTO" (height=Hug). Only override for stacked (VERTICAL).
    const f=alFrame({name:"Hero — Block Play",dir:stacked?"VERTICAL":"HORIZONTAL",bg:"#FFFFFF",w:W,pl:40,pr:40,pt:40,pb:40,gap:40,cross:"MIN"});
    if(stacked){f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";}
    const left=alFrame({name:"Main Block",dir:"VERTICAL",bg:"#F97316",gap:20,pl:32,pr:32,pt:40,pb:40,radius:16});
    f.appendChild(left);
    fill(left); if(!stacked){ fillV(left); }
    const lh=txt("Explore\nPremium Features",mobile?28:36,"Bold","#FFFFFF",{lineHeight:mobile?36:44}); left.appendChild(lh); fill(lh);
    const ld=txt("Unlock the full power of the platform.",14,"Regular","#FEE2E2"); left.appendChild(ld); fill(ld);
    left.appendChild(btnNode("Explore","#FFFFFF","#F97316",20,10,8));
    const right=alFrame({name:"Side Blocks",dir:tablet?"HORIZONTAL":"VERTICAL",gap:24,pl:0,pr:0,pt:0,pb:0}); f.appendChild(right); fill(right);
    [{name:"Join the Community",icon:"👥",bg:"#111827",h:160},{name:"Analytics Dashboard",icon:"📊",bg:"#F9FAFB",border:"#E5E7EB",h:120},{name:"Integrations",icon:"🔗",bg:"#EDE9FE",h:160}].forEach(({name,icon,bg,border,h})=>{
      const card=alFrame({name:"Block — "+name,dir:"VERTICAL",bg,gap:8,pl:20,pr:20,pt:20,pb:20,radius:12});
      right.appendChild(card);
      card.resize(1,160); card.primaryAxisSizingMode="FIXED";
      fill(card);
      if(border){card.strokes=[{type:"SOLID",color:rgb(border)}]; card.strokeWeight=1;}
      card.appendChild(txt(icon,20,"Regular",bg==="#111827"?"#FFFFFF":bg==="#EDE9FE"?"#7C3AED":"#374151"));
      const nm=txt(name,14,"Bold",bg==="#111827"?"#FFFFFF":"#111827"); card.appendChild(nm); fill(nm);
    });
    return f;
  },
  "bento-4": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Hero — Mosaic Grid",dir:"VERTICAL",bg:"#0F172A",w:W,pt:40,pb:40,pl:40,pr:40,gap:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const hd=txt("Where Vision\nMeets Craft",mobile?32:52,"Bold","#FFFFFF",{lineHeight:mobile?40:60}); f.appendChild(hd); fill(hd);
    if(mobile){
      [{name:"Performance",bg:"#1E293B",desc:"10x faster builds"},{name:"Global CDN",bg:"#0EA5E9",desc:"Edge delivery in 40+ regions"},{name:"Security",bg:"#312E81",desc:""},{name:"Uptime",bg:"#1E293B",desc:""},{name:"Support",bg:"#1E3A8A",desc:""}].forEach(({name,desc,bg})=>{
        const card=alFrame({name:"Tile — "+name,dir:"VERTICAL",bg,gap:8,pl:20,pr:20,pt:20,pb:20,radius:12}); f.appendChild(card); fill(card);
        const nt=txt(name,16,"Bold","#FFFFFF"); card.appendChild(nt); fill(nt);
        if(desc){const dt=txt(desc,14,"Regular","#94A3B8"); card.appendChild(dt); fill(dt);}
      });
    } else {
      const row1=alFrame({name:"Row 1",dir:"HORIZONTAL",gap:40,pl:0,pr:0,pt:0,pb:0,cross:"MIN"}); f.appendChild(row1); fill(row1);
      [{name:"Performance",bg:"#1E293B",desc:"10x faster builds"},{name:"Global CDN",bg:"#0EA5E9",desc:"Edge delivery in 40+ regions"}].forEach(({name,desc,bg})=>{
        const card=alFrame({name:"Tile — "+name,dir:"VERTICAL",bg,gap:8,pl:24,pr:24,pt:24,pb:24,radius:12});
        row1.appendChild(card); card.resize(1,140); card.primaryAxisSizingMode="FIXED"; fill(card);
        const nt=txt(name,16,"Bold","#FFFFFF"); card.appendChild(nt); fill(nt);
        const dt=txt(desc,14,"Regular","#94A3B8"); card.appendChild(dt); fill(dt);
      });
      const row2=alFrame({name:"Row 2",dir:"HORIZONTAL",gap:40,pl:0,pr:0,pt:0,pb:0,cross:"MIN"}); f.appendChild(row2); fill(row2);
      [{name:"Security",bg:"#312E81"},{name:"Uptime",bg:"#1E293B"},{name:"Support",bg:"#1E3A8A"}].forEach(({name,bg})=>{
        const card=alFrame({name:"Tile — "+name,dir:"VERTICAL",bg,gap:6,pl:20,pr:20,pt:20,pb:20,radius:12});
        row2.appendChild(card); card.resize(1,100); card.primaryAxisSizingMode="FIXED"; fill(card);
        const nt=txt(name,14,"Bold","#FFFFFF"); card.appendChild(nt); fill(nt);
      });
    }
    return f;
  },
  "bento-5": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Hero — Tile Map",dir:"VERTICAL",bg:"#FAFAFA",w:W,pt:40,pb:40,pl:40,pr:40,gap:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const hdr=alFrame({name:"Header Row",dir:mobile?"VERTICAL":"HORIZONTAL",gap:40,pl:0,pr:0,pt:0,pb:0,cross:mobile?"MIN":"CENTER",main:mobile?"MIN":"SPACE_BETWEEN"}); f.appendChild(hdr); fill(hdr);
    const ht=txt("The Platform Built\nfor What's Next",mobile?28:40,"Bold","#111827",{lineHeight:mobile?36:48}); hdr.appendChild(ht); fill(ht);
    const cta=alFrame({name:"CTA Block",dir:"VERTICAL",gap:12,pl:0,pr:0,pt:0,pb:0,cross:"MIN"}); hdr.appendChild(cta);
    cta.appendChild(btnNode("Get started →","#F97316","#FFFFFF",20,11,8));
    cta.appendChild(txt("✅ 27k+ users  ✅ 150+ countries  ✅ 99.9%",12,"Regular","#9CA3AF"));
    const grid=alFrame({name:"Tile Grid",dir:mobile?"VERTICAL":"HORIZONTAL",gap:24,pl:0,pr:0,pt:0,pb:0,cross:"MIN"}); f.appendChild(grid); fill(grid);
    [{name:"Design Tools",bg:"#111827"},{name:"Dev Handoff",bg:"#F0FDF4",border:"#BBF7D0"},{name:"Team Collab",bg:"#EFF6FF",border:"#BFDBFE"}].forEach(({name,bg,border})=>{
      const card=alFrame({name:"Tile — "+name,dir:"VERTICAL",bg,gap:8,pl:20,pr:20,pt:20,pb:20,radius:12});
      if(border){card.strokes=[{type:"SOLID",color:rgb(border)}]; card.strokeWeight=1;}
      grid.appendChild(card);
      if(!mobile){card.resize(1,120); card.primaryAxisSizingMode="FIXED";}
      fill(card);
      const nt=txt(name,16,"Bold",bg==="#111827"?"#FFFFFF":"#111827"); card.appendChild(nt); fill(nt);
    });
    return f;
  },
  "bento-6": W => {
    const mobile=W<=480;
    const tablet=!mobile&&W<=768;
    const stacked=mobile||tablet;
    // Desktop: HORIZONTAL frame — alFrame({w:W}) already sets primaryAxisSizingMode="FIXED" (width=W) and counterAxisSizingMode="AUTO" (height=Hug). Only override for stacked (VERTICAL).
    const f=alFrame({name:"Hero — Cluster",dir:stacked?"VERTICAL":"HORIZONTAL",bg:"#FFFFFF",w:W,pl:40,pr:40,pt:40,pb:40,gap:40,cross:"MIN"});
    if(stacked){f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";}
    const left=alFrame({name:"Copy",dir:"VERTICAL",gap:24,pl:0,pr:0,pt:0,pb:0,cross:"MIN"});
    f.appendChild(left); fill(left);
    const lh=txt("Think. Design.\nDevelop. Launch.",mobile?28:40,"Bold","#111827",{lineHeight:mobile?36:48}); left.appendChild(lh); fill(lh);
    const lr=txt("Repeat.",mobile?28:40,"Bold","#F97316",{lineHeight:mobile?36:48}); left.appendChild(lr); fill(lr);
    const ldesc=txt("The complete toolkit for teams that ship.",16,"Regular","#6B7280"); left.appendChild(ldesc); fill(ldesc);
    left.appendChild(btnNode("Start for free","#F97316","#FFFFFF",22,12,8));
    const cluster=alFrame({name:"Cluster",dir:"VERTICAL",gap:24,pl:0,pr:0,pt:0,pb:0}); f.appendChild(cluster); fill(cluster);
    const topRow=alFrame({name:"Row A",dir:mobile?"VERTICAL":"HORIZONTAL",gap:24,pl:0,pr:0,pt:0,pb:0,cross:"MIN"}); cluster.appendChild(topRow); fill(topRow);
    [{name:"Fast Builds",bg:"#FFFBEB",border:"#FDE68A"},{name:"Global Scale",bg:"#EDE9FE",border:"#DDD6FE"}].forEach(({name,bg,border})=>{
      const c=alFrame({name:"Tile — "+name,dir:"VERTICAL",bg,gap:4,pl:16,pr:16,pt:16,pb:16,radius:8}); topRow.appendChild(c);
      if(border){c.strokes=[{type:"SOLID",color:rgb(border)}]; c.strokeWeight=1;}
      c.resize(1,120); c.primaryAxisSizingMode="FIXED"; fill(c);
      const cn=txt(name,14,"Bold","#111827"); c.appendChild(cn); fill(cn);
    });
    const mid=alFrame({name:"Tile — Analytics",dir:"HORIZONTAL",bg:"#111827",gap:16,pl:20,pr:20,pt:16,pb:16,radius:8,cross:"CENTER"}); cluster.appendChild(mid); fill(mid);
    mid.appendChild(txt("📈",28,"Regular","#FFFFFF"));
    const mi=alFrame({name:"Analytics Info",dir:"VERTICAL",gap:4,pl:0,pr:0,pt:0,pb:0}); mid.appendChild(mi); fill(mi);
    const mih=txt("Real-time Analytics",14,"Bold","#FFFFFF"); mi.appendChild(mih); fill(mih);
    const mis=txt("Track what matters most",12,"Regular","#6B7280"); mi.appendChild(mis); fill(mis);
    const botRow=alFrame({name:"Row B",dir:mobile?"VERTICAL":"HORIZONTAL",gap:24,pl:0,pr:0,pt:0,pb:0,cross:"MIN"}); cluster.appendChild(botRow); fill(botRow);
    [{name:"Security",bg:"#ECFDF5",border:"#A7F3D0"},{name:"Support",bg:"#F0F9FF",border:"#BAE6FD"},{name:"API",bg:"#FFF1F2",border:"#FECDD3"}].forEach(({name,bg,border})=>{
      const c=alFrame({name:"Tile — "+name,dir:"VERTICAL",bg,gap:4,pl:12,pr:12,pt:12,pb:12,radius:8}); botRow.appendChild(c);
      if(border){c.strokes=[{type:"SOLID",color:rgb(border)}]; c.strokeWeight=1;}
      c.resize(1,80); c.primaryAxisSizingMode="FIXED"; fill(c);
      const cn=txt(name,14,"Bold","#111827"); c.appendChild(cn); fill(cn);
    });
    return f;
  },

  // ── HERO GALLERY ─────────────────────────────────────────────────────────
  "gallery-1": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Hero — Caption Row",dir:"VERTICAL",bg:"#FFFFFF",w:W,pt:40,pb:40,pl:40,pr:40,gap:40,cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const hdr=alFrame({name:"Header",dir:"VERTICAL",gap:24,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); f.appendChild(hdr); fill(hdr);
    const h=txt("See What's Possible",mobile?28:44,"Bold","#111827",{lineHeight:mobile?36:52}); hdr.appendChild(h); fill(h); h.textAlignHorizontal="CENTER";
    const sd=txt("A curated showcase of what you can build. Explore projects,\nget inspired, and start creating your own.",16,"Regular","#6B7280",{lineHeight:24}); hdr.appendChild(sd); fill(sd); sd.textAlignHorizontal="CENTER";
    hdr.appendChild(btnNode("Start Creating","#F97316","#FFFFFF",22,12,8));
    const grid=alFrame({name:"Gallery Grid",dir:mobile?"VERTICAL":"HORIZONTAL",gap:24,pl:0,pr:0,pt:0,pb:0,cross:"MIN"}); f.appendChild(grid); fill(grid);
    [{name:"Pixel Perfect",img:"#D1D5DB",desc:"Every detail crafted to look sharp on any screen."},{name:"Lightning Fast",img:"#9CA3AF",desc:"Go from idea to finished design in minutes."},{name:"Fully Flexible",img:"#E5E7EB",desc:"Customize everything to match your brand and style."}].forEach(({name,img,desc})=>{
      const card=alFrame({name:"Card — "+name,dir:"VERTICAL",gap:12,pl:0,pr:0,pt:0,pb:0}); grid.appendChild(card); fill(card);
      const imgF=alFrame({name:"Image",dir:"VERTICAL",bg:img,gap:0,pl:0,pr:0,pt:0,pb:0,radius:12}); card.appendChild(imgF);
      imgF.resize(1,mobile?160:220); imgF.primaryAxisSizingMode="FIXED"; fill(imgF);
      const cap=alFrame({name:"Caption",dir:"VERTICAL",gap:4,pl:0,pr:0,pt:0,pb:0}); card.appendChild(cap); fill(cap);
      const cn=txt(name,16,"Bold","#111827"); cap.appendChild(cn); fill(cn);
      const cd=txt(desc,14,"Regular","#6B7280",{lineHeight:20}); cap.appendChild(cd); fill(cd);
    });
    return f;
  },
  "gallery-2": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Hero — Dark Showcase",dir:"VERTICAL",bg:"#0F172A",w:W,pt:40,pb:40,pl:40,pr:40,gap:40,cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const hdr=alFrame({name:"Header",dir:"VERTICAL",gap:24,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); f.appendChild(hdr); fill(hdr);
    hdr.appendChild(pillNode("Portfolio","#1E293B","#94A3B8"));
    const h=txt("Crafted with\nPrecision",mobile?28:44,"Bold","#F1F5F9",{lineHeight:mobile?36:52}); hdr.appendChild(h); fill(h); h.textAlignHorizontal="CENTER";
    const sd=txt("A dark, editorial gallery of our finest work.\nEach project tells a story worth seeing.",16,"Regular","#94A3B8",{lineHeight:24}); hdr.appendChild(sd); fill(sd); sd.textAlignHorizontal="CENTER";
    hdr.appendChild(btnNode("Explore Work","#F97316","#FFFFFF",22,12,8));
    const grid=alFrame({name:"Gallery Grid",dir:mobile?"VERTICAL":"HORIZONTAL",gap:24,pl:0,pr:0,pt:0,pb:0,cross:"MIN"}); f.appendChild(grid); fill(grid);
    [{name:"Brand Identity",img:"#334155"},{name:"Motion Design",img:"#475569"},{name:"Product UX",img:"#64748B"}].forEach(({name,img})=>{
      const card=alFrame({name:"Card — "+name,dir:"VERTICAL",bg:"#1E293B",gap:12,pl:0,pr:0,pt:0,pb:16,radius:16}); grid.appendChild(card); fill(card);
      const imgF=alFrame({name:"Image",dir:"VERTICAL",bg:img,gap:0,pl:0,pr:0,pt:0,pb:0,radius:12}); card.appendChild(imgF);
      imgF.resize(1,mobile?160:200); imgF.primaryAxisSizingMode="FIXED"; fill(imgF);
      const cap=alFrame({name:"Caption",dir:"VERTICAL",gap:4,pl:16,pr:16,pt:0,pb:0}); card.appendChild(cap); fill(cap);
      const cn=txt(name,14,"Bold","#F1F5F9"); cap.appendChild(cn); fill(cn);
      cap.appendChild(txt("View project →",12,"Regular","#64748B"));
    });
    return f;
  },
  "gallery-3": W => {
    const mobile=W<=480;
    const tablet=!mobile&&W<=768;
    const stacked=mobile||tablet;
    // f is always VERTICAL — same anchor pattern as all other gallery variants
    const f=alFrame({name:"Hero — Editorial Grid",dir:"VERTICAL",bg:"#FFFFFF",w:W,pt:40,pb:40,pl:40,pr:40,gap:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    if(stacked){
      // Mobile / tablet: copy block then image grid stacked vertically
      const left=alFrame({name:"Copy",dir:"VERTICAL",gap:24,pl:0,pr:0,pt:0,pb:0,cross:"MIN"}); f.appendChild(left); fill(left);
      const eyebrow=txt("GALLERY",12,"Bold","#F97316"); eyebrow.letterSpacing={value:1.2,unit:"PIXELS"}; left.appendChild(eyebrow);
      const h=txt("Work that\nSpeaks for\nItself.",28,"Bold","#111827",{lineHeight:36}); left.appendChild(h); fill(h);
      const sd=txt("Hand-picked projects that push\nthe boundaries of design and craft.",16,"Regular","#6B7280",{lineHeight:24}); left.appendChild(sd); fill(sd);
      left.appendChild(btnNode("View All Work","#F97316","#FFFFFF",20,11,8));
      const rightGrid=alFrame({name:"Image Grid",dir:"VERTICAL",gap:16,pl:0,pr:0,pt:0,pb:0}); f.appendChild(rightGrid); fill(rightGrid);
      [[{bg:"#D1D5DB"},{bg:"#9CA3AF"}],[{bg:"#CBD5E1"},{bg:"#E5E7EB"}]].forEach((row,ri)=>{
        const r=alFrame({name:"Row "+(ri+1),dir:"HORIZONTAL",gap:16,pl:0,pr:0,pt:0,pb:0}); rightGrid.appendChild(r); fill(r);
        row.forEach(({bg})=>{
          const imgF=alFrame({name:"Image",dir:"VERTICAL",bg,gap:0,pl:0,pr:0,pt:0,pb:0,radius:12}); r.appendChild(imgF);
          imgF.resize(1,120); imgF.primaryAxisSizingMode="FIXED"; fill(imgF);
        });
      });
    } else {
      // Desktop: inner HORIZONTAL row (fills f's counter axis = width), proven anchor pattern
      const content=alFrame({name:"Content",dir:"HORIZONTAL",gap:40,pl:0,pr:0,pt:0,pb:0,cross:"MIN"}); f.appendChild(content); fill(content);
      const left=alFrame({name:"Copy",dir:"VERTICAL",gap:24,pl:0,pr:0,pt:0,pb:0,cross:"MIN"}); content.appendChild(left); fill(left);
      const eyebrow=txt("GALLERY",12,"Bold","#F97316"); eyebrow.letterSpacing={value:1.2,unit:"PIXELS"}; left.appendChild(eyebrow);
      const h=txt("Work that\nSpeaks for\nItself.",40,"Bold","#111827",{lineHeight:48}); left.appendChild(h); fill(h);
      const sd=txt("Hand-picked projects that push\nthe boundaries of design and craft.",16,"Regular","#6B7280",{lineHeight:24}); left.appendChild(sd); fill(sd);
      left.appendChild(btnNode("View All Work","#F97316","#FFFFFF",20,11,8));
      const rightGrid=alFrame({name:"Image Grid",dir:"VERTICAL",gap:16,pl:0,pr:0,pt:0,pb:0}); content.appendChild(rightGrid); fill(rightGrid);
      [[{bg:"#D1D5DB"},{bg:"#9CA3AF"}],[{bg:"#CBD5E1"},{bg:"#E5E7EB"}]].forEach((row,ri)=>{
        const r=alFrame({name:"Row "+(ri+1),dir:"HORIZONTAL",gap:16,pl:0,pr:0,pt:0,pb:0}); rightGrid.appendChild(r); fill(r);
        row.forEach(({bg})=>{
          const imgF=alFrame({name:"Image",dir:"VERTICAL",bg,gap:0,pl:0,pr:0,pt:0,pb:0,radius:12}); r.appendChild(imgF);
          imgF.resize(1,160); imgF.primaryAxisSizingMode="FIXED"; fill(imgF);
        });
      });
    }
    return f;
  },
  "gallery-4": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Hero — Feature Mosaic",dir:"VERTICAL",bg:"#FAFAFA",w:W,pt:40,pb:40,pl:40,pr:40,gap:40,cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const hdr=alFrame({name:"Header",dir:"VERTICAL",gap:24,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); f.appendChild(hdr); fill(hdr);
    const h=txt("The Art of\nGreat Design",mobile?28:44,"Bold","#111827",{lineHeight:mobile?36:52}); hdr.appendChild(h); fill(h); h.textAlignHorizontal="CENTER";
    const sd=txt("Three years. Six continents. Over 200 projects. All in one place.",16,"Regular","#6B7280",{lineHeight:24}); hdr.appendChild(sd); fill(sd); sd.textAlignHorizontal="CENTER";
    hdr.appendChild(btnNode("Browse Gallery","#F97316","#FFFFFF",22,12,8));
    const mosaic=alFrame({name:"Mosaic",dir:mobile?"VERTICAL":"HORIZONTAL",gap:16,pl:0,pr:0,pt:0,pb:0,cross:"MIN"}); f.appendChild(mosaic); fill(mosaic);
    const mainImg=alFrame({name:"Main Image",dir:"VERTICAL",bg:"#D1D5DB",gap:0,pl:0,pr:0,pt:0,pb:0,radius:16}); mosaic.appendChild(mainImg);
    if(mobile){mainImg.resize(1,200); mainImg.primaryAxisSizingMode="FIXED"; fill(mainImg);} else {fill(mainImg); fillV(mainImg);}
    const sideStack=alFrame({name:"Side Stack",dir:"VERTICAL",gap:16,pl:0,pr:0,pt:0,pb:0}); mosaic.appendChild(sideStack); fill(sideStack);
    [{bg:"#9CA3AF"},{bg:"#E5E7EB"}].forEach(({bg})=>{
      const imgF=alFrame({name:"Image",dir:"VERTICAL",bg,gap:0,pl:0,pr:0,pt:0,pb:0,radius:12}); sideStack.appendChild(imgF);
      imgF.resize(1,mobile?160:140); imgF.primaryAxisSizingMode="FIXED"; fill(imgF);
    });
    return f;
  },
  "gallery-5": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Hero — Panoramic Stage",dir:"VERTICAL",bg:"#FFFFFF",w:W,pt:40,pb:40,pl:40,pr:40,gap:32,cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const hdr=alFrame({name:"Header",dir:"VERTICAL",gap:24,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); f.appendChild(hdr); fill(hdr);
    const h=txt("One Frame.\nEvery Story.",mobile?28:48,"Bold","#111827",{lineHeight:mobile?36:56}); hdr.appendChild(h); fill(h); h.textAlignHorizontal="CENTER";
    const sd=txt("A panoramic showcase of standout work from our studio.",16,"Regular","#6B7280",{lineHeight:24}); hdr.appendChild(sd); fill(sd); sd.textAlignHorizontal="CENTER";
    hdr.appendChild(btnNode("See All Projects","#F97316","#FFFFFF",22,12,8));
    const hero=alFrame({name:"Hero Image",dir:"VERTICAL",bg:"#D1D5DB",gap:0,pl:0,pr:0,pt:0,pb:0,radius:16}); f.appendChild(hero);
    hero.resize(1,mobile?160:280); hero.primaryAxisSizingMode="FIXED"; fill(hero);
    const strip=alFrame({name:"Thumbnail Strip",dir:mobile?"VERTICAL":"HORIZONTAL",gap:16,pl:0,pr:0,pt:0,pb:0}); f.appendChild(strip); fill(strip);
    [{bg:"#9CA3AF"},{bg:"#CBD5E1"},{bg:"#E5E7EB"}].forEach(({bg})=>{
      const imgF=alFrame({name:"Thumb",dir:"VERTICAL",bg,gap:0,pl:0,pr:0,pt:0,pb:0,radius:12}); strip.appendChild(imgF);
      imgF.resize(1,mobile?80:100); imgF.primaryAxisSizingMode="FIXED"; fill(imgF);
    });
    return f;
  },
  "gallery-6": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Hero — Studio Wall",dir:"VERTICAL",bg:"#111827",w:W,pt:40,pb:40,pl:40,pr:40,gap:40,cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const hdr=alFrame({name:"Header",dir:"VERTICAL",gap:24,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); f.appendChild(hdr); fill(hdr);
    hdr.appendChild(pillNode("Our Work","#1F2937","#94A3B8"));
    const h=txt("A Wall of\nInspiration",mobile?28:48,"Bold","#F9FAFB",{lineHeight:mobile?36:56}); hdr.appendChild(h); fill(h); h.textAlignHorizontal="CENTER";
    const sd=txt("Every pixel intentional. Every project a statement.",16,"Regular","#94A3B8",{lineHeight:24}); hdr.appendChild(sd); fill(sd); sd.textAlignHorizontal="CENTER";
    hdr.appendChild(btnNode("Start a Project","#F97316","#FFFFFF",22,12,8));
    const row1=alFrame({name:"Row 1",dir:mobile?"VERTICAL":"HORIZONTAL",gap:16,pl:0,pr:0,pt:0,pb:0}); f.appendChild(row1); fill(row1);
    [{bg:"#334155"},{bg:"#475569"},{bg:"#64748B"}].forEach(({bg})=>{
      const imgF=alFrame({name:"Image",dir:"VERTICAL",bg,gap:0,pl:0,pr:0,pt:0,pb:0,radius:12}); row1.appendChild(imgF);
      imgF.resize(1,mobile?140:180); imgF.primaryAxisSizingMode="FIXED"; fill(imgF);
    });
    const row2=alFrame({name:"Row 2",dir:mobile?"VERTICAL":"HORIZONTAL",gap:16,pl:0,pr:0,pt:0,pb:0}); f.appendChild(row2); fill(row2);
    [{bg:"#374151"},{bg:"#4B5563"}].forEach(({bg})=>{
      const imgF=alFrame({name:"Image",dir:"VERTICAL",bg,gap:0,pl:0,pr:0,pt:0,pb:0,radius:12}); row2.appendChild(imgF);
      imgF.resize(1,mobile?120:140); imgF.primaryAxisSizingMode="FIXED"; fill(imgF);
    });
    return f;
  },

  // ── VIDEO HERO ───────────────────────────────────────────────────────────
  "video-1": W => {
    const f=alFrame({name:"Video Hero — Cinema Frame",dir:"VERTICAL",bg:"#09090B",w:W,pt:40,pb:40,pl:40,pr:40,gap:40,cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const mobile=W<=480;
    f.appendChild(pillNode("New release","#18181B","#FFFFFF"));
    const h=txt("Build at the\nSpeed of Thought",52,"Bold","#FFFFFF",{lineHeight:60}); f.appendChild(h); if(mobile){fill(h); h.textAlignHorizontal="CENTER";}
    const vf=alFrame({name:"Video Frame",dir:"VERTICAL",bg:"#18181B",main:"CENTER",cross:"CENTER",radius:12,gap:12,pl:0,pr:0,pt:0,pb:0});
    vf.strokes=[{type:"SOLID",color:rgb("#27272A")}]; vf.strokeWeight=1;
    f.appendChild(vf);
    vf.resize(1,Math.round((W-80)*.5625)); vf.primaryAxisSizingMode="FIXED"; fill(vf);
    const pb=alFrame({name:"Play Button",dir:"HORIZONTAL",bg:"#FFFFFF",main:"CENTER",cross:"CENTER",pl:16,pr:16,pt:14,pb:14,radius:9999,gap:0}); pb.appendChild(txt("▶",20,"Regular","#09090B")); vf.appendChild(pb);
    vf.appendChild(txt("Watch the demo · 2 min",14,"Regular","#71717A"));
    return f;
  },
  "video-2": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Video Hero — Split Play",dir:mobile?"VERTICAL":"HORIZONTAL",bg:"#FFFFFF",w:W,pl:40,pr:40,pt:40,pb:40,gap:40,cross:"CENTER"});
    if(mobile){ f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED"; }
    const left=alFrame({name:"Copy",dir:"VERTICAL",gap:20,pl:0,pr:0,pt:0,pb:0});
    f.appendChild(left); fill(left);
    if(mobile){ left.counterAxisAlignItems="CENTER"; left.primaryAxisAlignItems="MIN"; }
    const h=txt("See it in\naction.",44,"Bold","#111827",{lineHeight:52}); left.appendChild(h); if(mobile){fill(h); h.textAlignHorizontal="CENTER";}
    const sd=txt("Watch how teams use our platform to ship 10x faster.",16,"Regular","#6B7280",{lineHeight:24}); left.appendChild(sd); fill(sd); if(mobile) sd.textAlignHorizontal="CENTER";
    left.appendChild(btnNode("Get started free","#F97316","#FFFFFF",20,11,8));
    const vf=alFrame({name:"Video Frame",dir:"VERTICAL",bg:"#F1F5F9",main:"CENTER",cross:"CENTER",radius:12,gap:8,pl:0,pr:0,pt:0,pb:0});
    f.appendChild(vf);
    const vfH=mobile?Math.round((W-80)*.5625):Math.round((W-120)/2*.5625);
    vf.resize(1,vfH); vf.primaryAxisSizingMode="FIXED"; fill(vf);
    const pb=alFrame({name:"Play Button",dir:"HORIZONTAL",bg:"#F97316",main:"CENTER",cross:"CENTER",pl:14,pr:14,pt:12,pb:12,radius:9999,gap:0}); pb.appendChild(txt("▶",18,"Regular","#FFFFFF")); vf.appendChild(pb);
    vf.appendChild(txt("3 min walkthrough",12,"Regular","#9CA3AF"));
    return f;
  },
  "video-3": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Video Hero — Overlay CTA",dir:"VERTICAL",bg:"#111827",w:W,pt:40,pb:40,pl:40,pr:40,gap:40,cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const vf=alFrame({name:"Video Frame",dir:"VERTICAL",bg:"#1F2937",main:"CENTER",cross:"CENTER",radius:12,gap:20,pl:40,pr:40,pt:60,pb:60});
    f.appendChild(vf);
    if(mobile){ vf.primaryAxisSizingMode="AUTO"; } else { vf.resize(1,Math.round((W-80)*.5625)); vf.primaryAxisSizingMode="FIXED"; } fill(vf);
    const headline=txt("A film about\nwhat we build.",52,"Bold","#FFFFFF",{lineHeight:60,align:"CENTER"});
    vf.appendChild(headline); fill(headline);
    const pb=alFrame({name:"Play Button",dir:"HORIZONTAL",bg:"transparent",main:"CENTER",cross:"CENTER",pl:20,pr:20,pt:14,pb:14,radius:9999,gap:8});
    pb.fills=[{type:"SOLID",color:{r:1,g:1,b:1},opacity:0.15}];
    pb.strokes=[{type:"SOLID",color:{r:1,g:1,b:1}}]; pb.strokeWeight=1; pb.strokeAlign="INSIDE";
    pb.appendChild(txt("▶",14,"Regular","#FFFFFF")); pb.appendChild(txt("Watch film",14,"SemiBold","#FFFFFF"));
    vf.appendChild(pb);
    return f;
  },
  "video-4": W => {
    const f=alFrame({name:"Video Hero — Minimal Player",dir:"VERTICAL",bg:"#FFFFFF",w:W,pt:40,pb:40,pl:40,pr:40,gap:40,cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const mobile=W<=480;
    const h=txt("See How It Works",36,"Bold","#111827"); f.appendChild(h); if(mobile){fill(h); h.textAlignHorizontal="CENTER";}
    const sd=txt("A quick walkthrough of the most loved features.",16,"Regular","#6B7280"); f.appendChild(sd); if(mobile){fill(sd); sd.textAlignHorizontal="CENTER";}
    const vf=alFrame({name:"Video Frame",dir:"VERTICAL",bg:"#F9FAFB",main:"CENTER",cross:"CENTER",radius:16,gap:8,pl:0,pr:0,pt:0,pb:0});
    vf.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; vf.strokeWeight=1;
    f.appendChild(vf);
    vf.resize(1,Math.round((W-80)*.5625)); vf.primaryAxisSizingMode="FIXED"; fill(vf);
    const pb=alFrame({name:"Play Button",dir:"HORIZONTAL",bg:"#111827",main:"CENTER",cross:"CENTER",pl:18,pr:18,pt:14,pb:14,radius:9999,gap:8});
    pb.appendChild(txt("▶ Play video",14,"SemiBold","#FFFFFF")); vf.appendChild(pb);
    return f;
  },
  "video-5": W => {
    const f=alFrame({name:"Video Hero — Product Demo",dir:"VERTICAL",bg:"#0F172A",w:W,pt:40,pb:40,pl:40,pr:40,gap:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const mobile=W<=480;
    const hdr=alFrame({name:"Header",dir:mobile?"VERTICAL":"HORIZONTAL",gap:mobile?16:32,pl:0,pr:0,pt:0,pb:0,cross:"CENTER",main:mobile?"MIN":"SPACE_BETWEEN"}); f.appendChild(hdr); fill(hdr);
    if(mobile){ hdr.primaryAxisSizingMode="AUTO"; } else { hdr.counterAxisSizingMode="AUTO"; }
    const tb=alFrame({name:"Title Block",dir:"VERTICAL",gap:12,pl:0,pr:0,pt:0,pb:0}); hdr.appendChild(tb); fill(tb);
    const title=txt("Watch the Product Demo",30,"Bold","#F1F5F9"); tb.appendChild(title); if(mobile){fill(title); title.textAlignHorizontal="CENTER";}
    const sd=txt("See exactly what Pattern Pilot can do in under 3 minutes.",14,"Regular","#64748B"); tb.appendChild(sd); fill(sd); if(mobile) sd.textAlignHorizontal="CENTER";
    hdr.appendChild(btnNode("Start free trial","#F97316","#FFFFFF",20,11,8));
    const vf=alFrame({name:"Video Frame",dir:"VERTICAL",bg:"#1E293B",main:"CENTER",cross:"CENTER",radius:12,gap:8,pl:0,pr:0,pt:0,pb:0});
    vf.strokes=[{type:"SOLID",color:rgb("#334155")}]; vf.strokeWeight=1;
    f.appendChild(vf);
    vf.resize(1,Math.round((W-80)*.5625)); vf.primaryAxisSizingMode="FIXED"; fill(vf);
    const pb=alFrame({name:"Play Button",dir:"HORIZONTAL",bg:"#F97316",main:"CENTER",cross:"CENTER",pl:16,pr:16,pt:12,pb:12,radius:9999,gap:8});
    pb.appendChild(txt("▶",16,"Regular","#FFFFFF")); pb.appendChild(txt("Play demo",14,"SemiBold","#FFFFFF")); vf.appendChild(pb);
    const stats=alFrame({name:"Stats Row",dir:"HORIZONTAL",gap:0,pl:0,pr:0,pt:0,pb:0,main:"SPACE_BETWEEN",cross:"CENTER"}); f.appendChild(stats); fill(stats);
    [["3 min","Watch time"],["10k+","Users"],["4.9★","Rating"],["Free","To start"]].forEach(([v,l])=>{
      const s=alFrame({name:"Stat — "+l,dir:"VERTICAL",gap:4,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"});
      s.appendChild(txt(v,20,"Bold","#F1F5F9",{align:"CENTER"})); s.appendChild(txt(l,12,"Regular","#64748B",{align:"CENTER"}));
      stats.appendChild(s);
    });
    return f;
  },
  // ── TAB HORIZONTAL ───────────────────────────────────────────────────────
  "tab-h-1": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Tab — Underline",dir:"VERTICAL",bg:"#FFFFFF",w:W,gap:0,pl:0,pr:0,pt:0,pb:0});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const bar=alFrame({name:"Tab Bar",dir:"HORIZONTAL",bg:"#FFFFFF",gap:0,pl:40,pr:40,pt:16,pb:16,cross:"MAX"});
    bar.counterAxisSizingMode="AUTO";
    bar.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; bar.strokeWeight=1; bar.strokeAlign="OUTSIDE";
    if(mobile){
      const dd=alFrame({name:"Tab Dropdown",dir:"HORIZONTAL",bg:"#FFFFFF",pl:12,pr:12,pt:10,pb:10,gap:8,radius:8,main:"SPACE_BETWEEN",cross:"CENTER"});
      dd.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; dd.strokeWeight=1;
      dd.appendChild(txt("Overview",14,"SemiBold","#111827")); dd.appendChild(txt("▾",14,"Regular","#6B7280")); bar.appendChild(dd); fill(dd);
    } else {
      ["Overview","Analytics","Reports","Settings"].forEach((lbl,i)=>{
        const active=i===0;
        const tab=alFrame({name:"Tab: "+lbl,dir:"VERTICAL",bg:"#FFFFFF",gap:0,pl:20,pr:20,pt:14,pb:0,cross:"CENTER",main:"MIN"});
        tab.appendChild(txt(lbl,13,active?"SemiBold":"Regular",active?"#111827":"#9CA3AF"));
        const line=figma.createRectangle(); line.resize(40,2); line.fills=solid(active?"#6366F1":"#FFFFFF");
        tab.appendChild(line); bar.appendChild(tab); try{line.layoutSizingHorizontal="FILL";}catch(e){}
      });
    }
    f.appendChild(bar); fill(bar);
    const content=alFrame({name:"Content",dir:"VERTICAL",bg:"#FFFFFF",pl:40,pr:40,pt:40,pb:40,gap:16});
    content.appendChild(txt("Overview",20,"Bold","#111827"));
    content.appendChild(txt("Summary of your key metrics and activity.",14,"Regular","#6B7280"));
    const cards=alFrame({name:"Cards",dir:mobile?"VERTICAL":"HORIZONTAL",bg:"#FFFFFF",gap:16,pl:0,pr:0,pt:0,pb:0});
    [["1,240","Users"],["89%","Retention"],["$4.2k","Revenue"]].forEach(([v,l])=>{
      const c=alFrame({name:l,dir:"VERTICAL",bg:"#F9FAFB",pl:20,pr:20,pt:20,pb:20,gap:6,radius:8});
      c.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; c.strokeWeight=1;
      c.appendChild(txt(v,26,"Bold","#111827")); c.appendChild(txt(l,12,"Regular","#9CA3AF")); cards.appendChild(c); fill(c);
    });
    content.appendChild(cards); fill(cards); f.appendChild(content); fill(content); return f;
  },
  "tab-h-2": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Tab — Pill",dir:"VERTICAL",bg:"#F9FAFB",w:W,gap:0,pl:0,pr:0,pt:0,pb:0});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const bar=alFrame({name:"Tab Bar",dir:"HORIZONTAL",bg:"#F3F4F6",gap:4,pl:40,pr:40,pt:16,pb:16,cross:"CENTER"});
    bar.counterAxisSizingMode="AUTO";
    if(mobile){
      const dd=alFrame({name:"Tab Dropdown",dir:"HORIZONTAL",bg:"#FFFFFF",pl:12,pr:12,pt:10,pb:10,gap:8,radius:8,main:"SPACE_BETWEEN",cross:"CENTER"});
      dd.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; dd.strokeWeight=1;
      dd.appendChild(txt("Analytics",14,"SemiBold","#111827")); dd.appendChild(txt("▾",14,"Regular","#6B7280")); bar.appendChild(dd); fill(dd);
    } else {
      ["Overview","Analytics","Reports","Settings"].forEach((lbl,i)=>{
        const active=i===1;
        const tab=alFrame({name:"Tab: "+lbl,dir:"HORIZONTAL",bg:active?"#FFFFFF":"transparent",pl:16,pr:16,pt:8,pb:8,main:"CENTER",cross:"CENTER",radius:8});
        if(active){tab.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; tab.strokeWeight=1;}
        tab.appendChild(txt(lbl,13,active?"SemiBold":"Regular",active?"#111827":"#6B7280")); bar.appendChild(tab);
      });
    }
    f.appendChild(bar); fill(bar);
    const content=alFrame({name:"Content",dir:"VERTICAL",bg:"#F9FAFB",pl:40,pr:40,pt:40,pb:40,gap:16});
    content.appendChild(txt("Analytics",20,"Bold","#111827"));
    content.appendChild(txt("Track performance across all channels.",14,"Regular","#6B7280"));
    const row=alFrame({name:"Metrics",dir:mobile?"VERTICAL":"HORIZONTAL",bg:"#F9FAFB",gap:16,pl:0,pr:0,pt:0,pb:0});
    [["12.4k","Visitors"],["3.2%","Conv. Rate"],["$8.9k","Revenue"]].forEach(([v,l])=>{
      const c=alFrame({name:l,dir:"VERTICAL",bg:"#FFFFFF",pl:20,pr:20,pt:20,pb:20,gap:6,radius:8});
      c.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; c.strokeWeight=1;
      c.appendChild(txt(v,26,"Bold","#111827")); c.appendChild(txt(l,12,"Regular","#9CA3AF")); row.appendChild(c); fill(c);
    });
    content.appendChild(row); fill(row); f.appendChild(content); fill(content); return f;
  },
  "tab-h-3": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Tab — Card",dir:"VERTICAL",bg:"#FFFFFF",w:W,gap:0,pl:0,pr:0,pt:0,pb:0});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const bar=alFrame({name:"Tab Bar",dir:"HORIZONTAL",bg:"#F9FAFB",gap:0,pl:40,pr:40,pt:16,pb:16,cross:"MAX"});
    bar.counterAxisSizingMode="AUTO";
    bar.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; bar.strokeWeight=1; bar.strokeAlign="OUTSIDE";
    if(mobile){
      const dd=alFrame({name:"Tab Dropdown",dir:"HORIZONTAL",bg:"#FFFFFF",pl:12,pr:12,pt:10,pb:10,gap:8,radius:8,main:"SPACE_BETWEEN",cross:"CENTER"});
      dd.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; dd.strokeWeight=1;
      dd.appendChild(txt("Products",14,"SemiBold","#111827")); dd.appendChild(txt("▾",14,"Regular","#6B7280")); bar.appendChild(dd); fill(dd);
    } else {
      ["Products","Orders","Customers","Settings"].forEach((lbl,i)=>{
        const active=i===0;
        const tab=alFrame({name:"Tab: "+lbl,dir:"VERTICAL",bg:active?"#FFFFFF":"#F9FAFB",gap:0,pl:20,pr:20,pt:12,pb:0,cross:"CENTER",main:"MIN"});
        if(active){tab.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; tab.strokeWeight=1; tab.strokeAlign="OUTSIDE";}
        tab.appendChild(txt(lbl,13,active?"SemiBold":"Regular",active?"#111827":"#6B7280"));
        const bot=figma.createRectangle(); bot.resize(40,2); bot.fills=solid(active?"#FFFFFF":"#E5E7EB");
        tab.appendChild(bot); bar.appendChild(tab); try{bot.layoutSizingHorizontal="FILL";}catch(e){}
      });
    }
    f.appendChild(bar); fill(bar);
    const content=alFrame({name:"Content",dir:"VERTICAL",bg:"#FFFFFF",pl:40,pr:40,pt:40,pb:40,gap:16});
    content.appendChild(txt("Products",20,"Bold","#111827"));
    const tbl=alFrame({name:"Table",dir:"VERTICAL",bg:"#FFFFFF",gap:0,pl:0,pr:0,pt:0,pb:0,radius:8});
    tbl.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; tbl.strokeWeight=1;
    ["Headphones Pro — $89","Wireless Mouse — $34","USB-C Hub — $45"].forEach((item,i)=>{
      const row=alFrame({name:"Row",dir:"HORIZONTAL",bg:i%2===0?"#FFFFFF":"#F9FAFB",pl:16,pr:16,pt:14,pb:14,main:"SPACE_BETWEEN",cross:"CENTER"});
      row.appendChild(txt(item,14,"Regular","#374151")); row.appendChild(txt("In Stock",12,"Medium","#10B981")); tbl.appendChild(row); fill(row);
    });
    content.appendChild(tbl); fill(tbl); f.appendChild(content); fill(content); return f;
  },
  "tab-h-4": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Tab — Segmented",dir:"VERTICAL",bg:"#FFFFFF",w:W,gap:0,pl:0,pr:0,pt:0,pb:0});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const bar=alFrame({name:"Tab Bar",dir:"HORIZONTAL",bg:"#F3F4F6",gap:0,pl:40,pr:40,pt:16,pb:16,cross:"CENTER"});
    bar.counterAxisSizingMode="AUTO";
    bar.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; bar.strokeWeight=1; bar.strokeAlign="OUTSIDE";
    if(mobile){
      const dd=alFrame({name:"Tab Dropdown",dir:"HORIZONTAL",bg:"#FFFFFF",pl:12,pr:12,pt:10,pb:10,gap:8,radius:8,main:"SPACE_BETWEEN",cross:"CENTER"});
      dd.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; dd.strokeWeight=1;
      dd.appendChild(txt("Quarterly",14,"SemiBold","#111827")); dd.appendChild(txt("▾",14,"Regular","#6B7280")); bar.appendChild(dd); fill(dd);
    } else {
      ["Monthly","Quarterly","Annual","Custom"].forEach((lbl,i)=>{
        const active=i===1;
        const tab=alFrame({name:"Tab: "+lbl,dir:"HORIZONTAL",bg:active?"#6366F1":"transparent",pl:0,pr:0,pt:10,pb:10,main:"CENTER",cross:"CENTER",radius:6});
        tab.appendChild(txt(lbl,13,active?"SemiBold":"Regular",active?"#FFFFFF":"#6B7280")); bar.appendChild(tab); fill(tab);
      });
    }
    f.appendChild(bar); fill(bar);
    const content=alFrame({name:"Content",dir:"VERTICAL",bg:"#FFFFFF",pl:40,pr:40,pt:40,pb:40,gap:16});
    content.appendChild(txt("Quarterly Report",20,"Bold","#111827"));
    content.appendChild(txt("Q3 2024 performance summary across all regions.",14,"Regular","#6B7280"));
    const row=alFrame({name:"Cards",dir:mobile?"VERTICAL":"HORIZONTAL",bg:"#FFFFFF",gap:16,pl:0,pr:0,pt:0,pb:0});
    [["↑ 24%","Growth"],["$142k","Revenue"],["2,840","Orders"]].forEach(([v,l])=>{
      const c=alFrame({name:l,dir:"VERTICAL",bg:"#EEF2FF",pl:20,pr:20,pt:20,pb:20,gap:6,radius:8});
      c.appendChild(txt(v,26,"Bold","#6366F1")); c.appendChild(txt(l,12,"Regular","#818CF8")); row.appendChild(c); fill(c);
    });
    content.appendChild(row); fill(row); f.appendChild(content); fill(content); return f;
  },
  "tab-h-5": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Tab — Dark",dir:"VERTICAL",bg:"#0F172A",w:W,gap:0,pl:0,pr:0,pt:0,pb:0});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const bar=alFrame({name:"Tab Bar",dir:"HORIZONTAL",bg:"#0F172A",gap:0,pl:40,pr:40,pt:16,pb:16,cross:"MAX"});
    bar.counterAxisSizingMode="AUTO";
    bar.strokes=[{type:"SOLID",color:rgb("#1E293B")}]; bar.strokeWeight=1; bar.strokeAlign="OUTSIDE";
    if(mobile){
      const dd=alFrame({name:"Tab Dropdown",dir:"HORIZONTAL",bg:"#1E293B",pl:12,pr:12,pt:10,pb:10,gap:8,radius:8,main:"SPACE_BETWEEN",cross:"CENTER"});
      dd.strokes=[{type:"SOLID",color:rgb("#334155")}]; dd.strokeWeight=1;
      dd.appendChild(txt("Dashboard",14,"SemiBold","#F1F5F9")); dd.appendChild(txt("▾",14,"Regular","#64748B")); bar.appendChild(dd); fill(dd);
    } else {
      ["Dashboard","Activity","Settings","Billing"].forEach((lbl,i)=>{
        const active=i===0;
        const tab=alFrame({name:"Tab: "+lbl,dir:"VERTICAL",bg:"#0F172A",gap:0,pl:20,pr:20,pt:14,pb:0,cross:"CENTER",main:"MIN"});
        tab.appendChild(txt(lbl,13,active?"SemiBold":"Regular",active?"#FFFFFF":"#475569"));
        const line=figma.createRectangle(); line.resize(40,2); line.fills=solid(active?"#6366F1":"#0F172A");
        tab.appendChild(line); bar.appendChild(tab); try{line.layoutSizingHorizontal="FILL";}catch(e){}
      });
    }
    f.appendChild(bar); fill(bar);
    const content=alFrame({name:"Content",dir:"VERTICAL",bg:"#0F172A",pl:40,pr:40,pt:40,pb:40,gap:16});
    content.appendChild(txt("Dashboard",20,"Bold","#F1F5F9"));
    content.appendChild(txt("Real-time activity and system overview.",14,"Regular","#64748B"));
    const cards=alFrame({name:"Cards",dir:mobile?"VERTICAL":"HORIZONTAL",bg:"#0F172A",gap:16,pl:0,pr:0,pt:0,pb:0});
    [["99.9%","Uptime"],["2.1ms","Response"],["1.4k/s","Requests"]].forEach(([v,l])=>{
      const c=alFrame({name:l,dir:"VERTICAL",bg:"#1E293B",pl:20,pr:20,pt:20,pb:20,gap:6,radius:8});
      c.strokes=[{type:"SOLID",color:rgb("#334155")}]; c.strokeWeight=1;
      c.appendChild(txt(v,26,"Bold","#F1F5F9")); c.appendChild(txt(l,12,"Regular","#64748B")); cards.appendChild(c); fill(c);
    });
    content.appendChild(cards); fill(cards); f.appendChild(content); fill(content); return f;
  },
  "tab-h-6": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Tab — Branded",dir:"VERTICAL",bg:"#F5F3FF",w:W,gap:0,pl:0,pr:0,pt:0,pb:0});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const bar=alFrame({name:"Tab Bar",dir:"HORIZONTAL",bg:"#F5F3FF",gap:8,pl:40,pr:40,pt:16,pb:16,cross:"CENTER"});
    bar.counterAxisSizingMode="AUTO";
    if(mobile){
      const dd=alFrame({name:"Tab Dropdown",dir:"HORIZONTAL",bg:"#FFFFFF",pl:12,pr:12,pt:10,pb:10,gap:8,radius:8,main:"SPACE_BETWEEN",cross:"CENTER"});
      dd.strokes=[{type:"SOLID",color:rgb("#E9D5FF")}]; dd.strokeWeight=1;
      dd.appendChild(txt("All",14,"SemiBold","#7C3AED")); dd.appendChild(txt("▾",14,"Regular","#6D28D9")); bar.appendChild(dd); fill(dd);
    } else {
      ["All","Published","Drafts","Archived"].forEach((lbl,i)=>{
        const active=i===0;
        const tab=alFrame({name:"Tab: "+lbl,dir:"HORIZONTAL",bg:active?"#7C3AED":"transparent",pl:16,pr:16,pt:8,pb:8,main:"CENTER",cross:"CENTER",radius:9999});
        tab.appendChild(txt(lbl,13,active?"SemiBold":"Regular",active?"#FFFFFF":"#6D28D9")); bar.appendChild(tab);
      });
    }
    f.appendChild(bar);
    fill(bar);
    const content=alFrame({name:"Content",dir:"VERTICAL",bg:"#FFFFFF",pl:40,pr:40,pt:40,pb:40,gap:12}); fill(content);
    content.strokes=[{type:"SOLID",color:rgb("#E9D5FF")}]; content.strokeWeight=1; content.strokeAlign="OUTSIDE";
    content.appendChild(txt("All Content",20,"Bold","#111827"));
    ["Launch blog post","Product update draft","Q4 roadmap","Team announcement"].forEach((item,i)=>{
      const row=alFrame({name:"Item",dir:"HORIZONTAL",bg:"#FFFFFF",pl:0,pr:0,pt:12,pb:12,main:"SPACE_BETWEEN",cross:"CENTER"});
      row.appendChild(txt(item,14,"Regular","#374151"));
      const badge=alFrame({name:"Badge",dir:"HORIZONTAL",bg:i<2?"#D1FAE5":"#F3F4F6",pl:8,pr:8,pt:3,pb:3,radius:9999,main:"CENTER",cross:"CENTER"});
      badge.appendChild(txt(i<2?"Published":"Draft",10,"Medium",i<2?"#065F46":"#6B7280")); row.appendChild(badge); content.appendChild(row); fill(row);
      if(i<3){const div=figma.createRectangle(); div.resize(40,1); div.fills=solid("#F3F4F6"); content.appendChild(div); try{div.layoutSizingHorizontal="FILL";}catch(e){}}
    });
    f.appendChild(content); fill(content); return f;
  },

  // ── TAB VERTICAL ─────────────────────────────────────────────────────────
  "tab-v-1": W => {
    const sm=W<=768;
    const f=alFrame({name:"Tab — Vertical Light",dir:sm?"VERTICAL":"HORIZONTAL",bg:"#FFFFFF",w:W,gap:sm?0:24,pl:sm?0:40,pr:sm?0:40,pt:sm?0:40,pb:sm?0:40});
    if(sm){ f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED"; fillV(f); }
    if(sm){
      const bar=alFrame({name:"Tab Bar",dir:"HORIZONTAL",bg:"#FFFFFF",pl:40,pr:40,pt:16,pb:16,cross:"CENTER"});
      bar.counterAxisSizingMode="AUTO"; bar.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; bar.strokeWeight=1; bar.strokeAlign="OUTSIDE";
      const dd=alFrame({name:"Tab Dropdown",dir:"HORIZONTAL",bg:"#FFFFFF",pl:12,pr:12,pt:10,pb:10,gap:8,radius:8,main:"SPACE_BETWEEN",cross:"CENTER"});
      dd.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; dd.strokeWeight=1;
      dd.appendChild(txt("Overview",14,"SemiBold","#111827")); dd.appendChild(txt("▾",14,"Regular","#6B7280"));
      f.appendChild(bar); fill(bar); bar.appendChild(dd); fill(dd);
    } else {
      const tabs=alFrame({name:"Tabs",dir:"VERTICAL",bg:"#F9FAFB",gap:4,pl:8,pr:8,pt:8,pb:8,radius:8});
      tabs.primaryAxisSizingMode="AUTO"; tabs.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; tabs.strokeWeight=1;
      ["Overview","Analytics","Settings","Billing","Support"].forEach((lbl,i)=>{
        const active=i===0;
        const tab=alFrame({name:"Tab: "+lbl,dir:"HORIZONTAL",bg:active?"#FFFFFF":"transparent",pl:12,pr:12,pt:10,pb:10,gap:10,cross:"CENTER",radius:8});
        if(active){tab.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; tab.strokeWeight=1;}
        tab.appendChild(txt(lbl,13,active?"SemiBold":"Regular",active?"#111827":"#6B7280")); tabs.appendChild(tab); fill(tab);
      });
      f.appendChild(tabs); fill(tabs);
    }
    const content=alFrame({name:"Content",dir:"VERTICAL",bg:"#FFFFFF",pl:40,pr:40,pt:40,pb:40,gap:24,radius:8});
    content.appendChild(txt("Overview",20,"Bold","#111827"));
    content.appendChild(txt("Manage your account details and preferences.",14,"Regular","#6B7280"));
    ["Name","Email","Company","Role"].forEach(lbl=>{
      const field=alFrame({name:"Field: "+lbl,dir:"VERTICAL",bg:"#FFFFFF",pl:0,pr:0,pt:0,pb:0,gap:6}); fill(field);
      field.appendChild(txt(lbl,12,"SemiBold","#374151"));
      const input=alFrame({name:"Input",dir:"HORIZONTAL",bg:"#F9FAFB",pl:12,pr:12,pt:10,pb:10,radius:8,cross:"CENTER"});
      input.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; input.strokeWeight=1;
      input.appendChild(txt(lbl+" value",14,"Regular","#9CA3AF")); field.appendChild(input); fill(input); content.appendChild(field); fill(field);
    });
    f.appendChild(content); fill(content); return f;
  },
  "tab-v-2": W => {
    const sm=W<=768;
    const f=alFrame({name:"Tab — Vertical Accent",dir:sm?"VERTICAL":"HORIZONTAL",bg:"#F9FAFB",w:W,gap:sm?0:24,pl:sm?0:40,pr:sm?0:40,pt:sm?0:40,pb:sm?0:40});
    if(sm){ f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED"; fillV(f); }
    if(sm){
      const bar=alFrame({name:"Tab Bar",dir:"HORIZONTAL",bg:"#F9FAFB",pl:40,pr:40,pt:16,pb:16,cross:"CENTER"});
      bar.counterAxisSizingMode="AUTO"; bar.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; bar.strokeWeight=1; bar.strokeAlign="OUTSIDE";
      const dd=alFrame({name:"Tab Dropdown",dir:"HORIZONTAL",bg:"#FFFFFF",pl:12,pr:12,pt:10,pb:10,gap:8,radius:8,main:"SPACE_BETWEEN",cross:"CENTER"});
      dd.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; dd.strokeWeight=1;
      dd.appendChild(txt("Dashboard",14,"SemiBold","#111827")); dd.appendChild(txt("▾",14,"Regular","#6B7280"));
      f.appendChild(bar); fill(bar); bar.appendChild(dd); fill(dd);
    } else {
      const tabs=alFrame({name:"Tabs",dir:"VERTICAL",bg:"#F9FAFB",gap:2,pl:0,pr:0,pt:0,pb:0});
      tabs.primaryAxisSizingMode="AUTO";
      ["Dashboard","Users","Campaigns","Reports","Settings"].forEach((lbl,i)=>{
        const active=i===0;
        const tab=alFrame({name:"Tab: "+lbl,dir:"HORIZONTAL",bg:active?"#EEF2FF":"transparent",pl:12,pr:12,pt:12,pb:12,gap:12,cross:"CENTER",radius:8});
        if(active){const accent=figma.createRectangle(); accent.resize(3,36); accent.fills=solid("#6366F1"); accent.cornerRadius=99; tab.insertChild(0,accent);}
        tab.appendChild(txt(lbl,13,active?"SemiBold":"Regular",active?"#6366F1":"#6B7280")); tabs.appendChild(tab); fill(tab);
      });
      f.appendChild(tabs); fill(tabs);
    }
    const content=alFrame({name:"Content",dir:"VERTICAL",bg:"#FFFFFF",pl:40,pr:40,pt:40,pb:40,gap:24,radius:8});
    content.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; content.strokeWeight=1;
    content.appendChild(txt("Dashboard",20,"Bold","#111827"));
    content.appendChild(txt("Welcome back. Here's what's happening today.",14,"Regular","#6B7280"));
    const grid=alFrame({name:"Grid",dir:sm?"VERTICAL":"HORIZONTAL",bg:"#FFFFFF",gap:12,pl:0,pr:0,pt:0,pb:0}); fill(grid);
    [["2,840","Active users"],["94%","Uptime"],["$18.4k","MRR"]].forEach(([v,l])=>{
      const c=alFrame({name:l,dir:"VERTICAL",bg:"#F9FAFB",pl:16,pr:16,pt:16,pb:16,gap:4,radius:8}); fill(c);
      c.appendChild(txt(v,22,"Bold","#111827")); c.appendChild(txt(l,12,"Regular","#9CA3AF")); grid.appendChild(c); fill(c);
    });
    content.appendChild(grid); fill(grid); f.appendChild(content); fill(content); return f;
  },
  "tab-v-3": W => {
    const sm=W<=768;
    const f=alFrame({name:"Tab — Vertical Dark",dir:sm?"VERTICAL":"HORIZONTAL",bg:"#0F172A",w:W,gap:sm?0:24,pl:sm?0:40,pr:sm?0:40,pt:sm?0:40,pb:sm?0:40});
    if(sm){ f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED"; fillV(f); }
    if(sm){
      const bar=alFrame({name:"Tab Bar",dir:"HORIZONTAL",bg:"#0F172A",pl:40,pr:40,pt:16,pb:16,cross:"CENTER"});
      bar.counterAxisSizingMode="AUTO"; bar.strokes=[{type:"SOLID",color:rgb("#1E293B")}]; bar.strokeWeight=1; bar.strokeAlign="OUTSIDE";
      const dd=alFrame({name:"Tab Dropdown",dir:"HORIZONTAL",bg:"#1E293B",pl:12,pr:12,pt:10,pb:10,gap:8,radius:8,main:"SPACE_BETWEEN",cross:"CENTER"});
      dd.strokes=[{type:"SOLID",color:rgb("#334155")}]; dd.strokeWeight=1;
      dd.appendChild(txt("Deployments",14,"SemiBold","#F1F5F9")); dd.appendChild(txt("▾",14,"Regular","#64748B"));
      f.appendChild(bar); fill(bar); bar.appendChild(dd); fill(dd);
    } else {
      const tabs=alFrame({name:"Tabs",dir:"VERTICAL",bg:"#1E293B",gap:2,pl:8,pr:8,pt:8,pb:8,radius:8});
      tabs.primaryAxisSizingMode="AUTO";
      ["Overview","Deployments","Logs","Metrics","Settings"].forEach((lbl,i)=>{
        const active=i===1;
        const tab=alFrame({name:"Tab: "+lbl,dir:"HORIZONTAL",bg:active?"#334155":"transparent",pl:12,pr:12,pt:10,pb:10,gap:10,cross:"CENTER",radius:8});
        tab.appendChild(txt(lbl,13,active?"SemiBold":"Regular",active?"#F1F5F9":"#64748B")); tabs.appendChild(tab); fill(tab);
      });
      f.appendChild(tabs); fill(tabs);
    }
    const content=alFrame({name:"Content",dir:"VERTICAL",bg:"#1E293B",pl:40,pr:40,pt:40,pb:40,gap:24,radius:8});
    content.appendChild(txt("Deployments",20,"Bold","#F1F5F9"));
    content.appendChild(txt("Active deployments across all environments.",14,"Regular","#64748B"));
    ["prod-v2.4.1 · Live","staging-v2.5.0 · Building","dev-main · Ready"].forEach((item,i)=>{
      const row=alFrame({name:"Deploy",dir:"HORIZONTAL",bg:"#0F172A",pl:16,pr:16,pt:14,pb:14,main:"SPACE_BETWEEN",cross:"CENTER",radius:8}); fill(row);
      row.appendChild(txt(item,12,"Regular","#94A3B8"));
      const dot=alFrame({name:"Status",dir:"HORIZONTAL",bg:i===0?"#D1FAE5":i===1?"#FEF3C7":"#E0F2FE",pl:8,pr:8,pt:3,pb:3,radius:9999,main:"CENTER",cross:"CENTER"});
      dot.appendChild(txt(i===0?"Live":i===1?"Building":"Ready",10,"Medium",i===0?"#065F46":i===1?"#92400E":"#075985")); row.appendChild(dot); content.appendChild(row); fill(row);
    });
    f.appendChild(content); fill(content); return f;
  },
  "tab-v-4": W => {
    const sm=W<=768;
    const f=alFrame({name:"Tab — Vertical Pill",dir:sm?"VERTICAL":"HORIZONTAL",bg:"#FFFFFF",w:W,gap:sm?0:24,pl:sm?0:40,pr:sm?0:40,pt:sm?0:40,pb:sm?0:40});
    if(sm){ f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED"; fillV(f); }
    if(sm){
      const bar=alFrame({name:"Tab Bar",dir:"HORIZONTAL",bg:"#FFFFFF",pl:40,pr:40,pt:16,pb:16,cross:"CENTER"});
      bar.counterAxisSizingMode="AUTO"; bar.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; bar.strokeWeight=1; bar.strokeAlign="OUTSIDE";
      const dd=alFrame({name:"Tab Dropdown",dir:"HORIZONTAL",bg:"#FFFFFF",pl:12,pr:12,pt:10,pb:10,gap:8,radius:8,main:"SPACE_BETWEEN",cross:"CENTER"});
      dd.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; dd.strokeWeight=1;
      dd.appendChild(txt("Notifications",14,"SemiBold","#111827")); dd.appendChild(txt("▾",14,"Regular","#6B7280"));
      f.appendChild(bar); fill(bar); bar.appendChild(dd); fill(dd);
    } else {
      const tabs=alFrame({name:"Tabs",dir:"VERTICAL",bg:"#F3F4F6",gap:2,pl:6,pr:6,pt:6,pb:6,radius:8});
      tabs.primaryAxisSizingMode="AUTO";
      ["General","Security","Notifications","Integrations","Advanced"].forEach((lbl,i)=>{
        const active=i===2;
        const tab=alFrame({name:"Tab: "+lbl,dir:"HORIZONTAL",bg:active?"#FFFFFF":"transparent",pl:14,pr:14,pt:9,pb:9,cross:"CENTER",radius:9999});
        if(active){tab.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; tab.strokeWeight=1;}
        tab.appendChild(txt(lbl,13,active?"SemiBold":"Regular",active?"#111827":"#6B7280")); tabs.appendChild(tab); fill(tab);
      });
      f.appendChild(tabs); fill(tabs);
    }
    const content=alFrame({name:"Content",dir:"VERTICAL",bg:"#FFFFFF",pl:40,pr:40,pt:40,pb:40,gap:24,radius:8});
    content.appendChild(txt("Notifications",20,"Bold","#111827"));
    [["Email alerts","Get notified via email"],["Push notifications","In-app alerts"],["Weekly digest","Summary every Monday"],["Marketing emails","Updates and offers"]].forEach(([title,desc],i)=>{
      const row=alFrame({name:"Row",dir:"HORIZONTAL",bg:"#FFFFFF",pl:0,pr:0,pt:0,pb:0,main:"SPACE_BETWEEN",cross:"CENTER"}); fill(row);
      const info=alFrame({name:"Info",dir:"VERTICAL",bg:"#FFFFFF",pl:0,pr:0,pt:0,pb:0,gap:2}); hug(info);
      info.appendChild(txt(title,14,"SemiBold","#111827")); info.appendChild(txt(desc,12,"Regular","#9CA3AF")); row.appendChild(info);
      const tog=alFrame({name:"Toggle",dir:"HORIZONTAL",bg:i<2?"#6366F1":"#E5E7EB",pl:2,pr:2,pt:2,pb:2,radius:9999,cross:"CENTER",main:i<2?"MAX":"MIN"});
      tog.resize(36,20); tog.primaryAxisSizingMode="FIXED"; tog.counterAxisSizingMode="FIXED";
      const knob=alFrame({name:"Knob",dir:"HORIZONTAL",bg:"#FFFFFF",pl:0,pr:0,pt:0,pb:0,radius:9999}); knob.resize(16,16); knob.primaryAxisSizingMode="FIXED"; knob.counterAxisSizingMode="FIXED";
      tog.appendChild(knob); row.appendChild(tog); content.appendChild(row); fill(row);
      if(i<3){const div=figma.createRectangle(); div.resize(40,1); div.fills=solid("#F3F4F6"); content.appendChild(div); try{div.layoutSizingHorizontal="FILL";}catch(e){}}
    });
    f.appendChild(content); fill(content); return f;
  },
  "tab-v-5": W => {
    const sm=W<=768;
    const f=alFrame({name:"Tab — Vertical Compact",dir:sm?"VERTICAL":"HORIZONTAL",bg:"#FFFFFF",w:W,gap:sm?0:0,pl:sm?0:40,pr:sm?0:40,pt:sm?0:40,pb:sm?0:40});
    if(sm){ f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED"; fillV(f); }
    if(sm){
      const bar=alFrame({name:"Tab Bar",dir:"HORIZONTAL",bg:"#FFFFFF",pl:40,pr:40,pt:16,pb:16,cross:"CENTER"});
      bar.counterAxisSizingMode="AUTO"; bar.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; bar.strokeWeight=1; bar.strokeAlign="OUTSIDE";
      const dd=alFrame({name:"Tab Dropdown",dir:"HORIZONTAL",bg:"#FFFFFF",pl:12,pr:12,pt:10,pb:10,gap:8,radius:8,main:"SPACE_BETWEEN",cross:"CENTER"});
      dd.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; dd.strokeWeight=1;
      dd.appendChild(txt("Components",14,"SemiBold","#15803D")); dd.appendChild(txt("▾",14,"Regular","#6B7280"));
      f.appendChild(bar); fill(bar); bar.appendChild(dd); fill(dd);
    } else {
      const tabs=alFrame({name:"Tabs",dir:"VERTICAL",bg:"#FFFFFF",gap:0,pl:0,pr:0,pt:0,pb:0});
      tabs.primaryAxisSizingMode="AUTO"; tabs.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; tabs.strokeWeight=1;
      ["Getting Started","Components","Layouts","Patterns","Examples"].forEach((lbl,i)=>{
        const active=i===1;
        const tab=alFrame({name:"Tab: "+lbl,dir:"HORIZONTAL",bg:active?"#F0FDF4":"#FFFFFF",pl:16,pr:16,pt:12,pb:12,cross:"CENTER",gap:0});
        if(active){tab.strokes=[{type:"SOLID",color:rgb("#86EFAC")}]; tab.strokeWeight=2; tab.strokeAlign="OUTSIDE";}
        tab.appendChild(txt(lbl,13,active?"SemiBold":"Regular",active?"#15803D":"#6B7280")); tabs.appendChild(tab); fill(tab);
        if(i<4){const div=figma.createRectangle(); div.resize(1,1); div.fills=solid("#F3F4F6"); tabs.appendChild(div); try{div.layoutSizingHorizontal="FILL";}catch(e){}}
      });
      f.appendChild(tabs); fill(tabs);
    }
    const content=alFrame({name:"Content",dir:"VERTICAL",bg:"#FFFFFF",pl:40,pr:40,pt:40,pb:40,gap:24,radius:8});
    content.appendChild(txt("Components",24,"Bold","#111827"));
    content.appendChild(txt("A collection of ready-to-use UI components.",14,"Regular","#6B7280"));
    const grid=alFrame({name:"Grid",dir:sm?"VERTICAL":"HORIZONTAL",bg:"#FFFFFF",gap:16,pl:0,pr:0,pt:0,pb:0}); fill(grid);
    ["Button","Input","Card","Badge","Modal","Avatar"].forEach(comp=>{
      const c=alFrame({name:comp,dir:"HORIZONTAL",bg:"#F9FAFB",pl:12,pr:12,pt:8,pb:8,cross:"CENTER",radius:8,gap:8});
      c.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; c.strokeWeight=1;
      c.appendChild(txt(comp,12,"Medium","#374151")); grid.appendChild(c); fill(c);
    });
    content.appendChild(grid); fill(grid); f.appendChild(content); fill(content); return f;
  },
  "tab-v-6": W => {
    const sm=W<=768;
    const f=alFrame({name:"Tab — Vertical Dark Sidebar",dir:sm?"VERTICAL":"HORIZONTAL",bg:"#111827",w:W,gap:sm?0:24,pl:sm?0:40,pr:sm?0:40,pt:sm?0:40,pb:sm?0:40});
    if(sm){ f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED"; fillV(f); }
    if(sm){
      const bar=alFrame({name:"Tab Bar",dir:"HORIZONTAL",bg:"#111827",pl:40,pr:40,pt:16,pb:16,cross:"CENTER"});
      bar.counterAxisSizingMode="AUTO"; bar.strokes=[{type:"SOLID",color:rgb("#1F2937")}]; bar.strokeWeight=1; bar.strokeAlign="OUTSIDE";
      const dd=alFrame({name:"Tab Dropdown",dir:"HORIZONTAL",bg:"#1F2937",pl:12,pr:12,pt:10,pb:10,gap:8,radius:8,main:"SPACE_BETWEEN",cross:"CENTER"});
      dd.strokes=[{type:"SOLID",color:rgb("#374151")}]; dd.strokeWeight=1;
      dd.appendChild(txt("Profile",14,"SemiBold","#FFFFFF")); dd.appendChild(txt("▾",14,"Regular","#9CA3AF"));
      f.appendChild(bar); fill(bar); bar.appendChild(dd); fill(dd);
    } else {
      const tabs=alFrame({name:"Tabs",dir:"VERTICAL",bg:"#111827",gap:2,pl:0,pr:0,pt:0,pb:0});
      tabs.primaryAxisSizingMode="AUTO";
      const sections=[["Account",["Profile","Password","Sessions"]],["Workspace",["Members","Roles","Billing"]],["Developer",["API Keys","Webhooks"]]];
      sections.forEach(([heading,items])=>{
        const sec=alFrame({name:"Section: "+heading,dir:"VERTICAL",bg:"#111827",gap:1,pl:0,pr:0,pt:8,pb:0});
        sec.appendChild(txt(heading.toUpperCase(),9,"SemiBold","#4B5563"));
        items.forEach((lbl,i)=>{
          const active=(heading==="Account"&&i===0);
          const tab=alFrame({name:"Tab: "+lbl,dir:"HORIZONTAL",bg:active?"#1F2937":"transparent",pl:12,pr:12,pt:9,pb:9,cross:"CENTER",radius:8});
          tab.appendChild(txt(lbl,13,active?"SemiBold":"Regular",active?"#FFFFFF":"#6B7280")); sec.appendChild(tab); fill(tab);
        });
        tabs.appendChild(sec); fill(sec);
      });
      f.appendChild(tabs); fill(tabs);
    }
    const content=alFrame({name:"Content",dir:"VERTICAL",bg:"#1F2937",pl:40,pr:40,pt:40,pb:40,gap:24,radius:8});
    content.appendChild(txt("Profile",20,"Bold","#FFFFFF"));
    content.appendChild(txt("Manage your public profile information.",14,"Regular","#9CA3AF"));
    const avatar=alFrame({name:"Avatar Row",dir:"HORIZONTAL",bg:"#1F2937",gap:16,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"});
    const av=alFrame({name:"Avatar",dir:"HORIZONTAL",bg:"#6366F1",pl:0,pr:0,pt:0,pb:0,main:"CENTER",cross:"CENTER",radius:9999}); av.resize(56,56); av.primaryAxisSizingMode="FIXED"; av.counterAxisSizingMode="FIXED";
    av.appendChild(txt("JD",18,"Bold","#FFFFFF")); avatar.appendChild(av); avatar.appendChild(btnNode("Change photo","#374151","#FFFFFF",16,8,10)); content.appendChild(avatar);
    ["Full name","Username","Bio"].forEach(lbl=>{
      const field=alFrame({name:"Field: "+lbl,dir:"VERTICAL",bg:"#1F2937",pl:0,pr:0,pt:0,pb:0,gap:6}); fill(field);
      field.appendChild(txt(lbl,12,"SemiBold","#9CA3AF"));
      const input=alFrame({name:"Input",dir:"HORIZONTAL",bg:"#111827",pl:12,pr:12,pt:10,pb:10,radius:8,cross:"CENTER"});
      input.strokes=[{type:"SOLID",color:rgb("#374151")}]; input.strokeWeight=1;
      input.appendChild(txt("Enter "+lbl.toLowerCase(),14,"Regular","#4B5563")); field.appendChild(input); fill(input); content.appendChild(field); fill(field);
    });
    f.appendChild(content); fill(content); return f;
  },

  // ── VERTICAL NAV ─────────────────────────────────────────────────────────
  "vnav-1": W => {
    const f=alFrame({name:"Vertical Nav — Clean",dir:"VERTICAL",bg:"#FFFFFF",w:260,gap:0,pl:40,pr:40,pt:40,pb:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    f.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; f.strokeWeight=1;
    const logo=alFrame({name:"Logo",dir:"HORIZONTAL",bg:"#FFFFFF",gap:10,pl:0,pr:0,pt:0,pb:16,cross:"CENTER"});
    const badge=rect(28,28,"#6366F1",8); logo.appendChild(badge); logo.appendChild(txt("Brand",16,"Bold","#111827")); f.appendChild(logo); fill(logo);
    const div=figma.createRectangle(); div.resize(228,1); div.fills=solid("#F3F4F6"); try{div.layoutSizingHorizontal="FILL";}catch(e){} f.appendChild(div);
    const nav=alFrame({name:"Nav Items",dir:"VERTICAL",bg:"#FFFFFF",gap:2,pl:0,pr:0,pt:12,pb:12});
    [["🏠","Home",true],["📊","Analytics",false],["👥","Users",false],["📁","Projects",false],["⚙️","Settings",false]].forEach(([icon,lbl,active])=>{
      const item=alFrame({name:"Nav: "+lbl,dir:"HORIZONTAL",bg:active?"#EEF2FF":"#FFFFFF",pl:12,pr:12,pt:10,pb:10,gap:10,cross:"CENTER",radius:8});
      item.appendChild(txt(icon,14,"Regular","#6B7280")); item.appendChild(txt(lbl,13,active?"SemiBold":"Regular",active?"#6366F1":"#374151")); nav.appendChild(item); fill(item);
    });
    f.appendChild(nav); fill(nav); return f;
  },
  "vnav-2": W => {
    const f=alFrame({name:"Vertical Nav — Dark",dir:"VERTICAL",bg:"#111827",w:260,gap:0,pl:40,pr:40,pt:40,pb:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const logo=alFrame({name:"Logo",dir:"HORIZONTAL",bg:"#111827",gap:10,pl:0,pr:0,pt:0,pb:16,cross:"CENTER"});
    const badge=rect(28,28,"#6366F1",8); logo.appendChild(badge); logo.appendChild(txt("Brand",16,"Bold","#FFFFFF")); f.appendChild(logo); fill(logo);
    const div=figma.createRectangle(); div.resize(228,1); div.fills=solid("#1F2937"); try{div.layoutSizingHorizontal="FILL";}catch(e){} f.appendChild(div);
    const nav=alFrame({name:"Nav Items",dir:"VERTICAL",bg:"#111827",gap:2,pl:0,pr:0,pt:12,pb:12});
    [["🏠","Dashboard",true],["📊","Analytics",false],["👥","Team",false],["🔔","Notifications",false],["⚙️","Settings",false]].forEach(([icon,lbl,active])=>{
      const item=alFrame({name:"Nav: "+lbl,dir:"HORIZONTAL",bg:active?"#1F2937":"transparent",pl:12,pr:12,pt:10,pb:10,gap:10,cross:"CENTER",radius:8});
      item.appendChild(txt(icon,14,"Regular","#6B7280")); item.appendChild(txt(lbl,13,active?"SemiBold":"Regular",active?"#FFFFFF":"#9CA3AF")); nav.appendChild(item); fill(item);
    });
    const div2=figma.createRectangle(); div2.resize(228,1); div2.fills=solid("#1F2937"); f.appendChild(nav); fill(nav); f.appendChild(div2); try{div2.layoutSizingHorizontal="FILL";}catch(e){}
    const footer=alFrame({name:"User",dir:"HORIZONTAL",bg:"#1F2937",pl:12,pr:12,pt:10,pb:10,gap:10,cross:"CENTER",radius:8});
    const av=alFrame({name:"Avatar",dir:"HORIZONTAL",bg:"#6366F1",pl:0,pr:0,pt:0,pb:0,main:"CENTER",cross:"CENTER",radius:9999}); av.resize(28,28); av.primaryAxisSizingMode="FIXED"; av.counterAxisSizingMode="FIXED";
    av.appendChild(txt("JD",10,"Bold","#FFFFFF")); footer.appendChild(av); footer.appendChild(txt("Jane Doe",12,"SemiBold","#FFFFFF")); f.appendChild(footer); fill(footer);
    return f;
  },
  "vnav-3": W => {
    const f=alFrame({name:"Vertical Nav — Grouped",dir:"VERTICAL",bg:"#F9FAFB",w:260,gap:0,pl:40,pr:40,pt:40,pb:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    f.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; f.strokeWeight=1;
    const logo=alFrame({name:"Logo",dir:"HORIZONTAL",bg:"#F9FAFB",gap:8,pl:0,pr:0,pt:0,pb:16,cross:"CENTER"});
    logo.appendChild(txt("◈",18,"Regular","#6366F1")); logo.appendChild(txt("AppName",14,"Bold","#111827")); f.appendChild(logo); fill(logo);
    [["MAIN",["🏠 Home","📊 Dashboard","📁 Projects"]],["MANAGE",["👥 Team","🔑 Access","💳 Billing"]],["MORE",["❓ Help","⚙️ Settings"]]].forEach(([heading,items])=>{
      const sec=alFrame({name:"Section: "+heading,dir:"VERTICAL",bg:"#F9FAFB",gap:1,pl:0,pr:0,pt:4,pb:0});
      sec.appendChild(txt(heading,9,"SemiBold","#9CA3AF"));
      items.forEach((lbl,i)=>{
        const active=(heading==="MAIN"&&i===0);
        const item=alFrame({name:"Nav: "+lbl,dir:"HORIZONTAL",bg:active?"#FFFFFF":"transparent",pl:12,pr:12,pt:9,pb:9,cross:"CENTER",radius:8});
        if(active){item.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; item.strokeWeight=1;}
        item.appendChild(txt(lbl,12,active?"SemiBold":"Regular",active?"#111827":"#6B7280")); sec.appendChild(item); fill(item);
      });
      f.appendChild(sec); fill(sec);
    });
    return f;
  },
  "vnav-4": W => {
    const f=alFrame({name:"Vertical Nav — With Search",dir:"VERTICAL",bg:"#FFFFFF",w:260,gap:0,pl:40,pr:40,pt:40,pb:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    f.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; f.strokeWeight=1;
    const logo=alFrame({name:"Logo",dir:"HORIZONTAL",bg:"#FFFFFF",gap:10,pl:0,pr:0,pt:0,pb:12,cross:"CENTER"});
    logo.appendChild(txt("◈",18,"Regular","#111827")); logo.appendChild(txt("Workspace",14,"Bold","#111827")); f.appendChild(logo); fill(logo);
    // Search
    const search=alFrame({name:"Search",dir:"HORIZONTAL",bg:"#F3F4F6",pl:10,pr:10,pt:8,pb:8,gap:8,cross:"CENTER",radius:8});
    search.appendChild(txt("🔍",12,"Regular","#9CA3AF")); search.appendChild(txt("Search...",12,"Regular","#9CA3AF")); f.appendChild(search); fill(search);
    const nav=alFrame({name:"Nav",dir:"VERTICAL",bg:"#FFFFFF",gap:2,pl:0,pr:0,pt:8,pb:8});
    [["Inbox","3"],["Today",null],["Projects",null],["Archive",null]].forEach(([lbl,badge],i)=>{
      const active=i===0;
      const item=alFrame({name:"Nav: "+lbl,dir:"HORIZONTAL",bg:active?"#EEF2FF":"#FFFFFF",pl:12,pr:12,pt:10,pb:10,gap:10,cross:"CENTER",radius:8,main:"SPACE_BETWEEN"});
      item.appendChild(txt(lbl,13,active?"SemiBold":"Regular",active?"#6366F1":"#374151"));
      if(badge){const b=alFrame({name:"Badge",dir:"HORIZONTAL",bg:"#6366F1",pl:7,pr:7,pt:2,pb:2,radius:9999,main:"CENTER",cross:"CENTER"}); b.appendChild(txt(badge,10,"Bold","#FFFFFF")); item.appendChild(b);}
      nav.appendChild(item); fill(item);
    });
    f.appendChild(nav); fill(nav); return f;
  },
  "vnav-5": W => {
    const f=alFrame({name:"Vertical Nav — Icon Only",dir:"VERTICAL",bg:"#18181B",w:72,gap:0,pl:40,pr:40,pt:40,pb:40,cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const logo=alFrame({name:"Logo",dir:"HORIZONTAL",bg:"#6366F1",pl:0,pr:0,pt:0,pb:0,main:"CENTER",cross:"CENTER",radius:8}); logo.resize(40,40); logo.primaryAxisSizingMode="FIXED"; logo.counterAxisSizingMode="FIXED";
    logo.appendChild(txt("◈",18,"Regular","#FFFFFF")); f.appendChild(logo);
    const div=figma.createRectangle(); div.resize(40,1); div.fills=solid("#27272A"); try{div.layoutSizingHorizontal="FILL";}catch(e){} f.appendChild(div);
    const nav=alFrame({name:"Nav",dir:"VERTICAL",bg:"#18181B",gap:4,pl:0,pr:0,pt:8,pb:8});
    [["🏠",true],["📊",false],["👥",false],["📁",false],["🔔",false]].forEach(([icon,active])=>{
      const item=alFrame({name:"Nav Icon",dir:"HORIZONTAL",bg:active?"#3F3F46":"transparent",pl:0,pr:0,pt:10,pb:10,main:"CENTER",cross:"CENTER",radius:8});
      item.appendChild(txt(icon,16,"Regular","#FFFFFF")); nav.appendChild(item);
      item.resize(40, item.height||40); item.primaryAxisSizingMode="FIXED";
    });
    f.appendChild(nav); fill(nav);
    const div2=figma.createRectangle(); div2.resize(40,1); div2.fills=solid("#27272A"); f.appendChild(div2); try{div2.layoutSizingHorizontal="FILL";}catch(e){}
    const av=alFrame({name:"Avatar",dir:"HORIZONTAL",bg:"#6366F1",pl:0,pr:0,pt:0,pb:0,main:"CENTER",cross:"CENTER",radius:9999}); av.resize(40,40); av.primaryAxisSizingMode="FIXED"; av.counterAxisSizingMode="FIXED";
    av.appendChild(txt("JD",12,"Bold","#FFFFFF")); f.appendChild(av);
    return f;
  },
  "vnav-6": W => {
    const f=alFrame({name:"Vertical Nav — Minimal",dir:"VERTICAL",bg:"#FFFFFF",w:240,gap:0,pl:40,pr:40,pt:40,pb:40});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    f.strokes=[{type:"SOLID",color:rgb("#F3F4F6")}]; f.strokeWeight=1;
    const header=alFrame({name:"Header",dir:"HORIZONTAL",bg:"#FFFFFF",pl:20,pr:20,pt:20,pb:16,gap:10,cross:"CENTER",main:"SPACE_BETWEEN"});
    header.appendChild(txt("Navigation",14,"SemiBold","#111827"));
    header.appendChild(txt("✕",12,"Regular","#9CA3AF")); f.appendChild(header); fill(header);
    const div=figma.createRectangle(); div.resize(240,1); div.fills=solid("#F3F4F6"); try{div.layoutSizingHorizontal="FILL";}catch(e){} f.appendChild(div);
    const nav=alFrame({name:"Nav",dir:"VERTICAL",bg:"#FFFFFF",gap:0,pl:0,pr:0,pt:8,pb:8});
    [["Home",true],["Products",false],["Pricing",false],["About",false],["Blog",false],["Contact",false]].forEach(([lbl,active])=>{
      const item=alFrame({name:"Nav: "+lbl,dir:"HORIZONTAL",bg:"#FFFFFF",pl:20,pr:20,pt:12,pb:12,main:"SPACE_BETWEEN",cross:"CENTER"});
      item.appendChild(txt(lbl,13,active?"SemiBold":"Regular",active?"#6366F1":"#374151"));
      if(active) item.appendChild(txt("→",14,"Regular","#6366F1"));
      nav.appendChild(item); fill(item);
      const div=figma.createRectangle(); div.resize(240,1); div.fills=solid("#F9FAFB"); nav.appendChild(div); fill(div);
    });
    f.appendChild(nav); fill(nav); return f;
  },

  "video-6": W => {
    const f=alFrame({name:"Video Hero — Dark Stage",dir:"VERTICAL",bg:"#09090B",w:W,pt:40,pb:40,pl:40,pr:40,gap:40,cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const mobile=W<=480;
    const ey=txt("✦  Featured  ✦",12,"Regular","#52525B",{align:"CENTER"}); f.appendChild(ey); fill(ey);
    const h=txt("The Art of Building\nGreat Products",54,"Bold","#FFFFFF",{lineHeight:62}); f.appendChild(h); if(mobile){fill(h); h.textAlignHorizontal="CENTER";}
    const vf=alFrame({name:"Video Frame",dir:"VERTICAL",bg:"#18181B",main:"CENTER",cross:"CENTER",radius:16,gap:12,pl:0,pr:0,pt:0,pb:0});
    vf.strokes=[{type:"SOLID",color:rgb("#27272A")}]; vf.strokeWeight=1;
    f.appendChild(vf);
    vf.resize(1,Math.round((W-80)*.5625)); vf.primaryAxisSizingMode="FIXED"; fill(vf);
    const pb=alFrame({name:"Play Button",dir:"HORIZONTAL",bg:"#FFFFFF",main:"CENTER",cross:"CENTER",pl:20,pr:20,pt:20,pb:20,radius:9999,gap:0});
    pb.appendChild(txt("▶",22,"Regular","#09090B")); vf.appendChild(pb);
    vf.appendChild(txt("2:47 · HD quality",12,"Regular","#52525B"));
    return f;
  },

  // ── SIGN IN ──────────────────────────────────────────────────────────────
  "signin-1": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Sign In — Light Card",dir:"VERTICAL",bg:"#F9FAFB",w:W,pt:40,pb:40,pl:40,pr:40,gap:0,main:"CENTER",cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const cardW=mobile?W-80:Math.min(460,W-80);
    const card=alFrame({name:"Card",dir:"VERTICAL",bg:"#FFFFFF",gap:24,pl:40,pr:40,pt:40,pb:40,radius:16,cross:"CENTER"});
    card.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; card.strokeWeight=1;
    card.resize(cardW,1); card.primaryAxisSizingMode="AUTO"; card.counterAxisSizingMode="FIXED"; f.appendChild(card);
    const logo=alFrame({name:"Logo",dir:"HORIZONTAL",bg:"#111827",pl:0,pr:0,pt:0,pb:0,main:"CENTER",cross:"CENTER",radius:10});
    logo.resize(40,40); logo.primaryAxisSizingMode="FIXED"; logo.counterAxisSizingMode="FIXED"; card.appendChild(logo);
    const hGrp=alFrame({name:"Heading",dir:"VERTICAL",gap:8,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); hGrp.primaryAxisSizingMode="AUTO"; fill(hGrp); card.appendChild(hGrp);
    hGrp.appendChild(txt("Welcome back",26,"Bold","#111827",{align:"CENTER"}));
    const hs=txt("Sign in to your account to continue.",14,"Regular","#6B7280",{align:"CENTER",lineHeight:22}); fill(hs); hGrp.appendChild(hs);
    const form=alFrame({name:"Form",dir:"VERTICAL",gap:12,pl:0,pr:0,pt:0,pb:0}); card.appendChild(form); fill(form);
    ["Email address","Password"].forEach(ph=>{
      const inp=alFrame({name:ph,dir:"HORIZONTAL",bg:"#F9FAFB",pl:14,pr:14,pt:12,pb:12,cross:"CENTER",radius:8});
      inp.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; inp.strokeWeight=1;
      const p=txt(ph,14,"Regular","#9CA3AF"); inp.appendChild(p); fill(p); form.appendChild(inp); fill(inp);
    });
    const forgot=txt("Forgot password?",13,"Medium","#F97316"); forgot.textAlignHorizontal="RIGHT"; card.appendChild(forgot); fill(forgot);
    const btn=btnNode("Sign in","#111827","#FFFFFF",16,13,8); card.appendChild(btn); fill(btn);
    const foot=txt("Don't have an account?  Sign up \u2192",13,"Regular","#6B7280",{align:"CENTER"}); card.appendChild(foot); fill(foot);
    return f;
  },

  "signin-2": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Sign In — Dark Panel",dir:"VERTICAL",bg:"#0F172A",w:W,pt:40,pb:40,pl:40,pr:40,gap:0,main:"CENTER",cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const cardW=mobile?W-80:Math.min(460,W-80);
    const card=alFrame({name:"Card",dir:"VERTICAL",bg:"#1E293B",gap:24,pl:40,pr:40,pt:40,pb:40,radius:16,cross:"CENTER"});
    card.strokes=[{type:"SOLID",color:rgb("#334155")}]; card.strokeWeight=1;
    card.resize(cardW,1); card.primaryAxisSizingMode="AUTO"; card.counterAxisSizingMode="FIXED"; f.appendChild(card);
    const logo=alFrame({name:"Logo",dir:"HORIZONTAL",bg:"#6366F1",pl:0,pr:0,pt:0,pb:0,main:"CENTER",cross:"CENTER",radius:10});
    logo.resize(40,40); logo.primaryAxisSizingMode="FIXED"; logo.counterAxisSizingMode="FIXED"; card.appendChild(logo);
    const hGrp=alFrame({name:"Heading",dir:"VERTICAL",gap:8,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); hGrp.primaryAxisSizingMode="AUTO"; fill(hGrp); card.appendChild(hGrp);
    hGrp.appendChild(txt("Welcome back",26,"Bold","#F1F5F9",{align:"CENTER"}));
    const hs=txt("Sign in to continue to your workspace.",14,"Regular","#94A3B8",{align:"CENTER",lineHeight:22}); fill(hs); hGrp.appendChild(hs);
    const form=alFrame({name:"Form",dir:"VERTICAL",gap:12,pl:0,pr:0,pt:0,pb:0}); card.appendChild(form); fill(form);
    ["Email address","Password"].forEach(ph=>{
      const inp=alFrame({name:ph,dir:"HORIZONTAL",bg:"#0F172A",pl:14,pr:14,pt:12,pb:12,cross:"CENTER",radius:8});
      inp.strokes=[{type:"SOLID",color:rgb("#334155")}]; inp.strokeWeight=1;
      const p=txt(ph,14,"Regular","#475569"); inp.appendChild(p); fill(p); form.appendChild(inp); fill(inp);
    });
    const forgot=txt("Forgot password?",13,"Medium","#6366F1"); forgot.textAlignHorizontal="RIGHT"; card.appendChild(forgot); fill(forgot);
    const btn=btnNode("Sign in","#6366F1","#FFFFFF",16,13,8); card.appendChild(btn); fill(btn);
    const foot=txt("Don't have an account?  Sign up \u2192",13,"Regular","#475569",{align:"CENTER"}); card.appendChild(foot); fill(foot);
    return f;
  },

  "signin-3": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Sign In — Split Brand",dir:mobile?"VERTICAL":"HORIZONTAL",bg:"#FFFFFF",w:W,pt:0,pb:0,pl:0,pr:0,gap:0});
    if(mobile){f.primaryAxisSizingMode="AUTO";f.counterAxisSizingMode="FIXED";}else{f.counterAxisSizingMode="AUTO";}
    const brand=alFrame({name:"Brand Panel",dir:"VERTICAL",bg:"#F97316",pt:60,pb:60,pl:60,pr:60,gap:16,main:"CENTER",cross:"CENTER"});
    brand.primaryAxisSizingMode="AUTO"; f.appendChild(brand); fill(brand); if(!mobile) fillV(brand);
    const lbx=alFrame({name:"Logo",dir:"HORIZONTAL",pl:0,pr:0,pt:0,pb:0,main:"CENTER",cross:"CENTER",radius:10});
    lbx.fills=solid("#FFFFFF",0.25); lbx.resize(48,48); lbx.primaryAxisSizingMode="FIXED"; lbx.counterAxisSizingMode="FIXED"; brand.appendChild(lbx);
    const bh=txt("Brand Name",22,"Bold","#FFFFFF",{align:"CENTER"}); fill(bh); brand.appendChild(bh);
    const bs=txt("Your all-in-one workspace for modern teams.",14,"Regular","#FEDDB3",{align:"CENTER",lineHeight:22}); fill(bs); brand.appendChild(bs);
    const formSide=alFrame({name:"Form Side",dir:"VERTICAL",bg:"#FFFFFF",pt:40,pb:40,pl:40,pr:40,gap:24,main:"CENTER",cross:"CENTER"});
    formSide.primaryAxisSizingMode="AUTO"; f.appendChild(formSide); if(W<=768) fill(formSide); if(!mobile) fillV(formSide);
    const inner=alFrame({name:"Inner",dir:"VERTICAL",bg:"#FFFFFF",pt:0,pb:0,pl:0,pr:0,gap:24,cross:"CENTER"});
    inner.resize(mobile?W-80:Math.min(360,400),1); inner.primaryAxisSizingMode="AUTO"; inner.counterAxisSizingMode="FIXED"; formSide.appendChild(inner); if(W>480&&W<=768) fill(inner);
    const hGrp=alFrame({name:"Heading",dir:"VERTICAL",gap:8,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); hGrp.primaryAxisSizingMode="AUTO"; inner.appendChild(hGrp); fill(hGrp);
    hGrp.appendChild(txt("Sign in",26,"Bold","#111827",{align:"CENTER"}));
    const hs=txt("Enter your credentials below.",14,"Regular","#6B7280",{align:"CENTER",lineHeight:22}); hGrp.appendChild(hs); fill(hs);
    const form=alFrame({name:"Form",dir:"VERTICAL",gap:12,pl:0,pr:0,pt:0,pb:0}); inner.appendChild(form); fill(form);
    ["Email address","Password"].forEach(ph=>{
      const inp=alFrame({name:ph,dir:"HORIZONTAL",bg:"#F9FAFB",pl:14,pr:14,pt:12,pb:12,cross:"CENTER",radius:8});
      inp.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; inp.strokeWeight=1;
      const p=txt(ph,14,"Regular","#9CA3AF"); inp.appendChild(p); fill(p); form.appendChild(inp); fill(inp);
    });
    const forgot=txt("Forgot password?",13,"Medium","#F97316"); forgot.textAlignHorizontal="RIGHT"; inner.appendChild(forgot); fill(forgot);
    const btn=btnNode("Sign in","#F97316","#FFFFFF",16,13,8); inner.appendChild(btn); fill(btn);
    const foot=txt("Don't have an account?  Sign up \u2192",13,"Regular","#6B7280",{align:"CENTER"}); inner.appendChild(foot); fill(foot);
    return f;
  },

  "signin-4": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Sign In — Minimal",dir:"VERTICAL",bg:"#FFFFFF",w:W,pt:40,pb:40,pl:40,pr:40,gap:0,main:"CENTER",cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const inner=alFrame({name:"Inner",dir:"VERTICAL",bg:"#FFFFFF",pt:0,pb:0,pl:0,pr:0,gap:20});
    inner.resize(mobile?W-80:Math.min(400,W-80),1); inner.primaryAxisSizingMode="AUTO"; inner.counterAxisSizingMode="FIXED"; f.appendChild(inner);
    const hGrp=alFrame({name:"Heading",dir:"VERTICAL",gap:8,pl:0,pr:0,pt:0,pb:0}); hGrp.primaryAxisSizingMode="AUTO"; fill(hGrp); inner.appendChild(hGrp);
    hGrp.appendChild(txt("Sign in",30,"Bold","#111827"));
    const hs=txt("Good to see you again.",15,"Regular","#6B7280",{lineHeight:22}); fill(hs); hGrp.appendChild(hs);
    const form=alFrame({name:"Form",dir:"VERTICAL",gap:16,pl:0,pr:0,pt:0,pb:0}); inner.appendChild(form); fill(form);
    [["Email","Email address"],["Password","Password"]].forEach(([lbl,ph])=>{
      const field=alFrame({name:lbl,dir:"VERTICAL",gap:6,pl:0,pr:0,pt:0,pb:0}); form.appendChild(field); fill(field);
      field.appendChild(txt(lbl,13,"Medium","#374151"));
      const inp=alFrame({name:"Input",dir:"HORIZONTAL",bg:"#F9FAFB",pl:14,pr:14,pt:11,pb:11,cross:"CENTER",radius:8});
      inp.strokes=[{type:"SOLID",color:rgb("#D1D5DB")}]; inp.strokeWeight=1;
      const p=txt(ph,14,"Regular","#9CA3AF"); inp.appendChild(p); fill(p); field.appendChild(inp); fill(inp);
    });
    const divL=alFrame({name:"Divider",dir:"HORIZONTAL",bg:"#E5E7EB",pt:0,pb:0,pl:0,pr:0}); fill(divL); divL.resize(1,1); inner.appendChild(divL);
    const btn=btnNode("Sign in","#111827","#FFFFFF",16,13,8); fill(btn); inner.appendChild(btn);
    const foot=txt("New here?  Create an account \u2192",13,"Regular","#6B7280"); fill(foot); inner.appendChild(foot);
    return f;
  },

  "signin-5": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Sign In — Violet Accent",dir:"VERTICAL",bg:"#F5F3FF",w:W,pt:40,pb:40,pl:40,pr:40,gap:0,main:"CENTER",cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const cardW=mobile?W-80:Math.min(460,W-80);
    const card=alFrame({name:"Card",dir:"VERTICAL",bg:"#FFFFFF",gap:0,pl:0,pr:0,pt:0,pb:0,radius:16,cross:"CENTER"});
    card.strokes=[{type:"SOLID",color:rgb("#EDE9FE")}]; card.strokeWeight=1;
    card.resize(cardW,1); card.primaryAxisSizingMode="AUTO"; card.counterAxisSizingMode="FIXED"; f.appendChild(card);
    const strip=alFrame({name:"Header Strip",dir:"VERTICAL",bg:"#7C3AED",pt:24,pb:24,pl:40,pr:40,gap:8,cross:"CENTER"});
    strip.primaryAxisSizingMode="AUTO"; card.appendChild(strip); fill(strip);
    strip.appendChild(txt("Sign in to your account",18,"Bold","#FFFFFF",{align:"CENTER"}));
    const ss=txt("Enter your credentials to continue.",13,"Regular","#C4B5FD",{align:"CENTER",lineHeight:20}); fill(ss); strip.appendChild(ss);
    const body=alFrame({name:"Body",dir:"VERTICAL",bg:"#FFFFFF",pt:32,pb:32,pl:40,pr:40,gap:16,cross:"CENTER"});
    body.primaryAxisSizingMode="AUTO"; card.appendChild(body); fill(body);
    const form=alFrame({name:"Form",dir:"VERTICAL",gap:12,pl:0,pr:0,pt:0,pb:0}); body.appendChild(form); fill(form);
    ["Email address","Password"].forEach(ph=>{
      const inp=alFrame({name:ph,dir:"HORIZONTAL",bg:"#FAF5FF",pl:14,pr:14,pt:12,pb:12,cross:"CENTER",radius:8});
      inp.strokes=[{type:"SOLID",color:rgb("#EDE9FE")}]; inp.strokeWeight=1;
      const p=txt(ph,14,"Regular","#9CA3AF"); inp.appendChild(p); fill(p); form.appendChild(inp); fill(inp);
    });
    const forgot=txt("Forgot password?",13,"Medium","#7C3AED"); forgot.textAlignHorizontal="RIGHT"; body.appendChild(forgot); fill(forgot);
    const btn=btnNode("Sign in","#7C3AED","#FFFFFF",16,13,8); body.appendChild(btn); fill(btn);
    const foot=txt("Don't have an account?  Sign up \u2192",13,"Regular","#6B7280",{align:"CENTER"}); body.appendChild(foot); fill(foot);
    return f;
  },

  "signin-6": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Sign In — Image Split",dir:mobile?"VERTICAL":"HORIZONTAL",bg:"#FFFFFF",w:W,pt:0,pb:0,pl:0,pr:0,gap:0});
    if(mobile){f.primaryAxisSizingMode="AUTO";f.counterAxisSizingMode="FIXED";}else{f.counterAxisSizingMode="AUTO";}
    const imgPanel=imgBlock("Image Panel","#E2E8F0");
    f.appendChild(imgPanel);
    if(mobile){ imgPanel.resize(W,220); fill(imgPanel); }
    else{ fill(imgPanel); fillV(imgPanel); }
    const formSide=alFrame({name:"Form Side",dir:"VERTICAL",bg:"#FFFFFF",pt:40,pb:40,pl:40,pr:40,gap:24,main:"CENTER",cross:"CENTER"});
    formSide.primaryAxisSizingMode="AUTO"; f.appendChild(formSide); if(W<=768) fill(formSide); if(!mobile) fillV(formSide);
    const inner=alFrame({name:"Inner",dir:"VERTICAL",bg:"#FFFFFF",pt:0,pb:0,pl:0,pr:0,gap:24,cross:"CENTER"});
    inner.resize(mobile?W-80:360,1); inner.primaryAxisSizingMode="AUTO"; inner.counterAxisSizingMode="FIXED"; formSide.appendChild(inner); if(W>480&&W<=768) fill(inner);
    const hGrp=alFrame({name:"Heading",dir:"VERTICAL",gap:8,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); hGrp.primaryAxisSizingMode="AUTO"; inner.appendChild(hGrp); fill(hGrp);
    hGrp.appendChild(txt("Welcome back",26,"Bold","#111827",{align:"CENTER"}));
    const hs=txt("Sign in to continue.",14,"Regular","#6B7280",{align:"CENTER",lineHeight:22}); hGrp.appendChild(hs); fill(hs);
    const form=alFrame({name:"Form",dir:"VERTICAL",gap:12,pl:0,pr:0,pt:0,pb:0}); inner.appendChild(form); fill(form);
    ["Email address","Password"].forEach(ph=>{
      const inp=alFrame({name:ph,dir:"HORIZONTAL",bg:"#F9FAFB",pl:14,pr:14,pt:12,pb:12,cross:"CENTER",radius:8});
      inp.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; inp.strokeWeight=1;
      const p=txt(ph,14,"Regular","#9CA3AF"); inp.appendChild(p); fill(p); form.appendChild(inp); fill(inp);
    });
    const forgot=txt("Forgot password?",13,"Medium","#F97316"); forgot.textAlignHorizontal="RIGHT"; inner.appendChild(forgot); fill(forgot);
    const btn=btnNode("Sign in","#111827","#FFFFFF",16,13,8); inner.appendChild(btn); fill(btn);
    const foot=txt("Don't have an account?  Sign up \u2192",13,"Regular","#6B7280",{align:"CENTER"}); inner.appendChild(foot); fill(foot);
    return f;
  },

  // ── SIGN UP ──────────────────────────────────────────────────────────────
  "signup-1": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Sign Up — Light Card",dir:"VERTICAL",bg:"#F9FAFB",w:W,pt:40,pb:40,pl:40,pr:40,gap:0,main:"CENTER",cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const cardW=mobile?W-80:Math.min(480,W-80);
    const card=alFrame({name:"Card",dir:"VERTICAL",bg:"#FFFFFF",gap:24,pl:40,pr:40,pt:40,pb:40,radius:16,cross:"CENTER"});
    card.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; card.strokeWeight=1;
    card.resize(cardW,1); card.primaryAxisSizingMode="AUTO"; card.counterAxisSizingMode="FIXED"; f.appendChild(card);
    const logo=alFrame({name:"Logo",dir:"HORIZONTAL",bg:"#F97316",pl:0,pr:0,pt:0,pb:0,main:"CENTER",cross:"CENTER",radius:10});
    logo.resize(40,40); logo.primaryAxisSizingMode="FIXED"; logo.counterAxisSizingMode="FIXED"; card.appendChild(logo);
    const hGrp=alFrame({name:"Heading",dir:"VERTICAL",gap:8,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); hGrp.primaryAxisSizingMode="AUTO"; card.appendChild(hGrp); fill(hGrp);
    hGrp.appendChild(txt("Create an account",24,"Bold","#111827",{align:"CENTER"}));
    const hs=txt("Start your journey — it's free.",14,"Regular","#6B7280",{align:"CENTER",lineHeight:22}); hGrp.appendChild(hs); fill(hs);
    const form=alFrame({name:"Form",dir:"VERTICAL",gap:10,pl:0,pr:0,pt:0,pb:0}); card.appendChild(form); fill(form);
    if(!mobile){
      const nr=alFrame({name:"Name Row",dir:"HORIZONTAL",gap:10,pl:0,pr:0,pt:0,pb:0}); form.appendChild(nr); fill(nr);
      ["First name","Last name"].forEach(ph=>{
        const inp=alFrame({name:ph,dir:"HORIZONTAL",bg:"#F9FAFB",pl:14,pr:14,pt:12,pb:12,cross:"CENTER",radius:8});
        inp.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; inp.strokeWeight=1;
        const p=txt(ph,14,"Regular","#9CA3AF"); inp.appendChild(p); fill(p); nr.appendChild(inp); fill(inp);
      });
    }
    ["Email address","Password","Confirm password"].forEach(ph=>{
      const inp=alFrame({name:ph,dir:"HORIZONTAL",bg:"#F9FAFB",pl:14,pr:14,pt:12,pb:12,cross:"CENTER",radius:8});
      inp.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; inp.strokeWeight=1;
      const p=txt(ph,14,"Regular","#9CA3AF"); inp.appendChild(p); fill(p); form.appendChild(inp); fill(inp);
    });
    const btn=btnNode("Create account","#F97316","#FFFFFF",16,13,8); card.appendChild(btn); fill(btn);
    const foot=txt("Already have an account?  Sign in \u2192",13,"Regular","#6B7280",{align:"CENTER"}); card.appendChild(foot); fill(foot);
    return f;
  },

  "signup-2": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Sign Up — Dark Panel",dir:"VERTICAL",bg:"#0F172A",w:W,pt:40,pb:40,pl:40,pr:40,gap:0,main:"CENTER",cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const cardW=mobile?W-80:Math.min(480,W-80);
    const card=alFrame({name:"Card",dir:"VERTICAL",bg:"#1E293B",gap:24,pl:40,pr:40,pt:40,pb:40,radius:16,cross:"CENTER"});
    card.strokes=[{type:"SOLID",color:rgb("#334155")}]; card.strokeWeight=1;
    card.resize(cardW,1); card.primaryAxisSizingMode="AUTO"; card.counterAxisSizingMode="FIXED"; f.appendChild(card);
    const logo=alFrame({name:"Logo",dir:"HORIZONTAL",bg:"#6366F1",pl:0,pr:0,pt:0,pb:0,main:"CENTER",cross:"CENTER",radius:10});
    logo.resize(40,40); logo.primaryAxisSizingMode="FIXED"; logo.counterAxisSizingMode="FIXED"; card.appendChild(logo);
    const hGrp=alFrame({name:"Heading",dir:"VERTICAL",gap:8,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); hGrp.primaryAxisSizingMode="AUTO"; card.appendChild(hGrp); fill(hGrp);
    hGrp.appendChild(txt("Create an account",24,"Bold","#F1F5F9",{align:"CENTER"}));
    const hs=txt("Join thousands of users today.",14,"Regular","#94A3B8",{align:"CENTER",lineHeight:22}); hGrp.appendChild(hs); fill(hs);
    const form=alFrame({name:"Form",dir:"VERTICAL",gap:10,pl:0,pr:0,pt:0,pb:0}); card.appendChild(form); fill(form);
    if(!mobile){
      const nr=alFrame({name:"Name Row",dir:"HORIZONTAL",gap:10,pl:0,pr:0,pt:0,pb:0}); form.appendChild(nr); fill(nr);
      ["First name","Last name"].forEach(ph=>{
        const inp=alFrame({name:ph,dir:"HORIZONTAL",bg:"#0F172A",pl:14,pr:14,pt:12,pb:12,cross:"CENTER",radius:8});
        inp.strokes=[{type:"SOLID",color:rgb("#334155")}]; inp.strokeWeight=1;
        const p=txt(ph,14,"Regular","#475569"); inp.appendChild(p); fill(p); nr.appendChild(inp); fill(inp);
      });
    }
    ["Email address","Password","Confirm password"].forEach(ph=>{
      const inp=alFrame({name:ph,dir:"HORIZONTAL",bg:"#0F172A",pl:14,pr:14,pt:12,pb:12,cross:"CENTER",radius:8});
      inp.strokes=[{type:"SOLID",color:rgb("#334155")}]; inp.strokeWeight=1;
      const p=txt(ph,14,"Regular","#475569"); inp.appendChild(p); fill(p); form.appendChild(inp); fill(inp);
    });
    const btn=btnNode("Create account","#6366F1","#FFFFFF",16,13,8); card.appendChild(btn); fill(btn);
    const foot=txt("Already have an account?  Sign in \u2192",13,"Regular","#475569",{align:"CENTER"}); card.appendChild(foot); fill(foot);
    return f;
  },

  "signup-3": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Sign Up — Social First",dir:"VERTICAL",bg:"#F9FAFB",w:W,pt:40,pb:40,pl:40,pr:40,gap:0,main:"CENTER",cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const cardW=mobile?W-80:Math.min(460,W-80);
    const card=alFrame({name:"Card",dir:"VERTICAL",bg:"#FFFFFF",gap:16,pl:40,pr:40,pt:40,pb:40,radius:16,cross:"CENTER"});
    card.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; card.strokeWeight=1;
    card.resize(cardW,1); card.primaryAxisSizingMode="AUTO"; card.counterAxisSizingMode="FIXED"; f.appendChild(card);
    const hGrp=alFrame({name:"Heading",dir:"VERTICAL",gap:8,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); hGrp.primaryAxisSizingMode="AUTO"; card.appendChild(hGrp); fill(hGrp);
    hGrp.appendChild(txt("Create your account",22,"Bold","#111827",{align:"CENTER"}));
    const hs=txt("Join free. No credit card required.",14,"Regular","#6B7280",{align:"CENTER"}); hGrp.appendChild(hs); fill(hs);
    [["G  Continue with Google","#FFFFFF","#374151"],["\u25B2  Continue with GitHub","#111827","#FFFFFF"]].forEach(([label,bg,tc])=>{
      const sb=alFrame({name:label,dir:"HORIZONTAL",bg,pl:16,pr:16,pt:11,pb:11,gap:10,cross:"CENTER",radius:8,main:"CENTER"});
      sb.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; sb.strokeWeight=1;
      sb.appendChild(txt(label,14,"Medium",tc)); card.appendChild(sb); fill(sb);
    });
    const divRow=alFrame({name:"Divider",dir:"HORIZONTAL",gap:12,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); card.appendChild(divRow); fill(divRow);
    const dl=alFrame({name:"L",dir:"HORIZONTAL",bg:"#E5E7EB",pt:0,pb:0,pl:0,pr:0}); divRow.appendChild(dl); dl.resize(1,1); fill(dl);
    divRow.appendChild(txt("or continue with email",12,"Medium","#9CA3AF"));
    const dr=alFrame({name:"R",dir:"HORIZONTAL",bg:"#E5E7EB",pt:0,pb:0,pl:0,pr:0}); divRow.appendChild(dr); dr.resize(1,1); fill(dr);
    const form=alFrame({name:"Form",dir:"VERTICAL",gap:10,pl:0,pr:0,pt:0,pb:0}); card.appendChild(form); fill(form);
    ["Email address","Password"].forEach(ph=>{
      const inp=alFrame({name:ph,dir:"HORIZONTAL",bg:"#F9FAFB",pl:14,pr:14,pt:12,pb:12,cross:"CENTER",radius:8});
      inp.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; inp.strokeWeight=1;
      const p=txt(ph,14,"Regular","#9CA3AF"); inp.appendChild(p); fill(p); form.appendChild(inp); fill(inp);
    });
    const btn=btnNode("Create account","#111827","#FFFFFF",16,13,8); card.appendChild(btn); fill(btn);
    const foot=txt("Already have an account?  Sign in \u2192",13,"Regular","#6B7280",{align:"CENTER"}); card.appendChild(foot); fill(foot);
    return f;
  },

  "signup-4": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Sign Up — Minimal",dir:"VERTICAL",bg:"#FFFFFF",w:W,pt:40,pb:40,pl:40,pr:40,gap:0,main:"CENTER",cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const inner=alFrame({name:"Inner",dir:"VERTICAL",bg:"#FFFFFF",pt:0,pb:0,pl:0,pr:0,gap:20});
    inner.resize(mobile?W-80:Math.min(420,W-80),1); inner.primaryAxisSizingMode="AUTO"; inner.counterAxisSizingMode="FIXED";
    f.appendChild(inner);
    const hGrp=alFrame({name:"Heading",dir:"VERTICAL",gap:8,pl:0,pr:0,pt:0,pb:0}); hGrp.primaryAxisSizingMode="AUTO"; inner.appendChild(hGrp); fill(hGrp);
    hGrp.appendChild(txt("Get started",30,"Bold","#111827"));
    const hs=txt("Create your free account in seconds.",15,"Regular","#6B7280",{lineHeight:22}); hGrp.appendChild(hs); fill(hs);
    const form=alFrame({name:"Form",dir:"VERTICAL",gap:16,pl:0,pr:0,pt:0,pb:0}); inner.appendChild(form); fill(form);
    if(!mobile){
      const nr=alFrame({name:"Name Row",dir:"HORIZONTAL",gap:12,pl:0,pr:0,pt:0,pb:0}); form.appendChild(nr); fill(nr);
      ["First name","Last name"].forEach(lbl=>{
        const field=alFrame({name:lbl,dir:"VERTICAL",gap:6,pl:0,pr:0,pt:0,pb:0}); nr.appendChild(field); fill(field);
        field.appendChild(txt(lbl,13,"Medium","#374151"));
        const inp=alFrame({name:"Input",dir:"HORIZONTAL",bg:"#F9FAFB",pl:14,pr:14,pt:11,pb:11,cross:"CENTER",radius:8});
        inp.strokes=[{type:"SOLID",color:rgb("#D1D5DB")}]; inp.strokeWeight=1;
        const p=txt(lbl,14,"Regular","#9CA3AF"); inp.appendChild(p); fill(p); field.appendChild(inp); fill(inp);
      });
    }
    [["Email","Email address"],["Password","Create a strong password"]].forEach(([lbl,ph])=>{
      const field=alFrame({name:lbl,dir:"VERTICAL",gap:6,pl:0,pr:0,pt:0,pb:0}); form.appendChild(field); fill(field);
      field.appendChild(txt(lbl,13,"Medium","#374151"));
      const inp=alFrame({name:"Input",dir:"HORIZONTAL",bg:"#F9FAFB",pl:14,pr:14,pt:11,pb:11,cross:"CENTER",radius:8});
      inp.strokes=[{type:"SOLID",color:rgb("#D1D5DB")}]; inp.strokeWeight=1;
      const p=txt(ph,14,"Regular","#9CA3AF"); inp.appendChild(p); fill(p); field.appendChild(inp); fill(inp);
    });
    const chkRow=alFrame({name:"Terms",dir:"HORIZONTAL",gap:10,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); form.appendChild(chkRow); fill(chkRow);
    const chk=rect(16,16,"#FFFFFF",4); chk.strokes=[{type:"SOLID",color:rgb("#D1D5DB")}]; chk.strokeWeight=1.5; chkRow.appendChild(chk);
    const ct=txt("I agree to the Terms of Service and Privacy Policy.",13,"Regular","#6B7280",{lineHeight:20}); chkRow.appendChild(ct); fill(ct);
    const btn=btnNode("Create account","#111827","#FFFFFF",16,13,8); inner.appendChild(btn); fill(btn);
    const foot=txt("Already have an account?  Sign in \u2192",13,"Regular","#6B7280"); inner.appendChild(foot); fill(foot);
    return f;
  },

  "signup-5": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Sign Up — Two Column",dir:mobile?"VERTICAL":"HORIZONTAL",bg:"#FFFFFF",w:W,pt:0,pb:0,pl:0,pr:0,gap:0});
    if(mobile){f.primaryAxisSizingMode="AUTO";f.counterAxisSizingMode="FIXED";}else{f.counterAxisSizingMode="AUTO";}
    const brand=alFrame({name:"Brand Panel",dir:"VERTICAL",bg:"#DBEAFE",pt:60,pb:60,pl:60,pr:60,gap:16,main:"CENTER",cross:"CENTER"});
    brand.primaryAxisSizingMode="AUTO"; f.appendChild(brand); fill(brand); if(!mobile) fillV(brand);
    const lbx=alFrame({name:"Logo",dir:"HORIZONTAL",bg:"#2563EB",pl:0,pr:0,pt:0,pb:0,main:"CENTER",cross:"CENTER",radius:12});
    lbx.resize(52,52); lbx.primaryAxisSizingMode="FIXED"; lbx.counterAxisSizingMode="FIXED"; brand.appendChild(lbx);
    const bh=txt("Brand",22,"Bold","#1E3A8A",{align:"CENTER"}); brand.appendChild(bh); fill(bh);
    const bs=txt("The smart workspace for modern teams.",14,"Regular","#93C5FD",{align:"CENTER",lineHeight:22}); brand.appendChild(bs); fill(bs);
    const formSide=alFrame({name:"Form Side",dir:"VERTICAL",bg:"#FFFFFF",pt:40,pb:40,pl:40,pr:40,gap:24,main:"CENTER",cross:"CENTER"});
    formSide.primaryAxisSizingMode="AUTO"; f.appendChild(formSide); fill(formSide); if(!mobile) fillV(formSide);
    const inner=alFrame({name:"Inner",dir:"VERTICAL",bg:"#FFFFFF",pt:0,pb:0,pl:0,pr:0,gap:24,cross:"CENTER"});
    formSide.appendChild(inner);
    if(W>768){ inner.resize(420,1); inner.primaryAxisSizingMode="AUTO"; inner.counterAxisSizingMode="FIXED"; }
    else { inner.primaryAxisSizingMode="AUTO"; fill(inner); }
    const hGrp=alFrame({name:"Heading",dir:"VERTICAL",gap:8,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); hGrp.primaryAxisSizingMode="AUTO"; inner.appendChild(hGrp); fill(hGrp);
    hGrp.appendChild(txt("Create your account",24,"Bold","#111827",{align:"CENTER"}));
    const hs=txt("Set up your account in minutes.",14,"Regular","#6B7280",{align:"CENTER",lineHeight:22}); hGrp.appendChild(hs); fill(hs);
    const form=alFrame({name:"Form",dir:"VERTICAL",gap:14,pl:0,pr:0,pt:0,pb:0}); inner.appendChild(form); fill(form);
    if(!mobile){
      const nr=alFrame({name:"Name Row",dir:"HORIZONTAL",gap:12,pl:0,pr:0,pt:0,pb:0}); form.appendChild(nr); fill(nr);
      ["First name","Last name"].forEach(lbl=>{
        const field=alFrame({name:lbl,dir:"VERTICAL",gap:6,pl:0,pr:0,pt:0,pb:0}); nr.appendChild(field); fill(field);
        field.appendChild(txt(lbl,13,"Medium","#374151"));
        const inp=alFrame({name:"Input",dir:"HORIZONTAL",bg:"#F9FAFB",pl:14,pr:14,pt:11,pb:11,cross:"CENTER",radius:8});
        inp.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; inp.strokeWeight=1;
        const p=txt(lbl,14,"Regular","#9CA3AF"); inp.appendChild(p); fill(p); field.appendChild(inp); fill(inp);
      });
    }
    [["Email","Email address"],["Password","Create a strong password"]].forEach(([lbl,ph])=>{
      const field=alFrame({name:lbl,dir:"VERTICAL",gap:6,pl:0,pr:0,pt:0,pb:0}); form.appendChild(field); fill(field);
      field.appendChild(txt(lbl,13,"Medium","#374151"));
      const inp=alFrame({name:"Input",dir:"HORIZONTAL",bg:"#F9FAFB",pl:14,pr:14,pt:11,pb:11,cross:"CENTER",radius:8});
      inp.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; inp.strokeWeight=1;
      const p=txt(ph,14,"Regular","#9CA3AF"); inp.appendChild(p); fill(p); field.appendChild(inp); fill(inp);
    });
    const btn=btnNode("Create account","#2563EB","#FFFFFF",16,13,8); inner.appendChild(btn); fill(btn);
    const foot=txt("Already have an account?  Sign in \u2192",13,"Regular","#6B7280",{align:"CENTER"}); inner.appendChild(foot); fill(foot);
    return f;
  },

  "signup-6": W => {
    const mobile=W<=480;
    const f=alFrame({name:"Sign Up — Branded",dir:"VERTICAL",bg:"#F5F3FF",w:W,pt:40,pb:40,pl:40,pr:40,gap:0,main:"CENTER",cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const cardW=mobile?W-80:Math.min(480,W-80);
    const card=alFrame({name:"Card",dir:"VERTICAL",bg:"#FFFFFF",gap:0,pl:0,pr:0,pt:0,pb:0,radius:16,cross:"CENTER"});
    card.strokes=[{type:"SOLID",color:rgb("#EDE9FE")}]; card.strokeWeight=1;
    card.resize(cardW,1); card.primaryAxisSizingMode="AUTO"; card.counterAxisSizingMode="FIXED"; f.appendChild(card);
    const hdr=alFrame({name:"Header",dir:"VERTICAL",bg:"#6366F1",pt:28,pb:28,pl:40,pr:40,gap:8,cross:"CENTER"});
    hdr.primaryAxisSizingMode="AUTO"; card.appendChild(hdr); fill(hdr);
    const lbx=alFrame({name:"Logo",dir:"HORIZONTAL",pl:0,pr:0,pt:0,pb:0,main:"CENTER",cross:"CENTER",radius:8});
    lbx.fills=solid("#FFFFFF",0.2); lbx.resize(36,36); lbx.primaryAxisSizingMode="FIXED"; lbx.counterAxisSizingMode="FIXED"; hdr.appendChild(lbx);
    hdr.appendChild(txt("Join us today",18,"Bold","#FFFFFF",{align:"CENTER"}));
    const hs2=txt("Create your free account and get started.",13,"Regular","#C7D2FE",{align:"CENTER",lineHeight:20}); hdr.appendChild(hs2); fill(hs2);
    const body=alFrame({name:"Body",dir:"VERTICAL",bg:"#FFFFFF",pt:32,pb:32,pl:40,pr:40,gap:12,cross:"CENTER"});
    body.primaryAxisSizingMode="AUTO"; card.appendChild(body); fill(body);
    if(!mobile){
      const nr=alFrame({name:"Name Row",dir:"HORIZONTAL",gap:10,pl:0,pr:0,pt:0,pb:0}); body.appendChild(nr); fill(nr);
      ["First name","Last name"].forEach(ph=>{
        const inp=alFrame({name:ph,dir:"HORIZONTAL",bg:"#FAF5FF",pl:14,pr:14,pt:11,pb:11,cross:"CENTER",radius:8});
        inp.strokes=[{type:"SOLID",color:rgb("#EDE9FE")}]; inp.strokeWeight=1;
        const p=txt(ph,14,"Regular","#9CA3AF"); inp.appendChild(p); fill(p); nr.appendChild(inp); fill(inp);
      });
    }
    ["Email address","Password"].forEach(ph=>{
      const inp=alFrame({name:ph,dir:"HORIZONTAL",bg:"#FAF5FF",pl:14,pr:14,pt:11,pb:11,cross:"CENTER",radius:8});
      inp.strokes=[{type:"SOLID",color:rgb("#EDE9FE")}]; inp.strokeWeight=1;
      const p=txt(ph,14,"Regular","#9CA3AF"); inp.appendChild(p); fill(p); body.appendChild(inp); fill(inp);
    });
    const btn=btnNode("Create account","#6366F1","#FFFFFF",16,13,8); body.appendChild(btn); fill(btn);
    const foot=txt("Already have an account?  Sign in \u2192",13,"Regular","#6B7280",{align:"CENTER"}); body.appendChild(foot); fill(foot);
    return f;
  },

  // ── CONTACT FORM ─────────────────────────────────────────────────────────
  "contact-1": W => {
    const mobile=W<=768;
    const f=alFrame({name:"Contact — Info + Form",dir:mobile?"VERTICAL":"HORIZONTAL",bg:"#FFFFFF",w:W,pt:40,pb:40,pl:40,pr:40,gap:40,cross:"MIN"});
    if(mobile){f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";}
    else{f.primaryAxisSizingMode="FIXED"; f.counterAxisSizingMode="AUTO";}
    const info=alFrame({name:"Contact Info",dir:"VERTICAL",gap:24,pl:0,pr:0,pt:0,pb:0});
    info.primaryAxisSizingMode="AUTO"; f.appendChild(info); fill(info);
    info.appendChild(txt("GET IN TOUCH",12,"SemiBold","#F97316"));
    const hGrp=alFrame({name:"Heading",dir:"VERTICAL",gap:8,pl:0,pr:0,pt:0,pb:0}); hGrp.primaryAxisSizingMode="AUTO"; info.appendChild(hGrp); fill(hGrp);
    hGrp.appendChild(txt("Contact us",32,"Bold","#111827",{lineHeight:40}));
    const desc=txt("We're here to help. Send us a message and we'll get back to you within 24 hours.",15,"Regular","#6B7280",{lineHeight:24}); hGrp.appendChild(desc); fill(desc);
    const divL=alFrame({name:"Divider",dir:"HORIZONTAL",bg:"#E5E7EB",pt:0,pb:0,pl:0,pr:0}); divL.resize(1,1); info.appendChild(divL); fill(divL);
    [["\u{1F4E7}","hello@company.com"],["\u{1F4DE}","+1 (555) 000-0000"],["\u{1F4CD}","123 Market Street, San Francisco, CA"]].forEach(([icon,text])=>{
      const row=alFrame({name:"Row",dir:"HORIZONTAL",gap:12,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); info.appendChild(row); fill(row);
      const ic=alFrame({name:"Icon",dir:"HORIZONTAL",bg:"#F3F4F6",pl:10,pr:10,pt:10,pb:10,main:"CENTER",cross:"CENTER",radius:8});
      ic.primaryAxisSizingMode="FIXED"; ic.counterAxisSizingMode="FIXED"; ic.resize(40,40);
      ic.appendChild(txt(icon,16,"Regular","#374151")); row.appendChild(ic);
      const ct=txt(text,14,"Regular","#374151",{lineHeight:20}); row.appendChild(ct); fill(ct);
    });
    const formCol=alFrame({name:"Form",dir:"VERTICAL",gap:16,pl:0,pr:0,pt:0,pb:0});
    formCol.primaryAxisSizingMode="AUTO"; f.appendChild(formCol); fill(formCol);
    const nr=alFrame({name:"Name Row",dir:mobile?"VERTICAL":"HORIZONTAL",gap:12,pl:0,pr:0,pt:0,pb:0}); formCol.appendChild(nr); fill(nr);
    [["First name","First name"],["Last name","Last name"]].forEach(([lbl,ph])=>{
      const field=alFrame({name:lbl,dir:"VERTICAL",gap:6,pl:0,pr:0,pt:0,pb:0}); nr.appendChild(field); fill(field);
      field.appendChild(txt(lbl,13,"Medium","#374151"));
      const inp=alFrame({name:"Input",dir:"HORIZONTAL",bg:"#F9FAFB",pl:14,pr:14,pt:11,pb:11,cross:"CENTER",radius:8});
      inp.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; inp.strokeWeight=1;
      const p=txt(ph,14,"Regular","#9CA3AF"); inp.appendChild(p); fill(p); field.appendChild(inp); fill(inp);
    });
    [["Email","Email address"],["Subject","How can we help?"]].forEach(([lbl,ph])=>{
      const field=alFrame({name:lbl,dir:"VERTICAL",gap:6,pl:0,pr:0,pt:0,pb:0}); formCol.appendChild(field); fill(field);
      field.appendChild(txt(lbl,13,"Medium","#374151"));
      const inp=alFrame({name:"Input",dir:"HORIZONTAL",bg:"#F9FAFB",pl:14,pr:14,pt:11,pb:11,cross:"CENTER",radius:8});
      inp.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; inp.strokeWeight=1;
      const p=txt(ph,14,"Regular","#9CA3AF"); inp.appendChild(p); fill(p); field.appendChild(inp); fill(inp);
    });
    const msgF=alFrame({name:"Message",dir:"VERTICAL",gap:6,pl:0,pr:0,pt:0,pb:0}); formCol.appendChild(msgF); fill(msgF);
    msgF.appendChild(txt("Message",13,"Medium","#374151"));
    const msgInp=alFrame({name:"Textarea",dir:"VERTICAL",bg:"#F9FAFB",pl:14,pr:14,pt:12,pb:12,cross:"MIN",radius:8});
    msgInp.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; msgInp.strokeWeight=1;
    const mp=txt("Tell us more about your enquiry\u2026",14,"Regular","#9CA3AF",{lineHeight:22}); msgInp.appendChild(mp); fill(mp);
    msgInp.resize(1,120); msgInp.primaryAxisSizingMode="FIXED"; msgF.appendChild(msgInp); fill(msgInp);
    formCol.appendChild(btnNode("Send message","#F97316","#FFFFFF",20,13,8));
    return f;
  },

  "contact-2": W => {
    const mobile=W<=768;
    const f=alFrame({name:"Contact — Centered",dir:"VERTICAL",bg:"#F9FAFB",w:W,pt:40,pb:40,pl:40,pr:40,gap:24,cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    f.appendChild(txt("CONTACT",12,"SemiBold","#F97316",{align:"CENTER"}));
    const hGrp=alFrame({name:"Heading",dir:"VERTICAL",gap:8,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); hGrp.primaryAxisSizingMode="AUTO"; f.appendChild(hGrp); fill(hGrp);
    hGrp.appendChild(txt("Get in touch",34,"Bold","#111827",{align:"CENTER",lineHeight:42}));
    const hs=txt("Fill in the form below and our team will be in touch.",16,"Regular","#6B7280",{align:"CENTER",lineHeight:24}); hGrp.appendChild(hs); fill(hs);
    const form=alFrame({name:"Form",dir:"VERTICAL",bg:"#FFFFFF",gap:16,pl:40,pr:40,pt:40,pb:40,radius:16});
    form.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; form.strokeWeight=1;
    if(mobile){form.primaryAxisSizingMode="AUTO"; f.appendChild(form); fill(form);}
    else{form.resize(Math.min(640,W-80),1); form.primaryAxisSizingMode="AUTO"; form.counterAxisSizingMode="FIXED"; f.appendChild(form);}
    const nr=alFrame({name:"Name Row",dir:mobile?"VERTICAL":"HORIZONTAL",gap:12,pl:0,pr:0,pt:0,pb:0}); form.appendChild(nr); fill(nr);
    [["First name","First name"],["Last name","Last name"]].forEach(([lbl,ph])=>{
      const field=alFrame({name:lbl,dir:"VERTICAL",gap:6,pl:0,pr:0,pt:0,pb:0}); nr.appendChild(field); fill(field);
      field.appendChild(txt(lbl,13,"Medium","#374151"));
      const inp=alFrame({name:"Input",dir:"HORIZONTAL",bg:"#F9FAFB",pl:14,pr:14,pt:11,pb:11,cross:"CENTER",radius:8});
      inp.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; inp.strokeWeight=1;
      const p=txt(ph,14,"Regular","#9CA3AF"); inp.appendChild(p); fill(p); field.appendChild(inp); fill(inp);
    });
    [["Email","your@email.com"],["Subject","What's this about?"]].forEach(([lbl,ph])=>{
      const field=alFrame({name:lbl,dir:"VERTICAL",gap:6,pl:0,pr:0,pt:0,pb:0}); form.appendChild(field); fill(field);
      field.appendChild(txt(lbl,13,"Medium","#374151"));
      const inp=alFrame({name:"Input",dir:"HORIZONTAL",bg:"#F9FAFB",pl:14,pr:14,pt:11,pb:11,cross:"CENTER",radius:8});
      inp.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; inp.strokeWeight=1;
      const p=txt(ph,14,"Regular","#9CA3AF"); inp.appendChild(p); fill(p); field.appendChild(inp); fill(inp);
    });
    const msgF=alFrame({name:"Message",dir:"VERTICAL",gap:6,pl:0,pr:0,pt:0,pb:0}); form.appendChild(msgF); fill(msgF);
    msgF.appendChild(txt("Message",13,"Medium","#374151"));
    const msgInp=alFrame({name:"Textarea",dir:"VERTICAL",bg:"#F9FAFB",pl:14,pr:14,pt:12,pb:12,cross:"MIN",radius:8});
    msgInp.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; msgInp.strokeWeight=1;
    const mp=txt("Write your message here\u2026",14,"Regular","#9CA3AF",{lineHeight:22}); msgInp.appendChild(mp); fill(mp);
    msgInp.resize(1,120); msgInp.primaryAxisSizingMode="FIXED"; msgF.appendChild(msgInp); fill(msgInp);
    form.appendChild(btnNode("Send message","#111827","#FFFFFF",20,13,8));
    return f;
  },

  "contact-3": W => {
    const mobile=W<=768;
    const f=alFrame({name:"Contact — Dark Theme",dir:"VERTICAL",bg:"#0F172A",w:W,pt:40,pb:40,pl:40,pr:40,gap:24,cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    f.appendChild(txt("CONTACT US",12,"SemiBold","#6366F1",{align:"CENTER"}));
    const hGrp=alFrame({name:"Heading",dir:"VERTICAL",gap:8,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); hGrp.primaryAxisSizingMode="AUTO"; f.appendChild(hGrp); fill(hGrp);
    hGrp.appendChild(txt("Send us a message",32,"Bold","#F1F5F9",{align:"CENTER",lineHeight:40}));
    const hs=txt("Our team typically responds within one business day.",15,"Regular","#94A3B8",{align:"CENTER",lineHeight:24}); hGrp.appendChild(hs); fill(hs);
    const form=alFrame({name:"Form",dir:"VERTICAL",bg:"#1E293B",gap:16,pl:40,pr:40,pt:40,pb:40,radius:16});
    form.strokes=[{type:"SOLID",color:rgb("#334155")}]; form.strokeWeight=1;
    if(mobile){form.primaryAxisSizingMode="AUTO"; f.appendChild(form); fill(form);}
    else{form.resize(Math.min(640,W-80),1); form.primaryAxisSizingMode="AUTO"; form.counterAxisSizingMode="FIXED"; f.appendChild(form);}
    const nr=alFrame({name:"Name Row",dir:mobile?"VERTICAL":"HORIZONTAL",gap:12,pl:0,pr:0,pt:0,pb:0}); form.appendChild(nr); fill(nr);
    [["First name","First name"],["Last name","Last name"]].forEach(([lbl,ph])=>{
      const field=alFrame({name:lbl,dir:"VERTICAL",gap:6,pl:0,pr:0,pt:0,pb:0}); nr.appendChild(field); fill(field);
      field.appendChild(txt(lbl,13,"Medium","#94A3B8"));
      const inp=alFrame({name:"Input",dir:"HORIZONTAL",bg:"#0F172A",pl:14,pr:14,pt:11,pb:11,cross:"CENTER",radius:8});
      inp.strokes=[{type:"SOLID",color:rgb("#334155")}]; inp.strokeWeight=1;
      const p=txt(ph,14,"Regular","#475569"); inp.appendChild(p); fill(p); field.appendChild(inp); fill(inp);
    });
    [["Email","your@email.com"],["Subject","What's on your mind?"]].forEach(([lbl,ph])=>{
      const field=alFrame({name:lbl,dir:"VERTICAL",gap:6,pl:0,pr:0,pt:0,pb:0}); form.appendChild(field); fill(field);
      field.appendChild(txt(lbl,13,"Medium","#94A3B8"));
      const inp=alFrame({name:"Input",dir:"HORIZONTAL",bg:"#0F172A",pl:14,pr:14,pt:11,pb:11,cross:"CENTER",radius:8});
      inp.strokes=[{type:"SOLID",color:rgb("#334155")}]; inp.strokeWeight=1;
      const p=txt(ph,14,"Regular","#475569"); inp.appendChild(p); fill(p); field.appendChild(inp); fill(inp);
    });
    const msgF=alFrame({name:"Message",dir:"VERTICAL",gap:6,pl:0,pr:0,pt:0,pb:0}); form.appendChild(msgF); fill(msgF);
    msgF.appendChild(txt("Message",13,"Medium","#94A3B8"));
    const msgInp=alFrame({name:"Textarea",dir:"VERTICAL",bg:"#0F172A",pl:14,pr:14,pt:12,pb:12,cross:"MIN",radius:8});
    msgInp.strokes=[{type:"SOLID",color:rgb("#334155")}]; msgInp.strokeWeight=1;
    const mp=txt("Write your message here\u2026",14,"Regular","#475569",{lineHeight:22}); msgInp.appendChild(mp); fill(mp);
    msgInp.resize(1,120); msgInp.primaryAxisSizingMode="FIXED"; msgF.appendChild(msgInp); fill(msgInp);
    form.appendChild(btnNode("Send message","#6366F1","#FFFFFF",20,13,8));
    return f;
  },

  "contact-4": W => {
    const mobile=W<=768;
    const f=alFrame({name:"Contact — Card Header",dir:"VERTICAL",bg:"#FFFFFF",w:W,pt:40,pb:40,pl:40,pr:40,gap:0,cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    const cardW=mobile?W-80:Math.min(640,W-80);
    const card=alFrame({name:"Card",dir:"VERTICAL",bg:"#FFFFFF",gap:0,pl:0,pr:0,pt:0,pb:0,radius:16,cross:"CENTER"});
    card.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; card.strokeWeight=1;
    card.resize(cardW,1); card.primaryAxisSizingMode="AUTO"; card.counterAxisSizingMode="FIXED"; f.appendChild(card);
    const cardHdr=alFrame({name:"Card Header",dir:"VERTICAL",bg:"#F9FAFB",pt:24,pb:24,pl:40,pr:40,gap:8,cross:"MIN"});
    cardHdr.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}];
    cardHdr.strokeTopWeight=0; cardHdr.strokeLeftWeight=0; cardHdr.strokeRightWeight=0; cardHdr.strokeBottomWeight=1;
    cardHdr.primaryAxisSizingMode="AUTO"; card.appendChild(cardHdr); fill(cardHdr);
    cardHdr.appendChild(txt("Contact us",22,"Bold","#111827"));
    const cs=txt("Fill in the form below and we'll get back to you.",14,"Regular","#6B7280",{lineHeight:22}); cardHdr.appendChild(cs); fill(cs);
    const cardBody=alFrame({name:"Card Body",dir:"VERTICAL",bg:"#FFFFFF",pt:32,pb:32,pl:40,pr:40,gap:16,cross:"MIN"});
    cardBody.primaryAxisSizingMode="AUTO"; card.appendChild(cardBody); fill(cardBody);
    const nr=alFrame({name:"Name Row",dir:mobile?"VERTICAL":"HORIZONTAL",gap:12,pl:0,pr:0,pt:0,pb:0}); cardBody.appendChild(nr); fill(nr);
    [["First name","First name"],["Last name","Last name"]].forEach(([lbl,ph])=>{
      const field=alFrame({name:lbl,dir:"VERTICAL",gap:6,pl:0,pr:0,pt:0,pb:0}); nr.appendChild(field); fill(field);
      field.appendChild(txt(lbl,13,"Medium","#374151"));
      const inp=alFrame({name:"Input",dir:"HORIZONTAL",bg:"#F9FAFB",pl:14,pr:14,pt:11,pb:11,cross:"CENTER",radius:8});
      inp.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; inp.strokeWeight=1;
      const p=txt(ph,14,"Regular","#9CA3AF"); inp.appendChild(p); fill(p); field.appendChild(inp); fill(inp);
    });
    [["Email","your@email.com"],["Subject","Subject line"]].forEach(([lbl,ph])=>{
      const field=alFrame({name:lbl,dir:"VERTICAL",gap:6,pl:0,pr:0,pt:0,pb:0}); cardBody.appendChild(field); fill(field);
      field.appendChild(txt(lbl,13,"Medium","#374151"));
      const inp=alFrame({name:"Input",dir:"HORIZONTAL",bg:"#F9FAFB",pl:14,pr:14,pt:11,pb:11,cross:"CENTER",radius:8});
      inp.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; inp.strokeWeight=1;
      const p=txt(ph,14,"Regular","#9CA3AF"); inp.appendChild(p); fill(p); field.appendChild(inp); fill(inp);
    });
    const msgF=alFrame({name:"Message",dir:"VERTICAL",gap:6,pl:0,pr:0,pt:0,pb:0}); cardBody.appendChild(msgF); fill(msgF);
    msgF.appendChild(txt("Message",13,"Medium","#374151"));
    const msgInp=alFrame({name:"Textarea",dir:"VERTICAL",bg:"#F9FAFB",pl:14,pr:14,pt:12,pb:12,cross:"MIN",radius:8});
    msgInp.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; msgInp.strokeWeight=1;
    const mp=txt("How can we help you?",14,"Regular","#9CA3AF",{lineHeight:22}); msgInp.appendChild(mp); fill(mp);
    msgInp.resize(1,120); msgInp.primaryAxisSizingMode="FIXED"; msgF.appendChild(msgInp); fill(msgInp);
    const btn=btnNode("Send message","#F97316","#FFFFFF",20,13,8); cardBody.appendChild(btn); fill(btn);
    return f;
  },

  "contact-5": W => {
    const mobile=W<=768;
    const f=alFrame({name:"Contact — Minimal",dir:"VERTICAL",bg:"#FFFFFF",w:W,pt:40,pb:40,pl:40,pr:40,gap:24,cross:"CENTER"});
    f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";
    f.appendChild(txt("SAY HELLO",12,"SemiBold","#F97316",{align:"CENTER"}));
    const hGrp=alFrame({name:"Heading",dir:"VERTICAL",gap:8,pl:0,pr:0,pt:0,pb:0,cross:"CENTER"}); hGrp.primaryAxisSizingMode="AUTO"; f.appendChild(hGrp); fill(hGrp);
    hGrp.appendChild(txt("Let's talk",40,"Bold","#111827",{align:"CENTER",lineHeight:48}));
    const hs=txt("We love hearing from designers and teams building great things.",16,"Regular","#6B7280",{align:"CENTER",lineHeight:24}); hGrp.appendChild(hs); fill(hs);
    const form=alFrame({name:"Form",dir:"VERTICAL",gap:20,pl:0,pr:0,pt:0,pb:0});
    if(mobile){form.primaryAxisSizingMode="AUTO"; f.appendChild(form); fill(form);}
    else{form.resize(Math.min(640,W-80),1); form.primaryAxisSizingMode="AUTO"; form.counterAxisSizingMode="FIXED"; f.appendChild(form);}
    const nr=alFrame({name:"Name Row",dir:mobile?"VERTICAL":"HORIZONTAL",gap:24,pl:0,pr:0,pt:0,pb:0}); form.appendChild(nr); fill(nr);
    [["First name","First name"],["Last name","Last name"]].forEach(([lbl,ph])=>{
      const field=alFrame({name:lbl,dir:"VERTICAL",gap:6,pl:0,pr:0,pt:0,pb:0}); nr.appendChild(field); fill(field);
      field.appendChild(txt(lbl,13,"SemiBold","#374151"));
      const inp=alFrame({name:"Input",dir:"HORIZONTAL",bg:"#FFFFFF",pl:0,pr:0,pt:10,pb:10,cross:"CENTER"});
      inp.strokes=[{type:"SOLID",color:rgb("#111827")}]; inp.strokeTopWeight=0; inp.strokeLeftWeight=0; inp.strokeRightWeight=0; inp.strokeBottomWeight=2;
      const p=txt(ph,15,"Regular","#9CA3AF"); inp.appendChild(p); fill(p); field.appendChild(inp); fill(inp);
    });
    [["Email","your@email.com"],["Subject","What's it about?"]].forEach(([lbl,ph])=>{
      const field=alFrame({name:lbl,dir:"VERTICAL",gap:6,pl:0,pr:0,pt:0,pb:0}); form.appendChild(field); fill(field);
      field.appendChild(txt(lbl,13,"SemiBold","#374151"));
      const inp=alFrame({name:"Input",dir:"HORIZONTAL",bg:"#FFFFFF",pl:0,pr:0,pt:10,pb:10,cross:"CENTER"});
      inp.strokes=[{type:"SOLID",color:rgb("#111827")}]; inp.strokeTopWeight=0; inp.strokeLeftWeight=0; inp.strokeRightWeight=0; inp.strokeBottomWeight=2;
      const p=txt(ph,15,"Regular","#9CA3AF"); inp.appendChild(p); fill(p); field.appendChild(inp); fill(inp);
    });
    const msgF=alFrame({name:"Message",dir:"VERTICAL",gap:6,pl:0,pr:0,pt:0,pb:0}); form.appendChild(msgF); fill(msgF);
    msgF.appendChild(txt("Message",13,"SemiBold","#374151"));
    const msgInp=alFrame({name:"Textarea",dir:"VERTICAL",bg:"#FFFFFF",pl:0,pr:0,pt:10,pb:10,cross:"MIN"});
    msgInp.strokes=[{type:"SOLID",color:rgb("#111827")}]; msgInp.strokeTopWeight=0; msgInp.strokeLeftWeight=0; msgInp.strokeRightWeight=0; msgInp.strokeBottomWeight=2;
    const mp=txt("Your message\u2026",15,"Regular","#9CA3AF",{lineHeight:24}); msgInp.appendChild(mp); fill(mp);
    msgInp.resize(1,120); msgInp.primaryAxisSizingMode="FIXED"; msgF.appendChild(msgInp); fill(msgInp);
    form.appendChild(btnNode("Send message \u2192","#111827","#FFFFFF",24,14,8));
    return f;
  },

  "contact-6": W => {
    const mobile=W<=768;
    const f=alFrame({name:"Contact — Map Split",dir:mobile?"VERTICAL":"HORIZONTAL",bg:"#F9FAFB",w:W,pt:40,pb:40,pl:40,pr:40,gap:40,cross:"MIN"});
    if(mobile){f.primaryAxisSizingMode="AUTO"; f.counterAxisSizingMode="FIXED";}
    else{f.primaryAxisSizingMode="FIXED"; f.counterAxisSizingMode="AUTO";}
    const mapPanel=imgBlock("Map Panel","#E2E8F0");
    if(mobile){mapPanel.resize(1,200); mapPanel.primaryAxisSizingMode="FIXED"; f.appendChild(mapPanel); fill(mapPanel);}
    else{f.appendChild(mapPanel); fill(mapPanel); fillV(mapPanel);}
    const locCard=alFrame({name:"Location Card",dir:"VERTICAL",bg:"#FFFFFF",pt:14,pb:14,pl:18,pr:18,gap:6,radius:10,cross:"MIN"});
    locCard.strokes=[{type:"SOLID",color:rgb("#E2E8F0")}]; locCard.strokeWeight=1;
    locCard.primaryAxisSizingMode="AUTO";
    locCard.appendChild(txt("Our Office",14,"Bold","#111827"));
    const la=txt("123 Market Street, San Francisco, CA 94105",13,"Regular","#6B7280",{lineHeight:20}); locCard.appendChild(la); fill(la);
    mapPanel.appendChild(locCard); fill(locCard);
    const formSide=alFrame({name:"Form Side",dir:"VERTICAL",bg:"#FFFFFF",pt:40,pb:40,pl:40,pr:40,gap:16,radius:16});
    formSide.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; formSide.strokeWeight=1;
    formSide.primaryAxisSizingMode="AUTO"; f.appendChild(formSide); fill(formSide); if(!mobile) fillV(formSide);
    const hGrp=alFrame({name:"Heading",dir:"VERTICAL",gap:8,pl:0,pr:0,pt:0,pb:0}); hGrp.primaryAxisSizingMode="AUTO"; formSide.appendChild(hGrp); fill(hGrp);
    hGrp.appendChild(txt("Send us a message",22,"Bold","#111827"));
    const hs=txt("We'll get back to you within 24 hours.",14,"Regular","#6B7280",{lineHeight:22}); hGrp.appendChild(hs); fill(hs);
    [["Name","Your name"],["Email","your@email.com"],["Subject","What's this about?"]].forEach(([lbl,ph])=>{
      const field=alFrame({name:lbl,dir:"VERTICAL",gap:6,pl:0,pr:0,pt:0,pb:0}); formSide.appendChild(field); fill(field);
      field.appendChild(txt(lbl,13,"Medium","#374151"));
      const inp=alFrame({name:"Input",dir:"HORIZONTAL",bg:"#F9FAFB",pl:14,pr:14,pt:11,pb:11,cross:"CENTER",radius:8});
      inp.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; inp.strokeWeight=1;
      const p=txt(ph,14,"Regular","#9CA3AF"); inp.appendChild(p); fill(p); field.appendChild(inp); fill(inp);
    });
    const msgF=alFrame({name:"Message",dir:"VERTICAL",gap:6,pl:0,pr:0,pt:0,pb:0}); formSide.appendChild(msgF); fill(msgF);
    msgF.appendChild(txt("Message",13,"Medium","#374151"));
    const msgInp=alFrame({name:"Textarea",dir:"VERTICAL",bg:"#F9FAFB",pl:14,pr:14,pt:12,pb:12,cross:"MIN",radius:8});
    msgInp.strokes=[{type:"SOLID",color:rgb("#E5E7EB")}]; msgInp.strokeWeight=1;
    const mp=txt("Write your message\u2026",14,"Regular","#9CA3AF",{lineHeight:22}); msgInp.appendChild(mp); fill(mp);
    msgInp.resize(1,100); msgInp.primaryAxisSizingMode="FIXED"; msgF.appendChild(msgInp); fill(msgInp);
    formSide.appendChild(btnNode("Send message","#F97316","#FFFFFF",20,13,8));
    return f;
  },
};

// Generic fallback
function buildGeneric(sectionId, variantStyle, sectionName, W) {
  const idx = variantStyle ? parseInt(variantStyle.replace(/\D/g,"").slice(-1)||"0") % 6 : 0;
  const palettes=[
    {bg:"#FFFFFF",tc:"#111827",sc:"#6B7280",ac:"#6366F1"},
    {bg:"#0F172A",tc:"#F1F5F9",sc:"#94A3B8",ac:"#6366F1"},
    {bg:"#F9FAFB",tc:"#111827",sc:"#6B7280",ac:"#7C3AED"},
    {bg:"#111827",tc:"#FFFFFF",sc:"#9CA3AF",ac:"#F59E0B"},
    {bg:"#FFF7ED",tc:"#111827",sc:"#78350F",ac:"#F59E0B"},
    {bg:"#F5F3FF",tc:"#111827",sc:"#6B7280",ac:"#7C3AED"},
  ];
  const p=palettes[idx];
  const f=alFrame({name:sectionName+" — Style "+(idx+1),dir:"VERTICAL",bg:p.bg,w:W,pt:60,pb:60,
    pl:Math.round(W*.055),pr:Math.round(W*.055),gap:20});
  f.appendChild(txt(sectionName,30,"Bold",p.tc));
  f.appendChild(txt("A unique variation of the "+sectionName.toLowerCase()+" section.",16,"Regular",p.sc));
  f.appendChild(btnNode("Action →",p.ac,"#FFFFFF",20,10,6));
  return f;
}

// ─── Message handler ───────────────────────────────────────────────────────
figma.ui.onmessage = async function(msg) {
  if (msg.type === "insert") {
    await loadFonts();
    let node;
    try {
      const builder = BUILDERS[msg.variantStyle];
      if (builder) {
        node = builder(msg.width || 1440);
      } else {
        node = buildGeneric(msg.sectionId, msg.variantStyle, msg.sectionName, msg.width || 1440);
      }
      node.name = "["+msg.sectionName+"] "+msg.variantName;
    } catch(e) {
      figma.ui.postMessage({type:"error", message:"Build failed: "+(e.message||String(e))});
      return;
    }

    // Place below existing frames (non-overlapping stacking)
    figma.currentPage.appendChild(node);
    const siblings = figma.currentPage.children.filter(n => n !== node);
    if (siblings.length > 0) {
      const bottomY = Math.max(...siblings.map(n => n.y + n.height));
      node.x = Math.round(figma.viewport.center.x - node.width/2);
      node.y = Math.round(bottomY + 40);
    } else {
      node.x = Math.round(figma.viewport.center.x - node.width/2);
      node.y = Math.round(figma.viewport.center.y - node.height/2);
    }

    // Focus + select
    figma.currentPage.selection = [node];
    figma.viewport.scrollAndZoomIntoView([node]);

    figma.ui.postMessage({type:"inserted"});
    return;
  }
  if (msg.type === "close") {
    figma.closePlugin();
  }
};
