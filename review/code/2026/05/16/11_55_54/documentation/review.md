# 문서화(Documentation) 리뷰

## 발견사항

### 점검 관점 1 — 독스트링/JSDoc

- **[INFO]** `wrapOneOfDataSchema` 및 `ApiOkWrappedOneOfResponse` 함수 문서 추가 (파일 2)
  - 위치: `backend/src/common/swagger/api-wrapped.ts` L71-76, L98-103
  - 상세: 두 신규 공개 함수 모두 JSDoc 이 작성되어 있고, 사용 목적(분기 응답, oneOf 스키마)·예시 DTO 이름·Swagger 콘솔 동작까지 기술되어 있다. 문서화 수준이 기존 함수들과 일관되며 충분하다.
  - 제안: 현재 상태 유지. 추가 개선이 필요하다면 `dtos` 파라미터에 `@param` 태그를 명시할 수 있으나 필수 수준은 아니다.

- **[INFO]** `OAuthBeginPopupResultDto` / `OAuthBeginCafe24PendingResultDto` 분리 (파일 4)
  - 위치: `backend/src/modules/integrations/dto/responses/integration-response.dto.ts` L543-609
  - 상세: 단일 `OAuthBeginResultDto` 를 두 DTO 로 분리하면서 클래스 레벨 JSDoc 이 갱신되었고, 각 필드의 `@ApiProperty` description 도 분기별 의미에 맞게 명확해졌다. 기존 optional 필드 설명("Cafe24 Private 분기에서는 미존재")이 사라지고 각 DTO 가 스스로 강제하는 방식으로 변경되어 주석과 실제 타입이 일치한다.
  - 제안: 양호. `OAuthBeginPopupResultDto` 에는 클래스 레벨 JSDoc 이 없으므로, 간략한 한 줄 설명을 추가하면 Swagger 의 schemas 섹션에서 가독성이 향상된다.

- **[INFO]** `node-component.interface.ts` 주석 갱신 (파일 13)
  - 위치: `backend/src/nodes/core/node-component.interface.ts` L996
  - 상세: `validateConfig` 인터페이스의 JSDoc 에서 "Returns Korean messages" 를 "Returns warning messages" 로 수정하여 현재 코드(영문 메시지 SSOT 전환)와 정합성을 맞추었다. 주석 정확성 관점에서 정확한 수정이다.
  - 제안: 양호.

---

### 점검 관점 2 — README 업데이트

- **[INFO]** 신규 Swagger 헬퍼 함수 2개 추가 (파일 2)
  - 위치: `backend/src/common/swagger/api-wrapped.ts`
  - 상세: `wrapOneOfDataSchema` / `ApiOkWrappedOneOfResponse` 가 공개 API 로 추가되었다. 프로젝트의 `README.md` 는 실행 방법 중심 문서로 확인되고, 내부 헬퍼 수준의 변경은 README 반영 대상이 아닌 것으로 보인다. `spec/conventions/` 나 Swagger 관련 개발자 가이드가 있다면 업데이트가 필요할 수 있다.
  - 제안: `spec/conventions/swagger.md` (또는 유사 경로)가 존재한다면 `oneOf` 분기 응답 패턴과 새 헬퍼 사용법을 기재하는 것을 권장한다.

---

### 점검 관점 3 — API 문서

- **[INFO]** OAuth begin 엔드포인트 3개의 Swagger 문서 갱신 (파일 8)
  - 위치: `backend/src/modules/integrations/integrations.controller.ts` L140-148, L805-815, L822-832
  - 상세: `@ApiOkWrappedResponse(OAuthBeginResultDto, ...)` 를 `@ApiOkWrappedOneOfResponse([OAuthBeginPopupResultDto, OAuthBeginCafe24PendingResultDto], ...)` 로 교체하면서 각 엔드포인트의 `description` 에 분기별 응답 shape 이 명시되었다. Swagger 콘솔에서 `oneOf` 스키마가 두 DTO 를 개별 예시로 노출하도록 설계되어 API 사용자가 분기 구조를 명확히 이해할 수 있다.
  - 제안: `reauthorize` 엔드포인트(두 번째 `@ApiOkWrappedOneOfResponse`) 의 description 에 `scopesAdded?` 가 누락되어 있다(`request_scopes` 엔드포인트에는 포함됨). 일관성을 위해 `{ mode, integrationId, appUrl, callbackUrl, scopesAdded? }` 로 통일하는 것을 권장한다.

- **[INFO]** `third-party-oauth.controller.ts` — 단순 줄 줄임 포맷 변경 (파일 9)
  - 위치: `backend/src/modules/integrations/third-party-oauth.controller.ts` L853-856
  - 상세: `@ApiOkResponse` 의 description 문자열을 두 줄로 분리한 것은 순수 포맷 변경이며 내용 변경 없음. API 문서 영향 없음.
  - 제안: 해당 없음.

