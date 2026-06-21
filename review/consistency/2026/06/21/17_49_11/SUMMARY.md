# Consistency Check 통합 보고서 (impl-done)

**BLOCK: NO** — Critical 발견 없음, 차단 불필요.

> 모드: `--impl-done spec/4-nodes/4-integration` (diff-base origin/main, M-2 코드 커밋 `21ecd609` 까지 포함).
> 판정: M-2 strategy 분리는 spec-impl 정합 위배 없음. WARNING 4건은 전부 **대상 spec 영역 자체의 기존 정합성 사안**(planner 도메인)이며 M-2 변경과 무관. INFO I-6/I-7 이 명시: "M-2 는 codebase-only refactor 이며 `spec/2-navigation/4-integration.md` Rationale line 1311 이 구현 재량으로 사전 허용", "`refreshToken` 인터페이스 제외가 spec Rationale 와 충돌 없음 — refreshToken 책임이 `*-api.client.ts`·cafe24-token-refresh 큐 processor 에 위치".

## 전체 위험도
**MEDIUM** — WARNING 4건(spec 내 규약 불일치 2, 출력 포트 수 불일치 1, 에러 코드 surface 상충 1). 기능 차단 수준 아님. **전건 M-2 비차단 — 별건 planner spec 정합 작업 대상.**

## Critical 위배
해당 없음.

## 경고 (WARNING) — 전부 기존 spec 영역 사안 (M-2 무관)

| # | Checker | 위배 | 제안(planner) |
|---|---------|------|------|
| W-1 | Cross-Spec | `database_query`·`send_email` 출력 포트 수가 `0-overview.md §2.4` 카탈로그(구 상태 `1`)와 불일치 | overview 칸 `2 (success/error)`·`2 (out/error)` 로 갱신 |
| W-2 | Cross-Spec | `INTEGRATION_SERVICE_UNAVAILABLE` surface 경로가 `0-common.md`(error 포트) vs `3-send-email.md`(EMAIL_SEND_FAILED 흡수) 상충 | 예외 주석/역참조 명시 |
| W-3 | Convention | `send_email` 성공 포트 `'out'` 이 `node-output.md` Principle 5 단일 출력 모델과 모순 | Principle 5 정정 또는 §5.1 port 정정 |
| W-4 | Convention | `output.rowCount` 위치가 Principle 2(`meta.rowCount`) vs Principle 8.2(`output.rowCount`) 내부 충돌 | 규약 내부 모순 해소 |

## 참고 (INFO) — 11건
- I-6/I-7: **M-2 정합 확인** (codebase-only refactor·spec 재량 허용·refreshToken 책임 위치 정합) — 조치 불필요.
- I-1/I-2/I-10/I-11: Cafe24/MakeShop·INTEGRATION_*·EMAIL_HOST_BLOCKED 에러 코드 카탈로그 등재 불완전(기존 사안).
- I-3/I-4/I-5: 문서 구조·명명 일관성(기존).
- I-8/I-9: 진행 중 plan 항목과 정합(비차단).

## Checker별 위험도
| Checker | 위험도 |
|---------|--------|
| Cross-Spec | MEDIUM |
| Rationale Continuity | NONE (M-2 codebase-only, 기각 결정 보존) |
| Convention Compliance | MEDIUM (규약 자체 정비 선결) |
| Plan Coherence | NONE |
| Naming Collision | LOW (신규 식별자 충돌 없음) |

## 결정
**BLOCK: NO.** M-2 spec-impl 정합 확인. WARNING 4건은 전부 기존 spec 영역 정합 사안으로 project-planner 별건 처리 대상(M-2 PR 비차단).

> ⚠️ summary_written=false — main 이 `summary_markdown` 으로 멱등 persist.
