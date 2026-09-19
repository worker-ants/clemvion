# 요구사항(Requirement) 리뷰 — entity-schema-declaration-drift (2라운드)

## 검증 방법

저장소를 뮤테이션하지 않고(읽기 전용 `Read`/`Bash grep`/`git show`만 사용) 아래를 직접 대조했다:

- 6개 엔티티 파일(`edge`·`integration-expiry-dispatch`·`node-execution`·`node`·`workflow-assistant-session`·`workspace`)의 `@Index`/`@Unique`/`@Check`/`@ManyToOne(onDelete)` 최종 상태를 `Read`로 전문 확인
- 대응 Flyway 마이그레이션 원문(V001·V002·V009·V019·V095·V109) 전체 대조
- 신규 e2e 가드 `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 전문 확인 (프롬프트에서 diff 생략된 파일 — 실제 소스를 직접 읽었다)
- `git show 6e18aa4d8`(1라운드 W1·W2 리팩터 커밋)의 전체 diff를 라인 단위로 대조해 라벨 문자열·판정 분기가 리팩터 전후 동일함을 확인
- 설치된 `typeorm@0.3.31`의 `Check`/`Index` 데코레이터 타입 선언과 `EntityMetadata`의 `IndexMetadata`/`UniqueMetadata`/`CheckMetadata`/`ForeignKeyMetadata` 필드 실재 확인
- `npx tsc --noEmit -p tsconfig.json` 전체 실행 — 변경된 6개 엔티티 파일·e2e 파일에서 타입 오류 0건(출력 306줄은 전부 무관한 기존 `*.spec.ts` 파일의 선행 오류)
- `spec/1-data-model.md` §2·§3, `spec/data-flow/12-workspace.md`, `spec/5-system/5-expression-language.md` §8.3.2 본문 대조
- `spec/3-workflow-editor/4-ai-assistant.md`(커밋 `ff530fc8a`)의 §13 표·§3.2·§5.3·§5.3.2 정정분을 `dict/ko/assistant.ts`·`assistant-message.tsx`·`assistant-store.ts` 실제 코드와 한 줄씩 대조

## 발견사항

### 코드 — 엔티티 8곳 정정 (기능 완전성 / 비즈니스 로직 / spec fidelity)

- **[없음]** 8개 정정 항목이 대응 마이그레이션과 line-level로 전부 일치함을 재확인:
  - `workflow-assistant-session.entity.ts:23-33` — `idx_workflow_assistant_session_wf_user_active(workflow_id, user_id, status, last_interaction_at DESC)` / `…_user_recent(workspace_id, user_id, updated_at DESC)` = V019 원문과 정확히 일치, `spec/1-data-model.md:943-944`와도 일치.
  - `node-execution.entity.ts:38-40` — `idx_node_execution_exec_status_active(execution_id, status) WHERE status IN ('waiting_for_input','running')` = V095 원문과 정확히 일치(`spec/1-data-model.md:919`).
  - `node.entity.ts:23-33` — `IDX_node_workflow_label` 제거, 실제 `node.workflow_id` 인덱스는 `idx_node_workflow`(V002) 하나뿐임을 마이그레이션에서 확인. 저장소 전체 grep 결과 옛 이름을 참조하는 코드 없음(주석 언급만 잔존).
  - `workspace.entity.ts:21-24` — `uq_workspace_personal_owner(owner_id) UNIQUE WHERE type='personal'` = V109 원문과 정확히 일치, `spec/data-flow/12-workspace.md:199,455`와도 일치.
  - `integration-expiry-dispatch.entity.ts:14-17` — 이름 없는 `@Unique`로 정정, V009 원문도 이름 없는 `UNIQUE(integration_id, threshold, token_expires_at)`. `claimThreshold`가 `.orIgnore()`(대상 없는 `ON CONFLICT DO NOTHING`)만 쓰고 이름을 참조하지 않음을 확인.
  - `edge.entity.ts:21`/`node.entity.ts:24-27` `@Check` — `@Check('이름', '식')` 2-인자 오버로드로 정정(타입 정의에 실재), V001의 `chk_no_self_loop`/`chk_node_placement` 식과 일치.
  - `workspace.entity.ts:38` `owner` FK — `{ onDelete: 'CASCADE' }` 추가, V001 `owner_id … REFERENCES "user"(id) ON DELETE CASCADE`와 일치. `synchronize: false`라 런타임 동작 변화 없음.

- **[없음]** 신규 e2e 가드는 의도한 기능(엔티티 메타데이터 ↔ `pg_catalog` 정규화 비교, 선언→DB 단방향 검증)을 완전히 구현. 엣지 케이스 방어 확인:
  - `sameColumns`가 `pg` 드라이버의 `name[]` 미배열화 함정을 `throw`로 크게 실패시켜 silent 오탐 방지.
  - `expect(checked).toBeGreaterThan(0)`으로 vacuous 테스트(0건 순회 후 통과) 차단 — 4개 `it` 모두 적용.
  - CHECK/부분 인덱스는 문자열 비교가 아니라 임시 테이블에 실제로 만들어 Postgres 정규화 결과로 비교(표기 차이에 강건), 대조군 테스트(`entity-schema-declarations.e2e-spec.ts:259-297`)로 "다르게 써도 같다" + "만들 수 없는 식은 실패" 양방향 판별력을 자체 검증.
  - 모든 스키마 조작은 `inRolledBackTx`로 감싸 실제 DB에 흔적을 남기지 않음.

- **[없음]** 1라운드 W1·W2 리팩터 커밋(`6e18aa4d8`)을 diff 단위로 전수 대조 — `describeIndexDecl`/`describeDbIndex`/`describeForeignKeyDecl`/`reportMatch` 헬퍼로의 추출은 기계적이며, 추출 전후 생성되는 라벨 문자열·문제 메시지가 byte-identical하다(예: `@Index` 분기의 "같은 인덱스가 없다" / "이름이 다르다" 문구, FK 분기의 "동작이 다르다" 문구 모두 그대로). 새 결함 없음.

### TODO/FIXME 등

- 없음 — 6개 엔티티 파일 + 신규 e2e 파일 전체에 TODO/FIXME/HACK/XXX 없음(grep 확인).

### spec fidelity

- **[없음]** `spec/1-data-model.md` §3 인덱스 표(AssistantSession·NodeExecution 행, 918~944행), §2 Node/Edge 표(176행 `container_id`/`tool_owner_id` CHECK, 231행 자기 연결 불가)가 정정된 엔티티 상태와 line-level로 정확히 일치.
- **[없음]** `spec/data-flow/12-workspace.md`의 "personal 유일성" 서술, `spec/5-system/5-expression-language.md` §8.3.2의 "노드 라벨 유니크는 앱 레이어" 서술 모두 정정된 엔티티 상태와 일치.
- **[없음]** i18n spec 정정(커밋 `ff530fc8a`, `spec/3-workflow-editor/4-ai-assistant.md` §13 표 13행 + `autoResumedHintShort` 신규 행 + §3.2/§5.3/§5.3.2 divider 서술)을 `dict/ko/assistant.ts`(`planQuestionsHint`·`autoResumedHint`·`autoResumedHintShort`·`errorNoLlmConfig`·`errorRateLimit`·`edgeAdded`·`edgeRemoved`·`exploreLookup`·`executionNotInScope` 등)와 한 줄씩 grep 대조해 전부 정확히 일치함을 확인. `assistant-message.tsx`의 `RotateCw` 아이콘 + `max` 유무 분기(`autoResumedHint`/`autoResumedHintShort`)도 정정된 §3.2 서술과 일치.
- **[INFO]** `spec/1-data-model.md` §2 Workspace 표(`owner_id | FK → User`)는 삭제 동작을 여전히 적지 않아 엔티티의 신규 `onDelete: 'CASCADE'` 명시와 비대칭이다. 다만 이는 spec 위반이 아니라 spec의 침묵(코드가 spec보다 상세해진 것)이고, 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 planner 항목으로 등재돼 올바른 채널로 인계됨 — 추가 조치 불필요.
- **[INFO]** e2e 가드 JSDoc(`entity-schema-declarations.e2e-spec.ts:15` "근거·실측: `plan/complete/entity-schema-declaration-drift.md`")이 아직 존재하지 않는 경로(`plan/in-progress/entity-schema-declaration-drift.md`, status: in-progress)를 선인용한다. 1라운드 W3로 이미 식별됐고, 해당 plan 자체의 체크리스트 마지막 항목("이 plan complete/ 이동")이 스스로 이 상태를 인지하고 있다 — 마무리 커밋에서 자기 해소적으로 닫힐 예정이며 기능적 결함은 아니다. 이번 세션이 plan 이동 없이 종료되면 dangling reference로 남으므로, 마무리 커밋 체크리스트 항목을 빠뜨리지 않도록 유의할 것.

## 요약

엔티티 8곳의 인덱스·제약·FK 선언 정정은 대응 Flyway 마이그레이션(V001·V002·V009·V019·V095·V109) 원문 및 관련 spec 본문(`1-data-model.md`·`data-flow/12-workspace.md`·`5-expression-language.md`)과 line-level로 전수 일치하며, `synchronize: false`라 런타임 동작 변화가 없다는 전제도 확인됐다. 신규 e2e 가드는 vacuous-test·배열 미변환·표기 차이 오탐 등 흔한 함정을 구조적으로 방어하고, 판정 문구를 그대로 유지한 헬퍼 추출 리팩터(`6e18aa4d8`)도 diff 대조로 동작 불변을 확인했다. 동봉된 i18n spec 정정(§13 표)도 실제 프론트 dict·컴포넌트·store와 완전히 일치한다. TODO/FIXME 없음, 모든 판정 경로가 값을 반환하며 반환값 누락 경로 없음. 유일한 잔여 사항은 이미 트래커에 등재되었거나 plan 자체 체크리스트에 명시된 마무리 단계(spec 침묵 보완 항목, `plan/complete/...` 경로의 마무리-커밋 선인용)뿐으로, 둘 다 기능적 결함이 아니다.

## 위험도

NONE
