# Cross-Spec 일관성 검토 — trigger `(workflow_id)` 인덱스 (V111)

## 검토 범위와 실제 델타

호출 시 지정된 scope(`spec/2-navigation/`)는 이번 브랜치에서 델타 0이며, 실제 spec 변경은
`spec/1-data-model.md`(§3 인덱스 전략 표 + `## Rationale` 신설 절), `spec/data-flow/10-triggers.md`(§2.1 `trigger` 생성
행 각주 추가), `spec/conventions/migrations.md`(§5 말미 콜아웃 재작성) 세 파일에 있다(`git diff origin/main...HEAD` 로 확인).
코드 diff는 `V111__trigger_workflow_id_index.sql`/`.conf`, `codebase/backend/migrations/README.md`,
`trigger-resource-releaser.service.ts`(+spec/e2e)로 6파일 규모다. 아래는 이 실제 변경분을 기준으로 검토했다.

## 발견사항

없음 — CRITICAL·WARNING·INFO 어느 등급의 cross-spec 충돌도 발견되지 않았다.

### 확인한 근거

1. **데이터 모델 충돌 없음** — `spec/1-data-model.md` §3 에 추가된 `Trigger | (workflow_id) | ...` 행은 기존
   `(workspace_id, type)` · `(workspace_id, endpoint_path) UNIQUE` 행과 겹치지 않는(선두 컬럼이 다른) 신규 단독 인덱스이고,
   `codebase/backend/src/modules/triggers/entities/trigger.entity.ts` 의 `@Column({ name: 'workflow_id' }) workflowId`
   컬럼명과 `V111__trigger_workflow_id_index.sql` 의 `ON trigger (workflow_id)` 가 일치한다. Rationale 이 인용하는
   `workflowId` read-only(v1) 서술([`2-trigger-list.md` §2.3.1](../../../../../spec/2-navigation/2-trigger-list.md))도
   현재 문서 상태와 모순 없다.
2. **API 계약 충돌 없음** — 이번 변경은 신규 인덱스 + `releaseExternalForParent` 의 `select` 컬럼 축소(`id, type, config`)뿐이며,
   endpoint·request/response shape 변경이 없다. `select` 축소분이 실제 소비하는 필드(`releaseExternalMany` 의
   `trigger.type`, `chatChannelBinder.teardownChatChannel` 의 `trigger.config`/`trigger.id`)와 정확히 일치함을
   `trigger-resource-releaser.service.ts` / `chat-channel-binder.service.ts` 코드로 확인했다 — 다른 필드(`config` 밖)를
   읽는 소비처가 없다.
3. **요구사항 ID 충돌 없음** — 이번 변경은 새 요구사항 ID를 부여하지 않는다(순수 인덱스 성능 항목).
4. **상태 전이 충돌 없음** — 트리거/스케줄 상태 머신에 변화 없음. `§4.3 cascade` 표의 FK CASCADE 서술(`V001`)은 이번
   PR 이 바꾸지 않았고, 새 인덱스는 그 CASCADE 의 실행 방식을 바꾸지 않으므로 §4.3 행을 갱신할 필요가 없다(스캔 방식만
   Seq Scan → Bitmap Index Scan 으로 최적화).
5. **권한·RBAC 모델 충돌 없음** — 관련 코드·spec 어디에도 역할 게이트 변경 없음.
6. **계층 책임 충돌 없음** — 변경된 코드 파일(`trigger-resource-releaser.service.ts` 등)은
   [`spec/2-navigation/2-trigger-list.md`](../../../../../spec/2-navigation/2-trigger-list.md) frontmatter `code:`
   목록에 이미 등재되어 있어 소유 경계가 그대로 유지된다. 마이그레이션 파일(`V111__*`)도
   `codebase/backend/migrations/` 컨벤션(`spec/conventions/migrations.md`)의 절차를 그대로 따른다.
7. **`spec/conventions/migrations.md` ↔ `codebase/backend/migrations/README.md` §5 정합** — 이번 PR이 넓힌
   콜아웃 문구("교체든 신규 추가든 ... invalid 잔재 정리를 둔다")가 README §5 최신 내용(`51aef0107`/`ff7d79967` 로 이미
   반영된 "인덱스 교체는 DROP-먼저" + "신규 추가에도 0) 을 둡니다" 두 하위 패턴)과 문구·인용 사례(V056/V106/V110/V111)
   모두 일치한다.
8. **신규 식별자 충돌 없음** — `idx_trigger_workflow_id`, `V111`을 `codebase/`·`spec/`·`plan/` 전수 grep 한 결과 이번
   작업이 만든 자리(SQL/.conf/spec 2곳/e2e 주석) 외에 다른 의미로 이미 점유된 곳이 없다(마이그레이션 디렉터리에도
   중복 `V111__*` 파일이 없음을 확인).
9. **자매 문서 폭 불일치는 이미 검토·기각된 항목** — `spec/data-flow/8-notifications.md:277`("새로 쓰는 인덱스 **교체**는
   README §5 를 따른다")는 여전히 "교체"에 한정된 좁은 표현이지만, 이는 이전 회차 cross-spec 검토
   (`review/consistency/2026/09/18/13_04_19`)에서 WARNING으로 지적된 뒤 `plan/complete/spec-draft-trigger-workflow-index.md`
   Rationale("`--spec` 2회차 처분")에 **의도적으로 고치지 않는다**는 근거(그 문장의 주어는 V056 그 자체의 이력이라 좁은
   서술이 맞고, `migrations.md` 콜아웃은 모든 신규 마이그레이션에 걸리는 일반 규칙이라 넓어야 했던 것과 층이 다르다)와
   함께 판정이 이미 남아 있다. 새로운 모순이 아니라 기존에 다른 layer를 서술하는 문장이므로 이번 회차에서 등급을
   다시 매기지 않는다.

## 요약

이번 PR(`trigger (workflow_id)` 인덱스 V111 + `releaseExternalForParent` select 컬럼 축소)은 데이터 모델·API 계약·
요구사항 ID·상태 전이·RBAC·계층 책임 어느 축에서도 다른 spec 영역과 충돌하지 않는다. 유일하게 폭이 갈리는 자매 문서
(`spec/data-flow/8-notifications.md:277`)는 이전 회차에서 이미 "다른 층을 서술하는 문장"으로 검토·기각되었고 그 근거가
plan Rationale에 기록되어 있어, cross-spec 관점에서 재차 지적할 사안이 아니다. Cross-Spec 관점에서 이 PR은 clean 하다.

## 위험도
NONE
