# Resolution — M-7 스키마 enrich 클러스터 ai-review

리뷰 세션: `review/code/2026/07/02/15_09_45` (diff-base origin/main, 커밋 `875c81782`)
전체 위험도: **LOW** (Critical 0 / Warning 2 / INFO 다수). Warning 2건 모두 testing.

## 처리 요약

| # | Severity | Reviewer | 발견 | 조치 |
|---|----------|----------|------|------|
| W-1 | WARNING | testing | `endMultiTurnConversation` 회귀 가드가 캐스트 제거 대상 `messages`/`turnDebugHistory`/`allPresentations` 를 non-default 값으로 미검증(`?? []` fallback 경로만) | **FIX** — `ai-turn-executor.spec.ts` `endMultiTurnConversation` 에 회귀 테스트 추가: non-default turnDebugHistory·allPresentations·messages 세팅 후 `output.result.messages`(2건)·`output.result.presentations`·`meta.turnDebug` 로 전달됨을 단언. |
| W-2 | WARNING | testing | `processMultiTurnMessage` 재개 시 `turnDebugHistory`(prepend+append)·`allPresentations`(보존) 누적 로직 미커버(resumeState() 헬퍼가 해당 키 미채움) | **FIX** — `processMultiTurnMessage (resume loop)` 에 회귀 테스트 추가: 사전 turnDebugHistory(1건)·allPresentations(1건) 세팅 후 turn 처리 → 다음 `_resumeState.turnDebugHistory` 길이 2(누적)·`allPresentations` 이전 항목 보존 단언. |

## INFO (조치 판단 — 전부 비차단)

- **security×3 / architecture×3 / side_effect×2 / documentation×3** — z.custom no-op validator(기존 z.unknown 동일 강도)·credential allow-list 불변·boundary 캐스트 위치 이동·type-only import·문서화 우수. **조치 불필요.**
- **maintainability×2** — `state`/`resumeState` 공존 혼용 주의·스키마 주석 3중 반복. **경미(선택).**
- **INFO(architecture)** — `narrowResumeState()` 헬퍼로 `const resumeState = state as ResumeState` 3곳 단일화 가능. **선택(강제 아님).**
- **INFO(2440 legacy `as ChatMessage[]`)** — messages spread 의 undefined-assert 라 enrich 로 자동 제거 불가. **후속 defer.**
- **INFO(testing/documentation)** — z.custom 무검증 계약 고정 테스트·스타일(원소단위 vs 배열단위) 주석. **선택.**
- **INFO(requirement×2, rationale_continuity, convention_compliance/impl-done)** — 스키마 문서화 뉘앙스·의도적 범위 disclosure·spec Rationale 명문화 제안. **비차단/planner.**
- **INFO(plan_coherence/impl-done, WARNING-tracking)** — plan §M-7 미갱신. → **본 PR 에서 plan §M-7 갱신으로 반영.**

## rationale_continuity 특별 검증 (impl-done)

`z.custom()` predicate 미제공 시 identity validator(zod v4 소스 `fn ?? (() => true)`)로 **모든 값 통과** — 실 rehydration 경로(retry-turn/orchestrator/engine)에 `.parse`/`.safeParse` 호출 0건(grep 확인). #783 §7.5 "런타임 미검증" graceful-reset 결정 **불변·미번복** 확인. → BLOCK: NO.

## 검증

- W-1/W-2 fix 후: `ai-turn-executor.spec.ts` **25 tests PASS**(신규 2건 포함). fix 는 test-only(behavior-preserving) — 프로덕션 코드 무변경.

## Reviewer 파일 상태
code 9종·consistency 5종 전부 디스크 기록 완료(1차 workflow write 유실분은 main 이 동일 prompt 로 재실행). impl-done `review/consistency/2026/07/02/15_09_45` **BLOCK: NO**.
