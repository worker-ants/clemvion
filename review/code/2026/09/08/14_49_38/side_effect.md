# 부작용(Side Effect) 코드 리뷰

## 발견사항

- **[INFO]** 전역 예외 필터의 판정 범위 확대 — 앱 전체에 영향을 주는 동작 변경(의도적, 측정됨)
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` (`catch()` 메서드, `else if (isPostgresUniqueViolation(exception))` 분기)
  - 상세: `@Catch()` 전수 필터라 애플리케이션의 **모든** 미처리 예외를 지난다. 종전 로컬 `isUniqueViolation`은 `err instanceof QueryFailedError`를 먼저 요구해 TypeORM이 감싸지 않은 raw 표면(`err.code === '23505'`)을 통과시키지 못하고 500으로 떨어뜨렸는데, 이번 변경은 `isPostgresUniqueViolation`(두 표면 모두 인식)으로 교체해 그 raw 표면도 409로 승격시킨다. 즉 지금까지 500을 받던 특정 형태의 예외(코드 어디선가 `Object.assign(new Error(...), { code: '23505' })` 형태로 던져진 것이 있었다면)가 이제 조용히 409로 바뀐다 — 이는 전역 필터이므로 이 커밋이 손대지 않은 다른 모듈의 예외 처리 동작에도 영향을 줄 수 있는 넓은 반경의 변경이다. CHANGELOG(`## Unreleased — 가장 넓은 fallback...`)가 "실측한 blast radius는 0"이라고 명시하고, 양방향 회귀 테스트(23505→409, 23502→500 유지)를 새로 추가해 뒷받침하므로 의도치 않은 부작용이라기보다 문서화·검증된 의도된 확장이다.
  - 제안: 조치 불요 — 이미 CHANGELOG에 등재되고 회귀 테스트로 양방향이 고정되어 있다. 향후 이 분기를 다시 좁힐 때는 CHANGELOG의 "raw 표면 23505→409" 서술과 어긋나지 않는지 확인할 것.

