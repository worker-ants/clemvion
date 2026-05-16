# 문서화(Documentation) 리뷰

## 발견사항

### 파일 1: integration-oauth.service.cafe24.spec.ts

- **[INFO]** `buildFakeCafe24Integration` JSDoc 품질 양호 — 신규 추가된 테스트 factory 함수에 목적·배경·ai-review 출처까지 기술된 JSDoc 블록이 포함되어 있다. 인라인 파라미터 설명(`/** plain \`mall_id\` 컬럼 */`, `/** credentials.mall_id ... */`)도 명확하다.
  - 위치: `backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts` 라인 35-41
  - 상세: 테스트 파일임을 감안해도 문서화 기준이 잘 지켜졌다. 다만 함수 반환 타입이 `Record<string, unknown>`으로 느슨하게 선언되어 있어, 어떤 키가 반드시 존재하는지 독자가 JSDoc 없이 파악하기 어렵다.
  - 제안: 반환 타입에 대한 간략한 JSDoc `@returns` 설명을 추가하거나, 실제 entity 인터페이스를 참조하도록 타입을 좁히면 가독성이 향상된다.

---

### 파일 3: integrations.controller.ts

- **[INFO]** `@ApiOperation.description` 에 route-order 주의사항 추가 — 해당 설명은 Swagger UI 에 직접 노출되는 API 문서 텍스트이며, 운영상 필요한 맥락(`:id` 라우트 충돌 위험, spec 참조)을 명확히 담고 있다.
  - 위치: `backend/src/modules/integrations/integrations.controller.ts` 라인 370-371
  - 상세: 내용 자체는 유효하나, Swagger description 은 외부 API 소비자(프론트엔드·파트너)에게 노출된다. 구현 내부 사항("controller 코드 주석에 회귀 안전망 명시", "ai-review W21 조치")은 소비자 관점의 문서보다 코드 주석에 두는 것이 더 적합하다.
  - 제안: Swagger description 은 소비자가 API 를 사용할 때 필요한 정보(동작, 제한, 응답 형태)만 남기고, 내부 구현 근거·리뷰 추적은 코드 주석(`// route order note: ...`)으로 이동한다. spec 참조 링크는 그대로 유지해도 무방.

---

### 파일 4: integrations.service.ts

- **[INFO]** 트랜잭션 미적용 의사결정을 인라인 주석으로 문서화 — 4가지 근거(atomic INSERT, audit 순서, preview_token 원자 소비, spec 의도)가 구체적으로 서술되어 있어 향후 유지보수자가 불필요하게 트랜잭션 추가를 시도하지 않도록 가이드한다.
  - 위치: `backend/src/modules/integrations/integrations.service.ts` 라인 394-403
  - 상세: 복잡한 비즈니스 결정에 대한 인라인 설명이 잘 작성되어 있다. "향후 audit log 외 부작용이 추가되면 재검토" 라는 문구가 변경 조건을 명시한다.
  - 제안: 현재 상태로도 충분하다. 만약 이 결정이 spec 의 공식 설계 결정이라면 `spec/2-navigation/4-integration.md §Rationale` 에도 한 줄 기재하면 단일 진실 원칙이 강화된다 (선택 사항).

---

### 파일 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 18: metadata/*.ts (대량 operation 제거)

- **[WARNING]** Phase 8a-8j 완성 operation 블록 제거 — 다수 metadata 파일에서 "Phase 8x" 주석과 함께 묶였던 operation 항목들이 일괄 삭제되었다. 삭제된 operation 들은 `planned.ts` 의 `CAFE24_PLANNED_BY_RESOURCE` 로 이동되어 '계획됨(planned)' 상태로 재분류되었다.
  - 위치: `application.ts`, `collection.ts`, `community.ts`, `design.ts`, `mileage.ts`, `notification.ts`, `personal.ts`, `privacy.ts`, `promotion.ts`, `translation.ts` 전반
  - 상세: 코드 자체의 이동은 `planned.ts` 에서 확인되나, 왜 이미 구현된 operation 들을 다시 planned 상태로 되돌렸는지에 대한 설명이 diff 어디에도 없다. 삭제 이유를 알 수 없으면 후속 개발자가 planned 항목 구현 시 왜 Phase 8x 주석이 남아있는 이전 코드가 제거되었는지 혼란스러울 수 있다. `planned.ts` 파일이나 plan 문서에도 이 결정의 배경이 보이지 않는다.
  - 제안: `planned.ts` 상단 또는 파일 레벨 JSDoc에 "Phase 8x 에서 잠정 구현했다가 스코프 조정으로 다시 planned 로 환원한 배경" 한 단락을 추가한다. 또는 관련 spec/plan 문서의 Rationale 절에 동일 내용을 기재한다.

