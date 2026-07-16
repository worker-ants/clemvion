# Code Review 통합 보고서 (항목 B — 갱신)

## ⚠ router under-selection 정정
초기 router 가 diff 를 "순수 문서/spec" 으로 오판(review/** .md 30여개 + spec 이 압도)해 **code reviewer 전량 skip**, requirement/documentation 만 실행 → 자동 SUMMARY 가 RISK NONE 으로 보고. 그러나 이 diff 에는 실제 코드(항목 B: LLM chat 타임아웃 배선)가 있어 main 이 **code reviewer 4명(side_effect·concurrency·maintainability·testing)을 직접 재실행**했고 아래 실제 findings 를 확보했다.

## 전체 위험도 (재판정)
**MEDIUM (조치 완료 후 해소)** — concurrency 가 CRITICAL 1건(withTimeout leak)을 발견. 이는 diff 밖 pre-existing 코드(`llm.service.ts`)지만 항목 B 가 그 경로를 default-on 으로 처음 상시 활성화하므로 실효 영향이 커 조치 대상. 아래 조치로 해소.

## Critical 발견사항 [조치 완료]
- **[concurrency CRITICAL]** `LlmService.chat` 의 `withTimeout(() => client.chat(sanitized, opts?.signal), ...)` 콜백이 0-arity 라 withTimeout 이 넘기는 내부 timeout signal 을 버림 → 타임아웃 발화 시 `controller.abort()` 해도 provider HTTP 요청 미취소, 백그라운드 leak. 항목 B 가 default 600000ms 로 모든 AI Agent chat 을 이 경로에 상시 노출. **→ FIX**: `withTimeout((timeoutSignal) => client.chat(sanitized, opts?.signal ? AbortSignal.any([opts.signal, timeoutSignal]) : timeoutSignal))` 로 병합 전달(listModels 패턴 정합), Google client `chat(params, signal)` 추가, 회귀 테스트(`llm.service.spec`: 타임아웃 발화 시 signal.aborted).

## 경고 [조치 완료]
- **[side_effect/concurrency W]** default 600000ms behavior change + provider SDK 타임아웃(~120s)과의 관계 → §12.16 에 "실효 상한=더 작은 쪽", Google signal 배선, embed 스코프 밖 명문화.
- **[maintainability/testing W]** tool-loop 재호출(2·4번째 chat) timeoutMs 미검증, timeoutMs=0 전파 미검증, signal 검증 tautological → ai-turn-executor.spec 에 tool-loop 대칭·timeoutMs=0·실제 context.abortSignal 전파 테스트 추가.

## INFO (조치 불요)
resume signal no-op(기지 gap, disclose 됨), 캐스트 eslint-disable 타당, ai_agent 스코프 격리, IE-safe 등 — 검증 완료.

---

## (초기 router-selected 자동 판정 — 참고)
**NONE** — requirement 리뷰어가 CRITICAL/WARNING 없음(spec-code line-level 대조 전량 일치)을 확인. documentation 리뷰어는 output 파일 부재(FS-write flakiness).

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | item B(§12.16, LLM chat 타임아웃)의 Critical 발견·수정 근거가 된 consistency-check 라운드(`10_41_10`)가 이번 diff 에 미포함(untracked) — 내용은 이미 정확히 반영됐으나 감사 추적(audit trail)이 끊김 | `review/consistency/2026/07/16/10_41_10/**` (워크트리 존재, diff 미포함) | 후속 커밋에서 해당 산출물도 함께 커밋해 §12.16 정정 근거를 감사 추적에 남길 것을 권장 (필수 아님) |
| 2 | requirement | review artifact(files 1, 4, 6~11) 상호 참조·claim 을 실제 diff/코드와 전량 직접 대조 — 허위·과장 없음 확인 | `review/consistency/2026/07/16/09_13_49/SUMMARY.md`, `naming_collision.md`, `plan_coherence.md` 등 | 조치 불필요 (검증 완료 기록) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | NONE | 순수 문서 diff(spec 3개 + consistency 산출물 11개). §12.16(LLM chat 타임아웃)·§10(tool payload 예산 경고) spec 서술을 `llm-call-timeout.ts`/`ai-turn-executor.ts`/`tool-payload-save-warning.ts`/`workflows.service.ts`/`ai-turn-orchestrator.service.ts`/`llm.service.ts` 실제 코드와 line-level 대조해 전량 일치 확인. TODO/FIXME 류 미검출 |
| documentation | 재시도 필요 | `status=success` 보고됐으나 `documentation.md` 산출물이 디스크에 생성되지 않음(파일 부재) — 기존에 알려진 reviewer FS-write 비결정적 실패 패턴과 일치. 내용 확인 불가 |

## 발견 없는 에이전트

requirement (Critical/Warning 급 발견 없음, INFO 2건만)

## 권장 조치사항
1. documentation 리뷰어를 재실행(재시도)해 실제 산출물을 확보하고, 그 결과를 이 SUMMARY 에 반영할 것.
2. (선택) `review/consistency/2026/07/16/10_41_10/**` 을 후속 커밋에 포함시켜 §12.16 정정의 감사 추적을 완전하게 할 것.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `requirement`, `documentation` (2명)
  - **제외**: 아래 표 (12명)
  - **강제 포함(router_safety)**: `documentation`, `requirement` — 이유: (documentation) 문서 파일(.md 등) 변경 다수(`review/consistency/2026/07/16/07_31_34/naming_collision.md` 외 9건); (requirement) spec 본문 변경(`spec/4-nodes/3-ai/1-ai-agent.md`, `spec/conventions/cross-node-warning-rules.md`, `spec/conventions/node-cancellation.md`)으로 요구사항 일관성 검증 필요

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | security | 애플리케이션 코드 변경 없음(순수 문서/spec diff) — router 판단 |
  | performance | 상동 |
  | architecture | 상동 |
  | scope | 상동 |
  | side_effect | 상동 |
  | maintainability | 상동 |
  | testing | 상동 |
  | dependency | 상동 |
  | database | 상동 |
  | concurrency | 상동 |
  | api_contract | 상동 |
  | user_guide_sync | 상동 |