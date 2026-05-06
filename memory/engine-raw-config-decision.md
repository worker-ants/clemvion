# Engine Raw Config Exposure — 결정 메모

**상태**: 결정 완료, implementation 진행 예정

**결정 요약**:
- Path A 채택 — 엔진이 핸들러에 raw config (expression 평가 전 원본) 를 `ExecutionContext.rawConfig` 로 노출
- 핸들러는 `NodeHandlerOutput.config` 에 raw 를 echo, expression 평가 결과는 `output.*` 에 둠
- 마이그레이션 전략: 하드 스위치 — 모든 핸들러 일관 적용
- PRD ID prefix: 신규 `ENG-RC-*` (Engine Raw Config) 신설

**배경 / 사유**:
- `CONVENTIONS Principle 1.1.3` 은 "config = 원본 템플릿, output = 평가 결과" 를 이미 명시했으나, 엔진 구현이 평가된 config 만 핸들러에 넘겨 핸들러가 raw 를 echo 할 수 없었음
- Principle 7 의 "해석/치환 후 echo" 표현이 1.1.3 과 모순한 채 남아있어, Send Email · HTTP Request 의 output 에 평가 결과를 추가하려는 작업이 의미적으로 진행 불가

**산출물 위치**:
- PRD: `prd/3-node-system.md` §11 — `ENG-RC-01~04`
- Spec: `spec/5-system/4-execution-engine.md` §5.1 / §5.2 / §5.5 / §6.1, `spec/4-nodes/0-overview.md` §4.3, `spec/3-workflow-editor/1-node-common.md` §3.2
- CONVENTIONS: `user_memo/node-specs-improvement/CONVENTIONS.md` Principle 7 (전면 개정), 1.1.3 (보강), 8.2 (이메일·HTTP 표 갱신)
- Implementation tracker: `plan/in-progress/engine-raw-config-exposure.md`

**다음 액션**:
- Phase 1 (developer) — 엔진 plumbing
- Phase 2 (developer) — Send Email + HTTP Request 트리거 작업

**관련 메모**:
- 본 결정은 사용자가 "Send Email / HTTP Request output 에 본문 추가" 요청 시 발견된 아키텍처 misalignment 가 트리거. Path B (config + output 양쪽에 같은 evaluated 값) 는 Principle 1.1 직교성 위반으로 기각됨

**완료 시 갱신 사항**: 본 메모를 "완료" 상태로 변경하고 phase 별 PR 링크 추가. 모든 phase 종료 시 `plan/in-progress/engine-raw-config-exposure.md` 를 `plan/complete/` 로 이동.
