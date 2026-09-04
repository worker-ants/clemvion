# Plan 정합성 검토 — `spec/5-system/` (impl-done)

## 검토 범위 요약

- 모드: `--impl-done`, target scope=`spec/5-system/`, diff-base=`origin/main`
- `spec/5-system/` 자체 델타: 0개 파일 (정상 — 코드 전용 PR)
- 실제 diff (origin/main..HEAD, 4 커밋): `codebase/backend/.../external-interaction/dto/responses/execution-status-response.dto.ts` + 동반 `.spec.ts` (2파일/125줄), `plan/in-progress/spec-draft-nullable-notation-followups.md` 갱신, `CHANGELOG.md`, 그리고 review 산출물들.
- 내용: `ExecutionStatusDto` 의 `result`/`error`/`durationMs`/`currentNode`/`context` 5필드를 `@ApiPropertyOptional`+`field?: T|null` → `@ApiProperty({nullable:true})`+`field: T|null` 로 전환. 이는 `plan/in-progress/spec-draft-nullable-notation-followups.md` "§5.4 drift 배치 — 1단계"를 집행하고 그 plan 문서 자체를 갱신한 것이다.

## 대조한 plan/in-progress 문서

`spec-draft-nullable-notation-followups.md`(당사자) 외에 필드명(`durationMs`/`currentNode`/`ExecutionStatusDto`)·주제(§5.4, EIA 응답 DTO) 기준으로 교차 대조: `eia-context-schema-followups.md`, `eia-terminal-payload.md`, `spec-draft-eia-62-waiting-payload.md`, `spec-draft-eia-notification-payload-contract.md`, `spec-sync-external-interaction-api-gaps.md`, `spec-sync-common-gaps.md`, `retry-turn-terminal-guard.md`, `ie-resume-turn-boundary-cancel.md`, `node-cancellation-residual-signal-propagation.md`, `spec-draft-scope-and-anchor-drift.md`, `spec-conventions-engine-error-code-surface.md`.

## 발견사항

없음 (CRITICAL/WARNING 대상 없음). 아래는 확인 과정에서 나온 참고 사항 하나뿐이다.

- **[INFO]** `spec-draft-scope-and-anchor-drift.md` 의 라이프사이클 상태가 낡았다 — 이번 diff 와는 무관한 선재 상태
  - target 위치: (해당 없음 — 이번 diff 밖)
  - 관련 plan: `plan/in-progress/spec-draft-scope-and-anchor-drift.md`
  - 상세: 이 문서(①§5.4 스코프 명시·②`3-schedule.md`§2.1·③§2.2 자원 액션·④에러코드 소속)는 이미 `origin/main` 커밋 `7979d7daf`("docs(spec): 스코프 미명시 · 없는 규칙 인용 · 앵커 소속 미구분 4건 (#1280)")로 반영됐고, 그 사실은 `spec-draft-nullable-notation-followups.md`(①②③ "반영 완료")와 `spec-conventions-engine-error-code-surface.md`(④ "부분 해소")양쪽에서 이미 정확히 확인·인용되고 있다. 그런데 `spec-draft-scope-and-anchor-drift.md` 자신은 여전히 `status: in-progress` 로 `plan/in-progress/` 에 남아 있고 자체 종결조건/체크리스트 갱신이 없다 — 다음 사람이 이 문서를 열면 아직 미착수인 draft 로 오독할 수 있다.
  - 이번 검토 대상(`spec/5-system/` diff, 즉 `ExecutionStatusDto` 5필드 전환)과는 인과관계가 없다 — 이 diff 가 만들거나 악화시킨 상태가 아니라 이전 세션에서 이미 존재하던 상태다.
  - 제안: `spec-draft-scope-and-anchor-drift.md` 를 다음 planner 턴에서 종결조건 명시 후 `plan/complete/` 로 이동 (Gate C `spec_impact` 프런트매터 포함). 이번 PR 의 범위·차단 사유는 아니다.

