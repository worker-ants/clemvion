---
worktree: exec-park-polish-080a4d
started: 2026-06-06
owner: developer
spec_impact:
  - spec/5-system/4-execution-engine.md
  - spec/conventions/execution-context.md
  - spec/4-nodes/3-ai/1-ai-agent.md
  - spec/5-system/14-external-interaction-api.md
  - spec/data-flow/3-execution.md
---

# Plan — exec-park 후속 polish (PR-B2b/B2a 리뷰 deferred A~C)

> PR-B2b(#501)·PR-B2a-followup(#502) 머지 후 비차단 deferred 묶음. SoT: exec-park-durable-resume.md §"잔여 doc polish"/"umbrella 잔여" + exec-park-b2a-followup.md §후속.

## A. PR-B2b doc polish
- **A1** `driveResumeDetached` — JSDoc "void로(detach) 호출" 잔존 정정 + 메서드명 `driveResumeDetached`→`driveResumeAwaited` rename(이제 worker 가 await — 명칭/동작 불일치). def(L1824)+call(L1798, resumeFromCheckpoint)+주석 ~8곳. test 참조 없음(grep). (code+주석)
- **A2** frontmatter `code:` glob — `4-execution-engine.md`·`conventions/execution-context.md` 에 `codebase/backend/src/shared/execution-resume/**` 추가(park-release-signal.ts·resume-call-stack.types.ts spec-impl evidence 연결). (spec frontmatter)
- **A3** `1-ai-agent.md §7 L938` "multi-turn loop 재진입" → turn-park 단발 재진입(`processAiResumeTurn`) 으로 표현 정정(full B3 후 loop 없음). (spec)

## B. PR-B2a follow-up
- **B1** `.env.example` — `INTERACTION_JWT_SECRET`(JWT_SECRET 근처)·`# LLM_STUB_MODE=false`(OAUTH_STUB_MODE 근처) 등재. ENCRYPTION_KEY 는 이미 64-hex(무관). (code/config)
- **B2** `InteractionTokenService` — secret 미설정 시 현재 warn-only + `'interaction-fallback'`. prod fail-closed 명시 가드 추가: `NODE_ENV==='production'` && !envSecret → throw(OAUTH/LLM_STUB 패턴). dev 는 placeholder 유지. 단위테스트. (code)

## C. 아키텍처 (ai-review deferred)
- **C1** `ProcessTurnResult = void | ParkSignal` named type alias 신설 → park-signal 반환 메서드(waitForX 3종·processAiResumeTurn) 시그니처 통일. (code, 저위험)
- **C2** `updateExecutionStatus` "이미 target status면 no-op" 멱등 가드 검토 — process{Form,Button}ResumeTurn·finalizeAiNode 의 RUNNING-skip 중복(DRY) 해소 목적. **위험**: assertTransition 의 동일-상태 throw 가 의도적 invariant(예상치 못한 same-state 전이 = 버그 신호)일 수 있어 전역 no-op 화가 버그 마스킹 가능. → 구현 단계서 안전성 평가: 안전하면 적용, 위험하면 명시 가드 유지 + 결정 기록(DRY 수용).

## 워크플로
- spec 변경(A2/A3) + code(A1/B1/B2/C1/C2) → consistency-check --impl-prep 의무.
- TDD: B2 가드·C1·C2 단위테스트. TEST(lint/build/unit/e2e) → /ai-review → --impl-done.

## 진행 메모
- 2026-06-06 착수. origin/main `a6acf872`(#501+#502 머지) fresh worktree. exec-park-b2a-followup·merged stale 4건 worktree 정리 완료.
- **2026-06-06 구현 완료**:
  - A1 `driveResumeDetached`→`driveResumeAwaited` rename(service+spec 22+2곳) + JSDoc awaited 모델 재작성.
  - A2 frontmatter `code:` 에 `shared/execution-resume/**` 추가(4-execution-engine·execution-context, 후자는 resume-call-stack.types.ts).
  - A3 `1-ai-agent §7` "multi-turn loop 재진입"→"단발 재진입(processAiResumeTurn, full B3)".
  - B1 `.env.example` INTERACTION_JWT_SECRET·LLM_STUB_MODE 등재.
  - B2 `InteractionTokenService` prod fail-closed 가드(NODE_ENV=production && secret 전무→throw) + 단위테스트 2(prod throw / dev no-throw).
  - C1 `ProcessTurnResult = void | ParkSignal` alias 신설 + waitForX 3종·processAiResumeTurn·executeInline 지역변수 적용.
  - **C2 결정 = 미적용(명시 가드 유지)**: `updateExecutionStatus` 전역 멱등 no-op 화는 `assertTransition` 의 동일-상태 throw(예상 못한 same-state 전이=버그 신호 invariant)를 마스킹할 위험 → process{Form,Button}ResumeTurn·finalizeAiNode 의 명시 RUNNING-skip 가드 유지가 더 안전. DRY 비용은 주석으로 흡수(저위험). ai-review W12 disposition.
  - 게이트: `--impl-prep` BLOCK:NO(`17_58_19`, W-1=D6 레이블 namespace=본 변경 무관 pre-existing). build·lint clean, execution-engine unit 322·interaction-token 34 pass. e2e 진행.
  - 비차단 후속(out-of-scope): D6 레이블 namespace 분리(--impl-prep W-1), exec-park-durable-resume.md plan→complete 이동.
