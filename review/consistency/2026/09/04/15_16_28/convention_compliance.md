# 정식 규약 준수 검토 — convention_compliance

**검토 모드**: `--impl-done` (scope=`spec/5-system/`, diff-base=`origin/main`)
**대상**: `spec/5-system/` 델타 0건(정상 — 코드 전용 PR) + 구현 diff 3파일/229줄
(`execution-response.dto.ts`, `execution-status-response.dto.ts`,
`execution-status-response.dto.spec.ts`)

## 발견사항

없음 (CRITICAL/WARNING 0건).

diff 를 `spec/5-system/2-api-convention.md §5.4`(부재 표현 — `null` vs 키 생략) 및
`spec/conventions/swagger.md §1-3`/`§1-4` 원문과 직접 대조했다. 세 파일 모두 이 두 규약을
**정확히 실행하는 변경**이고, 규약이 명시적으로 예로 든 두 패턴(§5.4 "null 을 쓰는 상시 존재
필드" / "키 생략" present-when-available) 을 모두 올바르게 구분해 적용했다.

### 확인한 정합 지점 (참고용, 위반 아님)

- **`ExecutionDto`(10필드: `triggerId`·`finishedAt`·`durationMs`·`inputData`·`outputData`·
  `error`·`executedBy`·`parentExecutionId`·`reRunOf`·`chainId`)** — `@ApiPropertyOptional({
  nullable: true }) field?: T | null` → `@ApiProperty({ nullable: true }) field: T | null` 로
  전환. §5.4 표의 "`null`(키 present) = 기본값, 상시 존재" 규칙과 정확히 일치("TS 타입이
  `| null` 인데 `nullable: true` 를 선언하지 않는 것은 어느 쪽에서도 틀렸다" 조항의 반대
  방향 — `required`/`nullable` 양쪽을 다 채워 모순을 없앴다).
- **`ExecutionStatusDto`(5필드: `durationMs`·`currentNode`·`context`·`result`·`error`)** —
  동일 패턴. 특히 `context: ButtonsContextDto | NodeOutputContextDto | null` 필드는
  `swagger.md §1-4` 가 "닫힌 union" 예시로 **문자 그대로 인용**하는 코드 스니펫
  (`@ApiExtraModels` + `oneOf` + `@ApiProperty({ nullable: true })`)과 일치한다.
- **`conversationThread`(같은 EIA DTO 계열, `WaitingContextBaseDto`)** — 이번 diff 대상은
  아니지만 대조군으로 확인: `@ApiPropertyOptional() field?: T`(`| null` 미사용)로 "키 생략"
  분기를 유지하고 있고, JSDoc 에 §5.4 인용 + 근거("SSE wire 형식 일치")를 명시한다. §5.4
  가 요구하는 "키 생략은 (a)/(b) 사유를 문서화" 조항을 충족한다.
- **테스트(`execution-status-response.dto.spec.ts`)** — `nullable` 단언만 하던 기존
  `it.each` 에 `required` 배열 단언을 추가해, `@ApiPropertyOptional`↔`@ApiProperty` 전환이
  `nullable` 값만으로는 검출되지 않는(§5.4 각주가 지적하는) 축까지 회귀 방지선을 세웠다.
  가드 대상 5필드가 실제 DTO 변경 5필드와 정확히 일치한다.
- **`swagger.md §5-4` 새 엔드포인트 체크리스트**는 신규 엔드포인트 추가가 없으므로
  해당사항 없음(적용 대상 아님, 위반 아님).

### 참고 (INFO — 이미 plan 에 추적됨, 신규 발견 아님)

같은 파일(`execution-response.dto.ts`) 안의 `NodeExecutionSummaryDto` 클래스는
`finishedAt`/`durationMs`/`inputData`/`outputData`/`error` 에 대해 여전히
`@ApiPropertyOptional({ nullable: true }) field?: T | null` 패턴(§5.4 관점에서는 drift)을
쓰고 있다 — `ExecutionDto` 의 동명 형제 필드와 대비된다. 다만 이는 **이 diff 가 새로 만든
문제가 아니고**, `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "§5.4 drift
배치 — 2단계: 패스스루 응답 DTO 68곳"(미완료 항목)에 이미 명시적으로 등재돼 있다. 해당
plan 은 "패스스루 컨트롤러가 엔티티를 그대로 반환해 `tsc` 가 DTO 구조를 검사하지 않는 자리
라 `required: true` 를 기계적으로 주장할 수 없다"는 근거로 2단계로 분리했고, `tsc` 가 도달
가능한 15곳(이번 diff 의 정확히 그 15곳)만 1단계로 먼저 반영했다고 커밋 메시지·plan 양쪽에
기록돼 있다. 즉 이 클래스는 **의도적 범위 밖**이며 검토 시점 기준 새 CRITICAL/WARNING 사유가
아니다. 후속 세션이 2단계를 착수할 때 참고할 수 있도록만 기록해 둔다.

## 요약

이번 diff(3파일)는 `spec/5-system/2-api-convention.md §5.4`와 `spec/conventions/swagger.md
§1-3/§1-4`가 정의한 "null 을 쓰는 상시 존재 필드 vs 키 생략 필드" DTO 선언 규약을 정확히
구현한다 — 규약 원문의 예시 코드와 필드 단위로 1:1 대응하며, 회귀 방지 테스트도 규약이
지적하는 사각지대(`nullable` 만 보고 `required` 를 못 보는 축)까지 포함해 확장했다. `spec/
5-system/` 자체는 이번 PR 에서 변경되지 않았고(정상), 변경되지 않은 스펙 문서와도 모순되지
않는다. 같은 파일 내 아직 전환되지 않은 자매 필드(`NodeExecutionSummaryDto`)가 있으나 이는
이미 plan 에 2단계로 명시적으로 분리·기록된 의도적 스코프 밖이라 이번 검토의 위반 항목이
아니다.

## 위험도

NONE
