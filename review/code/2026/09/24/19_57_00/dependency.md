# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 외부 패키지 신규 추가 없음
  - 위치: 변경 파일 전체 (`codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts`, `spec-frontmatter-parse.test.ts`, `spec-pending-plan-existence.test.ts`)
  - 상세: `git diff origin/main...HEAD --stat` 로 확인한 결과 이번 변경분(13개 파일)에는 `package.json`/lockfile 수정이 전혀 없다. 실제 코드 변경은 기존 `node:path`(이미 상단에서 import 되어 있던 모듈, 파일 2의 6번째 줄)의 `path.posix.normalize` 를 추가로 호출하는 것뿐이며, 새 외부 라이브러리 import 는 없다. 나머지 변경 파일은 `plan/in-progress/**.md`, `review/consistency/**` 로 순수 문서 산출물이다.
  - 제안: 해당 없음 (조치 불필요).

- **[INFO]** 내부 의존성 — 기존 공유 모듈 표면 확장, 새 결합 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts:97-101` (`export function isPendingPlanPath`), 소비처 `spec-frontmatter-parse.test.ts:2`, `spec-pending-plan-existence.test.ts:6`
  - 상세: `spec-pending-plan-existence.test.ts` 는 이미 같은 모듈(`./spec-frontmatter-parse`)에서 `collectApplicableSpecs`, `repoRoot` 를 import 하고 있었고, 이번 변경은 그 기존 import 구문에 `isPendingPlanPath` 하나를 추가한 것이다. 즉 새로운 모듈 간 의존 엣지가 생긴 게 아니라 기존에 이미 존재하던 공유 헬퍼 모듈의 export 표면이 넓어진 것뿐이다. 순환 의존이나 계층 위반 소지 없음.
  - 제안: 해당 없음.

- **[INFO]** 무관한 별도 작업(`deps-typeorm12`)의 lockfile `libc:` 필드 진동 이슈가 이 diff 의 plan 문서에 백로그로만 등재됨
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (`libc:` 필드가 dependabot 과 고정 pnpm 사이에서 진동한다 항목)
  - 상세: 이 항목은 이번 코드 변경(`isPendingPlanPath` 관련 3개 TS 파일)과 무관하며, 별도 태스크 `deps-typeorm12` 의 이전 `/ai-review`(`review/code/2026/09/24/18_22_23`)에서 이미 발견되어 followup 문서에 기록된 것을 그대로 옮긴 내용이다. 이번 diff 는 `package.json`/lockfile 을 건드리지 않으므로 해당 이슈가 재현되거나 악화되지 않는다.
  - 제안: 조치 불필요 — 이미 별도 백로그 항목으로 추적 중이므로 이 리뷰에서 중복 등재하지 않는다.

- **[INFO]** 라이선스/취약점/번들 크기/빌드 시간/버전 고정/충돌 — 해당 사항 없음
  - 위치: 전체 diff
  - 상세: 새로 추가되거나 버전이 변경된 외부 의존성이 없으므로 라이선스 호환성, npm 취약점(CVE), 번들 크기 증가, 빌드 시간 영향, 기존 의존성과의 버전 충돌 항목 모두 이번 변경 범위에서 평가 대상이 아니다.
  - 제안: 해당 없음.

## 요약

이번 변경분은 `package.json`/lockfile 을 전혀 건드리지 않는 순수 애플리케이션 코드(기존 공유 테스트 헬퍼 모듈에 `isPendingPlanPath` 함수 1개 추가) + 테스트 + plan/review 문서 변경이다. 새 외부 의존성 추가, 버전 변경, 라이선스·취약점·번들 크기 이슈가 전혀 없고, 내부 모듈 의존 관계도 기존에 이미 있던 import 구문에 export 하나를 얹은 수준으로 새 결합을 만들지 않는다. 별도 태스크의 lockfile `libc:` 필드 이슈가 plan 문서에 언급되지만 이는 이 diff 와 무관한 기존 백로그 항목이다. 의존성 관점에서 조치가 필요한 사항은 없다.

## 위험도

NONE
