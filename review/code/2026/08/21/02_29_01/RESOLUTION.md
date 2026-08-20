# RESOLUTION — 02_29_01

대상 SUMMARY: `review/code/2026/08/21/02_29_01/SUMMARY.md` (위험도 **LOW**, Critical **0**, **WARNING 0**, INFO 11)

**처분: 신규 CRITICAL·WARNING 0 — 수렴.** INFO 11건 중 저비용·실질 갭 2건만 조치했다(둘 다
테스트라 런타임 위험 0).

9개 reviewer 가 실코드를 직접 재대조해 이전 5라운드의 CRITICAL 1 + WARNING 다수 전량 해소를
확인했다.

---

## 조치한 INFO (2건)

### INFO-6 — legacy 진입 경로 캐너리 (testing)

컨트롤러는 `parameterValues`(선호)와 `input.parameters`(back-compat)를 같은 `rawValues` 로
접어 거부 함수에 넘긴다. **신규 캐너리 셋이 전부 `parameterValues` 만 써서**, 그 접기가
깨져도 GREEN 이었다 — 코드 구조로만 보장되던 것을 테스트로 고정했다.

### INFO-7 — `masked_value_resubmitted` 매핑 단언 (testing)

`toTriggerParameterErrorDetails` 의 매핑 표 테스트에 형제 셋만 있고 **네 번째가 빠져** 있었다.
코드/메시지 리터럴이 바뀌어도 통합 테스트가 간접 커버할 뿐이다. 형제와 나란히 넣었다.

## 미조치 INFO (9건)

| # | 항목 | 사유 |
|---|---|---|
| 1 | 가드가 namespace import·re-export 를 못 잡음 | 현재 호출부 2곳 다 named import. 그 형태가 실제로 생기면 그때 확장(또는 AST) — 지금 넓히면 검증 못 할 표면만 는다 |
| 2 | `re-run.dto.ts` Swagger description stale | 외부 소비자 부재 확인됨. 다음 DTO 편집 기회 |
| 3 | 한/영 주석 혼재 | 이 diff 가 만든 문제 아님(3라운드 이월) |
| 4 | `reRun` 137줄 | 이번 증가분 4줄, 스코프 밖 |
| 5 | 최상위 `error.code` drift | 선존 + spec 명문화. 통일하면 기존 클라이언트가 보는 코드가 바뀐다 — 별도 breaking 결정 |
| 8 | `rawSource` 배열 케이스 · webhook/schedule 행위 테스트 | 이전 라운드 저위험 판정, 상태 변화 없음 |
| 9 | `ERROR_KO` ko 매핑 부재 | 형제 3종도 동일한 선존 패턴, `details[].code` 소비 UI 자체가 없음(4개 코드 전수 grep 0건) |
| 10 | `MASKED_MARKERS` 타입 변경 | 직접 import 하는 소비처 없음(전부 `isMaskedMarker()` 경유) |
| 11 | 트래커 W5 동반 종결 | 문서 전용·근거 명시·그루밍 관례 |

## 수렴 판정

| 라운드 | Critical | Warning | 성격 |
|---|---|---|---|
| `00_03_57` | **1** | 9 | boolean 완전 우회 — 검사 시점 |
| `00_39_27` | 0 | 5 | 절차 위반 · 폐기된 설계 지시 · 자매 발산 |
| `01_15_47` | 0 | **0** | INFO 만 |
| `01_38_26` | 0 | 3 | (내 INFO 조치가 만든) base/wrapper 오선택 여지 |
| `02_04_38` | 0 | 3 | **내가 넣은 가드 자체의 결함 셋** |
| `02_29_01` | **0** | **0** | INFO 만 — 대부분 이월·확인 |

두 번 "가드를 넣어 결함을 막으려다 가드가 새 결함 표면이 되는" 판을 겪고 수렴했다. 마지막
두 라운드의 INFO 는 성격이 바뀌었다 — 결함이 아니라 **다음 편집 기회에 할 일**이다.

## 검증

TEST WORKFLOW 4단계 PASS —

| 단계 | 결과 |
| --- | --- |
| lint | PASS (48s) |
| unit | PASS — backend jest **429 suites / 8,866**(직전 8,865 대비 +1) |
| build | PASS (139s) + 타입체크 ratchet **199건/38파일 baseline 일치** |
| e2e | PASS (207s) — backend supertest **276** · playwright **51** |
