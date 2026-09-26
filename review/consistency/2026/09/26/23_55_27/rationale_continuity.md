# Rationale 연속성 검토 — `plan/in-progress/workflow-version-creator.md` (`--impl-prep`, scope `spec/3-workflow-editor/`)

## 발견사항

없음. target(계획된 구현 방향)이 기존 spec `## Rationale` 이 이미 확정한 결정·원칙과 정합한다. 아래는 확인 근거.

- **[검증 완료] `select` 프로젝션 방식이 `1-data-model.md` Rationale "`User` 민감 컬럼 방어를 `select: false` 가 아니라 응답 경계에 둔 이유 (2026-09-06)" 의 채택안과 일치**
  - target 위치: `plan/in-progress/workflow-version-creator.md` §방향 3 (`VERSION_METADATA_SELECT` 상수 추출)
  - 과거 결정 출처: `spec/1-data-model.md` `## Rationale` — "`User` 민감 컬럼 방어를…" 항목의 채택 표(3행: "응답 경계 투영 + 검출 2축") 및 그 하위 인용문 `> 사례 둘 — WorkflowVersionsService.findOne(CREATOR_PROJECTION) · WorkspacesService.listMembers`
  - 상세: 이 Rationale 은 정확히 이 서비스(`WorkflowVersionsService.findOne`)를 "쿼리 범위 select 투영(그 쿼리 하나만 좁힌다)"의 정식 선례로 이름까지 들어 명시하고, 동시에 "표만 읽은 검토자가 `select: {...}` 를 1행이 기각한 대안(엔티티 컬럼 `select: false`)의 재도입으로 오판할 수 있다"고 스스로 경고해 두었다. target 이 추출하려는 `VERSION_METADATA_SELECT` 는 `find`/`findOne` 옵션에 한정된 쿼리-scope 투영이며 엔티티 컬럼 선언을 건드리지 않으므로 기각된 1행(컬럼 `select:false`)이 아니라 채택된 3행의 구현 형태다. 또한 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md` 1026행 근처)가 "`creator` 는 이미 `CREATOR_PROJECTION` 으로 공유한다(그쪽이 보안 경계였다). 남은 6키는… 이번 PR 범위 밖으로 미룬다"고 명시적으로 스코프를 갈라 두었고, target 은 그 스코프(메타 6키만, `CREATOR_PROJECTION` 은 불변)를 그대로 따른다.
  - 제안: 없음 (참고용 — 이 항목 자체가 과거 오판 위험을 스스로 경고해 두었으므로 재확인 기록만 남긴다).

- **[검증 완료] DTO 선언 정정 방향이 `spec/5-system/2-api-convention.md §5.4` 규칙과 정합**
  - target 위치: `plan/in-progress/workflow-version-creator.md` §방향 1 (`creator` → `@ApiProperty` 필수, `changeSummary` → `@ApiProperty({ nullable: true })`)
  - 과거 결정 출처: `spec/5-system/2-api-convention.md §5.4` "부재 표현 — `null` vs 키 생략" 표 및 "DTO 선언 형태" 규칙(상시 존재+`null` 가능 → `@ApiProperty({ nullable: true })` + `T | null`; 키 생략 → `@ApiPropertyOptional()` + `T` only)
  - 상세: 실측(마이그레이션 FK `created_by UUID NOT NULL`, `ON DELETE` 없음 → creator 관계는 항상 로드됨)에 따라 `creator` 는 "상시 존재·null 아님" 이므로 필수 선언, `changeSummary` 는 "상시 존재·null 가능"이므로 `nullable: true` 선언 — 둘 다 §5.4 표의 기준과 정확히 일치한다. 현재 코드(`workflow-version-response.dto.ts`)를 직접 읽어 두 필드 모두 `@ApiPropertyOptional({ nullable: true })` (금지 조합)임을 확인했고, 이는 트래커(`spec-draft-nullable-notation-followups.md` 1036행 근처)에 이미 등재된 부채와 일치한다 — target 은 새 예외를 만드는 것이 아니라 기존에 합의된 규칙을 뒤늦게 준수시키는 정정이다.
  - 제안: 없음.

- **[INFO] 프런트엔드 미러(`creator?: {…} | null`)를 좁히지 않는 결정 — 판단은 타당하나 근거가 plan 문서에만 있음**
  - target 위치: `plan/in-progress/workflow-version-creator.md` §실측 마지막 문단 ("바꾸지 않는다")
  - 과거 결정 출처: 트래커 `spec-draft-nullable-notation-followups.md` 1036행 근처 — "프런트엔드 `lib/api/workflows.ts` 의 손수 맞춘 미러도 같은 턴에 **봐야 한다**"
  - 상세: 트래커는 "검토하라"고만 요구했지 "narrow 하라"고 강제하지 않았으므로 번복이 아니다. target 은 실제로 검토했고(`version-history-panel.tsx` 의 `creator` 부재 시 `createdBy` 폴백 방어 코드·테스트 `creator: null` 을 근거로 제시), 넓은 선언이 런타임에 안전하다는 결론에 도달했다. Rationale 연속성 관점에서 결함은 없으나, 이 판단 근거가 spec 이나 코드 주석이 아니라 plan 문서 한 곳에만 남는다 — plan 이 `plan/complete/` 로 이동한 뒤에는 "왜 프런트 타입을 안 좁혔는가"를 추적하기 어려워질 수 있다.
  - 제안: (선택) `workflow-versions.service.ts` 의 기존 JSDoc("백엔드가 더 좁으므로 런타임 오류는 안 난다")이 있는 자리에, 혹은 `lib/api/workflows.ts` 의 `WorkflowVersionSummary.creator` 선언 옆에 한 줄로 "백엔드는 narrow(#PR) 했으나 프런트는 방어 폴백 유지 목적상 넓게 둔다"를 남기면 다음 사람이 plan 없이도 이 판단을 찾을 수 있다. 필수는 아님(BLOCK 대상 아님).

## 요약

target(`plan/in-progress/workflow-version-creator.md` 이 기술하는 구현 방향과 그 근거가 되는 `spec/3-workflow-editor/5-version-history.md`)은 `spec/1-data-model.md` 의 "`select: false` 대신 응답 경계 투영" Rationale과 `spec/5-system/2-api-convention.md §5.4` "부재 표현" 규칙 양쪽 모두와 정합하며, 두 문서 모두 이번 target 이 손대는 정확히 같은 코드 자리(`WorkflowVersionsService.findOne`/`CREATOR_PROJECTION`, DTO 의 `creator`/`changeSummary`)를 선례·부채로 이미 언급하고 있어 대조가 특히 용이했다. 기각된 대안(엔티티 컬럼 `select: false`)의 재도입도, 합의된 §5.4 원칙 위반도, 무근거 결정 번복도 발견되지 않았다. 유일한 주목점은 프런트엔드 타입을 의도적으로 좁히지 않기로 한 판단의 근거가 plan 문서에만 남아 있다는 것으로, 이는 경미한 추적성 보완 제안(INFO)에 그친다.

## 위험도
NONE
