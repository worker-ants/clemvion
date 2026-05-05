## 발견사항

### [WARNING] `resolve-dynamic-ports.spec.ts` 업데이트 누락
- **위치**: `resolve-dynamic-ports.ts` 변경 전체
- **상세**: 파일 헤더 주석에 "regression is covered by `resolve-dynamic-ports.spec.ts` mirroring the frontend fixtures"라고 명시되어 있으나, 이번 diff에 해당 spec 파일 변경이 없음. `classifierCategoriesPorts` 내 `c.id` 기반 포트 발급 로직이 새로 도입됐지만, resolver 단위 테스트에서 `{ id: 'cat_refund', name: 'Billing' }` 형태의 입력에 대해 `cat_refund` 포트가 나오는지 검증하는 케이스가 추가됐다는 근거가 없음.
- **제안**: `resolve-dynamic-ports.spec.ts`에 `classifier-categories` fixture를 `id` 필드 포함 케이스로 보강해야 함.

---

### [WARNING] JSON 파싱 실패(text fallback) 경로 + 커스텀 id 조합 미커버
- **위치**: `text-classifier.handler.ts` `processSingleLabelResult` catch 블록 (line ~312), `processMultiLabelResult` catch 블록 (line ~375)
- **상세**: `handler.spec.ts`의 기존 `should extract category from text on JSON parse failure` 테스트는 `baseConfig`(id 없음)만 사용. catch 블록에서 이름으로 매칭 후 `buildCategoryPortIds(categories)[portIndex]`를 호출하는 경로가 커스텀 id와 결합됐을 때 올바르게 `cat_refund` 등을 반환하는지 검증하지 않음. 멀티 레이블 text fallback 경로도 동일.
- **제안**: 단일·멀티 레이블 `includeEvidence` describe 하단에 다음을 추가:
  ```ts
  it('text fallback path should use custom id when set', async () => {
    mockLlmService.chat.mockResolvedValueOnce({
      content: 'The text relates to Billing',
      ...
    });
    const result = await handler.execute({}, {
      ...baseConfig,
      categories: [
        { id: 'cat_refund', name: 'Billing', description: 'Payment' },
        { id: 'cat_tech', name: 'Tech', description: 'Technical' },
      ],
    }, createContext());
    expect((result as any).port).toBe('cat_refund');
  });
  ```

---

### [WARNING] resolver vs handler 간 `c.id` trim 처리 불일치
- **위치**: `resolve-dynamic-ports.ts:87`, `text-classifier.handler.ts` `buildCategoryPortIds`
- **상세**: resolver는 `c.id` 를 그대로 포트 id로 사용(`c.id`, 미트림), handler의 `buildCategoryPortIds`는 `c.id.trim()`을 반환. `id: ' cat_refund '`처럼 앞뒤 공백이 있으면 resolver는 `' cat_refund '`, handler는 `'cat_refund'`를 발급해 port mismatch 발생. 스키마 regex(`/^[a-zA-Z0-9_-]+$/`)가 런타임 입력을 차단하지만, resolver와 handler가 diverge한다는 사실 자체가 리스크.
- **제안**: resolver를 `c.id.trim()`으로 통일하거나, `aiAgentConditionalPorts`와 일관되게 trim 없이 통일. 선택 후 `resolve-dynamic-ports.spec.ts`에 동작 고정 테스트 추가.

---

### [INFO] `categoryDefSchema` — 빈 문자열 id 거부 케이스 미테스트
- **위치**: `text-classifier.schema.spec.ts`
- **상세**: `id: ''`는 regex `^[a-zA-Z0-9_-]+$`(`+` 수량자) 에 의해 거부되어야 하나 spec에 명시적 케이스 없음. `.optional()`과 regex의 조합에서 빈 문자열이 실제로 거부되는지 한 줄 확인으로 보장 가능.
- **제안**:
  ```ts
  it('id 빈 문자열은 거부 (regex + 는 최소 1자 요구)', () => {
    expect(categoryDefSchema.safeParse({ id: '', name: 'A' }).success).toBe(false);
  });
  ```

---

### [INFO] `aiAgentConditionalPorts`와 trim 정책 불일치 — 기존 테스트로 행동이 고정되지 않음
- **위치**: `resolve-dynamic-ports.ts` `aiAgentConditionalPorts` vs `classifierCategoriesPorts`
- **상세**: `aiAgentConditionalPorts`는 `c.id.length > 0`(trim 없음), `classifierCategoriesPorts`는 `c.id.trim().length > 0`. 동일 resolver 내 두 함수의 정책이 다름. 현재 각 함수에 대한 spec 픽스처가 이 차이를 명시적으로 문서화하지 않음.
- **제안**: spec 또는 코드 주석에 의도적 차이임을 명시하거나 통일.

---

## 요약

핵심 변경(handler `buildCategoryPortIds`, schema `id` 필드, 단일·멀티 레이블 라우팅)에 대한 테스트는 happy path와 whitespace/누락 fallback을 충실히 커버하고 있으며 테스트 구조와 격리도 양호하다. 그러나 **`resolve-dynamic-ports.spec.ts`가 이번 diff에 포함되지 않아 resolver 단의 새 동작이 회귀 테스트로 보호되는지 확인할 수 없고**, JSON 파싱 실패 시 text-fallback 경로에 커스텀 id가 적용되는 케이스가 누락되어 있다. 또한 resolver와 handler 간 `c.id` trim 처리 불일치는 schema 제약 덕분에 현재는 문제가 없지만 잠재적 동기화 버그의 씨앗이 될 수 있다.

## 위험도

**MEDIUM** — resolver spec 업데이트 누락과 text-fallback 경로 미커버가 향후 리팩토링 시 silent regression으로 이어질 수 있음.