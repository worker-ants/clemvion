# Consistency Check 통합 보고서 (--impl-done, polish batch 최종)

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

검토 모드: `--impl-done spec/7-channel-web-chat/` (commit 4424bddfe, base origin/main)
일시: 2026-06-28 15:02:09 (직전 rate-limit 실패 후 재실행 성공분)

## 전체 위험도
**LOW** — 규약 WARNING 1건(비차단, pre-existing 파일명 패턴) + 비차단 INFO. Critical 없음. resetSession W-1 등 본 batch 도입 이슈는 직전 후속에서 해소 확인됨.

## 경고 (WARNING)

| # | Checker | 위배 | 처리 |
|---|---------|------|------|
| 1 | Convention | `embed-config.dto.ts` 파일명/클래스명이 `*-response.dto.ts`/`*ResponseDto` 패턴 미준수(swagger.md §5-1) | **defer** — **pre-existing**(본 batch 는 JSDoc 만 추가, 파일명 무변경). rename 은 파일·클래스·import·spec `code:` 동기화라 polish PR 범위·위험 초과. 별도 followup(또는 swagger.md 예외 등재). 기능 영향 없음, BLOCK: NO |

## 참고 (INFO) — 비차단
- I-1: NAV-WC-06 라이브 미리보기 표기 drift — 본 batch 의 0-overview 이동 **revert** 로 원상. NAV-WC-06 동기화는 별도 planner.
- I-2~I-7: workflow_id NOT NULL 명시·설치 스니펫 https 스킴·외형저장 번복 역참조·§R1↔§R5 역참조·frontmatter 주석 길이·_product-overview Overview — 전부 선택/pre-existing followup.
- I-8: plan 체크박스(본 후속 [x]). I-9: webchat-widget-refactor lifecycle(이미 #746 머지·complete 이동됨). I-10: safeApiBaseFromQuery 충돌 없음.

## Checker별 위험도
Cross-Spec LOW(표기 drift INFO) · Rationale NONE · Convention LOW(embed-config 파일명, defer) · Plan NONE · Naming NONE.

## 권장 조치사항
1. (defer/followup) embed-config.dto rename 또는 swagger.md §5-1 예외 등재 — pre-existing, 별도.
2. (별도 planner) NAV-WC-06 ↔ 0-overview 라이브 미리보기 상태 동기화.
3. (본 후속) plan 체크박스 [x] + complete 이동.
