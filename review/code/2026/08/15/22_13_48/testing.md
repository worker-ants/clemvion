# 테스트(Testing) 리뷰 — `22_13_48`

## 검토 방법

이 브랜치(`claude/ws-event-types-extract`)는 이미 6라운드(`19_27_37`→`20_05_17`→`20_27_08`→
`20_50_49`→`21_14_51`→`21_49_51`)의 `/ai-review` + fix 사이클을 거쳤다. 직전 라운드
(`21_49_51`)의 testing WARNING("default import + 전부 `type` 태그된 named import 조합을
값 간선 누락(FN)으로 오판정")이 최종 fix 커밋 `eeaf9c3ba`(`importLeavesValueEdge` /
`exportLeavesValueEdge` 로 AST 형태 소진)로 반영됐는지, 그리고 그 fix 자체가 새 결함을
들여오지 않았는지를 이번 라운드의 초점으로 삼았다.

- `git show eeaf9c3ba` 로 마지막 델타 전문을 직접 대조.
- `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` 전체(399줄)를
  `Read` 로 열람하고, `importLeavesValueEdge`/`exportLeavesValueEdge`/`namedBindingValueNames`
  의 분기를 직접 AST 규칙과 대조해 무수정 프로브(마음속 뮤테이션)로 재검증.
- `execution-event-emitter.service.spec.ts`, `websocket.service.spec.ts` 를 열어 관련 회귀
  커버리지가 유지되는지 확인.

## 발견사항

- **[INFO]** 직전 라운드(`21_49_51`) W1(default 바인딩 FN) 수정이 실제로 유효함을 확인
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` 함수
    `importLeavesValueEdge`(142-151행), `exportLeavesValueEdge`(154-160행)
  - 상세: `import Def, { type Bar } from '...'` 케이스를 손으로 재추적했다 —
    `clause.isTypeOnly` false → `clause.name`(`Def`) 존재 → 143-146행에서 조기 `return true`.
    직전 라운드가 겪은 "네임드 바인딩 유무 + 값 이름 수" 만 보던 결함(그 조합에서 `hasNamedBindings=true,
    valueNameCount=0` 이 되어 값 간선을 놓쳤던 것)이 `ImportClause` 의 세 부분(clause 부재 ·
    default `name` · `namedBindings`)을 전수 분기하는 구조로 바뀌면서 닫혔다. `export` 쪽도
    형태가 셋(`export * from` · `export * as ns from` · named)뿐이라 같은 방식으로 소진돼 있다.
    새로 도입된 "두 모듈 어디에도 `export default` 가 없다" 캐너리 테스트(318-335행)도 세 번째
    테스트의 `WebsocketService` 예외가 네임드 바인딩에만 적용된다는 전제를 문서화·고정한다.
  - 제안: 없음 — 확인용 기록.

- **[INFO]** 새 캐너리("두 모듈 어디에도 `export default` 가 없다")가 `export { X as default }`
  형태를 놓친다 — 다만 이 갭이 실제 방어선(offender-scan)을 무력화하지는 않는다
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts:318-335`
    (`it('두 모듈 어디에도 export default 가 없다...')`)
  - 상세: `hasDefault` 판정은 `ts.isExportAssignment(st)`(`export default expr;` / `export = expr;`)와
    `getModifiers(st)?.some(DefaultKeyword)`(`export default class/function`) 두 형태만 본다.
    그런데 default export 는 named-export-list 별칭으로도 만들 수 있다 —
    `export { WebsocketService as default };` 는 `ExportDeclaration`(exportClause 가
    `NamedExports`, 스페시파이어 `name.text === 'default'`) 이지 `ExportAssignment` 도 아니고
    statement-level modifier 도 없다. 이 형태가 `websocket.service.ts` 에 추가돼도 이 캐너리는
    `hasDefault: false` 를 반환해 통과한다(정적으로 손으로 확인 — 이 저장소에 현재 이런 export
    는 없음, 재현 실행은 안 함). 다만 **이게 실제 우회로가 되지는 않는다**: 337-359행의
    핵심 offender-scan 은 대상 모듈에 실제로 default export 가 있는지를 확인하지 않고, 소비
    파일 쪽에서 `import Def from '.../websocket.service'` 형태(named 바인딩 없음)를 만나면
    352행 `if (!r.names.length) return true;` 로 **항상** offender 로 분류한다 — `WebsocketService`
    예외는 named import 에만 걸려 있어 default-form import 는 애초에 예외를 못 탄다. 즉 이
    캐너리는 "예외 판정의 전제를 문서화·재확인"하는 자기-점검용이지, 그 자체가 우회 차단의
    유일한 방어선은 아니다 — 그래서 CRITICAL/WARNING 이 아니라 INFO.
  - 제안: `hasDefault` 계산에 `ts.isExportDeclaration(st) && st.exportClause && ts.isNamedExports(st.exportClause) && st.exportClause.elements.some(el => el.name.text === 'default')` 분기를 추가하면 이 캐너리 자체의 완전성이 올라간다. 급하지 않음(우선순위 낮음) — 실제 방어선은 이미 이 형태를 독립적으로 막고 있다.

