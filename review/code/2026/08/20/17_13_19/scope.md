STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===
# 변경 범위(Scope) 코드 리뷰 — eia-inputdata-marker-guard

## 검토 방법

`git diff origin/main...HEAD --stat` (211 files, +17013/-214)로 프롬프트가 축약한 diff를
전량 실측 보강했다. `plan/in-progress/eia-inputdata-marker-guard.md`의 frontmatter
`spec_impact`(7개 spec 파일)를 대조해 spec 변경의 정당성을 확인했고, 핵심 신규 로직
(`executions.service.ts`, `masked-markers.ts`, `rerun-modal.tsx`)은 `Read`/`git diff`로
직접 열어 무관한 코드가 섞였는지 확인했다.

## 발견사항

없음 — 211개 파일 전부가 단일 결정(`Execution.inputData` egress 마스킹 카브아웃 폐지 +
재제출 소비처 3곳 마커 가드)의 직접 산물이거나 그 산물을 기록하는 저장소 관례 산출물이다.

- **코드(24개 파일)**: backend(`executions.service.ts`/`.spec.ts`,
  `background-runs.service.ts`/`.spec.ts`, DTO 2개, `sanitize-error-message.ts`)와
  frontend(`dynamic-form-ui.tsx`, `editor-toolbar.tsx`, `rerun-modal.tsx`, 신규
  `lib/utils/masked-markers.ts` + 테스트, i18n dict 4개, docs mdx 4개)가 전부 "카브아웃
  폐지" 아니면 "3개 소비처 마커 가드" 둘 중 하나에 직접 대응한다. `executions.service.ts`
  diff를 직접 읽어 확인한바, 삭제된 것은 폐기된 `MASKED_INPUT_DATA_REASON` JSDoc 앵커뿐이고
  추가된 로직은 `inputData`를 마스킹 관문 세 곳(`toResponseExecution`·list 경로·
  `toExecutionDto`)에 편입시키는 것뿐 — 무관한 리팩터나 drive-by 수정이 섞여 있지 않다.
- **`masked-markers.ts` 승격(리팩터)**: `dynamic-form-ui.tsx` 안에 있던
  `MASKED_MARKERS`/`isMaskedMarker`를 `lib/utils/`로 옮기고 `hasMaskedMarkerLeaf`를
  추가한 것은 "불필요한 리팩토링"이 아니라, 이번 PR이 만드는 세 번째 소비처
  (`editor-toolbar.tsx`)와 두 번째 소비처(`rerun-modal.tsx`)가 폼 컴포넌트를 직접 import
  하지 않고도 판별기를 공유해야 하는 실제 필요에서 나온 것이다. 이동 자체가 이번 changeset
  안에서 3곳 모두 반영돼 있어 널널한 범위 확장이 아니다.
- **spec 7개 파일**: `plan/in-progress/eia-inputdata-marker-guard.md`의 frontmatter
  `spec_impact` 목록과 실제로 수정된 spec 파일 7개(`1-data-model.md`,
  `3-workflow-editor/3-execution.md`, `4-nodes/1-logic/12-background.md`,
  `5-system/{12-webhook,13-replay-rerun,14-external-interaction-api,6-websocket-protocol}.md`)가
  정확히 일치한다. §R17이 명시한 "닫는 조건"(프런트 마커 가드)이 충족되며 카브아웃이 닫히는
  결정이므로 spec 갱신은 이 작업의 필수 부분이지 별건이 아니다. `3-execution.md`의 WS
  inputData 서술 정정("WebSocket 이벤트에는 inputData가 포함되지 않음"이 stale이었다는
  정정)도 이 PR 자체의 §R17 flip-flop 방지 근거(REST·WS가 같은 규칙이라 깜빡임이 없다)가
  성립하려면 먼저 참이어야 하는 전제라 무관한 수정이 아니다.
- **`review/code/**`·`review/consistency/**` (약 150개 파일)**: 이 저장소는
  `review/`를 gitignore하지 않고 각 리뷰·통합 라운드 산출물을 커밋 이력에 남기는 것이 명시
  규약이다(`CLAUDE.md` "정보 저장 위치" 표). 같은 작업일(2026-08-20) 동안 8라운드의 코드
  리뷰 + 다수의 consistency 리뷰가 반복된 것은 "구현 완료 후 자동 review/fix는 상시 승인된
  강제 의무" 규약에 따른 정상적인 축적이며, 각 라운드의 RESOLUTION.md가 이전 라운드의
  WARNING을 좁혀가는 이력을 보여준다(값-only → touched-only → 값+touched → +구조 파싱
  실패 3중 조건으로 수렴). 코드 자체의 스코프 일탈이 아니라 리뷰 워크플로가 요구하는 감사
  기록이다.
- **`plan/in-progress/*.md` 3개**: 작업 추적 문서(`eia-inputdata-marker-guard.md`)와 그
  선행 조사 산출물(`spec-draft-inputdata-egress-masking.md`,
  `spec-sync-external-interaction-api-gaps.md` 갱신)로, 규약상 `plan/`은 `developer`도
  쓰기 가능한 영역이고 이번 작업의 스코프 정의·경위 기록이라 별건이 아니다.
- **포맷팅·주석·임포트·설정**: 별도의 포맷팅-only 변경, 무관한 주석 정리, 미사용 임포트
  정리, 설정 파일 변경은 diff 전역에서 발견되지 않았다. 주석 변경은 전부 "카브아웃이
  2026-08-20에 닫혔다"는 정책 전환을 반영하는 문맥 갱신이다(`MASKED_INPUT_DATA_REASON`
  앵커 삭제·`{@link}` 참조 정리 포함).

## 요약

211개 파일, +17013/-214 라인이라는 규모 자체는 크지만 실측 결과 전부가 "`Execution.inputData`
egress 마스킹 카브아웃 폐지 + 재제출 소비처 3곳(폼 프리필·Re-run 모달·에디터 히스토리
로드) 마커 가드"라는 단일 결정의 직접 산물이거나, 그 결정을 낳은 8라운드 리뷰 워크플로의
필수 감사 기록(`review/**`)이다. spec 7개 파일 변경은 plan frontmatter의 `spec_impact`와
정확히 일치하고 §R17이 미리 정의한 "닫는 조건"이 충족되어 발생한 것이라 무단 spec drift가
아니다. `masked-markers.ts` 승격도 신규 소비처 2곳이 실제로 요구하는 구조 변경이다.
요청 범위를 벗어난 기능 확장, drive-by 리팩터링, 무관한 파일 수정, 포맷팅/주석/임포트/설정의
불필요한 뒤섞임은 발견되지 않았다.

## 위험도

NONE
