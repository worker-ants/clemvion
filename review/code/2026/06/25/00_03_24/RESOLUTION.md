# Review Resolution — 03 C-2 1차 (executeSingleTurn setup 분해)

리뷰 SUMMARY: `review/code/2026/06/25/00_03_24/SUMMARY.md`
**위험도 LOW · Critical 0 · Warning 2 · INFO 18.** 12 reviewer 전원 success.

## 반영 (Addressed)

| # | 카테고리 | 조치 |
| --- | --- | --- |
| W-1 | requirement | `buildSingleTurnMessages` 의 §6.1 단계 오기재 "1.5·1.7" → **"1.7"** (JSDoc + caller 주석). spec §6.1 실제 단계 확인: 1.7=ai_user push, 1.3/1.5=memory(별 메서드). refactor 핵심 목표(spec 추적성) 정확화. |
| W-2 | testing | `ai-turn-executor.spec.ts executeSingleTurn` 에 §11.4 ordering 분기(KB `[Knowledge Base]`·condition `[조건 안내]`·presentation `[Presentation Tools]`) executor-level 테스트 추가 — system 프롬프트 조립을 핸들러 spec 간접 커버 대신 직접 고정 + ordering 인덱스 단조 단언. (116 pass) |
| INFO-5 | maintainability | `applySingleTurnMemoryInjection` 명시 반환 타입 추가 (`Promise<{messages·finalSystemPrompt·memoryMeta·singleTurnInjection}>`, singleTurnInjection 은 `ReturnType<AiTurnExecutor['injectThreadContext']>`) — 세 메서드 간 타입 일관성. |
| INFO-6 | maintainability | args 타입 블록 내 `//` memoryStrategy 주석을 JSDoc 본문으로 이동. |
| INFO-8 | requirement | `applySingleTurnMemoryInjection` JSDoc "1.3·[5]" → **"1.3·1.5"** ([5]=§11.4 ordering 의 thread injection = §6.1 1.5 와 동일 대상; 단계번호 체계 통일). |
| INFO-9·16 | requirement/doc | caller 주석에 실행순서 역전(1.7 → 1.3/1.5) 근거 명기: `ai_user` push 가 먼저여도 `getThreadExcludingNode` 가 self 제외라 주입 결과 동일(원본 보존, 회귀 없음). |
| INFO-14·15 | documentation | `appliedScope:'none'` 근거 인라인 주석 + `pushAiThreadTurn` 호출부 주석(단계 1.7) 복원. |

## 보류 (Deferred — 근거 명시)

| # | 카테고리 | 사유 |
| --- | --- | --- |
| INFO-1 | architecture | `buildSingleTurnMessages` 의 ai_user push side-effect(CQS) — JSDoc 에 명시했고(rename 은 호출부 가독성 트레이드오프), 원본 동작 보존이라 rename 보류. |
| INFO-2 | architecture | args 9필드 ISP — 향후 named value object. 본 슬라이스 범위 밖. |
| INFO-3·10 | architecture/side_effect | `let` 재할당 파이프라인 ordering 의존 — JSDoc/주석으로 의존성 설명 유지(반환타입 명시로 caller 갱신 강제도 문서화). 구조 변경 불요. |
| INFO-4 | architecture | tool-loop 응집도 잔류 — **2차 PR(processMultiTurnMessage 분해 + executeSingleTurn tool-loop)** 의 명시 범위. |
| INFO-7 | maintainability | `maxToolCalls \|\| 10` 매직넘버 상수화 — **M-2 가 건드리지 않은 선재 코드**(executeSingleTurn 본문, 본 추출과 무관). 별도 grooming. |
| INFO-11·12·13 | testing | ai_user push 호출순서·빈 prompt 엣지·chat messages 내용 단언 — 신규 ordering 테스트가 핵심 경로 커버. 추가 엣지는 백로그. |
| INFO-17 | performance | `new Date()`/`Date.now()` 분산 — 기존 패턴, 기능 무관. |
| INFO-18 | scope | review/ 산출물 EOF 개행 — 산출물 생성 스크립트 영역, 본 코드 PR 무관. |

## 재검증

review-fix 후: prettier clean, ai-turn-executor+handler 116 pass. lint·build(full tsc — 명시 반환타입/ReturnType 검증)·unit 재수행 (결과 커밋 반영). production 변경은 JSDoc/주석/반환타입 명시(런타임 동작 불변)이라 직전 e2e 214 유효.
