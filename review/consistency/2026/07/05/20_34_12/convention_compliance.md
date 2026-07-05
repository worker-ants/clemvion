# 정식 규약 준수 검토 — trigger-param 타입 통합 (impl-done convention)

- target: `git diff origin/main...HEAD` (worktree `trigger-param-type-consolidate-79b10c`)
- 변경 파일:
  - `codebase/frontend/src/lib/api/triggers.ts`
  - `codebase/frontend/src/components/editor/settings-panel/node-configs/trigger-configs.tsx`
  - `codebase/frontend/src/components/executions/rerun-modal.tsx`
  - `plan/in-progress/spec-code-cross-audit-2026-06-10.md`

## 검토 요약

순수 리팩터: `rerun-modal.tsx` 의 로컬 `TriggerParameterDefinition`(+`ParamType`)과 `trigger-configs.tsx` 의 로컬 `TriggerParameter` 두 개의 동일-shape 중복 타입을 `lib/api/triggers.ts` 로 canonical 단일화(`TriggerParameterDefinition` + `TriggerParameterType` export). 두 소비처는 import 로 교체. 동작 변경 없음.

## 발견사항

검토 결과 CRITICAL/WARNING 위반은 발견되지 않았습니다. 확인한 사항은 다음과 같습니다.

- **[INFO] canonical shape·이름이 spec·backend 와 3자 정합**
  - target 위치: `codebase/frontend/src/lib/api/triggers.ts` 신설 `TriggerParameterType`/`TriggerParameterDefinition` (주석에 `spec/4-nodes/7-trigger/0-common.md §1` 명시 인용)
  - 대조 규약/SoT: `spec/4-nodes/7-trigger/0-common.md §1` `TriggerParameterDefinition` 정의(`name/type/required?/defaultValue?/description?`, `type: 'string'|'number'|'boolean'|'object'|'array'`) — `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` 의 동일 인터페이스·`utils/coerce-type.ts` 의 `CoercibleType` union 과 필드명·union 리터럴이 정확히 일치함을 직접 대조 확인.
  - 상세: 프런트 신설 타입이 spec 문서 및 backend 타입과 이름·shape 모두 어긋남 없이 정합. "정식 규약을 따르는 이름으로 통합"이라는 취지에 부합.
  - 제안: 없음(현행 유지 권장).

- **[INFO] 파일 위치 선정(`lib/api/triggers.ts`) 근거가 기존 관례와 일치**
  - target 위치: `triggers.ts` 파일 상단 JSDoc ("프런트 canonical 정의로 여기서 단일화")
  - 대조 규약: CLAUDE.md 의 "정보 저장 위치 단일 진실 원칙" 은 spec/plan 계층에 대한 것이나, 동일 원칙("동일 개념은 한 곳에만 정의")이 코드 레벨에서도 준용됨. `lib/api/triggers.ts` 는 이미 트리거 도메인 typed API 카탈로그(`refactor M-8/m-2`)로 지정된 SoT 파일이라 타입 정의 추가 위치로 자연스러움 — 새 파일을 만들지 않고 기존 SoT 파일에 추가한 점이 "불필요한 신규 문서/파일 생성 금지" 원칙과 부합.
  - 상세: 없음(위반 아님, 근거 확인 목적의 기록).

- **[INFO] plan 체크박스 갱신 — "체크박스=실제 상태" 원칙 준수**
  - target 위치: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` V-14 후속 항목 체크박스 `[ ]` → `[x]` 전환
  - 대조 규약: `.claude/docs/plan-lifecycle.md` (plan 체크박스는 실제 완료 후 갱신, 커밋에 포함) — 사용자 메모리(`feedback_plan_checkbox_actual_state`)에도 동일 원칙 명시.
  - 상세: 체크박스 텍스트가 "brand 브랜치명(`trigger-param-type-consolidate`) + 실제 변경 내용(신설 위치·소비처 정리·pass 테스트 수)" 을 구체적으로 서술 — 과거 지적된 "already-done stale checkbox" 패턴과 달리 이번 커밋 자체가 그 구현물이므로 정합.
  - 이 plan 최상위 frontmatter `worktree: spec-sync-audit-998544` 는 현재 작업 worktree(`trigger-param-type-consolidate-79b10c`)와 다르나, 이는 최상위 audit-plan 의 하위 파생 후속 항목을 각각 별도 브랜치에서 처리하고 원본 체크리스트만 갱신하는 기존 반복 패턴(V-10·V-14 원본 항목도 동일 방식으로 이미 처리됨)과 일치 — 위반 아님.
  - 제안: 없음.

- **[INFO] `type` 키워드 re-export 시 TS `verbatimModuleSyntax`/`isolatedModules` 스타일 일관성**
  - target 위치: `rerun-modal.tsx` 신설 import `import type { TriggerParameterDefinition, TriggerParameterType } from "@/lib/api/triggers";`
  - 대조 규약: 프로젝트 conventions 문서에 TS import 스타일에 대한 명시적 규칙은 없음(빌드 가드 영역). 기존 파일 전반의 `import type { ... }` 패턴과 일관.
  - 상세: 특별한 위반 없음. 참고로만 기록.

## 위반 없음 확인 항목 (체크리스트)

1. **명명 규약** — `TriggerParameterDefinition`/`TriggerParameterType` 이름이 spec 문서(`0-common.md §1`) 및 backend `trigger-parameter.types.ts` 와 100% 일치. PascalCase 인터페이스, PascalCase 타입 alias — 기존 `lib/api/*.ts` 관례(`ChatChannelConfigView`, `ExecutionTriggerSource` 등)와 동일 컨벤션.
2. **출력 포맷 규약** — 본 변경은 런타임 API 응답/이벤트 payload 를 건드리지 않는 순수 컴파일 타임 타입 리팩터. `error-codes.md`/`node-output.md`/`swagger.md` 등 출력 포맷 규약과 무관.
3. **문서 구조 규약** — `spec/4-nodes/7-trigger/0-common.md` 자체는 변경되지 않았고(diff 미포함), 코드가 기존 spec 문서를 인용만 함. Overview/본문/Rationale 3섹션 요구는 spec 문서 신설·수정 시 적용되는 규약이라 본 변경 범위 밖.
4. **API 문서 규약(swagger)** — 프런트 전용 파일 변경으로 NestJS `@nestjs/swagger` 데코레이터·DTO 대상 아님. 해당 없음.
5. **금지 항목** — 중복 타입 정의를 제거하고 단일 canonical 로 합친 것은 오히려 conventions 가 지향하는 "단일 진실" 원칙에 부합하는 방향. 금지 패턴 재도입 없음.

## 요약

이번 diff 는 프런트엔드 `TriggerParameterDefinition`/`TriggerParameterType` 의 로컬 중복 정의 2벌(`rerun-modal.tsx`, `trigger-configs.tsx`)을 `lib/api/triggers.ts` 단일 canonical 정의로 통합한 순수 리팩터입니다. 신설 타입의 필드명·union 리터럴이 `spec/4-nodes/7-trigger/0-common.md §1` 및 backend `execution-engine/types/trigger-parameter.types.ts` 와 정확히 일치함을 직접 대조로 확인했으며, 파일 위치·plan 체크박스 갱신도 기존 프로젝트 관례와 부합합니다. 정식 규약(`spec/conventions/**`) 위반 사항은 발견되지 않았습니다.

## 위험도

NONE
