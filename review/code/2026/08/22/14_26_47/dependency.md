# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 신규 외부/내부 패키지 의존성 없음 — 오히려 중복 의존을 제거
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts`(파일 전체
    삭제, 162줄), `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts`(파일
    전체 삭제, 192줄)
  - 상세: `git diff origin/main..HEAD --name-only`로 실측한 결과 이 브랜치 전체(2커밋,
    `4df0b9097`·`997038e94`)는 `package.json`/`pnpm-lock.yaml`/`pnpm-workspace.yaml`를 전혀
    건드리지 않는다(신규 npm 패키지 0건). 삭제된 backend 사본이 소비하던
    `import * as ts from 'typescript'`·`import * as sot from '@workflow/masked-markers'`는 각각
    `codebase/backend/package.json:130`(`typescript ^5.7.3`, 기존 devDep)·`:58`
    (`@workflow/masked-markers: workspace:*`)에 계속 선언돼 있지만, 다른 소비처
    (`typescript`→backend 빌드/기존 다수 guard·spec, `@workflow/masked-markers`→
    `codebase/backend/src/shared/utils/sanitize-error-message.ts`, 실측 grep 확인)가 살아 있어
    orphan 선언은 아니다. 신규 `.github/workflows/repo-guards.yml`도 기존 composite action
    (`./.github/actions/pnpm-workspace`)과 `actions/checkout@v7`를 재사용할 뿐 새 액션을
    도입하지 않는다.
  - 제안: 없음 — 긍정적 변경(중복 제거).

- **[INFO]** 공유 devDependency 패키지 추출안을 등록 표면 실측으로 기각 — "새 의존성 불필요성"
  판단이 근거와 함께 문서화됨
  - 위치: `plan/in-progress/mirror-guard-single-copy.md` "## 왜 공유 패키지가 아닌가 — 등록 표면
    비교 (실측)" 절(게이트 31-55)
  - 상세: 트래커 원안(`@workflow/repo-guard-utils` 신규 devDep 패키지)과 실제 채택안(전용 CI
    잡)을 등록 표면(8곳 vs 5곳)·자동 검증 비율(2/8 vs 5/5)·프로덕션 배포 경로(Dockerfile 3곳)
    오염 여부로 실측 비교해 후자를 택했다고 표로 남겼다. 이는 정확히 본 리뷰 관점(§1 새 의존성
    필요성, §5 불필요한 의존성)이 요구하는 근거 수준이다. 기존 `@workflow/*` 8종이 전부
    production dependency라 devDep-only 테스트 유틸을 같은 방식(공유 패키지)으로 넣으면
    Dockerfile 등재라는 비대칭 비용이 생긴다는 관찰도 타당하다.
  - 제안: 없음 — 근거가 실측(표)으로 문서에 남아 있어 추후 재론 시에도 참조 가능.

- **[INFO]** 신규 워크플로가 스택 무관하게 매 `codebase/**` PR에서 frontend pnpm install을 태움
  (빌드 시간 영향, disclosed cost)
  - 위치: `.github/workflows/repo-guards.yml` `mirror-guard` 잡(게이트 62-86, 특히 76-79의
    `uses: ./.github/actions/pnpm-workspace` / `filter: 'frontend...'`, 82-86의 vitest 실행)
  - 상세: `on.pull_request`/`on.push`에 `paths:` 필터가 없고 `changes` 잡의 pathspec이
    `codebase/**` 전체(게이트 52)이므로, backend-only·web-chat-only PR에서도 이 잡이
    relevant 판정을 받아 frontend 워크스페이스를 설치한 뒤 가드 spec 1개만 돌린다.
    `frontend-checks.yml`이 이미 같은 설치를 하는 frontend-touching PR에서는 **두 번**
    실행된다 — 워크플로 자체 헤더 주석(게이트 21-23)이 이를 명시적으로 인지·수용하고 있다
    ("로컬 `run-test.sh unit`이 별도 배선 없이 돌리게 하기 위한 의도적 수용"). 결함이 아니라
    문서화된 트레이드오프다.
  - 제안: 없음(수용된 트레이드오프). CI 시간이 실측으로 문제가 되면 targeted 최적화(캐시 키
    조정 등) 검토.

- **[INFO]** `actions/checkout@v7` 버전 고정 방식이 저장소 전역 관례와 일치 — 신규 불일치 없음
  - 위치: `.github/workflows/repo-guards.yml:74`(게이트)
  - 상세: 태그 기반 고정(`@v7`, SHA 핀 아님)이며, `grep -rn "actions/checkout@" .github/workflows/*.yml`
    로 실측한 결과 `_changed-paths.yml`·`backend-checks.yml`·`frontend-checks.yml`·
    `harness-checks.yml`·`web-chat-checks.yml` 등 기존 워크플로 전체(11개 파일, 총 21건)가
    동일하게 `@v7`를 쓴다. 이 PR이 새 패턴을 도입하거나 기존과 어긋나게 만들지 않는다. SHA
    미고정 자체는 저장소 전역 기존 관례이며 이 PR이 새로 만든 회귀가 아니다.
  - 제안: 없음(저장소 전체 정책 트래커 대상이지 이 PR의 스코프 아님).

- **[INFO]** 내부 모듈 의존 — 크로스스택 가드 로직이 frontend 워크스페이스 안에 유일한 정본으로
  수렴 (§8 내부 의존성)
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts`
    (게이트 4-14, "이 파일이 유일한 사본이다")
  - 상세: backend가 이 로직을 소비하던 유일한 경로(사본 2파일)가 삭제되면서, backend→frontend
    방향의 코드 의존은 없고 대신 CI 워크플로(`repo-guards.yml`)가 frontend 워크스페이스를
    설치해 이 spec을 실행하는 구조로 바뀌었다. 즉 "코드 레벨 의존"이 "CI 오케스트레이션 레벨
    의존"으로 전환됐고, 두 스택 사이의 직접적인 소스 임포트 관계는 오히려 줄었다(단일 사본).
  - 제안: 없음 — 긍정적 방향. 아키텍처 리뷰어가 이미 지적했듯 크로스스택 로직이 늘어나면
    `.claude/tests/`(Python) 등 스택-중립 위치 재검토는 후속 고려사항.

## 요약

이 PR(및 그 위에 얹힌 라운드1 fix 커밋)은 `package.json`/`pnpm-lock.yaml`/`pnpm-workspace.yaml`을
전혀 건드리지 않아 신규 외부 의존성이 0건이며, 오히려 backend에 있던 `typescript`+
`@workflow/masked-markers` 소비 중복 사본(테스트 전용 AST 파서 로직 354줄)을 삭제해 frontend
사본 하나로 수렴시켰다(실측: 두 패키지 모두 backend의 다른 소비처가 살아 있어 orphan 아님).
plan 문서는 원래 트래커 항목이던 "공유 devDep 패키지로 재추출" 안을 등록 표면 실측(8곳/자동검증
2곳 vs 5곳/자동검증 5곳 전부, Dockerfile 오염 여부)으로 명시 기각했는데, 이는 "새 의존성이 정말
필요한가"를 검증 가능한 근거로 판단한 모범 사례다. 유일한 실비용은 신규 `repo-guards.yml`
워크플로가 스택 무관하게 frontend pnpm install을 태워 CI 시간을 소폭 늘리는 것인데, 이는 워크플로
헤더 주석과 plan 문서에서 트레이드오프로 명시 수용된 사항이다. `actions/checkout@v7` 등 액션
버전 고정도 저장소 전역 관례와 실측 일치하며 새로운 불일치를 만들지 않는다. 라이선스·취약점
관점에서 새로 도입되거나 갱신된 의존성이 없어 해당 관점의 리스크는 없다.

## 위험도
NONE
