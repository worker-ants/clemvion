# 변경 범위(Scope) 코드 리뷰

## 발견사항

- **[INFO]** diff 가 138개 파일에 걸쳐 있으나, 138 중 108개는 이전 3회 `/ai-review` 라운드(`review/code/2026/09/08/{12_53_08,13_34_28,14_01_56,14_29_12}`)와 4회 `--impl-done` 라운드(`review/consistency/2026/09/08/{12_21_11,13_22_38,13_34_30,14_01_57,14_29_13}`)의 산출물이다.
  - 위치: `review/code/2026/09/08/**`, `review/consistency/2026/09/08/**` 전체
  - 상세: 이 저장소 관례상 `review/` 는 gitignored 가 아니고 fix→재리뷰 루프의 매 라운드 산출물이 그대로 커밋되는 것이 표준 워크플로다(`plan/in-progress/spec-followups-batch-b.md` 체크리스트가 라운드별 결과표로 이를 스스로 기록). 실질적인 "리뷰 대상 코드"는 30개 파일(`.claude/`·`CHANGELOG.md`·`PROJECT.md`·`codebase/**`·`plan/in-progress/**`·`scripts/**`)뿐이고, 이는 결함이 아니라 이 batch 가 3+4=7 라운드를 거쳤다는 규모의 자연스러운 부산물이다.
  - 제안: 조치 불요. scope 판정은 아래 실질 코드 변경 30개 파일 기준으로 수행함.

플랜 문서(`plan/in-progress/spec-followups-batch-b.md`)가 선언한 8개 항목(B-1~B-8)과 실제 diff 를 파일 단위로 전수 대조했다. `git diff origin/main...HEAD --stat` 로 커밋 경계(`ee96a90de` fork-point)를 확인하고, 프롬프트에서 생략된 대용량 diff(`source-scan.ts`, `integration-oauth.service.{cafe24,makeshop}.spec.ts`, `endpoint-path-conflict-wrap-guard.ts`, `spec-draft-nullable-notation-followups.md`, 두 typecheck-ratchet 스크립트)는 저장소에서 직접 `git diff` 로 열어 확인했다.

- **B-1** (`test-stages.sh`+`PROJECT.md`+두 ratchet 스크립트 docstring 정정) — 4개 파일 모두 build 단계 배선과 그 문서화에 국한. 스코프 일치.
- **B-2** (`tsconfig.build.json` exclude 확장) — 실제 exclude 추가 1곳 + 잘못된 전제("build tsc 가 컴파일한다")를 적고 있던 자매 3파일(`source-scan.ts`·`workspace-id-fixtures.ts`·`oauth-config-mock.ts`)의 docstring 정정(취소선+정정 형식) + `production-build-devdep.spec.ts` 파라미터화 테스트. 전제 반증에 따른 필연적 동반 수정이며 범위 밖 확장 아님.
- **B-3** (`http-exception.filter.ts` SoT 통합) — 로컬 `isUniqueViolation`+미사용 `QueryFailedError` import 제거, `isPostgresUniqueViolation` 치환, 양방향 회귀 테스트 2건, `CHANGELOG.md` 항목 1건. 스코프 일치.
- **B-4** (`listMembers` DB 투영) — 서비스 `select` 투영 추가, 대응 단위 테스트, 화이트리스트에서 항목 제거(`user-entity-exposure.spec.ts`), 관련 e2e 주석 정정(`workspace-rbac.e2e-spec.ts`, 취소선 방식), `CHANGELOG.md` 항목 1건. 스코프 일치.
- **B-5** (`pgErrorConstraint()` 치환) — 서비스 2곳 치환 + import 확장, cafe24/makeshop 두 spec 파일에 flat/wrapped 두 표면 파라미터화(플랜의 "리뷰 INFO#7" 반영). 스코프 일치.
- **B-6** (`endpointPath` save() 래핑 래칫) — 신규 가드 3파일(`endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`/fixture). 여기서 `enclosingScopeName` 을 `user-entity-exposure-guard.ts` 의 기존 로컬 `enclosingName` 과 통합해 `source-scan.ts` 로 승격했는데, 이는 신규 가드가 요구하는 것과 동일한 "스코프 이름 판정" 로직이 이미 형제 가드에 중복 존재하던 것을 리뷰(`13_34_28` architecture WARNING#1)가 지적해 통합한 것 — 새 기능이 필요로 하는 공유 유틸 승격이라 B-6 범위 내 정당한 리팩터링. `user-entity-exposure-guard.ts` 는 import 전환 외 알고리즘 변경 없음(`git diff` 로 확인: 로컬 함수 제거 + import 교체뿐).
- **B-7** (트리거 409 e2e) — `webhook-trigger.e2e-spec.ts` 에 신규 케이스 1건 추가만. 스코프 일치.
- **B-8** (`WorkflowVersionDetail` 개명) — 백엔드 타입 선언 1곳 + 사용처 1곳(`workflow-versions.service.ts`) 개명, 프런트엔드는 JSDoc 만 갱신(타입 자체는 프런트 소비처 유지 의도대로 안 건드림). `grep -rn "WorkflowVersionDetail\b" codebase/backend/src` 로 개명 후 잔여 참조가 docstring 한 줄(의도된 프런트 타입 언급)뿐임을 확인 — 부분 개명·누락 없음.

플랜 문서 3건(`spec-followups-batch-b.md` 신규, `spec-draft-nullable-notation-followups.md` 체크박스 갱신, `auth-guard-reflection-hardening.md` 상호 트리거 정정)은 위 8개 항목의 완료 기록과 크로스플랜 조정(다른 plan 의 동일 대상 처방과의 중복 해소)이며, 이번 배치가 새로 등재한 3개 planner 항목(`select` 투영 Rationale 등재·`swagger.md` 인용 오프바이원·`requestId` 형식)은 developer 권한 밖으로 옳게 `[ ]` 미체크 상태로 남겨져 있다.

diff 밖 확인: `package.json`/lockfile/`.github/workflows/**`/기타 설정 변경 없음. `git status --short` 는 이번 review 세션 자신의 미커밋 출력 디렉터리 2개만 보여 저장소 상태는 깨끗하다(리뷰 중 뮤테이션 없음).

## 요약

8개 독립 항목(B-1~B-8)이 계획 문서에 사전 선언돼 있고, 실제 diff 의 모든 코드/설정/문서 변경이 그 8개 항목 중 하나로 정확히 귀속된다. 유일하게 항목 경계를 넘는 것처럼 보였던 `enclosingScopeName` 공유 유틸 승격(B-6)은 신규 가드가 요구하는 로직의 중복 제거이자 직전 리뷰 라운드의 명시적 지적에 대한 대응이라 범위 내로 판단했다. 다수 파일(108/138)은 review/consistency 워크플로가 매 라운드 커밋하는 산출물로, 이 저장소가 명시적으로 채택한 관례(gitignore 미적용, 라운드별 기록)이지 스코프 오염이 아니다. 불필요한 포맷팅·주석·임포트 잡음, 요청 외 기능 확장, 무관한 파일 수정, 의도치 않은 설정 변경은 발견되지 않았다.

## 위험도

NONE
