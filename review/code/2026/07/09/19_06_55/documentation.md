# 문서화(Documentation) Review 결과

> 대상: 웹채팅 위젯 세션 컨트롤(새 대화/대화 종료) + `getStatus` durable `conversationThread` 새로고침 히스토리
> 복원. 이전 라운드(`review/code/2026/07/09/18_44_10/`) 의 WARNING 8건·INFO 다수를 반영한 이후의 fresh 상태.

## 발견사항

- **[WARNING]** `eia-types.ts` 신규 JSDoc 의 spec 상대경로 링크 2건이 깨져 있음(디렉터리 깊이 off-by-one)
  - 위치: `codebase/channel-web-chat/src/lib/eia-types.ts:33-34` (`TurnSource` JSDoc)
  - 상세: 신규 JSDoc 이 `[conversation-thread §1.1](../../../spec/conventions/conversation-thread.md)` 와
    `[1-widget-app §2](../../../spec/7-channel-web-chat/1-widget-app.md)` 두 마크다운 링크를 추가했다. 파일
    위치(`codebase/channel-web-chat/src/lib/`)에서 저장소 루트의 `spec/` 까지는 `../../../../`(4단계)가
    필요한데 `../../../`(3단계)만 써서 `codebase/spec/...` 로 잘못 resolve 된다(실측: `codebase/spec` 디렉터리
    자체가 존재하지 않음). VS Code 등에서 JSDoc hover 로 링크를 클릭하면 404. 같은 diff 의 다른 파일들
    (`conversation.ts`/`use-widget.ts`/`panel.tsx`/`widget-state.ts`/`interaction.service.ts`)은 마크다운
    링크 문법 대신 plain-text `spec/...` 경로 표기를 써서 이 문제를 피했다 — `eia-types.ts` 만 유일하게 클릭형
    링크를 도입하면서 깊이 계산이 틀렸다. (참고: 저장소 전역에 유사한 off-by-one 링크가 이미 존재하는
    사례도 확인돼 — 이 자체가 이 저장소에서 아주 드문 결함은 아니다. 다만 이번 diff 로 새로 추가된 링크이므로
    지금 고치는 편이 저렴하다.)
  - 제안: `../../../../spec/conventions/conversation-thread.md`, `../../../../spec/7-channel-web-chat/1-widget-app.md`
    로 한 단계씩 늘릴 것.

- **[INFO]** 프로덕션 코드 주석에 외부 문맥 없는 "WARNING #N" 참조가 3곳 남음
  - 위치: `codebase/channel-web-chat/src/widget/components/panel.tsx:31`(`WARNING #5`), `:106`(`WARNING #4`),
    `codebase/channel-web-chat/src/widget/use-widget.ts:409`(`WARNING #1`)
  - 상세: 이 세 주석은 이전 코드 리뷰 라운드(`review/code/2026/07/09/18_44_10/`)에서 발견된 WARNING 항목
    번호를 그대로 코드에 남겼다. 각 주석 자체의 "왜"(중복 로직 통합·접근성 이름 충돌 회피·SSE 선차단 순서)
    설명은 이미 자기완결적이라 실무 영향은 낮지만, "WARNING #4/#5/#1" 라는 표기는 어느 리뷰 라운드·언제
    산출된 번호인지에 대한 앵커가 코드에 없다 — `review/` 디렉터리가 정리되거나 다음 리뷰에서 번호 체계가
    바뀌면(예: 다른 라운드의 WARNING #1) 미래 독자에게 오해를 줄 수 있는 참조다. 이 저장소의 다른 근거 주석들은
    보통 spec 섹션(`§3.1` 등)처럼 안정적인 식별자를 인용하는데 이 세 곳만 예외다.
  - 제안: "(WARNING #N)" 접미사를 제거하거나 "(2026-07-09 리뷰 반영)" 처럼 날짜를 붙여 최소한의 시점 앵커를
    남길 것. 필수 수정은 아님.

## 긍정적 관찰 (참고)

- `CHANGELOG.md` — 이전 라운드에서 지적된 누락이 해소됐다. `## Unreleased` 항목이 세션 컨트롤·히스토리 복원
  두 축을 각각 "무엇을/왜/SoT" 상세도로 다른 최근 항목들과 동일한 포맷으로 서술.
- `codebase/channel-web-chat/README.md` "상태" 섹션도 갱신돼 5-source→role 매핑·durable 복원·헤더 세션
  컨트롤이 모두 "구현됨" 목록에 반영됐다(이전 라운드 INFO #10 해소).
- `interaction.service.ts` 의 `getStatus()` JSDoc·인라인 주석은 신규 `conversationThread` 동봉의 보안 근거
  ("이미 SSE 로 공개 중인 데이터라 신규 민감 표면 아님")와 wire shape 근거(`cloneThread`/
  `stageDurableResumeSnapshot` 실제 식별자)를 정확히 인용한다 — grep 으로 두 식별자 모두 실존 확인함.
- `conversation.ts`/`eia-types.ts` 의 `TurnSource`/`roleOf` JSDoc 은 "왜"(새로고침 복원 thread 는 `role` 없이
  `source` 만 옴 → 매핑 없으면 전부 assistant 로 뒤집힘)를 정확히 설명하고 `spec/conventions/conversation-thread.md
  §1.1`(백엔드 5값 ConversationTurnSource) 인용도 실제 절 번호와 일치함을 확인했다.
- spec 3건(`14-external-interaction-api.md` §5.3/R17, `1-widget-app.md` §2/§3.1, `3-auth-session.md` §3.1)이
  코드와 같은 PR 로 동기화됐고, R17 addendum 에는 "기각 대안" 두 개까지 이 저장소의 rationale-continuity
  관례대로 기록돼 있다. `plan/in-progress/webchat-session-controls-history-restore.md` 도 문제·결정·작업·
  검증·잔여를 표준 구조로 기록.
- `endConversation()` JSDoc 은 `nodeId` 미확정 시 동일 phase 라도 `cancel` 로 폴백하는 엣지 케이스까지 명시
  (이전 라운드 INFO #12 해소, 코드의 `!!state.pending?.nodeId` 조건과 실제 일치 확인).
- Swagger DTO(`responses.dto.ts` `ExecutionStatusDto.context`)는 이번 diff 로 변경되지 않았지만 이미
  "conversationThread snapshot" 언급이 있어 REST 표면 문서와 실제 동작이 이번 변경으로 오히려 정합해졌다
  (기존엔 문서가 코드보다 앞서 있던 상태 — 이번 PR 이 코드를 문서에 맞춤).
- 테스트 파일들(`interaction.service.spec.ts`/`conversation.test.ts`/`panel.test.tsx`/`use-widget-eager-start.test.ts`)
  모두 신규 케이스 위에 "왜 이 케이스가 필요한가"를 한 줄 주석으로 남겨 회귀 방지 의도가 분명하다.

## 요약

문서화 수준은 전반적으로 매우 높다. 이전 라운드에서 지적된 CHANGELOG 누락·README stale·JSDoc 엣지 케이스
누락은 모두 이번 diff 에서 해소됐고, spec 3건·plan·코드 JSDoc·테스트 주석이 하나의 일관된 서사로 동기화돼
있다. 남은 문제는 실제로 검증된 사소한 결함 하나(`eia-types.ts` 의 신규 상대경로 링크 2건이 디렉터리 깊이
오류로 깨짐 — WARNING)와, 차단 사유는 아니지만 장기 가독성에 약간 부정적인 관찰 하나(리뷰 라운드 번호를
그대로 남긴 코드 주석 3곳 — INFO)뿐이다.

## 위험도
LOW
