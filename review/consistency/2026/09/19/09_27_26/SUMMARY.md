# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 전문 확보(재시도 필요 없음). CRITICAL 발견 없음.

## 전체 위험도
**LOW** — 이번 diff(엔티티 6개 인덱스/제약/FK 선언 정정 + 신규 e2e 가드)는 신규 결함을 만들지 않았으나, 대조 과정에서 `spec/2-navigation/4-integration.md`의 기존 데이터모델 drift 1건(WARNING, pre-existing)이 드러났고 별도 CASCADE 미기재 WARNING(이미 트래커 등재)이 재확인됐다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — CRITICAL 발견이 없어 이 표는 해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `integration_expiry_dispatch` 유니크 키 서술이 존재하지 않는 컬럼(`threshold_key`)·2컬럼 조합을 씀. 실제(엔티티 `@Unique`, V009)는 3컬럼(`integration_id, threshold, token_expires_at`) | `spec/2-navigation/4-integration.md` §11.2 (1006행) | `spec/data-flow/5-integration.md`(341행) · `spec/data-flow/8-notifications.md`(90행) · `codebase/backend/.../integration-expiry-dispatch.entity.ts` `@Unique(['integrationId','threshold','tokenExpiresAt'])` | `(integration_id, threshold, token_expires_at)` 로 정정 — planner 턴 필요(pre-existing drift, 이 PR 이 만든 것 아니고 이 PR 을 막을 사유 아님). 재인증 시 새 키 재발사 동작이 2컬럼 서술로는 재현 안 됨을 함께 기록 |
| 2 | cross_spec / rationale_continuity (병합, 강한 등급 채택) | `Workspace.owner_id` FK 의 `ON DELETE CASCADE` 를 §2 표가 미기재 — 이번 diff 가 코드에 명시화한 사실을 spec 이 침묵 | `spec/1-data-model.md` §2 Workspace 표 (104행) | `codebase/backend/.../workspace.entity.ts` `@ManyToOne(() => User, { onDelete: 'CASCADE' })`(신규 명시, 동작 자체는 V001 부터 불변) | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:4680-4683` 에 planner 항목으로 등재됨(문구까지 명시: `FK → User (ON DELETE CASCADE)`). **추가 조치 불요** — 본 라운드는 항목이 살아있고 이 PR 이 원인임을 재확인한 것 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | naming_collision | 번들된 target(`spec/2-navigation/*`)이 실제 diff(엔티티 인덱스/제약 정정 6개 + e2e 가드 + `spec/3-workflow-editor` i18n 표)와 무관 — scope 파라미터가 실제 변경 영역과 어긋남 | N/A (검토 설정 자체) | 조치 불요. 5개 checker 모두 실제 diff 를 절대경로로 직접 대조해 보완 수행함(결과에 반영됨) |
| 2 | cross_spec / plan_coherence | `9-user-profile.md` · `4-integration.md` 는 이번 diff 가 정정한 인덱스·제약 이름·CASCADE 동작을 전혀 언급하지 않음(침묵, 모순 아님) | `spec/2-navigation/9-user-profile.md`, `spec/2-navigation/4-integration.md` | 조치 불요 — DB 레벨 이름 서술 의무는 `1-data-model.md` SoT 소관. `plan/in-progress/entity-schema-declaration-drift.md` 의 `--impl-done spec/2-navigation/` 체크리스트 항목은 이 결과로 체크 가능 |
| 3 | convention_compliance | `2-trigger-list.md` Rationale 소절 번호가 문서 등장 순서와 어긋남(R-6→R-8→R-7→R-12, R-9~R-11 부재) | `spec/2-navigation/2-trigger-list.md` (L382~L407) | 명시적 규약 위반 아님(저장소의 "식별자 시간순 부여·재배치 금지" 관행과 부합 가능성). 이번 PR 스코프와 무관, 즉시 조치 불필요. 다음 편집자 오인 방지용으로 사유 한 줄만 남기면 충분 |
| 4 | plan_coherence | `plan/in-progress/spec-draft-nullable-notation-followups.md`(4649·4660·4680행)가 아직 `in-progress`인 `entity-schema-declaration-drift.md`를 `plan/complete/`로 미리 인용 | 두 plan 파일 간 상호 참조 | 조치 불요 — 마무리 커밋에서 `--impl-done` 통과 후 plan 이동 시 자연히 해소(현재 체크리스트 순서가 이미 그렇게 되어 있음) |
| 5 | naming_collision / rationale_continuity | 엔티티 인덱스/제약 이름(`chk_no_self_loop`·`chk_node_placement`·`uq_workspace_personal_owner`·`idx_node_execution_exec_status_active`·`idx_workflow_assistant_session_wf_user_active`·`idx_workflow_assistant_session_user_recent`) 및 `IDX_node_workflow_label` 삭제는 전부 기존 Flyway 마이그레이션(V001/V009/V019/V095/V109)과 1:1 일치, 신규 식별자 충돌 없음 | `codebase/backend/src/modules/**/entities/*.entity.ts` | 조치 불요 — 정합 확인 완료 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `4-integration.md` §11.2 유니크 키 서술 오류(신규 WARNING, pre-existing drift) + CASCADE 미기재(이미 트래커 등재) |
| rationale_continuity | NONE | 8개 정정 전부 기존 Rationale(§인덱스 전략·personal 워크스페이스 유일성·라벨 유니크 정책)을 코드가 뒤늦게 따라잡는 방향, 번복·재도입 없음 |
| convention_compliance | LOW | conventions(에러코드·Secret Store·Chat Channel·감사액션·Redis키·Swagger DTO) 전수 대조 CRITICAL/WARNING 없음, Rationale 번호 INFO 1건 |
| plan_coherence | NONE | 소유 spec 미검토 우려(착수 전 impl-prep 지적)를 이 라운드가 직접 재확인해 해소, plan 이동 순서 INFO 1건 |
| naming_collision | NONE | 모든 신규 이름이 기존 DB 객체명과 1:1 일치, 신규 e2e/plan/i18n 키도 충돌 없음 |

## 권장 조치사항
1. (BLOCK 해소 우선 — 해당 없음, 이미 BLOCK:NO)
2. `spec/2-navigation/4-integration.md` §11.2 유니크 키 서술을 `(integration_id, threshold, token_expires_at)` 로 정정 — planner 턴에서 처리(이 PR 을 막을 사유 아님, pre-existing drift)
3. `spec/1-data-model.md` §2 Workspace `owner_id` CASCADE 미기재 — 이미 `spec-draft-nullable-notation-followups.md` 트래커에 등재되어 있으므로 추가 조치 불요, 후속 planner 턴에서 함께 처리
4. `plan/in-progress/entity-schema-declaration-drift.md` 를 이번 `--impl-done` 통과 확인 후 체크리스트 완료 처리 + `plan/complete/` 이동
