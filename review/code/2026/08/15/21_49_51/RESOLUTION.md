# RESOLUTION — `21_49_51` (branch `claude/ws-event-types-extract`)

Critical **0** · Warning **1** · INFO 9. Warning 반영, INFO 2건 반영.

---

## Warning (testing) — default 바인딩 미인식 (FN) · **반영**

지적이 옳다. 무수정 프로브로 재현했다:

```ts
import Def9, { type ExecutionChannelEvent as R1 } from '../websocket/websocket.service';
```
→ **6/6 GREEN, 미검출.**

**그리고 이건 내 직전 수정이 만든 결함이다.** `21_14_51` 에서 인라인 `type` 오탐(FP)을 고치며
판정을 "네임드 바인딩 유무 + 값 이름 수" 로 바꿨는데, 그 조합에서 `import Def, { type Bar }` 는
"네임드 있음 + 값 이름 0" 이라 통과해 버린다. **FP 를 고치다 FN 을 만들었다.**

### 그래서 조건을 덧대는 대신 형태를 소진했다

조건을 하나씩 붙이는 한 이 진자(FN↔FP)는 멈추지 않는다. `ImportClause` 는 부분이 **셋뿐**이다 —
clause 자체의 부재 · default `name` · `namedBindings`(namespace 또는 named). 유한하므로
**전수로 소진**할 수 있고, 소진하면 새 경우가 생기려면 TS 문법이 바뀌어야 한다.

`importLeavesValueEdge(clause)` / `exportLeavesValueEdge(decl)` 가 각 형태를 빠짐없이 훑는다.
INFO1(import·export 분기 로직 중복)도 같은 수정에서 닫혔다 — 공통부는
`namedBindingValueNames()` 하나이고 판정 지점은 함수 둘뿐이다.

### 소진이 실제로 완전한지 형태별로 전수 검증

**20 RED / 8 GREEN**, 원복 후 baseline GREEN.

| 축 | 뮤턴트 (RED 가 정답) | 음성 대조 (GREEN 이 정답) |
|---|---|---|
| `ImportClause` 전수 | clause 부재 · default 단독 · **M21 default+전부type** · default+값named · default+namespace · namespace 단독 · 값named 단독 | 선언 `import type` · 인라인 type 단독 · 인라인 type 여럿 · `WebsocketService` 네임드(DI 정당) |
| `export … from` | `export *` · `export * as ns` · 값 named · **`export { WebsocketService }`**(예외 없음이 의도) | `export type … from` · `export { type … }` |
| require/동적 | top-level require 구조분해 · `import = require` | 함수 안 require · 동적 import |
| 타입 모듈·표시 | 타입모듈 import · 타입모듈 함수 안 require · 타입 전용을 `type` 없이 | — |
| **새 캐너리** | 타입모듈 `export default` · 서비스 `export default` · `export` 키워드 제거 · allowlist 죽은 경로 | — |

리뷰어가 제안한 **"`export default` 없음" 전제의 캐너리화**도 넣었다. 세 번째 테스트의
`WebsocketService` 예외는 네임드 바인딩만 면제하므로, 대상 모듈에 default export 가 생기면
`import Anything from '…'` 이 새 우회로가 된다. 이제 그 전제가 깨지면 즉시 RED 다.

---

## INFO

| # | 처분 |
|---|---|
| 1 import/export 분기 로직 중복 | **반영** — W1 수정에 흡수. 공통부는 `namedBindingValueNames` 하나 |
| 4 "선언 존재" 만 확인, `export` 여부 미확인 | **반영** — `ts.getModifiers` 로 `ExportKeyword` 확인. 뮤턴트("`export` 키워드 제거") RED |
| 2 re-export 3중 수동 동기화 | 무조치 — `tsc` fail-closed (4라운드 연속 합의) |
| 3 가드의 test-layer 배치 | 무조치(후속) |
| 5 3·5번째 테스트가 각각 전체 재파싱 | 무조치 — 스위트 2.5초 내 |
| 6 spec 6곳 정본 위치 stale | 등재됨 — planner 턴 (developer 권한 밖) |
| 7·8·9 | 확인용 기록 |

---

## 6라운드 수렴 판정

| 라운드 | 발견 | 성격 |
|---|---|---|
| `19_27_37` | gateway 가 순환에서 안 빠졌다 | **제품 코드** |
| `20_05_17` | 가드가 `export … from` 미검출 | 가드 FN |
| `20_27_08` | 가드가 별칭으로 예외 오판정 | 가드 FN |
| `20_50_49` | 가드가 `require()` 미검출 → **열거 통합** | 가드 FN |
| `21_14_51` | 가드가 인라인 `type` 오탐 → **대조군 확장** | 가드 FP |
| `21_49_51` | 가드가 default 바인딩 미인식 → **형태 소진** | 가드 FN (내 FP 수정의 부산물) |

제품 코드 결함은 1라운드가 마지막이다. 이후 다섯은 전부 가드 자신이고, 세 번의 구조 조치
(열거 통합 → 대조군 확장 → **형태 소진**)를 거쳤다.

**이번 조치가 앞선 둘과 다른 점**: 앞의 둘은 커버리지를 넓힌 것이라 "또 뭔가 빠졌을 수 있다" 가
남았지만, 이번은 **유한한 AST 형태를 전수로 소진**했다. 같은 축에서 더 나올 형태가 없다는 것이
문법상 보장된다.
