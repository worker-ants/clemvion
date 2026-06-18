# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-update-engine-split.md`
검토 기준: `spec/5-system/4-execution-engine.md § Rationale` 및 관련 spec Rationale 발췌

---

## 발견사항

- **[INFO]** 제안된 변경 대부분이 현재 spec 에 이미 반영된 상태
  - target 위치: `## 변경 (spec 파일별)` 각 항목 전체
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §Rationale "C-1 god-class strangler-fig 분할"` (lines 1456–1466)
  - 상세: target 문서가 신설을 요청하는 `§Rationale "C-1 god-class strangler-fig 분할"` 항은 이미 `spec/5-system/4-execution-engine.md` lines 1456–1466 에 완전히 기록돼 있다 (`EngineDriver`·`WorkflowExecutor` 기각·`EventEmitter` 불변·추출 서비스 목록 모두 포함). 마찬가지로 `spec/4-nodes/0-overview.md` §1.0 bootstrap 트리거 서비스 명시(line 55), `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 내 `ai-turn-orchestrator.service.ts`(line 12) 및 §10 `extractAiTurnErrorPayload` 포인터(line 1099), `spec/conventions/interaction-type-registry.md` §1.2 Backend emit 위치 열 `AiTurnOrchestrator`/`ButtonInteractionService`(lines 45–47) 및 frontmatter `code:`(line 7), `spec/conventions/node-output.md` §4.5 `button_continue` `selectedItem?`/`url?`(line 259) 및 §4.2 `previousOutput` Phase 3 예외(line 194), `spec/4-nodes/6-presentation/0-common.md` `processAiResumeTurn` 포인터(line 426) 모두 이미 현행화된 상태다.
  - 제안: target 의 `## 비고` 가 "구현은 4 PR 모두 정확·검증됨"이라 밝히듯, spec 파일들은 C-1 분할 PR 들이 완료된 시점에 이미 갱신됐을 가능성이 높다. planner 가 spec 파일을 직접 열어 각 제안 항목이 실제로 부재·오래된지 재확인한 뒤, 중복 작성을 방지한다.

- **[INFO]** `data-flow/3-execution.md` 다이어그램 actor 갱신은 선택(차단 아님) 표기이며 Rationale 정합 무관
  - target 위치: `### spec/data-flow/3-execution.md`
  - 과거 결정 출처: 없음(다이어그램은 Rationale 적용 대상 외)
  - 상세: 다이어그램 actor 명칭 갱신은 Rationale 위반 여부와 무관한 표현 정정이다. 충돌 없음.
  - 제안: 해당 없음.

---

## 요약

target 문서(`spec-update-engine-split.md`)가 도입·번복하려는 결정은 단 하나도 없다. 제안하는 모든 변경 — `§Rationale "C-1 god-class strangler-fig 분할"` 신설, 메서드 소속 포인터 갱신, frontmatter `code:` 추가, `button_continue` optional 필드, `previousOutput` 예외 명시 — 은 각 spec 파일에 이미 반영돼 있으며, 기존 Rationale 의 합의 원칙(§4.4 단일 sink 정책 불변, `WorkflowExecutor` 기각, in-process 전제, strangler-fig 옵션 A 선택)과 완전히 일치한다. 기각된 대안의 재도입, 합의된 invariant 위반, 근거 없는 결정 번복, 암묵적 가정 충돌은 발견되지 않는다. 단, planner 는 plan 실행 전 각 spec 파일의 현재 상태를 재확인해 이미 동기화된 항목에 대한 중복 편집을 피할 것을 권고한다.

---

## 위험도

NONE
