#!/usr/bin/env python3
"""Cafe24 field-level catalog generator.

Cafe24 공식 Admin API Documentation 의 **렌더링된 전체 페이지 HTML** 한 파일을 결정적으로
파싱해 `<resource>/<entity>.md` (field-level 상세 카탈로그) 222개를 재생성하고, top-level
`<resource>.md` index 의 `## Field-level 상세 카탈로그` 링크 섹션을 갱신한다.

정책·산출물 설명: `_overview.md §7`. 추측·날조 금지 — docs HTML 에 있는 것만 옮긴다.

사용법:
    python3 _generator.py /path/to/cafe24-admin-api-docs.html

HTML 확보 방법: developers.cafe24.com 의 Admin API Documentation 전체 페이지를 브라우저에서
"다른 이름으로 저장"(렌더링 완료 상태) → JS SPA 가 정적 HTML 로 고정된 파일. (WebFetch 로는
빈 HTML 만 나오므로 불가.)

HTML 구조 가정 (docs 개정으로 깨지면 본 셀렉터를 갱신):
  <h1>=resource, <section class="endpoint title">의 <h2 id>=entity(+설명 <p>),
  code-data endpoint-list 의 <a ... data-resource><span class="method GET">=operation,
  property-list 테이블=응답 속성, 기본스펙(SCOPE/호출제한)·요청사양 테이블=요청 파라미터.
  복합 필드: <div class="card child-attr">…<div class=card-body><p><strong>child</strong>…
  재귀 구조(balanced-div 매칭). field 명 공백은 <wbr> 주입(제거), Required 는
  <strong class=inner-mark>Required</strong>, 타입은 <span class=text-muted> <i>Array</i></span>.
"""
import re, html, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))

def clean(t):
    t=re.sub(r"</?wbr[^>]*>","",t)
    t=re.sub(r"<br\s*/?>","\n",t)
    t=re.sub(r"<[^>]+>","",t)
    t=html.unescape(t)
    t=re.sub(r"[ \t]+"," ",t)
    return "\n".join(ln.strip() for ln in t.split("\n")).strip()
def oneline(t): return re.sub(r"\s+"," ",clean(t)).strip()
def oneline_multi(t):
    s=clean(t); s=re.sub(r"\n+"," · ",s); s=re.sub(r"\s+"," ",s); return s.strip()
def mdcell(s): return (s or "").replace("|","\\|")

BADGES={"cafe24","youtube"}
KNOWN=["Store","Product","Order","Customer","Community","Design","Promotion","Application",
       "Category","Collection","Supply","Shipping","Salesreport","Personal","Privacy",
       "Mileage","Notification","Translation"]
REQ_MARK=re.compile(r'<strong class=inner-mark>\s*Required\s*</strong>')
INNER=re.compile(r'<strong class=inner-mark>(.*?)</strong>', re.S)
DOCS_BASE="https://developers.cafe24.com/docs/ko/api/admin/#"

def parse_atom(h):
    h=re.split(r'<div class="card child-attr', h, maxsplit=1)[0]
    required=bool(REQ_MARK.search(h))
    notes=[clean(x) for x in INNER.findall(h) if 'Required' not in x and clean(x)]
    types=[clean(x) for x in re.findall(r'<span class=text-muted>\s*<i>(.*?)</i>', h, re.S) if clean(x)]
    h2=re.sub(r'<strong class=inner-mark>.*?</strong>','',h, flags=re.S)
    mname=re.search(r'<strong>(.*?)</strong>', h2, re.S)
    name=clean(mname.group(1)) if mname else clean(re.split(r'<br|<p|<em|<span', h2)[0])
    cons=types+[clean(x) for x in re.findall(r'<em[^>]*>(.*?)</em>', h2, re.S) if clean(x)]
    return name, required, cons, (" / ".join(notes) if notes else None)

def atom_desc(pblock):
    h=re.split(r'<div class="card child-attr', pblock, maxsplit=1)[0]
    h=re.sub(r'<strong class=inner-mark>.*?</strong>','',h, flags=re.S)
    h=re.sub(r'<strong>.*?</strong>','',h, flags=re.S)
    h=re.sub(r'<em[^>]*>.*?</em>','',h, flags=re.S)
    h=re.sub(r'<span class=text-muted>.*?</span>','',h, flags=re.S)
    return oneline_multi(h)

def balanced_div(s, start):
    depth=0
    for m in re.finditer(r'<div\b|</div>', s[start:]):
        if m.group()=='</div>':
            depth-=1
            if depth==0: return start+m.end()
        else: depth+=1
    return len(s)

def parse_cardbody(inner, depth, out):
    pos=0
    while pos < len(inner):
        m=re.search(r'<p>|<div class="card child-attr', inner[pos:])
        if not m: break
        at=pos+m.start()
        if inner[at:at+3]=='<p>':
            end=inner.find('</p>', at); end=end+4 if end!=-1 else len(inner)
            pblock=inner[at:end]
            name,req,cons,note=parse_atom(pblock)
            if name: out.append(dict(name=name,required=req,constraints=cons,note=note,desc=atom_desc(pblock),depth=depth))
            pos=end
        else:
            divend=balanced_div(inner, at); block=inner[at:divend]
            cbm=re.search(r'<div class=card-body>', block)
            if cbm:
                cend=balanced_div(block, cbm.start())
                parse_cardbody(block[cbm.end():cend-6], depth+1, out)
            pos=divend

