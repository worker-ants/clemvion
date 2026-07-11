# 신규 식별자 충돌 검토 — eia-client-context-types-33e771 (`--impl-done` RE-RUN)

대상 diff: `git diff 1682777fe..HEAD` (5 commits: `964e887af`, `428134b64`, `dedc411fd`, `52e244034`, `25e098f76`)

본 재검토는 이전 실행(`review/consistency/2026/07/11/12_33_05/naming_collision.md`, 4-commit 시점, 위험도 NONE)
이후 추가된 3rd resolution 커밋(`25e098f76`, impl-done 반영)만 증분 검증한다.

## 검토한 신규 식별자 (누적)

- `codebase/channel-web-chat/src/lib/eia-types.ts`: `WaitingContextBase`(module-private) / `ButtonsContext` / `NodeOutputContext` / `WaitingContext`(export)
- `codebase/packages/sdk/src/client.ts` (+ `index.ts` re-export): `WaitingContextBase`(module-private) / `ButtonsContext` / `NodeOutputContext` / `WaitingContext`
- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`: `collectCodebaseSources` / `findBrokenSpecLinksInSources` (export)
- `spec/conventions/spec-impl-evidence.md` §4.2 — 신규 heading/anchor 없음 (기존 표 셀 텍스트만)

## 3rd 커밋(`25e098f76`)이 새로 도입한 것 — 없음 확인

`git show 25e098f76 --stat` 및 파일별 diff 를 직접 확인한 결과, 코드 식별자(interface/type/const/함수/export)를
신규 도입하는 hunk 는 **0건**이다. 변경 내용은 전부 이전 커밋에서 이미 검토된 식별자를 재언급하는 문서/주석/체크박스뿐:

1. **`spec/conventions/spec-impl-evidence.md`** — §4.2 가드 표의 기존 한 행(`spec-link-integrity.test.ts` 스캔 대상)에서
   `codebase/{backend,channel-web-chat,packages}` → `codebase/{backend,frontend,channel-web-chat,packages}` 로
   텍스트만 치환(`-`1줄/`+`1줄). 새 heading(`##`/`###`)도 새 anchor 도 생성하지 않음 — §4.2 는 diff 이전부터
   존재하던 기존 절이다(`grep -n '^#'` 로 헤딩 목록 확인, §4.2 = 기존 122행).
2. **`codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts`** — 상단 주석(코멘트) 문구만
   동일하게 3-루트→4-루트 로 정정. 코드 라인·식별자 변경 0건.
3. **`plan/in-progress/eia-context-schema-followups.md`** — 기존 두 항목을 `[ ]`→`[x]` 플립 + 완료 노트,
   신규 후속 bullet 1건 추가(자연어 서술, 신규 식별자 아님).
4. **`review/consistency/2026/07/11/12_33_05/*`** — 이전 checker 라운드의 산출물 커밋(리포트 텍스트, 코드 아님).

## 누적 식별자 재확인 — 충돌 없음 (변동 없음)

이전 리포트(12_33_05)의 판정을 grep 으로 재확인:

- `ButtonsContext` — `codebase/channel-web-chat/src/lib/eia-types.ts:146`, `codebase/packages/sdk/src/client.ts:124` 2곳만 정의. 3rd 커밋 이후에도 동일(추가 정의처 없음).
- `NodeOutputContext` — `eia-types.ts:151`, `client.ts:129` 2곳만.
- `WaitingContext` — `eia-types.ts:166`, `client.ts:140` 2곳만 (`type WaitingContext = ButtonsContext | NodeOutputContext`).
- `codebase/packages/sdk/src/index.ts` 의 `WaitingContext`/`ButtonsContext`/`NodeOutputContext` re-export(3rd 커밋 이전, `964e887af`)도 기존 `ExecutionStatus` 등 인접 export 목록과 이름 겹침 없음.

두 정의처(`channel-web-chat`, `@workflow/sdk`)는 서로 다른 독립 패키지(`channel-web-chat` 은 `@workflow/sdk` 에
의존하지 않음)이며, 동일 패턴(backend DTO 를 각자 미러링, `Dto` 접미사 탈락)이 diff 이전부터 `ExecutionStatus` 로
이미 확립돼 있어 cross-package 동명 재선언은 신규 리스크가 아니다 — 이전 라운드 판정 그대로 유효.

`collectCodebaseSources`/`findBrokenSpecLinksInSources` 도 `spec-links.ts` 내 기존 함수(`collectSpecMarkdown`,
`findBrokenLinks`, `collectHeadings`, `extractLinks`, `isExternal`, `headingSlugs`, `slugify`, `decodeAnchor`)와
이름·역할 모두 구분되며, 3rd 커밋에서 이 파일 자체는 변경되지 않았다(diff 목록에 `spec-links.ts` 없음).

## §4.2 heading/anchor 무결성 — 재확인

`spec/conventions/spec-impl-evidence.md` 의 현재 heading 목록(`grep -n '^#'`)에 `## 4.2 지식저장소·plan 무결성
가드`가 diff 전후 동일 위치·문구로 존재하며, 3rd 커밋의 diff 는 이 절 **내부** 표의 셀 텍스트 치환뿐이다. 새
`#anchor` 를 만들지 않으므로 `spec-link-integrity.test.ts` 자체 가드(spec 문서 anchor 무결성)와도 충돌하지 않는다.

## 요약

3rd resolution 커밋(`25e098f76`)은 spec §4.2 표 텍스트 1행, 테스트 파일 주석 문구, plan 체크박스/노트만 변경했고
코드 식별자(신규 interface/type/함수/export/ENV/설정키/파일경로/endpoint/이벤트명)를 전혀 도입하지 않았다 —
diff 전량 직접 확인으로 재검증 완료. 앞선 4-commit 시점(`12_33_05`)에서 이미 NONE 판정을 받은
`ButtonsContext`/`NodeOutputContext`/`WaitingContext`/`WaitingContextBase`(module-private)와
`collectCodebaseSources`/`findBrokenSpecLinksInSources`는 이번 재확인에서도 각자 소속 파일·패키지 내 유일한
정의처를 유지하며, 기존 export 와의 명칭 충돌도 발견되지 않았다. §4.2 편집은 anchor/heading 을 추가하지 않아
문서 링크 무결성 가드와도 무충돌이다.

## 위험도

NONE

STATUS: SUCCESS
