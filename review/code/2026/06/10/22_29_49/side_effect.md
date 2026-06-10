# 부작용(Side Effect) 리뷰

## 발견사항

### **[WARNING]** `deepFreeze` 가 shallow-copy 값 객체의 원본(공유) 참조를 비가역적으로 변형함
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts` — `freezeSharedCacheValues` + `deepFreeze` 호출 경로
- 상세: `{ ...context.nodeOutputCache }` 는 top-level 키를 새 객체에 복사하지만 값 객체(value object) 자체는 원본 `context.nodeOutputCache` 와 동일한 참조다. `deepFreeze(v)` 는 그 공유 참조에 직접 `Object.freeze` 를 적용하므로, branch 가 실행된 이후 부모 `ExecutionContext` 가 가리키는 값 객체도 frozen 상태가 된다. 이는 **함수 시그니처 외부의 상태(부모 컨텍스트 캐시 값 객체)를 비가역적으로 변경하는 부작용**이다. 현재 코드베이스에서 값 내부에 직접 assign 하는 패턴이 없어 즉각적인 TypeError 는 발생하지 않지만, 미래 핸들러가 값 내부를 mutate 하려 할 때 dev/test 에서만 TypeError 가 발생하고 production 에서는 통과하는 **진단 비대칭**이 생긴다. 이번 변경에서 JSDoc 에 "freeze 가 공유 참조에 적용됨"이 추가되어 의도적 설계임은 명시됐으나, 함수 시그니처·반환값·이름 어디에도 "입력 변형" 의미가 드러나지 않아 비직관적이다.
- 제안: `freezeSharedCacheValues` JSDoc 에 "@mutates — 값 객체(원본 참조)를 in-place frozen 으로 변형한다" 를 명시하거나, 함수명을 `freezeSharedCacheValuesInPlace` 등으로 변경해 호출자에게 변형 부작용이 있음을 시그니처 수준에서 전달한다.

### **[WARNING]** `FREEZE_BRANCH_CACHE` 가 `export const` 로 공개됨 — 인터페이스 확장 부작용
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts` 라인 36 (`export const FREEZE_BRANCH_CACHE = ...`)
- 상세: 이전 라운드(22_00_04)에서는 모듈 내부 전용 `const` 였던 상수가 이번 변경에서 `export const` 로 승격됐다. 목적은 테스트 전제 단언을 위한 것이나, 이로 인해 이 파일을 import 하는 모든 모듈이 이 상수를 소비할 수 있는 **공개 API 표면이 확대**됐다. 현재 유일한 소비처는 동일 모듈의 spec 파일이나, 향후 이름·의미·타입이 변경될 경우 모든 import 경로가 영향을 받는다. `@internal` 표기(diff 에 추가됨)가 있으나 TypeScript 컴파일러는 이를 강제하지 않는다.
- 제안: `/** @internal — test-only export (M-5 가드의 환경 전제 단언용). 프로덕션 코드에서 사용 금지. */` JSDoc 이 이미 추가된 것은 적절하다(diff 확인됨). 추가로, 현재 소비처가 spec 파일 1곳뿐이므로 위험은 낮지만, 모듈 배럴 파일(`index.ts`)이 있다면 해당 상수를 재-export 하지 않도록 주의한다.

### **[INFO]** `FREEZE_BRANCH_CACHE` 모듈 로드 시점에 `process.env.NODE_ENV` 를 읽어 전역 상수로 고정 (환경 변수)
- 위치: `parallel-executor.ts` 라인 36-37
- 상세: 모듈 최초 import 시점에 `process.env.NODE_ENV` 를 1회 평가해 상수로 고정한다. 이는 읽기 전용이고 환경 변수를 쓰거나 변경하지 않으므로 일반적인 부작용은 없다. 다만 이번 변경에서 음성 판별(`!== 'production'`)이 allowlist(`=== 'development' || === 'test'`)로 개선됐다 — 이는 `NODE_ENV` 미정의 시 production 에서도 freeze 가 켜지던 이전 동작을 수정한 올바른 방향이다. `jest.resetModules()` 없이 `NODE_ENV` 를 변경해도 이미 캐싱된 값은 갱신되지 않지만, 이는 명시된 설계 트레이드오프이며 JSDoc 에 기술되어 있다.
- 제안: 현행 유지. allowlist 방식 전환은 부작용 관점에서 개선이다.

