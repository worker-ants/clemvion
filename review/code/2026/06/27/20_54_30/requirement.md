# 요구사항(Requirement) Review

## 발견사항

### **[INFO]** `Math.min/max` spread 가 N=1000 에서 안전함 — 확인
- 위치: `execution-seq-allocator-load.e2e-spec.ts` line 156, 178–180, 361
- 상세: `Math.min(...seqs)` / `Math.max(...seqs)` 에 N=1000 을 펼치는 spread operator 는 V8 stack 한계(~65536 인자)에 비해 충분히 안전하다. N 이 향후 크게 증가하는 경우에만 재검토 필요.
- 제안: 현재 N=1000 에서는 문제 없음. 참고로 두면 충분.

### **[INFO]** `releaseBoth` 의 asymmetric 사용 (테스트 3)
- 위치: `execution-seq-allocator-load.e2e-spec.ts` line 228–230, 136–139
- 상세: 세 번째 테스트(`latency`)는 `allocA` 만 사용하지만 finally 에서 `releaseBoth` 를 호출한다. `allocB.release(executionId)` 는 `fallbackCounters` 에 해당 executionId 가 없어 Map.delete 가 no-op 이 되고, Redis DEL 은 이미 삭제되거나 존재하지 않는 키를 삭제하는 멱등 연산이라 오류가 발생하지 않는다. 기능상 안전하다.
- 제안: 현재 구현에서 문제 없음. 의도적 패턴으로 보임(lifecycle 계약 일관성).

### **[INFO]** median 계산이 짝수 표본에 대해 상위-중간값을 사용
- 위치: `execution-seq-allocator-load.e2e-spec.ts` line 211 (`sorted[Math.floor(sorted.length / 2)]`)
- 상세: SAMPLES=200 이면 true median 은 `(sorted[99] + sorted[100]) / 2` 이나, 코드는 `sorted[100]` (upper-middle) 만 사용한다. 이는 실제 중앙값보다 약간 높게 계산되어 assert `< 5ms` 가 더 보수적(엄격)으로 작동한다. 측정 오판이 아니라 latency 회귀 가드 측면에서 더 안전한 방향이다.
- 제안: 변경 불요. 현재 방식이 보수적(안전) 방향이며 latency 회귀 검출에 유리.

### **[INFO]** `REDIS_HOST` 기본값이 `'redis'` — Docker 네트워크 한정
- 위치: `execution-seq-allocator-load.e2e-spec.ts` line 67; `docker-compose.e2e.yml` line 459-460
- 상세: `REDIS_HOST ?? 'redis'` 기본값은 Docker e2e 컨테이너 network 내에서는 정확히 동작한다. `docker-compose.e2e.yml` 에 `REDIS_HOST: redis` / `REDIS_PORT: "6379"` 명시로 로컬 개발에서도 동일 기본값과 일치한다. 로컬에서 포트가 다를 경우 `REDIS_PORT` 환경변수로 override 가능.
- 제안: 현재 구성 적절. 로컬 바로 실행 시 환경변수 주석으로 안내된 사항이 명확하다.

### **[INFO] [SPEC-DRIFT]** spec §R7 에 1000 events/s / < 5ms latency 기준이 명시되지 않음
- 위치: 테스트 line 183–190, 224–227; `spec/5-system/14-external-interaction-api.md §R7`
- 상세: spec §R7 은 "seq 를 동일 monotonic counter 로 공유한다" 는 설계 결정만 서술하며, 분산 부하 검증 기준(1000 events/s throughput, latency < 5ms)을 수치로 정의하지 않는다. 이 기준치는 `plan/in-progress/eia-distributed-seq-load-verify.md` 의 "수용 기준 #3" / "criterion" 주석에 코드 내 주석(`# criterion: 1000 events/s`, `# criterion: < 5ms`)으로만 존재한다. 코드 구현이 합리적이고 의도적이며 되돌리는 것이 오답이다 — spec 갱신이 필요하다.
- 제안: **코드 유지 + spec 갱신**. `spec/5-system/14-external-interaction-api.md §R7` 하단 또는 `§3.5 비기능 요구사항` 표에 `EIA-NF-06` 항목으로 "분산 seq 발급 처리량 ≥ 1000 events/s (실 Redis e2e 검증)" 과 `EIA-NF-07` "seq 발급 단일 인스턴스 latency median < 5ms" 를 추가 기재하는 것이 spec-impl 일관성을 회복한다. 반영 대상 spec 위치: `/Volumes/project/private/clemvion/.claude/worktrees/eia-seq-load-verify-6f5ebc/spec/5-system/14-external-interaction-api.md` §3.5.

