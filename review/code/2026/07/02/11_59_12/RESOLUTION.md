# Resolution — M-7 RESUME-STATE 클러스터 ai-review

리뷰 세션: `review/code/2026/07/02/11_59_12`
대상 커밋(리뷰 시점): `ab25beaf5`
전체 위험도: **NONE→LOW** (Critical 0 / Warning 1 / INFO 다수)

## 처리 요약

| # | Severity | Reviewer | 발견 | 조치 |
|---|----------|----------|------|------|
| W-1 | WARNING | testing | `execution-engine.service.spec.ts` 의 builder↔schema drift 가드가 non-strict `resumeCheckpointSchema.safeParse(checkpoint)` 를 사용 — Zod 기본 object 스키마는 알 수 없는 키를 조용히 strip 후 `success:true` 반환하므로 credential 유입을 검출하지 못함. 실제 방어는 다음 줄 `not.toHaveProperty` 뿐이고 safeParse 어서션은 항상-참. | **FIX** — 두 사이트(ai_agent turn·IE 후속 turn) 모두 `resumeCheckpointSchema.strict().safeParse(checkpoint)` 로 변경. 이제 실 산출물에 credential/알 수 없는 키가 섞이면 strict 파싱이 실패해 drift 를 실제 검출한다. 주석도 non-strict 미사용 근거 명시. `.strict()` 가 실 `buildResumeCheckpoint` 산출물에 대해 통과함을 실행 확인(335 tests PASS). |

## INFO (조치 판단)

- **INFO(testing/security/requirement/maintainability)** — `resumeStateSchema`/`retryStateSchema` 의 `.catchall(z.unknown())` 은 §7.5 graceful-reset semantics 보존을 위한 의도된 설계(런타임 parse 미수행), JSDoc 명시. **조치 불필요.**
- **INFO(requirement/scope)** — plan §M-7 진행 서술이 실제 diff 범위(orchestrator·retry-turn·adapter 포함)보다 좁음. → **본 클러스터 PR 의 plan §M-7 갱신으로 반영** (아래 후속).
- **INFO(maintainability)** — relay 시그니처(`processAiResumeTurn`/`handleAiMessageTurn` 등)가 여전히 `Record<string,unknown>`. → 후속 클러스터(ai-turn-executor·orchestrator relay)에서 통일. **본 클러스터 범위 밖, defer.**
- **INFO(maintainability)** — `credentialStripSubsetShape` 15필드가 스키마·빌더 두 곳에 분리. drift-guard 테스트(위 W-1 fix 로 강화)로 완화됨. **조치 불필요.**
- **security/side_effect** — `import type` 전용(런타임 footprint 0), `isRecord` 치환 동치, behavior-preserving 확인. **조치 불필요.**

## 검증

- W-1 fix 후: `execution-engine.service.spec.ts` + `resume-state.schema.spec.ts` **335 tests PASS** (strict drift 가드가 실 checkpoint 에 대해 통과).
- fix 는 test-only(behavior-preserving) — 프로덕션 코드 무변경.

## Reviewer 파일 상태

`security`/`requirement`/`maintainability` 는 1차 workflow 에서 디스크 기록됨. `scope`/`side_effect`/`testing` 은 1차 summary 시점에 output_file 미생성(reviewer success 보고와 불일치) → main 이 동일 prompt_file 로 3개 재실행해 디스크 기록 완료. 전 reviewer(6) 커버리지 확보.
