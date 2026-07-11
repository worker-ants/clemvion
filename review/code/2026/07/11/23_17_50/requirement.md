# 요구사항(Requirement) 리뷰 — 웹채팅 위젯 table 잘림 배너 총 개수 노출 (§2/R8 parity)

검토 대상: `codebase/channel-web-chat/src/lib/presentation.{ts,test.ts}`,
`codebase/channel-web-chat/src/widget/components/presentations.{tsx,test.tsx}`,
`spec/7-channel-web-chat/1-widget-app.md` (§2 · 흡수 서술 절), `plan/in-progress/spec-draft-webchat-truncation-total-count.md`,
`review/consistency/2026/07/11/22_58_26/*`(동봉 consistency-check 산출물).

## 발견사항

- **[INFO]** `totalCount` 숫자 유효성 검증이 `typeof === "number"` 만 수행 — `NaN`/음수/`Infinity` 미필터
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts:526-527` (`toTable`)
    ```ts
    totalCount:
      typeof output.rowsTotalCount === "number" ? output.rowsTotalCount : undefined,
    ```
  - 상세: `typeof x === "number"` 는 `NaN`/음수/`Infinity` 도 통과시킨다. 백엔드가 잘못된 값을 보내면(계약 위반이지만) 배너가 `"총 NaN개 중 일부만 표시돼요."` 처럼 렌더될 수 있다. spec(`0-common.md §4`, `2-table.md §5.1/§5.2`, `1-ai-agent.md §7.10`)이 필드를 `number`(정수 개수, cap 전 element 개수) 로만 규정하고 별도 range 제약을 언급하지 않으므로 코드가 spec 을 위반하는 것은 아니며, 백엔드가 이미 신뢰 경계(zod-validated `rawArray.length`)로 이 값을 생성하는 유일한 소스라 실제 발생 가능성은 낮다. 엄밀 방어가 필요하면 `Number.isFinite(x) && x >= 0` 로 강화할 수 있다는 정도의 참고 사항.
  - 제안: 필수 아님. 강화하려면 `Number.isFinite` + 비음수 체크 추가 고려.

- **[INFO]** `plan/in-progress/spec-draft-webchat-truncation-total-count.md` 내부 "후속 구현" 절의 배너 문구가 같은 문서의 "문체" 절 및 실제 구현과 어긋남(문서 자기 불일치, 코드는 정상)
  - 위치: `plan/in-progress/spec-draft-webchat-truncation-total-count.md` `## 후속 구현` 절 — "`총 N개 중 일부만 표시됩니다.`(totalCount 있을 때) / 없으면 기존 `일부 행만 표시됩니다.` 폴백."
  - 상세: 같은 문서 상단의 `### 문체 (consistency WARNING 반영)` 절은 정확히 이 배너 문구를 해요체(`총 {N}개 중 일부만 표시돼요.` / `일부 행만 표시돼요.`)로 정규화하기로 결론지었고, 실제 구현(`presentations.tsx:1588-1594`, `presentations.test.tsx`)도 해요체로 일관되게 구현·테스트됐다. 즉 **코드는 spec/문체 결정과 완전히 일치**하지만, plan 문서 자체의 "후속 구현" 목록 항목만 결정 이전 초안 문구(`~됩니다`)를 그대로 남겨 문서 내부적으로 자기모순이다. 향후 이 plan 을 근거 자료로 참조하는 사람이 "후속 구현" 절만 읽으면 실제 구현과 다른 문구를 기대할 수 있다.
  - 제안: `plan/in-progress/spec-draft-webchat-truncation-total-count.md` `## 후속 구현` 절의 인용 문구를 `총 N개 중 일부만 표시돼요.` / `일부 행만 표시돼요.` 로 정정(코드 변경 불필요 — 문서만).

- **[INFO]** `webchat-widget-presentation-followups.md` 항목 1 체크박스 갱신 미포함 — 이미 동봉된 `plan_coherence.md` 가 WARNING 으로 지적한 사항과 동일
  - 위치: `plan/in-progress/spec-draft-webchat-truncation-total-count.md` `## 후속 구현`
  - 상세: 이번 diff 는 `webchat-widget-presentation-followups.md` 를 건드리지 않는다. 동봉된 consistency-check 산출물(`review/consistency/2026/07/11/22_58_26/plan_coherence.md`)이 이미 이 stale 위험을 WARNING 으로 정확히 짚었으므로 본 리뷰에서 중복 CRITICAL/WARNING 을 걸지는 않으나, 이 PR 이 머지될 때 해당 followups 트래커 항목 1 을 "table 부분 해소" 로 재기술하는 후속 조치가 실제로 수행됐는지 확인 필요.
  - 제안: `resolution-applier`/developer 단계에서 `plan_coherence.md` 의 제안을 실제로 반영(followups.md 항목 1 재기술)했는지 확인.

## 스펙 충실도 (item 9) — 상세

