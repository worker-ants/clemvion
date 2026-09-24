# 정식 규약 준수 검토 — spec/5-system (impl-done, diff-base origin/main)

## 검토 전제 확인

- `spec/5-system` 델타: **0개 파일** (이 브랜치는 spec 을 바꾸지 않았다 — plan 이 `spec_impact: none` 으로 명시).
- 실 구현 diff: `codebase/backend/src/modules/workspaces/workspaces.service.ts` · `workspaces.service.spec.ts` ·
  `test/helpers/concurrency.ts` · `test/member-remove-concurrency.e2e-spec.ts` ·
  `test/integration-rotate-concurrency.e2e-spec.ts` — `removeMember()` 의 owner 보호 가드 TOCTOU 수정
  (`plan/in-progress/member-owner-toctou.md`).
- 위 diff 는 절대경로 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/member-owner-toctou-51309a`)에서
  `git diff origin/main...HEAD -- <path>` 로 직접 재확인했다(프롬프트 예산 절단분 대체).

이 조건에서 "정식 규약 준수" 점검은 spec 문서의 명명/포맷/구조 위반이 아니라, **코드 변경이 기존
spec/conventions 가 규정하는 명명·출력 형식·카탈로그 등재 규율을 새로 어기지 않는가**로 좁혀진다.

## 발견사항

- **[INFO]** `CANNOT_REMOVE_OWNER` 는 `error-codes.md`/`3-error-handling.md` §1 카탈로그 미등재 — 단, 이 PR 이 만든 갭이 아니다
  - target 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` (`throwCannotRemoveOwner()`, 이번 diff 는 기존 인라인 throw 를 헬퍼로 추출했을 뿐 코드 값·의미를 바꾸지 않았다)
  - 위반 규약: `spec/conventions/error-codes.md` §"어느 쪽을 택하든 [에러 처리 §1 카탈로그](spec/5-system/3-error-handling.md#1-에러-분류)에 등재한다. 등재되지 않은 코드는 소비자가 존재를 알 방법이 없다."
  - 상세: `grep -n "CANNOT_REMOVE_OWNER" spec/5-system/3-error-handling.md` 결과 0건. 반면 `spec/5-system/1-auth.md` §3.2 각주·§3.3 은 이 코드를 서술한다 — 카탈로그(3-error-handling.md)가 아니라 도메인 spec 본문에만 있는 상태다. `git show origin/main:codebase/backend/src/modules/workspaces/workspaces.service.ts` 로 확인하니 이 코드는 `ae8f9cfd9`(리포지토리 초기 이관 커밋) 이전부터 존재했고, 3-error-handling.md 의 자체 Rationale 이 "`SOLE_OWNER_CANNOT_LEAVE` 등 workspace role/membership 관리 코드는 별도 pass" 라고 이미 이 갭을 알고 defer 해 둔 상태다. 즉 **이번 PR 이 새로 만든 미준수가 아니라 기존에 알려진 backlog**다.
  - 제안: 이번 PR 의 스코프(TOCTOU 동시성 수정)에서 조치할 사안이 아니다. 조치가 필요하면 `project-planner` 가 위에서 언급된 "workspace role/membership 관리 코드 별도 pass" 트래커에 `CANNOT_REMOVE_OWNER` 등재를 추가하면 된다 — 이번 PR 을 막을 사유는 아니다.

## 세부 대조

1. **명명 규약** — 신규 식별자는 `throwCannotRemoveOwner()`(private 헬퍼, 기존 `throwMemberNotFound()` 패턴과 동형), `VACUITY_GUARD_MS`(SCREAMING_SNAKE export) 뿐이며 둘 다 저장소 기존 관례를 그대로 따른다. `role: Not('owner')` 술어·에러 코드 문자열(`CANNOT_REMOVE_OWNER`, `UPPER_SNAKE_CASE`)은 변경되지 않았다 — `error-codes.md` §1 의미 기반 명명 원칙 위반 없음.
2. **출력 포맷 규약** — 에러 응답 형태(`{ error: { code, message } }`, 403)는 변경 전과 동일하며 `2-api-convention.md` §5.3 의 "top-level code 교체"(사유가 엔드포인트 결과 자체·한 요청에 사유 하나) 패턴에 부합한다. 새 0-affected 분기가 추가한 재조회(`still`)도 응답 바디 형태에 영향을 주지 않는다(존재 확인 후 여전히 `code: 'CANNOT_REMOVE_OWNER'` 또는 `MEMBER_NOT_FOUND`만 던진다).
3. **문서 구조 규약** — `spec/5-system` 은 이 브랜치에서 변경되지 않았다. 기존 1-auth.md·2-api-convention.md 는 이미 Overview/본문/Rationale 3섹션 구조를 갖추고 있고 이번 PR 로 인한 구조 이탈은 없다.
4. **API 문서 규약(OpenAPI/Swagger)** — 이 엔드포인트(`DELETE /api/workspaces/:id/members/:memberId`)의 DTO·데코레이터는 변경되지 않았다. 새로 노출되는 응답 필드가 없다.
5. **금지 항목** — `spec/conventions/error-codes.md` §2 는 "이름 정확성 향상만을 위한 rename 금지"를 규정하는데, 이번 PR 은 rename 을 하지 않고 기존 코드 값을 그대로 재사용했다. `redis-keys.md`·`migrations.md`·`node-cancellation.md` 등 다른 conventions 가 다루는 표면(락 상수 도입 방식, 마이그레이션, 노드 취소)에는 변경이 닿지 않는다 — 신규 advisory lock·신규 마이그레이션·신규 큐는 없다(plan 자체가 "새 락을 들이지 않는다"는 것을 설계 핵심으로 삼는다).

## 요약

이번 PR 은 `spec/5-system` 문서를 전혀 변경하지 않는 순수 코드 동시성 수정(TOCTOU)이며, plan 이 `spec_impact: none` 으로 정확히 표시하고 있다. 새로 도입된 식별자(`throwCannotRemoveOwner`, `VACUITY_GUARD_MS`)와 에러 응답 형태는 기존 저장소 명명·출력 포맷 관례를 그대로 따르며, 새로운 에러 코드·audit action·API 표면·마이그레이션이 없어 `spec/conventions/**` 가 규정하는 카탈로그 등재·표기 규율에 새로운 위반을 만들지 않는다. 유일하게 눈에 띈 사항은 `CANNOT_REMOVE_OWNER` 가 `3-error-handling.md` §1 카탈로그에 아직 등재되지 않았다는 점인데, 이는 리포지토리 초기 이관 이전부터 있던 기존 갭이며 문서 자신의 Rationale 이 이미 "별도 pass" 로 defer 해 둔 항목이라 이번 PR 의 책임 범위 밖이다.

## 위험도

NONE
