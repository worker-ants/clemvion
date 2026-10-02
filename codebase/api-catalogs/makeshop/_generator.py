#!/usr/bin/env python3
"""MakeShop API Catalog generator — Docusaurus chunk decode.

메이크샵 개발자센터(`https://developer.makeshop.co.kr/docs`, Docusaurus v3 +
`docusaurus-theme-openapi-docs`)를 fetch 해 각 endpoint 의 OpenAPI 3 operation 객체를
추출하고, 섹션별 `openapi/<section>.openapi.json` 을 재생성한다. 추출 방식은
`_overview.md §1` 에 기재된 그대로다.

추출 파이프라인 (`_overview.md §1`):
  1. `/docs/sitemap.xml` 으로 `/docs/api/<section>/<op>` 페이지 목록 확보.
  2. `/docs/` HTML 에서 해시 박힌 번들명(`main.<h>.js`, `runtime~main.<h>.js`) 자동 발견.
  3. runtime 번들의 `__webpack_require__.u` 두 맵(id→name, id→contenthash)으로 chunk 파일명
     규칙을 복원하고, main 번들의 routesChunkNames(route→content chunkName)를 파싱한다.
  4. 각 operation 페이지의 content chunk(`assets/js/<name>.<hash>.js`)를 받아 그 안의
     `api:"eJ…"` 블롭을 base64 decode + zlib inflate → 단일 operation 의 OpenAPI JSON.
  5. operation 들을 섹션별로 묶어 OpenAPI 3 document 로 조립해 기록한다.

operation 객체 → catalog operation body 변환 (HTML/추측 없이 디코드 값만 사용):
  - 공통 필드 {method, path, servers, securitySchemes, info} 는 document 레벨로 끌어올리고
    operation body 에서 제거(키 순서 보존).
  - `summary` 를 끝에 추가: REST 는 `postman.name`, webhook 은 페이지 `<title>` 의 접두.
  - webhook(operationId 가 `webhook-`, method `event`)은 paths 대신 `x-webhooks[id] = {post: body}`
    로 넣고, body 끝에 `x-event-code` 추가(requestBody 의 event_code 설명 `… - CODE` 에서 추출).
  - paths / x-webhooks 의 행 순서는 operationId 정렬.

document info.title 은 편집 큐레이션 값이므로 SECTION_TITLES 로 관리한다(사이트에서 복원
불가). 미등록 섹션은 디코드된 한글 제목 + 영문 섹션명으로 합성한다.

부수 산출: openapi json 기록 후 `<section>.md` 카탈로그 표도 같은 데이터로 재생성한다
(컬럼 규칙 `_overview.md §3·§7`). `--no-md` 로 생략 가능.

사용법:
    python3 _generator.py [--check] [--no-md] [--date YYYY-MM-DD]
                          [--cache DIR] [--delay SEC] [<section> ...]
      <section>     특정 섹션만 (기본: 사이트의 모든 /docs/api/<section>)
      --check       파일을 쓰지 않고 현재 openapi/*.json(및 md)와 비교 (차이 시 exit 1)
      --no-md       <section>.md 표 재생성 생략
      --date        info.x-extracted 에 박을 추출일 (기본: 오늘)
      --cache DIR   chunk/페이지 디스크 캐시 (기본: <generator>/.chunk-cache, gitignore)
      --delay SEC   네트워크 요청 간 sleep 초 (기본 0.3)
"""
import re, os, sys, json, time, base64, zlib, subprocess, datetime, urllib.parse, collections

HERE = os.path.dirname(os.path.abspath(__file__))
HOST = "https://developer.makeshop.co.kr"
DOCS = HOST + "/docs"
OPENAPI_VERSION = "3.0.3"
DROP = ("method", "path", "servers", "securitySchemes", "info")

# document info.title 은 큐레이션 값(사이트 복원 불가). 신규 섹션은 합성으로 대체.
SECTION_TITLES = {
    "benefit": "Makeshop Shop API — 혜택 (Benefit)",
    "board":   "Makeshop Shop API — 게시판 (Board)",
    "cpik":    "Makeshop Shop API — CPIK (외부연동: 장바구니·회원·주문·webhook)",
    "member":  "Makeshop Shop API — 회원 (Member)",
    "order":   "Makeshop Shop API — 주문 (Order)",
    "product": "Makeshop Shop API — 상품 (Product)",
    "shop":    "Makeshop Shop API — 상점 설정 (Shop)",
}


