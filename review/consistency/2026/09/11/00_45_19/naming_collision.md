# 신규 식별자 충돌 검토 — `spec/5-system` (impl-done, chat-channel PATCH 토큰 우회 수정 · 4라운드)

## 전제 확인

`spec/5-system` 의 `origin/main...HEAD` 델타는 이번에도 **0개 파일**이다 — 이 브랜치는 spec
레벨에서 요구사항 ID·엔티티명·API endpoint·이벤트명·ENV/설정키·spec 파일 경로를 새로 도입하지
않는다. 실질 검토 대상은 여전히 코드 diff(`codebase/`)가 도입하는 심볼이다.

이 세션(00_45_19)의 target 은 직전 라운드(`review/consistency/2026/09/11/00_21_57`, NONE)
이후 추가된 커밋 `5976587c7`("리뷰 3라운드")다. 그 커밋의 diff 를 워킹트리에서 직접 열어
신규 식별자 유무를 확인했다.

## `5976587c7`(직전 라운드 이후 신규 커밋)가 추가한 것 — 신규 코드 심볼 없음

- `triggers.service.spec.ts:3151` 부근 — 기존 단언에 `details: { field: 'chatChannel' }` 필드를
  덧붙였을 뿐, 새 함수/타입/상수 선언 없음. `'chatChannel'` 은 이미 직전 라운드에서 검토된
  `details.field` 값 재사용.
- `triggers.mdx` — 이중 공백 오타 정정(문구만).
- `discord.{,en}.mdx`/`slack.{,en}.mdx` 4개 파일에 신규 섹션(`## 6.5 Bot Token · Public Key 변경`
  / `## 5.5 Bot Token · Signing Secret 변경`, en 대응)을 추가 — telegram 문서의 기존 "Bot Token
  회전(single-path)" 절과 동일 내용을 slack/discord 에도 병렬 기술한 것. 새 엔드포인트·필드·
  코드·ENV 는 도입하지 않고 기존 `POST /api/triggers/:id/chat-channel/rotate-bot-token`,
  `config.chatChannel.botToken`, `config.chatChannel.inboundSigningPlaintext`,
  `details.field='chatChannel.botToken'`/`'chatChannel.inboundSigningPlaintext'` 를 재인용만 함.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` — 각주 갱신(경로 표기 정정 +
  후속 관찰 추가), 새 식별자 없음.

즉 이번 라운드에서 신규로 등장한 코드 심볼은 없다. 아래는 직전 라운드가 검토한 신규 식별자
집합을 이번 세션에서 독립적으로 재검증한 결과다.

## 검토 대상 신규 식별자와 실측 결과 (독립 재검증)

| 신규 식별자 | 종류 | 정의 위치 | 전수 grep 재실측(이번 세션) |
|---|---|---|---|
| `ChatChannelUpdateConfigDto` | class (DTO) | `chat-channel-config.dto.ts:372` | 저장소 전체 정의 1건(`export class`). `ChatChannelPatchConfigDto` 는 저장소 0건 — plan 이 경계한 대로 `Patch` 접두 후보는 채택 안 됨 |
| `ChatChannelInput` | type alias | `triggers.service.ts:60` | 전 사용처(9곳)가 `triggers.service.ts` 한 파일에 국한. 어댑터 내부 `ChatChannelConfig`(`chat-channel/types.ts`, 이름 다름)와 혼동 없음 |
| `ChatChannelInputMode` | type alias | `triggers.service.ts:73` | 저장소 전체 2건(정의+참조), 다른 의미의 기존 사용처 없음 |
| `assertPatchCarriesNoSecrets` | private method | `triggers.service.ts:695` | 저장소 전체 4건, 전부 같은 파일 |
| `assertChatChannelAlreadySetUp` | private method | `triggers.service.ts:722` | 저장소 전체 2건(정의+1회 호출) |
| `storeUserSuppliedSecrets` | 내부 옵션 플래그명 | `triggers.service.ts` (1079/1082 등) | 저장소 전체 9건, 전부 같은 파일 내 정의·호출·주석. 경계했던 `writeSecrets` 는 0건 |
| `preservedInboundSigningRef` | 내부 옵션 플래그명 | `triggers.service.ts` (590/1080/1087/1175) | 저장소 전체 4건, 전부 같은 파일 |

- **API endpoint** — `triggers.controller.ts` diff 는 기존 `PATCH /api/triggers/:id` 의 Swagger
  `@ApiBadRequestResponse` 설명만 확장했다. 새 method+path 조합 없음. 기존
  `POST /api/triggers/:id/chat-channel/rotate-bot-token` 도 변경 없음.
- **환경변수·설정키** — diff 전체(`git diff origin/main...HEAD -- codebase/`)에 `process.env`·
  `ConfigService`·신규 `@Column`·마이그레이션 추가 없음(grep 0건).
- **파일 경로** — `git diff --diff-filter=A -- codebase/ spec/` 결과 0건. 신규 파일 생성 없음
  (전부 기존 파일 수정).
- **이벤트/메시지명** — webhook·queue·sse 이벤트 신설 없음.
- **plan 파일명** — `plan/in-progress/impl-chat-channel-patch-token.md` 는 신규 생성이나,
  대응하는 `plan/complete/spec-draft-chat-channel-patch-token.md`(planner draft)와 `spec-draft-`
  / `impl-` 접두어 페어링은 이 저장소의 기존 관례(다른 다수 쌍이 동일 패턴)이며 충돌이 아니다.

## 참고 사항 (등급 부여 대상 아님) — 문서 서브섹션 번호 표기

이번 커밋이 `discord.mdx`/`discord.en.mdx`/`slack.mdx`/`slack.en.mdx` 4개 파일에 신설한 절
번호가 `## 6.5`(discord) / `## 5.5`(slack) 소수점 표기다. 저장소의 대응 문서인
`telegram.mdx` 는 동일 개념("Bot Token 회전")을 정수 절 번호(`## 6.`)로 표기한다. 4개 파일
전체에서 소수점 절 번호(`N.5`) 사용례는 이번 diff 가 처음이며, 기존에 다른 의미로 이미 쓰인
`6.5`/`5.5` 번호와 충돌하지도 않는다(각 파일에서 유일). 순수 명명 충돌은 아니고 형제 문서 간
번호 표기 관례 불일치(뒤 절을 밀지 않으려는 의도적 선택으로 보임)이므로 convention_compliance
관점의 참고 사항으로만 남긴다.

