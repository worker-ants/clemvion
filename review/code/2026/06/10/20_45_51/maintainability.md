# 유지보수성(Maintainability) 리뷰 결과

리뷰 대상: perf 백로그 01 구현 관련 consistency review 산출물 3종 + spec 갱신 2종 (Markdown 문서)

---

## 발견사항

### [INFO] `spec/5-system/4-execution-engine.md` §2.1 표 셀 — 설명 컬럼이 비대칭적으로 길어짐
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/spec/5-system/4-execution-engine.md` 순환 참조 제한 표 (`MAX_NODE_ITERATIONS` 행)
- 상세: 변경 전 설명 컬럼은 단일 문장이었으나, 이번 변경으로 "모듈 로드 시 1회 읽음 — 변경은 인스턴스 재시작 시 반영 (§11 worker env 들과 동일 규약)." 가 인라인 추가되어 동일 표 내 다른 행 대비 현저히 길어졌다. 표 내 같은 컬럼의 길이 불균형은 가독성을 저하하고, 테이블 렌더러에 따라 레이아웃이 왜곡될 수 있다.
- 제안: read-once 규약 설명은 표 아래 별도 주석(`>`)으로 이동하거나, 표 설명 컬럼은 "단일 노드가 한 실행에서 반복될 수 있는 최대 횟수. `0` 설정 시 무제한 (read-once 규약 — §11)." 수준으로 축약하고 세부를 각주로 위임하면 표 일관성이 유지된다.

---

### [INFO] `spec/data-flow/4-file-storage.md` 코드 진입점 목록 인라인 주석 — 다른 항목과 서술 수준 불일치
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/spec/data-flow/4-file-storage.md` Overview 코드 진입점 불릿
- 상세: `s3.service.ts` 불릿이 `upload`, `download`, `delete`, `deleteMany(keys)` 를 열거하며 `deleteMany` 에만 `(DeleteObjects 배치 — KB 삭제 cleanup 전용)` 괄호 주석이 붙는다. 다른 메서드들(`upload`, `download`, `delete`)에는 용도 주석이 없어 서술 수준이 비대칭이다. 신규 독자는 `deleteMany` 만 주석이 달린 이유를 추론해야 한다.
- 제안: (A) 모든 메서드에 동일 수준의 간략 주석을 추가하거나, (B) 모두 주석 없이 메서드 목록만 유지하고 세부는 §3 라이프사이클 표로 위임하는 방식 중 하나로 통일한다.

---

### [INFO] `spec/data-flow/4-file-storage.md` §3 라이프사이클 표 다음 인용 블록 — 두 문단이 단일 `>` 블록에 혼재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/spec/data-flow/4-file-storage.md` §3 라이프사이클 표 바로 아래 `>` 블록
- 상세: 변경 전에는 두 개의 독립된 `>` 인용 블록이었으나, 이번 변경으로 "KB 삭제 시 S3 객체 cleanup…" 설명과 "다만 삭제 시점에 warn 으로 스킵된 객체…" 문장이 하나의 연속 블록으로 합쳐졌다. 두 문장은 서로 다른 관심사(삭제 방식 vs GC 계획)를 다루므로 분리하면 독자가 개별 항목을 빠르게 파악하기 쉬워진다.
- 제안: 두 문장 사이에 빈 줄을 삽입해 별도 `>` 블록으로 분리한다. 기능 변경 없음.

---

### [INFO] consistency review 산출물 — `naming_collision.md` 발견사항 번호 매김과 헤더 수준 혼용
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/review/consistency/2026/06/10/20_30_25/naming_collision.md`
- 상세: 6개 식별자는 본문 번호 리스트(1~6)로 기술하고, 이후 "[INFO] `sortByStartedAt` 주석 잔존" 항목만 `###` 헤더로 구분된다. 같은 문서 내에서 발견사항 일부는 헤더, 일부는 번호 리스트로 기술되어 탐색 구조가 비일관적이다. 특히 `plan_coherence.md`·`rationale_continuity.md` 는 발견사항을 전부 `###` 헤더로 통일하고 있어 세 파일 간 스타일이 다르다.
- 제안: 식별자 충돌 여부 목록과 INFO 경고를 같은 레벨(`###` 헤더 또는 번호 리스트)로 통일한다. 다른 review 파일과 동일한 패턴(헤더 기반)을 따르는 것이 일관성 측면에서 유리하다.

---

### [INFO] `spec/4-nodes/1-logic/10-parallel.md` P1 구현 상태 callout — 단일 문장에 괄호 중첩 과다
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/spec/4-nodes/1-logic/10-parallel.md` P1 구현 상태 `>` 블록
- 상세: 변경 후 해당 문장은 `(default ON — PARALLEL_ENGINE=v1 가 기본값)`, `(rollback card — 본 env 는 모듈 로드 시 1회 읽음, 변경은 인스턴스 재시작 시 반영)` 두 개의 괄호 주석이 연이어 등장한다. 이미 상당히 조밀한 callout에 추가 정보를 인라인으로 계속 누적하면 단일 문장의 인지 부하가 높아진다.
- 제안: rollback card 설명(`본 env 는 모듈 로드 시 1회 읽음, 변경은 인스턴스 재시작 시 반영`) 을 `execution-engine.md §2.1` 링크 참조로 대체하거나, P1 구현 상태 callout 아래에 작은 별도 줄로 분리한다.

---

## 요약

이번 변경 대상은 모두 Markdown 문서(spec 갱신 2종, consistency review 산출물 3종)로, 코드 로직이 아닌 문서의 유지보수성이 평가 범위다. 기능 동작에 직접 영향을 주는 문제는 없다. 주요 지적사항은 네 가지다: (1) `execution-engine.md` 순환 참조 표에서 `MAX_NODE_ITERATIONS` 설명 셀만 지나치게 길어진 표 내 불균형, (2) `file-storage.md` 코드 진입점 목록에서 `deleteMany` 만 인라인 주석이 붙어 다른 메서드와 서술 수준이 비대칭, (3) 같은 파일 §3 인용 블록에서 서로 다른 관심사 문장이 하나의 블록으로 합쳐진 구조 혼합, (4) `naming_collision.md` 에서 발견사항 일부는 번호 리스트, 일부는 헤더로 기술되어 다른 review 파일과 스타일이 불일치. 모두 독자 이해도와 문서 탐색성에 영향을 주는 INFO 수준 개선이며 기능 회귀 가능성은 없다.

---

## 위험도

NONE
