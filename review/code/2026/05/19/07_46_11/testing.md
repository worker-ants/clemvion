# 테스트(Testing) 리뷰

## 발견사항

### [INFO] loop.schema.spec.ts — warningRules 비어 있음을 단일 assertion 으로만 검증
- 위치: `codebase/backend/src/nodes/logic/loop/loop.schema.spec.ts`, `describe('loopNodeMetadata.warningRules')` 블록
- 상세: 기존에는 `loop:no-count` warningRule 의 발화/비발화 케이스(4개 it) 를 직접 검증했으나, 변경 후 `expect(loopNodeMetadata.warningRules).toEqual([])` 한 줄로 대체되었다. 이 방식은 "warningRules 배열이 비어있음"은 확인하지만, 미래에 새 warningRule 이 잘못 추가될 경우 **의도적으로 빈 배열이어야 한다**는 맥락을 스펙 문서 없이 코드만으로 전달하기에 약하다. 테스트 자체는 정확하고 의도를 주석으로 설명하고 있으므로 심각성은 낮다.
- 제안: 현 상태(주석 포함)로 충분하다. 추가로 `it.each` 등으로 특정 id 의 warningRule 이 존재하지 않음을 명시하고 싶다면 `expect(loopNodeMetadata.warningRules.find(r => r.id === 'loop:no-count')).toBeUndefined()` 형태를 추가할 수 있으나, 빈 배열 검증으로 이미 동일한 보장이 제공된다.

### [INFO] loop.handler.spec.ts — "missing count" 케이스의 계층 검증 부재
- 위치: `codebase/backend/src/nodes/logic/loop/loop.handler.spec.ts:439-443`
- 상세: 변경된 테스트는 `handler.validate({})` 가 `{ valid: true, errors: [] }` 를 반환함을 올바르게 검증한다. 그러나 이 동작의 전제인 "빈 config 가 storage layer(zod `default('1')`) 를 통과하면 `count: '1'` 이 채워진다"는 zod 파싱 경로는 `loop.handler.spec.ts` 에서는 커버되지 않는다. 해당 경로는 `loop.schema.spec.ts` 의 `validateLoopConfig` 테스트나 별도 zod parse 테스트가 담당해야 한다.
- 제안: `loopNodeConfigSchema.parse({})` 가 `{ count: '1', maxIterations: 1000 }` 를 반환하는지 확인하는 테스트를 `loop.schema.spec.ts` 에 추가하면 두 레이어 간 계약(zod default → handler.validate passthrough) 이 명시적으로 문서화된다. 현재 해당 경로를 직접 검증하는 테스트가 없음이 커버리지 갭이다.

### [WARNING] loop.schema.spec.ts — zod `default('1')` 실제 파싱 동작 미검증
- 위치: `codebase/backend/src/nodes/logic/loop/loop.schema.spec.ts`
- 상세: 변경의 핵심 불변량은 "빈 config 가 zod parse 를 거치면 `count` 가 `'1'` 로 채워진다"이다. 이 불변량을 기반으로 `handler.validate({})` 가 valid 를 반환한다고 설명하지만, 정작 `loopNodeConfigSchema.parse({})` 또는 `loopNodeConfigSchema.parse({ count: undefined })` 의 결과를 직접 assert 하는 테스트가 없다. `warningRules: []` 검증과 `evaluateMetadataBlockingErrors` 통합 테스트는 있으나 zod schema 의 `default` 동작 자체를 검증하지 않는다. 만약 누군가 `count` 필드의 `.default('1')` 을 제거하거나 `.optional()` 로만 변경하면, 현재 테스트 세트는 이를 즉시 잡지 못할 수 있다.
- 제안: 아래 테스트를 `loop.schema.spec.ts` 의 `describe('validateLoopConfig')` 또는 별도 `describe('loopNodeConfigSchema')` 블록에 추가한다.
  ```typescript
  it('fills count with "1" when missing (zod default — 최소 반복 1회 정책)', () => {
    const parsed = loopNodeConfigSchema.parse({});
    expect(parsed.count).toBe('1');
  });

  it('fills count with "1" when count is explicitly undefined', () => {
    const parsed = loopNodeConfigSchema.parse({ count: undefined });
    expect(parsed.count).toBe('1');
  });
  ```

