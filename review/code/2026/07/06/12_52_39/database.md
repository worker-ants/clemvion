# 데이터베이스 리뷰 — schedules findAll triggerId 필터

대상: `codebase/backend/src/modules/schedules/schedules.service.ts` `findAll` (commit 5b52b8b96, `git diff origin/main...HEAD`)

## 발견사항

결함 없음. 아래는 확인한 항목과 근거.

- **[INFO]** `leftJoinAndSelect('s.trigger','t')` + `andWhere('t.id = :triggerId', …)` 조합의 의미
  - 위치: `schedules.service.ts:81-84`
  - 상세: LEFT JOIN 뒤 조인된 컬럼(t.id)에 대해 `WHERE`/`andWhere` 조건을 걸면 `t.id IS NULL`(비매치 row)이 자동 배제되어 사실상 INNER JOIN 필터로 동작한다. `schedule.trigger_id`는 엔티티상 NOT NULL FK(`@Column({ name: 'trigger_id' })`, nullable 미지정 → not null, `ManyToOne` cascade 참조)이므로 애초에 "연결 트리거가 없는 스케줄"은 존재하지 않는다. 즉 이 필터는 트리거 삭제로 CASCADE 삭제된 경우를 제외하면 항상 매치되고, 코드 주석("연결 트리거가 없는 스케줄은 t.id 가 null 이라 자연히 제외")은 방어적으로 정확하다 — LEFT JOIN 을 쓰고 있어 트리거가 실제로 없는 예외적 데이터 상태에서도 크래시 없이 안전하게 빠진다.
  - 결론: 의도대로 동작. 문제 없음.

- **[INFO]** 인덱스 커버리지
  - 위치: `codebase/backend/migrations/V106__schedule_trigger_id_index.sql`, `codebase/backend/src/modules/schedules/entities/schedule.entity.ts`
  - 상세: `schedule.trigger_id`에는 이미 `idx_schedule_trigger_id` (V106, `CREATE INDEX CONCURRENTLY`)가 존재한다 — 본 PR 이전에 V-10(#818) 작업에서 트리거 목록 enrichment hot-path 용으로 추가된 것. `trigger_id`는 "트리거당 스케줄 1건(1:1)"이라 선택도가 매우 높아 `t.id = :triggerId` 필터가 이 인덱스를 통해 효율적으로 처리된다. `workspace_id` 단독 인덱스는 없으나(V001/V002 어디에도 없음, 기존 갭), 이번 필터는 `trigger_id`(신규 조건, 매우 선택적)로 접근 후 `workspace_id`는 residual filter로 처리되므로 플래너가 index scan 경로를 취할 가능성이 높다. `search`(t.name ILIKE) 조건과 동시 사용 시에도 `trigger_id` 등호 조건이 있으면 그 인덱스가 우선 사용될 것으로 예상된다. 신규 마이그레이션 불필요.
  - 결론: 인덱스 이미 충족.

- **[INFO]** N+1 여부
  - 위치: `schedules.service.ts:70-97`
  - 상세: `leftJoinAndSelect`로 `trigger`, `trigger.workflow`까지 단일 쿼리에 포함되고, 반복문 내 개별 쿼리 없음. `getCount()` → `getMany()` 두 번의 쿼리가 발생하나 이는 페이지네이션의 표준 패턴(1回 count + 1回 data)이며 N(row 개수)에 비례하지 않는다.
  - 결론: 문제 없음.

- **[INFO]** getCount / getMany 필터 공유 및 페이지네이션 정확성
  - 위치: `schedules.service.ts:92-97`
  - 상세: 동일한 `qb` 인스턴스에 `where`/`andWhere`(workspaceId, search, triggerId)를 누적한 뒤 `qb.getCount()`를 먼저 호출하고, 이어서 같은 `qb`에 `.offset().limit().getMany()`를 체이닝한다. TypeORM 의 `getCount()`는 내부적으로 `orderBy`/`skip`/`take` 를 제거하고 COUNT 쿼리를 실행하지만 `where`/`andWhere` 조건(및 JOIN)은 그대로 유지하므로, `triggerId` 필터가 총 개수와 실제 반환 데이터 모두에 동일하게 적용된다. `totalItems`와 `data`가 같은 필터 기준으로 일관되어 페이지네이션이 정확하다.
  - 결론: 문제 없음.

- **[INFO]** 파라미터 바인딩(SQL 인젝션)
  - 위치: `schedules.service.ts:84`
  - 상세: `t.id = :triggerId` 형태로 named parameter 바인딩 사용, 문자열 concat 없음. DTO 단에서도 `@IsUUID()` 검증(`query-schedule.dto.ts`)이 선행되어 형식이 UUID 가 아니면 컨트롤러 단에서 400 으로 차단된다(class-validator).
  - 결론: 문제 없음.

- **[INFO]** 트랜잭션/커넥션 관리
  - 상세: 단순 조회(SELECT) 경로이며 쓰기 작업이나 다중 스텝 정합성 요구가 없어 트랜잭션 불필요. Repository 기반 `createQueryBuilder`는 NestJS TypeORM 모듈이 관리하는 풀에서 커넥션을 가져오며 쿼리 완료 후 자동 반환된다. 별도 관리 코드 불필요.
  - 결론: 문제 없음.

## 요약

이번 변경은 `schedules.findAll`에 옵셔널 `triggerId` 단일 필터를 추가한 것으로, LEFT JOIN 컬럼에 대한 등호 조건이 사실상 INNER 필터로 동작하는 점은 `trigger_id`가 NOT NULL FK 라는 스키마 제약과 부합해 의도대로 안전하다. 해당 컬럼에는 이미 이전 작업(V106)에서 인덱스가 존재해 신규 hot-path 에도 성능 갭이 없으며, `getCount`/`getMany`가 동일 QueryBuilder 인스턴스의 조건을 공유해 페이지네이션 정합성도 유지된다. N+1, SQL 인젝션, 트랜잭션/커넥션 관리 측면에서도 지적 사항이 없다.

## 위험도

NONE
