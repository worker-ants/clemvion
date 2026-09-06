# 신규 식별자 충돌 검토

## 전제 — 이 PR 이 실제로 다루는 델타

- `spec/5-system/**` 델타: **0개 파일**. 이 브랜치는 spec 을 바꾸지 않았다 — 요구사항 ID·API endpoint
  선언·환경변수 문서화가 이 diff 로는 발생하지 않는다.
- 실제 변경은 `codebase/backend/**` 31개 파일 / 2169줄. 절대경로
  (`/Volumes/project/private/clemvion/.claude/worktrees/sweep-response-contract-5ba0ad`)
  워킹트리에서 `git diff origin/main...HEAD -- codebase/ spec/` 로 직접 재현해 전문을 확인했다
  (prompt 번들의 `<git diff ...>` 절은 예산 초과로 생략돼 있었음 — 직접 조회로 대체).
- 내용은 §5.4 응답-계약(response-contract) 스윕: 이미 wire 로 나가고 있던 미선언 필드를 DTO
  선언에 반영하고, 트리거/스케줄 응답에서 새고 있던 비밀 컬럼(`notificationSecretV2`,
  `chatChannelTokenV2`, `config.interaction.triggerToken`, `config.notification.signing.secret`)을
  걷어내는 리팩터 + 그 회귀를 잡는 unit/e2e 다.

## 점검 관점별 결과

### 1. 요구사항 ID 충돌
spec 델타가 0이므로 신규 요구사항 ID 자체가 없다. 해당 없음.

### 2. 엔티티/타입명 충돌
새로 도입된 클래스/인터페이스는 다음이 전부다 — 각각 `git grep` 으로 저장소 전체에서 유일성을
확인했고, 기존에 다른 의미로 쓰이는 동명 식별자는 없다.

- `ScheduleTriggerWorkflowRefDto`, `ScheduleTriggerRefDto`
  (`schedule-response.dto.ts`)
- `TriggerWorkflowRefDto` (`trigger-response.dto.ts`)
- `OptionalNullableOffender`(interface) / `OptionalNullableOffenderFixtureDto`
  (`swagger-dto-contract-guard.ts` / `optional-nullable.fixture.ts`)
- 모듈 스코프 상수: `NOTIFICATION_SIGNING_STRIP_KEYS`, `INTERACTION_RESPONSE_STRIP_KEYS`,
  `TRIGGER_RESPONSE_STRIP_COLUMNS`, `omitKeys`, `contractCache`, `buildContractForDto`,
  `findOptionalNullableResponseFields`, `isResponseDtoFile` — 전부 신규이며 기존 동명 식별자 없음.
- 기존 private 메서드 rename: `sanitizeChatChannelForResponse` → `sanitizeForResponse`
  (`TriggersService` 스코프 내). 저장소 전체에서 `sanitizeForResponse` 라는 이름이 다른 클래스에
  이미 쓰이고 있지 않음을 확인했다 — 충돌 없음.
- 신규 컨트롤러 private 메서드 `SchedulesController.toResponse` — 같은 이름의
  `ExecutionsService.toResponseExecution` 과는 문자열이 다르고 클래스도 다른 스코프라 충돌 아님.

**INFO** — `TriggerWorkflowRefDto`(`{id, name}`)와 `ScheduleTriggerWorkflowRefDto`(`{name}`만)는
"트리거에 딸린 워크플로우 참조"라는 **같은 개념**을 서로 다른 이름·다른 필드 구성으로 표현한다
(하나는 스케줄→트리거→워크플로우 3단 참조, 하나는 트리거→워크플로우 2단 참조라 소비처 필요
필드가 다르다는 점은 diff 주석에 근거가 있다 — `schedules/page.tsx` 는 `name`만, `triggers/page.tsx`
는 `id`·`name` 둘 다 읽는다). 이름 자체는 충돌하지 않으나, 이후 세 번째 참조 DTO가 또 생기면
"Ref" 계열 명명이 흩어질 소지가 있다는 점만 기록해 둔다 — 지금 당장 정정을 요구할 사안은 아니다.

### 3. API endpoint 충돌
이 diff 는 **신규 endpoint 를 추가하지 않는다**. e2e 테스트가 참조하는 엔드포인트
(`GET /api/schedules/:id`, `GET /api/triggers`, `POST /api/triggers/:id/interaction/revoke-token`,
`GET /api/triggers/:id` 등)는 모두 `spec/5-system/1-auth.md`·기존 트리거/스케줄 spec 에 이미
정의된 기존 경로이며, 새 method+path 조합은 없다. 해당 없음.

### 4. 이벤트/메시지명 충돌
webhook·queue·SSE 이벤트명 신설 없음. 해당 없음.

### 5. 환경변수·설정키 충돌
신규 ENV var·config key 없음. `ContractCheckOptions.allowMissing`(새 옵션 필드)은 테스트 헬퍼
내부 타입 옵션이라 spec 에 노출되는 설정키가 아니며, `spec/` 전체에서 `allowMissing`/
`allowUndeclared` 문자열은 등장하지 않아(grep 0건) 기존 문서화된 키와도 충돌하지 않는다.

### 6. 파일 경로 충돌
신규 파일은 `codebase/backend/src/repo-guards/__tests__/fixtures/dto/responses/optional-nullable.fixture.ts`
1개뿐이다(그 외는 기존 파일 수정). 동일 경로에 기존 파일이 없어 **덮어쓰기 충돌은 없다.**

**INFO** — 다만 명명 컨벤션이 인접 파일과 갈린다. `repo-guards/__tests__/` 아래 기존 fixture 는
전부 평평한 위치에 `<name>-fixture.ts`(하이픈) 패턴이다
(`eslint-unicorn-peer-fixture.ts`, `audit-action-binding-fixture.ts`,
`engine-error-code-anchor-fixture.ts`). 이번 신규 파일은 (a) `fixtures/dto/responses/` 서브폴더를
새로 만들고 (b) `optional-nullable.fixture.ts`(마침표) 로 이름 지어 이 저장소에서 처음 등장하는
형태다. 파일 충돌은 아니지만 향후 fixture 가 늘어나면 두 패턴이 공존하게 된다 — 강제 정정
사유는 아니고, 이후 fixture 추가 시 표준화 여부만 판단하면 된다.

## 요약

이번 PR 은 `spec/5-system/**` 를 건드리지 않는 backend-only 변경(§5.4 응답-계약 스윕 + 비밀
필드 스트립)이라 요구사항 ID·API endpoint·이벤트명·환경변수 축에서는 신규 식별자 자체가
발생하지 않는다. 코드에서 새로 도입된 DTO 클래스·인터페이스·모듈 상수·함수 이름은 저장소
전체 grep 으로 유일성을 확인했으며 기존에 다른 의미로 쓰이는 동명 식별자와 충돌하는 사례는
없다. 발견된 두 건은 모두 INFO 등급의 명명 일관성 참고 사항(유사 개념의 Ref DTO 이명·신규
fixture 서브폴더/구두점 관례)이며 충돌·혼선 위험은 낮다.

## 위험도

NONE
