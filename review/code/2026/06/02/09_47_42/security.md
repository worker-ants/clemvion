# 보안(Security) 리뷰 결과

## 발견사항

### 발견사항 1
- **[WARNING]** `dangerouslySetInnerHTML` 사용 — DOMPurify 의존 신뢰
  - 위치: `codebase/channel-web-chat/src/widget/components/presentations.tsx` — `TemplateView` 함수
  - 상세: `dangerouslySetInnerHTML={{ __html: safeHtml }}` 를 사용한다. `safeHtml` 은 `DOMPurify.sanitize()` 출력값이므로 정상 경로에서는 안전하다. 그러나 DOMPurify 가 올바르게 초기화되지 않거나(window 미가용 등) `null` 이 아닌 빈 문자열을 반환하는 에지케이스, 혹은 향후 라이브러리 업그레이드에서 새로운 bypass 가 발견될 경우 XSS 위험이 잔존한다. `safeHtml !== null` 체크만 있고 빈 문자열 여부 확인이 없다.
  - 제안: 현재 구현은 업계 표준 접근법이라 전면 교체는 불필요하나, `safeHtml !== null && safeHtml.length > 0` 조건 추가 및 DOMPurify 버전을 lockfile 에 정확히 고정(`^3.4.7` → `3.4.7`)하여 패치 시 명시적 검토가 이루어지도록 할 것.

### 발견사항 2
- **[WARNING]** `marked` 라이브러리 — 파싱 결과가 DOMPurify 전에 구성됨
  - 위치: `codebase/channel-web-chat/src/lib/safe-html.ts` — `renderTemplateHtml` 함수
  - 상세: `marked.parse(rendered, { async: false })` 의 출력은 DOMPurify 호출 전 메모리에 raw HTML 로 존재한다. marked 자체는 sanitize 를 수행하지 않으며, 악의적 Markdown 입력이 XSS payload 를 가진 HTML 을 생성할 수 있다. 그 이후 DOMPurify 가 이를 제거하므로 결과적으로 안전하지만, `marked` 의 알려지지 않은 파싱 버그(예: prototype pollution, 예외적 토큰 처리)가 DOMPurify 를 우회할 가능성을 완전히 배제할 수 없다. 또한 `marked@18.0.4` 는 비교적 최신 메이저 버전이므로 알려진 CVE 가 있는지 주기적 확인이 필요하다.
  - 제안: marked 옵션에 `{ gfm: true, breaks: false }` 처럼 필요 최소 기능만 명시 활성화하여 attack surface 를 줄일 것. `npm audit` 을 CI 에 포함하여 marked/dompurify 취약점을 자동 감지할 것.

