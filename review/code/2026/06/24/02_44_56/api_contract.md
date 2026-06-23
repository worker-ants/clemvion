# API 계약(API Contract) 리뷰 결과

## 발견사항

### [INFO] `PATCH /api/triggers/:id` — interaction 객체 전체 교체 방식의 부분 업데이트 위험
- **위치**: `codebase/frontend/src/components/web-chat/use-web-chat.ts` `useUpdateWebChatAppearance` (파일 27), `triggers.web-chat.spec.ts` update 테스트 (파일 5)
- **상세**: 외형(`appearance`)만 업데이트하는 의도이나, 클라이언트가 `interaction: { enabled: true, tokenStrategy: tokenStrategy ?? "per_execution", appearance }` 전체를 PATCH 바디로 전송한다. `tokenStrategy` 미정의 시 `"per_execution"` 으로 하드코딩 폴백하므로, 서버에 `"per_trigger"` 가 저장된 인스턴스를 운영 콘솔에서 외형만 수정해도 `tokenStrategy` 가 `"per_execution"` 으로 덮어써질 위험이 있다. `tokenStrategy` 는 `WebChatInstance.tokenStrategy` 에서 읽어 전달하지만, 목록 응답에서 `undefined` 로 올 경우 폴백이 작동한다.
- **제안**: `tokenStrategy` 폴백 기본값 적용 전 서버 기존 값을 반드시 포함시키거나, 백엔드가 appearance 전용 PATCH 서브 경로(`PATCH /triggers/:id/appearance`)를 분리해 interaction 나머지 필드를 서버에서 보존하는 방식을 장기 고려. 단기적으로는 `tokenStrategy ?? "per_execution"` 폴백이 기존 `"per_trigger"` 를 silently override 할 수 있다는 점을 주석으로 명시할 것.

---

### [INFO] `GET /api/triggers?interactionEnabled=true` — boolean 쿼리 파라미터 Transform 범위
- **위치**: `codebase/backend/src/modules/triggers/dto/query-trigger.dto.ts` (파일 2), `triggers.service.ts` (파일 4)
- **상세**: `@Transform(({ value }) => value === true || value === 'true')` 구현은 `'false'` 를 올바르게 `false` 로 변환하고, `'true'` 를 `true` 로 변환한다. 단 `'1'` / `'0'` / `'yes'` / `'no'` 같은 대체 boolean 표현은 모두 `false` 로 처리된다. 이는 의도된 동작이며 주석에도 명시되어 있다. Swagger `ApiPropertyOptional` 에 `type: Boolean` + `example: true` 로 올바르게 문서화되어 있어 API 계약상 문제 없음.
- **제안**: 현 상태 유지. 주석이 이미 이 선택의 근거를 충분히 설명함.

---

### [INFO] `WebChatAppearanceDto` — `suggestions` 필드의 타입이 줄바꿈 구분 문자열
- **위치**: `codebase/backend/src/modules/triggers/dto/web-chat-appearance.dto.ts` (파일 3)
- **상세**: `suggestions` 가 `MaxLength(1000)` 의 단일 문자열(줄바꿈 구분)로 설계되어 있다. API 관점에서 배열(`string[]`)이 더 명시적이나, 현재 설계는 spec 및 프론트엔드 textarea 원문 그대로 보존하는 의도로 일관성 있게 구현되어 있다. Swagger `ApiPropertyOptional` 에 `maxLength` 가 명시되어 있어 계약 상 명확하다.
- **제안**: 현 상태 유지. 단 향후 API 버전 업 시 `string[]` 마이그레이션을 고려.

---

### [INFO] e2e mock 의 응답 shape 가 실제 API 봉투 구조를 올바르게 반영
- **위치**: `codebase/frontend/e2e/helpers/mock-auth.ts` (파일 13), `codebase/frontend/e2e/web-chat/console.spec.ts` (파일 14)
- **상세**: mock 응답이 `{ data: ... }` / `{ data: [...], pagination: { page, limit, totalItems, totalPages } }` 형태로 backend `TransformInterceptor` 봉투 구조를 정확히 재현하고 있다. `triggersBody()` 의 페이지네이션 필드명(`totalItems`, `totalPages`)이 서버 규약과 정합하는지 확인이 필요하나, 기존 스펙(`spec/conventions/swagger.md §2-5`)과 `normalizePagedResponse` 구현을 기준으로 일관됨.
- **제안**: 현 상태 유지.

---

## 요약

이번 변경은 기존 `PATCH /api/triggers/:id` 엔드포인트의 request body에 `config.interaction.appearance` 서브필드를 추가하고, `GET /api/triggers` 에 `interactionEnabled` 쿼리 파라미터를 추가하는 내용이다. 두 변경 모두 기존 API 필드를 제거하거나 타입을 변경하지 않는 순수 additive 확장이므로 **하위 호환성 위반(breaking change)은 없다**. 요청 검증은 `class-validator` 데코레이터(enum, 패턴, 길이)로 다층 방어되어 있으며, 응답 봉투 구조도 기존 `{ data }` / `{ data, pagination }` 컨벤션을 준수한다. API 버전은 현재 버전 prefix 없는 단일 버전 체계를 그대로 유지하며, 신규 필드가 optional 로 처리되어 기존 클라이언트에 영향을 주지 않는다. 유일한 주의사항은 외형 PATCH 시 `tokenStrategy` 폴백이 기존 `"per_trigger"` 설정을 silent override 할 수 있는 가능성으로, 이는 INFO 수준의 운영 주의사항이다.

## 위험도

LOW
