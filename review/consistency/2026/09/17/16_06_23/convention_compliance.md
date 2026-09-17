# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-window1-measured.md`

## 검토 범위

target 은 spec draft (`--spec` 모드)로, `spec/2-navigation/2-trigger-list.md` §3 과
`spec/5-system/15-chat-channel.md` §5.4 에 대한 변경안(A1~A3, B)을 제안한다. 두 target spec
파일의 현재 본문·frontmatter 를 직접 대조하고, 관련 정식 규약(`error-codes.md` ·
`spec/5-system/2-api-convention.md` §5.3/§6 · `swagger.md` · `review-citations.md` ·
`.claude/docs/plan-lifecycle.md` · `project-planner/SKILL.md`)과 실제 구현
(`triggers.service.ts`)을 대조해 규약 위반 여부를 확인했다.

## 발견사항

없음 — CRITICAL/WARNING 급 위반을 찾지 못했다.

### 확인한 항목 (위반 아님, 참고용)

- **에러 코드 명명(`error-codes.md`)**: A3 이 쓰는 `INTERNAL_ERROR` 는 새 코드가 아니라
  `spec/5-system/2-api-convention.md:195` 의 기존 카탈로그 기본값(`5xx=INTERNAL_ERROR`)이고,
  실제 `GlobalExceptionFilter`(`codebase/backend/src/common/filters/http-exception.filter.ts:40`)
  의 fallback 과 정확히 일치한다. 새 코드 신설이 아니므로 `error-codes.md` §1 도메인 prefix
  규칙이나 §3 예외 레지스트리 등재 의무가 걸리지 않는다.
- **404 행 추가(B)**: 표 컬럼(`HTTP | error.code | 사유`)은 §5.4 기존 행과 동일 포맷을 유지하며,
  새 코드를 도입하지 않고 기존 `RESOURCE_NOT_FOUND` 아래 사유만 보강한다 — API 규약 §5.3 의
  "새 코드는 카탈로그에 등재" 요구는 코드 신설에 거는 것이지 기존 코드의 사유 보강에는 걸리지
  않는다.
- **줄 번호 → 심볼 인용 전환((b))**: `review-citations.md` 는 `review/**` 산출물 인용 형태만
  규율하며 `spec/**` 안의 코드 줄번호 인용(`foo.ts:122` 형태)은 대상이 아니다. 이 전환은 정식
  규약이 요구하는 것은 아니지만, 저장소 전반에 이미 있는 `.ts:<line>` 인용(14곳)을 늘리지 않는
  방향이라 규약과 배치되지 않는다.
- **`code:` frontmatter 보강(A1)**: 기존 같은 블록의 `# 주석 + - 경로` 패턴(예:
  `trigger-workflow-ref.e2e-spec.ts` 앞 주석)과 형식이 동일해 `review_guard` 파서 호환성 문제가
  없다(이미 그 파서가 `#` 주석·빈 줄을 건너뛰도록 수정된 이력 확인).
- **`revoke-token` 에 에러 표를 신설하지 않은 결정**: `14-external-interaction-api.md` 의
  EIA-AU-07 은 요구사항 표(에러 응답 표가 아님)이며, 실제로 그 표에 `사유` 열이 없음을 확인했다.
  target 은 이를 Rationale 에 명시하고 §3 괄호 교차 언급으로 대체했다 — 단일 진실 원칙에
  부합하는 처리다.
- **404 판정 로직 사실관계**: `triggers.service.ts` 를 직접 읽어 `rewriteTriggerConfigLocked` 의
  `false` → `throwTriggerNotFound()` 변환 호출부가 정확히 둘(`rotateBotToken` L1391,
  `revokePerTriggerToken` L1204)뿐이고, 나머지 두 호출부(L913, L1486)는 무시/조용한 skip 임을
  확인했다 — target 의 "호출부는 둘이다" 주장이 코드와 일치한다.
- **plan frontmatter**: `worktree`/`started`/`owner` 3필드 + `spec_impact`(실재 spec 경로 리스트)
  가 `.claude/docs/plan-lifecycle.md` §4 스키마와 Gate C 형식을 모두 만족한다. 파일명
  (`plan/in-progress/spec-draft-window1-measured.md`)도 기존 `spec-draft-<name>.md` 관례와
  일치한다.
- **문서 구조**: target 이 수정하는 두 spec 파일은 이미 Overview / 본문 / Rationale 3섹션
  구조를 갖추고 있고, 이번 변경은 §3·§5.4(본문)와 그 근거를 draft 자체의 `## Rationale` 에
  국한해 구조를 흐트러뜨리지 않는다.
- **API 문서(swagger) 규약**: 이번 변경은 controller/DTO 코드를 건드리지 않는 순수 spec 문서
  갱신이며, `swagger.md` §497 은 에러 응답을 `ErrorResponseDto` 로 일반화해 표현하므로 사유
  단위 decorator 신설을 요구하지 않는다.

## 요약

target 은 이미 구현·병합된 동작(#1341~#1343)을 spec 에 반영하는 draft로, 제안하는 세 변경(§3
⚠️ 문단 교체, `code:` e2e 등재, §5.4 404 행 사유 보강)이 모두 기존 error-codes/api-convention
카탈로그의 기존 코드·기본값 범위 안에 있어 새 명명·출력 포맷 규약을 만들거나 어기지 않는다.
plan frontmatter·파일명·문서 구조도 `plan-lifecycle.md`·`project-planner/SKILL.md` 관례를
그대로 따른다. 코드 사실관계(호출부 개수, 필드명, 라인 위치)도 실제 구현과 대조해 일치를
확인했다. 정식 규약 준수 관점에서 이 draft 를 막을 근거를 찾지 못했다.

## 위험도

NONE
