# 정식 규약 준수 검토 — convention_compliance

## 범위 및 방법

`spec/5-system/**` 자체의 이번 브랜치 델타는 0(스코프 내 spec 문서 미변경)이라, 검토 대상은
그 영역의 정식 규약(`spec/conventions/swagger.md`, `spec/conventions/review-citations.md`,
`spec/conventions/error-codes.md`, `spec/conventions/audit-actions.md`, `spec/conventions/node-output.md`,
`spec/5-system/2-api-convention.md` §5.4, `spec/5-system/1-auth.md`)을 **구현이 실제로
준수하는가**로 좁혔다. 프롬프트 번들이 예산 절단으로 conventions 본문·diff 본문 대부분을
담지 못해(17개 spec/5-system 파일 + conventions 274개 파일 생략), 아래는 워킹트리를
절대경로로 직접 확인한 실측이다 — `git diff origin/main...HEAD -- codebase/`(31개 파일,
순증 1,447줄)와 `spec/conventions/*.md` 원문을 직접 Read 했다.

같은 세션에서 이미 `review/consistency/2026/09/06/00_01_16/convention_compliance.md` 가
동일 스코프를 검토해 NONE 판정을 냈다. 그 이후 커밋 하나(`e018a176f` — `sanitizeForResponse`
5책임 분해 + JSDoc 정정)가 추가돼, 이번 검토는 (a) 그 라운드의 결론이 여전히 유효한지
재확인하고 (b) 신규 diff 를 별도로 훑었다.

## 발견사항

