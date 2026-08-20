STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===
# 변경 범위(Scope) 코드 리뷰 — eia-inputdata-marker-guard (17_38_33)

## 검토 방법

프롬프트가 나열한 231개 파일 중 실 코드/문서/spec 변경은 34개(`CHANGELOG.md`, backend 8개,
frontend 17개, `plan/in-progress/*.md` 3개, `spec/**` 7개 — `git diff origin/main...HEAD --stat`
실측 1,562 insertions / 217 deletions)이고, 나머지 197개는 이 작업이 같은 브랜치에 누적한
`review/code/2026/08/20/**` · `review/consistency/2026/08/20/**` 세션 산출물이다. 이 저장소는
`review/` 를 gitignore 하지 않고 검토 사이클 산출물을 그대로 커밋하는 관행을 유지하며(직전
다섯 라운드의 scope 리뷰 — `16_25_35`·`16_51_19` 포함 — 가 이미 이 판단을 반복 확인),
`RESOLUTION.md` 다회 라운드가 실제로 서로를 참조한다. 이 자체는 scope 위반이 아니다.

직전 scope 라운드(`16_51_19`)가 이미 그 시점까지의 34개 핵심 파일 전량과 라운드6 처분
(`6f1d4d41d`)까지를 검토해 `ISSUES=0`(NONE) 로 판정했으므로, 이번 라운드는 그 이후 새로
반영된 두 커밋에 집중했다 — `fa4718df0`(라운드7 처분, `git show --stat` 6개 코드/plan
파일) · `1539349f5`(라운드8 처분, `git show --stat` 6개 코드/plan 파일). 둘 다 `git show`
로 직접 열어 코드 diff 를 전량 대조했다.

## 발견사항

없음.

- **의도 이상의 변경 / 무관한 수정**: 라운드7(`fa4718df0`)은 커밋 메시지가 예고한 정확히
  한 가지만 한다 — `background-runs.service.spec.ts` 의 ingestion 마커 보존 캐너리에
  `inputData` 표면(자매인 `ExecutionsService` ⑥ 이 이미 커버하던 것)을 추가하고,
  `plan/in-progress/eia-inputdata-marker-guard.md` 의 라운드 카운트를 갱신했다. 라운드8
  (`1539349f5`)도 마찬가지로 정확히 예고한 세 가지만 한다 — (1) `executions.service.spec.ts`
  자매 캐너리 셋(②⑧⑧-b)에 양성 단언(`toContain('***')`) 추가, (2) `masked-markers.ts` 배열
  분기 깊이 경계 테스트 추가, (3) `rerun-modal.tsx`/`.test.tsx` 재오픈 리셋 캐너리 추가 +
  `touchedMaskedKeys` → `touchedKeys` 이름 정정. 코드 영역을 벗어난 수정(다른 모듈·인증·
  노드 핸들러)은 두 커밋의 `git show --stat` 어디에도 없다.
- **불필요한 리팩토링**: `touchedMaskedKeys` → `touchedKeys` 리네이밍은 "리팩토링처럼" 보일
  수 있으나, 이 상태 변수는 **이 PR 자신이 이번 작업에서 만든 것**이고 세 라운드(`14_44_08`
  INFO → `17_13_19` maintainability INFO-3)에 걸쳐 반복 지적된 이름-내용 불일치를 정정한
  것이다. 변경 범위도 선언부·갱신부·소비부(`rerun-modal.tsx`)와 그 이름을 언급하던 plan
  문서(`spec-sync-external-interaction-api-gaps.md`) 한 줄로 한정돼 있어, 동작 무변화 드라이브-바이
  리팩터가 아니라 이 PR 스코프 내 자기 교정이다.
- **기능 확장(over-engineering)**: 두 커밋 모두 새 assertion·새 경계 테스트·이름 정정만
  추가하며 런타임 분기·신규 API·신규 옵션을 추가하지 않는다(라운드8 의 배열 깊이 경계
  테스트는 기존 `hasMaskedMarkerLeaf` 구현의 경계를 검증만 할 뿐 로직을 바꾸지 않았다 — 다만
  `git diff origin/main...HEAD` 전체 stat 이 `masked-markers.ts` 에 111줄 순증을 보이는 것은
  라운드6 처분에서 이미 반영된 깊이 상한 로직이며, 이번 두 라운드는 그 로직에 손대지 않았다).
- **포맷팅/주석/임포트**: 무의미한 공백·줄바꿈 변경 없음. 주석 변경(JSDoc)은 전부 이번 두
  라운드가 고정하는 캐너리·이름 정정의 근거를 서술하는 데 필요한 내용이다. 신규/불필요
  임포트 없음(두 커밋 모두 기존 import 문을 건드리지 않는다).
- **설정 변경**: `.claude/config/**`, `package.json`, CI, lint/tsconfig 등 설정 파일 변경
  없음.

## 요약

`17_13_19` 이후 새로 반영된 두 커밋(`fa4718df0` 라운드7, `1539349f5` 라운드8)은 각각 직전
리뷰가 지적한 정확히 하나(자매 캐너리 표면 누락)와 정확히 셋(자매 단언 강도 불일치·배열
분기 깊이 대칭성·변수명 정정 + 재오픈 리셋 캐너리)만 반영했다. 코드 로직이 바뀐 곳은
`rerun-modal.tsx`(변수명 리네이밍만, 판정 로직 무변화)뿐이고 나머지는 테스트 추가와 plan
동기화다. 이는 직전 scope 라운드들(`16_25_35`·`16_51_19`)이 이미 NONE 으로 판정한 34개
핵심 파일의 단일 결정("`Execution.inputData` egress 마스킹 카브아웃 폐지") 범위를 전혀
벗어나지 않으며, 새 기능·무관한 파일·포맷팅 잡음·설정 변경 어느 것도 섞여 있지 않다.

## 위험도

NONE