### [INFO] execution-engine.service.spec.ts — 주석 변경만이며 동작 검증 범위에 영향 없음
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4502-4541`
- 상세: 변경은 테스트 코드 자체가 아닌 주석(`// zod default('1') catches this...`)만 수정되었다. 테스트 의도(미설정 count 로 `INVALID_CONTAINER_PARAM` throw 검증)와 회귀 보호 범위는 그대로다. 주석이 현재 아키텍처(legacy data / direct repo write 경로에 대한 safety net 역할)를 정확히 기술하고 있어 가독성이 향상되었다.
- 제안: 없음. 주석이 적절하게 갱신되었다.

### [INFO] backend-labels.ts — i18n 매핑 삭제 테스트 커버리지 확인 필요
- 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts:328` (삭제된 `"Count must be entered."` 항목)
- 상세: plan 에 언급된 "i18n Principle 3 가드(`__tests__/backend-labels.test.ts` parity guard)" 가 삭제 방향(backend warningRule 제거 → i18n 매핑 제거)도 검출하는지 확인이 필요하다. 삭제된 키가 parity guard 의 검증 대상이 아니라면, 향후 동일 패턴의 삭제에서 i18n 불일치가 잠재적으로 누락될 수 있다.
- 제안: `backend-labels.test.ts` parity guard 가 "backend schema 에 존재하지 않는 warning 메시지가 `WARNING_KO` 에 남아있음"도 검출하는지 확인한다. 현재 구조상 추가 방향만 가드할 경우, 삭제 방향 가드를 확장하는 테스트를 추가할 것을 권고한다.

### [INFO] 테스트 격리 및 독립 실행 가능성
- 위치: 전체 변경 파일
- 상세: `loop.handler.spec.ts` 와 `loop.schema.spec.ts` 는 각각 `beforeEach` 로 독립 인스턴스를 생성하거나 순수 함수를 호출하므로 테스트 간 상태 공유가 없다. `execution-engine.service.spec.ts` 역시 `beforeEach` 에서 모든 mock 을 재생성한다. 격리 측면에서 문제 없다.
- 제안: 없음.

### [INFO] 회귀 테스트 유효성
- 위치: `loop.schema.spec.ts` 전체
- 상세: `validateLoopConfig` 의 기존 케이스(numeric string, expression, negative/zero, non-numeric, cross-field)는 변경 후에도 모두 유지된다. `evaluateMetadataBlockingErrors` 케이스도 빈 config(zod default) + 유효 config + 명시적 0 값 세 가지로 충분히 커버된다. `loop.handler.spec.ts` 의 validate/execute 분류도 모두 유지된다. 기존 회귀 보호에 누락 없다.
- 제안: 없음.

## 요약

이번 변경의 테스트 품질은 전반적으로 양호하다. `loop:no-count` warningRule 제거라는 정책 변경에 맞춰 `loop.schema.spec.ts`, `loop.handler.spec.ts`, `execution-engine.service.spec.ts` 의 테스트와 주석이 일관되게 갱신되었으며, 회귀 케이스도 모두 유지된다. 다만 변경의 핵심 불변량("빈 config 가 zod parse 를 거치면 `count: '1'` 이 채워진다")을 직접 검증하는 테스트가 없다는 커버리지 갭이 WARNING 수준으로 식별된다. 이 갭은 `loopNodeConfigSchema.parse({})` 결과를 assert 하는 테스트 1-2개를 `loop.schema.spec.ts` 에 추가하면 해소된다. i18n 삭제 방향 parity guard 의 커버리지 여부도 별도 확인이 필요하다.

## 위험도

LOW