## 검증한 정합 근거 (긍정 확인)

- **미해결 결정과의 충돌 없음**: `spec-draft-nullable-notation-followups.md` 는 "§5.4 가 WS wire 에도 적용되는가"를 planner 트랙 미결 항목으로 명시적으로 열어 두고 있다(선행 질문: "키 부재 ≠ null 인지"). 이번 diff 는 REST 응답 DTO(`ExecutionStatusDto`)만 건드리고 WS wire(`chat-channel-adapter.md` 의 `durationMs?: number | null`)는 그대로 두어, 그 미결 결정을 우회하거나 선점하지 않는다. `plan/in-progress/` 전수에서 이 WS 질문을 별도로 추적하는 중복 항목도 없다(단일 소유).
- **선행 plan 미해소 없음**: "1단계" 체크박스는 "노출 경로가 `getStatus()` 하나뿐이라 tsc 검증이 성립하는 유일한 묶음"이라는 전제 위에 서 있고, 그 전제가 반증되며 두 번 좁혀진 이력(83→15→5)이 plan 본문·CHANGELOG 양쪽에 함께 기록돼 있다. "2단계"(검증자 없는 응답 DTO 78곳=68 패스스루+`ExecutionDto` 10곳)로 남은 작업이 정확히 등재돼 있고, 개수 산식(83−5=78)도 plan 문서 내에서 일관된다.
- **후속 항목 누락 없음**: 이번 diff 로 새로 필요해진 후속(§5.4가 WS wire 에도 적용되는지, `ExecutionDto` 전용 스키마 테스트 부재, `AlertRuleDto.threshold` 형-불일치 등)이 모두 같은 plan 문서의 "## 후속"·"## 종결 조건" 표에 등재됐다. `NodeExecutionSummaryDto`(형제 클래스, 이번 diff 대상 아님)도 2단계 범위에 이미 포함돼 별도 누락이 없다. `durationMs`/`currentNode`/`finishedAt` 값 계산·재기록을 다루는 다른 in-progress plan(`retry-turn-terminal-guard.md`, `ie-resume-turn-boundary-cancel.md`, `node-cancellation-residual-signal-propagation.md` 등)은 **값의 정합성**(DB·in-memory 재계산)을 다루는 축이라 이번 diff 의 **선언 형태**(OpenAPI required/TS optionality) 축과 직교하며 상호 참조·충돌이 없다.
- 사전 라운드(`review/consistency/2026/09/04/15_16_28/`)가 이 plan 의 1단계 항목(당시 15필드/3파일 중간 상태)을 이미 NONE 으로 판정했고, 그 라운드의 `plan_coherence` 개별 리포트도 "미해결 결정·선행조건·후속항목 유실 없음"으로 결론지었다 — 이번 최종 diff(5필드/2파일로 재축소)는 그 판정의 방향을 유지하며 오히려 범위를 더 보수적으로 좁힌 상태다.

## 요약

이번 PR 은 `spec-draft-nullable-notation-followups.md` 가 스스로 세운 계획("§5.4 drift 배치 — 1단계")을 그대로 집행하고, 두 번의 자기반증(83→15→5)과 새로 발견한 미결 항목(WS wire 적용 여부, `ExecutionDto` 스키마 테스트 부재 등)을 모두 같은 plan 문서 안에 동시 반영했다. `plan/in-progress/` 전수를 필드명·주제 기준으로 대조한 결과 이 diff 와 충돌하는 미해결 결정이나 해소되지 않은 선행조건, 반영되지 않은 후속 항목을 찾지 못했다. 유일한 참고 사항은 이 diff 와 인과관계가 없는 별도 plan(`spec-draft-scope-and-anchor-drift.md`)의 라이프사이클 상태(이미 반영됐는데 `in-progress` 로 남음)이며, 이는 차단 사유가 아니다.

## 위험도

NONE
