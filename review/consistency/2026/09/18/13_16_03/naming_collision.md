# 신규 식별자 충돌 검토 — trigger `(workflow_id)` 인덱스 (impl-done, scope=spec/2-navigation/)

## 검토 범위와 실제 델타

호출 프롬프트의 명목 scope 는 `spec/2-navigation/` 이지만, `git diff origin/main...HEAD` 실측 결과
그 영역의 spec 델타는 0개 파일이다(정상 — 이 PR 은 다른 영역을 바꾼다). 이 PR 이 실제로 새 식별자를
도입하는 자리는:

- `codebase/backend/migrations/V111__trigger_workflow_id_index.sql` / `.conf` (신규 마이그레이션)
- `spec/1-data-model.md` §3 인덱스 전략 표 신규 행 2개(`(workflow_id)`, `(notification_health)`) + 신규
  Rationale 절 `### Trigger \`(workflow_id)\` 인덱스 (2026-09-18)`
- `spec/data-flow/10-triggers.md` §2.1 `trigger` 생성 행 문구 추가
- `spec/conventions/migrations.md` §5 콜아웃 확장 + `codebase/backend/migrations/README.md` §5 신규
  단락(`**신규 추가에도 0) 을 둡니다**`)
- `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts` 신규 e2e 케이스(`schema: trigger
  (workflow_id) 인덱스가 유효하게 있다 (V111)`)
- `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts` 의 `select` 좁히기(새
  식별자 도입 아님 — TypeORM `find()` 옵션 객체 리터럴)
- `plan/complete/spec-draft-trigger-workflow-index.md` (신규 plan 파일)

`spec/2-navigation/2-trigger-list.md` · `3-schedule.md` 는 이 diff 가 건드리지 않으며, 프롬프트에 번들된
것은 `trigger.workflowId` 가 read-only(v1) 라는 근거로 위 Rationale 절이 링크를 거는 관련 문서일 뿐이다
(내용은 바뀌지 않았다 — 그 두 파일 자체의 diff 는 0줄).

## 관점별 확인

1. **요구사항 ID 충돌** — 이 PR 은 새 요구사항 ID(R-\*, WH-\*, CCH-\* 류)를 부여하지 않는다. 신규
   Rationale 절 제목은 날짜 기반(`(2026-09-18)`)이라 그 파일의 기존 관례(예: `### User 민감 컬럼 방어를
   select: false 가 아니라 응답 경계에 둔 이유 (2026-09-06)`)와 같은 패턴이며 번호 충돌 여지가 없다.
   해당 없음.

2. **엔티티/타입명 충돌** — 신규 엔티티·DTO·인터페이스 없음. `TriggerResourceReleaserService.releaseExternalForParent`
   의 `select: { id: true, type: true, config: true }` 는 기존 메서드 시그니처 그대로이고 새 타입/필드명을
   만들지 않는다. `Trigger` 엔티티에는 `@Index` 데코레이터가 없어(기존 V061·V106 인덱스도 동일 관례) 코드
   레벨 식별자 충돌 표면 자체가 없다.

3. **API endpoint 충돌** — 이 PR 은 API endpoint 를 추가·변경하지 않는다. 해당 없음.

4. **이벤트/메시지명 충돌** — webhook·queue·SSE 이벤트명 신규 도입 없음. 해당 없음.

5. **환경변수·설정키 충돌** — 신규 ENV var·config key 없음. `.conf` 파일의 `executeInTransaction=false` 는
   Flyway 표준 키이며 V022·V051·V056·V072·V075~V079·V086·V095·V099·V105·V110 등 기존 다수 `.conf` 가 이미
   쓰는 값이다(신규 키 아님).

6. **파일 경로 충돌** — 마이그레이션 파일명 `V111__trigger_workflow_id_index.sql` / `.conf`:
   - `ls codebase/backend/migrations/` 실측 결과 `V110` 다음 유일한 신규 버전이며 `V111` 을 쓰는 다른
     파일은 없다(`git grep -n "V111"` — 매치는 전부 이 신규 파일 자신, `migrations/README.md` 의 신규
     서술, `spec/1-data-model.md`·`spec/data-flow/10-triggers.md` 의 신규 참조, 신규 e2e 케이스, 신규
     plan 파일뿐).
   - 파일명 컨벤션(`V<번호>__<스네이크케이스 설명>.sql`)을 그대로 따른다 — `V106__schedule_trigger_id_index.sql`,
     `V110__schedule_workspace_next_run_index.sql` 과 동일 패턴.
   - 신규 plan 파일 `plan/complete/spec-draft-trigger-workflow-index.md` — 동일 이름의 기존 파일 없음
     (`find plan -iname "*trigger-workflow-index*"` 결과 이 파일 하나).

### 인덱스 이름 `idx_trigger_workflow_id` — 별도 실측

이 PR 의 유일한 실질적 "새 식별자"인 Postgres 인덱스명을 저장소 전수로 재확인했다:

```
git grep -n "idx_trigger_workflow_id"
```

매치는 `V111__trigger_workflow_id_index.sql`(정의) · `trigger-deletion-releases-resources.e2e-spec.ts`(검증
쿼리) · `spec/1-data-model.md` · `plan/complete/spec-draft-trigger-workflow-index.md`(문서화) 뿐이며, 다른
의미로 이미 쓰이는 동명 식별자는 없다. 명명 패턴도 기존 `idx_<table>_<column>` 관례(`idx_schedule_trigger_id`
V106, `idx_execution_workflow_status` V105, `idx_trigger_notification_degraded` V061, `idx_schedule_workspace_next_run`
V110)와 일치해 컨벤션 이탈도 없다.

이 확인은 이미 `plan/complete/spec-draft-trigger-workflow-index.md` §구현 이 사전에 수행한 것과 동일한
grep(`codebase/` · `spec/` · `plan/` 0건)이며, 구현 완료 후 재실측해도 결과가 같다.

## 이전 회차와의 관계

같은 target 에 대한 `--spec` 단계 naming_collision 검토가 이미 두 차례(`review/consistency/2026/09/18/12_18_52`,
`13_04_19`) NONE 으로 판정했다. 본 impl-done 회차는 그 판정이 구현 완료 후에도 유지되는지(코드 diff 6파일 포함)
재확인하는 것이 목적이며, 위 실측대로 신규 CRITICAL/WARNING 은 없다.

## 발견사항

없음 (CRITICAL 0, WARNING 0, INFO 0). 참고로 이전 회차(`13_04_19`)가 남긴 INFO(`spec/data-flow/8-notifications.md:277`
가 README §5 콜아웃 확장을 "교체" 로만 좁게 반영)는 naming-collision 이 아니라 cross-spec 정합성 항목이며, 이번
scope(`spec/2-navigation/`)와도 무관해 여기서는 재기재하지 않는다.

## 요약

이 PR 이 새로 도입하는 식별자는 마이그레이션 `V111`/인덱스 `idx_trigger_workflow_id`, `spec/1-data-model.md` 의
신규 표 행·Rationale 절, `spec/conventions/migrations.md`/`migrations/README.md` 의 신규 콜아웃 문구, 신규 e2e
케이스 이름, 신규 plan 파일 하나로 한정된다. 전수 grep 결과 어느 것도 기존에 다른 의미로 쓰이고 있지 않으며, 파일명·
인덱스명 컨벤션도 기존 선례(V106/V110, `idx_<table>_<column>`)를 그대로 따른다. `spec/2-navigation/` 자체는 이
diff 로 변경되지 않았고, 신규 식별자 충돌 관점에서 이 PR 을 막을 사유가 없다.

## 위험도

NONE