---

### 파일 13: planned.ts

- **[INFO]** `CAFE24_PLANNED_BY_RESOURCE` 에 대량 항목 추가 — planned 레지스트리가 상당히 확장되었으나 파일 레벨 또는 export 레벨의 설명 주석이 없어, 이 상수의 역할(UI 노드 선택기에서 "아직 구현되지 않은 operation 목록" 표시용)을 코드만으로 파악하기 어렵다.
  - 위치: `backend/src/nodes/integration/cafe24/metadata/planned.ts` 라인 339 이후
  - 상세: `CAFE24_PLANNED_BY_RESOURCE` 자체에 설명이 없으면 신규 기여자가 이 레지스트리에 항목을 추가해야 할 시점과 이유를 알기 어렵다.
  - 제안: `CAFE24_PLANNED_BY_RESOURCE` 앞에 간략한 JSDoc 또는 블록 주석 — "이 레지스트리에 등록된 operation 은 UI 노드 선택기에서 '지원 예정' 으로 표시되며, 구현 완료 후 해당 metadata 파일로 이동한다" — 를 추가한다.

---

### 파일 20: frontend/src/app/(main)/integrations/new/page.tsx

- **[INFO]** `AbortController` 도입 관련 인라인 주석 업데이트 — 기존 `cancelled` 플래그 설명 주석이 `AbortController`/`aborted` 방식 설명으로 적절히 갱신되었으며, ai-review 출처(INFO #6, 2026-05-16)도 명시되어 있다.
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx` 라인 188-196
  - 상세: 주석과 코드가 일치한다. 다만 `void err;` 라인에 주석이 없어 왜 에러를 무시하는지, AbortError 와 다른 에러를 구분하지 않고 함께 처리하는 의도가 코드만으로는 명확하지 않다.
  - 제안: `void err;` 옆에 `// includes AbortError — silent by design` 한 줄을 추가하면 의도가 명확해진다.

---

### 파일 21: frontend/src/lib/api/integrations.ts

- **[INFO]** `cafe24Precheck` JSDoc 업데이트 — `signal` 파라미터 추가에 맞춰 JSDoc 이 갱신되었고, 취소 목적(부하·throttle 절약)과 spec 참조까지 기술되어 있다.
  - 위치: `frontend/src/lib/api/integrations.ts` 라인 246-253
  - 상세: JSDoc 이 코드 변경과 동기화되어 있고 내용이 충분하다.
  - 제안: 현재 상태로 충분하다. `@param signal` JSDoc 태그를 명시적으로 추가하면 IDE 툴팁 지원이 강화되지만 필수는 아니다.

---

### 파일 22: plan/in-progress/cafe24-mall-dup-followup.md

- **[INFO]** plan 문서 frontmatter 및 구조가 프로젝트 컨벤션에 부합한다 — `worktree`, `started`, `owner` 세 필드가 모두 기재되어 있으며, 대상 항목 목록이 명확히 정리되어 있다.
  - 위치: `plan/in-progress/cafe24-mall-dup-followup.md`
  - 상세: 문서 자체는 잘 작성되어 있다. diff 에서 보이는 파일이 52 줄이므로 나머지 부분(체크박스 현황 등)은 확인되지 않으나, 형식상 문제는 없다.
  - 제안: 해당 없음.

---

## 요약

이번 변경은 문서화 관점에서 전반적으로 양호하다. 신규 추가된 `buildFakeCafe24Integration` factory 의 JSDoc, `integrations.service.ts` 의 트랜잭션 미적용 근거 주석, `cafe24Precheck` API 의 JSDoc 업데이트, controller 의 `@ApiOperation.description` 보강 등은 모두 코드 의도를 명확히 전달한다. 주요 개선 기회는 두 곳이다. 첫째, `@ApiOperation.description` 에 내부 구현 근거(ai-review 출처, route 충돌 매커니즘)가 외부 API 소비자용 문서에 노출되고 있어 소비자 관점 문서와 구현 주석을 분리하는 것이 바람직하다. 둘째, Phase 8x operation 들이 metadata 파일에서 삭제되어 `planned.ts` 로 이동된 이유(스코프 재조정)가 어디에도 문서화되어 있지 않아, 이 결정의 배경을 `planned.ts` 주석 또는 spec Rationale 에 남겨야 한다.

## 위험도

LOW