- **[INFO]** 공개 타입 이름 변경(`WorkflowVersionDetail` → `WorkflowVersionDetailProjection`) — backend 내부 참조 확인 완료, 영향 없음
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` (exported type 선언부, `findOne` 반환 타입 시그니처)
  - 상세: exported type의 이름이 바뀌었으므로 이 심볼을 import하는 다른 파일이 있었다면 컴파일 에러가 났을 것이다. `grep -rn "WorkflowVersionDetail\b" codebase/backend/src` 로 직접 확인한 결과 이 파일 자신의 JSDoc 주석 외에는 backend 어디서도 참조하지 않았고, `WorkflowVersionDetailProjection` 도 같은 파일 두 곳(타입 선언·`findOne` 반환 타입)에서만 쓰인다. 프런트엔드의 동명 타입(`codebase/frontend/src/lib/api/workflows.ts`)은 원래도 별도 손-미러라 이 개명과 무관하게 독립적으로 존재한다.
  - 제안: 조치 불요. 확인용 근거만 기록.

- **[INFO]** `tsconfig.build.json` exclude 확장 — 빌드 산출물(dist) 구성 변경, 런타임 진입 경로 영향 없음 확인
  - 위치: `codebase/backend/tsconfig.build.json` (`exclude` 배열에 `"**/__test-utils__/**"` 추가)
  - 상세: 이 변경으로 `__test-utils__` 디렉터리(5파일, `common/` 3 + `modules/integrations/` 2)가 더 이상 `nest build` 산출물(dist)에 포함되지 않는다. 이는 "빌드 결과물이 바뀐다"는 관점에서 부작용 후보이지만, 같은 배치가 추가한 `production-build-devdep.spec.ts`의 `it.each` 캐너리가 이 exclude가 실제로 걸리는지(빌드 대상에서 사라졌는지)를 직접 검증하고, 이 디렉터리는 애초에 테스트 전용 순수 함수만 두는 관례(`workspace-id-fixtures.ts`·`oauth-config-mock.ts`의 정정 주석)라 런타임 진입 경로(`main.ts`)에서 소비되지 않는다. 타입체크 사각 우려도 `run-test.sh build`에 새로 편입된 `_cmd_typecheck_ratchets()`가 `tsconfig.json`(테스트 경로 포함) 기준으로 대신 커버한다.
  - 제안: 조치 불요.

- **[INFO]** `.claude/test-stages.sh`의 `cmd_build()`에 새 게이팅 단계 삽입 — CI/로컬 빌드 파이프라인의 실패 지점 이동
  - 위치: `.claude/test-stages.sh` — `cmd_build()` 함수, `_run_internal build && \` 다음 `_cmd_typecheck_ratchets && \` 삽입 지점(`_cmd_build_docker_images` 앞)
  - 상세: `&&` 체인이라 두 typecheck ratchet(backend/frontend) 중 하나라도 실패하면 이후 `_cmd_build_docker_images`가 실행되지 않는다. 이는 "빌드 성공 여부"라는 호출자(예: CI 워크플로, `run-test.sh`)가 관측하는 exit code의 의미를 넓히는 변경 — 종전에는 `nest build`/`vitest`류 빌드 실패만 `cmd_build` 실패로 이어졌는데, 이제 타입체크 ratchet의 증가/감소 판정 실패도 같은 실패 경로에 합류한다. `.claude/test-stages.sh`는 프로젝트 관례상 harness 스코프(`.claude/**`)이며 이 자체가 이번 배치(B-1)의 명시적 목적(#1292 CI 회귀 봉합)이므로 의도치 않은 부작용은 아니다.
  - 제안: 조치 불요. 다만 이 단계가 실패했을 때 "docker 이미지가 빌드되지 않았다"는 사실이 로그에서 원인(typecheck ratchet)과 함께 드러나는지는 실제 CI 1회 실행으로 재확인해 볼 가치가 있다(로컬 검증만으로는 CI 셸 환경 차이를 못 잡은 전례가 `#1292` 자체다).

- **[INFO]** `enclosingName` → `enclosingScopeName` 승격/이동 — 모듈 로컬 함수 제거 자체는 영향 없음, 신규 공개 함수 도입
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` (구 `enclosingName` 삭제) / `codebase/backend/src/common/__test-utils__/source-scan.ts` (신규 export `enclosingScopeName`)
  - 상세: 삭제된 `enclosingName`은 파일 로컬(비export) 함수라 외부 호출자가 없어 시그니처 변경 영향이 없다. 새 `enclosingScopeName`은 `source-scan.ts`(테스트 전용 공유 유틸)의 신규 공개 함수이며 두 소비처(`user-entity-exposure-guard.ts`, 신설 `endpoint-path-conflict-wrap-guard.ts`)가 동일한 알고리즘(메서드 우선 → 변수 fallback → `'<module>'`)을 공유하게 됐다. 알고리즘 자체는 기존 `enclosingName`과 동일하다는 것을 diff로 확인했다(순서·분기 동일) — 이관 과정에서 의미가 바뀌지 않았다.
  - 제안: 조치 불요.

## 요약

이번 배치(B-1~B-8, `codebase/backend`·`.claude`·`scripts`·`plan`·`spec`-인접 문서)의 실질 런타임 부작용 표면은 두 곳으로 좁다 — (1) `GlobalExceptionFilter`가 raw-surface `23505`도 409로 매핑하도록 넓어진 것(전역 필터이므로 반경이 앱 전체이지만 CHANGELOG에 blast-radius 0 실측과 양방향 회귀 테스트가 동반됨), (2) `WorkspacesService.listMembers`가 `relations`만 쓰던 쿼리에 `select` 투영을 추가한 것(반환된 부분 엔티티는 그 자리에서 즉시 `.map`으로 소비되고 별도로 저장(`.save()`)되지 않으므로 TypeORM의 "부분 로드 엔티티를 저장해 다른 컬럼을 null로 덮어쓰는" 전형적 부작용 패턴은 발생하지 않음을 코드로 확인했다). 그 외 변경은 harness 스크립트(`test-stages.sh`)의 빌드 파이프라인에 새 게이팅 단계 삽입, `tsconfig.build.json`의 exclude 확장(런타임 미사용 디렉터리), 테스트 전용 함수 이관/신규 export, exported 타입 개명(참조자 0건 확인) 등으로, 전역 변수·환경 변수·네트워크 호출·이벤트/콜백 변경은 diff 전체에서 발견되지 않았다(`process.env`·`fetch`·`global.`·`writeFileSync` 등 패턴 grep 결과 0건). 시그니처가 바뀐 자리(`WorkflowVersionDetail`→`…Projection`, `enclosingName` 삭제)는 모두 참조자를 직접 확인해 영향이 그 파일 내부로 닫혀 있음을 검증했다. 저장소 트리에는 리뷰 과정에서 어떤 뮤테이션도 가하지 않았다(`git status --short` 최종 확인 — 리뷰 산출물 디렉터리 외 변경 없음).

## 위험도

LOW
