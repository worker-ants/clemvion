# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**MEDIUM** — Critical 1건(파일 미존재)과 WARNING 9건. 핵심 설계 변경(per-node 모델 폐기 → execution-level intake 큐)은 기존 spec 과 직접 모순 없음. 에러 코드 의미 충돌과 식별자 불일치가 구현 시 실제 문제를 유발할 수 있어 반영 전 해소 필요.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `plan/in-progress/spec-draft-exec-intake-queue.md` 파일이 실제 저장소에 존재하지 않음(untracked). plan-lifecycle 가드 동작 불가 | 문서 전체 | `plan-lifecycle.md §1` | 파일 commit 후 재실행 |

## 경고 (WARNING)

1. **Naming** `EXECUTION_TIMEOUT` 의미 충돌 — Code 노드 스크립트 타임아웃에 이미 사용 중. 엔진 레벨은 `EXECUTION_TIME_LIMIT_EXCEEDED` 로 분리.
2. **Naming** `triggerKind` 값 `trigger` 가 `Trigger.type`(webhook/manual/schedule)과 불일치. 기존 어휘로 통일.
3. **Cross-Spec** §7.1 heartbeat 표현 폐기 — spec 반영 시 §7.1 전체를 stalled-job 으로 재작성.
4. **Cross-Spec** §7.2 "미완료 태스크(노드)" per-node 뉘앙스 — "active 세그먼트 job" 으로 정정.
5. **Cross-Spec** §8 timeout 기준 명시 — active-running 누적 명문화.
6. **Rationale** stalled-job 일원화 결정 근거 미기재 — Rationale 단락 추가.
7. **Plan Coherence** `spec-sync-execution-engine-gaps.md` §4·§7.1·§8 TODO 무효화 — 폐기/forwarding 처리.
8. **Plan Coherence** 0-overview §Rationale 수정 시 경쟁 worktree 머지 충돌 위험 — 의존 메모.
9. **Convention** frontmatter `owner` 필드 — plan-lifecycle §4 스키마 확인(worktree/started/owner 명시되어 있어 유효, 단 checker 이견 기록).

## 권장 조치 (요약)
1. (Critical) draft 파일 commit 후 재실행.
2~6. WARNING 1~8 을 draft 에 반영.
7. spec 반영 시 §2.4/§2.6/§9.3/§11, 1-data-model §2.13 동시 갱신.

> 본 SUMMARY 는 main 이 멱등 persist (workflow terminal write 가 write_blocked 였음).
