# 요구사항(Requirement) 리뷰 결과

리뷰 대상: 재리뷰(20_45_51) W1 fix — `resolveParallelEngineFlag` read-once 테스트 2건 추가 + `sortByStartedAt` 잔존 주석 7곳 → `selectSortedNodeResults` 교체

---

## 발견사항

### [INFO] `execution-engine.service.spec.ts` 3087행 `sortByStartedAt` 잔존
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 3087행
- 상세: 이번 diff 에서 `sortByStartedAt` → `selectSortedNodeResults` 교체 대상으로 지정된 7곳(engine.service.ts 5곳 + use-execution-events.test.ts 2곳)은 모두 처리됐다. 그러나 spec.ts 내 3087행 `// sortByStartedAt 정렬 정합성을 유지하기 위해서 (timeline-ordering` 주석은 이번 diff 범위 밖으로 남아 있다. 이전 SUMMARY INFO 1 목록에도 포함되지 않았던 위치이므로 이번 사이클의 누락이 아닌 선행 사이클부터 존재하던 잔여다.
- 제안: 후속 grooming 에서 해당 주석도 `selectSortedNodeResults` 로 교체. 기능 동작 무관이므로 INFO 유지.

---

## 기능 완전성 점검

### 새 테스트 케이스 — `resolveParallelEngineFlag` read-once 가드 2건

**테스트 1 (cold 경로)**
```
parallelEngineFlagOnce = null  // 캐시 초기화
mockConfigService.get.mockClear()
resolveParallelEngineFlag() → 'v1'  // 첫 호출
resolveParallelEngineFlag() → 'v1'  // 두 번째 호출
expect(flagCalls).toHaveLength(1)   // configService.get 은 1회만
```
- `ConfigService` mock 은 `PARALLEL_ENGINE` 키에 대해 `return defaultValue` 분기를 탄다. `resolveParallelEngineFlag` 구현이 `configService.get<string>('PARALLEL_ENGINE', 'v1')` 로 호출하므로 default `'v1'` 반환 → `.toBe('v1')` 일치.
- `??=` 연산자에 의해 두 번째 호출은 `configService.get` 을 건너뜀 → `flagCalls.length === 1` 단언 성립.
- 구현과 단언이 정합적이다.

**테스트 2 (warm 경로)**
```
resolveParallelEngineFlag()  // warm-up (캐시 채움)
mockConfigService.get.mockClear()
resolveParallelEngineFlag()  // 캐시 hit
expect(flagCalls).toHaveLength(0)
```
- `beforeEach` 가 서비스 인스턴스를 재생성하므로 `parallelEngineFlagOnce` 는 `null` 로 시작. warm-up 호출 이후 `mockClear` 로 이전 기록 소거, 이후 호출에서 `configService.get` 미호출 단언.
- 구현과 단언이 정합적이다.

**엣지 케이스: 이전 테스트에 의한 warm 상태 오염 가능성**
- 테스트 1 은 `parallelEngineFlagOnce = null` 로 캐시를 명시적으로 초기화해 다른 테스트의 warm-up 영향을 제거한다. 이 처리는 올바르다.

---

## spec fidelity 점검

### `spec/4-nodes/1-logic/10-parallel.md` — `PARALLEL_ENGINE` read-once 규약
- spec 본문(line 14): "본 env 는 모듈 로드 시 1회 읽음, 변경은 인스턴스 재시작 시 반영"
- 구현(`resolveParallelEngineFlag`): `??=` lazy 초기화. 첫 호출 시 읽고 이후 캐시.
- 테스트: 두 케이스가 이 read-once 규약을 직접 단언함.
- 일치 여부: spec 규약 → 구현 → 테스트 모두 정합.

### `spec/5-system/4-execution-engine.md` §1.6 — `MAX_NODE_ITERATIONS` read-once 규약
- 기존 케이스(이번 diff 범위 밖)가 이미 `resolveMaxNodeIterations` 를 동일 패턴으로 가드하고 있어 대칭성이 확보됐다.

### `selectSortedNodeResults` 주석 교체 — spec 일치
- `spec/data-flow/4-file-storage.md`, `spec/5-system/4-execution-engine.md`, `spec/4-nodes/1-logic/10-parallel.md` 어디에도 `sortByStartedAt` 이름이 규범적으로 명시된 곳은 없다 (`selectSortedNodeResults` 로 이미 갱신됐거나 함수명 변경 자체는 리팩터 범위). 주석 교체는 기존 함수명(`sortByStartedAt`) 이 `selectSortedNodeResults` 로 renamed 된 이후의 내부 정합성 정리이므로 spec 위반이 아니다.

---

## TODO/FIXME 점검

변경된 코드 내 TODO, FIXME, HACK, XXX 주석 없음.

---

## 에러 시나리오

`resolveParallelEngineFlag` 는 `configService.get` 이 `undefined` 를 반환하는 경우 `'v1'` default 를 사용하므로 null 방어가 구현 레벨에서 처리된다. 테스트 mock 은 `PARALLEL_ENGINE` 키에 대해 `defaultValue`('v1') 를 반환하므로 이 경로도 간접 검증된다.

---

## 요약

이번 diff 는 전 사이클(20_45_51) WARNING W1 에 대한 수정 사항이다. `resolveParallelEngineFlag` read-once 캐시에 대한 테스트 2건(cold/warm)이 추가됐고, 두 케이스 모두 `ConfigService` mock 동작과 `??=` 구현 의미론이 일치하므로 단언이 유효하다. `sortByStartedAt` → `selectSortedNodeResults` 주석 교체 7곳도 모두 처리됐다. spec 규약(`PARALLEL_ENGINE` read-once 1회 읽기)과 구현 및 테스트 간 정합성이 확보됐다. 기능 완전성·비즈니스 로직·반환값 측면에서 누락이나 오류가 없다. 유일한 잔여 사항은 `execution-engine.service.spec.ts` 3087행의 `sortByStartedAt` 주석으로, 이번 diff 의 원래 목록에 포함되지 않았던 위치이며 INFO 수준이다.

---

## 위험도

NONE
