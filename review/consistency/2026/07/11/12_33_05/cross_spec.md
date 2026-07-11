# Cross-Spec 일관성 검토 — EIA 클라이언트 context 타입 정밀화 + spec-link-integrity 가드 확장

- 검토 모드: `--impl-done`
- 대상 spec: `spec/5-system/14-external-interaction-api.md` (§5.3 / §R17), 연관 `spec/5-system/2-api-convention.md` §5.4, `spec/conventions/swagger.md` §1-4, `spec/conventions/spec-impl-evidence.md` §4.2
- 검증 대상 diff: `1682777fe..HEAD` (4 commits, worktree `eia-client-context-types-33e771`)
- 검증 방법: 페이로드 diff 는 참고만 하고, 실제 SoT 는 워크트리 `git diff`/`Read`/`vitest run` 으로 직접 재확인 (아래 각 항목에 근거 명시).

## 발견사항

- **[WARNING] `spec-impl-evidence.md` §4.2 의 가드 스코프 서술이 `frontend` 루트를 누락**
  - target 위치: `spec/conventions/spec-impl-evidence.md:128` (본 PR 편집 라인) — "codebase `.ts`/`.tsx` 소스(`codebase/{backend,channel-web-chat,packages}`)의 JSDoc·주석"
  - 충돌 대상: 실제 구현 `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 의 `CODEBASE_SOURCE_ROOTS`(`codebase/backend/src`, **`codebase/frontend/src`**, `codebase/channel-web-chat/src`, `codebase/packages`) 및 같은 PR 의 `spec-link-integrity.test.ts` 상단 주석("Codebase `.ts`/`.tsx` sources under `codebase/{backend, channel-web-chat, packages}`" — 이 코드 주석도 동일하게 `frontend` 누락)
  - 상세: 가드가 실제로 스캔하는 4개 루트 중 `codebase/frontend/src` 가 spec 문서·코드 주석 모두에서 목록에서 빠져 있다. 이 누락이 단순 서술 오류임은 **같은 PR 의 diff 자체가 반증**한다 — `codebase/frontend/src/components/editor/settings-panel/auto-form/widgets.tsx` 와 `.../__tests__/multi-select-widget.test.tsx` 의 깨진 spec 링크(`AI Common §11` 앵커)를 이번 PR 이 실제로 고쳤다(`git diff 1682777fe..HEAD` 확인). 즉 가드는 frontend 소스를 이미 스캔·시행 중인데, 그 사실을 설명하는 문서·코드 주석은 3개 루트만 나열한다. `spec-links.ts` 를 직접 읽고 `CODEBASE_SOURCE_ROOTS` 배열을 확인, 이어 `vitest run src/lib/docs/__tests__/spec-link-integrity.test.ts` 를 실행해 13개 테스트 전부 통과함(0 violations, frontend 포함 4-루트 스캔 정상 동작)을 실측으로 재확인했다.
  - 제안: `spec-impl-evidence.md` §4.2 표의 스코프 열거를 `codebase/{backend, frontend, channel-web-chat, packages}` 로 정정하고, `spec-link-integrity.test.ts` 상단 주석의 동일 목록도 함께 정정한다(코드 주석·spec 문서 SoT 이중 갱신). 같은 PR 안에서 이미 `plan/in-progress/eia-context-schema-followups.md` 에 관련 후속 항목(W-spec-link-ci 등)이 기록돼 있으나 이 정확한 누락(스코프 열거 오류)은 그 목록에 없다 — 별도 1줄 정정으로 충분해 즉시 처리 가능.

## 그 외 검증 항목 (충돌 없음 확인)

- **(a) 필드 패리티** — `codebase/channel-web-chat/src/lib/eia-types.ts` 의 `WaitingContextBase`(`interactionType`/`waitingNodeId`/`conversationThread?`) + `ButtonsContext`(`buttonConfig`) / `NodeOutputContext`(`nodeOutput`), `codebase/packages/sdk/src/client.ts` 의 동일 구조가 백엔드 `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts` 의 `WaitingContextBaseDto`/`ButtonsContextDto`/`NodeOutputContextDto` 및 spec `14-external-interaction-api.md` §5.3 JSON 예시(`interactionType`/`waitingNodeId`/`conversationThread`/`buttonConfig{buttons,nodeOutput}`/`nodeOutput`)와 필드명·구조 1:1 일치. 충돌 없음.
- **(b) `conversationThread` 키 생략** — client 타입 모두 `conversationThread?: T`(`| null` 미사용)로 선언, `api-convention §5.4`(및 그 표에 명시된 EIA §5.3 실사례)·EIA §R17("**부재 표현이 형제 필드와 다른 이유**" 문단, present-when-available)과 정확히 일치. 백엔드 DTO(`conversationThread?: ConversationThread`, `| null` 없음)와도 동일. 충돌 없음.
- **(c) discriminator 없음** — client 타입 주석("`interactionType` 은 sound 판별자가 아니다 … `buttons` 가 buttonConfig 복원 실패 시 fallthrough")이 `swagger.md` Rationale "`discriminator` 는 판별자가 sound 할 때만 (§1-4)" 문단 및 EIA §5.3 "**`context` 는 판별자 없는 닫힌 2-variant union**" 콜아웃과 문언까지 거의 동일하게 미러됨. 백엔드 `ExecutionStatusDto.context` 도 `oneOf` 만 선언(`discriminator` 미사용). 3자(spec·backend DTO·client 타입) 완전 정합. 충돌 없음.
- **(e) 런타임 wire 불변(type-only)** — `use-widget.ts` 변경은 `status.context as WaitingForInputEvent` 캐스트 제거뿐(`parseWaitingForInput(status.context)` 로 대체, 로직·분기 무변경). `client.ts`/`eia-types.ts` 변경은 신규 `interface`/`type` 선언 + 기존 `context?: Record<string, unknown> | null` 필드의 타입 애노테이션 교체뿐, 직렬화·역직렬화 코드 경로에는 손대지 않음. 런타임 동작 변경 없음 확인.
- **요구사항 ID 충돌 없음** — 이번 diff 는 신규 요구사항 ID(EIA-*, WH-*, CCH-* 등)를 부여하지 않는다. 기존 ID 재사용·재정의 없음.
- **상태 전이/RBAC 충돌 없음** — 상태 머신·권한 구조 변경 없음(순수 타입 정밀화 + 문서 링크 가드 확장).
- **`chat-channel/types.ts` 의 `ai_form_render`(4종) vs `getStatus.context.interactionType`(3종) 불일치처럼 보이는 지점**: 이는 이번 PR 이 새로 만든 불일치가 아니다 — `WaitingInteractionType`(chat-channel adapter 내부, 4종)과 `ExternalInteractionType`(EIA 외부 표면, 3종, `ai_form_render` 는 `ai_conversation` 의 sub-state 로 이미 명시)은 서로 다른 레지스트리로 기존에 이미 분리돼 있으며, 이번 diff 는 해당 파일의 상대링크 depth 만 수정했다(값 정의는 무변경). False positive 로 판단해 미보고.
- **cafe24/EIA 무관 파일(`chat-channel-config.dto.ts`, `terminal-revoke-reconciler.types.ts`)** — 링크 depth 정정만, 대상 spec 존재·앵커 일치 실측 확인(위 python 검증). 충돌 없음.

## 요약

이번 PR 은 백엔드 `ExecutionStatusDto.context`(`ButtonsContextDto | NodeOutputContextDto`, discriminator 없는 닫힌 2-variant union)를 클라이언트(위젯 `eia-types.ts`, SDK `client.ts`) 타입으로 충실히 미러링했고, 필드명·`conversationThread` 부재 표현(키 생략)·discriminator 부재 원칙 3가지 모두 EIA §5.3/§R17, api-convention §5.4, swagger §1-4 Rationale 과 문언 수준까지 일치해 spec 위반이 없다. 런타임 wire 도 손대지 않은 순수 타입 정밀화임을 확인했다. 유일한 흠은 spec-link-integrity 가드 확장을 설명하는 `spec-impl-evidence.md` §4.2 (및 그 코드 주석)가 실제로 스캔되는 4개 codebase 루트 중 `frontend` 를 열거에서 빠뜨린 점으로, 기능은 정상이나(vitest 13/13 통과, frontend 링크 실제로 이번 PR 이 수정) 문서 서술이 구현 스코프를 과소 진술한다. CRITICAL 없음.

## 위험도
LOW
