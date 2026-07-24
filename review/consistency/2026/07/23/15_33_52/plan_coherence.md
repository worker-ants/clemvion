# Plan 정합성 검토 — spec/4-nodes/6-presentation

## 발견사항

- **[WARNING]** target 범위와 실제 세션 diff 의 불일치 — "구현 완료 후 검토" 전제가 성립하지 않음
  - target 위치: `spec/4-nodes/6-presentation/0-common.md` · `1-carousel.md` (프롬프트에 포함된 전체 본문)
  - 관련 plan: 해당 없음 (검토 방법론 자체에 대한 지적)
  - 상세: `--impl-done` 모드는 "이 세션에서 spec/코드가 변경됐다"를 전제하지만, 실측 결과:
    - `git diff origin/main --stat -- spec/` → **0 변경** (spec 디렉터리 전체에 diff 없음)
    - `git diff origin/main -- spec/4-nodes/6-presentation/0-common.md` → **0 변경**, `git show origin/main:spec/4-nodes/6-presentation/0-common.md` 도 동일 내용으로 이미 origin/main 에 존재 (`status: implemented`)
    - `git diff origin/main --stat -- codebase/backend/src/nodes/presentation codebase/backend/src/modules/execution-engine codebase/frontend/src/components/editor/run-results` → presentation/execution-engine 백엔드 코드 diff **0**, frontend 는 `output-shape.ts`/`output-shape.test.ts` 만 변경 (§10 AI Tool 모드·§10.9 continuation sentinel wrap 등과 무관)
    - 프롬프트 본문에 "## 구현 변경 사항"(diff) 섹션 자체가 없음 — target 전문만 있고 diff 블록이 부재
    - 현재 브랜치(`claude/isconversationoutput-refactor-dc0472`)의 실제 커밋들은 `isConversationOutput`/`endReason` 리팩터 (harness reaper·push 훅 등) 이며 presentation 노드와 무관
  - 제안: 본 target 문서(§10 AI Tool 모드, §10.9 form submission wire sentinel 등)는 이미 완료된 `plan/complete/web-chat-ai-presentation-render.md` 산출물로 origin/main 에 안착된 **기존 spec** 이다. 신규 결정이 내려진 바 없으므로 "미해결 결정과의 충돌"은 원천적으로 발생할 수 없다 — orchestrator 측 target/diff 스코프 재확인 권장 (다른 세션의 payload 가 혼입됐을 가능성).

- **[INFO]** `processAiResumeTurn`/`handleAiMessageTurn` 의 `resumed` status 미emit — target §10.9 서술과 인접 plan 의 기존 추적 갭
  - target 위치: `0-common.md` §10.9 "`processAiResumeTurn` dispatch 4 케이스 명시 매칭" 표 (`'ai_message'` → `handleAiMessageTurn`, `'form_submitted'` → 동일 함수 호출)
  - 관련 plan: `plan/in-progress/node-output-redesign/information-extractor.md:177,230`
  - 상세: info-extractor plan 은 동일 dispatcher(`ai-turn-orchestrator.service.ts` `processAiResumeTurn:250-291` → `handleAiMessageTurn:520`)가 AI 대화 turn 에서 `message_received` interaction / `status: 'resumed'` 를 **emit 하지 않는다**는 기존 미해결 갭을 기록 중이다(`resumed` emit 은 form/button 전용 서비스에만 존재). target §10.9 는 이 dispatch 매칭 자체(라우팅 정확성)만을 SoT 로 선언하고 이 갭에 대해 언급하지 않는다 — 서로 다른 관심사(라우팅 vs 상태 emit)라 직접 충돌은 아니지만, `render_form` 의 `form_submitted` 액션도 동일 `handleAiMessageTurn` 경로를 타므로 이 기존 갭의 영향 범위에 render_form 도 포함될 가능성이 있다. target 문서에는 이 cross-ref 가 없음.
  - 제안: CRITICAL 아님(추적 필요 시 info-extractor.md 잔여 항목에 render_form 케이스 언급 추가만 권장, 우선순위는 낮음).

