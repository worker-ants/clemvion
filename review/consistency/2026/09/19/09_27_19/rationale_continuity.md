# Rationale 연속성 검토 — entity-schema-declaration-drift (impl-done, scope=spec/3-workflow-editor/)

## 대상 확인

이번 라운드(impl-done)에서 다루는 두 변경을 실제 워킹트리(HEAD)에서 직접 대조했다.

1. **spec 델타** — `spec/3-workflow-editor/4-ai-assistant.md` §13 i18n 키 표 정정 (커밋 `ff530fc8a`, docs-only).
2. **구현 diff** — 엔티티 여섯 파일의 인덱스·유니크·CHECK·FK 선언 정정 + 대조 e2e 가드 (커밋 `ffd58da4e`, 리팩터 `6e18aa4d8`).
   여섯 엔티티 중 `workflow-assistant-session.entity.ts` 가 scope(`spec/3-workflow-editor/4-ai-assistant.md`)
   소유이고 나머지 다섯은 `spec/1-data-model.md`·`spec/data-flow/12-workspace.md`·`spec/5-system/5-expression-language.md`
   등 scope 밖 spec 이 소유해 함께 대조했다.

동일 브랜치의 앞선 두 라운드(`review/consistency/2026/09/19/08_23_02` — spec 초안, `08_33_13` — impl-prep)가
이미 이 두 변경을 항목별로 Rationale 과 대조해 위험도 NONE 을 냈다. 이번 라운드는 (a) 그 결론이 실제 커밋된
코드와 여전히 일치하는지, (b) 그 사이의 ai-review 수정 라운드(`6e18aa4d8`)가 새 충돌을 들여오지 않았는지,
(c) 두 라운드가 등재를 약속한 tracker 항목이 실제로 등재됐는지를 확인했다.

## 항목별 재확인 (diff ↔ 실제 파일)

`git diff origin/main...HEAD -- codebase/backend/src/modules/{workspaces,workflow-assistant,nodes,edges,integrations,node-executions}/entities/*.ts` 를
직접 읽고 plan(`plan/in-progress/entity-schema-declaration-drift.md`) 표의 8행과 1:1 대조했다 — 여덟 항목
모두 plan 이 서술한 그대로 커밋돼 있다. 이 중 Rationale 연속성 관점에서 근거가 되는 세 항목만 재확인한다:

- **Workspace `@Index(['ownerId','type'])` → `uq_workspace_personal_owner (owner_id) UNIQUE WHERE type='personal'`**
  — `spec/data-flow/12-workspace.md` 의 「personal 워크스페이스 유일성」Rationale 이 이미 채택한 V109 모양 그대로다.
  기각된 대안(broad `@Unique(['ownerId','type'])`)의 재도입이 아니라, 그 기각을 서술하는 주석 옆에 남아 있던
  비-유니크 `@Index` 잔재를 걷어내는 방향이다.
- **NodeExecution `@Index` 에 `WHERE status IN ('waiting_for_input','running')` 추가** — `spec/1-data-model.md:919`
  가 이미 이 부분조건을 V095 인덱스로 명시하고 있고(실제로 grep 으로 재확인), 엔티티 자신의 JSDoc 도 이미 이
  사실을 서술하면서 데코레이터만 누락했던 자기모순을 닫는 정정이다.
- **AssistantSession 인덱스에 `userId` 추가** — `spec/1-data-model.md:943` `(workflow_id, user_id, status,
  last_interaction_at DESC)` 와 정확히 일치(재확인). 새 결정이 아니라 이미 문서화된 모양을 코드가 뒤늦게 따라간다.

## ai-review 수정 라운드(`6e18aa4d8`)의 영향

`git show 6e18aa4d8 --stat` 로 확인 — 변경은 `entity-schema-declarations.e2e-spec.ts` 내부 판정 골격을
헬퍼(`reportMatch`)로 통합하고 240자 삼항식을 푼 **순수 구조 리팩터**다. 커밋 메시지·plan 체크리스트가 판정
문구 불변과 뮤턴트 10개 동일 RED 를 명시한다. spec·Rationale 에 영향을 주는 동작 변화가 없다 — 이 라운드가
새로 검토할 결정은 없다.

