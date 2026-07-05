# 신규 식별자 충돌 검토 — naming_collision

- 검토 모드: `--impl-done` (구현 완료 후)
- Scope: `spec/4-nodes/4-integration/`
- diff-base: `origin/main`
- SoT 워킹트리: `/Volumes/project/private/clemvion/.claude/worktrees/ssrf-error-generalize-7e1091`

## 조사 방법

1. `--impl-done` 프롬프트에 번들된 target 문서(`spec/4-nodes/4-integration/**` 전체 + 관련 corpus)를 읽고, 실제 변경분을 식별하기 위해 워킹트리에서 `git diff origin/main --stat` 및 파일별 diff 를 직접 조회.
2. 이번 PR 의 실질 변경은 코드 2파일(`http-request.handler.ts`, `http-request.handler.spec.ts`) + spec 3파일(`1-http-request.md` §8.3 신설, `2-database-query.md` Rationale 갱신, `spec/2-navigation/4-integration.md` 표 갱신) — **SSRF 차단 에러 메시지 일반화**(HTTP Request 의 `HTTP_BLOCKED` message 를 host/IP 미노출 문구로 통일 + redirect-hop SSRF 도 동일 코드로 라우팅).
3. 직전 세션의 `--impl-prep` naming_collision 리뷰(`review/consistency/2026/07/05/12_55_17/naming_collision.md`)가 예측한 신규 식별자(일반화 메시지 상수·문자열)와 실제 구현을 대조.
4. 코드에 실제 도입된 식별자(`SSRF_BLOCKED_CLIENT_MESSAGE`, `logger` 인스턴스, `Logger('HttpRequestHandler')`)를 워킹트리 전체(`codebase/`, `spec/`)에서 grep 하여 기존 사용처와의 충돌 여부 확인.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** 신규 상수 `SSRF_BLOCKED_CLIENT_MESSAGE` — 충돌 없음, 기존 문자열과 의도적으로 통일
  - target 신규 식별자: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:36` `const SSRF_BLOCKED_CLIENT_MESSAGE = 'Request blocked by SSRF policy.'`
  - 기존 사용처: `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts:450` 의 fallback 문자열 `"Request blocked by SSRF policy."` (직전 `--impl-prep` 리뷰가 예측한 정확한 문구와 일치)
  - 상세: 신규 상수명·값 모두 코드베이스 어디에도 다른 의미로 선점되어 있지 않다. grep 결과 이 상수는 `http-request.handler.ts` 내부 4개 사용처(preflight 차단·redirect-hop 차단 2곳·usage 로그)로만 참조되며, 값 문자열은 frontend 테스트가 이미 fallback 으로 기대하던 문구와 정확히 일치해 3-node(HTTP/DB/Email) 메시지 어휘 통일이라는 spec §8.3 의도대로 구현되었다. `spec/4-nodes/4-integration/1-http-request.md:338,364` 의 문구(`Request blocked by SSRF policy.`)와도 완전히 동일.
  - 제안: 없음 — 충돌 아님, 참고 기록.

- **[INFO]** 에러 코드·클래스 재사용, 신규 enum 없음
  - target 신규 식별자: 없음 (`ErrorCode.HTTP_BLOCKED`, `IntegrationError` 클래스를 그대로 재사용)
  - 기존 사용처: `codebase/backend/src/nodes/core/error-codes.ts:18` `HTTP_BLOCKED: 'HTTP_BLOCKED'`, `codebase/backend/src/nodes/integration/_base/integration-handler-base.ts:120` `export class IntegrationError`
  - 상세: redirect-hop SSRF 차단 경로가 기존 `throw new Error('SSRF_BLOCKED: redirect chain exceeded 5 hops')` (plain Error, 코드 없음) 에서 `throw new IntegrationError(ErrorCode.HTTP_BLOCKED, SSRF_BLOCKED_CLIENT_MESSAGE)` 로 변경됐으나, 이는 신규 코드/클래스 도입이 아니라 기존 `HTTP_BLOCKED` 코드·`IntegrationError` 클래스의 재사용이며 spec §6/Rationale 8.3 이 요구하는 "redirect 한도 SSRF 도 HTTP_BLOCKED" 계약과 정확히 일치. 신규 식별자 충돌 대상 없음.
  - 제안: 없음.

- **[INFO]** `logger` 인스턴스명 — 파일 로컬 스코프, 프로젝트 전역 관례에 부합
  - target 신규 식별자: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:25` `const logger = new Logger('HttpRequestHandler')`
  - 기존 사용처: 없음(동일 파일 내 최초 도입, 타 handler 는 이미 각자 파일 스코프의 `Logger` 인스턴스를 갖는 NestJS 관례를 따름 — 예: DB/Email 핸들러도 유사 패턴)
  - 상세: 모듈 스코프 `const logger` 는 파일 내부에 한정되고 export 되지 않으므로 다른 파일의 동일명 상수와 충돌할 여지가 없다. context label `'HttpRequestHandler'` 도 타 handler 의 Logger context 문자열과 겹치지 않음(각 handler 가 자기 클래스명 사용하는 기존 관례와 일치).
  - 제안: 없음.

