## 발견사항

### **[WARNING]** `buildErrorEnvelope` 헬퍼에 대한 단위 테스트 부재
- **위치**: `backend/src/nodes/core/error-codes.ts` — `buildErrorEnvelope` 함수
- **상세**: `details === undefined` 분기를 가진 헬퍼 함수가 새로 추가되었으나 대응 테스트 파일이 없음. `ErrorCode` enum 값의 string 리터럴 일치 여부도 테스트되지 않음
- **제안**:
  ```ts
  // error-codes.spec.ts
  it('omits details key when undefined', () => {
    const e = buildErrorEnvelope('HTTP_5XX', 'msg');
    expect(e).not.toHaveProperty('details');
  });
  it('includes details when provided', () => {
    const e = buildErrorEnvelope('HTTP_5XX', 'msg', { statusCode: 502 });
    expect(e.details).toEqual({ statusCode: 502 });
  });
  ```

---

### **[WARNING]** `button_continue` 상태 통합 테스트 누락
- **위치**: `migrate-node-output-refs.spec.ts` — `status literal unification` describe 블록
- **상세**: `'submitted'`→`'resumed'`, `"button_click"`→`'resumed'` 는 테스트되었으나 `'button_continue'`→`'resumed'` 케이스가 빠져 있음. 스펙에서 세 값 모두 `'resumed'` 로 통일된다고 명시하고 있어 회귀 위험
- **제안**:
  ```ts
  it("replaces status === 'button_continue' with 'resumed'", () => {
    const { result } = rewriteExpression(
      '{{ $node["C"].status === \'button_continue\' }}',
      typeMap({ C: 'carousel' }),
    );
    expect(result).toContain("=== 'resumed'");
  });
  ```

---

### **[WARNING]** discriminator dropout 경고가 carousel 노드만 테스트됨
- **위치**: `migrate-node-output-refs.spec.ts` — `discriminator dropout warning` describe 블록
- **상세**: `output.type === "carousel"` 만 커버됨. `form`, `table`, `chart`, `template` 모두 `type` 판별자 제거 대상인데 이들 케이스에 대한 경고 동작 테스트 없음
- **제안**: 최소한 `form`, `table` 케이스 추가
  ```ts
  it('flags table.output.type without rewriting', () => {
    const { hits } = rewriteExpression(
      '{{ $node["T"].output.type === "table" }}',
      typeMap({ T: 'table' }),
    );
    expect(hits.some((h) => h.reason.includes('discriminator dropped'))).toBe(true);
  });
  ```

---

### **[WARNING]** `previousOutput` 필드 생명주기 테스트 부재
- **위치**: `spec/4-nodes/6-presentation-nodes.md` — carousel Resumed 출력 형식
- **상세**: 스펙에 `"previousOutput": { /* Stage 3 전환기 호환 필드 — Phase 3 에서 제거 예정 */ }` 로 명시됨. 이 필드의 존재/내용/Phase 3 제거 시 회귀를 막을 테스트가 핸들러 spec에 없음. 이행 필드를 테스트로 잠가두지 않으면 Phase 3에서 삭제 시 부지불식간에 다운스트림 consumer가 깨질 수 있음
- **제안**: carousel handler spec에 `previousOutput` 존재 여부 및 shape assertion 추가, TODO 주석으로 Phase 3 제거 의도 명시

---

### **[INFO]** `rewriteExpression` — `$node` 패턴 없는 표현식 테스트 부재
- **위치**: `migrate-node-output-refs.spec.ts`
- **상세**: `{{ someValue + 1 }}` 처럼 `$node` 참조가 없는 표현식의 통과 여부가 테스트되지 않음. 리라이터가 비대상 표현식을 안전하게 pass-through하는지 보장 필요
- **제안**:
  ```ts
  it('passes through expressions with no $node reference', () => {
    const { result, hits } = rewriteExpression('{{ $var.x + 1 }}', labels);
    expect(result).toBe('{{ $var.x + 1 }}');
    expect(hits).toHaveLength(0);
  });
  ```

---

### **[INFO]** chart 출력에 `rendered` 필드 없음 — 핸들러 테스트 일관성 확인 필요
- **위치**: `spec/4-nodes/6-presentation-nodes.md` — 3. Chart 출력 형식
- **상세**: carousel/table은 `output.rendered` 가 있으나 chart 출력 형식에는 `rendered` 없이 `data`만 존재. 기존 chart handler spec이 `output.rendered` 부재를 명시적으로 assert하는지 확인 필요 — spec과 구현의 괴리를 테스트가 잡아줘야 함

---

### **[INFO]** `walkAndRewrite` — 배열 내 null 요소 처리 미테스트
- **위치**: `migrate-node-output-refs.spec.ts` — `walkAndRewrite` describe 블록
- **상세**: `primitives untouched` 테스트는 최상위 null/undefined를 검증하나, 배열 내부의 null/undefined 요소 (`[null, '{{ expr }}', undefined]`) 처리는 커버되지 않음

---

## 요약

테스트 인프라 전반은 잘 설계되어 있으며 특히 `migrate-node-output-refs.spec.ts`는 RELOCATED/META/RESULT/RENAMED 매핑 전체를 smoke-test하는 체계적인 구조를 갖추고 있다. 그러나 신규 `buildErrorEnvelope` 헬퍼의 테스트 파일 부재, `button_continue` 상태 통합 케이스 누락, 이행 필드 `previousOutput`의 lifecycle 테스트 공백이 주요 위험 요소다. `button_continue` 누락은 마이그레이션 스크립트 실행 시 해당 status 값이 `'resumed'`로 치환되지 않는 회귀를 유발할 수 있어 신속한 보완이 권장된다.

## 위험도

**MEDIUM**