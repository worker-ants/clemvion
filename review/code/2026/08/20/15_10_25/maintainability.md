STATUS=success ISSUES=1

===REPORT_MARKDOWN_BELOW===
# 유지보수성(Maintainability) 코드 리뷰 — eia-inputdata-marker-guard (15_10_25)

## 컨텍스트

이 changeset 은 `Execution.inputData` egress 마스킹 카브아웃 폐지(재제출 소비처 3곳에
마커 가드 신설)를 다룬다. 동일 작업이 이미 두 라운드(`14_08_45`, `14_44_08`)의 유지보수성
리뷰를 거쳤고, 두 라운드가 지적한 항목(연속 JSDoc 블록 분리, describe 소제목이 구 결론을
현재형으로 단언)은 이번 diff 에서 실측 확인상 **모두 반영**돼 있다 —
`codebase/frontend/src/components/executions/rerun-modal.tsx` 의 `blockedByMaskedInput`
JSDoc 은 표 하나로 병합됐고, `codebase/backend/src/modules/executions/executions.service.spec.ts`
의 describe 소제목은 `## 두 레벨 모두 마스킹 대상이다` 로 갱신돼 있다. `MASKED_INPUT_DATA_REASON`
앵커도 코드베이스 전수 grep 0건으로 완전히 제거됐다(반전이 아니라 폐기를 택해 이전
consistency CRITICAL — 동일 식별자 반대 의미 재사용 — 도 자연히 해소됐다).

이번 라운드는 그 위에서 신규로 도입된 부분(`lib/utils/masked-markers.ts` 승격,
`splitMaskedParameters`/`blockedByMaskedInput`, 신규 테스트 파일 3개)을 중심으로 재검토했다.

## 발견사항

- **[INFO]** 신규 추가된 테스트 케이스 뒤에 불필요한 빈 줄이 남아 `describe` 블록을 어색하게 닫는다
  - 위치: `codebase/frontend/src/components/editor/toolbar/__tests__/editor-toolbar-run-input.test.tsx:538` (마지막 `it(...)` 블록의 닫는 `});` 와 `describe` 를 닫는 `});` 사이)
  - 상세: 이번 diff 가 파일 끝에 4개의 `it` 블록을 새로 추가하면서, 마지막 `it` 블록 뒤에 빈 줄 하나가 남고 그다음 줄에 `describe` 를 닫는 `});` 가 온다. 같은 파일의 다른 `it` 블록들 사이·마지막 블록 뒤에는 이런 빈 줄이 없어(직전 `it` 블록들은 곧바로 `});`로 이어짐) 이 자리만 국소적으로 어긋난다. `prettier --check` 로도 이 파일이 걸린다(다만 이 저장소는 `button.tsx` 같은 무관한 기존 파일도 동일하게 걸려 prettier 가 CI/lint 게이트에 물려 있지 않다 — 확인함, `package.json` `lint` 스크립트는 `eslint` 단독이고 CI 워크플로에 `prettier` 언급 없음). 그래서 툴링이 막을 사안은 아니지만 가독성 관점의 사소한 불일치다.
  - 제안: 마지막 `it` 블록과 `describe` 를 닫는 `});` 사이의 빈 줄을 제거해 같은 파일의 나머지 블록과 형태를 맞춘다.

## 확인했으나 재지적하지 않은 것 (이미 처리/명시적으로 defer 됨)

- `touchedMaskedKeys`(`rerun-modal.tsx:229`) 라는 이름이 "실제로는 마스킹 여부와 무관하게 건드린 키 전체를 담는다"는 정밀도 이슈는 직전 라운드(`14_44_08` maintainability INFO)가 이미 지적했고, `RESOLUTION.md` 가 "최종 판정이 `maskedKeys` 와의 교집합만 보므로 이름이 오해를 낳지 않는다"는 근거로 명시적으로 defer 했다. 이번 재검토에서도 그 판단은 여전히 유효하다 — 재지적하지 않는다.
- "2026-08-20 카브아웃 폐지" 서사가 CHANGELOG·백엔드 여러 주석·테스트에 근접 중복 서술되는 점도 직전 라운드(`14_44_08` maintainability INFO)가 지적했고, PR 자신도 CHANGELOG 에서 이 비용을 인지·감수했다고 밝혔다 — 이 저장소의 "SoT + 미러" 관례상 트레이드오프이므로 재지적하지 않는다.
- 신규 유틸 `codebase/frontend/src/lib/utils/masked-markers.ts` (`MASKED_MARKERS`/`isMaskedMarker`/`hasMaskedMarkerLeaf`)와 `rerun-modal.tsx` 의 `splitMaskedParameters`/`blockedByMaskedInput` 는 함수가 짧고 단일 책임이며, 중첩 깊이도 얕고(`hasMaskedMarkerLeaf` 최대 2단 분기), 순환 복잡도가 낮다. 판정 로직의 "왜 두 조건의 합인가"(표로 각 조건 단독의 우회 경로를 명시)는 다음 편집자가 조건을 하나로 줄이는 실수를 하지 않도록 근거를 코드 옆에 남긴 좋은 사례다.
- `background-runs.service.ts`/`.spec.ts`, `background-run-response.dto.ts`, `execution-response.dto.ts`, `sanitize-error-message.ts` 의 변경은 전부 주석/JSDoc 텍스트 갱신이며 자매 파일(`NodeExecutionSummaryDto`)과 같은 "주제문을 현재형으로, 옛 서술은 blockquote 캐비엇으로" 패턴을 일관되게 따른다.

## 요약

두 차례의 선행 리뷰 라운드에서 지적된 유지보수성 결함(연속 JSDoc 블록 분리, describe 소제목 stale, `MASKED_INPUT_DATA_REASON` 식별자 반전 위험)은 이번 diff 에서 실측상 전부 해소돼 있다. 신규로 추가된 `lib/utils/masked-markers.ts` 승격과 `rerun-modal.tsx` 의 이중 조건 판정 로직은 함수 길이·중첩·네이밍·중복 모든 축에서 양호하고, 판정 근거를 표로 명시해 다음 편집자의 실수를 예방하는 방어적 문서화를 갖췄다. 유일하게 새로 발견한 사항은 테스트 파일 하나에 남은 사소한 빈 줄(INFO)로, 기능·구조에는 영향이 없다.

## 위험도

NONE