---

### 점검 관점 4 — 주석 정확성 (오래된 주석)

- **[INFO]** `.conf` 파일 주석 추가 — 정확하고 상세함 (파일 1)
  - 위치: `backend/migrations/V050__integration_cafe24_connected_rotated_idx.conf` L1-6
  - 상세: `executeInTransaction=false` 설정이 기존에는 주석 없이 단독으로 존재했으나, 이번 변경으로 `CREATE INDEX CONCURRENTLY` 와 Flyway 트랜잭션 감싸기의 관계, 잠금 최소화 목적을 설명하는 주석이 추가되었다. `V050__*.sql` 본문 주석을 참조하도록 연결하여 중복 없이 맥락을 제공한다. 주석 내용이 현재 코드와 정확히 일치한다.
  - 제안: 양호.

- **[INFO]** `integration-oauth.service.ts` — `urlToken` destructuring 제거 주석 (파일 7)
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts` L1715-1718
  - 상세: `urlToken` 을 `params` 에서 제거하면서 "caller-side documentation" 목적의 인라인 주석을 추가하여, 호출자가 파라미터를 전달하는 이유와 recovery 로직이 `mall_id` 에만 의존함을 명시했다. 주석이 변경된 코드와 정확히 대응한다.
  - 제안: 양호.

- **[INFO]** `llm-provider-rule.ts` — Language SoT 주석 추가 (파일 11)
  - 위치: `backend/src/nodes/ai/llm-provider-rule.ts` L903-907
  - 상세: 영문이 메시지의 SSOT 임을 명시하고, `frontend/.../backend-labels.ts` 의 `WARNING_KO` 와의 연동 규칙을 모듈 JSDoc 에 추가했다. 향후 영문 메시지를 수정하는 개발자가 프론트엔드 번역 파일을 동시에 갱신해야 함을 놓치지 않도록 돕는 유용한 주석이다. 현재 코드 상태와 일치한다.
  - 제안: 양호. `WARNING_KO` 의 정확한 키 형태(`backend-labels.ts` 의 키 패턴)를 예시로 한 줄 추가하면 더욱 실용적이다.

- **[INFO]** `parallel.schema.ts` / `parallel.handler.ts` 주석 갱신 (파일 28, 30)
  - 위치: `parallel.handler.ts` L2538, `parallel.schema.ts` L2655
  - 상세: "Korean messages" 를 "warning messages" 로 일괄 수정하여 영문 메시지 전환 후의 실제 상태를 반영했다. 주석 정확성 향상이다.
  - 제안: 양호.

---

### 점검 관점 5 — 인라인 주석 (복잡한 로직)

- **[INFO]** `integration-expiry-scanner.service.spec.ts` — TypeORM 내부 구조 접근 설명 (파일 5)
  - 위치: `backend/src/modules/integrations/integration-expiry-scanner.service.spec.ts` L629-631
  - 상세: TypeORM `Not(In([...]))` operator 의 `_value._value` 내부 구조를 직접 검사하는 비직관적 단언에 대해 주석으로 구조를 설명했다. 복잡한 내부 구현 접근을 설명하는 적절한 인라인 주석이다.
  - 제안: 양호. TypeORM 버전 변경 시 `_value._value` 경로가 달라질 수 있으므로, 주석에 TypeORM 버전 의존성(`typeorm@X.Y.Z` 기준)을 명시하면 유지보수 시 도움이 된다.

- **[INFO]** `integration-oauth.service.cafe24.spec.ts` — DTO 분기 불변식 단언 설명 (파일 6)
  - 위치: `backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts` L669-673, L687-690
  - 상세: 분리된 DTO 분기에서 반대편 DTO 의 필드가 포함되지 않아야 함을 단언하는 테스트에 `spec §9.2` 참조와 목적 설명을 인라인 주석으로 추가했다. 분기 경계가 명확히 문서화되었다.
  - 제안: 양호.

- **[INFO]** `migrations.spec.ts` — 테스트 desc 내 로직 설명 (파일 3)
  - 위치: `backend/src/migrations.spec.ts` L357-372
  - 상세: 파일 모듈 상단 JSDoc 에 Flyway 10 버전 regex 동작, `V035a` silent skip 사례, `check-duplicate-versions.sh` 와의 이중 가드 정책 및 `spec/conventions/migrations.md §6` 참조가 포함되어 있다. 변경된 부분은 포맷 정리(줄 배치)뿐이며 기존 주석 내용은 유지되었다.
  - 제안: 양호.

---

### 점검 관점 6 — 변경 이력 (CHANGELOG)

- **[INFO]** CHANGELOG 파일 부재
  - 위치: 프로젝트 루트
  - 상세: 이번 변경은 공개 OAuth API 의 응답 스키마 표현 방식(단일 DTO → `oneOf` 두 DTO)을 변경하는 실질적인 API 계층 개편이다. CHANGELOG 가 존재하지 않는 것으로 보이며, 프로젝트 규약(`spec/`)에도 CHANGELOG 관리 정책이 명시되어 있지 않다. API 소비자 관점에서 파괴적 변경(breaking change)에 해당할 수 있는 DTO 이름 변경(`OAuthBeginResultDto` → `OAuthBeginPopupResultDto` / `OAuthBeginCafe24PendingResultDto`)이 기록되지 않았다.
  - 제안: CHANGELOG 가 없다면 `spec/2-navigation/4-integration.md §9.2` 의 Rationale 섹션에 DTO 분리 배경과 이전 DTO 이름을 기재하는 것을 권장한다. 외부 클라이언트가 DTO 이름을 참조하는 경우를 대비해 migration note 를 남기면 유용하다.

---

### 점검 관점 7 — 설정 문서

- **[INFO]** Flyway `.conf` 설정 문서화 (파일 1)
  - 위치: `backend/migrations/V050__integration_cafe24_connected_rotated_idx.conf`
  - 상세: `executeInTransaction=false` 설정이 이제 완전히 문서화되었다. `backend/migrations/README.md` 가 존재한다면 `.conf` 파일 사용 패턴과 `CONCURRENTLY` 인덱스 생성 시 이 설정이 필요함을 언급하면 향후 마이그레이션 작성 시 참고가 된다.
  - 제안: `backend/migrations/README.md` 에 "CONCURRENTLY 인덱스 생성 시 반드시 `.conf` 파일에 `executeInTransaction=false` 를 설정할 것" 패턴을 예제로 추가하는 것을 권장한다.

---

### 점검 관점 8 — 예제 코드

- **[INFO]** `wrapOneOfDataSchema` / `ApiOkWrappedOneOfResponse` 사용 예제 (파일 2)
  - 위치: `backend/src/common/swagger/api-wrapped.ts` L71-76, L98-103
  - 상세: `wrapDataSchema` 는 JSDoc 에 `@ApiOkResponse({ schema: wrapDataSchema(Dto) })` 형태 사용 예시가 있으나, `wrapOneOfDataSchema` 에는 직접 사용 예제가 없다. `ApiOkWrappedOneOfResponse` 의 JSDoc 에는 `popup vs cafe24_private_pending` 예시가 언급되어 있어 사용 맥락은 파악 가능하지만, `wrapOneOfDataSchema` 자체의 직접 사용 예시는 없다.
  - 제안: `wrapOneOfDataSchema` JSDoc 에 `@example` 또는 인라인 사용 예시를 추가하면 좋다. 단, `ApiOkWrappedOneOfResponse` 가 주 진입점이므로 낮은 우선순위다.

- **[INFO]** 테스트 케이스 rename — "Korean" 제거 (파일 10, 12, 14-16, 18-19, 21-23, 25-27)
  - 위치: 다수 `*.schema.spec.ts` 파일
  - 상세: 테스트 케이스 설명에서 "Korean warning/warnings" → "warning/warnings" 로 일괄 수정되었다. 이는 영문 메시지 SSOT 전환 이후 테스트 설명이 실제 동작을 정확히 표현하도록 맞춘 것이다. 테스트 자체가 동작을 문서화하는 역할을 하므로 이 변경은 문서화 정확성 향상이다.
  - 제안: 양호. 일관된 패턴으로 전체 spec 파일에 적용되었다.

---

## 요약

이번 변경 세트는 전반적으로 문서화 품질이 우수하다. Flyway `.conf` 파일에 누락되어 있던 설정 의도 설명이 추가되었고, `wrapOneOfDataSchema` / `ApiOkWrappedOneOfResponse` 신규 공개 함수에는 충분한 JSDoc 이 작성되었다. OAuth 응답 DTO 분리(`OAuthBeginResultDto` → 두 DTO)는 Swagger API 문서를 실제 분기 구조와 일치시키는 큰 개선이다. "Korean messages" → "warning messages" 일괄 수정은 영문 메시지 SSOT 전환을 코드 주석·테스트 설명 레이어까지 일관되게 전파한 것으로 주석 정확성 관점에서 올바른 조치다. 단, `OAuthBeginResultDto` 의 이름 변경은 API 소비자에게 영향을 줄 수 있는 변경임에도 CHANGELOG 또는 spec Rationale 에 이력이 기록되지 않은 점, `reauthorize` 엔드포인트의 Swagger description 에서 `scopesAdded?` 필드가 누락된 점이 개선 권고 사항으로 남는다.

## 위험도

LOW
