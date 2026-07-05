# Cross-Spec 일관성 검토 — V-14 impl-done (rerun-modal.tsx typed form + new-tab link)

대상 diff: `git diff origin/main...HEAD` (핵심: `codebase/frontend/src/components/executions/rerun-modal.tsx`)
- (a) 원본 실행 ID → `/workflows/:workflowId/executions/:id` 새 탭 링크 (`target="_blank"`)
- (b) 입력 폼을 워크플로 `manual_trigger` 노드 `config.parameters` 스키마(`TriggerParameterDefinition[]`) 기반 typed 동적 폼으로 전환 — string→text, number→number, boolean→checkbox, object/array→JSON 위젯
- (c) 스키마 부재(노드 삭제/미로딩) 시 원본 `inputData.parameters` 키를 untyped text 로 fallback

검증 대상: `spec/5-system/13-replay-rerun.md` §10.2 / §8.1 / §9, `spec/4-nodes/7-trigger/1-manual-trigger.md`, `spec/4-nodes/7-trigger/0-common.md` §1, `spec/5-system/4-execution-engine.md` §6.1.1, `spec/2-navigation/14-execution-history.md` §3.7, backend `resolve-trigger-parameters.ts` / `coerce-type.ts`.

(impl-prep 단계 payload 오배선 이력이 있어 diff 를 직접 읽어 검증 — impl-prep 시점 사전 분석(`review/consistency/2026/07/05/18_21_17/cross_spec.md`)이 이미 존재하므로 그 결론이 실제 구현 코드와 부합하는지도 함께 확인했다.)

---

## 발견사항

### [WARNING] 원본 ID 링크의 새-탭 동작이 자매 문서(chain badge)와 반대 방향 — 기존 불일치가 코드로 고착

- **target 위치**: 구현 코드 `rerun-modal.tsx` 의 원본 ID `<a target="_blank" rel="noopener noreferrer" href="/workflows/${original.workflowId}/executions/${original.id}">` (spec 근거: `spec/5-system/13-replay-rerun.md` §10.2 필드 동작 표 "원본 실행 헤더" 행 — "ID 클릭 시 새 탭으로 원본 상세 페이지", line 338)
- **충돌 대상**: `spec/2-navigation/14-execution-history.md` §3.7 Chain badge 행 — "원본 ID 클릭 시 **같은 탭**에서 원본 상세로 이동 (`<Link href>`, `target=_blank` **없음**)" (line 361). 실제 코드에서도 실행 상세 페이지의 chain badge 원본 링크(`app/(main)/workflows/[id]/executions/[executionId]/page.tsx:407`)는 평범한 `<Link>` 로 새 탭이 아님 — 확인함.
- **상세**: 두 문서는 서로 다른 UI 요소(모달 헤더의 원본 링크 vs 실행 상세 페이지 chain badge 의 원본 링크)를 가리키므로 동일 요소에 대한 직접 모순은 아니다. 그러나 "원본 실행으로의 딥링크"라는 동일 개념에 대해 한쪽 spec 은 새 탭, 다른 쪽은 "명시적으로 새 탭 아님"이라고 정반대로 못박아 두었다. `14-execution-history.md §3.7` 쪽 문구가 "target=_blank 없음"이라고 굳이 강조한 점은 `13-replay-rerun.md §10.2`(새 탭)를 인지한 채 의도적으로 갈랐거나, 갱신 시 다른 쪽을 놓친 결과일 수 있으며 텍스트만으로는 구분 불가.
- 이번 구현은 §10.2 문구를 그대로 코드화했을 뿐이므로 target 자체의 신규 결함은 아니며, **기존에 이미 존재하던 spec 간 불일치**를 이번 커밋이 코드 레벨로 고착시킨 것 — impl-prep 단계 사전 검토(`review/consistency/2026/07/05/18_21_17/cross_spec.md`)에서 동일하게 WARNING 으로 이미 식별되었고, 실제 구현도 그 지적대로 §10.2(새 탭)을 채택했다.
- **제안**: 두 링크의 탭 동작 통일이 필요한지는 project-planner 재량 결정 사항 — 이번 V-14 범위에서 처리할 필요는 없다(모달은 "입력을 비교하며 원본을 참조"하는 맥락이라 새 탭이, chain badge 는 "페이지 이동"이 맥락상 자연스러울 수 있어 의도적 차이일 가능성도 있음). 후속 조치가 필요하면 별도 plan 으로 분리하고, 그 경우 두 spec 문서를 동시 갱신할 것.

---

## 검증됨 — 충돌 없음 (확인 완료)

