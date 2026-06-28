# 테스트(Testing) 리뷰 결과

## 발견사항

### [INFO] `makeAllocatorForTtl` 헬퍼 추출 — 가독성·중복 제거 개선
- 위치: diff +36~+40, `seqKeyTtlSeconds — EXECUTION_SEQ_TTL_SECONDS env 분기` describe 블록
- 상세: 세 TTL 테스트 케이스 모두에서 반복되던 `new ExecutionSeqAllocator(makeRedisConn() as ...)` 인라인 생성 코드를 `makeAllocatorForTtl()` 로 추출함. 코드량이 줄고 의도("TTL 분기 검증용, redis stub 불필요")가 주석으로 명시돼 가독성이 높아짐. 기능 변경 없음.

### [INFO] 커버리지 갭 — `sanitize()` 경계값 테스트 부재
- 위치: `execution-seq-allocator.service.ts` L152-157 (`sanitize` 메서드)
- 상세: `sanitize` 는 로그 인젝션 방지 목적의 private static 메서드로, CR/LF/탭 치환 + 128자 truncation 로직이 있다. 현재 테스트 스위트 어디에도 128자 초과 executionId, CR/LF/탭 포함 ID에 대한 경계 검증이 없다. 악의적 입력이 로그에 노출될 때의 동작이 회귀 테스트로 보호되지 않음.
- 제안: `it('sanitize — 128자 초과 + CR/LF 제거')` 테스트를 추가하거나, 테스트 내에서 특수 문자가 포함된 executionId 로 `alloc.next()`를 호출해 경고 로그 메시지가 올바르게 처리되는지 간접 검증 추가를 고려.

### [INFO] DEL 실패 swallow 경로(release) 테스트 미비
- 위치: `execution-seq-allocator.service.ts` L135 (`client.del(...).catch(...)`)
- 상세: `release()` 의 `del` 이 reject 될 경우 경고 로그만 남기고 삼켜지는 코드 경로가 있으나 해당 분기를 테스트하는 케이스가 없다. 현재 테스트는 `del`이 성공하는 경우만 검증한다.
- 제안: `makeRedis({ del: jest.fn().mockRejectedValue(new Error('DEL failed')) })` 형태로 DEL 실패 시 `release()`가 throw 없이 완료됨을 검증하는 케이스 추가 고려.

### [INFO] `pipeline.exec()` 가 `null` 또는 빈 배열 반환하는 엣지 케이스 미검증
- 위치: `execution-seq-allocator.service.ts` L87-89 (`results?.[0]` null 체크)
- 상세: 구현에는 `results?.[0]`이 없을 때 throw 해 degraded fallback 으로 전환하는 경로가 있으나, 이 경로를 직접 커버하는 테스트가 없다. `exec()` 가 `null`을 반환하는 시나리오를 명시적으로 검증하면 null-guard 회귀를 방지할 수 있다.
- 제안: `b.exec = jest.fn(async () => null)` 형태의 케이스를 추가해 degraded fallback 으로 연착륙함을 확인.

### [INFO] 테스트 격리 — `process.env` 복원 패턴 정상
- 위치: `seqKeyTtlSeconds` describe 블록 L358-362 (`afterEach`)
- 상세: `afterEach` 에서 원래 ENV 값을 복원하는 패턴이 올바르게 구현돼 있어 다른 테스트로 누출되지 않는다. 변경 전후 동일하게 유지되고 있어 회귀 없음.

## 요약

이번 변경은 순수 리팩터링으로, TTL 분기 검증 세 케이스에서 중복되던 allocator 생성 코드를 `makeAllocatorForTtl()` 헬퍼로 추출한 것이다. 기능 추가·삭제 없이 가독성을 높이고 주석으로 의도를 명시했으며, `afterEach` 기반 env 복원으로 테스트 격리도 유지된다. 전반적인 테스트 스위트는 Redis 정상·장애·동시성·release·onModuleDestroy 등 주요 경로를 충분히 커버하고 있다. 다만 `sanitize()` 경계값, DEL 실패 swallow, `pipeline.exec()` null 반환 경로는 현재 커버되지 않아 향후 보강 여지가 있으나, 이번 변경의 범위와 무관한 기존 갭이므로 차단 이슈는 아니다.

## 위험도

NONE
