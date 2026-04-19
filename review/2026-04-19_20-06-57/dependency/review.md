### 발견사항

- **[INFO]** 외부 패키지 의존성 변경 없음
  - 위치: 전체 변경사항
  - 상세: `package.json` 변경이 없으며 신규 외부 라이브러리 도입이 없음. 모든 의존성 변화는 내부 모듈 간 결합도에 국한됨.
  - 제안: 해당 없음.

---

- **[WARNING]** `send-email.handler.ts` — 항상 동일 값을 반환하는 데드 코드 분기
  - 위치: `send-email.handler.ts` +167
  - 상세: `const code = err instanceof IntegrationError ? 'EMAIL_SEND_FAILED' : 'EMAIL_SEND_FAILED'` — 두 분기 모두 동일한 리터럴. `IntegrationError` 전용 코드(`INTEGRATION_TYPE_MISMATCH`, `INTEGRATION_NOT_CONNECTED`, `INTEGRATION_INCOMPLETE`)가 `output.error.code`에서 소실되고, `details.integrationCode`에만 남음. 이 결정이 의도적이라면 삼항 연산자 자체를 제거해야 하며, 의도적이지 않다면 로직 버그임.
  - 제안: 의도라면 `const code = 'EMAIL_SEND_FAILED'` 로 단순화. 아니라면 `err instanceof IntegrationError ? err.code : 'EMAIL_SEND_FAILED'` 복원.

---

- **[WARNING]** `handler-output.adapter.ts` — `isLegacyPortSelector` 제거로 발생하는 암묵적 결합 위험
  - 위치: `handler-output.adapter.ts` -136 ~ -148
  - 상세: `{ port, data, ...rest }` 포트 선택자 형태를 처리하던 브랜치가 제거됨. 아직 마이그레이션되지 않은 핸들러가 있을 경우 해당 shape는 bare-object 경로로 폴스루되어 `meta`에 폴딩되던 `rest` 필드가 무음 소실됨. 현재 커밋에서 모든 핸들러가 마이그레이션된 것으로 보이나, 외부 플러그인/확장 핸들러가 존재하면 런타임 회귀 위험이 있음.
  - 제안: 제거 전에 코드베이스 전체에서 `{ port, data }` shape를 반환하는 핸들러가 없음을 Grep으로 검증하거나, 제거 대신 deprecated 경고 로그만 남기는 단계적 제거 적용.

---

- **[WARNING]** `information-extractor.schema.ts` — `meta.durationMs` 필수 선언 후 `.partial()` 적용으로 인한 타입 불일치
  - 위치: `information-extractor.schema.ts` +161
  - 상세: `durationMs: z.number()` 가 `.partial()` 체인 안에 있어 실제로는 선택적(`optional`)임. 그러나 스키마 JSDoc에는 `필수`로 문서화되어 있고, `information-extractor.schema.spec.ts`의 error-port 픽스처는 `meta: { durationMs: 3200 }` 만 포함하여 나머지 필드가 없음. 의도와 구현 사이 불일치가 다운스트림 코드에서 타입 오해를 야기할 수 있음.
  - 제안: 실제로 필수라면 `.partial()`에서 분리하거나, 선택적이라면 `.optional()`을 명시적으로 표기.

---

- **[WARNING]** `output-shape.ts` `isConversationOutput` — 신구 형태 판별 로직의 취약한 결합
  - 위치: `output-shape.ts` +120~142
  - 상세: `looksLikeConversationEnd` 조건에서 `endReason` 값 목록(`'completed' | 'user_ended' | 'max_turns' | 'max_retries'`)을 하드코딩. 백엔드에서 새로운 `endReason` 값이 추가되면 프론트엔드 판별 로직이 조용히 누락됨. 백엔드 `endReason` 상수와 공유 타입이 없어 결합이 암묵적.
  - 제안: 공유 타입 패키지 또는 `consts` 파일에 `END_REASONS` 배열/유니온을 선언하고 양쪽이 참조하도록 리팩터링.

---

- **[INFO]** `conversation-utils.ts` — 신구 두 경로를 모두 읽는 레거시 호환 레이어의 생명주기 미정의
  - 위치: `conversation-utils.ts` +40~85
  - 상세: `meta.turnDebug` (신형)와 `output._turnDebugHistory` (구형), `meta` (신형)와 `output.metadata` (구형)를 모두 fallback으로 처리함. 이 호환 레이어가 언제 제거될지 명시적인 마이그레이션 타임라인이 없으면 코드가 영구적으로 복잡하게 유지됨.
  - 제안: TODO 또는 GitHub Issue 링크로 레거시 경로 제거 시점을 명시.

---

- **[INFO]** `NodeHandlerOutput._resumeState` 추가 — 인터페이스 소유권 경계 확인 필요
  - 위치: `node-handler.interface.ts` +71
  - 상세: `_resumeState`는 엔진 내부 상태이므로 핸들러 공용 인터페이스보다 엔진 전용 내부 타입에 위치하는 것이 더 적절할 수 있음. 현재 구조에서는 모든 핸들러 구현체가 이 필드를 노출할 수 있어 캡슐화 경계가 흐릿해짐.
  - 제안: `EngineNodeHandlerOutput extends NodeHandlerOutput` 형태로 엔진 전용 확장 타입을 분리하는 방안 검토.

---

### 요약

이번 변경은 신규 외부 패키지 도입이 없고 버전 충돌·라이선스·번들 크기 문제도 없어 외부 의존성 관점의 위험은 없음. 내부 의존성 측면에서는 `handler-output.adapter.ts`의 레거시 포트 선택자 브랜치 제거, `send-email`의 데드 코드 분기, `isConversationOutput`의 하드코딩된 `endReason` 목록이 주요 주의 사항이며, 레거시 호환 레이어가 생명주기 정의 없이 누적될 경우 장기적인 유지보수 부담이 증가할 수 있음.

### 위험도

**LOW**