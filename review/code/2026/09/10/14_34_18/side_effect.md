# 부작용(Side Effect) 리뷰 — `trigger-workflow-ref-canary`

대상: 신규 파일 3개(프로덕션 코드 변경 없음, `git show --stat HEAD` 로 확인 — `codebase/backend/src/**/*.ts` 중
변경된 것은 `src/shared/testing/trigger-workflow-ref.{ts,spec.ts}` 뿐이고 둘 다 신규 파일).

## 발견사항

### [WARNING] `tsconfig.build.json` exclude 만으로는 "프로덕션 코드가 이 파일을 import 하면 dist 로 샌다" 는 실패 모드를 못 막는다 — 가드도 이 형태를 못 잡는다 (구조적 공백, 이 PR 이 새로 만든 것은 아님)

- 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts:34-39`(exclude 를 근거로 "production 빌드 오염도 없다" 고 적은 docstring) ·
  `codebase/backend/tsconfig.build.json:20`(`"src/shared/testing/**"` exclude 항목) ·
  `codebase/backend/src/repo-guards/__tests__/production-build-devdep-guard.ts:26-36`(`resolveBuildFileNames`) ·
  `codebase/backend/src/repo-guards/__tests__/production-build-devdep.spec.ts:73-82`(`it.each(['shared/testing', ...])`)
- 상세: 저자의 주장("`tsconfig.build.json` 이 `src/shared/testing/**` 을 통째로 exclude 해 dist 로 못 나간다")과
  이를 뒷받침한다고 인용된 가드(`production-build-devdep.spec.ts`)를 scratch 디렉터리에서 실제 `tsc` 로
  재현해 검증했다.
  - `ts.parseJsonConfigFileContent()`(가드의 `resolveBuildFileNames` 가 쓰는 바로 그 API)는 **glob
    include/exclude 만 평가**한다 — 어떤 파일이 다른 (exclude 되지 않은) root 파일에서 실제로
    `import` 되는지는 전혀 보지 않는다. 그래서 `src/shared/testing/**` 아래 파일은 이 함수의 반환값에
    **항상** 없다.
  - 그런데 실제 `tsc -p tsconfig.build.json`(= `nest build` 가 쓰는 것과 같은 컴파일)은 다르게 동작한다.
    scratch 재현: `src/main.ts` 가 `./shared/testing/helper.ts`(exclude 패턴에 걸리는 경로)를 import 하도록
    만들고 `tsc --listFiles` 를 돌리자 그 파일이 프로그램에 포함됐고, **`dist/shared/testing/helper.js`
    로 실제 emit** 됐다(`find dist -type f` 로 직접 확인). `exclude` 는 "root 파일 후보"만 걸러낼 뿐,
    남은 root 파일이 그 경로를 import 하면 tsc 는 그 파일을 프로그램에 편입시키고 그대로 컴파일한다.
  - 즉 `production-build-devdep.spec.ts` 의 `'shared/testing' 는 빌드 대상이 아니다` 단언은 **현재
    상태(0건 import)에서는 참이지만, 미래에 어떤 프로덕션 파일이 실수로 `shared/testing/**` 를
    import 하게 되는 정확히 그 회귀를 감지하지 못한다** — `resolveBuildFileNames()` 의 결과 집합
    자체가 애초에 그 케이스를 담을 수 없는 API 위에 서 있기 때문이다. 이 가드는 "exclude 항목이
    나중에 좁혀지거나 지워지는" 회귀는 잡지만(가드 자신의 docstring 이 명시한 목적), "exclude 된
    디렉터리를 누가 import 로 뚫는" 회귀는 애초에 탐지 범위 밖이다.
  - **현재는 안전하다** — `grep -rn "shared/testing" src --include="*.ts"` 로 전수 확인한 결과
    `shared/testing/**` 밖에서 그 디렉터리를 import 하는 프로덕션 파일은 **0건**이다(자기 자신의
    docstring 인용 3건뿐). 이번 PR 의 `trigger-workflow-ref.ts` 도 어떤 것도 import 하지 않는
    self-contained 파일이라(ambient `expect` 만 사용) devDependency 를 직접 끌어오지도 않는다.
  - **이 문제는 이 PR 이 새로 만든 것이 아니다** — `tsconfig.build.json` 의 exclude 패턴 자체가
    2026-08-27/09-08 에 이미 두 차례 늘어난 이력(주석에 기록됨)이 있고, 그 exclude+가드 조합의
    설계가 원래 이 blind spot 을 갖고 있었다. 이번 PR 은 그 디렉터리에 다섯 번째 파일을 하나 더
    추가했을 뿐이다. 다만 헬퍼 docstring 이 "그래서 production 빌드 오염도 없다" 고 **단정적으로**
    적어, 다음 사람이 이 exclude 가 구조적으로 완전하다고 오인할 위험을 그대로 물려받는다.
- 제안: (a) 이 PR 스코프에서는 조치 불필요 — 현재 import 그래프는 깨끗하고, 이번에 추가된 파일도
  devDependency 를 끌어오지 않는다. (b) 후속으로 `production-build-devdep-guard.ts` 에 "실제 `tsc`
  프로그램이 확장한 파일 집합"(예: `ts.createProgram(fileNames, options).getSourceFiles()`)과
  `resolveBuildFileNames()` 의 차집합을 구해, exclude 된 파일이 프로그램에 편입되면 실패하는 캐너리를
  하나 추가하는 것을 검토할 가치가 있다 — 지금은 그 실패 모드를 감지할 수단이 저장소 안에 없다.

### [WARNING] e2e `afterAll` 이 raw SQL 삭제만 하고 `TriggersService.remove()` 를 거치지 않아 `secret_store` 고아 row 를 남긴다 — 자매 e2e 파일과 동일한 기존 관례이지 이 PR 의 신규 결함은 아니다

- 위치: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts:123-130`(`afterAll` — `DELETE FROM trigger
  WHERE id = $1` 만 수행) · 대조: `codebase/backend/src/modules/triggers/triggers.service.ts` 의 `remove()`
  (`teardownChatChannel` → `channelListenerRegistry.unregister` → `secrets.deleteByPrefix('secret://triggers/${trigger.id}/')`
  → `triggerRepository.remove()` 순서로 실행되는 실제 서비스 삭제 경로)
- 상세: `beforeAll`(:110-120)에서 `chatChannel: { provider: 'telegram', botToken: '111:e2eWfRefBotToken' }`
  로 트리거를 생성하면, `triggers.service.ts` 의 `setupChatChannel()` 이 외부 호출 **이전에** 이미
  `this.secrets.rotate(botTokenRef, ...)` 로 `secret_store` 에 row 를 쓴다(코드상 `secrets.rotate` 호출이
  `adapter.setupChannel()` 호출보다 먼저다). 이후 telegram 호출이 실패하면 `catch` 블록이 도는데, 그
  블록 자신의 주석이 명시한다 — *"secret_store 에 botToken 저장 완료 후 setupChannel 실패 … secret_store
  row 는 남아 있음. remove() 시 deleteByPrefix 로 정리."* 즉 `secret_store` row 는 오직 `remove()` API
  경로(`DELETE /api/triggers/:id`)를 타야 정리된다.
  이 e2e 파일의 `afterAll` 은 그 API 를 부르지 않고 `db.query('DELETE FROM trigger WHERE id = $1', …)` 로
  직접 DB 를 지운다. `migrations/V063__secret_store.sql` 이 명시하듯 `secret_store` 테이블은
  `workspace_id` FK 조차 없고 "application-level cascade" 로만 정리되므로(주석: *"workspace_id FK 없음
  — application-level cascade (TriggersService.delete / workspace 삭제 시 명시적 cleanup)"*), raw SQL
  삭제는 **`secret://triggers/<chatTriggerId>/bot-token` row 를 그대로 남긴다.**
  다만 이것은 이 PR 이 새로 만든 패턴이 아니다 — 자매 e2e 파일 `chat-channel-trigger-create.e2e-spec.ts`
  가 telegram/slack/discord 세 provider 로 다수의 chatChannel 트리거를 만들면서 **똑같이** `afterAll` 에서
  raw `DELETE FROM trigger` 만 수행한다(:66-73). 이 PR 의 plan 자체도 "teardown 은 이웃 e2e 파일들의
  보일러플레이트를 그대로 따른다" 고 명시적으로 밝히고 있어 의도된 관례 준수다. 실질 피해는 e2e
  스키마가 **CI 실행 단위로 ephemeral**(컨테이너/볼륨 재생성)하다는 전제로 완화된다(`test/helpers/db.ts`
  docstring: *"ephemeral schema 이므로 누적 cleanup 은 불필요"*) — 즉 한 세션 안에서는 고아 row 가
  남지만, 다음 CI 실행에서는 사라진다.
- 제안: 이번 PR 단독으로 고칠 필요는 없다(자매 파일과의 일관성이 더 중요). 다만 "row 삭제가
  불필요하다"는 기존 convention_compliance 리뷰의 판단은 **trigger 테이블 자체에는** 맞지만
  `secret_store` 처럼 FK 없이 애플리케이션 계층에서만 정리되는 테이블에는 그대로 적용되지 않는다는
  점을 후속(예: `PROJECT.md` e2e teardown 가이드 또는 별도 트래커 항목)에 한 줄 남겨 두는 것을 권한다
  — 그래야 다음 chatChannel e2e 작성자가 "row 삭제 불필요" 관례를 `secret_store` 잔존까지 검증한
  것으로 오인하지 않는다.

### [INFO] Channel listener registry — 이번 시나리오에서는 정리 누락이 실질 영향 없음

- 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1017-1022`(`setupChatChannel` 성공
  경로에서만 `channelListenerRegistry.register()` 호출) · `codebase/backend/src/modules/chat-channel/channel-listener.registry.ts:26-28`(in-memory `Map`, 프로세스 수명 동안 유지되는 모듈 싱글턴)
- 상세: `register()` 는 `try` 블록의 **성공** 분기에만 있고, telegram 호출 실패 시 도는 `catch` 분기에는
  없다. e2e 에 mock 이 없고 bot token 도 가짜(`'111:e2eWfRefBotToken'`)라 설령 DNS 가 즉시 실패하지
  않고 실제로 telegram 서버에 도달하더라도 진짜 Telegram 이 그 토큰을 거부해 `setWebhook`/`getMe` 가
  `ok:false` 를 반환하므로 성공 경로에 도달할 수 없다. 즉 이 e2e 가 만드는 두 chatChannel 트리거는
  **`ChannelListenerRegistry` 에 절대 등록되지 않는다** — `afterAll` 이 `unregister()` 를 안 불러도
  정리할 것이 없다. 프롬프트가 요청한 "레지스트리 정리" 점검 항목은 이 파일 한정으로는 위반이 없다.

### [INFO] BullMQ job — 해당 없음 (webhook 타입 트리거만 생성)

- 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1074-1094`(`syncScheduleActivation` —
  `scheduleRunner.registerJob`/`removeJob` 은 `type === 'schedule'` 트리거에만 호출됨) · 이 e2e 는
  `type: 'webhook'` 트리거 2개만 생성(`test/trigger-workflow-ref.e2e-spec.ts:100,113`)
- 상세: BullMQ job 등록/해제는 schedule 타입 트리거 전용 경로(`syncScheduleActivation`, `remove()` 안의
  schedule 분기)에서만 일어난다. 이 e2e 는 schedule 트리거를 만들지 않으므로 BullMQ 잔존 job 위험이
  구조적으로 없다.

### [INFO] Ambient `expect()` 사용 — 두 jest 설정 모두 안전, production import 경로 0건 확인

- 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts:70,73-75,77-94`(모두 `expect(...)` 를
  import 없이 사용)
- 상세: 자매 헬퍼 `schedule-trigger-ref.ts`(`src/shared/testing/schedule-trigger-ref.ts:43,48,50`)가 동일
  패턴을 이미 쓰고 있어 신규 관례가 아니다. 두 jest 설정(`codebase/backend/jest.config.ts` — unit,
  `rootDir:'src'`, `testRegex:'.*\.spec\.ts$'` / `codebase/backend/test/jest-e2e.json` — e2e,
  `testRegex:'.e2e-spec.ts$'`) 어디에도 `injectGlobals:false` 가 없어 jest 는 기본값대로 `expect` 를
  전역에 주입한다 — 두 러너 모두에서 안전하다. `tsconfig.json` 에 `"types"` 제한이 없어 `@types/jest`
  가 전 소스에 ambient 로 걸리므로 컴파일 타임에도 `expect` 참조는 에러 없이 해석된다(이는 production
  코드에서 실수로 import 됐을 때 **컴파일 에러로 조기 발각되지 않는다**는 뜻이기도 하다 — 유일한
  방어선은 위 WARNING #1 에서 다룬 exclude/그 gap 이다). `expect` 는 함수 **본문**에서만 참조되고
  모듈 평가 시점(top-level)에는 호출되지 않으므로, 설령 이 파일이 비-jest 컨텍스트로 import 되더라도
  **import 시점에는 에러가 나지 않는다** — 실제로 그 함수가 *호출*되는 순간에만 `ReferenceError` 가
  난다. `grep -rn "shared/testing" src` 로 전수 확인한 결과 현재 그 경로를 참조하는 production 파일은
  0건이라 이 리스크는 이론적 단계에 머문다.

### [NONE] 그 외 부작용 관점 — 위반 없음

- **전역 변수/상태**: `TRIGGER_SECRET_COLUMNS`, `WORKFLOW_REF_KEYS`, `UUID_PATTERN`(`trigger-workflow-ref.ts:48,54,56-57`)
  은 모두 모듈 스코프 `const`(배열 2개는 `as const`) 이며 export 되지 않는다. 함수 본문은 인자로 받은
  `dto` 를 스프레드/캐스팅만 할 뿐 원본 객체를 mutate 하지 않는다(`record`/`ref` 는 새 참조).
- **시그니처/인터페이스 변경**: 신규 함수 `expectTriggerWorkflowRef(dto, opts)` 뿐 — 기존 함수/DTO
  시그니처 변경 없음(`git show --stat HEAD` 로 프로덕션 파일 diff 0건 확인).
- **환경변수**: 신규 env var 읽기/쓰기 없음. `E2E_BASE_URL` 은 기존 e2e 파일 전체가 이미 쓰는
  기존 변수의 재사용(`test/trigger-workflow-ref.e2e-spec.ts:49`).
- **네트워크 호출**: `chatChannel` 이 실린 두 자리(생성 1회, PATCH #5 1회)에서만 `api.telegram.org`
  outbound 가 발생한다는 plan 의 서술은 코드로 확인된다(`setupChatChannel` 은 `chatChannel` 필드가
  있을 때만 호출됨, `create()`/`update()` 양쪽에서 `if (chatChannel) await this.setupChatChannel(...)`
  형태). 두 호출 모두 요청 처리 흐름 안에서 `await` 되어 동기적으로 완료되며, 백그라운드로 남는
  fire-and-forget 프라미스나 재시도 타이머는 없다(재시도는 `TelegramClient` 내부에서 그 `await` 체인
  안에 있음). 이는 자매 파일 `chat-channel-trigger-create.e2e-spec.ts` 가 이미 다수 provider 로
  검증 중인 기존 패턴과 동일하다.
- **cross-suite 간섭**: `uniqueEmail`/`uniqueName`(`test/helpers/db.ts:19-27`)이 `Date.now()+
  Math.random()` 조합으로 충돌을 사실상 0 으로 만들고, `test/jest-e2e.json` 의 `maxWorkers: 1` 로 전체
  e2e 스위트가 순차 실행되어 파일 간 레이스 자체가 없다. workspace/user/workflow row 를 정리하지 않는
  것도 다른 모든 e2e 파일과 동일한 관례(ephemeral schema 전제)이며 이 PR 이 새로 도입한 패턴이 아니다.
- **뮤테이션 라운드 잔여물**: `git status --short` = 신규 리뷰 산출물 디렉터리(`review/code/2026/09/10/
  14_34_18/`, 이 리뷰 세션 자신의 산출물) 외 아무것도 없음. `git diff --stat HEAD -- codebase/backend/src/
  modules/triggers/triggers.service.ts` = 빈 출력(HEAD 와 완전 일치). `relations: ['workflow']` 수정은
  `triggers.service.ts:339,550` 양쪽에 여전히 존재 — plan 이 주장한 "뮤턴트는 `cp` 로 원복했다" 는
  서술이 실제 파일 상태와 일치한다. 이 호스트에서 `docker ps`/`docker images` 로 확인한 결과 `backend-e2e`
  관련 컨테이너·이미지 잔존물은 없음(단, 이 확인은 이 워크트리가 실행된 호스트 한정이며 CI 인프라
  자체의 상태까지 보증하지는 못한다).

## 요약

프로덕션 코드는 전혀 바뀌지 않았고(`git show --stat HEAD` 로 확인), 신규 3파일(헬퍼·self-spec·e2e)이
모두 자매 파일들의 기존 관례를 그대로 따른다. 가장 의미 있는 발견은 두 가지 WARNING 인데 둘 다 "이번
PR 이 새로 만든 결함"이 아니라 "기존 관례/가드가 원래 갖고 있던 한계를 이번 파일도 물려받는다"는
성격이다. ① `tsconfig.build.json` 의 `src/shared/testing/**` exclude 는 **현재는** 실제로 dist 유출을
막지만(0건 import 로 확인), 그 안전을 검증한다고 인용된 가드(`production-build-devdep.spec.ts`)는
`ts.parseJsonConfigFileContent()` 기반이라 "exclude 된 디렉터리를 나중에 누가 import 로 뚫는" 회귀는
구조적으로 탐지 불가능하다는 것을 scratch 재현(`tsc --listFiles` + 실제 `dist/` 출력)으로 직접
검증했다. ② e2e `afterAll` 이 `TriggersService.remove()` 를 우회해 `secret_store` 고아 row 를 남기는
것도 실측으로 확인했지만, 자매 e2e 파일이 이미 똑같이 하고 있어 이 PR 단독의 회귀는 아니다. 그 외
channel listener registry(등록 자체가 안 일어나 정리 불필요)·BullMQ(schedule 타입이 아니라 해당
없음)·ambient `expect`(자매 패턴과 동일, 두 jest 설정 모두 안전)·cross-suite 간섭(unique naming +
순차 실행)·뮤테이션 잔여물(git 상태 클린, 수정 유지 확인)은 모두 실측으로 위반 없음을 확인했다.

## 위험도

LOW — 실제 프로덕션 코드 변경이 0건이고, 발견된 두 WARNING 은 모두 (a) 현재는 실질적 피해가 없음이
실측으로 확인됐고 (b) 이 PR 이전부터 존재하던 저장소 관례/가드 한계를 그대로 물려받은 것이라 이 PR
자체가 새로운 부작용을 도입했다고 보기 어렵다. 다만 ①(가드 blind spot)은 향후 다른 developer 가
그 디렉터리를 실수로 import 하면 조용히 dist 로 샐 수 있는 구조적 공백이므로, 별도 하드닝 트래커
항목으로 남겨 둘 가치는 있다.
