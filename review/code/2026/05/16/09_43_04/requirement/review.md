# 요구사항(Requirement) 리뷰

대상 커밋: `39c869c` — `docs(infra): README/CHANGELOG/Makefile follow-up + docs-consolidation 사전 결함 동반 해소`

---

## 발견사항

### 1. plan 문서 미완료 상태에서 커밋 포함

- **[WARNING]** `plan/in-progress/e2e-makefile-followup-2026-05-16.md` 가 `in-progress/` 에 위치한 채로 커밋에 포함됨
  - 위치: `plan/in-progress/e2e-makefile-followup-2026-05-16.md` 체크리스트 L36–38
  - 상세: 체크리스트 항목 `[ ] TEST WORKFLOW` 와 `[ ] REVIEW WORKFLOW` 가 미체크 상태다. CLAUDE.md 의 PLAN 문서 라이프사이클 규약("미체크 체크박스가 하나라도 있으면 `in-progress/`")에 따라 이 파일은 현재 작업이 끝난 뒤 `complete/` 로 이동되어야 한다. 커밋 자체에 포함되는 것이 문제가 아니라, 이 리뷰 사이클(REVIEW WORKFLOW)이 완료된 후에도 파일이 이동되지 않으면 라이프사이클 규약 위반이 된다.
  - 제안: REVIEW WORKFLOW 완료 시점에 `git mv plan/in-progress/e2e-makefile-followup-2026-05-16.md plan/complete/` 를 수행하고 별도 커밋으로 기록한다.

### 2. e2e-test-full의 exit code 캡처 범위 불일치 — 주석과 구현의 의도 괴리

- **[WARNING]** `e2e-test-full` 의 인라인 주석이 "runner1 실패 → STATUS=runner1 exit" 라고 설명하지만, 실제로는 `&&` short-circuit 이 발생하면 `STATUS=$$?` 가 캡처하는 값은 **runner1 의 exit code 가 아닌 runner2 의 exit code** 다.
  - 위치: `Makefile` L35–44
  - 상세: `runner1 && runner2; STATUS=$$?` 패턴에서 runner1 이 실패하면 `&&` 가 short-circuit 하여 `runner2` 는 실행되지 않는다. 이때 `$$?` 는 **runner1 의 exit code** 를 보존하고 있으며 `STATUS` 에 올바르게 담긴다. 그러나 주석 `(runner1 실패 → STATUS=runner1 exit, runner2 실패 → STATUS=runner2 exit, 둘 다 성공 → 0)` 은 올바른 동작을 기술하므로 결과적으로 주석의 의도 자체는 맞다. 다만 앞 문장 "패턴이 약간 달라 보이지만 동작은 일치한다" 는 `e2e-test` 의 `; STATUS=$$?` 패턴과 비교한 것인데, `e2e-test` 는 runner 1개이고 `e2e-test-full` 은 runner 2개로 구조가 다르다는 점에서 독자가 혼동할 소지가 있다. 핵심 차이는 "runner1 실패 시 runner2 skip" 정책이 의도적 설계인지가 명시되지 않은 것이다.
  - 제안: 주석에 "runner1 실패 시 runner2(playwright) 는 실행되지 않음 — 백엔드 e2e 통과가 playwright 선행 조건" 이라는 설계 의도를 한 줄 추가하면 향후 오해를 방지할 수 있다.

### 3. README.md e2e 섹션의 e2e-up 자동 rebuild 설명 불일치

- **[INFO]** README.md 의 새 e2e 섹션에서 "세 `e2e-*` 타겟 모두 매 실행 시 `--build` 로 backend 이미지를 갱신한다" 고 서술하지만, 실제로는 `e2e-up`, `e2e-test`, `e2e-test-full` 세 타겟이고 `e2e-down` 은 당연히 build 대상이 아니다. 서술 자체는 오해 없이 읽히나, `help` 텍스트에는 `e2e-up` 에만 "(자동 image rebuild)" 가 명시되고, `e2e-test`/`e2e-test-full` 에도 추가됐으므로 README 설명과 일치한다.
  - 위치: `README.md` L239 (추가된 섹션)
  - 상세: `e2e-down` 이 명시적으로 제외되어 있으므로 큰 문제는 아니나, "세 타겟" 이라는 표현이 README 의 `make e2e-down` 코드 예시 바로 뒤에 위치하여 독자가 잠깐 `e2e-down` 도 포함되는지 혼동할 수 있다.
  - 제안: "세 `e2e-*` 타겟" 을 `e2e-up`, `e2e-test`, `e2e-test-full` 로 명시하거나, 문장을 "빌드 타겟 세 개(`e2e-up`/`e2e-test`/`e2e-test-full`) 모두 …" 처럼 대상을 명확히 열거한다.

