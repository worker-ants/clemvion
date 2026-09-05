# 정식 규약 준수 검토 — convention_compliance

## 검토 범위

- target: `spec/5-system/` (impl-done, diff-base `origin/main`)
- scope 델타: `spec/5-system/**` 파일 변경 0건 (정상 — 이 브랜치는 코드 전용 PR)
- 실제 검토 대상: `codebase/` diff 29개 파일 / 1573줄 (`git diff origin/main...HEAD -- codebase/`), 실측 확인
  - 핵심: §5.4 응답-계약 스윕 후속 — 트리거 secret 이중 유출 차단(`sanitizeForResponse`)·
    스케줄 응답의 `trigger` 참조 narrowing·5개 DTO 의 미선언 필드 23개 선언·
    `swagger-dto-contract-guard.ts` 에 "금지 조합"(`required:false`+`nullable:true`) 3번째 축 신설 및
    78건 전수 래칫
- 대조한 정식 규약: `spec/5-system/2-api-convention.md §5.4`(부재 표현·검증 층), `spec/conventions/swagger.md`
  (§1-4/§1-6/§3/§5-1), `spec/conventions/secret-store.md §1.1`(2026-09-05 신설 조항)

## 발견사항

- **[INFO]** 신규 DTO 클래스 JSDoc 에 내부 서사가 섞여 있다 — 같은 PR 의 다른 파일들과 스타일 불일치
  - target 위치: `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts`
    의 `ScheduleTriggerWorkflowRefDto`(3~14행)·`ScheduleTriggerRefDto`(21행) 클래스 docblock
  - 위반 규약: `spec/conventions/swagger.md §3` "JSDoc 은 공개 OpenAPI 로 나간다 — 내부 서사를
    담지 않는다" (2026-09-05 규약화) — "정정 경위·리뷰 참조·왜 이렇게 바꿨는지 같은 내부
    서사는 JSDoc 이 아니라 그 위의 `//` 주석에 적는다"
  - 상세: `ScheduleTriggerWorkflowRefDto` 클래스 위 `/** ... */` 에 "종전 응답은 조인된
    `Trigger` 엔티티 전체를 실어 보냈고... §5.4 응답-계약 스윕이 `trigger` 를 '선언되지
    않은 키' 로 검출해 드러났다" 는 보안사고 경위 서사가 그대로 담겨 있다. 같은 diff 의
    다른 4개 응답 DTO(`AlertRuleDto`·`IntegrationDto`·`KnowledgeBaseDto`·`TriggerDto`)에
    추가된 신규 필드는 전부 이 규약이 요구하는 대로 서사를 `//` 주석으로, 소비자용
    한 줄 설명만 `/** */` 로 정확히 분리했다 — 이 두 클래스만 그 패턴에서 벗어난다.
    다만 `@nestjs/swagger` CLI 플러그인(`introspectComments`)이 **클래스 레벨** JSDoc 을
    공개 스키마 `description` 으로 승격하지는 않는 것으로 선행 라운드
    (`review/consistency/2026/09/05/19_08_19` INFO #2)에서 이미 실측 확인됐다 — 그래서
    현재 공개 OpenAPI 유출은 없다. 즉 이번 발견은 **동일 사실의 재확인**이며, 그 라운드
    이후에도 아직 정리되지 않고 남아 있다는 점만 다르다.
  - 제안: 두 클래스 docblock의 경위 서술(2문단)을 클래스 선언 위 `//` 블록으로 옮기고,
    `/** */` 에는 "스케줄 응답에 동봉되는 트리거 참조(참조 수준으로 좁혀짐)" 정도의
    한 줄만 남긴다. 시급하지 않음(§3 "기존 DTO 는 소급 정리 대상이 아니다" 원칙과
    유사하게 다음에 이 파일을 건드릴 때 함께 맞춰도 무방) — 필수 아님.

## 준수 확인 (참고 — 위반 아님, 검토 근거로 기록)

아래는 규약 위반이 아니라, 이번 diff 가 정식 규약을 특히 충실히 따른 지점을 근거로 남긴다
(§5.4·secret-store §1.1 은 오늘 날짜(2026-09-05)로 신설/개정된 규약이라 최신 반영 여부가
핵심 쟁점이었음):

- **명명 규약**: 신규 DTO 클래스(`ScheduleTriggerRefDto`·`ScheduleTriggerWorkflowRefDto`)가
  기존 `<Name>Dto` 명명 패턴을 따른다. `sanitizeChatChannelForResponse` → `sanitizeForResponse`
  개명은 메서드가 chat-channel 전용에서 3개 비밀 계열 전체로 책임이 넓어진 사실과 일치한다
  (더 이상 이름이 실제 책임보다 좁지 않다).
- **출력 포맷 규약 (§5.4 부재 표현)**: 신규 nullable 필드는 전부 "상시 존재 컬럼" 이라
  `@ApiProperty({ nullable: true })` + `T | null` 기본형을 쓰고 `@ApiPropertyOptional` 을
  섞지 않는다. `IntegrationDto.appUrl` 만 "조회 경로에 따라 없을 수 있음" 근거로
  `@ApiPropertyOptional()` + `T`(`| null` 없음) 키-생략형을 쓰는데, 그 근거(§5.4 기준 (a)/(b))가
  주석에 명시돼 있다. `ScheduleDto.trigger`/`ScheduleTriggerRefDto.workflow` 도 동일하게
  키-생략형을 올바르게 적용했다.
- **금지 항목**: `swagger-dto-contract-guard.ts` 의 신규 `findOptionalNullableResponseFields`
  가 §5.4 가 금지하는 `required:false`+`nullable:true` 조합을 응답 DTO 전수(78건)에서
  검출·래칫한다 — 최초 초안이 이 커밋 자신에서 그 금지 조합으로 17필드를 선언했다가
  같은 PR 안에서 자기 발견으로 정정한 이력이 CHANGELOG.md 에 남아 있다.
- **secret-store.md §1.1 (2026-09-05 신설) 이행**: "비대상 필드도 응답 바디에는 나가지
  않는다" 조항이 요구하는 대로, `notificationSecretV2`/`chatChannelTokenV2` 를 (a)
  `select:false` 가 아니라 응답 경계에서 지우고 (b) 트리거 자신의 응답(`sanitizeForResponse`)
  뿐 아니라 조인을 타고 새던 두 번째 경로(`GET/POST/PATCH /api/schedules`)까지
  `schedules.controller.ts` 의 응답 경계 narrowing 으로 막았다 — 이 조항이 지목한 "두
  엔드포인트" 문제를 그대로 닫았다.
- **API 문서 규약 (swagger.md §5-1 "양쪽 등재")**: `spec/5-system/2-api-convention.md`
  frontmatter `code:` 에 `swagger-dto-contract*.ts`·`response-contract*.ts` 양쪽이 모두
  등재돼 있고, `spec/conventions/swagger.md` frontmatter 도 동일 — 직전 라운드
  (`review/consistency/2026/09/05/19_08_19` WARNING #2, "§5.4 검증자가 `2-api-convention.md`
  에 미등재")가 이미 해소된 상태임을 확인했다(커밋 `983fd0ade`/`21182db02`).
- **numeric wire 타입 (swagger.md §1-6)**: 신규 필드 중 숫자형(`rerankScoreThreshold`
  — `double precision`, `documentCount`/`consecutiveNetworkFailures` — `int`)은 모두
  TypeORM 이 문자열로 변환하는 `numeric`/`decimal` 컬럼이 **아니라서** `number` 선언이
  정확하다 — 엔티티 컬럼 타입을 직접 대조해 확인했다.

## 요약

이번 diff(29개 파일/1573줄)는 신규 기능이 아니라 오늘 날짜로 개정·신설된 두 정식 규약
(`spec/5-system/2-api-convention.md §5.4`, `spec/conventions/secret-store.md §1.1`)을 코드에
반영·강제하는 스윕 그 자체다. DTO 필드 선언 형태(§5.4 기본형/키-생략형 구분)·JSDoc 서사
분리(§3, 대부분)·numeric wire 타입(§1-6)·양쪽 문서 `code:` 등재(§5-1) 등 점검한 항목 전반에서
정식 규약을 충실히 따르고 있다. 유일한 잔여 항목은 스케줄 트리거 참조 DTO 2개의 클래스
JSDoc 에 남아 있는 내부 서사(§3 위반)로, 이미 직전 라운드에서 "공개 스키마에는 승격되지
않음"이 실측 확인된 INFO 성격이라 차단 사유가 아니다.

## 위험도

LOW