## 발견사항

없음. 신규 식별자(요구사항 ID / 엔티티·DTO명 / endpoint / 이벤트명 / 환경변수 / 파일 경로) 중
기존 사용처와 다른 의미로 충돌하는 사례를 찾지 못했다. 이 결론은 `21_37_56`(최초 발견 —
`ChatChannelPatchConfigDto` WARNING, 이후 개명) → `22_04_23`/`22_14_27`/`22_24_30` →
`22_45_26`/`23_54_09`/`00_21_57`(전수 재검증)에 이어 이번이 **7번째 독립 재검증**이며, 매 라운드
동일하게 NONE 으로 수렴했다.

## 요약

이번 target 은 `spec/5-system` 을 전혀 변경하지 않는 코드/문서 전용 PR 이다. 직전 라운드
(`00_21_57`) 이후 추가된 커밋(`5976587c7`)은 테스트 단언에 `details.field` 값 하나를 덧붙이고
slack/discord 사용자 문서에 telegram 과 대칭인 "Bot Token 회전" 안내 절을 신설했을 뿐, **새
코드 심볼·API endpoint·환경변수·spec 파일을 도입하지 않았다.** 직전 라운드가 검토한 코드 심볼
7개(`ChatChannelUpdateConfigDto`, `ChatChannelInput`, `ChatChannelInputMode`,
`assertPatchCarriesNoSecrets`, `assertChatChannelAlreadySetUp`, `storeUserSuppliedSecrets`,
`preservedInboundSigningRef`)를 이번 세션에서 다시 워킹트리 전체 기준으로 독립 재검증한 결과도
기존 사용처와의 충돌 없음으로 재확인됐다. 유일하게 새로 관찰된 것은 신설 문서 절의 소수점
번호 표기(`6.5`/`5.5`)가 형제 문서(telegram)의 정수 표기와 불일치한다는 점인데, 이는 식별자
충돌이 아니라 표기 관례 차이이며 등급 부여 대상이 아니다.

## 위험도

NONE
