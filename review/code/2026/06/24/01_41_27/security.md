# 보안(Security) 리뷰 결과

## 발견사항

### 파일 1: codebase/frontend/e2e/web-chat/console.spec.ts

- **[INFO]** 테스트용 하드코딩 자격증명 — 테스트 픽스처 범위, 프로덕션 무영향
  - 위치: 라인 60 (`const ACCESS = "mock-access-token"`)
  - 상세: `mock-access-token`, `alice@example.com` 등 하드코딩 값이 있으나 Playwright e2e mock API 테스트 전용 픽스처이며 실 자격증명이 아니다. `localhost` 도메인 고정 쿠키도 동일 맥락.
  - 제안: 테스트 파일 내부이므로 조치 불필요. 다만 실수로 프로덕션 코드로 복사되지 않도록 주석으로 테스트 전용임을 명시하는 것은 선택사항.

- **[INFO]** `unknown[]` 타입 사용 — 런타임 검증 없음
  - 위치: 라인 107 (`function triggersBody(items: unknown[])`) / 라인 111 (`async function mockConsole(page: Page, triggers: unknown[])`)
  - 상세: `unknown[]` 로 선언하고 `JSON.stringify` 로 직렬화하므로 타입 강제는 없으나, 이는 mock 응답 픽스처를 그대로 반환하는 테스트 헬퍼이며 실 서버로 전송되지 않는다. 실제 입력 검증 취약점이 아님.
  - 제안: 테스트 품질 개선 차원에서 `Partial<Trigger>[]` 같은 구체 타입을 쓸 수 있으나 보안상 필수 아님.

- **[INFO]** `page.route` 와일드카드 인터셉션 — 테스트 격리 범위
  - 위치: 라인 66–82, 112–128
  - 상세: `**/api/auth/refresh` 등 `**` 글로빙 패턴은 테스트 환경(Playwright 인터셉터)에서만 동작하며, 프로덕션 코드에 영향 없다.
  - 제안: 이상 없음.

---

### 파일 3: spec/7-channel-web-chat/3-auth-session.md (신규 step 0)

- **[WARNING]** `embed-config` 조회 엔드포인트가 인증 없는 공개 경로 — allowlist 내용 노출 가능성
  - 위치: 신규 라인 (`GET /api/hooks/:path/embed-config`)
  - 상세: 스펙에 따르면 이 엔드포인트는 인증 없이 누구나 endpointPath 만으로 워크스페이스의 임베드 allowlist(`{ allowlist, enforce }`)를 조회할 수 있다. allowlist 에 내부 도메인·스테이징 URL 등 노출하고 싶지 않은 호스트명이 포함될 경우 정보 누출이 된다. 또한 유효하지 않은 endpointPath 를 무한 열거(enumeration)하면 존재하는 webhook path 를 탐색하는 데 악용될 수 있다.
  - 제안:
    1. 엔드포인트가 404 vs 200 으로 path 존재 여부를 노출하지 않도록 존재하지 않는 path 에 대해 빈 allowlist(`{ allowlist: [], enforce: false }`)를 반환하거나, 일관된 응답 시간을 유지해 타이밍 사이드채널을 최소화할 것을 스펙에서 명시 권고.
    2. allowlist 응답에 캐시 제어(`Cache-Control: public, max-age=60` 등)를 명시해 불필요한 반복 조회 부담을 줄일 것 권고(현재 스펙에 캐시 정책 미명시).

- **[INFO]** `fail-open` 정책 — 설계 의도 확인 필요
  - 위치: 신규 라인 (`allowlist 빈/enforce=false 면 통과(fail-open)`)
  - 상세: 스펙은 이 soft 검증의 목적이 "캐주얼 오남용 차단"임을 명시(4-security §3 R2)하고, fail-open 이 의도된 설계임을 Rationale 에서 기술하고 있다. 보안 컨텍스트를 인지한 의도적 결정으로 확인.
  - 제안: 이상 없음. 다만 워크스페이스 운영자가 enforce=true 로 설정하는 경로가 명확히 문서화되어 있는지 재확인 권고.

---

### 파일 4: spec/7-channel-web-chat/4-security.md (§3-① 보강)

- **[WARNING]** 클라이언트 soft 검증의 우회 가능성이 스펙에 충분히 명시되지 않음
  - 위치: §3-① 개정 내용
  - 상세: `window.location.ancestorOrigins[0]` 및 `document.referrer` 폴백은 JavaScript 로 읽는 클라이언트 값이다. 공격자가 위젯 번들을 직접 로드(iframe 밖에서)하거나, 브라우저가 `ancestorOrigins`/`referrer` 를 제공하지 않는 환경(일부 프라이버시 설정, `noreferrer` 링크)에서 이 검증은 빈 origin 으로 평가된다. 빈 allowlist 의 경우 fail-open 이 적용되어 모든 origin 이 통과하지만, allowlist 가 비어있지 않은 경우 빈 origin 이 어떻게 처리되는지(allow vs block) 스펙에 명시가 없다.
  - 제안: `ancestorOrigins`/`referrer` 모두 비어있을 때의 동작을 스펙에 명시. 권장 동작은 "origin 획득 불가 시 block"(보수적) 또는 "획득 불가 환경은 통과"(개방적) 중 명시적 선택 기술.

- **[INFO]** `document.referrer` 폴백의 조작 가능성
  - 위치: §3-① `ancestorOrigins[0]`, 미지원 시 `document.referrer` 폴백
  - 상세: `document.referrer` 는 iframe의 `referrerpolicy` 속성이나 부모 페이지의 `<a rel="noreferrer">` 링크를 통해 억제·조작될 수 있다. 그러나 스펙 자체가 이 검증을 "hard 보안 경계가 아닌 soft 컨트롤"로 규정하고 있으므로, 이 제약은 설계 범위 안에 있다.
  - 제안: 이상 없음. 스펙의 "soft 컨트롤" 명시가 이 제약을 커버한다.

- **[INFO]** `② API soft 필터(선택)` 및 `③ hard frame-ancestors(opt-in)` 의 구현 여부
  - 위치: §3-② ③
  - 상세: 이번 변경에서 ②③은 기존 그대로 유지됨. ①만 엔드포인트·DTO 명시로 보강. 구현 여부와 스펙 사이의 갭은 이번 리뷰 범위 밖.
  - 제안: 이상 없음.

---

## 요약

이번 변경은 주로 (1) Playwright e2e 테스트 파일 신규 추가와 (2) embed-config 엔드포인트 관련 스펙 문서 보강이다. 테스트 파일에서는 하드코딩된 mock 자격증명이 있으나 테스트 전용 픽스처로 프로덕션 보안에 영향이 없다. 스펙 보강에서는 `GET /api/hooks/:path/embed-config` 공개 엔드포인트를 통해 allowlist 내용이 외부에 노출될 가능성과 endpointPath enumeration 가능성이 주의가 필요한 WARNING 수준 사항이다. 또한 `ancestorOrigins`/`referrer` 모두 획득 불가한 엣지 케이스에서의 동작이 스펙에 미명시되어 있어 구현 시 혼선이 발생할 수 있다. 전반적으로 설계 의도(soft 컨트롤, fail-open)가 Rationale 에 명확히 기술되어 있어 보안 설계 자체의 맥락 이해는 양호하다.

## 위험도

LOW
