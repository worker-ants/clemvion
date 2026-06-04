#!/usr/bin/env python3
"""Cafe24 field-level catalog generator.

Cafe24 공식 Admin API Documentation 의 **렌더링된 전체 페이지 HTML** 한 파일을 결정적으로
파싱해 `<resource>/<entity>.md` (field-level 상세 카탈로그) 222개를 재생성하고, top-level
`<resource>.md` index 의 `## Field-level 상세 카탈로그` 링크 섹션을 갱신한다.

정책·산출물 설명: `_overview.md §7`. 추측·날조 금지 — docs HTML(필드) + code 엔드포인트(응답
샘플) 에 있는 것만 옮긴다.

사용법:
    python3 _generator.py /path/to/cafe24-admin-api-docs.html [옵션]
    옵션:
      --no-responses        operation 응답(Response) 샘플 fetch/주입을 생략 (HTML 만으로 생성)
      --resp-cache DIR      응답 JSON 캐시 디렉토리 (기본: <generator>/.resp-cache, gitignore 대상)
      --delay SEC           응답 fetch 간 sleep 초 (기본 2.0, rate-limit 회피)

HTML 확보 방법: developers.cafe24.com 의 Admin API Documentation 전체 페이지를 브라우저에서
"다른 이름으로 저장"(렌더링 완료 상태) → JS SPA 가 정적 HTML 로 고정된 파일. (WebFetch 로는
빈 HTML 만 나오므로 불가.)

응답(Response) 샘플 출처: 정적 HTML 의 request/response 예시는 JS 가 런타임에 별도 JSON 에서
주입하므로 저장본엔 빈 <pre> 로만 남는다. 실제 샘플은 code 엔드포인트
  https://developers.cafe24.com/docs/code/api/admin/shell/<entity_id>.json
에 operation 별로 {"<METHOD>_<Title>": {"<Title>": {"REQUEST": curl, "RESPONSE": json}}} 형태로
존재한다. URL 구성요소는 모두 HTML 에서 유도된다: host = developers.cafe24.com, base =
#doc_info[data-codepath]="/docs/code/api/admin", "shell" = lang-selector option(shell/java/
python/node/php/go 중 하나 — RESPONSE 는 언어무관), <entity_id> = data-resource(=entity id).
?v= 쿼리는 캐시버스터로 생략 가능. RESPONSE 는 언어무관이라 shell 하나만 받는다.

HTML 구조 가정 (docs 개정으로 깨지면 본 셀렉터를 갱신):
  <h1>=resource, <section class="endpoint title">의 <h2 id>=entity(+설명 <p>),
  code-data endpoint-list 의 <a ... data-resource><span class="method GET">=operation,
  property-list 테이블=응답 속성, 기본스펙(SCOPE/호출제한)·요청사양 테이블=요청 파라미터.
  복합 필드: <div class="card child-attr">…<div class=card-body><p><strong>child</strong>…
  재귀 구조(balanced-div 매칭). field 명 공백은 <wbr> 주입(제거), Required 는
  <strong class=inner-mark>Required</strong>, 타입은 <span class=text-muted> <i>Array</i></span>.
"""
import re, html, os, sys, json, time, shutil, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))

RESP_BASE = "https://developers.cafe24.com/docs/code/api/admin/shell/"

def _norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())

def _http_get(url):
    """(status_code, body_text). 환경의 TLS-intercepting proxy 와 호환되도록 curl 우선,
    없으면 urllib. status_code 는 정수(HTTP) 또는 0(네트워크 오류)."""
    if shutil.which("curl"):
        # %{http_code} 를 마지막 줄에 분리 출력
        p = subprocess.run(
            ["curl", "-sS", "-m", "30", "-A", "catalog-generator",
             "-w", "\n%{http_code}", url],
            capture_output=True, text=True)
        if p.returncode != 0:
            return 0, p.stderr.strip()
        body, _, code = p.stdout.rpartition("\n")
        try:
            return int(code), body
        except ValueError:
            return 0, p.stdout
    import urllib.request, urllib.error
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "catalog-generator"})
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as e:
        return 0, str(e)

