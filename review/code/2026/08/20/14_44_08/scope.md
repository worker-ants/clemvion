# 변경 범위(Scope) 코드 리뷰 — eia-inputdata-marker-guard

## 검토 방법

프롬프트가 크기 제한으로 일부 파일 diff 를 생략했으므로(`executions.service.ts`,
`executions.service.spec.ts`, `rerun-modal.tsx`, spec 파일 다수), `git diff origin/main...`
로 78개 변경 파일 전체를 직접 열어 대조했다.

## 발견사항

이번 changeset(78 파일, +3995/-197)은 `plan/in-progress/eia-inputdata-marker-guard.md` 가
명시한 단일 목표 — *"`Execution.inputData` egress 마스킹 카브아웃 폐지, 재제출 소비처(Re-run
모달·에디터 히스토리 로드) 마커 가드 신설"* — 에서 벗어나는 항목을 찾지 못했다.

- **backend 6개 파일** (`executions.service.ts`/`.spec.ts`, `background-runs.service.ts`/
  `.spec.ts`, 두 DTO): `MASKED_INPUT_DATA_REASON` 앵커 제거 + `Execution.inputData` 를
  `redactStoredDataForResponse` 관문에 편입 + 캐너리 테스트 방향 반전 + JSDoc/Swagger 문구
  갱신. 전부 이 전환 하나로 수렴한다.
- **frontend 소비처 3곳** (`dynamic-form-ui.tsx`→`lib/utils/masked-markers.ts` 승격,
  `rerun-modal.tsx` 의 `splitMaskedParameters`/`blockedByMaskedInput`,
  `editor-toolbar.tsx` 의 `hasMaskedMarkerLeaf` 검사): 계획서가 "소비처가 셋이 되면서
  모달·툴바가 무관한 폼 컴포넌트를 import 해야 하는 의존 방향이 생긴다"고 명시적으로 근거를
  적어 둔 리로케이션이며, 순수 코드 정리(drive-by refactor)가 아니라 새 소비처를 위한 필수
  구조 변경이다.
- **i18n 문자열 4개** (`en`/`ko` × `editor.ts`/`history.ts`): 신규 차단 UX 에 필요한 문구만
  추가, ko/en 동일 커밋.
- **유저 가이드 mdx 4파일**: 직전 `14_08_45` 코드 리뷰 라운드의 `user_guide_sync.md`
  WARNING(신규 차단 UX 가 가이드에 미반영)을 그대로 반영한 것으로, RESOLUTION.md 의
  "WARNING 6" 처분과 정확히 일치한다.
- **spec 7개 파일**: `12_08_46` consistency 리뷰의 cross_spec CRITICAL 2건(`1-data-model.md`
  §2.13, `13-replay-rerun.md` §10.2)과 WARNING(`3-execution.md` §2.2)이 지목한 미러 문서를
  정확히 갱신했고, `12-webhook.md`/`6-websocket-protocol.md`/`12-background.md` 도 같은
  결론("레벨이 가른다" 축 폐기)을 인용하던 자매 문단이라 함께 갱신이 필요했다 — 새로운 결정을
  추가한 것이 아니라 이미 §R17 이 "닫는 조건"으로 적어 둔 상태를 문서 전반에 반영한 것이다.
- **plan 3개 + review 45개 파일**: `plan/in-progress/*.md` 신설·갱신과
  `review/code/2026/08/20/14_08_45/**`, `review/consistency/2026/08/20/{12_08_46,
  12_29_59,12_41_29,12_58_14}/**` 는 이 작업의 실제 리뷰·consistency-check 라운드 산출물이다.
  본 저장소 CLAUDE.md 는 코드 리뷰·일관성 검토 산출물을 `review/**` 에 커밋하는 것을 정식
  워크플로로 규정하며(`review/` 는 gitignore 대상이 아님), developer 는 `review/**/
  RESOLUTION.md` 에 쓰기 권한이 있다. 따라서 이 45개 파일은 "의도 이상의 변경"이 아니라 이미
  진행된 리뷰 프로세스의 필수 기록이다.
- **CHANGELOG.md**: 자매 5커밋(#1177~#1186)이 모두 남긴 `## Unreleased — …` 관례를 그대로
  따른 항목 1개 추가.

특기할 만한 "범위 이탈 후보"를 개별적으로 점검했으나 전부 정당화됐다:
- `dynamic-form-ui.tsx` 에서 `MASKED_MARKERS`/`isMaskedMarker` 를 통째로 들어낸 것은
  포맷팅이 섞인 리팩터가 아니라 함수 전체를 `lib/utils/masked-markers.ts` 로 옮긴 것 —
  이동 후 파일에 로직 잔여물이나 죽은 코드가 없음을 확인했다(`initialValueFor` 의 참조만 남고
  정상적으로 새 경로에서 import).
- `editor-toolbar.tsx` 의 `jsonError` 리팩터(`JSON.parse` 결과를 변수에 담아 재사용)는 마커
  검사에 파싱된 값이 필요해서 생긴 최소 변경이며, 그 외 로직 변경 없음.
- `dict/en/history.ts` 의 curly-quote 정정(`RESOLUTION.md` WARNING 7)이 실제로 straight
  quote 로 반영됐는지 diff 로 직접 확인 — 반영됨, 무관한 재도입 없음.

임포트·설정 파일(`.claude/config/**`, `package.json`, `tsconfig*` 등) 변경은 diff 에 없음.
`plan/in-progress/spec-draft-inputdata-egress-masking.md` 가 `status: in-progress` 로 남아
있는 등 plan 라이프사이클 이슈가 있어 보이나, 이는 "체크리스트/상태 정합성" 범주로 다른
관점(plan_coherence)의 소관이며 이 changeset 이 "요청 이상"으로 손댄 것은 아니므로 본 리뷰
관점(scope)에서는 지적하지 않는다.

## 요약

78개 변경 파일 전부를 `git diff origin/main...` 로 직접 대조한 결과, 이번 changeset 은 plan
문서가 명시한 단일 목표(`Execution.inputData` egress 마스킹 카브아웃 폐지 + 재제출 소비처 3곳
마커 가드)로 수렴한다. backend/frontend 코드 변경은 전부 그 목표에 직접 종속되고, 유저 가이드·
spec 문서 갱신은 같은 changeset 안의 선행 리뷰 라운드(코드 리뷰 `user_guide_sync`, consistency
`cross_spec`)가 지적한 갭을 메운 것이며, plan/review 디렉터리의 다수 파일은 이 저장소가 정식
워크플로로 규정한 리뷰 산출물 커밋 관행이다. 요청 범위를 벗어난 리팩토링·기능 확장·무관한
파일 수정·의미 없는 포맷팅·불필요한 주석/임포트/설정 변경은 발견되지 않았다.

## 위험도

NONE
