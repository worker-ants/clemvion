# 테스트(Testing) 리뷰 — `impl-chat-channel-binder-t2` (4라운드)

## 검토 방법

이 diff 는 이미 3라운드(`18_04_36`→`18_42_05`→`19_06_54`)에 걸쳐 testing 관점 WARNING 5건·
INFO 다수가 제기·해소돼 왔다(각 `RESOLUTION.md` 확인). 이번 라운드는 (a) 그 해소가 **실제로
현재 코드에 반영돼 있는지** 소스를 직접 열어 재확인하고, (b) 새로 커밋된 3건
(`92f4b0607`·`8f43b1f56`·`68bb34e73`)이 이번이 처음 보는 변경이므로 독립적으로 재검증했다.

저장소 상태를 바꾸는 작업은 전부 `cp` 로 scratch(`/private/tmp/.../scratchpad`)에 백업 후
in-place 로 수행했고, 되돌린 뒤 `git status --short` 로 클린 확인했다(§검증 절 참조 — 복원이
한 번 지연된 경위 포함).

## 발견사항

- **[INFO]** `teardownChatChannel` 성공 경로 테스트가 `Logger.warn` **미호출**을 단언하지 않는다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.spec.ts` — `it('provider 가 등록돼 있으면 그 config 로 adapter.teardownChannel 을 부른다', ...)` (39번째 줄대, `describe` 블록 세 번째 `it`)
  - 상세: 성공 경로 테스트(`adapter.teardownChannel` 이 resolve 되는 경우)는 `registry.get`/
    `adapter.teardownChannel` 호출만 단언하고 `warn` 이 호출되지 않았음은 보지 않는다. 네 번째
    테스트(실패 경로)가 `warn` 호출을 단언하므로 클래스 두 분기 자체는 이미 서로 다른 값으로
    갈리지만, "성공했는데도 조용히 warn 이 딸려 나오는" 회귀는 이 파일만으로는 못 잡는다(다만
    다른 describe 가 `Logger.prototype` 을 건드리지 않는 한 실질 위험은 낮다).
  - 제안: 선택적 — `expect(warn).not.toHaveBeenCalled()` 한 줄 추가로 닫을 수 있다. 이 PR 을
    막을 사유는 아니다.

- **[INFO]** (저장소 위생, 제 검증 과정 관측) 뮤테이션 검증 중 워크트리 복원이 1회 지연됨 — 최종적으로 클린 확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:855` (`remove()` 의
    `await this.chatChannelBinder.teardownChatChannel(trigger);`)
  - 상세: `remove()` 의 새 배선 테스트(`triggers.service.spec.ts` "remove 는 chat-channel
    teardown 을 binder 에 위임한다")가 실제로 뮤턴트를 잡는지 독립 재현했다 — 해당 줄을 주석
    처리하자 타겟 테스트가 **RED** (`Expected number of calls: 1, Received: 0`)로 정확히
    실패함을 확인했다. 첫 복원 시도가 `cd <path> && git ...` 형태의 단일 명령에 섞여 있어
    worktree-isolation 가드에 전체가 거부되면서 `cp` 복원도 함께 스킵됐고, 뮤테이션이 일시적으로
    파일에 남았다. 두 번째 시도(순수 `cp`, 절대경로, git 명령과 미혼합)로 즉시 복원했고
    `git status --short` 로 클린 확인 + `jest` 재실행으로 정상 GREEN(124 passed, 1 skipped)
    확인했다. 최종 상태는 클린하지만, 규약이 경고한 "복원 지연이 다른 reviewer 를 오염시킬 수
    있다" 는 위험이 이번 세션에서도 실제로 재현됐다는 점을 기록해 둔다(다른 reviewer 가 이
    지연 구간을 관측했을 가능성은 낮음 — 같은 도구 호출 내에서 수 초 내 정정).
  - 제안: 조치 불요(이미 정정 완료). 다음 reviewer 프롬프트에 "cd+git 혼합 명령은 worktree 가드가
    통째로 거부한다"는 사실을 못박아 두면 향후 동일 지연을 예방할 수 있다.

## 이미 해소됨 — 재확인만 (신규 발견 아님)

아래는 과거 라운드가 WARNING/INFO 로 지적했고, 이번 라운드에서 소스를 직접 열어 **여전히
해소 상태임**을 재확인한 항목이다. 새 발견은 아니므로 등급 없이 기록만 한다.

