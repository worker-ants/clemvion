# API 계약(API Contract) 리뷰 — 웹훅 경로 영구 예약 (V133)

## 검토 범위

새 REST 엔드포인트는 없다. 이번 diff 는 기존 `POST /api/triggers` · `PATCH /api/triggers/:id` 가 이미
발행하던 409 `RESOURCE_CONFLICT`(`details.code=TRIGGER_ENDPOINT_PATH_CONFLICT`) 응답의 **트리거 조건을
넓히는** 변경이다 — DB 트리거(V133 `trg_trigger_reserve_endpoint_path`)가 지우거나 바꾼 웹훅 경로를
영구 예약해, 그 경로에 다른 워크스페이스가 `unique_violation`(라벨 `webhook_endpoint_reservation_owner`)을
내면 서비스가 기존과 **동일한** 409 응답으로 매핑한다. 수신 경로(`/api/hooks/:endpointPath`)는 변경 없음.
`codebase/backend/src/modules/triggers/{triggers.controller.ts,triggers.service.ts}`,
`codebase/backend/migrations/V133__webhook_endpoint_reservation.sql`,
`webhook-endpoint-reservation.entity.ts`, `CHANGELOG.md`, spec 5개 파일(`1-data-model.md`,
`2-trigger-list.md`, `12-webhook.md`, `3-error-handling.md`, `data-flow/10-triggers.md`)을 직접
`Read`/`Grep` 으로 대조했다. 저장소 파일은 수정하지 않았다(`git status --short` 확인 불필요 — 뮤테이션 없음).

## 발견사항

- **[INFO]** 동일 상태코드·동일 세부코드로 통합했으나 **행동(behavior) 자체는 breaking 변경** — 이전에 성공하던 요청이 이제 409 로 거부된다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `rethrowEndpointPathConflict` (게이트 1663~1680), `TRIGGER_ENDPOINT_PATH_CONFLICT_NAMES` (게이트 233~236)
  - 상세: 응답 스키마(`code`/`details.field`/`details.code`/HTTP 409)는 기존 계약과 완전히 동일해 **스키마 하위 호환성은 지켜졌다**. 다만 지우거나 바꾼 웹훅 경로를 다른 워크스페이스가 재등록하는 요청은 배포 전에는 (전역 UNIQUE 가 이미 비어 있으므로) **성공**했는데, 배포 후에는 항상 409 로 거부된다. 이는 의도된 보안 수정이고 `CHANGELOG.md`("배포 뒤 보일 수 있는 것")·마이그레이션 헤더·spec 5개 파일에 모두 명시적으로 예고돼 있어 은폐된 breaking change 는 아니지만, API 계약 관점에서는 "같은 요청이 배포 시점을 기준으로 성공/실패가 갈리는" 행동 변경이므로 기록해 둔다.
  - 제안: 조치 불요 — 이미 CHANGELOG·spec 양쪽에 예고돼 있고, 이 변경의 목적 자체가 그 행동을 막는 것이다. 문서화 상태로 충분.

- **[INFO]** 에러 `message` 문구 변경("이미 다른 트리거가 쓰고 있어요" → "쓸 수 없어요")은 계약 위반이 아님을 확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1670` 부근(`rethrowEndpointPathConflict`)
  - 상세: `spec/5-system/2-api-convention.md:192` 가 `message` 를 "사람이 읽을 짧은 설명" 으로 명시적으로 규정하고, 기계 판독 계약은 `code`/`details.code` 에 있다고 별도로 못 박아 둔다(같은 문서 224~226행 — `message` 는 shape 예시에서 의도적으로 제외). 이번 변경은 `code`/`details` 를 건드리지 않고 `message` 만 바꿨으므로 클라이언트가 규약대로 `details.code` 를 보고 분기했다면 영향이 없다. 문자열 자체를 파싱하는 비표준 클라이언트가 있다면 영향 있을 수 있으나, 그것은 이 프로젝트의 API 계약 밖의 사용법이다.
  - 조치 불요 — 기록 목적.

- **[INFO]** Swagger(OpenAPI) 문서 갱신이 `create`/`update` 두 엔드포인트에 단일 SoT 상수로 동기화됨(정합성 확인)
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:50-51` (`TRIGGER_ENDPOINT_PATH_CONFLICT_DESCRIPTION`, `@ApiConflictResponse` 로 두 메서드에서 공유)
  - 상세: grep 으로 확인한 결과 이 상수를 참조하는 `@ApiConflictResponse` 데코레이터는 `create`·`update` 두 곳뿐이라, 한쪽만 갱신되고 다른 쪽이 stale 해지는 문서 드리프트 위험이 없다. 응답 예시 스키마 자체(status/필드 shape)는 변경되지 않았다.
  - 조치 불요.

