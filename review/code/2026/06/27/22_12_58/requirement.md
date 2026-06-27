# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [INFO] [SPEC-DRIFT] EIA-NF-06/EIA-NF-07 이 spec 본문에 미반영
- 위치: `spec/5-system/14-external-interaction-api.md §3.5`
- 상세: e2e 테스트(`execution-seq-allocator-load.e2e-spec.ts`)가 검증하는 두 NFR — "1000 events/s 부하 하 분산 monotonic 유일성(EIA-NF-06)"과 "single-instance latency median < 5ms(EIA-NF-07)" — 은 spec §3.5 NFR 표에 아직 존재하지 않는다(표는 EIA-NF-05 까지). 구현·e2e 검증(PR #730)이 spec 보다 앞서 있는 의도적 상태이며, `plan/complete/spec-draft-eia-seq-nfr.md`가 이를 정식 NFR 로 역류하는 spec 갱신 작업을 추적 중이다. 코드를 되돌릴 이유가 없고, spec 갱신이 남아있다.
- 제안: 코드 유지. `plan/complete/spec-draft-eia-seq-nfr.md`의 변경안대로 `spec/5-system/14-external-interaction-api.md §3.5` 표에 EIA-NF-06/07 두 행을 추가하고, §R7 말미에 정량 NFR 연결 문장을 보강하는 작업(project-planner 소관)을 완료해야 spec-impl 정합이 달성된다.

---

## 파일별 요구사항 충족 평가

### 파일 1: `codebase/backend/test/execution-seq-allocator-load.e2e-spec.ts`

세 가지 정리 모두 동작 변경 없이 의도에 부합한다.

- **P95_PERCENTILE 상수화**: `sorted[Math.floor(sorted.length * 0.95)]` → `sorted[Math.floor(sorted.length * P95_PERCENTILE)]`. 매직 넘버 제거. latency assert 는 여전히 `median` 으로만 수행되고 p95 는 로그 보고 전용이라 의미 변화 없음.
- **makeProvider 반환 타입**: `Pick<RedisConnectionProvider, 'getClient' | 'getClientOrNull'>` 명시. 실제 `RedisConnectionProvider` 의 두 메서드(`getClient`, `getClientOrNull`) 서명을 컴파일 타임에 검사하므로, 인터페이스 drift 시 컴파일 에러로 조기 탐지된다. 주입 시점의 `as unknown as RedisConnectionProvider` 이중 cast 는 클래스에 private 멤버(`logger`, `client`, `degradeWarned`, `configService`)가 있어 구조적 서브타입 매칭이 불가한 데 따른 필수 우회이며, 주석으로 명시돼 있다. `as never` 보다 안전한 패턴.
- **테스트 흐름 완전성**: 세 `it` 블록 모두 `try/finally` 안에서 `releaseBoth(executionId)` 를 호출해 실패 시에도 Redis 키 정리가 보장된다. `beforeAll` 은 Redis 가용성을 PING 으로 강제 확인해 degraded false-pass 를 차단한다. edge case(total 홀수) 는 `allocateConcurrentlyAcrossInstances` 내부에서 Error 로 명시적 거부.
- 에러 시나리오: `afterAll` 의 `?.quit().catch(() => undefined)` 패턴으로 정리 실패가 테스트 실패를 전파하지 않도록 처리됨.

### 파일 2: `docker-compose.e2e.yml`

- `x-redis-env: &redis-env` anchor 가 최상위에 정의되고 `backend-e2e` 와 `backend-e2e-runner` 모두 `<<: *redis-env` 로 병합한다. `x-` 접두 키는 Docker Compose 가 서비스로 해석하지 않는다.
- 두 서비스 모두 정확히 `REDIS_HOST: redis` / `REDIS_PORT: "6379"` 를 동일하게 사용했으므로, anchor 병합 후 값이 변경되지 않는다.
- 단일 진실 지점화 의도와 구현이 일치. 포트 변경 시 anchor 한 곳만 수정하면 되는 DRY 보장.

### 파일 3: `plan/complete/spec-draft-eia-seq-nfr.md`

- `spec_impact` 를 bare string(`spec/5-system/14-external-interaction-api.md`) → YAML list 로 정정.
- Gate C 테스트(`spec-plan-completion.test.ts`) 는 string 값이 `"none"` / `"없음"` 이 아닌 경우 실패(line 138-145). spec 경로 문자열은 배열 형식이어야만 path 존재 검사를 통과한다(line 127-135). 수정 후 형식은 규약에 완전히 부합.
- `spec/5-system/14-external-interaction-api.md` 는 실존하므로 dangling-ref 검사도 통과.
- 이 파일이 `complete/` 에 있어 Gate C 적용 대상이고(`started: 2026-06-27` ≥ cutoff `2026-06-04`), 회귀(#733 유입)를 정확히 수정했다.

### 파일 4: `plan/in-progress/eia-seq-load-spec-cleanup.md`

- frontmatter 필수 3 필드(`worktree`, `started`, `owner`) 모두 존재.
- `/ai-review` 체크박스가 미체크 상태 — 현재 리뷰 수행 중이므로 정상. 리뷰 완료 후 체크하고 `complete/` 이동이 이루어져야 한다.
- `spec_impact` 는 `in-progress` 단계에서 의무 아님 — Gate C 는 `complete/` 이동 시점에만 강제. 단, 이 plan 의 목적이 순수 코드 정리(spec 변경 없음)이므로, 완료 이동 시 `spec_impact: none` 선언이 필요하다.

---

## 요약

본 변경은 PR #730 리뷰 INFO 3건(매직 넘버 상수화, 타입 안전성 개선, YAML DRY)을 동작 변경 없이 정리하고, #733에서 유입된 Gate C 회귀(spec_impact bare string)를 수정한다. 네 파일 모두 의도한 기능을 완전히 구현하고 있으며, 에러 처리·엣지 케이스·반환값 경로도 문제없다. 유일한 발견사항은 EIA-NF-06/07 이 spec 본문에 아직 반영되지 않은 SPEC-DRIFT 상태(INFO)이며, 이는 본 변경의 결함이 아니라 `spec-draft-eia-seq-nfr.md` 계획으로 추적 중인 후속 spec 갱신 작업의 미완료 상태다. plan/in-progress 파일은 현재 리뷰 단계이므로 `/ai-review` 체크박스가 미체크인 것이 정상이며, 완료 이동 시 `spec_impact: none` 을 추가해야 한다.

## 위험도

NONE
