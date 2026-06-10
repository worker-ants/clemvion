# 유지보수성(Maintainability) 리뷰 결과

리뷰 대상: 재리뷰 세션 (20_45_51 W1 fix) — resolveParallelEngineFlag read-once 테스트 2건 추가 + sortByStartedAt 주석 교체 7곳 + review 산출물 신규 생성

---

## 발견사항

### [INFO] 테스트 내 `type FlagSubject` 로컬 타입 앨리어스 중복 선언
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 추가 블록, `it` 콜백 2개 (각각 독립 선언)
- 상세: `type FlagSubject = { resolveParallelEngineFlag: () => string }` 가 두 `it` 테스트 케이스 내부에 각각 독립적으로 선언되어 동일 타입 정의가 두 번 반복된다. 현재 파일 규모(13,000+ 라인)에서는 이 수준의 중복이 noise로 작용하지 않지만, 패턴이 누적되면 describe 블록 상단에 공유 타입으로 추출하는 것이 더 깔끔하다.
- 제안: `describe` 블록 또는 it 상위 레벨에 `type FlagSubject = { resolveParallelEngineFlag: () => string }` 를 한 번만 선언하고 두 케이스에서 공유한다.

---

### [INFO] 첫 번째 테스트에서 `async` 키워드 불필요
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 37행 — `it('resolveParallelEngineFlag: configService.get 이 PARALLEL_ENGINE 키로 1회만 호출된다 (read-once)', async () => {`
- 상세: 해당 테스트 바디에 `await` 가 없어 `async` 키워드가 의미 없이 선언되어 있다. 동일 블록 내 두 번째 테스트(`55행`)도 `async` 이지만 역시 `await` 를 사용하지 않는다. 파일 내 다른 케이스들은 `await` 없이 순수 동기 테스트는 `async` 를 붙이지 않거나, 실제 async 동작이 있을 때만 사용하는 패턴이 혼재한다.
- 제안: `await` 없는 순수 동기 테스트에서 `async` 를 제거해 의도를 명확히 한다. 동작에는 영향이 없지만 읽는 사람이 비동기 동작을 기대하고 코드를 살펴보게 만드는 혼선이 있다.

---

### [INFO] `sortByStartedAt` → `selectSortedNodeResults` 주석 교체 — 완결성 확인
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 4004, 4177, 5581, 5907, 6572행; `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts` 291, 400행 (총 7곳)
- 상세: 이번 diff 에서 7곳의 주석이 `sortByStartedAt` → `selectSortedNodeResults` 로 교체되어 이전 리뷰(20_45_51) INFO 1 조치가 완료됐다. 변경 방향이 올바르다. 나머지 코드베이스에 `sortByStartedAt` 잔존 여부는 이번 diff 범위에서 추가로 발견되지 않는다.
- 제안: 없음. 조치 완료 확인.

---

### [INFO] `parallelEngineFlagOnce` 직접 null 주입 — private 상태 직접 조작 패턴
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 39-41행
- 상세: `(service as unknown as { parallelEngineFlagOnce: string | null }).parallelEngineFlagOnce = null` 로 private 필드를 직접 리셋한다. 기존 `MAX_NODE_ITERATIONS` read-once 테스트도 동일 패턴(`maxNodeIterationsOnce = null`)을 사용하므로 파일 내 일관성은 있다. 단, 이 패턴은 내부 구현 세부사항(필드 이름)에 직접 의존해 리팩터링 시 테스트가 조용히 깨질 수 있다. 실용적 대안으로 `resetCacheForTesting()` 같은 패키지-internal 헬퍼 메서드를 제공하는 방식이 있으나, 현재 코드베이스 규모와 패턴 일관성을 감안하면 YAGNI 범주다.
- 제안: 현 패턴 유지 가능. 중기적으로 read-once 캐시가 늘어나면 `resetAllCachesForTesting()` 헬퍼를 한 곳에 집약하는 리팩터를 고려한다.

---

### [INFO] review 산출물 파일 — 유지보수성 관점 검토 불필요
- 위치: `review/code/2026/06/10/20_45_51/` 하위 신규 파일들 (RESOLUTION.md, SUMMARY.md, _retry_state.json, api_contract.md, architecture.md, concurrency.md, database.md, dependency.md, documentation.md, maintainability.md)
- 상세: 해당 파일들은 리뷰 산출물이자 이력 문서로 코드 실행에 영향을 주지 않는다. 유지보수성 관점의 평가 대상이 아님.
- 제안: 없음.

---

## 요약

이번 diff 의 실질적 코드 변경은 두 가지다: (1) `resolveParallelEngineFlag` read-once 캐시에 대한 테스트 케이스 2건 추가(이전 리뷰 W1 조치), (2) 7곳 주석에서 `sortByStartedAt` → `selectSortedNodeResults` 교체(INFO 1 조치). 두 변경 모두 의도가 명확하고 기존 패턴을 일관성 있게 따른다. 유지보수성 관점의 주요 지적사항은 세 가지 INFO로, 기능 동작에 영향이 없다: 두 테스트 케이스에서 `type FlagSubject` 타입 앨리어스가 중복 선언되는 점, `async` 키워드가 `await` 없이 선언된 점, private 필드 직접 null 주입 패턴의 장기적 취약성이다. Critical/Warning 수준 발견사항은 없으며 전반적으로 유지보수성이 양호하다.

---

## 위험도

NONE
