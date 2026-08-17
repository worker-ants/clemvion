# 문서화(Documentation) 리뷰 — eia-masked-prefill-roundtrip-guard (HEAD `8d853b56a`)

## 발견사항

- **[WARNING]** `CHANGELOG.md` "Unreleased" 항목이 이번 커밋으로 stale 해졌다 — 프런트 마커
  가드를 아직 "트래커에 등재"된 것으로만 서술
  - 위치: `CHANGELOG.md:38-39` (`서버가 엔티티를 직접 읽어 영향 없다. 회귀 캐너리로 비대상임을
    고정했고, 프런트 마커 가드는` / `트래커에 등재했다.`)
  - 상세: 같은 마스킹 이니셔티브의 직전 3개 커밋(`107c8038f` #1177, `f5351e9c2` #1179,
    `89c3f3c53` #1180)은 전부 `CHANGELOG.md` "Unreleased" 절에 항목을 추가/갱신했다
    (`git show <sha> --stat` 로 각각 +27/+34/+52 라인 실측). 특히 `89c3f3c53`(#1180)이 남긴
    현재 Unreleased 절 본문은 "`Execution.inputData` 카브아웃의 닫는 조건 = 프런트 마커
    가드"라고 명시하고 그 가드를 **"트래커에 등재했다"**(미구현)로 마무리한다. 그런데 이번
    커밋(`8d853b56a`, 리뷰 대상 diff 그 자체)이 정확히 그 가드(`isMaskedValue` +
    `initialValueFor` 프리필 차단 + hint)를 **구현**했다 — `git show 8d853b56a --stat` 로 확인한
    변경 파일 20개 중 `CHANGELOG.md` 는 없다. 결과적으로 `CHANGELOG.md` 는 이미 구현된 것을
    "아직 계획만 됐다"고 계속 말하는 stale 문서가 됐다. `plan/in-progress/eia-masked-prefill-roundtrip-guard.md`
    의 체크리스트에도 CHANGELOG 갱신 항목이 아예 없고(다른 명시적 유예 항목 — `token=` 패턴
    확장 — 은 이유를 적어 뒀는데, CHANGELOG 는 그런 명시적 유예 문구조차 없다), 이번 라운드가
    빠뜨린 항목으로 보인다.
  - 제안: `CHANGELOG.md` line 38-39 를 "프런트 마커 가드는 트래커에 등재했다" → "프런트 마커
    가드(`DynamicFormUI.isMaskedValue`)를 구현해 이 조건을 닫았다"로 갱신하거나, 이번 커밋이
    고친 별도 결함(폼 `defaultValue` 프리필 왕복 오염)을 위한 새 `## Unreleased` 하위 항목을
    추가한다. 같은 시리즈의 앞선 3커밋과 동일한 관행(fix 커밋 = CHANGELOG 갱신)을 따를 것.

- **[INFO]** plan 체크리스트 항목이 완료로 바뀌었는데 하위 설명 문구는 "이번엔 Output 탭만
  반영했다"는 과거 시점(유예) 서술을 그대로 유지해 완료 상태와 어긋나 보인다
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:301-303`
  - 상세: 체크박스는 `- [ ]` → `- [x]`로 바뀌었다(항목명 "유저 가이드 Error 탭에도 마스킹
    캐비엇"). 그런데 바로 아래 설명 문장 "이번엔 Output 탭만 반영했다 — `error` 도 #1179
    이후 마스킹되므로 같은 캐비엇이 맞지만, 이 PR 의 변경 대상(`outputData`)에 범위를 맞춰
    좁게 반영했다"는 diff 로 손대지 않아 그대로 남아 있다. 이 문장은 "이번 라운드는 Output
    탭만 하고 Error 탭은 범위 밖으로 남긴다"는 과거의 유예 근거처럼 읽히는데, 실제로는 이번
    커밋이 `run-results.mdx`/`run-results.en.mdx` 양쪽에 Error 탭 캐비엇을 **추가**해 그 유예를
    닫았다(files 4·5 diff 확인). 체크박스만 보고 "완료됐다"고 판단하는 사람과, 하위 문장만
    보고 "아직 Output 탭만"이라고 판단하는 사람이 서로 다른 결론을 낼 수 있다.
  - 제안: 하위 문장을 "~~이번엔 Output 탭만 반영했다~~ → 이번 라운드에서 Error 탭 캐비엇을
    추가해 닫았다(KO/EN)"처럼 완료 시점 서술로 갱신. (참고: 바로 위 W1 항목 — 마커 JSDoc
    귀속 — 은 "다음에 이 파일을 여는 작업에 곁들인다"는 유예 문구가 실제로 이번 라운드의
    완료를 정확히 설명하고 있어 대조적으로 정확하다.)

- **[INFO]** JSDoc/스펙 상호참조 및 마커 상수 미러링 자체는 정확 — 확인만 남김(발견 아님, 긍정 확인)
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:95-100` (`VALUE_MASK_MARKER`
    등 재배치), `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:324-359`
    (`MASK_MARKERS`/`isMaskedValue`)
  - 상세: `MASK_MARKERS`(프런트)와 `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`
    (백엔드) 세 값이 정확히 일치(`"***"`/`"[REDACTED]"`/`"[REDACTED_DEPTH]"`)하고, 두 JSDoc
    모두 "값이 어긋나면 가드가 조용히 뚫린다"는 동기화 의무를 명시하며 서로를 교차 참조한다.
    프런트 JSDoc 의 상대경로 링크(`../../../../../../spec/5-system/14-external-interaction-api.md`,
    6단계 `../`)도 `codebase/frontend/src/components/editor/run-results/` 기준으로 실제
    `spec/5-system/14-external-interaction-api.md` 에 정확히 해석됨을 확인했다(`os.path.normpath`
    로 검증). 백엔드 파일도 이전 라운드(`00_47_01` documentation W1)가 지적한 "마커 JSDoc 이
    `MASKED_MARKERS` 상수에 붙지 않는 배치 문제"를 이번 diff 가 실제로 해소했다(세 상수 JSDoc
    이 이제 각 `export const` 바로 위에 위치). 이 항목은 조치 불요.

- **[INFO]** i18n 신규 키 `formMaskedDefaultHint` — EN/KO 양쪽 정확히 대응, 배치도 올바름
  - 위치: `codebase/frontend/src/lib/i18n/dict/en/editor.ts:306-307`,
    `codebase/frontend/src/lib/i18n/dict/ko/editor.ts:302-303`
  - 상세: 둘 다 `runResults` 섹션 안에 위치하고, 사용부(`dynamic-form-ui.tsx`의
    `t("editor.runResults.formMaskedDefaultHint")`)와 키 경로가 일치한다. 조치 불요.

## 요약

이번 diff 자체(백엔드 마커 상수 JSDoc 재배치, 프런트 `isMaskedValue`/`initialValueFor` 가드와
그 JSDoc, 회귀 테스트 4건의 설명 주석, 유저가이드 KO/EN Error 탭 캐비엇, EIA §R17 "닫는 조건"
갱신, `12-background.md`/`15-chat-channel.md` spec 정정)은 문서화 관점에서 완성도가 높다 —
새 공개 함수(`isMaskedValue`)와 상수(`MASK_MARKERS`)에 "왜 필요한가"까지 담은 JSDoc이 있고,
백엔드-프런트 미러 관계·spec SoT·과거 유사 결함(Re-run 모달 CRITICAL)과의 관계를 정확히
교차 참조하며, 마커 상수 JSDoc 배치 문제(이전 라운드 WARNING)도 해소했다. 다만 이 저장소
자신이 같은 마스킹 이니셔티브의 직전 세 커밋(#1177/#1179/#1180)에서 반복적으로 지켜온
"fix 커밋 = `CHANGELOG.md` Unreleased 갱신" 관행이 이번 커밋에서는 누락됐고, 그 결과
`CHANGELOG.md` 가 이미 구현된 가드를 "트래커에 등재만 됐다"고 계속 서술하는 stale 상태다
(WARNING). 부수적으로 plan 체크리스트 한 항목의 완료 표시와 하위 설명 문구 사이에 시제
불일치가 있다(INFO).

## 위험도

LOW — 기능 회귀나 계약 위반은 아니며, 코드 자체의 문서화 품질은 높다. 다만 CHANGELOG 갱신
누락은 이 저장소가 스스로 확립한 관행에서 벗어난 것이라 실제로 고쳐야 할 항목이다.