- **[WARNING]** 새 코드에 `review-citations.md` 가 명시적으로 **금지**한 bare `hh_mm_ss` 인용이 2건 신규 도입됨
  - target 위치:
    1. `codebase/backend/src/modules/schedules/schedules.service.spec.ts` (diff 기준 신설 JSDoc) — `` (`20_45_37` W2, `review/code/2026/09/05/23_30_00` INFO#6) ``
    2. `codebase/backend/test/schedule-trigger.e2e-spec.ts` (diff 기준 신설 `//` 주석) — `` // **수정 경로**도 같은 정화를 거치는가 (`21_40_37` W1). ``
  - 위반 규약: `spec/conventions/review-citations.md` §2 — "**bare `hh_mm_ss` 는 쓰지 않는다**"
    (표: `bare 시각` → **금지**). §4 는 *기존* bare 인용의 소급 정리를 면제할 뿐, 신규 도입을
    허용하지 않는다("기존 인용은 소급 정리 대상이 아니다" — 새로 쓰는 인용에는 적용되지
    않는 문장).
  - 상세: 두 인스턴스 모두 **`git diff` 상 `+` 라인**(이번 브랜치가 새로 추가)이며, 둘 다
    **테스트 파일의 주석**이라 §3 표의 예외("DTO·컨트롤러의 `/** */` JSDoc" 만 대상 아님)에
    해당하지 않는다 — `codebase/**` 코드·테스트 주석은 명시적으로 "적용" 대상이다.
    특히 인상적인 것은 **같은 파일 안에서 같은 세션을 두 가지 형태로 인용**한다는 점이다:
    `schedule-trigger.e2e-spec.ts` 는 262행 부근에서 같은 세션을
    `` `review/code/2026/09/05/21_40_37` W1 `` 으로 정확히 인용해 놓고, ~100줄 뒤 363행
    부근에서 같은 세션을 `` `21_40_37` W1 `` 으로 bare 인용한다 — 작성자가 규약을 몰라서가
    아니라 반복 작성 중 누락한 형태로 보인다. 이 규약(`review-citations.md`)은 이 브랜치가
    작업 중인 바로 그 §5.4 스윕과 같은 2026-09-05 그룹에서 등재된 최신 규약이라, 시행하는
    가드 코드가 없어(§Rationale "이 규약에는 시행하는 코드가 없다") CI 가 못 잡는다.
  - 제안: 두 자리를 각각 전체 경로 형태로 정정한다 — `20_45_37` → `` `review/code/2026/09/05/20_45_37` `` (이미 같은 줄에 있는 다른 인용과 형태를 맞추면 됨), `21_40_37` → `` `review/code/2026/09/05/21_40_37` ``. 소급 정리 대상이 아닌 것은 **기존** bare 인용이지, 이번 PR 이 새로 쓴 인용이 아니다 — 다음에 이 두 파일을 건드릴 때가 아니라 이번 PR 안에서 바로잡는 것이 원칙에 맞는다(§4 의 취지가 "일괄 소급 치환 금지"이지 "신규 위반 방치 허용"이 아님).

- **[INFO]** 응답 DTO 가 엔티티에서 유니온 타입을 직접 import (이전 라운드에서도 확인된 상태 유지)
  - target 위치: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts` 2~5행 (`import type { TriggerChatChannelHealth, TriggerNotificationHealth } from '../../entities/trigger.entity'`)
  - 위반 규약: `spec/conventions/swagger.md` §5-1 "엔티티 enum 에서 파생하지 않습니다"
  - 상세: 값 배열(`@ApiProperty({ enum: [...] })`)은 엔티티에서 파생되지 않고 수기로 직접
    선언돼 있어, 규칙이 실제로 막으려는 실패 모드("엔티티 enum 선언 순서가 wire 순서를
    흔든다")는 발생하지 않는다. 같은 타입-전용 import 패턴은 이 PR 이전부터
    `integration-response.dto.ts` 의 `IntegrationStatus` import 로 선례가 있다(`git blame`
    `c8c8e2cf90`, 2026-05-14) — 이번 PR 이 새로 도입한 이탈이 아니다.
  - 제안: 조치 불요. §5-1 문구가 "형제 DTO 공유" 문맥 안에 있어 단독 타입-전용 import 케이스
    적용 여부가 규약 자체로 불명확하므로, 다음에 그 절을 만질 때 예외를 한 줄 명시하면
    재해석 분쟁을 막을 수 있다(규약 갱신 쪽이 적절).

- **[INFO]** 같은 파일 안에서 동일 enum 값 배열이 두 번 반복 선언 (이전 라운드에서도 확인된 상태 유지)
  - target 위치: 위와 동일 파일, `chatChannelHealth`·`notificationHealth` — 둘 다 `@ApiProperty({ enum: ['unknown', 'healthy', 'degraded'], ... })`
  - 위반 규약: `spec/conventions/swagger.md` §5-1 "형제 DTO 가 같은 enum 을 공유하면 `*.literal.ts` 로 뺍니다"
  - 상세: 두 필드가 우연히 같은 값 집합을 쓰는 것이라, 공유 리터럴로 묶으면 "두 축은 항상
    같은 값 집합을 가진다"는 잘못된 불변식을 코드에 새기는 셈이다. 규약 문구의 표면("동일한
    값 집합을 노출할 때")만 보면 걸리지만, 독립 진화 가능성을 감안하면 현행 유지가 방어
    가능하다.
  - 제안: 현상 유지 권장(강제 아님). 두 축이 독립적으로 진화할 수 있다는 근거를 DTO 파일에
    한 줄 남기면 다음 리뷰어의 오독을 막는다.

## 준수 확인 (위반 없음, 참고용)

- `e018a176f`(이번 검토 델타)의 실질 변경 — `triggers.service.ts` 의 `sanitizeForResponse`
  5책임 분해(`stripChatChannelSecrets`/`stripInteractionSecrets`/
  `stripNotificationSigningSecrets`/`deleteSecretColumns`/`narrowWorkflowRef`)와
  `integration-response.dto.ts` `appUrl` JSDoc 정정 — 은 순수 리팩터/문서 정정이며 wire
  형태·DTO 선언을 바꾸지 않는다. §5.4 기본형·키생략형 판정에 영향 없음을 확인.
- DTO 신규 필드(`AlertRuleDto.createdBy`/`lastTriggeredAt`, `IntegrationDto.appUrl` 등,
  `KnowledgeBaseDto` 7필드, `ScheduleDto.trigger`, `TriggerDto` 7필드)는 전량
  `spec/5-system/2-api-convention.md` §5.4("상시 존재 → `nullable:true`" / "키 생략 →
  `@ApiPropertyOptional`")와 `swagger.md` §1-3/§1-6 을 정확히 따른다 — 상시 존재 필드는
  전부 `@ApiProperty({ nullable: true })` + `T | null`, 키 생략형(`ScheduleTriggerRefDto.workflow`,
  `TriggerDto.workflow`)은 전부 `@ApiPropertyOptional()` + `T?`(`| null` 없음).
- 내부 서사(정정 경위·리뷰 인용)는 `//` 주석에, 소비자용 설명은 `/** */` JSDoc 에 분리돼
  있어 `swagger.md` §3(2026-09-05 규약화) "JSDoc 은 공개 OpenAPI 로 나간다"를 지킨다.
- `spec/conventions/error-codes.md` §3 historical-artifact 레지스트리가 `1-auth.md §1.5.4`
  의 lowercase 코드(`invitation_not_found` 등, `forbidden`/`rate_limited` "초대 API 한정")를
  정확히 등재하고 있어, `1-auth.md` 의 해당 각주 인용이 실재 규약과 일치함을 확인했다.
- `1-auth.md §1.1.B` 하단 note 의 `node-output.md` Principle 3.2 인용("`code` 는
  `UPPER_SNAKE_CASE`") — 대상 절(§3.2 `output.error` 표준 형태)이 실재하고 문구가 일치.
- `swagger-dto-contract-guard.ts` 신규 3번째 축(`findOptionalNullableResponseFields`,
  §5.4 "`required:false`+`nullable:true`" 금지 조합 래칫)은 요청 DTO 를
  `isResponseDtoFile`(`/dto/responses/` 경로 한정)로 배제해 §5.4 "요청 바디는 대상이 아니다"
  범위를 정확히 지킨다. 신규 fixture(`optional-nullable.fixture.ts`)는 의도적 위반
  양성/음성 대조군으로 `src/modules` 스캔 범위 밖에 둬 프로덕션 베이스라인을 오염시키지 않는다.
- `spec/conventions/swagger.md`·`spec/5-system/2-api-convention.md` 양쪽 frontmatter `code:`
  가 `swagger-dto-contract*.ts`·`response-contract*.ts` 를 동일하게 등재 — §5.4 "두 검증자는
  양쪽 문서의 code: 에 모두 등재" 요구를 유지(이번 diff 로 깨지지 않음).
- 문서 구조(Overview → 본문 → Rationale)는 `spec/5-system/2-api-convention.md`(§Overview 25행
  · §Rationale 472행)·`spec/5-system/1-auth.md`(§Overview 78행 · §Rationale 576행) 양쪽에서
  유지되고 있다(이번 브랜치가 그 구조를 건드리지 않음).

## 요약

이번 브랜치의 코드 변경은 `spec/5-system/2-api-convention.md` §5.4 및 `spec/conventions/swagger.md`
(§1-3/§1-6/§3/§5-1/§5-2)·`error-codes.md`·`node-output.md` 가 정한 명명·선언·에러코드 규약을
폭넓게 정확히 따른다. 새로 발견한 것은 CRITICAL 급 위반이 아니라, 같은 날 새로 등재된
`review-citations.md`(§2 "bare `hh_mm_ss` 금지")를 어긴 신규 인용 2건(WARNING)이다 — 실행을
강제하는 가드 코드가 없는 문서 규약이라 시스템 invariant 를 깨지는 않지만, 규약 저자가
직전에 직접 "금지" 로 명문화한 패턴을 같은 작업 흐름 안에서 재도입했다는 점에서 방치하면
안 된다. 나머지는 이전 라운드(`00_01_16`)에서도 확인된 경계 사례 2건(INFO, enum import·중복
enum 선언)뿐이며 실질 wire 리스크는 없다.

## 위험도

LOW
