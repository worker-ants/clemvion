# Plan 정합성 Check — `spec-draft-webchat-execution-residuals.md`

## 발견사항

- **[INFO]** developer 위임 구현이 `error-codes.ts` 동시 편집 대기열에 합류
  - target 위치: `## 구현 위임 메모 (developer 세션용)` 항목 2, `## 변경안 (5) spec/5-system/3-error-handling.md`
  - 관련 plan: `plan/in-progress/exec-intake-followups.md` `## PR2b 후속` ARCH#5
  - 상세: ARCH#5 는 `error-codes.ts` 의 엔진/노드 레이어 분리 리팩터를 "http-ssrf-all-auth-followups·node-output-redesign 이 `error-codes.ts` 에 항목을 추가 중이라 그 PR 들 정착 후 착수" 라는 사유로 명시 defer 중이다. target 이 구현 위임하는 신규 `error.code='CHANNEL_IDLE_TIMEOUT'` 도 같은 파일에 항목을 추가하게 되어, ARCH#5 의 "정착 대기" 목록에 실질적으로 하나 더 추가된다. 충돌은 아니며(단순 신규 값 추가, 값 이름도 겹치지 않음) target 자체를 막을 사유는 없으나, ARCH#5 착수 판단 시점에 이 사실이 누락되면 재편 범위 추정이 부정확해질 수 있다.
  - 제안: 구현 착수 시 developer 가 `exec-intake-followups.md` ARCH#5 항목에 target PR 도 "정착 대기" 목록에 있었음을 1줄 추가하거나, ARCH#5 를 여전히 열어두는 이유로 재확인. target 문서 자체의 편집은 불필요(스코프 밖).

- **[INFO]** target 자신의 backlog 후속 반영(checklist 7)이 아직 미실행
  - target 위치: `## 체크리스트` 7번째 줄 `- [ ] (7) backlog plan 갱신`
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 마지막 미구현 항목 "host `resetSession` booting 중 중복 webhook 가드" (line 22, 여전히 `[ ]`)
  - 상세: target 은 이 backlog 항목을 "결정 완료(coalesce, 구현 handoff)" 로 갱신하고 신규 item B(B-2 backstop)를 등재하겠다고 §변경안 (7)에 명시했으나, 이 편집은 아직 실행되지 않았다(체크박스 미체크, 대상 파일도 미변경 확인). target 문서 본문의 결정 자체는 정합적이나, 이 backlog 파일이 갱신되지 않은 채로 머지되면 "미해결 결정 우회" 는 아니지만 "이미 해소된 항목이 backlog 에 미해결로 표시" 되는 stale 상태가 잠시 남는다.
  - 제안: target 편집 적용 시 (7)도 함께 수행해 두 파일의 상태를 동시에 닫을 것(이미 target 워크플로 상 예정된 절차이므로 실행 누락만 주의).

## 조사 결과 (충돌 없음 확인)

- **미해결 결정과의 충돌**: `plan/in-progress/**` 전체에서 A(coalesce)·B-1(client cancel)·B-2(channel idle-wait timeout)·`cancelledBy` 재사용·신규 `error.code`·EIA-RL-07·"신규 주기 스캐너 미도입" 원칙 예외 관련 미해결 "결정 필요" 항목은 발견되지 않았다. 유일하게 직접 겹치는 항목은 `spec-sync-external-interaction-api-gaps.md` 의 item A(위 INFO 참고)로, target 이 이를 정확히 인지하고 결정으로 대체하는 중이다.
- **선행 plan 미해소**: target 이 의존하는 전제(§3 시퀀스 7 proactive refresh 구현됨, EIA-RL-06 terminal revoke sweep 선례, `recoverStuckExecutions` 가 boot-only, EXECUTION_QUEUE_WAIT_TIMEOUT `cancelledBy='timeout'` 선례) 는 모두 이미 완료된 plan/spec 상태와 일치한다(`exec-intake-followups.md` "orphan pending backstop" 완료 확인 — `recoverStuckExecutions` 가 `§7.4 부팅+test-hook` 스코프임을 재확인, target 의 B-2 boot-only 불충분 논거와 정합). W1 이 지적했던 reload-401 낙관적 refresh 는 여전히 어떤 plan 에도 owner 가 없는 "Planned" 상태이나, target 은 이를 논거의 필수 전제로 삼지 않는다고 명시적으로 caveat 처리했으므로 선행 미해소로 인한 blocking 은 없다.
- **후속 항목 누락**: `eia-command-waiting-surface-guard.md`(완료, `/interact` 표면 매트릭스)·`eia-context-schema-followups.md`(완료 위주, context 스키마)·`spec-draft-pr874-deferred-docs.md`(완료, R7/§9 문서 보강) 등 인접 EIA/위젯 plan 은 target 의 A/B 설계와 레이어가 겹치지 않는다(각각 `/interact` 명령 표면 검증, context DTO 형태, 문서 서술 보강 — target 은 `cancel`(§5.4) 신규 흐름 + 신규 backstop). `spec-sync-websocket-protocol-gaps.md` 의 잔여 항목(§4.5 시스템 이벤트·server ping)도 §4.1 `execution.cancelled` 와 무관해 target 의 WS 편집과 충돌하지 않는다.

## 요약

`spec-draft-webchat-execution-residuals.md` 는 착수 전 자체 "정찰" 절에서 이미 병렬 plan/backlog 존재 여부를 확인했고, 실제로 조사한 결과도 그 판단과 일치한다 — `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 item A(host `resetSession` 중복 webhook 가드)만 유일하게 겹치며, target 이 이를 정확히 인지하고 결정으로 해소한 뒤 checklist (7)에서 backlog 파일 동기 갱신을 스스로 예정해 두었다. `plan/in-progress/**` 전역에서 target 의 A/B 설계(coalesce·client cancel·channel idle-wait timeout·`cancelledBy` 재사용·신규 `error.code`·주기 스캐너 원칙 예외)와 직접 충돌하는 미해결 "결정 필요" 항목이나 무효화될 후속 항목은 발견되지 않았다. 유일한 잔여 리스크는 절차적인 것 — (7) 체크박스가 실행 전이라는 점과, 구현 단계에서 `error-codes.ts` 에 신규 값을 추가하는 것이 이미 그 파일 재편을 대기 중인 `exec-intake-followups.md` ARCH#5 의 "정착 대기" 목록에 무언급으로 하나 더 얹힌다는 점 — 둘 다 INFO 수준이며 target 문서 자체의 결정을 재개봉할 필요는 없다.

## 위험도

LOW
