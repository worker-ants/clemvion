# RESOLUTION — `12_26_36`

ai-review **CRITICAL 0 / WARNING 8**. 4건 조치, 4건 유예(전부 트래커 등재 확인).

**이 라운드가 잡은 두 건은 내가 직전 턴에 만든 것이고, 그중 하나는 내가 방금 RESOLUTION 에
쓴 교훈을 그 자리에서 반복한 것이다.**

## W1 — 내가 추가한 두 메서드가 회귀 테스트를 죽였다 (testing)

**조치 완료. 리뷰어 주장을 실측으로 재현한 뒤 고쳤다.**

`markExecutionCancelled` 의 `affected=0`(다른 worker 가 먼저 처리) 회귀 테스트가 vacuous
상태였다. 이 PR 이 그 메서드에 `.setParameter()` / `.returning()` 을 추가했는데, 해당
테스트의 QB mock 에는 두 메서드가 없다 → `TypeError` → **함수 전체를 감싼 `try/catch` 가
삼킴** → 검증하려던 `if ((result.affected ?? 0) > 0)` 분기가 아예 실행되지 않는다.

**검증**: 가드를 `if (true)` 로 뮤테이션했더니 **12 passed, 0 failed — 생존**. 리뷰어 주장이
정확했다. mock 에 두 메서드를 넣은 뒤 같은 뮤턴트를 다시 걸어 **RED(1 failed)** 확인.

**자매 전수**: 스크립트로 `update` 체인 mock 전체를 훑어 `setParameter`/`returning` 누락을
셌다 → **1건**(이 자리)뿐. 리뷰어가 말한 나머지 17곳은 앞선 라운드에 이미 정정됐다.

> **교훈**: 프로덕션 코드에 체인 메서드를 추가하는 것은 **그 코드를 부르는 모든 mock 을 깨는
> 편집**이다. 그런데 `try/catch` 가 있는 함수에서는 깨짐이 실패로 드러나지 않고 **테스트를
> 조용히 무력화**한다. 이 PR 에서 vacuous mock 이 네 번째다.

## W7 — 같은 오버플로가 자매 write 경로에 그대로 있었다 (requirement)

**조치 완료.** `executions.service.ts` 의 `stop()` REST 경로가
`finishedAt.getTime() - startedAtMs` 를 **무가드로** 같은 `duration_ms INTEGER` 컬럼에 쓴다.
이 PR 이 CRITICAL 로 두 번 잡은 것과 **글자 그대로 같은 연산**이다.

`resolveTerminalDurationMs` 로 교체(`?? 0` 으로 종전의 "startedAt 부재 → 0" 동작 보존).

**검증**: 24.8일 넘긴 RUNNING 실행을 stop 하는 테스트를 추가하고, 클램프를 종전 코드로
되돌린 뮤턴트에서 **RED — 받은 값 `2233883648`** (int4 상한 `2147483647` 초과를 실증).

> 이 저장소의 기록된 교훈이 *"하드닝을 자매 함수에 미적용"* 이다. 이번엔 리뷰어가 자매를
> 찾아 줬다.

## W2 — 프런트엔드는 status 로 못 가른다 (side_effect)

**근본 수정 유예 — 그리고 리뷰어가 권고한 방향이 오답이라는 것을 실측으로 보였다.**

리뷰어 지적 자체는 옳다. 나는 직전 턴에 소비처 3곳 중 backend 2곳만 고치고 **프런트엔드
Duration 컬럼 4곳을 남겼다** — 내가 그 턴 RESOLUTION 에 *"자매를 전수로 세라"* 라고 쓰면서
그 자리에서 반복했다.

**그러나 권고된 "frontend status 분기" 는 틀린다.** 실측:

- `stop()` REST 취소도 `CANCELLED` 를 쓴다 (`stoppable: [RUNNING, PENDING]`)
- `RUNNING → CANCELLED` 의 duration 은 **진짜 실행 시간**이다
- 프런트엔드는 **직전 상태를 볼 수 없다**

