# 요구사항(Requirement) 리뷰 — `impl-chat-channel-binder-t2`

## 검토 범위

`TriggersService` 의 private 메서드 `setupChatChannel`/`teardownChatChannel`/`buildCallbackUrl`
을 신규 `ChatChannelBinderService`(`chat-channel-binder.service.ts`)와 순수 함수
`buildTriggerCallbackUrl`(`trigger-callback-url.ts`)로 옮기는 **동작 보존 리팩터**(4라운드째
`/ai-review`). 이번이 4번째 라운드이며 앞선 3라운드(`18_04_36`→`18_42_05`→`19_06_54`)에서
CRITICAL 0 를 유지한 채 WARNING 4→3→2 로 수렴했다. 독립적으로 재검증했다.

## 독립 검증 수행 내역

- `npx tsc --noEmit -p tsconfig.build.json` — 클린 (0 에러).
- `npx jest src/modules/triggers --silent` — **9 suites / 258 passed, 1 skipped, 259 total**,
  실패 없음.
- `npx eslint` 대상 4파일 — 클린 (미사용 import 없음, `triggers.service.ts` 의
  `buildSecretRef`/`ChannelAdapterRegistry` 등은 `rotateBotToken`/기타 잔류 메서드가 계속 사용).
- `TODO|FIXME|HACK|XXX` grep — 대상 8개 소스/스펙 파일 전부 0건.
- `git diff origin/main...HEAD --stat -- codebase/` — `codebase/` 만 변경, `spec/` 변경 0줄
  (plan frontmatter `spec_impact: none` 과 일치).
- `chat-channel-binder.service.ts` JSDoc 이 인용하는 spec 앵커(`CCH-AD-02`, `CCH-AD-03`,
  `R-CC-21`, `§5.4.1.1`)를 `spec/5-system/15-chat-channel.md` 에서 직접 확인 — 이동된
  주석·규칙 서술이 spec 본문과 line-level 로 일치.

## 발견사항

