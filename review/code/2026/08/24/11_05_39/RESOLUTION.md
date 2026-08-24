# RESOLUTION — `11_05_39`

RISK=LOW · CRITICAL=0 · WARNING=3. **3건 전부 처리**했고, 근거가 선 INFO 1건도 함께 했다.

## W3 (requirement) — "emit 5곳" 은 **6곳**이었다. 내 정량 오류다

`grep` 으로 직접 셌다:

```
form-interaction.service.ts:344
ai-turn-orchestrator.service.ts:1541
ai-turn-orchestrator.service.ts:1636      ← 이 둘을 하나로 셌다
button-interaction.service.ts:581
execution-engine.service.ts:6120
execution-engine.service.ts:6381
```

**6곳**이다. `ai-turn-orchestrator` 의 두 분기(FAILED/COMPLETED)를 하나로 셌다 — 앞선
조사에서 **내가 열어 본 것만 세고** 숫자를 썼다. 이 저장소가 반복 기록한 *"실측했다가
프록시였다"* 형태다.

**다섯 자리 전수 정정**: `websocket.service.ts` JSDoc · `websocket.service.spec.ts` JSDoc ·
`spec` §R17 정정 블록 · `plan/complete/sse-nodeoutput-allowlist.md` · 정본 트래커.
`grep "emit 5곳"` 이 0건임을 확인했다. §R17 과 트래커에는 **원문을 취소선으로 남기고**
breakdown 을 숫자와 함께 적었다 — 다음 사람이 "다시 찾지 말 것" 을 믿고 쓰기 때문이다.

## W1 (maintainability/documentation) — 리팩터가 JSDoc 을 떼어 놨다

헬퍼(`narrowTopLevelNodeOutput`)를 추출하면서 **옛 JSDoc 이 그 자리에 남았다**. 그 문서는
*"`nodeOutput` **두 자리**를 좁힌다"* 라고 말하는데 헬퍼는 **키 하나**만 다루고,
정작 세 자리를 조립하는 chokepoint(`allowlistFanoutNodeOutput`)는 JSDoc 이 **없었다**.

**이 파일이 이미 같은 클래스의 결함을 기록해 둔 자리 바로 아래다** — `14_55_29`
maintainability W4(*"블록 JSDoc 을 뒀더니 붙을 선언이 없어 뒤따르던 선언의 문서로 읽혔다"*).
재발이다.

- `narrowTopLevelNodeOutput` — **최상위 키 하나**의 계약. `key` 가 유니온인 이유(같은 래퍼가
  이벤트에 따라 `nodeOutput`/`output` 두 이름으로 실린다)와 copy-on-change 를 적었다.
- `allowlistFanoutNodeOutput` — **세 자리 표**(waiting / buttons nested / `node.*`)와,
  `buttonConfig.nodeOutput` 만 인라인인 이유(중첩은 헬퍼 계약 밖), 4번째 중첩 자리가 생기면
  경로 기반으로 일반화한다는 조건.

## W2 (api_contract/documentation) — breaking-change 고지가 비대칭이었다

`#1208`(waiting 표면)의 CHANGELOG 항목은 *"외부 수신자에게는 동작 변경"* 고지를 담았는데,
이번 정정 블록은 **기술적 반증만** 적고 그 고지를 빠뜨렸다. 같은 종류의 변경인데 한쪽만
고지하면 **읽는 사람이 이번 건은 안전하다고 오해**한다.

CHANGELOG 와 EIA §R17 **양쪽에** 같은 문장을 넣었다 — `output` 최상위에서 목록 밖 키가
사라진다는 것, 과거 응답에는 `_retryState` 등이 **이미 노출돼 있었을 수 있다**는 것(그것을
닫는 게 목적), 알려진 소비처는 실측 무영향이지만 **제3자 webhook 구독자는 확인 범위 밖**
이라는 것(운영 로그 접근이 없어 표본 감사를 못 했다), 내부 WS 는 불변이라는 것.

## INFO 8 (testing) — `output` 경로의 4키 보존을 **직접** 단언한다

*"같은 헬퍼를 공유하니 논리적으로는 보장되지만 직접 증거는 없다"* 는 지적이 맞다. 4키
캐너리를 `node.completed` 경로에도 추가했다(`it.each` 4건).

**vacuous 하지 않음을 실증**했다 — allowlist 에서 `rendered` 를 빼는 뮤턴트에
`(waiting)` 과 `(node.completed)` **양쪽이 각각** RED 가 됐다(3 failed / 59 passed).
배선 제거로는 안 갈리는 이유는 이 넷이 **보존만 단언하는 단방향 가드**이기 때문이고,
그 성질은 plan 의 뮤테이션 표에 이미 적어 뒀다.

## 넘김 (사유)

- **INFO 5** (flat 폴백 발동 계측) — 좋은 제안이지만 **이 PR 이 만든 문제가 아니고**,
  로깅을 넣으려면 "무엇을 언제 남길지" 가 결정 하나다. 트래커의 그 항목(`finalAdapted ??
  nodeOutputCache`)에 **재개 신호로 이미 적혀 있다**.
- **INFO 2** (`buttonConfig` 인라인 중복) — 리뷰어가 *"4번째 nested 자리가 생기면"* 으로
  조건을 달았고, 그 조건을 JSDoc 에 **명문화**했다.
- **INFO 7** (describe 블록 배치) — 기존 트래커 항목의 연장. 이번에 늘어난 2건도 그 항목이
  덮는다.
- **INFO 6** (서사 5곳 중복) · **INFO 9** (dispatcher 통합 테스트 부재) · **INFO 1·3·4·10** —
  조치 불요이거나 이미 다른 게이트에서 처분됨.
