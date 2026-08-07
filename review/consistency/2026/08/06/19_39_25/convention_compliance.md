# 정식 규약 준수 검토 — `spec/conventions/audit-actions.md`

## 검토 방법
- target 문서(`spec/conventions/audit-actions.md`) 전문을 직접 `Read` 로 확인 (prompt 번들과 대조해 동일함 확인).
- 프롬프트에 번들된 `spec/conventions/**` 발췌(주로 cafe24-api-catalog 계열)는 본 target 과 직접 관련성이 낮아, "컨텍스트 예산 초과로 생략" 명시된 `error-codes.md`·`spec-impl-evidence.md`·`migrations.md`·`node-output.md` 를 별도로 `Read` 하여 실제 규약 원문을 대조했다 (프롬프트 부재를 근거로 삼지 않음).
- frontmatter `code:` 가 가리키는 구현 SoT `codebase/backend/src/modules/audit-logs/audit-action.const.ts` 를 직접 읽어 문서 §3 레지스트리 표와 대조.
- `git log`/`git diff origin/main` 으로 본 세션 diff 범위(§3 표의 "미구현"→"구현" 갱신 + 각주 2개 추가) 확인, PR #1081 (2026-08-01) 병합 사실을 커밋 로그로 재검증.
- `spec/5-system/1-auth.md`, `spec/data-flow/1-audit.md`, `spec/data-flow/12-workspace.md` 의 앵커(§4.1, §4.1.A, §1.1, "workspace.deleted 감사 제외" Rationale)가 실제로 존재하는지 grep 으로 확인.

## 발견사항

없음 — CRITICAL/WARNING 급 정식 규약 위반을 찾지 못했다.

### 대조한 항목과 결과 (모두 통과)

1. **frontmatter 스키마** (`spec-impl-evidence.md` §2) — `id: audit-actions` 는 basename 과 일치(kebab-case), `status: implemented` 는 5-value enum 중 하나, `code:` 1개 경로가 실존 파일을 가리켜 `spec-code-paths.test.ts` 요건(≥1 매치) 충족.
2. **문서 3섹션 구조** (CLAUDE.md "Spec 문서 3섹션 구성") — `## Overview` → `## 1~3` 본문 → `## Rationale` 순서로 구성되어, 동일 계열의 선례 문서 `error-codes.md`(Overview/§1-5/Rationale) 와 구조가 일치한다. target 의 Rationale 하단에 "왜 이렇게 결정했는가"·"기각된 대안" 서술도 존재해 CLAUDE.md 의 Rationale 규약(결정의 배경·근거)을 충족.
3. **명명 규약 자기 일관성** — §1 의 `<resource>.<verb>` dot-prefix + 언더스코어 토큰 구분 규칙이 §3 레지스트리 표 전 항목(`scope_changed`, `transfer_ownership`, `role_changed`, `re_run`, `password_changed`, `2fa_enabled` 등)에 예외 없이 적용됨. 하이픈·camelCase 사용 없음.
4. **문서 ↔ 구현 SoT 정합** — `AUDIT_ACTIONS` const (`audit-action.const.ts`) 의 34개 액션이 §3 표와 1:1 일치 (workflow/trigger/schedule/model_config 13개 포함, `workspace.deleted`·`workflow.executed` 제외도 동일). 이번 세션 diff 로 "미구현"→"구현" 전환된 4개 resource(workflow/trigger/schedule/model_config) 는 실제로 PR #1081(`d02bb422f`, 커밋 날짜 2026-08-01)로 이미 병합되어 있어, 문서가 주장하는 "2026-08-01 구현·병합" 날짜와 정확히 일치.
5. **error-codes.md 와의 유비 주장 검증** — Rationale 에서 "`error-codes.md` 가 명명 규약과 카탈로그를 분리한 것과 같은 패턴" 이라 서술한 부분을 `error-codes.md` 원문과 대조한 결과 실제로 동일 패턴(명명 규약 문서 vs `5-system/3-error-handling.md` 카탈로그 문서 분리)이었다 — 근거 없는 유비가 아님.
6. **다른 표기 규약과의 충돌 여부** — `node-output.md` §3.2 의 `UPPER_SNAKE_CASE` 는 `output.error.code` 전용 규약(error-codes.md 가 명시)이며 `AuditLog.action` 도메인과 겹치지 않아 target 의 lower_snake dot-notation 채택과 충돌하지 않는다.
7. **링크 무결성 (참고 체크)** — Overview·Rationale 이 참조하는 `1-auth.md §4.1`/`§4.1.A`, `data-flow/1-audit.md §1.1`, `data-flow/12-workspace.md` "workspace.deleted 감사 제외" Rationale 앵커가 모두 실존.
8. **API 문서 규약(§4 관점)** — target 은 OpenAPI/Swagger DTO/데코레이터를 다루지 않는 문서라 해당 없음(N/A).
9. **출력 포맷 규약(§2 관점)** — target 은 API 응답 envelope 을 정의하지 않고 DB 컬럼 값의 명명만 다루므로 직접 해당 없음. 다만 §1 의 "읽기측은 닫힌 enum 으로 단정하지 않는다" 서술이 `AuditLog.action` 이 자유 문자열 컬럼이라는 점을 명시해, 향후 이 문서가 출력 포맷(닫힌 enum) 규약으로 오독되는 것을 스스로 방지하고 있다 — 오히려 규약 경계를 정확히 긋는 좋은 사례.

## 요약
`spec/conventions/audit-actions.md` 는 frontmatter 스키마(`spec-impl-evidence.md`), 3섹션 문서 구조(CLAUDE.md), 명명 규약 자기 일관성, 그리고 구현 SoT(`audit-action.const.ts`)와의 정합을 모두 충족한다. 이번 세션의 실제 변경분(§3 표의 상태 컬럼 "미구현"→"구현" 정정 + 각주 2개 추가)도 PR #1081 병합 사실과 날짜가 정확히 일치해 허위·과장 서술이 없었다. 유비로 든 `error-codes.md` 패턴 주장도 원문 대조 결과 정확했다. 정식 규약 준수 관점에서 지적할 CRITICAL/WARNING 사항이 없는 깨끗한 문서다.

## 위험도
NONE
