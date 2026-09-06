# 정식 규약 준수 검토 — convention_compliance

## 검토 범위와 방법

- target: `spec/5-system/` (impl-done, diff-base `origin/main`). `spec/5-system/` 자체는 이 브랜치에서 **델타 0** — 정상이며 그 자체로 결함이 아니다.
- 실제 변경은 코드 30개 파일 / 2003줄 (`git diff origin/main...HEAD --stat`, review 산출물 제외 시 핵심은 `schedules`/`triggers`/`integrations`/`knowledge-base`/`alerts` 응답 DTO + `swagger-dto-contract-guard.ts` + `response-contract.ts` + e2e/unit 테스트). 이는 `spec/5-system/2-api-convention.md §5.4`(부재 표현 규약)·`spec/conventions/swagger.md`·`spec/conventions/secret-store.md`·`spec/conventions/review-citations.md` 가 규율하는 표면이라, 프롬프트가 예산으로 자른 이 네 conventions 파일을 워킹트리에서 절대경로로 직접 열어 대조했다 (`Read`).
- 코드 확인은 전부 `/Volumes/project/private/clemvion/.claude/worktrees/sweep-response-contract-5ba0ad` 워킹트리(HEAD) 기준.

---

## 발견사항

### [WARNING] 응답 DTO 클래스 JSDoc 에 리뷰 인용을 넣었다 — `review-citations.md §3` + `swagger.md §3` 위반

- target 위치: 이 항목은 `spec/5-system/` 문서 자체가 아니라 그 문서가 참조하는 [`spec/conventions/swagger.md §3`](../../../../../spec/conventions/swagger.md)·[`spec/conventions/review-citations.md §3`](../../../../../spec/conventions/review-citations.md) 규약과, 그 규약이 규율하는 이번 diff 의 코드 위치다.
- 위반 규약: `spec/conventions/review-citations.md §3` 표의 "DTO·컨트롤러의 `/** */` JSDoc" 행 — *"대상 아님 — 그 JSDoc 은 공개 OpenAPI `description` 으로 나간다. 리뷰 인용은 소비자가 읽을 문장이 아니므로 애초에 거기 쓰지 않는다 — `swagger.md §3` 이 정한 대로 바로 위 `//` 주석에 적는다"*. 동일 취지로 `spec/conventions/swagger.md §3`(2026-09-05 규약화)도 *"정정 경위·리뷰 참조·'왜 이렇게 바꿨는지' 같은 내부 서사는 JSDoc 이 아니라 그 위의 `//` 주석에 적는다"* 고 명시한다.
- 상세: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts` 7~16행, `TriggerWorkflowRefDto` 클래스 선언 바로 위 `/** */` 블록에 리뷰 경로 인용이 그대로 박혀 있다:
  ```ts
  /**
   * 트리거 응답에 동봉되는 **워크플로우 참조** — 목록 UI 가 쓰는 두 필드만 담는다.
   *
   * `findAll` 의 `leftJoinAndSelect('t.workflow','w')` 와 `findById` 의
   * `relations: ['workflow']` 가 **Workflow 엔티티 전체**를 실어 왔고, `TriggerDto` 는 그것을
   * 선언조차 하지 않았다 — §5.4 응답-계약 대조를 목록·수정 경로로 넓히자 드러났다
   * (`review/code/2026/09/05/21_40_37` W1). `ScheduleDto.trigger` 와 같은 처방이다.
   ...
   */
  export class TriggerWorkflowRefDto { ... }
  ```
  같은 패턴이 `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts` 3~14행의 `ScheduleTriggerWorkflowRefDto` 클래스 JSDoc 에도 있다 — 리터럴 리뷰 경로는 없지만 "종전 응답은... 새어 나왔다 — §5.4 응답-계약 스윕이... 검출해 드러났다" 라는 **정정 경위**가 그대로 `/** */` 안에 있다. `review-citations.md §3` 이 금지하는 것도 정확히 이 종류다.
  - 흥미로운 점: 같은 파일·같은 diff 의 `ScheduleDto.trigger` **필드** JSDoc 은 이 규칙을 정확히 지켰다 — 필드 설명은 `/** */`에, 리뷰 인용(`review/consistency/2026/09/05/21_40_38 W1`)은 바로 아래 `//` 로 내리며 "내부 참조라 `//` 에 둔다: 필드 JSDoc 은 `introspectComments` 로 공개 OpenAPI description 이 된다 (`swagger.md §3`)" 라고 스스로 근거까지 적어 뒀다. 즉 작성자가 규칙 자체는 알고 있었고, **필드 단위에는 적용했지만 클래스 단위에는 놓쳤다.**
  - `review-citations.md` 자신이 이 규약을 `swagger.md §3` 과 **같은 날(2026-09-05)** 등재하면서 "실제 위반 사례는 없지만 두 규약이 서로를 모르는 상태를 남기지 않는다" 고 적어 뒀는데, 그 직후(같은 날, 더 늦은 세션 — `review/code/2026/09/05/21_40_37`)에 정확히 그 사례가 생겼다.
  - **완화 요인(실측)**: `@nestjs/swagger@11.4.5` 플러그인(`dist/plugin/visitors/model-class.visitor.js`)을 직접 열어 확인한 결과, `introspectComments` 기반 `description` 생성은 `ts.isPropertyDeclaration(node)` 경로에서만 호출되고 **클래스 선언 자체의 JSDoc 은 스캔 대상이 아니다** — 즉 이 리뷰 인용이 오늘 시점 실제 OpenAPI 출력으로 새어 나가지는 않는다(라이브 wire 유출 없음). 그럼에도 `review-citations.md §3` 의 표 문구는 "DTO·컨트롤러의 `/** */` JSDoc" 전체를 대상 밖으로 규정해 클래스/필드를 가르지 않으므로, **문면상으로는 명백한 위반**이다.
