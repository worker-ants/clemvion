# API 계약(API Contract) 리뷰 — 웹훅 `endpoint_path` 전역 UNIQUE (V131/V132)

## 발견사항

- **[INFO]** 유일성 범위 확장은 의도된 breaking change이며 완화책이 갖춰져 있음
  - 위치: `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql` (전체), `codebase/backend/migrations/V132__trigger_endpoint_path_global_unique.sql:21-24`
  - 상세: `Trigger.endpoint_path` UNIQUE 범위를 `(workspace_id, endpoint_path)` → `(endpoint_path)` 전역으로 좁힌다(spec 관점에서는 "좁힘"이지만 실질은 다른 워크스페이스가 같은 경로를 등록하지 못하게 막는 것). 이 자체는 기존에 우발적으로(또는 악의적으로) 워크스페이스 간에 같은 `endpoint_path` 를 등록해 둔 트리거에 대해 **하위 호환을 깨는 변경**이다 — V131 이 중복 묶음마다 가장 먼저 만든 것만 원래 경로를 유지하고 나머지는 새 UUID로 재발급하므로, "복사한 쪽"의 기존 외부 webhook URL 은 마이그레이션 직후 즉시 404 로 끊긴다. 이 영향은 (a) 정상적인 사용에서는 v4 UUID 충돌 확률이 무시할 만해 실제로는 "복사 등록"으로만 중복이 생긴다는 전제, (b) 채팅 채널 트리거에 대해서는 NOTICE + 운영 절차(소유자가 채널 설정 재저장)로 완화된다는 점에서 문서화·근거가 충분하다. 다만 **채팅 채널이 아닌 일반 webhook 트리거**가 재발급 대상이 될 경우, 애플리케이션 레벨 알림(이메일·UI 배너)은 없고 DB 마이그레이션 `RAISE NOTICE`(운영자만 확인 가능)만 남는다 — 소유 워크스페이스 사용자는 트리거 상세 화면에서 새 URL 을 다시 확인해야 외부 연동을 복구할 수 있다. 보안 수정의 트레이드오프로 합리적이나, 사후 확인 채널(트리거 상세 화면 URL 재확인 안내 등)이 운영 절차에 명시되면 더 안전하다.
  - 제안: 없음(설계상 수용 가능) — 다만 배포 노트/운영 절차에 "비채팅 webhook 도 새 경로를 트리거 상세에서 재확인해야 한다"는 문구를 남기면 좋다.

- **[INFO]** 에러 응답 계약(코드/상태/필드)은 변경 없이 그대로 유지 — 하위 호환 보존
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (`rethrowEndpointPathConflict`, `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX` 상수 인근)
  - 상세: `code=RESOURCE_CONFLICT`, HTTP 409, `details={field:'endpoint_path', code:'TRIGGER_ENDPOINT_PATH_CONFLICT'}` 봉투 구조는 그대로다. 바뀐 것은 사람이 읽는 `message` 문자열("동일 워크스페이스에…" → "그 엔드포인트 경로는 이미 다른 트리거가 쓰고 있어요…")뿐이며, 계약 SoT(`spec/2-navigation/2-trigger-list.md §3`, `spec/5-system/3-error-handling.md §1.10`)가 명시하는 필드는 `code`/`details` 이지 `message` 문자열이 아니므로, 기존 클라이언트가 `message` 문자열을 파싱하지 않는 한 breaking 하지 않다. 인덱스 이름을 이용한 판별 로직(`TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX` 상수)도 새 인덱스명으로 정확히 재배선됐고, 옛 인덱스명이 다시 나타나면 조용히 통과(전역 `RESOURCE_CONFLICT`)시키는 fail-safe 방향이 테스트(`triggers.service.spec.ts:3130-3140`)로 양방향 확인된다.
  - 제안: 없음.

- **[INFO]** Swagger 문서(`@ApiConflictResponse`)와 실제 동작이 정확히 일치하도록 갱신됨
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` `create()`/`update()` 의 `@ApiConflictResponse` 데코레이터
  - 상세: 두 엔드포인트(`POST /api/triggers`, `PATCH /api/triggers/:id`)의 409 설명이 "동일 워크스페이스" → "다른 워크스페이스의 트리거 포함 — 전역 유일" 로 정확히 갱신됐다. `code`/`details.field`/`details.code` 스키마 자체는 변경이 없어 OpenAPI 스키마(응답 shape) 관점에서는 breaking 하지 않고, 설명 문구만 갱신된 non-breaking 변경이다.
  - 제안: 없음.

- **[INFO]** 신규 크로스-테넌트 정보 노출 표면은 실질적으로 미미함 — 참고용 기록
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `rethrowEndpointPathConflict`
  - 상세: 유일성이 전역이 되면서, 워크스페이스 A 가 `endpointPath` 로 임의 UUID 를 시도해 409 를 받으면 "그 정확한 UUID 가 어떤 워크스페이스에선가 이미 등록돼 있다"는 사실을 확인할 수 있는 새 oracle 이 생긴다. 다만 이는 v4 UUID(128비트, 사실상 전수 추측 불가) 전체를 이미 알고 있어야만 성립하는 시나리오라, 그 자체로 이미 WH-SC-01 이 전제하는 "경로=비밀 키"를 알고 있는 상태이므로 실질적 추가 노출은 거의 없다(이번 마이그레이션이 막으려는 것 — 이미 아는 경로의 복사 등록 — 과 본질적으로 같은 자리다). CRITICAL/WARNING 으로 올리지 않음.
  - 제안: 없음.

- **[INFO]** 요청 검증(request validation)·URL 설계·페이지네이션·인증/인가 표면은 이번 변경으로 영향 없음
  - 상세: `endpointPath` 의 형식 검증(`@IsUUID('4')`, `create-trigger.dto.ts`/`update-trigger.dto.ts`)은 diff 밖이며 그대로 유지된다. URL 경로(`/api/hooks/:endpointPath`, `/api/triggers`, `/api/triggers/:id`)·인증/인가(`@Roles('editor')`, `WorkspaceId`)·API 버전 표기는 변경 없음. 목록 API 페이지네이션과는 무관한 변경이다.
  - 제안: 없음.

## 요약

이번 변경은 웹훅 `endpoint_path` 의 UNIQUE 범위를 워크스페이스 단위에서 전역으로 좁혀 다른 워크스페이스의 경로 복사(가로채기)를 막는 보안 수정이다. API 계약 관점에서 응답 봉투(`code`/`details.field`/`details.code`/HTTP 409)는 완전히 보존되고, Swagger 문서·서비스 단 메시지·에러 판별 상수·테스트(unit+e2e)가 모두 새 스코프에 맞춰 정합하게 재배선되어 하위 호환이 잘 관리되었다. 유일한 실질적 breaking 지점은 V131 dedupe 마이그레이션이 "복사된" 트리거의 `endpoint_path` 를 서버 측에서 강제로 재발급하는 부분인데, 이는 보안 결함(가로채기)을 정리하기 위한 의도된 트레이드오프이며 채팅 채널 케이스에는 운영 절차가 마련돼 있다(일반 webhook 트리거는 애플리케이션 레벨 알림 없이 DB NOTICE 로만 남는 점은 개선 여지로 기록). 요청 검증·URL 설계·페이지네이션·인증/인가 표면에는 변화가 없다. 전반적으로 API 계약 위험은 낮다.

## 위험도

LOW
