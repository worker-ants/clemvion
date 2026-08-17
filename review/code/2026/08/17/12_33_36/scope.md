# 변경 범위(Scope) 리뷰 — eia-masked-prefill-roundtrip-guard (round2, `12_33_36`)

## 발견사항

- **[INFO]** spec 3개 파일(`spec/4-nodes/1-logic/12-background.md`, `spec/5-system/14-external-interaction-api.md`, `spec/5-system/15-chat-channel.md`)이 핵심 기능("폼 `defaultValue` 프리필 왕복 오염 가드")과 직접 관련 없는 두 건의 부수 정정을 포함한다.
  - 위치: `spec/4-nodes/1-logic/12-background.md:246`(`nodeExecutions.data` 설명에 `outputData`·`inputData` 마스킹 캐비엇 추가), `spec/5-system/15-chat-channel.md:659`(`nodeName` → `nodeLabel` 오탈자 정정)
  - 상세: 두 건 모두 `plan/in-progress/eia-masked-prefill-roundtrip-guard.md` 체크리스트에 **"impl-prep W1"/"impl-prep W2"**로 명시적으로 등재되어 있고, `/consistency-check --impl-prep`(`11_38_00`) 라운드가 WARNING 으로 낸 항목을 착수 전 게이트 규약에 따라 이번 PR 에 "저비용 마무리"로 함께 반영한 것이다. 직전 라운드(`12_06_12`) scope 리뷰가 이미 이 번들링을 INFO #13 으로 검토해 "조치 불요"로 처분했고, 이번 라운드 `/consistency-check`(`12_06_15`)의 Plan Coherence checker 도 "정본 트래커가 정의한 단일 작업을 정확히 집행 / 체크박스 3건과 1:1 대응"으로 NONE 판정했다. 즉 문서화된 사전 승인 경로를 통해 들어온 변경이며, 몰래 끼워 넣은 무관 수정이 아니다.
  - 제안: 조치 불요. 향후 유사 impl-prep WARNING 묶음-정정 시에도 지금처럼 plan 체크리스트에 항목별로 명시하는 관행을 유지할 것.

- **[INFO]** `codebase/backend/src/shared/utils/sanitize-error-message.ts` 변경은 `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER` 세 상수 선언 + JSDoc 블록을 위로 재배치한 것뿐이며 값·로직·export 시그니처 변화가 없다.
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:95-128` (구 122-133 라인 블록이 위로 이동)
  - 상세: 순수 위치 이동(TSDoc 귀속 정정)으로, 이전 라운드가 지적한 "JSDoc 이 `MAX_REDACT_DEPTH` 에 귀속되던 배치 문제"를 고친 것이다. `plan/in-progress/spec-sync-external-interaction-api-gaps.md:293`에 "마커 JSDoc 을 `MASKED_MARKERS`에 귀속시키기"로 명시 등재되어 있다. 리팩터링이지만 관련 없는 정리가 아니라 이 PR 이 도입한 프런트 미러 JSDoc(상호참조)과 짝을 이루는 필수 변경이다.
  - 제안: 조치 불요.

- **[INFO]** `review/code/2026/08/17/12_06_12/**`, `review/consistency/2026/08/17/{11_38_00,12_06_15}/**` 산출물 파일 20여 개가 diff 에 포함되어 있으나, 이는 이 저장소가 강제하는 review/consistency-check 워크플로가 생성하는 표준 산출물(RESOLUTION.md, SUMMARY.md, 개별 리뷰어 리포트, meta.json)이며 CLAUDE.md 가 지정한 저장 위치(`review/code/**`, `review/consistency/**`)에 정확히 놓여 있다. 코드 변경이 아니다.
  - 위치: 파일 11~38 (전체 목록)
  - 제안: 조치 불요.

- **[INFO]** `CHANGELOG.md`, i18n 사전(`en/editor.ts`, `ko/editor.ts`), 유저가이드(`run-results.mdx`, `run-results.en.mdx`) 변경은 모두 이번 라운드에 신설된 `formMaskedDefaultHint` 힌트·마스킹 캐비엇과 1:1 대응한다. 포맷팅만 바뀐 줄, 무관한 재정렬, 불필요한 import 정리는 관찰되지 않았다.
  - 위치: 파일 1, 5, 6, 7, 8
  - 제안: 조치 불요.

새로 도입된 프로덕션 코드(`isMaskedMarker`/`MASKED_MARKERS`/`initialValueFor` 가드, 힌트 렌더링)와 그 회귀 테스트 5건은 모두 `plan/in-progress/eia-masked-prefill-roundtrip-guard.md` 체크리스트 항목에 정확히 대응하며, 요청 범위를 벗어난 기능 확장·불필요한 리팩토링·무관 파일 수정·의미 없는 포맷팅/주석/임포트 변경은 발견되지 않았다.

## 요약

diff 전량이 `plan/in-progress/eia-masked-prefill-roundtrip-guard.md` 체크리스트(폼 `defaultValue` 마스킹 왕복 오염 가드 + 6건 리뷰 WARNING fix)와 1:1 대응한다. spec 3개 파일 수정은 핵심 기능과 직접 관련은 없으나 사전 게이트(`--impl-prep`)가 낸 WARNING 을 명시적으로 등재·정정한 저비용 번들이며, 이전 라운드 scope 리뷰와 이번 라운드 consistency-check(Plan Coherence)가 이미 같은 결론(정당함)에 도달했다. `sanitize-error-message.ts` 는 로직 변경 없는 순수 JSDoc 재배치이고, `review/**` 산출물은 강제 워크플로의 표준 산출물이다. 의도 이상의 변경, over-engineering, 무관한 파일 수정, 의미 없는 포맷팅/주석/임포트 변경은 발견되지 않았다.

## 위험도

NONE
