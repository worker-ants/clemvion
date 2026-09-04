# API 계약(API Contract) 리뷰

## 대상 개요

이번 diff 의 실질 코드 변경은 `ExecutionStatusDto` 5개 필드(`durationMs`·`currentNode`·`context`·
`result`·`error`)를 `@ApiPropertyOptional({ nullable: true }) field?: T | null` →
`@ApiProperty({ nullable: true }) field: T | null` 로 전환(OpenAPI `required: false → true`)한
것과, 그에 대응하는 스키마 테스트 보강(`execution-status-response.dto.spec.ts`), 그리고
`CHANGELOG.md`/`plan/in-progress/spec-draft-nullable-notation-followups.md` 갱신이다.

이 changeset 에는 같은 브랜치의 **이전 두 코드 리뷰 라운드**(`review/code/2026/09/04/14_54_36/*`,
`review/code/2026/09/04/15_22_06/*`)와 **이전 두 consistency-check 라운드**
(`review/consistency/2026/09/04/{15_16_28,15_42_35}/*`)의 산출물이 함께 포함돼 있다. 그 두
라운드 모두 이 diff 계열(§5.4 drift 정정 배치)을 API 계약 관점에서 이미 검토했고 — `14_54_36`
시점에는 83필드, `15_22_06` 시점에는 15필드(`ExecutionDto` 10 + `ExecutionStatusDto` 5) — 둘 다
CRITICAL/WARNING 없이 **LOW**로 판정했다. 이번 최종 diff(파일 3: `execution-status-response.dto.ts`)는
그보다 더 좁다 — `ExecutionDto` 10필드는 되돌려졌고(`RESOLUTION.md` W2), 남은 것은 노출 경로가
`getStatus()` 하나뿐이라 `tsc` 검증이 실제로 성립하는 `ExecutionStatusDto` 5필드뿐이다. 즉 이번
라운드가 보는 최종 상태는 이전 두 라운드가 검토했던 것보다 **범위가 축소된, 더 보수적인 버전**이다.

## 발견사항

- **[INFO]** OpenAPI `required` flip 은 wire 는 불변이지만 생성 클라이언트 타입 계약을 좁힌다 (반복 관찰, 조치 불요)
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts:123,130`(`durationMs`),
    `:133,138`(`currentNode`), `:147,156`(`context`), `:159,165`(`result`), `:168,174`(`error`)
  - 상세: `required: false → true` 전환은 서버가 실제로 내려보내는 바이트에는 영향이 없다
    (`@ApiProperty`/`@ApiPropertyOptional` 은 `@nestjs/swagger` 문서화 데코레이터일 뿐 런타임
    직렬화에 관여하지 않는다). OpenAPI 로 타입을 코드젠하는 SDK/클라이언트 입장에서는 이 5필드가
    `field?: T | null` → `field: T | null` 로 좁아진다. 방향이 "옵셔널 체크 없이도 접근 가능"이라
    기존 optional-check 코드가 깨지는 방향은 아니므로 하위 호환 breaking 은 아니다. `CHANGELOG.md:14-15`
    (파일 1)에 영향 범위가 이미 명시돼 있다.
  - 제안: 조치 불요 — 문서화 완료. 이미 두 전 라운드(`14_54_36/api_contract.md`,
    `15_22_06/api_contract.md`)에서 동일하게 관찰·기록된 항목이며 이번 diff 로 새로 생긴 리스크가
    아니다.

- **[INFO]** 회귀 방지 테스트가 `nullable`·`required` 두 축을 단일 상수로 공유해 drift 를 구조적으로 차단
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts:116-122`
    (`NULL_PRESENT_FIELDS` 상수 신설), `:124`(`it.each(NULL_PRESENT_FIELDS.map(...))`),
    `:144-148`(`required` 배열 단언, `expect.arrayContaining([...NULL_PRESENT_FIELDS])`)
  - 상세: 이전 라운드(`14_54_36`)의 maintainability WARNING("목록이 `it.each`와
    `arrayContaining` 두 곳에 하드코딩돼 drift 위험")이 이번 diff 에서 단일 상수 추출로 해소돼
    있다. API 계약 관점에서는 이 필드들이 향후 실수로 다시 `@ApiPropertyOptional` 로 되돌아가도
    `nullable` 단언만으로는 놓치던 회귀(`required` 축)를 이제 같은 소스가 두 축 모두에서 잡는다는
    점이 긍정적 신호다.
  - 제안: 조치 불요.

## 항목별 점검 결과 (요약)

1. **하위 호환성**: wire 포맷 무변경. `required` 만 실제와 맞게 정정됐고, 방향은 계약을
   "정확하게 만드는" 쪽이라 breaking change 아님.
2. **버전 관리**: API 버전 변경 없음 — 문서 정확도 수정으로 버전업 대상 아님.
3. **응답 형식**: `null`(키 present, 상시 존재) 계약이 `spec/5-system/2-api-convention.md` §5.4
   신 문면·`spec/5-system/14-external-interaction-api.md` R17·`spec/conventions/swagger.md` §1-4
   와 필드 단위로 정합. 응답 5곳만 반영, 요청 DTO 는 범위 밖 — 이미 전 라운드에서 검증됨.
4. **에러 응답**: 변경 없음 — 해당 DTO 에 에러 응답 구조 변경 없음.
5. **요청 검증**: 요청 DTO 는 이번 diff 범위 밖 — 영향 없음.
6. **URL/경로 설계**: 컨트롤러·라우트 변경 없음.
7. **페이지네이션**: 해당 DTO 는 단발 상태 조회(`getStatus`) 응답이라 페이지네이션과 무관.
8. **인증/인가**: 변경 없음.

## 요약

이 diff 는 `ExecutionStatusDto` 5개 필드(`durationMs`/`currentNode`/`context`/`result`/`error`)의
`@ApiPropertyOptional`→`@ApiProperty({nullable:true})` 전환으로, §5.4 정정(#1277/#1280) 후속
drift 해소 작업의 최종·최소 범위 버전이다. 같은 브랜치를 대상으로 이미 두 차례(83필드 시점,
15필드 시점) API 계약 리뷰가 수행돼 둘 다 LOW·CRITICAL/WARNING 0 으로 판정했고, 이번 최종
diff 는 검증되지 않은 `ExecutionDto` 10필드를 되돌려 그보다도 좁은 — 노출 경로가 `getStatus()`
하나뿐이라 `tsc` 검증이 실제로 성립하는 — 범위로 수렴했다. wire 포맷은 불변이고, 유일한 실질
영향(OpenAPI 코드젠 클라이언트 타입 협소화)은 CHANGELOG 에 이미 명시돼 있으며 방향상 breaking
이 아니다. 회귀 방지 테스트도 `nullable`·`required` 두 축을 단일 목록으로 공유하도록 보강돼
이전 라운드가 지적한 drift 위험이 해소됐다. API 계약 관점에서 CRITICAL/WARNING 급 발견사항은 없다.

## 위험도

LOW
