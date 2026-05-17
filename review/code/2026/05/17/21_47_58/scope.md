# 변경 범위(Scope) 리뷰

## 발견사항

### 파일 1: execution-engine.service.spec.ts

- **[INFO]** 신규 테스트 케이스 추가 — 범위 내 정상 변경
  - 위치: 라인 46-129 (diff 기준)
  - 상세: `persists outputData (messages + interactionType + _resumeState strip) on multi-turn follow-up waiting turn` 테스트는 버그 수정(multi-turn 후속 turn 의 `NodeExecution.outputData` DB 영속 누락)을 검증하는 회귀 가드다. 변경 의도와 직접 연결된 테스트 추가이므로 범위 이탈 없음.
  - 제안: 없음.

---

### 파일 2: execution-engine.service.ts

- **[WARNING]** 실질 버그 수정 외 다수의 포맷팅 변경이 혼재
  - 위치: 라인 779-332, 3215-409, 3338-409 (diff 기준 3개 hunk)
  - 상세: 핵심 변경은 라인 2131-2177 (diff)의 `nodeExecutionRepository.save` 추가 블록 한 곳이다. 나머지 세 hunk는 기능적 변경 없이 긴 메서드 인자 목록을 줄바꿈·들여쓰기 재포맷한 것이다:
    - `this.graphTraversal.buildEdgeIndexes(...)` — 두 곳 (라인 779, 1262 영역)
    - `this.graphTraversal.isPortFiltered(...)` — 두 곳 (라인 3215, 3338 영역)
  - 이 포맷팅은 Prettier/lint 규칙에 의한 자동 변경으로 보이며, 의미 없는 diff noise를 발생시킨다. 버그 수정 커밋과 동일한 PR에 포함되어 코드 리뷰 가독성을 저해한다.
  - 제안: 포맷팅 전용 커밋을 버그 수정 커밋과 분리하거나, 포맷팅 변경을 별도 PR로 분리한다. 현 PR에서 제거해도 기능에 영향 없음.

- **[INFO]** 추가된 주석 블록은 적절함
  - 위치: 라인 2131-2168 (diff 기준)
  - 상세: `// Persist the accumulated turn snapshot...` 블록은 버그 원인·해결 근거·spec 참조를 담고 있어 의도된 변경에 직접 연관된 설명이다. 범위 이탈 없음.
  - 제안: 없음.

---

### 파일 3: catalog-sync.spec.ts

- **[WARNING]** 버그 수정과 직접 관련이 없는 파일에 경로 수정 포함
  - 위치: 라인 429-443 (diff 기준), `CATALOG_DIR` 경로 추가 `..` 삽입
  - 상세: 이 변경은 `codebase/` 래퍼 추가(commit 33521233)로 발생한 경로 오류 수정이다. multi-turn persist 버그 수정과 기능적으로 무관한 파일이다. 단, 이 수정이 없으면 catalog-sync 테스트가 독립적으로 실패하므로, 같은 PR에 포함된 데에 실용적 이유가 있다.
  - 제안: 가급적 별도 bugfix 커밋으로 분리하는 것이 범위 명확성에 좋다. 이미 동반 포함된 상태이면 커밋 메시지에 `fix(catalog-sync): correct repo-root path after codebase/ wrapper` 로 명시적으로 기재하는 것을 권장한다.

- **[INFO]** 추가된 주석은 경로 변경 근거를 설명하는 적절한 보조 정보
  - 위치: 라인 429-431 (diff 기준)
  - 상세: `__dirname` hop 수와 commit 참조를 담은 주석 3줄은 이 파일 변경 이유를 미래 유지보수자에게 설명한다.
  - 제안: 없음.

---

### 파일 4: registry.test.ts (frontend)

- **[WARNING]** 버그 수정 의도와 무관한 프론트엔드 파일에 경로 수정 포함
  - 위치: 라인 952-956 (diff 기준), `repoRoot` 경로 추가 `..` 삽입
  - 상세: catalog-sync.spec.ts 와 동일한 패턴이다. multi-turn persist 버그 수정과 기능적으로 무관하며, `codebase/` 래퍼 추가로 깨진 경로를 수정한 것이다. 프론트엔드 테스트 파일이 백엔드 execution-engine 버그 수정 PR에 포함되어 있어 변경 범위가 넓어진다.
  - 제안: 별도 커밋 또는 PR로 분리하거나, PR 설명에 "경로 수정 포함" 을 명시적으로 기재할 것을 권장한다.

- **[INFO]** 추가된 주석은 경로 변경 근거를 설명하는 적절한 보조 정보
  - 위치: 라인 953-955 (diff 기준)
  - 상세: `__dirname` hop 수와 commit 참조를 담은 주석 3줄.
  - 제안: 없음.

---

## 요약

핵심 버그 수정(multi-turn 후속 turn의 `NodeExecution.outputData` DB 영속 누락)과 그에 대응하는 회귀 테스트는 변경 의도와 정확히 일치한다. 그러나 이 PR은 세 가지 추가 범위를 포함하고 있다: (1) execution-engine.service.ts 내 포맷팅 전용 변경 4 hunk, (2) `catalog-sync.spec.ts` 및 (3) `registry.test.ts` 의 경로 픽스 — 둘 다 `codebase/` 래퍼 추가로 깨진 별도 버그 수정이다. 포맷팅 변경은 기능에 영향이 없으나 diff noise를 발생시키고, 두 경로 수정은 다른 모듈·레이어(cafe24 카탈로그 동기화, 프론트엔드 docs registry)에 속해 단일 책임 원칙 관점에서 범위가 확산됐다. 기능 안전성에 영향을 주는 문제는 없으나, 커밋 분리 또는 PR 설명 보강이 권장된다.

## 위험도

LOW
