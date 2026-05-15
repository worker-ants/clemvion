---
name: 2026-04-23 DANGLING_OUTPUT_PORTS 리뷰 조치
date: 2026-04-23
---

# 조치 내역

SUMMARY.md (위험도 LOW, Warning 10 + Info 17) 중 실질 위험이 있는 항목 위주로 조치.

## 조치 완료

### Security — DANGLING_OUTPUT_PORTS details 프롬프트 인젝션 표면
`review-workflow.ts` `buildReviewChecklist` 의 `summary` 빌드에서
`nodeLabel` / `nodeType` / `portId` / `portLabel` 을 모두 `sanitizeLlmProvidedString`
경유로 embed. 상한은 `DANGLING_PORT_LABEL_MAX_LEN=80`, `DANGLING_PORT_ID_MAX_LEN=64`.
`shadow-workflow.ts` 의 동일 헬퍼를 `export` 해서 재사용 (중복 방지).

- 방어 효과: 악의적인 node label (`"\n# HACK\n`rm -rf /`"` 등) 을 details 에 넣어
  LLM context 를 오염시키는 경로 차단. `originalRequest` 와 동일 방어 클래스로 통일.
- `data` 필드는 원문 유지 — 구조화 파싱용이라 중화하면 LLM 의 복구 가이드 품질이 떨어짐.
- 회귀 테스트: `review-workflow.spec.ts` "sanitizes LLM/client-provided node labels
  and port labels in details (prompt injection defense)" 추가.

### Testing — ai-agent-conditional multi_turn + conditions 케이스 누락
`resolve-dynamic-ports.spec.ts` 에 `multi_turn + conditions` describe it 추가.
`aiAgentConditionalPorts` 의 마지막 `if (isMultiTurn)` 분기 (`[...condPorts, user_ended, max_turns, error]`) 가 실제 조건 포트 경로와 함께 테스트됨.

### Testing — 복수 노드 dangling 동시 발생 케이스 누락
`review-workflow.spec.ts` "handles multiple nodes with dangling ports simultaneously"
추가. carousel + switch 동시 dangling 시 `data` 에 두 노드 포트가 모두 실리고
`details` 가 "; " 로 구분되어 그룹화되는 것을 고정.

### Testing — 미등록 노드 타입 스킵 미검증
`review-workflow.spec.ts` "silently skips nodes whose type is not in nodeDefs"
추가. `defsByType.get(node.type) === undefined` 분기의 continue 동작을 고정.

### Side Effect — BuildReviewChecklistInput.nodeDefs 필수 필드 breaking change
`grep -rn buildReviewChecklist src` 로 전수 확인 — production caller 는 `stream.service.ts`
1곳뿐이고 이미 업데이트됨. 테스트도 `baseInput` 헬퍼 한 곳에서 기본값 `[]` 주입으로
일괄 해소. 추가 변경 불필요.

## 조치 유보 (이번 변경 범위 밖)

### Architecture — Frontend/Backend resolve-dynamic-ports 이중 유지
CI 검증 자동화는 별도 이슈. 현재는 `memory/workflow-assistant-self-review-and-error-hints.md`
체크리스트 + 두 spec 파일의 시나리오 미러로 방어. 장기적으로 `packages/` 공유가 필요.

### Architecture — streamMessage SRP 지속 심화
기존 이슈. 이번 변경은 `evaluateReviewGuard` 한 지점에 `nodeDefs` 주입 1줄 추가만 수행.
전반 리팩토링은 별도 RFC 필요.

### Side Effect — DANGLING_OUTPUT_PORTS 기존 세션 소급 영향
의도된 동작. 기존에 배포된 워크플로에 dangling 포트가 남아 있다면 사용자가 다음 edit
턴에서 `WORKFLOW_REVIEW_REQUIRED` 를 경험하게 되며, 이는 "품질 회복" 흐름이라 유지.
`memory/workflow-assistant-self-review-and-error-hints.md` 에 이미 명시.

### Security — resolveEffectiveOutputPorts 입력 배열 크기 무제한
이론적 메모리 증폭 벡터. 실제 서버 heap 에 영향을 주려면 인증된 사용자가 `cases: [...10000]`
같은 DTO 를 반복 전송해야 하는데, DTO validator 쪽에서 방어하는 게 적절 (review 내부
상한은 `MAX_DANGLING_PORTS=20` 출력 제한만 담당). 별도 보안 이슈로 분리.

### Maintainability — aiAgentConditionalPorts 약 포트 배열 중복
`condPorts.length === 0` vs 그 외 분기에서 동일 순서의 system port 배열이 반복.
가독성 vs DRY 트레이드오프에서 프론트엔드 사본과의 일관성 유지 쪽을 택해 현행 유지.

### Testing — Port connectivity rules 프롬프트 config 경로 전수 미검증
`config.cases` / `config.buttons` 외 `config.conditions` / `config.categories` /
`config.items[*].buttons` / `config.itemButtons` 경로도 regex 고정할 수 있으나,
`every user-configured output port must have an outgoing edge` 문구 고정으로 상위
계약은 지켜지므로 INFO 수준에서 유보.

### Scope — 두 기능 (plan-only fix + DANGLING_OUTPUT_PORTS) 단일 변경셋 혼재
이 리뷰의 `git diff` 범위에 두 작업이 같이 들어간 것. 원래 plan-only fix 는 별도 커밋
대상이고 DANGLING_OUTPUT_PORTS 는 이번 PR 의 메인. 커밋 단위에서 분리하면 해결.

## 검증

- `backend` 전체 test: 1755/1755 pass
- `backend` lint: clean
- `backend` build: success

## 관련 문서

- 메모: `memory/workflow-assistant-self-review-and-error-hints.md` §체크리스트 항목·§Port 해석·§유지보수 체크리스트
- 회귀 테스트:
  - `backend/src/modules/workflow-assistant/tools/resolve-dynamic-ports.spec.ts` (17 tests)
  - `backend/src/modules/workflow-assistant/tools/review-workflow.spec.ts` DANGLING_OUTPUT_PORTS describe (9 tests)
  - `backend/src/modules/workflow-assistant/workflow-assistant-stream.service.spec.ts` "WORKFLOW_REVIEW_REQUIRED — DANGLING_OUTPUT_PORTS" describe (integration)
  - `backend/src/modules/workflow-assistant/prompts/system-prompt.spec.ts` "Port connectivity rules" describe (3 tests)
