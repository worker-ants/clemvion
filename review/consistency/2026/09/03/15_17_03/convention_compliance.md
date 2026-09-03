# 정식 규약 준수 검토

## 검토 범위 및 방법

- 대상: `spec/5-system/` (impl-done, diff-base `origin/main`, scope 델타 0개 파일 — 이 브랜치는
  `spec/5-system/` 자체를 변경하지 않았다)
- 구현 diff: 실측 결과 이 세션의 실제 diff(`git log origin/main..HEAD`)는 `7ce4fa92a`(nullable
  컬럼 타입 정정 8건 — `null as unknown as X` 캐스트 제거)와 `40fa58b8f`(그 후속 부팅 실패 수정)
  2개 커밋, 14파일/755줄이다. 전달된 프롬프트 번들의 diff 섹션과 일치함을 확인했다.
- target 문서 본문은 프롬프트 번들이 아니라 워킹트리 원본(`spec/5-system/1-auth.md`,
  `spec/5-system/2-api-convention.md`)을 직접 읽었다 — 번들에는 두 파일 모두 전문이 실려 있었으나
  `spec/conventions/**` 쪽은 대부분 "본문 생략됨(컨텍스트 예산 초과)" 상태였으므로, 비교 대상인
  `spec/conventions/error-codes.md`·`spec/conventions/audit-actions.md`도 워킹트리에서 직접
  전문을 읽어 대조했다.
- 코드 diff가 실제로 `spec/5-system/1-auth.md`가 SoT로 지목하는 영역(User/Schedule 엔티티,
  AuthService, TotpService)을 건드리므로, diff가 output-format·naming·API 문서 규약에 영향을
  주는지도 함께 확인했다(엔티티 nullable 타입 → 대응 응답 DTO의 `@ApiPropertyOptional({nullable:true})`
  선언 일치 여부, 민감 필드의 DTO 노출 여부 등).

## 발견사항

발견된 CRITICAL/WARNING 위반 없음. 확인한 항목과 근거는 다음과 같다.

- **명명 규약 (관점 1)** — `spec/5-system/1-auth.md §1.5.4`의 초대 흐름 에러 코드
  (`invitation_not_found` 등 `lower_snake_case`)는 규약 위반처럼 보이지만, 문서 자체가
  `error-codes.md §3` historical-artifact 레지스트리를 명시 인용하며 "신규 코드는 이 예외를
  선례로 삼지 않는다"고 스스로 제한한다. `error-codes.md §3` 원문의 해당 행과 대조한 결과
  코드·HTTP·근거 문서 링크가 정확히 일치한다 — 위반이 아니라 정식 등재된 예외.
- **명명 규약 — 감사 액션** — `1-auth.md §4.1`의 액션 목록(`user.password_changed` 등 dot-prefix +
  과거분사)을 `spec/conventions/audit-actions.md §1~§3` 레지스트리와 대조. 도메인별 분류(과거분사
  기본/CRUD 현재형 예외/도메인 고유 동사)와 표기가 모두 일치하며, `workspace.deleted` 미등재·
  `workflow.executed` Planned 처리 등 구조적 예외도 양쪽 문서에서 동일하게 서술된다.
- **출력 포맷 규약 (관점 2)** — 이번 diff가 넓힌 nullable 타입(`Schedule.nextRunAt: Date|null`,
  `User.passwordHash/twoFactorSecret/emailVerifyToken/passwordResetToken/…: T|null`) 중 API로
  노출되는 것은 `Schedule.nextRunAt`뿐이다. 대응 응답 DTO
  (`codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts`)는 이미
  diff 이전부터 `@ApiPropertyOptional({ format: 'date-time', nullable: true })` + `nextRunAt?:
  string | null`로 선언되어 있어 `2-api-convention.md §5.4`/`swagger.md §1-3`의 "`null`을 쓰는
  필드는 `@ApiPropertyOptional({nullable:true})` + `field?: T|null`" 규칙과 이미 일치한다 —
  엔티티 쪽 타입 거짓말이 정정됐을 뿐 wire 계약·DTO 선언에는 변경이 없다.
  `User`의 민감 필드(`passwordHash`·`twoFactorSecret`·`emailVerifyToken`·`passwordResetToken`)는
  `codebase/backend/src/modules/users/dto/`·`codebase/backend/src/modules/auth/dto/` 어디에도
  노출되지 않음을 grep으로 확인했다(주석 1건 오검출 제외) — 출력 포맷 규약 위반 없음.
