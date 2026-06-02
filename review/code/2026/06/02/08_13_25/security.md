# 보안(Security) 리뷰 결과

## 발견사항

### [WARNING] 임베드 soft 검증의 client-side 우회 가능성
- **위치**: `codebase/channel-web-chat/src/widget/use-widget.ts` — `isEmbedAllowed()` 함수 (L46-56)
- **상세**: 임베드 allowlist 검증이 클라이언트(위젯 SPA) 측에서만 수행되며, 서버는 `enforce=true` + allowlist 불일치 시에도 실제 API 요청(`/api/hooks/:endpointPath`, SSE 연결 등)을 거부하지 않는다. 공격자가 위젯 JavaScript를 수정하거나 embed-config fetch를 건너뛰면 차단을 우회해 워크스페이스의 AI 실행을 임의 도메인에서 구동할 수 있다. spec에서 "soft 검증"으로 명문화(§3-①)하고 있으므로 설계 의도이나, 이 한계가 운영자에게 명확히 전달되지 않으면 soft 차단을 hard 보안 경계로 오인할 위험이 있다.
- **제안**: (1) 현재의 fail-open + client-side 특성을 `EmbedConfigDto` API 응답 설명 및 운영 문서에 명시한다. (2) hard 차단이 필요한 워크스페이스는 opt-in `frame-ancestors` CSP(§3-③, followup)를 통해 서버 측 강제를 별도 제공한다.

### [WARNING] link 버튼 URL에 프로토콜 검증 누락 — javascript: 스킴 삽입 가능
- **위치**: `codebase/channel-web-chat/src/widget/components/presentations.tsx` — `ButtonBar` 컴포넌트 (L70-78); `codebase/channel-web-chat/src/lib/presentation.ts` — `asButtons()` (L817-827)
- **상세**: `asButtons()`는 `url`이 string 타입인지만 확인하고 프로토콜을 검증하지 않는다. `ButtonBar`는 `b.url`을 anchor `href`에 그대로 사용한다. 워크스페이스 데이터에 `javascript:alert(1)` 또는 `data:text/html,...` 형태의 URL이 포함되면 anchor 클릭 시 XSS 또는 피싱으로 이어질 수 있다. `target="_blank"` + `rel="noopener noreferrer"`는 탭 분리를 보장하지만 javascript: 스킴 자체 실행은 막지 않는다.
- **제안**: `asButtons()`에서 URL 파싱 후 `https:` 또는 `http:` 프로토콜만 허용하도록 필터링한다:
  ```ts
  function isSafeUrl(url: unknown): url is string {
    if (typeof url !== "string") return false;
    try {
      const p = new URL(url);
      return p.protocol === "https:" || p.protocol === "http:";
    } catch { return false; }
  }
  ```
  `asButtons` 내 `url: typeof b.url === "string" ? b.url : undefined` 부분을 `url: isSafeUrl(b.url) ? b.url : undefined`로 교체한다.

### [INFO] 임베드 config 캐시(Cache-Control: max-age=300)와 실시간 설정 변경 간 지연
- **위치**: `codebase/backend/src/modules/hooks/hooks.controller.ts` — `getEmbedConfig()` L510
- **상세**: `Cache-Control: public, max-age=300`으로 응답이 CDN/브라우저에 5분간 캐시된다. 워크스페이스 운영자가 allowlist에서 도메인을 긴급 제거(차단 강화)해도 최대 5분간 구 설정이 위젯에 남아 unintended access window가 발생한다. 이는 soft 검증의 성능-보안 trade-off로 spec에서 수용한 설계이다.
- **제안**: 이 캐시 특성을 spec §3-① 또는 API 문서에 명기하고, 즉각 차단이 필요한 경우 hard `frame-ancestors` CSP(§3-③) 도입을 권고한다.

### [INFO] `detectHostOrigin` — `document.referrer` 폴백의 신뢰성 한계
- **위치**: `codebase/channel-web-chat/src/widget/use-widget.ts` — `isEmbedAllowed()` L53-54 (`detectHostOrigin` 호출)
- **상세**: `detectHostOrigin`은 `ancestorOrigins`가 없을 때 `document.referrer`로 폴백하며, referrer가 비어 있으면 fail-open(`return true`)한다. 엄격한 referrer-policy를 사용하는 사이트는 referrer를 전송하지 않아 검증이 항상 통과된다. 이는 spec 의도이나, soft 검증이 환경에 따라 실질적으로 비활성화됨을 의미한다.
- **제안**: soft 검증 한계로 문서화 수용. 강한 origin 제어가 필요한 경우 `postMessage` origin 검증 강화 또는 서버 측 CORS/CSP 보완을 안내한다.

