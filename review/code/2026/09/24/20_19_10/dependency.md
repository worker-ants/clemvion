# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부 의존성·버전 변경 없음
  - 위치: 전체 diff (`git diff origin/main...HEAD --stat` 로 32개 파일 전수 확인)
  - 상세: 32개 변경 파일 중 `package.json`/`pnpm-lock.yaml` 등 의존성 매니페스트는 하나도 없다. 실질 코드 변경은 `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts` 에 순수 함수 `isPendingPlanPath`를 추가한 것뿐이며, 사용하는 `path`(`node:path`)는 그 파일 최상단에서 이미 import 되어 있던 Node 표준 모듈이다(`import path from "node:path";`, 새 diff 밖의 기존 줄). 새 import·새 패키지 선언이 전혀 없으므로 라이선스·CVE·번들 크기·빌드 시간·버전 충돌 항목은 이번 변경 범위에서 평가 대상이 아니다.
  - 제안: 해당 없음(조치 불필요).

- **[INFO]** 내부 의존성 — 기존 공유 헬퍼 모듈의 export 표면 확장, 새 결합 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts` (`isPendingPlanPath` 신설) → 소비처 `spec-frontmatter-parse.test.ts`, `spec-pending-plan-existence.test.ts`
  - 상세: `spec-pending-plan-existence.test.ts` 는 이미 같은 모듈(`./spec-frontmatter-parse`)에서 `collectApplicableSpecs`, `repoRoot` 를 import 하던 기존 소비처였고, 이번 변경은 그 import 구문에 `isPendingPlanPath` 하나를 추가한 것뿐이다. 새로운 모듈-간 의존 엣지가 아니라 4개 가드가 공유하는 이미 문서화된 헬퍼 허브의 export 하나가 늘어난 것이다. 순환 의존·계층 위반 소지 없음.
  - 제안: 해당 없음.

- **[INFO]** CHANGELOG.md 가 `#1388`(`@nestjs/typeorm` 12)를 의존성 버전 변경의 CHANGELOG 미기재 사례로 지목하지만, 그 버전 범프 자체는 이번 diff 범위 밖이다
  - 위치: `CHANGELOG.md`(diff 내 신규 문단), `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커 항목 "CHANGELOG 에 무엇이 들어가는지 성문 기준이 없다")
  - 상세: 두 문서는 `#1388` 이 항목 없이 머지된 것을 "판정이 아니라 고려하지 않았음"으로 인정하고 후속 트래커에 남겼다. 이 PR 자체는 `package.json`/lockfile 을 건드리지 않으므로 해당 의존성 버전 변경을 재현·악화시키지 않는다. 별도 태스크(`deps-typeorm12`)의 이력이며 이 diff 의 의존성 관점 판정에는 영향 없음.
  - 제안: 조치 불필요 — 이미 별도 트래커 항목으로 추적 중.

- **[INFO]** 같은 diff 에 이전 라운드(`19_57_00`)의 `dependency.md` 산출물이 신규 파일로 포함돼 있음 — 자기참조적 상황이나 결함 아님
  - 위치: `review/code/2026/09/24/19_57_00/dependency.md`(및 동 세션의 나머지 13개 reviewer 산출물, `review/consistency/2026/09/24/19_35_41/**`)
  - 상세: 이들은 실행 코드가 아니라 이전 리뷰/일관성 검토 세션의 산출물이 `review/**` 컨벤션에 따라 저장소에 커밋된 것이다. 이번 라운드가 검토해야 할 실질 diff(TS 3파일 + CHANGELOG + plan 2개)와는 성격이 다르며, 의존성 관점에서 별도로 볼 내용이 없다.
  - 제안: 조치 불필요.

## 요약

이번 변경분(32개 파일, `package.json`/lockfile 변경 0건)은 `pending_plans:` frontmatter 검증 가드에 순수 함수 `isPendingPlanPath`를 추가한 TS 3개 파일 + CHANGELOG + plan 문서 2개 + 이전 리뷰/일관성 검토 세션 산출물로 구성되며, 새 외부 의존성 추가·버전 변경·라이선스·취약점·번들 크기·빌드 시간·기존 의존성 충돌이 전혀 없다. 유일한 코드 변경은 기존에 이미 import 되어 있던 Node 표준 모듈(`node:path`)의 메서드 호출을 늘린 것이고, 내부 모듈 의존도 기존 공유 헬퍼 허브의 export 표면이 넓어진 수준으로 새 결합을 만들지 않는다. `#1388`(`@nestjs/typeorm` 12) CHANGELOG 미기재는 이 diff 와 무관한 별도 태스크의 기존 사실이며 이미 트래커에 등재돼 있다. 의존성 관점에서 조치가 필요한 사항은 없다.

## 위험도

NONE
