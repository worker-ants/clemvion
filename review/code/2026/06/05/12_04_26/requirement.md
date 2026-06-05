# 요구사항(Requirement) 리뷰 — PR-A2b: information_extractor 멀티턴 checkpoint 재개 확장

## 발견사항

### [INFO] `examples` 필드 — 테스트는 `resumeState.examples` 를 단언하지만 checkpoint allow-list 에서 명시적으로 제외됨
- 위치: `execution-engine.service.spec.ts` L123, `execution-engine.service.ts` L4236
- 상세: 테스트 `buildRetryReentryState re-derives IE config` 에서 `resumeState.examples` 를 `[{ in: 'a', out: 'b' }]` 로 단언한다. 이 필드는 `buildRetryReentryState` 의 `resumeState` (재구성된 in-memory state)에 포함되며, spec §1.3 L113 이 "config 필드는 재개 시 `node.config` 에서 재유도" 한다고 명시한 필드 목록(`outputSchema`/`examples`/`instructions`/`maxCollectionRetries`)에 속한다. 코드(`L4236`)도 `resolvedConfig.examples` 에서 재유도한다. 구현-테스트-spec 모두 일치하므로 문제 없음. 단, `buildResumeCheckpoint` 의 checkpoint allow-list(`L4314~4338`)에는 `examples` 가 포함되지 않는 것이 의도적임을 확인 완료 — spec §1.3 "credential-free runtime 값만 checkpoint" 정책과 부합.
- 제안: 추가 조치 불필요.

### [INFO] [SPEC-DRIFT] consistency-check SUMMARY 가 I1 으로 "spec 선반영 vs plan 분리·후속 불일치" 를 지적했으나 이 PR 에서 이미 해소
- 위치: `plan/in-progress/exec-park-durable-resume.md` A2b 항목 (변경됨), `review/consistency/2026/06/05/11_50_51/cross_spec.md` INFO I1
- 상세: consistency-check (11:50:51) 는 A2b 가 plan 에 "분리, 후속"으로 남아있다는 INFO 를 냈다. 이 PR 의 plan.md diff 에서 A2b 를 "✅ 완료"로 갱신했으므로 INFO I1 은 이 PR 로 해소된다. spec 3곳(`4-execution-engine §1.3` · `3-information-extractor L357` · `1-ai-agent L703~704`) 도 이미 갱신 완료 상태임을 코드/spec 파일에서 확인.
- 제안: 코드 유지 + spec 이미 반영됨. 별도 조치 불필요.

### [INFO] 통합 테스트에서 `mockNodeRepo.findOneBy` 를 `jest.fn()` 으로 새로 대입 — 기존 mock 결과와 격리 가능성
- 위치: `execution-engine.service.spec.ts` L187: `mockNodeRepo.findOneBy = jest.fn().mockResolvedValue({...})`
- 상세: `rehydrateAndResume` 통합 테스트에서 `mockNodeRepo.findOneBy` 를 jest.fn() 으로 교체한다. 일반적인 mock 분리 패턴이지만 `try/finally` 블록에서 원래 mock 을 복구하지 않아 이 테스트 블록 이후 다른 테스트가 교체된 mock 을 공유 받을 가능성이 있다. 현재 테스트는 `describe` 단위 격리·`beforeEach` reset 이 존재하는 구조이므로 실제 오염이 발생하지 않을 가능성이 높으나, `loadAndBuildGraph`/`waitForAiConversation` mock 은 `try/finally` 로 복구하면서 `mockNodeRepo.findOneBy` 는 복구하지 않는 비대칭이 있다.
- 제안: 저위험(테스트 코드). 기능 정확성에 영향 없음. 필요 시 `finally` 에 `mockNodeRepo.findOneBy = origFindOneBy` 추가 고려.

## 요구사항 충족 평가

PR-A2b 의 기능 목표("information_extractor 멀티턴 checkpoint 재개 확장")는 완전히 충족된다. spec §1.3 L111~118 이 요구하는 세 핵심 사항 — (1) checkpoint allow-list 합집합화(`partialResult`/`collectionRetryCount` 추가), (2) `buildRetryReentryState` 에서 IE config 필드를 `resolveRetryNodeConfig` 로 `node.config` 재유도, (3) 가드 3곳(`emitAiWaitingForInput` L5056, `handleAiMessageTurn` L5313, `driveResumeDetached` L1825) 에 `information_extractor` 확장 — 이 모두 구현됐으며 spec 본문과 line-level 로 일치한다. `maxCollectionRetries` 기본값 3은 spec `3-information-extractor.md` L31 과 일치한다. `buildResumeCheckpoint` 는 config 필드를 checkpoint 에서 올바르게 제외하고 credential-free runtime 값만 영속한다. 테스트 5건은 행복 경로(IE runtime state 영속·default·config 재유도)와 통합(RESUME_INCOMPATIBLE_STATE 미발생) 을 커버한다. TODO/FIXME 없음. 에러 경로(schemaVersion 미래 버전 → RESUME_INCOMPATIBLE_STATE)는 기존 PR-A2a 테스트가 이미 커버하므로 중복 없이 정합적이다.

## 위험도

NONE
