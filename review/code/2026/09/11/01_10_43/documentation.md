# 문서화(Documentation) 코드 리뷰 — `impl-chat-channel-patch-token` (5라운드, 타겟)

## 개요

이 라운드는 `documentation` + `user_guide_sync` 만 강제된 타겟 라운드다. 대상 diff 는
`ChatChannelUpdateConfigDto`(D-1) 신설로 PATCH `chatChannel` 이 사용자 비밀
(`botToken`·`inboundSigningPlaintext`)을 더 이상 받지 않게 막는 백엔드 변경과, 그에 맞춘
JSDoc/Swagger/e2e 주석/사용자 문서(ko·en telegram·triggers·slack·discord) 동반 갱신이다.
이전 4라운드(`23_21_57`→`23_55_23`→`00_21_55`→`00_45_18`)가 이미 CRITICAL 2건(R-CC-10 우회,
`inboundSigningRef` fail-open)을 닫고 WARNING 다수(slack/discord 유저가이드 누락, orphan
JSDoc, `botTokenRef` JSDoc 낡은 flat 표기, JSDoc 내부 서사 유출)를 순차로 해소했음을 소스
대조로 재확인했다. 이번 라운드에서 실제 코드 파일(`chat-channel-config.dto.ts`,
`trigger-dto-validation.spec.ts`)을 직접 열어 확인한 결과, 4라운드가 보고한 수정 사항
(botTokenRef JSDoc 두 갈래 병기, `ChatChannelUpdateConfigDto` 내부 서사의 `//` 이동, orphan
JSDoc 재배치)은 모두 실제로 반영돼 있다.

## 발견사항