# ---- HTTP (curl 우선 — 환경의 TLS-intercepting proxy 호환, cafe24 _generator.py 와 동일) ----
def http_get(url):
    p = subprocess.run(["curl", "-sSL", "-m", "30", "-A", "Mozilla/5.0", url],
                       capture_output=True, text=True)
    return p.stdout if p.returncode == 0 else ""


def cached_get(url, cache_dir, key, delay):
    os.makedirs(cache_dir, exist_ok=True)
    path = os.path.join(cache_dir, key)
    if os.path.exists(path):
        return open(path, encoding="utf-8").read()
    body = http_get(url)
    if body:
        open(path, "w", encoding="utf-8").write(body)
        time.sleep(delay)
    return body


# ---- 번들 파싱 ----
def _balanced(s, start):
    depth = 0
    for j in range(start, len(s)):
        if s[j] == "{":
            depth += 1
        elif s[j] == "}":
            depth -= 1
            if depth == 0:
                return j
    return len(s)


def parse_runtime(runtime):
    """__webpack_require__.u 의 두 맵(id→name, id→hash)에서 name→hash 를 만든다."""
    i = runtime.find(".u=")
    b1 = runtime.find("{", i); e1 = _balanced(runtime, b1)
    b2 = runtime.find("{", e1); e2 = _balanced(runtime, b2)
    id2name = {int(a): b for a, b in re.findall(r'(\d+):"([^"]+)"', runtime[b1:e1 + 1])}
    id2hash = {int(a): b for a, b in re.findall(r'(\d+):"([^"]+)"', runtime[b2:e2 + 1])}
    return {id2name[c]: id2hash[c] for c in id2name if c in id2hash}


def parse_routes(main):
    """routesChunkNames: route path → content chunkName.

    키는 `<route>-<suffix>` 형태라 마지막 `-` 토큰을 떼어 route 로 복원한다."""
    r2c = {}
    for key, content in re.findall(r'"(/docs/api/[^"]+)":\{[^{}]*?"content":"([0-9a-f]+)"', main):
        r2c[key.rsplit("-", 1)[0]] = content
    return r2c


def sitemap_routes():
    sm = http_get(DOCS + "/sitemap.xml")
    routes = []
    for loc in re.findall(r"<loc>([^<]+)</loc>", sm):
        loc = urllib.parse.unquote(loc).rstrip("/")
        if "/docs/api/" in loc:
            routes.append(loc[len(HOST):])
    return routes


# ---- operation 디코드 ----
def decode_api(route, r2c, name2hash, cache_dir, delay):
    content = r2c.get(route)
    if not content:
        return None
    h = name2hash.get(content)
    if not h:
        return None
    url = f"{DOCS}/assets/js/{content}.{h}.js"
    js = cached_get(url, cache_dir, content + ".js", delay)
    m = re.search(r'(?:"api"|\bapi):"(eJ[A-Za-z0-9+/=]+)"', js)
    if not m:
        return None
    raw = zlib.decompress(base64.b64decode(m.group(1)))
    return json.loads(raw, object_pairs_hook=collections.OrderedDict)


def page_title(route, cache_dir, delay):
    html = cached_get(HOST + route, cache_dir, "page" + route.replace("/", "_") + ".html", delay)
    m = re.search(r"<title[^>]*>([^<]*)</title>", html)
    return m.group(1).split(" | ")[0].strip() if m else ""


def event_code(api):
    """requestBody 의 event_code 설명에서 코드 토큰을 뽑는다.

    설명은 보통 "이벤트 코드 - CATEGORY_CHANGE" 지만, 부가 코드("… PRODUCT_ADD\\n\\n상품 수정 -
    PRODUCT_UPDATE")나 꼬리 기호("PRODUCT_STATUS)")가 붙기도 한다 → 첫 대문자 코드 토큰만 취한다."""
    try:
        props = api["requestBody"]["content"]["application/json"]["schema"]["properties"]
        d = props["event_code"]["description"]
        m = re.search(r"[A-Z][A-Z0-9_]{2,}", d)
        return m.group(0) if m else d.strip()
    except Exception:
        return ""


