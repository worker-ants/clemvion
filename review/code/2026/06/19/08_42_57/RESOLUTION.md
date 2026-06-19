# RESOLUTION — C-1 후속 ③ (LLM 타입통합)
type-only 통일(`f70dbbfa`). ai-review `08_42_57` (LOW·C0·W2). 추가 codebase 변경 없이 dispositioning 수렴.
## 조치 항목
| # | 분류 | 근거 |
|---|---|---|
| W1 (ai-agent inline 미전환) | 이연(follow-up) | plan 범위 = EE+IE 명시(ai-agent 미포함). ai-agent inline 은 앞 3필드 required stricter subtype — shared all-optional 로 전환 시 향후 필수필드 누락 push 허용(loosen). 별도 PR 에서 read-handling 평가 후 전환. **type-consolidation 후속과 묶어 추적.** |
| W2 (requestPayload 클라 노출) | 이연(pre-existing) | reviewer 명시 "이번 PR 신규 도입 아님". 통합 타입이 JSONB→WS 경로를 명시화할 뿐 — 행위 무변. WS emit 필터링/관리자 채널 분리는 별도 보안 grooming. |
| INFO (shared index.ts·optional 폴백·IE shape 테스트·lastResponse 등) | 수용/선택 | 전부 선택적 또는 pre-existing. interface 라 단위테스트 불요. |
**신규 Critical/Warning 0**(둘 다 pre-existing/범위밖·회귀 아님). impl·test 무변.
## TEST 결과
- lint ✓(eslint --fix, 변경 3파일 0 issue) · unit ✓(execution-engine 33s/822; information-extractor 71; ai-agent 420) · build ✓(tsc clean; required→optional 전환 narrowing 불요) · e2e ✓(dockerized 34/202; type-only 라 컴파일 산출물 무변)
## 보류·후속
- ai-agent inline → shared LlmCallRecord 전환(W1) + StructuredInteraction/PresentationInteractionPayload(item⑤) → **type-consolidation 후속**으로 묶음.
- requestPayload WS 노출(W2) → 보안 grooming.
