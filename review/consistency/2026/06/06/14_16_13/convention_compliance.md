# 정식 규약 준수 검토 결과

검토 모드: `--impl-done`  
Target 범위: `spec/5-system/4-execution-engine.md` + diff (구현 변경)  
검토 일시: 2026-06-06

---

## 발견사항

### 1. INFO — `isNodeWaitingForInput` 내부 helper 의 export 가 명시적 공개 API 처럼 보임

- **target 위치**: `codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts` L767 — `export function isNodeWaitingForInput`
- **위반 규약**: `spec/conventions/node-output.md` Principle 0 / `spec/conventions/spec-impl-evidence.md` §1 (실질적 규약 위반은 아니나 패턴 일관성 관점)
- **상세**: 파일 헤더(`// Internal helpers (also used by use-execution-events.ts)`) 구역에 배치됐으나 `export` 로 공개됐다. "Internal helpers" 섹션 설명과 `export` 키워드가 상충한다. 테스트 파일에서 직접 import 해 단위 테스트하기 위해 export 한 것은 이해되나, 파일 내 섹션 주석이 "Internal helpers" 라 명시해 패키지 내부 구분 의도가 읽히지 않는다. spec/conventions 에 직접 위반하는 항목은 없고 코드 자체는 동작상 문제 없음. 일관성 제안 수준.
- **제안**: 섹션 주석을 `// Internal helpers — also exported for unit testing and use-execution-events.ts` 로 갱신하거나, 파일 상단 export 목록에 명시해 "의도적 공개" 임을 표시. 혹은 규약 갱신 불필요 — 현재 comment 만 소폭 정정.

---

### 2. INFO — JSDoc 에서 spec 섹션 참조가 앵커 없이 작성됨

- **target 위치**: `codebase/backend/src/modules/executions/executions.service.ts` L198 — `spec/5-system/4-execution-engine.md §전이 표 "원자성 보장"` 형태의 인라인 텍스트 참조
- **위반 규약**: 직접적 규약 항목 위반은 없으나, `spec/conventions/spec-impl-evidence.md §2` `code:` 목록은 파일 경로 기반 글로브를 사용하며, 코드 주석 내 spec 링크가 일관된 형식(anchor URL)을 쓰도록 권장되는 프로젝트 패턴.
- **상세**: 같은 파일의 `isNodeWaitingForInput` JSDoc(frontend, L750)은 "spec §전이 원자성" 처럼 섹션명 산문 참조를 썼다. 위반은 아니나 파일 내 다른 주석(예: `spec/5-system/4-execution-engine.md §7.5`, `spec/conventions/node-output.md`) 들은 파일경로+섹션 형태로 작성돼 있어 일관성 낮음.
- **제안**: JSDoc spec 참조를 파일경로+앵커 형태(`spec/5-system/4-execution-engine.md §1.1 "원자성 보장"`)로 통일. 규약 갱신 불필요.

---

### 3. INFO — 테스트 파일에서 `status` 문자열 리터럴 직접 사용 (enum 상수 미사용)

- **target 위치**: `codebase/frontend/src/lib/websocket/__tests__/apply-execution-snapshot.test.ts` 여러 `it` 블록 — `status: "running"`, `status: "waiting_for_input"`, `status: "completed"` 등을 string literal 로 직접 사용
- **위반 규약**: 직접 금지 조항은 없으나 `spec/conventions/interaction-type-registry.md` §1 이 enum 값의 단일 진실 위치를 강조하며, exhaustive switch 를 통한 TS 컴파일러 검증 패턴을 권장함.
- **상세**: 테스트 fixture 에서 타입 단언(`as never`)을 써서 string literal 로 직접 주입하는 패턴은 프로덕션 코드가 enum/union 으로 보호돼 있는 값을 테스트만 우회하는 구조다. `NodeExecutionStatus` enum 이 `backend/node-execution.entity.ts` 에 있고 프론트는 string union 이라, frontend 테스트에서는 enum 상수 import 가 어렵다는 현실적 이유가 있다. 규약 위반은 아님. INFO 수준.
- **제안**: `as never` cast 대신 테스트 전용 타입-safe factory (`createNodeExecution({ status: "running" })`) 를 두면 미래 status rename 시 컴파일 오류로 보호됨. 단기 조치 불필요.

---

### 4. INFO — `reconcilePreParkWaitingStatus` 함수의 문서화 주석이 spec 섹션 참조 형식 혼재

- **target 위치**: `codebase/backend/src/modules/executions/executions.service.ts` L189 — `spec/5-system/4-execution-engine.md §전이 표 "원자성 보장"` 괄호 인라인 참조
- **위반 규약**: spec/conventions 에 직접 해당 항목 없음.
- **상세**: 백엔드 동기 변경 필요 주석(`@see` 스타일 경고)이 JSDoc 에 삽입된 것은 유용하며 프로젝트 패턴과 일치한다. spec 링크 형식이 일부 주석과 다른 점만 INFO 로 기록.
- **제안**: 해당 없음 — 현행 유지 가능.

---

## 요약

이번 diff 는 `spec/5-system/4-execution-engine.md` 의 "원자성 보장" 및 blocking 노드 전이 계약(§1.1·§1.3)을 read-side normalization 으로 방어하는 구현이다. spec 에 명시된 intra-row inconsistency 창(outputData 봉투 선저장 + status 컬럼 atomic 전이 사이)을 frontend `isNodeWaitingForInput` + backend `reconcilePreParkWaitingStatus` 로 대칭 처리했으며, 두 함수의 terminal row 제외 조건도 동일하게 유지됐다. `spec/conventions/` 의 정식 규약(spec-impl-evidence, node-output, interaction-type-registry, execution-context) 에 대한 직접 위반은 발견되지 않았다. 발견된 4건은 모두 INFO 등급으로, 코드 주석 형식 일관성·export 주석 표현 수정 등 소폭 제안이다. 정식 규약 채택 시 다른 시스템의 invariant 를 깨는 항목은 없다.

---

## 위험도

NONE
