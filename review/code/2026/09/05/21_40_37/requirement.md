# 요구사항(Requirement) 리뷰

## 검토 방법

이 PR 은 이미 4라운드의 코드 리뷰(`18_23_02`, `19_08_18`, `20_45_37` + 이번 `21_40_37`)와
4라운드의 consistency 리뷰(`18_23_03`, `19_08_19`, `20_45_39`)를 거쳤고, 매 라운드 발견사항이
`RESOLUTION.md` 로 실제 반영됐다. 프롬프트에 실린 diff 는 대부분(파일 32~97)이 그 과거
라운드의 산출물(`review/**`)이라 이번 라운드의 새 검토 대상이 아니다 — 실질 코드 변경은
파일 1~30(`triggers.service.ts`, `schedules.{controller,service}.ts`, 5개 DTO, `response-contract.ts`,
`swagger-dto-contract-guard.ts`, 관련 테스트)이다.

과거 라운드의 "고쳤다" 주장을 신뢰하지 않고, HEAD(`67881bbd4`)의 실제 코드를 `Read`/`grep`
으로 직접 열어 다음을 독립적으로 재검증했다:

- `triggers.service.ts` `sanitizeForResponse` — 세 비밀 경로(chatChannel JSONB · notification.signing
  JSONB · 엔티티 컬럼) 전부, 조기 return 없이, 6개 호출부(`findAll`/`findOneDetail`/`create`/`update`
  등) 전부 경유하는지
- `schedules.service.ts` `create()`/`update()` — `saved.trigger` 대입이 둘 다 `if (isActive)` **밖**에
  있는지 (대칭 회귀 여부)
- `schedules.controller.ts` `toResponse()` — 트리거 참조 4필드 좁히기가 실제 FE 소비처
  (`schedules/page.tsx:507-514`)와 정확히 일치하는지
- 5개 DTO 신규 23필드 각각을 대응 엔티티 컬럼의 `nullable`/타입과 1:1 대조
- `response-contract.ts` `allowMissing`/`contractForDto` 메모이제이션의 최종 배치(JSDoc-함수 인접성)
- `swagger-dto-contract-guard.ts` `findOptionalNullableResponseFields` 래칫의 baseline 78건을
  실측 카운트로 재확인
- `spec/5-system/2-api-convention.md §5.4`(검증 층 표) 및 `spec/2-navigation/1-workflow-list.md`
  (`formatVersion` Planned 갭)와의 line-level 대조

## 발견사항

- **[INFO]** `workflow-crud.e2e-spec.ts` 가 `ExportWorkflowDto` 를 `WorkflowDto` 와 별도 `import`
  문으로 추가해 같은 모듈에서 온 두 타입이 import 두 줄로 나뉜다.
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts:13-14`
  - 상세: 기능에는 영향 없는 스타일 사소함. 이미 이전 라운드(`18_23_02/scope.md`)에서
    지적·"조치 불요(사소)"로 확정된 항목이며 이번 라운드에도 그대로 남아 있다 — 새 발견이
    아니라 carried-over 확인.
  - 제안: 조치 불요. 다음에 이 파일을 손댈 때 한 줄로 병합.

- **[INFO]** §5.4 래칫의 양성 대조군 fixture(`optional-nullable.fixture.ts`)가 여전히 `spec/`
  의 `code:` glob 커버리지 밖에 있다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/fixtures/dto/responses/optional-nullable.fixture.ts`
  - 상세: `plan/in-progress/spec-draft-nullable-notation-followups.md:742-745` 에 planner 후속으로
    이미 등재돼 있고(`review/consistency/2026/09/05/20_45_39` W1 조치), `spec/` 쓰기는 developer
    권한 밖이라 이번 라운드에서 추가로 취할 조치가 없다. 새 결함이 아니라 확인 기록.
  - 제안: 조치 불요(등재 완료, planner 턴 대기).

이 두 건 외에 기능 완전성·엣지 케이스·에러 시나리오·데이터 유효성·비즈니스 로직·반환값·
spec fidelity 관점에서 새로 발견된 CRITICAL/WARNING 은 없다. 아래는 그 판정의 근거가 된
line-level 검증 결과다.

### 비즈니스 로직 / 대칭성 — 확인됨

`schedules.service.ts` 의 `create()`(:198-207)와 `update()`(:260-267)는 이번 diff 로 `saved.trigger`
대입이 각각 `if (isActive)`/`if (schedule.isActive)` **밖**으로 옮겨져 있다 — 비활성 스케줄
생성·PATCH 비활성화 양쪽 모두 응답에서 `trigger` 키가 사라지지 않는다. `findAll`(:82-83
`leftJoinAndSelect('s.trigger','t').leftJoinAndSelect('t.workflow','w')`)과 `findById`(:129
`relations: ['trigger','trigger.workflow']`) 도 둘 다 `workflow` 관계까지 로드해, `toResponse()`
가 `t.workflow` 유무로 `workflow` 필드 존재를 정확히 반영할 수 있는 데이터를 항상 받는다.

### 정화(sanitization) 경로 — 전수 확인됨

`triggers.service.ts` `sanitizeForResponse()`(:570 이하)는 (1) `config.chatChannel` (2)
`config.notification.signing` (3) 엔티티 컬럼(`TRIGGER_RESPONSE_STRIP_COLUMNS`) 세 곳을 조기
return 없이 처리하고, 호출부 `grep` 결과 `findAll`/`findOneDetail`/`create`/`update` 등 6개
반환 지점 전부가 이 메서드를 거친다 — 유출 경로가 남아 있지 않다. 이전 라운드
(`18_23_02/maintainability.md`)가 지적한 "undefined 대입 후 delete" 이중 순회 죽은 코드는
현재 단일 `delete` 루프(:634-636)로 정리돼 더 이상 존재하지 않는다.

