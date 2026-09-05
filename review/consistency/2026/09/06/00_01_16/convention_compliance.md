# 정식 규약 준수 검토 — convention_compliance

## 범위 및 방법

`spec/5-system/**` 자체의 이번 브랜치 델타는 0(스코프 내 spec 문서 미변경)이라, 검토 대상은
그 영역의 정식 규약(`spec/conventions/swagger.md`, `spec/conventions/review-citations.md`,
`spec/5-system/2-api-convention.md` §5.4)을 **구현이 실제로 준수하는가**로 좁혔다. 프롬프트
번들이 예산 절단으로 diff 본문을 담지 못해, 아래는 워킹트리를 절대경로로 직접 확인한 실측이다
(`git -C <worktree> diff origin/main...HEAD -- codebase/`, 31개 파일 / 순증 1,432줄).

핵심 변경은 §5.4(부재 표현 규약) 스윕 — 5개 응답 DTO(`TriggerDto`·`IntegrationDto`·
`KnowledgeBaseDto`·`AlertRuleDto`·`ScheduleDto`)에 이미 wire 로 나가고 있던 23개 미선언
필드를 선언에 반영하고, `swagger-dto-contract-guard.ts` 에 `required:false`+`nullable:true`
금지 조합을 잡는 세 번째 축(`findOptionalNullableResponseFields`)과 78건 래칫 베이스라인을
추가했다.

## 발견사항

- **[INFO]** 응답 DTO 가 엔티티에서 유니온 타입을 직접 import
  - target 위치: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts` 1~4행 (`import type { TriggerChatChannelHealth, TriggerNotificationHealth } from '../../entities/trigger.entity'`)
  - 위반 규약: `spec/conventions/swagger.md` §5-1 "엔티티 enum 에서 파생하지 않습니다"(DTO 레이어가 엔티티에 결합되지 않아야 한다는 원칙)
  - 상세: 이 문구는 문서상 "형제 DTO 가 같은 enum 을 공유"하는 시나리오(`*.literal.ts` 추출)의
    하위 항목으로 적혀 있어 적용 범위가 다소 모호하다. 실제로는 (a) `@ApiProperty({ enum: [...] })`
    의 값 배열이 엔티티에서 **파생되지 않고 수기로 직접 선언**돼 있어, 규칙이 막으려는 실패
    모드(b) — "엔티티 enum 선언 순서가 wire 순서를 흔든다" — 는 발생하지 않는다. (b) 같은
    타입-전용 import 로 엔티티 컬럼과 DTO 필드 타입을 동기화하는 패턴은 이 PR 이전부터
    `integration-response.dto.ts` 의 `IntegrationStatus` import 로 이미 선례가 있다
    (`git blame` — `c8c8e2cf90`, 2026-05-14). 따라서 이번 PR 이 새로 도입한 이탈이 아니라
    기존 관행의 연장이며, 값 배열이 엔티티에서 파생되지 않으므로 규칙의 실질 위험도 낮다.
  - 제안: 조치 불요에 가깝다. 다만 §5-1 문구가 "형제 DTO 공유" 문맥 안에 있어 이런 단독
    타입-전용 import 케이스에 적용되는지 규약 자체가 불명확하므로, 다음에 그 절을 만질 때
    "타입만 import 하고 값 배열은 직접 선언하는 경우는 예외" 를 한 줄 명시하면 향후 재해석
    분쟁을 막을 수 있다 (규약 갱신 쪽이 적절).

- **[INFO]** 같은 파일 안에서 동일 enum 값 배열이 두 번 반복 선언
  - target 위치: 위와 동일 파일, `chatChannelHealth`(107행)·`notificationHealth`(123행) — 둘 다 `@ApiProperty({ enum: ['unknown', 'healthy', 'degraded'], ... })`
  - 위반 규약: `spec/conventions/swagger.md` §5-1 "형제 DTO 가 같은 enum 을 공유하면 `*.literal.ts` 로 뺍니다"
  - 상세: 두 필드가 현재 같은 값 집합(`'unknown'|'healthy'|'degraded'`)을 쓰지만, 원칙적으로는
    서로 다른 도메인(채널 상태 vs 알림 상태)이 우연히 같은 값 집합을 갖는 것이라 공유 리터럴로
    묶으면 오히려 "두 축은 항상 같은 값 집합을 가진다"는 잘못된 불변식을 코드에 새기는 셈이다.
    그래서 추출하지 않은 선택도 방어 가능하지만, 규약의 표면적 문구("동일한 값 집합을
    노출할 때")만 보면 걸린다.
  - 제안: 현상 유지 권장(강제 아님). 두 축이 독립적으로 진화할 수 있다는 점을 DTO 파일에
    한 줄 남기면(왜 `*.literal.ts` 로 묶지 않았는지) 다음 리뷰어가 §5-1 위반으로 오독하지
    않는다.

## 준수 확인 (위반 없음, 참고용)

- DTO 신규 필드 전량이 `swagger.md` §5.4 대응 규칙(§1-3 optional 필드, §5.4 "상시 존재 →
  `@ApiProperty({ nullable: true })`" / "키 생략 → `@ApiPropertyOptional()`")을 정확히
  따른다 — `IntegrationDto.appUrl`, `KnowledgeBaseDto.rerankScoreThreshold` 등 전 필드 확인.
- `KnowledgeBaseDto.rerankScoreThreshold` 는 엔티티 컬럼이 `double precision`(≠
  `numeric`/`decimal`)이라 `swagger.md` §1-6 numeric-wire-타입 규칙(패스스루 `numeric`
  컬럼은 문자열)의 적용 대상이 아니며 `number` 선언이 맞다.
  (`codebase/backend/src/modules/knowledge-base/entities/knowledge-base.entity.ts` 111행)
- 내부 서사(정정 경위·리뷰 인용)는 전부 `//` 주석에, 소비자용 설명은 `/** */` JSDoc 에
  분리돼 있어 `swagger.md` §3(2026-09-05 규약화) "JSDoc 은 공개 OpenAPI 로 나간다 — 내부
  서사를 담지 않는다"를 그대로 지킨다.
