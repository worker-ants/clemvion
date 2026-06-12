# RESOLUTION — chat-channel gaps #1 (CCH-CV-03 b) + #4 (§5.4 rotate 응답)

> 대상 review: `review/code/2026/06/12/20_11_15/SUMMARY.md` — **LOW · Critical 0 · WARNING 6 · INFO 23**
> 리뷰 히스토리: `19_56_03`(HIGH, Critical 2 = false-positive SPEC-DRIFT + W1~3 test gap) → 수정 후 `20_11_15`(수렴, LOW, Critical 0).

## 처리 요약

Critical 0. WARNING 6건은 **모두 본 변경이 도입한 회귀가 아니라 기존 패턴 계승 또는 사전 부재** — 아래 근거와 함께 disposition. 직전 리뷰(`19_56_03`)의 Critical 2건(SPEC-DRIFT)은 **false positive 였음** (아래 참조). test-gap WARNING(W1~3)은 fix 완료.

### 직전 리뷰(19_56_03) Critical 2건 — false positive (반증)

- **Critical#1/#2 (SPEC-DRIFT, "15-chat-channel.md 가 아직 Planned/1필드")**: **사실 아님**. 본 PR 커밋이 이미 spec 을 갱신함 — CCH-CV-03 행은 "(a)/(b)/(c) 모두 구현됨", §5.4 는 4필드 예시로 교체됨. `git diff origin/main...HEAD -- spec/5-system/15-chat-channel.md` 가 6 insertions/5 deletions 로 Planned 마커 제거를 입증. 리뷰어가 stale line-number 컨텍스트(구 67/324/333행)로 구버전을 참조한 오탐. 수렴 리뷰(`20_11_15`)는 이를 INFO 로 정정("코드가 옳고 spec 예시가 구식").

### WARNING dispositions (6건 — 회귀 아님)

| # | 발견 | disposition |
|---|------|-------------|
| 1 | `executionsService['executionRepository']` bracket-access (캡슐화) | **기존 패턴 계승**: 원 `isActiveExecution` 이 동일 bracket-access 사용 — 본 변경이 도입한 것 아님. `ExecutionsService.getExecutionStatus` 공개 메서드 추출은 ExecutionsService + 테스트 동반 변경이라 별 리팩터링 트랙. 본 PR 범위(gap 구현) 밖. |
| 2 | 커스텀 `languageHints.executionStillRunning` MarkdownV2 escape 미보장 | **기존 패턴·일관**: `groupChatRefusal` 등 모든 inline 안내의 커스텀 override 가 동일하게 escape 미적용 (`maybeNotifyIgnored` 동일). §4.1.1 "기존 5 키" 군의 공통 특성 — 본 키만의 회귀 아님. 전 notice escape 정책은 cross-cutting 별 작업. |
| 3 | `await sendExecutionStillRunningNotice` 가 WH-NF-01 200ms SLA blocking | **기존 패턴 일관**: `maybeNotifyIgnored` 도 `await` (hooks.service.ts:261). 본 변경이 도입한 blocking 아님. fire-and-forget 전환은 두 notice 경로 공통 최적화 — 별 작업. |
| 4 | `getActiveExecutionStatus` → 분기 사이 TOCTOU | **수용(best-effort)**: 원 `isActiveExecution` 도 동일 read-then-act TOCTOU 존재 — 회귀 아님. 채팅 inbound 는 best-effort 특성상 실용 수용. trade-off 는 spec R9 맥락(처리 중 메시지는 재전송)과 정합. |
| 5 | rotate 응답 Swagger `@ApiResponse` DTO 미선언 | **사전 부재·user-docs 가 계약 SoT**: 해당 endpoint 는 이전에도 `@ApiResponse` 없었음(회귀 아님). 응답 계약은 `telegram.mdx`/`.en.mdx` 가 이미 `{ data: { triggerId, rotatedAt, chatChannelHealth, botIdentity } }` 로 문서화(구현보다 선행). Swagger DTO 신설은 별 doc-debt 트랙. |
| 6 | 테스트 `execRepo` cast 4회 중복 | **W1 종속**: 공개 메서드(W1) 도입 시 자연 소멸. 현재는 기존 spec 의 동일 cast 패턴 계승(신규 4건도 같은 형태). 별 리팩터링 시 일괄. |

