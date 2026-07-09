# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** `attribution 채움 현황` 콜아웃이 Text Classifier 의 resume 턴 유무를 모호하게 서술
  - 위치: `spec/data-flow/7-llm-usage.md` §1.3 콜아웃 — "멀티턴 AI 노드(AI Agent / Information Extractor)와 Text Classifier 는 첫 턴·resume 턴 모두 `workflow_id / execution_id / node_execution_id` 를 채운다"
  - 상세: 바로 위 카탈로그 표 행은 Text Classifier 를 "단발(`context.*`)" 로만 서술하고, 실제로 `text-classifier.handler.ts` 에는 `processMultiTurnMessage`/resume 로직이 없다(grep 결과 无). 반면 콜아웃 문장은 "Text Classifier" 를 "첫 턴·resume 턴 모두" 채운다는 절에 함께 묶어, Text Classifier 도 resume 턴을 갖는 것처럼 읽힐 여지가 있다. 표 자체는 정확하므로 실질적 오정보는 아니지만, 콜아웃만 읽는 독자에게는 혼동 가능.
  - 제안: "멀티턴 AI 노드(AI Agent / Information Extractor)는 첫 턴·resume 턴 모두, Text Classifier(단발)는 호출 시점에 채운다" 정도로 문장을 분리해 표와 대칭시키면 더 명확.

- **[INFO]** plan 문서의 후속 follow-up 항목이 리포지토리 밖(backup 브랜치)을 유일한 근거로 참조
  - 위치: `plan/in-progress/resume-llm-usage-attribution.md` "잔여 follow-up" 절 — "backup 브랜치 `spec-update-7-llm-usage.md` 참조"
  - 상세: 4건의 spec 정정 follow-up 항목이 현재 plan/spec 트리에 실체 문서 없이 "backup 브랜치"라는 외부 참조 하나로만 추적된다. 브랜치는 향후 삭제·rebase 로 사라질 수 있어, 이 follow-up 이 실제로는 유실될 위험이 있다(`.claude/docs/plan-lifecycle.md` 의 "진행 중 작업은 `plan/in-progress/`" 원칙과도 약간 어긋남).
  - 제안: 별도 `plan/in-progress/<name>.md` 항목으로 최소한의 스텁을 만들어 정식 추적하거나, 최소한 backup 브랜치의 커밋 SHA/날짜를 명시해 추적 가능성을 높이는 것을 권장.

## 요약

이번 변경은 문서화 관점에서 모범적인 수준이다. CHANGELOG 에 결함·원인·수정 범위를 상세히 기록했고, `spec/data-flow/7-llm-usage.md` §1.3 표·콜아웃·Rationale 과 `spec/5-system/4-execution-engine.md` §6.1 소비처 표를 실제 구현과 정합하도록 동시에 갱신했다(spec-code drift 없음, 직접 코드로 대조 검증 완료). 코드 측에서도 `execution-engine.service.ts`·`ai-turn-executor.ts`·`information-extractor.handler.ts` 세 곳 모두 과거의 부정확한/불완전한 주석("resume state 는 nodeId/nodeExecutionId 를 운반하지 않으므로", "workflowId 는 state 에 없어 null")을 현재 동작에 맞춰 정정했고, `MultiTurnState` 신규 필드에는 spec 참조를 포함한 JSDoc 이 추가됐다. 새 테스트 3건(ai-turn-executor.spec.ts ×1, information-extractor.handler.spec.ts ×1, 및 기존 테스트 문맥) 모두 "회귀 방지" 의도와 spec 절 번호를 명시한 인라인 주석을 달아 왜 이 assertion 이 필요한지 추적 가능하다. plan 문서(`plan/in-progress/resume-llm-usage-attribution.md`)는 stale-base 정리 경위·중복 제거 배경까지 투명하게 기록해 리뷰어가 변경 이력을 재구성하기 쉽다. 발견된 두 항목은 모두 INFO 수준의 사소한 표현/추적성 개선 제안이며, 신규 환경변수·API 엔드포인트·README 대상 변경이 없어 해당 항목들은 해당 없음(N/A)이다.

## 위험도

LOW
