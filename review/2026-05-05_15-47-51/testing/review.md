### 발견사항

- **[INFO]** `optionSchema` 의 `value: null` 케이스 테스트가 schema 동작을 정확히 검증함
  - 위치: `form.schema.spec.ts` — `optionSchema` 테스트
  - 상세: `z.unknown().default('')`에서 `null`을 명시 입력하면 기본값이 적용되지 않고 `null`이 그대로 통과해야 하는데, 테스트가 `toBeNull()`로 이를 올바르게 검증함. 의도된 동작임.
  - 제안: 없음. 정확함.

- **[INFO]** `keyValueSchema` passthrough 테스트의 타입 캐스트 패턴이 반복됨
  - 위치: `http-request.schema.spec.ts:23` — `const extra = parsed as Record<string, unknown>`
  - 상세: `.passthrough()`가 반환하는 타입은 TypeScript 상 추가 필드를 포함하지 않아 캐스트가 필요하지만, `form.schema.spec.ts`도 동일 패턴을 사용함. 이는 zod의 한계로 인한 불가피한 패턴이므로 문제는 아님.
  - 제안: 없음. 일관성 있게 적용됨.

- **[WARNING]** `keyValueSchema` 에 `value`가 누락된 케이스에 대한 테스트가 없음
  - 위치: `http-request.schema.spec.ts` — `keyValueSchema` describe 블록
  - 상세: `optionSchema`에는 `value` 누락 시 기본값(`''`)을 검증하는 테스트가 있지만, `keyValueSchema`에는 `value: z.string()`으로 기본값이 없어 파싱 시 오류가 발생해야 함. 반대로 `key` 누락 시 동작도 미검증. 현재 두 케이스 모두 happy-path만 테스트됨.
  - 제안:
    ```ts
    it('key 또는 value 누락 시 zod 파싱 오류', () => {
      expect(() => keyValueSchema.parse({ key: 'X' })).toThrow();
      expect(() => keyValueSchema.parse({ value: 'v' })).toThrow();
    });
    ```

- **[INFO]** `cookiesSchema`가 `keyValueSchema`를 공유하는지 테스트가 명시적으로 확인하지 않음
  - 위치: `http-request.schema.spec.ts` — describe 제목이 "headers / queryParams / cookies 공용"이라 명시
  - 상세: 제목에서 cookies도 공용으로 선언하지만, `httpRequestNodeConfigSchema`에 `cookies` 필드가 존재하는지 확인되지 않음. 실제 schema를 보면 `cookies` 필드는 없고 `headers`/`queryParams`만 존재함. describe 제목이 미래 의도를 담은 것이라면 오해를 줄 수 있음.
  - 제안: describe 제목을 `'keyValueSchema (headers / queryParams 공용)'`으로 수정하거나, `cookies` 필드가 추후 추가될 때 테스트를 갱신할 TODO를 남김.

- **[INFO]** 변경된 export(`keyValueSchema`, `optionSchema`) 에 대한 테스트가 동일 commit 내에 함께 추가됨
  - 상세: 스키마 변경(export 추가, `.passthrough()` 추가, default 변경)과 테스트가 동시에 포함되어 있어 회귀 위험이 낮음. TDD 관점에서 모범적인 패턴.

---

### 요약

두 변경 모두 schema를 export하는 최소한의 변경과 함께 해당 동작을 직접 검증하는 단위 테스트가 함께 제공되어 있다. `optionSchema` 테스트는 default 동작(빈 문자열), 다형 value 타입(boolean/number/string/null), passthrough 세 가지를 고루 커버하여 완성도가 높다. `keyValueSchema` 테스트는 happy-path와 passthrough를 검증하지만 **필수 필드 누락 시 파싱 실패 케이스**가 빠져 있어 소폭의 커버리지 갭이 있다. 테스트 격리, 가독성, mock 불필요(순수 zod 파싱)의 측면에서 모두 적절하다.

### 위험도

**LOW**