- `spec/7-channel-web-chat/1-widget-app.md` §2 (presentation inline 행) 이 같은 변경셋 안에서 함께 갱신됐고, 문구("잘림 표시를 총 개수(`{itemsTotalCount|rowsTotalCount}`...)와 함께 노출한다", "`총 N개 중 일부만 표시돼요.`", "*(현재 table 배너 한정 — carousel 은 잘림 배너 자체가 미구현이라 별도 후속으로 추적한다.)*")이 실제 구현(`presentations.tsx` `TableView`, `presentation.ts` `TableData.totalCount`/`toTable`)과 **line-level 로 정확히 일치**한다 — 필드명(`rowsTotalCount`), 조건(truncated=true 일 때만 의미), 폴백 문구, table-only 스코프 caveat 모두 spec 원문 그대로 구현됨.
- `spec/4-nodes/6-presentation/0-common.md` §4(L100)·§10.4(L312) 의 `output.{itemsTotalCount|rowsTotalCount}`("잘리기 전 element 개수") 정의, `spec/4-nodes/6-presentation/2-table.md` §5.1(L215) 의 `output.rowsTotalCount? number "cap 전 element 개수"`, `spec/4-nodes/3-ai/1-ai-agent.md` §7.10 의 `PresentationPayload.truncation.rowsTotalCount?: number` type block 과 코드의 필드명·타입·의미가 전부 일치.
- 메인 편집기 parity 근거(`codebase/frontend/src/components/editor/run-results/renderers/assistant-presentations-block.tsx:316-319` 의 `p.truncation.itemsTotalCount ?? p.truncation.rowsTotalCount`)도 직접 확인 — 위젯이 동등 필드를 소비하는 것이 실제로 기존 메인 에디터 동작과 parity 관계임을 재확인. 표기(문구)는 다르지만("truncated · total N" vs "총 N개 중 일부만 표시돼요.") 기능적 동등성(총 개수 노출)은 유지.
- carousel 미포함 스코프 경계는 코드(`CarouselData` 무변경)·spec(§2 인라인 caveat)·plan(`## 스코프 경계` 절) 세 곳 모두 정합적으로 일치 — spec-drift 없음, CRITICAL/WARNING 대상 없음.
- 동봉된 consistency-check 5개 checker(`cross_spec`/`rationale_continuity`/`convention_compliance`/`plan_coherence`/`naming_collision`) 산출물을 직접 대조한 결과, 이들이 지적한 WARNING(i18n 문체, followups 체크박스 미갱신)은 실제 최종 코드/spec 에서 이미 해소됐거나(문체는 이미 해요체로 구현·spec 반영됨) 이번 diff 범위 밖(followups.md 파일 자체는 미변경)이라 별도 CRITICAL 로 재상신할 사유는 없다.

## 기능 완전성 / 엣지 케이스 / 에러 시나리오 / 반환값

- `toTable` 은 3개 진입 경로(AI top-level `truncation.rowsTotalCount`, 노드 `output.rowsTotalCount` 직접, 부재/비-number)를 테스트로 전수 커버(`presentation.test.ts` 3건 신규 `it`). 모든 경로에서 `TableData` 객체 형태를 항상 반환하고(early return/undefined 반환 없음), `totalCount` 는 `number | undefined` 로 exhaustive.
- 위젯 렌더 레벨(`presentations.tsx` `TableView`)도 `typeof totalCount === "number"` 가드로 두 문구 분기를 빠짐없이 커버하고, `presentations.test.tsx` 가 총 개수 있음/없음/truncation 자체 없음 3가지 케이스를 모두 검증.
- TODO/FIXME/HACK/XXX 계열 주석 신규 도입 없음(diff 전수 grep 확인).
- 함수명·주석(`toTable`, doc comment)과 실제 동작(`output.rowsTotalCount` → `TableData.totalCount` 투영)이 정확히 일치 — 의도-구현 괴리 없음.

## 요약

`TableData.totalCount` 신설 + `toTable` 투영 + `TableView` 배너 두 문구 분기(총 개수 있음/폴백)는 spec(`spec/7-channel-web-chat/1-widget-app.md` §2, `spec/4-nodes/6-presentation/0-common.md` §4·§10.4, `spec/4-nodes/6-presentation/2-table.md` §5.1/§5.2, `spec/4-nodes/3-ai/1-ai-agent.md` §7.10)과 line-level 로 정확히 일치하며, 같은 변경셋에서 spec 자체도 함께 갱신돼(carousel table-only caveat 포함) drift 가 없다. 테스트는 AI top-level truncation 경로·노드 output 직접 경로·부재/이형 값 경로를 모두 커버하고, 위젯 배너 문구도 i18n 관례(해요체)로 일관되게 구현·검증됐다(동봉된 consistency-check WARNING 이 지적했던 문체 문제는 최종 구현에서 이미 해소). 발견된 사항은 모두 INFO 등급 참고 사항뿐이다 — (1) `totalCount` 숫자 유효성 검증이 `NaN`/음수까지는 안 걸러내는 이론적 엣지케이스, (2) plan 문서 자체 내부에서 "후속 구현" 절 인용 문구가 같은 문서의 "문체" 결정·실제 코드와 어긋나는 문서 자기불일치(코드는 정상), (3) `webchat-widget-presentation-followups.md` 체크박스 갱신은 이번 diff 범위 밖이며 이미 동봉 `plan_coherence.md` 가 WARNING 으로 추적 중. CRITICAL/차단 사유 없음.

## 위험도

LOW
