# Plan 정합성 검토 — 삭제 연쇄 FK 인덱스 (V112~V116)

## 전제 확인

- 이번 호출의 target scope 는 `spec/conventions/` 이며 `origin/main` 대비 델타는 **0개 파일**이다 — 이 PR 은 `spec/1-data-model.md`·
  `spec/data-flow/{3-execution,5-integration,7-llm-usage}.md` 만 건드리고 `spec/conventions/` 는 건드리지 않는다. 프롬프트 번들이
  지시한 대로 델타 0 자체를 근거로 CRITICAL 을 내지 않았다.
- `spec/conventions/` 에 실질 변경이 없으므로, 이 target 이 `plan/in-progress/**` 의 미해결 결정과 직접 충돌할 표면 자체가 없다.
  대신 이 PR 의 실제 실질 변경(마이그레이션 V112~V116, `plan/in-progress/spec-draft-deletion-cascade-indexes.md`, 그 draft 가
  참조하는 `plan/in-progress/spec-draft-nullable-notation-followups.md`·`plan/in-progress/cafe24-backlog-residual.md` 갱신)을
  대상으로 plan 정합성을 확인했다 — 관련 plan 이 이 PR 자신이 만드는 산출물이기 때문에 근접 파급을 놓치지 않기 위함이다.
- **주의**: 검토 도중 `plan/in-progress/spec-draft-deletion-cascade-indexes.md` 와 `plan/in-progress/spec-draft-nullable-notation-followups.md`
  가 같은 worktree 안에서 실시간으로 갱신됐다(git 미커밋 상태, 동일 세션의 후속 단계로 추정). 아래 판정은 검토 시점의 **최신
  워킹트리 상태**를 기준으로 한다.

## 발견사항

- **[INFO]** 캔버스 저장의 실행 이력 CASCADE 삭제 — 데이터 보존 정책 질문이 트래커에 미등재
  - target 위치: `plan/in-progress/spec-draft-deletion-cascade-indexes.md` `## 비대상` 표 세 번째 행 — "캔버스 저장이 노드를
    지울 때 그 노드의 실행 이력까지 CASCADE 로 사라지는 것 | 데이터 보존 정책 질문이지 인덱스 문제가 아니다 — 이 draft 는 비용만
    다룬다"
  - 관련 plan: 없음 (바로 이 점이 문제) — 같은 draft 안에서 발견된 다른 범위-밖 항목(`--impl-prep` 이 지나가다 본 cafe24 카탈로그
    문서 위생 셋)은 `plan/in-progress/cafe24-backlog-residual.md` 에 즉시 등재됐는데, 이 데이터 보존 정책 질문은 같은 처리를
    받지 못했다
  - 상세: target 자신이 "인덱스 문제가 아니다" 라며 범위 밖으로 선을 그은 것은 타당하다. 다만 그 판단이 곧 "제품적으로 문제
    없음" 을 뜻하지 않는다 — 캔버스 저장으로 노드가 빠지면 그 노드의 `NodeExecution`(및 CASCADE 로 딸린 `IntegrationUsageLog`)이
    영구 소실된다는 사실은 이번 실측으로 새로 정량화됐다(연쇄 표 §"어느 경로가 그 FK 를 부르나"). 이 관찰이 어떤 트래커에도
    적히지 않으면, "비용만 다룬다" 는 선언과 함께 그대로 유실될 위험이 있다
  - 제안: 같은 세션이 cafe24 항목에 쓴 패턴대로 `plan/in-progress/spec-draft-nullable-notation-followups.md` 또는 별도 backlog
    항목에 "캔버스 저장이 빼는 노드의 실행 이력이 보존 정책 없이 CASCADE 로 사라진다 — 제품 결정 필요" 한 줄을 등재해 다음
    사람이 재발견하지 않게 한다. 시급성은 낮음(기존부터 있던 동작, 이 PR 이 새로 만든 문제 아님)

## 상호 참조 무결성 확인 (참고 — 문제 없음)

아래는 발견사항이 아니라, 검토 중 확인해 이상 없음을 확인한 항목이다(다음 검토자의 중복 확인 비용을 줄이기 위해 기록):

- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 «`workflow`·`workspace` 를 참조하는 FK 중 선두 인덱스가 없는
  여섯» 항목은 이 draft 의 실측으로 **전제 정정**되어 "선두 인덱스가 없는 FK — 부모를 한정하지 않은 전수 37개 중 32개 남음" 으로
  갱신돼 있다. 원래 여섯(→ `integration_usage_log.workflow_id`·`alert_rule.workflow_id`·`auth_config.workspace_id`·
  `knowledge_base.workspace_id`·`integration_oauth_state.workspace_id`·`integration_oauth_preview.workspace_id`)은 draft 의
  `## 부록` 37행 표에 전부 재등재돼 있고, 그중 `integration_usage_log.workflow_id` 하나만 이번 PR(V114)로 해소, 나머지 다섯은
  미해소로 남아 목록에 그대로 있다 — 삭제·중복·모순 없음.
  - 부록 표 데이터 행 수를 세어 "37개" 서술과 대조: 37행 일치. `✅` 표시 5행 — V112~V116 각각 1개씩, "37개 중 32개 남음" 서술과
    일치.
- `plan/complete/spec-draft-trigger-workflow-index.md`(이 draft 가 «전제가 좁았다» 고 지목한 선행 완료 plan)의 "29개 FK 대조"
  서술은 **정정되지 않은 채 그대로** 남아 있다 — 이는 완료 아카이브라 당시 기준으로는 참이었던 서술을 보존하는 것이 이
  저장소의 관례이며(라이프사이클 문서 SoT), 새 draft 가 "재 보니 그 전제가 좁았다" 고 본문·Rationale·트래커 세 곳에서 명시적으로
  잇고 있어 모순으로 읽히지 않는다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md`·`plan/in-progress/spec-draft-deletion-cascade-indexes.md` 양쪽이
  아직 `plan/complete/` 로 이동하지 않은 이 draft 를 `plan/complete/spec-draft-deletion-cascade-indexes.md` 경로로 선인용하고
  있다. 이 draft 자신의 체크리스트가 "이동은 이 PR 의 마지막 커밋" 이라고 명시하므로(spec Rationale 이 그 경로를 인용하는 기존
  관례와 동일 패턴), 현재는 `/ai-review`·`--impl-done` 이 아직 끝나지 않은 정상적인 작업 중 상태의 선인용이지 깨진 참조가
  아니다. 다만 이 인용은 **`/ai-review`·`--impl-done`(본 검토 포함)이 무수정으로 통과해 실제로 같은 커밋에 draft 이동이
  뒤따를 때만** 유효해진다 — 이번 라운드에서 Critical 이 나와 본문이 바뀌면 이미 적힌 "해소 다섯" 서술과 수치가 그 변경을
  못 따라갈 수 있으니, draft 를 고치는 라운드가 또 있다면 트래커 쪽 수치도 같이 갱신해야 한다는 점만 남겨둔다(체크리스트에
  이미 있는 절차이므로 새 항목 등재는 불필요).
- 새 마이그레이션 V112~V116 이름·번호는 `plan/in-progress/**` 다른 어떤 문서에서도 다른 의미로 선점돼 있지 않다(전수 grep 0건).
- 이 PR 이 다음 후보로 미룬 "지식 베이스 연쇄"(`document_chunk`→`entity`/`relation`, `entity`→`relation`)는 draft 부록·트래커
  양쪽에서 동일하게 "다음 후보" 로 일관되게 표시돼 있고, 이를 선점한 다른 in-progress plan 은 없다(`rag-quality-improvement.md`
  등 RAG 관련 plan 은 검색 알고리즘만 다루고 삭제 연쇄를 언급하지 않는다).

## 요약

target scope(`spec/conventions/`)의 델타가 0이라 그 좁은 의미의 plan 충돌은 없다. 이 PR 의 실질 변경(V112~V116 인덱스 마이그레이션과
그에 딸린 `spec/1-data-model.md`·data-flow 세 문서, 그리고 `plan/in-progress/spec-draft-deletion-cascade-indexes.md`·
`spec-draft-nullable-notation-followups.md`·`cafe24-backlog-residual.md` 세 트래커 갱신)까지 넓혀 대조한 결과, 선행 트래커 항목의
전제 정정·부록 표·체크리스트 상태가 서로 모순 없이 맞물려 있고 미해결 결정을 우회하는 지점도 없다. 유일하게 남기는 것은 INFO
하나 — 캔버스 저장이 노드를 뺄 때 그 실행 이력이 보존 정책 없이 CASCADE 로 사라진다는, 이번 실측으로 드러난 제품 질문이 (같은
draft 안의 다른 범위-밖 발견들과 달리) 아직 어느 트래커에도 등재되지 않았다는 점이다.

## 위험도

LOW
