# 요구사항(Requirement) 리뷰 — trigger `(workflow_id)` 인덱스 (V111) + `releaseExternalForParent` select 좁히기

## 검토 범위

- `codebase/backend/migrations/V111__trigger_workflow_id_index.sql` / `.conf` (신규)
- `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts` — `releaseExternalForParent` 의 `select` 좁히기
- `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.spec.ts` — `select` 단언 추가
- `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts` — schema(`indisvalid`) 단언 추가
- `spec/1-data-model.md` §3 인덱스 전략 표 + `## Rationale` 신규 절, `spec/data-flow/10-triggers.md` §2.1
- `plan/in-progress/spec-draft-trigger-workflow-index.md` + 두 차례 consistency-check 산출물

직접 실행/실물 대조로 확인한 것: 유닛 테스트 실행(`npx jest trigger-resource-releaser.service.spec.ts` → 11/11 GREEN), 대상 파일 `tsc --noEmit` 클린, `chat-channel-binder.service.ts`(teardown 소비 필드), `trigger.entity.ts`(컬럼 nullable 여부), `migrations/README.md` §5, `spec/2-navigation/2-trigger-list.md` §2.3.1(read-only 근거), `V001__initial_schema.sql`(FK 암묵 이름), `releaseExternalForParent` 호출부 2곳(`workflows.service.ts`, `workspaces.service.ts`) 전수.

## 발견사항

- **[INFO]** SQL 헤더 주석과 신규 e2e 테스트 docstring 이 아직 존재하지 않는 경로를 인용한다
  - 위치: `codebase/backend/migrations/V111__trigger_workflow_id_index.sql:5` (`-- 실측·같은 클래스 전수: plan/complete/spec-draft-trigger-workflow-index.md`), `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts` 신규 `it` 블록 바로 위 JSDoc (`근거·실측: plan/complete/spec-draft-trigger-workflow-index.md`)
  - 상세: 이 커밋 시점에 그 파일은 `plan/complete/`가 아니라 `plan/in-progress/spec-draft-trigger-workflow-index.md`에 있다(`find plan -iname "*trigger-workflow-index*"` 로 확인 — `plan/complete/` 쪽은 0건). draft 자신의 체크리스트도 `- [ ] 트래커 반영 · 이 draft complete/ 이동`을 아직 미완료로 남겨 뒀고, `--impl-prep` 단계 consistency-check(`review/consistency/2026/09/18/12_26_41`)가 이미 WARNING 1로 같은 점을 지적했으며 draft 는 "이 PR 의 마지막 커밋에서 이동한다"고 명시적으로 처분했다. 즉 새로 발견한 결함이라기보다, 계획대로라면 이 리뷰 다음의 마무리 커밋에서 해소될 알려진 간극이다 — 다만 **현재 스냅샷 기준으로는 코드 주석이 존재하지 않는 파일 경로를 가리키는 상태**이므로, 그 마무리 커밋(트래커 반영 + `git mv` to `plan/complete/`)이 실제로 이 PR 안에서 일어나는지 확인이 필요하다.
  - 제안: 별도 수정 불요 — 계획대로 이 PR의 마지막 커밋에서 `plan/in-progress/spec-draft-trigger-workflow-index.md` → `plan/complete/`로 이동하고 트래커(`spec-draft-nullable-notation-followups.md`)를 갱신하는 단계가 실제로 실행됐는지만 push 전에 재확인할 것.

## 정합성 확인 (문제 없음 — 근거 기록)