def fetch_entity_json(entity_id, cache_dir, delay):
    """code 엔드포인트의 <entity_id>.json 을 fetch (디스크 캐시·지수 backoff). dict 또는 None."""
    os.makedirs(cache_dir, exist_ok=True)
    cache = os.path.join(cache_dir, entity_id + ".json")
    if os.path.exists(cache):
        try:
            with open(cache, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass  # 손상된 캐시는 재fetch
    url = RESP_BASE + entity_id + ".json"
    for attempt in range(6):
        code, body = _http_get(url)
        if code == 200:
            try:
                data = json.loads(body)
            except json.JSONDecodeError:
                back = delay * (2 ** attempt) + 3
                sys.stderr.write(f"  [retry {attempt+1}] {entity_id} bad JSON, sleep {back:.0f}s\n")
                time.sleep(back); continue
            with open(cache, "w", encoding="utf-8") as f:
                f.write(body)
            time.sleep(delay)  # rate-limit 회피
            return data
        if code == 404:
            return None
        back = delay * (2 ** attempt) + 3
        sys.stderr.write(f"  [retry {attempt+1}] {entity_id} HTTP/net {code}, sleep {back:.0f}s\n")
        time.sleep(back)
    sys.stderr.write(f"  [GIVE UP] {entity_id} after retries\n")
    return None

def resp_for_op(jsondata, method, title):
    """(method, title) 에 해당하는 canonical RESPONSE 문자열을 찾는다. 없으면 None.

    JSON 구조: {"<METHOD>_<canonical_title>": {"<example_title>": {"REQUEST","RESPONSE"}, ...}}.
    한 operation 키 아래 여러 예시 중 operation 제목과 일치하는 예시를 우선 채택한다."""
    if not jsondata:
        return None
    nt = _norm(title); m = method.upper()
    canon_fallback = None
    for topkey, inner in jsondata.items():
        if not isinstance(inner, dict):
            continue
        if "_" not in topkey or topkey.split("_", 1)[0].upper() != m:
            continue
        canon = topkey.split("_", 1)[1]
        # 1) operation 제목과 정확히 일치하는 예시
        for ititle, payload in inner.items():
            if isinstance(payload, dict) and _norm(ititle) == nt and payload.get("RESPONSE"):
                return payload["RESPONSE"]
        # 2) top-level canonical 키가 제목과 일치 → 그 키의 대표 예시를 fallback 으로 보관
        if _norm(canon) == nt and canon_fallback is None:
            for ititle, payload in inner.items():
                if isinstance(payload, dict) and _norm(ititle) == _norm(canon) and payload.get("RESPONSE"):
                    canon_fallback = payload["RESPONSE"]; break
            if canon_fallback is None:
                vals = [p.get("RESPONSE") for p in inner.values() if isinstance(p, dict) and p.get("RESPONSE")]
                if vals:
                    canon_fallback = vals[-1]
    return canon_fallback

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

def _json_field_seq(val, depth, out):
    """응답 JSON 을 document 순서로 (name, depth, kind) 시퀀스로 평탄화. 배열은 대표(첫) 원소만."""
    if isinstance(val, dict):
        for k, v in val.items():
            kind = 'obj' if isinstance(v, dict) else ('arr' if isinstance(v, list) else 'val')
            out.append((k, depth, kind))
            _json_field_seq(v, depth + 1, out)
    elif isinstance(val, list):
        for item in val:
            if isinstance(item, (dict, list)):
                _json_field_seq(item, depth, out); break

def resp_param_rows(resp_str, props):
    """대표 응답 샘플(JSON 문자열)에 나타난 필드를, 응답 속성(property list) 기준 제약·설명으로
    엮어 `| Parameter | 제약 | 설명 |` 표 행 리스트를 만든다. wrapper 키 등 property list 에
    없는 컨테이너는 (응답 객체)/(목록) 으로만 표기한다. 표 불가(스칼라 응답 등)면 빈 리스트."""
    try:
        data = json.loads(resp_str)
    except Exception:
        return []
    seq = []
    _json_field_seq(data, 0, seq)
    if not seq:
        return []
    by_name = {}
    for p in (props or []):
        by_name.setdefault(p['name'], p)
    rows = []
    for name, depth, kind in seq:
        p = by_name.get(name)
        cons = cons_cell(p['constraints'], p['note']) if p else ""
        if p and p.get('desc'):
            desc = mdcell(p['desc'])
        elif not p:
            desc = "(응답 객체)" if kind == 'obj' else ("(목록)" if kind == 'arr' else "")
        else:
            desc = ""
        rows.append(f"| {nm(name, depth)} | {cons} | {desc} |")
    return rows

def render_entity(rname, e, jsondata=None):
    rl=rname.lower(); anchor=e['id'].replace('_','-')
    L=["---",f"resource: {rl}",f"entity: {e['id']}",f"cafe24_docs: {DOCS_BASE}{anchor}",
       "source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json","---","",
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
            resp=resp_for_op(jsondata, o['method'], o['title'])
            if resp:
                L += ["","#### 응답 (Response)",""]
                rows=resp_param_rows(resp, e['props'])
                if rows:
                    ref=" 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준" if e['props'] else ""
                    L += [f"> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터.{ref} (`↳` = 중첩, 배열은 대표 원소).",
                          "","| Parameter | 제약 | 설명 |","|---|---|---|"]
                    L += rows
                    L += ["","응답 예시 (JSON):"]
                else:
                    L += ["> Cafe24 공식 docs 의 대표 응답 샘플."]
                L += ["","```json", resp.rstrip(), "```"]
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
    args=sys.argv[1:]
    fetch_resp=True; cache_dir=os.path.join(HERE,".resp-cache"); delay=2.0; html_path=None
    i=0
    while i<len(args):
        a=args[i]
        if a=="--no-responses": fetch_resp=False
        elif a=="--resp-cache": i+=1; cache_dir=args[i]
        elif a=="--delay": i+=1; delay=float(args[i])
        elif html_path is None: html_path=a
        i+=1
    if html_path is None:
        sys.exit("usage: python3 _generator.py <cafe24-admin-api-docs.html> [--no-responses] [--resp-cache DIR] [--delay SEC]")
    data=open(html_path,encoding="utf-8").read()
    tree=build_tree(data)
    ne=sum(len(v) for v in tree.values())
    written=0; resp_ok=0; resp_miss=[]
    seq=0
    for rname,ents in tree.items():
        rl=rname.lower(); d=os.path.join(HERE,rl); os.makedirs(d,exist_ok=True)
        for e in ents:
            seq+=1
            jsondata=None
            if fetch_resp:
                # 응답 JSON 엔드포인트는 data-resource(snake_case) 키를 쓴다. entity id 는
                # h2 anchor(hyphen) 형태이므로 hyphen→underscore 로 data-resource 를 복원.
                resource_key=e['id'].replace('-','_')
                jsondata=fetch_entity_json(resource_key, cache_dir, delay)
                if jsondata: resp_ok+=1
                else: resp_miss.append(e['id'])
                sys.stderr.write(f"[{seq}/{ne}] {rl}/{e['id']} resp={'Y' if jsondata else '-'}\n")
            open(os.path.join(d,f"{e['id']}.md"),"w",encoding="utf-8").write(render_entity(rname,e,jsondata))
            written+=1
        refresh_index(rl, ents)
    print(f"resources={len(tree)} entities={ne} files_written={written} resp_json_fetched={resp_ok}")
    if resp_miss:
        print(f"resp_json_missing({len(resp_miss)}): {', '.join(resp_miss)}")

if __name__=="__main__":
    main()
