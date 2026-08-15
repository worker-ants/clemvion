# 테스트(Testing) 리뷰 — ws-event-types-extract fix 커밋 (branch `claude/ws-event-types-extract`)

## 개요

이번 diff 는 직전 리뷰 라운드(`19_27_37`)의 Warning 5건에 대한 fix 커밋이다. 테스트 관점의
핵심은 W5 (`websocket-events.types.spec.ts` 신설, 회귀 가드 4 tests)와 W1 (`websocket.gateway.ts`
import 전환)이다. 신설 가드 테스트를 직접 읽고, `jest`로 실행하고, 실제로 스크래치 파일을
worktree 안에 만들어 뮤테이션을 주입해 각 `it`이 무엇을 실제로 검출/미검출하는지 실측했다
(작업 종료 후 `git status` 로 원상복구 확인 완료, 저장소 변경 없음).

## 발견사항

- **[WARNING] 신규 회귀 가드의 세 번째 테스트("enum 값을 `websocket.service` 경유로 가져오는 파일이 없다")가 `export … from` 형태의 재유입은 검출하지 못한다 — 같은 파일의 JSDoc·2번째 테스트가 명시한 커버리지 범위보다 좁다**
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` 함수 `moduleSpecifiersOf`(gate 64-94, `import`/`export … from`/`import = require()`/동적 `import()` 4종 전부 TS 파서로 탐지)와 `describe(...)` 블록 세 번째 `it`(gate 131-164, "enum 값을 `websocket.service` 경유로 가져오는 파일이 없다") 비교.
  - 상세: 파일 헤더 JSDoc(gate 20-24)은 "모듈 간선은 `import` 말고도 `export … from`(re-export) · `import x = require()` · 동적 `import()` · `require()` 로도 생긴다. 그래서 정규식이 아니라 **TypeScript 파서로 모든 module specifier 를 센다**"고 명시한다. 이 정밀 탐지(`moduleSpecifiersOf`)는 **첫 번째 `it`(TYPES_FILE 자기 자신 검사)에만** 적용된다. 그런데 "제3의 파일이 `websocket.service` 에서 enum 값을 값으로 가져가지 않는가"를 저장소 전체(`allTsFiles(SRC_ROOT)`, ~1,230 파일)에 대해 검사하는 세 번째 `it`은 **별도로 손으로 짠 검사**이고, `ts.isImportDeclaration(st)` 인 statement만 순회한다(gate 140). `export`/`require`/동적 `import()` 분기가 없다.
    실측: worktree 안에 `codebase/backend/src/modules/websocket/__scratch_reexport_probe.ts` 를 만들어
    ```ts
    export { ExecutionEventType } from '../websocket/websocket.service';
    ```
    를 추가한 뒤 `npx jest src/modules/websocket/websocket-events.types.spec.ts` 를 실행 — **4/4 GREEN** (검출 안 됨). 즉 새 파일이 `export … from '../websocket/websocket.service'` 형태로 enum 값을 재유입해도 이 가드는 통과한다. `export … from` 은 ES 모듈에서 live binding 을 만들어 `import` 와 동일하게 순환 간선이 되므로, 정확히 이 가드가 막으려는 결함 클래스(#1174 재발)를 실제로 재현할 수 있는 경로다. (프로브 파일은 확인 후 즉시 삭제, `git status --porcelain codebase/backend/src/modules/websocket/` 로 clean 확인함.)
  - 이 갭이 왜 우연이 아닌지: 같은 파일이 "narrow 하게 짠 자매 검사"가 정밀 검사와 다른 커버리지를 갖는 패턴을 이미 한 번 겪었다 — 직전 라운드 W1(`19_27_37`)의 근본 원인도 "두 제외 규칙 중 하나만 잡혔다"였다(`RESOLUTION.md` "같은 스크립트에 제외 규칙이 두 개 있었고 둘 다 정확히 문제 파일을 들어냈다"). 이번엔 테스트 쪽에서 같은 형태(정밀 탐지 함수 vs 손으로 짠 병렬 검사)의 불일치가 재현됐다.
  - 제안: 세 번째 `it` 도 `moduleSpecifiersOf` 를 재사용하도록 리팩터(다만 `moduleSpecifiersOf` 는 특정 statement가 아니라 파일 전체의 specifier 문자열만 반환하므로, "값 import 인지 type-only 인지"·"WebsocketService 만인지" 구분 로직은 별도로 필요 — `ts.isExportDeclaration(node) && !node.isTypeOnly && node.exportClause` 케이스를 별도로 순회에 추가하는 최소 수정으로 충분). 뮤테이션 표에 "M7: 제3 파일이 `export { ExecutionEventType } from '../websocket/websocket.service'`" 를 추가해 RED 를 확인할 것.

- **[INFO] 회귀 가드가 저장소 전체(~1,230개 `.ts`)를 매 실행마다 TS 파서로 파싱하지만, 실측 성능은 문제없다**
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` `allTsFiles`(gate 96-104) + 세 번째 `it`
  - 상세: 우려와 달리 실측 `npx jest src/modules/websocket/websocket-events.types.spec.ts` 결과 약 1초 내 4 tests 완료. 구조적 타입체크 없이 순수 syntactic parse 만 하므로 저장소가 몇 배 커지기 전까지는 CI 시간에 유의미한 영향이 없을 것으로 판단.
  - 제안: 조치 불필요, 기록 목적.

