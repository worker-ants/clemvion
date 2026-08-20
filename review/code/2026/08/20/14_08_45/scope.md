# 변경 범위(Scope) 리뷰 — `eia-inputdata-marker-guard`

## 사전 확인

이 브랜치는 2개 커밋으로 구성된다.

- `7da315c10` `docs(spec): Execution.inputData 카브아웃 폐지` — planner 턴 (spec 7곳 + plan 3곳 + consistency 산출물 4라운드)
- `37da9b593` `feat(security): Execution.inputData 카브아웃을 닫았다` — developer 턴 (backend 6곳 + frontend 11곳)

커밋 메시지 자체가 `--impl-prep`(`12_08_46`)이 `BLOCK: YES`(CRITICAL 3)를 내 developer 가 멈추고
`project-planner` 턴(spec 갱신)을 거친 뒤 `--spec`(`12_41_29`)이 `BLOCK: NO` 로 통과한 경위를
명시하고 있다. 이는 `CLAUDE.md` §Skill 체계가 강제하는 정확한 절차("구현 중 spec 변경 필요 시
developer 는 멈추고 project-planner 위임")이고, `review/consistency/**` 4라운드 산출물이 함께
커밋된 것도 프로젝트 컨벤션("일관성 검토 산출물 → `review/consistency/<...>/`", `review/` 는
gitignore 대상 아님)과 일치한다. 이 사전 맥락을 근거로 아래 개별 파일을 판단했다.

## 발견사항

- **[INFO]** consistency-check 4라운드(`12_08_46`/`12_29_59`/`12_41_29`/`12_58_14`) 산출물 30개
  파일이 기능 구현 커밋이 아니라 `docs(spec)` 커밋에 함께 실렸다
  - 위치: `review/consistency/2026/08/20/12_08_46/**` 외 3개 세션 디렉토리 (파일 21~52)
  - 상세: 이 저장소는 `review/` 를 SoT 저장 위치로 명시하고 gitignore 하지 않으므로 "무관한 파일
    수정"에 해당하지 않는다. 다만 처음 두 라운드(`12_08_46`, `12_29_59`)는 각각 `BLOCK: YES` 로
    종결된 중간 상태 산출물이라, 이 diff 만 보면 "왜 실패한 라운드까지 커밋됐는가"가 리뷰어
    입장에서 즉시 판단되지 않는다. 실제로는 커밋 메시지가 그 경위(BLOCK→planner 턴→재검토)를
    설명하고 있어 스코프 이탈은 아니다.
  - 제안: 조치 불요(컨벤션 준수). 참고로만 기록.

- **[INFO]** `masked-markers.ts` 신규 파일로의 로직 이관(`dynamic-form-ui.tsx` → `lib/utils/`)은
  driveby 리팩터링이 아니라 이번 작업이 만든 새 의존 방향 문제의 직접 해소다
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:325` (삭제된
    블록 시작), `codebase/frontend/src/lib/utils/masked-markers.ts:1-73` (신규 파일)
  - 상세: Re-run 모달(`rerun-modal.tsx`)과 툴바(`editor-toolbar.tsx`)가 새로 마커 판별기를
    소비해야 하는데, 기존 위치(`dynamic-form-ui.tsx`)에 두면 두 컴포넌트가 무관한 폼 UI
    컴포넌트를 import 해야 하는 역방향 의존이 생긴다. 코드는 순수 이동(`export` 위치만 변경,
    로직·JSDoc 내용 실질 동일)이라 "불필요한 리팩토링"에 해당하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `MASKED_INPUT_DATA_REASON` 앵커 상수 및 JSDoc 블록 전체 삭제(6개 참조처 전수)는
  스코프 밖 정리가 아니라 `naming_collision.md`(`12_08_46`) 가 CRITICAL 로 지적한 "반전 시 동일
  식별자 의미 반전" 위험에 대해 제안된 두 선택지 중 "폐기" 를 그대로 집행한 것
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` (게이트 54~56 이후,
    구 라인 57~202 블록 삭제 — 상수 정의·JSDoc·`void` 참조 전부)
  - 상세: 커밋 메시지가 "`MASKED_INPUT_DATA_REASON` 코드에서 0건(6곳 전수 삭제)" 이라고 명시하며,
    실제로 `background-runs.service.ts`(파일2)·`.spec.ts`(파일1)·`background-run-response.dto.ts`
    (파일3)·`execution-response.dto.ts`(파일4, 2곳)의 주석·Swagger 설명이 전부 동시에 갱신됐다.
    한 곳만 고치고 나머지가 stale JSDoc 으로 남는 패턴(이 프로젝트 메모리의 반복 교훈)을 피한
    전수 처리이며, 스코프 확장이 아니라 "반전이 아닌 폐기" 선택에 따른 필연적 크기다.
  - 제안: 조치 불요.

- **[INFO]** spec 변경 범위가 초기 계획(4개 문서)에서 7개 문서로 확대된 것은 스코프 크리프가
  아니라 consistency-checker(`cross_spec`)가 CRITICAL 로 지적한 SoT 미러 누락을 반영한 결과
  - 위치: `spec/1-data-model.md:471,550`, `spec/5-system/12-webhook.md:326-332`,
    `spec/5-system/6-websocket-protocol.md:205-209`, `spec/5-system/13-replay-rerun.md:8-11,351-370`,
    `spec/4-nodes/1-logic/12-background.md:246`, `spec/3-workflow-editor/3-execution.md:91`
  - 상세: `12_08_46/cross_spec.md` 와 `12_29_59/cross_spec.md` 가 각각 CRITICAL 로 지목한 문서
    (`12-webhook.md`, `6-websocket-protocol.md`, `1-data-model.md` §2.13 자매 행)가 최종 diff 에
    정확히 반영돼 있다 — 임의로 넓힌 범위가 아니라 게이트가 요구한 최소 범위다.
  - 제안: 조치 불요.

- **[INFO]** frontend 신규 테스트(캐너리 3건: `editor-toolbar-run-input.test.tsx`,
  `rerun-modal.test.tsx` 2건)는 요청 기능(마커 가드)의 방어 경계(부분 포함 vs 정확 일치, 토글 ON
  경로 무영향)를 고정하는 회귀 테스트로, 기능 확장이 아니라 이번 가드 자체의 정합성 증거다
  - 위치: `codebase/frontend/src/components/editor/toolbar/__tests__/editor-toolbar-run-input.test.tsx:452-497`,
    `codebase/frontend/src/components/executions/__tests__/rerun-modal.test.tsx:537-612`
  - 제안: 조치 불요.

## 스코프 밖으로 판단되는 변경 없음

- 설정 파일(`package.json`/`tsconfig`/`eslint`/CI 워크플로) 변경 없음.
- import 정리는 신규 `isMaskedMarker`/`hasMaskedMarkerLeaf`/`MASKED_MARKERS` 참조 추가뿐이며
  미사용 import 도입이나 드라이브바이 정리는 없음.
- 순수 포맷팅(공백/줄바꿈)만 바뀐 hunk 없음 — 모든 hunk 가 실질 문구·로직 변경을 동반.
- 두 커밋 모두 커밋 메시지가 "왜 이 파일까지 건드렸는가"를 사전에 밝히고 있고, diff 내용이
  그 설명과 1:1 로 대응한다(예: "코드에서 0건" ↔ 실제 6개 참조처 전수 갱신, "세 소비처" ↔
  실제 3개 프런트 컴포넌트만 변경).

## 요약

전체 diff 는 59개 파일에 걸친 대규모 변경이지만, 그 크기는 임의의 스코프 확장이 아니라
(1) `--impl-prep` BLOCK → planner 턴 → spec 갱신 → 재검토라는 프로젝트가 강제하는 절차,
(2) 새 소비처 3곳이 공유해야 하는 마커 판별 로직의 필연적 이관, (3) `MASKED_INPUT_DATA_REASON`
앵커를 "반전"이 아니라 "폐기"로 정리하기로 한 명시적 결정의 전수 집행, (4) consistency-checker
가 CRITICAL 로 지적한 spec 미러 누락의 직접 해소로 각각 설명된다. 커밋 메시지가 각 확장 이유를
사전에 밝히고 diff 내용과 정확히 대응하므로, 의도 이상의 변경·무관한 리팩토링·기능 확장·
포맷팅 혼입·불필요한 주석/임포트/설정 변경 어느 항목에서도 실질적 위반을 찾지 못했다.

## 위험도

NONE
