# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** `remove()` 가 단건 삭제에 DB 왕복 2회(SELECT + DELETE)를 쓴다 — 합칠 여지가 있으나 저빈도 관리 오퍼레이션이라 실익 작음
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` `remove()` (`const config = await this.findEntity(...)` 이후 `const { affected } = await this.repo.delete({ id, workspaceId })`)
  - 상세: 감사 payload 에 실을 `kind` 를 얻으려고 `findEntity`(SELECT, PK `id` 조회 — O(1))로 먼저 조회한 뒤, 별도로 `repo.delete({ id, workspaceId })`(DELETE, 역시 PK 조회 — O(1))를 호출한다. 두 쿼리 모두 PK(`id`, uuid PK)로 단일 행을 찾으므로 각각은 인덱스 스캔 O(1)이고 테이블 스캔이나 N+1 은 없다. 다만 논리적으로 하나의 삭제 작업에 DB 왕복이 (SELECT → DELETE → INSERT 감사) 3회 발생한다. 이는 **회귀가 아니다** — 종전 `repo.remove(config)` 도 `findEntity` SELECT 뒤에 별도 DELETE 를 발행했으므로 왕복 횟수는 diff 전후로 동일하다. Postgres 의 `DELETE ... RETURNING kind` 를 쓰면 findEntity 존재-확인용 SELECT 와 DELETE 를 한 왕복으로 합칠 수 있지만, 사용자 트리거형 관리 오퍼레이션(모델 설정 삭제)이라 처리량이 낮아 실질적 이득은 미미하다.
  - 제안: 현재로선 조치 불요. 형제 8건이 전부 채택한 동일 패턴이므로 이 자리만 바꾸면 비대칭이 생긴다 — 만약 최적화한다면 형제 전체를 함께 검토해야 한다.

- **[INFO]** `repo.delete({ id, workspaceId })` 의 복합 조건이 PK 단일 컬럼 룩업 위에 얹혀 있어 추가 인덱스 불필요
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` `remove()` — `const { affected } = await this.repo.delete({ id, workspaceId })`
  - 상세: `ModelConfig.id` 는 `@PrimaryGeneratedColumn('uuid')` (PK, 유니크). `id` 하나로 이미 최대 한 행만 매치되므로 `AND workspace_id = $2` 는 그 한 행에 대한 등치 비교 하나 추가일 뿐 — 별도의 `workspace_id` 인덱스나 복합 인덱스가 없어도 쿼리 플래너 비용에 실질적 영향이 없다. 대규모 `model_config` 테이블에서도 이 DELETE 는 여전히 O(1)이다.
  - 제안: 조치 불요.

- **[INFO]** 신규 e2e 테스트(`model-config-delete-concurrency.e2e-spec.ts`)의 락 유지 시간·타임아웃은 테스트 실행시간에만 영향, 프로덕션 경로 무관
  - 위치: `codebase/backend/test/model-config-delete-concurrency.e2e-spec.ts` — `SELECT id FROM model_config WHERE id = $1 FOR UPDATE` 유지 구간 + `Promise.race` 1500ms 대기 + 60_000ms 테스트 타임아웃
  - 상세: 이 파일은 테스트 전용 코드로 실제 서비스 경로의 락 경합을 인위적으로 만든다. 1.5초 대기 + 60초 타임아웃은 CI 실행시간에 누적되지만(형제 8개 파일이 각각 유사 구조) 단일 테스트 기준으로는 허용 범위. 형제 파일 8개가 거의 동일 구조로 존재해 CI 총 소요시간에 작은 누적 비용이 있으나, 이는 이미 다른 reviewer(maintainability, WARNING 3)가 "공용 헬퍼 추출 유예"로 지적·plan 에 결정 고정된 사항이며 성능 관점에서 별도 조치는 불필요.
  - 제안: 조치 불요 — maintainability WARNING 3(e2e 공용 헬퍼 추출)의 처분(9번째 PR 착수 시 결정)에 편승.

## 요약

이번 diff 의 핵심 변경(`repo.remove(config)` → `repo.delete({ id, workspaceId })`)은 알고리즘 복잡도·쿼리 횟수·메모리 사용 어느 측면에서도 diff 이전과 동일하거나 더 낫다. 두 쿼리(구·신 모두 `findEntity` SELECT + 삭제 오퍼레이션) 모두 PK(`id`, uuid) 단일 컬럼으로 최대 한 행만 매치되는 O(1) 조회이며, 반복문 내 호출이나 N+1 패턴, 불필요한 대규모 객체 적재, 캐싱 누락, 블로킹 동기 I/O, O(n²) 문자열 누적은 발견되지 않았다. 유일하게 언급할 만한 점은 논리적 삭제 1건에 DB 왕복이 3회(SELECT→DELETE→INSERT 감사) 발생한다는 것인데, 이는 diff 가 만든 회귀가 아니라 형제 8건이 공유하는 기존 패턴이고 처리량이 낮은 관리 오퍼레이션이라 실질적 영향이 없다. 신규 e2e 동시성 테스트는 프로덕션 경로에 영향을 주지 않으며 CI 소요시간 누적은 이미 별도 트랙(maintainability WARNING)에서 처리 중이다.

## 위험도
NONE
