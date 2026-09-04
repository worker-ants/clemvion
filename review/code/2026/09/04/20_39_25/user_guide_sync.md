# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 해당 없음

이번 changeset(커밋 `a65a4f85e`·`dc83c0312`·`c15489e61`·`5a7de8ab1`)은 `.claude/config/doc-sync-matrix.json` 의 어떤 trigger 도 동반 갱신 누락 없이 충족한다.

### 변경 파일 전수 (4개 커밋 union)

- `CHANGELOG.md`
- `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts`
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts`
- `plan/in-progress/spec-draft-nullable-notation-followups.md`
- `review/code/**`, `review/consistency/**` (리뷰 산출물, 매트릭스 밖)

`codebase/frontend/**` 파일은 이 changeset 어디에도 없다 (`git show --name-only` 4개 커밋 전수 확인).

### 매트릭스 매칭 판정

- **새 노드 추가 / 노드 schema 변경** — 미매칭. `codebase/backend/src/nodes/**` 글롭에 걸리는 파일 없음. `alerts` 모듈은 워크플로우 노드가 아니라 별도 `modules/alerts` 기능(알림 규칙)이다.
- **신규 UI 문자열(TSX)** — 미매칭. 변경 set 에 `.tsx` 파일 없음.
- **통합/제공자 변경** — 미매칭.
- **유저 가이드 신규 섹션 디렉토리** — 미매칭. `codebase/frontend/src/content/docs/*/` 신규 디렉토리 없음(`ls` 확인 — `01-`~`07-`, `99-faq` 그대로).
- **인증·권한·세션 흐름 / 표현식 언어 / 실행·디버깅 흐름 변경** — 미매칭.
- **신규 warningCode/errorCode** — 미매칭. `warningRules`·`error-codes.ts` 변경 없음.
- **백엔드 API 추가·변경** (`codebase/backend/src/**/dto/**` 글롭, PROJECT.md 표 §142행) — **매칭됨.** `alert-rule-response.dto.ts` 가 이 글롭에 해당. 매트릭스 targets:
  - (a) "controller·DTO 의 swagger jsdoc" — **같은 changeset 안에서 충족.** diff 자체가 `@ApiProperty({ type: String, example: '10.0000' })` + 갱신된 JSDoc 을 포함(커밋 `a65a4f85e`, 이어서 `dc83c0312` 가 JSDoc 을 공개 description 누출 문제로 재정정).
  - (b) "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지" — 조건부 target. 확인 결과 `codebase/frontend/src/content/docs/**` 어디에도 Alert Rule(알림 규칙) 기능을 설명하는 페이지가 없다(`07-workspace-and-team/` 은 `password-and-sessions`·`security-2fa`·`system-status`·`workspaces-and-members` 4개뿐, `system-status.mdx` 는 `alerts-evaluator` 를 BullMQ 큐 이름으로만 1회 언급하고 threshold 필드 타입은 언급하지 않음). 갱신할 기존 페이지 자체가 없고, 이번 변경은 **wire 포맷 불변**(엔티티·프런트엔드 소비자는 이미 `string` 으로 취급 중이었음, CHANGELOG 명시)인 순수 OpenAPI 문서 정정이라 사용자 가시 동작 변화도 없다. 따라서 이 target 은 "적용 대상 없음" 이지 "누락" 이 아니다.

### 부수 확인 — spec 오기 후속 처리

`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 `spec/1-data-model.md:873` 이 `threshold` 를 `Float` 로 오기(誤記)하고 있다는 사실이 INFO#6 로 이미 등재돼 있고, developer 가 직접 spec 을 고치지 않고 `project-planner` 트랙으로 넘겨둔 상태다(CLAUDE.md §자기-반증형 소정정 5조건 미충족 — 이 문장은 developer 가 쓴 예고 문장이 아니라 원래부터 있던 데이터 모델 서술이므로 예외 대상이 아님). 같은 문서에 `spec/conventions/swagger.md` numeric 불변식 성문화 항목(W2)도 planner 트랙 TODO 로 등재돼 있다. 두 항목 모두 매트릭스 trigger 범위(frontend docs/i18n) 밖이며 적절히 후속 추적되고 있어 이 리뷰의 지적 대상이 아니다.

## 요약

매트릭스 20개 trigger 행 중 glob 매칭 1건("백엔드 API 추가·변경" — DTO 파일)이 성립했고, 그 target (a)는 같은 changeset 안에서 충족, target (b)는 갱신 대상 페이지 자체가 부재(사전 존재하지 않는 문서)+wire 불변으로 "해당 없음"에 해당해 누락으로 볼 수 없다. 나머지 19개 trigger 는 미매칭. `codebase/frontend/**`(docs MDX·i18n dict·backend-labels·locale.ts) 변경이 이 changeset 에 전혀 없으므로 parity 가드가 물 자리도 없다. 발견된 동반 갱신 누락 없음.

## 위험도

NONE
