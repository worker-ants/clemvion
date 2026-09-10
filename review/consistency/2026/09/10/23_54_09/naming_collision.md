# 신규 식별자 충돌 검토 — `spec/5-system` (impl-done, chat-channel PATCH 토큰 우회 수정)

## 전제 확인

`git diff --stat origin/main...HEAD -- spec/5-system` 결과가 비어 있음을 직접 실측 —
이 브랜치는 `spec/5-system` 을 전혀 바꾸지 않는다. 즉 **spec 레벨에서 새로 도입되는
요구사항 ID·엔티티명·API endpoint·이벤트명·ENV/설정키·파일 경로는 없다.** `R-CC-21` /
`D-1` / `D-2` (spec 본문에 등장하는 결정 라벨) 는 이번 target 이 새로 부여한 것이 아니라
이전 커밋에서 이미 확정된 서술이므로 "신규 식별자" 검토 대상이 아니다.

실질적으로 검토할 신규 식별자는 diff(7 파일 / 1414줄, 코드 전용)가 도입하는 **코드 심볼**
들이다. 이를 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/impl-chat-channel-patch-token-a17c4e`)
전체를 대상으로 grep 하여 기존 사용처와의 충돌 여부를 확인했다.

## 검토 대상 신규 식별자와 실측 결과

| 신규 식별자 | 종류 | 정의 위치 | 충돌 여부(전수 grep) |
|---|---|---|---|
| `ChatChannelUpdateConfigDto` | class (DTO) | `dto/chat-channel-config.dto.ts` | 없음 — `*UpdateConfigDto` 패턴 전체에서 이 정의 1건만 존재 |
| `ChatChannelInput` | type alias | `triggers.service.ts` | 없음 — `ChatChannelConfig`(어댑터 내부 interface, `chat-channel/types.ts`), `ChatChannelConfigDto`(생성 DTO) 와 이름이 겹치지 않고 세 심볼 관계가 JSDoc(§L51-59)에 명시적으로 설명됨 |
| `ChatChannelInputMode` | type alias (`'create'\|'update'`) | `triggers.service.ts` | 없음 |
| `assertPatchCarriesNoSecrets` | private method | `triggers.service.ts` | 없음 — 기존 `assertChatChannelInputSafe`/`assertInboundSigningPlaintextByProvider` 와 이름 충돌 없음 |
| `assertChatChannelAlreadySetUp` | private method | `triggers.service.ts` | 없음 |
| `storeUserSuppliedSecrets` | 옵션 플래그명 | `triggers.service.ts` (`setupChatChannel` 옵션) | 없음 |
| `preservedInboundSigningRef` | 옵션 플래그명 | 위와 동일 | 없음 |

- `Patch` 접두 대신 `Update` 접두를 택한 근거(JSDoc 주석)도 실측 확인 — 저장소 전체에
  `export class Patch*` 패턴은 0건, 반면 `Update` 축(`UpdateTriggerDto` 등)은 기존 관례와
  일치한다.
- API endpoint — 이번 diff 는 기존 `PATCH /api/triggers/:id` 의 DTO/검증 로직만 바꿀 뿐,
  새 method+path 조합을 추가하지 않는다. `POST /api/triggers/:id/chat-channel/rotate-bot-token`
  도 기존 endpoint 그대로다.
- 이벤트/메시지명 — webhook·queue·sse 이벤트 신설 없음.
- ENV/설정키 — 신규 환경변수·config key 없음. `botToken`/`inboundSigningPlaintext` 필드명은
  기존 키를 그대로 재사용하며(POST DTO 는 필수, PATCH DTO 는 `@IsEmpty` 로 거부), 이는
  동일 자원에 대한 verb 별 검증 차등화이지 새 식별자 충돌이 아니다.
- 파일 경로 — 신규 spec 파일 없음(spec 델타 0). 코드 파일도 전부 기존 경로 수정이며 새
  파일 생성 없음.

## 발견사항

없음. 신규 식별자(요구사항 ID / 엔티티·DTO명 / endpoint / 이벤트명 / 환경변수 / 파일 경로)
중 기존 사용처와 다른 의미로 충돌하는 사례를 찾지 못했다.

참고(정보용, 등급 부여 대상 아님): `ChatChannelConfig`(어댑터 내부 타입) / `ChatChannelConfigDto`
(생성 DTO) / `ChatChannelUpdateConfigDto`(수정 DTO) / `ChatChannelInput`(둘의 union) 네
이름이 시각적으로 유사해 향후 신규 기여자가 헷갈릴 여지는 있으나, `triggers.service.ts`
상단 JSDoc(§L48-59)이 네 타입의 관계를 명시적으로 설명하고 있어 실질적 혼선 위험은 낮다.

## 요약

이번 target 은 `spec/5-system` 을 전혀 변경하지 않는 코드 전용 PR 이라 spec 레벨의 신규
식별자(요구사항 ID·엔티티명·API endpoint·이벤트명·ENV/설정키·spec 파일 경로) 자체가
없다. diff 가 도입하는 코드 심볼(`ChatChannelUpdateConfigDto`, `ChatChannelInput`,
`ChatChannelInputMode`, `assertPatchCarriesNoSecrets`, `assertChatChannelAlreadySetUp`,
`storeUserSuppliedSecrets`, `preservedInboundSigningRef`)을 워킹트리 전체 기준으로
전수 grep 한 결과 기존 사용처와의 충돌은 발견되지 않았고, 명명 규약(`Update` 접두)도
저장소 관례와 일치함을 확인했다.

## 위험도

NONE
