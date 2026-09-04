# 유지보수성(Maintainability) 리뷰

## 개요

이번 diff 는 두 축으로 구성된다.

1. **실질 코드 변경(작음)**: 응답 DTO 2개 파일(`execution-response.dto.ts`, `execution-status-response.dto.ts`)에서 `@ApiPropertyOptional({nullable:true}) field?: T | null` → `@ApiProperty({nullable:true}) field: T | null` 로 15개 필드를 전환. 실질 로직 변경 없음(OpenAPI 메타데이터 + TS 옵셔널 마커만).
2. **테스트 보강**: `execution-status-response.dto.spec.ts` 에 `it.each` 필드 목록을 3→5개로 확장하고, `required` 배열을 직접 단언하는 신규 테스트 1건 추가.
3. **문서/plan 갱신**: `CHANGELOG.md` 신규 항목 1건, `plan/in-progress/spec-draft-nullable-notation-followups.md` 체크리스트 갱신, 그리고 이전 리뷰 라운드(`14_54_36`, `15_16_28`)의 산출물(`SUMMARY.md`/`RESOLUTION.md`/각 에이전트 리포트/`meta.json`/`_retry_state.json` 등) 20건이 `review/**` 에 신규 커밋됨 — 이들은 자동 생성된 리포트 아티팩트로, 전통적 의미의 "유지보수 대상 코드"가 아니라 이 관점에서는 스캔만 하고 실질 결함 대상에서 제외한다.

## 발견사항

- **[WARNING]** `it.each` 목록과 `required` 배열 단언이 같은 5개 필드 이름을 두 곳에 각각 하드코딩 — 드리프트 위험
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts:110-115` (tuple 형태 `it.each`) 및 같은 파일 `:133-139` (plain string 배열, `expect.arrayContaining`)
  - 상세: 두 블록 모두 `result` / `error` / `durationMs` / `currentNode` / `context` 라는 동일한 5개 필드명을 30줄 이내 거리에서 각각 다른 리터럴 형태(tuple-wrapped vs plain string)로 나열한다. 바로 위 주석(`:108-109`)이 "이 가드는 손으로 고른 목록만 순회한다 — 새 nullable 필드를 여기 넣지 않으면 규약을 어겨도 조용히 통과한다" 고 명시적으로 그 취약성을 인지하고 있는데, 정작 그 인지가 "목록이 하나"라는 전제에서만 성립한다 — 지금은 목록이 **둘**이라 새 필드 추가 시 한쪽만 갱신하고 다른 쪽을 빠뜨리는 경로가 생겼다. 이번 PR 자체가 "nullable 만 보는 단언이 required 회귀를 놓친다" 는 사실을 실측으로 확인하고 만든 테스트인데, 그 확인 테스트의 소스 목록 자체가 두 곳으로 갈라져 있어 향후 같은 클래스의 문제(한쪽 목록만 갱신됨)를 재발시킬 수 있다.
  - 제안: 단일 상수로 추출 — 예) `const NULL_PRESENT_FIELDS = ['result', 'error', 'durationMs', 'currentNode', 'context'] as const;` 를 선언하고 `it.each(NULL_PRESENT_FIELDS.map((f) => [f]))` 와 `expect.arrayContaining([...NULL_PRESENT_FIELDS])` 양쪽에서 재사용. 리스트가 하나면 드리프트가 구조적으로 불가능해진다.

- **[INFO]** DTO 2개 파일의 15개 필드 전환은 단일 패턴의 기계적 치환이며 전형적 유지보수성 위험(함수 길이·중첩·복잡도·매직 넘버)과 무관
  - 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:19-20,42-43,46-47,57-62,72-77,88-93,96-97,100-101,112-113,116-117`, `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts:123-130,133-138,147-156,159-165,168-174`
  - 상세: 두 파일 전수 확인 결과, 대상 필드는 데코레이터/타입 줄만 바뀌었고 주변 JSDoc·인접 필드는 그대로다. `NodeExecutionSummaryDto.nodeLabel?`(execution-response.dto.ts:147-148) 등 진짜 키-생략 optional 필드는 정확히 배제됐다.
  - 제안: 조치 불요.

- **[INFO]** `CHANGELOG.md` 신규 항목의 서술 밀도가 높음(변경 요약 + 자기 정정 서사 혼재)이나 파일 내 기존 항목들과 동일한 포맷
  - 위치: `CHANGELOG.md:3-37` (`## Unreleased — 응답 DTO 15곳의 required 가 false → true...`)
  - 상세: "104곳이 아니라 15곳인가" / "왜 틀렸는가" 류 정정 서사가 변경 요약과 섞여 길지만, 파일의 다른 `## Unreleased` 항목들도 동일한 상세 서사형 포맷을 취하고 있어 이번 PR 이 새로 만든 비일관성은 아니다.
  - 제안: 조치 불요(기존 컨벤션 준수).

- **[INFO]** `review/**` 아티팩트 20건 신규 커밋은 코드가 아닌 자동 생성 리포트 — 유지보수성 축 적용 대상 아님
  - 위치: `review/code/2026/09/04/14_54_36/*.md,*.json`, `review/consistency/2026/09/04/15_16_28/*.md,*.json`
  - 상세: 이전 리뷰/일관성 검토 라운드의 산출물이며, 프로젝트 관례상 `review/**` 는 gitignore 대상이 아니고 감사 추적(audit trail) 목적으로 보존된다. 내용은 각 서브에이전트가 독립적으로 생성한 정형 마크다운/JSON 이라 "가독성·네이밍·중복" 같은 유지보수성 기준을 사람이 손으로 유지하는 코드에 적용하듯 판단할 대상이 아니다.
  - 제안: 조치 불요.

## 요약

실질 코드 변경(DTO 15필드 전환)은 순수 기계적 치환이라 유지보수성 위험이 낮고 전수 대조 결과 예외 처리(진짜 optional 필드 배제)도 정확하다. 유일한 실질 지적은 `execution-status-response.dto.spec.ts` 에서 이번 PR 이 새로 추가한 `required` 회귀 가드가 `it.each` 목록과 `arrayContaining` 목록 두 곳에 동일한 5개 필드명을 중복 하드코딩해, 향후 필드 추가 시 한쪽만 갱신되는 드리프트 경로를 열어둔다는 점이다 — 바로 이 PR 이 "목록이 커버리지 전부" 라는 취약성을 스스로 지적한 직후에 만들어진 코드라 아이러니하다. 단일 상수로 추출하면 간단히 해소된다. CHANGELOG/plan 문서의 서술은 장문이나 기존 컨벤션과 일치하고, 함께 커밋된 `review/**` 아티팩트는 코드가 아니므로 이 관점의 대상에서 제외했다.

## 위험도

LOW
