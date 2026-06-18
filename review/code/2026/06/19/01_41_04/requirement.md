# 요구사항(Requirement) 리뷰 결과

리뷰 대상: EngineDriver `@internal` JSDoc 대칭 + `graph-dispatch.types.ts` leaf 이동 (C-1 후속 ①)

---

## 발견사항

### INFO: `@internal` 누락 — 초기 7 EngineDriver 멤버
- 위치: `/codebase/backend/src/modules/execution-engine/engine-driver.interface.ts` lines 36–84
- 상세: `updateExecutionStatus`, `stageDurableResumeSnapshot`, `buildRetryReentryState`, `buildResumeCheckpoint`, `isCheckpointEligibleNodeType`, `contextKeyOf`, `applyPortSelection` — 초기 7개 멤버에는 `@internal` 태그가 없다. 커밋 메시지는 이 결정을 명시 정당화한다: "초기 7멤버는 impl 도 @internal 미보유라 멤버별 대칭상 제외 — scope 유지". 즉 의도적 비대칭이며 추후 별도 정리 대상 백로그로 남긴 것. 현 변경 범위 내에서는 버그가 아니다. 단, `EngineDriver` 인터페이스가 "엔진 내부 전용 계약"(spec §Rationale C-1 line 1465)임에도 일부 멤버에 `@internal`이 없으면 향후 소비자가 혼동할 여지가 있다.
- 제안: 현 PR 범위 유지(INFO). 별도 타스크로 초기 7멤버에도 동일 `@internal` 추가 고려.

### INFO: orphan 주석 위치
- 위치: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` line 395
- 상세: `// ─── Helper Interfaces moved to ./types/graph-dispatch.types.ts ─────` 주석이 `ExecutionEngineService` 클래스 JSDoc 블록과 `@Injectable()` 데코레이터 사이에 위치한다. 이 위치는 클래스 JSDoc (`/** ... */`)이 닫힌 직후이므로, 기술적으로는 클래스에 속하지 않는 독립 파일 레벨 주석이다. 동작·빌드에 영향 없음. 안내 목적 주석으로 허용 가능.
- 제안: 변경 불요 (INFO).

### INFO: [SPEC-DRIFT] spec §Rationale C-1 EngineDriver 멤버 목록 불완전
- 위치: `spec/5-system/4-execution-engine.md` line 1464
- 상세: spec Rationale C-1 에 EngineDriver 멤버를 `buildRetryReentryState`·`buildResumeCheckpoint`·`isCheckpointEligibleNodeType` 3개만 예시로 나열한다. 실제 인터페이스에는 C-1 step2 계약(7개: `updateExecutionStatus`, `stageDurableResumeSnapshot`, `buildRetryReentryState`, `buildResumeCheckpoint`, `isCheckpointEligibleNodeType`, `contextKeyOf`, `applyPortSelection`) + step4 계약(5개: `rehydrateContext`, `loadAndBuildGraph`, `runNodeDispatchLoop`, `findActivatedBackEdge`, `clearLlmDefaultConfigCache`) = 총 12개가 존재한다. spec 자체가 "본 분할은 spec 무변 — 메서드 물리 위치는 spec 이 정의하지 않는 구현 재량 영역"이라 명시하므로 코드가 틀린 것이 아니라 spec 예시 목록이 최신 인터페이스를 반영하지 않는 것이다. 코드가 합리적이고 의도적이며 되돌리는 것이 오답이다.
- 제안: 코드 유지 + spec 갱신. `spec/5-system/4-execution-engine.md` §Rationale C-1 line 1464의 EngineDriver 멤버 목록을 전체 12개(또는 "최소 seam 원칙에 따라 필요한 멤버를 추가해왔다"는 산문)로 갱신. 반영 대상: project-planner/spec-update 경로.

---

## 요약

이번 변경은 순수 refactor(행위 무변)이며 의도한 세 가지 목표(①EngineDriver 신규 5멤버 `@internal` 대칭 추가, ②`ExecutionCancelledError` `@internal` 추가, ③`ExecutionGraphState`·`NodeDispatchLoopParams` leaf 타입 모듈 분리)를 모두 완전히 달성했다. 기능 완전성·엣지 케이스·에러 시나리오·반환값 측면에서 인터페이스 계약이 구현(`ExecutionEngineService`)과 정확히 일치한다. `ExecutionCancelledError`가 execution-engine 모듈 외부(`park-release-signal.ts`)에서 값 import 없이 주석 참조만 되므로 `@internal` 태그는 현실 사용 패턴에 부합한다. `graph-dispatch.types.ts` leaf 이동 후 두 소비자(engine-driver.interface.ts·execution-engine.service.ts) 모두 새 경로에서 정확히 import 하며, 다른 소비자가 service.ts 에서 직접 import 하는 잔류 케이스도 없다. spec fidelity 측면에서는 spec이 EngineDriver 멤버를 불완전하게 열거하나 이는 "spec 무변" 선언으로 인한 의도적 생략으로 코드-버그가 아닌 spec 갱신 누락이다.

## 위험도

NONE