def is_webhook(api):
    return api.get("method") == "event" or str(api.get("operationId", "")).startswith("webhook-")


def op_body(api, route, cache_dir, delay):
    """디코드된 operation → catalog operation body (공통 필드 제거 + summary[+x-event-code])."""
    body = collections.OrderedDict((k, v) for k, v in api.items() if k not in DROP)
    if is_webhook(api):
        body["summary"] = page_title(route, cache_dir, delay)
        body["x-event-code"] = event_code(api)
    else:
        pm = api.get("postman") or {}
        body["summary"] = pm.get("name") or page_title(route, cache_dir, delay)
    return body


# ---- document 조립 ----
def build_doc(section, ops, date):
    """ops: [(route, api), …] (한 섹션). OpenAPI 3 document(OrderedDict) 반환."""
    first = ops[0][1]
    doc = collections.OrderedDict()
    doc["openapi"] = OPENAPI_VERSION
    doc["info"] = collections.OrderedDict([
        ("title", SECTION_TITLES.get(section) or synth_title(section, first)),
        ("version", "v1"),
        ("x-source", f"{DOCS}/api/{section}"),
        ("x-extracted", f"{date} (Docusaurus chunk decode)"),
    ])
    doc["servers"] = first.get("servers")
    doc["security"] = first.get("security")
    doc["components"] = collections.OrderedDict(
        [("securitySchemes", first.get("securitySchemes"))])
    paths = collections.OrderedDict()
    webhooks = collections.OrderedDict()
    for route, api in sorted(ops, key=lambda ra: ra[1].get("operationId", "")):
        body = op_body(api, route, _CACHE["dir"], _CACHE["delay"])
        if is_webhook(api):
            webhooks[api["operationId"]] = collections.OrderedDict([("post", body)])
        else:
            paths.setdefault(api["path"], collections.OrderedDict())[api["method"]] = body
    doc["paths"] = paths
    if webhooks:
        doc["x-webhooks"] = webhooks
    return doc


def synth_title(section, api):
    korean = api.get("info", {}).get("title", "").split(" - ")[-1].strip() or section
    return f"Makeshop Shop API — {korean} ({section.capitalize()})"


_CACHE = {"dir": os.path.join(HERE, ".chunk-cache"), "delay": 0.3}


# ---- 부수: <section>.md 카탈로그 표 (컬럼 규칙 _overview.md §3·§7) ----
def md_for(section, doc):
    base = doc["info"]["x-source"]

    def docs_url(oid):
        return f"{base.rstrip('/')}/{oid.replace('_', '-')}"

    def cell(s):
        return (s or "").replace("|", "\\|").strip()

    rest = []
    for path, methods in doc["paths"].items():
        rel = re.sub(r"^/api/v1/\{shopId\}/", "", path)
        for method, op in methods.items():
            m = method.upper()
            scope = "read" if m == "GET" else "write"
            pnames = {p.get("name") for p in op.get("parameters", [])}
            pag = "✓" if {"page", "limit"} <= pnames else ""
            rest.append((op["operationId"], op.get("summary", ""), m, rel, scope, pag))
    rest.sort(key=lambda o: o[0])

    display = doc["info"]["title"].split(" — ", 1)[1] if " — " in doc["info"]["title"] else section
    L = [f"---\nid: makeshop-{section}\n---", "",
         f"# Makeshop API Catalog — {display}", "",
         f"> 상위: [`_overview.md`](./_overview.md) · 전체 스키마(요청/응답 필드): "
         f"[`openapi/{section}.openapi.json`](./openapi/{section}.openapi.json)", "",
         "공통 prefix `/api/v1/{shopId}/` 는 `path` 컬럼에서 생략. 인증 `bearerAuth`. "
         "본 표는 메이크샵 공식 문서에서 자동 추출했다.", "",
         f"## REST endpoints ({len(rest)})", "",
         "| id | 라벨 (한) | method | path | scope | paginated | status | docs |",
         "|----|-----------|--------|------|-------|-----------|--------|------|"]
    for oid, label, m, rel, scope, pag in rest:
        L.append(f"| `{oid}` | {cell(label)} | {m} | `{rel}` | {scope} | {pag} | "
                 f"supported | [↗]({docs_url(oid)}) |")
    wh = doc.get("x-webhooks") or {}
    if wh:
        L += ["", f"## Webhook events ({len(wh)})", "",
              "> `method: event` — REST 호출이 아니라 **이벤트 수신(trigger) 정의**. "
              "payload 스키마는 openapi json 의 `x-webhooks` 참고.", "",
              "| id | 라벨 (한) | event_code | docs |",
              "|----|-----------|-----------|------|"]
        for wid in sorted(wh):
            post = wh[wid]["post"]
            L.append(f"| `{wid}` | {cell(post.get('summary'))} | "
                     f"`{post.get('x-event-code', '')}` | [↗]({docs_url(wid)}) |")
    return "\n".join(L) + "\n"


