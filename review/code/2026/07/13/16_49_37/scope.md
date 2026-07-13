# 변경 범위(Scope) Review — 엣지 데이터 미리보기 툴팁 + 전체 데이터 모달 (spec-sync-edge-gaps §4/§5, 3회차)

## 발견사항

- **[INFO]** 이전 ai-review 라운드 산출물(`review/code/2026/07/13/15_52_56/*`, `review/code/2026/07/13/16_20_51/*`)이 이번 changeset 에 신규 파일로 대량 포함됨
  - 위치: 파일 18~44 (`{SUMMARY,RESOLUTION,meta,_retry_state}.{md,json}` + 12개 리뷰어 `.md` × 2라운드)
  - 상세: 요청 작업(spec §4/§5 hover 데이터 미리보기 구현)과 무관해 보일 수 있으나, 본 저장소 컨벤션상 `review/` 는 gitignore 대상이 아니고 SUMMARY/RESOLUTION 을 포함한 리뷰 산출물은 커밋 대상이다(CLAUDE.md "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무"). 실제 diff 는 "①§4/§5 최초 구현 → ②`/ai-review` 15_52_56(CRITICAL 1+WARNING 5) → ③fix → ④`/ai-review` 16_20_51(WARNING 6) → ⑤fix(본 changeset) → ⑥본 3차 리뷰(16_49_37)"의 표준 강제 사이클을 그대로 반영한 것으로, 범위 이탈이 아니라 규약이 요구하는 정상 산출물이다. 직전 2회 scope 리뷰(15_52_56/scope.md, 16_20_51/scope.md) 모두 동일 결론(NONE)으로 수렴해 있어 반복 확인됨.
  - 제안: 조치 불필요 — 컨벤션 부합 확인 목적의 참고 기재.

- **[INFO]** 이번 라운드의 실질 변경분(파일 1~17)은 직전(`16_20_51`) 리뷰가 지적한 WARNING 을 좁게 겨냥한 fix 로만 구성됨
  - 위치: `codebase/frontend/src/components/editor/canvas/__tests__/edge-data-preview.test.tsx`(신규 `EdgeDataModal` 테스트 4건 + mouseEnter/mouseLeave 배선 테스트 1건 추가), `.../__tests__/use-edge-hover-preview.test.ts`(신규), `codebase/frontend/src/lib/stores/__tests__/execution-store.test.ts`(`findLatestResultByNodeId` 전용 describe 4건 추가)
  - 상세: `16_20_51/testing.md` WARNING 3건(EdgeDataModal 테스트 전무·mouseEnter/mouseLeave 배선 미검증·`findLatestResultByNodeId` 단위 테스트 부재)에 정확히 대응하는 테스트만 추가됐다. 프로덕션 코드(`edge-data-preview.tsx`, `use-edge-hover-preview.ts`, `execution-store.ts`, `workflow-canvas.tsx`) 자체는 이번 라운드에서 로직 변경 없이(테스트 대상 코드는 이전 라운드에서 이미 확정) 테스트만 보강됐다 — 요청 이상의 리팩터링·기능 확장 없음.
  - 제안: 조치 불필요.

- **[INFO]** `execution-store.ts` 신설 selector `findLatestResultByNodeId` 가 기존 중복 구현(`node-settings-panel.tsx` `InfoTab`, `use-expression-context.ts`)까지 소급 통합하지 않음 — 스코프 절제 사례로 재확인
  - 위치: `plan/in-progress/spec-sync-edge-gaps.md` "비고" 섹션 신규 항목("`findLatestResultByNodeId` selector 를 기존 소비처로 확대")
  - 상세: architecture WARNING("3중 중복")에 대한 조치로 신규 O(1) selector 를 도입했지만, 기존 두 소비처는 그대로 두고 그 근거(실측: `InfoTab` 은 1:1 이관 후보, `use-expression-context.ts` 는 다른 패턴이라 드롭인 불가)와 후속 task(`task_edb57ca2`) 분리를 plan 문서에 명시했다. 무관 컴포넌트(`node-settings-panel.tsx`)에 손을 대지 않고 이번 PR 을 §4/§5 surface 로 한정한 판단은 과잉 수정을 피한 적절한 스코프 관리다.
  - 제안: 조치 불필요 — 참고 기재.

- 이 외 `CHANGELOG.md` 항목 추가(최상단 1건, 기존 항목 무변경), `spec/3-workflow-editor/2-edge.md` §4/§5 상태 전환(Planned→구현)+`code:` frontmatter 신규 파일 3종 추가, mdx 사용자 가이드(`connecting-nodes.mdx`/`.en.mdx`, `running-a-workflow.mdx`/`.en.mdx`) 본문 한 단락씩 ko/en 대칭 추가, i18n dict(`ko/en editor.ts`) 신규 키 4종(`edgeDataPreviewTitle`/`edgeDataSize`/`edgeViewFullData`/`edgeNoData`), `plan/in-progress/spec-sync-edge-gaps.md` 체크박스 갱신은 모두 "§4/§5 엣지 데이터 미리보기 툴팁+모달 구현"이라는 단일 의도에 정확히 대응한다.

## 요약

이번 diff(45개 변경 파일)는 plan(`spec-sync-edge-gaps.md`) §4/§5 항목 하나("엣지 hover 데이터 미리보기 툴팁 + 축약 표시 + 전체 데이터 모달")의 구현·2회 ai-review 사이클(15_52_56, 16_20_51)의 fix·본 3차 리뷰까지의 표준 워크플로 전체를 담고 있다. 프로덕션 코드(신규 3파일 + `workflow-canvas.tsx`/`execution-store.ts` 최소 배선)와 문서(spec/mdx/CHANGELOG/plan/i18n dict)는 전부 이 단일 기능에 정확히 대응하며, 이번 라운드의 실질 diff 는 직전 리뷰가 지적한 테스트 커버리지 갭 3건만 좁게 메운 추가 테스트로 국한된다. `review/code/**` 하위 대량 신규 파일은 무관한 코드가 아니라 프로젝트가 강제하는 review/fix 사이클의 정상 산출물이며, 기존 중복 로직(`node-settings-panel.tsx` 등)에 대한 소급 리팩터는 의도적으로 배제하고 근거·후속 task 를 문서화해 스코프 이탈을 막았다. 요청 외 기능 확장, 무관 파일 수정, 의미 없는 포맷팅/주석/임포트 변경, 의도치 않은 설정 변경은 발견되지 않았다.

## 위험도
NONE
