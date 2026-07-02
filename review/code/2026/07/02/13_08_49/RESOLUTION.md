# Resolution — M-7 ai-turn-executor 클러스터 ai-review

리뷰 세션: `review/code/2026/07/02/13_08_49` (diff-base origin/main, 커밋 `d089c211b`)
전체 위험도: **NONE** (Critical 0 / Warning 2 / INFO 다수). Warning 2건 모두 testing reviewer.

## 처리 요약

| # | Severity | Reviewer | 발견 | 조치 |
|---|----------|----------|------|------|
| W-1 | WARNING | testing | `buildRetryState` 가 `as` 단언을 제거한 `mcpServers`/`knowledgeBases`/`pendingFormToolCall`/`totalThinkingTokens` 필드가 `_retryState` 출력 검증 테스트에서 non-default 값으로 커버되지 않음 | **FIX** — `ai-turn-executor.spec.ts` `endMultiTurnConversation` describe 에 회귀 테스트 추가("carries resume-state allow-list fields into _retryState"): 네 필드에 non-default 값 세팅 후 retryable 종결 → `result._retryState` 가 그대로 운반하는지 단언. cast 제거가 field passthrough 를 깨지 않음을 고정. |
| W-2 | WARNING | testing | production 코드만 변경되고 `ai-turn-executor.spec.ts` 미갱신 — to-record↔ResumeState cast 연결고리 검증 부재 | **FIX** — 위 W-1 fix 가 `ai-turn-executor.spec.ts` 에 ResumeState cast 경로(buildRetryState via endMultiTurnConversation)를 직접 exercise 하는 테스트를 추가해 해소. (to-record 자체는 to-record.spec.ts 9/9 로 커버.) |

## INFO (조치 판단 — 전부 비차단)

- **INFO(security)** — `isRecord`/`toRecord` 가 class 인스턴스·`Object.create(null)` 허용(plain-object 아님): 문서화된 trade-off, 본 PR JSDoc caveat 로 명시. spread/merge·미신뢰 JSON 신규 호출부 생기면 plain-object 가드 별도 도입. **조치 불필요.**
- **INFO(security/side_effect/architecture)** — `ResumeState`/`RetryState` `.catchall` open + 런타임 미검증: 의도된 설계(#783 §7.5 graceful-reset 보존), JSDoc 명시. **조치 불필요.**
- **INFO(architecture/maintainability)** — 같은 파일 다른 state 소비 메서드는 여전히 Record(과도기적): plan §M-7 후속 클러스터. **defer.**
- **INFO(maintainability)** — 지역변수 `s` 축약·`model`/`rawConfig`/`ragLastDiagnostics` 잔여 `as`(스키마상 unknown): 인라인 주석 근거 명시. 스코프 짧음. **비차단(선택 폴리시).**
- **INFO(scope)** — to-record JSDoc/테스트는 #782 ai-review INFO 후속(커밋 메시지 출처 명시). **비차단.**
- **INFO(requirement)** — public interface `as ResumeState` 미검증·`pendingFormToolCall` loose passthrough: pre-existing, 본 diff 불변. **defer.**
- **INFO(convention_compliance, impl-done)** — 신규 util 을 spec `code:` frontmatter 에 추가하면 추적성 향상: planner-owned spec 변경, M-7 코드와 직교. **planner/별건 defer.**

## 검증

- W-1/W-2 fix 후: `ai-turn-executor.spec.ts` **23 tests PASS**(신규 회귀 테스트 포함). fix 는 test-only(behavior-preserving) — 프로덕션 코드 무변경.

## Reviewer 파일 상태

code review 8종·consistency 5종 전부 디스크 기록 완료(1차 workflow write 유실분은 main 이 동일 prompt 로 재실행). impl-done `review/consistency/2026/07/02/13_09_40` **BLOCK: NO**.
