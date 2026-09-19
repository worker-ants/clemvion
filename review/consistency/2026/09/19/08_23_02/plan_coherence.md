### 발견사항

- **[WARNING]** 이번 턴이 만든 두 신규 backlog 항목이 트래커에 실제로 등재되지 않았다
  - target 위치: `plan/in-progress/spec-draft-assistant-i18n-table-sync.md` §"비대상 — 트래커에 올린다" (두 항목: (1) `assistant.continueAfterBudget`·`continueAfterBudgetButton`·`exampleArrange` 키 — 기능 서술 부재, (2) `spec/3-workflow-editor/0-canvas.md` §8.1 "자동 생성된 `change_summary`" 서술 — 자동 생성 자체가 코드에 없다는 사실 확인)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` (이 저장소의 spec drift 표준 트래커)
  - 상세: 두 항목 모두 `grep -rn "continueAfterBudget\|exampleArrange" plan/ spec/` 및 `grep -n "change_summary\|changeSummary" plan/in-progress/spec-draft-nullable-notation-followups.md` 로 확인한 결과 트래커에 **0건** — 어디에도 등재돼 있지 않다. target 문서는 "트래커에 올린다"고 서술만 할 뿐, 실제로 그 파일을 편집하거나 체크리스트로 그 작업을 못 박지 않는다. target 문서 자체에도 이를 강제할 `## 체크리스트` 섹션이 없다(반면 같은 세션의 자매 plan `plan/in-progress/entity-schema-declaration-drift.md`는 "트래커 반영(항목 닫기 + 컬럼 층 등재)"를 체크리스트 항목으로 명시하고, 같은 계열의 선례 `plan/in-progress/spec-draft-eia-notification-payload-contract.md`도 `## 후속 (developer)` 섹션에 체크박스로 후속 항목을 못 박는다 — 이 저장소의 확립된 관례). 서술만 하고 실행하지 않은 "트래커에 올린다"는 이 저장소에서 반복적으로 문제가 된 패턴이다(과거 세션에서 "이미 기록됨" 주장이 거짓이었던 사례가 있었다).
  - 제안: 이 plan 이 `complete/` 로 이동하기 전에 (a) `spec-draft-nullable-notation-followups.md` 에 위 두 항목을 실제로 `- [ ]` 로 등재하거나, (b) 이 plan 자체에 `## 체크리스트` 를 추가해 "트래커 등재" 를 완료 조건으로 명시할 것. 둘 중 하나가 실행되지 않은 채 plan 이 종결되면 두 항목은 소실된다.

### 요약
target 문서(`spec-draft-assistant-i18n-table-sync.md`)의 핵심 결정(§13 표를 사전 값에 맞춘다는 방향, 13행 정정 내역, B 의 신규 행, C 의 divider 서술 정정)은 `plan/in-progress/**` 의 어떤 미해결 결정과도 충돌하지 않았고, `entity-schema-declaration-drift.md`(같은 worktree, developer)의 `--impl-prep` BLOCK 을 해소하기 위한 선행 조건으로 정확히 정합했다(코드 실측: `assistant-message.tsx` 의 `autoResumedHint`/`autoResumedHintShort` 분기와 두 사전 파일의 실제 값이 target 의 서술과 일치). 또한 target 이 스코프 밖으로 미룬 기존 항목(WARNING 4·5 — `CONTAINER_*`, "강제 중단" 서술)은 실제로 다른 트래커·plan 에 이미 등재돼 있어 "이미 있다"는 target 의 주장이 사실이었다. 다만 target 이 **새로** 발견해 "비대상"으로 미룬 두 항목(사전 키 셋의 기능 서술 부재, `0-canvas.md` §8.1 문장의 사실 오류)은 실제 트래커에 반영되지 않아 이 plan 종결 시 소실될 위험이 있다 — 이는 이 저장소에서 이미 여러 차례 반복된 실패 패턴과 같은 형태다.

### 위험도
LOW
