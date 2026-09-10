# Plan 정합성 검토 — chatChannel PATCH 비밀 유출 차단 (impl-chat-channel-patch-token)

## 검토 범위

- Target: `spec/5-system` (scope 델타 0개 파일 — 이번 PR 은 spec 미변경, `spec_impact: none`)
- 실 diff: `codebase/backend` triggers 모듈 11파일 / ~1,100줄 (DTO 분리 `ChatChannelUpdateConfigDto` ·
  `assertChatChannelInputSafe` mode 분기 · `assertPatchCarriesNoSecrets` · `assertChatChannelAlreadySetUp` 신설)
- 대조한 plan: `plan/in-progress/impl-chat-channel-patch-token.md`(target plan) ·
  `plan/in-progress/spec-draft-nullable-notation-followups.md`(두 CRITICAL 의 origin·후속 트래커) ·
  `plan/in-progress/chat-channel-{discord-gateway,slack-socket-mode,visual-ssr-png}.md`(같은 spec 영역
  backlog, 충돌 없음 확인)

## 발견사항

- **[WARNING] `details.field` 실측이 끝났는데 target spec 세 곳이 여전히 "미확정" 이고, 파생 공개 문서는 이미 확정값을 노출한다**
  - target 위치: `spec/5-system/15-chat-channel.md` §5.4.1 (L375) · §5.4.1.1 (L392),
    `spec/2-navigation/2-trigger-list.md` L176 — 셋 다 `details.field` 를
    `**미확정 — 후속 e2e 확인 대기**` 로 표기 중
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` "§5.4.1 · §5.4.1.1 의
    `details.field` 문면이 실제 페이로드와 다를 수 있다" 항목 — **2026-09-11 실측 완료**로
    갱신됐지만 체크박스는 여전히 `[ ]` (planner 미착수)
  - 상세: 그 항목의 실측표는 이미 확정됐다 — 비어있지 않은 값을 보내면 전역
    `CustomValidationPipe` 가 **중첩 경로**(`chatChannel.botToken`, `details` 배열)로 거부하고,
    `null`/`''` 를 보내면 `@IsEmpty()` 를 통과해 서비스 가드가 **flat**(`botToken`, `details`
    단일 object)으로 거부한다. 정본은 `trigger-dto-validation.spec.ts` 의 두 `[실측]` 케이스.
    그런데 target spec 세 곳은 여전히 "미확정" 이다. 더 나아가 **이번 diff 가 같은 PR 에서 함께
    고친 공개 문서**(`codebase/frontend/src/content/docs/02-nodes/triggers.mdx`,
    `.../06-integrations-and-config/telegram.mdx`)는 이미 `details.field='chatChannel.botToken'`
    이라는 확정값을 사용자에게 공지하고 있다 — SoT(`spec/`)보다 파생 문서(공개 docs)가 먼저
    확정값을 노출하는 역전이 생겼다. developer 는 `spec/` 쓰기 권한이 없어 옳게 planner 로
    위임했지만, 측정이 끝난 시점부터 이 역전은 즉시 관측 가능한 상태다.
  - 제안: planner 턴에서 위 실측표를 `15-chat-channel.md` §5.4.1/§5.4.1.1 과
    `2-trigger-list.md:176`(및 언급된 `:119-120`)에 반영. 선행 조건(e2e 확인)은 이미 충족됐으므로
    지연 사유가 없다.

- **[WARNING] `SecretResolver.store()` vs 실제 `rotate()` 불일치가 이번 PR 이 손댄 같은 절 안에 그대로 남아있다**
  - target 위치: `spec/5-system/15-chat-channel.md` L200, L201, L373, L390 (추가로 예산 밖:
    `conventions/chat-channel-adapter.md:354,359` · `4-nodes/7-trigger/providers/telegram.md:58,219` ·
    `providers/slack.md:278`)
  - 관련 plan: `spec-draft-nullable-notation-followups.md` "spec 7~9곳이 `SecretResolver.store()`
    라 적는데 chat-channel 경로는 `rotate()` 만 쓴다" — `[ ]` planner 미착수 (`--impl-prep`
    `22_45_26` 및 `--impl-done` `23_54_09` 가 각각 독립 재확인)
  - 상세: chat-channel 비밀 저장 호출 전수가 `rotate()` 이고 `secrets.store(` 는 0건인데,
    이번 PR 이 §5.4.1 표(L367 이하)를 대폭 갱신하면서도 바로 그 표의 L373·L390 의 `store()`
    오기는 손대지 않았다 — 같은 절을 두 번 편집하면서도 인접 오기를 놓친 형태라 다음 사람이
    또 같은 자리에서 틀릴 위험이 높다.
  - 제안: 위 followups 항목에 이미 대상 9곳이 열거돼 있으므로, 다음 planner 턴에서 §5.4.1
    갱신과 함께 일괄 정정을 권장.

- **[WARNING] 신규 검증 분기(최초 chatChannel 설정·provider 전환 PATCH 차단)가 plan·spec 어디에도 등재되지 않았다**
  - target 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` 신설
    `assertChatChannelAlreadySetUp` — `details.field='chatChannel'`(최초 설정 차단),
    `details.field='provider'`(provider 전환 차단). 대응하는 spec 서술 없음
    (`spec/5-system/15-chat-channel.md` §5.4.1 표에 해당 행 없음)
  - 관련 plan: `plan/in-progress/impl-chat-channel-patch-token.md` 의 설계(D-1/D-2/D-3)에 이
    함수가 없다 — D-1/D-2 가 만드는 부작용(빈 `chatChannel` PATCH 가 secret 을 못 찾아
    `setupChatChannel` best-effort catch 에 조용히 `degraded` 로 앉는 문제)을 막기 위해 구현
    중 추가된 파생 결정으로 보이나, 어느 checklist 항목에도 등재가 없다
  - 상세: `git show origin/main:.../triggers.service.ts` 확인 결과 이런 가드는 이전에 없었다 —
    즉 PATCH 로 `chatChannel.provider` 를 바꾸거나 없던 채널을 처음 붙이는 것이 (실패하긴
    했겠지만) 이 명시적 400 형태로 막힌 적은 없었다. `2-trigger-list.md` R-12/§2.3.1 이 이미
    "provider 는 read-only, 변경하려면 삭제·재생성" 이라 **선언은 돼 있었으므로** 기존 결정과
    충돌하지는 않지만(오히려 선언을 code-level 로 처음 강제한 것), 새로 노출되는 두
    `details.field` 값('chatChannel', 'provider')은 어느 스펙 표에도 등재되지 않아 다음 사람이
    이 에러 표면의 존재를 모를 수 있다.
  - 제안: `spec-draft-nullable-notation-followups.md` 또는 `15-chat-channel.md` §5.4.1 표에 이
    두 케이스와 `details.field` 값을 planner 후속으로 추가 등재. CRITICAL 은 아니다 — 기존
    선언과 상충하지 않고 방향도 fail-closed 강화다.

- **[INFO] 완료 선언이 시점상 이르다 — `plan/complete/impl-chat-channel-patch-token.md` 를 인용하지만 실제 경로는 아직 `plan/in-progress/`**
  - target 위치: 해당 없음 (plan-to-plan)
  - 관련 plan: `spec-draft-nullable-notation-followups.md` L1976·L2031 "✅ 2026-09-11 해소 … 근거:
    `plan/complete/impl-chat-channel-patch-token.md`" vs 실제
    `plan/in-progress/impl-chat-channel-patch-token.md`(`find` 로 확인, 아직 `in-progress/`)
  - 상세: 대상 plan 은 아직 두 체크리스트 항목이 미완료다 — `/consistency-check --impl-done
    spec/5-system`(바로 이 리뷰) 과 "수렴 예외로 남긴 INFO 5건". lifecycle 이동은 이 두 항목이
    끝난 뒤에나 일어나는데, followups 문서는 이미 이동이 끝난 것처럼 경로를 인용했다.
  - 제안: 이 리뷰가 BLOCK:NO 로 닫히고 plan 이 실제 `plan/complete/` 로 이동한 뒤 참조를
    확정하거나, 지금은 "in-progress (완료 임박)" 로 표기.

## 확인했지만 문제 없음 (참고)

- `chat-channel-discord-gateway.md` / `chat-channel-slack-socket-mode.md` / `chat-channel-visual-ssr-png.md`
  는 모두 `status: backlog`, 다른 진입 조건 대기 중이며 이번 diff 와 겹치는 코드 경로가 없다 —
  충돌 없음.
- `15-chat-channel.md` frontmatter 의 `pending_plans` 3건은 모두 `plan/in-progress/` 에 실재한다
  (dangling 없음) — followups.md 가 지적했던 항목은 이미 해소된 상태.
- R-CC-21 의 "PATCH 는 어떤 비밀도 받지 않고 쓰지 않는다" 산문이 telegram server-issued 축까지
  넓게 읽히는 문제는 planner PR #1313 으로 이미 좁혀져 있음을 target 문서(§5.4.1 L380, R-CC-21
  L735 이하)에서 확인 — 코드(`triggers.service.ts` 의 "쓰기 ③ 무조건 유지" 주석)와 정합.
  플랜 checklist 의 해당 항목도 `[x]` 로 정합하게 마감돼 있다.