### [INFO] `EmbedConfigService.resolve` 예외 시 allow-all 로 degrade
- **위치**: `codebase/backend/src/modules/hooks/embed-config.service.ts` — catch 블록 (L363-368)
- **상세**: DB 조회 오류 시 `{ allowlist: [], enforce: false }` (allow-all)를 반환한다. DB 장애 시 allowlist 검증이 완전히 무력화되어 원래 차단해야 할 호스트도 위젯을 로드할 수 있다. 이는 fail-open 정책으로 명시적 설계이나, DB 장애가 allowlist 우회로 연결되는 부작용을 운영자가 인식해야 한다.
- **제안**: 현재 설계 수용(위젯 가용성 우선). 운영 문서에 "DB 장애 시 allowlist 검증 비활성" 동작을 명시하고, 모니터링 알림과 연계한다.

### [INFO] 카루셀 이미지 `src` 프로토콜 검증 누락 — mixed content / tracking 픽셀
- **위치**: `codebase/channel-web-chat/src/widget/components/presentations.tsx` — `CarouselView` L108
- **상세**: `item.image`가 string 타입인지만 확인하고 프로토콜을 검증하지 않는다. HTTP 이미지 URL이 허용되면 HTTPS 페이지에서 mixed content 경고가 발생하거나, 추적 픽셀로 악용될 수 있다. 데이터가 워크스페이스 운영자 구성(준-신뢰)이므로 위험도는 제한적이다.
- **제안**: 링크 버튼과 동일한 `isSafeUrl()` 필터를 이미지 src에 적용하거나, 위젯 iframe에 CSP `img-src https:` 정책을 설정하는 것을 고려한다.

### [INFO] warn 로그에 `err.message` 서버 내부 정보 포함 가능성
- **위치**: `codebase/backend/src/modules/hooks/embed-config.service.ts` — L364
- **상세**: `logger.warn(... ${err.message})`로 에러 메시지를 서버 로그에 기록한다. DB 에러 메시지에 SQL 상세, 컬럼명, 연결 정보 등 내부 구현 세부사항이 포함될 수 있다. 그러나 이는 서버 로그(클라이언트 미노출)이므로 직접적인 정보 노출 취약점에 해당하지 않는다.
- **제안**: 로그 집계 시스템의 접근 통제를 확인할 것. 현재 수준 수용 가능.

### [INFO] CI 워크플로우 Actions 버전(@v5, @v6) 공급망 확인 권고
- **위치**: `.github/workflows/web-chat-checks.yml` — L121, L126, L145, L150
- **상세**: `actions/checkout@v5`, `actions/setup-node@v6`을 사용한다. 2026-06-02 기준 알려진 공식 최신 릴리스(checkout@v4, setup-node@v4)와 다를 수 있으며, 미래 버전 태그가 실제로 존재하는지 확인이 필요하다. 공식 GitHub Actions가 아닌 잘못된 버전을 가리킬 경우 공급망 보안 위험이 있다.
- **제안**: 실제 릴리스 태그를 확인하고, 보안에 민감한 환경에서는 커밋 SHA 고정(`uses: actions/checkout@<SHA>`) 방식을 사용한다.

## 요약

이번 변경에서 가장 주목할 보안 이슈는 두 가지다. 첫째, 임베드 allowlist soft 검증(D#3)은 클라이언트 측 JavaScript 제어에 의존하므로 JavaScript 수정이나 fetch 우회로 통과 가능하다(WARNING). 이는 spec에서 "soft"로 명문화한 의도적 설계이나, 운영자가 hard 경계로 오인할 위험이 있으므로 문서화 보완이 권고된다. 둘째, carousel/table presentation의 link 버튼 URL에 `https:`/`http:` 이외 프로토콜 필터링이 없어 `javascript:` 스킴 삽입 시 XSS 경로가 열릴 수 있다(WARNING). Template 렌더는 React 텍스트 노드로 plain text 안전 렌더가 명시적으로 구현되어 XSS가 방어되어 있다. SQL 인젝션은 TypeORM Repository 파라미터 바인딩으로 방지, 하드코딩된 시크릿 없음, 암호화 취약점 없음, 인증/인가 우회 경로 없음이 확인되었다. fail-open 정책과 캐시 지연은 설계 의도이나 운영 문서화가 필요하다.

## 위험도

MEDIUM

---

STATUS=success ISSUES=8
