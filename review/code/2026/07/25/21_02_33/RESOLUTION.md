# RESOLUTION — cascade 가 취소를 네트워크 장애로 오분류하던 문제

CRITICAL 2 / WARNING 4. **직전 커밋의 cascade 가 세 결함을 갖고 있었고** 전부 실측 확증 후 수정.

## 조치 항목

| # | 판정 | 조치 | 근거 |
|---|---|---|---|
| C1 | 수용 | catch 에서 `AbortError` 재throw (D4 우회) | catch 가 무조건 `*TransportFailedError` 로 감싸 handler D4 가 `port:'error'`+`*_TRANSPORT_FAILED` 로 매핑 → §5.1 의 `cancelled` 분류에 도달 못함. `database-query.handler.ts` 가 이미 쓰는 패턴 |
| C2 | 수용 | 취소는 `recordNetworkFailure` 를 부르지 않음 | 같은 catch 가 무조건 카운터를 올려, ParallelExecutor cancel-others-on-fail 로 형제 3개가 취소되면 **정상 integration 이 `error(network)` 로 강등**. §2.2 사전-aborted 경로에서는 결정적으로 발생 |
| W1 | 수용 | 리스너 해제를 `finally` 로 이동 | cleanup 을 `controller.signal` abort 이벤트에 걸었는데 **성공한 요청은 controller 를 abort 하지 않아** 그 이벤트가 안 터진다(실측: 성공 후 `upstream.abort()` 가 controller 를 abort → 리스너 생존). `executeWithRetry` 는 429/401 에 재귀하므로 재시도마다 누적. **내 주석이 "completion 시 해제" 라고 사실과 다르게 적혀 있었다** |
| W2 | 위임 | §6 표 두 행이 구현 후에도 `미구현 (Planned)` — `spec/` 권한 밖이라 `spec-update-node-cancellation-shutdown-classification` 에 추가 |
| W3 | 수용 | `§2.2` 오인용 정정 | §2.2 는 "CPU 바운드 / 즉시 완료 노드" 절이라 HTTP client 와 무관. 게다가 같은 테스트 주석이 "fetch 는 그대로 실행된다" 고 스스로 반대로 적고 있었다. 구현한 것은 §4 의 already-aborted 분기 |
| W4 | 수용 | prettier 미실행 2파일 → `--write` |

**timeout 과 취소를 구분한 것이 핵심**이다. 로컬 `timeoutMs` abort 도 `AbortError` 라, 무조건
재throw 하면 진짜 전송 장애가 카운터에서 빠진다. `upstream?.aborted` 로 갈랐다.

## 내 테스트가 vacuous 했다 — mutation 이 잡았다

`finally` 의 `removeEventListener` 를 제거해도 **89 passed** 였다. 확인해보니 spy 를 `abort()`
**뒤에** 걸고 `aborted === true` 를 단언하고 있었다 — 무조건 참인 것을, 검증 대상과 무관하게.

fetch 가 실제로 받은 signal 을 캡처해, 성공 후 `upstream.abort()` 했을 때 **그 signal 이 여전히
aborted 가 아님**을 단언하도록 재작성했다. 리스너가 살아있으면 이미 끝난 요청의 controller 를
abort 시키므로 true 가 된다. 재작성 후 mutation → **2 failed**.

## 부수 사고 — `git checkout` 이 미커밋 수정을 지웠다

mutation 원복에 `git checkout` 을 써서 아직 커밋하지 않은 C1·C2·W1 수정이 전부 날아갔다
(scratchpad 백업에서 복구). 이 저장소가 이미 학습한 "**커밋 먼저 → mutation**" 규칙을 어긴
것이고, 이후 mutation 은 커밋 후에 돌렸다.

## 비-vacuity 검증 (전부 치환 성공 확인 후)

| 뮤턴트 | 결과 |
|---|---|
| `AbortError` 재throw 제거 (C1) | **2 failed** |
| `upstream?.aborted` → `true` (timeout 도 취소로 오분류) | **2 failed** |
| `finally` 의 `removeEventListener` 제거 (W1) | **2 failed** (재작성 후) |

> 첫 mutation 라운드는 prettier 가 조건문을 여러 줄로 쪼개 **치환이 하나도 안 됐는데** 전부
> "통과" 로 보였다. 이후 모든 뮤턴트에 치환 성공 단언을 붙였다.

## TEST 결과

- lint: **PASS**
- unit: **PASS** (14) / integration 노드 스위트 **640 passed**
- build: **PASS**
- e2e: **통과** (259 passed)

## 보류·후속 항목

- W2 §6 표 갱신 → planner 위임 (위 링크).
- INFO1(abort-cascade 3중 복제: http-request + 신규 2곳) — 공용 헬퍼 추출 제안. 이번 PR 은
  commerce 2건 범위라 `http-request.handler.ts` 는 건드리지 않았다. 다만 **같은 리스너 누수가
  거기에도 있다**(선재) — 별도 후속으로 남긴다.
