# Code Review 처리 (RESOLUTION)

대상: refactor 03 m-1 — 서비스 console.* → NestJS Logger + no-console 가드
리뷰: `review/code/2026/06/25/23_51_54/SUMMARY.md` (Risk LOW, Critical 0, Warning 2)
구현 커밋: `980b6375` · review-fix 커밋: `8378bd18`

## 요약
Critical 0. Warning 2(Testing) 전부 반영. INFO 12건은 planner 위임/plan 정리/수용.

## Warning (2건) — 전부 반영 ✅

- **W1 [Testing] ✅** `telegram-message.renderer.spec.ts` — `visualNode='photo'`(v1 미지원) 분기가 `Logger.prototype.warn` 을 호출하고 text fallback 하는지 검증하는 케이스 추가. 본 PR 이 도입한 logger.warn 경로 계약 잠금.
- **W2 [Testing] ✅** `mcp-test-connection.service.spec.ts` — MCP_CONNECT_FAILED 케이스에 `Logger.prototype.warn` spy + 인수 `[mcp:test] MCP_CONNECT_FAILED` 포함 assertion 추가. logInternal → Logger.warn 경로가 실수로 제거돼도 잡히도록.

## INFO (12건) — 처분

- **I-1 [SPEC-DRIFT] 보류(planner)** ai-agent §6.2.c.fallback·presentation 0-common spec 의 console.warn 처방 stale(코드 무관) → plan §m-1 planner 위임 묶음(impl-prep W-1~4 와 동일).
- **I-2·I-3 [Architecture] 수용** 순수함수 모듈/Injectable 의 모듈·직접 Logger 생성 — 리뷰어 "현 단계 수용". 장기 LoggerService 주입은 별건 후속.
- **I-4 [Architecture] 수용** scripts/** glob 면제 — scripts=CLI 독립 실행 전용(현 상태 명확).
- **I-5 [Maintainability] 수용** eslint.config.mjs prettier 따옴표 변경 — 자동 포매터 noise(기능 무관).
- **I-6 [Maintainability] 수용** code.handler inline disable 3회 — 각 사유(env 검증 2 / module-load IIFE 1)가 미세히 달라 개별 유지가 명확.
- **I-7 [Maintainability] 수용** mcp-test `[mcp:test]` prefix — operation 태그(Logger context 와 별개 정보), 유지.
- **I-8·I-9 [Testing] 수용** node-handler assertion('executionMetadata')·language-hint 접근 패턴 — 현행 통과·견고. 선택적 단순화는 미적용(범위 최소화).
- **I-10 [Requirement] plan-update 반영** plan §m-1 audit-logs:85 stale(이미 전환) → plan 갱신 시 제거 + telegram :416→:427.
- **I-11 [Security] 수용** 테스트 no-console off — 팀 규약(테스트 시크릿 미출력) 유지.
- **I-12 [Side Effect] 의도** main.ts bootstrap 로그 NestJS Logger 형식 변경 — §6.2 정합 의도된 변경.

## 미완 reviewer
없음(forced 6 전원 success, scope·side_effect 포함 NONE).

## 검증
review-fix 후 lint·build·unit PASS. 영향 spec 54 tests, backend 전건 PASS. e2e 는 환경 Docker 레지스트리 아웃티지로 다른 머신 위임.