- **[INFO]** `chat-channel-binder.service.ts` 의 경고 로그 4개가 `ChatChannelBinderService`
  로거 컨텍스트로 찍히면서도 메시지 리터럴은 `` `TriggersService: …` `` 로 시작한다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` — 예
    `this.logger.warn(\`TriggersService: chatChannel.provider="${chatChannelCfg.provider}" 미등록 — setupChannel skip\`)`
    (파일 내 `setupChatChannel`/`teardownChatChannel` 전체 warn 4곳).
  - 상세: 함수명·클래스명과 로그 문구가 불일치하는 "의도와 구현 간 괴리" 항목이지만, JSDoc
    상단에 *"동작 보존(순수 이동) 주장을 지키기 위해 의도적으로 남겼다"* 는 명시적 사유가 있고,
    이 리터럴을 단언하는 테스트가 0건임을 이미 실측해 둔 상태다. `plan/in-progress/spec-draft-nullable-notation-followups.md`
    에도 developer 후속 항목으로 등재돼 있음을 확인했다(중복 등재 불필요).
  - 제안: 이번 PR 범위에서 조치 불필요. 다음에 이 파일을 손댈 때 리터럴 접두를 정정.

- **[INFO]** `setupChatChannel`/`teardownChatChannel` 이 여전히 같은 `trigger.config` 컬럼에
  대해 read-merge-write 를 여러 `await` 경계에 걸쳐 수행하는 lost-update 패턴을 그대로
  옮겼다(비원자적 `triggerRepository.update` — 트랜잭션/락 없음).
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` `setupChatChannel`
    성공 경로(`newConfig` 조립 후 `update`) 및 실패 경로(`fallbackConfig`).
  - 상세: 사전 존재 결함이며 이 PR 의 명시 목표(동작 보존)와 일치하는 이동이다. 다만 호출이
    이제 서비스 경계(`TriggersService` → `ChatChannelBinderService`)를 건너므로, 후속 락 설계
    시 "어느 계층이 잠글 것인가"라는 새 질문이 생긴다 — 이미 트래커 항목에 이 관찰이
    각주로 반영돼 있음을 확인했다.
  - 제안: 이 PR 범위 밖. 후속 lost-update 항목 처리 시 계층 변경 사실을 반영.

- **[INFO]** 자체 검증 결과 CRITICAL/WARNING 급 신규 결함 없음. 4라운드에 걸쳐 이미 다뤄진
  항목(콜백 URL 인자 순서 → 이름 인자로 형태 제거, `teardownChatChannel` adapter 분기 무커버
  → 4케이스 신설, `remove()` → binder 위임 배선 무커버 → 스파이 테스트 신설, `ConfigService`
  mock 의 키-무시 → 키 인식 mock + URL 값 단언)이 실제로 커밋에 반영돼 있고 뮤테이션(RED)
  근거가 `RESOLUTION.md`/커밋 메시지에 기록돼 있음을 소스 대조로 확인했다.

## 요구사항 관점 체크리스트 결과

1. **기능 완전성**: `setupChatChannel`/`teardownChatChannel` 로직이 바이트 단위로 동일하게
   이동했고 호출부 3곳(`create`/`update`/`remove`)이 신규 협력자로 정확히 교체됨. 완전.
2. **엣지 케이스**: `buildTriggerCallbackUrl` 은 `baseUrl` undefined/빈 문자열, 후행/선행
   슬래시 단독·중복·중간경로 보존까지 7케이스로 명시적으로 캐너리화됨(`trigger-callback-url.spec.ts`).
   `teardownChatChannel` 의 `config` 무-`chatChannel`, provider 미등록, adapter 예외 케이스도
   신규 spec 4건으로 커버.
3. **TODO/FIXME**: 0건.
4. **의도와 구현 간 괴리**: 로그 리터럴 접두 불일치 1건(위 INFO, 의도적·이미 등재).
5. **에러 시나리오**: `endpointPath` 부재 시 `CHAT_CHANNEL_ENDPOINT_REQUIRED` 400 유지,
   `setupChannel` 실패 시 degraded 저장 유지, `teardownChannel` 실패 시 best-effort catch(로그
   후 삼킴) 유지 — 전부 이동 전과 동일 동작이며 새 spec 이 catch 의 warn 본문(trigger id·사유)
   까지 단언.
6. **데이터 유효성**: `storeUserSuppliedSecrets` 게이팅(R-CC-21)·`inboundSigningRefSurvives`
   대칭 보존 로직 그대로 이동, 뮤테이션 RED 확인됨.
7. **비즈니스 로직**: PATCH 비밀 미기록·telegram server-issued 예외 로직이 spec
   §5.4.1.1/R-CC-21 문구와 정확히 대응.
8. **반환값**: `setupChatChannel`/`teardownChatChannel` 모두 `Promise<void>`, 모든 분기(정상/스킵/실패)에서
   명시적으로 반환하거나 함수 종료 — 누락된 경로 없음.
9. **spec fidelity**: `spec/5-system/15-chat-channel.md` 의 `CCH-AD-02`/`CCH-AD-03`/`R-CC-21`/
   §5.4.1.1 과 코드의 JSDoc·분기가 line-level 로 일치. 코드가 `TriggersService.setupChatChannel`
   대신 `ChatChannelBinderService.setupChatChannel` 을 소유하게 되면서 spec 3곳(`secret-store.md`,
   `chat-channel-adapter.md`, `data-flow/14-chat-channel.md`)의 귀속 서술이 옛 심볼 경로를
   가리키게 됐다 — **이는 [SPEC-DRIFT] 이지만 developer 권한 밖(`spec/` 쓰기)** 이며,
   `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 항목으로 **이미
   등재**돼 있음을 diff 로 직접 확인했으므로 중복 발견사항으로 올리지 않는다(내용 실질은
   변하지 않고 심볼 경로만 낡음 — 코드가 옳고 spec 참조 경로만 갱신 필요, 해당 3곳 문서·행은
   위 트래커 항목에 명시돼 있음).

## 요약

`ChatChannelBinderService`/`buildTriggerCallbackUrl` 로의 이동은 동작을 바이트 단위로 보존한
순수 리팩터이며, 4라운드에 걸친 반복 리뷰가 지적한 커버리지 갭(콜백 URL 조립 규칙 무단언,
teardown adapter 분기 무실행, `remove()`→binder 위임 무단언, config-키 무시 mock)이 모두 실제
테스트로 닫혀 있고 뮤테이션 RED 로 재확인됐다. 독립적으로 재실행한 `tsc`/`jest`/`eslint`/
TODO grep 도 전부 클린하며, 새로 CRITICAL·WARNING 급 결함은 발견하지 못했다. 유일한 잔여
항목(로그 리터럴 접두 불일치, lost-update 패턴 서비스 경계 이전, spec 귀속 서술 3곳 SPEC-DRIFT)
은 모두 의도적이거나 사전 존재 갭이며 이미 트래커에 등재돼 있어 이 PR 의 조치 대상이 아니다.

## 위험도

LOW
