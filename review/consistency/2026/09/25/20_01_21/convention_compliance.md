## 발견사항

- **[WARNING]** `convention_compliance` 프롬프트 번들이 `spec/conventions/**` 본문 대부분을 컨텍스트 예산으로 절단함
  - target 위치: 검토 대상 자체가 아니라 이 검토를 구동한 입력(`_prompts/convention_compliance.md`) — `spec/conventions/error-codes.md`(18,219자)·`node-output.md`(80,407자)·`swagger.md`(21,120자)를 포함해 `audit-actions.md` 한 건만 제외한 사실상 전 conventions 본문이 "⚠️ 본문 생략됨 — 컨텍스트 예산 초과"로 대체되어 있음(`grep -c` 30건 이상).
  - 위반 규약: 이 항목 자체는 target 문서의 규약 위반이 아니라, memory 항목 `feedback_consistency_spec_mode_budget`("consistency `--spec` 기본 예산이 conventions 를 통째로 떨군다")가 이미 지목한 하니스 갭의 재현.
  - 상세: 이번 리뷰의 target(`9-user-profile.md`·`1-auth.md`·`data-flow/12-workspace.md`)은 하필 `error-codes.md`·`swagger.md`·`audit-actions.md`를 조밀하게 인용하는 문서라, 번들만 보고 판정했다면 정작 가장 관련도 높은 규약 본문이 없는 채로 "정합/위반"을 판정하는 거짓 신뢰 결과가 됐을 것. 본 리뷰는 리포지토리 파일을 직접 읽어(`spec/conventions/error-codes.md`, `node-output.md`, `swagger.md`, `audit-actions.md`, `redis-keys.md`, `migrations.md`, `frontend-layering.md`, `.claude/skills/project-planner/SKILL.md`) 이 갭을 우회했음.
  - 제안: target 문서 수정 사항 없음. 하니스 측에서 `--impl-prep`/`--spec` 번들 조립 시 대상 spec 파일이 실제로 참조하는 conventions 파일을 예산 절단 대상에서 우선 보존하거나, 절단이 발생하면 checker 프롬프트에 "직접 파일을 읽어 보완하라"는 지시를 명시하는 편이 안전.

- **[INFO]** `error-codes.md` 내부 셀프-레퍼런스 관행을 target 각주가 그대로 답습
  - target 위치: `spec/5-system/1-auth.md` §1.5.4 하단 각주("명명 — historical-artifact 예외")
  - 위반 규약: `spec/conventions/error-codes.md` Overview — "표기(`UPPER_SNAKE_CASE`): `3-error-handling.md §3.2` · `node-output.md §3.2` (SoT). 본 문서는 재선언하지 않는다."
  - 상세: target 각주는 `node-output.md Principle 3.2 · error-codes.md §1` 을 UPPER_SNAKE_CASE 규약의 근거로 인용하지만, `error-codes.md` 의 §1("의미 기반 명명")은 casing 을 선언하지 않으며 Overview 는 casing SoT 를 §1 이 아니라 `3-error-handling.md`/`node-output.md` 로 명시한다. 다만 이는 target 이 새로 만든 오류가 아니라 `error-codes.md` §3 표 자체가 여러 행에서 "§1 `UPPER_SNAKE_CASE` 위반"이라고 스스로 이미 그렇게 인용하고 있어(`invitation_not_found` 등 3개 행), target 은 그 기존 관행을 그대로 따른 것.
  - 제안: target 은 수정 불필요. `error-codes.md` §3 표의 자기-인용을 "Overview 의 SoT 위임"과 맞추는 편집(§1 대신 casing SoT 문서를 직접 인용)은 `error-codes.md` 자체의 정리 과제로 별도 제안.

## 요약

`spec/2-navigation/9-user-profile.md`·`spec/5-system/1-auth.md`·`spec/data-flow/12-workspace.md` 세 target 문서를 `spec/conventions/`(`error-codes.md`·`audit-actions.md`·`swagger.md`·`node-output.md`·`redis-keys.md`·`migrations.md`·`frontend-layering.md`)와 대조한 결과, 명명 규약(에러 코드 UPPER_SNAKE_CASE/역사적 예외 레지스트리 정합)·출력 포맷(`{ data: ... }` 봉투, 비-페이징 고정 컬렉션 `{ data: { items } }`)·감사 액션 명명(3분류 taxonomy)·API 문서 규약(swagger §5-4 의 `@WorkspaceParam` 403 `@ApiForbiddenResponse` 지시 등) 모두 2026-09-25 자 merge(`#1399`/`#1400`, `NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED`/`@WorkspaceParam` 도입)와 함께 관련 규약 문서(`error-codes.md` historical-artifact 레지스트리, `5-system/3-error-handling.md` 카탈로그, `swagger.md` §5-4)가 같은 커밋 계열에서 동기화되어 있어 CRITICAL/WARNING 급 위반이 발견되지 않았다. 문서 구조(Overview/본문/Rationale) 도 `2-navigation` 영역은 `_product-overview.md` 공유 Overview 패턴을, `5-system`/`data-flow` 는 자체 `## Overview`+`## Rationale` 패턴을 각각 준수한다. 유일한 실질적 우려는 target 자체가 아니라 본 검토를 구동한 프롬프트 번들이 컨텍스트 예산으로 관련 conventions 본문 대부분을 절단했다는 프로세스적 갭이며, 이는 리포지토리 파일 직접 열람으로 보완했다.

## 위험도

LOW
