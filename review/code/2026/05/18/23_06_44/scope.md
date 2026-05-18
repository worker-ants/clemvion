# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `backend-labels.ts`: `WARNING_KO`, `NODE_LABEL_KO`, `NODE_DESCRIPTION_KO` 세 상수에 `export` 키워드 추가
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` — 라인 1507, 1527, 1536 (diff 기준)
  - 상세: 새로 작성된 `backend-labels.test.ts` 가 이 세 상수를 직접 import 하기 때문에 export 노출이 필수적으로 수반된다. 테스트 추가와 함께 필요한 최소 변경이며 기존 동작에는 영향 없다.
  - 제안: 이상 없음. 의도된 변경으로 확인.

- **[INFO]** `PROJECT.md`: `ko.ts` / `en.ts` → `ko` / `en` 표현 수정 (단순 문서 표현 개선)
  - 위치: `PROJECT.md` 라인 44 (diff 기준), "자동 가드" 절
  - 상세: `ko.ts ↔ en.ts leaf key parity` 를 `ko ↔ en 사전 leaf key parity` 로 수정. 내용 변경이 아닌 표현 개선이며, 신규 테스트/행 추가와 함께 동일 절에서 일관성을 유지하기 위한 자연스러운 조정이다.
  - 제안: 범위 일탈은 아님. 다만 표현 수정 없이도 PR 목적이 달성되었으므로 순수 범위 관점에서는 불필요한 변경.

- **[INFO]** `plan/complete/harness-i18n-userguide-gap.md`: 신규 파일이 `plan/complete/` 에 직접 생성됨
  - 위치: `plan/complete/harness-i18n-userguide-gap.md` 전체
  - 상세: 이 파일은 이전 P0 PR 에서 작성된 plan 이 완료 처리되면서 `complete/` 에 위치한 것으로 보인다. 내용상 현재 PR 이 후속(P1+)으로 명시되어 있고, plan 의 모든 항목이 완료 처리되어 있다. CLAUDE.md 규약상 `plan/in-progress/` 에서 `git mv` 로 이동해야 하나, diff 에는 `git mv` 흔적 없이 `new file mode` 로 등장한다. 이는 이전 P0 PR 에서 `in-progress/` 에 만들어졌다가 본 PR 에서 `complete/` 로 이동되었거나, 처음부터 `complete/` 에 새로 생성된 경우 두 가지 해석이 가능하다. 코드 리뷰 범위(Scope) 관점에서는 plan 문서 상태 업데이트 자체는 작업 완료의 정상적인 부대 변경이다.
  - 제안: `plan/complete/` 의 frontmatter `worktree` 필드가 `harness-i18n-userguide-cded87` (이전 P0 worktree)로 기록되어 있어 현재 worktree(`i18n-guard-extension-a7b3c9`)와 불일치한다. 범위 이탈이라기보다는 plan 관리 규약 적합성 문제에 해당하며 scope 관점의 CRITICAL/WARNING 은 아니다.

- **[INFO]** `hardcoded-korean-ratchet.test.ts`: `writeBaseline()` 내부에 불필요한 이중 `fs.writeFileSync` 호출 존재
  - 위치: `codebase/frontend/src/lib/i18n/__tests__/hardcoded-korean-ratchet.test.ts` 라인 1181~1186 (diff 내 `writeBaseline` 함수)
  - 상세: 첫 번째 `writeFileSync` 호출에서 JSON 뒤 `// total: ...` 주석을 붙인 뒤, 두 번째 호출에서 주석 없이 덮어쓰는 코드가 있다. 주석 자체가 JSON 포맷을 깨트리기 때문에 즉시 덮어쓰는 구조인데, 코드 레벨에서 처음부터 주석을 붙이지 않는 방향이 더 명확하다. 기능적으로는 두 번째 `writeFileSync` 가 최종 상태를 결정하므로 동작에 문제는 없다. 이는 scope 이탈이 아니라 구현 품질 이슈이며 별도 리뷰어 관점에 해당한다.
  - 제안: scope 범위 이탈 아님. 코드 품질 리뷰어 참고 사항으로 전달.

## 요약

변경 범위(Scope) 관점에서 이번 PR 은 plan 문서(`harness-i18n-userguide-gap.md`)에 명시된 P1-B(backend-labels parity 테스트), P1-C(nodes-coverage 테스트), P1-D(PROJECT.md 보강), P2-b(hardcoded-korean ratchet) 네 항목을 정확히 구현하고 있다. 각 신규 파일(`backend-labels.test.ts`, `nodes-coverage.test.ts`, `hardcoded-korean-ratchet.test.ts`, `hardcoded-korean-baseline.json`)은 목적 내 범위이며, `backend-labels.ts` 의 export 추가는 테스트 구현에 필연적으로 수반되는 최소 변경이다. `PROJECT.md` 의 "자동 가드" 절 보강과 표현 수정, `spec/conventions/i18n-userguide.md` 신설은 P1-D 및 P1-A 에 각각 대응하는 의도된 변경이다. 의도 이상의 추가 수정이나 무관한 파일 수정은 발견되지 않았으며, 포맷팅 변경도 실질 변경과 섞인 사례는 없다.

## 위험도

NONE
