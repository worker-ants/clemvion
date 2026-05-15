## 발견사항

### [WARNING] `execution-engine.service.spec.ts` ESLint 주석 정리 후 lint 실패 가능성
- **위치**: 576번, 644번 라인
- **상세**: `(service as any)['contextService']` 접근 코드에서 `@typescript-eslint/no-explicit-any`와 `@typescript-eslint/no-unsafe-member-access` 억제 주석이 제거되었으나, 해당 코드 패턴은 여전히 두 규칙을 모두 위반함. 현재 남은 주석은 `no-unsafe-assignment`만 억제함.
- **제안**: 실제 lint를 실행하여 통과 여부 확인 필요. 실패 시 제거된 두 규칙을 다시 추가하거나, private 프로퍼티 접근을 위한 타입 단언 방식을 `(service as unknown as { contextService: ExecutionContextService }).contextService`로 변경

---

### [WARNING] `carousel.handler.ts` static 모드에서 `config.items`가 undefined일 때 런타임 에러
- **위치**: `carousel.handler.ts` execute() - static 분기
- **상세**: `execute()`에서 `mode === 'static'`일 때 `config.items`를 null/undefined 검사 없이 바로 `.map()` 호출. validate()를 통과하지 않고 직접 execute()가 호출될 경우 `TypeError: Cannot read properties of undefined (reading 'map')` 발생
- **제안**: 아래 테스트 케이스 추가 및 방어 코드 보완
  ```typescript
  it('should handle missing items gracefully in static mode', async () => {
    const result = await handler.execute(null, { mode: 'static' }, context);
    const items = (result as Record<string, unknown>).items as unknown[];
    expect(items).toHaveLength(0);
  });
  ```

---

### [WARNING] `carousel.handler.spec.ts` dynamic 모드에서 null 입력 시 동작 미테스트
- **위치**: `carousel.handler.spec.ts` execute() - dynamic 모드 섹션
- **상세**: dynamic 모드에서 `input = null`이면 `[null]`로 래핑됨. 이후 `null[titleField]` 접근 시 `TypeError` 발생 가능. 정상 동작 여부(빈 문자열 반환 vs 에러)가 테스트되지 않음
- **제안**:
  ```typescript
  it('should handle null input in dynamic mode without throwing', async () => {
    const result = await handler.execute(null, { titleField: 'name' }, context);
    const items = (result as Record<string, unknown>).items as Array<Record<string, unknown>>;
    expect(items[0].title).toBe('');
  });
  ```

---

### [WARNING] spec과 구현 간 `descriptionField` 필수 여부 불일치
- **위치**: `spec/4-nodes/6-presentation-nodes.md` 1.1 Config 표 / `carousel.handler.ts` validate()
- **상세**: 스펙은 `descriptionField`를 dynamic 모드에서 필수(`✓`)로 정의하나, `validate()`는 `titleField`만 검증함. `execute()`는 `descriptionField`를 optional로 처리함. 스펙 또는 구현 중 하나를 맞춰야 함
- **제안**: 스펙을 optional(`✗`)로 수정하거나, `validate()`에 검증 로직 추가하고 관련 테스트 보완

---

### [INFO] `toStr()` 함수의 비문자열 입력값 경로 미테스트
- **위치**: `carousel.handler.spec.ts`
- **상세**: dynamic 모드에서 필드값이 number, boolean, object인 경우를 테스트하는 케이스 없음. `toStr(0)` → `'0'`, `toStr(false)` → `'false'`, `toStr({a:1})` → `'{"a":1}` 동작이 검증되지 않음
- **제안**:
  ```typescript
  it('should convert non-string field values to string in dynamic mode', async () => {
    const result = await handler.execute(
      [{ count: 42, flag: true }],
      { titleField: 'count', descriptionField: 'flag' },
      context,
    ) as Record<string, unknown>;
    const items = result.items as Array<Record<string, unknown>>;
    expect(items[0].title).toBe('42');
    expect(items[0].description).toBe('true');
  });
  ```

---

### [INFO] `execute()` 호출 시 잘못된 mode 값의 동작 미테스트
- **위치**: `carousel.handler.spec.ts`
- **상세**: `mode: 'unknown'`으로 execute() 호출 시 else 분기(dynamic)로 폴스루됨. 이 암묵적 폴스루 동작이 의도된 것인지 테스트로 검증되어 있지 않음
- **제안**: 명시적 테스트 추가 또는 else 분기에 방어 코드 추가

---

### [INFO] 렌더링된 HTML의 이미지 src/alt 속성 이스케이프 테스트 누락
- **위치**: `carousel.handler.spec.ts`
- **상세**: XSS 이스케이프 테스트는 `<h3>` 제목만 검증. `<img src="..." alt="...">` 속성에서의 `"` 이스케이프(`&quot;`)가 정상 동작하는지 테스트 없음
- **제안**:
  ```typescript
  it('should escape HTML in image src and alt attributes', async () => {
    const result = await handler.execute(null, {
      mode: 'static',
      items: [{ title: '" onload="xss()', image: '" onerror="xss()' }],
    }, context) as Record<string, unknown>;
    expect(result.rendered as string).not.toContain('onload=');
    expect(result.rendered as string).toContain('&quot;');
  });
  ```

---

## 요약

`carousel.handler.spec.ts`는 static/dynamic 모드 전환이라는 핵심 기능 변경에 대해 전반적으로 잘 구성된 테스트를 제공하며 주요 경로는 충분히 커버됨. 다만 static 모드에서 `config.items`가 없을 때의 방어 로직 부재, dynamic 모드에서 null 입력 처리, spec과 구현 간 `descriptionField` 필수 여부 불일치가 Warning 수준의 이슈로 존재함. 또한 `execution-engine.service.spec.ts`의 ESLint 주석 정리가 실제로 lint를 통과하는지 검증이 필요하며, `toStr()` 비문자열 경로와 이미지 속성 XSS 이스케이프에 대한 보완 테스트가 권장됨.

## 위험도

**MEDIUM**