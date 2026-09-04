# 요구사항(Requirement) 리뷰 — `ExecutionStatusDto` 5필드 `required: false → true` (최종 축소본)

## 검증 방법

- 프롬프트 diff(파일 1~6)가 실질 변경이고, 파일 7~46 은 이전 두 리뷰 라운드(`14_54_36`,
  `15_22_06`)와 일관성 검토(`15_16_28`, `15_42_35`) 산출물이 이번 브랜치(`claude/dto-drift-split`,
  origin/main 대비 5커밋)에 함께 실려 온 것임을 `git log`/`git show --stat` 으로 확인했다. 이
  프로젝트 컨벤션상 `review/**` 커밋은 정상(감사 추적)이라 별도 요구사항 결함으로 다루지 않았다.
- 저장소 워킹트리를 직접 `Read`/`grep` 해 **diff 가 아니라 최종 상태**를 대조했다(3라운드에 걸쳐
  83 → 15 → 5 로 좁혀졌으므로, diff 조각이 아니라 현재 파일이 진실이다):
  - `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts`
  - `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts`
  - `codebase/backend/src/modules/external-interaction/interaction.service.ts` (`getStatus()` 전체)
  - `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts` (되돌려졌다는
    `ExecutionDto` 10필드가 실제로 `@ApiPropertyOptional`+`?:` 로 복원됐는지)
  - `spec/5-system/2-api-convention.md` §5.4, `spec/5-system/14-external-interaction-api.md` §5.3
  - `plan/in-progress/spec-draft-nullable-notation-followups.md` 후속 체크리스트
- 저장소에는 아무것도 쓰지 않았다 (`git status --short` 로 확인 — untracked 는 이 리뷰 세션
  자신의 출력 디렉터리뿐).

## 발견사항

없음. CRITICAL/WARNING 급 결함을 찾지 못했다.

### 참고용 INFO

- **[INFO]** 이 최종 diff 는 3라운드에 걸친 두 번의 자기 축소(83→15→5)의 결과물이며, 그 두
  narrowing 근거 모두 실측으로 재확인됨
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:331-471`
    (`getStatus()`), `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:19-117`
  - 상세: (1) `getStatus()` 의 리턴 객체 리터럴은 함수 시그니처 `Promise<ExecutionStatusDto>` 로
    contextual typing 되고, `durationMs`/`currentNode`/`context`/`result`/`error` 5개 키가 분기
    없이 **항상** 리터럴에 나타난다(널 값이거나 실값이거나 키 자체는 생략되지 않음) — "노출 경로
    `getStatus()` 하나뿐이라 tsc 검증이 성립한다"는 CHANGELOG 주장을 코드로 재확인했다. 1단계 조회
    `STATUS_PROJECTION_COLUMNS` 에 `durationMs`/`outputData` 가 명시 포함돼 부분 select 로 인한
    키 누락 여지도 없다. (2) `ExecutionDto` 10필드는 실제로 `@ApiPropertyOptional({...}) field?: T | null`
    로 원복되어 있어 "노출 경로 4개 중 1개(목록)에서만 조립되므로 되돌렸다"는 CHANGELOG/plan 서술과
    코드 상태가 정확히 일치한다.
  - 제안: 없음 — 검증 목적의 기록.

- **[INFO]** spec 본문과 line-level 정합 — §5.4/§5.3 이 예시로 든 `null`(키 present) 필드
  집합과 이번 5필드가 정확히 겹친다
  - 위치: `spec/5-system/2-api-convention.md:176-208`(§5.4), `spec/5-system/14-external-interaction-api.md:449-503`(§5.3)
  - 상세: §5.4 는 "`null`(키 present) → `@ApiProperty({nullable:true})` + `field: T | null`" 을
    규정하고 `EIA §5.3 currentNode/result/error` 를 선례로 명시한다. §5.3 의 JSON 예시는
    `"currentNode": {...} | null`, `"context": {...} | null`, `"result": {...} | null`,
    `"error": {...} | null`, `"durationMs": 4242 | null` 로 다섯 필드 모두 키-상시-present +
    값-nullable 형태를 그대로 보여준다 — 이번 DTO 변경(5필드 `@ApiProperty({nullable:true})`
    + non-optional TS 타입)과 라인 단위로 부합한다. 불일치 없음.
  - 제안: 없음.

- **[INFO]** 이전 라운드에서 지적된 "필드 목록 이중 하드코딩"(2R W3, maintainability)이 이번
  최종 상태에서 실제로 해소되어 있음을 재확인
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts:116-148`
  - 상세: `NULL_PRESENT_FIELDS` 상수 하나를 `it.each(NULL_PRESENT_FIELDS.map(...))` 와
    `expect.arrayContaining([...NULL_PRESENT_FIELDS])` 양쪽이 공유한다. `arrayContaining` 을
    써서 `required` 배열의 다른 상시-필수 필드(`id`/`workflowId`/`status`/`seq`/`updatedAt`)와
    충돌 없이 부분집합만 단언하는 것도 올바르다.
  - 제안: 없음.

