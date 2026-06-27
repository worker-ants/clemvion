# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** `Math.min(...seqs)` / `Math.max(...seqs)` — 스프레드 전개로 인한 콜 스택 한계
  - 위치: `execution-seq-allocator-load.e2e-spec.ts` 라인 149, 150, 174
  - 상세: N=1000 배열에 `Math.min(...seqs)` / `Math.max(...seqs)` 를 사용하면 스프레드 연산자가 배열을 함수 인수 목록으로 전개한다. V8 의 함수 인수 스택 한계(통상 ~65536) 대비 N=1000 은 안전하지만, N 을 키울 경우 `RangeError: Maximum call stack size exceeded` 로 테스트가 조용히 실패할 수 있다. `seqs.reduce((a,b) => a < b ? a : b, Infinity)` 또는 `Math.min.apply(null, seqs)` 보다 `for` 루프 단순 순회가 O(N) 동일하면서 스택 안전하다.
  - 제안: `Math.min(...seqs)` → `seqs.reduce((a, b) => Math.min(a, b), Infinity)` 로 교체. N 을 증가시키는 미래 변경에 방어적.

- **[INFO]** latency 측정 루프 — 직렬 await 220회(WARMUP 20 + SAMPLES 200) 로 인한 총 수행 시간
  - 위치: `execution-seq-allocator-load.e2e-spec.ts` 라인 196–202
  - 상세: 워밍업 20회 + 샘플 200회를 `for await` 직렬 실행하는 것은 **의도된 설계** — 개별 latency 를 정확히 측정하려면 직렬이어야 한다. 그러나 median ~0.08ms × 220 = ~18ms 이므로 실제로는 매우 빠르고 성능 문제는 없다. 네트워크 레이턴시가 크게 높아지는 환경(WAN Redis 등)에서는 SAMPLES 를 줄이는 것을 고려할 수 있지만, 현 도커망 환경에서는 무관하다.
  - 제안: 현 구현 유지. 다만 주석에 "직렬 측정 의도"가 이미 명시돼 있어 오해 소지 없음.

- **[INFO]** `new Set(seqs)` 중복 생성 — throughput 테스트에서 Set 재할당
  - 위치: `execution-seq-allocator-load.e2e-spec.ts` 라인 173
  - 상세: `expect(new Set(seqs).size).toBe(N)` 가 인라인으로 Set 을 생성한다. 동일 `seqs` 배열에 대해 Set 변환 + `Math.max` 를 각각 별도로 순회한다. 테스트 코드이고 N=1000 이므로 실질 영향 없음. 가독성 목적으로 `const uniqueSet = new Set(seqs)` 를 추출하면 재사용 가능하다.
  - 제안: 선택적 정리 — 동일 패턴이 첫 번째 테스트(라인 146–147)에서는 `const unique = new Set(seqs)` 로 이미 변수 추출돼 있으나 throughput 테스트(라인 173)에서는 인라인이다. 일관성 차원에서 통일하면 충분.

- **[INFO]** 두 테스트에서 `allocB.release(executionId)` 누락
  - 위치: `execution-seq-allocator-load.e2e-spec.ts` 라인 151–153, 185–187
  - 상세: 첫 번째·두 번째 테스트의 `finally` 블록에서 `allocA.release(executionId)` 만 호출하고 `allocB.release(executionId)` 를 호출하지 않는다. `ExecutionSeqAllocator` 가 내부적으로 executionId 별 인메모리 상태(Map 등)를 보유하는 경우, allocB 의 해당 키가 테스트 종료 후에도 메모리에 잔존할 수 있다. 각 테스트는 별도 executionId(randomUUID)를 사용하므로 교차 오염은 없지만, allocator 내부 Map 누수(메모리 누수)의 여지가 있다.
  - 제안: `finally` 블록을 `allocA.release(executionId); allocB.release(executionId);` 로 보완. 또는 `Promise.all([allocA.release(executionId), allocB.release(executionId)])` 패턴으로 대칭 정리.

## 요약

본 변경은 e2e 테스트 파일과 docker-compose 환경 변수 추가만으로 구성되며 프로덕션 코드를 건드리지 않는다. 성능 관점에서 중대한 문제는 없다. 발견된 항목 중 `allocB.release()` 누락(INFO)은 allocator 내부 구현에 따라 테스트 프로세스 내 메모리 잔존을 유발할 수 있으므로 보완을 권장한다. `Math.min/max` 스프레드 패턴은 N=1000 에서는 안전하나 N 증가 시 스택 한계 위험이 있어 방어적 수정을 권장한다. 나머지는 테스트 코드 특성상 실질 영향이 없는 스타일 수준이다.

## 위험도

LOW
