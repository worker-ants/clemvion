### 발견사항

---

**[WARNING] `context.variables.__workspaceId` 신뢰 경계 불명확 — IDOR 가능성**
- 위치: `execution-engine.service.ts` `filterAiNoLlmProviderError` (추가된 메서드)
- 상세: 보안 결정(`no-llm-provider` 오류 억제 여부)의 핵심 값인 `workspaceId`를 `context.variables.__workspaceId`에서 읽는다. `context.variables`가 워크플로우 expression 평가 결과나 사용자 입력 데이터를 포함한다면, 공격자가 자신의 실행 컨텍스트에 `__workspaceId: "타 워크스페이스 ID"`를 주입해 다른 워크스페이스의 기본 LLM 존재 여부를 탐색하거나, LLM 미설정 검증을 우회할 수 있다.
  ```typescript
  const workspaceId =
    (context.variables?.__workspaceId as string | undefined) || '';
  ```
- 제안: `__workspaceId`가 반드시 시스템이 주입하는 신뢰된 경로에서만 설정되는지 확인하고, 그렇지 않다면 `context` 자체에 전용 `workspaceId` 필드를 두어 user-land 변수(`variables`)와 분리한다. 테스트 픽스처 `buildContext`도 해당 분리를 반영하도록 업데이트한다.

---

**[WARNING] 에러 응답에 내부 식별자(`workspaceId`) 명시 노출**
- 위치: `llm.service.ts` `resolveConfig` 메서드 (변경된 throw 블록)
- 상세: `BadRequestException` 페이로드에 `workspaceId` 필드를 별도로 추가했다. 메시지 문자열에 이미 포함되어 있는 값을 구조화 필드로도 노출하면, API 응답을 파싱하는 자동화 스크립트가 다른 사용자의 workspace ID를 열거(enumeration)하는 데 활용할 수 있는 surface를 넓힌다.
  ```typescript
  throw new BadRequestException({
    code: 'LLM_CONFIG_NOT_FOUND',
    message: `워크스페이스(${workspaceId}) 에 기본 LLM...`,
    workspaceId,   // ← 구조화 필드로 중복 노출
  });
  ```
- 제안: 프론트엔드가 `workspaceId` 필드를 파싱해 활용하는 경우가 아니라면 페이로드에서 제거하고 메시지에만 포함한다. 활용이 필요하다면 인증된 요청에서 반환되는 자신의 ID임을 주석으로 명시한다.

---

**[INFO] 보안 분기를 사용자 노출 문자열 비교에 의존**
- 위치: `execution-engine.service.ts` `filterAiNoLlmProviderError`, `llm-provider-rule.ts`
- 상세: LLM 미설정 검증을 건너뛸지 결정하는 조건이 `errors.includes(AI_NO_LLM_PROVIDER_MESSAGE)`—즉 사용자에게 노출되는 한국어 문자열의 동일성 비교다. 상수(`AI_NO_LLM_PROVIDER_MESSAGE`)를 SSOT로 공유하는 설계가 주석으로 명시되어 있어 타이포 위험은 낮다. 그러나 i18n 확장이나 메시지 포맷 변경 시 비교가 무음으로 실패해 검증이 의도치 않게 통과될 수 있다.
- 제안: `handler.validate`의 반환 타입을 `{ id: string; message: string }[]`으로 확장하는 리팩토링이 범위를 초과한다면, 현재 설계의 한계(메시지 변경 시 필터 동작 불일치)를 `llm-provider-rule.ts`의 주석에 명시적으로 경고로 기재한다.

---

**[INFO] 프론트엔드 응답 구조 이중 참조 — 방어 코드의 구조 노출**
- 위치: `workflow-canvas.tsx` `defaultLlmConfigId` useMemo
- 상세: `data?.data ?? data`로 두 가지 응답 포맷을 동시에 처리한다. 이는 API 응답 구조가 일관되지 않음을 방어적으로 흡수하는 패턴인데, 실제로 두 포맷이 모두 가능하다면 동일한 엔드포인트에서 다른 인증 상태나 에러 경로가 다른 구조를 반환하는 경우를 무시(silent fallback)할 위험이 있다.
  ```typescript
  const configs: LlmConfigData[] =
    (llmConfigsData?.data as LlmConfigData[] | undefined) ??
    (llmConfigsData as LlmConfigData[] | undefined) ??
    [];
  ```
- 제안: API 응답 타입을 단일 구조로 정규화하거나, `llmConfigsApi.getAll()`의 반환 타입을 명시해 컴파일 타임에 구조를 보장한다.

---

### 요약

이번 변경은 AI 노드 실행 시 워크스페이스 기본 LLM 존재 여부에 따라 검증 오류를 후처리하는 로직을 추가했다. 전반적으로 하드코딩된 시크릿, SQL/커맨드 인젝션, XSS 등 명시적 취약점은 없다. 가장 주의해야 할 지점은 `filterAiNoLlmProviderError`가 `context.variables.__workspaceId`를 신뢰 없이 사용하는 구조로, 만약 `variables`가 사용자 expression 결과를 수용하는 공간이라면 다른 워크스페이스를 대상으로 한 IDOR 탐색 또는 검증 우회로 이어질 수 있다. 보안 결정에 사용하는 workspaceId는 user-land 변수가 아닌 시스템 전용 필드에서 읽도록 신뢰 경계를 명확히 하는 것이 권고된다.

### 위험도

**MEDIUM**