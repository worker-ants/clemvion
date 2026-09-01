# Plan 정합성 검토 — `spec-draft-audit-write-failed-metric.md`

## 발견사항

- **[WARNING]** `login_history` 카운터 후속 항목이 "등재한다" 고 두 번 명시되지만 실제로 등재되지 않았고, 관련 plan 의 기존 체크박스도 stale 로 방치된다
  - target 위치: `plan/in-progress/spec-draft-audit-write-failed-metric.md` §C ("`login_history` 쪽을 이번에 넓히지 않는 이유" 문단) 및 `## Rationale` → "기각한 대안" 첫 항목. 두 곳 모두 문장 끝이 **"후속 항목으로 등재한다"** 로 끝난다.
  - 관련 plan: `plan/in-progress/spec-sync-auth-gaps.md` — "`audit_log` 적재 실패에 관측 수단이 없다" 항목(`[x]` 완료, 2026-09-01) 아래 남아 있는 미해소 하위 체크박스
    `- [ ] 적재 실패 카운터/알림 도입 여부 결정 — 전 producer 공통이라 별도 트랙`
  - 상세: target 은 이 체크박스가 이미 존재한다는 사실을 전혀 언급하지 않고, 자신이 "등재하겠다" 는 후속 항목을 어디에 어떻게 남길지도 명시하지 않는다. 그런데 위 체크박스는 **바로 이 결정**("적재 실패 카운터/알림을 어디까지 도입하나")을 가리키도록 착수 시점(카운터 신설 전)에 이미 적혀 있었던 것이다. 지금 상태로는:
    1. `audit_log` 축은 이미 답이 나왔다(카운터 신설, 클램핑 방어) — 그런데 체크박스는 여전히 미체크로 "결정 전" 처럼 읽힌다.
    2. target 이 새로 여는 질문("`login_history` 도 카운터를 붙일까")은 이 체크박스가 좁혀서 흡수해야 자연스러운데, target 은 이 체크박스를 인지하지 못한 채 별도로 "후속 항목으로 등재한다" 고만 쓴다.
    실제로 이 draft 가 적용(spec 커밋)되는 시점에 `spec-sync-auth-gaps.md` 를 갱신하지 않으면, `login_history` 비대칭이라는 발견(target 이 스스로 "발견할 수 있게" 하려던 그 사실)이 plan 트래커 어디에도 살아남지 못하고 target 문서 안에서만 존재하게 된다. `spec_impact` 프론트매터도 `spec/` 파일 3개만 나열하고 `plan/` 파일은 없어, 이 갱신이 같은 턴에서 실행될지 불확실하다.
  - 제안: target 적용(spec 커밋)과 **같은 planner 턴**에서 `plan/in-progress/spec-sync-auth-gaps.md` 의 위 체크박스를 다음과 같이 갱신할 것 — (a) `audit_log` 축 결정 완료를 반영해 문구를 좁히고, (b) `login_history` 카운터/알림 도입 여부를 새 하위 체크박스로 명시 등재. target 문서 자체(또는 커밋 메시지)에도 "어디에 등재했는지" 링크를 남기면 다음 사람이 추적 가능하다.

## 요약

target 은 기술적으로 견고하다 — 인용된 spec 라인(§NF-OB-07 요약행 `:75`, 카탈로그 표, `9-observability.md:202~205`, `1-audit.md:21~23`)이 현재 저장소 상태와 정확히 일치하고, `clemvion.redis.fail_open` 선례(카탈로그 동시 갱신 규칙, `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 기록된 동일 정책)를 올바르게 따른다. `resource_type` 을 닫힌 유니온 대신 클램핑으로 방어하기로 한 결정도 기존 카탈로그의 `error_code`(`recordExecutionError`) 패턴과 정확히 같은 전례를 따르므로 `9-observability.md` §Rationale 의 "라벨을 `string` 으로 열어 두지 않는다" 서술과 충돌하지 않는다(그 서술은 `redis.fail_open` 의 컴파일타임 유니온에 한정된 것이고, 카탈로그에 이미 `error_code` 라는 반례가 존재한다). 코드 선행조건(`recordAuditWriteFailed`, `AuditLogsService.record()` 배선, `spec-sync-auth-gaps.md` 의 `[x]` 완료 마크)도 실측으로 확인된다. 유일한 정합성 갭은 target 이 두 차례 명시한 "`login_history` 후속 항목 등재" 약속이 실제 plan 갱신으로 이어지지 않고 있다는 점이며, `spec-sync-auth-gaps.md` 에는 이미 이 결정을 가리키는 낡은 체크박스가 있어 그대로 두면 두 문서가 같은 미해결 사안을 서로 모른 채 따로 들고 있게 된다.

## 위험도
LOW
