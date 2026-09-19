# Plan 정합성 검토 — spec/3-workflow-editor/ (--impl-done)

대상: `plan/in-progress/entity-schema-declaration-drift.md` (엔티티 인덱스·제약 선언 8곳 정정,
`spec_impact: none`). 이번 scope(`spec/3-workflow-editor/`) 안에서 실제로 걸리는 코드 변경은
`node.entity.ts`(1-node-common.md 소유) · `edge.entity.ts`(2-edge.md 소유) ·
`workflow-assistant-session.entity.ts`(4-ai-assistant.md 소유) 세 파일이다. 나머지 세 파일
(`workspace.entity.ts` · `integration-expiry-dispatch.entity.ts` · `node-execution.entity.ts`)은
각각 `spec/2-navigation/`(병행 세션 `09_27_26`) 소유이거나 소유 spec 이 없다.

## 발견사항

이번 scope 에서 CRITICAL/WARNING 급 정합성 문제는 확인되지 않았다. 근거:

- **미해결 결정 충돌 없음** — `node.entity.ts` 의 `@Index('IDX_node_workflow_label', …)` 제거,
  `edge.entity.ts`/`node.entity.ts` 의 `@Check` 인용부호 수정, `workflow-assistant-session.entity.ts`
  의 인덱스 컬럼·이름 보정은 모두 `synchronize: false` 하의 **선언만** 바꾸는 것이라 런타임 동작이나
  `spec/3-workflow-editor/1-node-common.md`·`2-edge.md`·`4-ai-assistant.md` 어디에도 서술된 "결정 필요"
  항목과 충돌하지 않는다. 세 문서 모두 이 인덱스·CHECK 관련 `pending_plans`/미결 서술이 없다(`2-edge.md`
  의 `pending_plans: ai-agent-tool-connection-rewrite.md` 는 도구 연결 UX 재설계로 무관).
- **선행 plan 미해소 없음** — 이 작업의 전제(트래커 `spec-draft-nullable-notation-followups.md` 의
  "`WorkflowAssistantSession` 인덱스에 `userId` 누락" 항목)는 실제로 해당 트래커에서 `[x]` 로 닫혀 있고,
  `entity-schema-declaration-drift.md` 를 해소 근거로 정확히 인용한다. 선행 조건이 열린 채 방치된 곳은
  없다.
- **후속 항목 누락 없음** — 이 plan 이 명시한 두 파생 결정(① `spec/1-data-model.md` §2 Workspace
  `owner_id` 행에 `ON DELETE CASCADE` 미기술, ② 컬럼 층 drift 9곳)은 모두
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 실제로 새 항목으로 등재돼 있다(각각
  "`spec/1-data-model.md` §2 Workspace `owner_id` 행이 삭제 동작을 적지 않는다" 항목과 "엔티티 컬럼
  선언이 실제 DB 와 다른 아홉 곳" 항목, 둘 다 `entity-schema-declaration-drift.md`/`08_33_13` WARNING 1
  을 근거로 인용). plan 이 "트래커에 등재하겠다" 고 말한 것과 트래커의 실제 상태가 일치한다.
- **scope 경계 자체는 plan 이 이미 자체 지적하고 병행 처리 중** — `08_33_13` WARNING 2(워크스페이스·
  integration 소유 spec 이 이번 `--impl-prep` scope 밖)는 plan 체크리스트에 "`--impl-done` 은
  `spec/3-workflow-editor/` 와 `spec/2-navigation/` 둘 다" 로 반영돼 있고, 실제로 같은 오케스트레이션
  라운드에서 `spec/2-navigation/` scope 세션(`review/consistency/2026/09/19/09_27_26/`)이 병행 실행
  중이다. 이 파일(scope=3-workflow-editor)만으로는 그 두 파일(workspace·integration)의 spec 정합성을
  판정할 수 없으나, 그것은 이 세션의 결함이 아니라 애초 설계된 분할이다.

- **[INFO] 체크리스트 종결 항목 두 개가 이 리뷰 결과에 의존한다**
  - target 위치: `plan/in-progress/entity-schema-declaration-drift.md` 체크리스트 마지막 두 항목
    (`- [ ] --impl-done — spec/3-workflow-editor/ 와 spec/2-navigation/ 둘 다`,
    `- [ ] 트래커 반영(항목 닫기 + 컬럼 층 등재) · 이 plan complete/ 이동`)
  - 관련 plan: 같은 문서 자신
  - 상세: 이 두 항목은 아직 미체크 상태이며, 이 세션(spec/3-workflow-editor)과 병행 세션
    (spec/2-navigation)의 BLOCK 판정이 모두 나와야 닫을 수 있다. plan 자신이 이미 이를 인지하고
    순서를 명시해 뒀으므로 결함은 아니지만, 두 세션 결과가 합쳐지기 전에 plan 을 `complete/` 로
    옮기거나 트래커 항목을 닫으면 안 된다는 점을 기록해 둔다.
  - 제안: 별도 조치 불요 — SUMMARY 집계 시 두 impl-done 세션(09_27_19, 09_27_26)이 모두 BLOCK: NO 임을
    확인한 뒤에만 마무리 커밋(트래커 반영 + plan 이동)을 진행할 것.

## 요약

이번 scope(`spec/3-workflow-editor/`)에서 걸리는 세 엔티티 파일의 선언 정정은 `synchronize: false`
하의 순수 메타데이터 정합화이며, target 문서(1-node-common.md·2-edge.md·4-ai-assistant.md)의 미해결
결정을 우회하지도, 미해소 선행 조건에 의존하지도 않는다. plan 이 스스로 도출한 두 파생 후속 항목(spec
CASCADE 미기술, 컬럼 층 drift)은 실제로 대응 트래커에 등재돼 있어 후속 항목 누락도 없다. 유일하게 열려
있는 것은 plan 자신의 체크리스트 마지막 두 항목(이 리뷰 완료 대기, 마무리 커밋 대기)이며 이는 정상적인
in-flight 상태다.

## 위험도
NONE