- **[INFO]** 잔여 스코프(§5.4 drift 2단계 — 검증자 없는 응답 DTO 78곳, WS wire 적용 여부)는
  이번 diff 범위 밖으로 명시적으로 등재돼 있어 "기능 미완성"으로 볼 사안이 아님
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:258-333`
  - 상세: 두 항목 모두 담당 트랙(developer/planner)·선행 조건과 함께 `## 후속` 표에 올라 있고,
    이번 커밋이 그 배치를 "완료했다"고 잘못 주장하지 않는다(CHANGELOG 도 "5곳"으로 스코프를
    명확히 좁혀 서술). TODO/FIXME 류 미완성 주석은 diff 대상 파일에 없다.
  - 제안: 없음 — 후속 트래킹이 이미 적절하다.

- **[INFO]** `plan/complete/spec-draft-scope-and-anchor-drift.md` 이동(파일 4·6)은 이번 DTO
  작업과 무관한 별도의 plan lifecycle 갱신이며 `git mv` 로 정상 처리됨
  - 위치: 커밋 `24c68d484`
  - 상세: `status: in-progress → complete` 필드만 바뀌고 rename 100% (구 파일 잔존 없음),
    동반된 `--impl-done` 리포트가 BLOCK:NO·Critical 0·Warning 0 임을 근거로 든다. DTO 변경의
    요구사항 충족 여부와는 별개 축이라 이 관점에서는 결함 없음으로만 기록한다.
  - 제안: 없음.

## 요약

최종 diff 는 `ExecutionStatusDto` 5필드(`result`/`error`/`durationMs`/`currentNode`/`context`)의
OpenAPI `required` 를 `false → true` 로 정정하는 것으로, 두 차례의 자기 반증(83→15, 15→5)을 거쳐
"노출 경로가 `getStatus()` 하나뿐이라 tsc 검증이 실제로 성립하는" 유일한 안전한 부분집합으로
좁혀졌다. 워킹트리를 직접 대조한 결과 (1) `getStatus()` 는 다섯 키를 분기 없이 항상 채워 반환하고
`Promise<ExecutionStatusDto>` 리턴 타입이 그 구조를 tsc 로 강제하며, (2) 되돌려졌다는 `ExecutionDto`
10필드는 실제로 optional 로 원복돼 있고, (3) 신규 `required` 회귀 테스트는 `NULL_PRESENT_FIELDS`
단일 상수를 공유해 이전 라운드가 지적한 목록 이중화 결함을 해소했다. `spec/5-system/2-api-convention.md`
§5.4 와 `spec/5-system/14-external-interaction-api.md` §5.3 본문(JSON 예시 포함)이 이번 5필드
형태와 line-level 로 정확히 일치하며, spec 쪽 결함이나 spec-drift 도 발견되지 않았다. 잔여 78곳·WS
wire 적용 여부는 이번 diff 가 명시적으로 범위 밖으로 등재해 후속 트랙에 넘겼을 뿐 기능 미완성이
아니다. CRITICAL/WARNING 급 발견사항은 없다.

## 위험도

NONE
