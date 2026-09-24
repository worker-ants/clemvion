# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 20개 trigger) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(155~219행) 을 Read 했다.

## 변경 파일 목록 (prompt 기준)

1. `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` — unit 테스트 보강 (TOCTOU 재현)
2. `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `removeMember()` DELETE 술어에 `role: Not('owner')` 추가 + `throwCannotRemoveOwner()` 헬퍼 추출
3. `codebase/backend/test/member-remove-concurrency.e2e-spec.ts` — 기존 e2e 파일에 재진입 시나리오 케이스 추가
4. `plan/in-progress/member-owner-toctou.md` — 신규 plan (developer 소유, `spec_impact: none`)
5. `plan/in-progress/spec-draft-nullable-notation-followups.md` — 트래커에 planner 소유 후속 항목 3건 등재 + 회고 노트
6~13. `review/consistency/2026/09/24/07_29_15/*` — 직전 `--impl-prep` consistency-check 산출물 (읽기 대상, 코드 변경 아님)

## 매칭 분석

매트릭스 20개 trigger 를 순회했다. glob 매칭 대상(`codebase/backend/src/nodes/**`, `codebase/frontend/src/**/*.tsx`, `codebase/channel-web-chat/src/**/*.tsx`, `codebase/frontend/src/content/docs/*/`, `codebase/backend/src/modules/system-status/system-status.constants.ts`, `codebase/backend/src/nodes/core/error-codes.ts`, `codebase/packages/expression-engine/**`, `spec/{2,3,4,5}-*/**`, `spec/conventions/**`) 중 어느 것도 이번 변경 set 의 파일과 겹치지 않는다. 변경은 전부 `codebase/backend/src/modules/workspaces/**` · `codebase/backend/test/**` · `plan/**` · `review/**` 아래에 있다.

유일한 semantic 후보는 `auth-session-flow-change` (`change_type: "인증·권한·세션 흐름 변경"`) 이다. 이 행의 JSON trigger 는 `{"globs": ["codebase/backend/src/modules/auth/**"], "match": "semantic"}` — 즉 glob 자체가 `modules/auth/**` 로 국한돼 있고, 이번 변경은 `modules/workspaces/**` 라 glob 이 애초에 겹치지 않는다. semantic 판단으로 넓혀 보더라도, 이 PR 이 건드리는 것은 "owner 는 제거할 수 없다" 는 **기존 규칙의 동시성 하 정합성**(TOCTOU 하드닝)이지 사용자 가시 흐름·정책의 변경이 아니다. 근거:

- `plan/in-progress/member-owner-toctou.md` §C 가 명시: `spec/5-system/1-auth.md` 는 이미 "대상이 Owner인 경우 거부된다" 를 서술하며, 이 PR 은 "그 문장을 동시성 하에서도 참으로 만드는 것" 이라 서술을 바꾸지 않는다 → `spec_impact: none`.
- `CANNOT_REMOVE_OWNER` 에러 코드는 신규가 아니다 — diff 상 이전 코드에서도 이미 `throw new ForbiddenException({code: 'CANNOT_REMOVE_OWNER', ...})` 로 동일 코드/메시지를 던지고 있었고, 이번 변경은 그 리터럴을 `throwCannotRemoveOwner()` 사설 헬퍼로 추출해 재사용했을 뿐이다 (`new-error-code`/`new-warning-code` trigger 불해당).
- API 응답 형태·라우트·에러 코드·UI 문자열 어느 것도 바뀌지 않았다 — 사용자가 관찰 가능한 유일한 차이는 "레이스 조건에서도 owner 가 지워지지 않는다" 는, 기존에 문서화된 불변식이 실제로 지켜지는 것뿐이다.

## 회색 지대로 검토했지만 기각한 항목

- `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 새로 등재된 3개 planner 후속 항목 — (1) `removeMember` owner 보호 메커니즘을 `spec/data-flow/12-workspace.md` 에 명문화, (2) `CANNOT_REMOVE_OWNER`/`OWNER_ROLE_PROTECTED`/`SOLE_OWNER_CANNOT_LEAVE` 를 `spec/5-system/3-error-handling.md` §1.9 에러 카탈로그에 등재, (3) `spec/5-system/1-auth.md` §3.2 표가 각주로 인해 GFM 렌더링이 깨지는 형식 결함. 세 항목 모두 이미 직전 `--impl-prep` consistency-check(`rationale_continuity`/`convention_compliance`/`cross_spec`) 가 잡아 트래커에 planner 소유로 등재된 것이며, `spec/` 문서 갱신은 본 매트릭스가 다루는 `codebase/frontend` 유저 가이드(MDX)·i18n dict·`backend-labels.ts` 범위 밖이다 (developer 가 `spec/` 을 직접 고칠 권한도 없다 — CLAUDE.md §Skill 체계). 본 리뷰어 영역에서는 누락으로 잡지 않는다.
- `codebase/frontend/src/content/docs/07-workspace-and-team/` 페이지가 owner 제거 관련 안내를 담고 있을 수 있으나, 이 PR 이 그 안내가 서술하는 사용자 가시 동작(owner 제거 불가)을 바꾸지 않았으므로 갱신 대상이 아니다.

## 요약

매트릭스 20개 trigger 중 이번 변경 set(백엔드 `workspaces` 모듈의 owner 보호 TOCTOU 수정 + unit/e2e 테스트 + plan 문서)에 매칭되는 항목은 없다. 가장 근접한 `인증·권한·세션 흐름 변경` 행은 glob 이 `modules/auth/**` 로 국한돼 있어 `modules/workspaces/**` 변경과 겹치지 않고, semantic 으로 판단해도 기존에 문서화된 규칙("owner 는 제거 불가")의 동시성 하드닝일 뿐 사용자 가시 흐름 변경이 아니어서(신규 에러 코드도 아님, `spec_impact: none`) 유저 가이드 MDX·i18n dict·backend-labels.ts 동반 갱신 의무가 발생하지 않는다. spec 문서(`data-flow/12-workspace.md`, `3-error-handling.md` 에러 카탈로그) 갱신 필요성은 이미 별도 consistency-check 가 잡아 planner 소유 트래커 항목으로 등재돼 있어 본 리뷰어 영역과 중복 지적하지 않는다.

## 위험도

NONE
