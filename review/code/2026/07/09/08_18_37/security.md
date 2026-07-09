# 보안(Security) 리뷰

## 대상

이번 diff(커밋 `62484807`, `refactor(navigation): 슬러그 라우팅 round-2 ai-review/impl-done Warning 조치`)는
직전 라운드(2026-07-08 18:24 리뷰)의 Warning 후속 조치다. 실제 코드 변경은 3개 프런트엔드 파일 +
테스트 1개뿐이고, 나머지(`CHANGELOG.md`, `RESOLUTION.md`, `spec/**`)는 문서.

- `codebase/frontend/src/lib/workspace/href.ts` — `buildWorkspaceHref` open-redirect 정규화 강화
- `codebase/frontend/src/lib/workspace/__tests__/href.test.ts` — 위 강화에 대한 회귀 테스트 4건
- `codebase/frontend/src/lib/stores/workspace-store.ts` — `setWorkspaces` 폴백 로직을
  `resolveFallbackWorkspace()` 위임으로 리팩터 (순수 DRY, 보안 성격 아님)
- `codebase/frontend/src/lib/workspace/resolve-fallback.ts` — JSDoc 갱신(소비처 3곳 명시)뿐, 로직 무변경

## 발견사항

- **[INFO]** `buildWorkspaceHref` open-redirect 정규화는 실제 우회 클래스를 정확히 차단
  - 위치: `codebase/frontend/src/lib/workspace/href.ts:687-719`
  - 상세: 신규 로직
    ```ts
    const clean = `/${String(path)
      .replace(/[\t\r\n]/g, "")
      .replace(/^[/\\]+/, "")}`;
    ```
    는 (1) tab/CR/LF 를 전체 문자열에서 제거하고 (2) 선두의 `/`·`\` 연속을 모두 접어 단일
    `/` 로 재조립한다. WHATWG URL 파서가 특수 스킴(`http`/`https` 등)에서 `\` 를 `/` 와
    동등하게 취급하고 tab/CR/LF 를 무시하는 실제 스펙 동작(예: `\\evil.com`, `/\evil.com`,
    `/\t/evil.com` 모두 브라우저에서 `//evil.com` 과 동일하게 파싱됨)을 정확히 겨냥한
    하드닝이다. 직접 실행해 검증한 케이스들(아래)도 규칙과 일치한다.
    - `"\\\\evil.com/x"` → tab/CR/LF 없음 → 선두 `\\` 2개 제거 → `evil.com/x` → `/evil.com/x` (same-origin)
    - `"https://evil.com"` → 선두가 `/`·`\` 가 아니므로 무변경 → `/https://evil.com` (스킴이
      아닌 경로 세그먼트로 강등되어 안전)
    - URL-encoded 변형(`%2F%2Fevil.com`, `%5C%5Cevil.com`)은 리터럴 문자가 아니므로 정규화
      대상이 아니지만, 브라우저가 percent-encoding 을 프로토콜-상대 판단 전에 디코드하지
      않으므로 별도 우회로 이어지지 않음.
    - 풀와이드 유사문자(`／` U+FF0F, `＼` U+FF3C)는 최신 브라우저 WHATWG URL 파서가 구분자로
      취급하지 않아(레거시 IE 한정 이슈) 잔여 리스크 아님.
  - 참고: 커밋 메시지 자체가 "현 호출부 미도달" 이라고 명시하듯, 코드베이스 전수 호출부
    (`grep buildWorkspaceHref`)를 확인한 결과 `path` 인자는 전부 하드코드 라우트 리터럴이거나
    서버가 발급한 id(workflow/integration/execution id)를 보간한 문자열, 또는 현재 URL 자체
    (`[...rest]/page.tsx` catch-all)이며 사용자가 임의로 주입 가능한 텍스트(예: 검색창 입력,
    `?redirect=` 쿼리 등)가 흘러드는 지점은 없다. 즉 실질 공격 표면은 현재 0이며, 이번 변경은
    **방어 심층화(defense-in-depth)** 성격 — 향후 호출부가 추가되어도 안전하도록 경계를
    미리 완결한 것으로 적절한 조치.
  - 제안: 없음(추가 조치 불요). 다만 향후 이 헬퍼에 사용자 입력(예: 알림 딥링크의 외부
    파라미터, `?next=` 류)이 유입될 가능성이 생기면, 정규화 후 결과가 여전히 `/` 로
    시작하고 두 번째 문자가 `/`·`\` 가 아님을 재확인하는 단위테스트를 그 시점에 추가할 것.

- **[INFO]** `workspace-store.ts` / `resolve-fallback.ts` 변경은 순수 리팩터, 보안 영향 없음
  - 위치: `codebase/frontend/src/lib/stores/workspace-store.ts:412-427`,
    `codebase/frontend/src/lib/workspace/resolve-fallback.ts`
  - 상세: 인라인으로 중복 구현되던 "현재 workspace 가 목록에 있으면 유지, 없으면 첫 항목"
    폴백 로직을 기존 공유 함수 `resolveFallbackWorkspace()` 로 위임한 것뿐이며, 동작(폴백
    대상 선정 규칙)은 리팩터 전후 동일하다. 워크스페이스 인가는 여전히 `switchWorkspace`→
    서버 `/switch` 재발급(`X-Workspace-Id` 헤더 + 토큰 클레임)이 SoT 이며, 이 클라이언트 측
    상태는 UX 편의(어떤 workspace 를 기본 표시할지)에만 관여 — 인가 경계 자체에 영향 없음.
    `resolve-fallback.ts` 는 `WorkspaceSummary` 를 type-only import 하므로 런타임 순환
    리스크도 없음(주석과 실제 import 구문(`import type ...`) 일치 확인).
  - 제안: 없음.

- **[INFO]** CHANGELOG/RESOLUTION/spec 문서 diff — 시크릿·민감정보 노출 없음
  - 위치: `CHANGELOG.md`, `review/code/2026/07/08/18_24_41/RESOLUTION.md`,
    `spec/2-navigation/{0-dashboard,1-workflow-list,11-error-empty-states}.md`,
    `spec/3-workflow-editor/4-ai-assistant.md`, `spec/5-system/13-replay-rerun.md`
  - 상세: 문서 전용 변경(슬러그 라우팅 phase 1 서술 추가, 이동된 페이지의 bare-path 산문을
    slug-aware 각주로 정정). API 키/토큰/자격증명 패턴 grep 결과 매치 없음(알림 이메일
    템플릿·초대 토큰 등은 기능 서술일 뿐 실제 값이 아님). 인가/검증 로직 변경 없음.
  - 제안: 없음.

## 요약

이번 diff 는 직전 ai-review 라운드에서 지적된 open-redirect 방어 Warning(W4)에 대한 후속
하드닝으로, `buildWorkspaceHref` 가 protocol-relative(`//host`) 뿐 아니라 WHATWG URL 파서가
실제로 `/` 와 동등하게 취급하는 backslash·tab/CR/LF 우회 클래스까지 정규화하도록 확장했다.
정규화 로직은 실제 파서 동작에 부합하며, 현재 코드베이스 내 모든 호출부가 신뢰 가능한
경로 리터럴/서버 발급 id 만 전달하므로 실질 공격 표면은 이미 0이었고 본 변경은 방어
심층화다. 나머지 코드 변경(`workspace-store`/`resolve-fallback`)은 순수 아키텍처 리팩터로
인가/인증 경계에 영향이 없으며, 문서 diff 에서도 하드코딩 시크릿이나 민감정보 노출은
발견되지 않았다. 신규 취약점 없음.

## 위험도

NONE
