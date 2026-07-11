---
title: 웹채팅 위젯 table 잘림 배너 총 개수 노출 (§2 parity)
worktree: llm-usage-doc-alignment-01d7a4
started: 2026-07-11
owner: project-planner
spec_area: spec/7-channel-web-chat/1-widget-app.md
spec_impact:
  - spec/7-channel-web-chat/1-widget-app.md
---

## 배경

`webchat-widget-presentation-followups.md` §미구현 항목 "truncation total-count 표시".
메인 편집기 run-results 는 잘림 시 `truncated · total {itemsTotalCount ?? rowsTotalCount}` 로
**총 개수를 함께** 보여주는데(`assistant-presentations-block.tsx:316`), 웹채팅 위젯은
`TableData.truncated: boolean` 만 소비해 `일부 행만 표시됩니다.` **고정 문구**만 낸다.

## 실측 (Explore)

- **백엔드 무변경**: `applyOneMbCap`(render-tool-provider.ts:322/336/344)이 `totalCount=rawArray.length`
  (잘리기 전)을 top-level `truncation.{rowsTotalCount|itemsTotalCount}` 로 이미 실어 보낸다.
  노드 경로(table/carousel.handler)도 `output.{rowsTotalCount|itemsTotalCount}` 로 싣는다.
- **wire 무변경**: 위젯 SSE 레이어는 presentations 를 `Record<string,unknown>` untyped passthrough.
  `presentation.ts` `truncationMeta`(L110-125)가 **4개 키 전부**(`rowsTotalCount`/`itemsTotalCount`
  포함)를 이미 `output` 으로 흡수 중 — 즉 총 개수는 이미 위젯 `output` 까지 도달하나 `toTable` 이
  `rowsTruncated` 만 읽고 total 을 **버린다**(dead field).
- **§10.4/§4 무변경**: `{itemsTotalCount|rowsTotalCount}` = "잘리기 전 element 개수"로 이미 규범 정의
  (`spec/4-nodes/6-presentation/0-common.md §4 L100·§10.4 L312`).

## 결정 (spec 변경 — 최소) — consistency-check 반영판

**§2(화면 구조, L48 presentation inline 행)**: `PresentationPayload.truncation … 잘림 표시를 노출한다`
→ **잘림 표시를 총 개수(`{itemsTotalCount|rowsTotalCount}`, 잘리기 전 총 개수)와 함께 노출**한다
(메인 편집기 run-results 와 parity). **table 배너 한정 — carousel 은 잘림 배너 자체가 없어
[`webchat-widget-presentation-followups`](../plan/in-progress/webchat-widget-presentation-followups.md)
가 별도 추적** 이라는 inline caveat 포함(consistency INFO #1). 필드 순서는 SoT(`0-common.md`
§4/§10.4) 대로 **items-first**(consistency INFO #2). 데이터는 이미 흡수되는 메타의 소비 확장이라
wire·§10.4 무변경.

**§R8**: truncation 흡수 서술에 "총 개수(`*TotalCount`)도 동일 경로로 흡수돼 table 배너에 함께 노출"
1절 추가.

### 스코프 경계 (명시)
- **본 결정은 table 배너 한정.** carousel 은 현재 **잘림 배너 자체가 없다**(0→1 신설) — 이는 별개의
  선행 미구현 항목(`webchat-widget-presentation-followups` §carousel 잘림 배너, 본 세션 미선택)이며
  본 §2 변경이 새로 만든 gap 이 아니다(기존 §2 "잘림 표시 노출"도 carousel 엔 이미 미충족). §2 문구는
  presentation 일반을 서술하되 **table-only caveat 를 인라인 명시**, carousel 배너 구현은 해당 followup 추적.
- widget-app frontmatter `status: implemented` 유지 — 본 변경은 기존 배너(table) 강화이며, carousel
  미구현은 **이전부터 존재하던** 추적 항목이라 본 PR 이 status 를 바꾸지 않는다.

### 문체 (consistency WARNING 반영)
위젯 user-facing 문자열은 **해요체**가 관례다(실측: "종료할까요?…없어요"·"입력해 주세요"·"…사라져요"·
"…없어요. …시도해 주세요"). 유일한 예외가 기존 배너 `일부 행만 표시됩니다.`(`~됩니다`, i18n-userguide
Principle 6 위반). 본 PR 이 **바로 그 배너 라인**을 확장하므로 신규·기존 문구 모두 **해요체로 정규화**한다:
- totalCount 있음: `총 {N}개 중 일부만 표시돼요.`
- totalCount 없음(폴백): `일부 행만 표시돼요.` (기존 `…표시됩니다.` 를 같은 라인에서 해요체로 교정)

위젯은 i18n-userguide 하드코딩 빌드 가드(`hardcoded-korean-ratchet`) 스캔 밖이라 사전 분리는 강제 아님 —
기존 위젯 관례(인라인 한국어 + 해요체)를 따른다.

## 후속 구현 (developer, 같은 PR)

- `presentation.ts`: `TableData` 에 `totalCount?: number` 추가, `toTable` 이 `output.rowsTotalCount`
  (number)만 투영. (CarouselData 무변경 — 별건.)
- `presentations.tsx` `TableView`: `truncated` 배너 문구를 `총 N개 중 일부만 표시돼요.`(totalCount
  있을 때) / `일부 행만 표시돼요.`(폴백, 기존 `…표시됩니다.` 를 같은 라인에서 해요체로 교정) — §문체 참조.
- 테스트: `presentation.test.ts`(toTable totalCount 투영) · `presentations.test.tsx`(배너 총 개수 렌더).
- **followups 갱신(plan_coherence WARNING)**: 구현 완료 후 `webchat-widget-presentation-followups.md`
  §미구현 항목 1 을 "table 부분 해소(본 PR #), carousel 잔여(item 2 병합/의존)"로 재기술한다 —
  planner 규약상 실완료 전 체크 금지이므로 stale 방지 위해 재기술만(항목 전체 체크 아님). ✅ 반영됨.

## 검증 (완료)

- **TEST WORKFLOW**: lint·unit(위젯 78 tests)·build·e2e(253 tests) 전량 PASS.
- **/ai-review**: risk LOW, Critical 0, Warning 3 → 전량 조치(CHANGELOG·followups 재기술·배너 문구 고객사
  영향 note) + INFO 4(NaN/음수 가드 강화, 테스트 분리/보강, 문서 정정). RESOLUTION 기록.
- **/consistency-check --impl-done** (spec/7-channel-web-chat/1-widget-app.md): **BLOCK: NO**, 5 checker
  Critical 0 (plan_coherence·naming_collision journal 복구 — INFO만). cross_spec/rationale/naming 정합 확인.
- **i18n WARNING(반복)**: 위젯 UI 하드코딩 한국어의 i18n-userguide 스코프 공백 — **내 diff 가 원인 아닌
  기존 규약 침묵**(위젯은 이미 인라인 한국어·hardcoded-korean 가드 스캔 밖). 되돌림 불요. 위젯 EN
  로컬라이제이션은 제품 정책이라 rushed 각주 대신 별건 follow-up(task_e2fc42c8)으로 라우팅.
