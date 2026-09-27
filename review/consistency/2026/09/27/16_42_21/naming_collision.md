# 신규 식별자 충돌 검토 — `spec/2-navigation/` (impl-done)

## 검토 범위 재확인

- `spec/2-navigation/` 델타(`origin/main` 대비): **0개 파일**. 이 PR 은 해당 spec 영역을 수정하지 않았다.
- 실제 코드 diff(11 파일 / 372줄, `origin/main`↔HEAD 워킹트리 실측)는 절대경로 워킹트리에서 직접 확인했다. 요지:
  - `codebase/backend/src/common/utils/omit-undefined.ts` — JSDoc 주석 추가 (호출부 null 가드 안내), 신규 식별자 없음.
  - `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts` — 기존 필드 `description?: string` → `description?: string | null` (nullable 확장, `nullable: true` Swagger 옵션 추가).
  - `codebase/backend/src/modules/nodes/dto/update-node.dto.ts` — 기존 필드 `description?: string` → `description?: string | null`.
  - `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts` — 기존 필드 `ipWhitelist?: string[]` → `ipWhitelist?: string[] | null`.
  - `codebase/backend/test/patch-partial-body.e2e-spec.ts` — 기존 `it('A. …')`~`it('D. …')` 뒤에 `it('E1. …')`/`it('E2. …')`/`it('E3. …')` 세 케이스 추가.
  - `CHANGELOG.md` — Unreleased 섹션 1건 추가.
  - `plan/in-progress/patch-body-followups.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md` — plan 문서 갱신 (spec 아님).
  - 나머지는 `review/code/**`, `review/consistency/**` 산출물(리뷰 아티팩트, 신규 식별자 도입과 무관).

즉 이번 변경은 **기존에 이미 존재하던 필드(`description`, `ipWhitelist`)의 타입을 nullable 로 넓히는 것**이며, 신규 요구사항 ID·엔티티·DTO·endpoint·이벤트·ENV·spec 파일 경로 중 어느 것도 새로 도입하지 않는다.

## 관점별 확인 결과

1. **요구사항 ID 충돌** — 신규 ID 없음. `NAV-WF-07` 등 기존 ID 재사용/재정의 없음. 해당 없음.
2. **엔티티/타입명 충돌** — 신규 타입/DTO/인터페이스 없음. `UpdateWorkflowDto` / `UpdateNodeDto` / `UpdateAuthConfigDto` 는 기존 타입이며 필드 union 만 확장(`string` → `string | null`). 해당 없음.
3. **API endpoint 충돌** — 신규 endpoint 없음. 사용된 `PATCH /api/workflows/:id`, `PATCH /api/nodes/:id`, `PATCH /api/auth-configs/:id` 모두 `spec/2-navigation/1-workflow-list.md §3`, `spec/2-navigation/6-config.md` 에 이미 정의된 기존 endpoint 그대로다. 해당 없음.
4. **이벤트/메시지명 충돌** — webhook·queue·sse 관련 신규 이벤트명 없음. 해당 없음.
5. **환경변수·설정키 충돌** — 신규 ENV/config key 없음. 해당 없음.
6. **파일 경로 충돌** — 신규 spec 파일 없음(spec 델타 0). 코드 쪽 신규 파일도 없음 — 기존 파일 수정뿐이며, 새로 만든 유일한 서술 단위는 기존 e2e spec 파일 내부의 `it('E1'/'E2'/'E3')` 케이스 라벨인데, 같은 파일의 기존 `A`/`B`/`C`/`D` 라벨(`patch-partial-body.e2e-spec.ts:67,101,137,215`) 뒤를 순서대로 이어받아 중복·충돌 없음.

## 부가 확인 — `ipWhitelist` 의미 정합성

`spec/2-navigation/6-config.md:54` 는 이미 `ipWhitelist` 를 `create-auth-config.dto.ts`/`update-auth-config.dto.ts` 의 필드로 서술하고 있어, 이번 PR 이 그 필드의 의미를 바꾸거나 다른 의미로 재사용하는 것이 아니라 nullable semantics(값 삭제)를 명시적으로 광고에 반영한 것뿐임을 확인했다. 신규 식별자가 아니므로 충돌 대상이 아니다.

## 발견사항

없음 — 신규 식별자 충돌 관점에서 보고할 CRITICAL/WARNING/INFO 항목이 없다.

## 요약

이번 diff 는 `spec/2-navigation/` 이 정의한 기존 endpoint(`PATCH /api/workflows/:id`, `/api/nodes/:id`, `/api/auth-configs/:id`)와 기존 필드(`description`, `ipWhitelist`)의 nullable 처리를 코드·OpenAPI 문서에 뒤늦게 반영하는 좁은 범위의 버그 수정이며, 새 요구사항 ID·엔티티·DTO·endpoint·이벤트·ENV·config key·spec 파일 경로를 전혀 도입하지 않는다. `spec/2-navigation/` 자체의 델타도 0개 파일이라 신규 식별자 충돌이 발생할 표면이 애초에 없다.

## 위험도

NONE
