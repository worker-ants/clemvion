# 정식 규약 준수 검토 — convention_compliance (RE-RUN)

- 검토 대상: `spec/conventions/spec-impl-evidence.md` §4.2 + 연관 구현/문서
- 모드: `--impl-done` RE-RUN (선행 실행 `review/consistency/2026/07/11/12_33_05/convention_compliance.md` 의 W1/W2 재검증)
- diff 범위: `git diff 1682777fe..HEAD` (5 commits, worktree `eia-client-context-types-33e771`)
  1. `964e887af` feat(web-chat,sdk): EIA getStatus context 닫힌 union 정밀화
  2. `428134b64` test(docs): spec-link-integrity 가드 codebase 확장 + 링크 14곳 정정
  3. `dedc411fd` refactor(docs,sdk): ai-review 반영 (SDK 배선·frontend 스캔·negative test)
  4. `52e244034` docs(review): fresh review 12_15_40 반영 (3rd resolution commit)
  5. `25e098f76` docs(review): impl-done 반영 — §4.2 SoT frontend 추가 + plan flip (선행 W1/W2 fix)

## 발견사항

없음 (선행 실행 W1/W2 모두 해소 확인, 신규 위반 없음).

## 재검증 결과

### (a) §4.2 SoT text — 가드 실제 동작과 일치 확인

`spec/conventions/spec-impl-evidence.md` §4.2 표(`spec-link-integrity.test.ts` 행)는 이제:

> codebase `.ts`/`.tsx` 소스(`codebase/{backend,frontend,channel-web-chat,packages}`)의 JSDoc·주석

로 4-root 를 명시한다. 실제 가드 구현 `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 의 `CODEBASE_SOURCE_ROOTS`:

```ts
const CODEBASE_SOURCE_ROOTS = [
  "codebase/backend/src",
  "codebase/frontend/src",
  "codebase/channel-web-chat/src",
  "codebase/packages",
];
```

4개 root(backend/frontend/channel-web-chat/packages) 로 정확히 일치. `spec-link-integrity.test.ts` 헤더 주석도 동일 4-root 로 동기화됐다(커밋 `25e098f76`). 선행 실행이 지적한 "frontend 누락"(코드는 이미 `dedc411fd` 에서 frontend/src 를 추가했으나 spec 표·test 주석이 3-root 로 stale) 은 완전히 해소.

### (b) 절차 관련 우려 — follow-up 등재 확인

developer 가 `spec/` (`spec-impl-evidence.md §4.2`) 를 직접 편집한 절차적 우려(CLAUDE.md 상 `spec/` 는 `project-planner` 트랙, `developer` 는 read-only)는 `plan/in-progress/eia-context-schema-followups.md` `## 리뷰 후속` 섹션 마지막 항목으로 durable 하게 등재됨(커밋 `25e098f76`):

> - [ ] **`spec-impl-evidence.md §4.2` 편집 절차 사후 확인** (planner/사용자) — 본 PR 에서 developer 가 가드 확장에 수반해 §4.2 SoT 표를 직접 편집했다(CLAUDE.md 상 `spec/` 는 planner 트랙). 정합화 성격이라 impl-done 이 사후 검증했으나, convention checker 가 "subagent write isolation 논리 혼동" 을 지적 — 절차상 planner 가 사후 리뷰하거나, 향후 유사 정합화의 경계를 명확히 할 것.

침묵 폐기가 아니라 `plan/in-progress/**` 의 미완료 체크박스로 기록됐고, 커밋 메시지에도 "W3 developer 의 §4.2 편집 절차 사후 확인을 §리뷰 후속 에 durable 등재" 로 명시. plan 은 frontmatter(`worktree`/`started`/`owner`) 도 정상 보유 — plan-frontmatter 가드 통과 형태.

> 참고(정보용, 신규 발견 아님): 절차 자체(developer 의 spec 직접 편집)는 여전히 이번 PR 안에서 이미 발생한 사실이며 본 RE-RUN 이 되돌릴 수 있는 사안이 아니다. 등재 여부만 확인 대상이었고, 이는 충족됨. 실질적 정합화 내용(§4.2 표 정정)은 accuracy 상 올바르므로 이 절차 이슈는 향후 프로세스 개선 권고이지 현재 CRITICAL/BLOCK 사유는 아니다.

### (c) `api-convention §5.4` 클라이언트 타입 미러 — 계속 유지 확인

`spec/5-system/2-api-convention.md §5.4` "부재 표현 — `null` vs 키 생략" 은 `context.conversationThread` 를 **present-when-available(키 생략, `| null` 아님)** 로 규정하며, Rationale("왜 conversationThread 를 null 로 정규화하지 않는가")은 그 근거로 "REST context 와 SSE wire 의 형식 parity(위젯 단일 파서 재사용)" 를 든다.

이번 diff 의 양쪽 클라이언트 타입 모두 이 계약을 그대로 미러한다:

- `codebase/channel-web-chat/src/lib/eia-types.ts` — `WaitingContextBase.conversationThread?: ConversationThread;` (optional, `| null` 없음)
- `codebase/packages/sdk/src/client.ts` — `WaitingContextBase.conversationThread?: Record<string, unknown>;` (optional, `| null` 없음)

