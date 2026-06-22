# Cross-Spec 일관성 검토 결과

검토 대상: `spec/2-navigation` (--impl-done, diff-base=origin/main)
실제 변경 범위: `codebase/frontend/src/lib/api/triggers.ts` 신설 + `triggers/page.tsx` · `trigger-detail-drawer.tsx` 의 `apiClient` 직접 호출을 `triggersApi` 로 이관. `spec/2-navigation` 파일 자체는 변경 없음.

---

## 발견사항

### [WARNING] `TriggerListParams` 에 `search` 파라미터 누락 — spec §3 API 계약 부분 불일치

- **target 위치**: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/lib/api/triggers.ts` `TriggerListParams` 인터페이스 (L89–95)
- **충돌 대상**: `spec/2-navigation/2-trigger-list.md §3` — `GET /api/triggers` 의 쿼리 파라미터 목록: `type, status, search, page, limit, sort, order`
- **상세**: spec §3 은 `search` 파라미터를 명시하나, 신설된 `TriggerListParams` 에는 `search` 가 없다. `sort`·`order` 도 마찬가지로 누락됐다. 현재 `triggers/page.tsx` 의 queryFn 이 search/sort/order 파라미터를 보내지 않으므로 런타임 동작상 문제는 없지만, 타입 정의가 spec 의 전체 파라미터 목록보다 작게 정의되어 후속 구현자가 `TriggerListParams` 를 SoT 로 오인할 경우 search/sort 파라미터를 추가해도 타입 오류 없이 전달된다는 착각을 유도할 수 있다. (`triggers/page.tsx` 가 검색 기능을 클라이언트사이드 필터로 처리하고 있어 `search` 를 실제로 보내지 않는 것은 spec 의 "sort/order 반영 미구현/Planned" 주석과 동일한 "known gap" 이지만, 타입 파일이 이를 명시하지 않아 ambiguity 가 생김.)
- **제안**: `TriggerListParams` 에 `search?: string; sort?: string; order?: "asc" | "desc"` 를 선택적 필드로 추가하거나, 파일 주석으로 "현재 클라이언트는 search/sort/order 를 전송하지 않음 — spec §3 참고" 를 명시해 의도적 생략임을 문서화한다. spec 자체는 현행 그대로 유효.

---

### [WARNING] `spec/2-navigation/2-trigger-list.md` 의 `code:` 프런트매터에 `codebase/frontend/src/lib/api/triggers.ts` 미등록

- **target 위치**: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/spec/2-navigation/2-trigger-list.md` 프런트매터 `code:` 목록
- **충돌 대상**: 동일 파일 자신 (프런트매터 완결성 규약 — `spec/conventions/spec-impl-evidence.md` SoT)
- **상세**: 이번 구현으로 `codebase/frontend/src/lib/api/triggers.ts` 가 트리거 목록 화면의 실질적 API 계약 파일로 신설됐다. 기존 `code:` 목록(`page.tsx`, `components/triggers/*.tsx` 등)은 컴포넌트 레이어를 가리키며 API 레이어 파일(`lib/api/`)은 포함되지 않는다. 유사한 선례(`spec/conventions/node-cancellation.md` 가 `lib/api/executions.ts` 를 `code:` 에 포함)와 비교하면 등록 권장 대상이다.
- **제안**: `spec/2-navigation/2-trigger-list.md` 프런트매터 `code:` 에 `codebase/frontend/src/lib/api/triggers.ts` 추가. 단 spec 은 project-planner 관할이므로 developer 가 수정 시 일관성 규약 확인 필요.

---

### [INFO] `trigger-delete-dialog.tsx` 는 `triggersApi` 로 이관되지 않고 `apiClient.delete` 직접 호출 잔류

- **target 위치**: `codebase/frontend/src/components/triggers/trigger-delete-dialog.tsx` L69 — `await apiClient.delete(\`/triggers/${id}\`)`
- **충돌 대상**: `codebase/frontend/src/lib/api/triggers.ts` 의 `triggersApi` 카탈로그 — `DELETE /api/triggers/:id` 엔드포인트가 `triggersApi` 에 없음
- **상세**: 이번 리팩터는 `page.tsx`·`trigger-detail-drawer.tsx` 의 `apiClient` 직접 호출을 `triggersApi` 로 이관했다. 그러나 삭제 다이얼로그(`trigger-delete-dialog.tsx`)의 `DELETE /api/triggers/:id` 호출은 `triggersApi` 에 추가되지 않고 `apiClient.delete` 직접 호출로 잔류한다. `triggersApi` 를 트리거 도메인 API 카탈로그 단일 진실로 정의한 이번 리팩터 의도와 불일치가 생긴다. (`page.tsx` 가 이미 `apiClient` 직접 호출을 `/workflows` 조회에 대해서는 "m-2 workflows 트랙에서 이전 예정" 주석으로 명시한 것과 달리, delete 는 같은 도메인임에도 주석 없이 잔류.)
- **제안**: `triggersApi.delete(id)` 를 추가하고 `trigger-delete-dialog.tsx` 를 이관하거나, 주석으로 의도적 미이관을 명시한다. spec 변경 불필요.

---

### [INFO] `TriggerUpdateBody` 에 `config` 최상위 키 누락 — spec §3 PATCH body 계약의 선택적 키

- **target 위치**: `codebase/frontend/src/lib/api/triggers.ts` `TriggerUpdateBody` 인터페이스 (L116–124)
- **충돌 대상**: `spec/2-navigation/2-trigger-list.md §3` PATCH body 설명 — `config` (그 외 JSONB 키의 부분 갱신)가 허용 키 중 하나로 명시
- **상세**: spec §3 의 `PATCH /api/triggers/:id` 본문 허용 키 목록에 `config` 가 포함되나, `TriggerUpdateBody` 에 해당 키가 없다. 현재 컴포넌트 코드가 `config` 를 직접 PATCH body 로 보내는 경로가 없으며 `notification`/`interaction`/`chatChannel` 가 top-level 키로 이미 분리됐으므로 런타임 이슈는 없다. 단 타입 정의가 spec 의 전체 허용 키보다 좁아 불완전한 인터페이스다.
- **제안**: `TriggerUpdateBody` 에 `config?: Record<string, unknown>` 을 선택적 키로 추가하거나 주석에서 의도적 생략을 명시.

---

## 요약

이번 변경은 `spec/2-navigation/2-navigation` spec 파일 자체를 수정하지 않고 `codebase/frontend/src/lib/api/triggers.ts` 를 신설하여 트리거 도메인 API 호출을 타입 카탈로그로 정리한 순수 리팩터이다. spec 과의 직접 모순(CRITICAL)은 발견되지 않았다. 주요 발견사항은 두 가지 WARNING: (1) 신설 `TriggerListParams` 가 spec §3 이 명시하는 `search`/`sort`/`order` 쿼리 파라미터를 포함하지 않아 타입과 spec 계약이 부분 불일치하며, (2) 신설 파일 `lib/api/triggers.ts` 가 spec 프런트매터 `code:` 에 등록되지 않아 spec-impl 트레이서빌리티가 약화된다. 두 INFO 항목은 `DELETE` 엔드포인트 미이관과 `config` 키 타입 누락으로, 기능 회귀 없이 코드 일관성·완결성에 관한 권고다. spec 영역 간 직접 충돌(엔티티 모순, RBAC 불일치, 상태 전이 불일치, 요구사항 ID 충돌)은 없다.

## 위험도

LOW

STATUS: SUCCESS
