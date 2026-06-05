# 보안(Security) 리뷰

리뷰 대상 커밋: `b6dda4d9` — feat(execution-engine): PR-A2b — information_extractor 멀티턴 checkpoint 재개 확장

---

## 발견사항

### [INFO] `partialResult` checkpoint 필드 — 비정형 사용자 데이터 JSONB 영속
- 위치: `execution-engine.service.ts` diff, `buildResumeCheckpoint` / `buildRetryReentryState` 신규 필드 (`partialResult: Record<string, unknown>`)
- 상세: `partialResult` 는 information_extractor 가 대화 도중 수집한 구조화 데이터다. 이 값은 `NodeExecution.outputData` JSONB 컬럼에 `_resumeCheckpoint` 로 그대로 영속된다. 현재 코드는 `(s.partialResult as Record<string, unknown> | undefined) ?? {}` 형태로 타입 단언만 하고 **스키마 검증·크기 제한 없이** DB에 저장한다. 워크플로 설계자가 악의적이거나 비정상적으로 큰 `partialResult` 를 생성하게 하는 입력이 누적되면 JSONB 컬럼 부풀림이 발생한다. 다만 이 값은 **사용자 직접 입력이 아닌 LLM 출력 기반**이고, checkpoint 크기는 모델 응답 크기에 의존하므로 외부 공격면은 제한적이다.
- 제안: `buildResumeCheckpoint` 에 `partialResult` 객체의 키 개수 및 직렬화 바이트 상한 가드(예: 64 KB)를 추가하고, 초과 시 빈 객체로 fallback 하거나 checkpoint 저장을 skip 하여 RESUME_INCOMPATIBLE_STATE 처리 경로를 타도록 한다. 기존 `messages` 필드에도 유사한 크기 상한이 있는지 확인 권장.

---

### [INFO] `as unknown[]` / `as number | undefined` 타입 단언 — 런타임 타입 보증 부재
- 위치: `execution-engine.service.ts` diff 신규 블록 (`outputSchema`, `examples`, `instructions`, `maxCollectionRetries` 재유도 코드)
- 상세: `resolvedConfig.outputSchema as unknown[] | undefined`, `resolvedConfig.maxCollectionRetries as number | undefined` 등 모두 TypeScript `as` 캐스팅으로 처리된다. 런타임에서 실제 타입이 다르더라도(예: `maxCollectionRetries: "many"`) 캐스팅이 통과하고 다운스트림 핸들러가 예상치 않은 값을 받는다. 공격면은 낮지만(node.config 는 워크플로 설계자가 제어하는 내부 데이터), 허술한 타입 단언이 런타임 오류 또는 예기치 않은 동작을 유발할 수 있다.
- 제안: `zod` 또는 class-validator 로 IE node config 를 파싱하는 헬퍼 함수를 둬서 런타임에 타입·범위를 검증하고, 파싱 실패 시 기본값으로 안전하게 fallback 한다.

---

### [INFO] 테스트 코드에서 `svcAny.loadAndBuildGraph = jest.fn()` 직접 교체 — production 코드 가시성 없음
- 위치: `execution-engine.service.spec.ts` diff, IE 재구성 통합 테스트 (line ~202–250)
- 상세: 테스트가 서비스 내부 private 메서드를 `as unknown as { ... }` 캐스팅으로 직접 모킹하는 패턴이다. 이 자체는 보안 취약점이 아니나, 이 패턴이 테스트 커버리지 갭을 숨긴다 — 실제 `loadAndBuildGraph` 경로가 IE 재개 시 node.type 검증이나 권한 체크를 수행하는지 테스트가 검증하지 못한다. 향후 rehydration 경로에 인가 가드가 추가될 경우 이 테스트는 가드를 우회한 mock 으로 녹색을 유지해 취약점을 놓칠 수 있다.
- 제안: 통합 수준 테스트에서 전체 경로를 통과시키거나, `loadAndBuildGraph` 모킹 범위를 최소화하고 node 타입·권한 가드를 포함한 별도 단위 테스트를 추가한다.

---

## 요약

이번 변경(PR-A2b)은 `information_extractor` 노드의 멀티턴 checkpoint 재개 기능을 `ai_agent` 와 동일한 allow-list 합집합 방식으로 확장한 것으로, 직접적인 SQL 인젝션·XSS·커맨드 인젝션·하드코딩 시크릿·인증 우회·평문 전송 취약점은 존재하지 않는다. 코드 변경은 내부 실행 엔진의 상태 재구성 경로에 국한되며, 사용자 직접 입력이 새 경로로 유입되는 표면도 없다. 다만 `partialResult` 의 크기 제한 부재와 타입 단언 기반의 런타임 타입 미검증이 장기적 방어 심도(defense-in-depth) 측면에서 개선 여지로 식별되었으며, 두 항목 모두 낮은 외부 공격 가능성과 내부 데이터 기원으로 인해 INFO 수준이다.

---

## 위험도

LOW
