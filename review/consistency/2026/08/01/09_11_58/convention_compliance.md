# 정식 규약 준수 검토 — spec/data-flow/ (--impl-prep)

## 검토 범위 및 방법

- prompt 번들: `spec/data-flow/{0-overview,1-audit,3-execution,7-llm-usage,11-workflow,12-workspace,2-auth,4-file-storage}.md`
  + `spec/conventions/{cafe24-api-catalog/**,cafe24-api-metadata}.md` (컨텍스트 예산으로 그 외 conventions 265개 파일 생략 표시).
- 번들에 없는 항목은 "없다"를 근거로 삼지 않고 실제 파일시스템에서 직접 `Read`했다:
  `spec/conventions/audit-actions.md`, `error-codes.md`, `migrations.md`, `swagger.md`, `secret-store.md`,
  `spec/5-system/1-auth.md §4.1`, `spec/data-flow/10-triggers.md`, `spec/2-navigation/6-config.md`.
- 대상 브랜치명(`audit-logging`)과 git diff 부재(= origin/main 과 동일, 순수 impl-prep 게이트)를 근거로
  실제 구현 착수 지점이 `1-audit.md` §1.1 "커버리지 갭"(`workflow.*`/`trigger.*`/`schedule.*`/`model_config.*`)일
  가능성이 높다고 판단, `1-audit.md` + `conventions/audit-actions.md` 를 최우선 정밀 검증했고 그 교차검증을
  코드 레벨(`audit-action.const.ts`, `audit-logs.controller.ts`, `login-history.service.ts`/`.dto.ts`)까지 내렸다.
  나머지 6개 번들 문서는 전문을 읽고 명명·출력포맷·문서구조·금지패턴 관점에서 스캔했다.
- `spec/data-flow/` 의 15개 도메인 문서 중 번들에 없던 8개(5-integration·6-knowledge-base·8-notifications·
  9-observability·10-triggers·13-agent-memory·14-chat-channel·15-external-interaction)는 audit 액션
  키워드에 한해 grep spot-check 만 수행했고, 전수 conventions 대조는 하지 않았다 (아래 위험도 참고).

## 발견사항

CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았다. 아래는 이유를 뒷받침하는 구체적 검증 포인트다.

### 명명 규약 (audit-actions.md) — 전수 일치 확인

`spec/data-flow/1-audit.md` §1.1 표에 등장하는 21개 action 문자열
(`integration.created/updated/deleted/rotated/scope_changed/reauthorized`,
`workspace.transfer_ownership/created/updated`, `member.invited/role_changed/removed`,
`execution.re_run`, `auth_config.create/update/delete/regenerate/reveal`,
`user.password_changed/email_changed/2fa_enabled/2fa_disabled`)를
`spec/conventions/audit-actions.md` §3 도메인별 분류 레지스트리, `spec/5-system/1-auth.md §4.1` 카탈로그,
실제 구현 SoT `codebase/backend/src/modules/audit-logs/audit-action.const.ts` 의 `AUDIT_ACTIONS` 세 소스와
1:1 대조한 결과 **완전히 일치**한다. `<resource>.<verb>` dot-prefix, 토큰 구분자(언더스코어), verb 시제
3분류(과거분사/현재형 CRUD 예외/도메인 고유 동사) 배정도 모두 정합적이다. Planned 액션
(`workflow.*`/`trigger.*`/`schedule.*`/`model_config.*`)의 명명도 `audit-actions.md` §3 레지스트리와
`1-auth.md §4.1` Planned 표가 정확히 동일한 이름·시제 분류를 쓴다 — 구현 시 참조할 두 SoT 가 갈리지 않는다.

### 금지 항목 — 명시적 forbidden 패턴 미검출

- `re_run_initiated`(dot-prefix 이탈, audit-actions.md §1 이 명시적으로 금지) 는 spec/코드 전체에서
  "과거 이력을 설명하는 문맥"으로만 등장하고 활성 패턴으로는 전무 (grep 확인).
- retired 에러코드 `LLM_CONFIG_NOT_FOUND`/`LLM_CONFIG_INVALID`(error-codes.md §5) 는 `spec/data-flow/` 어디에도
  잔존하지 않음.
- migrations.md §1 이 금지하는 alphanumeric V-suffix(`V035a` 류)는 `codebase/backend/migrations/` 에 없음.
- audit action 인라인 문자열 금지는 `AuditAction` union 타입으로 강제되고 있음이 코드로 확인됨.

### 출력 포맷 규약 (swagger.md) — 코드 대조로 검증

