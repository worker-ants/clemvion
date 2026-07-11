# 신규 식별자 충돌 검토 — eia-client-context-types-33e771

대상 diff: `git diff 1682777fe..HEAD` (4 commits: `964e887af`, `428134b64`, `dedc411fd`, `52e244034`)

## 검토한 신규 식별자

- `codebase/channel-web-chat/src/lib/eia-types.ts`: `WaitingContextBase`(모듈-private) / `ButtonsContext` / `NodeOutputContext` / `WaitingContext`(export)
- `codebase/packages/sdk/src/client.ts` (+ `index.ts` export): `WaitingContextBase`(모듈-private) / `ButtonsContext` / `NodeOutputContext` / `WaitingContext`
- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`: `collectCodebaseSources` / `findBrokenSpecLinksInSources` (export)
- `spec/conventions/spec-impl-evidence.md` §4.2 (표 셀 텍스트 수정만, 신규 heading/anchor 없음)

## 발견사항

### (a) 각 패키지 내 기존 export 와 충돌 여부 — 충돌 없음

`ButtonsContext`/`NodeOutputContext`/`WaitingContext`/`WaitingContextBase` 는 diff 이전 두 패키지(`channel-web-chat`, `@workflow/sdk`) 어디에도 존재하지 않았다 (전체 리포 grep 결과 신규 도입 지점 외 등장 없음, `backend`측 `*Dto` 접미사 버전만 기존 존재). `collectCodebaseSources`/`findBrokenSpecLinksInSources` 도 `spec-links.ts` 파일 내 기존 함수(`collectSpecMarkdown`, `findBrokenLinks`, `collectHeadings`, `extractLinks`, `isExternal`, `headingSlugs`, `slugify`, `inGeneratedCatalog`, `decodeAnchor`)와 이름이 명확히 구분되고, import 하는 `spec-link-integrity.test.ts` 에서도 4개 함수(`collectSpecMarkdown`/`findBrokenLinks`/`collectCodebaseSources`/`findBrokenSpecLinksInSources`)를 동시에 가져와도 이름 겹침이 없다. 결론: 충돌 없음.

### (b) `WaitingContext` cross-package homonym — `ExecutionStatus` 선례에 부합, 수용 가능

동일한 파일(`eia-types.ts`, `client.ts`) 안에 이미 `ExecutionStatus` interface 가 **diff 이전부터** 독립적으로 각 패키지에 존재한다(이번 diff 는 두 `ExecutionStatus.context` 필드 타입만 `Record<string, unknown>` → `WaitingContext` 로 좁혔을 뿐, interface 자체는 pre-existing). 두 `ExecutionStatus` 는 구조가 서로 다르다:

- widget: `workflowId?: string`, `status: string`, `result?: unknown`
- SDK: `workflowId: string`, `status: 'pending' | 'running' | ...` 리터럴 유니언, `result?: Record<string, unknown> | null`, `seq: number`(필수)

즉 이 코드베이스는 **공유 타입 패키지로 통합하지 않고, 각 소비 패키지가 backend DTO 를 독립적으로 미러링**하는 확립된 패턴을 이미 갖고 있다 (`channel-web-chat` 은 `@workflow/sdk` 에 의존하지 않음 — package.json 확인, 완전히 독립된 앱). `WaitingContext`/`ButtonsContext`/`NodeOutputContext`/`WaitingContextBase` 도 동일 패턴을 따른다: 둘 다 동일한 backend DTO(`WaitingContextBaseDto`/`ButtonsContextDto`/`NodeOutputContextDto`, `responses.dto.ts`)를 각자 미러링하되 구조가 미묘하게 다르다(예: widget `conversationThread?: ConversationThread` vs SDK `conversationThread?: Record<string, unknown>`; widget `interactionType: ExternalInteractionType` vs SDK `interactionType: 'form' | 'buttons' | 'ai_conversation'` 리터럴). 명명 접미사 컨벤션도 일관: backend `*Dto` ↔ 클라이언트 측 접미사 없는 동명 인터페이스(`ExecutionStatusDto`→`ExecutionStatus`, `ButtonsContextDto`→`ButtonsContext` 등). 부속 `WaitingContextBase` 는 두 파일 모두 export 되지 않는 module-private 타입이라 외부 노출 충돌 소지도 없다. 결론: 선례에 부합하며 수용 가능.

### (c) `collectCodebaseSources`/`findBrokenSpecLinksInSources` — spec-links.ts 내부 충돌 없음

두 함수는 `spec-links.ts` 367줄 파일에서 이름·역할 모두 기존 `collectSpecMarkdown`/`findBrokenLinks` 와 구분된다(작동 대상이 `spec/**.md` vs `codebase/**.ts`/`.tsx` 로 상보적). 다만 plan 파일(`plan/in-progress/eia-context-schema-followups.md`, 이번 diff 로 갱신됨)에 저자 스스로 "`collectSpecMarkdown`/`findBrokenLinks` 와 ~40줄 골격 중복 — 저우선 리팩터 후속" 이라고 이미 기록해 두었다. 이는 이름 충돌이 아니라 **구현 중복**(별개 관점, DRY)이며 저자가 인지하고 명시적으로 defer 한 사안이라 본 리뷰(신규 식별자 충돌) 범위에서는 문제 없음.

### (d) spec-impl-evidence.md §4.2 edit — anchor/heading 충돌 없음

diff 는 기존 표(`## 4.2` 절 내 가드 목록 표)의 한 셀 텍스트만 수정한 것으로, 신규 heading/anchor 를 추가하지 않는다(`git diff` 확인: `-`/`+` 각 1줄, 표 행 텍스트 치환뿐). 따라서 anchor slug 충돌 가능성 자체가 없다.

### 참고 (범위 밖, 충돌 아님) — 표 텍스트와 실제 코드의 소스 루트 목록 불일치

식별자 충돌은 아니지만 같은 hunk 를 검증하다 발견: spec-impl-evidence.md §4.2 표 셀은 소스 스캔 대상을 "`codebase/{backend,channel-web-chat,packages}`" 로 서술하지만, 실제 `spec-links.ts` 의 `CODEBASE_SOURCE_ROOTS` 는 `codebase/frontend/src` 도 포함한다(4개 루트 중 3개만 표에 언급). 이름 충돌 범주는 아니므로 본 리포트의 판정에는 반영하지 않으나, 문서-코드 정합 관점 리뷰어가 있다면 별도로 다룰 만하다.

## 요약

이번 diff 가 도입하는 신규 export 식별자(`ButtonsContext`/`NodeOutputContext`/`WaitingContext`, widget/SDK 각각 + module-private `WaitingContextBase`, 그리고 `spec-links.ts` 의 `collectCodebaseSources`/`findBrokenSpecLinksInSources`)는 소속 패키지 내부에서도, 리포 전체에서도 기존에 다른 의미로 쓰이던 이름과 충돌하지 않는다. `WaitingContext` 류의 cross-package 동명 재선언은 신규 패턴이 아니라 이미 `ExecutionStatus` 로 확립된 "각 클라이언트 패키지가 backend DTO 를 독립 미러링하고 `Dto` 접미사만 뗀다" 컨벤션을 그대로 따른 것이며, `channel-web-chat` 이 `@workflow/sdk` 에 의존하지 않는 아키텍처(완전 독립 앱)이기 때문에 실제 타입 시스템 충돌(동일 스코프 내 재선언 등)도 발생하지 않는다. `spec-links.ts` 신규 함수 2개는 기존 함수와 이름·역할이 명확히 분리되며, 구현 골격 중복은 저자가 이미 후속 항목으로 defer 처리했다. spec-impl-evidence.md 편집은 표 텍스트 치환뿐으로 신규 anchor 를 만들지 않는다. 요구사항 ID·API endpoint·이벤트명·환경변수·파일 경로 어느 범주에서도 이번 diff 가 새로 도입한 것은 없다(context 타입 정밀화는 기존 `getStatus` 응답의 `context` 필드 타입을 좁히는 것일 뿐, 신규 endpoint/이벤트가 아님).

## 위험도

NONE

STATUS: SUCCESS
