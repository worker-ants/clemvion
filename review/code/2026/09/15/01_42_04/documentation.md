# 문서화(Documentation) 리뷰 — trigger-config-lost-update (14라운드)

## 검토 범위

`trigger.config` lost-update 수정 배치의 14번째 리뷰 라운드. 직전 라운드(`review/code/2026/09/15/01_09_53`)가 지적한 CHANGELOG 문단 불일치(W3)·`trigger-transaction-mock.ts` JSDoc 낡은 숫자(W4)를 고친 최신 커밋(`6ebc760d1`)까지 포함해 `CHANGELOG.md`, `trigger-config-lock.ts`, `schedules.service.ts`/`.spec.ts`, `triggers.service.ts`, `trigger-transaction-mock.ts`, `plan/in-progress/trigger-config-lost-update.md` 를 `git show`/`Read`로 직접 재확인했다.

## 발견사항

- **[INFO]** `TRIGGER_DELETE_LOCK_TIMEOUT_MS` 근거의 "정리 항목 3종" 예시가 두 소비자 중 하나(스케줄 cascade)에는 과대 서술 — CHANGELOG 정정이 이 문구를 새로 한 곳 더 복제했다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:65-76`(`TRIGGER_DELETE_LOCK_TIMEOUT_MS` JSDoc, `provider teardown · secret 삭제 · BullMQ 해제`) 및 `CHANGELOG.md`(`Unreleased — **Behavior change**...` 항목의 "**삭제 경로 둘만 5초 상한을 둔다**" 문단, `둘 다 락을 잡기 **전에** 되돌릴 수 없는 정리(provider teardown · secret 삭제 · BullMQ 해제)를 끝내므로`)
  - 상세: 이 세 항목 나열(`provider teardown · secret 삭제 · BullMQ 해제`)은 원래 `TriggersService.remove()` 하나만 정확히 설명하는 문장이었다(직전 라운드 `review/code/2026/09/15/01_09_53` documentation INFO 로 이미 지적됨). 이번 라운드가 고친 것(W3)은 CHANGELOG 의 "삭제 경로 둘만 상한" 문장을 `DELETE /api/triggers/:id` 단독에서 "둘 다"로 넓히는 것이었는데, 그 과정에서 같은 세 항목 나열을 그대로 재사용해 **두 번째 소비자에게도 그대로 적용된다는 인상을 CHANGELOG 에도 새로 만들었다**. 실제로 `SchedulesService.remove()` 의 trigger cascade 삭제(`codebase/backend/src/modules/schedules/schedules.service.ts` `remove()`)가 락을 잡기 전에 끝내는 되돌릴 수 없는 정리는 `scheduleRunnerService.removeJob()`(BullMQ 해제) 하나뿐이다 — schedule 타입 트리거는 `chatChannel` 을 가질 수 없어 provider teardown·secret 삭제 대상이 원천적으로 없다는 점을, 정작 `schedules.service.ts` 자신의 인접 주석(`remove()` cascade 블록, "schedule 타입 트리거는 chatChannel 을 가질 수 없어 인입 서명 fail-open 으로는 이어지지 않지만…")은 정확히 알고 있다. 즉 셋 중 하나(주석 3)만 진실을 반영하고, 나머지 둘(JSDoc·CHANGELOG)은 "둘 다 세 가지를 다 한다"로 읽히는 나열을 공유한다. 보안·정합성에 영향은 없고(오히려 실제 동작보다 "더 조심스러워 보이는" 방향의 과대 서술이라 위험 방향은 안전 쪽) 이 PR 이 스스로 반복 지적한 "목록형 서술은 낡는다"는 교훈과 같은 클래스의, 이번 라운드가 미처 못 닫은 잔여 사례다.
  - 제안: `TRIGGER_DELETE_LOCK_TIMEOUT_MS` JSDoc 의 예시를 "그 삭제 경로가 되돌릴 수 없는 선행 정리를 이미 끝낸 경우"처럼 소비자 비특정 표현으로 일반화하거나, "두 소비자의 선행 정리 내용이 다르다(트리거 삭제=provider teardown+secret 삭제+BullMQ 해제, 스케줄 cascade=BullMQ 해제만)"를 한 줄 덧붙인다. CHANGELOG 문단도 같은 표현을 재사용하지 말고 "정리 내용은 경로마다 다르지만 둘 다 락 획득 전에 되돌릴 수 없는 선행 작업을 마친다"처럼 완화할 수 있다. 급하지 않음 — 코드/테스트 동작에는 영향이 없는 서술 정밀도 문제다.

## 긍정적으로 확인한 점 (참고)

- 직전 라운드가 지적한 두 항목(CHANGELOG "삭제 경로 둘 다 락 / 삭제 경로 둘만 상한" 문단 불일치, `trigger-transaction-mock.ts` JSDoc의 "2 감쌈/4 안 감쌈" → 실제 "3/3" 낡은 숫자)은 최신 커밋(`6ebc760d1`)에서 정확히 고쳐졌고, 두 자리 모두 "왜 낡았는지"를 함께 적어 재발 방지 근거를 남겼다 — `git show 6ebc760d1`로 diff 를 직접 대조해 확인.
- `schedules.service.spec.ts` 신규 테스트(`'삭제 실패는 조용히 지나가지 않는다…'`, 상한 순서 배열 단언)의 인라인 주석이 "존재가 아니라 순서를 단언한다"는 의도를 정확히 설명하고, 실측한 뮤턴트 결과(25건 GREEN→46건 중 1 RED 등)를 커밋 메시지·plan 양쪽에 일관되게 남겼다.
- `plan/in-progress/trigger-config-lost-update.md` 는 14라운드 전체의 처분 이력을 라운드별로 누락 없이 추적하며, 이번 라운드에서 "정지 규칙을 결과를 보기 전에 선언"(비동작 결함은 `RESOLUTION.md` 로만 기록)한 것도 이 프로젝트의 정지 규칙 관례와 일치한다.
- `withTransactionMock` 을 쓰는 파일 3개(`triggers.service.spec.ts`·`triggers.web-chat.spec.ts`·`schedules.service.spec.ts`)와 안 쓰는 3개(`auth-configs`·`external-interaction`·`hooks`)를 grep 으로 직접 세어 JSDoc 의 "3개/3개" 서술과 정확히 일치함을 확인했다.
- README·환경변수 문서 갱신 필요성 없음(신규 env var·외부 설정 옵션·API 표면 변경 없음)은 이전 라운드들의 결론과 이번 재확인에서도 동일하다.

## 요약

이번 라운드는 직전 WARNING(CHANGELOG 문단 불일치)과 관련 INFO(mock JSDoc 낡은 숫자)를 정확히 해소했다. 다만 그 수정 과정에서 원래 하나의 함수(`TriggersService.remove()`)에만 정확했던 "정리 3종 나열"이 CHANGELOG 의 일반화된 문장에도 그대로 옮겨져, 실제로는 정리 내용이 다른 두 번째 소비자(`SchedulesService.remove()`의 스케줄 cascade — BullMQ 해제만 함)에도 적용되는 것처럼 읽히는 잔여 정밀도 문제가 남았다. 안전 방향의 과대 서술이라 차단 사유는 아니며, 이 PR 이 이미 여러 차례 확인한 "목록형 서술은 낡는다" 교훈의 다섯 번째 사례로 후속 정리 대상이다. 그 외 문서화 수준(JSDoc 근거·기각된 대안·리뷰 라운드 출처, plan 이력 추적, 테스트 주석의 뮤턴트 실측 병기)은 여전히 이 저장소 평균을 상회한다.

## 위험도

LOW
