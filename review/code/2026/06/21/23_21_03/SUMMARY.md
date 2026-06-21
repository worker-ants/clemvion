# Code Review 통합 보고서

대상 커밋: `c82b4a03` — test(ai-agent): M-1 3단계 ai-review 보강 — capFormDataBytes·form_submitted resume 직접 테스트

---

## 전체 위험도

**LOW** — production 코드 무변경(additive 테스트 보강만). Critical 발견 없음. **WARNING 0.** INFO 수준 개선 사항만 존재. → **수렴 (Critical 0 / WARNING 0).**

---

## Critical 발견사항

없음.

---

## 경고 (WARNING)

없음.

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | spec frontmatter `code:` 에 `ai-turn-executor.ts` 미등재 (기존 deliberate-defer, planner 위임) | `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter | 세 파일 등재 (project-planner 위임) |
| 2 | Testing | `capFormDataBytes` zero-budget clamp 분기·복수 string 필드 균등 배분 케이스 미커버 | `ai-turn-executor.spec.ts` | 2건 추가 권장 (선택적·차기) |
| 3 | Testing | `form_submitted` resume `ai_message bypass(cancelled)`·toolCallId 불일치 fallback 경로 미커버 | `ai-turn-executor.spec.ts` | bypass·fallback 테스트 2건 추가 권장 (선택적·차기) |
| 4 | Testing | `form_submitted` 테스트가 splice replace 가 아닌 push append 경로로 동작 (주석/명칭과 실행 경로 불일치) | `ai-turn-executor.spec.ts` | tool stub 추가로 replace 경로 실행 또는 주석을 append 검증으로 수정 (선택적·차기 nit) |
| 5 | Testing | `resolveRetryStateTtlMinutes` env 직접 테스트 미포함 | `ai-turn-executor.spec.ts` | RESOLUTION.md I#9 defer 근거 기록됨 (module-private fn) |
| 6 | Testing | `baseContext` 공유 참조 — 테스트 간 오염 잠재 위험 (pre-existing) | `ai-turn-executor.spec.ts` | immutable 사용이라 실질 무해, 선택적 |
| 7 | Testing | UTF-8 멀티바이트 테스트 — `formDataTruncation` defined·길이 감소 미검증 | `ai-turn-executor.spec.ts` | 선택적 보강 |
| 8 | Maintainability | 픽스처 `llmConfigId: 'cfg-1'` vs mock `id: 'config-1'` 불일치 이유 불명확 | `ai-turn-executor.spec.ts` | 인라인 주석/상수 통일 (선택적) |
| 9 | Maintainability | 비-string-only 배열 크기 `4000` 근거 주석 부재 | `ai-turn-executor.spec.ts` | 주석 추가 (선택적) |
| 10 | Side Effect | `capFormDataBytes` 신규 export — `@internal` 표기 권장 | `ai-turn-executor.ts` | JSDoc `@internal` 추가 (선택적) |
| 11 | Security | `sanitizeToolError` URL/credential 마스킹 미구현 (pre-existing, RESOLUTION.md I#3 defer) | `ai-turn-executor.ts` | 별건 보안 개선 |
| 12 | Security | `resolveRetryStateTtlMinutes` TTL 상한 clamp 없음 (pre-existing, RESOLUTION.md W#2/I#4 defer) | `ai-turn-executor.ts` | 별건 (W#2 DI 와 함께) |
| 13 | Documentation | `capFormDataBytes` `@example` 미보강 (테스트 4건으로 사실상 대체) | `ai-turn-executor.ts` | 선택적 |
| 14 | Documentation | `AI_RETRY_STATE_TTL_MINUTES` 중앙 env 목록 미등록 (pre-existing, RESOLUTION.md I#12 planner defer) | `ai-turn-executor.ts` | planner 후속 |
| 15 | Documentation | 세 공개 메서드 JSDoc 부재 (C-2 defer) | `ai-turn-executor.ts` | C-2 후속 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 보안 위험 없음. pre-existing(sanitizeToolError, TTL 상한) 전부 deliberate-defer |
| requirement | LOW | SPEC-DRIFT(frontmatter code:) 잔존. form_submitted 테스트 push vs splice 경로 의도 불일치(INFO) |
| scope | NONE | 커밋 범위 이탈 없음. review/ 산출물 동봉은 규약 의무 |
| side_effect | NONE | 신규 부작용 없음. `capFormDataBytes` export `@internal` 권장 |
| maintainability | LOW | 픽스처 상수 불일치·배열 크기 근거 주석 (INFO) |
| testing | LOW | capFormDataBytes/form_submitted 추가 케이스 (선택적·차기) |
| documentation | NONE | 신규 테스트 문서화 양호. 잔존은 전부 기존 defer |

---

## 수렴 판정

- **Critical 0 / WARNING 0** — 본 fresh review(resolution 후속, 대상 커밋 `c82b4a03`)는 수렴.
- INFO 15건 전부 비차단: ⓐ planner-only(#1,#14), ⓑ C-2 후속(#15), ⓒ pre-existing 보안 defer(#11,#12), ⓓ optional 테스트 nit(#2~#10,#13). RESOLUTION.md(23_06_04) 에 분류·근거 기록.
- INFO #4(form_submitted 테스트 주석 vs append 경로)·#10(@internal) 은 production 영향 0 의 테스트/주석 nit — 추가 폴리시 루프 회피(메모리: Critical/Warning 0 시 INFO 비차단 수렴), 차기 정리 후보.

---

## 라우터 결정

라우터 선별 실행. **실행**(7명, 전원 router_safety 강제): security, requirement, scope, side_effect, maintainability, testing, documentation. **제외**(7명): performance·architecture·dependency·database·concurrency·api_contract·user_guide_sync (additive 테스트 보강 커밋 — production 무변경).
