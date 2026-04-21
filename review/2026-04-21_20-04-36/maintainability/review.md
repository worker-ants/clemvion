### 발견사항

- **[INFO]** 중복된 SDK stub 패턴 (인라인 반복)
  - 위치: `aborted` 테스트(~line 194), `sendMessageStream rejects` 테스트(~line 220), `classifies 429` 테스트(~line 241)
  - 상세: `client.genAI = { getGenerativeModel: jest.fn().mockReturnValue({ startChat: jest.fn().mockReturnValue({ sendMessageStream }) }) }` 블록이 세 곳에 동일하게 반복됨. `makeClientWithStreamResult`가 있음에도 불구하고 에러 케이스에서만 직접 인라인으로 작성함.
  - 제안: `makeClientWithErrorResult(error: Error)` 헬퍼를 추가하거나, `makeClientWithStreamResult`에 에러 옵션을 추가하여 통일.

```ts
function makeClientWithRejectedStream(error: Error) {
  const client = new GoogleClient('test-key', 'gemini-2.5-flash');
  const sendMessageStream = jest.fn().mockRejectedValue(error);
  // @ts-expect-error — stub
  client.genAI = {
    getGenerativeModel: jest.fn().mockReturnValue({
      startChat: jest.fn().mockReturnValue({ sendMessageStream }),
    }),
  };
  return { client, sendMessageStream };
}
```

- **[INFO]** `aborted` 테스트의 stub 구조가 `makeClientWithStreamResult`와 다름
  - 위치: ~line 194–215
  - 상세: abort 테스트는 인라인으로 스트림 이터레이터를 직접 구현함. 동일 패턴이지만 헬퍼를 쓰지 않아 일관성이 떨어짐.
  - 제안: `asyncIter` 대신 `abort.abort(); throw` 시나리오를 위한 별도 팩토리 or `makeClientWithStreamResult`에 커스텀 `stream` 옵션 추가 검토.

- **[INFO]** `'gemini-2.5-flash'` 문자열 반복
  - 위치: 모든 테스트 케이스 (11개 케이스에서 각각 등장)
  - 상세: 모델 식별자가 하드코딩으로 반복됨. 모델명 변경 시 전체 수정 필요.
  - 제안: 파일 상단에 `const TEST_MODEL = 'gemini-2.5-flash'` 상수 선언 후 참조.

- **[INFO]** `tool_call_delta`/`tool_call_end` id 검증의 타입 가드 중첩
  - 위치: ~line 132–136
  - 상세: `if (delta?.type === 'tool_call_delta' && end?.type === 'tool_call_end')` 조건이 `expect(delta).toMatchObject(...)` 이후에 위치해 있어 실패 시 id 검증이 생략될 수 있음.
  - 제안: 타입 단언 또는 `assert`로 처리하거나, 검증이 항상 실행되도록 구조 변경.

---

### 요약

전반적으로 `asyncIter`, `makeClientWithStreamResult`, `collect` 등의 헬퍼를 잘 분리하여 가독성이 우수하고, 테스트 케이스별 의도도 명확하다. 주된 유지보수성 문제는 에러 케이스 세 곳에서 SDK stub 패턴이 인라인으로 중복되는 것으로, 헬퍼로 추출하면 해결된다. `'gemini-2.5-flash'` 문자열 상수화도 작은 개선이지만 장기 유지보수에 도움이 된다. 심각한 구조적 결함은 없다.

### 위험도

**LOW**