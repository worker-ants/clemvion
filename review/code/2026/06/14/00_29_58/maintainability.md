# 유지보수성(Maintainability) Review

## 발견사항

- **[INFO]** 인덱스 항목 문자열이 과도하게 길어 가독성 저하
  - 위치: `spec/data-flow/3-execution.md` §2.1 Schema 매핑 표, `node_execution` 노드 실행 시작 행 "인덱스 / 제약" 셀
  - 상세: 변경 후 인덱스 셀이 `` `(execution_id)`, V034 `(execution_id, node_id, started_at DESC)` composite, V095 `(execution_id, status) WHERE status IN ('waiting_for_input','running')` partial (활성 노드 조회/전이) `` 로 늘어났다. Markdown 표 셀 안에 3개의 인덱스 항목과 부연 설명이 한 줄에 압축되어, 좁은 화면이나 diff 뷰에서 가독성이 낮다. 인접 행(`execution` 행)의 인덱스 셀은 `` `(workflow_id, started_at DESC)`, `(status)` `` 수준의 간결함을 유지하고 있어 스타일 일관성도 낮아졌다.
  - 제안: 각 인덱스를 줄 바꿈(`<br>` 또는 별도 sub-bullet list) 으로 분리하거나, 복잡한 부연 설명은 각주 또는 본문 §2.1 아래 별도 서술 블록으로 추출해 표를 간결하게 유지한다. 예:
    ```
    `(execution_id)`,
    V034 `(execution_id, node_id, started_at DESC)` composite,
    V095 `(execution_id, status) WHERE status IN ('waiting_for_input','running')` partial
    ```

- **[INFO]** V095 인덱스의 목적 설명이 단일 셀에 인라인 삽입되어 문서 전체 패턴과 불일치
  - 위치: 동일 셀 내 `(활성 노드 조회/전이)` 괄호 주석
  - 상세: 다른 인덱스 항목(V034, V035 등)은 해당 마이그레이션 번호와 인덱스 정의만 제시하고 목적 설명을 인라인으로 달지 않는다. V095만 `(활성 노드 조회/전이)` 를 괄호로 끼워 넣어 일관성이 깨진다.
  - 제안: 목적 설명을 제거하거나, 전체 인덱스 항목에 동일하게 목적 주석을 추가하는 방향으로 컨벤션을 통일한다. 추가 맥락이 필요하다면 §2.1 아래 별도 노트 블록(예: `> V095: ...`)을 활용한다.

## 요약

이번 변경은 `node_execution` 인덱스 항목에 V095 partial index 정보를 추가한 단일 라인 수정이다. 변경 자체는 정확하고 의미 있는 정보를 추가하지만, 표 셀 하나에 3개의 인덱스 정의와 인라인 목적 주석을 한 줄로 압축한 결과, 인접 행들의 간결한 스타일과 불일치한다. 함수 길이·매직 넘버·중복 코드 등 코드 수준 관점은 spec 문서(Markdown) 특성상 해당하지 않는다. 가독성과 스타일 일관성 측면에서 낮은 수준의 개선 여지가 있으나 문서의 기능적 정확성에는 영향을 주지 않는다.

## 위험도

LOW
