# Convention Compliance Review

검토 대상: `README.md`, `CHANGELOG.md`, `Makefile`
검토 모드: 구현 착수 전 (--impl-prep)
검토 일시: 2026-05-16

---

## 발견사항

### 1
- **[CRITICAL]** README.md — 금지된 `prd/` 경로가 주요 경로 트리에 잔존
  - target 위치: `README.md` 78행 (`├── prd/                        # 제품 요구 사항 정의서 (PRD)`)
  - 위반 규약: `CLAUDE.md` "폴더 구조 > 명명 컨벤션" — "옛 `prd/`, `memory/`, `user_memo/` 폴더는 docs-consolidation(2026-05-12) 으로 모두 `spec/` 또는 `plan/complete/archive/` 로 흡수되었다. 신규 문서를 옛 경로 컨벤션으로 만들지 않는다."
  - 상세: README.md 의 "주요 경로" 섹션 코드블록 안에 `prd/` 항목이 삭제되지 않고 남아있다. docs-consolidation 이후 `prd/` 폴더는 존재해서는 안 되는 경로이므로, README가 이를 정식 경로로 표기하면 다른 개발자·문서 도구가 `prd/`가 유효한 경로라고 오해할 수 있다.
  - 제안: 해당 `prd/` 항목을 트리에서 제거하고, 제품 정의 문서 경로를 `spec/<영역>/_product-overview.md` 형식으로 대체하거나 `spec/` 항목의 설명을 "제품 정의·기술 명세" 로 갱신한다.

### 2
- **[CRITICAL]** README.md — `prd/` 경로를 `spec/` 와 병렬로 재언급
  - target 위치: `README.md` 232행 (`prd/`, `spec/` 의 markdown 내부 링크와 ... 정합성을 확인한다.)
  - 위반 규약: `CLAUDE.md` "폴더 구조 > 명명 컨벤션" — 옛 `prd/` 경로 신규 사용 금지.
  - 상세: 문서 링크 검증 설명문에서 `prd/` 를 유효한 검사 대상 경로로 나열하고 있다. `prd/`가 흡수된 이후에도 이 설명이 그대로 남아 있어 `check-doc-links.py` 가 `prd/` 경로를 정상 대상으로 취급하는 것처럼 문서화된다.
  - 제안: `prd/` 언급을 제거하고 `spec/` 단독으로 표기하거나, 정확한 검사 대상(`spec/`, `frontend/src/content/docs/`)만 명시한다.

### 3
- **[CRITICAL]** CHANGELOG.md — `user_memo/` 경로 직접 참조
  - target 위치: `CHANGELOG.md` 4행 (`Implements the CONVENTIONS rulebook in \`user_memo/node-specs-improvement/CONVENTIONS.md\``)
  - 위반 규약: `CLAUDE.md` "폴더 구조 > 명명 컨벤션" — "옛 `prd/`, `memory/`, `user_memo/` 폴더는 docs-consolidation(2026-05-12) 으로 모두 `spec/` 또는 `plan/complete/archive/` 로 흡수되었다."
  - 상세: CHANGELOG 본문이 `user_memo/node-specs-improvement/CONVENTIONS.md` 를 규칙집 위치로 명시하고 있다. 이 경로는 docs-consolidation 이후 `spec/conventions/node-output.md` 로 이전된 정식 규약이다. CHANGELOG 가 옛 경로를 정규 경로처럼 기술하면, 이 릴리즈 노트를 읽는 사람이 실제로 존재하지 않는 경로를 찾으러 이동하거나 다른 문서에서 이 경로를 재인용하는 오류로 이어질 수 있다.
  - 제안: `user_memo/node-specs-improvement/CONVENTIONS.md` 를 `spec/conventions/node-output.md` 로 교체한다. CHANGELOG 는 역사 기록이지만, 독자를 현재 경로로 안내하는 기능이 중요하므로 이 수정은 정보 정합성 유지 차원에서 필요하다.

### 4
- **[INFO]** README.md — 문서 구조: "주요 경로" 트리가 실제 폴더 구조와 불일치 가능성
  - target 위치: `README.md` 75–106행 ("주요 경로" 코드블록)
  - 위반 규약: `CLAUDE.md` "README.md" 항 — "history 가 아닌 **제품의 최종 상태** 를 서술한다."
  - 상세: `prd/` 항목 잔존(이슈 1)과 더불어, `spec/` 항목의 설명이 "기술 스펙 문서 (SDD)" 로만 표기되어 있어 제품 정의(옛 PRD) 도 여기 통합되었음을 독자에게 알리지 않는다. 최신 상태를 서술한다는 CLAUDE.md 의도에 비춰볼 때 `spec/` 항목 설명을 "제품 정의·기술 명세 (단일 진실)" 등으로 보강하는 것이 좋다.
  - 제안: `spec/` 항목 설명을 "제품 정의·기술 명세 (single source of truth)" 수준으로 갱신. 사소한 형식 제안이므로 INFO 등급.

### 5
- **[INFO]** Makefile — 규약 위반 없음, 참고 사항
  - target 위치: `Makefile` 전체
  - 위반 규약: 없음
  - 상세: `e2e-test`, `e2e-up`, `e2e-down`, `e2e-test-full` 타겟 명명은 CLAUDE.md 개발 방법론 및 SKILL.md 의 `make e2e-test` 규약과 일치한다. `docker-compose.e2e.yml` 참조 방식도 올바르다. 발견 사항 없음.
  - 제안: 없음.

---

## 요약

세 대상 파일 중 `Makefile` 은 정식 규약과 완전히 일치한다. 반면 `README.md` 와 `CHANGELOG.md` 는 docs-consolidation(2026-05-12) 이후 폐기된 `prd/` 및 `user_memo/` 경로를 여전히 유효한 경로로 기술하고 있어, 각각 CRITICAL 2건과 CRITICAL 1건이 식별되었다. 이 세 건은 독자·자동화 도구가 더 이상 존재하지 않는 경로를 정규 경로로 오인하게 만들어 프로젝트의 "단일 진실 원칙" invariant를 직접 위반한다. 추가로 README.md 의 `spec/` 설명 미흡 1건이 INFO로 기록되었다.

---

## 위험도

MEDIUM

> CRITICAL 발견 3건이 있으나, 이들은 모두 문서 텍스트 내 경로 표기 문제이며 실제 코드 실행·배포 경로나 API 계약에 직접 영향을 주지는 않는다. 다만 docs-consolidation 이후 옛 경로를 정규 경로로 안내하는 문서가 존재하면 신규 기여자가 잘못된 위치를 참조하거나, `check-doc-links.py` 같은 자동화 스크립트가 `prd/` 를 유효 경로로 검사하는 부작용이 발생할 수 있어 MEDIUM 으로 판정한다.