`1-audit.md §2.2`(`GET /users/me/login-history`)가 서술하는 커서 페이지네이션이 swagger.md §5-2 표에 없는
패턴이라 처음엔 규약 미등재 후보로 의심했으나, 실제 컨트롤러(`sessions.controller.ts`)·DTO
(`login-history.dto.ts`)를 열어 확인한 결과 표준 `ApiOkWrappedResponse(LoginHistoryPageDto)`(§5-2 1행,
`{ data: <Dto> }`)를 그대로 쓰고 `LoginHistoryPageDto{ items, nextCursor }` 는 DTO 내부 형태일 뿐이라 규약
위반이 아니다. `GET /audit-logs` 도 `ApiOkPaginatedResponse(AuditLogDto)` + `@Roles('admin')` 동반
`@ApiForbiddenResponse`(swagger.md §5-4 체크리스트)까지 정확히 지킨다.

### 문서 구조 규약 (CLAUDE.md / 0-overview.md §3)

`1-audit.md`는 Overview(제품정의 포함)/본문/Rationale 3섹션 구조를 지키며, `## 2. Read path`·`## 3. 보존 정책`
을 형제 문서들의 canonical 순서(Source→Sink/Schema매핑/상태전이/외부의존)와 다르게 끼워 넣은 점은
`0-overview.md` 자체의 Rationale("권한 요약 섹션(§3.6) 신설")에서 "섹션 수가 형제 문서와 달라지는 것은
문제가 아니다 — 1-audit.md 에 이미 5-섹션 선례가 있다"로 명시적으로 사전 승인되어 있다 — 위반이 아니라
문서화된 예외다. `spec/data-flow/0-overview.md` 파일명(`0-`) 자체도 `spec/4-nodes/0-overview.md` 등
기존 폴더-엔트리 관례와 일치하며, CLAUDE.md의 "`_product-overview.md` 또는 진입 문서의 `## Overview`"
허용 조항에 부합한다(`## Overview (제품 정의)` 섹션으로 구현).

- **[INFO]** 섹션 순서 상이에 대한 본문 내 각주 부재
  - target 위치: `spec/data-flow/1-audit.md` — `## 2. Read path`, `## 3. 보존 정책` 헤더
  - 위반 규약: 없음(위반 아님) — `spec/data-flow/0-overview.md §3 공통 규약` 참고
  - 상세: 섹션 순서가 형제 문서와 다른 것은 0-overview.md Rationale 에서 이미 사전 승인됐지만, 그 승인
    근거가 `1-audit.md` 본문에는 각주로 없어 이 문서만 단독으로 여는 리뷰어는 이탈로 오인할 수 있다.
  - 제안: 선택 사항. `1-audit.md` §2 헤더 아래에 "형제 문서와 섹션 순서가 다른 이유는
    [0-overview.md §Rationale](./0-overview.md#권한-요약-섹션3-6-신설--왜-34-아래가-아닌가-2026-07-31)"
    같은 1줄 역참조를 추가하면 탐색성이 개선된다. 규약 갱신은 불필요.

## 요약

impl-prep 게이트 대상인 `spec/data-flow/`(특히 브랜치명이 시사하는 실제 착수 지점인 `1-audit.md` 와
그 명명 SoT `spec/conventions/audit-actions.md`)는 정식 규약 준수 관점에서 매우 높은 수준을 보인다.
audit action 명명(`<resource>.<verb>`, dot-prefix, 시제 3분류)은 conventions 문서·인접 시스템 spec·실제
구현 상수 세 곳이 완전히 일치하고, 금지 패턴(`re_run_initiated`, retired 에러코드, alphanumeric V-suffix,
인라인 action 문자열)은 모두 정상적으로 배제되어 있으며, 출력 포맷(Swagger 래퍼)·에러 코드 표기
(UPPER_SNAKE_CASE 기본 + 등록된 lowercase 예외)도 conventions 문서를 직접 인용하며 준수한다. 문서 구조는
Overview/본문/Rationale 3섹션과 5요소 공통 규약을 지키고, 관례 이탈처럼 보이는 지점(섹션 순서·`0-overview.md`
파일명)도 모두 CLAUDE.md 허용 조항 또는 상위 문서의 명시적 Rationale 로 사전 정당화되어 있다. CRITICAL/WARNING
위반은 발견되지 않았고, INFO 1건(섹션 순서 각주 부재)만 선택적 개선 사항으로 남는다. 다만 `spec/data-flow/`
15개 도메인 문서 중 8개는 audit 키워드 spot-check 만 수행했고 전수 conventions 대조는 하지 않았다는 점이
이번 검토의 범위 한계다.

## 위험도

LOW