def parse_field_cell(td):
    parent_html=re.split(r'<button[^>]*data-toggle=collapse', td, maxsplit=1)[0]
    pn,pr,pc,pnote=parse_atom(parent_html)
    rows=[dict(name=pn,required=pr,constraints=pc,note=pnote,desc=None,depth=0)] if pn else []
    m=re.search(r'<div class="card child-attr">', td)
    if m:
        block=td[m.start():balanced_div(td, m.start())]
        cbm=re.search(r'<div class=card-body>', block)
        if cbm:
            cend=balanced_div(block, cbm.start())
            parse_cardbody(block[cbm.end():cend-6], 1, rows)
    return rows

def parse_desc_cell(td):
    default=None
    m=re.search(r'<span class="badge[^"]*">\s*DEFAULT\s*</span>\s*([^<]+)', td)
    if m: default=clean(m.group(1))
    return oneline_multi(re.split(r'<span class="badge', td)[0]), default

def parse_table(tbl):
    ths=[oneline(x) for x in re.findall(r"<th[^>]*>(.*?)</th>", tbl, re.S)]
    rows=[re.findall(r"<td[^>]*>(.*?)</td>", r, re.S) for r in re.findall(r"<tr[^>]*>(.*?)</tr>", tbl, re.S)]
    return ths, [r for r in rows if r]

def strip_title(t):
    w=t.split()
    while w and w[-1] in BADGES: w.pop()
    return " ".join(w).strip()

def build_tree(data):
    ep_map={}
    for m in re.finditer(r'<a href="#([^"]+)"[^>]*data-resource="([^"]*)"[^>]*>\s*<span class="method (GET|POST|PUT|DELETE)">\3</span>\s*([^<]+)', data):
        ep_map[m.group(1)]=dict(method=m.group(3), path=m.group(4).strip(), platforms=m.group(2))
    h1s=[(m.start(), clean(m.group(1))) for m in re.finditer(r"<h1[^>]*>(.*?)</h1>", data, re.S)]
    ranges=[]
    for i,(pos,name) in enumerate(h1s):
        end=h1s[i+1][0] if i+1<len(h1s) else len(data)
        if name in KNOWN: ranges.append((name,pos,end))
    tree={}
    for rname,rpos,rend in ranges:
        body=data[rpos:rend]; toks=[]
        for m in re.finditer(r'<h2 id=([^ >]+)[^>]*>(.*?)</h2>', body, re.S):
            toks.append((m.start(),'h2',m.group(1).strip('"'),oneline(m.group(2)),m.end()))
        for m in re.finditer(r'<h3 id=([^ >]+)[^>]*>(.*?)</h3>', body, re.S):
            toks.append((m.start(),'h3',m.group(1).strip('"'),oneline(m.group(2)),m.end()))
        for m in re.finditer(r'<table[^>]*>(.*?)</table>', body, re.S):
            toks.append((m.start(),'table',None,m.group(1),m.end()))
        toks.sort()
        entities=[]; cur=None; curop=None
        for pos,kind,tid,text,end in toks:
            if kind=='h2':
                cur=dict(id=tid,name=text.strip(),desc='',props=[],ops=[])
                # entity 설명 <p> 는 h2 를 감싼 description <div> 안(첫 </div> 이전)에만 있다.
                # 그 범위로 한정하지 않으면 설명 없는 entity 에서 뒤따르는 필드 셀 <p>(예: shop_no
                # "멀티쇼핑몰 번호")를 잘못 집어 entity 설명으로 오기입한다.
                intro=body[end:].split('</div>', 1)[0]
                mp=re.search(r'<p>(.*?)</p>', intro, re.S)
                if mp: cur['desc']=oneline_multi(mp.group(1))
                entities.append(cur); curop=None
            elif kind=='h3':
                if cur is None: continue
                if tid in ep_map:
                    curop=dict(anchor=tid,title=strip_title(text),scope=None,scope_full=None,spec={},params=[],**ep_map[tid])
                    cur['ops'].append(curop)
                elif text.lower().endswith('property list'): curop='PROP'
                else: curop=None
            elif kind=='table':
                ths,rows=parse_table(text)
                if curop=='PROP' and cur is not None:
                    for tds in rows:
                        if not tds: continue
                        pdesc=oneline_multi(tds[1]) if len(tds)>1 else ''
                        for fr in parse_field_cell(tds[0]):
                            cur['props'].append(dict(name=fr['name'],constraints=fr['constraints'],note=fr['note'],
                                                     desc=(pdesc if fr['depth']==0 else fr['desc']),depth=fr['depth'],required=fr['required']))
                elif isinstance(curop,dict):
                    if ths and ths[0].lower().startswith('property'):
                        for tds in rows:
                            k=oneline(tds[0]); v=oneline(tds[1]) if len(tds)>1 else ''
                            curop['spec'][k]=v
                            sm=re.search(r'mall\.((read|write)_\w+)', v)
                            if sm: curop['scope']=sm.group(2); curop['scope_full']=sm.group(1)
                    elif ths and ths[0].lower().startswith('parameter'):
                        for tds in rows:
                            pdesc,default=parse_desc_cell(tds[1]) if len(tds)>1 else ('',None)
                            for fr in parse_field_cell(tds[0]):
                                curop['params'].append(dict(name=fr['name'],required=fr['required'],constraints=fr['constraints'],
                                                            note=fr['note'],desc=(pdesc if fr['depth']==0 else fr['desc']),
                                                            default=(default if fr['depth']==0 else None),depth=fr['depth']))
        tree[rname]=entities
    return tree

