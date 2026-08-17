# Rationale 연속성 검토 결과

## 검토 범위

- target: `spec/5-system/` (impl-done, diff-base=`origin/main`)
- 실질 diff: `codebase/backend/src/shared/utils/sanitize-error-message.ts`,
  `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx`(+test),
  `run-results.{en,}.mdx`, `en/ko editor.ts` i18n — EIA(`14-external-interaction-api.md`) `code:` frontmatter 소관.
- 대응 커밋: `8d853b56a`(fix: 마스킹된 폼 기본값 프리필 차단) + `df708f4f8`(round2 게이트 처분, docs 정정).
- `git diff origin/main...HEAD -- spec/5-system/14-external-interaction-api.md` 로 spec 자체 변경분도 직접 확인함.

## 발견사항

없음 — CRITICAL/WARNING 없음.

- **[INFO] Rationale 이 코드보다 먼저(또는 동시에) 갱신되어 번복이 아니라 예고된 이행임**
  - target 위치: `codebase/frontend/.../dynamic-form-ui.tsx` — `MASKED_MARKERS`/`isMaskedMarker`/`initialValueFor` 신설, `sanitize-error-message.ts` export 주석 갱신.
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` `## Rationale` → R17 "잔여 ②"의 "닫는 조건: 프런트가 마스킹 마커를 감지해 해당 필드 재입력을 강제하는 가드가 선행되어야 한다. 트래커에 등재됐다" (원문, `origin/main` 기준) + 이번 브랜치에서 추가된 "프리필 왕복 — 마스킹된 값이 되돌아와 실제 입력이 되는 경로 (2026-08-17)" 신규 하위 불릿.
  - 상세: `git diff origin/main...HEAD -- spec/5-system/14-external-interaction-api.md` 로 실측한 결과, 이 문서는 "닫는 조건" 문장을 "그 가드의 첫 조각이 2026-08-17 에 섰다"로 갱신하고 "프리필 왕복" 신규 서브섹션을 함께 추가했다. 이 신규 Rationale 은 (a) 왜 `Execution.inputData` 카브아웃(잔여②) 처럼 마스킹을 끄는 방식을 안 썼는지(외부로도 나가는 값이라 카브아웃 불가), (b) 왜 `isMaskedMarker` 가 "정확 일치"만 잡고 "부분 포함"은 잡지 않는지(오탐 비용 > 미탐 비용, 이미 R17 본문에 있는 원칙과 동일선상), (c) 마커 SoT/미러 관계(backend `sanitize-error-message.ts` 가 SoT, frontend 가 미러)를 명시한다. 코드 diff 를 이 서술과 대조하면 1:1로 일치한다 — `MASKED_MARKERS` 값 3종(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`) 동일, `isMaskedMarker` 는 `Set.has()`(정확 일치)만 사용해 부분 치환(`scheme://***@host`) 은 의도적으로 통과시키는 캐너리 테스트까지 신설. "egress 마스킹 자체는 끄지 않는다"는 R17 최상위 불변식("안전 방향은 한쪽으로만 열린다")도 그대로 유지된다(마스킹을 우회하지 않고 소비 측에서 마커만 감지).
  - 이는 관점 3("결정의 무근거 번복")이 요구하는 "과거 결정을 뒤집을 때 새 Rationale 동반" 을 정확히 만족하는 사례이며, 관점 1/2/4(기각된 대안 재도입·원칙 위반·invariant 우회) 어느 것에도 해당하지 않는다.
  - 제안: 조치 불필요. 다만 R17 자신이 명시하듯 "Re-run 모달·에디터 히스토리 로드"에 동일 가드 확장이 트래커에 남아 있으므로, 후속 라운드에서 그 항목을 다룰 때도 이번과 같은 방식(코드 변경과 Rationale 신규 불릿을 같은 PR 에서 동반)을 유지할 것을 권고.

## 요약

이번 diff(마스킹된 폼 `defaultValue` 프리필 차단)는 EIA spec `14-external-interaction-api.md` §Rationale R17 이 이미 "닫는 조건"으로 예고해 둔 항목의 첫 이행이며, 코드와 정확히 같은 턴에 R17 본문에 "프리필 왕복" 신규 서브섹션이 추가되어 결정의 배경(카브아웃 불가 이유·정확 일치 경계·SoT/미러 관계)이 명시적으로 기록됐다. 기각된 대안의 재도입, 합의 원칙(예: "egress-only 마스킹은 끄지 않는다", "이미 마스킹된 값은 재마스킹하지 않는다") 위반, 무근거 결정 번복, invariant 우회 중 어느 것도 관측되지 않았다. Rationale 연속성 관점에서 이 diff 는 모범적으로 spec 과 동기화되어 있다.

## 위험도

NONE