따라서 `status === 'cancelled'` 로 지우면 정상 동작하던 표시를 깨뜨린다. 근본 해결은
**필드 분리**(`waitMs`)이고 이미 트래커에 있다. 트래커 표를 "backend 해소 / frontend 잔여"
로 갱신하고, **왜 순진한 필터가 오답인지**를 실측과 함께 적었다.

### 같은 실측이 내 AVG 수정도 검증했다

`status = 'completed'` 만 남긴 것이 옳은 이유가 여기서 나온다 — `finalizeStalledExhausted`
가 `FAILED` 라서 **FAILED 도 이 PR 로 오염**된다. 오염되지 않은 상태는 `completed` 하나뿐이다.
좁히려던 내 직관(`completed`+`failed`)은 틀렸을 것이다.

**다만 그 필터는 지표 정의를 바꾼다.** 종전에 집계되던 정상 실패·stop 취소의 실제 duration
이 평균에서 빠진다. 사용자에게 보이는 숫자가 이동하므로 **CHANGELOG 에 명시 고지**했다 —
직전 턴에는 이 사실을 적지 않았다.

## W3 — 배제 전제가 반증됐다 (user_guide_sync)

**조치 완료.** 앞선 4라운드(`10_18_38`~`11_09_44`)의 `user_guide_sync` 가 *"UI 표시값 불변"*
이라는 전제로 이 항목을 배제했는데, 이번 라운드가 diff 실측으로 그 전제를 반증했다.

`run-results.mdx` KO/EN 양쪽에 캐비엇 추가 — 취소·타임아웃 종료 실행의 "소요 시간"은 대기
시간을 포함할 수 있고, 완료 실행은 언제나 실제 처리 시간이라는 구분.

> **교훈**: 리뷰어의 **배제 사유**도 실측 대상이다. 네 라운드가 같은 전제를 물려받았다.

## 유예 4건 — 전부 트래커 등재 확인

| # | 항목 | 유예 근거 |
|---|---|---|
| 4 | `finalizeCancelledExecution` DB≠emit | `updateExecutionStatus` 는 boolean 만 반환. 트래커 등재 확인 |
| 5 | retry-turn CANCELLED 재진입 DB≠emit | spec §6.5 에 알려진 예외로 명시. 트래커 등재 확인 |
| 6 | REST/push `durationMs` 비대칭 | 필드 부재일 뿐 계약 위반 아님. CHANGELOG·spec·트래커 3중 고지 |
| 8 | `emitExecution(payload: unknown)` | **이번 라운드가 트래커 등재를 실측 확인** — 직전 라운드 지적이 닫혔다 |

## INFO 처분

| # | 처분 |
|---|---|
| 1 (이중 호출) | 무조치. O(1) 순수함수, 3라운드 공통 확인 |
| 2 (`?? null` 이 죽은 코드) | 무조치. 방어적 중복이고 제거 이득이 없다 |
| 3 (주석 3중 복제) | 무조치. 타입 분리는 의도적 |
| 4 (필드명이 두 의미) | W2 와 같은 항목 — 필드 분리로 수렴 |
| 5 (트래커 표 drift) | **조치** — W2 에서 함께 갱신 |
| 6 (plan 현재형 서술) | 무조치, 비차단 (9라운드째 확인) |
| 7 (컬럼명 하드코딩·값 e2e) | 트래커 등재됨, 범위 밖 |

## 검증

- 백엔드 **425 suites / 8710 passed** · lint `--max-warnings 0` **0 errors**
- 타입 **199** (래칫 일치) · frontend docs 가드 **20 files / 2931 passed**
- W1 판별력: 뮤턴트 **생존 → 수정 → RED** (전후 대조)
- W7 판별력: 클램프 제거 뮤턴트에서 **RED**, 실제 값 `2233883648` 로 초과 실증