## 두 라운드가 예고한 tracker 등재의 실제 확인

`08_33_13` impl-prep 라운드가 낸 **WARNING 1**("`spec/1-data-model.md` §2 Workspace `owner_id` 행이 `ON
DELETE CASCADE` 를 적지 않는데, 이 PR 이 엔티티에 CASCADE 를 명시하면 코드만 말하고 spec 은 침묵하는 비대칭이
생긴다")이 실제로 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재됐는지 직접 grep 으로
확인했다 — **4680~4683행에 등재돼 있다**("`spec/1-data-model.md` §2 Workspace `owner_id` 행이 삭제 동작을
적지 않는다", planner·낮음·2026-09-19). 이 파일 §2 를 직접 열어 대조한 결과도 일치한다: 104행
(`owner_id | UUID | FK → User`, 삭제 동작 미기재)과 539행(`owner_id | UUID | FK → User (ON DELETE CASCADE)…`,
동일 패턴에서 삭제 동작 기재)이 같은 문서 안에서 표기 관례가 갈려 있음을 실측으로 재확인했다. 이 갭은
developer 권한 밖(spec 쓰기는 planner)이라 이번 PR 이 고치지 않는 것이 맞고, 등재 자체도 확인됐으므로
**결정이 유실되지 않았다**.

`spec/1-data-model.md` Rationale 「쓸 인덱스가 없는 FK 서른하나의 처분」의 "user 를 가리키는 13개(NO ACTION
여섯)…사용자 삭제를 더하는 변경은 이 13개의 처분부터 다시 정해야 한다" 게이트도 재확인했다 — 이 PR 은 사용자
삭제 경로를 추가하지 않고 이미 V001 부터 존재하던 CASCADE 를 엔티티 선언에 반영할 뿐이므로 이 게이트를
발동시키지 않는다. `08_33_13` 라운드의 같은 결론(INFO 3)과 일치한다.

## i18n 표 정정(`ff530fc8a`)의 Rationale 연속성

`08_23_02` 라운드가 이미 사전(`assistant.ts`)·컴포넌트(`assistant-message.tsx`)와 라인 단위로 대조해 완결한
검토다. 이번 라운드에서 재확인한 것은 그 이후 코드에 추가 변경이 없다는 사실뿐이다 —
`git diff origin/main...HEAD -- spec/3-workflow-editor/4-ai-assistant.md` 는 그 라운드가 검토한 diff 와
동일하고, 프론트 소스(`assistant-message.tsx`)에 이후 커밋이 닿지 않았다(git log 상 `ff530fc8a` 이후
`codebase/frontend` 변경 없음). 결정 번복이 아니라 spec 표를 실제 사전에 맞추는 사실 정정이라는 판단은
유효하다.

## 발견사항

없음.

## 요약

이번 impl-done 라운드는 새로운 Rationale 충돌을 찾지 못했다. 두 변경(entity 선언 정정 + i18n 표 동기화) 모두
과거 spec Rationale 이 이미 확정한 결정(V109 partial unique·V095 partial index·AssistantSession 4컬럼
인덱스·글로서리 "엣지" 금지)을 코드/문서가 뒤늦게 따라가는 정정이며, 기각된 대안의 재도입·합의 원칙 위반·
무근거 번복·invariant 우회 중 어느 것도 발견되지 않았다. 앞선 두 라운드가 낸 유일한 열린 항목(Workspace
`owner_id` 행의 삭제 동작 미기재)은 developer 권한 밖 spec 갭으로 정확히 분류돼 tracker 에 실제로 등재된
것을 확인했다 — 결정이 유실되지 않았다. 이후 ai-review 라운드는 판정 문구를 바꾸지 않는 순수 리팩터라 이
결론에 영향을 주지 않는다.

## 위험도

NONE
