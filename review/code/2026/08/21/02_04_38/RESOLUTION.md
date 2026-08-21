# RESOLUTION — 02_04_38

대상 SUMMARY: `review/code/2026/08/21/02_04_38/SUMMARY.md` (위험도 **MEDIUM**, Critical **0**, WARNING **3**, INFO 8)

**처분: WARNING 3건 전부 수정.** 셋 다 **직전 라운드에 내가 추가한 가드 자체의 결함**이다 —
핵심 기능(거부 로직·두 호출부·에러 봉투)은 4라운드에 걸쳐 CRITICAL 0 / WARNING 0 으로
수렴한 상태가 재확인됐다.

> 가드를 넣어 결함을 막으려다 **가드가 새 결함 표면이 됐다.** 이 PR 이 반복해 배운 형태의
> 또 한 판이다.

---

## WARNING 3 — `Object.freeze(new Set(...))` 는 **플라시보였다** (maintainability) — **수정**

가장 아픈 지적이다. 직접 실행해 확인했다:

```
Object.freeze(new Set(['a','b']))  →  .add('c') 성공, size 3
Object.freeze(['a','b'])           →  .push('c') TypeError
```

`Set` 의 데이터는 own property 가 아니라 **내부 슬롯**에 있어 `freeze` 가 닿지 않는다.

**그런데 직전 라운드 RESOLUTION 은 *"런타임 불변화되어 … 변형 파급을 차단"* 이라고 적었다** —
**존재하지 않는 보장을 문서가 서술**한 것이다. 이 시리즈에서 반복된 형태(문서한 보장이
구현보다 넓다)가 또 나왔고, 이번엔 그 문서를 내가 그 라운드에 직접 썼다.

- `MASKED_MARKERS` 를 `readonly string[]` + `Object.freeze` 로 교체(`isMaskedMarker` 는
  `.includes()`). 소비처는 실측 1곳뿐이라 교체 비용이 없었다.
- **캐너리로 기계에 맡겼다** — `Object.isFrozen` · `push` 가 `TypeError` · 주입된 값이 마커로
  판정되지 않음. `Set` 으로 되돌리면 RED.
- 직전 RESOLUTION 의 그 문단에 **반증 노트**를 달았다(지우지 않았다 — 틀린 주장이 어디서
  왔는지 남아야 같은 형태를 다음에 알아본다).

## WARNING 1 — 가드 정규식이 **주석 속 import 예시**를 오판 (architecture) — **수정**

내가 `importsBaseFn` 위에 단 JSDoc 예시(`import { ... } from '...'`)가 정규식에 걸려, 가드
자신과 형제 spec 이 "base 를 import 하는 파일" 로 잡혔다. 그걸 **허용목록에 얹어 은폐**했다.

> 그 은폐가 "죽은 허용목록 항목" 캐너리까지 무력화한다 — 진짜 죽은 항목이 생겨도 그 두
> 줄이 잡음으로 남는다. 그리고 나중에 무관한 파일이 문서에 같은 구문을 인용하면 엉뚱한
> CI 실패가 난다.

`stripCommentsAndStrings` 전처리를 넣어 근본을 고쳤고, 그 결과 **죽은 항목 캐너리가 스스로
자기참조 두 줄을 지목**해 허용목록에서 뺐다.

AST 파서로 가지 않은 이유: 판정 대상이 **import 문 하나**라 문법 표면이 좁다 — 정본 파서를
끌어오는 비용이 이득을 넘는다. 다만 주석·문자열 제거는 **안 하면 오판이 실제로 발생**했으니
그 부분만 처리했다.

## WARNING 2 — 가드의 **탐지 능력 자체가 무보증** (testing) — **수정**

리뷰어가 `findUnexpectedCallers` 의 제외 필터를 `.filter(() => false)` 로 무력화했더니
**3개 테스트 전부 GREEN** 이었다. 앞선 테스트들은 *"위반이 없다"* 만 확인하기 때문이다.

> 지키려는 것이 보안 불변식인데 가드 자체가 무보증이면 **없느니만 못하다** — 있다고 믿게
> 만든다.

임시 디렉터리에 **진짜 위반 파일**과 대조군(wrapper 만 쓰는 파일)을 만들어, 가드가 위반
파일만 정확히 지목하는지 확인하는 캐너리를 추가했다.

### 재검증 (뮤테이션 2종)

| 뮤턴트 | 이전 | 지금 |
| --- | --- | --- |
| 제외 필터 무력화(`.filter(() => false)`) | **전부 GREEN** (리뷰어 실증) | **RED** |
| `stripCommentsAndStrings` 제거 | — | **RED** (허용목록 밖 파일이 잡힘) |

## 미조치 INFO (8건)

전부 이전 라운드에서 이미 처분 확정 또는 리뷰어가 "조치 불요"·"필수 아님" 판정 — 최상위
`error.code` 선존 drift · Swagger description stale · `executeNode` 스코프 밖 · non-record
fail-open 상속(선존 계약) · webhook/schedule 행위 테스트 · 가드의 읽기 전용 fs 접근 ·
freeze 직접 캐너리(→ 이번에 W3 처리로 자연 해소) · `rawSource` 배열 케이스.

INFO-1(가드 자기참조 주석이 실제 매칭 메커니즘을 부정확하게 서술)은 **W1 수정으로 소멸**했다
— 자기참조 항목 자체가 없어졌다.

## 검증

TEST WORKFLOW 4단계 PASS —

| 단계 | 결과 |
| --- | --- |
| lint | PASS (48s) |
| unit | PASS — backend jest **429 suites / 8,865**(직전 8,862 대비 +3) |
| build | PASS (138s) + 타입체크 ratchet **199건/38파일 baseline 일치** |
| e2e | PASS (238s) — backend supertest **276** · playwright **51** (`51 passed (55.7s)` 실측) |
