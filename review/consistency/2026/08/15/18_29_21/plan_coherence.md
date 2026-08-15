## 발견사항

- **[WARNING]** `cancelledBy` 해소가 명시적으로 "동시 갱신" 대상으로 지목된 다른 두 plan 에 반영되지 않았다
  - target 위치: `spec/5-system/14-external-interaction-api.md:579` (`result.cancelledBy` 행, "**(2026-08-15 해소)**"), 그리고 `plan/in-progress/retry-turn-terminal-guard.md` #2(P2, `[x]` 완료)· `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (해당 체크박스 `[x]`)
  - 관련 plan: `plan/in-progress/eia-terminal-payload.md:283-292` (`## 다른 plan 과의 관계 (W4·W6)`) — 이 문서 자신이 *"이 작업을 이미 추적 중인 plan 이 셋 있다. 구현 후 그쪽 체크박스가 stale 로 남지 않게 동시 갱신할 것"* 이라고 명시하며 정본(`spec-sync-external-interaction-api-gaps.md`) · `spec-draft-eia-notification-payload-contract.md` · `backend-lint-gate-broken-on-main.md`(774~791행) 세 곳을 지목했다.
  - 상세: 이번 PR(`eia-terminal-emit-facade.md`)이 `retry-turn-terminal-guard.md` #2 와 `spec-sync-external-interaction-api-gaps.md` 정본 항목은 갱신했으나, 나머지 둘은 `git diff origin/main...HEAD --stat` 로 확인한 결과 **전혀 손대지 않았다**:
    - `plan/in-progress/spec-draft-eia-notification-payload-contract.md:106` 필드표가 여전히 `result.cancelledBy | 구현됨(경로 1곳 누락) | ... failRetryExecution L956 은 emit 안 함` 으로 남아 있고, `:212-213` 체크박스도 `- [ ] failRetryExecution 의 cancelledBy 누락 → retry-turn-terminal-guard.md #2 에서 집행 (그 항목 완료 시 (1) 표의 "경로 1곳 누락" 도 함께 해제)` 로 미체크 상태다. 이 문서 스스로 "그 항목 완료 시 함께 해제" 라고 조건을 적어 뒀는데 그 조건이 이제 참인데도 반영되지 않았다.
    - `plan/in-progress/backend-lint-gate-broken-on-main.md:786-791` 의 `- [ ] [developer] failRetryExecution 이 cancelledBy 를 안 채운다` 항목도 여전히 미체크 상태로, `retry-turn-terminal-guard.md` 를 "미완료" 로 교차 참조하고 있다.
  - 제안: 두 문서의 해당 표/체크박스를 이번 PR 이 만든 해소 사실(`eia-terminal-emit-facade.md` 흡수, `'user'` 값 사용)로 갱신하거나, 최소한 `retry-turn-terminal-guard.md` #2 완료를 가리키는 각주를 추가한다. (이 저장소 기록된 교훈 — "plan 체크박스 두 군데 동기화" — 의 재발이다.)

- **[WARNING]** "별도 항목으로 등재한다" 는 약속이 실제로는 등재되지 않았다 (같은 plan 가족이 최근에 자백한 것과 동일한 패턴의 재발)
  - target 위치: `plan/in-progress/eia-terminal-emit-facade.md:36-38` — *"실제 원인이 timeout/system 이었다면 cancelledBy 와 error 부재가 함께 틀린다... DB 의 `error.code` 로 원인을 파생하는 개선은 별도 항목으로 등재한다."*
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (정본 트래커) — 해당 항목을 grep 했으나 없음. `spec-draft-eia-notification-payload-contract.md` 도 `cancelledBy`/`error.code` 관련 서술은 있으나 이 신규 개선 항목과는 무관(기존 닫힌-union 계약 서술일 뿐)
  - 상세: `spec-sync-external-interaction-api-gaps.md` 전체를 검색해도 "DB 의 `error.code` 로 `cancelledBy` 원인을 파생" 하는 개선을 가리키는 체크박스나 절이 없다. 같은 정본 트래커 문서(3130행 부근)는 바로 이 세션에서 *"나는 세 라운드에 걸쳐 RESOLUTION 과 커밋 메시지에 '별건 등재됨' 이라 썼는데 `plan/` 전체 grep 결과 그런 체크박스가 없었다"* 는 정확히 동일한 결함을 자백하고 "유예의 근거로 '등재했다' 를 인용할 때, 그 등재를 실측하지 않았다" 는 교훈을 남겼다. `eia-terminal-emit-facade.md` 가 같은 턴에 같은 실수를 반복했다.
  - 제안: `spec-sync-external-interaction-api-gaps.md` 의 `## 후속 (cross-cutting, 본 spec 밖)` 또는 신규 절에 `cancelledBy` timeout/system 오분류 가능성 항목을 실제로 등재하거나, 이번 PR 문구에서 "등재한다" 대신 "등재가 필요하나 아직 하지 않았다" 로 정정한다.

## 요약

이번 diff 는 `plan/in-progress/eia-terminal-emit-facade.md` 가 `spec-sync-external-interaction-api-gaps.md` (정본 트래커)의 "종결 emit 타입 초크포인트" 항목을 집행하고, 그 부산물로 `retry-turn-terminal-guard.md` #2(`cancelledBy` 누락)를 흡수해 `spec/5-system/14-external-interaction-api.md` 의 관련 행을 "해소" 로 갱신했다 — 두 정본 문서(트래커·흡수 대상 plan) 간 정합은 잘 맞는다. 다만 이 흡수 작업을 **명시적으로 예고했던 문서**(`eia-terminal-payload.md`)가 "동시 갱신 대상"으로 지목한 두 개의 다른 plan(`spec-draft-eia-notification-payload-contract.md`, `backend-lint-gate-broken-on-main.md`)에는 반영되지 않아 그쪽에 stale 한 "미완료" 서술이 남았다. 또한 `eia-terminal-emit-facade.md` 자신이 "별도 항목으로 등재한다"고 적은 후속(cancelledBy 정확도 개선)이 실제로는 어디에도 등재되지 않았는데, 이는 같은 정본 트래커가 이 세션 안에서 이미 한 차례 자백한 것과 동일한 패턴의 재발이다. 두 건 모두 결정 충돌(CRITICAL)은 아니고 후속/교차 문서 갱신 누락(WARNING) 성격이다.

## 위험도
MEDIUM
