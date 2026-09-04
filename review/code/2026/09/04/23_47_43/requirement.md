# 요구사항(Requirement) 코드 리뷰

## 검토 방법

이번 changeset(51개 파일, `origin/main..HEAD` 5개 논리 커밋: `6143b8c9f`→`e20fe5b0b`→`dd6549796`→`8b0f5ac0c`→`608caf02b`)의 실질 코드 변경은 4개다.

- `codebase/backend/migrations/V110__schedule_workspace_next_run_index.{sql,conf}` (신규 마이그레이션)
- `codebase/backend/test/schedule-trigger.e2e-spec.ts` (schema 검증 `it` 1개 + 목록 조회 `J.` `it` 1개 추가)
- `codebase/backend/src/modules/schedules/schedules.service.spec.ts` (unit 케이스 1개 추가)
- `plan/complete/spec-draft-schedule-index.md`(신규), `plan/in-progress/spec-draft-nullable-notation-followups.md`(항목 종결), `spec/1-data-model.md`, `spec/data-flow/10-triggers.md`(spec 반영)

나머지는 이전 두 코드 리뷰 라운드(`23_02_51`, `23_26_09`)와 두 consistency-check 라운드(`22_34_55`, `22_43_40`)의 산출물이 이 PR 에 커밋된 것이다. 이 라운드들은 이미 WARNING 7건(각 4건·3건)을 지적하고 전부 조치 완료(RESOLUTION.md 확인)했다고 주장하므로, 프롬프트에 실린 리뷰 텍스트를 그대로 신뢰하지 않고 **저장소의 현재 소스를 직접 Read/Grep 하여 그 주장을 재검증**했다. 저장소에 쓰기는 하지 않았다(`git status --short` 확인 — 이 세션이 만든 `review/code/2026/09/04/23_47_43/` 외 변경 없음).

직접 대조한 파일: `codebase/backend/src/modules/schedules/{schedules.service.ts,schedules.controller.ts,dto/query-schedule.dto.ts,dto/responses/schedule-response.dto.ts,entities/schedule.entity.ts}`, `codebase/backend/src/common/dto/pagination.dto.ts`, `codebase/backend/src/common/dto/paginated-response.dto.ts`, `codebase/backend/src/common/interceptors/transform.interceptor.ts`, `codebase/backend/migrations/{V002__indexes.sql,V056__notification_active_partial_index.sql,V106__schedule_trigger_id_index.sql,README.md}`, `spec/1-data-model.md`, `spec/data-flow/10-triggers.md`, `plan/complete/spec-draft-schedule-index.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`.

## 발견사항

- **[INFO]** 기능 완전성 — 인덱스 교체가 실제 쿼리 경로·spec 서술·e2e 검증까지 line-level 로 일치함을 직접 확인
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:60-65`, `codebase/backend/src/modules/schedules/schedules.service.ts:80-105`(`resolveOrderBy`), `spec/1-data-model.md:914`, `spec/data-flow/10-triggers.md:175`
  - 상세: 옛 인덱스명(`idx_schedule_next_run`)이 `V002__indexes.sql:30` 의 실제 DDL과 정확히 일치하고, 신규 인덱스명(`idx_schedule_workspace_next_run`)이 마이그레이션·e2e schema 테스트·spec 두 문서 전부에서 동일하다. `spec/1-data-model.md:914` 의 `(workspace_id, next_run_at)` 서술과 `spec/data-flow/10-triggers.md:175` 의 미러가 실제 컬럼 순서·CONCURRENTLY 여부와 어긋남 없이 일치한다. V110 은 `ls migrations | sort -V | tail` 기준 다음 미점유 버전(V109 다음)이라 번호 충돌도 없다.
  - 제안: 없음 — spec fidelity CRITICAL 대상 없음.

- **[INFO]** e2e `J.` 테스트가 실제 엔드포인트 계약(쿼리 파라미터 검증·응답 포맷·워크스페이스 격리)과 정확히 부합
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:347-419`, 대조 `schedules.controller.ts:52-67`(`@Get() findAll`), `dto/query-schedule.dto.ts`, `common/dto/pagination.dto.ts`(`sort`/`order`/`limit` 검증 규칙), `common/interceptors/transform.interceptor.ts`
  - 상세: `sort=next_run_at&order=asc|desc&limit=50` 는 `PaginationQueryDto` 의 화이트리스트(`IsIn(['asc','desc'])`, `Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)`, `limit` 1~100)를 모두 통과하는 유효 입력이고, `resolveOrderBy('next_run_at')` → `'s.next_run_at'` 매핑도 `schedules.service.ts:119-126` 화이트리스트와 정확히 일치한다. `TransformInterceptor` 는 이미 `data` 키를 가진 `PaginatedResponseDto`(`{data, pagination}`)를 그대로 통과시키므로 테스트의 `res.body.data` 접근이 실제 응답 shape 와 맞는다. `ScheduleDto.nextRunAt?: string | null` (엔티티 `nextRunAt: Date | null`)이 nullable 이라 테스트의 `filter((v): v is string => v !== null)` 가 정당한 방어다.
  - 제안: 없음 — 기능·계약 불일치 없음.