- **[INFO]** `ai-agent-tool-connection-rewrite.md` (`tool_*` 일반 도구 재설계, 착수 전 사용자 결정 대기) 는 target 이 참조하는 `render_*` 표현 도구 가족과 명시적으로 직교 관계 — 충돌 없음 확인
  - target 위치: `0-common.md` §10 (`render_*` family), 상위 `1-ai-agent.md §12.4`(비-target 이지만 cross-ref) "`tool_*` 슬롯과의 관계" Rationale
  - 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md:13` (`(unstarted)`, 사용자 도구 등록 모델 결정 대기)
  - 상세: 두 문서 모두 "의도·schema 출처·결과 라우팅이 다른 직교 관계"를 명시적으로 서술하며 상호 정합 — target 이 `tool_*` 미해결 결정을 우회하거나 선점하지 않음. 실제 스펙(`spec/4-nodes/3-ai/1-ai-agent.md:402`)의 dispatcher 분류 순서(provider-매칭 kb→mcp→render, 이후 cond 이름 대조, 최종 tool_* fallback)도 이 직교성과 일치.

- **[INFO]** `execution-engine-residual-gaps.md` G2(errorPolicy `continue` SIGTERM interrupt, defer 확정) 는 target §10.9 의 "재개 모델(full B3, park 즉시 해제 + rehydration 일원화)" 서술과 레이어가 달라 충돌 없음
  - target 위치: `0-common.md` §10.9 하단 "재개 모델 (full B3)" 문단
  - 관련 plan: `plan/in-progress/execution-engine-residual-gaps.md:45-67` (G2, BLOCKED/defer)
  - 상세: target 의 park/rehydration 모델 변경은 WAITING_FOR_INPUT(폼/버튼/멀티턴 AI) 재개 경로에 대한 것이고, G2 는 RUNNING(non-waiting) 노드가 SIGTERM grace 내 미완료 시 `errorPolicy='continue'` 분기 처리에 대한 것 — 서로 다른 재개 트리거 레이어. G2 의 "장애물 3"(cross-instance mid-execution 재개 인프라 부재)은 이미 `exec-park-durable-resume.md` PR3(크래시 RUNNING 세그먼트 재개, 완료)로 부분 해소된 상태이며 target 변경이 이 defer 결정을 뒤집거나 전제를 깨지 않음.

## 요약

Plan 정합성 관점에서 가장 중요한 발견은 target 문서 내용 자체다: `spec/4-nodes/6-presentation/{0-common,1-carousel}.md` 는 `origin/main` 과 완전히 동일한 이미 병합된 spec(`status: implemented`)이며, 대응 백엔드(`nodes/presentation/**`, `modules/execution-engine/**`)·프런트(`run-results/**`)에도 이 세션에서의 diff 가 전혀 없다. 즉 이번 `--impl-done` 호출이 전제하는 "이 세션에서 새로 결정·구현된 내용"이 존재하지 않으므로, "미해결 결정을 일방적으로 우회"할 대상 자체가 없다. plan/in-progress 전수(`node-output-redesign/{carousel,table,chart,form,template,ai-agent}.md`, `ai-agent-tool-connection-rewrite.md`, `execution-engine-residual-gaps.md`, `node-cancellation-inflight-followups.md`, webchat 계열 등)를 target 의 핵심 개념(render_* AI tool family, ButtonDef.userMessage, button/option backfill, continuation bus sentinel wrap, presentations timeline inline)으로 교차 검색한 결과 CRITICAL 급 충돌은 없었고, 인접한 두 건(§10.9 dispatch 의 resumed-status 미emit 갭 cross-ref 누락, defer 확정된 G2 와의 레이어 분리)은 정보성으로만 기록할 가치가 있다. 실질적 위험은 코드/스펙 정합성이 아니라 **이 검토 자체의 스코프-diff 불일치**이며, 이는 orchestrator 측에서 target/diff 페이로드 소스를 재확인해야 할 사안이다.

## 위험도
LOW
