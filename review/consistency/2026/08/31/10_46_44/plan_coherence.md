# Plan 정합성 검토 — `plan/in-progress/spec-draft-lockout-and-alertrule.md`

## 발견사항

- **[INFO]** `Notification.type` 신규 값과 알림 옵트아웃 카탈로그의 연결 미검토
  - target 위치: `plan/in-progress/spec-draft-lockout-and-alertrule.md` ③ (`§2.19` `type` 에
    `alert_failure_rate`/`alert_duration`/`alert_llm_cost` 3종 추가)
  - 관련 plan: `plan/in-progress/spec-sync-user-profile-gaps.md` — "알림 설정 조회/수정"
    항목([x] 완료)이 `Notification.type` 계열 값(`executionFailedEmail`/`scheduleFailedEmail`
    등)을 사용자 옵트아웃 토글 카탈로그(`9-user-profile.md §5.1`)에 매핑해 두었다.
  - 상세: 이번 draft 는 이미 코드에 존재하는 값(`alert_${rule.type}`)을 §2.19 표에 **문서로만**
    반영하는 것이라 새 기능이 아니고, 완료된 옵트아웃 plan 항목을 무효화하지도 않는다.
    다만 새 `alert_*` 값이 이메일 옵트아웃 토글 카탈로그에는 없고, `AlertRule.channel`
    (§2.25, `in_app`/`email`)이라는 **별도 규칙-단위 채널 선택 메커니즘**과 사용자 전역
    옵트아웃(`notification_preferences`) 이 같은 문서군 안에 병존하게 된다. 두 메커니즘의
    관계(전역 옵트아웃이 규칙별 `channel=email` 선택을 무시하는지 등)는 이 draft 도, 어떤
    `plan/in-progress` 도 명시하지 않는다.
  - 제안: 이 draft 범위에서 처리할 필요는 없음(사실 정정이지 신규 설계가 아님). 다음에
    알림 옵트아웃/알림 채널을 다루는 planner 턴이 있을 때 참고하도록, `9-user-profile.md
    §5.1` 각주나 새 observability 트래커에 짧게 남겨 두는 정도면 충분.

## 점검한 범위와 결론

- `plan/in-progress/spec-sync-auth-gaps.md`(전문 확인) — target 의 ①·②는 이 트래커 "추가
  발견(2026-08-30, `21_59_41` cross_spec)" W1·W2 항목을 정확히 이행한다. W1 은 트래커 자체가
  "(a) 문구 제거 / (b) 구현 티켓" 두 선택지를 열어 두고 "project-planner 턴 필요" 라고
  적어 뒀는데, 이 draft(owner: project-planner)가 (a) 를 선택하며 근거(실측 표)를 제시한다 —
  이는 트래커가 위임한 결정을 "일방적으로 우회" 하는 것이 아니라 **트래커가 요청한 그
  턴**이다. W2 도 트래커가 이미 "임시로 auth 트래커에 둔다, 다음 planner 턴이 옮기거나
  적절한 위치를 만들 것" 이라 적어 둔 것을 그대로 이행(`1-data-model.md` 신설)한다.
  target ④ 는 두 항목을 `[x]` 로 닫고 "auth 트래커라 주제가 안 맞다" 메모를 정리하겠다고
  명시 — 트래커 상태와 정확히 대응한다.
- `1-data-model.md`, `5-system/1-auth.md`, `data-flow/9-observability.md`, `alert_rule`,
  `AlertRule`, `계정 잠금`, `lockedUntil`, `ACCOUNT_LOCKED`, `login_history`, `§2.19`, `§2.25`
  등 핵심 키워드로 `plan/in-progress/**` 전체(prompt 번들에서 절단된 61개 파일 포함, 디스크
  원본 기준 전수 grep)를 재검색 — target 이 건드리는 대상을 동시에 수정 중이거나 그에 대해
  "결정 필요" 로 남겨둔 **다른** in-progress plan 은 없다. `§1.1` 매치는 전부
  `4-execution-engine.md §1.1`(다른 문서) 이고, `observability` 매치는 `node-output-redesign/
  ai-agent.md`·`variable-declaration.md` 의 무관한 일반 용어("meta observability" 블록)다.
- `backend-lint-gate-broken-on-main.md` 가 `data-flow/9-observability.md` 를 Rationale
  링크로 1회 인용하지만 Redis fail-open 카운터 라벨링 근거일 뿐, `alert_rule` 이나 §2.1
  컬럼 서술과 무관 — 충돌 없음.
- `§2.25` 신설이 다른 in-progress plan 이 동시에 예약해 둔 번호와 겹치는지 확인 —
  `1-data-model.md` 를 언급하는 in-progress plan 은 `spec-sync-auth-gaps.md`(원 트래커)와
  target 자신뿐이라 번호 충돌 없음.

## 요약

target 의 세 처방(① 잠금 이메일 알림 문구 제거, ② `AlertRule` §2.25 신설, ③ `Notification.type`
enum 보강)은 모두 그 처방의 출처인 `plan/in-progress/spec-sync-auth-gaps.md` 가 미리 남겨 둔
"결정 필요"/"임시 위치" 메모를 정확히 이행하는 것이며, 그 트래커가 요청한 대로 project-planner
턴에서 선택지 중 하나(문구 제거)를 골랐다 — 위임된 결정의 이행이지 우회가 아니다. 트래커 종결
(④)도 실제 미해결 체크박스 상태와 정확히 대응한다. 나머지 `plan/in-progress/**` 전체를
관련 키워드로 재검색해도 target 이 침범하는 미해결 결정, 미해소 선행 조건, 무효화될 후속
항목은 발견되지 않았다. 유일한 참고 사항은 신규 `Notification.type` 값이 기존(완료된) 알림
옵트아웃 카탈로그 plan 과 개념적으로 인접해 있다는 점인데, 이는 이 draft 의 범위를 벗어나는
후속 참고용 INFO 다.

## 위험도

NONE
