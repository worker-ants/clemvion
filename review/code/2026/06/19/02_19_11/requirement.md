# 요구사항(Requirement) Review

## 리뷰 범위

커밋: `8a9d8a063905cc6c1370c100b95a782ae98bbcac`
변경 성격: **주석 only** — 런타임/컴파일 산출물 무변 (docs(execution-engine): C-1 후속 ① ai-review INFO 주석 반영)

대상 파일:
- `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/types/graph-dispatch.types.ts`

관련 spec: `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md`

---

## 발견사항

### [INFO] 주석 only 변경 — 런타임/기능 영향 없음
- 위치: 모든 3개 파일
- 상세: 이번 커밋은 순수 JSDoc/인라인 주석 추가로 코드 실행 경로, 타입 정의, 함수 시그니처에 변경 없음. 컴파일 산출물 불변이 commit message 에 명시됨.
- 제안: 해당 없음 (기능 리뷰 항목 1-8 은 주석 only 변경에 적용되지 않음).

### [INFO] `EngineDriver` 인터페이스 JSDoc "5-vs-7 비대칭" 설명의 spec 미반영
- 위치: `engine-driver.interface.ts` L70-72 (신규 JSDoc 단락)
- 상세: 추가된 JSDoc 문구: "C-1 step4 멤버 5개는 impl 측과 대칭으로 `@internal` 을 명시 — 그 외 멤버도 동일 계약상 내부 전용이다." `spec/5-system/4-execution-engine.md` §Rationale C-1 분할 섹션(L1464)은 EngineDriver 잔류 멤버로 `buildRetryReentryState`, `buildResumeCheckpoint`, `isCheckpointEligibleNodeType` 3개만 열거하고, step4 추가 5멤버(`rehydrateContext`, `loadAndBuildGraph`, `runNodeDispatchLoop`, `findActivatedBackEdge`, `clearLlmDefaultConfigCache`)는 spec 본문에 명시적 목록이 없다. 이 비대칭은 **설계 결함이 아니라** spec 문서가 step4 멤버 목록을 따라오지 못한 SPEC-DRIFT — 코드 JSDoc 이 올바르게 비대칭 이유를 설명하고 있다.
- 제안: 코드 유지 + spec 반영. `spec/5-system/4-execution-engine.md` §Rationale "C-1 분할" 의 "EngineDriver 멤버" 열거 목록(L1464)에 step4 추가 멤버 5개(`rehydrateContext`, `loadAndBuildGraph`, `runNodeDispatchLoop`, `findActivatedBackEdge`, `clearLlmDefaultConfigCache`)를 추가해 전체 12멤버 목록을 완성해야 한다.

### [INFO] `types/graph-dispatch.types` 모듈 분리 동기(타입 레벨 순환 해소)가 spec 에 미반영
- 위치: `execution-engine.service.ts` L415 신규 주석; `engine-driver.interface.ts` L61 신규 주석; `types/graph-dispatch.types.ts` 파일 헤더 JSDoc
- 상세: `graph-dispatch.types.ts` 파일 분리는 `engine-driver.interface.ts` ↔ `execution-engine.service.ts` 타입 레벨 순환 해소 목적이며, 두 소비자가 중립 leaf 모듈에서 공통 타입을 가져오는 구조다. 이 설계 결정과 파일 존재는 `spec/5-system/4-execution-engine.md` 어디에도 언급되지 않는다. 그러나 C-1 분할 §Rationale 이 "메서드 물리 위치는 spec 이 정의하지 않는 구현 재량 영역"으로 명시(L1458)했으므로 타입 파일 위치도 동일하게 구현 재량이다 — spec 침묵 영역이므로 INFO.
- 제안: 해당 없음. 필요 시 spec §Rationale 에 타입 모듈 분리 결정 배경을 단락으로 추가하는 것은 가독성 개선이지만 필수 아님.

### [INFO] `NodeDispatchLoopParams.executionId` 필드 JSDoc ("현재 처리 중인 Execution UUID") 는 spec 필드 정의와 일치
- 위치: `types/graph-dispatch.types.ts` L1745 (신규 JSDoc 라인)
- 상세: spec §7.5 rehydration 시퀀스에서 `executionId` 가 `Execution UUID` 임을 일관되게 사용(L869, L1090 등). 신규 JSDoc 문구가 spec 의미론과 정확히 일치한다.
- 제안: 해당 없음.

---

## spec fidelity 점검 결과

| 항목 | spec 기준 | 코드 | 판정 |
|------|-----------|------|------|
| `EngineDriver` 계약: "엔진 내부 전용" | spec L1465 "엔진 내부 통신 = EngineDriver … 엔진 내부 전용 계약" | JSDoc L110 "모든 멤버는 ENGINE_DRIVER 토큰을 통해서만 호출" | 일치 |
| step4 멤버 `@internal` 표기 | spec L1464 멤버 목록에 step4 5개 미열거 (SPEC-DRIFT) | `@internal` 5개 멤버에 추가, JSDoc 비대칭 설명 | 코드 옳음, spec 낡음 |
| `graph-dispatch.types.ts` 존재 | spec 에 미정의 (구현 재량) | leaf 타입 모듈로 분리 | spec 침묵 영역 — INFO |
| `NodeDispatchLoopParams.executionId` 의미론 | Execution UUID (spec §7.5) | "현재 처리 중인 Execution UUID" | 일치 |
| import 주석 C-1 step 배경 | spec §Rationale C-1 분할 (L1456) | 주석이 spec 배경과 일치하는 설명 제공 | 일치 |

---

## 요약

이번 변경은 이전 C-1 engine-split ai-review(01_41_04)의 INFO 발견사항 4건에 대응하는 주석 전용 커밋이다. 런타임·컴파일 산출물에 변경이 없으므로 기능 완전성·엣지 케이스·에러 시나리오 측면의 리스크는 0이다. 추가된 주석들은 모두 spec `4-execution-engine.md` 의 C-1 분할 §Rationale, `EngineDriver` 계약 정의, `runNodeDispatchLoop` 반환 계약과 의미론적으로 일치한다. 한 가지 SPEC-DRIFT: spec §Rationale C-1 분할 섹션(L1464)이 EngineDriver 멤버를 3개만 열거하고 step4 추가 5멤버를 누락하고 있으며, 코드 JSDoc 이 이 비대칭을 올바르게 설명한다 — spec 갱신이 필요하지만 코드는 옳다.

## 위험도

NONE
