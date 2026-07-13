# 변경 범위(Scope) Review

대상 작업: `plan/in-progress/pnpm-migration-followups.md` §1-(a) — backend 프로덕션 이미지 슬림화
(`pnpm deploy` 격리 번들 전환).

## 검증 방법

payload 의 diff 4건(Dockerfile / plan 문서 / pnpm-lock.yaml / pnpm-workspace.yaml)을 각각 검토하고,
실제 커밋(`360d41f60`)의 `git diff --stat HEAD~1 HEAD` 로 payload 가 전체 변경분을 빠짐없이
반영했는지 교차 확인했다.

```
codebase/backend/Dockerfile                  | 39 +++++++++++++++++-----------
plan/in-progress/pnpm-migration-followups.md | 11 ++++++++
pnpm-lock.yaml                               |  1 +
pnpm-workspace.yaml                          |  4 +++
4 files changed, 40 insertions(+), 15 deletions(-)
```

payload 의 4개 파일과 정확히 일치 — 리뷰 대상 밖에 숨은 변경 없음.

## 발견사항

- **[INFO]** `codebase/backend/Dockerfile` 신규 stage 주석이 상당히 길다(deploy/legacy 비교,
  cron-parser 회귀 원인, target 경로 제약 등).
  - 위치: `# ---------- deploy: ... ----------` 및 `# ---------- runner: runtime ----------` 블록
  - 상세: 분량은 크지만 전부 이번 변경(“왜 install --prod 대신 deploy 인지”, “왜 legacy 가 아니라
    injected 인지”)을 직접 설명하는 내용이라 무관한 주석 추가나 리팩토링 잔재는 아니다. 실패했던
    옵션(legacy deploy → cron-parser 회귀)의 근거를 남겨 재발 방지에 기여하므로 범위 위반으로
    보지 않는다.
  - 제안: 그대로 유지해도 무방. 다만 이후 이 코멘트가 더 늘어나면 plan 문서 쪽 상세로 옮기고
    Dockerfile 에는 요약만 남기는 것도 고려 가능(선택 사항, 이번 PR 블로커 아님).

- **[INFO]** runner stage 에서 `WORKDIR /app/codebase/backend` 를 스테이지 시작부로 올리고
  기존 이중 `WORKDIR`(`/app` → `/app/codebase/backend`)를 하나로 합쳤다.
  - 위치: Dockerfile diff 라인 73~81 (구) vs 70~78(신)
  - 상세: `pnpm deploy` 산출물이 `/prod/backend` 아래로 이미 backend 전용이라, COPY 대상이 처음부터
    `/app/codebase/backend` 가 되는 것이 자연스러운 결과다. 별도의 스타일 정리가 아니라 스테이지
    재구성에 종속된 필연적 변경으로 판단, 범위 이탈 아님.

- **[없음 — 정탐 확인]** `injectWorkspacePackages: true` 추가(`pnpm-workspace.yaml` + 그 파생인
  `pnpm-lock.yaml` `settings.injectWorkspacePackages`) 근거 확인.
  - 위치: `pnpm-workspace.yaml` 신규 4줄, `pnpm-lock.yaml` 신규 1줄(`settings:` 블록)
  - 상세: Dockerfile 주석과 plan 문서 모두 동일한 인과관계를 명시한다 — legacy(`--legacy`) deploy 는
    backend 직접 의존 `cron-parser@^5.5.0` 을 bullmq 전이 의존 `4.9.0` 으로 잘못 collapse해
    `CronExpressionParser`(v5 API) 가 `undefined` 가 되어 유효한 cron 표현식도 400 응답이 나는
    회귀를 유발했고, e2e `schedule-trigger` 가 이를 포착했다. non-legacy(injected) deploy 는
    `injectWorkspacePackages: true` 없이는 `ERR_PNPM_DEPLOY_NONINJECTED_WORKSPACE` 로 실패하므로
    이 설정 추가는 선택적 기능 확장이 아니라 §1-(a) 가 채택한 해법(옵션 A, injected deploy)의
    필수 전제조건이다. lockfile 변경도 해당 설정 반영에 따른 1줄뿐이고 `버전 churn 0`(plan 문서
    명시, `git diff --stat` 로도 1줄만 확인)이라 부작용 파급이 없다. `.npmrc` 의 `node-linker`(hoisted)
    는 그대로 유지되어(§3 strict 전환은 미포함) 관련 없는 다른 설정까지 건드리지 않았다.

- **[없음 — 정탐 확인]** plan 문서에 추가된 "부수 발견 — pnpm 필드 무시" 단락.
  - 위치: `plan/in-progress/pnpm-migration-followups.md` §1 하단 blockquote
  - 상세: `pnpm.overrides`/`pnpm.onlyBuiltDependencies` 가 pnpm 10.23 부터 더 이상 읽히지 않는다는
    관찰을 기록만 하고, **이번 diff 에서 실제로 고치지 않았다**(§2 관련 별도 follow-up으로 명시
    보류). 코드 변경 없이 발견 사항만 문서화한 것으로, 오히려 “발견했지만 이번 범위에서 손대지
    않는다”는 스코프 절제를 보여주는 사례다. 범위 위반 아님.

- **[없음]** 그 외 무관한 파일·포맷팅·임포트·불필요 리팩토링 없음.
  - `deps`/`builder` 스테이지(변경 diff 밖, 컨텍스트로만 노출된 라인 89~126)는 그대로 유지되어
    있고, 실제 diff 는 `prod-deps`→`deploy` 스테이지 재작성과 `runner` 스테이지 COPY 로직에만
    한정된다. `.npmrc`, CI workflow, 다른 서비스 Dockerfile 등은 전혀 손대지 않았다.

## 요약

이번 변경은 plan §1-(a) 가 정의한 “backend 프로덕션 이미지 슬림화(`pnpm deploy` 채택)”라는 단일
목표에 정확히 정렬돼 있다. 실제 diff 는 Dockerfile 의 `prod-deps`→`deploy` 스테이지 재작성 + `runner`
COPY 선별, `pnpm-workspace.yaml`/`pnpm-lock.yaml` 의 `injectWorkspacePackages: true` 1개 설정(및
그 파생 lockfile 1줄), plan 문서의 완료 기록 4개 파일로 국한되며 `git diff --stat` 로 교차 검증한
결과 payload 밖의 숨은 변경은 없다. `injectWorkspacePackages` 추가는 기능 확장이 아니라 injected
deploy(선택된 해법)가 요구하는 필수 전제이며, legacy deploy 의 cron-parser 버전 오해소(스케줄 400
회귀)를 근거로 명확히 정당화되어 있다. `node-linker`(hoisted) 등 인접 설정(§3 범위)은 의도적으로
건드리지 않았고, 부수적으로 발견한 pnpm 필드 무시 이슈도 코드 수정 없이 문서 기록만 남겨 스코프를
지켰다. Dockerfile 주석이 다소 길지만 전부 이번 변경의 근거 설명이라 무관한 주석 추가로 보지 않는다.

## 위험도

NONE
