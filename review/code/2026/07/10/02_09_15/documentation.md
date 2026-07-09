# 문서화(Documentation) 리뷰

대상: 멀티턴 resume 턴 `llm_usage_log` attribution 수정 (IE `node_execution_id` 오적재 + AI Agent 메인 chat 미배선) — CHANGELOG, execution-engine.service.ts, ai-turn-executor.{ts,spec.ts}, information-extractor.handler.{ts,spec.ts}, plan 문서, spec/5-system/4-execution-engine.md, spec/data-flow/7-llm-usage.md, 그리고 이전 리뷰 라운드(`review/code/…/01_46_28/`, `review/consistency/…/01_46_28/`)의 산출물 일체.

## 발견사항

- **[INFO]** "Text Classifier 도 resume 턴이 있는 것처럼" 읽히는 동일 모호 서술이 이전 라운드에서 고친 곳(1곳) 외에 2곳(execution-engine.md §6.1 표, CHANGELOG.md)에 그대로 남아 있음
  - 위치: `spec/5-system/4-execution-engine.md:712` (`nodeExecutionId` 행 — "AI·멀티턴 핸들러(AI Agent / Text Classifier / Information Extractor)는 `LlmCallContext` 로 …기록하며, resume 턴은 `ExecutionContext` 미주입이라 … `state` 에 주입한 현재 turn row PK 를 쓴다"), `CHANGELOG.md:38` ("이로써 노드 핸들러 3종(AI Agent·Text Classifier·Information Extractor)의 첫 턴·resume 턴 attribution 이 모두 채워진다")
  - 상세: 이전 리뷰 라운드(`review/code/2026/07/10/01_46_28/documentation.md` INFO)가 `spec/data-flow/7-llm-usage.md` §1.3 콜아웃에서 지적한 것과 정확히 같은 클래스의 모호성이다 — "AI Agent / Text Classifier / Information Extractor" 를 한 절에 묶은 뒤 곧바로 "resume 턴은 …" 이라고 이어 붙이면, `text-classifier.handler.ts` 에는 `processMultiTurnMessage`/resume 로직이 전혀 없음에도(직접 grep 재확인 — 매치 0건) Text Classifier 도 resume 턴 attribution 을 갖는 것처럼 읽힌다. 해당 RESOLUTION(FIX #11)은 `spec/data-flow/7-llm-usage.md` 콜아웃 한 곳만 "멀티턴 AI 노드(AI Agent/IE)는 첫 턴·resume 턴 모두, Text Classifier(단발 — resume 없음)는 호출 시점" 으로 분리해 정정했지만, **동일한 사실을 서술하는 자매 문서 2곳(§6.1 표가 명시적으로 `[data-flow/7-llm-usage §1.3]` 를 cross-ref 하는데도)과 CHANGELOG 항목**에는 같은 정정이 전파되지 않았다. 기능적 오류는 아니고(§1.3 표 자체·§1.3 콜아웃은 정확하며 링크를 따라가면 진실을 확인할 수 있음), CHANGELOG 는 영구 기록이라 이 부정확한 표현이 그대로 남는다.
  - 제안: `execution-engine.md:712` 셀의 "resume 턴은 …" 절 앞에 "(AI Agent/Information Extractor 한정 — Text Classifier 는 resume 없음)" 정도의 괄호 삽입, 또는 `4-execution-engine.md` §6.1 셀 텍스트를 짧게 유지하고 상세 구분은 `data-flow/7-llm-usage §1.3` 링크에 전적으로 위임(문구에서 Text Classifier 를 첫 절에서 아예 빼고 "AI·멀티턴 핸들러(AI Agent/Information Extractor, resume 포함) + Text Classifier(단발)" 식으로 재배열). CHANGELOG 항목은 이미 병합 전(Unreleased) 이므로 "노드 핸들러 3종(AI Agent·Text Classifier·Information Extractor)의 attribution 이 채워진다(AI Agent·IE 는 첫 턴·resume 턴 모두, Text Classifier 는 호출 시점)" 로 절을 나누는 정정을 권장. 차단 사유는 아님(INFO).

## 참고 — 검증 확인된 양호 사항

- 이전 라운드 `documentation.md` INFO 2건(§1.3 콜아웃 모호성, follow-up 의 backup-branch 단독 의존) 은 각각 `spec/data-flow/7-llm-usage.md` 콜아웃 재작성과 `plan/in-progress/resume-llm-usage-attribution.md` "잔여 follow-up" 절의 대상 파일:line + 정정 문구 + backup SHA(`7a270a923`) 인라인으로 실제로 정정된 것을 직접 diff 로 확인했다(RESOLUTION.md 서술과 일치).
- `MultiTurnState.workflowId`/`nodeExecutionId` 신규 필드에는 spec 절(§1.3) 참조를 포함한 JSDoc 이 붙었고, `execution-engine.service.ts`/`ai-turn-executor.ts`/`information-extractor.handler.ts` 세 곳 모두 과거의 부정확한 주석("resume state 는 nodeId/nodeExecutionId 를 운반하지 않으므로", "workflowId 는 state 에 없어 null")을 현재 동작에 맞춰 정정했다 — 오래된 주석(stale comment) 문제 없음.
- 신규 테스트(ai-turn-executor.spec.ts, information-extractor.handler.spec.ts)의 인라인 주석은 "회귀 방지" 의도와 spec 절 번호를 명시해 추적 가능하다. `ai-turn-executor.spec.ts:521` 의 "ai-review INFO#3" 표기는 신규 관행이 아니라 이 코드베이스 전반(`app.module.ts`, `execution-context.service.ts`, `integrations.service.spec.ts` 등)에 이미 존재하는 기존 컨벤션이라 별도 지적하지 않음.
- 신규·설정·API 엔드포인트 표면이 없어 README/API 문서/설정 문서/예제 코드 항목은 해당 없음(N/A).
- `review/code/2026/07/10/01_46_28/**`, `review/consistency/2026/07/10/01_46_28/**` 산출물은 CLAUDE.md 저장 위치 규약(`review/code|consistency/<YYYY>/<MM>/<DD>/<hh_mm_ss>/`)과 정확히 일치하는 경로에 위치.

## 요약

이번 diff(2차 라운드, review-fix 반영 후 clean diff)는 문서화 관점에서 전반적으로 높은 수준을 유지한다. 1차 라운드에서 지적된 INFO 2건은 실제로 정정되었음을 코드/spec diff 로 직접 검증했고, JSDoc·인라인 주석·CHANGELOG·plan 문서·spec 갱신 모두 실제 코드 동작과 line-level 로 정합한다. 다만 1차 라운드가 `spec/data-flow/7-llm-usage.md` §1.3 콜아웃에서 고친 "Text Classifier 도 resume 턴을 갖는 것처럼 읽히는" 모호한 문장 패턴이, 같은 사실을 서술하는 자매 위치 2곳(`spec/5-system/4-execution-engine.md` §6.1 `nodeExecutionId` 표 셀, `CHANGELOG.md` 신규 항목)에는 전파되지 않고 그대로 남아 있다. 기능적 오류나 spec-code drift 는 아니며(표/링크를 따라가면 정답을 확인 가능), 하지만 동일 changeset 안에서 이미 한 번 발견·수정된 모호성이 인접 파일에 반복 잔존한다는 점에서 review-fix 적용 범위가 다소 좁았다는 참고 사항으로 남긴다.

## 위험도

LOW
