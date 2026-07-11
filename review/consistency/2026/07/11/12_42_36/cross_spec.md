# Cross-Spec 일관성 검토 — RE-RUN (WARNING 수정 검증)

- 검토 모드: `--impl-done` (WARNING fix 재검증)
- 대상 spec: `spec/conventions/spec-impl-evidence.md` §4.2
- 검증 대상 diff: `1682777fe..HEAD` (5 commits: `964e887af`·`428134b64`·`dedc411fd`·`52e244034`·`25e098f76`), worktree `eia-client-context-types-33e771`
- 선행 리뷰: `review/consistency/2026/07/11/12_33_05/cross_spec.md` — WARNING "`spec-impl-evidence.md` §4.2 의 가드 스코프 서술이 `frontend` 루트를 누락"
- 검증 방법: 워크트리 절대경로에서 `git show`/`grep`/`Read` 로 각 항목 직접 재확인 + `vitest run spec-link-integrity.test.ts` 실행.

## 재검증 결과

### (a) §4.2 SoT 텍스트 vs 실제 `CODEBASE_SOURCE_ROOTS` — 일치 확인

`spec/conventions/spec-impl-evidence.md` §4.2 표 (수정 후, `git diff 1682777fe..HEAD` 로 확인):

> `spec-link-integrity.test.ts` (build 차단) | **(1)** `spec/**.md` 본문, **및 (2)** codebase `.ts`/`.tsx` 소스(`codebase/{backend,frontend,channel-web-chat,packages}`)의 JSDoc·주석 …

실제 `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:250-255`:

```ts
const CODEBASE_SOURCE_ROOTS = [
  "codebase/backend/src",
  "codebase/frontend/src",
  "codebase/channel-web-chat/src",
  "codebase/packages",
];
```

4개 루트(backend/frontend/channel-web-chat/packages) 전부 spec 문서에 열거됨. `frontend` 누락(선행 WARNING 의 핵심 지적) 해소. 일치.

### (b) 가드 실제 동작 = 문서화된 4-루트 — 일치 확인

`spec-link-integrity.test.ts` 상단 주석(수정 후):

> Codebase `.ts`/`.tsx` sources under `codebase/{backend,frontend, channel-web-chat,packages}` — …

`CODEBASE_SOURCE_ROOTS` 배열과 문언 수준까지 동일. `vitest run src/lib/docs/__tests__/spec-link-integrity.test.ts` 직접 실행 결과 **13/13 통과**(0 violations) — `collectCodebaseSources` sanity 테스트(`sources.length > 100`, `channel-web-chat/src/lib/eia-types.ts` 포함 확인, `dist`/`node_modules` 제외 확인)와 `findBrokenSpecLinksInSources` 실측 스캔 모두 green. 가드가 실제로 4-루트를 스캔하고 있음을 런타임으로 재확인.

### (c) 잔여 doc-code drift — 없음

`grep -rn "backend,channel-web-chat,packages\|backend, channel-web-chat, packages" spec/ codebase/` 결과 0건 — 3-루트(frontend 누락) 구버전 문구가 spec 이든 코드 주석이든 어디에도 남아있지 않음. §4.2 Rationale(R-9) 도 루트 목록을 재언급하지 않아 별도 미러 지점 없음. `spec-impl-evidence.md` §4 표(frontmatter-evidence 4건)와 §4.2 표(지식저장소·plan 무결성 5건)의 구분도 이번 diff 로 손대지 않아 정합 유지.

### (d) 클라이언트 context 타입 ↔ backend 미러 — 불변 확인 (선행 검증 재확인)

이번 5-commit 구간 중 타입 정의 자체(`codebase/channel-web-chat/src/lib/eia-types.ts` 의 `WaitingContextBase`/`ButtonsContext`/`NodeOutputContext`, `codebase/packages/sdk/src/client.ts` 의 동일 구조)는 `964e887af`(최초 구현)에서 확정되고 `dedc411fd`(comment 3줄 + `nodeOutput` NonNullable 강제)에서 소폭 보강된 뒤 그 이후 커밋(`428134b64`·`52e244034`·`25e098f76`)에서는 **무변경**(`git show --stat`으로 확인, 해당 커밋들은 client.ts/eia-types.ts 를 건드리지 않음). 백엔드 `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts` 의 `WaitingContextBaseDto`(`interactionType`/`waitingNodeId`/`conversationThread?`)·`ButtonsContextDto`(`buttonConfig`)·`NodeOutputContextDto`(`nodeOutput`)와 필드명·구조·"판별자 아님" 원칙·`conversationThread` present-when-available(`| null` 미사용) 모두 그대로 1:1 일치 — 선행 리뷰(12_33_05)의 결론과 동일하며 이번 구간에서 이 부분에 새로 손댄 변경 없음.

## 그 외 확인 (충돌 없음)

- 이번 3개 fix 커밋(`428134b64`·`dedc411fd`·`52e244034`·`25e098f76`)이 건드린 파일은 spec-link 가드 확장(`spec-links.ts`/`spec-link-integrity.test.ts`)·SDK 테스트 배선(`.claude/test-stages.sh`, `client.spec.ts`)·문서 정정(`spec-impl-evidence.md`, plan 파일)뿐이며, 신규 요구사항 ID·API 계약·상태 머신·RBAC 변경 없음.
- `25e098f76` 커밋 메시지에 "developer 가 spec/ 를 편집한 것은 CLAUDE.md 상 planner 트랙" 이라는 절차적 self-flag(convention WARNING2)가 있으나, 이는 **역할 분담 절차 문제**이지 spec 영역 간 데이터모델/API/상태/RBAC 충돌이 아니므로 cross-spec 관점 밖(convention_compliance 채널로 별도 보고됨).

## 요약

선행 리뷰(12_33_05)가 지적한 유일한 WARNING — `spec-impl-evidence.md` §4.2 SoT 표와 `spec-link-integrity.test.ts` 코드 주석이 실제 `CODEBASE_SOURCE_ROOTS`(4-루트: backend/frontend/channel-web-chat/packages) 중 `frontend` 를 누락해 문서-코드 drift 였던 문제 — 는 `25e098f76` 에서 두 위치 모두 `codebase/{backend,frontend,channel-web-chat,packages}` 로 정정되어 완전히 해소됐다. 실제 코드(`CODEBASE_SOURCE_ROOTS` 배열)와 문서(§4.2 표 + 테스트 주석) 문언이 이제 정확히 일치하며, `vitest run spec-link-integrity.test.ts` 13/13 통과로 가드의 런타임 동작도 이 4-루트 스코프와 부합함을 실측 확인했다. `spec/`·`codebase/` 전역에서 stale 3-루트 문구는 검색 결과 0건. 클라이언트 context 타입(`WaitingContext`/`ButtonsContext`/`NodeOutputContext`)의 backend DTO 미러 관계는 이번 fix 구간에서 재변경되지 않았고 선행 검증 그대로 정합 유지. Cross-Spec 관점에서 CRITICAL/WARINING 없음.

## 위험도
NONE
