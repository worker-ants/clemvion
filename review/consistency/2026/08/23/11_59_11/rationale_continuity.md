STATUS=success rationale_continuity 완료 — CRITICAL 0 / WARNING 1 / INFO 2
===REPORT_MARKDOWN_BELOW===
### 발견사항

- **[WARNING]** ③ "별개 판단이라 건드리지 않는다" 유보를 해제하면서 그 유보 문구를 인용·연결하지 않음
  - target 위치: `plan/in-progress/swagger-decisions.md` `## ③ 길이 규칙 — 실측이 "규칙 아님" 을 말한다`
  - 과거 결정 출처: `spec/conventions/swagger.md` `## Rationale` → `### §3 보안·정책 캐비엇 예외 …` 마지막 문단 —
    > "위 34% 는 보안·정책 캐비엇 클래스보다 넓다. 즉 `10~40자` **기본 수치 규칙 자체**가 현실과
    > 벌어져 있을 수 있는데, **그건 이 예외의 문제가 아니라 별개 판단이라 여기서 건드리지
    > 않는다**."
    (같은 문구가 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` L972-980 에 (a)/(b)/(c)
    3택 미결 항목으로 등재돼 있고, target 의 결정 (c) 는 그 항목의 옵션 c 그대로다.)
  - 상세: target ③ 은 그 "별개 판단이라 안 건드린다" 로 **일부러 분리·유보**해 둔 질문을 바로
    다음 날 스코프 안으로 끌어와 종결한다 — 방향 자체는 정당하고(트래커가 이미 3택 미결로
    공식 등재해 뒀고 오늘 사용자가 그중 (c) 를 골랐다는 서술과 일치), "기각된 대안의 재도입"은
    아니다. 다만 target 본문은 이 유보 문구를 **한 번도 인용하지 않고** "37% 미준수는 …" 로
    마치 새로 발견한 사실인 것처럼 서술한다. 이 저장소는 정확히 이런 상황("당시 왜 유보했는가
    → 그 전제가 지금 어떻게 해소됐는가")을 명시하는 확립된 패턴을 이미 갖고 있다 —
    `spec/2-navigation/4-integration.md` `## Rationale` 의 `cafe24-token-refresh` 항목
    ("**왜 이 시점에 명문화하나 (defer 해제)**" 문단, *"defer 의 번복이 아니라 defer 조건
    충족에 따른 예정된 재개"*). target 의 실제 작업 항목("③ swagger.md §3 문면 개정 + `##
    Rationale` 에 근거")이 이 인용·연결 없이 집행되면, 새 Rationale 이 "37% 초과" 라는 수치만
    반복하고 **왜 어제는 별개 판단이라 미뤘던 것을 오늘은 같은 자리에서 확정하는지**를 설명하지
    않게 되어, 다음 리뷰가 "그 유보는 어떻게 됐나"를 다시 묻게 될 위험이 있다.
  - 제안: `## Rationale` 신설 문단에 (a) 위 유보 문구를 그대로 인용, (b) *"§3 예외 확장과는
    별개 판단이라 그 작업에서 의도적으로 분리했다"* 던 전제가 오늘 사용자 결정으로 해소됐음을
    명시, (c) `spec-sync-external-interaction-api-gaps.md` 의 (a)/(b)/(c) 3택 항목을 "(c) 채택,
    trạcker 종결"로 상호 링크. cafe24-token-refresh 의 "defer 해제" 서술 패턴을 그대로 재사용
    가능.

- **[INFO]** ① "현행 유지" 결정이 2026-08-22 `execute-body-dto` Rationale·캐너리를 인용하지 않음
  - target 위치: `plan/in-progress/swagger-decisions.md` `## ① 현행 유지 — 왜 이게 결정인가`
  - 과거 결정 출처: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` L1001-1023
    (`execute-body-dto`, 2026-08-22 닫힘) — `execute` 가 전역 `CustomValidationPipe.toValidate()`
    의 `Object` 제외로 검증을 skip 하는 것이 **이미 내려진 의도적 결정**이며, 그 결정을 지키는
    회귀 캐너리 `workflows-execute-body.spec.ts` 가 이미 존재한다는 서술.
  - 상세: target ①의 서술("`execute` 는 전역 파이프에 진입하지 않고 … 이 비대칭은 의도적으로
    유지되는 상태")은 이 기존 결정과 완전히 정합한다 — 모순은 없다. 다만 이 결정이 이미
    한 달 전 별도 항목에서 근거·캐너리와 함께 확정돼 있었다는 사실을 target 이 인용하지 않아,
    "오늘 처음 결정한다"는 서술과 "이미 확정된 것을 트래커 항목 형태로 재포장한다"는 서술이
    구분되지 않는다.
  - 제안: ① 트래커 종결 문구에 `execute-body-dto`(2026-08-22)와 `workflows-execute-body.spec.ts`
    캐너리를 명시적으로 인용해, "여분 키 400 거부" 판단이 그 결정의 **재확인**임을 밝힌다.

- **[INFO]** ③ 실측 수치가 2026-08-22 Rationale 수치와 소폭 다름(114/333 → 116/335) — 델타 미설명
  - target 위치: `plan/in-progress/swagger-decisions.md` `## ③ 길이 규칙` 표
  - 과거 결정 출처: `spec/conventions/swagger.md` `## Rationale` `### §3 …` — "요청 DTO 73개 파일의
    `description` 333개 중 114개(34%)가 40자를 넘는다"
  - 상세: target 표는 같은 스코프(요청 DTO)에 대해 116/335(34%)로 약간 다른 절대값을 싣는다.
    비율은 동일(34%)하고 하루 사이 병합된 PR(#1188-1191 등)로 DTO 파일이 늘었을 가능성이
    있어 모순은 아니지만, 최종 `## Rationale` 에 반영될 때 어느 시점 실측인지 밝히지 않으면
    기존 문단의 "333개/114개"와 신규 문단의 "335개/116개"가 같은 명제의 서로 다른 숫자로
    나란히 남아 향후 판독자가 drift 로 오인할 수 있다.
  - 제안: 새 Rationale 문단에 실측 명령·기준일(예: "2026-08-23 재실측, 기준 동일")을 한 줄
    명시해 기존 §3 문단의 실측 방법론(집계 기준 경로 명시)과 동일한 형식으로 정합시킨다.

### 요약
target 의 세 결정 모두 기존 spec Rationale·트래커에 이미 "사용자 판단 필요"로 공식 등재돼
있던 미결 항목의 종결이며, 어느 것도 과거에 명시적으로 기각된 대안을 재도입하거나 합의된
설계 원칙(예: `execute-body-dto` 의 런타임 무변경 원칙, `legacyInput` rename 불가 판정)을
위반하지 않는다. 다만 ③은 `swagger.md §3` 자체 Rationale 이 "별개 판단이라 건드리지 않는다"고
명시적으로 유보해 둔 지점을 바로 다음 날 해제하면서 그 유보 문구를 인용하지 않고 있어, 이
저장소가 이미 확립한 "defer 해제" 서술 패턴(cafe24-token-refresh 사례)을 따르지 않으면 새
Rationale 이 유보 이력과 단절된 채 남을 위험이 있다. ①도 한 달 전 이미 확정된 결정·캐너리를
재인용 없이 재서술하고 있어 완전성 보완이 필요하다. 이 셋 모두 target 자체의 방향을 뒤집을
필요는 없고, 실제 spec/Rationale 집행 시점에 인용·링크를 보강하면 해소되는 수준이다.

### 위험도
LOW
