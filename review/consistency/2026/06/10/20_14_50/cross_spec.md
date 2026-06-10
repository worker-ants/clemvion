# Cross-Spec 일관성 검토 결과

대상 문서: `plan/in-progress/spec-update-perf-backlog-01.md`
검토 모드: `--spec`

---

## 발견사항

### [WARNING] Item 2: `§1.6` 섹션 참조가 존재하지 않음
- **target 위치**: draft §2 — "spec/5-system/4-execution-engine.md §1.6"
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/spec/5-system/4-execution-engine.md`
- **상세**: draft 는 `§1.6 표의 MAX_NODE_ITERATIONS 행` 에 문구를 추가하도록 지정하지만, 실제 `4-execution-engine.md` 에 `§1.6` 이라는 섹션은 존재하지 않는다. `## 1. 실행 상태 머신` 의 하위 섹션은 `§1.1 Execution 상태`, `§1.2 NodeExecution 상태`, `§1.3 블로킹/재개 컨트랙트` 세 개뿐이다. `MAX_NODE_ITERATIONS` 는 `§2.1 토폴로지 정렬 기반 실행 (순환 참조 지원)` 안의 `순환 참조 제한` 표(line 206)에 위치한다. PARALLEL_ENGINE 은 `§2.1` 본문 밖(overview 문서 §6.1 Parallel 노드 행)에 언급되며, `4-execution-engine.md` 자체에는 등장하지 않는다. 섹션 번호 오기(§2.1 → §1.6)로 실제 반영 위치를 찾기 어렵게 만든다.
- **제안**: draft §2 를 "§2.1 토폴로지 정렬 기반 실행 — `순환 참조 제한` 표의 `MAX_NODE_ITERATIONS` 행" 으로 수정. `PARALLEL_ENGINE` 언급 위치도 `spec/4-nodes/1-logic/10-parallel.md` 또는 `spec/0-overview.md §6.1 Parallel 노드 행` 임을 명시한다.

---

### [INFO] Item 1: `s3Service.deleteMany` 메서드는 현재 s3.service.ts spec 에 정의되지 않음
- **target 위치**: draft §1 — "s3Service.deleteMany(keys) — DeleteObjectsCommand 1000키/요청 청크 배치 삭제"
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/spec/data-flow/4-file-storage.md` Overview 코드 진입점 목록 (line 18)
- **상세**: `spec/data-flow/4-file-storage.md` 의 "코드 진입점" 표는 `s3Service` 의 메서드를 `upload(key, body, contentType)`, `download(key)`, `delete(key)` 세 개만 기재한다. draft 는 `deleteMany(keys)` 를 새 메서드로 도입하고 Spec 을 갱신하지만, 해당 메서드가 목록에 추가되지 않으면 코드 진입점 절이 구식이 된다. 행위 의미는 불변(best-effort warn 정책 유지)이므로 CRITICAL 수준은 아니지만, Overview 의 메서드 목록이 동기화 대상이다.
- **제안**: draft 가 `spec/data-flow/4-file-storage.md` 를 갱신할 때 Overview "코드 진입점" 항목에 `deleteMany(keys)` 를 추가한다(현재 draft 에는 §3 라이프사이클 표와 본문 산문만 갱신 대상으로 명시). 완전한 spec 반영을 위해 draft 체크리스트에 해당 항목 추가를 권장한다.

---

## 요약

target draft 는 두 건의 code-sync 문구 갱신으로, 둘 다 행위 의미를 바꾸지 않는 범위다. Item 1(`s3Service.deleteMany`)은 `spec/data-flow/4-file-storage.md` 본문의 라이프사이클 서술을 갱신하는 정합 변경이며 다른 spec 과 모순이 없다. 다만 Overview 코드 진입점 목록의 동기화가 draft 범위에서 누락돼 있어 INFO 로 기록한다. Item 2(`MAX_NODE_ITERATIONS §1.6`)는 실제 `4-execution-engine.md` 에 존재하지 않는 섹션 번호(`§1.6`)를 대상으로 지정하고 있어 실제 반영 시 작업자가 잘못된 위치를 탐색할 위험이 있으며, 올바른 대상은 `§2.1` 임을 확인했다. 두 항목 모두 기존 spec 과의 직접 모순(CRITICAL)은 없고, 이 draft 를 그대로 채택해도 기존 spec 의 작동 불가를 초래하지 않는다.

## 위험도

LOW
