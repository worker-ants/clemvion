---
worktree: conventions-code-data-9b32d5
started: 2026-06-03
owner: project-planner
---

# spec-draft: Code/Data 노드 conventions 정합화 (Principle 7/8.2 + meta + 포트수)

> 출처: `review/consistency/2026/06/03/08_50_44/SUMMARY.md` (impl-prep, BLOCK Critical 2건 + WARNING).
> code-node 구현(timeout/$node/$helpers) 착수 전 발견된 **기존 conventions drift** 를 정합화. 구현과 직교.

## 변경 (이미 worktree spec/ 에 적용)

### Critical 해소
- [x] **Principle 7 (`node-output.md`)** — `code.config.code` 를 "절대 echo 금지" → "항상 echo" 목록으로 이동 + 명확화 노트. 근거: 코드 본문은 `systemPrompt`/`userPrompt`/`body` 와 동일 부류의 사용자 작성 raw 텍스트로 echo 됨(구현·`2-code.md §5.1`·`0-common.md §4 line54`·테스트 모두 일치). `expression-exclusions` 등록은 "평가 제외"이지 "echo 금지"가 아님 — 혼동 정정.
- [x] **Principle 8.2 (`node-output.md`)** — "코드 실행 결과 → `output.result`" 행을 "root 직접 배치 (Code/Transform 은 output.result 미적용)" 로 정정. 하단 규칙도 "output.result 래핑은 LLM 계열 한정" 으로 명확화. 근거: `2-code.md §5.1` 이 사용자 return 값을 root 에 직접 둠(의도적, Principle 8 래핑 예외). 표 행 vs LLM 한정 규칙 내부 모순 해소.
- [x] **`2-code.md` `## Rationale` 신설** — config.code echo + output root 배치 결정 근거·기각 대안 명문화.

### WARNING 해소
- [x] **Principle 2 (`node-output.md`)** — Code meta 행에서 폐기된 `meta.error?`/`meta.errorCode?` 제거 (Phase 1 D 에서 `output.error`+`port:error` 로 이관됨, 핸들러·테스트가 별칭 미방출 확인).
- [x] **`0-common.md §4`** — Code meta 기술을 `{success, logs?}` 로 정정 (동일 사유).
- [x] **`spec/4-nodes/0-overview.md §2.5`** — `code` 출력 포트 수 `1` → `2` (success/error, `2-code.md §3.2` 와 일치).
- [x] **`0-common.md §5` 색인 (INFO #9)** — Code 행 pre-flight 참조 `§5.8` → `§6` 깨진 앵커 정정.

## 잔여 (별도 추적 — 본 PR scope 밖 INFO)

- [ ] `node-output.md` 말미 `## Rationale` 섹션 신설 (Principle 7·8.2 번복 경위 + `meta.error` 폐기 경위 통합) — 현재 인라인 박스 + `2-code.md §Rationale` 로 분산 기록됨 (INFO #4/#5).
- [ ] `node-output.md §3.2.2` Code details 스키마(`legacyCode`) 등재, `3-error-handling.md §1.4` `CODE_MEMORY_LIMIT(로드맵)` + `CODE_TIMEOUT←EXECUTION_TIMEOUT` 연원 등재 (INFO #5/#10).
- [ ] `0-common.md`/`1-transform.md` `## Rationale` 섹션 신설, `id: common` 다중정의 스코핑 (INFO #2/#3).

## consistency-check 결과 (`review/consistency/2026/06/03/09_11_20`)

**BLOCK: NO** — Critical 0. 정합화가 impl-prep 의 Critical 2건(rationale_continuity HIGH→LOW)을 해소. WARNING 1건은 `node-output-redesign` plan 의 spec 체크박스가 본 변경으로 무효화 → **target 머지 후** `code.md`/README 동기화 (code-node 구현 task 에서 함께 처리). 즉시 수정 가능한 INFO(#9 깨진 앵커, #6/#7 체크박스, #1 경로)는 반영 완료.

## Rationale

모두 **신규 정책 아님 — 기존 구현/spec 본문과 conventions 메타문서 간 drift 정합화**. 데이터 모델·API·상태 전이 변경 없음. impl-prep checker 가 제시한 권고를 그대로 적용. 이로써 code-node 구현(timeout schema + $node/$helpers)의 impl-prep Critical 이 해소되어 구현 재개 가능.
