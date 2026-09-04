# Plan 정합성 검토 — spec/5-system/ (--impl-done)

## 검토 범위 요약

이번 세션의 실질 변경은 spec 델타 0(정상 — 코드 전용 PR), 구현 diff 8개 파일(`background-run-response.dto.ts`·`create-assistant-session.dto.ts` 의 nullable/`@ApiProperty` 계약 정정 9곳 + 신규 가드 `swagger-dto-contract-guard.ts`/`.spec.ts` + `nullable-type-lie-cast-guard.ts`/`.spec.ts` 리팩터 + 공용 `temp-fixture.ts` 추출)와, `plan/in-progress/spec-draft-nullable-notation-followups.md`·`plan/in-progress/execution-engine-residual-gaps.md` 두 plan 문서 갱신이다. 각각을 대조했다.

## 발견사항

- **[WARNING]** 이동된 plan 경로를 가리키는 stale 주석 2곳 (이번 diff 가 그중 1곳을 직접 건드리고도 미수정)
  - target 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:22`(이번 diff 에서 수정된 파일) · `codebase/backend/src/common/__test-utils__/source-scan.ts:190`(미수정 형제 파일)
  - 관련 plan: `plan/in-progress/entity-nullable-column-type-mismatch.md` — 커밋 `562d3119f`(entity nullable 배치 3, 이번 세션 이전) 로 이미 `plan/complete/entity-nullable-column-type-mismatch.md` 로 이동 완료. `plan/in-progress/` 에는 더 이상 이 파일이 없다.
  - 상세: 두 소스 파일의 docstring 이 "전수 목록·다음 배치 기준: `plan/in-progress/entity-nullable-column-type-mismatch.md`" 라고 적는데, 그 경로는 이제 존재하지 않는다(plan lifecycle 이동이 코드 주석에 반영되지 않음). 더 심각한 것은 **"다음 배치 기준"이라는 서술 자체가 지금은 틀렸다** — 그 역할은 이번 diff 가 갱신한 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "§5.4 drift 배치"(현재 104곳, 착수 시 재측정 지시)로 넘어갔는데, 두 주석 다 그 새 위치를 언급하지 않는다. `nullable-type-lie-cast.spec.ts` 는 이번 diff 에서 직접 편집됐음에도(픽스처 추출) 이 인접 주석은 손대지 않았다.
  - 제안: 두 주석의 참조를 `plan/complete/entity-nullable-column-type-mismatch.md`(완료 이력) 또는 실질적 "다음 배치" 추적처인 `plan/in-progress/spec-draft-nullable-notation-followups.md`(§5.4 drift 배치)로 정정. 코드 쪽 처리이므로 developer 턴에서 바로 고칠 수 있는 범위(사실 정정, spec 아님).

## 정합성 확인된 항목 (참고용 — 문제 없음)

- 9곳 "계약 거짓" DTO 수정(`background-run-response.dto.ts` 8필드 + `create-assistant-session.dto.ts` `llmConfigId`)은 target 문서 `spec/5-system/2-api-convention.md` §5.4 의 **이미 확정된** 규칙("`null` 을 쓰는 상시 존재 필드 → `@ApiProperty({nullable:true})` + `field: T | null`", "`@ApiPropertyOptional` 을 쓰면 `required:false` 로 나가 모순")을 그대로 구현한 것 — §5.4 는 이 세션 이전(planner 커밋 `cce8a188b`, `#1277`)에 이미 정정되어 있었으므로, 이번 diff 는 미해결 결정을 우회한 것이 아니라 **이미 해소된 결정을 뒤늦게 구현**한 것이다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 는 "§5.4 drift 배치"(구 관행 103→104곳)를 명시적으로 **이 PR 범위 밖**으로 남기고("급하지 않다", 별도 developer plan) 체크박스를 미해결로 유지한다 — 이번 diff 도 그 104곳을 건드리지 않아 plan 서술과 실제 변경 범위가 일치한다.
- `plan/in-progress/execution-engine-residual-gaps.md` 에 추가된 "장애물 2·3 재실측" 단락은 순수 서술 추가(코드 무변경)이며, 기존 `⛔ BLOCKED` 상태·"developer 가 열 수 없다 → planner 턴 선행" 결론과 모순 없이 재확인만 한다.
- `plan/complete/entity-nullable-column-type-mismatch.md` 가 이미 처리한 `AuthConfigDto.ipWhitelist`(#1273)·`WorkspaceInvitationDto.invitedBy`(#1274) 를 `spec-draft-nullable-notation-followups.md` 가 "111(→104+1 재계산 후에도 유지)곳 배치의 첫 두 건"으로 등재한 서술은 이번 diff 가 만든 것이 아니라 기존 텍스트(숫자만 갱신)이며, 새로운 모순을 만들지 않는다.
- `background-run-response.dto.ts` 를 참조하는 다른 in-progress plan(`node-output-redesign/background.md`, `eia-context-schema-followups.md`)은 `meta.jobId` 미발행·status 리터럴 유니온 등 **이번 diff 와 무관한 축**을 다루므로 충돌 없음.

## 요약

이번 diff 는 target spec(`spec/5-system/2-api-convention.md` §5.4)의 **이미 planner 턴에서 확정된 규칙**을 구현하는 소규모·자기완결적 버그 수정 + 재발방지 가드다. 관련 plan(`spec-draft-nullable-notation-followups.md`)이 "완료 항목"과 "의도적 유예 항목"(104곳 drift 배치)을 정확히 구분해 갱신됐고, 유예 항목을 건드리지 않았다. 미해결 결정을 우회하거나 선행 plan 을 무시한 정황은 없다. 유일한 흠은 plan lifecycle 이동(in-progress → complete)이 코드 주석 2곳에 반영되지 않은 stale 참조로, 그중 1곳은 이번 diff 가 바로 그 파일을 편집하면서도 놓쳤다 — plan 문서 자체의 정합성 문제라기보다 "plan 참조 hygiene" 성격의 경미한 결함이다.

## 위험도

LOW