### **[INFO]** `beforeAll` 에서 PING fail 시 allocator 초기화를 건너뜀 — 안전한 실패
- 위치: `execution-seq-allocator-load.e2e-spec.ts` line 117–119, 124–125
- 상세: `beforeAll` 에서 Redis PING assert 가 실패하면 jest 가 `beforeAll` 실패로 처리해 해당 describe 의 모든 테스트를 skip(not run)하거나 fail 로 표기한다. 이는 "Redis 불가용 시 false-pass" 를 막기 위한 명시적 설계이며, 파일 주석에도 기술된 의도적 동작이다.
- 제안: 현재 구현이 의도와 일치. 변경 불요.

### **[INFO]** 테스트 간 Redis 키 격리 — UUID prefix 로 충분
- 위치: `execution-seq-allocator-load.e2e-spec.ts` line 142 (`load-${randomUUID()}`), line 165 (`tput-${randomUUID()}`), line 197 (`lat-${randomUUID()}`)
- 상세: 각 테스트가 고유 UUID 를 prefix 한 `executionId` 를 사용하므로 테스트 간 Redis 키 오염이 없다. `finally` 의 `releaseBoth` 가 DEL 을 best-effort 로 실행하므로 정상 종료 시 키가 정리된다. 60분 TTL 이 DEL 에 실패해도 24시간 내 자동 회수된다.
- 제안: 현재 구현 적절.

---

## 기능 완전성 평가

**Plan 에 명시된 작업 단위 3개가 모두 구현됨:**
1. 두 인스턴스 동시 `next()` 같은 키 → seq 중복·역전 0 assert (테스트 1, 완료)
2. 1000 events/s 시 seq 단조 증가 보장 측정 (테스트 2, 완료)
3. single-instance latency < 5ms 마이크로벤치 (테스트 3, 완료)

**`docker-compose.e2e.yml` 변경** (`REDIS_HOST`, `REDIS_PORT` 추가)은 plan 의 "runner 에 `REDIS_HOST`/`REDIS_PORT` 명시만 추가" 항목을 정확히 충족한다.

**Spec EIA §R7 의 핵심 요건인 "execution 별 atomic INCR 로 발급되는 분산 monotonic seq" 가 실 Redis 위에서 경험적으로 검증됨.** WebSocket §2.2 의 `seq` 설명("Redis 미가용 시 in-memory per-instance counter 로 degrade")에 맞춰 `beforeAll` 에서 실 Redis 가용성을 강제 확인함으로써 degraded false-pass 를 구조적으로 차단하고 있다.

---

## 요약

두 파일의 변경 모두 plan(`eia-distributed-seq-load-verify.md`)이 정의한 검증 항목 3개를 빠짐 없이 구현하며, 의도한 기능을 완전히 충족한다. 엣지 케이스(Redis 불가용 → beforeAll 실패, 키 충돌 → UUID prefix, DEL 멱등성) 처리가 모두 적절하다. TODO/FIXME 없음. 반환값은 모든 경로에서 명확하다. `releaseBoth` 의 비대칭 사용은 멱등성으로 안전하다. 테스트가 직접 참조하는 spec 위치(§R7, §2.2)에 throughput/latency 수치 기준이 명시되지 않은 점은 spec 갱신이 필요한 SPEC-DRIFT (코드 버그가 아님)이며, 외에 코드 수정이 필요한 발견사항은 없다.

---

## 위험도

NONE
