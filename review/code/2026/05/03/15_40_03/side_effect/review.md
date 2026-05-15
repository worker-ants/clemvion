## 발견사항

### [WARNING] `filterAiNoLlmProviderError` 내부의 DB 쿼리 실패 시 오류 전파 경로 오염
- **위치**: `execution-engine.service.ts` — `filterAiNoLlmProviderError` / `executeNode` 호출 지점
- **상세**: `this.llmService.hasDefaultLlmConfig(workspaceId)`가 throw하면(DB 연결 오류 등), 예외가 `executeNode`의 catch 블록까지 올라가 error policy handler가 `INVALID_NODE_CONFIG`가 아닌 DB 에러 메시지로 노드를 실패 처리한다. 사용자 관점에서는 "LLM provider를 선택하라"는 구성 오류와 "DB 장애"가 동일한 코드 경로를 타게 된다.
- **제안**: `filterAiNoLlmProviderError` 내부에서 `hasDefaultLlmConfig` 호출을 try/catch로 감싸고, 예외 시 원본 errors를 그대로 반환하도록 fail-safe 처리 추가.

```typescript
try {
  const hasDefault = await this.llmService.hasDefaultLlmConfig(workspaceId);
  if (!hasDefault) return errors;
  return errors.filter((e) => e !== AI_NO_LLM_PROVIDER_MESSAGE);
} catch {
  return errors; // DB 장애 시 원본 검증 결과 유지
}
```

---

### [WARNING] `resolveConfig` 에러 메시지 문자열 변경으로 인한 잠재적 클라이언트 파싱 오류
- **위치**: `llm.service.ts` — `resolveConfig` 메서드
- **상세**: 기존 메시지 `'No LLM config specified and no default provider configured'`가 한국어 문자열로 교체됐다. 프론트엔드나 통합 테스트에서 이 메시지 문자열에 직접 의존하는 코드가 있다면 조용히 깨진다. payload에 `workspaceId` 필드가 추가된 것은 additive이므로 문제없으나, 기존 `code: 'LLM_CONFIG_NOT_FOUND'`를 보고 영어 `message`를 파싱하던 클라이언트가 있을 경우 오작동 가능성이 있다.
- **제안**: `code: 'LLM_CONFIG_NOT_FOUND'`가 이미 구조화된 식별자 역할을 하므로 클라이언트는 `code`만 체크하도록 가이드. 기존 테스트 `'should throw when no config available'`는 타입 체크만 하므로 통과하지만, 영어 메시지를 문자열 비교하는 테스트나 클라이언트 코드가 있는지 전체 코드베이스에서 확인 필요.

---

### [WARNING] `LlmConfigSelector` 로딩 중 "기본 LLM 미설정" 힌트 플리커
- **위치**: `llm-config-selector.tsx` — `!defaultConfig && value === ""` 조건
- **상세**: `useQuery`가 fetch 중일 때 `configs`는 `[]`이므로 `defaultConfig === undefined`가 된다. `value`가 `""`이면 힌트 문구(`워크스페이스 기본 LLM이 설정되어 있지 않아요`)가 잠시 표시됐다가 데이터 도착 후 사라지는 플리커가 발생한다. 실제 기본 LLM이 있는 워크스페이스에서도 초기 렌더링 시 이 경고가 노출된다.
- **제안**: `isLoading` 또는 `isPending` 상태를 조건에 추가.

```tsx
{!isLoading && !defaultConfig && value === "" ? (
  <p ...>{t("nodeConfigs.llmConfigSelector.noDefaultHint")}</p>
) : null}
```

---

### [INFO] `WorkflowCanvas`에 새로운 네트워크 쿼리 추가
- **위치**: `workflow-canvas.tsx` — `useQuery({ queryKey: ["llm-configs"] })`
- **상세**: 캔버스 마운트 시 LLM 설정 목록을 fetch하는 쿼리가 추가됐다. `CustomNode`와 동일한 query key를 공유하므로 중복 요청은 없으나, `CustomNode`가 아직 마운트되지 않은 초기 상태(빈 캔버스)에서는 캔버스가 독자적으로 요청을 발생시킨다. 이 자체가 문제는 아니지만, 노드가 하나도 없는 초기 빈 워크플로우에서도 LLM 설정 조회가 발생하는 것은 의도한 동작인지 확인 필요.

---

### [INFO] AI 노드 실행 경로에 per-node DB 쿼리 추가
- **위치**: `execution-engine.service.ts` — `filterAiNoLlmProviderError`
- **상세**: `AI_LLM_PROVIDER_NODE_TYPES`에 해당하는 노드(ai_agent, text_classifier, information_extractor)가 실행될 때마다 `hasDefaultLlmConfig` → `llmConfigService.findDefault` DB 쿼리가 발생한다. 단일 워크플로우에 AI 노드가 여럿 있을 경우 쿼리가 N번 발생한다. `hasDefaultLlmConfig` 자체에는 캐싱이 없다.
- **제안**: 단기적으로는 무시해도 되는 수준이나, 향후 AI 노드가 많아지면 실행 컨텍스트 레벨에서 워크스페이스당 1회 조회 후 메모이제이션하는 것이 바람직하다.

---

## 요약

이번 변경은 AI 노드의 "no-llm-provider" 검증 오류를 실행 시점에 워크스페이스 기본 LLM 존재 여부에 따라 필터링하는 후처리 로직과, 그에 따른 UI 개선(셀렉터 기본값 레이블 표시, 기본 LLM 미설정 힌트)이 핵심이다. SSOT 상수 파일 분리와 테스트 보강도 동반됐다. 전반적으로 구조는 건전하나, DB 오류 전파 경로 오염(filterAiNoLlmProviderError 미보호), resolveConfig 에러 메시지 문자열 교체에 따른 호출자 영향, 로딩 중 UI 힌트 플리커의 세 가지 부작용에 주의가 필요하다.

## 위험도

**LOW** (기능적 정확성은 유지되나 오류 처리 경계와 UI 상태 관리에서 개선 여지 있음)