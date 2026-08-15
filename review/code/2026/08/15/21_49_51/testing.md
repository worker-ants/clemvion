# 테스트(Testing) 리뷰

## 검토 방법

이번 diff(38개 파일)는 `websocket.service.ts` 가 함께 export 하던 enum/타입을 의존성-프리 모듈
`websocket-events.types.ts` 로 추출한 순환-해소 리팩터이며, 이미 5라운드(`19_27_37` ~
`21_14_51`)의 코드 리뷰가 진행되어 정적 가드(`websocket-events.types.spec.ts`)가 매 라운드
새 문법 형태(`export … from`, 별칭 FN, `require()`, 인라인 `type` 오탐)를 잡아내며 성장해 온
이력이 `review/code/**/RESOLUTION.md` 에 기록돼 있다. 이번 라운드에서는 ①`websocket-events.types.spec.ts`
의 핵심 함수(`moduleRefs`, `leavesValueEdge`)를 직접 열어 지금까지의 뮤테이션 매트릭스(M1~M20,
N1~N9)가 다루지 않은 문법 조합이 남아 있는지 실제 `typescript` 파서로 프로브했고,
②`execution-event-emitter.service.spec.ts` 의 `TERMINAL_SHAPE` 커버리지, ③영향받은 스펙
파일들의 실제 실행(`jest`)을 확인했다.

`npx jest src/modules/websocket/websocket-events.types.spec.ts
src/modules/execution-engine/events/execution-event-emitter.service.spec.ts
src/modules/websocket/websocket.service.spec.ts` → **3 suites / 56 tests PASS**.

## 발견사항

- **[WARNING]** 가드의 간선 열거 함수가 "default import + 전부 `type` 태그된 named import" 조합을 값 간선 누락(FN)으로 오판정한다 — 이 PR 이 4라운드 연속 찾아낸 것과 **같은 결함 클래스**의 5번째 사례
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` 함수 `leavesValueEdge`(정의부 약 134~142행), 그리고 `moduleRefs` 내 `ts.isImportDeclaration` 분기(약 156~173행, `named`/`names` 계산부)
  - 상세: `leavesValueEdge(declTypeOnly, hasNamedBindings, valueNameCount)` 는 `ImportDeclaration.importClause.name`(default import 바인딩)을 전혀 보지 않는다. `moduleRefs` 도 `clause?.namedBindings` 만 읽고 `clause?.name` 은 무시한다. 그 결과 `import Def, { type Bar } from '...'` 형태는 — 실제 `typescript` 컴파일러 API 로 직접 파싱해 확인한 결과 `clause.name.text === 'Def'`(값 바인딩 존재), `clause.namedBindings` 는 `Bar` 하나만 담은 `NamedImports`(전부 `isTypeOnly`) — `names = []` 로 필터링되어 `leavesValueEdge(false, /*hasNamedBindings*/ true, /*valueNameCount*/ 0)` → `false` 를 반환한다. 즉 `Def` 라는 실재하는 eager 값 바인딩이 있음에도 "값 간선 없음" 으로 판정된다. 이는 정확히 이 파일의 존재 이유("간선을 세는 곳은 하나뿐이다 — 새 문법이 생겨도 고칠 곳은 한 곳")를 스스로 위반하는 지점이고, `20_05_17`(`export … from` 미검출)·`20_27_08`(별칭 FN)·`20_50_49`(`require()` 미검출)·`21_14_51`(인라인 `type` 오탐) 이 찾아낸 결함들과 **동일한 "distinguishing input 누락" 패턴**이다.
  - 현재 실exploitability: `websocket.service.ts`/`websocket-events.types.ts` 어느 쪽도 `export default` 가 없음을 grep 으로 확인했다 (`grep -n "export default" websocket.service.ts websocket-events.types.ts` → 0건). 따라서 `import Def, { type X } from '../websocket/websocket.service'` 형태는 오늘은 **`tsc` 자체가 "no default export" 로 컴파일을 막아** 실제로 우회 경로가 되지 못한다 — 그래서 CRITICAL 이 아니라 WARNING 으로 낮춘다. 다만 이 가드 함수는 `websocket.service`/`websocket-events.types` 전용이 아니라 범용 AST 유틸로 설계되어 있고("새 문법이 생겨도 고칠 곳은 한 곳"), 두 대상 모듈 중 하나가 미래에 편의상 `export default` 를 추가하면(드물지만 가능) 이 blind spot 이 조용히 살아난다.
  - 제안: 뮤테이션 매트릭스에 `default import + 전부 type-tagged named import`(예: `import WS, { type ExecutionEventType } from '...'`) 형태를 M21 로 추가하고, `leavesValueEdge` 시그니처에 `hasDefaultBinding: boolean` 인자를 더해 `clause?.name` 유무를 반영하도록 수정 권장. 대상 모듈에 `export default` 가 없다는 전제 자체를 캐너리로 남기려면(선택) `websocket-events.types.spec.ts` 의 두 번째 테스트("값·타입 선언이 실제로 존재") 근처에 "`export default` 가 없다" 를 명시적으로 단언해 두면, 향후 누군가 default export 를 추가하는 순간 이 가드의 전제가 깨졌음을 즉시 알 수 있다.

- **[INFO]** "값·타입 선언이 실제로 이 모듈에 있다" 테스트가 `export` 여부가 아니라 선언 존재만 확인한다
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` 두 번째 `it` (`declared.add(st.name.text)` 블록)
  - 상세: `ts.isEnumDeclaration`/`isInterfaceDeclaration`/`isTypeAliasDeclaration` 만 확인하고 `ExportKeyword` modifier 유무는 보지 않는다. 이론상 `enum ExecutionEventType {...}` 를 `export` 없이 선언해도 이 테스트는 통과한다(실제로는 그 경우 소비자 쪽 `tsc` 가 즉시 깨지므로 실질 위험은 낮다). 이 테스트의 존재 목적("첫 번째 단언이 공허해지는 것 방지")에 한정하면 현재로도 충분하지만, 완전성 기준으로는 근소한 갭.
  - 제안: 필요 시 `ts.canHaveModifiers(st) && ts.getModifiers(st)?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)` 조건을 추가. 우선순위 낮음(INFO).

