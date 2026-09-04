# 요구사항(Requirement) 코드 리뷰

## 검토 방법

`git status --short -b` 로 확인한 결과 이 브랜치(`claude/schedule-next-run-index`)는 `origin/main` 대비 9개 커밋·65개 파일 diff(`+4610/-20`)이며, 앞서 이미 코드 리뷰 3라운드(`23_02_51`→WARNING 4·`23_26_09`→WARNING 3·`23_47_43`→WARNING 1, 전부 조치 완료)와 consistency-check 2라운드(`22_34_55`→WARNING 2·`22_43_40`→WARNING 0)를 거쳤다. `git log`·`git diff --stat origin/main..HEAD` 로 확인한 결과 `23_47_43` 라운드의 조치 커밋(`703e10dca`) 이후 코드·spec·plan 에 새 diff 는 없다 — 이번 라운드는 그 최종 상태를 프롬프트 텍스트에 의존하지 않고 **소스를 직접 Read/Grep 하여 독립 재검증**했다.

직접 대조한 파일: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.{sql,conf}`, `codebase/backend/test/schedule-trigger.e2e-spec.ts`(전문), `codebase/backend/src/modules/schedules/{schedules.service.ts,schedules.service.spec.ts,dto/query-schedule.dto.ts}`, `codebase/backend/src/common/dto/pagination.dto.ts`, `codebase/backend/src/modules/schedules/entities/schedule.entity.ts`, `codebase/backend/migrations/V002__indexes.sql`, `spec/1-data-model.md`(§3 표 + `## Rationale` 신설분), `spec/data-flow/10-triggers.md`(§2.1 미러), `plan/complete/spec-draft-schedule-index.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`. 저장소에 쓰기는 하지 않았다(`git status --short` 로 이 세션의 출력 디렉터리 외 변화 없음 확인).

## 발견사항

