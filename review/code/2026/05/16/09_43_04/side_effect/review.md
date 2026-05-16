# 부작용(Side Effect) 코드 리뷰

대상 커밋: `39c869c5ae51c8c913f37d83c2d12f8ecd656322`
분석 파일: `CHANGELOG.md`, `Makefile`, `README.md`, `plan/in-progress/e2e-makefile-followup-2026-05-16.md`, `review/consistency/2026/05/16/09_34_14/SUMMARY.md`, `review/consistency/2026/05/16/09_34_14/_prompts/convention_compliance.md`

---

### 발견사항

- **[INFO]** Makefile help 텍스트 변경 — 순수 출력 문자열 수정, 동작 영향 없음
  - 위치: `Makefile` 9~14행 (`help` target `@echo` 라인들)
  - 상세: `e2e-up`, `e2e-test`, `e2e-test-full` 항목의 설명 문자열에 "(자동 image rebuild)" 문구가 추가되었다. `make help` 의 출력 텍스트만 변경되며, 실제 빌드·실행·파일시스템에 미치는 영향은 전혀 없다.
  - 제안: 이상 없음. 사용자가 `--build` 동작을 `make help` 만으로 파악할 수 있게 되어 정보 제공 측면에서 유익하다.

- **[INFO]** `e2e-test-full` target 에 설명 주석 추가 — 동작 변경 없음
  - 위치: `Makefile` 153~157행 (새로 삽입된 다중 라인 주석)
  - 상세: `runner1 && runner2; STATUS=$$?` 패턴의 exit code 동작을 설명하는 주석이 삽입되었다. 주석은 shell 에서 실행되지 않으며 Makefile recipe 의 실행 흐름에 영향을 주지 않는다. 단, 주석 블록과 `e2e-test-full:` target 선언 사이에 빈 줄이 없으므로 Make 가 해당 주석 라인을 target 의 일부(shell 명령)로 해석할 여지가 있는지 확인이 필요하다. Makefile 주석은 `#` 으로 시작하며 recipe 내 `#` 행은 shell 에 전달되지 않으므로 현재 형태라면 무해하다.
  - 제안: `e2e-test-full:` 라인 바로 위에 붙어있어 시각적으로 혼동될 수 있으나, Makefile 문법 상 `#` 라인은 항상 주석으로 처리되므로 동작 문제는 없다. 명확성을 위해 주석 블록과 target 선언 사이에 빈 줄 하나를 두는 것을 고려할 수 있다.

- **[INFO]** `CHANGELOG.md` 의 경로 참조 교체 — 텍스트 변경, 부작용 없음
  - 위치: `CHANGELOG.md` 4행 (`Implements the CONVENTIONS rulebook in ...`)
  - 상세: `user_memo/node-specs-improvement/CONVENTIONS.md` 를 `spec/conventions/node-output.md` 로 교체했다. CHANGELOG 는 정적 기록 문서이므로 어떠한 런타임·빌드 부작용도 없다. 폐기된 경로 참조를 올바른 현행 경로로 정정한 것이므로 문서 정합성이 향상된다.
  - 제안: 이상 없음.

- **[INFO]** `README.md` 디렉토리 트리 수정 — 폐기된 `prd/` 항목 제거 및 `plan/`, `review/` 추가
  - 위치: `README.md` 74~80행 (디렉토리 트리 코드 블록)
  - 상세: 트리에서 `prd/` 항목이 제거되고 `spec/` 설명이 보강되었으며 `plan/`, `review/` 항목이 추가되었다. 순수 문서 변경이며 빌드·런타임·파일시스템에 영향 없다.
  - 제안: 이상 없음. docs-consolidation 이후 실제 폴더 구조와 README 가 일치하게 되어 신규 기여자 혼란을 줄인다.

- **[INFO]** `README.md` "격리 인프라 기반 e2e" 섹션 신설 — 새 문서 섹션 추가
  - 위치: `README.md` 228~239행 (새로 삽입된 섹션)
  - 상세: `make e2e-test` 등 네 개 target 에 대한 안내 섹션이 추가되었다. 문서에만 해당하며 어떠한 코드·스크립트·환경 변수·파일도 변경되지 않는다.
  - 제안: 이상 없음.

- **[INFO]** `README.md` 문서 링크 검증 설명에서 `prd/` 언급 제거
  - 위치: `README.md` 243행, 252행
  - 상세: `prd/`, `spec/` → `spec/` 단독 표기, "spec/PRD 헤딩" → "spec 헤딩" 으로 교체. 순수 문서 변경. `scripts/check-doc-links.py` 의 실제 검사 범위가 바뀌지 않으며(스크립트 코드는 미수정), README 설명만 정확해진다.
  - 제안: 이상 없음. 다만 `scripts/check-doc-links.py` 가 아직 `prd/` 경로를 검사 대상으로 포함하고 있다면 스크립트도 함께 정리하는 것이 완전한 정합이 된다. 본 PR 범위 밖이므로 후속 작업으로 메모.

- **[INFO]** `plan/in-progress/e2e-makefile-followup-2026-05-16.md` 신규 생성
  - 위치: `plan/in-progress/e2e-makefile-followup-2026-05-16.md` (신규 파일)
  - 상세: plan 파일이 새롭게 생성되었다. 프로젝트 규약(CLAUDE.md)에서 정의한 `plan/in-progress/` 위치와 frontmatter(`worktree`, `started`, `owner`) 형식을 올바르게 따른다. 체크리스트 중 `TEST WORKFLOW`, `REVIEW WORKFLOW` 두 항목이 미완(`[ ]`)이며 이 파일이 `in-progress/` 에 있는 것은 규약에 부합한다.
  - 제안: 이상 없음. 향후 해당 항목 완료 후 `git mv` 로 `plan/complete/` 이동 필요.

- **[INFO]** `review/consistency/` 산출물 파일 신규 생성
  - 위치: `review/consistency/2026/05/16/09_34_14/SUMMARY.md`, `review/consistency/2026/05/16/09_34_14/_prompts/convention_compliance.md`
  - 상세: consistency-check 세션 결과물이다. `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` nested ISO 경로 규약을 따른다. 읽기 전용 산출물이며 어떤 런타임 부작용도 없다.
  - 제안: 이상 없음.

---

### 요약

이번 변경은 전적으로 문서·빌드 스크립트 도움말·plan 추적·consistency 산출물에 국한된다. `CHANGELOG.md`, `README.md` 는 정적 마크다운 파일이며 런타임에 읽히지 않는다. `Makefile` 의 변경은 `help` target 의 출력 문자열 수정과 `e2e-test-full` target 앞의 설명 주석 추가로, 실제 recipe 의 실행 명령(`docker compose ... --build`, `exit $$STATUS` 등)은 이전 PR 에서 이미 확정되어 있고 이번 PR 에서는 변경되지 않았다. 전역 변수 도입, 환경 변수 읽기/쓰기, 네트워크 호출, 이벤트/콜백 변경, 공개 API 시그니처 변경 등 부작용 관점의 위험 요인은 하나도 없다. `scripts/check-doc-links.py` 가 내부적으로 아직 `prd/` 경로를 검사한다면 README 설명과 미소한 불일치가 남을 수 있으나 이는 기능 회귀가 아닌 문서 정합성 과제다.

### 위험도

NONE