def dumps(doc):
    return json.dumps(doc, ensure_ascii=False, indent=2)


def main():
    args = sys.argv[1:]
    check = "--check" in args
    no_md = "--no-md" in args
    date = datetime.date.today().isoformat()
    if "--date" in args:
        date = args[args.index("--date") + 1]
    if "--cache" in args:
        _CACHE["dir"] = args[args.index("--cache") + 1]
    if "--delay" in args:
        _CACHE["delay"] = float(args[args.index("--delay") + 1])
    flags_with_val = {"--date", "--cache", "--delay"}
    only = [a for i, a in enumerate(args)
            if not a.startswith("--") and (i == 0 or args[i - 1] not in flags_with_val)]

    print("· fetching bundles & sitemap …", file=sys.stderr)
    index = http_get(DOCS + "/")
    mnames = re.findall(r"/docs/assets/js/(main\.[0-9a-f]+\.js)", index)
    rnames = re.findall(r"/docs/assets/js/(runtime~main\.[0-9a-f]+\.js)", index)
    if not mnames or not rnames:
        sys.exit("could not find main/runtime bundle names in /docs/ HTML")
    main_js = http_get(f"{DOCS}/assets/js/{mnames[0]}")
    runtime_js = http_get(f"{DOCS}/assets/js/{rnames[0]}")
    name2hash = parse_runtime(runtime_js)
    r2c = parse_routes(main_js)

    routes = sitemap_routes()
    sections = collections.OrderedDict()
    for route in routes:
        section = route.split("/docs/api/", 1)[1].split("/", 1)[0]
        if only and section not in only:
            continue
        api = decode_api(route, r2c, name2hash, _CACHE["dir"], _CACHE["delay"])
        if not api or "method" not in api or "operationId" not in api:
            continue  # 카테고리/사이드바 페이지 등 (operation 아님)
        sections.setdefault(section, []).append((route, api))

    diffs = 0
    for section, ops in sections.items():
        doc = build_doc(section, ops, date)
        nrest = sum(len(m) for m in doc["paths"].values())
        nwh = len(doc.get("x-webhooks") or {})
        targets = [(os.path.join(HERE, "openapi", f"{section}.openapi.json"), dumps(doc))]
        if not no_md:
            targets.append((os.path.join(HERE, f"{section}.md"), md_for(section, doc)))
        for path, content in targets:
            label = os.path.relpath(path, HERE)
            if check:
                old = open(path, encoding="utf-8").read() if os.path.exists(path) else None
                state = "OK" if content == old else ("DIFF" if old is not None else "NEW")
                if state != "OK":
                    diffs += 1
                print(f"[check] {label}: {state}")
            else:
                os.makedirs(os.path.dirname(path), exist_ok=True)
                open(path, "w", encoding="utf-8").write(content)
                print(f"wrote {label}")
        print(f"  └ {section}: rest={nrest} webhook={nwh}", file=sys.stderr)

    if check and diffs:
        sys.exit(f"{diffs} file(s) differ from generated output")


if __name__ == "__main__":
    main()
