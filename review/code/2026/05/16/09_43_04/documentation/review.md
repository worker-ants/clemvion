# 문서화(Documentation) 리뷰

리뷰 대상: `CHANGELOG.md`, `Makefile`, `README.md`, `plan/in-progress/e2e-makefile-followup-2026-05-16.md`, `review/consistency/2026/05/16/09_34_14/SUMMARY.md`, `review/consistency/2026/05/16/09_34_14/_prompts/convention_compliance.md`

커밋: `39c869c5ae51c8c913f37d83c2d12f8ecd656322`

---

### 발견사항

- **[INFO]** CHANGELOG의 "Test infrastructure" 섹션 설명이 단락 하나에 과도하게 압축됨
  - 위치: `CHANGELOG.md` — 새로 추가된 `### Test infrastructure` 섹션 (L81–84)
  - 상세: `make e2e-*` 의 `--build` 결정 사유와 영향을 한 문장에 담았다. 내용 자체는 정확하나, 독자가 빠르게 스캔할 때 핵심 변경 항목(`e2e-up`, `e2e-test`, `e2e-test-full`)을 목록 형태로 보기 어렵다. 같은 커밋 내 README 섹션은 bullet/code block 을 사용했는데 CHANGELOG 는 산문 한 줄이다.
  - 제안: 섹션 첫 줄에 영향 받은 target 세 가지를 bullet 으로 열거한 후, 결정 사유 문장을 별도 단락으로 분리하면 가독성이 개선된다.

- **[INFO]** Makefile `e2e-test-full` 인라인 주석의 블록 배치가 target 선언과 분리됨
  - 위치: `Makefile` — 추가된 `# e2e-test 와 패턴이 약간 달라 보이지만 동작은 일치한다.` 이하 4행 주석 (L153–157)
  - 상세: 주석이 `e2e-test-full:` target 선언 바로 직전이 아닌 두 라인 위에 삽입되어, `e2e-test` target 의 마지막 줄(`exit $$STATUS`)과 `e2e-test-full:` 선언 사이 공백 없이 연결된다. 주석은 `e2e-test-full` 를 설명하는 것이지만 `e2e-test` 블록에 붙어 있는 것처럼 읽힐 수 있다.
  - 제안: 빈 줄 하나를 주석 위에 추가하거나 주석을 `e2e-test-full:` 다음 줄로 이동해 해당 target 에 속함을 명확히 한다.

- **[INFO]** README 의 새 e2e 섹션에서 `e2e-up` 도 `--build` 자동 rebuild 동작을 하는지 명시 부족
  - 위치: `README.md` — `### 격리 인프라 기반 e2e (make e2e-*)` 섹션 마지막 단락 (L239)
  - 상세: "세 `e2e-*` 타겟 모두 매 실행 시 `docker compose ... --build` 로 backend 이미지를 갱신한다"라고 서술하지만, 코드 블록에는 네 개 target (`e2e-test`, `e2e-test-full`, `e2e-up`, `e2e-down`)이 나열된다. `e2e-down` 은 rebuild 와 무관하지만, `e2e-up` 도 `--build` 를 사용하는데 "세 타겟"이라는 표현이 `e2e-test`, `e2e-test-full`, `e2e-up` 을 가리키는지 아니면 `e2e-down` 을 제외한 세 개인지 독자가 한눈에 파악하기 어렵다.
  - 제안: "세 `e2e-*` 타겟" 을 "`e2e-up` / `e2e-test` / `e2e-test-full`" 로 명시적으로 열거한다.

- **[INFO]** plan 문서의 체크리스트 항목 `TEST WORKFLOW`, `REVIEW WORKFLOW` 가 미완으로 남아있음
  - 위치: `plan/in-progress/e2e-makefile-followup-2026-05-16.md` — L346–347 (`[ ] TEST WORKFLOW`, `[ ] REVIEW WORKFLOW`)
  - 상세: 이 PR 커밋과 함께 plan 파일이 추가됐는데, 체크리스트의 두 항목이 아직 미완(`[ ]`)이다. plan 문서는 `in-progress/` 에 있으므로 CLAUDE.md 규약상 문제는 아니지만, 해당 항목들이 이 커밋 이후에도 처리되어야 함을 독자가 인식할 수 있도록 plan 상태가 정확히 유지될 필요가 있다.
  - 제안: PR 병합 전 또는 별도 후속 커밋에서 `TEST WORKFLOW` / `REVIEW WORKFLOW` 완료 후 plan 을 `complete/` 로 `git mv` 한다.

- **[INFO]** CHANGELOG 에 변경 날짜(date) 표기가 없음
  - 위치: `CHANGELOG.md` — `### Test infrastructure` 섹션
  - 상세: 기존 다른 CHANGELOG 항목들이 날짜를 명시하는지 파일 전체를 볼 수 없어 확인이 제한적이나, 일반적으로 CHANGELOG 항목에는 날짜 또는 버전이 병기되어 이력 추적이 가능하다. "2026-05-15 background-monitoring 사례"는 본문에 언급하지만 항목 자체에 날짜 메타가 없다.
  - 제안: 섹션 서두나 bullet 에 `(2026-05-15)` 등 날짜를 명기해 이력 추적을 용이하게 한다.

---

### 요약

이번 변경은 `README.md` 에 e2e 인프라 섹션 신설, `CHANGELOG.md` 에 "Test infrastructure" 항목 추가, `Makefile` help 텍스트 및 인라인 주석 보강, 그리고 docs-consolidation 이후 잔존한 폐기 경로 참조(`prd/`, 구 `user_memo/`) 3건 해소로 구성된다. 문서화 관점에서는 변경 사항을 정확하게 반영하고 있으며 새 기능(`make e2e-*` 자동 rebuild)에 대한 안내가 README, CHANGELOG, Makefile help 세 곳에 일관되게 기록된 점이 우수하다. 다만 CHANGELOG 서술이 단문 산문으로 압축되어 가독성이 다소 낮고, Makefile 주석 블록이 target 선언과 약간 분리되어 소속이 모호하며, README 에서 "세 타겟"이라는 표현이 구체적이지 않은 점이 소소한 개선 여지로 발견된다. 위반 항목은 모두 경미한 수준으로 릴리스를 차단할 요소는 없다.

### 위험도

LOW
