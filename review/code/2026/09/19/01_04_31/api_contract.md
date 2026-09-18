# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** 하위 호환성 — `endpoint_path` 유일성 범위를 워크스페이스 단위 → 전역으로 바꾸면서, V131 마이그레이션이 "복사 등록의 흔적"으로 판단한 기존 트리거의 `endpoint_path`(= 웹훅 수신 URL)를 소유자 동의 없이 자동으로 재발급한다
  - 위치: `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql:42` (`UPDATE trigger SET endpoint_path = gen_random_uuid()::text ...`), 근거는 `spec/1-data-model.md` `## Rationale` 「Webhook `endpoint_path` 전역 유일 (2026-09-18)」
  - 상세: 이 UPDATE 는 외부에 공개된 API 엔드포인트 식별자(`/api/hooks/:endpointPath`)를 트랜잭션 내에서 조용히 변경한다. 트리거 소유 워크스페이스에는 애플리케이션 레벨 알림·상태 플래그가 없고(마이그레이션 주석 자신도 "채팅 채널 상태 컬럼은 쓰지 않는다"고 명시), 남는 흔적은 배포 운영자만 보는 `RAISE NOTICE` 뿐이다. "정상 경로로는 워크스페이스 간 중복이 생기지 않는다"는 휴리스틱이 어떤 예외 케이스(예: 향후 워크스페이스 합병·복제 기능, 수동 DB 이관 등)에서 어긋나면, 그 워크스페이스의 실제 운영 중인 외부 연동(Stripe/GitHub webhook 등)이 예고 없이 끊긴다. DOWN 절 자체가 "되돌릴 수 없다"고 명시한다.
  - 제안: 이미 `spec/1-data-model.md` Rationale 과 백로그(`plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목 "묘비 부재")에 관련 배경이 기록돼 있어 재설계를 요구하지는 않으나, 사용자 결정으로 채택된 트레이드오프임을 release note/운영 가이드에도 남겨 실제로 영향받는 워크스페이스가 있었는지(마이그레이션 NOTICE 로그의 트리거 id 기준) 배포 직후 확인하는 절차를 권장한다.

- **[INFO]** 에러 응답의 사람이 읽는 `message` 텍스트가 변경됨 — 계약 위반은 아니나 wire-visible
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (`rethrowEndpointPathConflict` 내부 `message` 필드, "같은 워크스페이스에 그 엔드포인트 경로를 쓰는 트리거가 이미 있어요." → "그 엔드포인트 경로는 이미 다른 트리거가 쓰고 있어요. 새 경로를 쓰세요.")
  - 상세: `spec/5-system/2-api-convention.md` 컨벤션상 클라이언트는 `code`/`details.code` 로 분기해야 하며 `message` 는 계약 대상이 아니라고 되어 있어 이 변경은 정당하다. 다만 실제로 `message` 문자열을 파싱하는 브리틀한 외부 통합이 있다면 이번 변경으로 텍스트가 달라진다는 점만 기록해 둔다(신규 e2e/unit 테스트가 "워크스페이스" 문자열 부재를 명시적으로 단언해 회귀를 방지하고 있어 실질 위험은 낮음).
  - 제안: 없음 — 컨벤션을 따른 정당한 변경.

- **[INFO]** `TriggersService.findByEndpointPath(workspaceId, endpointPath)` 가 여전히 워크스페이스로 스코프된 조회를 제공하지만 이번 diff 의 대상이 아니고 호출부가 없음(dead code)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `findByEndpointPath` 메서드 (파일 끝부분, 이번 diff 범위 밖)
  - 상세: `grep` 결과 저장소 전체에서 정의부 한 곳 외 호출부가 없다. 전역 유일성 체제 아래에서 이 메서드가 향후 재사용되면 "워크스페이스 안에 없으면 null" 을 "그 경로 자체가 존재하지 않음"으로 오인하는 호출부가 생길 수 있다(실제로는 다른 워크스페이스에 존재할 수 있음).
  - 제안: 이번 PR 범위는 아니므로 조치 불요. 향후 이 메서드를 호출하는 코드를 추가할 때는 전역 스코프 조회(`findByEndpointPathGlobal` 류)와 혼동하지 않도록 이름/주석으로 명확히 할 것.

- **[INFO]** 알려진 잔여 갭(묘비 부재)은 이미 트래커에 등재되어 있어 이번 PR 의 결함이 아님
  - 위치: `spec/1-data-model.md` Rationale 「남는 틈」 단락, `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목 "지운 웹훅 경로를 다른 워크스페이스가 다시 등록할 수 있다"
  - 상세: 트리거 삭제 후 그 `endpoint_path` 가 즉시 재사용 가능해지는 문제(경로 하이재킹의 또 다른 형태)는 이번 전역 UNIQUE 로도 닫히지 않는다. 이는 설계 문서와 백로그에 명시적으로 기록되어 있어 정보 은폐가 아니다.
  - 제안: 없음 — 참고용 기록.

- **[INFO]** 회귀 없음 확인 — 409 응답 봉투 형태(`code=RESOURCE_CONFLICT`, `details={field, code}`), Swagger `@ApiConflictResponse` 설명 SoT 화, DTO 유효성 검증(`@IsUUID('4')`), 인증/인가 데코레이터(`@ApiBearerAuth`, editor 이상 권한)는 이번 diff 에서 변경되지 않았고 회귀도 관찰되지 않음
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` (`create`/`update` 데코레이터), `codebase/backend/src/modules/triggers/triggers.service.ts` (`rethrowEndpointPathConflict`)
  - 상세: 인덱스 이름 상수(`TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX`)만 재배선되고, 판정 함수(`isEndpointPathUniqueViolation`)·에러 매핑 로직·Swagger 데코레이터 구조 자체는 그대로다. 신규 e2e(B5/B6)와 unit(`triggers.service.spec.ts`)이 이름 변경·교차 워크스페이스 충돌·구 인덱스 이름 오탐 방지를 모두 커버한다.
  - 제안: 없음.

## 요약

이번 변경은 웹훅 `endpoint_path` 의 UNIQUE 범위를 워크스페이스 단위에서 전역으로 바꾸는 보안 수정(V131 정리 + V132 인덱스 교체)과 그에 따른 컨트롤러/서비스/spec 문서/테스트 동기화다. 409 에러 봉투 형태(`code`/`details.field`/`details.code`)와 인증·인가·요청 검증은 그대로 유지되어 계약이 구조적으로 깨지지 않으며, 신규 e2e(B5/B6)가 교차 워크스페이스 충돌·인덱스 유효성을 직접 검증한다. 다만 이 전환은 본질적으로 클라이언트가 의존하는 공개 API 엔드포인트 식별자(`endpoint_path`)를 서버가 판단 기준(휴리스틱)에 따라 동의 없이 재발급하는 하위 호환성 트레이드오프이며, 사용자 결정과 spec Rationale 로 의도적으로 승인·문서화되어 있다. 최신 라운드의 consistency-check(BLOCK:NO)에서도 관련 spec 정합성 Critical 은 모두 해소된 상태로 확인된다.

## 위험도

LOW
