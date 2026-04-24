### 발견사항

---

**[WARNING] `llm-config.service.ts`: `isDefault` 트랜잭션 처리가 별도 버그픽스로 번들링됨**
- 위치: 파일 20, `create()`·`update()` 전체 재구성
- 상세: `create()`에서 `clearDefault()` 호출을 제거하고 트랜잭션으로 교체, `update()`도 동일 패턴으로 변경. 이는 race condition 수정이며 preview-models 기능과 무관한 독립적 버그픽스다. 기능 PR에 포함되면 추후 rollback 시 이 수정도 함께 사라질 위험이 있다.
- 제안: 별도 커밋/PR로 분리.

---

**[WARNING] `llm-config.controller.ts`: `clearClientCache` 호출 순서 변경이 번들링됨**
- 위치: 파일 19, `remove()` 메서드
- 상세: `this.llmService.clearClientCache(id)`를 `await this.llmConfigService.remove(id, workspaceId)` 뒤로 이동하고 설명 주석 추가. 이는 "캐시 삭제 후 DB 삭제 실패" 케이스를 막는 별도 버그픽스다.
- 제안: 기능 변경과 분리하거나, 최소한 커밋 메시지에 명시적으로 언급.

---

**[INFO] TypeScript `as unknown as T` 제거: 30개 이상 파일에 걸친 무관한 대규모 정리**
- 위치: 파일 2~9, 11~16, 26, 30~42 등 전체
- 상세: `as unknown as string[]`, `as unknown as string`, `null as unknown as string`, `as never` 등 불필요한 타입 단언 제거가 테스트 파일 20개 이상과 프로덕션 파일 여러 개에 일괄 적용됨. 이 변경들은 preview-models 기능과 완전히 무관하다. 특히 `condition-eval.util.ts`(파일 39), `ai-agent.handler.ts`(파일 35), `integration-oauth.service.ts`(파일 14)는 LLM 모델 목록 기능과 연관 없는 파일들이다.
- 제안: 타입 정리는 독립 PR로 분리. 기능 PR에서 직접 수정이 필요한 파일(llm 클라이언트, 서비스)의 타입 정리만 포함.

---

**[INFO] `google.client.ts`: SDK 마이그레이션 중 동작 설명 주석 다수 제거**
- 위치: 파일 24, `buildContents()`, `sanitizeGeminiSchema()`, `chat()`, `stream()` 등
- 상세: `@google/generative-ai` → `@google/genai` SDK 마이그레이션은 범위 내이나, 마이그레이션 과정에서 Gemini role 규칙, `functionResponse` 처리, `responseMimeType` 제약 등 비직관적 동작을 설명하던 주석들이 제거되거나 축약됨. 일부 주석은 왜 이 코드가 이렇게 작성되었는지 알려주는 유일한 단서였다.
- 제안: SDK 마이그레이션과 무관한 설명 주석(Gemini 스펙 설명)은 유지하거나 SDK 변경에 맞게 업데이트.

---

**[INFO] `llm-config.controller.ts`: 기존 `GET :id/models`에 `@Throttle` 추가**
- 위치: 파일 19, `listModels` 핸들러
- 상세: preview-models 엔드포인트에 rate limit을 추가하면서 기존 `GET :id/models`에도 동일한 throttle이 추가됨. 기존 동작 변경이므로 의도적인지 확인 필요.
- 제안: 의도적이라면 CHANGELOG/스펙에 명시.

---

### 요약

이번 변경의 핵심은 **preview-models 엔드포인트 신설, Google SDK 마이그레이션, 프로바이더별 실시간 모델 조회, 프론트엔드 ModelCombobox 통합**이며, 이들은 응집도 높은 하나의 기능으로 간주할 수 있다. 그러나 그 안에 **`isDefault` race condition 트랜잭션 수정**이라는 독립적 버그픽스와, **30개 이상 파일에 걸친 TypeScript 타입 단언 정리**라는 대규모 코드 정리가 섞여 있다. 이 두 번들링이 이번 변경의 주요 범위 이탈이다. 기능 자체는 명확하게 구현되었고 스펙·문서·테스트도 일관성 있게 갱신되었으나, 향후 커밋 이력 추적이나 rollback 시 불필요한 복잡성이 발생할 수 있다.

### 위험도

**LOW**