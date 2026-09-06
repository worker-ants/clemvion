# API 계약(API Contract) 리뷰

## 개요

이번 diff(`origin/main...HEAD`)는 `User` 엔티티 컬럼 노출 방어 작업이 10여 차례의
`/ai-review`+`/consistency-check` 라운드를 거쳐 수렴한 최종 상태다. 직전 라운드
(`review/code/2026/09/06/15_52_58/api_contract.md`)가 이미 API 계약 관점 실질 변경
세 갈래(트리거 409 충돌 계약 구현·`WorkflowVersionsService` 투영·
`WorkspaceMemberDto.joinedAt` 추가)를 검토해 위험도 LOW·조치 불요로 판정했고, 그 뒤
마지막 커밋(`8bbae332a`)은 다음만 바꿨다 — 전부 API 표면에 영향 없음:

- `CHANGELOG.md` 1줄: 문서가 실제 wire 키(`details.code`)와 다르게 `subCode` 로 남아
  있던 것을 정정 (직전 라운드가 지적한 W2 를 이 커밋이 닫음 — 문서-코드 대조 결과
  현재는 `code`·`triggers.service.ts`·`error-codes.md §4.2` 세 곳이 일치).
- `pg-error.spec.ts`/`triggers.service.spec.ts`/`workspaces.service.spec.ts`: 테스트
  fixture 를 공유 SoT(`pg-error-fixtures.ts`)로 통합 + 관계-부재 테스트 보강. 응답
  wire 형태·상태 코드·엔드포인트 동작에는 영향 없음.
- `triggers.service.ts`: orphan JSDoc 빈 줄 제거 (동작 변경 없음).

API 표면에 실질적으로 영향을 주는 세 갈래를 코드를 다시 열어 직접 재확인했다:

1. **`TriggersService.rethrowEndpointPathConflict`** — `(workspace_id, endpoint_path)`
   UNIQUE 위반 시 `spec/2-navigation/2-trigger-list.md:164` 가 문서화한
   `409 RESOURCE_CONFLICT`(`details.field='endpoint_path'`,
   `details.code='TRIGGER_ENDPOINT_PATH_CONFLICT'`)를 그대로 발행. `create`/`update`
   양쪽에 대칭 적용, 다른 UNIQUE 인덱스 위반은 가로채지 않고 그대로 흘려보낸다
   (`triggers.service.spec.ts` 의 반대방향 대조군으로 확인). `GlobalExceptionFilter`
   는 `code`/`message`/`requestId`/`details` 만 봉투에 복사하므로 이 구현이 실제
   wire 에 닿는 경로가 맞다.
2. **`WorkflowVersionsService.findOne`** — `creator` 관계를 `CREATOR_PROJECTION`
   (`{id,name,email}`)으로 투영해, `WorkflowVersionDto`/`WorkflowVersionCreatorDto`
   가 이미 선언한 3필드와 실제 응답을 일치시켰다. 투영 상수와 DTO OpenAPI 스키마의
   키 집합을 대조하는 테스트(`workflow-versions.service.spec.ts`)가 양방향 드리프트를
   막는다. e2e(`workflow-crud.e2e-spec.ts` H.)가 계약 대조 + 이름 기반 부재 + 실제
   `creator` 키 3종을 모두 검증.
3. **`WorkspaceMemberDto.joinedAt`** — `WorkspacesService.listMembers` 가 이미 wire 로
   내보내던 값을 DTO 선언에 반영한 additive 필드. `nullable: true` 가 스키마(컬럼
   nullable)를 따른 것이고 현재 도달 가능한 4개 채움 지점은 전부 `new Date()` 라는
   실측이 주석에 남아 있어 §5.4 기본형 선택이 정당하다.

## 발견사항

새로 지적할 API 계약 위반은 없다. 직전 라운드가 남긴 두 INFO 는 여전히 유효하며 상태
변화가 없어 반복 기재만 한다 (조치 불요/추적 중):

- **[INFO]** (조치 불요, 이미 planner 등재) 에러 봉투 `details` 필드가 배열/객체 두
  형태로 쓰이는 것이 `spec/5-system/2-api-convention.md §5.3` 에 아직 명문화되지
  않았다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` 의
    `rethrowEndpointPathConflict` (`details: { field, code }` — 단일 객체, `message`
    키 없음) vs §5.3 예시(`details: [{ field, message, code }]` — 배열)
  - 상세: `ErrorResponseBodyDto.details` 가 `unknown`/`additionalProperties: true` 로
    느슨히 선언돼 있어 OpenAPI 스키마상 깨지는 계약은 없다. `plan/in-progress/
    spec-draft-nullable-notation-followups.md` 에 "`details` object/array 두 형태를
    §5.3 에 명문화" 항목으로 이미 등재돼 있음을 재확인했다 — developer 권한(`spec/`
    쓰기 불가) 밖의 정당한 처리.
  - 제안: 조치 불요 — 후속 planner 턴 반영을 기다린다.

- **[INFO]** 트리거 `endpoint_path` UNIQUE 충돌의 409 응답을 실 DB 유니크 제약 경로로
  검증하는 e2e 가 여전히 없다 (unit mock 검증만 존재)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts`
    (`describe('TriggersService — endpoint_path UNIQUE 충돌 계약')`)
  - 상세: unit 커버리지는 `create`/`update` × 두 wrap 표면(driverError/top) 4조합 +
    반대방향 대조군까지 촘촘하지만, 전부 `triggerRepo.save` mock reject 로 만든 합성
    에러다. 실제 PG 유니크 인덱스가 던지는 에러 형태와 `GlobalExceptionFilter` 를
    거친 최종 wire 형태 일치는 e2e 로 닫히지 않았다. `WorkflowVersionsService`/
    `WorkspaceMemberDto` 두 갈래는 각각 신규 e2e 로 실 인프라 검증이 있는 것과 대비.
  - 제안: 필수는 아님(unit 커버리지가 이미 충분히 촘촘함). 형평을 위해 웹훅 트리거
    e2e 에 같은 `endpointPath` 2차 생성 → 409 + `error.details.field`/`.code` 단언
    케이스 추가를 권장.

## 요약

이번 diff 의 API 계약 관련 변경은 모두 기존 계약 위반(구현이 문서보다 좁거나, 값이
선언보다 넓던 상태)을 닫는 방향이고 breaking change·버전 관리 이슈는 없다. 직전
라운드가 지적했던 CHANGELOG 의 `subCode`/`code` 문서-코드 불일치는 이번 마지막
커밋에서 정정돼 코드·테스트·spec·CHANGELOG 네 곳이 전부 `details.code` 로 일치한다.
새로 지적할 사항은 없으며, 남은 두 INFO(§5.3 `details` 형태 미명문화, 트리거 409
경로 e2e 부재)는 둘 다 이전 라운드에서부터 이어진 비차단 항목이다. 페이지네이션·
URL 설계·인증/인가 축은 이번 diff 가 새 엔드포인트를 도입하지 않아 해당 없음.

## 위험도

LOW
