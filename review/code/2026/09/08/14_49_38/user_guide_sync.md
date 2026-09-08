# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 22개 trigger 행) + `PROJECT.md` §변경 유형 → 갱신
위치 매핑 본문을 SSOT 로 적재했다.

## 변경 파일 컨텍스트

이번 배치(`spec-followups-batch-b`, B-1~B-8, 3커밋)의 실제 소스/문서 변경 파일(review/ 산출물·
plan 체크박스 갱신 제외):

- `.claude/test-stages.sh`, `PROJECT.md`, `CHANGELOG.md` — harness/문서 (매트릭스 target 아님)
- `codebase/backend/src/common/filters/http-exception.filter.{ts,spec.ts}` — `isUniqueViolation` 로컬 판정 → SoT `isPostgresUniqueViolation` 치환 (raw `err.code` 표면도 409 로 커버)
- `codebase/backend/src/modules/integrations/integration-oauth.service.ts` (+cafe24/makeshop spec) — 손-작성 constraint 추출식 → 기존 `pgErrorConstraint()` 헬퍼로 치환
- `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` — `WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 개명 (백엔드 내부 타입, wire 불변)
- `codebase/backend/src/modules/workspaces/workspaces.service.{ts,spec.ts}`, `codebase/backend/test/workspace-rbac.e2e-spec.ts` — `listMembers` 를 `relations:['user']` 전체 로드에서 DB `select` 투영으로 전환 (응답 6키 wire 불변)
- `codebase/backend/src/repo-guards/__tests__/**`, `common/__test-utils__/**`, `modules/integrations/__test-utils__/**` — 신규 AST 가드(`endpoint-path-conflict-wrap-guard.ts`)·헬퍼 승격·docstring 정정
- `codebase/backend/test/webhook-trigger.e2e-spec.ts` — 기존에 이미 spec 문서화된 `TRIGGER_ENDPOINT_PATH_CONFLICT`(§1.10) 에 대한 e2e 케이스 신규 추가
- `codebase/backend/tsconfig.build.json`, `scripts/check-{backend,frontend}-typecheck-ratchet.py` — 빌드/ratchet 설정
- `codebase/frontend/src/lib/api/workflows.ts` — 백엔드 개명에 따른 JSDoc 상호 참조 갱신 (타입 자체·UI 문자열 변경 없음)
- `plan/in-progress/{auth-guard-reflection-hardening,spec-draft-nullable-notation-followups,spec-followups-batch-b}.md` — plan 체크박스/서술 갱신

## 매칭 검토

1. **새 노드 추가 / 노드 schema 변경** — trigger glob `codebase/backend/src/nodes/**` 매치 파일 없음. 해당 없음.
2. **신규 UI 문자열(TSX)** — `.tsx` 변경 파일 없음(`workflows.ts` 는 `.ts` 이고 내용도 JSDoc 주석 갱신뿐, 신규 한국어 UI 리터럴 없음). 해당 없음.
3. **통합/제공자 변경** — `integration-oauth.service.ts` 가 유일한 integrations 모듈 변경이지만, 손-작성 constraint 추출식을 기존 `pg-error.ts` 의 `pgErrorConstraint()` 로 치환하는 **behavior-preserving 리팩터**다(같은 판정, 같은 에러 코드 `ALREADY_CONNECTED_BY_SERVICE['cafe24'|'makeshop']`, 같은 제약 이름 매칭). provider 설정 필드·인증 흐름·에러 코드·사용자 노출 동작 어느 것도 바뀌지 않았다 — `06-integrations-and-config/{cafe24,makeshop}.mdx` 갱신을 요구할 변경이 아니다.
4. **신규 섹션 디렉토리** — `codebase/frontend/src/content/docs/*/` 신규 디렉토리 없음. 해당 없음.
5. **인증·권한·세션 흐름 변경** — trigger glob `codebase/backend/src/modules/auth/**` 매치 파일 없음. `workspaces.service.ts` 의 `listMembers` 투영 전환은 `modules/workspaces/` 소속이고, 인증·인가 판정 로직이 아니라 **응답에 실리는 `User` 컬럼을 DB 레벨에서 좁히는 방어 강화**(민감 컬럼 유출 축소)다. 응답 wire(6키: id/userId/email/name/role/joinedAt)는 전환 전후로 동일함이 코드 주석·CHANGELOG·테스트 세 곳에서 명시적으로 확인된다 — `07-workspace-and-team/` 사용자 가이드가 서술할 "멤버 목록에 보이는 정보"에 변화가 없으므로 세션/권한 흐름 변경에 해당하지 않는다.
6. **표현식 언어 변경** — `codebase/packages/expression-engine/**` 변경 없음. 해당 없음.
7. **실행·디버깅 흐름 변경** — 실행 엔진·디버그 로깅 변경 없음(이번 배치는 예외 필터·워크스페이스 멤버 쿼리·오류 처리 리팩터). 해당 없음.
8. **신규 warningCode/errorCode 발행** — `http-exception.filter.ts` 변경은 **기존** `RESOURCE_CONFLICT`(409) 코드를 raw `err.code==='23505'` 표면에도 적용하도록 판정 함수를 SoT 로 교체한 버그 수정이지, 새 에러 코드를 발행하지 않는다. `webhook-trigger.e2e-spec.ts` B4 가 검증하는 `TRIGGER_ENDPOINT_PATH_CONFLICT` 도 `spec/2-navigation/2-trigger-list.md` §1.10 에 이미 문서화된 기존 코드다(naming_collision 체커가 동일 결론). `error-codes.ts`/`warningRules` 자체는 이번 배치에서 변경되지 않았다. 해당 없음.

## 발견사항

해당 없음 — 위 8개 관점 모두 trigger 미매칭. `WorkflowVersionDetailProjection` 개명은 프런트엔드 `lib/api/workflows.ts` 의 동명 타입 JSDoc 과 이미 같은 커밋에서 동반 갱신되어 있어(양쪽 다 diff 에 포함) 별도 지적 대상도 아니다.

## 요약

매트릭스 22개 trigger 행(신규 노드/스키마·UI 문자열·통합 제공자·신규 섹션·인증 흐름·표현식·실행 디버깅·신규 warning/error 코드 등) 중 이번 배치(B-1~B-8, harness/에러 처리 SoT 통합/`User` 노출 방어 강화/타입 개명 중심의 순수 developer 배치)의 변경 파일과 매칭되는 항목은 0건이다. 통합 서비스(cafe24/makeshop) 변경은 provider 동작을 바꾸지 않는 리팩터, 인증/워크스페이스 변경은 세션 흐름이 아니라 응답 컬럼 투영 강화, 예외 필터 변경은 신규 코드가 아니라 기존 `RESOURCE_CONFLICT` 판정의 커버리지 확장이라 어느 것도 유저 가이드 MDX·i18n dict·`backend-labels.ts` 동반 갱신을 요구하지 않는다.

## 위험도

NONE
