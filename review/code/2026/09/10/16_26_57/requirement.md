# 요구사항(Requirement) 리뷰 — `trigger-workflow-ref` 캐너리, 3라운드 (13번째 수정 이후)

대상: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts` · `trigger-workflow-ref.spec.ts` ·
`codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` + 관련 plan/review 문서.

이번 라운드 지시 범위는 좁다 — (1) case E docstring 의 R-CC-10 경고문이 `spec/5-system/15-chat-channel.md`
와 line-level 로 일치하는지, (2) 2라운드에 새로 쓴 세 서술(헬퍼 파일 스코프 `//` 註 · self-spec 가드
순서 규약 문장 · `id` 판별 fixture 근거)의 사실관계, (3) e2e 쪽 축약 포인터가 실제 존재하는 자리를
가리키는지. SPEC-DRIFT(§3)와 사전 존재 CRITICAL 2건은 이미 이관·등재됐으므로 재지적하지 않는다.

## 검증 방법

- `spec/5-system/15-chat-channel.md` 의 R-CC-10 본문(§608-612)·§5.4 표(§376-378)·CCH-SE-04/04-C(§90-91)·
  DDL 주석(§285-286)을 `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` case E docstring 과
  line-by-line 대조.
- `triggers.service.ts` 의 `setupChatChannel()`(PATCH+chatChannel 경로, :915-1000)과
  `rotateChatChannelBotToken()`(rotate 전용 경로, :1250-1360 부근)을 실제로 읽어 "PATCH 는 grace 백업·
  전용 audit action·`chatChannelRotatedAt` 갱신을 모두 건너뛴다"는 주장을 코드로 재현.
- `jest.config.ts`·`test/jest-e2e.json`·`tsconfig.build.json`(backend) 세 설정 파일의 현재 내용을 직접
  읽어 헬퍼 파일 스코프 `//` 註의 각 문장과 대조.
- `production-build-devdep-guard.ts`(`resolveBuildFileNames`/`findDevDepLeaks`)를 읽어 "감지 가드가
  아직 없다" 주장을 검증(가드는 root 파일 후보의 자체 import 만 보고 relative-import 경유 exclude
  디렉터리 도달은 보지 않음 — 주장과 일치).
- `grep -rln "shared/testing" src --include="*.ts"` 로 "production import 0건" 을 재확인.
- `git show HEAD:<path>` 로 커밋된 정본 라인 번호를 프롬프트 diff 게이트와 대조(작업 중 다른
  reviewer 의 뮤테이션이 워킹트리에 있어 아래 "관측한 이상 상태" 참고).
- `review/code/2026/09/{06/01_13_50, 10/14_34_18, 10/15_52_06}` 및 `review/consistency/2026/09/10/15_23_41`
  의 실제 파일을 열어 코드가 인용하는 `Wn`/`①②③④⑤` 라벨이 그 문서의 실제 순번과 일치하는지
  SUMMARY.md/RESOLUTION.md 의 정본 넘버링과 대조.
- `git log -p -- codebase/backend/src/shared/testing/trigger-workflow-ref.ts` 로 "고아 JSDoc 세 번"
  문장이 도입된 커밋(`64334e708`)의 전체 커밋 메시지를 확인하고, 사용자 memory
  `feedback_my_own_fix_is_the_next_defect.md`(수정일 2026-09-06, `#1292`)의 "orphan JSDoc(세 번)"
  기록과 시점을 비교.
- `git log --oneline -S "CREATOR_PROJECTION" -- codebase/` + 커밋 `08fbf133d` 본문으로 "동일 리터럴
  4중 복사 → Critical → 단일 상수 통합" 선례 인용을 재검증.

## 관측한 이상 상태 (내가 만들지 않음) — 계약에 따라 보고

