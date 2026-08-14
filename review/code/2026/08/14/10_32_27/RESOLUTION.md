# RESOLUTION — `10_32_27` (+ consistency `10_32_29`)

ai-review **CRITICAL 0 / WARNING 9** (forced 7명 전원). consistency **BLOCK: YES** —
그 CRITICAL 은 planner 인계(아래 §consistency). WARNING 9건 전부 조치.

## W1 (보안) — 보안 수정을 하면서 새 결함을 넣었다

**조치 완료.** 지적이 정확했고 **직접 재현했다**:

```
out.keep = 2            (정상)
__proto__ 키 보존?  false   ← 값이 조용히 사라진다
프로토타입 오염?    true
null 대입 시 hasOwnProperty  undefined  ← 하류 TypeError
```

초판은 매 레벨에서 `out = {}` 를 만들고 `out[k] = s` 로 채웠다. `JSON.parse` 결과에 own
`__proto__` 가 있으면 그 키가 own property 로 남지 않고 프로토타입을 갈아친다(CWE-1321).

### 무엇이 실제 방어인지 실측으로 갈랐다

처방을 넣은 뒤 뮤테이션했더니 **테스트가 살아남았다.** 원인을 파 보니:

| 형태 | 오염 |
|---|---|
| `{}` + bracket 대입 | **발생** |
| `{...obj}` + bracket 대입 | 없음 |

즉 **load-bearing 방어는 스프레드**다 — `CreateDataProperty` 라 own `__proto__` 를 옮기고,
그 own 속성이 상속 접근자를 가린다. `Object.defineProperty` 는 그 위의 중복 방어라 판별할
게 없었던 것이다. JSDoc 이 defineProperty 를 방어라고 적고 있었는데 **잘못된 귀속**이라
정정했다 — 다음 사람이 스프레드를 안전하게 바꿔도 된다고 오해하면 그 자리가 다시 열린다.

### 테스트도 처음엔 vacuous 였다

첫 fixture 는 `__proto__` 값 안에 strip 대상이 없어 **대입 분기에 들어가지도 않았다.**
`__proto__` 의 **값 안에** `llmCalls` 를 넣어 자식이 바뀌게 하니 비로소 위험 지점을 통과한다.
최종 확인: 스프레드를 `{}` 로 되돌리는 뮤턴트에서 **RED**.

## W3 (유지보수성) — "할당 없음" 이 구현보다 넓은 주장이었다

**조치 완료.** JSDoc 은 "common path 는 allocation 이 없다" 고 했는데 실제로는 매 레벨에서
`out = {}` / `value.map()` 을 만들고 변경이 없을 때만 버렸다. 최상위 identity 만 보존됐다.
형제 `sanitizeInner` 처럼 **진짜 지연 할당**(`out: T | null = null`, 필요할 때만 스프레드)
으로 바꿔 주장과 구현을 맞췄다. 이 저장소에서 반복 지적된 패턴이라 특히 아프다.

## W4 (보안) — 깊이 상한이 호출 순서에 의존했다

**조치 완료.** 형제와 같은 `MAX_SANITIZE_DEPTH` 를 적용. 지적대로 현재는 모든 호출부가
`sanitizePayloadForWs` 를 먼저 거쳐 우연히 유계였지만, **호출 순서에 기대는 불변식은 함수
자신의 방어가 아니다.**

## W2 (성능) — 유예하되 근거를 실측했다

hot path 에서 순회가 두 번이라는 지적. A/B 로 쟀다(8턴 `turnDebugHistory` waiting payload,
N=3000):

| | ms/emit |
|---|---|
| 옛 depth-1 | 0.0112 |
| 현행 재귀 | 0.0314 (**2.80배**, +20.2 µs) |

두 pass 를 합치지 않은 이유: `sanitizePayloadForWs` 는 **wire/fanout 분기 이전**에 돌아 두
채널이 공유하는데 내부 WS 채널은 `llmCalls` 를 받아야 한다. 합치려면 그 함수에 채널 개념을
넣어야 하고 credential 마스킹·`SANITIZE_CACHE`·depth 캡을 건드린다 — **20 µs 를 아끼려고
마스킹 로직을 흔들 이유가 없다.** 수치와 함께 JSDoc 에 남겼다.

## W5·W6·W7 (테스트/요구사항) — 전부 조치

- **W5**: identity 테스트가 이름은 "envelope 동일" 인데 자식(`nodeOutput`)만 봤다 →
  `expect(fanout.payload).toBe(wire)` 추가
- **W6**: nested strip 테스트에 **대조군이 없었다**. 같은 블록의 다른 테스트는 전부
  "fanout 은 strip / wire 는 보존" 짝을 갖는데 이것만 빠졌다 → wire 단언 추가.
  이게 없으면 **payload 를 통째로 날리는 구현도 GREEN** 이다
- **W7**: 테스트 JSDoc 이 "strip 은 depth-1 이다" 를 **현재형**으로 썼다(같은 diff 가 그걸
  바꿨는데) → 과거형 정정

## W8 (plan) — 이미 조치됨

커밋 `a9574f823`. 처방 선택이 (b)→(a) 로 **뒤집힌 것**과 이름 충돌이 **분리된 것**을 기록.

## W9 (문서화) — CHANGELOG 항목 추가

정보 노출 수정에 항목이 없었다. 두 누출 경로·수신자·"선언이 참이 아니었다" 를 적고,
**이미 전송된 데이터**라 운영 판단이 필요하다는 점을 명시했다.

## consistency `10_32_29` — CRITICAL 은 planner 인계

`turnDebug` 이름 충돌(top-level object vs `nodeOutput.meta.turnDebug` 배열)은 **이 diff 가
만든 게 아니다** — 체커도 "이번 diff 는 거기서 새는 secret 을 막는 정당한 보안 패치" 라고
적었다. 위험은 예정된 §6.2 재작성이 그 이름을 그대로 spec 에 옮겨 고착시키는 것이라,
`spec-draft-eia-62-waiting-payload.md` 에 planner 인계로 등재했다.

## 검증

- `__proto__` 테스트: 스프레드→`{}` 뮤턴트에서 **RED**(판별력 확인)
- 누출 프로브: 두 경로 모두 RED → 수정 후 GREEN, 내부 WS 대조군 유지
- 전체 백엔드 **422 suites / 8629 passed** · lint(`--max-warnings 0`) · ratchet 199/38

## 넘김 (근거 명시)

| # | 처분 |
|---|---|
| INFO 2 (사용자 노드 출력이 `llmCalls` 라면 함께 사라짐) | 이름 기반 strip 의 의도된 트레이드오프. 현재 grep 상 collateral 0. `result.outputs` 외부 노출 작업 착수 시 재점검하도록 plan 에 연결됨 |
| INFO 3 (`stripDeep`/`sanitizeInner` 스켈레톤 중복) | 통합하면 두 함수의 다른 의미(strip vs redact, 캐시 유무)가 섞인다. 한쪽 수정 시 짝점검하는 관례로 충분 |
| INFO 4 (`EXTERNAL_STRIPPED_FIELDS` O(n)) | 원소 1개 |
| INFO 6 (routing context × nested strip 조합 테스트) | 두 기능이 같은 경로를 공유하나 상호작용 없음. `attachRoutingContext` 리팩터 시점이 자연스러운 착수점 |
| INFO 7 (순환 참조 실패 모드 서술) | 결론(가드 미도입)은 유지하고 문구만 정확히 — `JSON.stringify` 가 어차피 `TypeError` 를 낸다는 점을 명시했다 |
