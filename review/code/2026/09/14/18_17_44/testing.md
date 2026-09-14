# 테스트(Testing) 리뷰 — trigger-config-lost-update

## 검증 방법 메모

이 리뷰는 정적 검토 외에, 코드가 실제로 회귀를 잡는지 **뮤테이션으로 실측**했다. 저장소
안에서 두 번 고쳤다가 즉시 `cp` 로 원복했고, 각 실측 뒤 `git status --short` / `git diff --stat`
로 잔여물 없음을 확인했다(둘 다 clean, 기존 untracked `review/code/**` 두 디렉터리만 표시).

1. `chat-channel-binder.service.ts` 의 `survivesWithFresh` — 이번 fix 의 핵심(락 안에서
   재읽은 행의 `inboundSigningRef` presence 를 게이트에 더하는 로직)을 원천 무효화:
   `Boolean((freshConfig...)?.chatChannel?.inboundSigningRef)` 항을 제거하고
   `inboundSigningRefSurvives` 만 남기도록 되돌림.
2. `triggers.service.ts` 의 `rotateBotToken` — `rewriteTriggerConfigLocked` 의 merge 콜백을
   `(freshConfig) => ({...freshConfig, chatChannel: mergedChannel})` 에서
   `(_freshConfig) => ({...(trigger.config ?? {}), chatChannel: mergedChannel})` (고치기 전의
   스냅샷 기반 병합)으로 되돌림.

두 뮤테이션 모두 `npx jest src/modules/triggers` 전체(9 스위트 279건, 1 skip)가 **100% GREEN**
이었다(첫 뮤테이션 단독 재실행: 278 passed / 1 skipped, 두 번째도 동일). 즉 **이 배치가 추가한
unit 테스트 중 어느 것도 이번 PR 의 핵심 수정 두 곳을 실제로 지키지 않는다.**

## 발견사항

