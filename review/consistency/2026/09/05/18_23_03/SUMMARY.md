# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견 있음 (§5.4 응답-계약 규약 위반, 신규 선언 다수)

## 전체 위험도
**CRITICAL** — 이번 "§5.4 응답-계약 스윕 1차" 커밋이 트리거 secret 이중 유출을 정확히
막았고 spec 대비 cross-spec/naming 관점은 전부 정합적이지만, 같은 스윕이 신규 선언한
응답 DTO 필드 다수가 `spec/5-system/2-api-convention.md §5.4` 가 **응답 바디에 명시적으로
금지한** `@ApiPropertyOptional({ nullable: true })` + `field?: T | null` 조합(요청 바디
전용 패턴)을 재도입했다. 두 checker(rationale_continuity, convention_compliance) 가
독립적으로 같은 위반을 발견했고, 기존 자동 검증기(`response-contract.ts`,
`swagger-dto-contract-guard.ts`) 어느 쪽도 이 축(선언의 optional/required 정밀도)을
구조적으로 검출하지 못한다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity, convention_compliance | 신규 선언 필드 16~17개(엔티티 컬럼상 항상 존재하는데도)가 §5.4가 "요청 바디 전용"으로 못박은 `@ApiPropertyOptional({ nullable: true })` + `field?: T \| null` 조합을 응답 DTO에 재도입 | `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts`(5필드: `chatChannelLastError`·`chatChannelSetupAt`·`chatChannelRotatedAt`·`notificationLastError`·`notificationRotatedAt`), `.../integrations/dto/responses/integration-response.dto.ts`(5필드: `appUrl`·`mallId`·`tokenExpiresAt`·`lastRotatedAt`·`lastUsedAt`), `.../knowledge-base/dto/responses/knowledge-base-response.dto.ts`(4필드: `embeddingModelConfigId`·`rerankScoreThreshold`·`rerankConfigId`·`rerankLlmConfigId`), `.../alerts/dto/responses/alert-rule-response.dto.ts`(2필드: `createdBy`·`lastTriggeredAt`) | `spec/5-system/2-api-convention.md` §5.4 "부재 표현 — null vs 키 생략" 표(적용 범위: 응답 바디만, 요청 바디 예외) + 코드측 회귀 가드 `execution-response.dto.spec.ts` 의 `OPTIONAL_NULLABLE_DRIFT`(기존 10건 "동결, 확대 금지"로 명시) | 5개 파일의 해당 필드를 `@ApiProperty({ nullable: true })` + `field: T \| null`(`?` 제거, required)로 정정. `execution-response.dto.spec.ts` 패턴처럼 이 5개 DTO에도 OpenAPI 스키마 형태 회귀 가드 신설 |
| 2 | convention_compliance | `ScheduleDto.trigger` 가 반대 방향으로 §5.4 위반 — 실측상 순수 "키-생략" 케이스(로드 실패 경로 없음, `null` 리터럴 생성 코드 0건)인데 `nullable: true` 까지 붙여 "키 생략 → `\| null` 금지" 규칙도 함께 어김 | `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts:91` (`trigger?: ScheduleTriggerRefDto \| null`) | 동일 §5.4 표의 "키 생략 → `@ApiPropertyOptional()` + `field?: T` (`\| null` 금지)" 규칙 | `@ApiPropertyOptional({ type: () => ScheduleTriggerRefDto })` + `trigger?: ScheduleTriggerRefDto`(`nullable: true` 제거)로 정정 |

## planner 인계 (권한 밖 Critical)

