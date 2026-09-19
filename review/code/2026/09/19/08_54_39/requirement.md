# 요구사항(Requirement) 리뷰 — entity-schema-declaration-drift

## 검증 방법

저장소 파일은 전혀 뮤테이션하지 않았다(읽기 전용 `Read`/`Grep`/`grep`/`sed -n` 만 사용). 아래 결론은 다음을
직접 대조해 확인한 것이다:

- 6개 엔티티 파일의 `@Index`/`@Unique`/`@Check`/`@ManyToOne(onDelete)` 최종 상태
- 대응 Flyway 마이그레이션 원문(V001, V009, V019, V095, V109)
- 신규 e2e 가드 `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 전문
- `spec/1-data-model.md`(§2, §3, Rationale "쓸 인덱스가 없는 FK 서른하나의 처분")
- `spec/3-workflow-editor/4-ai-assistant.md` §13 i18n 표 ↔ `codebase/frontend/src/lib/i18n/dict/{ko,en}/assistant.ts` ↔ `assistant-message.tsx` ↔ `assistant-store.ts`
- TypeORM 설치 버전(`typeorm@0.3.31`)의 `Check` 데코레이터 타입 정의(2-인자 오버로드 실재 확인)

## 발견사항

### 코드(엔티티 8곳 정정)

- **[없음]** 8개 발견 항목(트래커 표 #1~#8) 전부 실측으로 재확인했다. 요약:
  - `workflow-assistant-session.entity.ts` — `idx_workflow_assistant_session_wf_user_active (workflow_id, user_id, status, last_interaction_at DESC)`(V019)와 컬럼 순서·이름 일치, `…_user_recent (workspace_id, user_id, updated_at DESC)`도 일치.
  - `node-execution.entity.ts` — `idx_node_execution_exec_status_active (execution_id, status) WHERE status IN ('waiting_for_input','running')`(V095)와 이름·컬럼·부분조건 일치.
  - `node.entity.ts` — `IDX_node_workflow_label` 제거 확인, 실제 `node.workflow_id` 인덱스는 `idx_node_workflow` 하나뿐(V002)임을 마이그레이션에서 확인.
  - `workspace.entity.ts` — `uq_workspace_personal_owner (owner_id) UNIQUE WHERE type='personal'`(V109)로 교체 확인.
  - `integration-expiry-dispatch.entity.ts` — 이름 없는 `@Unique(['integrationId','threshold','tokenExpiresAt'])`로 정정, V009 원문도 이름 없는 `UNIQUE (integration_id, threshold, token_expires_at)`. `orIgnore()`(`integration-expiry-scanner.service.ts:517`) 사용을 확인해 "이름을 참조하는 코드 없음" 주장도 검증됨.
  - `edge.entity.ts`/`node.entity.ts` `@Check` — 두 곳 모두 `@Check('이름', '식')` 2-인자 오버로드로 정정. 이 오버로드가 설치된 TypeORM 타입 선언에 실재함을 `Check.d.ts`에서 확인. V001 원문의 `chk_no_self_loop`/`chk_node_placement` 식과 일치.
  - `workspace.entity.ts` `owner` FK — `{ onDelete: 'CASCADE' }` 추가, V001 `owner_id … REFERENCES "user"(id) ON DELETE CASCADE`와 일치.
  - 8곳 모두 실제 DB 상태로 수렴했고, `synchronize: false`(동작 불변) 전제도 `app.module.ts` 확인과 일치.

- **[없음]** 신규 e2e 가드(`entity-schema-declarations.e2e-spec.ts`)는 요구된 기능(엔티티 메타데이터 ↔ `pg_catalog` 정규화 비교)을 완전히 구현했다. 엣지 케이스 처리 확인:
  - `sameColumns`가 `pg` 드라이버의 `name[]` 미배열화 함정(플랜 문서가 실제로 겪은 1차 결함)을 명시적으로 감지해 크게 실패하도록(`throw`) 방어 — silent 오탐 방지.
  - `checked` 카운터로 vacuous 테스트(0건 검사하고 통과)를 막음(`expect(checked).toBeGreaterThan(0)`).
  - CHECK/부분 인덱스 비교를 문자열이 아니라 임시 테이블에 실제로 만들어 Postgres 정규화 결과로 비교 — 표기 차이(`!=`/`<>`, `IN`/`= ANY`)에 강건. 대조군 테스트(182~220행)로 "다르게 써도 같다고 판정" + "만들 수 없는 식은 실패로 판정" 둘 다 확인.
  - 트랜잭션 롤백(`inRolledBackTx`)으로 실제 DB에 흔적을 남기지 않음.
  - plan 문서(`entity-schema-declaration-drift.md`)에 기록된 뮤테이션 테스트 10건(이름 불일치·컬럼순서·CHECK정규형·FK동작 등 각 분기)이 e2e 코드의 실제 분기(`problems.push` 각 지점)와 1:1 대응함을 코드 레벨에서 확인 — "가드가 실제로 판별력이 있다"는 주장이 근거 있음.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md:4649`의 원 트래커 항목("WorkflowAssistantSession 인덱스에 userId 누락")은 여전히 `- [ ]`(미체크) 상태다. 반면 이번 PR의 plan(`plan/in-progress/entity-schema-declaration-drift.md`)은 "트래커의 이 항목을 닫는다"고 서술한다. 실제로는 `entity-schema-declaration-drift.md`의 체크리스트 마지막 두 항목("트래커 반영(항목 닫기)" · "이 plan complete/ 이동")이 아직 미체크 상태라 — 지금 diff 는 그 마감 이전의 중간 상태이고, 서술과 체크리스트가 서로 모순 없이 "아직 안 끝남"을 일치되게 말하고 있다. 기능적 결함은 아니며, 이 리뷰가 통과된 뒤(`/ai-review`→`--impl-done`) 후속 커밋에서 마무리될 것으로 보인다. 다만 여러 문서(`spec-draft-nullable-notation-followups.md:4668`, 08_33_13 rationale_continuity 등)가 이미 `plan/complete/entity-schema-declaration-drift.md`라는 아직 존재하지 않는 경로를 인용하고 있다 — 이동 전까지는 dangling reference 다. 이동이 이번 작업의 마지막 체크리스트 항목으로 명시돼 있어 자기 해소적이지만, 이 세션에서 최종적으로 plan 이동 없이 종료된다면 잔여 dangling 참조로 남는다.

