# 정식 규약 준수 검토 — spec/data-flow/ (impl-done)

## 검토 범위 요약

- 검토 모드: `--impl-done`, scope=`spec/data-flow/`, diff-base=`origin/main`
- 실제 diff(`origin/main...HEAD`)는 전부 `codebase/backend/src/common/__test-utils__/source-scan.ts`(+spec),
  `codebase/backend/src/common/utils/update-returning-rows.spec.ts`,
  `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts`(+spec) — raw
  `UPDATE/DELETE … RETURNING` 지점을 전수 발견해 헬퍼 우회를 잡는 **테스트/가드 하드닝**과
  `kb-stats.helper.ts` 의 pg 드라이버 반환 타입 표기(주석+제네릭 튜플)뿐이다.
- 신규/변경된 API endpoint, DTO, swagger 데코레이터, 에러 코드, audit action, Redis key, 이벤트
  페이로드는 diff 안에 **없다**. `spec/data-flow/*.md` 자체를 건드리는 diff hunk도 없다.
- 즉 이번 변경은 정식 규약이 규율하는 "출력 표면"(API 응답 형식·이벤트 payload·에러 코드·
  audit action·명명)에 아무 영향이 없는 내부 테스트 인프라 변경이다. 아래 발견사항은 모두
  이 사실을 배경으로 한다.

## 발견사항

- **[INFO]** 신규 테스트 주석의 언어가 diff 내에서 국지적으로 갈린다
  - target 위치: `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.spec.ts` 신규 주석
    (`// Raw \`UPDATE … RETURNING\` resolves to a \`[rows, affectedCount]\` tuple, ...`)
  - 위반 규약: 직접 해당하는 `spec/conventions/**` 항목 없음 — `i18n-userguide.md` 는 **사용자
    노출 문자열**(frontend 응답)의 i18n 을 다루고, "주석/JSDoc 등 정당한 잔존" 은 오히려 하드코딩
    한국어를 허용하는 방향의 예외 서술이라 코드 주석 언어를 규율하는 정식 규약이 아니다.
  - 상세: 같은 diff 의 다른 신규 주석(`source-scan.ts`/`source-scan.spec.ts`/
    `update-returning-rows.spec.ts`)은 전부 한국어인데 이 파일만 영어다. 강제 규약 위반은 아니지만
    저장소 전반의 문서화 스타일(spec·plan·commit 한국어 기본)과의 국지적 불일치.
  - 제안: 정식 규약 갱신이 필요할 정도는 아님 — 원하면 다음 편집 시 한국어로 맞추는 정도의
    cosmetic 정리로 충분.

- **[INFO]** target 문서(`spec/data-flow/`) 자체는 이번 diff 로 인한 신규 위반이 없음
  - target 위치: `spec/data-flow/0-overview.md`, `1-audit.md`, `2-auth.md`, `3-execution.md`,
    `9-observability.md`, `11-workflow.md` (bundle 에 본문 전체가 포함된 6개 파일)
  - 위반 규약: 해당 없음(확인용 표본 점검)
  - 상세: 표본 점검한 6개 파일 모두 `## Overview` → 본문(`## 1 …` 이하) → `## Rationale` 3섹션
    구조를 유지한다. `1-audit.md` §1.1 의 audit action 표는 `spec/conventions/audit-actions.md`
    §1 의 `<resource>.<verb>` dot-prefix 규칙과 §3 시제 3분류를 전부 준수한다(예:
    `integration.created`(§2.1 과거분사), `auth_config.create`(§2.2 현재형),
    `execution.re_run`/`workspace.transfer_ownership`(§2.3 도메인 고유 동사)). `2-auth.md` 의
    에러 코드(`ACCOUNT_LOCKED`, `OAUTH_STATE_MISMATCH`)는 `spec/conventions/error-codes.md` §1 의
    `UPPER_SNAKE_CASE` + 의미 기반 명명 원칙과 일치하며, `OAUTH_STATE_MISMATCH` 는 그 문서가
    직접 예시로 드는 코드다. `login_history.event` 값(`login_success` 등)이 dot-prefix 형식이
    아닌 것은 위반이 아니다 — `audit-actions.md` 의 적용 범위는 명시적으로 `AuditLog.action` 한정이고,
    `login_history` 와의 분리는 `1-audit.md` §Rationale "두 테이블을 분리한 이유"에 근거가 있다.
  - 제안: 조치 불요. 이번 PR 이 이 파일들을 건드리지 않았으므로 diff-scoped 위반도 없다.

- **[INFO]** 이번 diff 는 정식 규약이 규율하는 산출물을 생성하지 않음
  - target 위치: diff 전체 (`source-scan.ts`, `update-returning-rows.spec.ts`, `kb-stats.helper.ts`)
  - 위반 규약: 해당 없음
  - 상세: 신규 API endpoint/DTO/swagger 데코레이터(`spec/conventions/swagger.md` 대상 없음), 신규
    에러 코드(`error-codes.md` 대상 없음), 신규 audit action(`audit-actions.md` 대상 없음), 신규
    Redis key(`redis-keys.md` 대상 없음)가 없다. `kb-stats.helper.ts` 의 `.query<...>` 제네릭
    타입 인자를 `{...}[]` → `[{...}[], number]` 로 정정한 것은 pg 드라이버가 실제로 반환하는 튜플
    형태를 타입에 반영한 **버그 방지성 정정**이며, 이는 spec 이 규율하는 "출력 포맷"이 아니라
    내부 드라이버 호출 계약의 타입 표기 문제다.
  - 제안: 조치 불요.

## 요약

이번 PR 의 diff(`origin/main...HEAD`)는 raw `UPDATE/DELETE … RETURNING` 헬퍼 우회를 잡는 백엔드
테스트 가드 하드닝과 `kb-stats.helper.ts` 의 pg 드라이버 반환 타입 표기 정정으로만 구성되며,
`spec/data-flow/**` 를 포함해 정식 규약이 규율하는 명명·출력 포맷·문서 구조·API 문서 표면에
아무 것도 신설·변경하지 않는다. impl-done scope 로 지정된 `spec/data-flow/` 문서 6개(본문 전체
포함분)를 표본 점검한 결과도 `spec/conventions/audit-actions.md`·`error-codes.md` 및 CLAUDE.md 의
3섹션(Overview/본문/Rationale) 문서 구조 규약을 기존부터 준수하고 있어, 이번 diff 로 인한 신규
CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았다.

## 위험도

NONE
