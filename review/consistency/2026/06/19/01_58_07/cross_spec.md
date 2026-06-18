# Cross-Spec 일관성 검토 결과

**검토 모드**: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/4-execution-engine.md)
**diff-base**: origin/main
**변경 파일 (4개)**:
- `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/types/graph-dispatch.types.ts` (신규)
- `codebase/backend/src/modules/execution-engine/workflow-errors.ts`

---

## 발견사항

### [INFO] EngineDriver 인터페이스 내부 전용 주석과 spec 기술 일관성

- **target 위치**: `engine-driver.interface.ts` — 클래스 레벨 doc (`모든 멤버는 ENGINE_DRIVER 토큰을 통해서만 호출되는 엔진 내부 전용 표면`), 5개 신규 멤버 `@internal` JSDoc
- **충돌 대상**: `spec/5-system/4-execution-engine.md §Rationale "C-1 god-class strangler-fig 분할"` (라인 1465)
- **상세**: spec 은 EngineDriver 가 "엔진 내부 전용 계약"임을 이미 명시하고 있다. 구현의 `@internal` JSDoc 은 이 spec 기술과 완전히 일치한다. 충돌 없음 — 단순 코드-doc 동기화 상태 확인.
- **제안**: 동기화 상태 양호. 별도 조치 불필요.

### [INFO] `ExecutionGraphState` / `NodeDispatchLoopParams` 이동 — spec 미언급

- **target 위치**: `types/graph-dispatch.types.ts` (신규 leaf 타입 모듈), `execution-engine.service.ts` (기존 export 제거)
- **충돌 대상**: `spec/5-system/4-execution-engine.md` — 본 두 타입의 물리적 위치를 명시한 spec 구문 없음; `spec/conventions/interaction-type-registry.md §1` — `WaitingInteractionType` 은 여전히 `execution-engine.service.ts` 핀 유지 (이번 diff 미변경)
- **상세**: 두 타입의 이동은 `plan/in-progress/refactor/c1-engine-split.md §PR4 후속` 에서 "후속(impl-done INFO)"으로 명시적으로 계획된 작업이며, spec `code:` glob (`codebase/backend/src/modules/execution-engine/**`) 이 `types/` 하위 디렉토리를 자동 커버하므로 spec 갱신이 불필요하다. `WaitingInteractionType` 은 spec-pinned(`interaction-type-registry.md §1.2`)이며 이번 diff 에서 이동되지 않았다 — 핀이 여전히 유효하다.
- **제안**: 조치 불필요. spec 갱신 필요 없음 (glob 자동 커버 + 타입 위치는 spec 정의 영역 밖).

### [INFO] `ExecutionCancelledError` `@internal` 추가 — spec 언급 없음

- **target 위치**: `workflow-errors.ts` — `ExecutionCancelledError` 에 `@internal — execution-engine 모듈 내부 cancel 전파 전용 sentinel. 모듈 외부 직접 참조 금지.` 추가
- **충돌 대상**: `spec/5-system/4-execution-engine.md` — `ExecutionCancelledError` 에 대한 spec 직접 언급 없음; `ExecutionError` 계층 구조 설명(§7.5.2)에서 sentinel 역할은 암묵적으로 정의됨
- **상세**: spec §7.5.2 는 typed `ExecutionError` 계층을 설명하며 "모듈 외부 직접 참조 금지" 원칙을 코드 doc 수준에서 표현한 것이다. spec 은 타입의 공개/비공개 여부를 JSDoc 수준에서 정의하지 않으므로 충돌 없음. `plan/in-progress/refactor/c1-engine-split.md §PR4 후속`에 명시된 작업과 일치한다.
- **제안**: 조치 불필요.

---

## 요약

이번 diff 는 C-1 god-class 분할(PR #627) 완료 이후의 계획된 follow-up 정리 작업이다: (1) `EngineDriver` 인터페이스의 신규 5개 멤버에 `@internal` JSDoc 대칭 추가, (2) `ExecutionCancelledError` 에 모듈 내부 전용 sentinel 주석 추가, (3) `ExecutionGraphState`/`NodeDispatchLoopParams` 를 타입 레벨 순환 해소를 위해 중립 leaf 모듈(`types/graph-dispatch.types.ts`)로 이동. 세 변경 모두 `spec/5-system/4-execution-engine.md §Rationale "C-1 분할"`에서 이미 확정된 설계와 일치하며, 다른 spec 영역(data-flow, conventions, 4-nodes 등)의 어떤 정의와도 모순되지 않는다. `WaitingInteractionType` 은 `interaction-type-registry.md` 에 `execution-engine.service.ts` 위치로 spec-pinned 되어 있으나 이번 diff 에서 이동되지 않아 핀이 유효하다. spec `code:` glob 이 `execution-engine/**` 를 와일드카드로 커버하므로 신규 `types/` 하위 디렉토리도 자동 포함된다. 발견된 모든 사항은 INFO 등급 — 차단 요인 없음.

## 위험도

NONE

---

STATUS: OK
