# 정식 규약 준수 검토 — `spec/4-nodes`

## 사전 확인 (검토 신뢰도 관련)

- `--impl-done` 모드로 지정됐으나 `git -C <워크트리> diff origin/main...HEAD --stat` 확인 결과 이번 브랜치의 실제 diff 는 `.claude/tests/**`·`.github/workflows/harness-checks.yml`·`codebase/packages/*/package.json`(버전 bump)·`review/code/2026/08/06/18_55_02/**` 뿐이며 **`spec/4-nodes/**` 또는 그 코드 대응 경로(`codebase/backend/src/nodes/**`)에는 변경분이 전혀 없다.** 즉 이번 세션의 실제 변경사항과 지정된 검토 target(`spec/4-nodes`)이 무관하다 (앞선 `naming_collision.md` 07/23 배치들이 이미 지적한 "반복되는 orchestrator target-diff 불일치" 패턴과 동일 계열). 아래 발견사항은 diff 유발이 아니라 `spec/4-nodes` 자체의 **standing 규약 준수 상태**를 평가한 것이다.
- 프롬프트 번들은 `spec/conventions/` 파일 265개가 컨텍스트 예산으로 생략됐고(`audit-actions.md`·`cafe24-api-catalog/*`만 포함), Logic 노드 검토에 실제로 필요한 `node-output.md`·`error-codes.md`·`cross-node-warning-rules.md`·`node-cancellation.md`·`spec-impl-evidence.md` 는 프롬프트에 없었다. 이 checker 는 워크트리 절대경로로 해당 conventions 원본을 직접 Read 해 대조했다.

## 발견사항

- **[WARNING] `spec/4-nodes/<category>/0-common.md` frontmatter `id` 6중 충돌 — 자기 문서가 세운 충돌회피 규약을 스스로 어김**
  - target 위치: `spec/4-nodes/1-logic/0-common.md`(frontmatter `id: common`), 그리고 같은 패턴의 `spec/4-nodes/2-flow/0-common.md`, `3-ai/0-common.md`, `4-integration/0-common.md`, `5-data/0-common.md`, `7-trigger/0-common.md` — 6개 파일이 전부 `id: common` 을 그대로 사용.
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 — "`id` … 파일 basename 기반 권장. **같은 basename 이 영역을 달리해 중복될 때는 후발 문서가 영역 prefix 로 충돌을 회피한다**" (문서가 든 예시: `agent-memory` vs `nav-agent-memory`).
  - 상세: `spec/4-nodes/6-presentation/0-common.md` 는 실제로 `id: presentation-common` 으로 이 규약을 지켜 basename 충돌을 회피했고, `spec/4-nodes/0-overview.md` 도 `id: nodes-overview`(단순 `overview` 아님)로 동일 패턴을 따른다 — 즉 이 spec 영역은 규약의 존재와 적용 방식을 이미 알고 실천하는데, 같은 영역 안의 나머지 6개 `0-common.md` 만 예외적으로 disambiguation 없이 `common` 을 그대로 재사용해 서로 충돌한다(`grep -rn '^id: common$' spec/` 결과 정확히 이 6개 파일, spec 전역에서 이 케이스만 유일). frontmatter-evidence 가드(`spec-frontmatter-parse.ts`/`spec-frontmatter.test.ts`)는 `id` 유일성을 검증하지 않아 build 는 통과하지만, 문서 site 등에서 `id` 를 키로 조회하는 향후 소비자가 생기면 6개 중 임의의 하나만 남는 silent shadowing 위험이 있다. 앞선 `review/consistency/2026/07/23/{15_33_52,18_40_40}/naming_collision.md` 는 `presentation-common`/`carousel`/`table` 만 대상으로 "spec 전역에서 유일" 결론을 냈는데, 그 검토는 다른 카테고리(`1-logic` 등)의 `id: common` 과 교차 대조하지 않아 이 6중 충돌을 놓쳤다 — 이번이 최초 포착이다.
  - 제안: 나머지 6개 `0-common.md` 의 `id` 를 `logic-common`/`flow-common`/`ai-common`/`integration-common`/`data-common`/`trigger-common` 처럼 `presentation-common`·`nodes-overview` 와 동일한 disambiguation 패턴으로 정정. 코드 쪽 소비자가 없어(위 확인: `codebase/frontend/src/lib/docs/registry.ts` 는 user-guide MDX `id` 만 다루고 spec frontmatter `id` 는 test guard 외 런타임 소비자 없음) 순수 문서 수정이며 side-effect 없음.