- **[WARNING]** 이 PR 이 닫는 CRITICAL 보안 우회 + wire 계약 변경에 대해 `CHANGELOG.md` 항목이
  없다. 이전 3개 라운드(`23_21_57`·`23_55_23`·`00_21_55` 의 `documentation.md`)가 "이 저장소는
  CHANGELOG 관례가 없다" 고 반복 서술했는데, 그 근거는 `codebase/backend`·`codebase/frontend`
  안에서만 `find`한 것이었다 — **저장소 루트에 `CHANGELOG.md` 가 실제로 존재**하고, 거의 모든
  `fix(backend)`/`feat`/`fix(api)`/`fix(dto)` 커밋이 `## Unreleased —` 절로 그 파일을 갱신한다.
  - 위치: 저장소 루트 `CHANGELOG.md` (이 diff 에 없음). 비교 대상: `plan/in-progress/spec-draft-nullable-notation-followups.md` 자신도 이 관례를 전제로 쓴다 — 예) 2행짜리 표현 "**wire 변경**이라 CHANGELOG 를 동반해야 한다"(followups 파일 1266행 부근), "`CHANGELOG.md` 에 동작 변경으로 등재"(558행 부근).
  - 상세: `git log --oneline -20 -- CHANGELOG.md` 로 확인한 결과 `08fbf133d`(`User` 비밀 컬럼 유출)·`bfa124920`(트리거 비밀 4축 유출 — 바로 이 chat-channel 트리거와 같은 모듈)·`f5d97aa39`·`4a92cb2bf`·`e55b3a74a`·`c6dcbacf6` 등 최근 backend 보안/계약 수정 커밋이 예외 없이 `CHANGELOG.md` 를 같은 커밋에서 갱신했다. 이번 PR 은 정확히 같은 클래스다 — (1) §5.4.1 R-CC-10 single-path 우회를 닫는 CRITICAL 보안 수정, (2) PATCH `chatChannel` 이 이제 `botToken`/`inboundSigningPlaintext` 를 400 으로 거부하고 최초 부착·provider 전환도 새로 400 을 내는 **의도된 breaking change**(`plan/in-progress/impl-chat-channel-patch-token.md` D-1/D-2 자신이 "breaking" 으로 표기). 직전 라운드(`00_21_55/SUMMARY.md` INFO#8)가 이 미기재를 지적했지만 "이미 검토·유지 결정된 사안(SDK 코드젠 지원 시 재검토)" 으로 처분했는데, 그 처분 사유는 **바로 옆 항목인 `writeOnly: true` OpenAPI 코드젠 이슈에만 논리적으로 들어맞고 CHANGELOG 축에는 사유가 붙어 있지 않다** — 두 서로 다른 발견이 한 줄에 묶여 한쪽 사유가 다른 쪽까지 덮은 형태다.
  - 제안: 마무리 커밋에서 `CHANGELOG.md` 에 `## Unreleased — ...` 절을 추가하거나(선례 형식: `bfa124920`), 정말 스코프 밖이라 판단하면 그 판단 근거를 CHANGELOG 축 하나로 명시해 `spec-draft-nullable-notation-followups.md` 에 등재한다. "이미 검토됨" 이라는 근거만으로는 재-flag 를 막기에 충분하지 않다 — 그 검토가 실제로는 다른 항목(writeOnly)의 처분이었다.

- **[INFO]** `triggers.mdx`/`triggers.en.mdx` 의 "Bot Token 회전 (single-path)" 절 제목이 이번
  diff 로 늘어난 본문 범위를 더 이상 정확히 설명하지 않는다.
  - 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` `### Bot Token 회전 (single-path)`(427행 부근) / `triggers.en.mdx` `### Rotating the bot token (single-path)`(416행 부근).
  - 상세: 직전 라운드(`review/code/2026/09/11/00_45_18/user_guide_sync.md`)가 지적한 "`chatChannel` 최초 부착 불가·provider 불변" 안내 누락을 이번 diff 가 정확히 그 절 바로 아래에 첫 문단으로 추가해 해소했다. 다만 그 결과 이 절은 이제 서로 다른 세 가지 400 사유(① chatChannel 최초 부착 금지, ② provider 전환 금지, ③ bot token PATCH 금지)를 담고 있는데 제목은 여전히 "Bot Token 회전(single-path)" 하나만 가리킨다. 목차만 보고 "provider 는 왜 못 바꾸나" 를 찾는 독자는 이 절을 건너뛸 수 있다.
  - 제안: 급하지 않음 — 다음에 이 문서를 편집할 때 제목을 "Chat Channel 설정 변경 제약" 류로 넓히거나, 첫 문단 앞에 소제목을 하나 더 두는 것을 고려. 기능·보안상 영향은 없다(내용 자체는 정확하고 완전하다).

## 확인한 것 — 이전 라운드 수정이 실제로 반영됨

- `chat-channel-config.dto.ts:189-195` — `botTokenRef` JSDoc 이 "비어있지 않은 값" 중첩 경로와 `null`/`''` flat 경로 두 갈래를 모두 정확히 서술한다(4라운드 item#3 수정 확인).
- `chat-channel-config.dto.ts:349-410` — `ChatChannelUpdateConfigDto` 클래스 JSDoc 은 소비자용 정보(필드 비교 표, `@see` spec 링크)만 남기고, `OmitType` 채택 이유·`Update` 접두 관례 등 **내부 서사**는 클래스 선언 바로 위 `//` 블록으로 옮겨져 있다 — `spec/conventions/swagger.md:315` 의 `introspectComments` 유출 규약을 정확히 지킨다.
- `trigger-dto-validation.spec.ts:757-868` — "5필드 details.field 실측" 관련 JSDoc 이 각각 올바른 테스트(`null`/`''` 케이스, 비어있지 않은 값 케이스) 위에 재배치돼 있다(4라운드 item#2 "orphan JSDoc" 수정 확인). `details.field` 가 값의 형태에 따라 갈리는 두 갈래(중첩 vs flat) 서술도 정확하고, 후속 planner 정정을 위한 정본 위치임을 명시한다.
- `trigger-workflow-ref.e2e-spec.ts` case E docstring — R-CC-10 우회를 재현하던 경고 블록이 "2026-09-10 해소됨" 으로 정확히 갱신됐고, 대체 계약 검증 위치(`triggers.service.spec.ts`·`trigger-dto-validation.spec.ts`)를 명시한다. 인라인 주석도 "이 바디가 200 이 되는 것 자체가 CRITICAL 이 닫혔다는 신호" 로 캐너리의 의도를 정확히 설명한다.
- `triggers.controller.ts` `@ApiBadRequestResponse` — 신규 3가지 400 사유(비밀 필드·최초 부착·provider 전환)와 `details.field` 두 갈래 형식을 정확히 서술한다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` — CRITICAL 항목이 `[x]` 로 체크되고 처방 경위·정정 이력·해소 근거(커밋/리뷰 세션 경로)가 시간순으로 정확히 누적돼 있다. 아직 열린 항목(`§5.4.1` flat 표기 정정 등)도 "무엇이 planner 몫으로 남았는지" 를 명확히 구분해 등재했다.
- `triggers.service.ts` 신규 private 메서드(`assertPatchCarriesNoSecrets`, `assertChatChannelAlreadySetUp`) — 각각 spec 절 인용(`[Spec Chat Channel R-CC-21 / D-1]`, `[Spec Chat Channel §5.4.1 표 1행]`)과 "왜 이 시점에 거부해야 하는가"(best-effort catch 에 삼켜지는 문제) 근거 주석이 붙어 있다.

## 요약

이번 diff 는 문서화 관점에서 완성도가 매우 높다 — JSDoc·Swagger description·인라인 주석·e2e
docstring·사용자 문서(ko/en 6파일) 전부가 실제 동작(특히 `details.field` 가 값의 형태에 따라
갈리는 미묘한 두 갈래)과 정확히 일치하도록 여러 라운드에 걸쳐 다듬어졌고, 이번 라운드에서
소스를 직접 열어 그 반영을 재확인했다. 유일한 실질적 갭은 **CHANGELOG.md 미기재**다 — 이
저장소는 (이전 문서화 리뷰 라운드들의 반복된 주장과 달리) 루트에 `CHANGELOG.md` 를 두고
거의 모든 backend 보안/계약 수정 커밋에서 이를 갱신하는 확립된 관례를 갖고 있으며, 이 PR 은
그 관례가 겨냥하는 정확히 그 종류의 변경(CRITICAL 보안 우회 차단 + 의도된 breaking wire
change)이다. 이 갭이 CRITICAL 하지는 않지만(제품 동작에 영향 없음), 다음 사람이 CHANGELOG 를
"동작 변경의 단일 진실" 로 참조할 때 이 PR 의 이력이 빠져 있게 된다.

## 위험도

LOW
