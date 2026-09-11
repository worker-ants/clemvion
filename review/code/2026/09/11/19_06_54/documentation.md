# 문서화(Documentation) 리뷰 — `impl-chat-channel-binder-t2` (3라운드, `19_06_54`)

## 검증 방법

`git log origin/main..HEAD` 기준 4커밋(`a2e5b7e16` 이동 · `7e9aaa736` plan 등재 · `92f4b0607`
1라운드 수정 · `8f43b1f56` 2라운드 수정) 전부를 `git show`로 직접 열람했다. 앞의 세 커밋은
직전 두 라운드(`review/code/2026/09/11/18_04_36/documentation.md`,
`review/code/2026/09/11/18_42_05/documentation.md`)가 이미 상세히 검토했으므로, 이번 라운드는
**직전 라운드가 지적한 두 WARNING(② `@param` 태그 불일치, ③ plan 코드 스케치 stale)이 2라운드
수정(`8f43b1f56`)으로 실제 해소됐는지**를 직접 재확인하는 데 집중했다. `chat-channel-binder.service.ts`
· `trigger-callback-url.ts`(+두 spec 파일) 전문을 `Read`로 열어 JSDoc과 실제 시그니처를 대조했고,
`plan/in-progress/impl-chat-channel-binder-t2.md` 전문을 다시 읽어 설계 스케치·체크리스트 정합성을
확인했다. 저장소에는 어떤 뮤테이션도 가하지 않았다(`git status --short` 로 세션 시작·종료 시점
모두 이 리뷰가 만든 잔여물 없음을 확인).

## 발견사항

- **[WARNING]** plan 문서의 설계 스케치 두 곳 중 **한 곳만** 이름 인자로 정정됐다 — 나머지 한 곳은
  여전히 실제와 다른 위치 인자 호출 예시를 보여준다.
  - 위치: `plan/in-progress/impl-chat-channel-binder-t2.md:88`
    (`` (`buildTriggerCallbackUrl(this.configService.get('app.url'), path)`), **URL 형태도 fallback 도 한 자리**. ``)
  - 상세: 2라운드 문서화 리뷰(`review/code/2026/09/11/18_42_05/documentation.md` WARNING 2)가
    이 plan 문서에서 실제 시그니처(named-args 객체 1개)와 어긋나는 옛 위치-인자 스케치를 **두 곳**
    (당시 줄 번호 `:79`, `:84`) 지적했다. 뒤이은 수정 커밋(`8f43b1f56`)의 `RESOLUTION.md`는
    *"스케치를 이름 인자로 고치고… 각주로 달았다"* 며 **해소**로 분류했고, 실제로 `git show
    8f43b1f56 -- plan/in-progress/impl-chat-channel-binder-t2.md` 로 확인한 결과 `### 결정 — 순수
    함수로 뽑는다` 절의 코드 블록(현재 `:79`, `buildTriggerCallbackUrl({ baseUrl, endpointPath }):
    string`)은 이름 인자로 바뀌었고 "왜 바뀌었는지" 각주(`:82-84`)도 정확히 붙었다. **그러나 몇 줄
    아래 별도 불릿 안의 두 번째 인용문(현재 `:88`)은 그 커밋의 diff에 포함되지 않아 그대로
    남았다** — 지금도 `buildTriggerCallbackUrl(this.configService.get('app.url'), path)` 라는,
    최상위 인자 2개를 위치로 받는 옛 시그니처 형태 그대로다. 실제 호출부
    (`chat-channel-binder.service.ts:112-115`, `triggers.service.ts:1061-1064`)는 모두
    `buildTriggerCallbackUrl({ baseUrl: ..., endpointPath: ... })` 형태다. 기능에 영향은 없지만,
    "해소"로 표기된 RESOLUTION이 실제로는 지적된 두 곳 중 한 곳만 고쳤다는 점에서 **완료 처리
    자체가 부정확**하고, 이 plan은 곧 `plan/complete/`로 옮겨져 영구 기록이 되므로 지금 정정하는
    편이 싸다.
  - 제안: `:88`의 인용문을 `buildTriggerCallbackUrl({ baseUrl: this.configService.get('app.url'),
    endpointPath: path })` 형태로 맞추거나, `:82-84`처럼 "이 예시는 착수 시점 판본" 각주를 붙인다.

