# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** `create()`/`update()` 의 두 주석이 `setupChatChannel` 의 실제 쓰기 경로를 더 이상 정확히 서술하지 않는다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:512-514`(`create()`), `:706-708`(`update()`)
  - 상세: 두 주석 모두 `// setupChatChannel 은 별도 triggerRepository.update 로 ... 갱신` 이라고 적는다. 이번 PR 로 `ChatChannelBinderService.setupChatChannel()` 성공·실패 경로의 쓰기는 `this.triggerRepository.update(...)` 직접 호출이 아니라 `rewriteTriggerConfigLocked()`(`manager.transaction` + advisory lock + 락 안 재읽기 + `m.update(Trigger, ...)`)로 완전히 바뀌었다(`chat-channel-binder.service.ts` diff 참조). 재조회가 필요하다는 결론(`saved` in-memory 가 stale) 자체는 여전히 참이라 동작 결함은 아니지만, "별도 `triggerRepository.update`" 라는 메커니즘 서술은 지금 코드와 다르다 — 다음 사람이 이 주석만 보고 락/트랜잭션 유무를 오판할 수 있다.
  - 이미 추적됨: 이 정확한 결함이 `plan/in-progress/trigger-config-lost-update.md` §D "9라운드 리뷰 처분" 표의 INFO#7 (`create()` 안 두 주석이 실제 쓰기 경로를 더 이상 정확히 서술하지 않는다 — 결론은 참이라 낮은 우선순위)로 이미 등재·의도적으로 낮은 우선순위 처리돼 있다. 새 발견이 아니라 **아직 코드에 남아 있다는 사실의 재확인**이다.
  - 제안: `별도 triggerRepository.update` → `rewriteTriggerConfigLocked (advisory lock 안 재읽기·머지)` 로 문구만 갱신. plan 이 이미 "결론은 참"이라고 판정했으므로 이 배치를 막을 사유는 아니다.

## 그 외 확인한 항목 (지적 없음)

- **신규 공개 함수/모듈 JSDoc**: `trigger-config-lock.ts`(`triggerConfigLockKey`, `acquireTriggerConfigLock`, `TRIGGER_DELETE_LOCK_TIMEOUT_MS`, `rewriteTriggerConfigLocked`), `chat-channel-input-rules.ts`(`extractInboundSigningRef`), `hooks.service.ts`(`touchLastTriggeredAt`), `triggers.service.ts`(`assertTriggerFound`, `mergeIntoFreshSubKey`, `throwTriggerNotFound`, `findByIdForUpdate`) 전부 "왜 필요한가 · 무엇을 반환하는가 · 어떤 사고를 막는가"를 갖춘 JSDoc 이 있다. 특히 `rewriteTriggerConfigLocked` 는 창(window) 배선표·부재 처리 정책표·기각된 대안(Cafe24 advisory lock) 대조까지 포함해 이 규모의 동시성 유틸리티치고 이례적으로 상세하다.
- **인라인 주석**: 각 호출부(`chat-channel-binder.service.ts` 의 `survivesWithFresh`/`buildChannel`, `triggers.service.ts` 의 창 1 트랜잭션 블록, `remove()` 의 락+상한)마다 "왜 이 형태인가"와 리뷰 라운드 근거(`/ai-review review/code/...`)가 함께 달려 있어 인라인 밀도가 높다.
- **CHANGELOG**: 신규 항목(`CHANGELOG.md:3-52`)이 배경·설계 근거(기각된 Cafe24 advisory lock 선례)·대기 상한 유무·삭제 5초 예외·정적 래칫의 보증 범위를 모두 정확히 반영한다. 인용된 review round 디렉터리(`review/code/2026/09/14/19_07_43` 등)와 consistency 디렉터리(`review/consistency/2026/09/14/17_10_16`)를 실제로 존재하는지 확인했고 전부 존재한다.
- **plan 문서**: `plan/in-progress/trigger-config-lost-update.md` 가 10라운드에 걸친 실측·반증·처분을 빠짐없이 추적하고 있고, 취소선(`~~...~~`)으로 반증된 문장을 원문 보존한 채 정정한 사례(§D "유예의 근거가 틀렸다")가 이 저장소 컨벤션(자기-반증형 소정정)과 일치한다. 체크리스트 미완료 항목(트래커 갱신·`run-test-all.sh`·`/ai-review`)은 in-progress 상태에 맞게 미체크로 남아 있어 "체크박스 = 실제 상태" 규약과 일치한다.
- **테스트 문서화**: `trigger-config-lost-update.e2e-spec.ts`, `trigger-config-lock.spec.ts`, `trigger-transaction-mock.ts`, `hooks.service.spec.ts`/`schedules.service.spec.ts`/`endpoint-path-conflict-wrap.spec.ts`의 신규 테스트 전부가 "무엇을 판별하는가"·"왜 이 값/provider 를 골랐는가"·"공허성 가드"를 설명하는 JSDoc/주석을 달고 있다. 헬퍼(`withTransactionMock`)는 이관 배경(6개 파일 중 2개만 이관, 나머지 4개는 그 경로를 아직 안 탄다)까지 명시해 다음 사람이 헷갈리지 않게 해 둔다.
- **README/설정 문서**: 이번 변경은 새 환경변수·설정 옵션·외부 API 계약을 추가하지 않는 서비스 내부 동시성 수정이라 README 갱신 필요성 없음(다른 라운드의 `api_contract.md` NONE 판정과 일치).
- **정적 가드 주석**(`endpoint-path-conflict-wrap-guard.ts`, `endpoint-path-conflict-wrap.spec.ts`): 가드가 "왜 눈이 멀었었는지"(수신자 이름 vs 엔티티 인자, 문장 경계 vs 콜백 경계)와 "왜 지금 이렇게 넓혔는지"를 각각 설명하며, 빈 배열(`EXPECTED_UNWRAPPED_TRIGGER_SAVES: []`)이 "더 강한 상태"라는 이유까지 문서화돼 있다.

## 요약

이번 변경은 문서화 관점에서 이례적으로 높은 수준이다 — 새 공개 함수마다 목적·계약·부재 처리 정책·기각된 대안과의 대조가 JSDoc 으로 기록되고, CHANGELOG·plan 문서·인라인 주석이 모두 서로 참조하며 정합한다. 유일하게 남은 문제는 `triggers.service.ts` 의 두 주석(`create()`/`update()`)이 `setupChatChannel` 쓰기 메커니즘을 여전히 "별도 `triggerRepository.update`"로 서술해 실제 구현(`rewriteTriggerConfigLocked` 의 advisory lock + 재읽기)과 어긋난다는 점인데, 이는 이미 plan 문서 자체가 9라운드에서 발견해 "결론은 참이라 낮은 우선순위"로 의도적으로 defer 한 항목이다. 신규 README/설정/API 문서 갱신 필요성은 없다(외부 계약 변경 없음).

## 위험도

LOW
