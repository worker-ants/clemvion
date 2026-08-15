# RESOLUTION — `16_44_28`

ai-review **CRITICAL 0 / WARNING 2** · 위험도 **LOW**. **코드 변경 없음** — 둘 다 문서다.

리뷰어의 결론을 그대로 인용한다: *"코드 자체의 결함이 아니라 관찰성/문서 hygiene 개선이므로
이번 PR 을 막을 필요는 없음"*.

## 수렴 판정

| 라운드 | 성격 |
|---|---|
| `16_04_38` | WARNING 4 — **동작/커버리지 2건**(cascade WHERE 미검증 · 헬퍼 미재사용) |
| `16_19_26` | WARNING 2 — **커버리지 1건**(Execution `WHERE id` 미검증) |
| `16_31_53` | WARNING 1 — **계약 테스트 1건**(트랜잭션 중간 실패) |
| `16_44_28` | WARNING 2 — **선존 구조 1 · 내 문서 stale 1** |

커버리지 갭이 라운드마다 하나씩 줄어 0이 됐고, 마지막 라운드의 신규 지적 중 이 PR 이
유발한 것은 **문서 stale 1건**뿐이다.

## W1 — `claimResumeEntry` 만 반대 순서로 잠근다 (concurrency) → **등재**

**실측** (`.update(Entity)` 등장 순서):

| 함수 | 잠금 순서 |
|---|---|
| `cancelParkedExecution` | Execution → NodeExecution |
| `markWebChatIdleTimeout` | Execution → NodeExecution |
| `finalizeStalledExhausted` | Execution → NodeExecution |
| **`claimResumeEntry`** | **NodeExecution → Execution** |

**유예 근거 (실측)**: 역전은 **선존**이다 — 자매 둘이 이미 `Execution → NodeExecution`
이었고 `claimResumeEntry` 만 반대였다. 이 PR 은 **세 번째를 같은 방향으로 맞춘 것**이라
자매 간 일관성은 오히려 개선됐다. Postgres 가 데드락을 자동 검출하고, 이번에 추가한
**실패-전파 테스트**가 hang·유령 상태가 없음을 잠근다.

정본 트래커에 표와 함께 등재했다(순서 통일 + 자매 JSDoc 캐비엇 2항목).

## W2 — 판별력 표가 라운드 1에 멈춰 있었다 (documentation) → **조치**

`eia-stalled-atomicity.md` 의 "판별력(뮤테이션)" 표가 **2행**인데, 같은 문서 하단
체크리스트는 **3라운드 조치 완료**를 정확히 적고 있었다 — 같은 문서 안에서 어긋났다.

이후 2라운드가 잠근 3개 뮤테이션 계약을 추가해 **5행**으로 갱신하고, 각 행에 라운드를
달았다. **이 표가 stale 이었다는 사실 자체**도 표 위에 적었다.

> 이 세션에서 *"체크박스는 갱신, 옆 산문은 stale"* 을 이미 세 번 겪었고, 이번엔 방향이
> 반대였다 — **체크리스트가 최신이고 표가 뒤처졌다.** 같은 문서 안에서도 두 서술이
> 갈린다는 뜻이다.

## INFO 처분

| # | 처분 |
|---|---|
| 1 (DB 왕복 2→4, 락 보유 연장) | 무조치 — 콜드 경로(워커 크래시), 밀리초 단위. **정확성이 명백히 우선** |
| 2 (`logger.warn` 타이밍 이동) | positive — 부분 상태에서 찍히던 로그가 커밋 후로 옮겨져 관측성도 같은 창을 닫았다 |
| 3 (첫째 UPDATE 단독 실패 미커버) | 무조치 — 코드 경로가 동일해 실질 위험 낮음 |
| 4 (실 DB 롤백 미검증) | **기등재** (`16_19_57` W1) |
| 5·6 (spyOn 반복 · 3중 골격) | 파일 전역 관례 / 정본 트래커에 defer 등재됨 |
| 7 (backstop race) | JSDoc 에 수용된 기존 노출. 이 PR 이 만들거나 넓히지 않았다 |

## 검증

- 백엔드 **425 suites / 8731 passed** · lint **0** · 타입 **199** · spec 가드 **2938**
- **TEST WORKFLOW e2e 276 passed — 최종 커밋 기준 재실측**
- 이 라운드의 편집은 **plan 문서뿐** — 코드 변경 0
- 누적 판별력: 트랜잭션 제거 **3/3** · `affected=0` 제거 · cascade WHERE 변조 ·
  Execution `WHERE id` 변조 **2** · 트랜잭션 예외 삼킴 — **전부 RED**
