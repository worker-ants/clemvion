### 발견사항

- **[INFO]** 새 외부 패키지 없음 — 변경 전/후 동일
  - 위치: 3개 파일 전체
  - 상세: 모든 변경은 기존 의존성(`vitest`, `@nestjs/testing`, `@nestjs/bullmq`, `@testing-library/react`, 내부 모듈) 범위 내에서 이루어짐. `package.json` 변경 없음.
  - 제안: 해당 없음

- **[INFO]** 내부 store 의존성 감소 — `addConversationMessage` 제거
  - 위치: `use-execution-events.ts:96`, `use-execution-events.ts:839`
  - 상세: `handleAiMessage` 콜백의 `useCallback` 의존성 배열에서 `addConversationMessage`가 제거됨. 레거시 fallback 경로가 삭제되면서 해당 store action 참조가 불필요해진 것으로, 의도된 범위 축소임. `execution-store` 내 `addConversationMessage` 자체는 삭제되지 않아 다른 소비자(예: `sendMessage` 호출부)에 영향 없음.
  - 제안: 해당 없음

- **[INFO]** `process.env.NODE_ENV` 분기 — 빌드 도구 의존
  - 위치: `use-execution-events.ts` diff, `handleAiMessage` 내부
  - 상세: `if (process.env.NODE_ENV !== "production")` 조건부 경고는 Next.js/webpack의 dead-code elimination에 의존함. 이 패턴은 이미 프로젝트 전반에서 관용적으로 사용 중이며 번들 크기에 영향 없음.
  - 제안: 해당 없음

- **[INFO]** 타입 선언에서 `requestPayload` / `responsePayload` 제거
  - 위치: `use-execution-events.ts` diff 309번째 줄 부근
  - 상세: 프론트엔드 payload 타입에서 flat 필드 두 개가 삭제됨. 이는 백엔드 emit 계약 변경(동일 브랜치의 `execution-engine.service.spec.ts` 테스트가 명시적으로 검증)과 동기화된 것으로, 내부 계약 정합성이 향상됨.
  - 제안: 해당 없음

---

### 요약

세 파일 모두 새 외부 패키지를 추가하지 않으며, 기존 의존성의 버전·라이선스·호환성에 영향을 주는 변경도 없다. 내부 의존성 측면에서는 `addConversationMessage` store action 참조가 `useExecutionEvents`에서 제거되어 의존 범위가 오히려 축소되었고, 백엔드 spec 테스트와 프론트엔드 타입 선언이 동일한 payload 계약(llmCalls + messages snapshot 필수, flat fields 제거)으로 정렬되어 내부 모듈 간 계약 일관성이 강화되었다.

### 위험도

**NONE**