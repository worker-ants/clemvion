# 문서화(Documentation) 리뷰 — `impl-chat-channel-binder-t2` (4라운드, `19_30_49`)

## 검증 방법

`git log origin/main..HEAD` 기준 5커밋(`a2e5b7e16` 이동 · `7e9aaa736` plan 후속 등재 ·
`92f4b0607`/`8f43b1f56`/`68bb34e73` 1~3라운드 `/ai-review` 수정)을 확인했다. 이 diff 는 이미
문서화 관점에서 **3라운드** 검토를 거쳤으므로(`review/code/2026/09/11/{18_04_36,18_42_05,19_06_54}/documentation.md`),
이번 라운드는 (a) 직전 라운드가 남긴 WARNING 이 실제로 해소됐는지 재현 확인, (b) 신규 코드/주석의
JSDoc·spec 인용이 실재하는지 독립 검증, (c) 새 결함 유무 확인에 집중했다.

- `chat-channel-binder.service.ts`·`trigger-callback-url.ts`(+두 spec)를 `Read` 로 전문 열람.
- `triggers.service.ts`/`triggers.service.spec.ts` diff 를 `git diff origin/main` 으로 직접 대조해
  이동 후 남은 주석이 옛 심볼을 가리키지 않는지 확인(`buildCallbackUrl`/`setupChatChannel` grep).
- JSDoc 이 인용하는 spec 좌표(`§5.4.1.1`, `R-CC-21`, `CCH-AD-02`, `CCH-AD-03`, `CCH-SE-01`,
  `WH-MG-04`) 를 `spec/5-system/15-chat-channel.md`·`spec/5-system/12-webhook.md` 에서
  grep 으로 실재 확인.
- 3라운드 문서화 리뷰(`19_06_54`)가 남긴 WARNING(plan 코드 스케치 잔여 위치-인자 예시,
  `plan/in-progress/impl-chat-channel-binder-t2.md:88`)이 이후 커밋(`68bb34e73`)으로 실제
  해소됐는지 `git show`+grep(`buildTriggerCallbackUrl(this\.|buildTriggerCallbackUrl(baseUrl`)
  으로 재현 확인(잔여 0건).
- 이 리뷰는 저장소에 어떤 뮤테이션도 가하지 않았다. 다만 세션 종료 시점 `git status --short` 에서
  **다른 리뷰어(추정)가 만든 미커밋 변경 1건**을 관측했다 — 아래 별도 항목으로 보고한다.

## 발견사항

- **[INFO]** (이월, 새 결함 아님 — 3라운드 연속 관측) `chat-channel-binder.service.ts` 클래스
  JSDoc 이 아직 `plan/in-progress/` 에 있는 plan 을 `plan/complete/impl-chat-channel-binder-t2.md`
  경로로 선인용한다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:18`
    (``TriggersService` 에서 그대로 옮겨왔다 (동작 보존, `plan/complete/impl-chat-channel-binder-t2.md`).``)
  - 상세: 직접 확인 결과 plan 은 지금도 `plan/in-progress/impl-chat-channel-binder-t2.md` 에 있다
    (`plan/complete/` 에 동명 파일 없음). 1~3라운드가 이미 지적했고, 이는 새 결함이 아니라
    **마무리 커밋에서 `plan/complete/` 로 옮길 때 함께 해소되도록 설계된 상태**다 — plan 체크리스트에
    `- [ ] plan/complete/ 이동` · `- [ ] 이동 후 plan/complete/impl-chat-channel-binder-t2.md 실재
    확인 — chat-channel-binder.service.ts JSDoc 이 그 경로를 인용한다` 두 항목이 명시적으로 걸려
    있고(`impl-chat-channel-binder-t2.md:208-211`) 아직 미체크(`[ ]`) 상태다. 즉 지금 시점에는
    링크가 깨져 있는 것이 맞지만, 그 사실 자체가 이미 인지·계측돼 있다.
  - 제안: 조치 불요(이번 라운드 범위 밖). `plan/complete/` 로 이동하는 마무리 커밋에서 그
    체크리스트 항목으로 실재 여부를 검증할 것 — 이동을 빠뜨리면 이 링크가 영구히 깨진 채로
    `plan/complete/` 아카이브에 남는다.

