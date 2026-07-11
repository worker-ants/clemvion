# Rationale 연속성 검토 — EIA/WS 대기 표면 명령 매트릭스 (waiting-surface-guard)

대상: `spec/5-system/14-external-interaction-api.md` (--impl-done, diff-base `52f46f95f`)
구현 diff 요지: `resolveWaitingNodeExecutionId`에 `expectedCommand` 인자를 추가하고
`assertCommandMatchesWaitingSurface`(신규 `waiting-surface-guard.ts`)로 대기 노드의
interaction 표면(form/buttons/ai_conversation)과 도착 명령의 적합성을 publish 전에
검증한다. 표면 판정 불가 시 fail-closed. `hooks.service.ts`의 chat-channel 인바운드
forwarding도 새 409를 warn 후 삼키도록 조정됐다.

## 발견사항

- **[WARNING]** 신규 "대기 표면 ↔ 명령 매트릭스" 결정이 아직 spec Rationale에 반영되지 않음
  - target 위치: `spec/5-system/14-external-interaction-api.md` §5.1 `409 STATE_MISMATCH` 행 —
    diff 상 target 문서에 대한 변경이 전혀 없음(`### 구현 대상 spec 영역: (없음)`,
    `git diff 52f46f95f -- spec/` 도 무변경 확인).
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §7.5.1 (기존엔 "0건" / "2건 이상" 두
    케이스만 표에 등재), `spec/5-system/14-external-interaction-api.md` R13("WS 평면 ack
    에러 코드 ↔ EIA REST 에러 코드 매핑 원칙" — `InvalidExecutionStateError → 409
    STATE_MISMATCH`), EIA-IN-13("현재 노드 상태와 명령이 맞지 않으면 409").
  - 상세: 신규 `assertCommandMatchesWaitingSurface` + `SURFACE_ALLOWED_COMMANDS` 매트릭스는
    `InvalidExecutionStateError`(→409 STATE_MISMATCH)의 **세 번째 발생 사유**(표면 불일치)를
    도입한다. R13의 매핑 원칙 자체와는 정합하고 EIA-IN-13이 이미 약속한 계약의 구현이라
    "기각된 대안의 재도입"이나 "invariant 위반"은 아니지만, (a) §7.5.1 표에 3번째 행이
    없고, (b) "왜 form/buttons는 엄격, ai_conversation은 4종 모두 허용, 판정 불가는
    fail-closed인가"를 설명하는 신규 Rationale 항목이 execution-engine.md에도
    14-external-interaction-api.md에도 없다. 이 결정 근거는 현재
    `plan/in-progress/eia-command-waiting-surface-guard.md`(진행 중 작업 문서)에만 있고,
    CLAUDE.md 정보 저장 원칙상 "결정의 배경·근거"는 spec 문서 끝 `## Rationale`이 SoT다.
    같은 plan 파일의 체크리스트 마지막 두 항목("`/consistency-check --impl-done
    spec/5-system`", "spec 동기")이 미체크 상태로, 이 gap은 이미 self-tracked 돼 있다(침묵
    누락은 아님).
  - 제안: `project-planner`에게 plan 파일의 "spec 동기(project-planner 위임 대상)" 목록대로
    위임 — `4-execution-engine.md` §7.5.1 3번째 행 + `## Rationale` 신설(왜 fail-closed,
    왜 ai만 관대), `14-external-interaction-api.md` §5.1 STATE_MISMATCH 예시 보강,
    `4-nodes/6-presentation/0-common.md` §10.9에 buttons 비-click 명령이 이제 publisher
    단계에서 거부됨을 명시(기존 `resolveButtonInteraction` (d) fallback 문서화 갱신),
    `conventions/interaction-type-registry.md` cross-ref.

- **[INFO]** fail-open → fail-closed 전환의 grounding은 실제로 검증됨 — 문제 없음, 강화 제안만
  - target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    `assertCommandMatchesWaitingSurface` JSDoc "**fail-closed**" 단락;
    `plan/in-progress/eia-command-waiting-surface-guard.md` "fail-open → fail-closed 정정"
  - 과거 결정 출처: 프로젝트 전역 fail-open 선례 전수 확인(`grep -rn "fail-open" spec/`) —
    모두 Redis/DB 인프라 가용성 시나리오(webhook rate-limit, token blacklist, nonce-cache
    등) 한정. 대조적으로 `spec/4-nodes/2-flow/1-workflow.md`(§2)와
    `spec/5-system/4-execution-engine.md` §Rationale "sub-workflow workspace 격리
    fail-closed (PR #637)"은 "인프라 가용성이 아닌 비즈니스 invariant 판정"에 대해
    fail-open→fail-closed로 전환한 선행 사례. 본 PR의 근거("자매 게이트 `dispatchResumeTurn`이
    이미 fail-closed·표면 판정 불가 행은 오늘도 `RESUME_CHECKPOINT_MISSING`으로 죽는다")도
    `spec/5-system/4-execution-engine.md` §7.5 rehydration 표(`RESUME_CHECKPOINT_MISSING`
    → Execution `cancelled`)와 실제로 일치함을 확인했다. 지어낸 선례가 아니다.
  - 상세: 문제 없음. 다만 이 grounding은 plan 문서에만 적혀 있어 향후 신설될 Rationale
    항목이 이 두 선례(인프라-한정 fail-open 관례 / PR #637 fail-closed 전환)를 명시적으로
    cross-ref하면 결정의 재현성이 높아진다.
  - 제안: 신설 Rationale 항목에 "본 프로젝트의 fail-open 선례는 인프라 가용성 전용이며 본
    사안은 비즈니스 상태 invariant라 [PR #637 sub-workflow workspace 격리
    fail-closed](../4-nodes/2-flow/1-workflow.md) 선례를 따른다"는 한 문장을 포함.

- **[INFO]** AI 표면 4종 허용의 §10.9 graceful re-park invariant 보존 — 검증됨, 문제 없음
  - target 위치: `waiting-surface-guard.ts` `SURFACE_ALLOWED_COMMANDS.ai_conversation`(4종),
    `waiting-surface-guard.spec.ts`/`execution-engine.service.spec.ts`의
    "resumeTurnRegistry 의 selects 와 resolveWaitingSurface 판정이 일치한다" 회귀 테스트.
  - 과거 결정 출처: `spec/4-nodes/6-presentation/0-common.md` §10.9
    "`'button_click'` AI conversation 내 미도달 invariant" 단락(향후 도달 시 `else`
    분기=warn+no-op park의 graceful degradation) + `spec/4-nodes/3-ai/1-ai-agent.md`
    §6.2 step 2.c(`render_form` 응답=`form_submitted`).
  - 상세: 신규 가드가 `ai_conversation` 표면에서 `button_click`을 publish 전에 막아버렸다면
    §10.9의 graceful degradation 경로(worker 측 `else` 분기)에 아예 도달하지 못해 그 계약이
    깨졌을 것이다. 코드는 반대로 4종 모두 통과시키고, 별도 회귀 테스트로
    `resolveWaitingSurface`의 판정이 `resumeTurnRegistry`/`parkEntryRegistry`의 실제 selects
    술어와 어긋나지 않음을 고정한다 — publisher가 "worker가 실제로 고를 처리기"를 오예측해
    이종 명령을 조용히 오처리하는 이 PR이 고치는 결함 클래스의 재도입을 그 테스트 자체가
    막는다. Rationale 연속성 관점에서 문제 없음.

- **[INFO]** `hooks.service.ts` chat-channel 표면-불일치 삼킴의 CCH-ERR-04 인접성 — 이미
  추적됨, 등급 상향 불필요
  - target 위치: `codebase/backend/src/modules/hooks/hooks.service.ts`
    `forwardToInteractionService` catch 블록(warn 후 return, 사용자 안내 없음).
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` CCH-ERR-04("silently swallow 금지 —
    backend 로그 발사 후 generic 안내 발송").
  - 상세: CCH-ERR-04는 문언상 "분류 표에 없는 `error.code`의 execution-failed 알림 분류"
    맥락(§4.1 언저리)이라 본 인바운드 명령 라우팅 거부와 정확히 같은 메커니즘은 아니다.
    구현은 backend 로그(warn)는 남기되 채널 사용자에게는 안내를 보내지 않는데, 이는
    developer 스스로 `plan/in-progress/eia-command-waiting-surface-guard.md` F-2로
    "본 PR 범위 밖" 후속(신규 `languageHints` 키)으로 이미 명시 추적하고 있다. 침묵
    누락이 아니라 스코프를 좁힌 의도적 defer이므로 CRITICAL/WARNING으로 올리지 않는다.
  - 제안: F-2가 실제로 project-planner에게 위임돼 `spec/5-system/15-chat-channel.md`
    §4.1 `languageHints` 표에 `surfaceMismatch` 키가 등재될 때까지, 이 코드 주석의
    "§10.9 silent skip 금지" 인용은 정확히는 §10.9의 대상 메커니즘(`waitForAiConversation`
    내부 dispatch)과 다르다는 점만 유의 — 인용 자체를 넓은 "프로젝트 전반 관례"로 쓰는
    것은 허용 가능하나, 신설 Rationale 작성 시 F-2 항목과 함께 정확한 근거로 재인용 권장.

## 요약

핵심 시스템 invariant 두 가지(§10.9 stale `button_click` graceful re-park + AI Agent §6.2
step 2.c `render_form` 응답 보존, 그리고 fail-closed 전환이 인프라-한정 fail-open 선례와
충돌하지 않는지)는 모두 실제 spec 텍스트·기존 선례와 대조 검증한 결과 정합하며 위반이나
기각된 대안의 재도입은 발견되지 않았다 — 오히려 회귀 테스트(`resumeTurnRegistry` selects
parity)가 그 invariant를 명시적으로 고정한다. 다만 이 PR이 도입하는 신규 시스템 결정
(대기 표면 ↔ 명령 매트릭스, fail-closed 판정불가 정책)은 아직 어느 spec 문서의
`## Rationale`에도 기록되지 않았다 — target 문서(`14-external-interaction-api.md`)를
포함해 diff 대상 spec 파일이 전무하다. 이 gap은 담당 plan 문서가 스스로 체크리스트로
추적하고 있어 "무근거 번복"이라기보다 "spec 동기 대기 중" 상태에 가깝지만, 정확히 이
`--impl-done` 게이트가 잡아야 할 시점의 갭이므로 WARNING으로 보고한다.

## 위험도

MEDIUM
