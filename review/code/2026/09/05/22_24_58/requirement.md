# 요구사항(Requirement) 리뷰

## 검토 방법

이 PR 은 이미 4라운드(`18_23_02`→`19_08_18`→`20_45_37`→`21_40_37`)의 코드 리뷰 + 3라운드
consistency 리뷰를 거쳤고, 각 라운드의 Critical/실질 Warning 은 RESOLUTION.md 로 조치가
확인된다. 본 라운드(5차)는 그 누적 상태 + 최신 커밋(`7e85da873`, "계약 대조를 목록·PATCH
로 넓히자 drift 2건이 나왔다")을 대상으로, 프롬프트 diff 뿐 아니라 다음을 직접 `Read`/
`Bash`(`git show`, `grep`)로 열어 실측 대조했다: `schedules.controller.ts`,
`triggers.service.ts`(전체 1467줄 중 sanitizeForResponse·create·update·findAll·findById 구간),
`response-contract.ts`(전체 443줄), `swagger-dto-contract-guard.ts`(핵심 술어),
`swagger-dto-contract.spec.ts`(EXPECTED_OPTIONAL_NULLABLE_DRIFT 78건 개수 재계산),
관련 엔티티(`trigger.entity.ts`·`alert-rule.entity.ts`·`schedule.entity.ts`·
`integrations.service.ts` `toPublic`), FE 소비처(`schedules/page.tsx`·`triggers/page.tsx`),
`spec/1-data-model.md §2.9.1`, `plan/in-progress/spec-draft-nullable-notation-followups.md`.

## 발견사항

없음 — Critical/Warning 급 신규 결함을 찾지 못했다. 실측으로 확인한 핵심 사실은 다음과 같다
(발견이 아니라 검증 기록):

- **비밀 유출 수정의 완결성**: `TRIGGER_RESPONSE_STRIP_COLUMNS`(`notificationSecretV2`·
  `chatChannelTokenV2`)는 `sanitizeForResponse` 단일 진실에서 무조건 `delete` 되고(이전
  라운드가 지적한 "undefined 대입 후 delete" 이중 순회는 이미 제거됨, 현재
  `triggers.service.ts:645-655` 는 단일 루프), `findAll`/`findOneDetail`/`create`/`update`
  네 경로 전부가 이를 거친다. `SchedulesController.toResponse()` 도 조인된 트리거를
  4필드(`id`·`name`·`workflowId`·`workflow.name`)로 좁혀 같은 비밀이 스케줄 조인 경로로
  새는 것을 막는다. 코드베이스 전수 grep(`notificationSecretV2`/`chatChannelTokenV2`)으로
  확인한 결과 이 두 컬럼을 응답 경로에서 다루는 곳은 `triggers.service.ts` 뿐이고, 다른
  서비스(`auth-configs.service.ts`, `dashboard.service.ts`, `executions/utils/
  execution-trigger.ts`)의 트리거 조인은 전부 `name`/`type` 등 특정 필드만 selective
  하게 뽑아 엔티티를 통째로 반환하지 않는다 — 이 PR 범위 밖 코드도 안전하다.
- **최신 커밋(`7e85da873`)의 PATCH `undefined` 덮어쓰기 수정**: `tsconfig.json` 의
  `target: ES2023` 는 TypeScript 기본값으로 `useDefineForClassFields: true` 를 함의하므로,
  `UpdateTriggerDto` 의 `name?: string` 같은 optional 필드가 인스턴스화 시 값 없이도
  `undefined` own-property 로 생성된다는 커밋 메시지의 설명은 기술적으로 정확하다. 수정
  (`Object.entries(rest).filter(([, v]) => v !== undefined)`)은 `null`(명시적 초기화 의도,
  예: `authConfigId: null`)과 `undefined`(미제공)를 정확히 구분해 `null` 은 그대로 통과시키고
  `undefined` 만 걸러낸다 — 의도된 필드 초기화 기능을 깨지 않는다.
- **DTO 신규 필드 선언과 실제 값 소스의 일치**: `AlertRuleDto.createdBy`/`lastTriggeredAt` ↔
  `alert-rule.entity.ts` 의 `nullable: true` 컬럼과 정확히 일치. `IntegrationDto.appUrl` 등
  6필드 ↔ `IntegrationsService.toPublic()` 이 `credsUnreadable` 분기·정상 분기 양쪽에서
  `...sanitizedEntity` 스프레드로 항상 포함시키는 것과 일치. `TriggerDto` 의 6개
  chat-channel/notification health 필드 ↔ `trigger.entity.ts` 의 non-nullable/nullable
  컬럼 선언과 일치. `ScheduleDto.trigger`(non-optional) ↔ `Schedule.trigger_id` 가
  `@Column({ name: 'trigger_id' })`(nullable 옵션 없음 = NOT NULL)이고 `1-data-model.md
  §2.9.1` 의 "Schedule.trigger_id는 NOT NULL — 반드시 Trigger와 1:1 매핑" 서술과 일치.
- **키 생략형(optional) 필드의 실제 로드 조건 일치**: `ScheduleTriggerRefDto.workflow` /
  `TriggerDto.workflow` 는 `findAll`(join)·`findById`(relations)에서만 채워지고
  `create`/`update` 직후 대입 경로에서는 비는데, 이 비대칭이 실제 서비스 코드
  (`schedules.service.ts`·`triggers.service.ts`)의 조회 방식과 정확히 일치한다.
- **FE 소비처 인용 정확성**: DTO 주석이 인용한 `schedules/page.tsx`(`s.trigger?.name` ·
  `s.trigger?.id` · `s.trigger?.workflowId` · `s.trigger?.workflow?.name`)와
  `triggers/page.tsx`(`t.workflow?.id` · `t.workflow?.name`)를 직접 열어 대조, 인용대로
  존재함을 확인.
- **래칫 수치의 정확성**: `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 실제 원소 수 = 78(재계산 확인,
  CHANGELOG "78건" 과 일치). `execution-response.dto.spec.ts` 의 `OPTIONAL_NULLABLE_DRIFT`
  = 10(일치). 이번 PR 이 새로 선언한 필드 중 어느 것도 이 두 래칫 목록에 등장하지 않음 —
  즉 §5.4 금지 조합(`required:false` + `nullable:true`)으로 새로 넓어진 케이스가 없다.
  CHANGELOG 의 "23필드" 표도 실제 5개 DTO 항목 합계(7+6+7+2+1)와 일치.
- **`allowMissing`(response-contract.ts) 신규 옵션**: `workflow-crud.e2e-spec.ts` 의
  `allowMissing: ['formatVersion']` 사용처가 `spec/2-navigation/1-workflow-list.md:153`
  의 "포맷 버전 협상은 미구현 (Planned)" 명시 서술과 정확히 대응 — JSDoc 이 요구하는
  "그 갭이 spec 본문에 Planned 로 이미 적혀 있는 경우" 조건을 충족한다. 구현
  (`visit()` 의 `isRequired && !walk.allowMissing.has(path)`)도 `missing` 축에만 적용되고
  `undeclared`/`null` 축과는 분리돼 있으며, `response-contract.spec.ts` 가 이름 정확 매칭·
  중첩 경로 스코프·축 분리를 각각 별도 테스트로 단언한다.
- **`contractForDto` 메모이제이션**: 진행 중 promise 를 캐시하고 실패 시 캐시에서 제거 후
  재던지는 구현이 JSDoc 설명과 일치하며, 이전 라운드가 지적한 "worker 단위" 오기술은
  "파일 단위" 로 정정되어 있다(Jest 는 파일마다 모듈 레지스트리를 새로 만드는 것이 사실과
  부합).
- TODO/FIXME/HACK/XXX 계열 주석 신규 도입 없음 (`git diff origin/main...HEAD` 전수 grep 0건).

이전 라운드에서 이미 처분(수용 유예)된 항목 — 본 라운드에서 재조사했으나 새로운 논거가
없어 유예 판단을 유지한다: `IntegrationDto.consecutiveNetworkFailures` FE 미소비(별도 wire
변경 항목으로 이미 등재), `ScheduleDto.trigger`/`workflow` 의 nav-spec 문서 이관
(planner 소유로 `plan/in-progress/spec-draft-nullable-notation-followups.md:768` 에 등재
확인), `toResponse()` 의 `update()` 경로 trigger-narrowing 이 unit 미검증(e2e G/H 가
`assertMatchesContract(patch.body.data, contractForDto(TriggerDto/ScheduleDto))` 로 대체
커버 — `schedule-trigger.e2e-spec.ts` G·H·C-3 확인).

## 요약

`sweep-response-contract` 브랜치는 §5.4 응답-계약 검증자 배선 확대(4→18 DTO)와 그 과정에서
실측으로 드러난 트리거 회전 secret 유출(엔티티 컬럼 미스트립 + 스케줄 조인을 통한 2차 유출)
수정, 5개 DTO 23필드 선언 보정(wire 불변)을 담은 단일하고 응집력 있는 교정 PR 이다. 5차
리뷰인 이번 라운드에서 프롬프트에 제시된 diff 뿐 아니라 대상 소스 파일 전체·연관 엔티티·
FE 소비처·spec 문서·기존 RESOLUTION 이력을 직접 열어 line-level 로 교차 검증했고, 값 소스
(엔티티 nullable, 서비스 조회 경로)와 DTO 선언·주석의 주장이 전부 일치함을 확인했다. 최신
커밋의 PATCH `undefined` 덮어쓰기 수정도 `useDefineForClassFields`/`target: ES2023` 조합에
대한 기술적으로 정확한 진단에 기반하며 `null`(명시적 초기화)과 `undefined`(미제공)를
올바르게 구분한다. 신규 Critical/Warning 은 발견되지 않았고, 남아 있는 항목은 모두 이전
라운드에서 근거와 함께 처분되어 plan 트래커에 정확히 등재된 것으로 확인했다.

## 위험도
NONE
