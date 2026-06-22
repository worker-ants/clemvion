# 문서화(Documentation) 리뷰

## 발견사항

### [INFO] `dispatchNodeSchema` JSDoc — 비문자열 캐시 우회 근거 명문화 완료, 적절
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m3-assistant-tool-router/codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.ts` L120–L128
- 상세: private `dispatchNodeSchema` 메서드에 JSDoc이 추가되어 hits 카운트 규칙(첫 호출=1, 두 번째=2, 세 번째≥hard-stop)과 비-문자열 type 인자 시 캐시 우회 의도가 명확히 서술되어 있다. 이는 이전 리뷰(WARNING #1, INFO #4)에서 요구한 "코드 주석 명시"를 충실히 이행한 것으로 평가된다.
- 제안: 해당 없음.

### [INFO] 클래스 레벨 JSDoc — `dispatchNodeSchema` 위임 서술 미갱신
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m3-assistant-tool-router/codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.ts` L47–L61 (클래스 JSDoc)
- 상세: `AssistantToolRouter` 클래스 JSDoc의 2번 항목에 "`dispatchExplore`는 `get_node_schema` 의 turn-scoped 캐시/하드스톱을 관리한다"고 서술되어 있는데, 이 변경으로 캐시/하드스톱 로직이 `dispatchExplore` 내부 인라인에서 `dispatchNodeSchema` private 메서드로 이전되었다. 클래스 수준 서술이 여전히 `dispatchExplore`가 직접 관리하는 것처럼 읽힌다. private 메서드는 공개 API가 아니므로 외부에서 이를 알 필요는 없으나, 유지보수자 관점에서 "위임"임을 밝히면 더 정확하다.
- 제안: 클래스 JSDoc의 해당 구절을 "private `dispatchNodeSchema` 로 위임해 turn-scoped 캐시/하드스톱을 관리한다"로 소폭 수정 검토. 낮은 우선순위.

### [INFO] `handleExploreCall` 인라인 주석 — `list_integrations`·`list_workflows` 인자 추출 스타일 불일치 미문서화
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m3-assistant-tool-router/codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.ts` L182–L191
- 상세: `handleExploreCall` 내 `list_integrations`·`list_workflows` 에서는 여전히 인라인 삼항 (`typeof args.category === 'string' ? args.category : undefined`)을 사용하고 있고, `get_node_schema`·`get_workflow`·`list_knowledge_bases` 등은 `asString`을 사용한다. `dispatchNodeSchema` 에서 `asString` 으로 통일(INFO #10 처리)한 이후 `handleExploreCall` 내 다른 스위치 케이스에도 같은 패턴이 잔류하지만 주석 등으로 이 의도적 차이 혹은 미처리 사항임을 표시하지 않는다. 향후 유지보수자가 혼동할 여지가 있다.
- 제안: `handleExploreCall` 상단에 짧은 인라인 주석(`// TODO(M-3 후속): asString 통일`)을 달거나, RESOLUTION.md 에 "handleExploreCall 내 인라인 삼항 잔류"를 명시적으로 추적 항목으로 기록하는 것을 권장. 현재 RESOLUTION.md 는 INFO #10 처리 완료만 기재하고 잔류 케이스를 언급하지 않는다.

### [INFO] `coerce.spec.ts` — 모듈 수준 설명 주석 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m3-assistant-tool-router/codebase/backend/src/modules/workflow-assistant/tools/coerce.spec.ts`
- 상세: 신설된 `coerce.spec.ts` 는 `describe('asString', ...)` 블록 하나로 구성되어 있다. `describe` 이름이 충분히 서술적이므로 별도 파일 레벨 주석이 없어도 이해에 지장이 없다. 다만 `coerce.ts` 의 향후 확장 시 추가 `describe` 블록이 붙는 구조임을 파일 상단 주석으로 명시하면 맥락 전달이 수월하다.
- 제안: 보완 우선순위 없음. 현 상태로 충분하다.

### [INFO] RESOLUTION.md — `handleExploreCall` 잔류 인라인 삼항 추적 누락
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m3-assistant-tool-router/review/code/2026/06/23/01_00_21/RESOLUTION.md` "즉시 수정" 테이블
- 상세: INFO #10 처리 항목이 "L113 `asString` 통일"로만 기재되어 있고, 동일 파일 내 `handleExploreCall` 스위치 케이스들의 인라인 삼항(`typeof args.category === 'string' ...` 등)이 동일 이슈의 잔류 인스턴스임을 명시하지 않는다. 처리 완료 범위가 모호해 향후 리뷰어가 "INFO #10 이미 해결됨"으로 오판할 수 있다.
- 제안: RESOLUTION.md INFO #10 항목에 "단, `handleExploreCall` 내 다른 case 인라인 삼항은 이번 단계 범위 밖 — 후속 단계에서 일괄 정리 예정"을 부기.

### [INFO] SUMMARY.md — 이전 리뷰 문서로 현재 변경과 관계 명확
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m3-assistant-tool-router/review/code/2026/06/23/01_00_21/SUMMARY.md`
- 상세: 이번 커밋에 포함된 SUMMARY.md/RESOLUTION.md 는 이전 리뷰(01_00_21)의 산출물로서 역할이 명확하다. 문서 자체의 구성과 서술 품질은 양호하다.
- 제안: 해당 없음.

### [INFO] spec 갱신 필요 — `schemaCache` 정책 위치 cross-reference (planner-only)
- 위치: `spec/3-workflow-editor/4-ai-assistant.md` §Part A (L928, L990) — 리뷰 payload 내 INFO #1 참조
- 상세: spec 문서가 `SCHEMA_LOOKUP_HARD_STOP` 상수와 정책 로직의 구 위치(이동 전 서비스 파일)를 cross-reference하고 있다. 본 변경으로 상수·정책이 `assistant-tool-router.service.ts`의 `dispatchNodeSchema`로 이전되었으나 spec 서술이 미갱신 상태다. `developer` 역할은 `spec/` 쓰기 불가이므로 `project-planner` 위임 필요. 현 문서화 리뷰 범위에서는 갱신 요청만 기록한다.
- 제안: project-planner 에 위임 — spec §"schemaCache 정책" 절의 구현 위치 cross-ref를 "policy 로직·상수는 `assistant-tool-router.service.ts`의 `dispatchNodeSchema`, 캐시 맵 소유는 `streamMessage`"로 갱신.

## 요약

이번 변경은 행동 보존 리팩터링(private `dispatchNodeSchema` 추출 + 테스트 보강)으로 문서화 품질 전반이 양호하다. `dispatchNodeSchema` JSDoc 및 클래스 레벨 문서가 충실히 추가·유지되었고, 이전 리뷰(WARNING #3)에서 지적한 생성자 stale `@param` 문제도 grep 검증 결과 비이슈로 확인되었다. 주요 잔여 사항은 두 가지다: (1) 클래스 JSDoc의 `dispatchExplore` 직접 관리 서술이 위임 구조로 소폭 갱신되지 않았고, (2) `handleExploreCall` 내 잔류 인라인 삼항 케이스가 INFO #10 처리 완료 기록에서 누락되어 향후 혼동을 유발할 수 있다. 두 사항 모두 즉각 차단이 필요한 수준은 아니며, spec의 schemaCache cross-reference 갱신만 planner-only 후속 작업으로 추적이 필요하다.

## 위험도

LOW