- **[INFO]** 직전 두 코드 리뷰 라운드(`23_02_51` WARNING 4건, `23_26_09` WARNING 3건)가 조치 완료로 보고한 항목을 소스에서 재확인 — 전부 실제로 반영됨
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:60`(DROP-first, W1), `codebase/backend/test/schedule-trigger.e2e-spec.ts:81`(`relkind = 'i'`, INFO#8), `plan/in-progress/spec-draft-nullable-notation-followups.md:379`(체크박스 `[x]` + `../complete/` 상대링크, W2), `plan/complete/spec-draft-schedule-index.md`(`git mv` 완료 + `status: complete`, `23_26_09` W1), `codebase/backend/test/schedule-trigger.e2e-spec.ts:66-419`(`A`~`J` 물리 순서 = 알파벳 순, `23_26_09` W2)
  - 상세: "RESOLUTION.md 가 고쳤다고 적었다"에 의존하지 않고 각 항목을 직접 Read/grep 으로 대조했다 — DROP-first 순서(`DROP idx_schedule_workspace_next_run` → `CREATE ... IF NOT EXISTS` → `DROP idx_schedule_next_run`), `relkind='i'` 필터, plan 링크 상대경로, `plan/complete/` 로의 실제 파일 이동, e2e 테스트 물리 순서 `A,B,C,D,E,F,G,H,I,J` 모두 보고된 그대로였다. 문서 주장과 소스 상태 사이의 drift 는 발견되지 않았다.
  - 제안: 없음(확인용 기재). 이 결과로 이번 라운드에서 새로 여는 Critical/Warning 은 없다.

- **[INFO]** 잔여 백로그(`CREATE INDEX CONCURRENTLY IF NOT EXISTS` 재실행 규약화)는 이 PR 범위 밖으로 정당하게 분리됨
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:395-428`
  - 상세: V110 자신의 재실행 위험(빌드 실패 후 인덱스 0개)은 DROP-first 로 이미 닫혔고(실증 로그 `RESOLUTION.md` `23_02_51` §W1), 남은 것은 선례 V056/V106(이미 적용된 append-only 마이그레이션)에 대한 규약·런북 차원 처리다. `spec/conventions/` 쓰기는 planner 트랙이라는 이 저장소 규약과 정확히 일치하게 (a)/(b) 트랙으로 분리 등재돼 있다. 회색지대(spec 본문이 아직 다루지 않는 영역)이므로 SPEC-DRIFT 태그를 붙이지 않는다 — 이것은 코드가 spec 을 앞서간 것이 아니라 규약 문서 자체가 아직 이 패턴을 다루지 않는 신규 후속 작업이다.
  - 제안: 없음 — 후속 등재가 적절하다.

## 요약

실질 코드 변경(V110 마이그레이션 쌍 + e2e 테스트 2건 + unit 테스트 1건)은 spec(`spec/1-data-model.md` §3·`## Rationale`, `spec/data-flow/10-triggers.md` §2.1)과 line-level 로 정확히 일치하며, 실제 컨트롤러·서비스·DTO·인터셉터·엔티티를 직접 대조한 결과 기능 완전성·에러 시나리오·데이터 유효성·비즈니스 로직(워크스페이스 격리 + 정렬 화이트리스트) 모두 코드와 정합한다. 이 PR 은 이미 코드 리뷰 2라운드(`23_02_51`→WARNING 4건, `23_26_09`→WARNING 3건)와 consistency-check 2라운드(`22_34_55`→WARNING 2건, `22_43_40`→WARNING 0건)를 거쳤고, 각 라운드가 "조치 완료"로 보고한 항목을 이번 라운드에서 문서 주장에 의존하지 않고 소스를 직접 열어 독립 재검증했으나 drift 나 미반영은 발견하지 못했다. TODO/FIXME/HACK/XXX 흔적도 diff 전체에 없다. 새로 여는 Critical/Warning 은 없다.

## 위험도
NONE
