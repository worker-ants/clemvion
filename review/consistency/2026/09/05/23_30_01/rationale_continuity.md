# Rationale 연속성 검토 — sweep-response-contract-5ba0ad

## 검토 방법 메모

프롬프트 번들의 `## 구현 변경 사항` (diff, 30개 파일 / 2068줄) 섹션은 예산 절단으로 프롬프트에
**전혀 실리지 않았다** (헤더 자체가 부재). 대상 spec 영역(`spec/5-system/`) 델타도 0개로,
`spec/5-system/2-api-convention.md`·`1-auth.md` 는 전문이 실렸으나 diff 는 실측이 불가능했다.
따라서 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/sweep-response-contract-5ba0ad`)에서
`git diff origin/main`을 직접 실행해 실제 코드 변경을 확인했다 — DTO 5종
(`trigger-response.dto.ts` · `schedule-response.dto.ts` · `alert-rule-response.dto.ts` ·
`integration-response.dto.ts` · `knowledge-base-response.dto.ts`), `triggers.service.ts`,
`schedules.controller.ts`/`schedules.service.ts`, `response-contract.ts`,
`swagger-dto-contract-guard.ts`(신규 축), `swagger-dto-contract.spec.ts`, 관련 e2e 배선,
`CHANGELOG.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`.

## 발견사항

- **[INFO]** 이 PR 자신이 한 차례 §5.4 를 위반했다가 같은 세션의 리뷰로 자체 정정 — 최종 상태는 준수
  - target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` "스윕 1차의 자기 반박" 절, `CHANGELOG.md` "같은 조합이 조용히 넓어지지 못하게 래칫을 세웠다" 절
  - 과거 결정 출처: `spec/5-system/2-api-convention.md §5.4` — "`null` 을 쓰는(상시 존재) 필드 → `@ApiProperty({ nullable: true })` + `field: T | null`", "TS 타입이 `| null` 인데 `nullable: true` 를 선언하지 않는 것은 어느 쪽에서도 틀렸다"는 원칙과, `swagger-dto-contract.spec.ts` 의 기존 `OPTIONAL_NULLABLE_DRIFT`(`ExecutionDto`) 주석이 이미 "동결, 확대 금지"로 명시해 둔 상태
  - 상세: 이 PR의 첫 초안은 23개 신규 필드 중 17개를 `@ApiPropertyOptional({ nullable: true })` + `field?: T | null` (요청 바디 tri-state 전용으로 §5.4 가 명시적으로 금지한 조합)으로 선언했다. 이는 "기각된 형태를 이유 명시 없이 재도입"한 사례에 해당하나, **같은 세션의 `--impl-done 18_23_03` 라운드(정확히 이 rationale-continuity 관점)가 Critical 로 검출**했고, 개발자가 전량을 §5.4 기본형(`@ApiProperty`+`nullable:true`)으로 정정한 뒤 재발 방지용 3번째 정적 축(`findOptionalNullableResponseFields` + `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 78건 양방향 래칫)까지 신설했다. 현재 HEAD 워킹트리를 직접 grep 한 결과 `*.dto.ts` 안에 `ApiPropertyOptional`+`nullable:true` 실사용 조합은 0건(주석 언급만 존재)이다.
  - 제안: 조치 불요 — 이미 해소됐고 CHANGELOG·plan 양쪽에 정직하게 기록돼 있다. 참고용으로만 남긴다.

## 대조 확인 (위반 없음 확인된 항목)

- `secret-store.md §1.1`(2026-09-05, PR #1290 로 이미 merge — 이 브랜치의 spec 델타 0과 정합)이 요구하는 "`select: false` 금지, 응답 경계에서 스트립"을 `triggers.service.ts` 의 `sanitizeForResponse`(구 `sanitizeChatChannelForResponse`)가 그대로 따른다 — `trigger.entity.ts` 에 `notificationSecretV2`/`chatChannelTokenV2` 컬럼 레벨 `select:false` 없음을 확인.
- `§5.4` "키 생략은 (a)/(b) 근거가 있을 때만" 원칙 — `TriggerDto.workflow`/`ScheduleTriggerRefDto.workflow` 는 필드 JSDoc 에 근거 (b)(생성 응답에서 로드 안 됨)를 명시, `ScheduleDto.trigger` 는 상시 로드되므로 §5.4 기본형(`@ApiProperty`)으로 승격 — 형식 선택 기준과 정합.
- `2-trigger-list.md R-8`("UI 는 `hasBotToken: boolean` 만 받는다")과 `sanitizeForResponse` 의 `hasBotToken` derived 필드 유지가 일치.
- `2-navigation/4-integration.md` (§ Cafe24 App URL Card 결정)의 `IntegrationDto.appUrl: string | null` 요구와 이번 diff 의 `appUrl` 선언이 일치.
- `1-auth.md`/`5-system` 감사 로그 관련 Rationale(§1288 완료분)은 이번 diff 범위(audit-logs 미포함)와 무관 — 재침범 없음.
- `api-convention.md §5.4` 검증 층 표(정적 `swagger-dto-contract-guard.ts` vs 런타임 `response-contract.ts`)의 역할 분담을 신설 3번째 축도 그대로 준수(정적 파일에 추가, 요청 DTO는 `isResponseDtoFile`로 명시 제외).

## 요약

이번 diff(spec/5-system 델타 0, 코드 diff 30파일/2068줄)는 §5.4 응답-계약 규칙과
`secret-store.md §1.1`(직전 planner 턴에서 이미 merge된 규범)을 확장 적용하는 스윕 성격의
변경으로, 기존 Rationale 이 세운 형식 규칙(`null` vs 키 생략 선택 기준, `@ApiProperty` vs
`@ApiPropertyOptional` 사용 기준, secret 응답 경계 스트립 원칙)을 위반 없이 준수하고, 오히려
그 규칙을 강제하는 새 정적 가드(§5.4 세 번째 축)를 도입했다. 유일하게 눈에 띄는 이력은 이
PR 자체의 초안이 한 차례 §5.4 금지 조합을 재도입했다가 같은 세션 내 리뷰로 즉시 잡히고
정정된 것인데, 최종 HEAD 상태에는 그 위반이 남아 있지 않으며 CHANGELOG·plan 문서에 투명하게
기록돼 있다. 새로 도입되거나 기각된 대안이 재차 채택된 사례, 또는 새 Rationale 없이 과거
결정을 뒤집은 사례는 발견되지 않았다.

## 위험도
NONE
