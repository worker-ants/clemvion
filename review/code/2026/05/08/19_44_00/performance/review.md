## 발견사항

- **[INFO]** `setEngineResolvedConfig` 의 방어적 null 체크가 데드 코드
  - 위치: `execution-context.service.ts` — `setEngineResolvedConfig` 메서드 내 `if (!context.engineResolvedConfigCache)` 분기
  - 상세: `createContext` 에서 이미 `engineResolvedConfigCache: {}` 로 초기화하므로, `setEngineResolvedConfig` 에 도달할 때 이 필드가 `undefined` 일 수 없다. 매 노드 실행마다 이 분기를 평가하는 오버헤드는 무시할 수준이지만, 대칭으로 존재하는 `setStructuredOutput` 의 동일 패턴도 함께 고려하면 두 곳 모두 제거 가능하다.
  - 제안: `if (!context.engineResolvedConfigCache)` 블록 제거. `createContext` 초기화로 보장이 완전하다.

- **[INFO]** 노드당 캐시 슬롯이 3개로 늘어남에 따른 메모리 상한 증가
  - 위치: `ExecutionContextService` — `nodeOutputCache`, `structuredOutputCache`, `engineResolvedConfigCache`
  - 상세: 이번 변경으로 각 노드 실행 후 세 번째 캐시 슬롯이 추가됐다. 슬롯마다 같은 executionId 내에 살아있다가 `deleteContext` 시 함께 해제된다. 일반 워크플로우 규모(노드 < 100개, config 객체 < 1 KB) 에서는 총 추가 메모리가 수 KB 수준으로 무시 가능하다. 다만 `engineResolvedConfigCache` 에는 `resolvedConfig` 객체 참조가 그대로 저장되므로, config에 대용량 바이트 배열이나 중첩 구조가 담기는 노드가 생기면 두 캐시(`structuredOutputCache.config` + `engineResolvedConfigCache`)에 동일 데이터가 이중 적재될 수 있다.
  - 제안: 현 규모에서는 허용 가능. 대용량 config를 가진 노드(예: 대형 스키마 내장 노드)가 추가될 경우 shallow clone 대신 필요 키만 선택적으로 저장하는 방식(pick)을 고려하라.

- **[INFO]** 테스트 내 하드코딩된 `setTimeout(r, 200)` 지연
  - 위치: `execution-engine.service.spec.ts` — Loop/Parallel/ForEach 신규 테스트 케이스 다수
  - 상세: 비동기 완료 대기를 `await new Promise((r) => setTimeout(r, 200))` 로 처리하고 있다. 일부 테스트는 `flushPromises()` 를 사용하지만 신규 케이스들은 고정 딜레이를 사용한다. 200ms × 8개 케이스 = 약 1.6초의 불필요한 테스트 실행 시간이 추가된다. CI 환경의 부하에 따라 간헐적 flakiness 위험도 있다.
  - 제안: 기존 `flushPromises()` 헬퍼를 신규 케이스에도 통일해 적용하라.

- **[INFO]** `UNRESOLVED_EXPRESSION_PATTERN` 정규식이 `.*` 탐욕 매칭 사용
  - 위치: `coerce-container-param.ts:12` — `const UNRESOLVED_EXPRESSION_PATTERN = /\{\{.*\}\}/`
  - 상세: 모듈 레벨 상수로 정의되어 재컴파일 비용은 없다. `.*` 탐욕 매칭은 `{{a}} text {{b}}` 같은 멀티 표현식 문자열에서 첫 `{{` ~ 마지막 `}}` 전체를 하나로 매칭하는데, 이는 의도된 동작이다. config 값은 짧은 문자열이므로 역추적 비용은 실질적으로 없다. 단, `s` 플래그 미적용으로 `.` 이 개행을 무시하지만 config 필드에서 개행이 포함된 표현식은 발생하지 않으므로 문제없다.
  - 제안: 현 구현 유지 가능. 명시성을 위해 `\{\{[^}]*\}\}` 처럼 문자 클래스를 좁히는 것은 코드 가독성 개선이지 성능 개선은 아니다.

---

## 요약

이번 변경의 핵심인 `engineResolvedConfigCache` 도입은 성능 관점에서 **올바른 방향**이다. 표현식 재평가를 피하고 이미 계산된 `resolvedConfig` 를 재활용하므로, 컨테이너 진입 시점의 추가 연산 비용은 O(1) 캐시 룩업 하나뿐이다. `coerce-*` 헬퍼들은 컨테이너 노드당 1회만 호출되고 regex도 모듈 상수로 관리되어 핫패스 부담이 없다. 발견된 이슈들은 모두 INFO 수준으로, 가장 실질적인 개선 포인트는 테스트 내 하드코딩 지연을 `flushPromises()` 로 교체하여 CI 수행 시간을 단축하는 것이다.

## 위험도

**LOW**