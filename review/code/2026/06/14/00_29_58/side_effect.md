# 부작용(Side Effect) 리뷰 결과

## 대상 파일

- `/Volumes/project/private/clemvion/.claude/worktrees/refactor-05-database-721c98/spec/data-flow/3-execution.md`

## 변경 요약

`spec/data-flow/3-execution.md` §2.1 Postgres 스키마 매핑 테이블의 `node_execution` 행에서 인덱스/제약 컬럼에 V095 partial 인덱스 명세를 추가했다.

변경 전: `(execution_id)`, V034 `(execution_id, node_id, started_at DESC)` composite
변경 후: 위에 더하여 `, V095 (execution_id, status) WHERE status IN ('waiting_for_input','running')` partial (활성 노드 조회/전이) 추가

---

## 발견사항

- **[INFO]** 문서 전용 변경 — 런타임 부작용 없음
  - 위치: `spec/data-flow/3-execution.md` 라인 36 (diff 기준)
  - 상세: 이 변경은 Markdown spec 문서의 테이블 셀 하나만 수정한다. 실행 코드, 설정 파일, 환경 변수, 네트워크 호출, 이벤트/콜백 중 어느 것도 건드리지 않는다. V095 인덱스가 실제로 DB에 적용되는 시점은 별도의 마이그레이션 파일이므로, 이 spec 편집 자체는 데이터베이스 상태나 애플리케이션 동작에 직접적인 부작용을 일으키지 않는다.
  - 제안: 해당 없음.

---

## 요약

이번 변경은 spec 문서(Markdown)의 인덱스 설명 텍스트만 수정하며, 전역/공유 상태 변경·전역 변수 도입·파일시스템 부작용·함수 시그니처 변경·공개 API 변경·환경 변수 조작·네트워크 호출·이벤트/콜백 변경 중 어느 항목도 해당하지 않는다. 부작용 관점에서 완전히 무해한 문서 갱신이다.

## 위험도

NONE
