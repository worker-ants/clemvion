# 요구사항(Requirement) 리뷰 — M-8 1단계 review fix (triggersApi 유닛 테스트 + 타입/문서 강화)

리뷰 대상 커밋: `ac804f2a4510631b552dcbd96fa6d7a2dc2a91c8`
리뷰어: requirement (spec fidelity)

---

## 발견사항

### 1. **[INFO]** W-1/W-2/W-3 테스트 픽스 완료 — 이전 리뷰 요구사항 충족 확인

- 위치: `codebase/frontend/src/lib/api/__tests__/triggers.test.ts` (신설)
- 상세: 이전 리뷰(08_17_18)의 W-1(유닛 테스트 부재)/W-2(workflow 평탄화 4-way 미커버)/W-3(double-envelope 언래핑 미커버) 세 건이 `triggers.test.ts` 신설 12개 테스트로 완전히 이행됐다. `list`(params·paged 정규화·bare-array fallback), `getById`(workflowId 최상위/workflow 중첩/둘 다/둘 다 없음 4-way + 무-envelope 5-way), `update`/`create`(PATCH·POST URL·body), `rotateNotificationSecret`/`revokeInteractionToken`(`res.data.data` 이중 언래핑), `rotateBotToken`(전용 endpoint·body) — spec §3 의 모든 엔드포인트에 대응하는 테스트가 구성돼 있다.
- 제안: 없음 (완전 이행됨).

---

### 2. **[INFO]** `TriggerListParams.type`/`status` 리터럴 유니온 narrowing — spec §3 필터 계약과 일치

- 위치: `codebase/frontend/src/lib/api/triggers.ts` `TriggerListParams` (라인 89–95)
- 상세: `type?: "webhook" | "schedule" | "manual"`, `status?: "active" | "inactive"` 로 좁혀졌다. spec `§3 GET /api/triggers` 가 `type`, `status` 쿼리 파라미터를 허용하며, spec §2.2 필터 옵션 표(유형: 전체/Webhook/Schedule/Manual, 상태: 전체/Active/Inactive)와 정확히 일치한다. 이전 `string` 오픈 타입보다 spec 계약 충실도가 높아졌다.
- 제안: 없음 (spec 일치 확인됨).

---

### 3. **[INFO]** JSDoc 개선 — `TriggerListParams`/`create`/`TriggerListItem.workflow` 문서화

- 위치: `codebase/frontend/src/lib/api/triggers.ts` 라인 89, 149–151, 78
- 상세: `TriggerListParams` 인터페이스에 `/** GET /triggers 쿼리 파라미터 (Spec §3). */` JSDoc 추가. `create` 함수에 "응답 바디는 버린다 — 호출부가 queryKey 무효화로 재조회" 의도 문서화. `TriggerListItem.workflow` 필드에 "backend shape 편차 흡수" 주석 추가. 이전 리뷰 INFO #16/#17/#19 모두 이행됨.
- 제안: 없음.

---

### 4. **[INFO]** `page.tsx` `/workflows` apiClient 잔류 주석 — m-2 트랙 의도 명확화

- 위치: `codebase/frontend/src/app/(main)/triggers/page.tsx` 라인 229–230
- 상세: `/workflows` 도메인 호출이 `apiClient` 직접 잔류하는 이유("m-2 workflows 트랙에서 `lib/api/workflows.ts` 로 이전 예정")를 주석으로 명시했다. 이전 리뷰 INFO #10/#12/#15 이행됨. 이 변경 자체는 기능에 영향 없으나 후속 개발자의 오해를 방지한다.
- 제안: 없음.

---

### 5. **[INFO]** `getById` 워크플로우 평탄화 로직 — spec §2.3.1 workflowId/workflowName 필드 요구사항 충족

- 위치: `codebase/frontend/src/lib/api/triggers.ts` `getById` 함수 (라인 136–147)
- 상세: `TriggerDetail.workflowId` / `workflowName` 두 필드를 반환해야 하는 요구사항(spec §2.3.1 기본 정보 섹션 "연결된 워크플로우")에 대해, backend shape 편차(`workflowId` 최상위 vs `workflow.{id,name}` 중첩)를 클라이언트에서 흡수하는 구현이 이번 테스트로 검증됐다. 4-way + 무-envelope 5개 케이스 모두 올바른 폴백 우선순위를 확인했다.
  - `workflowId`: `raw.workflowId ?? raw.workflow?.id ?? ""`
  - `workflowName`: `raw.workflow?.name ?? raw.workflowName ?? ""`
  - 테스트 케이스 3("둘 다 있을 때") 검증 결과: `workflowId`는 최상위 값 우선, `workflowName`은 nested `workflow.name` 우선 — 이 우선순위는 spec 에서 명시적으로 정의되지 않으나 코드 일관성상 합리적이다.
- 제안: 없음 (기능 완성도 확인).

---

