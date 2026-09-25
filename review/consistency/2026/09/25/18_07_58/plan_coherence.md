# Plan 정합성 검토 — `spec-draft-workspace-path-guard-oracle-census.md`

## 발견사항

- **[WARNING]** 자매 plan `workspace-path-guard-impl.md` 의 체크리스트가 이 draft 가 존재하게 된 경위(라운드 2~4 리뷰)를 반영하지 못한 채 stale 하다
  - target 위치: 없음(target 자체의 결함이 아니라, target 이 생겨난 원인 — 4라운드 `/ai-review` 의 requirement WARNING — 이 옆 plan 에 아직 기록되지 않은 상태)
  - 관련 plan: `plan/in-progress/workspace-path-guard-impl.md` §체크리스트(파일 하단) — `- [ ] \`/ai-review\` — 1라운드 \`review/code/2026/09/25/16_03_32\`: ... 2라운드를 돈다` 항목 이후로 갱신이 없다
  - 상세: git log 상 이미 `568afefec`(2라운드 docs) · `dc60b1af8`(3라운드 fix) · `03b1d4242`(3라운드 docs) · `1f616ef05`(4라운드 fix — 바로 이 target draft 가 근거로 삼는 커밋) · `61ca58343`(4라운드 Testing WARNING#4 후속 테스트)까지 진행됐는데, `workspace-path-guard-impl.md` 체크리스트 본문은 여전히 1라운드만 적고 "2라운드를 돈다"는 예고에 머물러 있다. 그 plan 이 스스로 세운 순서 규칙("**planner 턴 순서**: 구현·테스트가 끝난 뒤 `/ai-review` 전에 연다 … `--impl-done` 은 `/ai-review` 수렴 뒤")은 사전에 알려진 W1~W5 5건짜리 **한 번의** planner 턴만 예정했다. 이번 target 은 그 순서 밖에서 — 리뷰 4라운드 도중 새로 발견된 requirement WARNING 에 대한 반응으로 — 발생한 **두 번째** planner 턴인데, 그 사실이 `workspace-path-guard-impl.md` 어디에도 아직 등재돼 있지 않다. target draft 의 spec 커밋이 착지된 뒤 `--impl-done` 을 돌리기 전에, 이 plan 에 (a) 라운드 2~4 결과 요약과 (b) 이번 두 번째 planner 턴을 그 사이에 끼워 넣는 항목이 필요하다 — 그래야 나중에 이 plan 만 읽는 사람이 "왜 --spec 이 두 번 돌았는가"를 재구성할 수 있다.
  - 제안: target 자체는 변경 불필요(spec 정정 범위가 맞다). `plan/in-progress/workspace-path-guard-impl.md` 체크리스트를 이 draft 착지 직후 갱신 — 라운드 2~4 한 줄 요약 + "requirement WARNING(4라운드) → 두 번째 planner 턴(`spec-draft-workspace-path-guard-oracle-census.md`) → spec 반영" 흐름을 명시할 것.

- **[INFO]** `workspace-path-guard-impl.md` 의 뮤턴트 표(M1~M17)에 이번 4라운드 수정(`transferOwnership` 인가 선행 재정렬, 커밋 `1f616ef05`)에 대응하는 항목이 아직 없다
  - target 위치: target 본문 "실측으로 확인했다: 비멤버 · 비-owner 멤버 × 부재 · 개인 · 팀 6케이스 테스트가 수정 전 RED 6, 인가 선행을 넣은 뒤 GREEN"
  - 관련 plan: `plan/in-progress/workspace-path-guard-impl.md` §"뮤턴트 (2026-09-25 …)" 표 — M13(`addMemberByEmail` 순서 원복)·M14(`leaveWorkspace` 인가 선행 제거)와 대칭되는 "M18: `transferOwnership` 인가 선행 제거" 류 항목이 없다
  - 상세: target 은 그 6케이스 RED/GREEN 실측을 spec 정정문 안에 직접 적었으나, 같은 실측이 impl plan 의 형식적 뮤턴트 표에는 아직 옮겨지지 않았다. 이 저장소가 "같은 사실이 한 문서에만 있고 자매 문서엔 없으면 다음 정정 때 한쪽만 갱신되는 drift 로 이어진다" 는 클래스를 반복 학습해 왔다(예: `auth-guard-reflection-hardening.md` 의 앵커 정정 이력).
  - 제안: impl plan 뮤턴트 표에 M18 한 줄 추가(권장, 선택) — 필수는 아니나 두 문서의 "뮤테이션으로 실증" 관행을 맞춰 둔다.

## 추가로 확인해 검토를 통과한 항목 (참고, 발견사항 아님)

- CHANGELOG.md "워크스페이스 권한 거부가 코드를 싣고…" 항목은 이미 "**세** 서비스 메서드도 인가를 조회보다 앞으로 옮겼다"로 서술돼 있어 target 이 고치려는 12-workspace.md Rationale 과 방향이 일치한다(CHANGELOG 가 코드보다 먼저 정정된 상태 — target 이 spec 을 그 상태로 따라잡는 모양).
- `plan/in-progress/spec-draft-nullable-notation-followups.md` (같은 spec 영역을 다루는 대형 트래커)의 "경로 파라미터로 워크스페이스를 받는 라우트 13개가 가드 층 보호를 전혀 못 받는다" 항목은 이미 `[x]` 로 닫혀 있고, 계획 단계 실측이 "9곳은 안전 · 오라클 2곳"으로 `transferOwnership` 을 안전 쪽에 잘못 분류했던 이력까지 그대로 인용돼 있다 — target 의 "계획 단계 실측이 놓친 이유" 서술과 정확히 들어맞는다. 충돌 없음.
- 같은 트래커의 `removeMember()` 존재-오라클 항목(2026-09-21 발견, 2026-09-24 `member-auth-order.md` 로 별도 해소)은 target 의 대상(`leaveWorkspace`·`addMemberByEmail`·`transferOwnership`)과 겹치지 않는 별개 라우트라 충돌하지 않는다.
- `plan/in-progress/nestjs-v12-coordinated-upgrade.md` 의 부트 캐너리 기준값(§C "2026-09-25 기준값 갱신")은 "그 PR 이 머지된 뒤 다시 잴 것"이라고 스스로 잠정성을 명시해 뒀으므로, 이번 4라운드 이후 커밋들이 만든 추가 테스트 증감과 충돌하지 않는다.
- `auth-guard-reflection-hardening.md` · `deps-guard-hardening.md` 는 주제가 인접하나(RolesGuard reflection, 의존성 보안) target 이 다루는 "경로 파라미터 오라클 카운트 정정"과 겹치는 미해결 결정이 없다.

## 요약

target 은 이미 착지된 커밋(`1f616ef05`)과 4라운드 `/ai-review` 의 requirement WARNING 을 spec 문서에 사후 반영하는 사실 정정이며, 같은 사실을 이미 담고 있는 CHANGELOG·트래커(`spec-draft-nullable-notation-followups.md`)와 line-level 로 정합한다. 미해결 결정을 우회하거나 다른 plan 이 아직 안 푼 선행 조건을 가정하는 곳은 없다. 다만 이 draft 가 발생한 경위(리뷰 도중 두 번째 planner 턴) 가 자매 plan `workspace-path-guard-impl.md` 의 체크리스트에는 아직 반영되지 않아, 그 plan 이 라운드 1까지만 기록한 채 정지돼 있다 — `--impl-done` 이전에 그 plan 갱신이 필요하다(WARNING). 뮤턴트 표 동기화는 INFO 수준의 위생 항목이다.

## 위험도

LOW