두 파일 모두 JSDoc 에서 "present-when-available — 값이 있을 때만 키가 present, 부재 시 키 자체가 생략(`| null` 아님)" 을 명시하고, 대응 unit 테스트(`eia-events.test.ts` "conversationThread 는 present-when-available", `client.spec.ts` "conversationThread 부재 = 키 생략")가 이를 회귀 가드로 고정한다. §5.4 계약과 어긋나지 않음.

### (d) 3rd resolution commit(`52e244034`) — 신규 규약 위반 없음

`52e244034`("docs(review): fresh review 12_15_40 반영")은 커밋 메시지 자체가 "resolution 커밋 `dedc411fd` 를 fresh review 한 결과" 로 시작 — 5-commit 시퀀스 중 최초 feat 커밋(`964e887af`) 이후 3번째 "resolution" 커밋(`428134b64`→1st, `dedc411fd`→2nd, `52e244034`→3rd)에 해당한다. 변경 내역을 직접 diff 로 확인:

- `codebase/channel-web-chat/src/lib/eia-events.test.ts` — 테스트 **주석**만 수정(설명 줄이 `// @ts-expect-error` 로 시작해 TS pragma 로 오인되는 self-inflicted TS2578 방지). 실행 코드·assertion 무변경.
- `codebase/packages/sdk/src/client.spec.ts` — 동일 클래스의 주석 정확도 수정(“SDK build=tsc 가 negative 를 검증” 이라는 부정확한 서술을 “검증 통로는 test(ts-jest)” 로 정정). 실행 코드 무변경.
- `plan/in-progress/eia-context-schema-followups.md` — C2 항목의 "pre-existing red 3건" 표현을 실측 "~10건" 으로 정정(문서 정확도, 신규 항목 아님).
- 나머지 변경 파일은 전부 `review/code/2026/07/11/12_15_40/**` (fresh code-review 산출물) — `review/code/**` 는 code-review-agents 쓰기 권한 범위, CLAUDE.md 저장 위치 규약과 일치.

`spec/conventions/**` 편집 없음, 신규 식별자·API endpoint·에러코드·이벤트 페이로드 형식 변경 없음, 문서 구조(Overview/본문/Rationale) 변경 없음. 즉 이 커밋은 코멘트·문서 정확도 정정에 국한돼 있어 정식 규약 관점에서 신규 위반 표면이 없다.

## 부가 확인 (교차 점검, 신규 발견 아님)

- `spec-impl-evidence.md` frontmatter `code:` 는 `spec-link-integrity.test.ts`·`spec-links.ts` 를 이미 포함 — 이번 확장(`collectCodebaseSources`/`findBrokenSpecLinksInSources` 추가)이 동일 파일 내 함수 추가라 frontmatter 갱신 불요, evidence 가드 계속 통과 형태.
- `codebase/packages/sdk/src/client.ts` 의 신규 JSDoc(`[Spec EIA §5.3].` 등 URL 없는 대괄호 인용)은 파일 전역에 이미 존재하는 기존 관례(예: 17번째 줄 `[Spec EIA §4 / §5].`, 253번째 줄 `[Spec EIA §5.1].`)와 동일 스타일 — SDK 패키지가 monorepo 밖에 배포될 가능성을 고려해 상대경로 하이퍼링크 대신 텍스트 인용을 쓰는 기존 house style 을 그대로 따른 것으로, 신규 이탈이 아니다.
- `WaitingContext`/`ButtonsContext`/`NodeOutputContext` 명명은 기존 SDK/위젯 타입 명명 패턴(`ExecutionStatus`, `TriggerWebhookResult` 등, `Dto` 접미사 없는 plain interface)과 일관.
- 위젯·SDK 양쪽에 동일 타입을 각각 재선언(중복)한 것은 과거 결정 "cafe24/makeshop 미러 중복은 의도"([`project_cafe24_makeshop_mirror_dedup_withdrawn.md`] 계열 결정)와 같은 궤의 의도적 미러 — 이번 PR 코멘트도 "notification-dispatcher.types 패턴과 동일" 로 명시.

## 요약

선행 `--impl-prep`/`--impl-done` 실행이 지적한 두 건 — (W1) §4.2 SoT 표의 codebase 스캔 root 4종 중 frontend 누락(코드-문서 불일치), (W2) developer 의 spec 직접 편집에 대한 절차적 우려 — 는 5-commit 시퀀스의 마지막 커밋(`25e098f76`)에서 각각 §4.2 표 정정과 `eia-context-schema-followups.md §리뷰 후속` durable 등재로 온전히 해소됐다. `api-convention §5.4`(present-when-available 키 생략 계약)는 위젯·SDK 양쪽 클라이언트 타입 미러에서 그대로 유지되며 회귀 테스트로 고정돼 있다. "3rd resolution commit"(`52e244034`)은 주석·문서 정확도 정정에 국한돼 신규 규약 위반 표면을 만들지 않는다. 정식 규약(`spec/conventions/**`) 준수 관점에서 이번 RE-RUN 대상 diff 전체에 CRITICAL/WARNING 급 신규 발견 없음.

## 위험도

NONE

STATUS: SUCCESS
