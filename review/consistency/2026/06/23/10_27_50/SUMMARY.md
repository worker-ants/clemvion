# Consistency Check 통합 보고서 (--impl-done spec/7-channel-web-chat/)

**BLOCK: NO** — Critical 0. SPEC-CONSISTENCY 게이트 통과.

검토 모드: `--impl-done` · 일시: 2026-06-23

## 전체 위험도
**LOW** — 구조적 모순 없음. 문서 동기화/배포 문서화 WARNING, plan 체크박스 미갱신.

## Critical
없음.

## WARNING — 처분
| # | Checker | 위배 | 처분 |
|---|---|---|---|
| W-1 | Convention | NAV-WC-01~06 상태 전부 🚧 방치(구현 후) | **fix** — NAV-WC-01~05 ✅, 06(미리보기) 🚧 partial |
| W-2 | Convention | §2 트리 `Web Chat — 🚧 (계획)` 불일치 | **fix** — 🚧 (partial) 로 |
| W-3 | NamingCollision | `NEXT_PUBLIC_WIDGET_CDN_BASE` `.env.example` 미등록 | **fix** — .env.example 주석 추가 |
| W-4 | PlanCoherence | plan Phase 0 체크박스 5건 `[ ]` 방치(완료됨) | **fix** — `[x]` |
| W-5 | PlanCoherence | Phase 3 boot config 전달 메커니즘 미정의 | **이미 등록** — plan Phase 3 선결 항목 |

## INFO — 처분
- I-1: EIA §14 line169 `authType` 잔존 — **선재 grooming**(내 변경 무관), 별도.
- I-2: `0-overview §6.2` 콘솔 구현 미반영 — **fix**(간단).
- I-3: `5-admin-console` pending_plans 정리 — plan 진행 중이라 보류(완료 시).
- I-4: `use-web-chat.ts` `per_trigger` 유니언 — **fix**(주석: 콘솔은 per_execution 만).
- I-5: nav `_product-overview` 헤더 스펙 맵에 Web Chat 링크 — **fix**(간단).
- I-6: spec-draft fallback 이력 — draft(계획 산출물) 보류.

## 처리
spec/plan grooming(W-1·2·4, I-2·5) + 사소 codebase(W-3 .env.example, I-4 주석) → lint/unit 재통과 → 종결.
W-5 는 Phase 3(증분2) 선결로 기 등록. I-1·I-3·I-6 보류(선재/계획 산출물).
