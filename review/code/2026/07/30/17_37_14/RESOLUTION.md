# RESOLUTION — 17_37_14 (11차 라운드) — **수렴 판정**

**CRITICAL 0.** 14개 reviewer 전원 결과 확보, forced 화이트리스트 6명 미이행 없음,
skip·미완 0건. 개별 최고 위험도는 `maintainability` MEDIUM.

## 수렴 근거

발견의 성격이 세 단계로 내려왔다.

| 라운드 | in-diff 동작 결함 | 성격 |
|---|---|---|
| 1R~4R | 있음 | 종결 경로 — **매 라운드 직전 수정이 원인** |
| 5R | 없음 | 인접 pre-existing (plan W1) |
| 6R~7R | 있음 | 원자 claim **삽입 위치** |
| 8R | 있음 | **짝 전이가 절대 persist 안 됨** (pre-existing — 기능이 애초에 동작하지 않았다) |
| 9R~10R | 없음(코드) | 8R 수정의 **검증 부족** — 내 mutation 판정이 얕았다 |
| **11R** | **없음** | 구조·테스트 대칭·문서만 |

**소스 로직은 8R 이후 세 라운드 연속 무변경**이다. 9R·10R 의 Critical 은 "코드가 틀렸다" 가
아니라 "잠금 장치와 문서가 없다" 였고, 11R 에서 그 축의 Critical 이 사라졌다.

## 이번 라운드 조치 — 내가 직전 라운드에 만든 결함 2건

| SUMMARY # | 처분 | 내용 |
|---|---|---|
| W11 (user_guide_sync) | **수정** | 10R 에서 내가 추가한 EN 문단이 `Retryable`/`Not retryable` 목록을 **중간에서 끊었다**(KO 는 목록 뒤라 정상). EN 을 KO 와 동일 순서로 이동. 아울러 두 로케일의 뒤쪽 무조건문("재시도가 성공하면 하류가 이어서 실행")을 "대화가 끝난 경우" 조건부로 정정 — 방금 도입한 두 갈래 설명과 상충했다 |
| W8 (documentation) | **수정** | `updateExecutionStatus` JSDoc 에만 `@param opts` 가 없었다. 같은 PR 에서 형제 두 함수(`tryLockActiveExecutionAndSaveNodeExec`·`lockNonTerminalExecutionRow`)는 갱신했는데 **상태 전이 단일 choke point 이자 이번 CRITICAL 의 당사자 함수만** 빠진 비대칭. "상태머신 opt-in 과 DB 가드에 **함께** 적용돼야 하고 하나만 반영하면 0행으로 막힌다(= 이 파라미터가 생긴 이유)" 를 명시 |

두 건 다 문서·가이드 전용으로 동작 로직 무변경이다.

## defer — 코드 변경 없음, plan 등재

| SUMMARY # | 처분 | 등재 위치 |
|---|---|---|
| W1 (concurrency) | 기존 #20 **증거 보강** | Parallel 형제 브랜치가 `continue` 정책으로 살아있어 Execution 이 `RUNNING` 인 경우 `rehydrateContext` 가 형제와 **동일 live `ExecutionContext`** 를 반환해 공유 가변 상태를 동시 mutate 할 수 있다(미재현·개연성 평가). #20 의 `Execution.status===FAILED` 사전 검증이 두 시나리오를 함께 닫는다 |
| W2 | 신규 #26 (P3) | DB 가드의 COMPLETED/CANCELLED 배제 대조 테스트 부재. **코드는 직접 계산으로 정확함 확인** |
| W3 | 신규 #27 (P3) | `tryLockActiveExecutionAndSaveNodeExec` 전용 describe 가 신규 opts 미반영 |
| W4 | 기존 #3 (P2) | 실 Postgres e2e 부재 — 이 결함 계열이 3라운드 연속 unit mock 정교화로만 대응돼 온 이력을 근거로 **우선순위 상향 권고** 를 함께 기록 |
| W5·W7 | 기존 #21·#22·#23 | opt-in 배선 shape 중복 / 이중 SoT / 헬퍼 통합 |
| W6 | 신규 #30 (P3) | `buildStatusesSql(extraIncluded)` 일반화 |
| W9 | 신규 #28 (P3) | `InvalidExecutionStateError` 문구가 retry 실패 사유와 불일치 |
| W10 | 신규 #29 (P3) | `assertTransition` raw Error 가 client-safe 매핑 없이 payload 노출(민감도 낮음 — enum 값뿐) |

INFO 전체 — 조치 없음(대부분 기존 추적 항목의 독립 교차검증).

## 남긴 판단 — 왜 더 고치지 않는가

W5(배선 shape 중복)는 `maintainability` 가 MEDIUM 을 매긴 근거이고, **이 브랜치에서 실제로 두
차례 CRITICAL 을 유발한 구조**다. 그럼에도 이번에 손대지 않는다:

- 수정 범위가 상태머신·엔진 choke point·orchestrator 4파일의 타입 재배선이다. 이 PR 은 이미
  11라운드를 돌았고, 그 규모의 구조 변경은 **새 리뷰 표면을 열어 라운드를 다시 여러 번 만든다**.
- 지금 그 구조는 **테스트로 잠겨 있다** — 10R 이 seam 무검증을 잡았고 그 후 리뷰어의 강한
  뮤턴트(shape 보존)로 RED 를 확인했다. 즉 배선이 끊기면 이제는 잡힌다.
- #21·#22·#23 으로 근거째 등재돼 있어 다음 착수 때 전제로 쓸 수 있다.

## 검증 이력 (누적)

- **mutation**: 라운드별 누적 20종 이상. 1차 실행에서 미검출이 난 가드는 매번 테스트를 추가해
  잠갔다(3R M1·M7 앵커 비유일 / 8R A·C 미검출 / 10R seam shape 오판).
- **핵심 교훈**: 뮤턴트가 **호출 shape 을 바꾸면** shape 단언이 잡아버려 "동작이 잠겼다" 고
  오판한다. 동작을 잠그려면 뮤턴트도 shape 을 보존해야 한다(10R CRITICAL 이 이걸 잡았다).
- **TEST WORKFLOW**: 매 라운드 전량 재수행. 최종 unit 412 suites / 8,346 · e2e backend 46
  suites / 260 + Playwright 51 · build · lint 전부 PASS.