- **[INFO]** (이월, 새 결함 아님) `chat-channel-binder.service.ts:18`의 클래스 JSDoc이 아직 존재하지
  않는 `plan/complete/impl-chat-channel-binder-t2.md` 경로를 인용한다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:18`.
  - 상세: 1라운드(`18_04_36`) documentation/SUMMARY WARNING #4가 처음 지적했고, 2라운드
    (`18_42_05`) documentation 리뷰가 "여전히 미해소"로 재확인했으며, 이번 라운드에도 plan은
    여전히 `plan/in-progress/`에 있다(직접 확인). 이는 새 결함이 아니라 **마무리 커밋에서
    `plan/complete/`로 옮길 때 함께 해소되도록 이미 설계된 상태**다 — plan 체크리스트에
    `- [ ] 이동 후 plan/complete/impl-chat-channel-binder-t2.md 실재 확인` 항목이 명시적으로
    걸려 있다(`impl-chat-channel-binder-t2.md:204-206`).
  - 제안: 조치 불요(이번 라운드 범위 밖). `plan/complete/` 이동 시점에 그 체크리스트 항목으로
    검증할 것.

- **[INFO]** (이월, 새 결함 아님) spec 문서 3곳이 `setupChatChannel`의 소유 클래스를 옛 이름
  (`TriggersService`/`triggers.service.ts`)으로 서술한다.
  - 위치: `spec/conventions/secret-store.md`, `spec/conventions/chat-channel-adapter.md`,
    `spec/data-flow/14-chat-channel.md` (developer 권한 밖 — 이번 diff에 포함되지 않음).
  - 상세: `--impl-prep`(`review/consistency/2026/09/11/17_39_32` W2)가 발견해
    `plan/in-progress/spec-draft-nullable-notation-followups.md`에 planner 항목으로 이미 등재됐고
    (해당 진술의 "실질"은 여전히 참이며 "심볼 경로"만 stale임을 근거와 함께 명시), 자기-반증형
    소정정 조건 1(그 문장을 developer 자신이 쓴 것이 아님)이 불성립해 developer가 직접 고칠 수
    없는 자리임도 확인해 두었다. 추가 조치 불요.

## 긍정적으로 확인된 사항

- 2라운드 WARNING 1(`@param baseUrl`/`@param endpointPath` 태그가 구조분해 인자와 불일치)은
  실제로 완전히 해소됐다 — 현재 `trigger-callback-url.ts:50-53`은 `@param` 태그 없이 타입
  리터럴의 각 프로퍼티(`baseUrl`, `endpointPath`)에 직접 JSDoc을 달아 TS 관용을 따른다.
- `chat-channel-binder.service.ts`·`trigger-callback-url.ts`·두 신규 spec 파일의 JSDoc은
  설계 근거·기각한 대안·spec 교차 참조(`§5.4.1.1`, `R-CC-21` — 둘 다 `spec/5-system/15-chat-channel.md`에
  실재함을 확인)·회귀 캐너리 이름까지 코드 인접 지점에 남겨 이 저장소의 확립된 관례를 정확히
  따른다.
- `chat-channel-binder.service.spec.ts`의 `makeBinder` 헬퍼(2라운드 INFO 7 대응)와
  `afterEach(jest.restoreAllMocks)`(INFO 8 대응)는 실제로 이름 인자·정리 순서 문제 모두 고쳤고,
  각 수정 지점에 "왜 바뀌었는지"를 리뷰 경로와 함께 남겼다.
- `triggers.service.spec.ts`의 `rotateBotToken` describe에 추가된 키 인식 `ConfigService` mock
  주석(`:1897-1904`)과 `mockAdapter.setupChannel` 호출 인자 단언 강화 주석(`:1990-1993`)은
  실제 뮤테이션 실측(`'app.url'` → `'frontend.url'`)과 정확히 일치한다.
- `triggers.module.ts`의 갱신된 주석("TriggersService 와 ChatChannelBinderService 가 …
  둘 다 쓴다 — TriggersService 는 rotateBotToken·remove 경로에서, Binder 는 setup/teardown 에서")은
  `channelAdapterRegistry`/`channelListenerRegistry` 실사용처를 grep으로 대조한 결과와 일치한다.
- `triggers.service.ts`에 남은 주석 중 이동된 메서드를 가리키는 것들(예: `:564`
  "3-쓰기 표는 `chat-channel-binder.service.ts` 의 `setupChatChannel` JSDoc 에 있다")은 모두
  올바른 새 위치를 가리키도록 갱신됐다 — 옛 클래스를 가리키는 죽은 링크는 발견되지 않았다.
- README/CHANGELOG/환경변수 문서: 이 diff는 API·UI·spec·환경변수에 영향을 주지 않는 순수 내부
  리팩터(동작 보존, `spec_impact: none`)이므로 갱신 불요 — 직전 두 라운드의 `user_guide_sync.md`가
  doc-sync-matrix 21행 전수 대조로 이미 확인했고, 이번 라운드도 같은 결론이다.
- `rotate-bot-token` 엔드포인트의 OpenAPI 데코레이터 부재는 이 diff가 만든 것이 아닌 사전 존재
  갭이며(컨트롤러 파일 자체가 diff 밖), `plan/in-progress/spec-draft-nullable-notation-followups.md`에
  이미 등재돼 있다.

## 요약

3라운드째 반복 검토 결과 CRITICAL/차단급 문서화 결함은 없다. 직전 라운드가 지적한 두 WARNING 중
`@param` 태그 문제는 완전히 해소됐지만, "plan 코드 스케치 stale" 문제는 **지적된 두 곳 중 한 곳만
고쳐졌고 RESOLUTION.md는 이를 완전 해소로 잘못 기록**했다 — 기능에는 영향 없는 사소한 사례지만,
이 plan이 곧 `plan/complete/`로 영구 보존되는 점과 "내 수정이 다음 결함이 된다"는 이 저장소의
반복 패턴을 고려해 WARNING으로 남긴다. 그 외 이미 알려진 두 항목(`plan/complete/` 조기 참조,
spec 3곳의 귀속 stale)은 각각 마무리 체크리스트와 planner 인계로 정상 처리 중이며 이번 라운드가
새로 만든 문제가 아니다. 신규 코드(`ChatChannelBinderService`, `buildTriggerCallbackUrl`)의
JSDoc 품질은 설계 근거·기각 대안·spec 참조·회귀 캐너리를 모두 갖춰 이 저장소 관례를 정확히 따르고
있으며, README/CHANGELOG/OpenAPI 문서 갱신은 이 순수 내부 리팩터의 범위에서 불필요하다.

## 위험도

LOW
