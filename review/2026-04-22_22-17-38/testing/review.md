## 테스팅 코드 리뷰 결과

### 발견사항

---

**[CRITICAL] 모듈 스코프 `EXPRESSION_REFERENCE_CACHE` — 테스트 격리 파괴**
- **위치**: `system-prompt.ts` — `let EXPRESSION_REFERENCE_CACHE: string | null = null;` + `getExpressionReferenceSection()`
- **상세**: 이 캐시는 Jest 프로세스 생명 동안 **단 한 번** 채워지고 절대 리셋되지 않는다. `system-prompt.spec.ts` 내 첫 번째 `buildSystemPrompt` 호출이 캐시를 세팅하면, 이후의 모든 테스트(다른 spec 파일 포함)는 동일 캐시를 사용한다. 현재는 `getAllFunctionNames()`를 모킹하는 테스트가 없어 실패하지 않지만, 향후 누군가 이를 모킹하면 **캐시가 모킹을 무시하고 최초 실제 값을 반환**하는 무음 버그가 발생한다. `beforeEach`/`afterEach`에서 캐시를 리셋하는 훅이 없다.
- **제안**: 테스트 파일에 `afterEach(() => { (global as any).__resetExpressionCache?.() })` 같은 리셋 진입점을 노출하거나, 캐시 변수를 `@internal`로 export 하여 테스트에서 `EXPRESSION_REFERENCE_CACHE = null`로 리셋. 또는 `getExpressionReferenceSection()`을 `getAllFunctionNames`를 주입받는 형태로 바꿔 테스트에서 독립적으로 제어.

---

**[WARNING] 5블록 순서 검증이 부분적 — BLOCK 1→2→3 간 순서는 미검증**
- **위치**: `system-prompt.spec.ts` — `5-block structural layout` describe 블록
- **상세**: 현재 순서 검증 테스트는 (CONTRACTS) `Label vs identifier` < (REFERENCE) `## Expression language` < (DYNAMIC) `"nodes":[` / `## Active plan context` 세 쌍만 검사한다. **BLOCK 1(역할/결정표) < BLOCK 2(CONTRACTS) < BLOCK 3(EDIT PLAYBOOK) < BLOCK 4(REFERENCE)** 간 순서가 테스트되지 않아, 예컨대 EDIT PLAYBOOK 섹션이 CONTRACTS보다 앞으로 이동해도 기존 테스트가 통과한다.
- **제안**: 다음 쌍 추가:
  ```typescript
  it('places CONTRACTS before EDIT PLAYBOOK', () => {
    const prompt = buildSystemPrompt(defs as never, emptySnapshot);
    expect(prompt.indexOf('## Contracts')).toBeLessThan(prompt.indexOf('## Closing the turn'));
  });
  it('places EDIT PLAYBOOK before REFERENCE catalog', () => {
    const prompt = buildSystemPrompt(defs as never, emptySnapshot);
    expect(prompt.indexOf('## Closing the turn')).toBeLessThan(prompt.indexOf('## Reference — node catalog'));
  });
  ```

---

**[WARNING] Turn 결정표 검증이 5개 중 2개 행만 확인**
- **위치**: `system-prompt.spec.ts:411~417` — `'surfaces a turn-type decision table'` 테스트
- **상세**: 표 헤더 존재 + `plan-only` / `execution` 두 단어만 확인. `Single unambiguous edit`, `openQuestions unanswered`, `Question-only` 행은 검증하지 않는다. 리팩터링 과정에서 일부 행이 삭제되거나 문구가 변경되어도 이 테스트는 통과한다.
- **제안**: 표 본문에 `finish` 열의 값(`do NOT call \`finish\``)과 나머지 turn 유형도 검사 추가:
  ```typescript
  expect(prompt).toMatch(/Question-only/i);
  expect(prompt).toMatch(/openQuestions unanswered/i);
  ```

---

