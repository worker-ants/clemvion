# 신규 식별자 충돌 검토 — `spec-draft-integration-dto-pointer.md`

## 발견사항

없음 — target 이 새로 도입하는 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·파일 경로가
존재하지 않는다. 아래는 6개 관점별로 확인한 근거다.

- **요구사항 ID**: target 은 어떤 신규 ID 도 부여하지 않는다. `spec-draft-nullable-notation-followups.md`
  의 기존 트래커 항목(1562행, `4-integration.md §9.1 — IntegrationDto 확장 필드 포인터`)을 그대로 승계할
  뿐이다.
- **엔티티/타입명**: 새 DTO·인터페이스명 없음. `IntegrationDto`, `mallId`, `tokenExpiresAt`,
  `lastRotatedAt`, `lastUsedAt`, `consecutiveNetworkFailures` 모두 이미 존재하는 식별자이며,
  `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` 145~167행의
  실제 필드명과 1글자도 다르지 않게 일치한다 (`mallId`/`tokenExpiresAt`/`lastRotatedAt`/`lastUsedAt`/
  `consecutiveNetworkFailures`). `spec/1-data-model.md` §2.10 (285~312행)의 DB 컬럼(`mall_id`,
  `token_expires_at`, `last_rotated_at`, `last_used_at`, `consecutive_network_failures`)과도 정확히
  대응한다 — camelCase/snake_case 매핑이 기존 관례와 일치하고 새 의미 부여가 없다.
- **API endpoint**: 신규 endpoint 없음. `GET /api/integrations/:id` 는 `spec/2-navigation/4-integration.md`
  795행에 이미 정의된 endpoint 이고, target 은 그 행의 서술 문구만 보강한다.
- **이벤트/메시지명**: 해당 없음 — webhook·queue·sse 어느 것도 target 에서 언급되지 않는다.
- **환경변수·설정키**: 해당 없음 — 신규 ENV var·config key 없음.
- **파일 경로**: target 문서 자체(`plan/in-progress/spec-draft-integration-dto-pointer.md`)는
  `spec-draft-<topic>.md` 네이밍 컨벤션(동일 디렉터리의 `spec-draft-nullable-notation-followups.md`,
  `spec-draft-eia-62-waiting-payload.md`, `spec-draft-eia-notification-payload-contract.md`)을 그대로
  따르며 기존 파일과 겹치지 않는다(신규 파일, `plan/complete/` 에도 동명 파일 없음 확인). target 이
  spec 본문에 새로 삽입할 앵커 링크 `../1-data-model.md#210-integration` 도 `spec/1-data-model.md` 의
  기존 헤딩(285행 `### 2.10 Integration`)이 슬러그화된 유일한 앵커이며, 파일 내 다른 `2.10` 헤딩과
  충돌하지 않는다(`### 2.10.1 IntegrationUsageLog` 는 별개 슬러그).

## 요약

target 은 `4-integration.md §9.1` `GET /:id` 행의 기존 서술 끝에 문장 하나를 추가하는 순수 문서
경계-명확화(포인터) 패치로, **신규 식별자를 전혀 도입하지 않는다**. 언급되는 5개 필드명·엔티티명·
endpoint·앵커는 전부 기존 DTO 소스 코드(`integration-response.dto.ts`)와 `spec/1-data-model.md §2.10`
에 이미 존재하는 식별자와 문자 그대로 일치함을 직접 대조로 확인했다. 새 요구사항 ID, 새 엔티티/타입,
새 endpoint, 새 이벤트명, 새 환경변수, 파일 경로 컨벤션 위반 중 어느 것도 발견되지 않았다.

## 위험도

NONE