- **[CRITICAL]** unit 테스트가 `survivesWithFresh` 의 신규 항(락 안에서 재읽은 `chatChannel.inboundSigningRef`)을 전혀 검증하지 않는다 — 뮤테이션으로 실측
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` `survivesWithFresh` (206~211행), 호출부 `buildFallbackChannel`(213~218행)·`buildMergedChannel`(243~252행)
  - 상세: 이 PR 이 겨누는 결함은 "동시 PATCH 가 그 사이에 ref 를 처음 확립하면 이 함수가 요청 시작 시점 상태로 게이팅해 ref 를 지운다"(fail-open) 는 것이고, 그 수정이 `survivesWithFresh` 의 세 번째 OR 항이다. 그런데 `triggers.service.spec.ts` 의 모든 관련 테스트는 `triggerRepo.findOne.mockResolvedValue(...)`(1회성 아님, 고정값)를 쓴다 — `withTransactionMock` 이 락 안 `m.findOne` 을 **같은 mock** 으로 위임하므로, "요청 시작 시점의 읽기"와 "락 안에서 다시 읽은 행"이 모든 테스트에서 **항상 동일한 값**이 된다. 그 결과 세 번째 OR 항이 다른 두 항과 실제로 갈리는 입력이 어떤 unit 테스트에도 없다. 실측: 세 번째 항을 통째로 제거해도(`inboundSigningRefSurvives` 만 남겨도) `src/modules/triggers` 전체 unit 스위트(279건)가 100% 통과한다.
  - 이 결함이 지키는 것은 인입 웹훅 서명 검증(fail-open 방지)이라 보안에 직결되고, 이 배치의 존재 이유 자체다. 유일한 방어선은 e2e 테스트 1건뿐인데(아래 WARNING 참고), 그마저 이 정확한 분기를 이 환경에서 관측한 적이 없다고 그 테스트 스스로 적어 두었다.
  - 제안: `triggerRepo.findOne` 을 `mockResolvedValueOnce` 로 두 번 체이닝해 — ① 최초 호출(=`findById`, ref 없음) ② 락 안 재읽기(=`m.findOne`, 동시 확립된 ref 있음) — 두 값이 다른 unit 테스트를 최소 1건(성공 경로 `buildMergedChannel`) + 1건(실패 경로 `buildFallbackChannel`, `setupChannel` mock 을 reject 시켜서) 추가한다. `TriggersService.update()` 경로에서 `findOne` 이 정확히 두 번(최초 1회 + 락 안 1회) 불리는 것은 이미 코드 구조상 보장되므로 어렵지 않게 결정적으로 만들 수 있다.

- **[CRITICAL]** `rotateBotToken` 의 락 안 재병합도 unit 테스트가 지키지 못한다 — 뮤테이션으로 실측
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `rotateBotToken` 의 `rewriteTriggerConfigLocked` 호출 (merge 콜백, `(freshConfig) => ({...freshConfig, chatChannel: mergedChannel})`)
  - 상세: 위와 같은 이유로 `describe('TriggersService.rotateBotToken — 6단계 오케스트레이션')` 의 `triggerRepo.findOne.mockResolvedValue(...)` 도 고정값이라, merge 콜백이 `freshConfig` 를 무시하고 `trigger.config`(요청 시작 시점 스냅샷)로 되돌아가도 구분되지 않는다. 실측: 그 되돌리기를 적용해도 `rotateBotToken` describe 의 14건 전부, 그리고 `triggers.service.spec.ts` 전체(129건 중 128 passed·1 skip)가 그대로 통과한다. 즉 "다른 요청이 그 사이 커밋한 `config` 의 나머지 키를 보존한다"는, 이 PR 이 `rotateBotToken` 창에 대해 주장하는 바로 그 효과가 어떤 unit 테스트로도 고정되지 않는다.
  - 제안: 위와 같은 패턴 — `findOne` 을 두 번 다른 값으로 응답하게 해, 락 안 재읽기에만 있는 키(예: 다른 요청이 막 써 넣은 `rateLimitPerMinute` 등)가 최종 `update()` 호출의 `config` 에 살아남는지 단언한다. e2e 는 이 경로를 아예 다루지 않으므로(챗채널 PATCH-vs-PATCH 만 재현) unit 이 유일하게 가능한 방어선이다.

- **[WARNING]** e2e 캐너리의 두 단언 중 보안 관련 단언(②)은 이 환경에서 한 번도 RED 를 낸 적이 없다고 테스트 스스로 기록한다
  - 위치: `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts` 파일 상단 JSDoc "## 실측 — 이 테스트는 판별한다" 절, 그리고 본문 `expect(after.inboundSigningRef).toBe(issuedRef)` (검증 블록의 ② 단언)
  - 상세: 테스트 자신의 문서가 정직하게 적는다 — "이 환경에서는 `setupChannel` 이 빨리 실패해 1행 인터리빙이 나온다. 2행(②번 단언)은 실패가 늦은 환경을 위한 것이라 여기서는 실행되지 않았다." 즉 `rateLimitPerMinute` 유실(①)은 뮤턴트로 RED 를 실측했지만, **이 PR 의 진짜 목적인 `inboundSigningRef` fail-open 방지(②)는 이 환경에서 한 번도 판별력이 검증되지 않았다.** 위 CRITICAL 두 건과 합치면, 현재 이 배치에는 "락 안 재계산이 깨져도 실제로 잡아 주는 것으로 실측된 테스트"가 **하나도 없다** — CI 환경이 이 e2e 를 실행하더라도 `setupChannel` 실패 지연이 이 로컬 실측과 같은 타이밍이면 ② 는 계속 관측되지 않을 수 있다.
  - 제안: (a) 위 CRITICAL 두 건의 unit 테스트로 결정적 방어선을 먼저 만들고, (b) e2e 쪽은 가능하면 `setupChannel` 의 실패 지연을 결정적으로 늦추는 수단(예: 이 특정 트리거만 adapter mock 지연을 주입하거나, A 의 COMMIT 을 B 의 `setupChannel` 호출 이후로 강제하는 별도 시나리오)을 검토해 ② 인터리빙도 최소 1회는 실측 RED 로 확인해 둔다. 최소한 "관측되지 않았다"를 알고 있는 리스크로 트래커에 명시한다(plan 은 이미 "관측되지 않았다는 이유로 지우지 말 것"이라 적어 인지는 하고 있다 — 다만 해소는 안 됐다).

- **[WARNING]** `rewriteTriggerConfigLocked` 의 "행이 사라졌다" 분기(`if (!fresh) return false`)가 unit·e2e 어느 쪽에도 커버되지 않는다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:75-76`
  - 상세: JSDoc 은 이 반환값의 존재 이유를 "조용히 아무것도 안 했다를 호출부가 관측할 수 있게" 라고 명시하지만, 세 호출부(`chat-channel-binder.service.ts` 2곳, `triggers.service.ts` `rotateBotToken` 1곳) 중 어디에도 `findOne` 이 `null`/`undefined` 를 돌려주는 테스트가 없다. `false` 반환 자체를 아무도 안 쓰는 것(best-effort 라 의도적)과, `!fresh` 분기가 **한 번도 실행되지 않은 채로 남아 있는 것**은 별개다 — 다음 사람이 이 분기 안의 로직(예: 실수로 `merge` 를 호출해 `fresh` 가 `null` 인데 `.config` 접근으로 던지게 바꾸는 등)을 깨도 아무 테스트도 못 잡는다.
  - 제안: `trigger-config-lock.ts` 전용 unit spec 을 하나 신설해(현재 이 파일은 전용 테스트가 없다 — `find codebase/backend -iname "*trigger-config-lock*"` 결과 소스/컴파일 산출물뿐) `EntityManager` 를 직접 mock 해 `findOne → null` 일 때 `merge` 가 호출되지 않고 `update` 도 안 불리며 함수가 `false` 를 반환하는 것을 단언한다. 이 함수 자체가 순수 로직이 얇아 이런 spec 은 비용이 낮다.

