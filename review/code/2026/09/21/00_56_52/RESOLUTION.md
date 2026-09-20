# RESOLUTION — 스케줄 동시 DELETE 감사 중복 (리뷰 3라운드)

2라운드 조치로 `codebase/**` 가 바뀌어 돌린 fresh 라운드. **Critical 0 · Warning 1** — 조치했다.

## 조치 항목

| SUMMARY # | 발견 | 조치 |
|---|---|---|
| WARNING 1 (testing) | 2라운드에서 `!affected` → `affected === 0` 으로 바꾼 **그 이유**(«모른다»(null·undefined)를 «없다»(0)로 읽지 않는다)를 붙드는 테스트가 없다. 스위트의 `affected` 값이 `0`·`1` 뿐이라 **`=== 0` 을 `!affected` 로 되돌리는 뮤턴트가 32건 전건 GREEN 으로 살아남는다**(리뷰어 실측). 자매 함수 `rewriteTriggerConfigLocked` 는 정확히 그 형태의 대조군을 갖고 있어 비대칭이다 | 자매 테스트와 **같은 형태**(`for (const affected of [undefined, null])`)로 대조군 둘을 추가했다 — 트리거 경로와 `triggerId` 없는 방어 분기 각각. 둘 다 «404 로 뒤집지 않고 정상 종료하며 감사를 남긴다» 를 단언한다 |

INFO 12건은 조치 불요이거나 이미 등재됐다(`3-schedule.md` 문서 격차 · BullMQ `removeJob` 중복 ·
`triggerId` NOT NULL 로 도달 불가한 방어 분기 · 세션 마무리 단계의 트래커 갱신).

## TEST 결과

- lint : 통과 · unit : 통과(schedules 54건) · build : 통과 · e2e : **통과 371/371**

### 뮤테이션 검증 — 리뷰어가 «살아남는다» 고 실측한 그 편집을 다시 넣었다

`affected === 0` 두 곳을 `!affected` 로 되돌린 뮤턴트:

| | 대조군 추가 전 (리뷰어 실측) | 추가 후 (이 라운드) |
|---|---|---|
| 결과 | **32건 전건 GREEN** — 뮤턴트 생존 | **2건 RED** (52 GREEN) |

즉 이 라운드가 추가한 것은 «판정이 맞다» 가 아니라 **«그 판정을 그렇게 쓴 이유»** 를 붙드는 테스트다.
`cp` 백업·원복, `git checkout` 미사용.

## 보류·후속 항목

- `IntegrationsService.remove()` — 같은 계열의 남은 자리(1라운드 전에 트래커 등재, grep 0→1 확인).
- BullMQ `removeJob` 중복 호출 · `3-schedule.md` §4 문서 격차 — 세 문서·트래커에 이미 등재된 잔여.