- **[INFO]** spec 문서 내 신규 식별자 없음 — 기존 §번호·에러코드·anchor 재사용
  - target 신규 식별자: 없음. `1-http-request.md` 에 신설된 것은 `## 8.3 SSRF 차단 메시지 일반화 — 정찰 면 축소 (2026-07-05)` 라는 Rationale 서브섹션 제목뿐이며, 이는 기존 `## 8. Rationale` 아래 `### 8.1`, `### 8.2` 에 이어지는 순번 확장(anchor `#83-ssrf-차단-메시지-일반화--정찰-면-축소-2026-07-05`)이라 기존 anchor 와 겹치지 않는다.
  - 기존 사용처: `2-database-query.md` Rationale 이 위 anchor 를 정확히 참조(`[1-http-request §8.3](./1-http-request.md#83-ssrf-차단-메시지-일반화--정찰-면-축소-2026-07-05)`) — 상호 참조 링크가 실제 생성된 heading 과 slug 규칙(공백→`-`, 특수문자 제거)상 일치함을 확인.
  - 상세: `spec/2-navigation/4-integration.md` 의 `HTTP_BLOCKED` 표 행 설명 문구 갱신도 기존 행의 텍스트만 보강한 것이며 새 코드/키를 추가하지 않았다.
  - 제안: 없음.

## 요약

이번 PR(SSRF 차단 에러 메시지 일반화 + redirect-hop SSRF 의 `HTTP_BLOCKED` 정합)은 신규 요구사항 ID·엔티티·API endpoint·이벤트명·ENV var·spec 파일 경로를 전혀 도입하지 않는다. 코드 레벨의 유일한 신규 식별자는 파일-로컬 상수 `SSRF_BLOCKED_CLIENT_MESSAGE` 와 파일-로컬 `Logger` 인스턴스뿐이며, 둘 다 export 되지 않아 스코프 충돌 여지가 없다. 특히 `SSRF_BLOCKED_CLIENT_MESSAGE` 의 값은 frontend 가 이미 fallback 으로 기대하던 문자열과 정확히 일치하도록 구현되어, 직전 `--impl-prep` naming_collision 리뷰가 권고한 "기존 `... blocked by SSRF policy.` 어휘 패턴 재사용" 방향과 완전히 부합한다. 에러 코드는 기존 `ErrorCode.HTTP_BLOCKED`/`IntegrationError` 를 그대로 재사용했고, spec 의 신규 Rationale 서브섹션(§8.3)과 상호 참조 anchor 도 기존 번호 체계 안에서 정합하게 확장되었다. 신규 식별자 충돌 관점에서 이번 구현은 위험이 없다.

## 위험도

NONE