- **[INFO]** (문서화 범위 밖 — 저장소 위생 관측, 병렬 리뷰어 뮤테이션 추정) 세션 종료 시점
  `git status --short` 에 이 리뷰가 만들지 않은 미커밋 변경이 남아 있었다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:855`
    — `await this.chatChannelBinder.teardownChatChannel(trigger);` 줄이
    `// MUTATION-TEST-REMOVED: await this.chatChannelBinder.teardownChatChannel(trigger);` 로
    치환된 상태로 관측됨(`git diff` 로 직접 확인).
  - 상세: 이 리뷰(documentation)는 이 파일을 수정하지 않았다. 정확히 이 지점은 3라운드
    `/ai-review`(`19_06_54`) 가 지적한 WARNING 1(`remove()` → `teardownChatChannel` 위임을 검증하는
    테스트 부재)을 검증하기 위한 뮤테이션 형태와 일치한다 — 아마 병렬로 도는 `testing` 계열
    reviewer 가 신규 테스트("remove 는 chat-channel teardown 을 binder 에 위임한다")가 실제로
    이 뮤턴트를 RED 로 잡는지 실측하는 중일 가능성이 높다. 같은 클래스의 워크트리 오염이
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 **4회째 재발**로
    등재돼 있다(1~3라운드 각 1회 + 이번 라운드 1회). 이 리뷰는 저장소 뮤테이션 금지 규약에 따라
    이 파일을 되돌리지 않았다(`git checkout`/`git restore` 미사용).
  - 제안: 이 관측을 무시하지 말 것 — SUMMARY 통합 시점에 해당 reviewer 가 정상적으로 원복했는지
    `git status --short` 로 재확인 필요. 트래커 항목(워크트리 오염 재발)에 5회째로 이번 관측을
    추가하는 것을 고려.

## 긍정적으로 확인된 사항

- **3라운드 WARNING 완전 해소 확인** — `plan/in-progress/impl-chat-channel-binder-t2.md` 의
  잔여 위치-인자 코드 스케치(`buildTriggerCallbackUrl(this.configService.get('app.url'), path)`)가
  `68bb34e73` 로 이름 인자 형태(`buildTriggerCallbackUrl({ baseUrl: ..., endpointPath: ... })`)로
  정정됐다. `grep -rn "buildTriggerCallbackUrl(this\.\|buildTriggerCallbackUrl(baseUrl"
  codebase/backend/src plan/in-progress` 재현 결과 **잔여 0건**.
- 같은 커밋이 직전 라운드(`18_42_05`) `RESOLUTION.md` 의 오기재("완전 해소")를 **삭제하지 않고
  `⚠️ 정정 (3라운드에서 드러났다)` 블록을 덧붙이는 방식**으로 고쳤다 — 리뷰 이력을 소급 편집하지
  않고 정정 사실 자체를 남기는 이 저장소의 좋은 관례를 따른다.
- `TriggersService.remove()` → `ChatChannelBinderService.teardownChatChannel` 위임을 고정하는
  신규 테스트(`triggers.service.spec.ts` "remove 는 chat-channel teardown 을 binder 에 위임한다")의
  JSDoc 주석이 **뮤테이션 실측치**(9,598개 전부 GREEN)와 이전 회귀의 형제 관계(1라운드 W2)를
  정확히 인용한다 — 과장·추측 없이 실측만 기술.
- 신규 파일 `chat-channel-binder.service.ts`·`trigger-callback-url.ts` 의 JSDoc 이 인용하는 spec
  좌표를 전수 grep 으로 실재 확인했다 — `§5.4.1.1`·`R-CC-21`·`CCH-AD-02`·`CCH-AD-03`·`CCH-SE-01`·
  `WH-MG-04` 전부 `spec/5-system/15-chat-channel.md`/`12-webhook.md` 에 실재하며 서술 내용도
  일치한다. 존재하지 않는 spec 앵커를 인용하는 "가짜 근거"가 없다.
  - `trigger-callback-url.ts` 의 JSDoc 이 언급하는 자매 파일(`chat-channel-input-rules.ts`) 과
    선례(`chat-channel-token-rotator.service.ts`)도 실재를 확인했다.