- **[INFO]** 새 DB 테이블(`webhook_endpoint_reservation`)은 어떤 API 로도 노출되지 않음 — 인증/인가·페이지네이션 관점에서 신규 표면 없음
  - 위치: `codebase/backend/src/modules/triggers/entities/webhook-endpoint-reservation.entity.ts`, `codebase/backend/src/database/root-entities.ts`
  - 상세: grep 결과 이 엔티티를 참조하는 Repository·Controller·Service 메서드가 전혀 없다(스키마 가드용 엔티티 등록뿐). 강제는 전적으로 DB 트리거가 수행하므로 새 엔드포인트·새 목록 조회·새 인증 경로가 생기지 않았다. 페이지네이션·인증/인가 관점에서 점검할 신규 표면이 없다.
  - 조치 불요.

- **[INFO]** 요청 검증(request validation) 관점에서 이번 diff 는 기존 `endpointPath` 형식 검증 로직을 건드리지 않음
  - 상세: `CreateTriggerDto`/`UpdateTriggerDto` 의 `endpointPath` 검증 규칙은 이번 diff 범위 밖이며 변경되지 않았다. 새로 추가된 충돌 판정(`TRIGGER_ENDPOINT_PATH_CONFLICT_NAMES` 확장)은 DB 에서 던진 에러의 사후 매핑일 뿐 요청 바디 검증 단계에 개입하지 않는다.
  - 조치 불요.

## 확인된 양호한 설계 (참고 — 오탐 방지)

- **응답 비구분(정보 노출 방지)**: "경로가 한때 쓰였다" 는 사실이 상태코드·`details`·메시지 어디에서도 새지 않도록 두 원인(전역 UNIQUE·예약 트리거)을 완전히 동일한 응답으로 통합했고, `triggers.service.spec.ts` 신규 테스트(게이트 3095~3109)가 두 케이스의 응답 객체 동일성(`toEqual`)과 메시지 부정 단언(`not.toMatch(/쓰고 있/)`)까지 실측한다.
- **spec 5개 파일 동기화**: `2-trigger-list.md`(§3 API 표) · `3-error-handling.md`(§1.10 카탈로그) · `12-webhook.md`(§WH-SC-01) · `data-flow/10-triggers.md`(Sink 표 · sequenceDiagram 주석) 가 모두 같은 세부 코드(`TRIGGER_ENDPOINT_PATH_CONFLICT`)·같은 409/`RESOURCE_CONFLICT` 조합·같은 데이터 모델 앵커(`§2.8.1`)를 문구 수준까지 일치시켜 참조한다 — 계약 문서 드리프트 없음.
- **버전 관리**: 이 프로젝트는 URL 경로 버전(`/api/v1/...`) 을 쓰지 않는 스타일이며, 이번 변경은 기존 엔드포인트의 에러 트리거 조건만 넓히고 스키마를 바꾸지 않아 버전 관리 정책과 충돌하지 않는다.
- **인증/인가**: `create`/`update` 양쪽 모두 `workspaceId` 는 컨트롤러/인증 컨텍스트에서 주입되고 DTO 스프레드 뒤 명시적으로 override 되어(`{ ...rest, workspaceId }`), 클라이언트가 body 로 다른 워크스페이스를 사칭할 수 없다 — 이번 diff 가 인가 경로를 바꾸지 않았음을 확인.

## 요약

이번 diff 는 API 계약 표면(엔드포인트·요청/응답 스키마·HTTP 상태 코드·버전)을 확장하거나 변경하지 않았다 — 기존 409 `RESOURCE_CONFLICT`/`TRIGGER_ENDPOINT_PATH_CONFLICT` 응답의 발생 조건을 DB 트리거 기반으로 넓혔을 뿐이며, 응답 shape 은 두 원인 모두에서 완전히 동일하게 유지된다(정보 노출 방지 목적이 테스트로 실측 검증됨). 유일하게 짚을 만한 지점은 "이전에는 성공하던 요청(지우거나 바꾼 웹훅 경로의 타 워크스페이스 재등록)이 배포 후에는 항상 409 로 거부되는" 행동 변화인데, 이는 보안 취약점을 닫기 위한 의도된 변경이고 CHANGELOG·마이그레이션 헤더·spec 5개 파일 모두에 이미 명시적으로 예고돼 있어 API 계약 위반이나 은폐된 breaking change 로 보지 않는다. 새 REST 엔드포인트·페이지네이션·인증 표면은 없으며(신규 테이블은 어떤 API 로도 노출되지 않음), Swagger 문서는 단일 SoT 상수로 두 엔드포인트에 동기화됐다. Critical/Warning 급 결함 없음.

## 위험도

NONE
