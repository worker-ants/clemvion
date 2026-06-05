# Code Review 통합 — A3 요약/추출 전용 LLM 모델 옵션

**BLOCK: YES** (fix 전) → 멀티턴 핵심 버그 1건. 7 reviewer fan-out.
대상: `origin/main..HEAD` (f761394a feat · 31e3effd 선존앵커fix). e2e(현재코드) PASS 168+, lint/unit/build PASS.

## Critical (반드시 fix)
| # | reviewer | 발견 |
|---|---|---|
| C1 | requirement(BLOCK:YES)·maintainability(CRITICAL)·side-effect·testing·scope 일치 | `summaryModel`/`extractionModel` 이 `multiTurnStateBase`(_resumeState, handler ~L2152-2191)에 미저장 → 멀티턴 turn2+ 에서 `state.summaryModel`/`config.extractionModel`=undefined → 노드 model 로 silent 폴백. **핵심 기능(전용 저비용 모델)이 멀티턴에서 무효**. 단일턴은 정상. |

**조치**: `multiTurnStateBase` 에 `summaryModel`/`extractionModel` 2줄 추가 + 멀티턴 turn2 전용모델 사용 단언 테스트.

## Warning / 정리
| # | reviewer | 발견 | 조치 |
|---|---|---|---|
| W1 | cross-spec/rationale | `1-ai-agent §12.12` 가 cross-link 한 `conversation-thread §7 '요약/추출 전용 저비용 모델'` 항목이 §7 에 부재(유령 참조, 선존) | §7 에 "채택 완료(A3)" 항목 추가 또는 cross-link 정리 |
| W2 | testing(I1) | 요약 fallback 3단째(model+summaryModel 모두 미설정→llmConfig 기본) 미커버 | 테스트 추가 |
| W3 | maintainability(W1) | 요약 fallback 인라인 vs 추출 named-var 표현 불일치 | 요약도 named var 로 |
| W4 | maintainability(W2) | embeddingModel widget 'text' vs 신규 'expression' 불일치(선존) | (defer) 또는 expression 통일 |
| W5 | testing(I2) | makeJob 헬퍼 extractionModel 파라미터 미수용(캐스트 주입) | 헬퍼 파라미터화 |

## INFO 주요
- rationale-continuity: §12.12 번복이 과거 scope-freeze 3우려 각각에 반론 명시 → **무근거 번복 아님, 정합**. BLOCK:NO.
- side-effect: 구버전 큐 payload 하위호환 OK, 메인 추론 콜 영향 없음, 미설정 시 회귀 0.
- scope: 변경 단일 목적 집중, conversation-thread §9 fix 독립 커밋 분리 정당.

## reviewer별 BLOCK
rationale-continuity NO · cross-spec NO · requirement **YES** · side-effect NO · testing NO · scope NO · maintainability(위험도 CRITICAL, 명시 BLOCK 라인 없음→C1 로 승격)