- 제안: `TriggerWorkflowRefDto`·`ScheduleTriggerWorkflowRefDto` 클래스 doc 을 필드 예시와 동일한 패턴으로 쪼갠다 — 소비자가 알아야 할 것(무엇을 담는 DTO인지, 소비처)만 `/** */` 에 남기고, "왜 새로 만들었는지·어느 리뷰가 찾았는지" 는 바로 위 `//` 로 옮긴다. (혹은 이 클래스-vs-필드 경계가 의도된 완화라면 `review-citations.md §3` 표 행을 "DTO·컨트롤러의 **필드** `/** */` JSDoc" 으로 좁혀 명시하는 규약 갱신도 대안이다 — 다만 규약 문면이 현재 그렇게 읽히지 않는다.)

### [INFO] `TriggerDto.chatChannelHealth`/`notificationHealth` 가 엔티티 타입 별칭을 그대로 가져와 쓴다

- target 위치: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts` 2~5행 `import type { TriggerChatChannelHealth, TriggerNotificationHealth } from '../../entities/trigger.entity'` 및 107·123행 필드 타입.
- 위반 규약(경향): `spec/conventions/swagger.md §5-1` — *"엔티티 enum 에서 파생하지 않습니다 — (a) DTO 레이어가 엔티티에 결합되지 않아야 하고 ... 로컬 리터럴이 wire SoT 입니다."* 게다가 `chatChannelHealth`/`notificationHealth` 두 필드가 정확히 동일한 값 집합(`'unknown'|'healthy'|'degraded'`)을 공유하므로, 같은 절의 "형제 DTO 가 같은 enum 을 공유하면 `*.literal.ts` 로 뺀다" 정신과도 맞닿아 있다(다만 그 규칙은 문면상 "형제 **DTO**" 사이 공유를 겨냥하지, 한 DTO 안의 두 필드 공유까지 명시하지는 않는다).
- 상세: `@ApiProperty({ enum: [...], ... })` 데코레이터 자체는 하드코딩 리터럴 배열이라 엔티티 선언 순서에 흔들리지는 않지만(§5-1 이 우려하는 (b) 는 회피), TS 필드 타입을 엔티티 모듈에서 `import type` 하는 것 자체가 (a) 가 말하는 "결합" 이다.
- **완화 요인**: 이 패턴은 이번 diff 가 처음 도입한 게 아니라 저장소 전역에 이미 널리 퍼져 있다 — `edge-response.dto.ts`(`EdgeType`), `execution-response.dto.ts`(`ExecutionStatus`), `model-config-response.dto.ts`(`MODEL_CONFIG_KINDS`), `node-response.dto.ts`(`NodeCategory`), `integration-response.dto.ts`(`IntegrationStatus`), `login-history.dto.ts`(`LoginHistoryEvent`), `workflow-test-dataset-response.dto.ts`(`TestDatasetVisibility`) 등 최소 6곳이 동일하게 엔티티에서 타입을 import 한다. 즉 이 diff 는 **기존에 이미 정착된(비록 §5-1 문면과는 어긋나는) 코드베이스 관행을 그대로 따른 것**이지, 새로운 이탈이 아니다.
- 제안: 이 diff 범위에서 고치라는 뜻은 아니다 — 다음에 `chatChannelHealth`/`notificationHealth` 를 손댈 때 `dto/responses/trigger-health.literal.ts` 로 값 집합을 추출하는 것을 고려할 수 있고, 더 근본적으로는 `swagger.md §5-1` 의 "엔티티 enum 파생 금지" 문구가 현실(7곳 기존 위반)과 벌어져 있다는 사실 자체를 별도로 실측·정리하는 편이 값지다 — 이 규약도 §3 DTO 길이 규칙처럼 "문면은 강제인데 관행은 아니다" 상태일 가능성이 있다.

---

## 준수 확인 (위반 아님 — 정합성 근거로 기록)

- **`secret-store.md §1.1` 세 필드 완전 스트립**: 이 절이 이름으로 열거한 `config.interaction.triggerToken`·`Trigger.notification_secret_v2`·`Trigger.chat_channel_token_v2`(+ref 계열 `botTokenRef`/`config.notification.signing.secretRef`) 가 `triggers.service.ts` 의 `INTERACTION_RESPONSE_STRIP_KEYS`/`TRIGGER_RESPONSE_STRIP_COLUMNS`/`NOTIFICATION_SIGNING_STRIP_KEYS`/`CHAT_CHANNEL_RESPONSE_STRIP_KEYS` 네 상수로 전부 커버된다. 이전 라운드(§1.1 문서 자체가 지적)까지는 셋 중 둘만 닫혀 있었는데 이번 diff(`66a2510fd`)가 `triggerToken` 을 마저 닫아 **완전 준수**로 전환했다. `select: false` 를 쓰지 않은 이유(로테이션 스윕이 그 컬럼을 읽어야 해서 fail-silent 위험)도 secret-store.md §1.1 이 명시한 지침과 정확히 일치한다.
- **`2-api-convention.md §5.4` 선언 형태**: 새로 선언한 모든 필드가 규칙대로 갈렸다 — 상시 존재(`trigger`, `chatChannelHealth` 등)는 `@ApiProperty({ nullable: true })` + `T | null`, 키 생략형(`workflow?`)은 `@ApiPropertyOptional()` + `T`(`| null` 없음)로 정확히 분기했고, `IntegrationDto.appUrl` 은 처음 키 생략형으로 잘못 선언했다가 e2e 계약 대조(`response-contract.ts`)가 반증해 §5.4 기본형으로 정정한 이력까지 diff 안에 남아 있다 — §5.4 가 요구하는 "검증 층" 이 실제로 작동한 사례다.
- **§5.4 "검증 층" 확장이 실제로 스펙이 말한 그대로 동작**: `2-api-convention.md §5.4`(§검증 층)가 선언한 두 검증자(`swagger-dto-contract-guard.ts` = 선언↔선언, `response-contract.ts` = 값↔선언) 구분과 diff 의 실제 동작이 일치한다 — 새 세 번째 축(`required:false`+`nullable:true` 래칫)도 §5.4 "응답 바디는 대상, 요청 바디는 tri-state라 대상 아님" 경계를 `isResponseDtoFile`(`/dto/responses/` 경로 필터)로 정확히 구현했다.
- **DTO 파일 위치·명명**: 신규 `ScheduleTriggerRefDto`/`ScheduleTriggerWorkflowRefDto`/`TriggerWorkflowRefDto` 모두 `dto/responses/*-response.dto.ts` 안에 위치하고 `Dto` 접미를 지킨다 (`swagger.md §5-1`). nested object 선언도 `@ApiProperty({ type: () => X })` 패턴(`swagger.md §1-4`)을 그대로 따른다.
- **CHANGELOG 관행 일치**: 이번 diff 의 CHANGELOG 항목(트리거 회전 secret 유출)이 바로 위에 이미 있던 "`GET /api/audit-logs` User 26키 유출" 항목과 동일한 서술 구조(영향 → 원인 → 수정 → 회귀 테스트)를 따른다 — 이 저장소가 굳힌 관행과 일치.
- **리뷰 인용 형식(§2 날짜 포함)**: 이번 diff 가 코드/테스트 주석(`//`)에 남긴 리뷰 인용은 전부 `review/code/2026/09/05/HH_MM_SS` 전체 경로 형식이며 `review-citations.md §2` 의 "권장" 형태를 따른다 — 위 WARNING 은 인용 **형식**이 아니라 인용이 **놓인 자리**(클래스 JSDoc)의 문제다.
- **secret-store.md §1.1 로 인용된 두 검증 축**(`api-convention §5.4` 응답-계약, `swagger.md §5-1` 엔티티 패스스루 금지)이 실제로 이번 diff 의 사고 원인(엔티티 조인 패스스루)을 정확히 짚었고, 수정도 "엔티티를 고치지 않고 응답 경계에서 지운다"는 두 규약의 공통 원칙을 따랐다.
- **신규 에러 코드·URL·audit action 없음**: 이번 diff 는 순수 응답 형태 정정이라 `error-codes.md`·`audit-actions.md`·URL 명명 규약(`2-api-convention.md §2`) 대상 표면을 건드리지 않는다 — 위반 후보 자체가 없다.

---

## 요약

`spec/5-system/` 문서 자체는 이번 브랜치에서 바뀌지 않았고, 실제 코드 변경(트리거·스케줄 응답의 조인 엔티티 비밀 유출 스윕 + DTO 선언 정합화)은 `2-api-convention.md §5.4`·`swagger.md`·`secret-store.md` 세 규약이 요구하는 형태를 거의 전부 정확히 따른다 — 특히 secret-store.md §1.1 이 열거한 세 필드의 완전 스트립과 §5.4 nullable/optional 선언 분기는 모범적으로 집행됐다. 유일한 실질적 흠은 새로 만든 두 참조 DTO(`TriggerWorkflowRefDto`, `ScheduleTriggerWorkflowRefDto`)의 **클래스 레벨** JSDoc 에 "왜 이렇게 만들었는지"의 경위·리뷰 인용을 그대로 남겨, 같은 날 갓 등재된 `review-citations.md §3`("DTO·컨트롤러의 `/** */` JSDoc 은 리뷰 인용 대상 아님")과 `swagger.md §3`("내부 서사는 `//`로")을 문면상 위반한 것이다 — 같은 diff 의 필드 레벨 JSDoc 은 정확히 규칙을 지켰다는 점에서 일관성 결여가 두드러진다. 다만 실측(`@nestjs/swagger` 플러그인 소스 확인)으로는 클래스 JSDoc 이 현재 OpenAPI `description` 으로 새어 나가지 않아 소비자에게 실질적 해는 없다. 부수적으로 `chatChannelHealth`/`notificationHealth` 가 엔티티 타입을 그대로 import 하는 것도 §5-1 문면과는 어긋나지만, 저장소 전역에 이미 6곳 이상 같은 패턴이 있어 이번 diff 특유의 이탈이 아니라 기존 관행의 연장이다.

## 위험도

LOW
