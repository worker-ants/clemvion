# 유지보수성(Maintainability) 리뷰 결과

리뷰 대상: M-3 1단계 review fix — `dispatchNodeSchema` 추출 + 테스트 보강 (commit `07de6ff1`)
리뷰 일시: 2026-06-23

---

## 발견사항

### [INFO] `dispatchNodeSchema` 추출로 `dispatchExplore` 가독성 명확히 개선됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m3-assistant-tool-router/codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.ts` L108–L118 (`dispatchExplore` 본체)
- 상세: 이전 리뷰(01_00_21)에서 지적된 `get_node_schema` 인라인 블록이 `private dispatchNodeSchema()` 로 추출되었다. `dispatchExplore` 는 이제 3줄짜리 라우팅 분기(`get_current_workflow` → `verify_workflow` → `get_node_schema` → 기본 위임)로만 구성되어 단일 추상화 수준을 유지한다. 이전 대비 순환 복잡도가 현저히 낮아졌으며 의도가 즉시 파악된다.
- 제안: 해당 없음 — 적절히 수정됨.

### [INFO] `dispatchNodeSchema` JSDoc이 비-문자열 type 캐시 우회 의도를 명확히 서술
- 위치: 동일 파일 L120–L128 (JSDoc 블록)
- 상세: 빈 `typeArg`(`''`) 시 캐시 정책이 적용되지 않는 이유("빈 type 의 스키마 조회 자체가 무의미해 별도 차단 이득이 없기 때문")가 명시되어, 코드를 읽는 사람이 설계 의도를 오해하지 않는다. 이전 인라인 주석만 있던 상태에서 정식 JSDoc 으로 승격된 점도 문서 품질 측면에서 긍정적이다.
- 제안: 해당 없음.

### [INFO] `asString` 사용 불일치 해소 확인
- 위치: 동일 파일 L133 (`dispatchNodeSchema` 내 `typeArg` 추출)
- 상세: 이전 리뷰에서 지적된 `typeof args.type === 'string' ? args.type : ''` 인라인 삼항이 `asString(args.type, '')` 으로 교체되어, `handleExploreCall` 내 사용과 스타일이 통일되었다. 파일 내 일관성 달성.
- 제안: 해당 없음 — 수정됨.

### [INFO] 신규 테스트 케이스 명명이 의도를 잘 드러냄
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m3-assistant-tool-router/codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.spec.ts` L283–L337
- 상세: 4개 신규 테스트의 `it()` 설명문이 각각 검증하는 동작을 구체적으로 서술한다. 특히 `'bypasses the cache for non-string type args (no key, delegates every call)'` 와 `'verify_workflow on an empty canvas passes (nothing to cover) and signals reviewCompleted'` 는 설계 의도를 테스트 이름 자체로 문서화하는 좋은 예다. 인라인 주석(`// typeArg === '' → no cache key → …`)도 추가되어 있어 복습 비용이 낮다.
- 제안: 해당 없음.

### [INFO] `coerce.spec.ts` 가 극소 파일임에도 경계값 커버리지가 충분
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m3-assistant-tool-router/codebase/backend/src/modules/workflow-assistant/tools/coerce.spec.ts`
- 상세: 17줄로 null/undefined/number/object/array/boolean → fallback, 빈 문자열·일반 문자열 → passthrough 의 7개 경계값을 커버한다. 테스트 파일 이름이 소스 파일명과 1:1 대응(`coerce.ts` → `coerce.spec.ts`)하여 파일 탐색 비용이 없다.
- 제안: 해당 없음.

### [INFO] `dispatchNodeSchema` 내 `cached.hits += 1` 위치가 early-return 전 공유 변이라는 점
- 위치: 동일 서비스 파일 L136 (`cached.hits += 1`)
- 상세: 캐시 히트 시 `hits += 1` 을 먼저 수행한 뒤, 값에 따라 `HARD_STOP` 또는 `warning` 분기로 분리된다. 현재 로직은 정확하지만, 변이가 두 분기 앞에 단독으로 놓여 있어 처음 읽을 때 "왜 반환 전에 변이하는가"라는 의문이 생길 수 있다. 짧은 인라인 주석("hits 를 먼저 증가시켜 두 분기 모두 최신 카운트를 볼 수 있도록")을 추가하면 명확성이 올라간다.
- 제안(선택적): `cached.hits += 1;` 바로 위에 `// increment first so both branches see the updated count` 한 줄 추가. 동작 변경 없음.

### [INFO] 잔여 `unknown` 반환 타입(`buildVerifyWorkflowResult`)은 이전 리뷰 이후 미변경
- 위치: 동일 서비스 파일 L101–L105 (`dispatchExplore` 내 타입 단언)
- 상세: `(verifyResult as { ok?: boolean } | undefined)?.ok` 타입 단언이 남아 있다. 이번 PR 은 behavior-preserving 원칙을 준수하므로 verbatim 이동 결과를 변경하지 않은 것이 적절하다. M-3 후속 단계에서 `VerifyWorkflowResult` 구체 타입 도입 시 제거 가능하다는 점이 RESOLUTION.md 에도 명시되어 있어 추적 가능 상태다.
- 제안: 해당 없음 — defer 근거 기록 완비.

### [INFO] `get_workflow` 테스트가 두 개의 독립적인 `await` 호출을 하나의 `it` 블록에 배치
- 위치: `assistant-tool-router.service.spec.ts` L304–L323
- 상세: `mode=full` 과 기본 `summary` 두 케이스를 단일 `it` 블록 내에서 검증한다. 현재 구조에서는 첫 번째 단언이 실패해도 두 번째 단언이 실행되지 않으므로 실패 원인 격리가 불완전하다. 단, 두 케이스가 동일한 mock(`exploreTools.getWorkflow`)을 공유하고 테스트 의도("mode 파라미터 분기")가 하나이므로 허용 가능한 수준이다.
- 제안(선택적): 두 개의 분리된 `it` 블록으로 나누면 실패 메시지가 더 명확해진다. 의무 수정 아님.

---

## 요약

이번 커밋은 이전 라운드(01_00_21)의 유지보수성 지적 사항을 적절히 처리했다. `dispatchNodeSchema` 추출로 `dispatchExplore` 가 순수 라우팅 분기로 정돈되어 순환 복잡도가 낮아졌고, `asString` 사용 불일치가 해소되었으며, 비-문자열 캐시 우회 의도가 JSDoc 으로 명문화되었다. 신규 테스트 4건은 설계 의도를 이름 수준에서 문서화하는 좋은 패턴을 따른다. 잔여 이슈(`unknown` 반환 타입, `get_current_workflow` safety-net `throw` 미전환)는 모두 behavior-preserving 원칙 또는 후속 단계 defer 로 근거가 기록되어 있어 추적 가능 상태다. 신규 발견된 사항은 모두 INFO 수준의 선택적 개선이며, 즉각적인 수정 의무는 없다.

## 위험도

NONE
