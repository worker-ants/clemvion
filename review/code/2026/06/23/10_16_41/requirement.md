# 요구사항(Requirement) 리뷰 결과

## 발견사항

### **[WARNING]** `uiMapping.formMode` 편집 UI 누락 — spec §2.3.1 이 edit 필드로 명시
- 위치: `/codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx` — `ChatChannelEditForm` 컴포넌트(L148–275), `saveMutation.mutationFn`(L406–432)
- 상세: spec `2-trigger-list.md §2.3.1` 매트릭스는 `Chat Channel | uiMapping.formMode | edit`로 정의하고, 허용값은 `multi_step / native_modal / auto`, default `auto`이다. 그러나 `ChatChannelEditForm`에는 `formMode` 셀렉터가 없고, PATCH body 에서 `formMode`는 `"multi_step"` 으로 하드코딩된다(L416). 사용자가 설정한 기존 `formMode` 값(예: `native_modal`, `auto`)이 저장 시 항상 `multi_step`으로 덮어씌워진다.
- 제안: `ChatChannelEditForm`에 `formMode` 셀렉터(`auto / native_modal / multi_step`)를 추가하고, `initialChatChannelEditValues`가 `chatChannel?.uiMapping?.formMode ?? "auto"`를 읽어 초기값을 제공하도록 수정. PATCH body 에서도 `editValues.formMode`를 사용해야 한다. 아니면 — 만약 본 카드에서 `formMode` 편집을 의도적으로 제외한 것이라면(예: 추후 별도 구현), plan 에 그 이유와 defer 결정을 명시하고 spec `§2.3.1` 행을 `read-only(v1)` 또는 `deferred` 로 갱신하도록 planner 에 위임해야 한다.

### **[WARNING]** `RotateBotTokenModal` — bot token 형식 검증(regex) 누락
- 위치: `/codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx` — `RotateBotTokenModal`(L281–340), 확인 버튼 비활성화 로직(L329)
- 상세: spec `2-trigger-list.md §2.3.1` Chat Channel `botToken` 행은 클라이언트 측 형식 검증 `^\d{6,}:[A-Za-z0-9_-]{30,}$`을 명시한다(Spec Chat Channel §5.4 참조). 현재 구현은 `value.trim().length === 0`만 체크하므로 형식이 잘못된 토큰(예: 숫자 없음, 구분자 없음, 너무 짧은 hash 부분)도 submit 버튼이 활성화된다. 백엔드가 최종 차단하더라도 spec이 명시한 client-side 검증이 누락된 상태이다.
- 제안: 확인 버튼 `disabled` 조건에 regex 검사를 추가한다: `pending || !BOT_TOKEN_REGEX.test(value.trim())` (여기서 `BOT_TOKEN_REGEX = /^\d{6,}:[A-Za-z0-9_-]{30,}$/`). 또는 `@workflow/chat-channel-validation` 패키지에 동일 정규식이 있다면 해당 export를 재사용한다.

### **[WARNING]** `OverviewCard.name` — `maxLength={255}` vs spec 1~120자
- 위치: `/codebase/frontend/src/components/triggers/cards/overview-card.tsx` — L1266: `maxLength={255}`
- 상세: spec `2-trigger-list.md §2.3.1` Overview `name` 행은 `1~120 자`를 명시한다. 코드는 `maxLength={255}`를 사용해 120자를 초과하는 이름 입력이 클라이언트 측에서 차단되지 않는다. 백엔드가 최종 검증하지만 spec이 명시한 클라이언트 측 상한선이 일치하지 않는다.
- 제안: `maxLength={120}`으로 수정한다.

### **[WARNING]** `ExternalInteractionCard` — notification URL 삭제 불가 (빈 값으로 clear 경로 없음)
- 위치: `/codebase/frontend/src/components/triggers/cards/external-interaction-card.tsx` — `saveMutation.mutationFn`(L801–816)
- 상세: `saveMutation`의 patchBody 구성 로직(L802–810)은 `urlValue`가 비어있으면 `patchBody.notification`을 아예 포함하지 않는다. 이는 기존에 설정된 notification URL을 빈 문자열로 수정해 clear하려 해도, PATCH body에서 해당 키가 누락되어 백엔드가 이를 "변경 없음"으로 처리하는 결과를 낳는다. 즉, notification URL을 일단 설정하면 UI에서 제거할 방법이 없다.
- 제안: 의도가 "URL 비우기 = notification 제거"라면 `patchBody.notification = null` (또는 `{}`) 경로를 추가하거나 spec EIA `§4`에서 해당 경로를 확인해야 한다. 의도가 "URL 필드는 항상 URL을 가져야 하므로 clear 불가"라면, 편집 폼에서 URL을 비워도 저장이 되지 않아야 하고 그 의도를 UI/주석에서 명확히 해야 한다.

### **[INFO]** `ChatChannelCard` — `hasChatChannel` 체크가 `provider` 존재로만 판단
- 위치: `/codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx` — L362: `const hasChatChannel = Boolean(chatChannel?.provider);`
- 상세: `config.chatChannel`이 존재하지만 `provider`가 아직 설정되지 않은 경우(예: 생성 직후 설정 미완료 상태)를 "미설정"으로 표시한다. 이는 spec §2.3 의 "config.chatChannel 설정 트리거에만 표시"와 대체로 일치하나, provider가 빈 문자열인 엣지 케이스에서 미설정 화면이 뜰 수 있다. INFO 수준 — 실제 데이터 모델에서 `provider`는 항상 설정되거나 `chatChannel` 자체가 null인 구조라면 무해하다.
- 제안: 실제 응답 데이터 계약에서 `chatChannel.provider`가 항상 non-empty라면 현행 유지. 아니라면 `hasChatChannel = Boolean(chatChannel)` 또는 추가 필드 체크 고려.