- **select 좁히기 완전성**: `releaseExternalForParent`가 `select: { id: true, type: true, config: true }`로 좁혔고, 그 결과가 흘러가는 `releaseExternalMany`는 `trigger.type`(schedule 필터)·`trigger.id`(schedule 조회 키·`unregister`)만 쓰고, `chatChannelBinder.teardownChatChannel`은 `trigger.config`(`chatChannel` 읽기)와 `trigger.id`만 읽는다(`chat-channel-binder.service.ts:365-371`) — 세 필드로 충분하고 과다·과소 선택이 없다.
- **호출부 무영향**: `releaseExternalForParent`는 `workflows.service.ts:268`, `workspaces.service.ts:513`에서만 호출되고 반환형이 `Promise<void>`라 select 좁히기가 호출부에 부작용을 만들지 않는다.
- **테스트**: unit(`trigger-resource-releaser.service.spec.ts`)의 mock trigger factory가 정확히 `{id, type, config: {}}`만 채워 select 계약과 일치하고, 실제 실행 결과 11/11 GREEN. e2e 신규 `it`은 인덱스 "존재"뿐 아니라 `indisvalid`와 `indexdef`(선두 컬럼)까지 단언해 `CREATE INDEX CONCURRENTLY` 실패로 인한 invalid 잔재를 초록으로 통과시키는 취약한 단언을 피했다.
- **마이그레이션**: `V111`은 저장소 실측상 다음 순번(V110 다음)이고 `.conf`(`executeInTransaction=false`)가 정확히 동봉됐다. `DROP INDEX CONCURRENTLY IF EXISTS` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS` 순서는 신규 추가(교체 아님)인데도 `migrations/README.md` §5의 "invalid 잔재가 영영 유효해지지 않는다"(V106 케이스) 위험을 인지하고 예방한 것으로, SQL 주석이 그 이유를 명시적으로 적어 뒀다. FK 이름 `trigger_workflow_id_fkey`는 `V001__initial_schema.sql`의 무명 `REFERENCES workflow(id) ON DELETE CASCADE`에 대한 Postgres 암묵 명명 규칙과 일치한다.
- **spec fidelity**: `spec/1-data-model.md` §3에 추가된 `Trigger | (workflow_id) | …` 행과 `## Rationale`의 `### Trigger (workflow_id) 인덱스 (2026-09-18)` 절이 실물 파일에 그대로 반영돼 있고(직접 `sed -n '915,930p'`, Rationale 절 확인), `spec/data-flow/10-triggers.md` §2.1 `trigger` 생성 행에도 `(workflow_id)` 인덱스 문구가 정확히 추가됐다. Rationale이 인용하는 `[트리거 목록 §2.3.1]`은 실제로 `workflowId | read-only (v1)`을 명시하고 있어 "v1 에서 바뀌지 않는다"는 주장과 일치한다. 코드-스펙 간 필드명·기본값·상태전이 불일치는 발견되지 않았다.
- **TODO/FIXME/HACK**: 대상 diff 5개 파일 어디에도 미완성을 시사하는 주석 없음.
- **엣지 케이스**: `config`는 DB 레벨 `NOT NULL DEFAULT '{}'`이라 `select`가 좁혀져도 `null` 역참조 위험이 없고, `scheduleTriggerIds.length === 0`(스케줄 타입 없음) 분기는 기존 로직 그대로 보존돼 회귀가 없다.

## 요약

인덱스 신설(V111)과 `releaseExternalForParent`의 `select` 좁히기는 선행 PR(#1346)이 만든 성능 갭(워크플로 삭제가 `trigger`를 3회 전체 스캔)을 정확히 겨냥한 국소적이고 완결된 변경이다. 코드가 실제로 소비하는 컬럼만 select하는지, spec 문서가 line-level로 갱신됐는지, 마이그레이션이 컨벤션(`migrations/README.md` §5)을 신규 추가 케이스에 맞게 응용했는지를 직접 실행·대조로 확인했고 불일치를 찾지 못했다. 유일한 관찰은 코드 주석이 아직 완료되지 않은 후속 커밋(`plan/complete/`로의 draft 이동)을 미리 가리키고 있다는 점인데, 이는 이미 draft 자신의 체크리스트와 `--impl-prep` consistency-check가 인지하고 "이 PR의 마지막 커밋에서 처리"로 명시적으로 처분해 둔 사항이라 CRITICAL/WARNING이 아니라 INFO로 남긴다.

## 위험도

NONE