리뷰 도중 `git status --short` 에 ` M codebase/backend/src/shared/testing/trigger-workflow-ref.ts` 가
나타났다 — `git diff` 확인 결과 `expect(workflow).not.toBeNull();`(HEAD 기준 123행) 한 줄이 지워진
상태였다. 다른 reviewer 의 진행 중인 뮤테이션 실험으로 보인다. 나는 이 파일을 Read/`git show HEAD:`
로만 열람했고 Write/Edit 를 호출하지 않았다. 이후 재확인 시점(`git status --short`)에는 이미 원복돼
있었다 — 최종 상태는 clean. 이하 모든 줄 번호 인용은 `git show HEAD:<path>` 기준 정본(=프롬프트 diff
게이트와 동일)을 사용했다.

## 발견사항

- **[WARNING]** 헬퍼 파일 스코프 `//` 註의 "고아 JSDoc 을 이 저장소가 이미 세 번 겪었다" 라는 이력
  주장이 **자기 인용 시점에 이미 네 번째를 가리키고 있다** — 인용한 근거 자체가 "세 번째"가 아니라
  "이번(4번째)" 사례다.
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts:24-26`
    (`// 이 절을 /** */ 가 아니라 // 로 적는 것은 일부러다 — ... 고아 JSDoc 이 되고, 그 형태를 이
    저장소가 이미 세 번 겪었다 (review/code/2026/09/10/15_52_06 maintainability W1).`)
  - 상세: 사용자 memory `feedback_my_own_fix_is_the_next_defect.md`(수정일 2026-09-06, `#1292` 세션
    기준)는 "orphan JSDoc(세 번)" 을 이미 별개의 세 사례로 기록해 뒀다 — 전부 이 PR(`trigger-workflow-ref-canary`,
    2026-09-10)보다 앞선, 다른 브랜치(`#1292`)의 사건이다. 그런데 이 문장이 인용하는
    `review/code/2026/09/10/15_52_06` `maintainability` W1 은 **바로 이 파일**(`trigger-workflow-ref.ts`)의
    orphan 메인 독스트링을 이번 PR·이번 세션(2026-09-10, 즉 memory 갱신일 이후)에 새로
    찾아낸 발견이다 — `15_52_06` 리포트 자신도 "프로젝트 메모리가 이미 'orphan JSDoc 3번'을
    반복 결함 클래스로 기록해 둔 것과 **정확히 같은 형태**다" 라고 적어, 이 발견을 memory 의
    세 건과 **별개의, 추가** 사례로 취급한다. 즉 memory 의 3건 + 이번 파일의 1건(15_52_06 이 찾은
    바로 그 사례) = 이 문장을 쓰는 시점 기준 **최소 네 번째**다. 코드가 쓴 "이미 세 번 겪었다" 는
    정확히 이 문장을 성립시키는 근거(`15_52_06` W1)를 인용하면서 그 근거 자체를 세 번 중 하나로도,
    별도의 네 번째로도 명시하지 않아 — 읽는 사람은 "이 사례와 무관한 세 개의 선행 사례가 있다" 로
    오독하기 쉽지만 실제로는 "이 사례를 포함해 최소 네 번" 이 맞다. 같은 커밋(`64334e708`)의
    커밋 메시지 안에서 바로 몇 줄 아래, 경로 오기(`/api/` 누락)에 대해서는 저자 스스로 **"내 근거
    문장이 부정확한 **네 번째** 사례"** 라고 정확히 세면서, 바로 위 orphan JSDoc 항목에는 memory
    의 stale 한 "세 번" 을 그대로 옮겨 적어 갱신하지 않았다 — 같은 커밋 안에서 카운팅 정확도가
    비대칭이다.
  - 제안: "이미 세 번 겪었다" → "이미 세 번 겪었고(`#1292`, `feedback_my_own_fix_is_the_next_defect.md`),
    이번이 **네 번째**다" 로 정정하거나, 인용 대상을 memory 파일로 바꾸고 `15_52_06` W1 은 "이번
    회귀의 근거" 로 별도 표기한다. 기능에 영향 없는 테스트 전용 주석이라 CRITICAL 은 아니지만,
    이 세션이 이미 "근거 문장을 네 번 틀렸다"고 스스로 기록한 패턴(assertMatchesContract 범위 ·
    tsconfig exclude · User 선례 · 경로 `/api/`)에 다섯 번째로 들어맞는 형태다.

