# Convention Compliance Review

**검토 모드**: 구현 완료 후 검토 (--impl-done)
**대상 범위**: `spec/5-system/4-execution-engine.md` (코드 변경: `button-interaction.service.ts` + `button-interaction.service.spec.ts`)
**검토 일시**: 2026-06-19

---

## 발견사항

### [INFO] `StructuredInteraction.type` union 이 `interaction-type-registry.md` 의 공식 값 집합과 직접 참조 관계 불명확

- **target 위치**: `button-interaction.service.ts` 추가부, `StructuredInteraction` 인터페이스 (lines 79–87)
- **위반 규약**: `spec/conventions/interaction-type-registry.md` — `interaction.type` 값은 중앙 레지스트리가 단일 진실을 보유하며, 새 union type 정의 시 레지스트리와 직접 교차 참조하도록 권장
- **상세**: `StructuredInteraction.type` 은 `'form_submitted' | 'button_click' | 'button_continue' | 'message_received'` 를 인라인 union 으로 선언한다. `interaction-type-registry.md` 는 `WaitingInteractionType` (§1) 과 `ConversationTurnSource` (§2) 를 다루며, `interaction.data.type` 의 allowed value set 에 대한 중앙 exhaustive list 는 `node-output.md §4.5` 표가 사실상 SoT 역할을 한다. 현재 코드 주석 `CONVENTIONS §4.5` 로 참조 의도를 표현했으나, 이 union 이 `node-output.md §4.5` 의 `interaction.type` 허용값 집합과 완전히 정렬됨을 단언하는 구조적 장치(type alias import, const-assertion 등)가 없다. 이 자체가 직접 위반은 아니지만, 추후 `interaction.type` 허용값 추가 시 이 파일이 갱신 대상으로 포착되지 않을 수 있다.
- **제안**: 허용값 집합을 `spec/conventions/node-output.md §4.5` 와 `interaction-type-registry.md` 양쪽에 이미 등록된 값으로만 제한한다는 JSDoc 참조를 보강하거나, 추후 중앙 타입 alias 가 신설되면 그것을 import 해 사용한다. 현재 값(4종)은 `node-output.md §4.5` 표와 일치하므로 실질 drift 없음.

---

### [INFO] `INVALID_BUTTON_ID` 에러 코드가 `error-codes.md` 레지스트리에 미등재

- **target 위치**: `button-interaction.service.ts` 추가부, `resolveButtonInteraction` 내 `throw new Error('INVALID_BUTTON_ID: ...')` (lines 141–143)
- **위반 규약**: `spec/conventions/error-codes.md §1` (의미 기반 명명 + 카탈로그) 및 `spec/conventions/node-output.md §3.2` (에러 코드는 `UPPER_SNAKE_CASE`)
- **상세**: `INVALID_BUTTON_ID` 는 `UPPER_SNAKE_CASE` 표기 규칙(§3.2) 을 준수하고 있으며, Pre-flight throw(`Principle 3.1` — config/payload 검증 실패) 범주에 해당해 에러 포트 라우팅 대신 throw 를 쓰는 것도 규약 내 정상 동작이다. 그러나 `error-codes.md §3 Historical-artifact 레지스트리` 에도, 중앙 `ErrorCode` enum(`error-codes.ts`)에도 등재되지 않은 인라인 문자열 리터럴이다. `error-codes.md §1` 은 적용 범위를 "프로젝트 전체의 에러 코드 문자열" 로 명시하므로 형식은 맞으나, 중앙 enum 미등재는 일관성 제안 사항이다. 단, 이 에러는 내부 엔진 예외(`ButtonInteractionService` 내부)로서 API 응답 봉투 `error.code` 로 직접 노출되지 않으므로 클라이언트 계약 위반은 아니다.
- **제안**: `codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` enum 에 `INVALID_BUTTON_ID` 를 추가하거나, 내부 엔진 전용 에러 코드임을 JSDoc 에 명시해 "등재 대상 아님" 의 의도를 표현한다. 규약 자체의 적용 범위 세분화(API 노출 에러 코드 vs 엔진 내부 throw)가 필요하다면 `error-codes.md` 에 해당 예외 분류를 추가하는 것이 더 근본적인 해결이다.

---

### [INFO] `previousOutput` 레거시 필드 코드 주석이 `node-output.md §4.2` 를 `CONVENTIONS §4.2` 로 약칭

- **target 위치**: `button-interaction.service.ts` 추가부, `buildResumedStructuredOutput` 함수 내 주석 (line 284 전후: `CONVENTIONS §4.2 explicitly marks it for retirement`)
- **위반 규약**: `spec/conventions/node-output.md §4.2` (폐기 필드 규정)
- **상세**: 코드 내 주석이 `CONVENTIONS §4.2` 로 node-output 규약 섹션을 약칭하고 있으나, 이 약칭이 가리키는 SoT 파일 경로가 명시되지 않아 맥락 없이 읽으면 불명확하다. `node-output.md §4.2` 는 실제로 `previousOutput` 필드 폐기(Phase 3 정리 대상) 를 명시하고 있으며, 코드 주석의 의도와 일치한다. 또한 `node-output.md §4.2` 의 "Phase 3 완료 전 과도기 예외" 주석(`ButtonInteractionService` 는 `previousOutput` 보존 허용)과도 정합한다.
- **제안**: 코드 주석을 `CONVENTIONS §4.2` 대신 `spec/conventions/node-output.md §4.2` 또는 `node-output.md Principle 4.2` 로 완전 경로를 명시한다. 규약 자체의 변경은 불필요.

---

## 요약

검토 대상 diff(`button-interaction.service.ts` + `.spec.ts`)는 정식 규약에 대한 CRITICAL 또는 WARNING 급 위반을 포함하지 않는다. 추가된 `StructuredInteraction` 인터페이스, `resolveButtonInteraction`, `buildResumedStructuredOutput` 은 `spec/conventions/node-output.md` Principle 4 (블로킹/재개 컨트랙트), §4.4 (immutable snapshot), §4.5 (`interaction.data` payload 규격) 의 `button_click`/`button_continue` 형식 요건을 준수하며, `interaction-type-registry.md` 등록 값과 일치한다. `previousOutput` 레거시 필드 보존은 `node-output.md §4.2` 과도기 예외가 명시적으로 허용하는 범위다. 발견된 세 건은 모두 INFO 수준의 형식 일관성·명시화 제안이며, 규약 invariant 를 깨거나 다른 시스템의 가정을 훼손하는 항목은 없다.

## 위험도

NONE
