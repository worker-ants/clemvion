# Consistency Check 통합 보고서 (--impl-done, 최종)

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

검토 모드: `--impl-done spec/7-channel-web-chat/` (HEAD 7bba45cbd, base origin/main)
일시: 2026-06-28 01:40:10

## 전체 위험도
**LOW** — WARNING 1건(spec frontmatter `code:` 명시성)이나 기능·가드 영향 없음(glob 커버). 나머지 4 checker NONE.

## Critical 위배
없음.

## 경고 (WARNING)

| # | Checker | 위배 | 처리 |
|---|---------|------|------|
| W-1 | Convention | `3-auth-session.md` frontmatter `code:` 에 `use-token-refresh.ts` 미명시(spec-impl-evidence §2.1 specificity) | **비차단** — 0-architecture `codebase/channel-web-chat/**` glob 이 커버해 `spec-code-paths.test.ts` 가드 통과(checker I-3 도 "가드 위반 없음" 확인). 명시 추가는 **planner spec frontmatter polish followup**(developer 는 spec read-only). 동작/계약 영향 0 |

## 참고 (INFO) — 비차단
- I-1: W-1 과 동일 사안(planner followup). I-3: 1-widget-app `code:` 에 use-pending-message-queue.ts 명시 권장(glob 커버, 선택).
- I-2: use-widget re-export 계약 충돌 없음. I-4/I-5/I-6: 큐 gating·토큰 갱신 불변식·SessionRef alias·scheduleRefresh 직접호출 모두 동작 동등(추출 전후 보존). I-7: backlog §B [x] 정합. I-8: 신규 타입 file-local 충돌 없음.

## Checker별 위험도

| Checker | 위험도 | 핵심 |
|---------|--------|------|
| Cross-Spec | NONE | spec 6문서 교차 이상 없음 |
| Rationale Continuity | NONE | 큐 gating·토큰 갱신 타이머·cancelled guard 불변식 추출 전후 보존 |
| Convention Compliance | LOW | W-1 frontmatter 명시성(glob 커버, 가드 통과) |
| Plan Coherence | NONE | B1 plan↔spec(implemented) 정합 |
| Naming Collision | NONE | 신규 타입·식별자 충돌 없음 |

## 권장 조치사항
1. **(planner spec polish followup, 비차단)** `3-auth-session.md`·`1-widget-app.md` frontmatter `code:` 에 신규 훅 파일 명시 — glob 커버로 가드 통과 상태라 비강제. backlog 등재.
