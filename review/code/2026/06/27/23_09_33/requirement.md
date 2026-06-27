# 요구사항(Requirement) 리뷰

## 발견사항

### [INFO] 파일 1·2 — `as never` → `as unknown as RedisConnectionProvider` 안전 타입 캐스트 교체

- 위치: `execution-seq-allocator.service.spec.ts` 전반(42, 53, 64, 75, 86, 101, 116행 변경), `execution-seq-allocator-load.e2e-spec.ts`(134, 137행)
- 상세: 변경 전에는 mock 객체를 `as never` 로 주입해 TypeScript 가 실제 `RedisConnectionProvider` 인터페이스 시그니처를 전혀 검사하지 못했다. 변경 후 `as unknown as RedisConnectionProvider` 로 교체되고 e2e 파일에서는 `makeProvider` 반환 타입을 `Pick<RedisConnectionProvider, 'getClient' | 'getClientOrNull'>` 로 명시해 메서드 시그니처가 실제 클래스와 drift 되면 컴파일 에러로 잡힌다.
- 제안: 기능 동작 변화 없음(순수 타입 안전성 향상). 단위 테스트 파일에서도 `makeRedisConn` 반환 타입을 Pick 형태로 명시하면 e2e 파일과 패턴이 완전히 통일되나, 현재도 `as unknown as RedisConnectionProvider` 단계에서 컴파일 오류 없이 메서드 접근이 확인되므로 필수는 아님.

---

### [INFO] `as never` 제거 완전성 확인

- 위치: 변경된 두 파일 전체
- 상세: `as never` 캐스트가 완전히 제거됐는지 확인. `execution-seq-allocator.service.spec.ts` 에서 `as never` 잔류 없음 확인. `execution-seq-allocator-load.e2e-spec.ts` 에서도 `as never` 는 주석 문장에만 존재("blind `as never` 대비 안전")하며 코드 캐스트로는 미사용 확인.

---

### [INFO] [SPEC-DRIFT] 파일 3 — `workspace-invitations-pruner` e2e 큐 목록 추가

- 위치: `test/system-status.e2e-spec.ts` `EXPECTED_QUEUE_NAMES` 배열(line 790)
- 상세: 코드 `MONITORED_QUEUES`(`system-status.constants.ts`) 에 `WORKSPACE_INVITATIONS_PRUNER_QUEUE` 가 등재되었고, e2e `EXPECTED_QUEUE_NAMES` 에도 `workspace-invitations-pruner` 가 추가됐다. 그러나 `spec/5-system/16-system-status-api.md` §1 의 모니터링 대상 큐 표에는 `workspace-invitations-pruner` 항목이 없다. `spec/data-flow/0-overview.md` §4 카탈로그 및 §108행 요약에는 이미 등재되어 있으므로 코드가 옳고 spec/16 §1 표가 낡은 상태다.
- 제안: **코드 유지 + spec 반영** — `spec/5-system/16-system-status-api.md` §1 모니터링 큐 표(`login-history-pruner` 행 아래)에 `workspace-invitations-pruner | system | 1 (기본) | repeatable cron (daily 04:00 KST) — 만료·미수락 workspace_invitation prune` 항목 추가(project-planner 위임).

---

### [INFO] 파일 2 — `LATENCY_WARMUP_COUNT` / `LATENCY_SAMPLE_COUNT` 모듈 상수 추출

- 위치: `test/execution-seq-allocator-load.e2e-spec.ts` 43~495행 (상수 신설) 및 latency 테스트 내부 인라인 변수(`WARMUP`, `SAMPLES`) 제거
- 상세: 테스트 3번("single-instance 발급 latency")에서 로컬 `const WARMUP = 20; const SAMPLES = 200;` 을 삭제하고 모듈 레벨 상수로 승격. 로그 메시지의 `SAMPLES` 참조도 `LATENCY_SAMPLE_COUNT` 로 교체. 기능 동작 동일, 가독성·중복 제거 목적.
- 제안: 추가 조치 불필요.

---

### [INFO] 파일 4 — plan frontmatter `spec_impact` 필드 추가

- 위치: `plan/complete/trigger-review-deferred-fixes.md` frontmatter
- 상세: W7 항목 완료에 따라 영향 받은 spec 문서 4건(`spec/5-system/12-webhook.md`, `spec/data-flow/0-overview.md`, `spec/data-flow/10-triggers.md`, `spec/data-flow/12-workspace.md`)을 `spec_impact` 로 명시. plan 라이프사이클·frontmatter 스키마와 일치하며 내용상 오류 없음.

---

### [INFO] 기능 완전성 — spec EIA §R7 / EIA-NF-06 / EIA-NF-07 충족 여부

- 위치: 파일 1(단위 테스트), 파일 2(e2e 부하 테스트)
- 상세:
  - EIA-NF-06 (분산 seq monotonic 1000 events/s) — e2e 테스트 1·2에서 `allocateConcurrentlyAcrossInstances` + `assertMonotonicUniqueness` 로 검증. `ALLOC_COUNT=1000`, 두 인스턴스 교차 발사, `expect(throughput).toBeGreaterThanOrEqual(1000)` 으로 기준 충족.
  - EIA-NF-07 (single-instance latency median < 5ms) — e2e 테스트 3에서 `LATENCY_WARMUP_COUNT=20`, `LATENCY_SAMPLE_COUNT=200` 표본으로 `expect(median).toBeLessThan(5)` 검증.
  - spec §R7 "execution 별 atomic INCR" 전제 — 단위 테스트에서 pipeline INCR, sliding TTL EXPIRE, degraded fallback, mirror high-water mark, release DEL, onModuleDestroy 전부 커버됨.
  - 모든 요구사항 ID(R7, EIA-NF-06, EIA-NF-07)에 해당하는 동작이 이번 변경 테스트에서 경로 변경 없이 그대로 유효함.
- 제안: 추가 조치 불필요.

---

## 요약

이번 변경은 크게 세 가지다. (1) 단위 테스트·e2e 부하 테스트에서 `as never` 타입 캐스트를 `as unknown as RedisConnectionProvider` 로 교체해 `RedisConnectionProvider` 인터페이스 drift 를 컴파일 타임에 잡을 수 있도록 안전성을 높였다. (2) e2e 부하 테스트의 인라인 매직 넘버를 모듈 레벨 상수로 추출해 가독성을 향상시켰다. (3) system-status e2e `EXPECTED_QUEUE_NAMES` 에 `workspace-invitations-pruner` 를 추가해 코드 `MONITORED_QUEUES` 의 실제 상태와 일치시켰다. 기능 동작 자체를 바꾸는 변경이 없어 spec EIA §R7 / EIA-NF-06 / EIA-NF-07 의 요구사항은 이전과 동일하게 충족된다. 단 `spec/5-system/16-system-status-api.md` §1 큐 표에 `workspace-invitations-pruner` 항목이 누락되어 있어 spec 갱신이 필요하다 (코드가 정합하고 spec 이 낡은 SPEC-DRIFT).

## 위험도

NONE
