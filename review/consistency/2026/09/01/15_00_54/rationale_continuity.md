# Rationale 연속성 검토 — `plan/in-progress/spec-draft-audit-write-failed-metric.md`

## 발견사항

- **[WARNING]** `resource_type` 라벨의 open-string 설계가 `9-observability.md` Rationale 의 "닫힌 집합 유지" 원칙과 어긋나는데, 그 원칙의 출처 문서 자체는 갱신 대상에 없다
  - target 위치: 변경안 A-2 (카탈로그 표 신규 행 `clemvion.audit.write_failed` | `resource_type`), A-3 (표 위 서술 보강)
  - 과거 결정 출처: `spec/data-flow/9-observability.md` `## Rationale` § "`clemvion.redis.fail_open` 의 `component` 를 실제 배선된 값만 열거하는 이유" — "라벨 값 집합은 코드의 리터럴 유니온이 정하는 **닫힌 집합**과 1:1 로 유지한다 … **라벨을 `string` 으로 열어 두지 않는 이유이기도 하다** — 외부 문자열이 라벨에 실리면 Prometheus 시계열 cardinality 가 터진다."
  - 상세: target A-3 은 `resource_type` 이 `AuditLogsService.record()` 의 `resourceType: string`(열린 타입)에서 온다는 점을 스스로 인지하고, "컴파일러가 닫힘을 증명하지 못해 64자 클램핑으로 방어한다 — `error_code` 와 같은 방식" 이라 적는다. 실측 확인 결과 `error_code` 도 실제로 `recordExecutionError(errorCode: string)` 을 통해 동일한 `clampLabel()`(64자) 방어를 이미 쓰고 있어(`business-metrics.service.ts`), target 의 주장 자체는 사실이고 기존 선례를 정확히 인용한다. 다만 이 "open string + clamp" 패턴은 `9-observability.md` 의 Rationale 이 명시한 "닫힌 집합 1:1 유지 · string 미채택" 원칙과 문면상 어긋나며, 그 원칙 문서(9-observability.md 의 Rationale) 는 이 draft 의 변경안 B(§본문 블록쿼트 나열)에서만 손대고 **Rationale 절 자체는 건드리지 않는다.** 결과적으로 "라벨을 string 으로 열어 두지 않는다" 는 문장은 이 draft 이후에도 `9-observability.md` 안에서 그대로 남아, 그 문서만 읽는 다음 사람은 `resource_type`(그리고 이미 존재하던 `error_code`)이 이 원칙의 명시적 예외라는 사실을 알 길이 없다. 결정 번복 자체는 근거 있음(criteria 3 충족: A-3·"기각한 대안" 절이 클램핑 방어 논리를 명시)이나, 새 Rationale 이 원 결정의 출처 문서가 아닌 다른 문서(`_product-overview.md` 표 위 서술)에만 놓여 원칙-예외 관계가 한 곳에서 보이지 않는다.
  - 제안: `9-observability.md` 의 해당 Rationale 항목 끝에 한두 문장을 추가해 "이 원칙은 `clemvion.redis.fail_open` 처럼 코드 유니온이 있는 라벨에 적용되며, `error_code`/`resource_type` 처럼 유니온을 증명할 수 없는 라벨은 64자 클램핑으로 방어한다(→ `_product-overview.md` NF-OB-07 서술 참조)" 는 취지의 교차 참조를 남긴다. spec_impact 에 `9-observability.md` Rationale 갱신을 명시적으로 추가하거나, 최소한 A-3 서술에 "9-observability.md 의 원칙 문장은 이 예외를 반영하도록 별도 갱신하지 않는다" 는 의도적 생략임을 한 줄 남긴다.

## 요약

target 은 이미 구현된 `clemvion.audit.write_failed` 카운터를 spec 세 곳에 동기화하는 draft로, 대부분의 결정(카탈로그 표 확장 규칙 준수, `redis.fail_open` 옆 배치, `1-audit.md` 의 "로그로만 남는다" 서술을 비대칭으로 재서술, `login_history` 미확장을 후속 항목으로 명시 유예)이 기존 Rationale 을 정확히 인용하고 그 정신에 부합한다 — 특히 "카탈로그 표가 SoT" 원칙 준수, 두 `record` 테이블의 목적 분리(기존 Rationale)와의 정합, 삼킴+await 설계 불변 유지는 모두 기존 결정을 강화하는 방향이다. 유일한 긴장은 `resource_type` 라벨이 `9-observability.md` Rationale 이 명시한 "닫힌 집합 유지·string 비채택" 원칙과 문면상 어긋난다는 점인데, target 은 이를 숨기지 않고 `error_code` 선례(실측 확인됨 — 코드에 이미 동일 클램핑 방어 존재)를 인용해 정당화한다. 다만 그 정당화가 원칙의 출처 문서(`9-observability.md`)가 아니라 파생 카탈로그(`_product-overview.md`)에만 기록되어, 원칙-예외 관계가 한 곳에서 완결되지 않는 문서 연속성 공백이 남는다.

## 위험도
LOW