- `impl-chat-channel-patch-token.md` 의 `spec_impact: none` 선언은 실제 diff(코드 전용)와
  일치하고, target 문서(`spec/5-system`) 변경 0건 실측과도 일치한다 — 불일치 없음.
- DTO 분리(`ChatChannelUpdateConfigDto`, `OmitType` 사용), 검증 경로 mode 분기, `stripChatChannelPlaintext`
  타입 확장은 plan 의 D-1/D-3 설계 문서와 diff 가 정확히 일치한다.

## 요약

이번 PR 은 plan(`impl-chat-channel-patch-token.md`)이 목표한 두 CRITICAL(단일 경로 우회·
`ChatChannelCard` 저장 400)을 설계대로 닫았고, 상위 plan(`spec-draft-nullable-notation-followups.md`)의
관련 항목들도 정확히 대응해 갱신했다 — 미해결 결정을 일방적으로 뒤집거나 선행 조건을 건너뛴
CRITICAL 은 발견되지 않았다. 다만 (1) 이번 PR 자신이 완료한 `details.field` 실측이 target spec
세 곳에는 아직 반영되지 않은 채 공개 문서에는 이미 확정값이 노출돼 SoT-파생문서 역전이 생겼고,
(2) 기존에 추적되던 `store()`/`rotate()` 표기 불일치가 같은 절을 편집하면서도 그대로 남았으며,
(3) 구현 중 추가된 신규 검증 분기(최초 설정·provider 전환 차단)가 어느 문서에도 등재되지 않아
누락 위험이 있다. 셋 다 planner 후속 턴으로 짧게 닫을 수 있는 수준이라 즉시 차단 사유는 아니다.

## 위험도

MEDIUM