- `triggers.service.ts` 에서 `setupChatChannel`/`teardownChatChannel`/`buildCallbackUrl` 이
  삭제된 자리 주변에 남은 주석을 전수 grep 한 결과, 옛 클래스를 가리키는 죽은 링크 없이 모두
  `this.chatChannelBinder.X(...)` 호출부 또는 `chat-channel-binder.service.ts` 로 갱신된 포인터를
  가리킨다(예: `:564` `` "3-쓰기 표는 `chat-channel-binder.service.ts` 의 `setupChatChannel`
  JSDoc 에 있다"``).
- `chat-channel-binder.service.spec.ts` 헤더 JSDoc 이 "왜 `setupChatChannel` 은 여기서 다시
  덮지 않는가"를 근거(뮤테이션 3종 RED 실측)와 함께 명시해, 다음 사람이 커버리지 공백으로
  오인하지 않도록 선제 설명한다.
- `triggers.module.ts` 의 갱신된 주석("TriggersService 와 ChatChannelBinderService 가 …
  둘 다 쓴다 — TriggersService 는 rotateBotToken·remove 경로에서, Binder 는 setup/teardown
  에서")은 실제 두 registry 사용처와 일치한다(직접 대조).
- **README/CHANGELOG/API 문서**: 이 diff 는 컨트롤러·DTO·엔드포인트·환경변수를 건드리지 않는
  순수 내부 리팩터(`spec_impact: none`)다. `CHANGELOG.md` 는 이 저장소에서 사용자 관측 가능한
  동작 변경에만 항목을 쌓는 관례인데(현재 `## Unreleased` 항목도 검증 로직 변경 건), 이번 diff 는
  동작을 보존하므로 항목 추가가 불필요하다 — 직전 두 라운드의 `user_guide_sync.md` 가
  doc-sync-matrix 전수 대조로 이미 확인한 결론과도 일치한다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이번 T2 turn 이 추가한 후속
  항목들(`--impl-prep` W1~W4, INFO 1·3, `TriggersService:` 로그 리터럴 잔존, `run-test.sh`
  `NOT_DEFINED` exit 0 등)은 각각 실측·귀속·처분 근거를 갖추고 있어 트래커 문서로서 품질이
  일관되게 유지되고 있다.

## 요약

4라운드째 재검토 결과 CRITICAL/WARNING 급 신규 문서화 결함은 없다. 3라운드가 남긴 유일한
WARNING(plan 코드 스케치 잔여 위치-인자 예시)은 이후 커밋(`68bb34e73`)에서 완전히 해소됐음을
독립적으로 재현 확인했고, 그 수정 방식(원 RESOLUTION 을 지우지 않고 정정 블록 추가)도 적절하다.
남은 문서화 관측 하나(`chat-channel-binder.service.ts` 의 `plan/complete/` 선인용)는 3라운드
연속 이월된 known-temporary 상태로 plan 체크리스트가 이미 관리하고 있어 조치 불요다. 별도로,
이 리뷰가 만들지 않은 병렬 리뷰어 추정 뮤테이션(`triggers.service.ts:855` 의
`MUTATION-TEST-REMOVED` 치환)을 저장소 위생 차원에서 기록해 SUMMARY 통합 시 원복 여부 재확인을
요청한다 — 이는 문서화 결함이 아니라 리뷰 프로세스 관측이다. 신규 코드
(`ChatChannelBinderService`, `buildTriggerCallbackUrl`)의 JSDoc 은 설계 근거·기각 대안·spec
인용·회귀 캐너리를 모두 갖췄고, 그 spec 인용들을 전수 grep 으로 실재 검증한 결과 허위 인용이
없었다. README/CHANGELOG/OpenAPI 문서 갱신은 이 순수 내부 리팩터 범위에서 불필요하다.

## 위험도

NONE