1. `chat-channel-binder.service.spec.ts` 의 `makeBinder` 헬퍼가 두 번째 인자를 이름 인자
   (`{ adapter, providerRegistered }`)로 받는다 — 위치 boolean 이 재발하지 않음(2라운드 INFO 7).
2. `afterEach(() => jest.restoreAllMocks())` 로 spy 복원이 단언 성패와 무관하게 실행됨(2라운드 INFO 8).
3. `triggers.service.spec.ts` 의 `rotateBotToken` describe 의 `ConfigService` mock 이 키를
   인식(`key === 'app.url' ? … : undefined`)하고, `setupChannel` 호출 시 넘긴 URL 값까지
   단언한다(2라운드 W1) — `'app.url'` → `'frontend.url'` 스왑을 잡는 판별 fixture 가 실재함을
   코드로 확인.
4. `remove()` → `chatChannelBinder.teardownChatChannel` 배선을 `jest.spyOn` 으로 직접 단언하는
   테스트가 존재(3라운드 W1) — 위 §검증 절에서 뮤턴트로 **RED** 를 독립 재현해 실효성 확인.
5. `buildTriggerCallbackUrl` 시그니처가 이름 인자로 바뀌어 순서 스왑이 형태로 제거됨(1라운드 W1),
   `trigger-callback-url.spec.ts` 가 fallback·후행/선행 슬래시·양쪽 동시·하위 경로 보존 7케이스로
   조립 규칙을 직접 고정함.
6. `chat-channel-binder.service.spec.ts` 가 `teardownChatChannel` 의 이전에 안 돌던 분기
   (adapter 등록 시 실제 호출 + best-effort catch)를 덮고, catch 케이스는 `resolves` 뿐 아니라
   warn 내용(trigger id·사유)까지 단언한다(1라운드 W2).

## 독립 실행 검증

- `npx jest chat-channel-binder.service.spec.ts trigger-callback-url.spec.ts triggers.service.spec.ts triggers.web-chat.spec.ts` → **4 suites passed, 139 passed / 1 skipped(무관한 사전 존재 `structural anchor` placeholder, 이 diff 밖)**.
- `npx jest src/modules/triggers` (전체 트리거 스위트) → **9 suites passed, 258 passed / 1 skipped**, RESOLUTION 이 주장한 "257→258" 수치와 일치.
- `npx tsc -p tsconfig.json --noEmit` (전체, `*.spec.ts` 포함) → 197건 에러가 있으나 전부 이번
  diff 와 무관한 파일(예: `alerts-evaluator.service.spec.ts`, `websocket.gateway.spec.ts` 등)이고
  이번 diff 대상 파일(`chat-channel-binder.service.ts`/`.spec.ts`, `trigger-callback-url.ts`/
  `.spec.ts`, `triggers.service.ts`/`.spec.ts`, `triggers.module.ts`, `triggers.web-chat.spec.ts`)
  관련 에러는 **0건**. `tsconfig.build.json` 은 `*.spec.ts` 를 제외하므로 이 197건은 4단계
  `build` ratchet 의 사각지대이며 사전 존재 상태로 판단된다(이 diff 가 새로 만든 것이 아님).
- `remove()` 배선 뮤턴트(해당 줄 주석 처리) → 타겟 테스트 **RED** 로 독립 재현(§발견사항 2번 참조).

## 요약

이 diff 는 `TriggersService` 의 private 메서드 3개를 `ChatChannelBinderService`/
`buildTriggerCallbackUrl` 로 옮기는 순수 리팩터이며, 이미 3라운드의 `/ai-review` 를 거치며
"새 클래스 경계가 생기면서 아무도 단언하지 않던 자리"(콜백 URL 조립 규칙, `teardown` 의
adapter-호출 분기, `remove()`→binder 배선, `rotateBotToken` 의 config 키 read)를 순차적으로
찾아 뮤테이션으로 검증된 테스트를 추가해 왔다. 이번 라운드에서 그 해소 상태를 소스 대조와
독립 `jest`/`tsc` 실행, 그리고 최신 배선 테스트에 대한 자체 뮤테이션 재현(RED 확인)으로
재검증했으며, 새로운 CRITICAL/WARNING 급 테스트 갭은 발견되지 않았다. 유일한 잔여 관측은
선택적 개선 여지(성공 경로에서 `warn` 미호출 단언 부재)와, 리뷰 과정에서 실제로 재현된
scratch 복원 지연(최종적으로 클린 확인) 두 건으로, 둘 다 이 PR 을 막을 사유가 아니다.

## 위험도

NONE
