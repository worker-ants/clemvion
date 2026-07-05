# Cross-Spec 일관성 검토 — V-14 fix-round impl-done (rerun-modal.tsx)

대상: `git diff origin/main...HEAD` — 2 커밋.
1. `4b9a3abac` feat(executions): V-14 Re-run 모달 원본 ID 링크 + typed 입력 폼
2. `31058b3a2` refactor(executions): V-14 ai-review 조치 — 스키마 전환 재조정 + coerceInput boolean

핵심 변경 파일: `codebase/frontend/src/components/executions/rerun-modal.tsx`
(a) 원본 실행 ID → `/workflows/:workflowId/executions/:id` 새 탭 링크(`target="_blank"`)
(b) 입력 폼을 워크플로 `manual_trigger` 노드 `config.parameters` 스키마(`TriggerParameterDefinition[]`) 기반 typed 동적 폼으로 전환 (string/number/boolean/object/array)
(c) 스키마 부재 시 원본 `inputData.parameters` 키를 untyped text 로 fallback
(d) **fix-round 추가분**: fallback(all-string) → 스키마 로드 후 typed 전환 시, 잔류 raw string 값을 필드 타입으로 1회 재조정하는 `useEffect([fields])` + `coerceInput` 에 `boolean` 분기 추가

검증 대상 spec: `spec/5-system/13-replay-rerun.md` §8.1(API 계약) / §9(데이터 모델) / §10.2(모달 UI), `spec/4-nodes/7-trigger/1-manual-trigger.md`, `spec/4-nodes/7-trigger/0-common.md` §1(TriggerParameterDefinition 계약), `spec/5-system/4-execution-engine.md` §6.1.1(`resolveTriggerParameters`), `spec/2-navigation/14-execution-history.md` §3.7(chain badge 원본 링크).

이 세션은 fix-round(`31058b3a2`)를 포함한 최종 diff 전체를 대상으로 하며, 직전 impl-prep/구현 단계 cross_spec 리뷰(`review/consistency/2026/07/05/18_21_17/cross_spec.md`, `review/consistency/2026/07/05/18_37_10/cross_spec.md`)의 결론이 fix-round 이후에도 유지되는지 재확인한다.

---

## 발견사항

### [WARNING] 원본 ID 링크의 새-탭 동작이 자매 문서(chain badge)와 반대 방향 — 기존 spec 간 불일치가 코드로 고착 (재확인, 신규 아님)

- **target 위치**: `rerun-modal.tsx` 원본 ID `<a target="_blank" rel="noopener noreferrer" href="/workflows/${original.workflowId}/executions/${original.id}">`. spec 근거: `spec/5-system/13-replay-rerun.md` §10.2 필드 동작 표 "원본 실행 헤더" 행 — "ID 클릭 시 새 탭으로 원본 상세 페이지" (line 338)
- **충돌 대상**: `spec/2-navigation/14-execution-history.md` §3.7 Chain badge 행 — 원본 ID 클릭 시 같은 탭(`<Link href>`, `target=_blank` 없음)으로 명시. 실제 코드의 실행 상세 페이지 chain badge 원본 링크(`app/(main)/workflows/[id]/executions/[executionId]/page.tsx`)도 평범한 `<Link>` 로 새 탭이 아님.
- **상세**: 두 spec 이 가리키는 UI 요소(모달 헤더의 원본 링크 vs 실행 상세 페이지 chain badge 원본 링크)는 서로 다르지만, "원본 실행으로의 딥링크"라는 동일 개념에 대해 한쪽은 새 탭, 한쪽은 "명시적으로 새 탭 아님"으로 정반대로 못박아 둔 상태다. target 은 §10.2 문구를 그대로 코드화했을 뿐이므로 이번 diff 가 새로 만든 모순은 아니며, 기존에 이미 존재하던 spec 간 불일치를 코드 레벨로 고착시킨 것.
- 이 항목은 fix-round 커밋(`31058b3a2`)의 커밋 메시지에도 "raw `<a>`(new-tab 적절) — 조치불요 INFO" 로 재확인되어 있고, 이번 검토에서도 동일 결론 — 구현을 막을 사유는 아니다.
- **제안**: 두 링크의 탭 동작 통일 필요 여부는 project-planner 재량. 후속 조치가 필요하면 별도 plan 으로 분리하고 두 spec 문서(`13-replay-rerun.md` §10.2, `14-execution-history.md` §3.7)를 동시 갱신할 것.

