## 의존성 코드 리뷰

---

### 발견사항

---

**[WARNING] Zod v4 전용 API 사용 — 버전 고정 필요**
- 위치: `workflow-assistant-stream.service.spec.ts` — `z.string().optional().meta({...})`
- 상세: `.meta()` 메서드는 Zod v4에서 도입된 API다. Zod v3에는 존재하지 않으며, v3 프로젝트에서 이 코드를 실행하면 런타임 오류가 발생한다. 테스트 주석에서도 `z.toJSONSchema()` 언급이 있는데, 이 역시 Zod v4 메서드다(v3에서는 별도 패키지 `zod-to-json-schema` 필요).
- 제안: `package.json`에서 `"zod": "^4.x.x"` 또는 `">=4.0.0"` 으로 명시적으로 고정할 것. v3를 유지해야 한다면 `.meta()` 대신 `.describe()`를 사용하고 JSON Schema 변환은 `zod-to-json-schema` 패키지로 처리해야 한다.

---

**[WARNING] `{ type: 'none' } as never` — 존재하지 않는 Anthropic API 타입 우회**
- 위치: `anthropic.client.ts:74, 202` — `({ type: 'none' } as never)`
- 상세: Anthropic의 `tool_choice` 타입에 `{ type: 'none' }` 옵션은 존재하지 않는다. 유효한 값은 `auto`, `any`, `tool` 세 가지뿐이다. `as never` 캐스트는 타입 검사를 강제로 통과시키는 것으로, 이 값이 실제 API에 전송되면 400 오류를 유발할 가능성이 있다. `toolChoice === 'none'` 의도는 아마 도구 목록 자체를 제외하거나 `tool_choice`를 생략하는 것이었을 것이다.
- 제안: `toolChoice === 'none'`일 때 `requestParams.tool_choice`를 설정하지 않거나(`undefined`로 두거나), `params.tools`를 포함하지 않는 방향으로 수정할 것.

```typescript
// 현재 (문제 있음)
} else {
  requestParams.tool_choice = base; // base = { type: 'none' } as never
}

// 제안
// toolChoice === 'none' 분기에서는 tool_choice를 아예 설정하지 않음
if (params.toolChoice !== 'none') {
  requestParams.tool_choice = { ...base, disable_parallel_tool_use: false };
}
// toolChoice === 'none'인 경우 tool_choice 미설정 → API 기본값(auto) 동작
```

---

**[WARNING] `stream as unknown as AsyncIterable<Anthropic.MessageStreamEvent>` — SDK 타입 불일치**
- 위치: `anthropic.client.ts:247`
- 상세: `this.client.messages.create(requestParams)` (streaming 모드)의 반환 타입이 `AsyncIterable<MessageStreamEvent>`를 직접 만족하지 않아 이중 캐스트(`as unknown as`)가 필요한 상황이다. 이는 Anthropic SDK의 스트리밍 반환 타입이 버전에 따라 다르게 정의됨을 의미한다. 현재 사용 중인 SDK 버전에서 스트리밍 API는 `.stream()` 헬퍼나 `.messages.stream()` 을 통해 직접 `AsyncIterable`을 반환받는 경로가 공식 권장 방법이다.
- 제안: `@anthropic-ai/sdk` 버전을 `package.json`에 명시적으로 고정(`"^0.26.0"` 등)하고, SDK 공식 스트리밍 API(`client.messages.stream()`)를 사용하는 방향으로 마이그레이션 검토. 이중 캐스트는 SDK 업그레이드 시 런타임 오류를 타입 검사에서 잡지 못하게 한다.

---

**[INFO] `disable_parallel_tool_use` — 최소 SDK 버전 요구**
- 위치: `anthropic.client.ts:77, 209`
- 상세: `tool_choice` 객체의 `disable_parallel_tool_use` 필드는 비교적 최근 Anthropic SDK 버전에서 추가된 필드다. 이 필드를 사용하려면 해당 타입 정의를 포함한 SDK 버전이 필요하다.
- 제안: `package.json`의 `@anthropic-ai/sdk` 버전 하한을 이 필드가 포함된 버전 이상으로 고정할 것. `// requires @anthropic-ai/sdk >= x.y.z` 형태의 최소 버전 주석 추가 고려.

---

**[INFO] `@workflow/expression-engine` — 내부 워크스페이스 패키지**
- 위치: `system-prompt.ts:1`
- 상세: `@workflow/` 네임스페이스의 내부 모노레포 패키지로, 외부 의존성이 아니다. 의존성 자체는 적절하나, `getAllFunctionNames()` 결과를 모듈 스코프 캐시(`expressionReferenceCache`)에 저장하는 구조이므로 이 패키지의 변경이 프로세스 재시작 없이는 반영되지 않는다는 점은 설계 의도와 일치한다.
- 제안: 현 구조 유지 적절. 다만 테스트에서 `resetExpressionCacheForTesting()` 호출이 필요한 이유가 바로 이 캐시 때문임을 `@workflow/expression-engine` mock 시 인지해야 한다.

---

**[INFO] `EXECUTION_STATUS_VALUES` — 서비스 레이어에서 상수 직접 참조**
- 위치: `tool-definitions.ts:2`
- 상세: 도구 정의 파일이 `explore-tools.service.ts`에서 도메인 상수를 직접 import한다. 이 상수가 서비스 구현 파일에 위치하면, 나중에 서비스 리팩토링 시 도구 스키마도 같이 수정해야 하는 결합이 생긴다.
- 제안: `EXECUTION_STATUS_VALUES`를 별도 상수 파일(예: `execution.constants.ts`)로 분리하면 단방향 의존을 유지하기 쉬워진다. 현재 구조가 동작에 문제는 없으나 구조적 개선 여지가 있다.

---

### 요약

외부 의존성 추가는 없으나 기존 의존성 사용 방식에 두 가지 실질적 위험이 존재한다. Zod v4 전용 API(`.meta()`, `z.toJSONSchema()`)를 사용하면서 `package.json`에 v4 이상으로 버전이 고정되어 있지 않다면 CI/배포 환경에서 런타임 오류가 발생할 수 있다. `@anthropic-ai/sdk`에서 `{ type: 'none' } as never` 캐스트는 존재하지 않는 API 값을 Anthropic 서버로 전송하게 되어 런타임 오류를 유발할 가능성이 있으며, 이중 캐스트(`as unknown as AsyncIterable`)는 SDK 버전 업그레이드 시 타입 검사망을 우회해 무음 장애로 이어질 수 있다.

---

### 위험도

**MEDIUM**