### **[INFO]** `useTrigger` hook — `isLoading` 반환 시 `isInitialLoading` vs `isPending` 구분 없음
- 위치: `/codebase/frontend/src/components/triggers/hooks/use-trigger.ts` — L12: `isLoading: query.isLoading`
- 상세: TanStack Query v5에서 `isLoading`은 `isPending && isFetching`의 합성 값이다. drawer가 열린 상태에서 background refetch 시 `isLoading`이 false를 유지하므로 스피너가 표시되지 않는다 — 이것은 의도된 동작이다. 그러나 명시적 `isPending` (첫 로드) 구분이 필요한 경우를 위한 참고. 현재 동작은 기존 코드(useQuery in drawer)와 동일하므로 behavior-preserving 조건 충족.
- 제안: 현 구현 유지 가능. 명세 상 별도 상태 구분 요건이 없으면 변경 불필요.

### **[INFO]** `[SPEC-DRIFT]` spec §2.3.1 필드 매트릭스에 `languageLocale` 편집 행 없음
- 위치: `/codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx` — `ChatChannelEditForm`(L229–253), `initialChatChannelEditValues`(L112)
- 상세: `ChatChannelEditForm`은 `languageLocale` 셀렉터(`ko / en`)를 포함하며, PATCH body에도 `languageLocale: editValues.languageLocale`를 전송한다. spec `15-chat-channel.md §4.1` (ChatChannelConfig JSON 예시 L215)은 `languageLocale` 필드를 `"ko" | "en"` — 미설정 default `"ko"` 로 정의하나, `2-trigger-list.md §2.3.1` 필드 권한 매트릭스에는 `languageLocale` 행이 없다. `languageHints`만 edit 행으로 존재한다. 코드가 `languageLocale`을 편집 가능하게 노출한 것은 합리적 기능 추가이지만 spec 매트릭스가 갱신되지 않았다.
- 제안: 코드 유지 + spec `2-trigger-list.md §2.3.1` 매트릭스에 `Chat Channel | languageLocale | edit | "ko" | "en" — 미설정 default "ko"` 행 추가를 planner에 요청한다.

### **[INFO]** `[SPEC-DRIFT]` spec §2.3 drawer 테이블에 "인증 설정" 카드가 별도 행이지만 코드에서는 `WebhookConfigCard`에 병합
- 위치: `/codebase/frontend/src/components/triggers/cards/webhook-config-card.tsx` — `AuthConfigSelect` 포함(L1676–1686); spec `2-trigger-list.md §2.3` 테이블 L80
- 상세: spec `§2.3` 드로어 구성 테이블은 "인증 설정 | 연결된 AuthConfig 정보"를 별도 행으로 나열한다. spec `§2.3.1`도 "Auth Config" 카드를 별도 카드로 기술한다. 현 구현은 `authConfigId` 셀렉터를 `WebhookConfigCard` 내에 병합(5카드 구조). 이는 behavior-preserving 리팩터링에서 의도적으로 유지한 결정이며, plan에도 "5카드 behavior-preserving 유지 — AuthConfigCard 분리는 별도 결정"으로 명시되어 있다. 코드 되돌리기가 오답인 SPEC-DRIFT이다.
- 제안: 코드 유지. spec `2-trigger-list.md §2.3` 드로어 테이블 및 `§2.3.1` Auth Config 카드 행에 "현재 구현에서 `authConfigId`는 Webhook Configuration 카드에 병합됨 — 별도 카드 분리는 후속 결정 사안" 주석 추가를 planner에 요청한다.

---

## 요약

이 변경은 `trigger-detail-drawer.tsx` god-component를 5개 카드 파일 + 2개 hook으로 behavior-preserving 분리한 리팩터링이다. 공개 surface(`TriggerDetailDrawer`) 및 기존 테스트(54개)는 무변으로 유지된다. 요구사항 충족 관점에서 주요 기능(read/edit 모드 전환, PATCH 저장, rotate-bot-token, rotate-secret, revoke-token)은 모두 구현되어 있다. 그러나 두 가지 spec 위반 사항이 존재한다: (1) spec §2.3.1이 `uiMapping.formMode`를 편집 가능 필드로 정의하나 edit form에 selector가 없고 PATCH body에 `"multi_step"` 하드코딩으로 기존 설정을 덮어쓴다 — 실제 behavioral 회귀 가능성이 있다. (2) spec §2.3.1 및 Spec Chat Channel §5.4가 botToken 형식 검증(`^\d{6,}:[A-Za-z0-9_-]{30,}$`)을 클라이언트 측에서 수행하도록 명시하나 `RotateBotTokenModal`은 비어있는지만 체크한다. `overview-card.tsx`의 `maxLength={255}` vs spec 1~120자 불일치도 spec 차이지만 백엔드 최종 검증으로 데이터는 보호된다. `languageLocale` 편집 기능과 Auth Config 카드 통합은 합리적 결정으로 spec이 갱신되어야 하는 SPEC-DRIFT이다.

## 위험도
**MEDIUM** — `formMode` 하드코딩으로 기존에 `native_modal` 또는 `auto`로 설정된 트리거가 저장 시 `multi_step`으로 교체될 수 있다. botToken format validation 누락은 UX 저하지만 백엔드가 보호한다.
