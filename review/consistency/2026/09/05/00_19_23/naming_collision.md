# 신규 식별자 충돌 검토 — Schedule 인덱스 `(workspace_id, next_run_at)` 전환 (V110)

## 검토 대상 요약

target 델타는 spec 2개 파일(`spec/1-data-model.md`, `spec/data-flow/10-triggers.md`)과 이를
구현하는 4개 코드 파일(V110 마이그레이션 `.sql`/`.conf`, `schedules.service.spec.ts`,
`schedule-trigger.e2e-spec.ts`)로 구성된다. 신규 도입 식별자는 다음 세 가지로 좁혀진다.

1. Flyway 마이그레이션 버전 `V110` (`V110__schedule_workspace_next_run_index.sql` / `.conf`)
2. Postgres 인덱스명 `idx_schedule_workspace_next_run`
3. `spec/1-data-model.md` §3 Schedule 인덱스 표에 새로 추가된 두 번째 행 `(trigger_id)`
   (기존 V106 구현의 문서화 보완 — 새 식별자 도입이 아니라 기존 인덱스의 누락된 표 항목 채움)

그 외에는 요구사항 ID, 엔티티/DTO 명, API endpoint, 이벤트명, ENV var 신규 도입이 없다
(기존 `GET /api/schedules`, `SchedulesService.resolveOrderBy` 의 `next_run_at` 매핑은
diff 전부터 존재 — `codebase/backend/src/modules/schedules/schedules.service.ts:119`, 테스트만 신규).

## 발견사항

### 1. 마이그레이션 버전 `V110` — 충돌 없음

- `ls codebase/backend/migrations/` 실측: `V109__workspace_personal_owner_unique.*` 다음
  미점유 정수가 `V110` — 단조증가 정책([`spec/conventions/migrations.md`](../../../../../spec/conventions/migrations.md) §1~2) 대로 다음 번호를 정확히 점유했다.
- `V110` 토큰을 `spec/` 전체에서 grep 한 결과 이번 target 두 파일(`spec/1-data-model.md:914,979`,
  `spec/data-flow/10-triggers.md:175`) 외에는 나타나지 않는다. 프로젝트가 별도로 쓰는
  하이픈형 기능 그룹 ID(`V-04`, `V-09`, `V-10`, `V-12`, `V-14` 등, `2-navigation` 계열 문서)와는
  표기(하이픈 유무)와 네임스페이스(마이그레이션 버전 vs 기능 그룹)가 달라 혼동 표면이 없다.

### 2. 인덱스명 `idx_schedule_workspace_next_run` — 충돌 없음

- 저장소 전역 grep(`*.sql/*.md/*.ts/*.conf`) 결과 이 이름은 V110 파일 자신과 그 구현을 다루는
  동일 작업의 리뷰 산출물(`review/code/2026/09/04/23_47_43/*.md`)에서만 등장한다. 기존 스키마·
  spec 어디에도 다른 의미로 선점되어 있지 않다.
- 대체 대상인 옛 인덱스명 `idx_schedule_next_run` (`V002__indexes.sql:30`)은 이번 diff 가 DROP
  하는 대상으로 정확히 일치 인용되며, 남은 참조(`plan/complete/spec-draft-schedule-index.md`,
  `plan/in-progress/spec-draft-nullable-notation-followups.md:54,379,484`)는 전부 "종전 인덱스"
  로서의 역사적 언급이라 신규 정의와 혼선을 만들지 않는다.

### 3. Schedule 인덱스 표의 `(trigger_id)` 행 추가 — 신규 식별자 아님, 문서 갭 보완

- 이 행이 인용하는 `idx_schedule_trigger_id` / `V106` 은 이미 `codebase/backend/migrations/V106__schedule_trigger_id_index.sql`
  (선행 커밋 `219e63e8f`, #818)로 구현돼 있었으나 `spec/1-data-model.md` §3 표에는 항목이
  없었다. 이번 diff 는 V110 행 추가와 같은 편집 단위에서 그 누락을 메운 것이며, 표 안에
  동일 엔티티·동일 인덱스에 대한 중복 행은 없다(§3 895~939행 직접 대조).

### 4. `.conf` 설정 키 `executeInTransaction=false` — 기존 관례 재사용

- Flyway 표준 옵션이며 `spec/conventions/migrations.md` 가 이미 문서화한 패턴(V056 등 CONCURRENTLY
  선례)을 그대로 따른다. 새 키가 아니라 기존 관례의 반복 사용이라 충돌 대상이 아니다.

### 5. 파일 경로 — 명명 컨벤션 준수

- `V110__schedule_workspace_next_run_index.{sql,conf}` 는 `V<번호>__<snake_case_descriptor>`
  패턴과 `.conf`/`.sql` base name 동일 규칙을 그대로 따른다. `plan/complete/spec-draft-schedule-index.md`
  경로도 기존 `plan/complete/spec-draft-*` 명명과 겹치는 파일 없이 유일하다(`find plan -iname 'spec-draft-schedule-index*'` → 1건).

## 요약

target 이 실제로 새로 도입하는 식별자는 마이그레이션 버전 `V110` 과 인덱스명
`idx_schedule_workspace_next_run` 두 개뿐이며, 둘 다 저장소 전역 검색상 기존에 다른 의미로
점유된 바 없다. 추가된 `(trigger_id)` 표 행은 신규 식별자가 아니라 이미 구현된 V106 인덱스의
누락 문서화이고, 옛 인덱스명 `idx_schedule_next_run` 에 대한 잔여 참조도 전부 "대체된 과거
인덱스"라는 일관된 의미로만 쓰인다. `.conf` 설정 키·마이그레이션 파일 경로도 기존 컨벤션을
그대로 따라 신규 식별자 충돌 관점에서 이 target 은 깨끗하다.

## 위험도

NONE
