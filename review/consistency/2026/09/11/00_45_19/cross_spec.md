# Cross-Spec 일관성 검토 — `spec/5-system` (chatChannel PATCH 비밀 차단, impl-done, 4라운드째)

## 검토 범위와 방법

`--impl-done` 모드, scope=`spec/5-system`, diff-base=`origin/main`. 이 브랜치의 `spec/5-system` 델타는
**0개 파일**(`spec_impact: none`)이라, 검토 대상은 "구현이 기존 spec 여러 영역의 정의와 충돌하는가"다.

프롬프트 번들이 예산 초과로 `15-chat-channel.md`·`git diff` 본문 등 16개 파일을 생략했으므로,
워킹트리(`/Volumes/.../impl-chat-channel-patch-token-a17c4e`)를 **절대경로**로 직접 열어 확인했다.
주의: 이 세션 초반 `/Volumes/project/private/clemvion/spec/...` (워크트리 접두 없는 경로)로 읽은 결과는
**다른 체크아웃**(별도 worktree)이었음을 뒤늦게 발견해 폐기하고, 아래는 전부
`/Volumes/project/private/clemvion/.claude/worktrees/impl-chat-channel-patch-token-a17c4e/...` 절대경로
재확인 결과다.

- `git diff origin/main...HEAD --stat` 로 6개 커밋의 전체 델타(코드 5파일, docs 7파일, plan/review 다수) 확인.
- 이전 라운드 산출물(`review/consistency/2026/09/11/00_21_57/cross_spec.md` 등 4개 선행 라운드)을 읽고,
  그 라운드 이후 유일한 신규 커밋(`5976587c7` — slack/discord 사용자 가이드 mdx 4개 + 테스트 판별력
  보강 8줄 + `plan/in-progress/spec-draft-nullable-notation-followups.md` 갱신)이 새 cross-spec 충돌을
  만드는지 집중 검증했다.
- `triggers.service.ts`(D-1/D-2/D-3 핵심 로직), `chat-channel-config.dto.ts`(`ChatChannelUpdateConfigDto`),
  `update-trigger.dto.ts`, `trigger-dto-validation.spec.ts`(`[실측]` 케이스)를 diff·전문 대조.
- `spec/5-system/15-chat-channel.md` §5.4.1/§5.4.1.1/R-CC-21, `spec/2-navigation/2-trigger-list.md`
  §2.3.1/R-12/PATCH 표, `spec/5-system/3-error-handling.md` §2.1(`details[].field` 중첩 경로 규약),
  `spec/5-system/1-auth.md` §3.2 RBAC 매트릭스, `spec/1-data-model.md` §2.8 Trigger 를 대조.

## 발견사항

이번 라운드에서 **새로 발견한 CRITICAL/WARNING 은 없다.** 직전 라운드(`00_21_57`)가 이미 등재한 두
WARNING 은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 후속으로 정확히
추적되고 있고, 이번 신규 커밋(`5976587c7`)은 그 상태를 변경하지 않았음을 재확인했다. 아래는 참고용
재확인 사항이다.

