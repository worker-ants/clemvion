### 발견사항

---

**[WARNING]** Google 클라이언트 스트림 처리의 타입 안전성 회귀
- 위치: `google.client.ts` — `stream()` 메서드
- 상세: 신 SDK 마이그레이션 후 `stream`을 `AsyncIterable<unknown>`으로 선언하고 루프 내에서 `raw as { candidates?: ... }`로 인라인 캐스팅. 이전 SDK는 SDK 타입으로 안전하게 추론됐으나, 이제 런타임 형태가 변경돼도 컴파일러가 잡지 못함. 보안 민감 스트림 경로에서의 타입 우회임.
- 제안: `@google/genai` SDK가 `GenerateContentResponse` 타입을 export하는지 확인 후 명시적 타입 적용. 없다면 별도 `interface GoogleStreamChunk`를 선언해 `as` 캐스트를 한 곳으로 격리.

---

**[WARNING]** Google API 제약 설명 주석 일괄 제거
- 위치: `google.client.ts` — `buildContents()`, `buildGenerationConfig()`, `sanitizeGeminiSchema()` 등
- 상세: 이전 코드에는 "`responseMimeType` + tools 동시 사용 시 400 반환", "`function` role은 user role과 분리 필수", "ObjectSchema에 빈 properties 금지" 등 Google API의 비자명한 제약을 설명하는 주석이 있었음. 이번 변경에서 대부분 제거됨. CLAUDE.md 방침("WHY가 비자명한 경우에만 주석 작성")에 비춰도, 이 주석들은 외부 API의 숨겨진 제약이라 유지 대상임.
- 제안: 제거된 주석 중 외부 API 제약(400 반환 조건, role alternation 규칙)을 설명하던 것들만 복원.

---

**[WARNING]** `LlmConfigService`의 `isDefault` 트랜잭션 패턴 중복
- 위치: `llm-config.service.ts` — `create()` L98~125, `update()` L146~175
- 상세: `isDefault=true` 전환 시 "기존 default 해제 → 본인 저장" 트랜잭션 블록이 두 메서드에 거의 동일하게 복사됨. 비즈니스 불변식(워크스페이스당 default 1개)을 한 곳에서 관리하지 않아, 미래에 한 쪽만 수정되면 불일치 발생 가능.
- 제안:
```typescript
private async setAsDefault(
  manager: EntityManager,
  workspaceId: string,
  entity: LlmConfig,
): Promise<LlmConfig> {
  await manager.update(LlmConfig, { workspaceId, isDefault: true }, { isDefault: false });
  return manager.save(LlmConfig, entity);
}
```
두 메서드가 이 private 메서드를 공유하도록 리팩토링.

---

**[INFO]** `isPrivateHost()` 함수의 위치 — 재사용성 및 테스트 용이성
- 위치: `llm.service.ts` 상단 (모듈 레벨 함수)
- 상세: SSRF 가드 로직이 서비스 파일에 인라인 정의됨. 현재는 단일 용도이지만, 향후 다른 URL 입력(Integration OAuth, HTTP Request 노드 등)에 동일 가드가 필요해질 수 있음. 별도 파일에 있으면 독립 단위 테스트도 용이.
- 제안: `backend/src/common/utils/network.util.ts`로 이동하고 해당 유틸리티에 집중 테스트 추가. 현재 구조에서 심각한 문제는 아님.

---

**[INFO]** 스펙 주석 참조 오류
- 위치: `llm.service.ts` — `previewModels()` 메서드 상단 주석
- 상세: `"spec §5.4"` 참조가 있으나 `spec/5-system/7-llm-client.md`에서 §5.4는 "Local (Ollama/vLLM)"이고, preview 기능은 §5.5임. 미미하지만 문서 추적 시 혼선 야기 가능.
- 제안: 주석을 `(spec §5.5)`로 수정.

---

**[INFO]** 프론트엔드 API 클라이언트의 이중 응답 구조 방어 코드
- 위치: `frontend/src/lib/api/llm-configs.ts` — `listModels()`, `previewModels()`
- 상세: `(data?.data ?? data)` 패턴이 추가됨. `TransformInterceptor`가 모든 응답을 `{ data: ... }`로 래핑한다면 `data?.data`만으로 충분하고, 그렇지 않으면 래핑 일관성 자체가 문제. 방어 코드가 시스템 불일치를 숨기고 있을 가능성.
- 제안: `GET /llm-configs/:id/models` 응답 구조가 `TransformInterceptor`를 거치는지 확인. 일관되게 래핑된다면 `data.data`로 단순화. 두 엔드포인트 간 구조가 다르다면 근본 원인 수정.

---

**[INFO]** `withTimeout()` 내부 reject 억제 패턴
- 위치: `llm.service.ts` — `withTimeout()` private 메서드
- 상세: `inner.catch(() => undefined)`로 Promise.race에서 진 쪽의 rejection을 명시적으로 억제. 의도적이고 주석도 있으나, abort 전파 시 내부 에러 정보가 완전히 소실됨. 현재는 `sanitizeErrorMessage()`가 상위에서 처리하므로 큰 문제 없음.
- 제안: 현 구조 유지, 단 추후 디버깅이 필요할 경우를 위해 `this.logger.debug` 수준으로 내부 에러를 선택적으로 기록하는 옵션 고려.

---

### 요약

이번 변경은 세 가지 아키텍처적 개선을 담고 있다: (1) Google AI SDK를 `@google/generative-ai`에서 `@google/genai`로 전면 마이그레이션하여 신 SDK의 flat API 패턴에 맞게 `chat`/`stream` 경로 재설계, (2) `previewModels` 기능 신설로 저장 전 자격증명으로 모델 목록 조회를 가능하게 하고 SSRF 가드·타임아웃·rate limit을 서비스 레이어에서 일관되게 처리, (3) `isDefault` 플래그 변경 시 race condition 방지를 위한 트랜잭션 도입. 전체적으로 레이어 분리와 패턴 일관성은 양호하나, Google 스트림 경로의 `as unknown` 캐스팅이 타입 안전성을 부분적으로 약화시키고, `isDefault` 트랜잭션 블록의 중복이 장기 유지보수 위험을 내포한다. 또한 Google API 제약을 설명하던 핵심 주석이 제거된 점은 신규 기여자 온보딩 측면에서 손실이다.

### 위험도

**MEDIUM** — Google 클라이언트의 스트림 타입 우회(`as unknown` 캐스트) 및 SDK 전면 교체가 런타임 회귀를 야기할 수 있는 구간이 존재하며, 통합 테스트 커버리지 확인이 필요함.