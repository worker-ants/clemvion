# 문서화(Documentation) 리뷰 — trigger-config-lost-update

## 검토 범위

`trigger.config` lost-update(동시 PATCH 가 `inboundSigningRef` 를 지워 인입 서명 검증을
fail-open 시키는 결함) 수정 배치. 13라운드째 리뷰가 도는 PR 이라 `CHANGELOG.md`,
`trigger-config-lock.ts`(신규), `chat-channel-binder.service.ts`, `triggers.service.ts`,
`schedules.service.ts`, 관련 테스트·가드 파일, `plan/in-progress/trigger-config-lost-update.md`
를 프롬프트 diff 와 `Read`/`grep` 직접 조회로 함께 확인했다.

## 발견사항

- **[WARNING]** CHANGELOG 의 "삭제 락 타임아웃" 문단이 같은 항목 안의 "락 자체" 문단보다 좁다 — 스케줄 cascade 삭제도 5초 상한을 쓰는데 문서는 `DELETE /api/triggers/:id` 만 지목한다
  - 위치: `CHANGELOG.md:48` (`**삭제(\`DELETE /api/triggers/:id\`)만 5초 상한을 둔다.**`)
  - 상세: 같은 changelog 항목의 `CHANGELOG.md:25`(`**삭제 경로 둘 다** 같은 락을 잡는다 — \`DELETE /api/triggers/:id\` 와 스케줄 삭제의 cascade.`)는 이번 최신 커밋(`2a87eb2f0`)에서 "락 획득"이 두 경로 모두에 적용된다고 정정됐다. 그런데 23줄 아래의 **타임아웃** 문단은 그 정정을 따라가지 못하고 여전히 `DELETE /api/triggers/:id` 하나만 5초 상한 대상으로 지목한다. 실제 코드(`codebase/backend/src/modules/schedules/schedules.service.ts` — `acquireTriggerConfigLock(m, triggerId, { timeoutMs: TRIGGER_DELETE_LOCK_TIMEOUT_MS })`)는 스케줄 cascade 삭제에도 정확히 같은 `TRIGGER_DELETE_LOCK_TIMEOUT_MS` 상수를 넘겨 5초 상한을 건다 — 즉 코드는 두 경로 모두에 상한을 두는데, CHANGELOG 는 그중 하나만 문서화한다. 이 PR 자신이 반복해서 지적한 "인접한 두 문장 중 하나만 고치면 다른 하나가 낡은 채로 남는다"(§D 12라운드: `"삭제도 같은 락을 잡는다"` 문장이 경로 하나만 덮고 있었다) 는 교훈과 정확히 같은 형태가 **락 문단은 고쳐졌는데 타임아웃 문단은 그대로**인 채로 재발한 것이다.
  - 제안: `CHANGELOG.md:48` 문장을 "삭제(`DELETE /api/triggers/:id`) **와 스케줄 삭제의 trigger cascade** 만 5초 상한을 둔다"로 넓히거나, 락 문단처럼 "삭제 경로 둘 다" 로 통일한다.

- **[INFO]** `TRIGGER_DELETE_LOCK_TIMEOUT_MS` 의 JSDoc 근거 서술이 두 소비자 중 하나(`remove()`)만 구체적으로 설명한다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:65-76`
  - 상세: 이 상수의 JSDoc 은 "**삭제만 다르다**: `remove()` 는 락을 잡기 **전에** 되돌릴 수 없는 정리(provider teardown · secret 삭제 · BullMQ 해제)를 이미 끝냈으므로…" 라고 근거를 설명하는데, 이 서술은 `TriggersService.remove()` 하나에만 정확히 들어맞는다. 지금은 `SchedulesService.remove()` 의 trigger cascade 삭제도 같은 상수를 쓰는데, 그쪽의 "돌이킬 수 없는 선행 정리"는 `scheduleRunnerService.removeJob()` 뿐이고 provider teardown·secret 삭제는 없다(schedule 타입 트리거는 chatChannel 을 가질 수 없다는 사실이 `schedules.service.ts` 자체 주석에도 있다). 상수를 공유 프리미티브로 뽑으면서 JSDoc 예시가 한쪽 호출부에만 고정된 상태다 — 이 PR 이 `rewriteTriggerConfigLocked` JSDoc 에서는 이미 "호출부를 세어 적지 않는다"(`trigger-config-lock.ts:88-90`)는 규율을 명시적으로 도입했는데, 바로 아래(같은 파일)의 `TRIGGER_DELETE_LOCK_TIMEOUT_MS` 에는 그 규율이 적용되지 않았다.
  - 제안: "다른 경로는 무한 대기가 낫다 … **삭제만 다르다**" 까지는 일반 원칙으로 유지하고, 괄호 예시(`provider teardown · secret 삭제 · BullMQ 해제`)는 "그 삭제 경로가 되돌릴 수 없는 선행 정리를 이미 끝낸 경우"처럼 소비자를 특정하지 않는 표현으로 완화하거나, 두 소비자의 선행 정리가 다르다는 점을 한 줄 덧붙인다. 급하지 않음(WARNING 이 아니라 INFO 로 유지 — 상수 자체의 계약·값은 정확하고, 예시 문장의 정밀도 문제일 뿐이다).

- **[INFO]** 리뷰 도중 워킹트리에서 일시적 이상 상태를 관측(이미 원복됨, 후속 조치 불요)
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` (`remove()` 의 cascade 삭제 블록)
  - 상세: 파일을 `Read` 로 직접 열었을 때 한 번 `acquireTriggerConfigLock(m, triggerId, { timeoutMs: TRIGGER_DELETE_LOCK_TIMEOUT_MS })` 대신 `acquireTriggerConfigLock(m, triggerId)`(타임아웃 인자 없음) 상태가 관측됐다. 즉시 `git status --short`(untracked `review/` 산출물 외 변경 없음) · `git diff HEAD`(빈 diff) · `sed`/`md5` 재조회로 재확인한 결과 워킹트리는 `git show HEAD:...` 와 정확히 일치하는 정상 상태였다. 이 저장소가 이미 기록한 "병렬 리뷰어가 같은 워킹트리를 동시에 mutate 한다" 현상의 재현으로 보이며, 저장소에 잔여 이상 상태는 없다. 위 WARNING/INFO 두 항목은 재확인된 정상 상태를 기준으로 작성했다.