- 코드 내 리뷰 인용은 전부 `review/<type>/YYYY/MM/DD/hh_mm_ss` 전체 경로 형태이며
  (`review-citations.md` §2 "권장" 형태), 인용된 8개 경로 전부 워킹트리에 실재함을 확인했다.
  bare `hh_mm_ss` 인용 없음.
- `spec/5-system/2-api-convention.md` §5.4 "검증 층" 절이 명시한 두 검증자
  (`swagger-dto-contract-guard.ts` = 선언↔선언, `response-contract.ts` = 값↔선언)의 역할
  분리가 실제 구현과 일치하며, 신규 3번째 축(`findOptionalNullableResponseFields`)도 같은
  절이 요구하는 "코드의 JSDoc 이 단일 진실" 원칙을 지켜 상세 판정 표를 spec 에 복제하지
  않았다.
- `spec/conventions/swagger.md`·`spec/5-system/2-api-convention.md` 양쪽 frontmatter `code:`
  가 `swagger-dto-contract*.ts`·`response-contract*.ts` 를 동일하게 등재하고 있어, §5.4
  "두 검증자는 양쪽 문서의 code: 에 모두 등재" 요구를 만족한다(선행 커밋에서 이미 반영,
  이번 diff 로 깨지지 않음을 재확인).
- 문서 구조(Overview → 본문 → Rationale) 는 `spec/5-system/2-api-convention.md` 에서
  25행 `## Overview` / 472행 `## Rationale` 로 유지되고 있다(이번 브랜치가 그 구조를
  건드리지 않음).
- CHANGELOG.md 항목의 정량 서술("78건")은 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 배열의 실제
  항목 수(78)와 일치한다(실측 대조).

## 요약

이번 브랜치의 코드 변경(31개 파일)은 `spec/5-system/2-api-convention.md` §5.4 및
`spec/conventions/swagger.md`(§1-3/§1-6/§3/§5-1/§5-2)·`spec/conventions/review-citations.md`
가 정한 명명·선언·인용 규약을 폭넓게, 그리고 정확하게 따르고 있다. 이미 같은 날짜에 다수의
코드 리뷰·정합성 검토 라운드(`review/code/2026/09/05/*`, `review/consistency/2026/09/05/*`)를
거치며 §5.4 사각지대(요청 vs 응답 DTO 구분, `required:false`+`nullable:true` 금지 조합,
캐너리 vacuity 등)가 이미 상당수 걸러진 상태로 보인다. 이번 검토에서 새로 찾은 것은 CRITICAL·
WARNING 급 위반이 아니라, 엔티티에서 타입을 직접 import 하는 기존 선례의 연장선에 있는 경계
사례 2건(INFO)뿐이며 둘 다 규약 문구의 모호성에 가깝지 실질적 wire 리스크는 없다.

## 위험도

NONE