def nm(name,depth): return ("↳ "*depth)+f"`{name}`"
def cons_cell(constraints,note):
    parts=list(constraints)
    if note: parts.append(f"_{note}_")
    return mdcell("; ".join(parts))

def render_entity(rname, e):
    rl=rname.lower(); anchor=e['id'].replace('_','-')
    L=["---",f"resource: {rl}",f"entity: {e['id']}",f"cafe24_docs: {DOCS_BASE}{anchor}",
       "source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03","---","",
       f"# Cafe24 API — {rname} / {e['name']}","",
       f"> Field-level 카탈로그. Endpoint enumeration index: [`../{rl}.md`](../{rl}.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [{e['name']}]({DOCS_BASE}{anchor})",
       "> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다."]
    if e['desc']: L += ["", e['desc']]
    if e['props']:
        L += ["","## 응답 속성 (Property list)","","| Attribute | 제약 | 설명 |","|---|---|---|"]
        for p in e['props']:
            L.append(f"| {nm(p['name'],p['depth'])} | {cons_cell(p['constraints'],p['note'])} | {mdcell(p['desc'])} |")
    if e['ops']:
        L += ["","## Operations"]
        for o in e['ops']:
            L += ["",f"### `{o['method']} {o['path']}` — {o['title']}",""]
            L.append(f"- **Scope**: " + (f"`mall.{o['scope_full']}` ({o['scope']})" if o['scope_full'] else "—"))
            for k,v in o['spec'].items():
                if 'SCOPE' not in k.upper(): L.append(f"- **{k}**: {v}")
            L.append(f"- **Platform**: {o['platforms']}")
            L.append(f"- **Docs**: {DOCS_BASE}{o['anchor']}")
            if o['params']:
                L += ["","#### 요청 파라미터 (Request)","","| Parameter | 필수 | 제약 | 기본값 | 설명 |","|---|---|---|---|---|"]
                for p in o['params']:
                    L.append(f"| {nm(p['name'],p['depth'])} | {'✓' if p['required'] else ''} | {cons_cell(p['constraints'],p['note'])} | {mdcell(p['default'])} | {mdcell(p['desc'])} |")
            else:
                L += ["","_요청 파라미터 없음._"]
    return "\n".join(L)+"\n"

INDEX_MARK="## Field-level 상세 카탈로그"
def refresh_index(rl, ents):
    path=os.path.join(HERE,f"{rl}.md")
    if not os.path.exists(path): return
    raw=open(path,encoding="utf-8").read()
    if INDEX_MARK in raw: raw=raw[:raw.index(INDEX_MARK)].rstrip()+"\n"
    L=["",INDEX_MARK,"",
       "> 각 sub-resource 의 **응답 속성(field) + operation 요청 파라미터**를 Cafe24 공식 docs 기준으로 담은 상세 카탈로그. 위 표가 endpoint enumeration index 라면, 아래는 field-level 본문이다. 출처: Cafe24 REST API Documentation (admin), 2026-06-03 download.",""]
    for e in sorted(ents, key=lambda x:x['name'].lower()):
        meta=[]
        nfields=len([p for p in e['props'] if p['depth']==0])
        if nfields: meta.append(f"{nfields} fields")
        if e['ops']: meta.append(f"{len(e['ops'])} ops")
        L.append(f"- [`{rl}/{e['id']}.md`](./{rl}/{e['id']}.md) · {e['name']}"+(f" — {', '.join(meta)}" if meta else ""))
    L.append("")
    open(path,"w",encoding="utf-8").write(raw.rstrip()+"\n"+"\n".join(L))

def main():
    if len(sys.argv)<2:
        sys.exit("usage: python3 _generator.py <cafe24-admin-api-docs.html>")
    data=open(sys.argv[1],encoding="utf-8").read()
    tree=build_tree(data)
    written=0
    for rname,ents in tree.items():
        rl=rname.lower(); d=os.path.join(HERE,rl); os.makedirs(d,exist_ok=True)
        for e in ents:
            open(os.path.join(d,f"{e['id']}.md"),"w",encoding="utf-8").write(render_entity(rname,e))
            written+=1
        refresh_index(rl, ents)
    ne=sum(len(v) for v in tree.values())
    print(f"resources={len(tree)} entities={ne} files_written={written}")

if __name__=="__main__":
    main()