## 점검 관점별 확인 결과 (문제 없음 — 근거 기록용)

1. **R-CC-10 경고문의 spec 일치 (초점 1)** — `spec/5-system/15-chat-channel.md:608-612`(R-CC-10 본문)·
   `:376-378`(§5.4 표, PATCH 차단 근거 3항: 즉시 단절·grace 일관성 붕괴·audit mixing)·`:90-91`(CCH-SE-04/04-C,
   grace 24h + v2 컬럼)·`:285-286`(DDL 주석, `chat_channel_token_v2`/`chat_channel_rotated_at`)을
   `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts:223-239`(case E docstring)와 대조한 결과
   **line-level 로 일치**한다.
   - 엔드포인트 경로 `POST /api/triggers/:id/chat-channel/rotate-bot-token` — spec `:90`/`:610`/`:376`
     과 정확히 일치(1라운드 W1 로 `/api/` 가 이미 보정됨, 재지적 아님).
   - "24h grace 백업" — spec `:285`("rotation grace (24h) 동안 old bot token 백업 용")·
     `:91`(`chat_channel_token_v2` v2 ref) 과 어휘까지 일치. 코드로도 재현: `rotateChatChannelBotToken`
     은 `oldPlaintext !== null` 이면 `secrets.rotate(v2Ref, ...)` 로 백업하는데(`triggers.service.ts:1301-1306`),
     `setupChatChannel`(PATCH 경로, case E 가 타는 분기)은 `secrets.rotate(botTokenRef, ...)` 로 **직접
     덮어쓸 뿐** v2Ref 백업이 없다(`triggers.service.ts:947-952`) — "건너뛴다" 주장이 코드로 확인됨.
   - "전용 audit action" — spec `:378`("audit log 가 `trigger.updated` 와
     `trigger.chat_channel_bot_token_rotated` 로 mixed"). 코드 확인: `rotateChatChannelBotToken` 은
     `AUDIT_ACTIONS.TRIGGER_CHAT_CHANNEL_BOT_TOKEN_ROTATED` 를 기록(`:1352-1358`)하지만, `update()`(case
     E 가 타는 경로)는 `chatChannel` 재조회 **이전에** `AUDIT_ACTIONS.TRIGGER_UPDATED` 만 기록하고
     (`:516-521`) `setupChatChannel` 경로 안에는 별도 `recordAudit` 호출이 없다 — "전용 action 을
     건너뛴다" 주장이 코드로 확인됨.
   - "`chatChannelRotatedAt` 갱신" — `rotateChatChannelBotToken` 은 `triggerRepository.update(...,
     {chatChannelRotatedAt: rotatedAt, ...})`(`:1338-1349`)로 갱신하지만, `setupChatChannel` 경로는
     그 컬럼을 전혀 건드리지 않는다 — 주장이 코드로 확인됨.
   - "single-path" 표현 — spec 의 제목("R-CC-10. Bot Token 변경 single-path (rotate API only)")과
     본문("PATCH body 의 `botTokenRef` 변경은 차단한다")을 그대로 반영.
   이 CRITICAL 은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 로 이관·등재돼
   있으므로(review/code/2026/09/10/14_34_18 api_contract ④) 여기서는 재지적하지 않고 spec 일치
   여부만 확인한다.

2. **헬퍼 파일 스코프 `//` 註의 사실관계** — `trigger-workflow-ref.ts:3-26`.
   - `jest.config.ts`(`rootDir: 'src'`, `testRegex: '.*\.spec\.ts$'`) + `test/jest-e2e.json`
     (`testRegex: '.e2e-spec.ts$'`) 실측 확인 — `test/helpers/*.spec.ts` 는 unit jest(`rootDir:'src'`
     라 `test/` 밖 스캔 안 함)에도, e2e jest(`.e2e-spec.ts$` 만 매칭)에도 걸리지 않는다는 주장이
     설정 파일 내용과 정확히 일치.
   - `tsconfig.build.json:20` 의 `"src/shared/testing/**"` exclude 항목 확인. "exclude 는 root
     파일 후보만 거르고, exclude 되지 않은 파일이 import 하면 dist 로 emit 된다" — 이 tsc 동작
     자체는 `review/code/2026/09/10/14_34_18/side_effect.md` W1 이 `tsc --listFiles` + 실제 `dist/`
     산출로 이미 재현했고, 인용도 정확하다(같은 파일의 첫 WARNING = W1).
   - "production import 0건" — `grep -rln "shared/testing" src --include="*.ts"` 로 재확인, 0건.
   - "그 회귀를 감지할 가드는 아직 없다" — `production-build-devdep-guard.ts` 의
     `findDevDepLeaks`/`resolveBuildFileNames` 를 읽은 결과, 이 가드는 `ts.parseJsonConfigFileContent`
     의 root 파일 목록만 순회하며 각 파일 **자신의** import specifier 를 검사한다. relative import
     (`packageRootOf` 가 `.`/`/` 시작 시 `null` 반환)는애초에 패키지 유출 판정 대상이 아니므로,
     "exclude 되지 않은 파일이 exclude 된 디렉터리를 relative import 로 끌어와 dist 로 emit" 되는
     이번 케이스는 이 가드의 탐지 범위 밖이 맞다 — 주장이 정확하다.
   - "이 형태를 이 저장소가 이미 세 번 겪었다" 문장만 부정확 — 위 발견사항 참조.

3. **self-spec 가드 순서 규약 문장** — `trigger-workflow-ref.spec.ts:15-21`.
   - 헬퍼(`trigger-workflow-ref.ts`) 함수 본문의 실행 순서: dto not-null(:106-107) → 비밀 컬럼(:110-112)
     → present:false(:114-118) → present:true(:121-123, hasOwn + not-null) → 키셋(:125-126) → id
     타입(:127) → id UUID(:129) → name 타입(:130) → name 길이(:131) → expectedWorkflowId(:133-135).
   - self-spec 의 실제 `it()` 배치가 이 순서를 정확히 따른다(가드 1~10 주석 마커 + 순서 일치,
     `null` 판정 테스트는 명시 마커는 없지만 present:true 와 키셋 사이에 정확히 위치해 실제 코드의
     `expect(workflow).not.toBeNull()` 자리와 맞음). `15_52_06 maintainability W3` 이 지적한
     "신규 4케이스가 가드 순서를 두 지점에서 깼다" 문제가 이번 라운드에 실제로 재배열로 해소됐음을
     확인했다 — 문장과 코드가 일치.

4. **`id` 판별 fixture 근거** — `trigger-workflow-ref.spec.ts:113-138`.
   - `isUuidShaped('42')` 를 `common/utils/uuid.ts` 의 정규식(`^[0-9a-f]{8}-...`)으로 직접 평가하면
     false — 즉 `id:42` 로는 `expect(typeof ref.id)` 를 지워도 다음 줄 `isUuidShaped(String(42))`
     가 어차피 던져 vacuous 하다는 `15_52_06 testing W1`(이 파일의 유일한 WARNING, 순번 일치)의
     결론이 정확하다.
   - 교체된 fixture `{ id: { toString: () => WF_ID }, name: 'W' }` 는 `typeof` 가 `'object'`(타입
     단언 있으면 즉시 거부) 이면서 `String(...)` 은 `WF_ID`(유효 UUID shape, 단언 없으면 통과)로
     변환되어 — 정확히 "타입 단언 유무로만 갈리는" 값이다. 두 가드가 이 값에서만 갈린다는 주장이
     맞다.

5. **e2e 축약 포인터 실재 확인** — 아래 전부 실제 파일의 실제 발견사항에 정확히 착지함(SUMMARY.md/
   RESOLUTION.md 의 정본 넘버링과 대조):
   - `review/code/2026/09/06/01_13_50` W4 (e2e-spec.ts:24-25, "생성 응답에만 없다" JSDoc 갭) →
     `01_13_50/RESOLUTION.md:39` 가 동일 사안을 "W4 (requirement)" 로 명명, 내용 일치.
   - `review/code/2026/09/10/14_34_18` testing W1/W2/W3 (trigger-workflow-ref.ts:98,105 / spec.ts:154) →
     `14_34_18/SUMMARY.md:39-41` 표와 W-번호·내용 모두 일치(W1=identity 갭, W2=dto null 갭,
     W3=name typeof vacuous).
   - `review/code/2026/09/10/14_34_18` side_effect W1/W2 (trigger-workflow-ref.ts:19 / e2e-spec.ts:152) →
     `14_34_18/side_effect.md` 의 첫/둘째 WARNING(tsconfig exclude 맹점 / secret_store 고아 row)과
     순번·내용 일치.
   - `review/code/2026/09/10/14_34_18` api_contract ④ (e2e-spec.ts:230) → `14_34_18/api_contract.md:84`
     의 "### [CRITICAL] ④ PATCH 가 chat-channel bot-token single-path 정책을 실질적으로 우회한다"와
     정확히 일치.
   - `review/code/2026/09/10/15_52_06` maintainability W2/W3 (e2e-spec.ts:30 / spec.ts:19) →
     `15_52_06/maintainability.md` 의 둘째(중복 서술)/셋째(조립 순서) WARNING과 순번·내용 일치.
   - `--impl-done` `15_23_41` rationale_continuity W1 (e2e-spec.ts:239) →
     `review/consistency/2026/09/10/15_23_41/rationale_continuity.md:16` 의 유일한 WARNING
     ("캐너리 case E 가 R-CC-10 위반 응답을 코드 주석 없이 200 으로 고정한다")과 일치 — 이 지적이
     정확히 case E docstring 신설의 계기가 됐다는 서술과 부합.
   - `CREATOR_PROJECTION` 선례 인용(trigger-workflow-ref.ts:39) — 커밋 `08fbf133d` 본문의
     "투영 리터럴이 네 곳에 복제돼 있었다(W1) ... 그 복제가 Critical 의 원인" 서술과 "4중 복사 →
     Critical → 단일 상수 통합" 요약이 정확히 일치. `User` 선례 인용 철회(이전 라운드에서 이미
     처리, 재지적 아님)와 달리 이 신규 인용은 정확하다.

