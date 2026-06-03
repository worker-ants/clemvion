# RESOLUTION — AI Agent 자동 메모리 코드 리뷰

대상 리뷰: `review/code/2026/06/03/23_11_51/SUMMARY.md` (코드 범위, 전 14 reviewer, CRITICAL 0 · WARNING 5)
+ 1차 spec 리뷰(`22_58_44`, router 오판으로 spec만 봄)의 코드 적용 보안 발견(W-1/W-2) 합산.

## 조치 항목

| 리뷰 # | 발견 | 조치 | commit |
|---|---|---|---|
| 23_11_51 W-1 | summary_buffer multi-turn 단위 테스트 미작성 | `ai-agent.memory.spec.ts` 에 summary_buffer+multi_turn(예산초과→runningSummary 저장→2턴 재사용) 케이스 추가 | `eae813d4` |
| 23_11_51 W-2 | selectVolatileTail 빈 배열 엣지 미검증 | `agent-memory-injection.spec.ts` 빈/전체커버 엣지 케이스 추가 | `eae813d4` |
| 23_11_51 W-3 | recall 실패 핸들러 graceful 미검증 | 핸들러 recall try/catch + `mockRejectedValue` graceful 테스트 | `eae813d4` |
| 23_11_51 W-4 | 크로스 워크스페이스 격리 명시 테스트 부재 | `agent-memory.service.spec.ts` `recall('ws-2')` params 격리 검증 | `eae813d4` |
| 23_11_51 W-5 | stripMemoryBlocks round-trip 미검증 | append 2회 후 블록 1개(중첩 누적 방지) round-trip 테스트 | `eae813d4` |
| 22_58_44 W-2 (보안) | persistent 추출 content → systemPrompt indirect prompt injection | `wrapMemoryContent` [memory] 데이터 펜스 + 가이드 + escape, saveMemories jailbreak 필터 | `eae813d4` |
| 22_58_44 W-1 (보안) | memoryKey→scope_key 길이/제어문자 미검증 | `sanitizeScopeKey` 제어문자 제거 + 512자 상한(SHA-256 축약) | `eae813d4` |

### 미채택(근거)
- 22_58_44 C-1 "17-agent-memory.md 초안 수준"(Critical): **FP** — 파일 106줄 완성·전 섹션 존재. router 가 변경을 spec-only 로 오판해 코드 미리뷰한 1차 산출의 주관적 오판. 코드 범위 재리뷰(23_11_51)에서 Critical 0 확인.
- 22_58_44 W-4~W-13 (spec 문서 cross-ref/dead-anchor/중복): spec 보완 항목. 본 PR 의 핵심(구현)과 분리, 경미. 후속 항목으로 분류(아래).

## TEST 결과
- lint: 통과 (`lint-20260603-232832`)
- unit: 통과 — backend 5750 passed / 0 failed. frontend 는 `spec-frontmatter.test.ts` 의 cafe24-api-catalog 444건만 실패하나 **pre-existing**(origin/main 동일, 본 브랜치 카탈로그 0 변경, `resource/entity` frontmatter 스키마라 `id` 미보유) — 본 변경 무관.
- build: 통과 (`build-20260603-233007`)
- e2e: 통과 — 144 passed (`e2e-20260603-233054`). Flyway V071~V077 마이그레이션 docker 실행 검증.

## 보류·후속 항목
- spec 문서 보완(1차 W-4/7/8/9/11/12/13, impl-done W-3 §7 echo, SPEC-DRIFT I-11 §7 v3): `plan/in-progress/ai-context-memory-followup-v2.md` 로 이관(소규모 spec 정밀화).
- persistent + BullMQ 추출 e2e 시나리오(중기): followup-v2.
- 멀티턴 누적 messages 물리 축소(현재 요약 additive): followup-v2 기재.
