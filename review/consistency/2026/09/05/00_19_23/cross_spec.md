# Cross-Spec 일관성 검토 — schedule 인덱스 전략 정정

## 대상

- `spec/1-data-model.md` §3 인덱스 전략 (Schedule 행) + `## Rationale`
- `spec/data-flow/10-triggers.md` §2.1 Schema 매핑 (`schedule` 발사 후 UPDATE 행)
- 동반 구현: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.{sql,conf}`

변경 내용: Schedule 테이블의 미사용 부분 인덱스 `(next_run_at, is_active) WHERE is_active`
를 `(workspace_id, next_run_at)` 로 교체하고, 이전에 문서화가 누락돼 있던 기존 인덱스
`(trigger_id)` (V106, 이미 구현되어 있던 것) 를 §3 표에 신규 등재. 순수 DB 인덱스 전략
변경으로, 엔티티 필드·API 계약·상태 머신·RBAC·계층 책임에는 손대지 않는다.

## 발견사항

교차 영역 충돌 없음. 확인한 항목:

- **데이터 모델 충돌** — 없음. 이번 변경은 인덱스(물리 접근 경로)만 바꾸며 `Schedule` 엔티티의
  필드·타입·nullable 여부는 그대로다. `spec/2-navigation/3-schedule.md:58`,
  `spec/2-navigation/2-trigger-list.md:100` 이 서술하는 `nextRunAt`(계산 불가 시 `-` 표시,
  발사와 무관한 정보성 값) 의미도 변경 전후 동일하며 이번 diff 가 그 서술을 건드리지 않았다.
- **API 계약 충돌** — 없음. `GET /api/schedules` 의 정렬 파라미터(`sort=next_run_at`,
  기본 `created_at`)·응답 shape 변경 없음. 인덱스는 같은 쿼리를 더 빠르게 서빙할 뿐이다.
  신규 e2e(`schedule-trigger.e2e-spec.ts` 테스트 J)도 API 응답 shape 이 아니라 정렬 결과·
  워크스페이스 격리만 검증한다.
- **요구사항 ID 충돌** — 새로 부여된 요구사항 ID 없음(순수 인덱스 변경, 요구사항 ID 부여
  대상 아님).
- **상태 전이 충돌** — 없음. `schedule` 의 `last_run_at`/`next_run_at` UPDATE 는 "발사
  트리거가 아니라 정보성 재계산" 이라는 기존 서술이 `1-data-model.md`·`10-triggers.md`
  양쪽에서 문구까지 일치하게 유지된다("**발사 경로가 아니다**" / "process() 정보성 재계산;
  발사 트리거 아님").
- **권한·RBAC 모델 충돌** — 없음. 워크스페이스 격리는 기존 `WHERE workspace_id = ?` 술어를
  그대로 인덱스가 가속할 뿐 인가 로직 변경 없음.
- **계층 책임 충돌** — 없음. 마이그레이션(DB 계층)·spec 문서(데이터 모델 계층) 동반 갱신이
  같은 PR 안에서 이뤄져 이 저장소가 반복 지적해 온 "한쪽만 고치고 미러를 놓치는" drift 패턴을
  재현하지 않는다.

### 부가 확인 (참고, 문제 아님)

- **미러 정합**: `1-data-model.md` 와 `data-flow/10-triggers.md` 두 문서가 새 인덱스명·
  컬럼 순서·"부분 인덱스가 걸리지 않는 이유(`is_active` 미사용)" 서술까지 일치한다. 저장소
  전체에서 이 인덱스를 언급하는 3곳(두 spec + 실물 DDL `V002__indexes.sql:30`(제거 대상)/
  `V110__...sql`(신규)) 을 모두 grep 으로 확인했고 stale 참조는 없었다.
  `plan/complete/spec-draft-schedule-index.md` 자체가 이 전수 확인을 §5 에 기록해 두었다.
- **마이그레이션 버전 정책**: `codebase/backend/migrations/` 의 `V100`~`V110` 나열 결과
  연속·중복 없음(`V110` 이 gap 없이 다음 정수). `spec/conventions/migrations.md` §1/§2 의
  명명·버전 정책과 상충하지 않는다.
- **선례 인용의 정확성**: Rationale 이 인용하는 `#1277`(등재)·`#1278`(전제 교체)·V106 선례는
  `git log`/plan 문서로 대조 가능하며 실측 표(EXPLAIN 결과)를 함께 실어 근거를 조작하지 않았다.

## 요약

이번 target 은 `Schedule` 테이블의 물리 인덱스 하나를 교체하고 기존에 문서 누락 상태였던
인덱스 하나를 등재하는, 범위가 명확한 DB 최적화 spec 변경이다. 엔티티 정의·API 계약·요구사항
ID·상태 머신·RBAC·계층 책임 어느 축에서도 다른 spec 영역과 모순되지 않으며, 두 미러 문서(§3
데이터 모델 / §2.1 data-flow)가 컬럼 순서·용도·"발사 경로 아님" 서술까지 일치해 drift 가
없다. 마이그레이션 버전 번호도 gap 없이 이어진다.

## 위험도
NONE