### 발견사항 3
- **[WARNING]** `isSafeUrl` — 불완전한 URL 스킴 차단 (blob: 스킴 누락)
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts` — `isSafeUrl` 함수
  - 상세: `javascript:`, `data:`, `vbscript:` 는 차단하지만 `blob:` 스킴이 명시적으로 차단되지 않는다. `blob:` URL 은 브라우저에서 로컬로 생성된 객체 URL 이며 악의적 blob content 를 실행시키는 데 활용될 수 있다. 또한 `file:` 스킴도 차단 목록에 없다.
  - 제안: `isSafeUrl` 에 `blob:` 과 `file:` 스킴 차단 추가:
    ```ts
    if (lower.startsWith("blob:") || lower.startsWith("file:")) return false;
    ```

### 발견사항 4
- **[WARNING]** DOMPurify `hookInstalled` — 모듈 전역 단일 인스턴스 가정
  - 위치: `codebase/channel-web-chat/src/lib/safe-html.ts` — `hookInstalled` 변수 및 `ensureLinkHook`
  - 상세: `hookInstalled` 는 모듈 레벨 변수다. DOMPurify 는 싱글턴이므로 한 번만 hook 을 등록해야 한다는 의도는 올바르다. 그러나 테스트 환경(jsdom)에서 모듈 캐시가 공유되면, 한 테스트에서 `hookInstalled = true` 로 설정된 후 다른 테스트에서 hook 등록이 재실행되지 않아 테스트 격리 문제가 발생할 수 있다. 더 중요하게는, 향후 누군가가 `DOMPurify.removeHook()` 또는 `DOMPurify.removeAllHooks()` 를 호출했을 때 링크 보안 hook 이 조용히 제거되어도 `hookInstalled` 는 `true` 로 남아있게 된다.
  - 제안: 현재 설계가 실용적이나, hook 제거 방어를 위해 `DOMPurify.isSupported` 및 hook 등록 여부를 외부에서 테스트할 수 있도록 export 하거나, 단순히 hook 을 매번 안전하게 덮어쓰는 방식(멱등성 보장)을 고려할 것.

### 발견사항 5
- **[INFO]** `USE_PROFILES: { html: true }` — 기본 허용 태그 범위 확인 필요
  - 위치: `codebase/channel-web-chat/src/lib/safe-html.ts` — `DOMPurify.sanitize()` 옵션
  - 상세: `USE_PROFILES: { html: true }` 는 DOMPurify 의 HTML 프로파일을 사용하는 것으로, 광범위한 HTML 태그를 허용한다. `FORBID_TAGS` 로 `style`, `form`, `input`, `button`, `textarea`, `select` 를 명시적으로 차단하고 있으나 `object`, `embed`, `applet`, `base`, `meta`, `link`(HTML link 요소) 등 추가로 위험할 수 있는 태그들이 DOMPurify 기본 정책에 의존하고 있다. DOMPurify 기본 설정은 이들을 차단하므로 현재는 안전하지만 구성 의도를 명시하는 것이 좋다.
  - 제안: 화이트리스트 방식(`ALLOWED_TAGS`, `ALLOWED_ATTR`)으로 전환하여 위젯에서 실제로 필요한 태그만 허용하는 것을 고려할 것. 임베드 위젯 특성상 표현적 태그(p, ul, ol, li, h1-h6, strong, em, a, img, table, th, td, tr, code, pre, blockquote) 정도로 제한 가능하다.

### 발견사항 6
- **[INFO]** `cellText` — `JSON.stringify` 를 통한 임의 객체 문자열화 (정보 노출 주의)
  - 위치: `codebase/channel-web-chat/src/widget/components/presentations.tsx` — `cellText` 함수
  - 상세: `cellText` 는 객체 타입 값을 `JSON.stringify` 로 변환한다. 테이블 셀로 렌더되므로 React 의 기본 이스케이핑이 적용되어 XSS 위험은 없다. 그러나 서버 응답에 민감한 내부 구조(API 키, 토큰 등)가 포함된 nested object 가 rows 에 포함될 경우 사용자 화면에 노출된다.
  - 제안: 현재 설계 범위에서 허용 가능하나, 렌더 전 rows 데이터의 출처(백엔드 신뢰)가 보장되어야 함을 문서화할 것.

### 발견사항 7
- **[INFO]** `marked` 버전 — `^18.0.4` 범위 지정 (공급망 보안 관점)
  - 위치: `codebase/channel-web-chat/package.json`
  - 상세: `^18.0.4` 는 18.x.x 의 마이너/패치 업그레이드를 자동 허용한다. DOMPurify(`^3.4.7` 동일)의 경우도 마찬가지. lockfile 이 있으므로 npm install 시 버전이 고정되지만 lockfile 업데이트 시(dependabot, `npm update`)에는 자동으로 최신 마이너/패치로 올라갈 수 있다.
  - 제안: CI 에 `npm audit --audit-level=moderate` 를 추가하여 신규 CVE 를 자동 탐지할 것.

---

## 요약

이번 변경은 템플릿 풍부 렌더(DOMPurify + marked 도입)와 차트 축 레이블·범례 추가가 핵심이다. 보안 관점에서 DOMPurify 를 클라이언트 사이드에서 일관되게 적용하고, `isSafeUrl` 로 URL 스킴 차단, 링크에 `noopener noreferrer` 강제, `FORBID_TAGS`/`FORBID_ATTR` 으로 위험 태그·속성 명시 차단하는 등 전반적으로 방어적 설계를 따르고 있다. 주요 잔존 위험은 두 가지다: ① `isSafeUrl` 에서 `blob:`, `file:` 스킴이 차단되지 않아 향후 이미지 src 나 버튼 URL 에 해당 스킴이 사용될 경우 누락될 수 있고, ② `USE_PROFILES: { html: true }` 는 DOMPurify 기본 허용 범위에 의존하므로 임베드 위젯 특성에 맞는 화이트리스트 방식으로 보강하면 공격 면적을 줄일 수 있다. 하드코딩된 시크릿, SQL 인젝션, 인증/인가 우회, 커맨드 인젝션, 경로 탐색 등 다른 카테고리의 취약점은 이 변경 범위 내에서 발견되지 않았다.

## 위험도

MEDIUM