### **[INFO]** `toEiaEvent` export alias 제거 — 인터페이스 표면 변경 확인됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` (alias 제거)
- 상세: 공개 export 였던 `toEiaEvent` alias 가 삭제됐다. 인터페이스 변경이나, 모든 런타임 참조가 `toChatChannelEvent` 로 교체됐고 grep 결과 잔류 import 0건이 확인됐다. breaking change 부작용 없음.
- 제안: 별도 조치 불필요.

### **[INFO]** `registerContinuationHandlers()` / `ContinuationBusService.on()` 제거 — 이벤트/콜백 흐름 전환
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.ts`
- 상세: `onModuleInit` 에서 in-memory listener 등록 경로가 완전 제거됐다. continuation 이벤트 dispatch 가 BullMQ Worker 단일 경로로 일원화됐으므로, **이벤트 발생·콜백 호출 구조가 변경됐다**. 의도된 Phase 2 전환으로 e2e 179건 통과로 커버 확인됐다. BullMQ Worker 가 실행되지 않는 일부 단위 테스트 모듈에서 continuation 이벤트가 silent drop 될 수 있으나, 이는 설계 범위 내다.
- 제안: 별도 조치 불필요.

### **[INFO]** `FAILED_DEGRADED_THRESHOLD` / `DELAYED_DEGRADED_THRESHOLD` 상수 제거 — 전역 상수 삭제
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/system-status/system-status.constants.ts`
- 상세: 모듈 로드 시 `process.env` 를 읽어 고정하던 두 상수가 제거됐다. 이는 **모듈 로드 시점 전역 상태 고정 제거**로 긍정적인 변경이다. getter 함수 패턴으로 완전 이행돼 테스트 격리와 런타임 반영이 개선됐다. 잔류 import 0건 확인됨.
- 제안: 별도 조치 불필요.

### **[INFO]** `plan/`, `review/` 하위 파일 신규 생성 — 파일시스템 부작용
- 위치: `plan/in-progress/spec-update-deadcode-cleanup.md`, `review/code/2026/06/10/22_00_04/` 하위 파일들
- 상세: 프로젝트 규약에 따른 정상 산출물 생성이다. `_retry_state.json` 에 `/Volumes/project/private/clemvion/...` 절대 경로가 포함되어 있으나, `review/` 는 gitignored 아님(기록 보존 정책)이며 이전 라운드에서 이미 "내부 저장소 현행 유지"로 결론난 사항이다.
- 제안: 현행 유지.

---

## 요약

이번 변경의 핵심 부작용 주의 지점은 두 가지다. 첫째, `deepFreeze` 가 branch context 의 shallow-copy 값 객체(원본 컨텍스트와 동일 참조)를 직접 `Object.freeze` 로 비가역 변형하는 구조다. JSDoc 에 의도임이 명시됐으나 함수 시그니처 상 비직관적이고, 미래 핸들러가 값 내부를 mutate 할 때 dev/test 에서만 TypeError 가 발생하는 진단 비대칭이 존재한다(prod 에서는 freeze 가 꺼지므로 silent pass). 둘째, `FREEZE_BRANCH_CACHE` 가 `export const` 로 공개됨에 따라 모듈 공개 API 표면이 확장됐다. `@internal` JSDoc 이 추가됐으나 컴파일러 강제가 없으므로 오용 가능성이 남는다. 두 사항 모두 dev/test 환경에만 영향을 미치고 production 동작은 무변경이다. 나머지 변경(deprecated 코드 제거, 전역 상수 삭제, 이벤트 흐름 BullMQ 일원화)은 의도된 설계 개선으로 부작용이 없거나 긍정적이다.

---

## 위험도

LOW

STATUS=success ISSUES=2