### spec fidelity

- **[없음]** `spec/1-data-model.md` §3 인덱스 표(AssistantSession, NodeExecution 행)가 엔티티 정정 후 값과 line-level 로 정확히 일치함을 확인(918~944행).
- **[없음]** `spec/data-flow/12-workspace.md`의 "personal 유일성" 서술, `spec/5-system/5-expression-language.md` §8.3.2의 "노드 라벨 유니크는 앱 레이어" 서술 모두 정정된 엔티티 상태와 일치.
- **[없음]** `spec/1-data-model.md` §2 Workspace 표(104행, `owner_id | FK → User` — 삭제 동작 미기재)는 이번 엔티티 변경(`onDelete: 'CASCADE'` 명시)과 완전히 대칭은 아니지만("코드는 명시, spec은 침묵"), 이는 08_33_13 consistency-check WARNING 1로 이미 식별됐고 `spec-draft-nullable-notation-followups.md:4667`에 planner 항목으로 정확히 등재돼 있다. **[SPEC-DRIFT] 아님** — 코드가 spec보다 상세해진 것이지 spec을 위반한 게 아니고(spec은 삭제 동작에 침묵할 뿐 다른 값을 주장하지 않음), 이미 올바른 채널(planner 트래커)로 인계됐으므로 이 리뷰에서 추가 조치 불필요.
- **[없음]** i18n 스펙 초안(`plan/complete/spec-draft-assistant-i18n-table-sync.md`)이 반영한 `spec/3-workflow-editor/4-ai-assistant.md` §13 표의 13개 행(edgeAdded/edgeRemoved 금지어, 보간 문법 6행, executionNotInScope 오탈자, planQuestionsHint/errorNoLlmConfig/errorRateLimit 해요체, autoResumedHint 🔄 제거, autoResumedHintShort 신규 행)을 실제 `dict/ko/assistant.ts` 값과 한 줄씩 대조해 전부 정확히 일치함을 확인했다(741~773행 vs grep 결과). §3.2 divider 서술("회전 아이콘 + autoResumedHint/autoResumedHintShort")도 `assistant-message.tsx`(RotateCw 아이콘, `message.autoResume.max !== undefined` 분기)와 정확히 일치. §5.3.2의 "rehydrate 시 max 없어 순번만" 서술도 `assistant-store.ts`의 `hydrateMessage`(max 필드 미설정)와 일치.
- **[INFO]** `spec/1-data-model.md` Rationale의 "user 참조 FK 13개 — 사용자 삭제 앱 경로가 없다"는 전제와, 이번 `workspace.owner_id` CASCADE 선언이 서로 모순되지 않음을 확인(사용자 삭제 경로 부재는 유지되므로 CASCADE 여부가 실질 동작에 영향 없음) — 08_33_13 rationale_continuity INFO 3의 판단이 타당함.

### TODO/FIXME 등

- 없음. 6개 엔티티 파일 + 신규 e2e 파일 전체에 TODO/FIXME/HACK/XXX 없음(grep 확인).

## 요약

엔티티 8곳의 인덱스·제약·FK 선언 정정은 실제 Flyway 마이그레이션(V001·V009·V019·V095·V109) 원문과 line-level 로 전수 일치함을 독립적으로 재확인했고, `@Check`의 2-인자 오버로드가 설치된 TypeORM 버전에 실재함도 확인했다. 신규 e2e 가드는 vacuous-test·배열-미변환·표기차이 오탐 등 흔한 함정을 모두 구조적으로 방어하고 있으며, plan 문서에 기록된 뮤테이션 테스트 10건이 실제 코드 분기와 대응돼 판별력 주장이 신뢰할 만하다. 동봉된 i18n spec 초안(§13 표 13행 + divider 서술)도 실제 프론트 코드(dict·컴포넌트·store)와 전부 일치함을 확인했다. `synchronize: false`라 이번 변경은 런타임 동작을 바꾸지 않으며, 유일한 잔여 사항은 트래커 항목 미체크·plan 미이동(둘 다 이번 plan의 체크리스트에 남은 작업으로 이미 명시돼 있어 자기 인지된 상태)과 그로 인한 일부 문서의 `plan/complete/...` 경로 선참조뿐이다. 이는 기능적 결함이 아니라 워크플로 마무리 단계의 문서 정합 이슈에 그친다.

## 위험도

NONE
