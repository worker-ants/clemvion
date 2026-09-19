# Plan 정합성 검토 — spec-draft-code-guards-and-change-summary.md

## 발견사항

없음.

target 이 닫으려는 두 항목을 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에서 원문으로 대조했다.

- **항목 1** (해당 파일 4698~4702행) — 「`spec/1-data-model.md` frontmatter `code:` 에 이 문서를 지키는 e2e 가드를 넣을지 — 게이트 범위 결정」. 원문이 제시한 후보 셋(`deletion-cascade-indexes` · `trigger-endpoint-path-dedupe` · `entity-schema-declarations`)과 「하나만 넣으면 어긋나고, 셋을 넣으면…」 이라는 조건이 target 의 «셋 다 넣는다» 결정과 정확히 일치한다. 세 e2e 파일 모두 `codebase/backend/test/` 에 이미 존재함을 확인했다(`ls` — 최근 커밋 `4157bc557`·`e29b2bb51`·`1cc089343` 등으로 이미 머지된 구현).
- **항목 2** (해당 파일 4673~4678행) — 「`0-canvas.md` §8.1 «버전에는 자동 생성된 `change_summary` 포함» — 자동 생성이 없다」. 원문의 두 선택지(서술을 실제로 고침 / 자동 요약을 기능으로 새로 정의)중 target 은 전자를 택하고 "사용자 결정(2026-09-19)" 으로 명시한다 — 원문이 "결정 필요" 로 열어 둔 항목을 우회 없이 정면으로 닫는 형태다.

양쪽 다 target 문서 서두에 "**사용자 결정(2026-09-19)**" 로 명시되어 있어, 미해결 결정을 일방적으로 덮어쓰는 것이 아니라 트래커가 요구한 바로 그 결정 행위를 수행하는 정상 흐름이다.

추가로 확인한 것:
- `spec/1-data-model.md` 4673행 항목이 스스로 "`code:` 등재는 아래 새 항목으로 넘겼다" 고 명시한 대상이 정확히 항목 1(4698행)이다 — 선행 항목 간 참조 사슬이 끊기지 않는다.
- 제외되는 기능 e2e 넷(`background-monitoring` · `notifications-dismiss` · `terminal-duration-sql` · `webhook-trigger`)을 `plan/in-progress/**` 전체에서 grep 했으나, 이 넷을 `1-data-model.md` 의 `code:` 에 넣자고 제안하는 다른 진행 중 plan 은 없다 — target 의 "비대상" 처분과 충돌하는 후속 항목이 없다.
- `change_summary`/`changeSummary` 문자열은 `plan/in-progress/**` 전체에서 트래커 원문과 target 자신 외에 등장하지 않는다 — 자동 요약 기능을 전제하는 다른 진행 중 작업이 없다.
- 두 항목을 참조하는 다른 in-progress plan(의존 항목)도 없다 — target 이 이 둘을 닫아도 무효화되거나 새로 만들어야 할 후속 항목이 발견되지 않는다.

## 요약

target 이 닫는 두 항목은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 4673행·4698행에 그대로 남아 있는 "결정 필요" 미결 항목이며, target 은 그 항목이 제시한 후보·조건과 정확히 일치하는 결정을 "사용자 결정" 으로 명시해 정면으로 닫는다. 선행 조건 미해소나 다른 plan 과의 충돌, 후속 항목 누락은 발견되지 않았다. 유일하게 남는 실무 사항은 target 자신의 체크리스트에 이미 적힌 "트래커 두 항목 닫기" — target 이 머지될 때 `spec-draft-nullable-notation-followups.md` 4673행·4698행 체크박스도 함께 갱신해야 한다는 점이며, 이는 검토 시점에 이미 절차로 인지되어 있다.

## 위험도

NONE