- **[INFO]** `withTransactionMock` 헬퍼는 이 리뷰가 요구하는 수준의 자기 검증을 이미 갖췄다 — 긍정 기록
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:34-80`
  - 상세: JSDoc 이 "no-op 으로 두면 안 된다" 는 이유와, 실제로 transaction 콜백을 실행하지 않게 뮤테이션했을 때 13개 케이스가 RED 임을 실측해 적어 뒀다. `m.update`/`m.findOne` 을 바깥 repo mock 으로 위임해 기존 39개 테스트 지점의 의미를 보존한 것도 확인했다(`triggerRepo.update.mock.calls` 를 그대로 재사용하는 기존 단언들, 예: `persistedChannel()` 헬퍼가 계속 유효). 이 부분은 회귀 테스트 관점에서 잘 처리됐다.

- **[INFO]** 신규 게이트 로직이 `setupChatChannel` 내부 인라인 클로저라 단위 격리 테스트가 어렵다 (테스트 용이성)
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` `survivesWithFresh`/`buildFallbackChannel`/`buildMergedChannel` (206~252행)
  - 상세: 세 함수 모두 `internalCfg`·`inboundSigningRef`·`inboundSigningRefSurvives` 를 클로저로 캡처하는 지역 함수라 `export` 되지 않고, 독립적으로 부를 수 없다 — 위 CRITICAL 두 건에서 제안한 "findOne 을 두 번 다르게" 방식이 그나마 실현 가능한 이유는 DI mock 체이닝이 되기 때문이지, 함수 자체가 테스트하기 쉬워서가 아니다. 만약 `survivesWithFresh` 를 트리거 대신 값(`inboundSigningRefSurvives: boolean, freshChatChannel: unknown`)만 받는 순수 함수로 뽑아 내보내면, 위 CRITICAL 두 건의 회귀 테스트가 트랜잭션 mock 배선 없이 값 하나로 끝난다.
  - 제안: 필수는 아니지만(현재 우선순위는 CRITICAL 두 건의 실제 테스트 추가), 다음 유사 수정에서는 presence 게이트 계산을 순수 함수로 분리해 두는 편이 이런 회귀를 구조적으로 막는다.

- **[INFO]** e2e 테스트의 문서화·격리·공허성 가드는 이 저장소 관례를 잘 따른다 — 긍정 기록
  - 위치: `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts` 전체, 특히 `waitForWindowOneCommit`(공허성 가드: 겹침을 못 만들면 통과가 아니라 throw)과 `afterAll` 의 row 정리
  - 상세: 인터리빙 두 가지를 표로 대응시키고, 뮤턴트/원본 실측을 예측·실측 두 칸으로 기록했으며, 첫 실행에서 단언 순서가 잘못돼 엉뚱한 실패 메시지가 났던 것까지 정직하게 남겼다(이 저장소가 반복 강조하는 "GREEN 은 증거가 아니다"를 스스로 실천). 유일한 흠은 위 WARNING(② 미관측)이지 이 테스트의 설계·서술 품질이 아니다.

## 요약

이번 PR 의 프로덕션 코드 수정(락 안 재읽기 + presence 게이트 재계산)은 설계·구현 모두 합리적이고, `trigger-config-lock.ts` 의 JSDoc·`plan/in-progress/trigger-config-lost-update.md` 의 실측 기록은 이 저장소 관례에 충실하다. 그러나 **테스트 관점에서는 핵심 결함이 있다**: 뮤테이션으로 두 곳(바인더의 `survivesWithFresh` 신규 항, `rotateBotToken` 의 `freshConfig` 사용)을 각각 되돌려 봤을 때 `src/modules/triggers` unit 스위트(279건) 전체가 그대로 통과했다 — 즉 이 PR 이 고치는 두 가지 lost-update/fail-open 회귀 중 어느 것도 unit 레벨에서 보호되지 않는다. 유일한 방어선인 e2e 테스트 1건은 설계·서술은 훌륭하지만, 그 테스트 자신이 "보안에 직결되는 쪽 단언(②)은 이 환경에서 한 번도 RED 를 낸 적이 없다"고 기록해 뒀다. `rewriteTriggerConfigLocked` 의 "행 삭제됨" 분기도 어느 테스트에도 걸리지 않는다. `withTransactionMock` 자체의 설계·자기검증은 훌륭하므로, 그 인프라 위에 `findOne.mockResolvedValueOnce` 를 두 번 체이닝하는 결정적 unit 테스트 2~3건을 추가하는 것으로 이 갭은 비교적 저렴하게 닫을 수 있다.

## 위험도

HIGH
