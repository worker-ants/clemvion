# Cross-Spec 일관성 검토 — e2e Makefile follow-up (README · CHANGELOG · Makefile)

검토 모드: `--impl-prep` / scope: `README.md`, `CHANGELOG.md`, `Makefile`
대상 plan: `plan/in-progress/e2e-makefile-followup-2026-05-16.md`

---

## 발견사항

- **[WARNING]** README.md 디렉토리 트리에 폐기된 `prd/` 경로 박제
  - target 위치: `README.md` 라인 77 — `├── prd/                        # 제품 요구 사항 정의서 (PRD)`
  - 충돌 대상: `spec/0-overview.md §8 문서 맵` / `CLAUDE.md §폴더 구조`
  - 상세: docs-consolidation(2026-05-12)으로 `prd/` 는 `spec/` 으로 완전 흡수되었고, `CLAUDE.md` 는 "`옛 prd/, memory/, user_memo/ 폴더는 docs-consolidation(2026-05-12)으로 모두 spec/ 또는 plan/complete/archive/ 로 흡수되었다`" 라고 명시한다. `README.md` 디렉토리 트리의 `prd/` 항목은 존재하지 않는 경로를 공식 문서에 표기하는 것이므로 spec 과 직접 모순된다. 본 plan 이 README 를 편집하는 시점에 함께 수정하지 않으면 스텔스 회귀가 고착된다.
  - 제안: `README.md` 편집 작업 시 해당 라인을 `spec/                       # 제품 정의·기술 명세 (단일 진실)` 로 교체하거나 삭제. 이미 라인 76 에 `prd/` 와 `spec/` 둘 다 나열되어 있는 상태이므로 `prd/` 행 제거가 가장 간결하다.

- **[INFO]** README.md 스크립트 표가 `make e2e-test` 를 누락하여 `npm run test:e2e` 만 안내
  - target 위치: `README.md` 라인 222–228 `### 스크립트` 표
  - 충돌 대상: `plan/in-progress/e2e-makefile-followup-2026-05-16.md` 작업 항목 1 / `CLAUDE.md §개발 방법론` ("e2e — `make e2e-test`, `docker-compose.e2e.yml` 기반 격리 인프라")
  - 상세: CLAUDE.md 는 e2e 테스트 실행의 정규 경로로 `make e2e-test` 를 명시하나, README 스크립트 표에는 `npm run test:e2e` 만 기술되어 있다. plan 이 "스크립트 표 자체 재구성은 의도적 제외" 라고 밝히고 별도 단락 추가를 선택한 점은 인지되어 있다. 단락 추가 후에도 표와 단락이 병존하므로 독자가 두 경로의 차이(격리 인프라 여부)를 오해할 수 있다.
  - 제안: 추가하는 단락에 "표의 `npm run test:e2e` 는 host 환경 직접 실행(인프라 별도 필요), `make e2e-test` 는 격리 인프라 포함 1-shot 실행" 임을 한 문장으로 구분해 표기. 또는 표에 Makefile 타겟 행을 추가하고 단락을 생략하는 것도 동등하게 유효.

- **[INFO]** CHANGELOG.md "Unreleased" 섹션 제목이 특정 기능("Node Output Contract Unification")으로 고정되어 Test infrastructure 항목과 의미상 혼재
  - target 위치: `CHANGELOG.md` 라인 3 — `## Unreleased — Node Output Contract Unification`
  - 충돌 대상: 없음 (외부 spec 충돌 아님)
  - 상세: plan 이 "Unreleased 하단 신설 섹션(예: 'Test infrastructure') 에 1-2줄 기록" 을 계획하는데, 현재 Unreleased 헤더가 단일 기능명("Node Output Contract Unification")으로 이미 고정되어 있다. 새 섹션이 추가되면 하나의 Unreleased 블록 안에 서로 다른 주제(노드 계약 통일 + e2e 인프라 변경)가 섞인다. 이는 spec 위반이 아니라 changelog 가독성 문제이므로 INFO 로 분류.
  - 제안: 추가 섹션의 헤더를 명확히 구분(`### Test infrastructure` 또는 `### Internal / DX`) 해 Unreleased 내 하위 카테고리임을 드러내는 것이 충분. Unreleased 헤더 자체를 변경할 필요는 없다.

---

## 요약

target 파일(`README.md`, `CHANGELOG.md`, `Makefile`) 은 spec 도메인 엔티티·API 계약·상태 머신·RBAC 와 직접 교차하지 않는 문서/인프라 레이어이므로 CRITICAL 충돌은 없다. 다만 `README.md` 라인 77 의 `prd/` 경로 박제가 docs-consolidation(2026-05-12) 결정과 직접 모순되는 WARNING 이 1건 있다. README 를 편집하는 본 plan 의 작업 범위 안에서 해당 행을 함께 수정하면 추가 PR 없이 해결된다. INFO 2건은 독자 경험·changelog 가독성 개선 권장 사항이며 착수 차단 사유가 아니다.

---

## 위험도

LOW
