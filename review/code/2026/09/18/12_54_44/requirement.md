# 요구사항(Requirement) 충족 리뷰 — trigger (workflow_id) 인덱스 (V111)

## 검토 방법

`plan/in-progress/spec-draft-trigger-workflow-index.md` 가 정의한 요구사항(스코프: V111 마이그레이션 +
`releaseExternalForParent` select 좁히기 + 관련 spec/README 갱신)을 실제 코드·spec 원문과 line-level 로 대조했다.
프롬프트 번들에서 잘린 파일(README.md, service.ts/spec.ts, e2e-spec.ts, plan 파일)은 전부 `Read`/`Grep` 으로
worktree 원본을 직접 열어 확인했다. 저장소 뮤테이션 없음 (`git status --short` 로 편집 전후 无 변경 확인,
읽기 전용 조사만 수행).

## 발견사항

- **[WARNING]** `plan/complete/spec-draft-trigger-workflow-index.md` 를 가리키는 선참조(forward reference)가
  이번 구현 커밋에서 **2곳 더 늘었다** — 실제 파일은 아직 `plan/in-progress/` 에 있다
  - 위치:
    - `spec/1-data-model.md:987` (`> ... 실측 절차는 \`plan/complete/spec-draft-trigger-workflow-index.md\`, 구현은 V111.`) — 기존에 `review/consistency/2026/09/18/12_26_41/convention_compliance.md` 가 이미 WARNING 으로 지목
    - `codebase/backend/migrations/V111__trigger_workflow_id_index.sql:5` (`-- 실측·같은 클래스 전수: plan/complete/spec-draft-trigger-workflow-index.md`) — **신규, 이전 consistency 라운드는 아직 이 파일이 존재하지 않아 못 봄**
    - `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts:196` (`* 근거·실측: \`plan/complete/spec-draft-trigger-workflow-index.md\`,`) — **신규, 같은 이유로 못 봄**
  - 상세: `ls plan/complete/spec-draft-trigger-workflow-index.md` → 파일 없음 (`git status` 상 `plan/in-progress/spec-draft-trigger-workflow-index.md` 가 아직 in-progress). 세 참조 모두 이 시점 기준 **거짓**이다. `spec-link-integrity.test.ts` 는 마크다운 링크(`[..](path)`)만 잡고 backtick 텍스트는 잡지 않으므로(12_26_41 convention_compliance 리포트가 이미 확인한 사실) 세 곳 모두 자동 가드 사각지대다. plan 자신은 이 리스크를 인지하고 "draft 이동을 이 PR 의 마지막 커밋에서 한다 — 다른 PR 로 떼지 않는다"(`plan/in-progress/spec-draft-trigger-workflow-index.md:109`)로 완화책을 문서화했지만, 그 완화책이 언급하는 것은 spec 문서 1곳뿐이고 이번 구현 단계에서 같은 문구가 SQL 주석·e2e 테스트 주석에도 그대로 복제됐다는 사실은 plan 어디에도 재확인되어 있지 않다. `/ai-review` → `--impl-done` → "트래커 반영 · draft `complete/` 이동" 순서가 실제로 같은 PR 안에서 끝까지 완결되면 착지 시점에 참이 되어 실해는 없지만, 만약 이 세 곳 중 하나라도 남긴 채 PR 이 분리되거나 이동 커밋이 누락되면 CI 로 걸러지지 않는 dangling 참조가 세 곳(1곳이 아니라)으로 남는다.
  - 제안: 코드 수정이 아니라 **완결 순서 준수 확인** — 이 PR 의 마지막 커밋에서 `plan/in-progress/spec-draft-trigger-workflow-index.md` 를 `plan/complete/` 로 이동할 때, 위 세 참조가 전부 유효해졌는지(`grep -rn "plan/complete/spec-draft-trigger-workflow-index" spec/ codebase/`) 재확인 요망. `--impl-done` 게이트가 이 파일들을 스코프에 포함하므로 그때 다시 잡힐 가능성이 높으나, 자동 가드가 backtick 참조를 못 잡는다는 것이 이미 확인된 사실이므로 수동 확인이 안전망이다.

## 검증 통과 항목 (근거 기록)