- **[INFO]** `TERMINAL_SHAPE` 모듈-스코프 승격에 대한 회귀 커버리지는 견고하되, 재발 감지는
  여전히 "부수 대량 실패"에 의존한다 (누적 관찰, 신규 아님)
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.spec.ts`
    `describe('emitTerminalExecution — 종결 payload wire 형태', …)` (80-152행)
  - 상세: 3-variant(completed/failed/cancelled) + `error`/`cancelledBy` 의 null-vs-부재 구분까지
    단언하는 커버리지 자체는 훌륭하다. 다만 이 스펙은 `WebsocketService` 를 `'../../websocket/websocket.service'`
    에서 직접 값으로 import 해 mock 을 주입하므로(28-30행), 프로덕션이 실제로 겪는
    `websocket.service ↔ websocket.gateway ↔ event-emitter` 순환 그래프를 재현하지 않는다.
    즉 이 스펙 자체는 "순환이 되살아나 `TERMINAL_SHAPE` 가 `undefined` 를 읽는" 회귀를 **직접**
    잡지 못하고, 그 회귀는 여전히 (문서화된 대로) 전체 스위트 426개 중 다수가 부수적으로
    깨지는 방식으로만 드러난다. 이 트레이드오프는 앞선 라운드들의 dependency/side_effect
    리뷰가 이미 인지·수용했고("정적 가드가 없다" INFO, 무조치 처분), 이번 라운드에 새로
    악화되지 않았다.
  - 제안: 없음 — 이미 반복 검토·수용된 항목이므로 재지적만, 조치 요구 아님.

## 회귀 확인

- 6라운드에 걸쳐 성장한 뮤테이션 매트릭스(M1~M21, N1~N9, 이번 라운드 기준 20 RED / 8 GREEN)가
  `git show eeaf9c3ba` 의 구조 변경(`leavesValueEdge` 단일 함수 → `importLeavesValueEdge`/
  `exportLeavesValueEdge`/`namedBindingValueNames` 3분할) 이후에도 깨지지 않는지, 로직을
  손으로 재추적해 기존에 RED 였던 대표 케이스(`export … from` 재유입, 별칭 FN, `require()`
  미검출, 인라인 `type` 오탐)가 여전히 각 함수 조합에서 올바르게 판정됨을 확인했다 — 새 구조가
  기존 커버리지를 되돌리지 않는다.
- 25개 프로덕션/spec 파일의 `websocket.service` → `websocket-events.types` import 경로 교체는
  전부 기계적 1:1 치환이며, 로직 변경이 없어 회귀 위험이 낮다.

## 요약

이 PR 의 정적 가드(`websocket-events.types.spec.ts`)는 6라운드에 걸쳐 "지목된 인스턴스만
고친다 → 다음 라운드에 새 형태가 나온다"는 실패 패턴을 스스로 인지하고, 열거를 단일 지점
(`moduleRefs`)으로 통합한 뒤 마지막에는 `ImportClause`/`ExportDeclaration` 의 유한한 AST
형태를 전수 소진하는 구조(`importLeavesValueEdge`/`exportLeavesValueEdge`)로 수렴했다.
직전 라운드가 지적한 default 바인딩 FN 은 이번 라운드가 검토한 최종 커밋(`eeaf9c3ba`)에서
실제로 닫혀 있음을 로직 재추적으로 확인했다. 새로 찾은 유일한 갭은 새로 추가된 "no default
export" 캐너리 테스트 자신이 `export { X as default }` 별칭 형태를 못 본다는 것인데, 이 형태가
실제로 발생해도 핵심 offender-scan 테스트가 독립적으로 이미 차단하고 있어 익스플로잇 경로가
없다 — 그래서 INFO 로 낮춰 기록한다. `execution-event-emitter.service.spec.ts` 의 종결 이벤트
wire 형태 회귀 커버리지도 견고하다. Critical/Warning 급 테스트 결함 없음.

## 위험도

NONE
