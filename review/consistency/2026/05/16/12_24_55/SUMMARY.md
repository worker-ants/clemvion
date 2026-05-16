# Consistency Check 통합 보고서 — data-model install_token follow-up draft

**BLOCK: NO (draft self-correcting)**

cross_spec 의 Critical 2건은 본 draft 가 정확히 정정하는 spec/1-data-model.md §2.10 의 두 행 (install_token / install_token_issued_at) drift 자체다. draft 적용 시 동시 해소.

- 대상: `plan/in-progress/spec-draft-data-model-install-token-followup.md`
- 모드: spec draft 검토 (--spec)
- 검토 일시: 2026-05-16T12:24:55
- Checker: 5/5 success

## Critical (draft 적용 시 해소)

| # | Checker | 항목 | draft 해소 |
|---|---------|------|------------|
| 1 | cross_spec | `install_token` "callback 성공 시 NULL" 표기 잔존 | 변경 1 로 "callback 성공 시 보존, TTL 만료/삭제 시에만 NULL" 로 정정 |
| 2 | cross_spec | `install_token_issued_at` "callback 성공 시 NULL" 표기 잔존 | 변경 2 로 "callback 성공 시 보존" 로 정정 |

## INFO

| # | Checker | 항목 | 조치 |
|---|---------|------|------|
| 1 | cross_spec | 직전 머지 spec (`spec/2-navigation/4-integration.md`, `spec/data-flow/integration.md`) 가 보조 코퍼스에 직접 포함되지 않음 — draft 의 "완전 일치" 주장은 직접 본문 확인 필요 | 직전 commit 의 spec 변경 본문이 동일 정책 명시 (이미 확인 — `commit pending`) |
| 2 | convention_compliance | 표 행의 줄바꿈 다소 길어 가독성 저하 가능 | draft 신청 그대로 유지 — 단일 행 가독성은 spec 컨벤션 위반 아님 |
| 3-5 | plan_coherence | 활성 worktree 간 spec 경합 (`cafe24-w2-spec-d9f2a3` 등) | merge coordinator 가 시점별 조율 |

## 결론

draft 의 변경 1, 2 를 `spec/1-data-model.md` 에 즉시 반영. 후속 spec write 진행 가능.
