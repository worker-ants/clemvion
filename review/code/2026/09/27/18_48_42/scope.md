# 변경 범위(Scope) 리뷰 — patch-null-validation (3R, HEAD `27191021c`)

## 검증 방법

- `git diff origin/main...HEAD --stat` 로 브랜치 전체(64개 파일)를 프롬프트 번들과 대조 — 누락·불일치 없음.
- 직전 라운드(1R `17_47_49`, 2R `18_13_53`) scope 판정(둘 다 위험도 NONE) 이후 새로 추가된 두 커밋 `634297632`(JSDoc)·`27191021c`(plan/tracker 보강 + `--impl-done` consistency 산출물)을 `git show`로 직접 열어 신규 변경분만 별도 검증.
- `codebase/` 하위 실제 diff 파일 목록을 `git diff --name-only`로 뽑아 plan이 선언한 43필드/14 DTO 스코프와 대조.
- `codebase/backend/test/patch-null-rejection.e2e-spec.ts` 전문을 직접 읽어 신규 e2e가 이 기능 검증에만 쓰이는지 확인.

## 발견사항

- **[INFO]** 3R에서 새로 추가된 두 커밋은 모두 `--impl-done` consistency-check(`review/consistency/2026/09/27/18_23_40`)가 낸 항목에 대한 최소 응답이다.
  - 위치: `codebase/backend/src/common/utils/optional-non-null.ts`(JSDoc 3줄 추가, 커밋 `634297632`), `plan/in-progress/patch-null-validation.md`·`plan/in-progress/spec-draft-nullable-notation-followups.md`(체크리스트·트래커 보강, 커밋 `27191021c`)
  - 상세: `git show 634297632`는 정확히 주석 3줄(응답 계약 검증자 `response-contract.ts`, 병합 짝 `omit-undefined.ts`와의 층 구분)만 추가하고 동작 코드는 한 글자도 바꾸지 않는다. `git show 27191021c`는 `plan/`과 `review/consistency/18_23_40/**`(harness 산출물)만 건드리고 `codebase/`는 0건이다. 둘 다 W1~W5 항목을 코드로 직접 구현하지 않고 JSDoc 한 곳과 planner 트래커 등재로만 처리해, 오히려 스코프를 확장하지 않으려는 방향의 최소 대응이다.
  - 제안: 조치 불필요.

- **[INFO]** 핵심 코드 변경(18개 `codebase/` 파일)은 plan이 선언한 스코프(신규 데코레이터 1개 + 43필드/14 DTO의 `@IsOptional()` → `@IsOptionalNonNull()` 교체 + 관련 테스트)와 정확히 일치한다.
  - 위치: `codebase/backend/src/common/utils/optional-non-null.ts`(신규), `optional-non-null.spec.ts`(신규), 14개 `*/dto/*.ts`, `update-me.dto.spec.ts`, `src/repo-guards/__tests__/patch-null-rejection.spec.ts`(신규), `test/patch-null-rejection.e2e-spec.ts`(신규)
  - 상세: `git diff --name-only -- codebase/`로 전수 확인한 결과 frontend·다른 backend 모듈·무관한 파일 변경은 0건이다. 각 DTO 파일 diff는 import 1줄 추가 + 데코레이터 치환뿐이며 재배열·포맷팅 잡음이 없다(1R·2R scope 리뷰가 이미 이 부분을 정밀 검증했고 이번 라운드에서 재확인해도 동일).
  - 제안: 조치 불필요.

- **[INFO]** 신규 e2e 파일(`test/patch-null-rejection.e2e-spec.ts`)을 전문 확인한 결과, 이 기능(43필드 null 거부 + 모델 설정 유효값/키 생략 경로) 검증에만 쓰이고 무관한 어서션·픽스처가 없다.
  - 위치: `codebase/backend/test/patch-null-rejection.e2e-spec.ts` 전체
  - 상세: `beforeAll`이 생성하는 리소스(폴더·워크플로·노드·인증설정·트리거·알림규칙·테스트데이터셋·스케줄·모델설정·어시스턴트세션)는 전부 `cases` 배열의 33개 null-거부 케이스와 마지막 모델 설정 happy-path 케이스가 실제로 사용한다. 미사용 픽스처·죽은 코드 없음.
  - 제안: 조치 불필요.

- **[INFO]** `review/code/**`·`review/consistency/**` 하위 42개 파일은 프로젝트 규약이 요구하는 리뷰/컨시스턴시 게이트의 필수 산출물이며 코드 스코프 침범이 아니다.
  - 위치: `review/code/2026/09/27/{17_47_49,18_13_53}/**`, `review/consistency/2026/09/27/{17_14_44,18_23_40}/**`
  - 상세: 전부 `## 정보 저장 위치` 규약이 지정한 위치(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`, `review/consistency/...`)에 정확히 놓여 있고, `codebase/**`를 건드리지 않는다. `18_23_40/_code_diff.patch`(1103줄)는 `--impl-done` 번들이 스냅샷한 코드 diff 그대로임을 직접 열어 확인했다 — 신규·중복 코드 변경이 아니다.
  - 제안: 조치 불필요.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 갱신은 이번 PR이 조사 중 발견한 스코프 밖 항목(§5.4 tri-state 모호성, `endpointPath`/`maxConcurrentExecutions` spec 서술 갭, IDOR 의심 등)을 직접 구현하지 않고 트래커에만 등재한 것 — 오히려 스코프를 좁게 지킨 결과다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md`
  - 상세: 이 문서는 `plan/in-progress/`에 있어 developer 쓰기 권한 범위 안이고(`spec/` 본문이 아님), 프런트매터·본문 갱신 모두 트래커 항목 텍스트에 국한된다. `spec/` 실제 파일은 이번 diff에 전혀 등장하지 않는다.
  - 제안: 조치 불필요.

## 저장소 상태

리뷰 중 저장소 파일을 수정하지 않았다 — `Read`/`Bash`(`git show`, `git diff --stat`, `git diff --name-only`)만 사용, 뮤테이션 없음.

## 요약

3R 스코프 리뷰는 1R(`17_47_49`)·2R(`18_13_53`) scope 판정(둘 다 위험도 NONE)의 결론을 재확인하며, 그 이후 새로 추가된 두 커밋(`634297632` JSDoc, `27191021c` plan/tracker 보강)까지 직접 열어 검증했다. 두 커밋은 `--impl-done` consistency-check가 낸 W1~W5 항목에 대해 코드 동작을 바꾸지 않는 주석 추가와 planner 트래커 등재로만 응답해, 스코프를 벗어나지 않았다. 브랜치 전체 64개 파일을 대조해도 의도 이상의 변경·불필요한 리팩토링·기능 확장(over-engineering)·무관한 파일 수정·포맷팅 잡음·불필요한 주석/임포트·설정 변경 중 어느 것도 발견되지 않았다. `codebase/` 하위 18개 파일은 plan이 선언한 43필드/14 DTO 스코프와 정확히 일치하고, 나머지 `plan/**`·`review/**` 46개 파일은 프로젝트 규약이 요구하는 부수 산출물(plan 문서, 코드 리뷰/컨시스턴시 게이트 산출물)이다.

## 위험도

NONE