- **`select: { id: true, type: true, config: true }` 좁히기 — 소비처와 정확히 일치**: `TriggerResourceReleaserService.releaseExternalForParent`(`codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:72-78`) 가 좁힌 세 컬럼은 `releaseExternalMany` 내부에서 실제로 전부 쓰인다 — `type`(schedule 필터, :151), `id`(schedule 조회 키·listener unregister·로그, :152/:163), `config`(`ChatChannelBinderService.teardownChatChannel` 이 `trigger.config.chatChannel` 을 직접 읽음, `chat-channel-binder.service.ts:365-371`). `releaseExternalForParent` 의 두 호출부(`workflows.service.ts:268`, `workspaces.service.ts:513`)는 반환값을 쓰지 않아 다른 필드 요구가 없음을 확인. 누락 없음.
- **단위 테스트 mock 의 한계를 스스로 명시하고 정확한 대조 단언으로 보완**: `trigger-resource-releaser.service.spec.ts:94-99` 의 mock `find` 는 select 인자와 무관하게 전체 객체를 반환하므로(주석이 스스로 인정), 유일하게 결함을 잡는 것은 `toHaveBeenCalledWith({ select: {...}, where: ... })` 정확 대조 하나뿐 — plan 체크리스트가 주장하는 뮤턴트 RED(1/1, 1/1) 결과와 부합하는 구조.
- **V111 마이그레이션이 README §5 최신 규약(신규 추가에도 0) DROP 선행)과 정확히 일치**: `codebase/backend/migrations/V111__trigger_workflow_id_index.sql:31-33` 의 `DROP INDEX CONCURRENTLY IF EXISTS idx_trigger_workflow_id; CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trigger_workflow_id ON trigger (workflow_id);` 는 같은 PR 이 `codebase/backend/migrations/README.md` 에 새로 규약화한 "신규 추가 | 0) DROP(새 이름) → CREATE(새 이름) | V111" 행(README.md §5)과 정확히 부합 — plan 초안(V106 형태, DROP 없음)에서 최종적으로 변경된 결정이 코드·문서·plan Rationale(INFO 3 처분) 세 곳 모두 일관되게 반영됨. `.conf` 의 `executeInTransaction=false` 도 CONCURRENTLY 두 문 모두를 커버.
- **spec 본문 line-level 일치**: `spec/1-data-model.md:924` 신규 행(`Trigger | (workflow_id) | ...`)과 `spec/data-flow/10-triggers.md:173` 말미 추가 문구가 plan S1/S3 초안 문구와 정확히 일치. `notification_health` 부분 인덱스 행(:925)도 INFO-1 처분대로 함께 추가돼 §3 표가 실제 DB 상태(V061)와 일치하게 됨.
- **e2e 스키마 단언이 실제로 실패를 구분할 수 있는 형태**: `trigger-deletion-releases-resources.e2e-spec.ts:199-212` 는 존재 여부만이 아니라 `indisvalid=true` 와 `pg_get_indexdef` 정규식(`ON public\.trigger USING btree \(workflow_id\)$`)까지 확인 — README 가 경고하는 "존재만 보는 단언은 invalid 인덱스를 초록으로 통과시킨다" 함정을 피함.
- **V111 번호·인덱스명 충돌 없음**: `ls codebase/backend/migrations | grep V11` 실측 결과 `V110`·`V111` 페어만 존재, 중복·gap 없음.
- TODO/FIXME/HACK/XXX 계열 미완성 표식 없음(대상 파일 전수 grep 0건).

## 요약

핵심 요구사항(V111 인덱스 추가, `releaseExternalForParent` select 투영 좁히기, 관련 spec·README 문서 갱신)은 구현·테스트·spec 이 line-level 로 정확히 맞물려 있고 CRITICAL 급 결함은 없다. 유일한 실질 이슈는 `plan/complete/spec-draft-trigger-workflow-index.md` 를 가리키는 아직 사실이 아닌 forward reference로, 원래 1곳(spec 문서)에서 이번 구현 커밋을 거치며 자동 가드가 못 잡는 2곳(V111 SQL 주석, e2e 테스트 주석)으로 늘었다 — plan 이 세운 "같은 PR 마지막 커밋에서 draft 이동" 완화책이 착지되면 저절로 참이 되지만, 그 완결 여부를 `--impl-done`/최종 이동 커밋에서 반드시 재확인해야 한다.

## 위험도

LOW
