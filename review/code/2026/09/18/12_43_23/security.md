# 보안(Security) 리뷰 — trigger (workflow_id) 인덱스 + 외부 해제 select 좁히기 (V111)

## 검토 범위

- `codebase/backend/migrations/V111__trigger_workflow_id_index.conf` / `.sql` (신규 마이그레이션)
- `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts` (`releaseExternalForParent` 의 `find()` 에 `select` 추가)
- `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.spec.ts` (단위 테스트, `select` 단언 추가)
- `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts` (스키마 e2e 단언 추가)
- `plan/in-progress/spec-draft-trigger-workflow-index.md`, `spec/1-data-model.md`, `spec/data-flow/10-triggers.md` (문서)
- `review/consistency/2026/09/18/{12_18_52,12_26_41}/**` (consistency-check 산출물 — 코드 아님)

`git diff origin/main...HEAD --stat` 로 프롬프트 대상 파일 목록과 실제 diff 가 일치함을 확인했다. 저장소 파일은 뮤테이션하지 않았다(전량 Read 전용 검토).

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** 신규 SQL 이 전부 정적 문자열이며 사용자 입력이 개입하지 않음 (인젝션 해당 없음)
  - 위치: `codebase/backend/migrations/V111__trigger_workflow_id_index.sql:31-33`
  - 상세: `DROP INDEX CONCURRENTLY IF EXISTS idx_trigger_workflow_id;` / `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trigger_workflow_id ON trigger (workflow_id);` 는 인덱스명·테이블명·컬럼명이 전부 하드코딩 리터럴이라 SQL 인젝션 표면이 없다. e2e 테스트(`trigger-deletion-releases-resources.e2e-spec.ts` 신규 `it` 블록)의 `pg_index`/`pg_class` 조회도 리터럴 `'idx_trigger_workflow_id'` 만 사용해 동일하다.
  - 제안: 조치 불요 (참고 기록).

- **[INFO]** `select` 좁히기는 노출 컬럼을 **줄이는** 방향이며 새 정보 노출을 만들지 않음
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts` `releaseExternalForParent` (변경 후 73~76행)
  - 상세: 변경 전에는 `this.triggerRepository.find({ where: parent })` 로 `Trigger` 전 컬럼(비밀 참조·헬스·타임스탬프 포함)을 메모리에 올렸다. 변경 후에는 `select: { id: true, type: true, config: true }` 로 컬럼을 명시적으로 좁혔다. `Trigger.config` 컬럼은 `@Column({ type: 'jsonb' })` 로 `select: false` 가 걸려 있지 않아(직접 엔티티 확인) 원래도 로드 가능한 컬럼이었으므로, 이번 변경이 새로운 민감 데이터 접근을 추가하지 않는다. 오히려 로드 컬럼 집합이 최소화되어 우발적 로그/직렬화 노출 표면이 줄었다.
  - 제안: 조치 불요.

- **[INFO]** 에러 메시지에 내부 예외 문자열을 포함하지만 로그·throw 대상은 내부 경계 내
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts` `removeScheduleJobsOrRestore` (203~207행 `throw new Error(...)`, 197~200행 `logger.error(...)`)
  - 상세: `err instanceof Error ? err.message : String(err)` 를 조합한 문자열을 로그·예외 메시지에 넣는다. 이 서비스는 워크플로/워크스페이스 삭제 트랜잭션 내부 협력자이고 이 변경 diff 자체가 만든 패턴이 아니라 기존 코드다(diff 는 `select` 필드 추가만). 호출 경로가 컨트롤러까지 그대로 전파돼 클라이언트 응답에 원문 노출되는지는 이번 diff 범위 밖이라 재확인하지 않았다.
  - 제안: 조치 불요 (이번 PR 의 신규 결함 아님, 참고만).

- **[INFO]** consistency-check 산출물(`review/consistency/**`)에 시크릿·자격증명 없음
  - 위치: `review/consistency/2026/09/18/12_18_52/**`, `review/consistency/2026/09/18/12_26_41/**`
  - 상세: 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/...`)만 포함하며 API 키·토큰·비밀번호 패턴 없음. 문서 산출물이라 보안 표면 아님.

## 점검 관점별 결론

1. 인젝션: 해당 없음 — 신규 SQL·테스트 쿼리 전부 정적 리터럴, 사용자 입력 미개입.
2. 하드코딩된 시크릿: 발견 없음.
3. 인증/인가: 이번 diff 는 인증·인가 로직을 변경하지 않는다(DB 인덱스 추가, `find()` select 절 좁히기, 테스트 보강뿐).
4. 입력 검증: 사용자 입력을 받는 신규 진입점 없음.
5. OWASP Top 10: 해당 사항 없음 — 순수 성능(인덱스) + 데이터 최소화(select 좁히기) 변경.
6. 암호화: 관련 변경 없음.
7. 에러 처리: 기존 패턴(`err.message` 포함) 유지, 이번 diff 가 새로 만든 노출 아님(위 INFO 참고).
8. 의존성 보안: 신규/변경 의존성 없음.

## 요약

이번 변경은 (1) `trigger.workflow_id` 에 대한 `CONCURRENTLY` 인덱스를 추가하는 Flyway 마이그레이션과 (2) 워크플로 삭제 시 외부 자원 해제가 로드하는 컬럼을 `id/type/config` 로 좁히는 TypeORM `select` 절 추가, 그에 따른 단위·e2e 테스트 보강으로 구성된 순수 성능·데이터 최소화 개선이다. 신규 SQL 은 전부 정적 리터럴로 인젝션 표면이 없고, 컬럼 select 좁히기는 오히려 로드되는 데이터 양을 줄여 노출 표면을 축소하는 방향이며 `config` 컬럼 자체는 이 변경 이전부터 `select:false` 없이 로드 가능했다. 인증/인가·시크릿·암호화·의존성 축에서 변경 사항이 없고, 문서·리뷰 산출물에도 민감정보 유출이 없다. 보안 관점에서 이 PR 을 차단할 사유는 없다.

## 위험도

NONE