1. **`TriggerParameterDefinition` 스키마 계약 일치** — `0-common.md` §1 의 `{ name, type: 'string'|'number'|'boolean'|'object'|'array', required?, defaultValue?, description? }` 정의, `1-manual-trigger.md` 의 `config.parameters` 사용법, target 코드의 `TriggerParameterDefinition` 로컬 타입 정의가 완전히 일치. `manualNode?.config?.parameters` 접근 방식도 `NodeData.config: Record<string, unknown>` 기존 타입과 충돌 없음.
2. **타입 coercion 정합성** — 프론트 `coerceInput()`(number→`Number()`, object/array→`JSON.parse` 시도, 실패 시 raw 유지)이 만든 native-typed 값을, 백엔드 `coerce-type.ts` 의 `coerceToType()` 이 이미 값이 native 타입이면 그대로 통과시키는 분기(`if (typeof value === 'number') return value` 등)를 갖고 있어 이중 처리 시 문제 없음. `resolve-trigger-parameters.ts` 의 `resolveTriggerParameters()` 도 동일 경로로 `inputOverride` 를 검증·coerce — §8.1 "resolveTriggerParameters 와 동일한 검증을 거침" 계약과 부합.
3. **API 계약(§8.1)** — `POST /api/executions/:executionId/re-run` request body `inputOverride?: Record<string, unknown>` 는 임의 값 타입을 이미 허용하는 shape 이라, typed form 이 number/boolean/object/array 네이티브 값을 채워 보내도 request shape 변경 불요. `useOriginalInput` 도 코드에서 매 제출 시 항상 명시 전송(§10.2 "프론트엔드는 토글 상태로부터 useOriginalInput 을 항상 명시 전송" 규정과 일치).
4. **필드 도출 우선순위** — 코드는 `manual_trigger` 노드의 `config.parameters` 스키마가 있으면 그것으로 필드를 만들고, 없으면(노드 삭제/미로딩) 원본 `inputData.parameters` 키를 text fallback 으로 렌더 — §10.2 "필드 라벨/타입은 워크플로의 manual_trigger 노드 config 에서 도출" 규정 그대로이며, "데이터 은닉 회피"라는 부가 안전장치는 spec 미기술이지만 spec 과 모순되지 않는 보강.
5. **라우팅 패턴** — 새 링크 `href="/workflows/${original.workflowId}/executions/${original.id}"` 는 §10.2 "재실행" 버튼의 기존 라우팅 패턴(`/workflows/:workflowId/executions/:newId`)과 동일한 URL 스킴을 재사용 — 새 계약 아님. `original.workflowId` 는 `ReRunModalProps` 에 이미 존재하던 필드(diff 신규 아님)이므로 props 계약 변경 없음.
6. **요구사항 ID** — 새로 부여된 요구사항 ID 없음(V-14 는 plan 라벨일 뿐). 기존 `RR-PL-01~07` 네임스페이스, `RERUN_*` 에러 코드 네임스페이스와 충돌 없음.
7. **상태 전이·권한·RBAC** — 본 변경은 입력 폼 렌더링과 링크 방식만 다루며 Re-run 의 상태 머신(§9 chain 모델), 권한 게이트(RR-PL-06), Rate limit(§12) 에는 관여하지 않음 — 충돌 대상 없음.
8. **plan 문서 갱신** — `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 의 V-14 항목이 "spec 변경 불요(§10.2 이미 명시)"로 정확히 기록됨 — spec 과 plan 서술 간 불일치 없음.

---

## 요약

target 구현(원본 ID 새 탭 링크 + manual_trigger 스키마 기반 typed 동적 폼)은 `spec/5-system/13-replay-rerun.md §10.2/§8.1/§9`, `spec/4-nodes/7-trigger/{0-common,1-manual-trigger}.md`, `spec/5-system/4-execution-engine.md §6.1.1` 의 데이터 모델·API 계약과 완전히 정합하며, 백엔드 `coerceToType`/`resolveTriggerParameters` 가 이미 native-typed 값 수용 경로를 갖추고 있어 별도 backend 변경 없이 안전하다. CRITICAL 급 데이터모델·API 계약·상태전이·권한 충돌은 발견되지 않았다. 유일한 소음은 원본 ID 새 탭 링크(§10.2)가 자매 문서 `14-execution-history.md §3.7` chain badge 의 "새 탭 아님" 명시와 반대 방향이라는 점인데, 이는 서로 다른 UI 요소를 가리키는 **기존에 이미 존재하던 spec 간 불일치**를 이번 구현이 코드로 고착시킨 것이지 target 이 새로 만든 모순은 아니다(impl-prep 사전 검토에서도 동일하게 식별·WARNING 처리됨). 구현을 막을 이유는 없다.

## 위험도

LOW
