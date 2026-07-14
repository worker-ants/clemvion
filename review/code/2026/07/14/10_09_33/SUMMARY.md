# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. AI Agent 도구 정의 payload 예산 가드레일(fail-fast)은 스펙·테스트와 line-level 로 정확히 일치하는 견고한 구현이나, 배포 시 기존 대형 도구셋 워크스페이스 breaking behavior change 공지, `executeSingleTurn` God Method 심화, 음수 env 오설정 시 AI Agent 노드 영구 차단 가능성 등 WARNING 9건 후속 조치 권장.

## Critical 발견사항
없음 (9개 reviewer 전원 CRITICAL 미보고).

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Maintainability/Architecture | `executeSingleTurn`(436줄 God Method)에 buildTools try/catch + config-echo 블록(~50줄) 인라인 추가 — 로컬 헬퍼 추출 관례 미준수 | ai-turn-executor.ts:1401-1554 | private 헬퍼 추출 |
| 2 | Architecture | 같은 클래스 두 메서드가 `ToolDefinitionPayloadExceededError` 에 다른 전파 계약(single=return, multi=throw) — 비대칭 확장 | ai-turn-executor.ts:1519-1554 vs :2609-2614 | JSDoc 에 공식 계약 문서화(후속 plan 인지됨) |
| 3 | Side Effect | 하드 예산 도입으로 기존 초과 도구셋 워크스페이스가 배포 즉시 error 포트 종결(feature flag 없음) breaking behavior change | tool-payload-budget.ts, ai-turn-executor.ts:3499 | 롤아웃 공지(의도된 fail-fast) |
| 4 | Maintainability | `singleTurnEnteredAt` vs 기존 `singleTurnStartedAt` 이름 혼동 | ai-turn-executor.ts:1409 vs :1560 | 개명 |
| 5 | Testing | 음수 env(`HARD_BYTES=-1`)가 `Number(x)\|\|fallback` 로 방어 안 됨 → 예산 "항상 실패" 고정, AI Agent 노드 영구 차단 위험. 가드·테스트 없음 | tool-payload-budget.ts readByteBudget | `Math.max`/`>0` 방어 + 회귀 테스트 |
| 6 | Testing | env=`'0'` → fallback 계약 미검증 | tool-payload-budget.spec.ts | `'0'` assertion 추가 |
| 7 | Testing | single-turn catch 의 rethrow(else) 분기 미검증 | ai-turn-executor.ts:1531-1552 | rethrow 테스트 추가 |
| 8 | Documentation | 신규 env 3종 `.env.example` 미등재(MCP_MAX_RESPONSE_BYTES 선례 위반) | codebase/backend/.env.example | 등재 |
| 9 | Documentation | CHANGELOG.md 미갱신(직전 6 PR 관례 이탈) | CHANGELOG.md | Unreleased 항목 추가 |

## 참고 (INFO)
1. Requirement: `toolProviderGroupKey` sid 분할이 sid 에 `__` 포함 시 culprit 오귀속(판정엔 무영향). 낮은 우선순위.
2. Side Effect: 예산 초과 error meta 에 mcpDiagnostics 미포함 — 다른 error 경로와 shape 불일치.
3. Requirement: 신규 error meta 가 §7.3 turnDebug 보다 얇음(pre-flight 특성). spec 주석 권고.
4. Requirement: ai-agent.md §10 저장 경고 미구현 인라인 표기 없음(cross-node-warning-rules 는 Planned 명시).
5. Maintainability: `readByteBudget` 이름이 byte 특정하나 count 파싱에도 재사용 → 범용 개명.
6. Maintainability: hard/soft 메시지 템플릿 중복 → 헬퍼 통합.
7. Maintainability: `buildTools` 의 throw 계약 JSDoc `@throws` 미명시.
8. Testing: 멀티턴 테스트명이 extractAiTurnErrorPayload 경유 암시하나 code 필드만 확인.
9. Testing: `pickCulpritProvider` 빈 perProvider → culpritProvider 키 생략 분기 미검증.
10. API Contract: env `0`(킬스위치) 이 `\|\|` 로 조용히 기본값 복귀 — 미문서화.

## 에이전트별 위험도
security NONE · architecture LOW · requirement LOW · scope NONE · side_effect LOW · maintainability LOW · testing LOW(48/48 통과) · documentation LOW · api_contract LOW.

## 권장 조치 (반영 계획)
1. (W5+INFO10) env 파싱 `Number.isFinite(n) && n > 0 ? n : fallback` 하드닝 + 음수/0 회귀 테스트(W6).
2. (W7) rethrow 분기 테스트.
3. (W8) .env.example 등재. (W9) CHANGELOG Unreleased 항목(+W3 behavior-change 노트).
4. (W4) `singleTurnEnteredAt` 개명. (W1) 신규 블록 private 헬퍼 추출. (W2) JSDoc 계약 문서화.
5. INFO5/6/7/9 opportunistic 반영.

## 라우터 결정
routing_status=done. 실행 9명(security/architecture/requirement/scope/side_effect/maintainability/testing/documentation/api_contract), router_safety 강제 7명 포함. 제외 5명(performance/dependency/database/concurrency/user_guide_sync — 무관 영역).
