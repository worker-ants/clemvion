# RESOLUTION — `22_51_46`

RISK=LOW · CRITICAL=0 · WARNING=4. **4건 전부 처리**했고, INFO 중 근거가 선 3건도 함께
처리했다. 나머지 INFO 는 사유를 적고 넘긴다.

## WARNING

### W1 (side_effect / api_contract) — REST 표면이 조용히 넓어졌다 → **캐너리로 의도 고정**

지적이 정확하다. 목록이 하나라 chat-channel 때문에 넣은 4키가 **REST `getStatus` 에서도**
통과한다. 표면별로 목록을 가르는 대안은 손-동기화 지점을 둘 만들므로 택하지 않고, 대신
**그 확장이 의도임을 테스트가 말하게** 했다.

- `interaction.service.spec.ts` 에 캐너리 추가 — 4키가 REST 응답에 남고, **같은 응답에서
  `_retryState` 는 여전히 떨어진다**. 확장이 allowlist 의 본래 목적을 훼손하지 않았다는
  것까지 한 테스트가 함께 고정한다.
- 실측: 이 넷을 **REST 로 읽는 소비처는 현재 없다** — 위젯은 `output.rendered` 처럼 한 겹
  아래로 읽는다. 즉 노출 표면은 넓어지되 **깨는 것은 없다**.

### W2 (testing) — `buttonConfig` 분기의 copy-on-change 미검증 → **캐너리 + 뮤테이션 M5**

지적이 정확하다. 기존 동일성 테스트는 **top-level 분기만** 고정했고, `buttonConfig` 쪽
`if (narrowed !== inner)` 를 지워도 잡는 테스트가 없었다.

- `buttonConfig.nodeOutput` 이 이미 깨끗한 fixture 로 `fanout.payload.buttonConfig` 참조
  동일성을 단언하는 캐너리 추가(envelope 자체 동일성도 함께 — 한 층만 보면 나머지 층의
  재구성을 놓친다).
- 뮤테이션 **M5** 로 등재해 실행: 그 가드만 제거 → 이 캐너리만 RED.

### W3 (documentation) — CHANGELOG 서술이 이제 거짓 → **취소선 + 정정**

`CHANGELOG.md` Unreleased 가 *"SSE·fanout 은 여전히 deny-list(잔여)"* 라 적고 있었다.
이 저장소의 자기정정 관례대로 원문을 **취소선으로 남기고** 정정 블록을 달았다 — 유예 사유가
실측으로 반증됐다는 사실과, 목록이 **9키→13키**(실측)로 넓어진 이유를 함께 적었다.

### W4 (api_contract) — 하위 호환 동작 변경 공지 → **기록했다. 단 로그 감사는 못 했다**

*"배포 전/후 webhook payload 로그에서 `nodeOutput` 최상위 키 분포를 표본 감사하라"* 는 이
세션에서 **수행 불가**다(운영 로그 접근 없음). **못 한 것을 했다고 적지 않는다.**

대신 **한 것**: CHANGELOG 정정 블록에 *"외부 수신자에게는 동작 변경"* 임을 명시하고,
알려진 두 소비처(위젯·chat-channel)는 실측으로 영향 없음을, 제3자 webhook 구독자는
**확인 범위 밖**임을 함께 적었다. 코드 변경을 막을 사유는 아니라는 리뷰어 판단에 동의한다.

## INFO — 처리

- **#5 (requirement)**: plan frontmatter `spec_impact` 에 `6-websocket-protocol.md` 누락 → 추가.
- **#11 (documentation)**: `node-output-allowlist.ts` 헤더의 *"`getStatus` 는 둘 다 지난다"* 가
  소비처 하나만 언급 → *"`getStatus` 와 `toFanoutEnvelope` 는 둘 다"* 로 정정.
- **#2 (security)**: 동명 필드 disambiguation — 이미 spec 각주로 반영됨(확인만).

## INFO — 넘김 (사유)

- **#3 (performance) `.includes()` → `Set`**: **안 한다.** `NODE_OUTPUT_ALLOWED_KEYS` 는
  `as const` 튜플이고 그 리터럴 타입이 컴파일타임 assertion
  (`PublicHandlerOutputKey extends (typeof …)[number]`)의 입력이다. `Set` 으로 바꾸면 그
  결속이 사라지고, 조회용 `Set` 을 따로 파생하면 **두 번째 자료구조 = 두 번째 동기화 지점**이
  생긴다 — 이 PR 이 내내 없애 온 형태다. 13원소 선형 탐색의 비용보다 그쪽이 비싸다.
  (자매 `WIRE_PRESERVED_FIELDS` 가 `Set` 인 것은 그쪽에 타입 결속이 없기 때문이다.)
- **#7·#8 (maintainability) 반복 패턴·축약 변수명**: 소비 지점이 **둘**인 지금 헬퍼로 묶으면
  파라미터로 경로를 넘기는 간접층이 생겨 오히려 읽기 나빠진다. 리뷰어도 *"3번째가 생기면"*
  으로 조건을 달았다 — 그 조건이 재개 신호다.
- **#9 (maintainability) JSDoc 표 ↔ 배열 미러링**: 이번 라운드에 그 표를 배열과 동기화하고
  *"요약이 아니라 함께 갱신되어야 하는 미러"* 라고 명시했다(`22_26_33` W3). 파생 생성은
  리뷰어 조건대로 **그룹 4개 이상**에서.
- **#10 (testing) 명시 `null` 분기**: `typeof null === 'object'` 를 피하려는 방어 분기이고,
  이미 있는 `제거할 필드가 없으면 … 동일 객체` 테스트가 무변경 경로를 지난다. 우선순위 낮음.
- **#1·#4·#6·#12**: 조치 불요(설계 트레이드오프 확인 / 긍정 평가).