### DTO 신규 23필드 — 엔티티 대조 결과 전부 일치

`AlertRuleDto.{createdBy,lastTriggeredAt}`, `IntegrationDto.{appUrl,mallId,tokenExpiresAt,
lastRotatedAt,lastUsedAt,consecutiveNetworkFailures}`, `KnowledgeBaseDto.{documentCount,
embeddingModelConfigId,rerankMode,rerankCandidateK,rerankScoreThreshold,rerankConfigId,
rerankLlmConfigId}`, `TriggerDto.{chatChannelHealth,chatChannelLastError,chatChannelSetupAt,
chatChannelRotatedAt,notificationHealth,notificationLastError,notificationRotatedAt}` 를 각각
대응 엔티티 `@Column` 선언과 대조(7+6+7+2+1=23, CHANGELOG "23필드" 서술과 정확히 일치)한
결과, `nullable` 여부·타입이 DTO 선언과 전부 일치한다. `appUrl` 만 엔티티 컬럼이 아니지만
`IntegrationsService.toPublic` 의 `{ appUrl: null }` 기저값 때문에 상시 존재이고, DTO 도 그에
맞춰 `@ApiProperty({ nullable: true })` 기본형으로 선언돼 있다 — CHANGELOG(:53-55)도 정정된
서술(기본형)로 코드와 일치한다.

### 스코프 좁히기(ScheduleTriggerRefDto) — FE 소비처와 정확히 일치

`schedules/page.tsx:507-514` 가 실제로 읽는 필드는 `trigger.name`·`trigger.id`·
`trigger.workflowId`·`trigger.workflow.name` 넷뿐이고, `ScheduleTriggerRefDto`/
`ScheduleTriggerWorkflowRefDto` 는 정확히 그 넷만 선언한다 — 과다·과소 노출 없음.

### 래칫 baseline — 실측 78건 일치

`EXPECTED_OPTIONAL_NULLABLE_DRIFT` 배열을 직접 파싱해 세어 정확히 **78개** 항목임을
확인했다 — CHANGELOG·RESOLUTION 이 주장하는 수치와 일치한다. 이번 diff 가 새로 선언한
23필드 중 이 금지 조합(`required:false`+`nullable:true`)에 해당하는 것은 하나도 없다(전부
`@ApiProperty(+nullable:true)` 기본형 또는 `@ApiPropertyOptional()` 키 생략형).

### spec fidelity — §5.4 / workflow-list Planned 갭

`spec/5-system/2-api-convention.md:191-237` 의 §5.4 본문(부재 표현 규칙 + "검증 층" 두 검증자
표)과 코드 주석·`response-contract.ts`/`swagger-dto-contract-guard.ts` 의 JSDoc 이 line-level
로 일치한다. 세 번째 검증 축(`findOptionalNullableResponseFields`)이 spec 표에 별도 행으로
없는 것은 결함이 아니다 — §5.4 자신이 "판정 규칙의 상세 표는 코드의 JSDoc 이 단일 진실"
이라고 명시해 두었고(:243-246), 이는 spec 이 의도적으로 코드를 SoT 로 위임한 회색지대다
(SPEC-DRIFT 아님, INFO 성격 — 이미 이전 consistency 라운드가 같은 결론).

`workflow-crud.e2e-spec.ts` 의 `allowMissing: ['formatVersion']` 은 `spec/2-navigation/
1-workflow-list.md:153` 의 "포맷 버전 협상은 미구현 (Planned)" 서술과 정확히 대응하고,
`ExportWorkflowDto.formatVersion` 이 실제로 `@ApiProperty()`(required, no `?`)로 선언돼 있어
`allowMissing` 옵션의 설계 목적(문서화된 갭에 한정)에 부합한다.

## 요약

프롬프트에 실린 97개 파일 중 실질 코드 변경은 30개(§5.4 응답-계약 검증자 배선 4→18 DTO,
트리거 회전 secret 2경로 유출 차단, 5개 DTO 23필드 선언 보정, `allowMissing`/`contractForDto`
메모이제이션, `swagger-dto-contract-guard.ts` 신규 래칫)이며 나머지는 과거 4라운드 리뷰
산출물이다. 그 4라운드가 발견한 Critical 2건(§5.4 자기 위반 · 존재하지 않는 fixture 참조)과
WARNING 다수(create/update 비대칭, strip 목록 누락, CHANGELOG 수치 오차, JSDoc 분리 등)를
현재 HEAD 코드에서 직접 대조 재검증한 결과 전부 실제로 반영·해소돼 있음을 확인했다. 이번
라운드에서 독립적으로 재검토한 결과 새로운 Critical/Warning 은 발견하지 못했다 — DTO 23필드
전부가 대응 엔티티 컬럼과 nullable/타입이 일치하고, 스케줄 trigger narrowing 이 FE 소비처와
정확히 일치하며, 정화 경로가 조기 return 없이 전 호출부를 경유하고, 래칫 baseline 수치(78)와
CHANGELOG 정량 서술(23필드)이 실측과 일치하고, §5.4 spec 본문과 검증자 JSDoc 이 line-level
로 부합한다. 남은 두 항목(import 두 줄 분리, canary fixture 의 `code:` 미등재)은 이미 이전
라운드에서 조치 불요/planner 후속 등재로 확정된 carried-over INFO 이며 이번 발견에 새로
추가할 사항이 없다.

## 위험도

NONE