### 4. CHANGELOG의 "Test infrastructure" 섹션 위치

- **[INFO]** CHANGELOG.md 에 추가된 `### Test infrastructure` 섹션이 `## Unreleased — Node Output Contract Unification` 하단의 마지막에 위치한다. 이 섹션은 "Node Output Contract Unification" 릴리스와 직접 관련이 없는 독립적인 인프라 변경이다. Unreleased 하위 섹션으로 배치되는 것이 형식 일관성 측면에서 맞지만, 향후 릴리스 시 해당 섹션이 "Node Output Contract Unification" 릴리스 노트에 포함되어 독자에게 혼란을 줄 수 있다.
  - 위치: `CHANGELOG.md` L82–84
  - 상세: CHANGELOG 구조가 단일 Unreleased 섹션을 쓰고 있어 모든 변경이 같은 릴리스에 묶이는 구조다. 별도 릴리스 노트 분리 여부는 프로젝트 정책에 달린 문제이므로 INFO 등급으로 분류한다.
  - 제안: CHANGELOG 의 "Unreleased" 섹션 상단에 주석 또는 메타로 "여러 변경이 동시에 누적되는 섹션" 임을 명시하거나, 중장기적으로 카테고리별 Unreleased 항목 분리를 검토한다.

### 5. plan 문서의 0-unimplemented-overview.md 내 `prd/` 경로 참조 잔존

- **[INFO]** `plan/in-progress/0-unimplemented-overview.md` (consistency-check 의 plan_coherence 프롬프트에 포함됨) 내부에 `prd/0-overview.md` 등 폐기된 `prd/` 경로 참조가 다수 남아있다. 본 PR 이 해소한 `README.md`, `CHANGELOG.md` 내 `prd/` 참조와 동일한 종류의 docs-consolidation 잔여 결함이다.
  - 위치: `plan/in-progress/0-unimplemented-overview.md` L3, L1328 등
  - 상세: 본 PR 은 의도적으로 `plan/in-progress/0-unimplemented-overview.md` 의 정리를 "의도적 제외" 로 선언하지 않았다. 다만 consistency-check 의 발견 목록(C1~C3)에도 포함되지 않았으므로, 범위 외 잔여 결함으로 남아있다. 요구사항 관점에서 "docs-consolidation 이후 폐기 경로 참조 제거" 라는 작업이 완결되지 않았음을 시사한다.
  - 제안: 후속 PR 에서 `plan/in-progress/0-unimplemented-overview.md` 의 `prd/` 참조를 정리하거나, 본 plan 의 "의도적 제외" 섹션에 명시적으로 기재하여 추적한다.

---

## 요약

이번 변경은 `Makefile --build` 수정에 대한 문서 후속 조치(README e2e 섹션 신설, CHANGELOG Test infrastructure 섹션 추가, Makefile help 갱신, `e2e-test-full` 패턴 주석) 와 docs-consolidation 사전 결함 3건 해소를 하나의 커밋으로 처리했다. 기능 완전성 측면에서 계획한 4개 후속 항목과 3개 사전 결함 항목 모두 구현 체크리스트가 완료로 표시되어 있다. 핵심 요구사항(stale 이미지 회귀 방지 문서화, 폐기 경로 제거)은 충족됐다. 단, plan 문서의 TEST/REVIEW WORKFLOW 항목이 미완으로 남아 있어 리뷰 완료 후 `complete/` 이동이 필요하다. `e2e-test-full` 주석은 exit code 동작을 올바르게 기술하지만 "runner1 실패 시 runner2 skip" 이라는 설계 의도가 명시되지 않아 향후 혼동 여지가 있다. 전반적으로 문서 변경 중심이며 로직 변경이 없어 에러 시나리오·데이터 유효성 관련 위험은 낮다.

---

## 위험도

LOW
