# Consistency Check 통합 보고서

**BLOCK: NO** — 확보된 3개 checker(cross_spec / convention_compliance / naming_collision) 결과에 Critical 위배 없음. 단, **rationale_continuity·plan_coherence 2개 checker 는 status=success 로 보고되었으나 output_file 이 디스크에 실제로 생성되지 않아(알려진 Workflow FS-write 비결정적 flakiness) 이번 통합에서 내용을 확인하지 못했다.** 이 두 checker 는 "재시도 필요" 로 표기하며, 재실행 결과에 Critical 이 나오면 BLOCK 판정을 재평가해야 한다.

## 전체 위험도
**LOW** — 확보된 3개 checker 기준으로는 CRITICAL 없음, WARNING 2건(문서 drift), INFO 2건. 단 5개 checker 중 2개(rationale_continuity, plan_coherence)의 결과를 확인하지 못해 전체 커버리지는 불완전.

## Critical 위배 (BLOCK 사유)

없음 (확보된 3개 checker 기준. rationale_continuity/plan_coherence 는 미확인 — 아래 "재시도 필요" 참고)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `_selectedPort` 활성화 조건이 fan-out(`port: string[]`) 모델을 반영하지 않음 — §2.1 은 `_selectedPort` 가 단일 문자열이라는 전제로만 서술 | §2.1 "back-edge 활성화 조건"(L223-230), "`_selectedPort` 메타데이터 처리"(L240-242) | 같은 문서 §5.1 `NodeHandlerOutput.port` 타입(이번 diff 로 `string \| string[]` 로 확장) · `spec/conventions/node-output.md` Principle 5 · `spec/4-nodes/1-logic/10-parallel.md` · `spec/4-nodes/3-ai/2-text-classifier.md` (모두 `port: string[]` fan-out 을 표준으로 확립). 코드 `graph-traversal.service.ts` `isPortFiltered` 는 배열 `.includes()` 분기를 이미 구현 | §2.1 "back-edge 활성화 조건"에 "`_selectedPort`가 배열인 경우(Principle 5 fan-out) `sourcePort` 가 배열에 포함되면 활성화" 항목 추가, "`_selectedPort` 메타데이터 처리" 절에도 배열 케이스 1줄 명시 |
| 2 | convention_compliance | `interaction.data` payload 표가 스스로 인용한 CONVENTIONS §4.5 원본과 `form_submitted` 행이 불일치 (`via?: 'ai_render'` 필드·`ai_agent(render_form)` 적용 범위 누락) | §1.3 "`interaction.data` payload 규격 (CONVENTIONS §4.5)" 표 (약 L203-210) | `spec/conventions/node-output.md` §4.5 (SoT) — 동일 행이 `{ [fieldName]: value, via?: 'ai_render' }`, 적용 노드 `form`/`ai_agent`(`render_form`) 로 정의됨 | target 의 `form_submitted` 행을 node-output.md §4.5 원문과 동기화 (`data` 열 `via?` 필드 추가, 적용 노드 열에 `ai_agent(render_form)` 추가). 규약 자체 변경 아님 — target 이 최신본을 따라가야 함 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `port`/노드 타입 식별자 kebab-case → snake_case 정정은 `node-output.md` Principle 5 표와의 기존 drift 를 해소하는 방향 — 새 충돌 없음 | §5.3 "Port Selector 패턴" (`if_else`, `switch`, `text_classifier`, `http_request`, `ai_agent`) | 조치 불필요 (정보성 기록) |
| 2 | convention_compliance | `variables.__*` 이중 밑줄 시스템 변수 prefix 의 명명 SoT 부재 — `execution-context.md` 원칙 4 는 top-level `_`-prefix 만 규정, `variables` 맵 내부 `__`-prefix 는 어느 conventions 문서에도 정식 정의 없음 | §6.1 "컨텍스트 구조"(`variables.__workspaceId`), §6.2 "park 시 시스템 `__*` 제외" 서술 | `execution-context.md` 또는 신규 항목에 "`variables.__*` 는 시스템 예약 네임스페이스" 1줄 명문화 검토 (target 만의 결함 아님, 규약 보강 쪽이 적절) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | WARNING 1건(`_selectedPort` fan-out 미반영) + INFO 1건(kebab→snake 정정, 무해). 그 외 `_resumeCheckpoint`/`_retryState` 재유도 채널, `CREDENTIAL_CONTEXT_FIELDS`, `Execution`/`NodeExecution` enum, `RESUME_*` 에러코드·큐·env 모두 data-model/conventions/data-flow/websocket-protocol/error-handling/external-interaction-api 와 정합 확인 |
| rationale_continuity | **재시도 필요** | status=success 로 보고됐으나 output_file(`rationale_continuity.md`) 이 디스크에 생성되지 않음 (알려진 Workflow FS-write flakiness). 내용 미확인 |
| convention_compliance | LOW | WARNING 1건(`interaction.data` §4.5 `form_submitted` 행 drift) + INFO 1건(`__*` prefix SoT 부재). 나머지 — 문서 구조·frontmatter·에러코드 UPPER_SNAKE_CASE·Principle 인용·금지 패턴(구 `_multiTurnState` 등) 모두 규약 준수 확인 |
| plan_coherence | **재시도 필요** | status=success 로 보고됐으나 output_file(`plan_coherence.md`) 이 디스크에 생성되지 않음 (알려진 Workflow FS-write flakiness). 내용 미확인 |
| naming_collision | NONE | 이번 diff 가 신규 도입하는 식별자 없음(`CREDENTIAL_CONTEXT_FIELDS`/`resumeStateSchema`/`port: string \| string[]`/언더스코어 노드 타입 표기/`#501` 모두 기존 코드·spec 과 동일 의미로 이미 존재하던 것을 뒤늦게 명문화). 충돌 없음 |

## 권장 조치사항
1. (BLOCK 해소 우선 아님 — 현재 BLOCK: NO) **rationale_continuity, plan_coherence 2개 checker 를 재실행**하여 output_file 확보 후 내용 확인. Critical 발견 시 BLOCK 재평가 필요 — 현재 통합 결과는 5개 중 3개 checker 커버리지로 잠정적임.
2. `spec/5-system/4-execution-engine.md` §2.1 "back-edge 활성화 조건"에 `_selectedPort` 배열(fan-out) 케이스 명시 추가 — Principle 5 / `10-parallel.md` / `2-text-classifier.md` 와 정합.
3. §1.3 `interaction.data` payload 표의 `form_submitted` 행을 `spec/conventions/node-output.md` §4.5 원문(`via?: 'ai_render'`, 적용 노드 `form`/`ai_agent(render_form)`)과 동기화.
4. (선택) `spec/conventions/execution-context.md` 에 `variables.__*` 시스템 예약 네임스페이스 규칙 1줄 추가 검토 — target 자체 결함이 아닌 규약 보강 사안.