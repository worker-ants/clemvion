## 발견사항

### **[WARNING]** Google 클라이언트 리팩토링 중 중요 주석 제거
- **위치**: `google.client.ts` — `buildContents()` (구 `buildChatInputs()`), `sanitizeGeminiSchema()`
- **상세**: 구 `buildChatInputs`에 있던 Gemini API의 role 제약 설명 ("`role: 'user'`에 `functionResponse` part를 넣으면 SDK가 400을 반환"하는 이유, `'model'`·`'user'`·`'function'` 세 role 구분)이 새 `buildContents`에서 세 줄 요약으로 축소됐다. 또한 `sanitizeGeminiSchema` 내부에서 `ObjectSchema.properties`가 비어 있으면 null을 반환하는 이유, `ArraySchema`에서 items가 없으면 전체 array를 drop하는 이유를 설명한 주석이 제거됐다. 이 내용들은 코드만으로는 추론하기 어려운 Gemini API의 비공개 제약 사항이다.
- **제안**: `buildContents` 상단 주석에 "role: 'function'은 functionResponse 전용이며, role: 'user'에 넣으면 SDK 400 오류 발생" 한 줄이라도 복원 권장. `sanitizeGeminiSchema`의 null 반환 분기에 "Gemini ObjectSchema는 빈 properties를 거부" 인라인 주석 복원 권장.

---

### **[WARNING]** `fnCallToToolCall` 헬퍼 함수 미문서화
- **위치**: `google.client.ts` — `chat()` 내 `fnCallToToolCall(part.functionCall)` 호출
- **상세**: diff에서 `fnCallToToolCall` 함수가 새로 사용되지만 해당 함수의 정의나 시그니처가 diff에 포함되어 있지 않다. 인터페이스 문서(`llm-client.interface.ts`)나 spec에도 이 헬퍼가 언급되지 않는다.
- **제안**: 함수 정의 위치를 spec 또는 파일 상단 주석에 명시하거나, 함수 자체에 한 줄 주석("FunctionCall → ToolCall 변환, id가 없으면 uuid 생성") 추가.

---

### **[INFO]** `isPrivateHost` SSRF 가드 — 의도적 한계 명시 우수
- **위치**: `llm.service.ts` — `isPrivateHost()` 함수 블록 주석
- **상세**: DNS rebinding을 차단하지 않는 이유, `local` 프로바이더를 예외로 두는 이유, rate limit으로 완화한다는 설명이 구체적으로 기술되어 있다. 보안 관련 의도적 한계를 문서화한 좋은 사례.

---

### **[INFO]** `withTimeout` 패턴 — no-op catch 목적 주석 적절
- **위치**: `llm.service.ts` — `withTimeout()` private 메서드
- **상세**: `inner.catch(() => undefined)` 의 이유("abort 전파로 SDK가 reject하면 unhandled rejection 방지")가 주석으로 설명되어 있다. 비자명 패턴에 대한 주석으로 적절.

---

### **[INFO]** `llm-client.interface.ts` — JSDoc 추가 적절
- **위치**: `llm-client.interface.ts:listModels`
- **상세**: `signal?: AbortSignal` 파라미터에 대해 "service layer의 timeout wrapper가 deadline 초과 시 소켓을 해제하기 위해 사용"이라는 JSDoc이 추가됐다. 인터페이스 계약에 의도가 명확히 기술되어 있다.

---

### **[INFO]** spec 문서 동기화 양호
- **위치**: `spec/5-system/7-llm-client.md`, `spec/2-navigation/6-config.md`
- **상세**: Google AI 클라이언트 섹션(5.3) 신설, preview-models 섹션(5.5) 신설, 에러 코드 테이블 3개 항목 추가, API 엔드포인트 테이블 업데이트가 모두 반영되어 있다.

---

### **[INFO]** 사용자 문서(mdx) 및 i18n 동기화 양호
- **위치**: `llm-config.en.mdx`, `llm-config.mdx`, `en.ts`, `ko.ts`
- **상세**: preview-models 엔드포인트 동작, "모델 불러오기" UX 흐름, API key 미저장 보장이 한/영 모두 반영됐다. i18n 키 5개(`loadModels`, `loadingModels`, `loadModelsHint`, `noModelsFound`, `loadModelsFailed`)가 양 언어에 동일하게 추가되어 있다.

---

### **[INFO]** 캐시 순서 변경 주석 — 신설됐으나 길이 과다
- **위치**: `llm-config.controller.ts:remove()` — 2행 주석
- **상세**: `clearClientCache`를 `remove` 이후로 이동한 이유를 주석으로 설명한다. 이유는 타당하나, 주석 지침("WHY가 비자명할 때만")을 약간 초과하는 길이. "DB 삭제 성공 후 캐시 제거 — 역순이면 삭제 실패 시 레코드 잔존" 정도로 단축 가능.

---

## 요약

이번 변경에서 API 문서(Swagger 데코레이터), 스펙 문서(`spec/`), 사용자 문서(mdx), i18n 문자열은 새 preview-models 기능에 맞게 일관되게 업데이트됐다. `isPrivateHost`의 SSRF 가드와 `withTimeout`의 no-op catch 패턴 등 비자명 로직에는 적절한 주석이 달려 있다. 주요 누락은 Google SDK 마이그레이션 과정에서 Gemini API의 role 제약(`function` role 분리 이유)과 `sanitizeGeminiSchema`의 null 반환 조건에 대한 설명 주석이 제거된 점으로, 향후 구글 클라이언트를 수정하는 개발자가 같은 API 제약을 재학습해야 할 위험이 있다.

## 위험도

**LOW**