- **[WARNING]** `spec/1-data-model.md` `## Rationale` 신설 항목의 출처 인용 `#1284` 가 이 변경과 무관한 다른(이미 병합된) PR 번호다
  - 위치: `spec/1-data-model.md:977` (`> 출처: \`#1284\` 후속으로 남아 있던 developer 항목. 실측·재현 절차는 \`plan/complete/spec-draft-schedule-index.md\`, 구현은 V110.`)
  - 상세: `git log --oneline`으로 직접 추적한 결과, `idx_schedule_next_run` 후속 항목은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 커밋 `cce8a188b`(**PR #1277**)에서 처음 등재됐고, 이후 `#1278`·`#1280`에서 갱신됐다. **`#1284`는 이 브랜치가 분기한 베이스 커밋(`4a92cb2bf`, `fix(api): OpenAPI 만 거짓말하고 있었다 — numeric 축 가드 + 응답 대조 검증자 첫 엔드포인트`)의 PR 번호이며, `git merge-base --is-ancestor 4a92cb2bf origin/main` 로 확인한 결과 이미 `origin/main` 에 병합돼 있고 schedule 인덱스와는 전혀 무관한 내용이다.** 같은 `## Rationale` 섹션의 다른 항목(`:994`, `### alert_rule 을 §2.25 로 등재`)은 `#1245 의 --impl-done(21_59_41) cross_spec` 처럼 **PR + 세션 ID** 를 함께 적어 검증 가능한 출처를 남기는데, 이번 신설 항목은 세션 ID 없이 PR 번호만 있고 그 번호조차 틀렸다. 이 저장소가 이미 반복 지적해 온 "관련 spec 근거를 정확히 남긴다" 관행(CLAUDE.md `## Rationale` = SoT)에 어긋나는 사실 오류이며, 코드 리뷰 3라운드가 모두 이 필드를 재확인 대상으로 삼지 않고 통과시켰다(`23_47_43/documentation.md` 는 오히려 이 `#1284` 를 "이미 안정적 식별자를 쓰고 있는 좋은 예"로 인용해 그대로 전파했다).
  - 제안: `#1284` 를 실제 출처(예: `#1277` — 항목이 처음 등재된 PR, 필요하면 이후 갱신 PR `#1278`/`#1280` 도 함께)로 정정한다. 이 파일은 `spec/` 이므로 수정은 `project-planner` 트랙 — 정정 자체는 사소하지만(한 줄, 인접 서술 불변), spec 본문의 사실관계 오류이므로 developer 자가-반증 소정정 예외(요구사항·제품 정의가 아니라 "예고 문장" 정정에 한정) 대상은 아니다.

- **[INFO]** 기능 완전성 — 인덱스 교체가 실제 쿼리 경로·양쪽 spec 미러·양방향 e2e 까지 line-level 로 정확히 일치함(독립 재확인)
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:60-65`, `codebase/backend/src/modules/schedules/schedules.service.ts:80-108,115-124`(`findAll`/`resolveOrderBy`), `spec/1-data-model.md:914`, `spec/data-flow/10-triggers.md:175`, `codebase/backend/test/schedule-trigger.e2e-spec.ts:66-84,347-419`
  - 상세: 옛 인덱스명(`idx_schedule_next_run`)이 `V002__indexes.sql:30` DDL과 정확히 일치, 신규 인덱스명(`idx_schedule_workspace_next_run`)이 마이그레이션·e2e schema 테스트·spec 두 문서 전부에서 동일 문자열이다. `resolveOrderBy` 화이트리스트(`next_run_at → s.next_run_at`)와 신규 unit 테스트(`schedules.service.spec.ts:142-147`), e2e `J.` 테스트(asc/desc 양방향 + `createdAt` 기본 정렬 + 다른 워크스페이스 격리를 `toEqual([])` 로 직접 단언)가 서로 어긋남 없이 정합한다. `PaginationQueryDto`(`limit` 1~100, `order` `IsIn(['asc','desc'])`, `sort` 정규식 화이트리스트)와 e2e 가 실제로 보내는 `limit=50`/`sort=next_run_at`/`order=asc|desc` 가 전부 유효 입력 범위 안이다.
  - 제안: 없음 — spec fidelity CRITICAL 대상 없음.

- **[INFO]** 마이그레이션 재실행 안전성(`indisvalid`) 결함이 실제로 닫혀 있음을 코드로 재확인
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:60`(`DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_workspace_next_run;` — CREATE **앞**), `codebase/backend/test/schedule-trigger.e2e-spec.ts:66-84`(`indisvalid=true` 단언 + 구 인덱스 `relkind='i'` 필터로 부재 확인)
  - 상세: `23_02_51` W1(재실행 시 인덱스 0개가 될 수 있던 결함)이 CREATE 앞 DROP 추가로 실제 코드에 반영돼 있고, 이 상태를 고정하는 e2e schema 테스트도 실재한다. `23_26_09` W3(DROP-first 의 비대칭 — 정상 마이그레이션 수동 재실행 시 재빌드)도 헤더 주석(`:53-58`)에 트레이드오프 표로 명시돼 있어 "문서한 보장이 구현보다 넓다" 패턴이 재발하지 않았다.
  - 제안: 없음(확인용 기재).

- **[INFO]** TODO/FIXME/HACK/XXX 흔적 없음, 반환값·에러 시나리오 누락 없음
  - 위치: `git diff origin/main..HEAD -- codebase/` 전체 grep(`TODO|FIXME|HACK|XXX`) 매치 0건
  - 상세: `schedules.service.ts:findAll` 은 모든 경로(검색어 유무, `triggerId` 유무, 정렬 컬럼 화이트리스트 히트/미스)에서 `PaginatedResponseDto` 를 반환하고, `resolveOrderBy` 는 미허용 값에도 `'s.created_at'` 폴백으로 항상 값을 반환한다(undefined 반환 경로 없음). 마이그레이션도 `IF EXISTS`/`IF NOT EXISTS` 로 모든 재실행 분기에서 에러 없이 종료한다.
  - 제안: 없음.

- **[INFO]** 잔여 백로그(`CREATE INDEX CONCURRENTLY IF NOT EXISTS` 재실행 규약화)는 여전히 이 PR 범위 밖으로 정당하게 분리돼 있고, 상태가 정직하게 열려 있다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:395-428`(체크박스 `[ ]`, planner/developer 트랙 분리)
  - 상세: V110 자신의 재실행 위험은 DROP-first 로 닫혔고, 선례 `V056`/`V106`(append-only, 수정 불가) 에 대한 규약·런북 처리만 후속으로 남아 있다는 서술이 실측(`git log -S`, `README.md`/`migrations.md` grep 결과 `indisvalid` 언급 0건)과 일치한다. 체크박스가 `[x]` 로 조작되지 않고 정직하게 `[ ]` 로 남아 있다.
  - 제안: 없음 — 이번 PR 을 막을 사유 아님.

## 요약

실질 코드 변경(V110 마이그레이션 쌍 + e2e 테스트 2건 + unit 테스트 1건)은 기능 완전성·에러 시나리오·데이터 유효성·비즈니스 로직(워크스페이스 격리 + 정렬 화이트리스트)·반환값 모든 축에서 spec(`spec/1-data-model.md` §3·`spec/data-flow/10-triggers.md` §2.1)과 line-level 로 정확히 일치하며, 코드 리뷰 3라운드가 낸 WARNING 8건(누적)이 전부 실제로 조치돼 있음을 문서 주장에 의존하지 않고 소스에서 독립 재확인했다. TODO/FIXME 류 미완성 흔적도 없다. 다만 이번 라운드에서 처음으로 `spec/1-data-model.md` `## Rationale` 신설 항목의 출처 인용 `#1284` 가 실제로는 이 스케줄 인덱스 작업과 무관한, 이미 병합된 다른 PR 번호임을 `git log`/`merge-base` 로 확인했다 — 기능에는 영향이 없으나 spec 의 "결정 근거" SoT 에 사실 오류가 남고, 앞선 리뷰 라운드가 이 번호를 오히려 "좋은 인용 예시"로 그대로 전파했다는 점에서 지금 정정하는 것이 맞다.

## 위험도

LOW
