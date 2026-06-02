# Testing Review — backend-msg-i18n-impl (i18n Principle 3-C)

## 발견사항

### [WARNING] custom-node-graph-warning 테스트에 params·locale 분기 미커버
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/components/editor/canvas/__tests__/custom-node-graph-warning.test.tsx` 전체
- 상세: `custom-node.tsx` 변경의 핵심은 `graphWarningMessage` 계산이 `r.message` 직접 사용에서 `translateGraphWarning(r, locale)` 경유로 바뀐 것이다. 기존 테스트 파일은 이 변경을 전혀 검증하지 않는다 — `setWarnings()` 헬퍼의 타입도 `params?` 없이 정의되어 있고, ko/en 로케일 전환에 따라 tooltip 텍스트가 달라지는지를 검증하는 케이스가 없다. `params` 가 있는 결과 객체와 없는 결과 객체에서 각각 올바른 한국어/영문 메시지가 렌더되는지 테스트 되지 않는다.
- 제안: ko 로케일 + params 있는 warning 결과 → tooltip이 한국어 보간 문자열인지, en 로케일 + 같은 결과 → 영문 fallback 메시지인지, params 없는(정적) warning → `result.message` 그대로인지를 검증하는 케이스 추가.

### [WARNING] editor-toolbar-rbac 테스트의 Save 버튼 title 검증이 구 동작 기준으로 고착
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/components/editor/toolbar/__tests__/editor-toolbar-rbac.test.tsx` L121-139
- 상세: `editor-toolbar.tsx` 변경은 Save 버튼 `title` 속성을 `result.message` 직접 노출에서 `translateGraphWarning(err, locale)` 경유로 바꿨다. 그런데 RBAC 테스트 L134는 `expect(saveBtn).toHaveAttribute("title", "Graph error occurred")` — 영문 원문 그대로를 기대한다. 현재 테스트에서 locale 은 `"en"` 으로 설정되어 있어 일단 통과하지만, ko 로케일 + params 포함 결과에서 실제 한국어 템플릿이 보간되어 title 에 노출되는지는 검증하지 못한다.
- 제안: ko 로케일·params 있는 error result → Save 버튼 title 이 한국어 보간 결과인지 검증하는 케이스 추가. 기존 en 케이스는 유지(회귀 방지).

### [WARNING] translateGraphWarning·translateBackendError 신규 함수에 대한 직접 단위 테스트 없음
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` — 신규 `describe("i18n Principle 3-C …")` 블록
- 상세: Phase 4 가드(P3-C-1/P3-C-2)는 키 존재 여부(parity)만 검증하고, `translateGraphWarning(result, locale)` / `translateBackendError(code, params, locale, fallback)` 함수 자체의 동작(로케일별 분기·params 보간·fallback 경로·null/undefined params 처리)을 검증하는 유닛 테스트가 없다. `interpolate()` 는 `i18n.test.ts` 에서 `translate()`를 통해 간접 검증되지만, `translateGraphWarning` 은 `ruleId` 미등록·params 키 누락·비-ko 로케일 케이스가 모두 미커버다.
- 제안: `backend-labels.test.ts` 또는 별도 파일에 `translateGraphWarning` / `translateBackendError` 단위 테스트 추가. 최소 커버 항목: (1) ko + params 있는 known ruleId → 보간된 한국어 문자열, (2) ko + unknown ruleId → fallback 영문 message, (3) en → fallback 영문 message, (4) params 누락(undefined) → 빈 문자열 보간 or template 그대로.

### [INFO] e2e 테스트 A케이스: `params` 필드의 구체적 값 미검증
- 위치: `/Volumes/project/private/clemvion/codebase/backend/test/graph-warning-save.e2e-spec.ts` L281-284
- 상세: 테스트는 `depthErr.params` 가 `node`, `child`, `grand` 키를 가지는지만 확인한다(`toHaveProperty`). 실제 값이 노드 라벨(`"Outer"`, `"Middle"`, `"Inner"`)과 일치하는지는 검증하지 않는다. 값 정확성은 단위 테스트(parallel.spec.ts)에서 커버되므로 e2e 수준에서는 key 존재 확인으로 충분하지만, 라벨이 실제 HTTP 응답까지 정확하게 전파되는지 추가 보증이 필요한 경우 값 단언으로 강화 가능하다.
- 제안: 필수는 아니지만 `expect(depthErr.params).toMatchObject({ node: 'Outer', child: 'Middle', grand: 'Inner' })` 로 강화하면 라벨 전파 end-to-end 정합성이 명확해진다.

### [INFO] parallel.spec.ts 의 `evaluateGraphWarningRulesForGraph` 케이스에서 grand 값 미단언
- 위치: `/Volumes/project/private/clemvion/codebase/packages/graph-warning-rules/src/__tests__/parallel.spec.ts` L165-168 (전체 그래프 평가 케이스)
- 상세: `expect(depth!.params).toMatchObject({ node: 'Outer', child: 'Inner' })` 만 단언하고 `grand: 'Innermost'` 는 누락. 개별 rule 단위 케이스(`L872-876`)에서는 세 키 모두 단언하므로 커버리지는 존재하지만, evaluator 레벨에서 params 가 그대로 전파되는지 완전한 확인을 위해 `grand` 도 포함하는 것이 일관성 측면에서 더 명확하다.
- 제안: `toMatchObject({ node: 'Outer', child: 'Inner', grand: 'Innermost' })` 로 보완.

### [INFO] no-internal-refs.test.ts 에 GRAPH_WARNING_KO 추가되었으나 주석 목록은 미갱신
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/docs/__tests__/no-internal-refs.test.ts` L21-22
- 상세: 파일 상단 주석(Forbidden classes 목록)에는 `GRAPH_WARNING_KO` 가 추가되지 않았다. 동작에는 영향 없으나 문서와 코드 불일치로 가독성 저하.
- 제안: 주석 L21 `- Internal i18n mapping table names (ERROR_KO / WARNING_KO / LABEL_KO ...)` 에 `GRAPH_WARNING_KO` 추가.

---

## 요약

i18n Principle 3-C 구현은 전반적으로 테스트 커버리지 구조가 체계적이다. shared 패키지 단위(parallel.spec.ts)와 backend e2e(graph-warning-save.e2e-spec.ts)에서 `params` 전파가 검증되며, parity 가드(P3-C-1/P3-C-2)가 신규 ruleId 추가 시 매핑 누락을 빌드 단계에서 차단한다. 그러나 변경의 중심인 프론트엔드 렌더 경로 — `translateGraphWarning()` 함수 자체와 이를 사용하는 `custom-node.tsx`·`editor-toolbar.tsx` 의 로케일별 동작 — 에 대한 단위/컴포넌트 테스트가 부재하다. ko 로케일 + params 보간 경로, en/fallback 경로, unknown ruleId 처리가 모두 테스트되지 않아 향후 회귀 위험이 존재한다.

## 위험도

MEDIUM