- **[INFO] 회귀 테스트 유효성 재확인 — 이번 diff 로 유일하게 실질 로직이 바뀐 지점의 기존 테스트가 그대로 유효하다**
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.spec.ts` (import 경로만 변경, 로직 unchanged) — `TERMINAL_SHAPE[payload.type]` 파생을 호출 시점 지연평가에서 모듈 스코프 상수로 되돌린 변경을 이 파일의 `emitTerminalExecution` 관련 5개 `it`(completed/failed/failed-null/cancelled/cancelled-user)이 매번 실제로 평가하므로 여전히 커버한다.
  - 상세: 직접 실행해 확인 — `npx jest execution-event-emitter.service.spec.ts websocket.service.spec.ts websocket-events.types.spec.ts` → **3 suites / 55 tests 전부 PASS**. `websocket.service.spec.ts`(re-export facade 검증, guard 의 유일한 exempt 대상)도 enum 값을 실제로 다수 지점에서 소비하며 GREEN — RESOLUTION 이 주장한 "의도된 커버리지"가 실측과 일치한다.
  - 제안: 없음 (확인 목적의 기록).

- **[INFO] `websocket-events.types.spec.ts` 테스트 2번("값·타입 선언이 실제로 이 모듈에 있다")은 편도(one-way) 검사다 — `EXPECTED_EXPORTS ⊆ 실제 선언`만 확인하고 역방향은 확인하지 않는다**
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts:116-129`
  - 상세: `[...EXPECTED_EXPORTS].filter((n) => !declared.has(n))` 만 단언하므로, 파일에 `EXPECTED_EXPORTS` 목록에 없는 새 enum/interface/type alias 가 추가돼도 이 테스트는 실패하지 않는다. 의도적으로 관대하게 설계된 것으로 보이나(신규 export 추가 자체는 막을 이유가 없음), allowlist 성격의 테스트라면 보통 양방향을 기대하므로 명시해 둔다.
  - 제안: 낮은 우선순위. 현재 설계(신규 export 자유 허용)가 의도라면 조치 불필요.

## 요약

핵심 fix(W5: `websocket-events.types.spec.ts` 신설, W1: gateway import 전환)는 실측상 견고하다 — 실제로 `npx jest`를 돌려 4/4·55/55 GREEN을 확인했고, W1이 고쳤던 정확한 결함(gateway import 되돌리기)은 세 번째 `it`이 정적 `import` 형태로는 확실히 잡는다. 다만 그 세 번째 `it`은 자신이 속한 파일의 JSDoc과 자매 함수(`moduleSpecifiersOf`)가 명시한 "import·export-from·require·동적 import 4종 전부"라는 커버리지 범위에 못 미쳐, `export … from` 형태의 재유입을 놓친다는 것을 스크래치 파일로 직접 재현해 확인했다(4/4 GREEN으로 통과 — 미검출). 이는 이번 PR이 이미 한 번 겪은 "같은 방어를 자매 지점에 적용하지 못한다" 패턴이 테스트 코드 자체에서 재발한 것이라 WARNING으로 표기한다. 나머지 20여 개 import-path 전용 변경 파일들의 회귀 테스트는 컴파일·런타임 모두 영향 없음을 이전 라운드에서 이미 확인했고 이번 라운드에서도 재확인했다.

## 위험도

LOW
