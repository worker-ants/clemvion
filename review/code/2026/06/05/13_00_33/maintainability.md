# 유지보수성(Maintainability) 리뷰

리뷰 대상 커밋: `18fc07f7` — feat(execution-engine): PR-A3 — user-defined variables durable park 영속 + rehydration 복원

---

## 발견사항

### [INFO] `stageDurableResumeSnapshot` 내 변수 필터 로직이 `rehydrateUserVariables` 와 중복
- 위치: `execution-engine.service.ts` — `stageDurableResumeSnapshot` (lines 378-382) 및 `rehydrateUserVariables` (lines 392-397)
- 상세: 두 함수 모두 `for...of Object.entries(...)` + `if (!key.startsWith('__'))` 패턴으로 시스템 변수를 걸러낸다. `stageDurableResumeSnapshot` 은 스냅샷을 저장할 때, `rehydrateUserVariables` 는 복원할 때 각각 동일한 필터를 독립적으로 구현한다. 현재는 로직이 단순해 문제가 없지만, 나중에 필터 기준이 변경될 때(예: `__` 외 다른 접두어 추가, 특정 키 화이트리스트 도입) 두 곳을 동시에 수정해야 한다는 사실을 놓치기 쉽다.
- 제안: `filterUserVariables(vars: Record<string, unknown>): Record<string, unknown>` 같은 private 헬퍼 하나로 추출해 두 메서드가 공유하도록 리팩터링. 필터 의미("시스템 `__*` 제외")가 단일 출처로 관리된다.

---

### [INFO] `stageDurableResumeSnapshot` 가 두 가지 책임을 가짐 (conversationThread + userVariables)
- 위치: `execution-engine.service.ts` — `stageDurableResumeSnapshot` (lines 373-383)
- 상세: 메서드 이름이 "durable resume 스냅샷 준비" 전체를 포괄하도록 의도적으로 확장된 점은 이해할 수 있다. 다만 함수 본문이 두 개의 서로 다른 필드(`conversationThread`, `userVariables`)를 동시에 변경하며, 향후 durable resume 에 새 필드가 추가될 경우 이 함수가 계속 커질 위험이 있다. 현재 길이(10줄)는 문제가 없으나, 확장 패턴으로 고착될 경우 함수 길이가 증가할 수 있다.
- 제안: 현재 규모에서는 허용 가능. 세 번째 필드가 추가되는 시점에 각 필드 스냅샷을 개별 private 메서드로 분리하거나, 일급 `DurableResumeSnapshot` 타입 빌더 패턴을 고려할 것을 권장.

---

### [INFO] `rehydrateUserVariables` 의 `as Record<string, unknown>` 타입 단언
- 위치: `execution-engine.service.ts` — `rehydrateUserVariables`, line 394
- 상세: `Object.entries(raw as Record<string, unknown>)` 에서 `raw` 는 이미 `typeof raw === 'object'` 가드를 통과했으나 여전히 타입 단언이 필요하다. TypeScript 의 타입 좁힘이 `null` 제외 후 `object`를 `Record<string, unknown>` 으로 자동 추론하지 못하기 때문에 단언이 불가피하지만, 의도가 명확하지 않아 보인다. 가드 조건 `!raw || typeof raw !== 'object'` 에서 `Array.isArray(raw)` 도 함께 제외하는 것이 더 방어적이다(배열이 넘어오면 숫자 인덱스 키가 사용자 변수로 복원될 수 있다).
- 제안: `if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};` 로 강화. 배열 엣지케이스를 명시적으로 차단하면 코드의 방어 의도가 더 분명해진다.

---

### [INFO] 테스트 파일의 타입 단언 중복(`as unknown`)
- 위치: `execution-engine.service.spec.ts` — `stageDurableResumeSnapshot` 테스트 블록 (lines 222-248)
- 상세: `const execution = { ... } as unknown` 으로 선언한 후 즉시 `const ex = execution as { conversationThread: unknown; userVariables: Record<string, unknown> }` 로 다시 단언한다. 이중 단언은 코드 추적을 어렵게 한다.
- 제안: 처음부터 `const execution: { id: string; conversationThread: ...; userVariables: ... } = { ... }` 로 타입을 명시하거나, 단일 단언으로 통합한다. 테스트 코드이므로 CRITICAL 이 아니나, 같은 파일 내 다른 테스트 블록과 스타일이 다르다.

---

### [INFO] 엔티티 파일의 인라인 블록 주석 길이
- 위치: `execution.entity.ts` — `userVariables` 컬럼 주석 (lines 454-459)
- 상세: 컬럼 주석이 7줄짜리 인라인 `//` 블록으로 작성되었다. 기존 `conversationThread` 컬럼은 `@Column` 데코레이터 위에 별도 JSDoc `/** ... */` 없이 바로 선언된 반면, 신규 `userVariables` 는 긴 인라인 주석 블록이 선행한다. 정보는 충분하지만 기존 엔티티 스타일(`@Column` 데코레이터만, 또는 짧은 설명 한 줄)과 일관성이 약하다. 별도 DB 컬럼 주석(`COMMENT ON COLUMN`)이 마이그레이션 파일(V085)에 이미 존재하므로 엔티티 레벨에서 중복 서술된다.
- 제안: 엔티티 주석은 "용도 1~2줄 + spec 참조"로 축약하고, 긴 설계 의도는 마이그레이션 파일의 `COMMENT ON COLUMN` 에 위임하는 것이 기존 엔티티 패턴과 더 일관된다.

---

## 요약

PR-A3 의 코드 변경은 전반적으로 가독성이 높고 네이밍도 의도를 잘 반영하고 있다. `stageDurableResumeSnapshot` / `rehydrateUserVariables` 두 메서드 모두 간결하며 순환 복잡도가 낮다. 주된 유지보수성 위험은 `__` 접두어 필터 로직이 두 메서드에 독립 구현되어 있다는 점으로, 필터 기준 변경 시 두 곳을 동시에 갱신해야 한다는 사실을 놓치기 쉽다. 나머지 발견사항은 타입 단언 방어 강화, 이중 타입 단언, 엔티티 주석 스타일 불일치 등 소규모 개선 사항이며 모두 INFO 수준이다. 기존 A1 패턴(conversationThread)을 재사용한 구조적 일관성은 긍정적이고, 테스트 커버리지도 NULL 회귀 케이스와 normalizer 단위 테스트를 모두 포함해 충분하다.

---

## 위험도

LOW

STATUS: OK
