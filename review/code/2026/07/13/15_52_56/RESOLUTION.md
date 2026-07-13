# Resolution — edge §4/§5 ai-review (2026-07-13 15:52)

원 리뷰 위험도 **CRITICAL** (CRITICAL 1 + WARNING 5). disk-write gap(documentation/user_guide_sync) journal 복구 → documentation=CRITICAL(i18n, 동일), user_guide=WARNING 3(findNodeResult 불일치·EN 가이드·frontmatter) 함께 반영.

## Critical

| # | 발견 | 조치 |
|---|------|------|
| 1 | 신규 `edge-data-preview.tsx` 하드코딩 문자열이 i18n ratchet 가드(`hardcoded-korean-ratchet.test.ts`) FAIL(2 tests) | **반영** — `dict/ko/editor.ts`+`dict/en/editor.ts` 에 `edgeDataPreviewTitle`/`edgeDataSize`/`edgeViewFullData`/`edgeNoData` 키 추가, 컴포넌트에서 `useT()` 로 교체. **ratchet 4 passed 로 해소 재확인.** |

## Warning

| # | 카테고리 | 발견 | 조치 |
|---|----------|------|------|
| 2 | perf/arch/req | `useEdgeFlowData` 가 O(1) 인덱스 대신 O(n) 역스캔으로 최신결과 조회 + JSDoc/CHANGELOG/spec 은 `findNodeResult`(실제 미호출·시맨틱 상이) 라 서술 | **반영** — store 공유 selector `findLatestResultByNodeId(nodeId)`(O(1) `lastIndexByNodeId`) 신설, `useEdgeFlowData` 가 반응형 selector 로 소비. JSDoc/CHANGELOG/spec/plan 을 `findLatestResultByNodeId` 로 정정. |
| 3 | perf | byte 계산·모달 JSON.stringify 미메모이제이션 | **반영** — 모달은 인라인 `<pre>` 제거하고 공용 `JsonContent` 재사용, 툴팁 summarize 는 `useMemo`(data 키)로 렌더마다 아님. byte 계산은 hover 시점 1회(memo). |
| 4 | arch | 모달이 `JsonContent` 대신 인라인 마크업 재작성 | **반영** — `JsonContent` import·재사용. |
| 5 | req/testing | 신규 훅/컴포넌트 테스트 전무 | **반영** — `use-edge-hover-preview.test.ts` renderHook 5(fake timer: 지연 숨김·keepAlive 취소·dismiss·unmount cleanup·참조안정) + `edge-data-preview.test.tsx` RTL 3(무데이터 미렌더·축약 렌더·클릭→onOpenModal). |
| 6 | testing | 모달 "데이터 없음" 이 `undefined` 만 검사(`output:null` 누락) | **반영** — `data == null`(undefined+null). |

## INFO(반영/이월)
- #7 unmount 타이머 cleanup → **반영**(`useEffect(() => clearTimer)`). #9 훅 반환 memo화 → **반영**. #10 닫힌 모달 시 조회 스킵 → **반영**(edgeId 빈값 early guard). #8 mdx frontmatter `code:` 3파일 → **반영**. user_guide EN 가이드 "존재하지 않는 로케일" WARNING → i18n 수정으로 해소.
- formatBytes 영문 단위(bytes/KB/MB)=범용 단위로 유지(ratchet 무관). #11 output-shape 위치·#12 prop-drill·#13 God component → 이월(§4-insert/후속).

## 검증
- tsc `--noEmit` clean · **ratchet 4 passed(CRITICAL 해소)** · 신규 vitest 18 passed(util 10 + hook 5 + component 3) · eslint 0 errors
- e2e `make e2e-test-full` + fresh `/ai-review` 후속.