## 그 외 대조 결과 (위반 없음 — 참고)

아래 축은 직접 확인했고 명확한 위반을 찾지 못했다:
- **출력 포맷 규약**: `output.error` 표준 형태(`code`/`message`/`details`, `UPPER_SNAKE_CASE`) — Logic 노드는 에러 포트를 갖지 않는(`node-output.md` §3.3) 노드들이라 관련 없고, 인용된 에러 코드(`CONTAINER_MISSING_EMIT`/`MAX_ITERATIONS_EXCEEDED`/`RESERVED_VARIABLE_NAME`/`PARALLEL_NESTED_DEPTH_EXCEEDED` 등)는 모두 `error-codes.md` §1 의 `UPPER_SNAKE_CASE` + 의미기반 명명 원칙을 준수. Container 노드 `{ <컬렉션>, count }` 오버라이트 컨트랙트(§9 · §9.1)는 `node-output.md` Principle 9·9.2 와 컬렉션 키(`iterations`/`mapped`/`items`/`branches`)까지 정확히 일치.
- **문서 구조 규약**: `spec/4-nodes/_product-overview.md`(제품 정의, 이번 프롬프트 예산상 생략됐으나 실존 확인) + `0-overview.md`(기술 아키텍처) + 개별 노드 문서(본문) + 필요한 곳만 `## Rationale` 구조는 project-planner SKILL §Spec 문서 구조("다중 spec 파일을 가진 영역은 `_product-overview.md` 별도 파일")와 정합 — 개별 노드 문서에 `## Overview` 헤더가 없는 것은 위반이 아니라 이 패턴의 정상 결과.
- **동적 포트 ID**: slug-regex(`^[a-zA-Z0-9_-]{1,64}$`) + 인덱스 fallback(`case_0`/`branch_0` 형태 `<prefix>_<index>`) + 시스템 예약어(Switch `RESERVED_CASE_IDS: ['default','out','error']`)는 `node-output.md` Principle 6 및 `0-overview.md` §1.3 과 lockstep.
- **cross-node warningRule**: Parallel 의 `parallel:nested-depth-exceeded`/`parallel:nested-concurrency-cap` 인용은 `cross-node-warning-rules.md` §8 등재 내용과 일치.
- **API 명명**: `GET /api/nodes/definitions` 는 `5-system/2-api-convention.md` §2.2(복수형 명사·kebab-case)에 부합.
- **금지 항목**: `output.view`/`output.type` 판별자, `output.submittedData`, `_multiTurnState` 등 `node-output.md` §4.2 폐기 필드는 target 어디서도 재사용되지 않고, 오히려 "금지" 사실을 정확히 인용만 하고 있음.

## 요약

`spec/4-nodes`(특히 Logic 카테고리 문서군)는 `node-output.md`/`error-codes.md`/`cross-node-warning-rules.md`/`node-cancellation.md` 등 정식 규약을 이례적으로 촘촘히 인용·정합시키고 있어 출력 포맷·에러 코드·동적 포트·컨테이너 오버라이트 축에서는 위반을 찾지 못했다. 유일한 실질 발견은 문서 구조/명명 규약 축의 `0-common.md` frontmatter `id` 6중 충돌로, `spec-impl-evidence.md` 가 예시로 든 disambiguation 패턴을 같은 영역의 자매 파일(`presentation-common`)은 따르면서 나머지 6개는 따르지 않는 내부 비일관성이다. build 가드가 `id` 유일성을 강제하지 않아 즉각적 장애는 없으므로 WARNING 등급이 적절하다. 별도로, 이번 세션의 실제 코드 diff 가 `spec/4-nodes` 와 무관해 `--impl-done` 검토 전제 자체가 약하다는 점은 검토 신뢰도 맥락으로 남겨둔다.

## 위험도
LOW