- **[INFO]** `TERMINAL_SHAPE` 회귀 커버리지는 양호 — `emitTerminalExecution` 스펙이 3개 variant(completed/failed/cancelled) 전부와 `error`/`cancelledBy` 의 null-vs-부재 구분까지 단언한다
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.spec.ts` `describe('emitTerminalExecution — 종결 payload wire 형태', …)`
  - 상세: `TERMINAL_SHAPE` 를 호출 시점 인라인에서 모듈 스코프 상수로 되돌린 변경(이번 diff 의 유일한 실행-순서 의존 변경)에 대해, 세 분기(`completed`/`failed`/`cancelled`)의 파생 결과(`eventType`, `status`)를 각각 실제 mock 호출 인자로 단언하는 테스트가 이미 존재한다. `error: null` 유지(§6.4)와 `cancelledBy: 'user'` 시 `error` 키 자체 부재(§6.5)를 `Object.keys(wire)`/`'error' in wire` 로 직접 검증하는 것도 정확하다(`toHaveBeenCalledWith` 가 `{error: undefined}` 를 통과시키는 함정을 스스로 문서화하고 우회함). 회귀 관점에서 추가 요청 사항 없음.
  - 제안: 없음(확인용 기록).

- **[INFO]** `websocket-events.types.spec.ts` 는 `SRC_ROOT` 전체를 반복 파싱하는 정적 가드로, 실제 소스 트리 상태에 의존하는 결정론적 테스트 — 격리 문제 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` `collectOffenders`/`allTsFiles`
  - 상세: 파일시스템을 읽기만 하고 어떤 파일도 쓰거나 변형하지 않으므로 테스트 간 의존성·오염 위험은 없다. `collectOffenders` 가 3번째·5번째 `it` 에서 각각 `SRC_ROOT` 전체를 재파싱하는 비효율은 있으나(파싱 결과 캐시 없음), 현재 스위트가 수 초 내 통과하고(`jest` 실측 3 suites/56 tests, 2.5s) 테스트 정확성에 영향 없는 성능 관찰에 불과함.
  - 제안: 조치 불필요.

## 요약

이 PR 은 순수 import 경로 재배선 + 순환 해소 리팩터이고, 5라운드에 걸쳐 정적 가드
(`websocket-events.types.spec.ts`)가 실제 결함 클래스(`export … from` 미검출 → 별칭 FN →
`require()` 미검출 → 인라인 `type` 오탐)를 하나씩 뮤테이션으로 걷어낸 이력이 잘 문서화돼 있고,
`execution-event-emitter.service.spec.ts` 의 `TERMINAL_SHAPE` 회귀 커버리지도 3-variant +
null-vs-부재 구분까지 견고하다. 다만 이번 라운드에서 실제 `typescript` 파서로 직접 프로브한
결과, 가드의 핵심 함수(`leavesValueEdge`/`moduleRefs`)가 "default import + 전부
type-tagged named import" 조합을 값 간선 누락(FN)으로 오판정하는 지점을 새로 확인했다 — 지금까지
가드가 스스로 반복 발견해 온 것과 동일한 "distinguishing input 누락" 패턴의 다섯 번째 사례다.
다행히 오늘은 대상 모듈 둘 다 `export default` 가 없어 `tsc` 컴파일 자체가 이 우회 경로를 막고
있으므로 CRITICAL 은 아니지만, "새 문법이 생겨도 고칠 곳은 한 곳" 이라는 이 가드의 설계 전제를
좁게 만드는 잔여 갭이라 WARNING 으로 기록한다. 그 외 회귀 대상 스펙 25개 파일은 전부 기계적
import 경로 교체만 포함하고, 관련 스펙 3개 스위트(56 tests) 실측 PASS 를 확인했다.

## 위험도

LOW