- **[WARNING, 재확인 — 신규 아님]** `details.field` flat vs 중첩 경로
  - target 위치: `spec/5-system/15-chat-channel.md` L375(botToken 값 축 — *"details.field 는
    미확정 — 후속 e2e 확인 대기"*), L392(inboundSigningPlaintext 축 — 동일 미확정 문구);
    `spec/2-navigation/2-trigger-list.md` L176 PATCH 註(동일 미확정 문구), L120(`botTokenRef`
    행 — `details.field='botTokenRef'` **확정형**으로 적혀 있으나 실측은 이 필드도 값이 있으면
    중첩)
  - 충돌 대상: `spec/5-system/3-error-handling.md` §2.1(`details[].field` 는 `nodes[3].type` 같은
    중첩/배열 경로가 canonical). `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts`
    의 신규 `[실측]` 테스트(`botToken`/`inboundSigningPlaintext`/`botTokenRef`/`inboundSigningRef`/
    `inboundSigning` 5필드 전부, 비어있지 않은 값일 때 `chatChannel.<field>` 로 emit — `L846-866`)
  - 상세: SoT 스스로 "미확정"이라 정직하게 표시해 둔 자리이고, 이번 PR 의 단위 테스트가 그 답을
    측정했다(`chatChannel.botToken` 등). 다만 이 측정은 **단위(pipe 직접 호출) 테스트**이지 spec
    문구가 요구하는 "e2e 확인"은 아니다 — `trigger-workflow-ref.e2e-spec.ts` 캐너리 case E 는 성공
    경로(200)만 고정하고 이 400 계약 자체를 e2e 로 재확인하지 않는다. planner 가 이 실측으로
    "미확정"을 지울 때, 근거 문구를 "e2e 확인"이 아니라 "단위(전역 ValidationPipe) 확인"으로
    정확히 적는 것이 좋다.
  - 제안: 이미 followups 트래커에 planner 후속으로 등재됨(§5.4.1·§5.4.1.1 placeholder,
    `2-trigger-list.md:120,176` 정정 대상). 추가로 **"e2e" 라는 근거 매체 표현**을 "단위 테스트
    (`CustomValidationPipe` 직접 호출)"로 정정할 것을 함께 등재 권고 — 사소하지만 다음 사람이
    "e2e 로 확인됐다"로 오독하면 실제 HTTP round-trip 검증 없이 그 상태를 확정하게 된다.

- **[INFO, 재확인 — 신규 아님]** `SecretResolver.store()` vs `.rotate()` 명명 — `15-chat-channel.md`
  L373/L390 등 여전히 `.store()` 로 서술하지만 실제 호출은 전부 `.rotate()`. 직전 라운드가 이미
  CRITICAL 이 아닌 WARNING/planner 후속으로 확정했고, 이번 신규 커밋은 이 서술을 건드리지 않았다 —
  상태 불변.

- **[INFO, 재확인 — 신규 아님]** `assertChatChannelAlreadySetUp` 의 두 신규 400 분기
  (`details.field='chatChannel'` 최초 부착 차단, `details.field='provider'` 전환 차단)은 여전히
  `spec/5-system/15-chat-channel.md` §5.4.1 표와 `spec/2-navigation/2-trigger-list.md` PATCH
  註에 구체적 에러 계약으로 반영돼 있지 않다. 정책 자체(§5.4.1 표 1행 "최초 트리거 생성은 POST
  한정", R-12 "provider 변경하려면 삭제·재생성")와는 **모순 없음** — 문서 완결성 갭일 뿐이다.
  이미 `spec-draft-nullable-notation-followups.md` 에 `--impl-done 00_21_57 W3` 근거로 등재됨.

## 검증되어 충돌 없음으로 재확인된 항목

- `ChatChannelUpdateConfigDto`(`OmitType` + `@IsEmpty()`)는 `15-chat-channel.md` R-CC-21·§5.4.1·
  §5.4.1.1 이 서술하는 정책과 정확히 일치 — telegram server-issued 축(쓰기 ③)만 무조건 유지되는
  것도 R-CC-21 상단 caveat("telegram 의 server-issued `issuedInboundSigning` 은 대상이 아니다")과
  정확히 일치한다.
- §5.4.1 표 2행("트리거 활성화 PATCH 가 setupChannel 을 재호출하는지 미확정")은 spec 스스로 이미
  "확인 중"이라 정직하게 표시해 둔 상태이며, 이번 diff 는 `update()` 의 `if (chatChannel)` 게이트를
  바꾸지 않아 그 불확정 상태를 악화시키지도 해소하지도 않는다 — 새로운 충돌 아님.
- `assertPatchCarriesNoSecrets`/`assertChatChannelAlreadySetUp` 은 모두 `triggerRepository.save()`
  **이전**에 던져지므로, 거부된 PATCH 가 `spec/5-system/1-auth.md` §4.1 감사 카탈로그에 없는 유령
  `trigger.updated` 항목을 남기지 않는다 — 신규 감사 계약 충돌 없음.
- `chatChannelRotatedAt` 갱신 지점(`triggers.service.ts:1558`)은 rotate 전용 엔드포인트 경로에만
  있고 이번 PR 의 PATCH 게이팅 로직과 무관 — §5.4 single-path 계약 유지.
- RBAC(§3.2 Trigger: Editor=CRUD)·데이터 모델(§2.8 Trigger `chat_channel_*` 컬럼)은 이번 diff 가
  건드리지 않아 여전히 정합.
- 신규 slack/discord 사용자 가이드(`slack.mdx`/`discord.mdx`/`telegram.mdx`/`telegram.en.mdx`/
  `triggers.mdx`/`triggers.en.mdx`)가 명시하는 `details.field='chatChannel.botToken'` 은 코드
  실측(`trigger-dto-validation.spec.ts`)과 정확히 일치 — 가이드 자체의 정확성은 문제 없다. 다만
  이 가이드가 **SoT 인 `spec/5-system/15-chat-channel.md`/`2-navigation/2-trigger-list.md` 보다
  먼저** 확정값을 서술하게 된 비대칭이 생겼다(SoT 는 여전히 "미확정" 문구 유지) — 이는 위
  WARNING 항목의 연장이며 별도 신규 충돌로 세지 않았다.

## 요약

직전 4개 라운드(`21_37_56`·`22_45_26`·`23_54_09`·`00_21_57`)에 걸쳐 이미 식별·추적된 두 WARNING
(`.store()`/`.rotate()` 명명, `details.field` flat vs 중첩)과 한 INFO(신규 400 분기의 SoT 미반영)는
이번 라운드에서도 여전히 유효하지만 **전부 `plan/in-progress/spec-draft-nullable-notation-followups.md`
에 planner 후속으로 등재돼 있고 상태 변화가 없다.** 이번 라운드가 커버한 유일한 신규 델타
(`5976587c7` — slack/discord 사용자 가이드 mdx 4개 + 테스트 판별력 보강 + followups 註 갱신)는
코드 실측과 정확히 일치하는 순수 문서 보강이며, 새로운 CRITICAL/WARNING 을 만들지 않는다. 다만
그 가이드가 SoT spec 보다 먼저 `details.field` 확정값(`chatChannel.botToken`)을 노출하게 된
비대칭은 기존 WARNING 의 연장으로 재확인해 둔다. `spec/5-system`·`spec/2-navigation`·`spec/conventions`
전 영역에 걸쳐 이 구현을 무효화할 만한 직접 모순은 없다.

## 위험도

LOW