## 요약

이번 라운드의 핵심 요구사항(R-CC-10 경고문의 spec line-level 일치, 2라운드 신규 서술 세 건의
사실관계, e2e 축약 포인터의 실재성)을 개별 실측으로 확인한 결과 거의 전부 정확했다 — 특히 이전
라운드에 세 번 틀렸던 근거 문장 패턴이 이번 R-CC-10/jest-config/가드순서/fixture 서술에서는
재발하지 않았다. 유일한 예외는 헬퍼 파일 스코프 `//` 註의 "고아 JSDoc 을 이 저장소가 이미 세 번
겪었다"는 이력 주장으로, 이 문장이 인용하는 바로 그 근거(`15_52_06` maintainability W1)가 memory
에 기록된 세 건과 무관한 **새로운(최소 네 번째)** 사례이므로 "세 번" 은 이 문장을 쓰는 시점 기준
이미 낡았다 — 같은 커밋이 몇 줄 아래 경로 오기는 정확히 "네 번째"로 세면서 이 항목만 memory 의
stale 한 숫자를 그대로 옮겨 적어 비대칭이다. 기능·판정 로직에는 영향 없는 테스트 전용 주석의
사실관계 문제이므로 CRITICAL 은 아니나, 이 세션이 스스로 기록한 "근거 문장을 네 번 틀렸다" 패턴에
다섯 번째로 해당할 수 있어 WARNING 으로 남긴다. 리뷰 도중 다른 reviewer 의 진행 중 뮤테이션을
관측했으나(계약에 따라 보고) 최종적으로 원복돼 있음을 확인했다. SPEC-DRIFT(§3)와 사전 존재
CRITICAL 2건은 이미 이관·등재됐으므로 본 리포트에서 재지적하지 않았다.

## 위험도

LOW — 신규 코드 결함 없음. 발견된 유일한 WARNING 은 테스트 전용 주석의 역사적 사실 정확도
문제이고 런타임 동작·계약·spec 일치 여부에는 영향이 없다.

STATUS: success
