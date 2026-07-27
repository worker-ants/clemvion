# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** CHANGELOG 항목이 CRITICAL #1 수정으로 추가된 4번째(그리고 코드 주석상 "정상 multi-turn 대화 종료의 주 경로") 소비처를 누락해, 이 데이터 정합성 결함의 실제 영향 범위를 과소 서술한다.
  - 위치: `CHANGELOG.md:9` ("3. **짝 전이 `false` 반환 계약을 AI 경로 3곳(re-park·첫 turn park·retry-last-turn RUNNING 재claim) 전부 소비**")
  - 상세: 이 CHANGELOG 절은 커밋 `acbdbb81e`(2026-07-26 20:56, review 세션 `20_10_51`의 SUMMARY#5 조치)에서 작성됐고, 그 시점엔 짝 전이 가드 소비처가 실제로 3곳(re-park·첫 turn park·retry-last-turn RUNNING 재claim)이었다. 그런데 이어진 review 세션 `21_08_01`의 CRITICAL #1 수정(커밋 `157bfb887`, 22:07)이 **네 번째** 소비처(`finalizeAiNode` 의 "이미 RUNNING" 분기)를 추가했다. 이 분기는 `assertLinkedTransitionApplied` 헬퍼 자신의 JSDoc(`ai-turn-orchestrator.service.ts`)이 "네 소비처"라고 명시하고, 커밋 메시지 자체가 "turn-park 재개는 진입 시 이미 RUNNING 이라 이 분기가 **대화 종료의 주 경로**였다"고 밝힐 만큼 — 엣지케이스가 아니라 정상 멀티턴 대화가 자연 종료될 때 매번 타는 주경로다. `git log -- CHANGELOG.md`, `grep CHANGELOG review/code/2026/07/26/21_08_01/RESOLUTION.md` 로 확인한 결과 CRITICAL #1 수정 이후 CHANGELOG 는 다시 갱신되지 않았다 — 코드 쪽 JSDoc(`assertLinkedTransitionApplied`, `engine-driver.interface.ts`)은 정확히 갱신됐는데 CHANGELOG 만 stale 상태로 남았다. 이 CHANGELOG 를 근거로 릴리스 노트나 사후 감사를 하는 독자는 "re-park 류 엣지케이스만 고쳤다"로 오독해 이 결함의 실제 심각도(정상 대화 종료 경로에서 취소가 사후에 뒤집혀 `NODE_COMPLETED`/`EXECUTION_RESUMED` 가 오발행됨)를 과소평가할 수 있다.
  - 제안: CHANGELOG 의 3번 항목(또는 별도 항목)에 `finalizeAiNode` 의 "이미 RUNNING"(정상 대화 종료) 분기가 CRITICAL 로 별도 수정됐다는 사실과, 이 경로가 "3곳" 이 아니라 "네 소비처" 임을 반영해 정정한다.

- **[INFO]** `spec/5-system/4-execution-engine.md` §Rationale (C-1) 의 `EngineDriver` 멤버 수 서술이 코드와 어긋나 있다 — 단, 이 diff 자체가 그 사실을 자각하고 위임 처리 중이라 별도 조치가 필요한 새 발견은 아니다.
  - 위치: `spec/5-system/4-execution-engine.md` (`### C-1 god-class strangler-fig 분할` 절, "**12 distinct**"·"7멤버"·"8멤버" 서술) vs `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts` 모듈 최상단 JSDoc (2026-07-26 실측 "distinct **14**"·"`AiTurnEngineDriver` 합계 **9**")
  - 상세: 직접 `engine-driver.interface.ts` 를 세어 확인 — `CoreEngineDriver`(updateExecutionStatus, contextKeyOf=2) + `InteractionEngineDriver` 추가(stageDurableResumeSnapshot=1) + `ReentryStateDriver`(buildRetryReentryState=1) + `AiTurnEngineDriver` 자체 5(assertExecutionNotCancelled/buildResumeCheckpoint/isCheckpointEligibleNodeType/applyPortSelection/markNodeCancelled) + `RetryEngineDriver` 자체 5 = **14**, `AiTurnEngineDriver` 합계 = 2+1+1+5 = **9**. 코드 쪽 새 JSDoc 수치는 정확하다. spec 쪽 "12 distinct"/"7멤버"/"8멤버" 는 이번 PR 로 stale 해졌지만, 코드 JSDoc 이 이 사실을 명시적으로 지적하며 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` #7 보강 8번 항목으로 이미 위임해 뒀다(코드/스펙 정정을 같은 턴에 처리하도록 명시). 즉 "코드-스펙 갈라짐"은 실재하지만 은폐가 아니라 투명하게 추적되는 중간 상태.
  - 제안: 별도 조치 불요 — 향후 spec 팀 턴에서 위 위임 항목이 실제로 반영되는지만 확인.

- **[INFO]** 신규 e2e/JSDoc 참조(`{@link DELAY_MARKER}`, `stub.client.ts`)는 export 되지 않은 module-private `const` 를 가리킨다.
  - 위치: `codebase/backend/src/modules/llm/clients/stub.client.ts` 클래스 상단 JSDoc ("user 메시지에 {@link DELAY_MARKER} 접두사")
  - 상세: `DELAY_MARKER` 는 `export` 되지 않은 모듈 스코프 상수라 TypeDoc 등 문서 생성기가 링크를 해석 못할 수 있다. 다만 이 코드베이스는 이미 private 멤버를 가리키는 `{@link assertLinkedTransitionApplied}` 같은 패턴을 다른 곳에서도 쓰고 있어(코드 내부 개발자를 위한 참조 표기 관행), 실질적 문제라기보다 스타일 일관성 수준의 지적.
  - 제안: 조치 불요(선택 사항).

## 요약

이번 PR 은 JSDoc·인라인 주석·plan/RESOLUTION 문서화 관행이 전반적으로 상당히 엄격하다 — 새 인터페이스 멤버(`assertExecutionNotCancelled`, `markNodeCancelled`)와 `updateExecutionStatus` 의 반환 계약 변경(`@returns` 갱신), 헬퍼(`assertLinkedTransitionApplied`) 도입 배경, 명명 제약 준수 근거까지 코드 JSDoc 에 촘촘히 기록돼 있고, spec 위임이 필요한 부분(§2.1/§2.3/§1.1/멤버 수)도 developer 권한 밖임을 인지해 `spec-update-*` plan 으로 투명하게 위임했다. 다만 CHANGELOG 는 두 차례 review 세션(20_10_51 → 21_08_01) 중 첫 세션 이후로 갱신되지 않아, 두 번째 세션의 CRITICAL #1 수정(정상 대화 종료 주경로의 취소 가드 누락)이 CHANGELOG 상에는 반영되지 않은 채 "AI 경로 3곳" 으로만 남아 있다 — 코드 JSDoc 은 "네 소비처"로 정확히 갱신됐는데 CHANGELOG 만 뒤처진 비대칭이다. README·API 문서·신규 env 변수 문서화는 이번 변경 범위(엔진 내부 취소 가드 + 테스트 전용 e2e 지연 마커)상 해당 사항이 없다.

## 위험도

MEDIUM
