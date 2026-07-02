# 정식 규약 준수 검토 — spec/5-system/ (--impl-prep)

대상: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`
비교 규약: `spec/conventions/error-codes.md`, `spec/conventions/audit-actions.md`, `spec/conventions/swagger.md`, `spec/conventions/node-output.md`, `spec/conventions/secret-store.md`, `codebase/backend/migrations/README.md` §1, `.claude/skills/project-planner/SKILL.md` (3섹션 구조)

## 발견사항

없음 — 정식 규약 위반 항목을 발견하지 못했다. 확인한 세부 사항은 다음과 같다.

- **에러 코드 명명(`error-codes.md §1·§3`)**: `1-auth.md` 전역에서 사용되는 에러 코드(`WEBAUTHN_COUNTER_REGRESSION`·`WEBAUTHN_VERIFY_FAILED`·`INVALID_OPTIONS_TOKEN`·`CHALLENGE_INVALID`·`RECOVERY_CODE_INVALID`·`REAUTH_NOT_AVAILABLE`·`RESOURCE_CONFLICT`·`VALIDATION_ERROR` 등)는 모두 `UPPER_SNAKE_CASE` + 의미 기반 명명 원칙을 준수한다. §1.5.4 의 `lower_snake_case` 초대 흐름 코드(`invitation_not_found` 등)는 target 문서가 스스로 "historical-artifact 예외" 로 명시하며 `error-codes.md §3` 레지스트리 항목을 정확히 포인터로 인용한다 — 규약이 요구하는 정확한 절차다. `spec/5-system/10-graph-rag.md §7` 의 `KB_REEXTRACT_IN_PROGRESS` 도 UPPER_SNAKE_CASE·의미 기반이라 위반 없음.
- **감사 액션 명명(`audit-actions.md`)**: `1-auth.md §4.1` 의 구현됨/Planned 액션 카탈로그(`integration.*`·`user.*`·`auth_config.*`·`execution.re_run`·`workspace.transfer_ownership`·Planned `workspace/member/workflow/trigger/schedule/model_config` 표)가 `audit-actions.md §3` 도메인별 분류 레지스트리와 정확히 일치한다 (resource dot-prefix, verb 시제 3분류, 언더스코어 토큰 구분자 모두 일치). 두 문서 간 SoT 책임 분리(카탈로그 vs 명명 규약)도 서로 정합적으로 포인터링되어 있다.
- **문서 구조(3섹션)**: 두 target 문서 모두 `## Overview` (또는 SKILL.md 가 명시한 다중-파일 영역의 정식 변형 `## Overview (제품 정의)`) → 본문 → `## Rationale` 구조를 따른다. `## Overview (제품 정의)` 표기는 `spec/5-system/` 내 다수 문서(9-rag-search·12-webhook·13-replay-rerun 등)에서 이미 확립된 패턴이며 `project-planner/SKILL.md` 의 표에도 명시된 정식 변형이라 위반이 아니다.
- **API 문서 규약(`swagger.md`)**: target 은 spec 프로즈이며 실제 데코레이터 코드는 포함하지 않지만, §5 에서 응답 wrapping 계약(`{ data: ... }`)을 정확히 서술한다 (예: `/auth/2fa/webauthn/availability` 의 논리 payload `{ enabled: boolean }` 이 `TransformInterceptor` 로 `{ data: { enabled } }` 래핑됨을 명시). `swagger.md §2-5`/`§5-2` 의 wrapping 규약과 모순 없음.
- **WebSocket 이벤트 명명**: `10-graph-rag.md §6` 의 `document:graph_*` 이벤트가 기존 `8-embedding-pipeline.md` 의 `document:embedding_*` 콜론+언더스코어 표기를 그대로 계승한다. `document:graph_error` 를 "dead-declared" 로 명시한 것도 embedding 쪽의 동일 패턴(`document:embedding_error` 의 "영구 실패 신호로 사용하지 말 것" 경고)과 일관된 서술 방식이다.
- **마이그레이션 Rationale 교차참조**: `1-auth.md §Rationale 1.4.G` 의 V058 NOT VALID/VALIDATE 예외 논의가 `codebase/backend/migrations/README.md §1` 이 스스로 명시한 표준 사례("V058 → `spec/5-system/1-auth.md §1.4.G`")와 정확히 대응한다 — 규약이 예정한 교차참조 구조 그대로.
- **secret store 교차참조**: `1-auth.md §Rationale "Production fail-closed 가드"` 의 `ENCRYPTION_KEY` 서술이 `secret-store.md#rationale` 을 정확히 가리키며 내용도 일치한다.

## 요약

`spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md` 두 문서는 정식 규약(`spec/conventions/**`)의 명명·출력 포맷·문서 구조·API 문서화 규약을 위반 없이 준수한다. 특히 에러 코드·감사 액션처럼 다른 규약 문서가 SoT 를 갖는 영역에서는 인라인 재정의 없이 정확한 포인터 참조로 책임을 분리했고, 예외 사항(lower_snake_case 초대 코드)은 규약이 정한 historical-artifact 레지스트리 절차를 그대로 따라 명시했다. 신규 도입 요소(`KB_REEXTRACT_IN_PROGRESS`, `document:graph_*` 이벤트)도 기존 확립된 패턴을 정확히 계승해 새로운 이탈을 만들지 않는다.

## 위험도

NONE
