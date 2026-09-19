# Plan 정합성 검토 — target: spec/2-navigation/

## 검토 전제 확인

- `spec/2-navigation/` 델타는 실측대로 0개 파일. 이 PR 의 실제 코드 diff(8개 파일)는 `edge.entity.ts` ·
  `integration-expiry-dispatch.entity.ts` · `node-execution.entity.ts` · `node.entity.ts` ·
  `workflow-assistant-session.entity.ts` · `workspace.entity.ts` · 신규 e2e 가드 ·
  `spec/3-workflow-editor/4-ai-assistant.md` 뿐이며, `spec/2-navigation/` 이 관장하는 엔티티(`Trigger`·
  `Schedule`)는 이 PR 에서 건드리지 않았다. `--impl-done` 이 이 scope 로도 도는 이유는 별개다 —
  `plan/in-progress/entity-schema-declaration-drift.md` 체크리스트가 자체적으로
  `[ ] --impl-done — spec/3-workflow-editor/ 와 spec/2-navigation/ 둘 다` 를 요구하기 때문이며, 이 요구는 그
  plan 의 2차 `--impl-prep` (`review/consistency/2026/09/19/08_33_13` WARNING 2)이 "scope 가 workspace·
  integration 두 엔티티의 소유 spec(`spec/2-navigation/9-user-profile.md` · `4-integration.md`)을 덮지
  못했다" 고 지적한 데서 온다.

## 발견사항

검토 결과 CRITICAL/WARNING 급 정합성 결함은 발견되지 않았다. developer 가 plan 안에서 이미 자체
점검한 결론(WARNING 2 — 두 문서 모두 이번에 바뀐 인덱스·제약 이름이나 Workspace 소유자 FK 삭제
동작을 서술하지 않는다)을 아래와 같이 직접 재확인했다.

- **INFO** — `spec/2-navigation/9-user-profile.md` / `4-integration.md` 는 이번 엔티티 정정과 무관함을
  재확인
  - target 위치: `spec/2-navigation/9-user-profile.md` (워크스페이스 나가기/이양/삭제 UX 섹션, 약
    194~374행), `spec/2-navigation/4-integration.md` (V072 통일 store-identifier UNIQUE 서술부)
  - 관련 plan: `plan/in-progress/entity-schema-declaration-drift.md` 착수 전 검토 WARNING 2
  - 상세: 이 PR 은 (a) `Workspace.owner`(`ownerId → User`) 관계에 `{ onDelete: 'CASCADE' }` 를 추가하고
    `@Index(['ownerId','type'])` 를 실제 DB 의 `uq_workspace_personal_owner (owner_id) WHERE
    type='personal'` 로 교체했고, (b) `IntegrationExpiryDispatch` 의 `@Unique('integration_expiry_dispatch_key', …)`
    에서 이름을 제거했다(자동 생성 이름과 불일치했던 것을 무이름 선언으로 정정). 두 파일을 직접
    grep 한 결과 — `9-user-profile.md` 는 owner 관련 서술이 전부 앱 레벨 흐름(자가 탈퇴 차단·Owner
    이양·워크스페이스 삭제 API)이고 `owner_id` FK 의 DB-레벨 `ON DELETE` 동작이나 인덱스 이름을
    언급하지 않는다("유일한 owner 는 차단"은 멤버 나가기 규칙이지 FK CASCADE 서술이 아니다).
    `4-integration.md` 는 `integration_expiry_dispatch` 자체를 언급하지 않으며(그 테이블은
    `spec/data-flow/5-integration.md` · `8-notifications.md` SoT), 그 두 data-flow 문서도 제약을
    이름 없이 `(integration_id, threshold, token_expires_at) UNIQUE` 로만 서술해 이번 이름 제거와
    이미 정합적이다. `IDX_node_workflow_label` 제거·`chk_no_self_loop`/`chk_node_placement` 이름
    명시·`idx_workflow_assistant_session_*` 이름 명시 넷도 `spec/2-navigation/` 안 어디서도
    참조되지 않는다(grep 0건).
  - 제안: 갱신 불필요. `plan/in-progress/entity-schema-declaration-drift.md` 체크리스트의
    `--impl-done spec/2-navigation/` 항목은 이 결과로 체크 가능하다.

- **INFO** — 완료 전 forward-reference: 트래커가 `entity-schema-declaration-drift.md` 를
  `plan/complete/` 로 미리 인용
  - target 위치: 해당 없음(target 문서와 무관, plan 간 내부 참조)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 4649·4660·4680행이
    `plan/complete/entity-schema-declaration-drift.md` 를 인용하지만, 그 plan 파일은 현재도
    `plan/in-progress/`에 있고 자신의 체크리스트에 `[ ] --impl-done` · `[ ] 트래커 반영 · complete/
    이동` 이 미완료로 남아 있다
  - 상세: target(spec/2-navigation) 정합성과는 무관한 사소한 순서 문제이나, 두 plan 이 같은
    브랜치/PR 안에서 함께 움직이고 있어 마무리 커밋에서 `entity-schema-declaration-drift.md` 를
    실제로 `complete/` 로 옮기면 저절로 해소된다.
  - 제안: 이 PR 의 마무리 커밋에서 plan 이동을 `--impl-done` 통과 직후 함께 수행할 것(현재
    체크리스트 순서가 이미 그렇게 되어 있음 — 별도 조치 불필요, 확인 차 기록).

## 요약

이 PR 의 실질 코드 변경(엔티티 인덱스·제약·FK 선언을 실제 DB 와 일치시키는 정정, `Trigger`/`Schedule`
엔티티는 미변경)은 `spec/2-navigation/` 이 다루는 화면·API 계약과 접점이 없다. `--impl-done` 이 이
scope 를 도는 것은 해당 plan 자신이 착수 전 `--impl-prep` 에서 제기한 "소유 spec 미검토" 우려를
닫기 위한 절차이며, 두 후보 문서(9-user-profile.md·4-integration.md)를 직접 대조한 결과 이번에
바뀐 인덱스·제약 이름·FK delete 동작 중 어느 것도 그 문서들에 서술되어 있지 않아 갱신이 필요 없다.
plan 이 스스로 남긴 미결정 항목("결정 필요") 중 이 PR 이 일방적으로 결정을 내려 우회한 것은 없고,
target 이 가정하는 선행 조건도 없으며, target 변경이 없으므로 무효화되는 후속 항목도 없다. 유일한
잔여는 plan 이동 순서(아직 `in-progress`인 plan 을 다른 plan 이 `complete/` 로 미리 인용)인데, 이는
정합성 결함이 아니라 마무리 커밋에서 자연히 닫히는 절차상 사소한 선반영이다.

## 위험도

NONE
