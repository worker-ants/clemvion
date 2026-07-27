# RESOLUTION — 8차(최종) 라운드

`review/code/2026/07/27/03_14_01` — **Critical 0 / 위험도 LOW**.

**이 라운드는 코드를 변경하지 않는다.** 발견이 전부 유지보수성·관측성·테스트 완결성으로
좁혀졌고 correctness 결함이 0건이라, 여기서 수렴시키고 잔여는 plan 으로 이관한다.
(계속 고치면 매번 리뷰가 stale 해져 라운드가 무한히 이어진다 — 8라운드 동안 관측한 패턴.)

## 조치 항목

| SUMMARY # | 분류 | 처분 | 근거 |
|---|---|---|---|
| Critical | — | **0건** | 핵심 스코프(park↔resume 짝 전이 lost-update, turn 경계 cancel 가드, FAILED 경로, terminal 집합 누락)는 전부 닫혔고 mutation 6/6 RED 로 고정됨 |
| SPEC-DRIFT #1·#2 | spec 위임 | 조치 없음 | `spec-update-node-cancellation-shutdown-classification.md` #7(및 보강 6~8)에 이미 등재. developer 는 `spec/` 쓰기 권한 없음 |
| W1 (두 guard 지점 반환값 소비 비대칭 — `executeSync` 쪽 무로그) | plan 이관 | 코드 변경 없음 | 관측성 drift. 동작은 양쪽 모두 정확(선점 시 skip). 공용 헬퍼 추출과 함께 후속 처리가 적절 |
| W2 (신규 metrics 발사 미고지) | plan 이관 | 코드 변경 없음 | 버그 아님 — 과거 undercount 가 정확해진 것. **배포 시 공지 필요** 항목으로 등재 |
| W3 (`finalizeFailedExecution` 재사용 대신 3곳 재구현) | plan 이관 | 코드 변경 없음 | 통합(`markExecutionFailed` 승격)은 3개 종결 경로를 동시에 건드리는 리팩터라 이 PR 끝단에서 하기엔 회귀 위험이 이득보다 크다 |
| W4~W7 (테스트 헬퍼 중복·매직 인덱스·`FinalizeSubject` 반복·`handleAiMessageTurn` 길이) | plan 이관 | 코드 변경 없음 | 순수 유지보수성 |
| W8 (`markNodeCancelled` reject 경로 미검증) | plan 이관 | 코드 변경 없음 | 실 사각지대이나 발생 조건이 "취소 마킹 DB 저장 실패"로 드묾 |
| W9 (`emitTerminalExecutionMetrics` 3번째 인자 미단언 = 생존 뮤턴트) | plan 이관 | 코드 변경 없음 | **알려진 생존 뮤턴트로 명시 등재**. 영향은 metrics 정확도 한정이며 취소 정합성과 무관 |
| W10·W11 (다른 파일의 stale 줄 번호 앵커, 하드코딩 서수) | plan 이관 | 코드 변경 없음 | 이번 diff 밖 인스턴스 포함 |
| W12 (multi-turn WS 메타 O(N²) 재전송) | plan 이관 | 코드 변경 없음 | 본 PR 이 만든 것 아님(선재). 별도 성능 항목 |
| INFO 전반 | plan 이관 / 조치 불요 | — | `retry-turn.service.ts::failRetryExecution` 동일 패턴은 별도 PR 항목으로 등재 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (execution-engine 모듈 41 suite / 1,086 tests)
- build : 통과
- e2e   : 통과 (260 passed)

> 직전 라운드(`02_23_50`) 조치 직후 전량 실행해 통과했고, **이 라운드는 코드를 변경하지 않았으므로**
> 그 결과가 현재 트리에 그대로 유효하다.

### mutation 재검증 (최종 트리, 원복 완료)

핵심 가드를 하나씩 무력화해 RED 를 확인 — **6/6**:

| 뮤턴트 | 결과 |
|---|---|
| 공유 잠금 헬퍼(`lockNonTerminalExecutionRow`) 항상 통과 | RED (3 failed) |
| 공유 잠금 헬퍼 `FOR UPDATE` 제거 | RED (2 failed) |
| 취소 종결 헬퍼(`assertLinkedTransitionApplied`) throw 무력화 | RED (11 failed) |
| 짝 `NodeExecution` terminal 마킹 제거 | RED (7 failed) |
| `finalizeFailedExecution` 선점 조기 return 제거 | RED (1 failed) |
| `failFirstSegmentSetup` 선점 조기 return 제거 | RED (1 failed) |

## 보류·후속 항목

전부 [`plan/in-progress/ie-resume-turn-boundary-cancel.md`](../../../../../plan/in-progress/ie-resume-turn-boundary-cancel.md)
"후속(본 PR 밖)" / "8차 라운드 추가 후속" 절에 등재했다 — `review/**` 는 SoT 가 아니므로
plan 이 유일한 추적처다.
