# RESOLUTION — channel-web-chat 섹션2(W1~W5) + 섹션4(show/hide/updateProfile)

리뷰: `review/code/2026/06/03/10_10_09/SUMMARY.md` — RISK **MEDIUM**, Critical **0**, Warning **12**, INFO 13.
라우터가 spec-doc 위주로 6 reviewer 실행 → 발견은 전부 spec SoT/cross-ref/plan 추적 정제. **섹션4 위젯 코드(widget-state/use-widget/widget-app) 지적 0**. 조치: 수동(main).

## 조치 항목

| SUMMARY # | 카테고리 | 조치 | 위치 |
|---|---|---|---|
| W1·INFO4 | 아키텍처 | `blocked` 상태 정의 SoT = 1-widget-app §3.2 로 명시, 4-security §3-① 은 "정책 trigger" 로 역할 표기(단방향) | `4-security.md §3-①` |
| W2·rec7 | 아키텍처 | `0-architecture §4` 에서 env 키·함수명·경로 등 구현 세부 제거 → "SoT: 4-security §2·§2.1" 순수 cross-ref 만 | `0-architecture.md §4` |
| W3 | 아키텍처 | §3.2 도입부에 3개 레이어(가시성=UI / blocked=보안정책 / updateProfile=payload 변이) 구분 명시 | `1-widget-app.md §3.2` |
| W4 | 부작용 | **이미 충족** — `spec-frontmatter-parse.ts INCLUDE_PREFIXES` 동기가 동일 PR(commit 5)에 포함. frontend 가드 4 files/843 tests 통과로 실증 | (commit 5) |
| W5 | 부작용 | **이미 충족** — `plan/in-progress/channel-web-chat-demo.md` 실존 확인(본 PR 신설, in-progress) | — |
| W6 | 요구사항 | `2-sdk §R4 에 blocked 1줄 추가` 는 **의도적 미반영** — 직전 consistency-check(09_46_31 Warning #2)가 §R4(분리 근거 절) 부적합 판정. 대신 blocked 를 1-widget-app §3.2 + 4-security §3-① 에 배치(채택안과 일치) | (의도) |
| W7 | 요구사항 | EIA §5.2 역방향 cross-ref(`replay_unavailable`→위젯 타이머 교체)는 **cross-area(spec/5-system) follow-up 으로 분리** — 1-widget-app §3.1 에 forward TODO 는 이미 명기. project-planner 후속 | (follow-up) |
| W8 | 요구사항 | `3-auth-session.md pending_plans` 에 `channel-web-chat-demo.md` 등재(1-widget-app 은 기등재) | frontmatter |
| W9 | 요구사항 | **이미 처리** — `channel-web-chat-followups.md §4` 에 "✅ spec 설계 확정(2026-06-03)" 갱신(commit 4) | — |
| W10 | 유지보수 | §3.1 SSE 단락은 bold 라벨 유지(별도 `####` 소제목 미추가) — cross-ref 는 §3.1 앵커로 해소됨. minor, 미조치 | (minor) |
| W11 | 유지보수 | `3-auth-session §3` "새로고침 지속" 중복 bullet 을 "상세는 §3.1" cross-ref 로 축약 | `3-auth-session.md §3` |
| W12·INFO2 | 유지보수 | `spec-impl-evidence §1` 신규 항목 긴 인라인 괄호 제거 → 기존 항목과 스타일 통일 | `spec-impl-evidence.md §1` |
| INFO6 | 문서화 | `4-security §1` 요약표 임베드 allowlist 행에 "불일치 시 위젯 `blocked`" 추가 | `4-security.md §1` |
| INFO7 | 문서화 | `1-widget-app §3` 다이어그램 위에 "가시성 축·blocked 는 §3.2" 주석 추가 | `1-widget-app.md §3` |
| INFO9 | 문서화 | `4-security §2.1` 에 `codebase/backend/.env.example` 경로 명시 | `4-security.md §2.1` |

미조치(의도/사소): W6(의도적), W7(cross-area follow-up), W10(앵커 해소됨), INFO3/8/11/12/13(review 산출물 포맷·숫자 등 비-spec 본질). INFO5(plan §W3 `_product-overview` 표현)는 본 PR plan 노트라 영향 경미 — 미수정.

## TEST 결과

- lint: **통과** (channel-web-chat eslint 0 error — 본 조치는 spec/plan 만 변경, 코드 무변경)
- unit: **통과** (channel-web-chat vitest 134/134 — 직전 섹션4 커밋 기준 유지, 본 조치 코드 무변경)
- build: **통과** (직전 커밋에서 next build static export 확인, 코드 무변경)
- **frontend frontmatter 가드: 통과** (spec/7 INCLUDE_PREFIXES + 3-auth pending_plans 반영 후 4 files/**843 tests**)
- e2e: **보류** — 본 변경은 spec/plan 문서 + channel-web-chat 위젯(dev) + frontend 가드 helper(test) + backend `.env.example`(샘플, 런타임 무관)로 backend supertest e2e 에 신호 없음. 사용자 e2e 보류 승인(2026-06-03, 본 PR 데모 배치)과 동일 구조적 사유 — backend 무접촉. RESOLUTION 인용.

> 검증 스코프: 독립 패키지(channel-web-chat) + frontend 가드 테스트만 영향. 전체-monorepo run-test.sh 비채택(무관 backend/frontend 런타임·docker 재빌드).

## 보류·후속 항목

- **W7**: EIA `spec/5-system/14-external-interaction-api.md §5.2`(EIA-NF-03)에 "클라이언트 fallback >5분 로컬 타이머 — `replay_unavailable` 구현 시 위젯 타이머 교체 의무" 역방향 노트 — cross-area, project-planner 후속.
- **머지 충돌**: W3 spec-impl-evidence.md ↔ spec-sync-audit / W5 .env.example ↔ system-status worktree (사용자 충돌 감수 결정, 머지 시 수동 resolve).
