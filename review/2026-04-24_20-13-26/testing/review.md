충분히 파악했습니다. 리뷰를 작성합니다.

---

## 발견사항

### **[WARNING] send-email: `.default('')` 경로를 커버하는 테스트 없음**
- **위치**: `send-email.handler.spec.ts` 전체 / `send-email.schema.ts:119,125`
- **상세**: `baseConfig`는 항상 `subject: 'hi'`와 `body: 'hello'`를 공급한다. 즉, 두 필드를 생략했을 때 스키마가 `''`를 기본값으로 채우는 경로가 단 한 번도 테스트되지 않는다. 더 중요한 점은 핸들러 `validate()`가 `!config.subject`로 빈 문자열도 거부하는데(line 68, 72), 이 케이스도 테스트 없이 문서화만 되어 있지 않다.
- **제안**:
  ```ts
  // send-email.schema.spec.ts (신규 파일)
  it('defaults subject and body to empty string when omitted', () => {
    const result = sendEmailNodeConfigSchema.parse({ integrationId: 'x', to: [] });
    expect(result.subject).toBe('');
    expect(result.body).toBe('');
  });
  
  // send-email.handler.spec.ts — validate 블록에 추가
  it('rejects empty-string subject (schema default path)', () => {
    const result = handler.validate({ ...baseConfig, subject: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('subject');
  });
  
  it('rejects empty-string body (schema default path)', () => {
    const result = handler.validate({ ...baseConfig, body: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('body');
  });
  ```

---

### **[WARNING] switch: `caseDefSchema.id` 옵셔널 특성이 스키마 레벨에서 미검증**
- **위치**: `switch.schema.ts:12-16` / `switch.handler.spec.ts` 전체
- **상세**: 스키마는 `id: z.string().optional()`로 선언하여 Zod 파싱 시 id 없는 케이스를 통과시키지만, 핸들러 `validate()`는 `!c.id`로 id 없는 케이스를 런타임 에러로 처리한다. 핸들러 스펙은 이미 모든 케이스에 `id`를 포함하므로 "id 없이 파싱 성공 → 핸들러 validate에서 실패" 경로가 완전히 비어 있다. `switch.schema.spec.ts` 파일도 존재하지 않는다.
- **제안**:
  ```ts
  // switch.schema.spec.ts (신규 파일)
  it('parses caseDefSchema without id (optional)', () => {
    const result = caseDefSchema.safeParse({ label: 'fallback', value: 'a' });
    expect(result.success).toBe(true);
    expect(result.data?.id).toBeUndefined();
  });
  
  it('preserves id when provided', () => {
    const result = caseDefSchema.parse({ id: 'case-abc', label: 'A', value: 1 });
    expect(result.id).toBe('case-abc');
  });
  
  it('applies default values for switchNodeConfigSchema', () => {
    const result = switchNodeConfigSchema.parse({});
    expect(result.mode).toBe('value');
    expect(result.cases).toEqual([]);
    expect(result.hasDefault).toBe(false);
    expect(result.strictComparison).toBe(false);
  });
  ```

---

### **[INFO] 스키마·핸들러 계층 간 `id` 의미론적 불일치 — 통합 테스트 없음**
- **위치**: `switch.schema.ts:12` (optional) vs `switch.handler.ts:58` (required at runtime)
- **상세**: Zod 스키마는 `id`를 optional로 정의하므로 스키마를 통과한 config가 핸들러의 `validate()`에서 거부되는 시나리오가 존재한다. 이 두 레이어를 관통하는 테스트가 없어 향후 스키마를 required로 강화하거나 핸들러를 완화할 때 의도치 않은 동작 변경이 가능하다. 현재 `plan/node-schema-audit.md`의 F-1~F-5 항목들도 이 패턴을 확장할 예정이므로, 이 불일치 패턴이 굳어지기 전에 정책을 명시하는 게 낫다.
- **제안**: `switch.handler.spec.ts`에 아래 케이스 추가:
  ```ts
  it('rejects case without id even though schema allows it as optional', () => {
    // 스키마 파싱은 성공하지만 핸들러 validate()는 id를 요구
    const parsed = switchNodeConfigSchema.parse({
      switchValue: 'x',
      cases: [{ label: 'no-id', value: 'x' }],
    });
    const result = handler.validate(parsed as Record<string, unknown>);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('id is required');
  });
  ```

---

### **[INFO] `plan/node-schema-audit.md` F-1의 테스트 요건이 구체적이나 아직 파일 없음**
- **위치**: `plan/node-schema-audit.md:25-26`
- **상세**: F-1이 `text-classifier.handler.spec.ts`에 "custom id 설정 시나리오 추가"를 명시하고 있다. 이는 follow-up으로 처리 예정이지만, 현재 `text-classifier.handler.spec.ts`에 `class_0`/`class_1` 하드코딩 다수가 있고 이는 switch의 `id` 추가 패턴과 동일한 위험(label 수정 → index 밀림 → edge 파손)을 가진다. switch의 선례가 생긴 지금, text-classifier 쪽 테스트 보강 타이밍이 됐다.

---

## 요약

이번 변경은 두 스키마 수정 모두 핸들러의 런타임 동작을 바꾸지 않으며(send-email의 `validate()`는 `''`도 `undefined`와 동일하게 거부, switch의 `id` 필수 검사는 핸들러 레이어에 그대로 유지), 기능적 회귀 위험은 낮다. 그러나 스키마 레벨 스펙 파일이 두 노드 모두 없고, `subject`/`body` 기본값 경로와 `caseDefSchema`의 id 옵셔널 특성이 어떤 테스트에서도 검증되지 않아 커버리지 갭이 구조적으로 존재한다. 특히 스키마(optional)와 핸들러(runtime-required)의 의미론적 불일치는 향후 동일 패턴(F-1 text-classifier 등)이 확산되기 전에 테스트로 못 박아 두는 것이 권장된다.

## 위험도

**LOW** — 기능 동작 변경 없음, 기존 테스트 깨짐 없음. 단, 스키마·핸들러 계층 불일치 패턴이 문서화 없이 확산될 경우 MEDIUM으로 격상될 수 있음.