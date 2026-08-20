# RESOLUTION — 01_15_47

대상 SUMMARY: `review/code/2026/08/21/01_15_47/SUMMARY.md` (위험도 **LOW**, Critical **0**, **WARNING 0**, INFO 10)

**처분: 신규 CRITICAL·WARNING 0 — 수렴.** INFO 10건 중 값싸고 실질적인 3건만 조치했다.

9개 reviewer 전원이 이전 세 라운드의 CRITICAL 1(`boolean` 마커 완전 우회) + WARNING 다수
(호출부 중복 · `isPlainRecord` 재구현 · `errors`→`details` 봉투 유실 · spec 서술 3곳 stale)를
**실코드로 재검증해 전부 해소 확인**했다.

---

## 조치한 INFO (3건)

### INFO-4 — `MASKED_MARKERS` 런타임 freeze (side_effect)

`export const` 로 승격했지만 `ReadonlySet` 은 **타입 수준 표시일 뿐**이다. 타입 우회로
변형되면 egress 마스킹(`isMaskedMarker`)과 재제출 거부(`findMaskedResubmissions`)가 **같은
싱글턴을 공유**하므로 두 판정기가 동시에 오염된다. `Object.freeze` 로 감쌌다.

> 지금 직접 소비하는 신규 코드가 없어 즉시 악용 경로는 없지만, **export 로 표면을 넓힌 것이
> 이 PR** 이라 그 비용을 이 PR 에서 닫는 게 맞다.

### INFO-2 — 혼합 중첩 경계 (testing)

기존 경계 테스트는 동종(객체만/배열만)만 쌓는다. 두 분기가 각자 `depth + 1` 하므로 섞여도
같은 보폭이어야 한다 — `obj→arr→obj→arr` 형태 캐너리를 추가했다.

### INFO-3 — phase 경계의 알려진 트레이드오프 (testing)

①(raw)을 통과한 뒤 **무관한 필드의 진짜 타입 오류**로 resolve 가 `coerce_failed` 를 던지면
②(JSON 문자열 안의 마커)는 실행되지 않는다. 보안 우회가 아니라 **안내가 한 왕복 늦어지는**
UX 엣지케이스다 — docstring 에 명시했다.

리뷰어 제안대로 "합쳐서 throw" 하지 않는 이유는 직전 라운드(`00_39_27` W2)에 적었다:
① 이후에도 resolve 를 강행하면 `coerce_failed` 가 섞여 안내가 다시 흐려진다.

## 미조치 INFO (7건)

| # | 항목 | 사유 |
|---|---|---|
| 1 | e2e 스모크 부재 | 컨트롤러↔필터 배선은 unit 두 스펙이 각각 고정. 리뷰어도 "선택, 필수 아님" |
| 5 | Swagger description 에 예약어 제약 미노출 | 기존 문서화 관행과 일치, 외부 소비자 부재 확인됨. 다음 DTO 편집 기회 |
| 6 | 한/영 주석 혼재 | 이 diff 가 만든 문제 아님(이월 INFO) |
| 7 | `reRun` 137줄 | 기존 구조, 이번 변경은 분기 1개 |
| 8 | 트래커 W5 동반 종결 | 근거 명시·코드 변경 없음·기존 관례 |
| 9 | planner plan `status: in-progress` | plan 정리 대상 — 이 PR 의 plan 이동에서 함께 처리 |
| 10 | `MASKED_VALUE_RESUBMITTED` ko 매핑 부재 | 형제 3종도 동일, 이번 diff 의 이탈 아님. `genericError` 폴백이라 영문 코드 노출 없음 |

## 수렴 판정

| 라운드 | Critical | Warning | 성격 |
|---|---|---|---|
| `00_03_57` | **1** | 9 | boolean 완전 우회 — 검사 시점 |
| `00_39_27` | 0 | 5 | 절차 위반 · 폐기된 설계를 지시하던 spec · 자매 발산 |
| `01_15_47` | **0** | **0** | INFO 만 — 방어적 보강 제안 |

Critical 이 해소되고 Warning 이 0 이 됐다. 남은 INFO 는 전부 "다음 기회에" 또는 "조치
불요" 로 리뷰어 스스로 판정한 것들이다.

## 검증

TEST WORKFLOW 재실행 결과는 커밋 메시지에 기록한다. 마커 유틸 스위트 **21 passed**.
