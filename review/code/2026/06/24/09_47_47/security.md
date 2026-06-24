# 보안(Security) 리뷰

대상 커밋: `33ad66b65c97eddb7d057615e91f923a6b876083`
리뷰 파일: `next.config.ts`, `proxy.ts`, `proxy.test.ts`, `spec/7-channel-web-chat/0-architecture.md`

---

## 발견사항

### 인증/인가

- **[WARNING]** `/_widget` prefix 예외가 과도하게 광범위하다 — Path traversal 잠재성
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/proxy.ts` 라인 27, 46
  - 상세: `pathname.startsWith("/_widget")` 는 `/_widget` 로 시작하는 **모든** 경로를 인증 없이 통과시킨다. 현재는 `public/_widget/` 정적 파일만 존재하므로 실질 피해는 없지만, 향후 `/_widget` prefix 를 가진 동적 라우트나 API 핸들러가 추가될 때 실수로 인증 예외가 적용될 수 있다. matcher regex(`(?!...._widget)`)도 동일하게 prefix 전체를 Skip 하므로 중간자가 없더라도 설계 표면이 넓다.
  - 제안: `/_widget/web-chat/` 처럼 실제 위젯 번들 경로로 최대한 구체화하거나, 최소한 주석·lint 룰로 "이 prefix 에는 동적 라우트를 추가하지 말 것" 을 명시한다. 또는 Next.js `public/` 디렉토리 서빙은 미들웨어를 애초에 타지 않으므로, matcher regex 에서 제외(`_widget` 를 matcher 에서 제외)하는 것만으로 충분하고 함수 내부 `startsWith("/_widget")` 가드는 사실상 dead-code — 불필요한 예외 코드를 제거해 표면을 줄인다.

- **[WARNING]** 세션 검증이 클라이언트 제어 가능한 쿠키(`has_session`) 단일 힌트에만 의존한다
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/proxy.ts` 라인 35–39
  - 상세: `has_session` 쿠키가 존재하면 모든 보호 경로를 통과시킨다. 미들웨어가 쿠키 값·서명·만료를 검증하지 않으므로, 공격자가 `has_session=1` 쿠키를 임의로 심으면 프론트엔드 redirect 우회가 가능하다. 코드 주석에 "set by frontend JS on login" 으로 명시돼 있어 이 동작은 의도된 것(실제 세션 검증은 백엔드 API 에서 수행하는 구조)임을 알 수 있으나, 미들웨어만 보면 인증 우회처럼 보인다.
  - 제안: 주석을 보강하여 "이 미들웨어는 UX 전용 redirect 힌트이며 실질 인증은 백엔드 API 레이어에서 수행됨을 명시"한다. 만약 미들웨어가 단독 보안 게이트라면 서명된 JWT/세션 토큰을 미들웨어에서 검증해야 한다. 현 구조에서 인증 게이트는 백엔드라고 가정하면 미들웨어 역할 명확화로 충분하다.

### 입력 검증 / Open Redirect

- **[WARNING]** `redirect` 쿼리 파라미터에 검증 없는 pathname 삽입 — Open Redirect 위험
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/proxy.ts` 라인 37–38
  - 상세: `loginUrl.searchParams.set("redirect", pathname)` 은 `request.nextUrl.pathname`(path 부분만)을 사용하므로 origin 탈출은 없다. 그러나 `/login` 이후 리디렉션 처리 코드가 `redirect` 파라미터를 검증 없이 `window.location` 등에 적용하면 Open Redirect 로 이어질 수 있다. 미들웨어 단에서는 pathname 만 추출하므로 현재는 안전하나, 소비측 코드의 안전성에 의존한다.
  - 제안: `/login` 페이지의 redirect 처리 코드에서 값이 절대 URL(`//attacker.com` 등) 이 아닌 상대 경로(`/`로 시작)임을 검증한다. 방어적 코딩으로 미들웨어에서도 `pathname.startsWith("/")` 확인 후 삽입한다.

### 경로 탐색(Path Traversal) — rewrite 규칙

- **[INFO]** `next.config.ts` rewrite source 의 `:segment*` 와일드카드 범위
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/next.config.ts` 라인 62–67
  - 상세: `/_widget/:segment*/app` → `/_widget/:segment*/app/index.html` rewrite 는 `segment` 에 `..` 같은 경로 순회 시퀀스가 포함될 수 있다. 그러나 Next.js 의 public 디렉토리 서빙은 경로 정규화를 수행하므로 실제 파일시스템 탈출 가능성은 낮다. 다만 `segment*` 패턴이 의도하지 않은 경로(예: `/_widget/../../etc/passwd/app`)를 매칭해 rewrite 후 404 를 반환하는 정보 노출(존재 여부 탐지)은 이론적으로 가능하다.
  - 제안: 운용 상 위협 수위는 낮으나, 가능하다면 `segment` 에 허용 문자 제약(`[a-zA-Z0-9_\-]+`)을 두거나, 매칭 대상을 `/_widget/web-chat/v1/app` 처럼 고정 경로로 좁혀 와일드카드 표면을 최소화한다.

### 테스트 품질 (보안 회귀 커버리지)

- **[INFO]** 세션 쿠키 위조 시나리오 테스트 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/__tests__/proxy.test.ts`
  - 상세: 테스트는 `has_session=1` 쿠키가 있을 때 통과, 없을 때 redirect 를 검증하지만 임의 문자열 값(`has_session=fake`)의 동작은 테스트하지 않는다. 현재 구현은 쿠키 존재 여부만 확인하므로 값과 무관하게 통과하는데, 이 동작이 의도적임을 명시하는 테스트가 있으면 향후 구현 변경 시 회귀를 잡을 수 있다.
  - 제안: `has_session=arbitrary_value` 도 통과함을 확인하는 케이스를 추가하거나, 반대로 이 동작이 설계 의도인지 주석으로 명시한다.

---

## 요약

이번 변경의 핵심은 `/_widget/**` 경로를 인증 미들웨어 예외로 추가하고, Next.js rewrite 로 위젯 SPA 의 디렉토리 index 폴백을 처리한 것이다. 정적 번들을 인증 없이 공개하는 의도 자체는 타당하며 하드코딩된 시크릿·인젝션·암호화 문제는 없다. 주요 보안 우려는 두 가지다. 첫째, `/_widget` prefix 전체를 예외로 두는 설계가 향후 해당 prefix 하에 동적 라우트를 추가할 때 인증 누락으로 이어질 수 있으므로 예외 범위를 구체화하거나 아키텍처 제약을 문서화해야 한다. 둘째, 세션 검증이 클라이언트 제어 가능한 쿠키 존재 여부에만 의존하는 구조는 실제 보안 게이트가 백엔드임을 코드 주석·아키텍처 문서로 명확히 해야 오해를 방지한다.

---

## 위험도

LOW
