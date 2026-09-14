# 변경 범위(Scope) 리뷰 — trigger-config-lost-update (10라운드, 23:38 세션)

## 검토 방법

`git log --oneline origin/main..HEAD`(전체 10개 커밋) · `git diff --stat origin/main...HEAD`
(`codebase/` 19개 파일, `+1190/-40`; 전체 180개 파일 중 나머지는 `review/**`·`plan/**` 산출물)로
프롬프트에 열거된 파일 목록과 대조해 완전히 일치함을 확인했다. 프롬프트가 "크기 제한으로
diff 생략"이라 표시한 파일(`chat-channel-binder.service.ts`·`trigger-config-lock.ts`/`.spec.ts`·
`triggers.service.ts`/`.spec.ts`·`trigger-transaction-mock.ts`·e2e·plan)은 `git diff
origin/main...HEAD -- <path>` 로 전체 diff 를 직접 읽어 확인했다. 특히 이번 세션(23_38_09)이
새로 리뷰하는 최신 커밋 `833bb745a`(직전 라운드 `review/code/2026/09/14/23_01_18` 처분분)는
전체 diff 를 커밋 메시지와 한 줄씩 대조했다.

## 발견사항

- **[INFO]** 최신 커밋(`833bb745a`)의 실제 diff 가 커밋 메시지의 주장과 정확히 일치한다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts`(C1 `cleanupRotatedChatChannelTokens` 검증 누락 대응은 실은 `triggers.service.spec.ts` 쪽 테스트 추가이고, `triggers.service.ts` 본문 변경은 W1 `rotateBotToken` 의 `mergeIntoFreshSubKey` 적용·W5 orphan JSDoc 재배치·`promoted` 카운터 조건부 증가로 국한), `codebase/backend/src/modules/triggers/triggers.service.spec.ts`(`rotateBotToken`/`promoteRotatedNotificationSecrets`/`cleanupRotatedChatChannelTokens` 세 개 신규 `it`), `codebase/backend/src/modules/triggers/trigger-config-lock.spec.ts`(JSDoc 통합만)
  - 상세: 커밋 메시지가 예고한 C1(`cleanupRotatedChatChannelTokens` 동작 테스트 부재)·W1(`rotateBotToken` 의 스냅샷 대입 4번째 자리)·W5(orphan JSDoc 3번째 재발)·INFO(`promoted` 카운터 조건부화, `@param` 보완, lock spec 중복 JSDoc 정리) 각 항목이 diff 안에 정확히 그 범위로만 나타난다. 커밋 메시지가 "만들지 않기로 했다"고 적은 정적 가드(orphan JSDoc 탐지기)는 실제로 코드에 추가되지 않았다 — 주장과 부재가 일치한다. 이 diff 에 서술과 무관한 추가 수정은 없다.
  - 제안: 없음(양호).

- **[INFO]** 이번 PR 전체가 원 스코프("동시 PATCH lost-update")에서 "같은 결함 클래스의 21개 후보 중 8개 `save(entity)` 자리 + 웹훅 hot path 2자리"로 넓어졌으나, 그 확장은 스스로 실측·리뷰 지적에 의해 강제된 것이며 매 라운드 plan 에 근거가 기록돼 있다
  - 위치: `plan/in-progress/trigger-config-lost-update.md` §"같은 클래스의 자리가 넷보다 많다"(전수 열거 21건) 및 §"2~9라운드 리뷰 처분" 표
  - 상세: `hooks.service.ts`(웹훅 인입 hot path 2곳) · `schedules.service.ts`(trigger 컬럼 동기화) · `chat-channel-input-rules.ts`(중복 캐스트 추출) · `endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`/fixture(정적 래칫이 새 코드 형태를 못 따라가 재조정) 는 모두 "PATCH 가 아닌 다른 경로도 같은 `save(entity)` 로 `chatChannel.inboundSigningRef` 를 되돌린다"는 **같은 근본원인**의 다른 발현이며, 전부 이전 라운드 리뷰(`19_07_43`~`23_01_18`)의 Critical/Warning 지적을 처분한 결과다. 새 기능 추가나 무관한 리팩토링이 아니라, 원 결함의 정의("config 를 다시 쓰는 모든 자리")를 참으로 만들기 위한 좁은 확장이다. `endpoint-path-conflict-wrap-guard.ts`/fixture 변경도 창 1 을 락 안(`manager.transaction`)으로 옮기며 수신자가 `this.triggerRepository`→`m` 으로 바뀌어 기존 정적 가드가 오탐(래핑이 있는데 "없다"로 읽음)을 냈기 때문이며, 가드 자체의 대상 스코프(`endpointPath` 충돌 래핑)는 바뀌지 않았다.
  - 제안: 조치 불요 — 이미 plan 이 매 확장을 별도 트래킹 항목으로 등재하고 "넓히지 않는 것"(§하지 않는 것)과 "후속으로 미루는 것"(§후속)을 명시적으로 분리해 두었다.

- **[INFO]** `plan/in-progress/trigger-config-lost-update.md` · `review/consistency/2026/09/14/17_10_16/**` · `review/code/2026/09/14/{18_17_44,19_07_43,19_44_08,...,23_01_18}/**` 가 같은 changeset 에 누적 포함
  - 위치: 위 경로들 (총 diff 180개 파일 중 `codebase/**` 19개를 제외한 나머지 전부)
  - 상세: `CLAUDE.md` 가 구현 착수 직전 `--impl-prep` consistency-check 를, 구현 완료 후 `/ai-review` 강제 반복(및 fix)을 의무화하므로, 이 라운드 수(10라운드)만큼 리뷰 산출물이 같은 브랜치에 누적되는 것은 이 저장소의 강제 워크플로가 만드는 정상적 부산물이다. scope creep 이 아니다.
  - 제안: 조치 불요.

이 외에 요청 범위를 벗어난 임의 리팩토링, 무관한 파일 수정, 포맷팅 전용 변경, 불필요한 주석/임포트 정리, 의도치 않은 설정 변경은 발견되지 않았다. `git diff` 상의 import 추가는 모두 신규 헬퍼(`rewriteTriggerConfigLocked`, `extractInboundSigningRef`, `withTransactionMock`, e2e 헬퍼)에 직접 연결되며 미사용 임포트나 정리성 변경은 없다.

## 요약

10개 커밋 전체(`+1190/-40`, `codebase/` 19개 파일)를 `origin/main` 대비 확인한 결과, 코드 변경은 "동시 PATCH 가 `trigger.config` 를 lost-update 로 잃어 `inboundSigningRef` fail-open 이 재발한다"는 단일 결함 클래스를 닫는 데 일관되게 집중돼 있다. 확장된 범위(웹훅 hot path·schedules·notification/interaction 관련 8개 write-site·정적 래칫 재조정)는 전부 같은 근본원인의 다른 발현이며, 자체 실측 또는 리뷰 라운드의 Critical/Warning 지적으로 강제된 것으로 plan 문서에 라운드별 근거가 남아 있다. 이번 리뷰가 새로 검토한 최신 커밋(`833bb745a`)은 직전 라운드 리뷰(`23_01_18`)가 지적한 항목(C1·W1·W5·INFO)만 정확히 처분했고, 그 이상의 부수 변경은 없었다. plan/consistency/review 산출물의 누적 포함은 이 저장소의 강제 워크플로 규약이 요구하는 동반 아티팩트다. 요청 이상의 변경, 불필요한 리팩토링, 기능 확장(over-engineering), 무관한 파일 수정, 포맷팅 전용 변경은 발견되지 않았다.

## 위험도

NONE
