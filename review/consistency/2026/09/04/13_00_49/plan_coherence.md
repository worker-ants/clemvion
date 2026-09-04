# Plan 정합성 검토 — spec/5-system/ (impl-done)

## 검토 범위 재확인

- target scope(`spec/5-system/`) 델타: **0개 파일** — 이 브랜치는 그 spec 영역을 바꾸지 않았다(정상).
- 실제 코드 diff(`origin/main...HEAD -- code_areas`, 16파일/1262줄)는 `codebase/backend/src/common/__test-utils__/`·`codebase/backend/src/repo-guards/__tests__/`(source-scan 유틸 추출·`swagger-dto-contract` 신규 가드·9곳 DTO 계약거짓 수정)와 `plan/in-progress/spec-draft-nullable-notation-followups.md` 자체 갱신으로 구성된다.
- 이 diff 는 `plan/in-progress/spec-draft-nullable-notation-followups.md`(P2, in-progress, 2026-09-04 시작)와 그 형제 plan `plan/complete/entity-nullable-column-type-mismatch.md`(2026-09-04 complete 이동, 33/33 종결)를 직접 참조한다. 아래는 그 정합성 실측이다.

## 발견사항

- **[INFO]** `spec-draft-nullable-notation-followups.md` "종결 조건" 절이 이미 집행된 동작을 미래형으로 서술
  - target 위치: 해당 없음 (target `spec/5-system/` 델타 0, 이 항목은 plan 문서 자체의 내적 서술)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` `## 종결 조건` — "이 draft 를 `complete/` 로 옮길 때 **형제 plan 의 세 체크박스를 함께 닫는다**(`entity-nullable-column-type-mismatch.md` 의 planner 턴 3건 `:182`·`:190`·`:247`). 그 plan 상단 경고문도 함께 해제한다."
  - 상세: 실측 결과 형제 plan `entity-nullable-column-type-mismatch.md` 는 이미 `plan/complete/`로 이동했고(`status: complete`), 상단 경고문도 이미 `~~완료 처리하지 말 것~~` 취소선 처리 + "**planner 턴 3건 반영 완료**(`spec-draft-nullable-notation-followups.md`, 2026-09-04) — 이 조건은 해제됐다"로 갱신돼 있으며, `:182`(`next_run_at` 표기)·`:190`(`/api/auth/*` 예외)·`:247` 인근(§5.4 자기모순 관련) 항목도 모두 `[x]` 로 닫혀 있다. 즉 "종결 조건"이 예고하는 동작은 **이 followups draft 자신이 아직 `in-progress`(남은 미해결 항목 5건: §5.4 drift 배치·`QueryExecutionDto.workflowId`·`idx_schedule_next_run`·§2.2 단일동사·§5.4 응답전용 스코프문구)인 상태에서 이미 선행 집행**됐다. 실질적 충돌은 아니다(형제 plan의 내용 자체는 실측과 일치하고 거짓이 아님) — 다만 이 "종결 조건" 문구가 여전히 "닫을 때 함께 닫는다"는 미래 지시형이라, 나중에 이 draft 를 실제로 `complete/`로 옮기는 사람이 "아직 안 닫혔다"고 오인하거나 중복 작업을 시도할 여지가 있다.
  - 제안: `spec-draft-nullable-notation-followups.md` 의 "종결 조건" 절을 "이미 반영됨(cce8a188b, 2026-09-04)"으로 갱신해 실제 순서(형제 plan 완료 → 남은 5건 계속 진행 → 이 draft 자체 종결)를 반영. 우선순위 낮음(내용 무결성에는 영향 없음).

## 정합성 확인된 항목 (참고용, 문제 아님)

- 코드 주석(`source-scan.ts:290-296`, `nullable-type-lie-cast.spec.ts:22`)의 `plan/complete/entity-nullable-column-type-mismatch.md`(33/33 종결) 참조는 실측과 일치 — dangling 참조 없음(`plan/in-progress/`에는 더 이상 해당 파일이 없고, 참조하는 두 소스 모두 `plan/complete/` 경로를 정확히 가리킴).
- "다음 배치는 `spec-draft-nullable-notation-followups.md` 의 §5.4 drift 배치" 라는 코드 주석 클레임은 실제로 그 plan 안에 동일 표제의 미착수(`[ ]`) 항목으로 존재 — 정합.
- 신규 `swagger-dto-contract-guard.ts` 는 presence/null 두 축을 모두 스캔하지만, plan 이 "새 가드는 [§5.4 drift 103곳/17곳] 형태를 잡지 않는다"고 적은 주장은 AST 판정 로직(`effectiveRequired === tsOptional`)을 실측 대조한 결과 사실과 일치한다 — `field?: T | null` + `nullable:true`(정상 tri-state/response 패턴)는 플래그되지 않고, `field: T | null`(물음표 없음) + `@ApiPropertyOptional()`(계약 거짓 패턴)만 플래그된다. 요청 DTO 의 tri-state 필드를 이 배치에서 "카테고리째 제외"한다는 plan 결정과 실제 가드 동작이 충돌하지 않는다.
- `spec/5-system/2-api-convention.md` §5.4 는 아직 "응답 바디 한정" 명시 문구를 담고 있지 않다 — plan 이 이 항목을 `[ ]`(planner 턴 미착수)로 남겨둔 것과 정확히 일치. target 델타 0 과도 모순 없음(이 세션이 그 문구를 앞질러 넣지 않았다).
- `create-assistant-session.dto.ts` `llmConfigId` 수정(CHANGELOG 신규 절)은 §5.4 소속(`## 5. 응답 형식`)이 요청 DTO 에는 적용되지 않는다는 plan 의 논거를 그대로 인용하며, presence 축(`@ApiPropertyOptional` 유지)은 건드리지 않고 null 축(계약 거짓)만 고쳤다 — plan 의 "요청 DTO 는 drift 배치에서 제외" 결정과 정합.
- `path.relative(...).split(path.sep).join('/')` 인라인 8곳은 이번 diff 로 전부 `toPosixRelative` 로 이관됐다(잔존 인라인 패턴 0건, grep 확인) — "추출을 하면서 사본을 더 늘렸다"는 자기반성 주석이 이번 diff 에서는 해소된 상태로 남아 후속 결함을 만들지 않음.

## 요약

target(`spec/5-system/`)은 이번 브랜치에서 실질적으로 변경되지 않았고(델타 0), 실제 코드 diff는 이미 병합된 spec 정정(`cce8a188b`, origin/main 포함)이후의 후속 가드/DTO 정합화 작업이다. 이 작업이 참조하는 두 plan(`plan/in-progress/spec-draft-nullable-notation-followups.md`·`plan/complete/entity-nullable-column-type-mismatch.md`) 사이의 체크박스·경고문·범위(요청 DTO 제외, §5.4 drift 배치 미착수)는 실측 대조 결과 전부 일치하며, 미해결 결정을 우회하거나 선행 plan을 무시하거나 후속 항목을 빠뜨린 사례는 발견되지 않았다. 유일한 지적은 followups plan의 "종결 조건" 절이 이미 선행 집행된 동작을 여전히 미래형으로 서술하는 사소한 문서 staleness(INFO)뿐이다.

## 위험도
LOW
