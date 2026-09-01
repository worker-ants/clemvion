# Rationale 연속성 검토 — `plan/in-progress/spec-draft-audit-resource-type-count.md`

## 발견사항

- **[INFO]** 클램핑 결정 재확인 — 재도입·번복 아님, Rationale 과 정합
  - target 위치: `## 변경 제안` 마지막 문단 ("설계 결론(클램핑을 쓰고 닫힌 유니온을 쓰지 않는다)은
    바뀌지 않는다…")
  - 과거 결정 출처: `spec/data-flow/9-observability.md` `## Rationale` §
    "`clemvion.redis.fail_open` 의 `component` 를 실제 배선된 값만 열거하는 이유" 말미의
    인용 블록 — "이 원칙은 코드 유니온이 있는 라벨에 적용된다. 소스 시그니처가 이미 `string` 인
    라벨은 컴파일러가 닫힘을 증명하지 못하므로… **클램핑**해 같은 목적을 달성한다 —
    `clemvion.execution.errors` 의 `error_code`, `clemvion.audit.write_failed` 의
    `resource_type` 이 그 경우다."
  - 상세: target 은 `resource_type` 라벨 카디널리티 실측치를 12→10 으로 정정하면서, 그 정정이
    "닫힌 유니온으로 전환해야 한다" 는 새 주장으로 번지지 않도록 명시적으로 차단하고 있다.
    이는 위 Rationale 이 이미 확정한 "`record()` 시그니처가 `string` 이므로 유니온이 아니라
    클램핑" 원칙을 정확히 재확인하는 것이며, 기각된 대안(닫힌 유니온 채택)을 다시 끌어들이지
    않는다. `## Rationale` 문단("증명되지 않은 닫힘을 타입으로 적으면 다음 사람이 그걸 믿고
    클램핑을 지운다")이 경고한 바로 그 실수를 target 이 스스로 피해가고 있다 — 숫자만 보고
    "10개면 닫힌 유니온으로 가도 되지 않나" 라는 유혹에 빠지지 않았다.
  - 제안: 없음(현행 유지). 다만 `spec/5-system/_product-overview.md` 표 정정 시,
    `data-flow/9-observability.md` 의 위 Rationale 인용구(각주 링크)를 표 근처에 한 줄
    교차 참조로 남기면 "왜 10종인데도 유니온으로 안 바꾸는가" 를 다음 사람이 재추론하지 않아도
    된다 — 선택 사항.

- **[INFO]** "표가 구현보다 넓어지면 안 된다" 원칙과의 정합
  - target 위치: `## Overview`, `## 실측` 전체
  - 과거 결정 출처: `spec/data-flow/9-observability.md` `## Rationale` § 동일 항목의 첫 문단 —
    "실제로 배선된 것은… 하나뿐이다. 나머지를 미리 열거하고 싶어지는 자리지만 그렇게 하면
    **문서가 구현보다 넓어진다**"
  - 상세: 이 원칙은 "라벨 값 집합은 실제 배선을 초과해서는 안 된다"는 취지다. target 의 12→10
    정정은 문서(카탈로그 표의 "실측 12종")가 실제 distinct 값(10종)보다 부풀려져 있던 상태를
    좁히는 방향이라, 이 원칙과 충돌하지 않고 오히려 그 정신을 실행한다. 카운트 대상 혼동(파일 수
    vs 라벨 값)이라는 원인 분석도 향후 재발 방지에 부합한다.
  - 제안: 없음.

- **[INFO]** `alert_rule`/`workspace_invitation` 을 감사 `resourceType` 에서 제외한 판단의
  교차 정합
  - target 위치: `## 실측` § "감사가 아닌 `resourceType` 을 갈라낸 것이 판정의 절반이다"
  - 과거 결정 출처: `spec/1-data-model.md` `## Rationale` § "`alert_rule` 을 §2.25 로 등재
    (2026-08-31)" 및 `spec/data-flow/9-observability.md` §
    "`clemvion.redis.fail_open`…" 항의 닫힌 집합 원칙
  - 상세: `alert_rule` 이 최근(2026-08-31) `spec/1-data-model.md` §2.25 로 신규 등재되면서
    "감사가 아니라 알림(Notification) 리소스" 라는 성격이 이미 그 문서에서 정리된 바 있다.
    target 이 같은 결론(`alert_rule` 은 `alerts-evaluator.service.ts` 의 알림 경로이며
    `AuditLogsService` 를 주입하지 않는다)을 독립적으로 재확인하고 있어, 두 문서 간 판단이
    합치한다 — 충돌 없음.
  - 제안: 없음.

CRITICAL/WARNING 수준의 발견은 없다. 기각된 대안의 무근거 재도입, 합의 원칙 위반, Rationale
갱신 없는 결정 번복, invariant 우회 설계 중 어느 것도 target 에서 관측되지 않았다.

## 요약

target 은 `NF-OB-07` 카탈로그의 `resource_type` 카디널리티 오기산(12→10)을 정정하는 좁은
spec draft 로, 유일하게 직접 연관된 과거 `## Rationale`(`spec/data-flow/9-observability.md`
의 "코드 유니온이 없는 라벨은 클램핑" 원칙)을 정확히 인용·재확인하며, 숫자 정정이 설계
결론(클램핑 유지·닫힌 유니온 미채택)에 영향을 주지 않는다는 점을 스스로 명시해 "기각된 대안의
무근거 재도입" 위험을 사전에 차단했다. `alert_rule`/`workspace_invitation` 을 감사
`resourceType` 에서 배제한 판단도 `spec/1-data-model.md` §2.25 의 최근 결정과 합치한다.
Rationale 연속성 관점에서 문제 될 소지가 없다.

## 위험도

NONE
