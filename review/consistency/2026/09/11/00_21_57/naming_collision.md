# 신규 식별자 충돌 검토 — `spec/5-system` (impl-done, chat-channel PATCH 토큰 우회 수정 · 2라운드)

## 전제 확인

`git diff --stat origin/main...HEAD -- spec/5-system` 결과가 비어 있음을 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/impl-chat-channel-patch-token-a17c4e`)에서
직접 재확인 — 이 브랜치는 `spec/5-system` 을 전혀 바꾸지 않는다. spec 레벨에서 새로 도입되는
요구사항 ID·엔티티명·API endpoint·이벤트명·ENV/설정키·spec 파일 경로는 없다.

실질적 검토 대상은 코드 diff(`origin/main...HEAD -- codebase/`, 11 파일)가 도입하는 **코드
심볼**이다. 이 세션(00_21_57)의 target 은 직전 라운드(`review/consistency/2026/09/10/23_54_09`,
BLOCK: NO)가 이미 같은 코드 심볼 집합을 전수 검토한 뒤, **그 이후 커밋 1개**
(`83d5f3f94` "리뷰 2라운드")가 추가된 상태다. 그 커밋의 diff 를 직접 열어 **새 식별자가
추가됐는지**를 우선 확인했다.

## `83d5f3f94` (직전 라운드 이후 신규 커밋)가 추가한 것 — 신규 식별자 없음

- `assertChatChannelInputSafe` 에 **오버로드 시그니처 2개**를 추가했다 — 기존 함수명을
  재사용하는 오버로드일 뿐 새 식별자가 아니다(TS 오버로드는 동일 심볼).
- `triggers.service.spec.ts`/`trigger-dto-validation.spec.ts` 에 파라미터화 테스트 케이스를
  늘렸다 — 새 함수/타입/상수 선언 없음(`it.each` 인자로 문자열 리터럴 `'botToken'`/
  `'inboundSigningPlaintext'`/`'telegram'`/`'slack'` 을 쓰지만 전부 기존에 이미 존재하던
  필드명/provider명 재사용).
- `triggers.controller.ts` Swagger `@ApiBadRequestResponse` 설명 문구 정정 — 신규
  `details.field` 값을 추가하지 않고, 기존 값(`chatChannel.botToken` 등 중첩 경로)이
  **어느 조건에서 어떤 형태로 나가는지**를 정확히 서술하도록 산문만 고쳤다.
- 4개 `.mdx` 문서(ko/en × triggers·telegram)의 예시 문구를 실측값(`details.field=
  'chatChannel.botToken'`, 입력 필드는 `botToken` 이지 `botTokenRef` 가 아니다)으로
  정정 — 기존에 문서가 잘못 적어 온 `botTokenRef` 라는 **오기(誤記)** 를 없앤 것이지,
  새 식별자를 도입한 것이 아니다.

즉 이번 라운드에서 신규로 등장한 식별자는 없다. 아래는 직전 라운드가 검토한 전체
신규 식별자 집합을 이 세션에서 독립적으로 재확인한 결과다(재검증 — grep 은 이번 세션에서
새로 실행).

## 검토 대상 신규 식별자와 실측 결과 (독립 재검증)

| 신규 식별자 | 종류 | 정의 위치 | 충돌 여부(전수 grep, 이번 세션 실측) |
|---|---|---|---|
| `ChatChannelUpdateConfigDto` | class (DTO) | `dto/chat-channel-config.dto.ts:372` | 없음 — 저장소 전체에서 이 클래스 정의 1건뿐. plan 이력상 원래 후보였던 `ChatChannelPatchConfigDto`(`Patch` 접두, 저장소 0건 관례 위반 우려)는 채택되지 않고 `Update` 축으로 확정돼 있음(`plan/complete/spec-draft-telegram-signing-carveout.md:138`) |
| `ChatChannelInput` (`= ChatChannelConfigDto \| ChatChannelUpdateConfigDto`) | type alias | `triggers.service.ts:60` | 없음 — 인접한 어댑터 내부 interface `ChatChannelConfig`(`chat-channel/types.ts`)와 이름이 다르고, 관계가 정의부 JSDoc(`triggers.service.ts:48-59`)에 명시됨 |
| `ChatChannelInputMode` (`'create' \| 'update'`) | type alias | `triggers.service.ts:73` | 없음 |
| `assertPatchCarriesNoSecrets` | private method | `triggers.service.ts:695` | 없음 — 기존 `assertChatChannelInputSafe`/`assertInboundSigningPlaintextByProvider`/`assertNotificationUrlSafe` 와 이름 축(`assert*`)은 일치하되 완전히 새 이름 |
| `assertChatChannelAlreadySetUp` | private method | `triggers.service.ts:722` | 없음 |
| `storeUserSuppliedSecrets` | 옵션 플래그명 (`setupChatChannel` 3번째 인자) | `triggers.service.ts:1082` | 없음. plan 이 스스로 경계한 `writeSecrets` 같은 뭉뚱그린 이름도 채택되지 않았음을 실측 확인 — 저장소 전체에 `writeSecrets` 0건 |
| `preservedInboundSigningRef` | 옵션 플래그명 | `triggers.service.ts:1087` | 없음 |

- `details.field` 값 — 이번 diff 가 응답에 싣는 `'chatChannel'`(§`assertChatChannelAlreadySetUp`)
  · `'provider'`(같은 함수) · `'botToken'`/`'inboundSigningPlaintext'`(flat, `assertPatchCarriesNoSecrets`)
  를 `codebase/backend/src` 전체에서 재검색 — 트리거 모듈 밖 다른 엔드포인트가 같은
  `details.field` 문자열을 **다른 의미**로 쓰는 사례는 없음(둘 다 이번 diff 가 도입한
  자리에서만 등장).
- `botToken` 필드명 — `spec/4-nodes/7-trigger/providers/{slack,discord,telegram}.md` ·
  `spec/5-system/15-chat-channel.md` 전체에서 이미 "채널 어댑터의 봇 토큰"이라는 동일
  의미로 18곳 이상 쓰이고 있음. `ChatChannelUpdateConfigDto.botToken`(금지 필드로 재선언)은
  같은 의미의 필드를 다른 verb(PATCH)에서 다르게 검증하는 것일 뿐 새 의미의 재사용이 아님.
- API endpoint — 기존 `PATCH /api/triggers/:id`, `POST /api/triggers/:id/chat-channel/rotate-bot-token`
  그대로. 새 method+path 조합 없음.
- 이벤트/메시지명 — webhook·queue·sse 이벤트 신설 없음.
- ENV/설정키 — 신규 환경변수·config key 없음.
- 파일 경로 — 신규 spec 파일 없음(spec 델타 0). 코드도 전부 기존 파일 수정, 신규 파일 생성 없음.

## 발견사항

없음. 신규 식별자(요구사항 ID / 엔티티·DTO명 / endpoint / 이벤트명 / 환경변수 / 파일 경로) 중
기존 사용처와 다른 의미로 충돌하는 사례를 찾지 못했다. 이 결론은 `21_37_56`(최초 발견 —
`ChatChannelPatchConfigDto` WARNING) → `22_04_23`/`22_14_27`/`22_24_30`(개명 확인) →
`22_45_26`/`23_54_09`(전수 재검증)에 이어 이번이 **6번째 독립 재검증**이며, 매 라운드
동일하게 NONE 으로 수렴했다.

참고(정보용, 등급 부여 대상 아님): `ChatChannelConfig`(어댑터 내부 타입) /
`ChatChannelConfigDto`(생성 DTO) / `ChatChannelUpdateConfigDto`(수정 DTO) /
`ChatChannelInput`(둘의 union) 네 이름이 시각적으로 유사해 향후 신규 기여자가 헷갈릴
여지는 여전히 남아 있으나, `triggers.service.ts` 상단 JSDoc 이 네 타입의 관계를 명시적으로
설명하고 있어 실질적 혼선 위험은 낮다. 직전 라운드부터 이 관찰은 반복 등재만 될 뿐 등급
상향 근거가 나오지 않았다.

## 요약

이번 target 은 `spec/5-system` 을 전혀 변경하지 않는 코드 전용 PR 이다. 직전 라운드
(`23_54_09`) 이후 추가된 커밋(`83d5f3f94`)은 함수 오버로드·테스트 파라미터화·Swagger 및
사용자 문서 문구 정정뿐이며 **새 식별자를 도입하지 않았다.** 직전 라운드가 검토한 코드
심볼 7개(`ChatChannelUpdateConfigDto`, `ChatChannelInput`, `ChatChannelInputMode`,
`assertPatchCarriesNoSecrets`, `assertChatChannelAlreadySetUp`, `storeUserSuppliedSecrets`,
`preservedInboundSigningRef`)를 이번 세션에서 워킹트리 전체 기준으로 독립 재검증한
결과도 기존 사용처와의 충돌 없음으로 재확인됐다.

## 위험도

NONE
