# API 계약(API Contract) 리뷰

## 대상 개요

응답 DTO **15필드**(`ExecutionDto` 10 · `ExecutionStatusDto` 5)의
`@ApiPropertyOptional({ nullable: true }) field?: T | null` →
`@ApiProperty({ nullable: true }) field: T | null` 전환. 배경은 §5.4 정정(`#1277`/`#1280`) 후속
drift 정리이며, 원래 104곳(요청 21 + 응답 83) 중 `tsc` 도달성 재측정으로 **83 → 15** 로 좁힌
결과물이다(`RESOLUTION.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`).
나머지 68곳(패스스루 컨트롤러 반환 DTO)은 검증자 없이는 `required: true` 를 주장할 수 없다는
이유로 되돌려졌고 2단계 후속으로 등재됐다. 요청(PATCH) DTO 21곳은 애초에 이 배치에서 카테고리째
제외됐다(tri-state 의미 보존).

git log 로 확인하면 이 diff 는 두 커밋(`499675277` 83곳 flip → `441761478` 15곳으로 축소)의
누적 결과이며, 축소 방향(더 넓은 계약 주장을 되돌리는 방향)이라 API 계약 관점에서 위험이 늘지
않고 줄어드는 편집이다.

## 발견사항

- **[INFO]** OpenAPI `required` flip 은 wire 불변이지만 생성 클라이언트 타입 계약을 좁힌다
  - 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts` (예:
    `triggerId`, `finishedAt`, `durationMs`, `inputData`, `outputData`, `error`, `executedBy`,
    `parentExecutionId`, `reRunOf`, `chainId`), `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts`
    (`durationMs`, `currentNode`, `context`, `result`, `error`)
  - 상세: `required: false → true` 는 서버가 실제로 보내는 바이트에는 영향이 없고(런타임 값은
    그대로 `null` 가능), OpenAPI 로 코드젠하는 SDK/클라이언트의 생성 타입만
    `field?: T | null` → `field: T | null` 로 좁힌다. 방향이 "옵셔널 체크 없이도 접근 가능"이라
    기존 optional-check 코드가 깨질 일은 없어 하위 호환 breaking 은 아니다. 다만 코드젠 SDK 를
    별도 파이프라인으로 재생성/배포하는 소비자가 있다면 그 트리거가 이번 커밋을 반영했는지는
    diff 만으로는 확인 불가.
  - 제안: 조치 불요. SDK 자동 재생성 파이프라인이 존재하면 트리거 여부만 확인 권장(전 라운드와
    동일 권고, 여전히 유효).

- **[INFO]** 요청/응답 분리 및 범위 축소가 diff 에서 실제로 지켜졌는지 대조 확인
  - 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:19-113`,
    `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts:123-174`
  - 상세: 두 파일 모두 `dto/responses/` 경로이고 PATCH 류 tri-state 요청 필드는 포함돼 있지
    않다. 전 라운드 리뷰(§5.4 응답 전용 명시, `#1280`)와 일치하며, 이번 diff 는 그 전 라운드가
    검토한 83필드 중 **`tsc` 가 실제로 도달·검사한 15필드로 축소**한 결과이므로 이전에 지적된
    "68곳은 컨트롤러 패스스루라 검증자 없이 `required: true` 를 주장할 수 없다"는 우려가
    diff 자체에서 해소돼 있다(해당 68곳은 이번 diff 에 없음 — 되돌려짐).
  - 제안: 조치 불요.

- **[INFO]** 이번 diff 가 스키마 레벨 테스트에 `required` 축 단언을 신설(파일 3,
  `execution-status-response.dto.spec.ts`)해 전 라운드 testing WARNING(#2, "유일한 스키마 빌드
  테스트가 `required` 를 검사하지 않는다")을 이 diff 범위 안에서 직접 닫는다
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts`
    (신설 `it('null 을 쓰는 다섯 필드는 required 이기도 하다 — 상시 존재', …)`)
  - 상세: API 계약 관점에서 회귀 방지 안전망이 생겼다는 점은 긍정적 신호. `ExecutionDto` 쪽
    10필드에 대해서는 동일한 `required` 배열 단언이 이 diff 에 보이지 않는데(파일 3 은
    `ExecutionStatusDto` spec 만 다룸), `execution-response.dto.spec.ts` 자체가 diff 에 없어
    이미 존재하는지/신설 필요한지는 이 프롬프트 범위로는 판단 불가.
  - 제안: `ExecutionDto` 응답 스키마를 빌드해 검사하는 스펙이 있다면 동일하게 10필드
    `required` 단언이 있는지 확인 권장(있으면 조치 불요).

## 항목별 점검 결과 (요약)

1. **하위 호환성**: wire 포맷 무변경. `required` 만 실제와 맞춰짐 — 논브레이킹, 계약을 좁히는
   게 아니라 정확하게 만드는 방향. 전 라운드 83곳 주장 중 검증 안 된 68곳은 되돌려져 있어
   과잉주장 리스크가 이번 diff 에는 없다.
2. **버전 관리**: API 버전 변경 없음 — 문서 정확도 수정으로 버전업 대상 아님.
3. **응답 형식**: `null`(키 present) 계약이 §5.4 신 문면과 일치. 응답측 15곳만 반영, 요청측은
   범위 밖 — 구분 정확.
4. **에러 응답**: 해당 파일에 에러 응답 DTO 자체 변경 없음.
5. **요청 검증**: 요청 DTO 는 이번 diff 범위 밖.
6. **URL/경로 설계**: 컨트롤러·라우트 변경 없음.
7. **페이지네이션**: 변경 없음(해당 DTO 는 목록 페이지네이션과 무관).
8. **인증/인가**: 변경 없음.

## 요약

응답 DTO 15필드(`ExecutionDto` 10 · `ExecutionStatusDto` 5)의 `required: false → true` 정정은
§5.4 문면과 실제 서버 동작을 일치시키는 순수 계약 정확화이며 wire 포맷은 불변이다. 전 라운드에서
83필드로 과다 적용됐던 것을 `tsc` 도달성 재측정으로 15필드로 좁혀 검증되지 않은 68필드(패스스루
컨트롤러 반환 DTO)를 되돌린 결과물이라, API 계약 리스크는 전 라운드보다 오히려 줄었다. 요청/응답
분리·PATCH tri-state 보존도 유지된다. 유일한 잔여 관찰은 코드젠 SDK 소비자에 대한 고지(이미
CHANGELOG 에 기재됨) 뿐이며 CRITICAL/WARNING 급 발견은 없다.

## 위험도

LOW
