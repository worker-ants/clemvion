# API 계약(API Contract) 리뷰

## 발견사항

### [WARNING] endpointPath 유효성 검증 강화 — 의도된 Breaking Change
- 위치: `codebase/backend/src/modules/triggers/dto/create-trigger.dto.ts` L55, `update-trigger.dto.ts` L63
- 상세: `@IsString() @MaxLength(255)` 에서 `@IsUUID('4')` 로 변경. 기존에 `endpointPath: '/hooks/my-integration'` 또는 임의 문자열(최대 255자)을 사용하던 API 클라이언트는 이제 400 VALIDATION_ERROR를 받는다. Swagger 스키마도 `maxLength: 255` 대신 `format: 'uuid'` 로 변경되어 계약이 명시적으로 단절됨. 이것은 WH-SC-01 보안 강화 목적의 의도된 breaking change 이며 spec(WH-MG-02)에 문서화되었으나, 기존 클라이언트(예: 사람이 읽기 쉬운 `e2e-a-<hex>` 형태의 경로를 사용했던 코드)는 마이그레이션이 필요하다. e2e 테스트(파일 7·8)는 이미 `crypto.randomUUID()` 로 업데이트되어 있다.
- 제안: 클라이언트 마이그레이션 가이드 또는 CHANGELOG를 명시하여 외부 통합자에게 공지. 내부 코드는 이미 일관되게 업데이트된 것으로 확인됨.

### [INFO] UpdateTriggerDto의 endpointPath 변경 거부 — 서비스 레이어 응답 미명시
- 위치: `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts` L58 description
- 상세: description에 "생성 후 endpointPath 변경은 service 가 거부한다"고 명시되었으나, 거부 시 어떤 HTTP 상태 코드(`400`? `409`? `422`?)와 오류 코드가 반환되는지 Swagger 문서에 기록되지 않았다. DTO 검증(`@IsUUID('4')`)은 통과하지만 service 레이어에서 거부되는 경우, 클라이언트는 어떤 응답을 기대해야 하는지 계약적으로 불명확하다.
- 제안: `PATCH /api/triggers/:id` 의 Swagger 응답 섹션에 `400 ENDPOINT_PATH_IMMUTABLE`(또는 실제 오류 코드) 문서를 추가하거나, service 거부 로직의 오류 코드를 spec 또는 DTO 주석에 명시.

### [INFO] WorkspaceInvitationsPrunerService — API 계약 무관
- 위치: 파일 4·5·6 (workspace-invitations-pruner.service.ts, .spec.ts, workspaces.module.ts)
- 상세: 내부 BullMQ 스케줄 백그라운드 잡으로 공개 API 엔드포인트를 추가·변경하지 않는다. API 계약 관점의 영향 없음.

### [INFO] 요청 검증 강화 — 단위·e2e 테스트 충분
- 위치: `trigger-dto-validation.spec.ts` L207-258, `webhook-trigger.e2e-spec.ts`, `chat-channel-trigger-create.e2e-spec.ts`
- 상세: v4 UUID 강제에 대해 (a) 유효한 UUID 통과, (b) 비-UUID(squatting 패턴·경로 형식·v1 UUID) 거부, (c) UpdateTriggerDto 동일 적용 등 6개 단위 케이스가 추가되었다. e2e 테스트도 일관되게 `crypto.randomUUID()` 로 업데이트됨. 요청 검증 범위는 충분하다.

### [INFO] 에러 응답 형식 일관성 확인
- 위치: `chat-channel-trigger-create.e2e-spec.ts` L636-640, L688-691
- 상세: DTO 수준 검증 실패는 `{ error: { code: 'VALIDATION_ERROR', details: Array } }`, service 단 검증 실패는 `{ error: { code: 'VALIDATION_ERROR', details: Object (단일 field) } }` 로 두 형태가 혼재한다. 이는 이전부터 존재하는 기존 비일관성으로, 이번 변경이 새로 도입한 것은 아니나 클라이언트가 `details` 타입을 Array인지 Object인지 분기해야 한다.
- 제안: 신규 이슈가 아니므로 별도 추적 필요 시 기존 TODO 항목으로 관리.

---

## 요약

이번 변경의 API 계약 핵심은 `endpointPath` 필드의 유효성 검사를 `@IsString()/@MaxLength(255)` 에서 `@IsUUID('4')` 로 강화한 것이다. 이는 공개 webhook의 endpoint path가 전역 라우팅 키로서 사실상 비밀 키 역할을 하므로(WH-SC-01) 예측 가능한 경로 직접 지정(squatting/enumeration)을 서버 계약 수준에서 차단하는 의도적인 breaking change이며, spec(WH-MG-02, spec/data-flow/10-triggers.md)에 일관되게 문서화되었다. 내부 e2e·단위 테스트도 이미 일관되게 업데이트되어 있다. 다만 `UpdateTriggerDto` 에서 endpointPath 변경을 service가 거부할 때의 구체적인 오류 코드가 Swagger/spec에 명시되지 않은 점은 INFO 수준의 계약 모호성으로 남는다. WorkspaceInvitationsPrunerService는 내부 스케줄러로 API 계약에 영향을 주지 않는다.

## 위험도

MEDIUM

---

STATUS=success ISSUES=1
