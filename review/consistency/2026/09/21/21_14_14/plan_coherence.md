# Plan 정합성 검토 — spec/5-system (impl-done)

## 검토 전제

- target(`spec/5-system`) 델타: 0개 파일 — 이 브랜치는 코드 전용(`e2e-race-helper`) 리팩터이며 spec 변경이 없다. 이는 정상이며 그 자체로는 결함이 아니다.
- 실제 diff: `codebase/backend/test/**` 9개 e2e spec + 신규 `codebase/backend/test/helpers/concurrency.ts` (프로덕션 코드 변경 0), 그리고 `plan/in-progress/e2e-race-helper.md`(신규) · `plan/in-progress/spec-draft-nullable-notation-followups.md`(갱신).
- 소유 plan: `plan/in-progress/e2e-race-helper.md` (`spec_impact: none`). spec/5-system 과는 직접 관련이 없어 위 세 관점(미해결 결정 충돌·선행 plan 미해소·후속 항목 누락) 중 target-vs-spec 축에서는 특이사항이 없다.
- 다만 diff 에 포함된 plan 문서 간(`e2e-race-helper.md` ↔ 트래커 `spec-draft-nullable-notation-followups.md`) 자체에 라이프사이클 불일치가 있어 아래에 보고한다 (plan 정합성 검토의 목적과 직접 맞닿음 — 다음 세션·merge-coordinator 가 트래커만 보고 상태를 오판할 수 있다).

## 발견사항

- **[WARNING]** 트래커가 "해소" 를 선언했지만 소유 plan 은 아직 열려 있고 인용된 `plan/complete/` 경로가 존재하지 않는다
  - target 위치: (diff 포함 문서) `plan/in-progress/spec-draft-nullable-notation-followups.md` — "동시성 e2e 아홉 파일의 공용 헬퍼를 추출한다" 항목, `[x]` 체크 + "**2026-09-21 해소** (`plan/complete/e2e-race-helper.md`)" 각주 (commit `ffb2a8197`)
  - 관련 plan: `plan/in-progress/e2e-race-helper.md` (아직 `plan/in-progress/` 에 있음 — `plan/complete/e2e-race-helper.md` 는 워킹트리에 존재하지 않음). 이 plan 의 `## 체크리스트` 는 세 항목이 미체크로 남아 있다:
    - `[ ] /ai-review → 수렴`
    - `[ ] /consistency-check --impl-done <scope> → BLOCK: NO`
    - `[ ] 트래커 항목 해소 + 이 plan plan/complete/ 로`
  - 상세: `git show ffb2a8197 -- plan/in-progress/e2e-race-helper.md` 는 빈 diff — 트래커를 "해소" 로 갱신한 그 커밋이 소유 plan 자체는 전혀 건드리지 않았다. 그런데 그 커밋 메시지("리뷰 라운드 3 수렴 — Critical·Warning 0")는 `/ai-review` 가 실제로 수렴했음을 말하고 있어, 소유 plan 의 `[ ] /ai-review → 수렴` 체크박스는 이미 사실과 어긋난 stale 상태다. 게다가 지금 이 검토(`/consistency-check --impl-done`) 자체가 세 번째 체크박스의 선행 조건인데, 트래커는 이미 그보다 앞서 전체 항목을 완료 처리했다 — 소유 plan 의 체크리스트가 규정한 순서(ai-review → consistency-check --impl-done → 트래커 해소+이동)를 앞지른 것이다.
    이 저장소의 동일 라운드 선례들(`3cbb4a1dc`→`plan/complete/webauthn-dup-delete.md`, `890fcd9b7`→`plan/complete/modelconfig-dup-delete.md`, `4d906474`→`plan/complete/integration-dup-delete.md` 등)은 전부 "트래커 체크박스·해소 마커·plan 이동·frontmatter 를 한 커밋으로 처리한다"(커밋 메시지 인용)는 관례를 지켜 트래커 갱신과 `plan/complete/` 이동이 **같은 커밋**에 들어 있었다. 이번 건은 그 관례에서 벗어나 트래커만 앞서 갱신되고 이동이 빠졌다.
  - 제안: 마무리 커밋에서 (1) `plan/in-progress/e2e-race-helper.md` 의 `/ai-review` 체크박스를 사실대로 체크, (2) 이번 `/consistency-check --impl-done` 결과(BLOCK 여부)를 그 체크박스에 반영, (3) 통과 시 트래커 각주가 가리키는 경로대로 `plan/in-progress/e2e-race-helper.md` → `plan/complete/e2e-race-helper.md` 로 실제 이동 + frontmatter(`status: complete`) 갱신을 **같은 커밋**에서 수행해 트래커의 선언과 실제 상태를 일치시킬 것. 만약 이번 검토가 BLOCK:YES 로 끝나면 트래커의 "해소" 각주는 되돌리거나 조건부로 정정해야 한다(현재는 무조건 완료를 주장하고 있어, 이번 검토 결과와 무관하게 이미 확정된 사실처럼 읽힌다).

## 요약

target(spec/5-system)은 이번 diff 로 변경되지 않았고, 소유 plan(`e2e-race-helper.md`)의 설계·실측·판별 실험(음성 대조군)도 자체적으로 충실해 spec 축의 결정 충돌이나 선행 plan 미해소는 없다. 다만 diff 에 포함된 트래커 plan(`spec-draft-nullable-notation-followups.md`)이 이 저장소가 스스로 지켜온 "트래커 해소 마커 = plan/complete 이동과 동일 커밋" 관례를 어기고, 존재하지 않는 `plan/complete/e2e-race-helper.md` 를 인용하며 완료를 선언한 반면 소유 plan 은 여전히 `plan/in-progress/` 에 3개 미체크 항목(그중 하나는 이미 사실과 어긋난 stale 체크박스)을 가진 채 남아 있다. 이는 결정 충돌이 아니라 plan 라이프사이클 기록의 시점 불일치이며, 마무리 커밋에서 체크박스 갱신 + 실제 이동을 동시에 처리하면 해소된다.

## 위험도
MEDIUM
