# 정식 규약 준수 검토 결과

검토 모드: `--impl-done` (구현 완료 후 검토, diff-base=main)
검토 대상: EIA form validation 구현 (branch: claude/refactor-04-a1-eia-msglen-ba62ae)

---

## 발견사항

### [WARNING] interaction.controller.ts Swagger `@ApiBadRequestResponse` description 에 폐기 에러 코드 잔존

- **target 위치**: `codebase/backend/src/modules/external-interaction/interaction.controller.ts` line 70 (`@ApiBadRequestResponse` description)
- **위반 규약**: `spec/conventions/swagger.md §2-4` (상태 코드 응답 데코레이터 패턴) 및 `spec/conventions/error-codes.md §1` (의미 기반 명명)
- **상세**: diff 에서 `interaction.controller.ts` 의 `@ApiBadRequestResponse` description 은 `'VALIDATION_FAILED (form field) / INVALID_COMMAND (필수 필드 누락).'` 에서 `'VALIDATION_ERROR (form field — details[]) / INVALID_COMMAND (필수 필드 누락).'` 로 변경됐다. 그러나 현재 worktree 파일(`codebase/backend/src/modules/external-interaction/interaction.controller.ts:70`)을 직접 확인하면 **여전히 구 코드 `VALIDATION_FAILED`** 가 남아 있다. EIA spec(`spec/5-system/14-external-interaction-api.md §5.1`)은 해당 에러 코드를 `VALIDATION_ERROR` 로 명시하며, diff 가 의도한 변경이 파일에 실제 반영되지 않은 상태다. Swagger 문서에 노출되는 description 이 spec·구현과 불일치하면 API 소비자가 잘못된 에러 코드로 분기 로직을 작성하게 된다.
- **제안**: `interaction.controller.ts:70` 의 `@ApiBadRequestResponse` description 을 `'VALIDATION_ERROR (form field — details[{field,message,code:INVALID_FIELD}]) / INVALID_COMMAND (필수 필드 누락).'` 으로 교체해 diff 의 의도를 실제 파일에 반영하고 EIA spec §5.1 과 동기화한다.

---

### [WARNING] `workflow-errors.ts` — `FormValidationError` 클래스 바로 앞에 JSDoc 블록이 두 개 중첩

- **target 위치**: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` lines 228–242 (두 개의 연속 `/** ... */` 블록이 서로 다른 선언을 가리키지만 순서가 뒤집혀 있음)
- **위반 규약**: `spec/conventions/swagger.md §1-1` (JSDoc 주석 패턴: 각 선언 위에 단일 JSDoc 블록)
- **상세**: `workflow-errors.ts` 에는 228–237 줄에 `FormValidationError` 클래스 전체를 설명하는 JSDoc 이 있고, 238–242 줄에 `ValidationDetail` interface 를 설명하는 JSDoc 이 이어진다. 그런데 `export interface ValidationDetail` 선언은 243 번째 줄에 있어 두 JSDoc 이 모두 `ValidationDetail` 선언 바로 앞에 위치하는 모양이 된다. TypeScript 컴파일러·tsDoc 는 선언 직전 마지막 `/**` 만 연결하므로, 첫 번째 블록(FormValidationError 에 대한 설명)이 `ValidationDetail` 에 붙거나 어느 쪽도 `FormValidationError` 클래스와 연결되지 않는 문제가 생긴다.
- **제안**: `ValidationDetail` interface 를 `FormValidationError` 클래스 **앞**으로 이동하거나, `FormValidationError` JSDoc 을 클래스 선언 직전에 오도록 순서를 재정렬한다. 올바른 순서: `ValidationDetail` (JSDoc + interface) → `FormValidationError` (JSDoc + class). 각 선언이 자신의 JSDoc 을 단일·정확하게 갖게 된다.

---

### [INFO] `error-codes.ts` 신규 `VALIDATION_ERROR` — 도메인 prefix 부재 의도 주석 보강 권장

- **target 위치**: `codebase/backend/src/nodes/core/error-codes.ts` (diff: `VALIDATION_ERROR: 'VALIDATION_ERROR'` 추가)
- **위반 규약**: `spec/conventions/error-codes.md §1` (도메인 prefix 권장, 단 시스템 전역 공용 코드는 별개 범주로 허용)
- **상세**: `VALIDATION_ERROR` 는 prefix 없는 시스템 전역 공용 코드로, `spec/conventions/error-codes.md §1` 이 명시적으로 "별개 범주" 로 허용하고 있어 위반이 아니다. 다만 코드 주석이 spec 참조만 인용하고 "시스템 전역 공용 — prefix 없음" 분류를 언급하지 않아, 후속 개발자가 도메인 prefix 누락으로 오탐할 수 있다.
- **제안**: 인라인 주석에 `// 시스템 전역 공용 코드 — prefix 없음 (spec/conventions/error-codes.md §1)` 한 줄 추가. 차단 불필요.

---

### [INFO] `spec/4-nodes/6-presentation/4-form.md` — `## Rationale` 섹션 부재

- **target 위치**: `spec/4-nodes/6-presentation/4-form.md` 전체 문서
- **위반 규약**: `CLAUDE.md §정보 저장 위치` ("결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`")
- **상세**: `4-form.md` 는 §1~§7 로 구성되어 있으며 `## Rationale` 섹션이 없다. 규약은 3섹션(Overview / 본문 / Rationale)을 권장한다. 현재 `(Planned)` 표기·`⚠` 주석으로 설계 이유를 인라인에 흩어두고 있어 독자가 찾기 어렵다. spec 이 `status: partial` 이므로 현 시점 차단은 불필요하나 완성 시 보완 필요.
- **제안**: spec 완성 시점에 `## Rationale` 섹션 추가 — metadata-only file 전송 결정, MIME 기본값 목록 선택 이유, `preset` 미구현 결정 등 포함.

---

## 요약

구현은 `spec/conventions/node-output.md` Principle 4·4.5, `spec/conventions/error-codes.md` 의미 기반 명명, EIA spec §5.1 의 `VALIDATION_ERROR + details[]` 출력 포맷을 전반적으로 올바르게 따른다. `FormValidationError.code = ErrorCode.VALIDATION_ERROR`, `toHttpDetails()` 반환 형태 `{field, message, code:'INVALID_FIELD'}`, WS ack 의 `errorCode='VALIDATION_ERROR'` 모두 스펙과 정합한다. 단 두 가지 주의 사항이 있다: (1) `interaction.controller.ts` 의 Swagger `@ApiBadRequestResponse` description 이 현재 파일에 여전히 구 코드(`VALIDATION_FAILED`)를 담고 있어 Swagger 문서와 spec 이 불일치한다(WARNING). (2) `workflow-errors.ts` 에서 JSDoc 블록 두 개가 연속 등장해 TypeScript 컴파일러의 doc-comment 연결이 의도와 달라진다(WARNING). 나머지는 INFO 수준의 문서 완성도 제안이다.

---

## 위험도

MEDIUM