- **문서 구조 규약 (관점 3)** — `1-auth.md`·`2-api-convention.md` 모두 frontmatter
  (`id`/`status`/`code:`) → `## Overview` → 본문 → `## Rationale` 3섹션 구조를 준수한다.
  `1-auth.md §5`에 있는 자기-반증형 소정정(취소선 + `--impl-done WARNING, 2026-09-03` +
  `plan/complete/auth-change-password-oauth-only-code-split.md` 링크)도 원문을 지우지 않고
  취소선으로 남기는 CLAUDE.md 조건 4를 지키고 있다 — 단, 이 문단은 금번 diff가 아니라 이전
  세션에서 이미 반영된 기존 내용이다(참고용으로만 기록, 위반 아님).
- **API 문서 규약 (관점 4)** — 확인한 `ScheduleDto`(응답) 데코레이터 패턴은 `swagger.md`가
  요구하는 `@ApiProperty`/`@ApiPropertyOptional` 구분과 일치. diff에 포함된 나머지 변경(엔티티
  컬럼 타입, 테스트 파일, `source-scan.ts`의 신규 헬퍼 `countNullAsUnknownAsCasts`/
  `hasNullAsUnknownAsCast`)은 API 응답·이벤트 페이로드·에러 코드와 무관한 내부 정적분석
  유틸리티/엔티티 정의라 이 관점의 대상이 아니다.
- **금지 항목 (관점 5)** — `spec/conventions/**`에서 명시적으로 금지한 패턴(예:
  `error-codes.md §1`의 구현·역사를 코드명에 박는 것, `audit-actions.md §1`의 dot-prefix 없는
  액션명)이 이번 diff나 대상 spec 문서에 새로 도입되지 않았다.

### 참고 — 이 리뷰 범위 밖 관찰 (판정에 포함하지 않음)

같은 diff에서 `Schedule.lastRunAt`(`nullable: true` 컬럼인데 TS 타입은 여전히 `Date`)·
`User.oauthProvider`(`nullable: true`인데 `string`)는 이번 배치에서 정정되지 않은 채 남아있다.
다만 이는 TypeORM 엔티티 타입 정확성 문제이며 `spec/conventions/**`가 규율하는 명명·출력포맷·
문서구조·API문서 규약 어느 것도 위반하지 않는다(대응 DTO는 이미 올바르게 선언되어 있음을
위에서 확인) — code-review 관점(유지보수성/일관성)의 관찰 사항이지 정식 규약 위반은 아니므로
본 보고서의 발견사항에는 포함하지 않는다.

## 요약

`spec/5-system/` 자체는 이번 브랜치에서 변경되지 않았고(scope 델타 0), 실제 코드 diff는
엔티티 nullable 컬럼의 TS 타입 거짓말(8건의 `null as unknown as X` 캐스트)을 제거하는 내부
타입 정확성 리팩터로 명명·출력포맷·문서구조·API 문서 규약과 표면적으로 접점이 없다. 유일하게
API로 노출되는 필드(`Schedule.nextRunAt`)의 응답 DTO는 diff 이전부터 이미
`spec/conventions/swagger.md`의 nullable 필드 패턴을 정확히 따르고 있었고, 민감 필드는 DTO에
노출되지 않는다. 대상 spec 문서(`1-auth.md`/`2-api-convention.md`) 본문도 `error-codes.md`·
`audit-actions.md`의 명명·historical-artifact·retired-code 규약을 정확히 인용하며 일치한다.
정식 규약 위반은 발견되지 않았다.

## 위험도

NONE