---

## 검증됨 — 충돌 없음 (fix-round 포함 재확인)

1. **재조정 effect 가 API/데이터 모델 계약을 변경하지 않음** — `useEffect([fields])` 는 프론트엔드 로컬 `paramValues` state 만 조작하는 순수 UI 레이어 로직이다. 제출 시 최종적으로 백엔드에 보내는 shape 은 여전히 `inputOverride?: Record<string, unknown>` (§8.1) 이며, 재조정은 이 payload 에 실리는 값의 **타입 순도**만 높일 뿐 필드 구성이나 API 계약을 바꾸지 않는다.
2. **coerceInput 의 boolean 분기 추가가 backend coerce 경로와 충돌 없음** — `raw === "true"` → native boolean. `resolveTriggerParameters`/`coerceToType` (backend, `spec/5-system/4-execution-engine.md §6.1.1` 경유)는 이미 native-typed 값을 그대로 통과시키는 분기를 가지므로, 프론트가 이제 boolean 도 미리 native 로 변환해 보내는 것은 이중 처리 충돌 없음 — 오히려 스키마 계약(`0-common.md §1` type: 'boolean')과의 정합성이 이전보다 강화됨 (fallback 구간의 raw string "true"/"false" 잔류가 사라짐).
3. **fields 재계산 트리거 범위** — effect 의존성이 `[fields]` 뿐이라 `paramValues` 변경(사용자 타이핑)에는 재실행되지 않음 — §10.2 "사용자가 필드를 편집해 다른 입력으로 재실행 가능" 이라는 편집 가능성 계약을 침해하지 않음(활성 편집 값을 덮어쓰지 않음을 코드 주석과 diff 로 확인).
4. **테스트 보강분(object JSON round-trip, useOriginalInput ON 시 checkbox disabled)** 은 §10.2 "ON 으로 두면 폼 read-only" 계약과 §7 dry-run/§9 데이터 모델에 신규 결합을 만들지 않음 — 순수 회귀 가드 추가.
5. **요구사항 ID·상태 전이·권한/RBAC·계층 책임** — fix-round 는 새 요구사항 ID, 새 엔드포인트, 새 상태 필드를 도입하지 않으며 Re-run 상태 머신(§9 chain 모델)·권한 게이트(RR-PL-06)에도 관여하지 않음 — 이전 세션 결론(18_37_10 cross_spec 항목 6, 7)과 동일하게 유지.
6. **plan 문서** — `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 의 V-14 항목 갱신(diff 3라인 추가)이 "spec 변경 불요" 결론과 정합 — 확인.

---

## 요약

이번 fix-round(스키마 전환 재조정 effect + `coerceInput` boolean 분기)는 순수 프론트엔드 내부 state 정합화 로직으로, `spec/5-system/13-replay-rerun.md` §8.1(API 계약)·§9(데이터 모델)·§10.2(모달 UX), `spec/4-nodes/7-trigger/{0-common,1-manual-trigger}.md`(TriggerParameterDefinition 계약), `spec/5-system/4-execution-engine.md §6.1.1`(resolveTriggerParameters) 어느 것과도 새로운 모순을 만들지 않는다. 오히려 fallback→typed 전환 구간의 타입 오염 가능성을 없애 스키마 계약과의 정합성을 강화하는 방향이다. 유일한 소음은 이전 세션에서부터 이미 식별된 원본 ID 새 탭 링크(§10.2)와 `14-execution-history.md §3.7` chain badge(새 탭 아님) 간의 기존 spec 불일치이며, 이는 이번 fix-round 이전부터 존재했고 이번 커밋도 그 결론을 바꾸지 않는다. CRITICAL 급 데이터 모델·API 계약·상태 전이·권한 충돌은 발견되지 않았다.

## 위험도

LOW

STATUS=success
