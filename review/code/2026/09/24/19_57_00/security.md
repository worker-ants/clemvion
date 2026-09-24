# 보안(Security) 코드 리뷰

## 대상 요약

이번 변경은 `spec-pending-plan-existence` 문서 가드에 신설 술어 `isPendingPlanPath()`
(`codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts`)를 추가하고, 관련 유닛
테스트(`spec-frontmatter-parse.test.ts`, `spec-pending-plan-existence.test.ts`)와 plan
문서(`plan/in-progress/pending-plan-is-plan.md`, `spec-draft-nullable-notation-followups.md`
트래커 항목 추가), 그리고 `/consistency-check --impl-prep` 산출물
(`review/consistency/2026/09/24/19_35_41/*`)로 구성된다. 런타임 애플리케이션 코드(API 엔드포인트,
DB 접근, 인증/세션, 외부 입력 처리)는 이번 diff에 포함되지 않는다 — 전부 vitest 기반 CI 문서 가드와
문서/리포트 산출물이다.

뮤테이션 검증 없이 정적 분석만 수행했다(저장소 파일을 고칠 필요가 없는 순수 읽기 리뷰).

## 발견사항

- **[INFO]** `isPendingPlanPath`/기존 존재-확인 로직의 신뢰 경계는 "저장소에 병합된 spec
  frontmatter"이지 외부 사용자 입력이 아니다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts:97-101`
    (`isPendingPlanPath`), 및 `codebase/frontend/src/lib/docs/__tests__/spec-pending-plan-existence.test.ts:56-65`
    (`fs.existsSync(path.join(root, planRel))`)
  - 상세: `planRel` 값은 `spec/**.md` frontmatter의 `pending_plans:` 배열에서 오며, 이는 PR
    리뷰를 거쳐 저장소에 커밋된 콘텐츠다 — 익명 사용자나 런타임 요청이 채우는 값이 아니다. 따라서
    `path.join(root, planRel)` 뒤의 `fs.existsSync` 자체가 "임의 파일 존재 여부를 노출하는
    오라클"이 되더라도, 공격자가 이미 저장소에 병합 권한을 가져야 트리거할 수 있고 노출되는 정보도
    "CI 테스트 통과/실패"라는 1비트뿐이라 실질 위험은 낮다. 오히려 이번 변경은 이전에 `plan/`
    바깥의 **모든** 존재 파일(`.sql` 마이그레이션 등)을 받아들이던 것을 `plan/in-progress/**.md`·
    `plan/complete/**.md`로 좁혀, 검증 표면을 축소하는 방향이다 — 보안 관점에서 회귀가 아니라 개선.
  - 제안: 조치 불요(정보 제공 목적). 향후 이 helper가 신뢰 경계 밖 입력(예: 사용자가 업로드한
    frontmatter, 외부 웹훅 payload 등)에 재사용될 가능성이 생기면 그때 `path.relative(root, ...)
    .startsWith("..")` 형태의 탈출 가드를 명시적으로 추가할 것.

- **[INFO]** `path.posix.normalize` 선-정규화가 `..` 트래버설을 올바르게 차단함(설계 의도대로 동작)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts:98` (`isPendingPlanPath`)
  - 상세: `plan/in-progress/../../codebase/x.md` → `normalize` 후 `codebase/x.md`가 되어
    `PENDING_PLAN_DIRS` 접두사 어디에도 매칭되지 않아 `false`를 반환한다. 테스트
    (`spec-frontmatter-parse.test.ts` "rejects paths that escape plan/ via `..`")로 이 분기가
    직접 커버된다. 정규화를 접두사 검사 **전에** 수행한 순서도 올바르다(원문 그대로 접두 검사부터
    하면 `..`가 통과했을 것이라는 커밋 메시지의 지적과 일치). 결함 없음 — 참고로 기록.
  - 제안: 없음.

- **[INFO]** 시크릿/자격증명 하드코딩 없음
  - 위치: 리뷰 대상 전체 (`codebase/frontend/src/lib/docs/__tests__/*`, `plan/**`,
    `review/consistency/2026/09/24/19_35_41/*`)
  - 상세: `secret-store.md`·`error-codes.md` 등은 전부 문서 **파일명**을 가리키는 산문 인용이며,
    실제 토큰/키/비밀번호 값은 diff 어디에도 없다 (`grep -iE
    "password|secret|token|api[_-]?key|private[_-]?key|BEGIN (RSA|PRIVATE)"` 로 전수 확인).
  - 제안: 없음.

- **[INFO]** 인젝션 벡터 없음
  - 상세: 신규/변경 코드는 문자열 접두사·확장자 비교(`startsWith`, `endsWith`)와
    `path.posix.normalize`만 사용한다. SQL·쉘·템플릿 실행·정규식 동적 조립이 diff에 포함되지
    않는다 (`child_process`/`exec`/`eval`/`process.env`/동적 `require` 등 패턴 전수 grep 결과
    0건). `review/consistency/**` 산출물은 정적 마크다운/JSON 리포트로, 실행 경로가 없다.
  - 제안: 없음.

## 요약

이번 diff는 CI 전용 문서 정합성 가드(vitest)에 새 순수 술어 `isPendingPlanPath`를 추가해
`pending_plans:` 항목의 허용 범위를 "디스크에 실존하는 아무 파일"에서
"`plan/in-progress/**.md`·`plan/complete/**.md`"로 좁히는 변경이며, 관련 plan 문서와 이전
consistency-check 리포트 산출물이 함께 커밋되었다. 애플리케이션 런타임 코드(엔드포인트, DB, 인증,
사용자 입력 처리)는 전혀 건드리지 않고, 신뢰 경계는 시종일관 "PR 리뷰를 거친 저장소 콘텐츠"에
머문다. 하드코딩된 시크릿, 인젝션 벡터, 인증/인가 우회, 안전하지 않은 암호화, 민감정보 노출 에러
처리, 취약 의존성 도입 — 점검 관점 8개 항목 전부에서 유의미한 결함을 찾지 못했다. 유일하게 언급할
가치가 있는 지점(`fs.existsSync` 존재-오라클)은 이번 변경으로 오히려 축소되었고, 신뢰 경계상
실질 위험도 낮아 INFO로만 기록한다.

## 위험도

NONE
