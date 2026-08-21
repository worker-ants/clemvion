### 발견사항

- **[WARNING]** "다른 plan 과의 관계" 종결 목록이 정본 트래커의 동일 결함을 하나 놓쳤다
  - target 위치: `plan/in-progress/masked-marker-shared-package.md` "## 다른 plan 과의 관계" (대체·종결 항목 "둘"의 열거) + "## 작업" 체크리스트의 "정본 트래커 2항목 `[x]` + 대체 근거"
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:373` — "**마커 미러 계약 테스트 — backend SoT ↔ frontend 미러를 기계가 대조하게 한다**" (2026-08-17 등재, `12_33_36` security/side_effect INFO-1, 아직 `[ ]`)
  - 상세: 같은 트래커 파일 안에 이 결함을 서술하는 **열려 있는 항목이 둘**이다.
    1. `:373` (2026-08-17 등재) — "backend `sanitize-error-message.ts` 의 `MASKED_MARKERS` 와 frontend `masked-markers.ts` 미러가 손으로 복제돼 있다 … **남은 것: 두 스택을 가로지르는 대조. backend jest 와 frontend vitest 가 갈려 있어 공유 패키지 추출(`packages/`)이 선행돼야 값싸다 — 그래서 별건으로 남긴다.**"
    2. `:757` (2026-08-21 등재, "마커 재제출 거부 PR 의 이월 항목" 절) — "**마커 리터럴 cross-stack 계약 테스트 부재** — 프런트 `lib/utils/masked-markers.ts` 와 backend `shared/utils/sanitize-error-message.ts` 의 `MASKED_MARKERS` 가 문자 그대로 대칭이어야 하는데 이를 강제하는 것이 없다(jest↔vitest 경계)."
    두 항목은 사실상 동일한 갭을 두 번 등재한 것이고(`:373`은 명시적으로 "공유 패키지 추출이 선행돼야 값싸다"고 이 target 이 지금 하려는 작업을 정확히 예고해 뒀다), target 문서는 `:757`(대체 근거는 "§마커 재제출 거부 PR 의 이월 항목")만 지목한다. `:373`은 열거·체크리스트 어디에도 없다. target 이 계획대로 "정본 트래커 **2항목** `[x]` + 대체 근거"만 집행하면 `:373`은 동일한 결함을 가리키는 **stale 중복 항목으로 트래커에 계속 열린 채 남는다** — target 자신이 인용한 선례(`ws-event-types-extract.md`)가 지키는 원칙("추출이 같은 값을 더 적은 표면으로 얻는다", 대체된 항목을 남기지 않고 사유와 함께 닫는다)과 어긋난다.
  - 제안: target 의 "다른 plan 과의 관계" 열거를 "둘"에서 "셋"으로 넓히고, `:373`도 같은 구현 커밋 턴에 `[x]` + 대체 근거(패키지 추출로 대체)를 적는다. 두 항목이 문구까지 거의 동일하므로 대체 근거 문장은 재사용 가능.

- **[INFO]** "consistency `05_23_14` 등재분 중 wrapper/미러 관련 서술" 인용이 다소 부정확
  - target 위치: `plan/in-progress/masked-marker-shared-package.md` "## 다른 plan 과의 관계" 둘째 불릿
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:776-781` — `05_23_14` 배치는 항목 3개(wrapper 함수명 spec 미기재 · §R17 표 볼드 비일관 · error-codes 패턴 표 누락)이고, 이 중 "미러" 를 직접 언급하는 항목은 없다. "wrapper" 에 해당하는 것은 `:779` "wrapper 함수명이 spec 본문에 없다" 하나뿐이다.
  - 상세: target 이 R17 정정을 planner 턴으로 넘기면서 이 wrapper 항목을 같이 접었다고 해도 틀린 결정은 아니나("두 문서에 함수·파일명 명시" 요구가 target 의 R17 SoT 정정 작업과 같은 절을 건드림), "wrapper**/미러**" 라는 표현이 `:373`/`:757` 의 "미러" 항목과 혼동을 부를 수 있다. 실제로 `05_23_14` 항목 자체엔 미러 서술이 없다.
  - 제안: 사소하므로 차단 사유는 아니나, 다음 편집 시 "05_23_14 등재분 중 wrapper 함수명 항목" 으로 정확히 지칭하면 위 WARNING 항목(진짜 "미러" 항목 `:373`/`:757`)과의 혼동을 없앨 수 있다.

### 요약
target(`masked-marker-shared-package.md`)이 미해결 결정을 우회하거나 선행 조건을 무시하는 지점은 없다 — CI 경로 게이팅 실측, `MAX_SANITIZE_DEPTH` 비통합 근거, R17 정정을 planner 턴으로 분리하는 판단 모두 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)의 기존 서술과 정합하고, 인용한 선례(`ws-event-types-extract.md`)의 "구현 커밋과 같은 턴에 트래커를 닫는다" 관행도 정확히 재현하고 있다. 다만 그 트래커 파일 안에 이 target 이 정확히 겨냥하는 결함("MASKED_MARKERS backend/frontend cross-stack 계약 테스트 부재")이 **두 번(:373, :757) 등재돼 있는데 target 은 하나(:757)만 인지**하고 있어, 계획대로 "2항목만" 닫으면 오래된 중복 항목(:373)이 트래커에 stale 하게 남는다. 이는 결정 충돌이 아니라 트래커 동기화 커버리지 누락이며, 체크리스트 한 줄 확장으로 해소 가능하다.

### 위험도
LOW
