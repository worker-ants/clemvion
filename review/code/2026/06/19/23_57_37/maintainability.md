# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: execution-failure-classifier.spec.ts

- **[INFO]** `it.each` 배열 분리 포맷 일관성 양호
  - 위치: 변경 후 `it.each` 블록 (no-CCH-ERR-04 warn 테스트)
  - 상세: 기존 인라인 `it.each(['CODE_MEMORY_LIMIT', 'HTTP_BLOCKED', 'DB_HOST_BLOCKED'])` 에서 배열 리터럴 멀티라인 포맷으로 전환한 것은 가독성과 향후 항목 추가 시 diff 노이즈 감소 측면에서 개선이다. 파일 내 다른 `it.each` 블록도 동일 패턴을 이미 사용 중이므로 일관성이 유지된다.
  - 제안: 현행 유지.

- **[INFO]** `warnSpy` 설정·해제 보일러플레이트 반복
  - 위치: "no CCH-ERR-04 warn" 테스트, "Unknown fallback" describe, "event.error undefined guard" describe
  - 상세: `jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)` + `warnSpy.mockRestore()` 패턴이 세 곳에서 동일하게 반복된다. 현재 규모(3회)에서 결함 위험은 낮고 `beforeEach`/`afterEach` 추출 없이도 파악 가능하나, warn 관련 테스트가 늘어날 경우 유지보수 부담이 증가한다.
  - 제안: 즉시 수정 의무 없음. warn 테스트 추가 빈도가 높아지면 `withWarnSpy(fn: (spy) => void)` 형태의 헬퍼 추출을 고려한다.

### 파일 2: execution-failure-classifier.ts

- **[INFO]** `INTERNAL_CODES` Set 내 주석 일관성 양호
  - 위치: 신규 추가 주석 블록 (`WORKFLOW_FORBIDDEN_WORKSPACE` 위)
  - 상세: 신규 항목 주석이 기존 `HTTP_BLOCKED`(SSRF 차단), `DB_HOST_BLOCKED`(DB SSRF 차단) 주석과 동일한 서술 패턴(차단 원인 → 분류 근거 → spec 참조 → 기존 W1 패턴 언급)을 따른다. Set 전체에서 패턴 일관성이 유지된다.
  - 제안: 현행 유지.

- **[INFO]** `SUB_WORKFLOW_FAILED`와 `WORKFLOW_FORBIDDEN_WORKSPACE` 물리적 인접 배치
  - 위치: `INTERNAL_CODES` Set, `SUB_WORKFLOW_FAILED` 직후
  - 상세: 의미적으로 같은 그룹(sub-workflow 관련 실패)인 두 코드가 인접 배치되어 있어, 미래에 동일 카테고리 코드 추가 시 자연스러운 확장 위치가 명확하다. 주석도 그룹 의도를 명시("동일 그룹").
  - 제안: 현행 유지.

- **[INFO]** `classifyExecutionFailure` 함수 분기 체인
  - 위치: 함수 본체 전체
  - 상세: 함수는 6개 선형 분기(`if` 단일 반환)로 구성되며, 중첩이 없고 순환 복잡도는 약 7이다. 신규 코드가 Set 에만 추가되므로 함수 본체 변경 없이 확장 가능한 구조다. 이번 변경이 함수 길이·복잡도에 영향을 주지 않는다.
  - 제안: 현행 유지.

### 파일 3: plan/in-progress/classify-forbidden-workspace.md

- **[INFO]** Plan 문서 완전성 양호
  - 위치: 전체
  - 상세: frontmatter(worktree, status, started, owner, parent) 가 규약 스키마를 준수하고, 작업 체크리스트와 워크플로 체크리스트가 명확히 분리되어 있다. 결정·근거 섹션에 impl-prep 생략 이유와 e2e 판단 근거가 기록되어 있어 맥락 재구성이 가능하다.
  - 제안: 현행 유지.

### 파일 4: spec/conventions/chat-channel-adapter.md

- **[INFO]** 매핑 표 행 길이 증가
  - 위치: `executionFailedInternal` 행 (변경된 단일 행)
  - 상세: `WORKFLOW_FORBIDDEN_WORKSPACE(W-6 워크스페이스 격리 차단)` 추가로 이미 11개 코드가 나열된 긴 셀이 더 길어진다. Markdown 렌더러에서는 문제없으나 raw 편집 시 가독성이 낮아진다. 즉각적 문제는 아니나 코드 추가가 계속될 경우 누적 유지보수 부담이 생긴다.
  - 제안: 즉시 수정 필요 없음. 향후 코드 추가 시 테이블 행 분리 또는 내부 열거를 별도 목록으로 추출하는 방안을 검토한다.

## 요약

이번 변경은 `WORKFLOW_FORBIDDEN_WORKSPACE` 코드를 `INTERNAL_CODES` Set 에 단일 항목으로 추가하고, 테스트 파라미터 배열 두 곳과 spec 표 한 행에 동일 코드를 등재하는 최소 범위 변경이다. 코드 구조는 기존 W1 패턴(CODE_MEMORY_LIMIT, HTTP_BLOCKED)을 1:1 복제하여 일관성이 높으며, 주석 서술 방식·배치 위치·테스트 포맷 모두 기존 컨벤션을 따른다. 함수 길이·중첩 깊이·매직 넘버·순환 복잡도 측면에서 변경 전후 차이가 없고 현행 수치도 허용 범위 내다. 테스트 파일의 `warnSpy` 보일러플레이트 반복과 spec 표 행 길이 증가는 누적 리스크가 있으나 현재 규모에서 즉시 수정 의무는 없다. 유지보수성 관점에서 위험 요소가 없는 변경이다.

## 위험도

NONE
