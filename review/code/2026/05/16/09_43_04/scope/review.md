# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** docs-consolidation 사전 결함 3건 동반 해소 — 요청 범위 외 수정 포함됨
  - 위치: `README.md` (L77, L232), `CHANGELOG.md` (L4)
  - 상세: 본 PR 의 원래 목적은 이전 `Makefile --build` fix 의 RESOLUTION 후속 4건(README e2e 섹션 추가, CHANGELOG Test infrastructure 섹션, Makefile help 텍스트 갱신, e2e-test-full 주석) 처리다. 여기에 더해 docs-consolidation(2026-05-12) 이후 잔존한 폐기 경로 참조 3건(`prd/` 항목 제거, `user_memo/` 경로 → `spec/conventions/` 교체)이 추가되었다. 이 3건은 원래 follow-up plan 에 없던 항목이다.
  - 평가: commit message 와 plan 문서(`e2e-makefile-followup-2026-05-16.md`)에 "동반 사전 결함 해소"로 명시하고, consistency-check ISSUE FIX 정책에 따른 것임을 근거로 기록했다. 또한 plan 의 "의도적 제외" 섹션에서 다른 누락 항목과 범위를 명확히 구분했다. 같은 파일을 편집하는 김에 묶은 점도 합리적이다. 다만 이 3건은 본 PR 의 핵심 의도와 무관한 수정이므로, 별도 commit 또는 PR 로 분리하면 변경 추적이 더 명확해진다.

- **[INFO]** `review/consistency/2026/05/16/09_34_14/` 파일 일괄 커밋
  - 위치: `review/consistency/2026/05/16/09_34_14/SUMMARY.md`, `_prompts/convention_compliance.md` 등
  - 상세: 구현 착수 전 실행한 consistency-check 산출물이 구현 커밋과 동일 commit 으로 묶였다. 이 파일들은 리뷰 아티팩트로 `review/` 경로에 보관되는 것이 정책상 올바르나, 시점 기록 목적상 consistency-check 완료 직후의 별도 commit 으로 남기는 편이 더 자연스럽다. 현재 묶임 자체가 규칙 위반은 아니다.

- **[INFO]** `plan/in-progress/e2e-makefile-followup-2026-05-16.md` 의 미완료 항목
  - 위치: `plan/in-progress/e2e-makefile-followup-2026-05-16.md` L346–347
  - 상세: 체크리스트에 `[ ] TEST WORKFLOW`, `[ ] REVIEW WORKFLOW` 두 항목이 미체크 상태로 커밋되었다. plan 문서가 `in-progress/` 에 위치한 점은 규칙에 맞으나, commit 시점에 이미 e2e 테스트가 통과(12/12 suites, 66/66 tests)한 상태라면 TEST WORKFLOW 체크박스가 미완료인 이유가 불분명하다. 의도적으로 남겨둔 것이라면 주석으로 근거를 남기는 것이 좋다.

- **[INFO]** `README.md` 「격리 인프라 기반 e2e」 섹션의 내용 범위
  - 위치: `README.md` L230–240
  - 상세: `e2e-test` / `e2e-test-full` 두 타겟에 대해 "세 `e2e-*` 타겟 모두" 라고 표기하고 있으나, `e2e-down` 은 `--build` 와 무관하므로 서술이 다소 부정확하다 (`e2e-down` 을 제외한 세 타겟이 `--build` 를 갖는다). 기능 확장이나 의도 이상의 변경은 아니지만 문서 정확성 측면에서 확인이 필요하다.

## 요약

본 변경은 `Makefile --build` fix 의 후속 문서화 작업(RESOLUTION 4건)을 핵심 목적으로 하며, 모든 핵심 수정(README e2e 섹션 추가, CHANGELOG Test infrastructure 섹션, Makefile help 갱신, e2e-test-full 주석)이 해당 목적에 정확히 부합한다. 의도 이상의 변경으로 분류될 수 있는 docs-consolidation 잔존 결함 3건 해소가 포함되어 있으나, consistency-check ISSUE FIX 정책에 따라 plan 문서와 commit message 에 명시적으로 근거를 남겼고 같은 파일 편집 범위 안에서 처리한 점에서 실질적 리스크는 낮다. 불필요한 리팩토링·기능 확장·무관한 파일 수정·포맷팅 오염·임포트 변경·설정 파일 의도치 않은 변경은 발견되지 않았다. 동반 해소 항목의 분리 커밋 여부는 팀 컨벤션에 따라 결정하면 충분하다.

## 위험도

LOW