### 6. **[SPEC-DRIFT]** `lib/api/triggers.ts` 신설 — spec §3 API 표에 frontend typed 카탈로그 규약 미반영 (이월)

- 위치: `codebase/frontend/src/lib/api/triggers.ts` (신설 전체)
- 상세: 이전 리뷰(08_17_18) INFO #6/SPEC-DRIFT 에서 지적된 사항이 RESOLUTION.md 에서 "planner-only" 로 분류됐다. spec `2-trigger-list.md §3` API 표에 "frontend 구현은 `lib/api/triggers.ts` typed 카탈로그 경유" 패턴이 여전히 미반영이다. 코드 오류가 아니라 spec 갱신 누락이므로 SPEC-DRIFT 분류 유지.
- 제안: 코드 유지 + spec 반영. 갱신 대상: `/Volumes/project/private/clemvion/spec/2-navigation/2-trigger-list.md §3` 하단에 "frontend 구현은 `lib/api/triggers.ts` typed 카탈로그 경유" note 추가 및 frontmatter `code:` 목록에 `codebase/frontend/src/lib/api/triggers.ts` 등재. project-planner 트랙 처리.

---

### 7. **[INFO]** `TriggerUpdateBody`에 `config` 최상위 키 미포함 — spec §3 PATCH note 경미한 불일치 (의도적 유지)

- 위치: `codebase/frontend/src/lib/api/triggers.ts` `TriggerUpdateBody` (라인 116–124)
- 상세: spec §3 PATCH note 는 `config` 최상위 키도 허용하나, `TriggerUpdateBody` 에 `config` 키가 없다. RESOLUTION.md 에서 "의도적(R-4 단일 경로의 명시 키 사용)"으로 분류됐으며, drawer 카드들이 top-level `notification`/`interaction`/`chatChannel` 키로 직접 전송하므로 실제 동작 문제 없다. 이 변경에서 새로 발생한 사항이 아니므로 이월 관찰.
- 제안: 현재 범위에서 변경 불필요. spec `§3` PATCH note 의 `config` 키 항목 혼란 해소는 project-planner 주석 정리 대상.

---

### 8. **[INFO]** `create` 반환 `void` — 현재 요구사항(queryKey 재조회 패턴) 충족 확인

- 위치: `codebase/frontend/src/lib/api/triggers.ts` `create` 함수 (라인 153–155)
- 상세: `Promise<void>` 반환은 현재 `page.tsx`의 `createMutation.onSuccess`가 `queryClient.invalidateQueries({ queryKey: ["triggers"] })` + toast만 수행하는 패턴과 정합한다. JSDoc 에 의도가 문서화됐다("응답 바디는 버린다 — 호출부가 `triggers` queryKey 무효화로 재조회"). 테스트에서도 `create` 가 POST 를 올바른 URL·body로 호출함을 확인했다.
- 제안: 없음 (현재 요구사항 충족, 향후 UX 확장 시 시그니처 변경 필요).

---

### 9. **[INFO]** W-4/W-5/W-6/W-7 defer — behavior-preserving 범위 내 적절한 판단

- 위치: RESOLUTION.md Deferred 섹션
- 상세: Architecture/Maintainability 4건(뷰모델 매핑 잔류, 타입 이중화, chatChannel 오버-와이드 타입, god-component)을 M-8 2단계로 defer한 결정은 본 리팩터의 "behavior-preserving" 원칙에 부합한다. 이 판단은 이전 리뷰 자체가 직접 권고한 것이므로 기능 결함이 아니다. defer된 항목들이 M-8 2단계 계획에 명시적으로 등재돼 있는지는 plan 파일로 추적 필요하나, 본 리뷰 범위 내에서는 이상 없다.
- 제안: 없음.

---

## 요약

이번 커밋(M-8 1단계 review fix)은 이전 리뷰(08_17_18) Warning 7건 중 즉시 수정 대상 3건(W-1/W-2/W-3 Testing)을 `triggers.test.ts` 12개 테스트로 완전히 이행했으며, INFO 6건(타입 narrowing·JSDoc·주석)도 적절히 처리했다. `TriggerListParams` 리터럴 유니온은 spec §3·§2.2 필터 정의와 정확히 일치하고, `getById` workflow 평탄화 4-way·무-envelope 케이스도 테스트로 검증됐다. spec fidelity 관점에서 `2-trigger-list.md §3` API 표에 frontend typed 카탈로그 패턴이 미반영된 SPEC-DRIFT(이전 리뷰에서 planner-only로 분류)가 유일한 미해결 항목이며, 이는 코드 오류가 아닌 spec 갱신 누락이다. W-4/W-5/W-6/W-7의 defer 결정은 behavior-preserving 원칙과 이전 리뷰 권고에 부합하며 기능 결함을 유발하지 않는다. 전체적으로 이번 변경은 M-8 1단계 review fix 의 의도한 기능 요구사항을 완전히 충족한다.

---

## 위험도

NONE