## 긍정적으로 확인한 점 (참고)

- `trigger-config-lock.ts` · `chat-channel-binder.service.ts` · `triggers.service.ts` · `trigger-transaction-mock.ts` 의 신규/변경 함수는 예외 없이 "무엇을, 왜, 어떤 대안을 왜 기각했는지, 어느 리뷰 라운드가 이 근거를 요구했는지"를 JSDoc 에 담고 있다 — 공개 함수·비공개 헬퍼를 가리지 않고 문서 밀도가 이 저장소의 기존 상위 수준(예: `execution-engine.service.ts` admission lock)과 일치하거나 그 이상이다.
- `hooks.service.ts` 의 `touchLastTriggeredAt` 통합, `endpoint-path-conflict-wrap-guard.ts` 의 `TRIGGER_ENTITY` 상수 등은 "왜 두 형태를 봐야 하는가"·"왜 이 자리에서 판단이 갈렸었나"를 코드 옆에 남겨 다음 편집자가 같은 실수(가드가 형태 변경을 못 따라가는 것)를 반복하지 않도록 했다.
- `endpoint-path-conflict-wrap.spec.ts` 의 `EXPECTED_UNWRAPPED_TRIGGER_SAVES` 가 빈 배열로 바뀐 것과 그 이유("빈 목록이 더 강한 상태다")를 docblock 에 명시한 것은 회귀 방지용 정적 래칫의 의도를 정확히 설명한다.
- `plan/in-progress/trigger-config-lost-update.md` 는 13라운드에 걸친 처분·반증·뮤테이션 실측을 빠짐없이 남겨, "왜 이 설계가 됐는가"와 "어떤 대안이 왜 기각됐는가"가 완전히 추적 가능하다. 자신이 이전 라운드에 쓴 문장이 실측으로 반증됐을 때 취소선(`~~...~~`)으로 원문을 남기고 정정한 방식(§D "유예의 근거가 틀렸다")도 이 프로젝트 관례(자기-반증형 소정정)와 일치한다.
- README(`codebase/backend/README.md`)·환경변수 문서 갱신은 불필요 — 이번 변경은 새 env var·설정 옵션·외부 API 표면을 추가하지 않는 순수 내부 동시성 수정이다(다른 라운드의 `dependency.md`/`api_contract.md` 리뷰와 일치).
- `spec/5-system/15-chat-channel.md` 의 `code:` glob 이 새 파일(`trigger-config-lock.ts`)을 안 무는 문제는 developer 권한 밖(`spec/`)이라 plan 에 planner 후속으로 이미 정확히 등재돼 있다 — 이번 리뷰에서 새로 지적할 사항이 아니다.

## 요약

이 PR 의 문서화 수준은 이례적으로 높다 — 모든 신규/변경 함수가 근거·기각된 대안·리뷰 라운드 출처를 갖춘 JSDoc 을 달고 있고, plan 문서는 13라운드의 실측·반증 이력을 취소선 정정까지 포함해 투명하게 남긴다. 다만 그 밀도 자체가 함정을 만든다 — CHANGELOG 안에서 "락은 두 삭제 경로 모두에 적용된다"는 문장은 최신 커밋에서 정정됐는데 바로 아래 "타임아웃은 `DELETE /api/triggers/:id` 에만 적용된다"는 인접 문장은 갱신되지 않아, 실제 코드(스케줄 cascade 삭제도 같은 타임아웃 상수를 씀)보다 문서가 좁게 서술하는 상태가 됐다. 같은 상수의 JSDoc 예시도 한쪽 소비자에만 정확한 표현을 쓰고 있어 낮은 우선순위지만 함께 정리할 여지가 있다. 리뷰 중 관측한 워킹트리 일시 이상 상태는 재확인 결과 정상이었다(병렬 리뷰어 mutation 으로 추정). 두 발견 모두 차단 사유는 아니며, CHANGELOG 정확성 항목 하나만 다음 커밋에서 가볍게 정정하면 된다.

## 위험도

LOW
