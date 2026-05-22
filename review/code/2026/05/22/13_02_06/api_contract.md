# API 계약(API Contract) 리뷰 결과

## 발견사항

### [WARNING] PATCH /api/triggers/:id — schedule 타입에 대한 에러 응답의 `details.disallowed` 필드가 테스트에서 미검증
- 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` L910-916, `codebase/backend/src/modules/triggers/triggers.service.spec.ts` L99-106
- 상세: 서비스 구현은 `{ code: 'VALIDATION_ERROR', details: { field: 'type', disallowed: [...] } }` 를 반환한다. 그러나 스펙 테스트(`triggers.service.spec.ts`)의 첫 번째 케이스는 `details.disallowed` 필드 존재 여부를 검증하지 않는다. `disallowed` 배열은 클라이언트가 어떤 필드를 제거해야 하는지 알기 위한 중요한 계약 정보이므로, 이 값이 실제로 올바르게 채워지는지 보장하는 단언이 없으면 향후 리팩토링 시 무음으로 깨질 수 있다.
- 제안: 테스트에 `details: { field: 'type', disallowed: expect.arrayContaining(['endpointPath']) }` 형태의 단언을 추가한다.

### [WARNING] 프론트엔드 WebhookConfigCard — config 전체를 PATCH body 에 포함 (과도한 페이로드)
- 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` L2262-2275
- 상세: `WebhookConfigCard.updateMutation` 은 `body.config = { ...trigger.config, authType, ... }` 방식으로 기존 config 전체를 클라이언트 측에서 복사해 PATCH body 에 실어 보낸다. 이는 두 가지 API 계약 위험을 수반한다. (1) 클라이언트가 읽어온 이후 서버 측에서 config 가 변경된 경우(다른 세션/자동화) 이전 값으로 되돌리는 silent overwrite 가 발생할 수 있다. (2) config 안에 서버 전용 내부 필드(예: `chatChannel.secretToken`, `interaction.triggerToken` 등)가 포함되어 있을 경우 클라이언트가 그 값을 다시 서버로 전송하게 된다. PATCH 의도와 달리 전체 config 를 교체하는 semantics 가 되어 부분 업데이트(PATCH) 계약을 위반한다.
- 제안: config 를 통째로 보내지 않고, 변경된 필드(authType, hmacHeader, hmacSecret, bearerToken)만 별도 최상위 DTO 필드 또는 명시적 config 서브 필드로 보내도록 PATCH 스키마를 설계한다. 이미 백엔드가 `mergeExternalConfig` 를 통해 부분 병합을 지원하므로, 프론트엔드가 변경분만 전달하는 방식으로 정렬하면 된다.

### [WARNING] hmacSecret / bearerToken 응답 마스킹 미적용 — 현재 PATCH 응답에 평문 포함 가능
- 위치: commit 메시지 `별 plan 으로 분리` 항목, `codebase/backend/src/modules/triggers/triggers.service.ts` 전체
- 상세: commit 메시지에 `hmacSecret / bearerToken 응답 마스킹(…last4) — TriggerDto 갱신 필요. 후속 plan 으로 분리` 가 명시되어 있다. 즉, 현재 PATCH 응답(`Trigger` 엔티티 직렬화)에 `config.hmacSecret` 및 `config.bearerToken` 이 평문으로 포함될 수 있다. 이는 API 응답 보안 관점에서 시크릿 노출 위험이며, 클라이언트가 시크릿 값을 로컬 state 에 보관하게 되는 악순환의 원인이 된다.
- 제안: 별도 plan 추적은 적절하나, 현재 PATCH 엔드포인트 응답에서 즉시 해당 필드를 `null` 또는 마스킹된 값으로 반환하도록 임시 조치를 취하거나, 응답 DTO 에서 해당 필드 자체를 제외한다. "다음 plan"으로 미루는 기간이 길어질수록 기존 API 계약에 마스킹을 추가하는 것이 breaking change 가 될 수 있다.

### [INFO] PATCH 에러 응답 메시지가 한국어 — 다국어 API 클라이언트와의 계약 일관성
- 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` L913
- 상세: `message: 'Schedule 타입 트리거는 name·isActive 만 수정할 수 있어요 ...'` 와 같이 에러 응답의 `message` 필드가 한국어 하드코딩이다. 다른 에러(`RESOURCE_NOT_FOUND: 'Trigger not found'`, `NOTIFICATION_NOT_CONFIGURED: 'Trigger 에 notification 설정이 없어...'`)도 혼용이다. API 를 프로그램적으로 소비하는 외부 클라이언트 또는 영어 로케일 사용자에게 일관성 없는 경험을 줄 수 있다.
- 제안: `message` 필드는 영어 표준 메시지로 통일하고, 로케일별 메시지는 프론트엔드 i18n 계층에서 처리한다. 또는 일관된 다국어 처리 정책을 API 계약 문서에 명시한다.

### [INFO] (workspace_id, endpoint_path) UNIQUE 충돌 시 409 매핑 미구현
- 위치: commit 메시지 `별 plan 으로 분리` 항목
- 상세: endpointPath 변경을 허용하는 PATCH 를 구현했으나, 현재 DB 제약 충돌 시 500 또는 DB 레벨 에러가 그대로 클라이언트에 노출될 수 있다. `(workspace_id, endpoint_path)` UNIQUE 제약이 추가된 이후에도 서비스 레이어에서 409 로 매핑하는 guard 가 없으면 계약 위반이 된다.
- 제안: UNIQUE 제약 추가 시 TypeORM QueryFailedError 를 잡아 `{ code: 'ENDPOINT_PATH_CONFLICT', ... }` 와 함께 409 를 반환하는 guard 를 서비스 또는 예외 필터에 즉시 추가한다. 두 작업(DB 제약 + 에러 매핑)이 동시에 배포되어야 API 계약이 완전해진다.

### [INFO] OverviewCard — PATCH { name } 호출 후 응답 본문 미활용, 로컬 state 가 stale 될 수 있음
- 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` — `OverviewCard.updateMutation`
- 상세: `mutationFn` 이 PATCH 응답 본문을 사용하지 않고 `onSuccess` 에서 `invalidateAfterSave()` 를 호출해 쿼리를 무효화한다. 이 패턴 자체는 올바르다. 다만 invalidate 후 refetch 가 완료되기 전 짧은 구간에 `trigger.name` 이 이전 값을 보여주는데, 이는 UI 계약이지 API 계약 위반은 아니다. 참고 사항으로만 기록한다.

---

## 요약

이번 변경의 API 계약 관련 핵심 사항은 다음과 같다. 백엔드 `TriggersService.update` 에 schedule 타입 PATCH 제한 guard 가 추가되었고 에러 코드(`VALIDATION_ERROR`)와 HTTP 상태(400)는 적절하다. 그러나 PATCH body 로 config 전체를 전송하는 프론트엔드 패턴은 PATCH 의미론(부분 업데이트)을 위반하며 silent overwrite 위험이 있어 WARNING 수준의 계약 이슈다. `hmacSecret / bearerToken` 마스킹이 후속 plan 으로 미뤄진 상황도 현재 API 응답에서 시크릿이 노출될 수 있는 상태로, 가능한 한 빨리 해소되어야 한다. 에러 메시지의 언어 혼용과 UNIQUE 충돌 미매핑은 INFO 수준이나 지속적인 API 품질을 위해 추적이 필요하다.

## 위험도

MEDIUM
