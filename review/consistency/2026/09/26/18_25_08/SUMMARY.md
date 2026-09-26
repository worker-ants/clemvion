# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전문 모두 확보(인라인 authoritative, `plan_coherence.md` 는 디스크에 없어 본 요약 단계에서 인라인 전문으로 새로 영속화함).

## 전체 위험도

**LOW** — Critical 0건, WARNING 1건(신규 "문서 전용 `*RequestDto`" 명명 계열이 `swagger.md §1-7` 에 아직 편입되지 않음). 이 PR 은 `spec_impact: none` 순수 OpenAPI 문서화 변경이며 런타임 계약은 불변.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance (rationale_continuity 도 동일 항목을 INFO 로 중복 지적, 최강 등급 채택) | 신규 "문서 전용 DTO"(class-validator 미부착, `@ApiBody({ type })` 전용) 계열의 명명이 이 PR 이 스스로 인용한 선례(`ExecuteWorkflowDto`, 접미 없음)와 다르고, `swagger.md §1-7` 은 `Update` 접두 규칙만 규정할 뿐 이 신규 카테고리의 명명을 아직 다루지 않음 | `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token-request.dto.ts` (`ChatChannelRotateBotTokenRequestDto`) · `codebase/backend/src/modules/executions/dto/continue-execution.dto.ts` (`ContinueExecutionRequestDto`) | `spec/conventions/swagger.md` §1-7 | 코드 재작업은 불요(저장소 지배적 패턴인 `*RequestDto` 접미와 정합). `plan/in-progress/rotate-bot-token-body.md` 체크리스트 마지막 항목("트래커 항목 닫기 · 전역 가드 후속 등재")을 실제로 수행해 `spec/conventions/swagger.md` §1-7(또는 인접 절)에 "문서 전용(비검증) top-level 요청 DTO 명명" 행을 추가할 것. 이미 plan 이 INFO2/4/5 로 자체 식별·유예해 둔 항목이라 이번 PR 범위에서 차단 사유는 아님 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | 형제 DTO 간 단어 순서 비대칭 — `ExecutionContinueResultDto`(응답) vs `ContinueExecutionRequestDto`(요청), 접두사 grep/자동완성으로 짝을 찾기 어려움 (규약 위반은 아님) | `codebase/backend/src/modules/executions/dto/continue-execution.dto.ts` (신규) / `dto/responses/execution-response.dto.ts:223` (기존) | 후속 리네임 기회가 있으면 `ExecutionContinueRequestDto` 로 어순을 맞추는 안을 트래커에 남겨 둘 것. 지금 당장 조치 불요(비검증 DTO 리네임은 계약 영향 없음) |
| 2 | plan_coherence | 트래커 종결 노트(`spec-draft-nullable-notation-followups.md` 라인 2459~2466, "OpenAPI 데코레이터 전무" 문구가 이 PR 로 stale) 반영이 이번 diff 범위 밖으로 의도적으로 지연됨 | `plan/in-progress/rotate-bot-token-body.md` 체크리스트 마지막 줄 `- [ ] 트래커 항목 닫기 · 전역 가드 후속 등재` | `--impl-done` 통과 후 마무리 커밋에서 트래커 항목을 실제 채택안(DTO 미승격·문서 전용 패턴)으로 갱신하고 `[x]` 체크 — 위 WARNING #1 조치와 동일 커밋에서 함께 처리 가능 |
| 3 | naming_collision | 신규 `*-body.spec.ts` 세 파일이 각각 로컬 `class StubController`을 정의해 `workflows-execute-body.spec.ts` 의 기존 `StubController`와 이름은 겹치지만, 각각 별도 Jest 모듈 스코프에서 격리된 `buildSwaggerDocument`를 생성하는 기존 확립 패턴(3번째 반복)이라 실제 스키마 레지스트리 충돌 아님 | `codebase/backend/src/modules/{triggers,executions,hooks}/*-body.spec.ts` | 조치 불요 — 재조사 방지용 기록 |
| 4 | cross_spec | 선행 `--impl-prep`(`review/consistency/2026/09/26/17_20_45`) WARNING 2건(required 표기 누락 위험 · `15-chat-channel.md` code glob 이탈 위험)이 구현에서 정확히 해소됨 — `newBotToken: string`(필수) + `@ApiProperty({ writeOnly: true })`, 파일명이 응답 DTO와 대칭이라 glob 안에 포함 | `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token-request.dto.ts` | 조치 불요 — 확인 기록 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 3개 라우트 OpenAPI 스키마 추가가 `15-chat-channel.md` §5.4·`12-webhook.md` WH-EP-04/05·`3-execution.md` `/continue` 계약과 전부 정합, 선행 impl-prep WARNING 2건 해소 확인 |
| rationale_continuity | LOW | R-CC-10/18/21/22/23 등 관련 Rationale 전부 번복 없이 준수. 유일 잔여는 "문서 전용 `*RequestDto`" 명명이 `swagger.md §1-7` 미편입(plan 이 자체 인지·유예) |
| convention_compliance | LOW | writeOnly·JSDoc 분리·응답 wrapping·에러코드 등 규약 대부분 준수. WARNING 1건(§1-7 명명 공백) + INFO 1건(형제 DTO 어순 비대칭) |
| plan_coherence | NONE | 이미 닫힌 `execute-body-dto` 결정(2026-08-22)을 정합하게 확장, 선행 조건·후속 plan 과 충돌 없음. 트래커 종결 노트 반영만 의도적으로 마무리 커밋으로 지연 |
| naming_collision | NONE | 신규 식별자(DTO 클래스 2개·헬퍼 함수 1개·신규 파일 소수) 전부 기존 사용처와 동명 충돌 없음. 응답 DTO 와의 근접 명명도 `Request` 접미로 명확히 구별 |

## 권장 조치사항

1. (WARNING 해소) `--impl-done` 통과 후 마무리 커밋에서 `plan/in-progress/rotate-bot-token-body.md` 체크리스트 마지막 항목을 실행 — `spec/conventions/swagger.md` §1-7(또는 인접 절)에 "문서 전용(비검증) top-level 요청 DTO 명명(`*RequestDto`)" 규칙을 추가하고, `plan/in-progress/spec-draft-nullable-notation-followups.md` 라인 2459~2466 의 stale 트래커 문구도 이 PR 의 실제 채택안(DTO 미승격, 문서 전용 패턴)으로 갱신·체크할 것. (harness 문서 편집이므로 project-planner 턴 대상 — 코드 변경은 불필요)
2. (선택, 비차단) 후속 리네임 기회가 있을 때 `ContinueExecutionRequestDto` → `ExecutionContinueRequestDto` 로 형제 응답 DTO 와 어순을 맞추는 안을 같은 트래커 항목에 기록해 둘 것.