**[WARNING] 새 `## Error handling` 섹션에 대한 테스트 없음**
- **위치**: `system-prompt.ts` `STATIC_BLOCK_3_EDIT_PLAYBOOK` 내 `## Error handling (tool result codes)` 섹션
- **상세**: `LABEL_CONFLICT`, `NODE_NOT_FOUND`, `PLAN_AWAITING_APPROVAL`, `PLAN_NOT_COMPLETE` 에러 코드 핸들링 가이드가 새로 추가됐으나 spec에 검증이 없다. 이 섹션이 실수로 삭제되거나 에러 코드 문자열이 오타로 바뀌어도 탐지되지 않는다.
- **제안**: 기존 테스트 패턴에 맞춰 추가:
  ```typescript
  it('documents error code handling', () => {
    const prompt = buildSystemPrompt(defs as never, emptySnapshot);
    expect(prompt).toMatch(/LABEL_CONFLICT/);
    expect(prompt).toMatch(/PLAN_AWAITING_APPROVAL/);
    expect(prompt).toMatch(/PLAN_NOT_COMPLETE/);
  });
  ```

---

**[WARNING] `(no nodes registered)` 폴백 경로 미테스트**
- **위치**: `system-prompt.ts:57` — `${catalog || '(no nodes registered)'}` + `renderNodeCatalog()`
- **상세**: 빈 `nodeDefs` 배열로 호출하는 테스트가 없다. `renderNodeCatalog([])` → `''` → 폴백 문자열이 삽입되는 경로가 검증되지 않는다.
- **제안**:
  ```typescript
  it('uses fallback text when nodeDefs is empty', () => {
    const prompt = buildSystemPrompt([], emptySnapshot);
    expect(prompt).toMatch(/\(no nodes registered\)/);
  });
  ```

---

**[INFO] 중복 `activePlan` 픽스처 — 다른 형태로 두 곳에 선언**
- **위치**: `system-prompt.spec.ts` — 바깥 `Active plan context section` describe(L179~)와 새 `5-block structural layout` describe(L341~) 각각 `activePlan` 선언
- **상세**: 두 픽스처는 의도적으로 다르게 구성되어 있으나(전자는 전체 데이터, 후자는 최소 데이터), 변수명이 동일하여 혼동 유발 가능. 두 스코프가 중첩되지 않으므로 런타임 충돌은 없다.
- **제안**: 5-block describe 내 픽스처 이름을 `minimalActivePlan` 등으로 변경하여 의도를 명확화.

---

**[INFO] `getExpressionReferenceSection` 캐시 동작 자체에 대한 테스트 없음**
- **위치**: `system-prompt.ts` — `EXPRESSION_REFERENCE_CACHE` 로직
- **상세**: 캐시가 실제로 두 번째 호출에서 재사용되는지, 또는 `getAllFunctionNames()` 결과가 반영되는지를 직접 검증하는 테스트가 없다.
- **제안**: 캐시 효과는 성능 속성이어서 단위 테스트보다 통합/벤치마크 레벨에서 검증하는 것이 적합하다. 최소한 두 번 연속 `buildSystemPrompt` 호출 시 동일 expression 섹션이 나오는 것을 확인하는 스냅샷 테스트 고려.

---

### 요약

신규 `5-block structural layout` 테스트 블록은 목표(prefix-cache 친화적 순서 보장, 규칙 중복 제거 검증)를 적절히 추적하고 있으며, 기존 테스트들과 잘 통합된다. 그러나 **모듈 스코프 `EXPRESSION_REFERENCE_CACHE`가 테스트 격리를 구조적으로 취약하게 만드는 점**이 가장 중요한 위험 요소다. 현재는 해당 캐시를 조작하는 테스트가 없어 무음 실패 중이지만, 향후 `getAllFunctionNames` 모킹이 추가되면 미탐지 버그의 온상이 된다. 순서 검증 커버리지도 부분적이어서(3쌍 중 상위 블록 간 순서 누락), 리팩터링 회귀를 완전히 막지 못한다.

### 위험도

**MEDIUM**