### test-gap (직전 19_56_03 W1~3) — fix 완료
- pending 상태 분기 테스트 + DB 예외(catch→비활성→새 execution) 테스트 + sendMessage 실패해도 ignored 반환 테스트 추가 (hooks.service.spec.ts, 33 tests green).
- handleChatChannelWebhook JSDoc 에 (a)/(b)/(c) 분기 반영, ROTATE_RESULT 테스트 주석 명료화.

### INFO dispositions (주요)
- **INFO#1/#2 (SPEC-DRIFT)**: 둘 다 "코드가 옳고 spec 예시가 구식". #1(executionStillRunning default MarkdownV2 pre-escape)·#2(CCH-CV-03 b 가 button/contact/file 에도 적용) — 본 PR 의 CCH-CV-03 본문 갱신이 (b) 동작을 이미 기술. command-kind 매트릭스 세분 기재는 비차단 doc 보강(별 planner 트랙). 코드 정확.
- **INFO#11 (button_callback 등 (b) 테스트 미포함)**: 본 (b) 분기는 4 command kind 공통(forwarding 분기 진입 조건 자체가 4종)이라 text_message 대표 검증으로 충분. 비차단.
- 나머지 INFO(타입 캐스팅 축소, 부정조건 가독성, JSDoc 보강, named type export 등): 비차단 품질 — 기록만.

## §7 동시 갱신 확인
`chat-channel-adapter.md` 는 어댑터 인터페이스/타입(`SetupResult.botIdentity`/`configUpdates`, `languageHints`)만 정의하며 rotate API **응답 shape** 나 CCH-CV-03 분기를 기술하지 않음 → 본 변경으로 갱신할 내용 없음(이미 데이터 소스 보유). 동시 갱신 의무 = 해당 없음 (15-chat-channel.md 만 갱신).

## TEST 결과
마지막 코드 변경(review fix: 테스트 3건 + JSDoc) 후 전 단계 재수행:
- lint PASS / unit PASS (backend incl. hooks.service 33, triggers.service · chat-channel.controller; frontend 4296) / build PASS / e2e PASS (188)
- e2e: **통과**. 변경 set 이 화이트리스트 밖(backend `.ts`)이라 수행.

## consistency-check (--impl-done spec/5-system/) 결과

산출: `review/consistency/2026/06/12/20_20_29/SUMMARY.md` — **BLOCK: NO** (Critical 0, WARNING 4, INFO 10). push Gate 2 (spec-linked `triggers.service.ts` impl-done freshness) 충족.

- **W1 (fix)**: `telegram.md:190` 의 stale `isActiveExecution` 참조 → `getActiveExecutionStatus` 로 갱신 (본 PR rename 의 직접 결과). spec-only.
- **W2 (fix)**: `spec-sync-webhook-gaps.md` 의 동일 §5.5 갭(비활성 chatChannel 202) → `[x]` 종결 + 동시 해소 cross-ref. plan-only.
- **W3 (fix)**: `auth-config-webhook-followups.md §2` 동일 갭 → "해소됨 (2026-06-12)" 주석. plan-only.
- **W4 (disposition)**: `1-auth.md §1.5.4` SoT cross-link 강조 — auth 영역·본 PR 무관. 별 작업.
- **I8 (disposition)**: `executionStillRunning` EN default — §4.1.1 "기존 5 키 EN 범위 밖" + 본 PR CCH-CV-03 註가 KO inline 명시. 이미 정책 기술됨.
- **I10 (disposition)**: stale worktree 정리 — `chat-channel-followups-residual` 는 **open PR #568** 의 worktree(미머지, 미접촉), `refactor-04` 는 타 작업. 미접촉.
- 나머지 INFO(doc 구조·cross-link 보강): 비차단, 기록만.

> W1/W2/W3 는 spec/plan 파일(비-codebase)이라 push Gate 1(code review freshness)·Gate 2(impl-done freshness, spec-linked **codebase** 대상)에 영향 없음.