(없음) — 위 두 Critical 은 `spec/5-system/2-api-convention.md §5.4` 가 이미 정확히
문서화한 규칙을 코드(응답 DTO 데코레이터)가 어긴 것이라, spec 정정이 아니라 **codebase
내부 수정만으로 해소**된다. developer 권한(`codebase/**`) 범위 안이므로 planner 인계
대상이 아니다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | 6개 필드가 "항상 존재 + 항상 non-null"인데도 `@ApiPropertyOptional()`(nullable 없이)로 선언 — §5.4 두 canonical 패턴 어디에도 안 드는 제3의 과소선언 | `trigger-response.dto.ts` (`chatChannelHealth`·`notificationHealth`), `knowledge-base-response.dto.ts` (`documentCount`·`rerankMode`·`rerankCandidateK`), `integration-response.dto.ts` (`consecutiveNetworkFailures`) | `spec/5-system/2-api-convention.md` §5.4 "선언이 wire 를 반영해야 한다" 원칙 | `@ApiProperty()`(required)로 통일. 근거 있으면 필드 옆 `//` 주석에 명시 |
| 2 | plan_coherence | `## 종결 조건` 요약 표가 같은 커밋에서 갱신된 본문("18개 DTO 배선, 26건 drift")과 어긋난 옛 수치("4개 DTO", "60개 중 56개")로 남음 — 문서 자신이 이미 두 번 경고한 stale-count 패턴의 3번째 재현 | `plan/in-progress/spec-draft-nullable-notation-followups.md` 하단 `## 종결 조건` 표 | 같은 문서 본문의 "§5.4 drift 배치 — 2단계" 최신 서술 + 문서 자신의 "표에 개수를 적지 않는다"는 명시적 가이드라인 | 표 행에서 구체 수치를 빼고 "본문 §스윕 1차 참조"로 포인터만 남기거나, 갱신한다면 본문의 상한치 단서까지 함께 옮긴다 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | `CHANGELOG.md` 신규 절이 "wire 변경 없음"만 확인하고 optional/nullable 정밀도 축은 언급하지 않음 | `CHANGELOG.md` 신규 절 | 후속 커밋에서 CRITICAL/WARNING 정정 반영 시 CHANGELOG 에 짧게 추가 기록 (필수 아님) |
| 2 | plan_coherence | `User` 엔티티 `select:false` 미해결 결정과 이번 트리거/스케줄 secret-strip 결정이 같은 근거 구조(컬럼 레벨 차단 시 fail-silent 위험)를 쓰는데 상호 참조 없음 | `plan/in-progress/spec-draft-nullable-notation-followups.md` 라인 ~276-296 | `User` 미해결 항목에 이번 사례를 선례로 한 줄 링크 |
| 3 | naming_collision | "응답 경계에서 엔티티를 얕게 변환" 패턴이 서비스마다 다른 이름(`sanitizeForResponse`/`toResponse`/`toResponseExecution`)으로 반복 — 충돌은 아니나 컨벤션화 여지 | `triggers.service.ts`(`sanitizeForResponse`), `schedules.controller.ts`(`toResponse`), `executions.service.ts`(`toResponseExecution`) | 다음에 같은 패턴 추가 시 참고할 명명 컨벤션 문서화 검토 (선택) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | spec/5-system 델타 0, 신규 선언 24필드 전부 data-model 기존 컬럼과 이름·의미 일치, secret 2필드 제거는 기존 "영구 마스킹" 문서 의도와 정합 |
| rationale_continuity | CRITICAL | §5.4가 금지한 `Optional+nullable` 조합이 17개 신규 필드·5개 DTO에 재도입 — 기존 회귀 가드가 "동결, 확대 금지"로 명시한 바로 그 조합 |
| convention_compliance | HIGH (Critical 항목 포함) | 동일 위반을 16~17필드+역방향 1건으로 재확인, 두 검증기 모두 이 축을 구조적으로 못 잡음. 추가로 6필드 과소선언 WARNING |
| plan_coherence | LOW | plan 본문은 최신 반영, 단 하단 요약 표가 3번째로 stale — 문서 자신의 기존 경고 재현 |
| naming_collision | NONE | 신규 요구사항ID/엔드포인트/이벤트/환경변수/spec경로 전무. 신규 DTO 필드·클래스·상수 전수 대조 결과 기존 식별자와 충돌 없음 |

## 권장 조치사항
1. (BLOCK 해소 최우선) `trigger-response.dto.ts`·`integration-response.dto.ts`·
   `knowledge-base-response.dto.ts`·`alert-rule-response.dto.ts` 의 16~17개 필드를
   `@ApiPropertyOptional({ nullable: true })` + `field?: T | null` 에서
   `@ApiProperty({ nullable: true })` + `field: T | null`(required) 로 정정한다.
2. `schedule-response.dto.ts:91` 의 `trigger` 필드는 반대로 `nullable: true` 를 제거하고
   `@ApiPropertyOptional()` + `trigger?: ScheduleTriggerRefDto` 로 정정한다.
3. 위 5개 DTO에 `execution-response.dto.spec.ts` 패턴과 같은 OpenAPI 스키마 형태 회귀
   가드를 신설해, 이 "금지 조합"이 §5.4 인용만으로 다시 조용히 통과하지 않게 한다.
4. (WARNING) 6개 과소선언 필드(`chatChannelHealth`·`notificationHealth`·`documentCount`·
   `rerankMode`·`rerankCandidateK`·`consecutiveNetworkFailures`)를 `@ApiProperty()`
   (required)로 통일한다.
5. (WARNING) `plan/in-progress/spec-draft-nullable-notation-followups.md` 하단
   `## 종결 조건` 표의 stale 수치를 본문과 일치시키거나 포인터로 대체한다.
6. (INFO, 선택) CHANGELOG 보강, `User` select:false 항목에 이번 선례 링크, 응답 변환
   메서드 명명 컨벤션 검토.