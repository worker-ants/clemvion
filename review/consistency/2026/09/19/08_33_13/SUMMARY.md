# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. `plan/in-progress/entity-schema-declaration-drift.md`(엔티티 인덱스·제약
데코레이터 8곳 정정, `spec_impact: none`)에 대한 5개 checker 전원이 결과를 반환했고(전문 확보), 재시도 필요
항목은 없음.

## 전체 위험도
**LOW** — CRITICAL 0건, WARNING 2건(둘 다 "기존 문서 공백이 이번 변경으로 더 눈에 띔" 성격이지 신규 모순 아님), 나머지는 INFO.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 이번 라운드에 CRITICAL 이 없어 인계 대상 자체가 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | Workspace→User FK 의 `ON DELETE CASCADE` 가 `spec/1-data-model.md` §2 Workspace 표에 여전히 미기재. 이 PR 이 코드 데코레이터에 CASCADE 를 명시적으로 적어 넣으면 "코드는 명시적, spec 은 침묵"이라는 비대칭이 새로 생김 | plan 발견 #8 (`workspace.entity.ts` `@ManyToOne(() => User)` 에 `{ onDelete: 'CASCADE' }` 추가) | `spec/1-data-model.md:104` (`owner_id \| UUID \| FK → User` — 삭제 동작 미기재). 다른 User-FK 행들(`:539`,`:695`,`:714`,`:772`,`:888`)은 삭제 동작을 괄호로 명시하는 관례. 같은 파일의 "쓸 인덱스가 없는 FK 서른하나의 처분" 절(`:1019-1082`)이 "사용자 삭제 미지원 — 13개 FK 재검토 필요"를 이미 서술 중이라 이 공백이 더 눈에 띄게 됨 | developer 는 `spec/` 쓰기 권한이 없으므로 이번 PR 에서 직접 고치지 말고, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 "`spec/1-data-model.md:104` Workspace owner_id 행에 `(ON DELETE CASCADE)` 주석 추가" 항목으로 등재해 planner 턴을 기다릴 것. 이번 PR 자체는 블로킹 아님(동작 변화 없음, 기존 침묵의 연장) |
| 2 | plan_coherence | `--impl-prep` 스코프(`spec/3-workflow-editor/`)가 이 plan 이 건드리는 6개 파일 중 2개의 소유 spec 을 덮지 못함 | plan 발견 #4(`workspaces/entities/workspace.entity.ts`), #5(`integrations/entities/integration-expiry-dispatch.entity.ts`) | `spec/2-navigation/9-user-profile.md`(`code: codebase/backend/src/modules/workspaces/**`, `pending_plans: spec-sync-user-profile-gaps.md`), `spec/2-navigation/4-integration.md`(`code: codebase/backend/src/modules/integrations/**`) — 이 두 문서에 대한 정합성은 이번 라운드에서 검사되지 않음(별도 grep 으로 실충돌 0건 확인했으나 이는 이번 검토 프로세스가 보장한 것이 아님) | plan 체크리스트의 `--impl-prep`/`--impl-done` 스코프를 `spec/2-navigation/`(최소 두 파일) 포함하도록 넓히거나 별도 라운드로 한 번 더 대조할 것. `--impl-done` 은 diff-scope 라 최종적으로 잡힐 가능성은 있으나, 결정 충돌이 있었다면 late-stage 에 드러나 왕복 라운드가 늘었을 것 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | `5-version-history.md` 내부 워크플로 id path param 표기 불일치(`:id` vs `:wfId`), 인접 `3-execution.md` §9 는 `:id` 로 일관 | `spec/3-workflow-editor/5-version-history.md` §6/§7.1-7.2/§7.3 | 규약으로 강제되진 않음(`spec/conventions/**` 에 path param 명명 규칙 없음). 실제 컨트롤러 `@Param()` 확인 후 표기 통일 검토, 필요시 project-planner 가 별도 규약 신설 판단. 이번 PR 스코프 밖 |
| 2 | convention_compliance | `5-version-history.md` 만 `## Rationale` 섹션이 없고 설계 근거(`m-3` 등)가 본문에 산재 | `spec/3-workflow-editor/5-version-history.md` 전체 (다른 6개 파일은 모두 보유) | 필수 아님(SKILL.md 권장 사항). 다음 편집 시 Rationale 섹션 신설해 근거 이관 |
| 3 | convention_compliance | AI Assistant 편집 도구 인자 케이싱 혼재(`add_edge` snake_case vs 나머지 camelCase) — spec 이 이미 "혼재"로 투명하게 명시, 대응 규약 자체가 없음 | `spec/3-workflow-editor/4-ai-assistant.md` §4.3 | 규약 위반 아님, 조치 불요. LLM tool schema 케이싱 규약이 필요하면 project-planner 가 별도 검토 |
| 4 | cross_spec / naming_collision | 직전 라운드(`08_07_50`) BLOCK:YES 였던 §13 i18n 금지어("엣지") 는 커밋 `ff530fc8a` 로 이미 해소 확인됨(사전 값과 대조 완료) | `spec/3-workflow-editor/4-ai-assistant.md` §13 | 재-flag 아님, 조치 불요 |
| 5 | naming_collision | `node.entity.ts` 를 동시에 건드리는 다른 in-progress plan(`marketplace-and-plugin-sdk.md` — `NodeCategory` enum `custom` 추가) 존재하나 축이 다름(인덱스/CHECK vs enum 값) | `plan/in-progress/marketplace-and-plugin-sdk.md:90` | 식별자 충돌 없음, 병합 시 라인 인접 정도. 조치 불요 |
| 6 | 전 checker 공통 | 신규/교체 인덱스·제약 이름 6개(`idx_workflow_assistant_session_wf_user_active` 등)와 제거 대상 2개는 모두 기존 Flyway 마이그레이션·spec 문서의 실재 이름과 완전히 일치 — 새 이름 발명 없음, dangling reference 없음 | plan 발견 #1~#7 | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | Workspace→User FK CASCADE 가 spec §2 표에 미기재(기존 침묵의 연장, 신규 모순 아님). 나머지 발견 #1~#7 은 기존 spec 서술과 정확히 일치 |
| rationale_continuity | NONE | 8개 정정 전부 기존 `## Rationale`(`12-workspace.md` personal 유일성, `5-expression-language.md §8.3.2` 등)이 이미 확정한 결정을 코드가 뒤늦게 따라가는 것. 기각된 대안 재도입 없음 |
| convention_compliance | LOW | INFO 3건(path param 표기 불일치·Rationale 섹션 부재·도구 인자 케이싱 혼재) — 전부 강제 규약 위반 아니며 이번 PR 스코프 밖. frontmatter/`code:`·에러코드·포트 예약어·DTO 명명·i18n 문체는 전부 준수 |
| plan_coherence | LOW | `--impl-prep` 스코프가 변경 파일 6개 중 2개(workspace/integration)의 소유 spec(`spec/2-navigation/`)을 덮지 못함. 별도 grep 으로 실충돌은 미확인 |
| naming_collision | NONE | 신규/교체 이름 전부 기존 DB 카탈로그·spec 문서와 일치, e2e 파일명도 기존과 겹치지 않음. §13 은 이미 해소 확인 |

## 권장 조치사항
1. `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 "`spec/1-data-model.md:104` Workspace owner_id 행에 `(ON DELETE CASCADE)` 주석 추가" 항목 등재 (planner 턴 대기, 이번 PR 비블로킹)
2. plan 체크리스트의 `--impl-prep`/`--impl-done` 스코프에 `spec/2-navigation/9-user-profile.md`·`4-integration.md` 를 포함하거나 별도 라운드로 workspace/integration 소유 spec 대조를 완결
3. (선택, 비긴급) 다음에 `5-version-history.md` 편집 시 path param 표기(`:id`/`:wfId`) 통일 및 `## Rationale` 섹션 신설 검토
