# Rationale 연속성 검토 결과

STATUS: OK

## 발견사항

### [INFO] §3 신규 행 (`workspace_type_mismatch` 그룹) 에 인접 Rationale 교차 참조 보강 여지
- target 위치: `spec/conventions/error-codes.md §3` 4번째 행 (`workspace_type_mismatch` · `already_a_member` · `invitation_already_pending` · `invitation_already_accepted`)
- 과거 결정 출처: `spec/data-flow/12-workspace.md` 라인 72 — "초대 흐름이 발행하는 4종 lower_snake_case 는 historical artifact, error-codes.md §3 등재" + "already_a_member·workspace_type_mismatch 는 직접 추가 경로(§1.9)가 발행하는 UPPER_SNAKE 와 동일 의미·별개 wire 코드 — 통합 금지"
- 상세: target §3 행은 "모듈 일관성 보존을 위해 lowercase 유지(2026-06-28 결정)" 를 근거로 명시하고 있어 합의 원칙과 대체로 일치한다. 단, `already_a_member`/`workspace_type_mismatch` 가 §1.9 직접 추가 경로의 UPPER_SNAKE 코드와 **동명 의미·별개 wire 코드**로 의도적으로 분리된다는 사실이 12-workspace.md Rationale 에는 명시되어 있으나 target §3 행 자체에는 "의도적 분리" 설명이 있어 일관성은 유지된다. 다만 두 스펙 간 상호 교차 참조가 단방향(12-workspace → error-codes)으로만 되어 있어 양방향 참조를 추가하면 탐색 편의가 높아진다.
- 제안: target §3 근거 열의 12-workspace.md 링크에 "§1.9 직접 추가 경로의 UPPER_SNAKE 코드와 의도적 분리" 주석을 간략히 보완하거나, 현 상태를 유지하고 12-workspace.md 의 단방향 참조에 역참조 링크를 추가하는 것을 검토. 현재도 정합 위반은 아님.

### [INFO] §5 retirement 진입 기준 Rationale 과 `WORKSPACE_REQUIRED` 사례 정합 — 이미 정합
- target 위치: `spec/conventions/error-codes.md §5 Rationale` — "§5 진입 기준이 'client 코드 분기 미존재' 인 이유" + `WORKSPACE_REQUIRED` 행
- 과거 결정 출처: `spec/5-system/15-chat-channel.md` 라인 343 — rotate-bot-token 응답 표에 `WORKSPACE_ID_REQUIRED` 가 canonical 코드로 명시; `spec/5-system/1-auth.md` §1.3 에 `WORKSPACE_ID_REQUIRED` 정상 등재
- 상세: target §5 의 `WORKSPACE_REQUIRED → WORKSPACE_ID_REQUIRED` rename 항은 "user-docs 목록에만 노출됐고 client 하드코딩 분기 없음 — breaking 영향 0" 이라는 기준으로 §5 에 흡수됐다. 15-chat-channel.md 가 이미 `WORKSPACE_ID_REQUIRED` 를 신 canonical 로 사용하고 있어 구 코드(`WORKSPACE_REQUIRED`)가 실제로 은퇴됐음을 확인할 수 있다. 정합 위반 없음.

### [INFO] `WORKER_HEARTBEAT_TIMEOUT` — "heartbeat 채널 신설 폐기" 결정과 코드명 유지의 연속성 확인
- target 위치: `spec/conventions/error-codes.md §3` 마지막 행 (`WORKER_HEARTBEAT_TIMEOUT`)
- 과거 결정 출처: `spec/5-system/4-execution-engine.md` §7.1 Rationale "§7.1 heartbeat → stalled-job 일원화 (2026-06-04 결정)" — "별도 heartbeat 채널(워커 5초 emit + 중앙 검사) 도입을 포기하고 BullMQ stalled-job 으로 일원화"; "WORKER_HEARTBEAT_TIMEOUT 코드는 유지하되 의미를 재정의"
- 상세: target §3 행이 "heartbeat 는 워커가 주기적으로 emit 하는 별도 heartbeat 채널을 암시하나 그런 채널은 신설하지 않는다 — 실제 검출은 BullMQ stalled-job 재배달 attempts 소진" 이라고 코드명과 의미 재정의를 명시하고 있어, 4-execution-engine.md Rationale 의 결정(heartbeat 채널 폐기·stalled-job 일원화·코드 의미 재정의)과 완전히 정합한다. 기각된 대안(별도 heartbeat 채널)이 재도입되지 않았음을 확인.

## 요약

target `spec/conventions/error-codes.md` 는 기존 spec Rationale 에서 합의된 핵심 원칙(의미 기반 명명, rename = breaking, historical-artifact 예외 레지스트리, §5 "client 코드 분기 미존재" 흡수 기준, heartbeat 채널 폐기·stalled-job 일원화, CAFE24_PRIVATE_APP_ALREADY_CONNECTED 코드명 유지)을 모두 올바르게 계승하고 있다. 신규 추가된 `workspace_type_mismatch` 그룹 §3 행의 "2026-06-28 결정" 도 12-workspace.md Rationale 의 lowercase 유지 방침과 일치한다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회는 발견되지 않았다. INFO 항목 2건은 양방향 교차 참조 보강·확인 수준의 제안이며 차단 사안이 아니다.

## 위험도

NONE
