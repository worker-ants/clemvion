# 테스트(Testing) 리뷰 — backend Dockerfile `pnpm deploy` 전환 (injected deploy)

대상: `codebase/backend/Dockerfile`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `plan/in-progress/pnpm-migration-followups.md`
(순수 애플리케이션 코드 변경 없음 — Docker 멀티스테이지 빌드 + pnpm workspace 설정만 변경)

## 발견사항

- **[WARNING]** devDeps/프런트 스택 부재를 자동 검증하는 CI 스모크 가드가 여전히 없음 (plan §1 follow-up (b), 미해결로 명시)
  - 위치: `.claude/test-stages.sh` `_cmd_build_docker_images` (77-94행), `.github/workflows/e2e.yml` "Build backend image" 스텝
  - 상세: `_cmd_build_docker_images` 는 `docker build -q -f codebase/backend/Dockerfile ...` 로 **빌드 성공 여부만** 확인한다. 이미지 **내용**(`node_modules/jest` 부재, `node_modules/next`·`@next`·`three`·`playwright` 부재, 이미지 크기 상한 등)을 assert 하는 단계는 파이프라인 어디에도 없다. 이번 diff 가 해결하려는 문제(구 `prod-deps` 스테이지가 hoisted flat tree 를 통째 옮겨 프런트 스택 600MB+·backend 원본 src 가 프로덕션 이미지에 잔존)는 정확히 "이미지 내용이 조용히 나빠지는" 유형의 회귀이고, 그 회귀는 **ai-review 로만 발견됐지 CI 로 걸린 적이 없다**. 즉 같은 클래스의 재발(예: 이후 어떤 diff 가 `deploy` 스테이지를 우회하고 다시 `--from=builder /app ./` 로 되돌리는 실수)도 다시 수동 리뷰에 의존해야 걸러진다. 이미지 크기 1.23GB→551MB 개선은 plan 문서에 **1회성 수기 측정**으로만 기록돼 있고 재현 가능한 assert 가 아니다.
  - 제안: `_cmd_build_docker_images` (또는 `docker-compose.e2e.yml` 빌드 직후) 에 저비용 스모크 스텝 추가.
    ```sh
    docker run --rm --entrypoint sh clemvion-build-check/backend:latest -c \
      'test ! -d node_modules/jest && test ! -d node_modules/typescript \
       && test ! -d node_modules/next && test ! -d node_modules/@next'
    ```
    실행 수 초 내외이며, 이번 PR 이 고치는 문제 자체를 회귀 가드로 고정한다. plan 문서에 이미 "별도(b)"로 추적 중이므로 이번 PR 을 막을 필요는 없으나, "언제 별도 PR 로 처리할지"가 명시돼 있지 않아 우선순위가 계속 밀릴 위험이 있다.

- **[WARNING]** cron-parser 버전 충돌(legacy deploy 버그) 회귀 커버리지가 "의도된 가드"가 아니라 "우연한 적중"
  - 위치: `codebase/backend/Dockerfile` deploy 스테이지 주석(52-54행), `codebase/backend/test/schedule-trigger.e2e-spec.ts` 테스트 A/B (54-83행)
  - 상세: legacy(flat) `pnpm deploy` 가 backend 직접 의존 `cron-parser@^5.5.0` 을 bullmq 전이 의존 `4.9.0` 으로 잘못 collapse 한 버그는, 마침 `schedule-trigger.e2e-spec.ts` 의 A("유효 cron → 200/201")·B("잘못된 cron → 400") 테스트가 `CronExpressionParser`(v5 API) 를 실제로 호출하는 코드 경로를 이미 커버하고 있었기 때문에 잡혔다. 이는 "pnpm deploy 가 backend 의 직접 의존 버전을 올바르게 해소하는지"를 목표로 설계된 테스트가 아니라, 우연히 겹친 결과다. 향후 다른 패키지(다른 버전으로 이중 해소될 수 있는 임의의 backend 직접 의존)가 같은 방식으로 잘못 collapse 되어도, 그 결과가 기존 e2e 가 exercise 하는 경로에서 hard failure(400/500)를 유발하지 않는 한(예: 미세한 동작 차이·보안 패치 레벨 차이) 아무 테스트도 잡지 못한다.
  - 제안: (a) 이미지/부팅 시점에 핵심 의존성 버전을 로그 또는 헬스체크 응답에 노출하는 최소 스모크(`node -e "console.log(require('cron-parser/package.json').version)"` 등)를 CI 에 추가하거나, (b) 최소한 `schedule-trigger.e2e-spec.ts` 테스트 A/B 상단 주석에 "이 테스트가 pnpm deploy 의 cron-parser 버전 해소 회귀도 겸해서 가드한다"는 사실을 남겨, 이후 리팩터링(예: preview 로직을 mock 으로 교체)이 이 암묵적 보호를 실수로 제거하지 않도록 한다.

- **[INFO]** 신규 애플리케이션 코드가 없어 유닛 테스트 추가는 해당 없음 — 검증 계층 선택이 적절
  - 위치: 전체 diff (Dockerfile/workspace/lockfile/plan 문서만 변경)
  - 상세: 이 변경은 순수 빌드/배포 인프라이므로 유닛 테스트로 의미 있게 커버할 대상이 없다. 실제 검증은 (1) `docker build`(빌드 성공), (2) e2e — `backend-e2e` 서비스가 `target: runner`(이번 diff 가 바뀐 바로 그 프로덕션 이미지)로 기동돼 253개 e2e 가 실제 산출물에 대해 돌아가는 구조로 되어 있다(`docker-compose.e2e.yml` 117-123행). 계층 선택 자체는 적절하다.

- **[INFO]** 회귀 테스트 유효성 — 기존 e2e/unit 스위트는 이번 변경 후에도 유효
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` 전체, plan 문서 "검증" 절
  - 상세: 애플리케이션 소스·마이그레이션·비즈니스 로직은 변경되지 않았고, `deploy` 스테이지 산출물이 `runner` 로 selective COPY 되는 경로만 바뀌었다. plan 문서에 따르면 lint·unit(14)·build·e2e(253, schedule-trigger 포함) 전부 통과가 이미 확인됐다고 기록돼 있어(review 시점 기준 실행 레코드 확보), 회귀 위험은 낮다. 다만 이 리뷰는 그 실행 로그 자체를 재확인하지 않았으므로, "실제로 이 커밋 기준으로 253개가 통과했는지"는 plan 문서 서술에 의존한다.

- **[INFO]** 격리(node injection)의 정합성은 명시적 assert 없이 "전체 부팅 성공"에 암묵적으로 의존
  - 위치: `codebase/backend/Dockerfile` 76-78행 (`COPY --from=deploy .../node_modules`, `COPY --from=builder .../dist`), `pnpm-workspace.yaml` `injectWorkspacePackages: true`
  - 상세: `@workflow/*` 4개 패키지가 injected copy 로 올바르게 주입됐는지, 혹은 일부만 주입되고 나머지가 broken symlink 로 남는지를 직접 assert 하는 테스트는 없다. 다만 backend 코드 전반이 이 패키지들을 광범위하게 import 하므로, 주입이 깨지면 앱이 아예 부팅하지 못하거나 다수의 e2e 가 500 으로 실패해 사실상 빠르게 드러난다 — implicit coverage 로 충분하다고 판단, 별도 조치 불필요.

## 요약

이번 diff 는 애플리케이션 코드를 건드리지 않는 순수 Docker/pnpm workspace 인프라 변경이라 유닛 테스트 신설 대상이 없고, 검증 계층 선택(build 스모크 + 실제 프로덕션 `runner` 이미지를 기동하는 e2e)은 적절하다. 특히 이번 변경이 고치는 legacy-deploy cron-parser 버전 붕괴 버그를 `schedule-trigger` e2e 가 실제로 포착했다는 점은 "실행 아티팩트 기준 e2e" 구조가 이 종류의 배포 회귀에 유효함을 보여준다. 다만 그 적중은 우연(해당 경로가 마침 e2e 로 커버돼 있었을 뿐)에 가깝고, 이번 변경의 존재 이유 자체인 "프로덕션 이미지에 devDeps/프런트 스택이 잔존하는지"를 assert 하는 자동 가드는 여전히 전무해 plan 문서도 이를 미해결 잔여(b)로 명시하고 있다. 이 자체가 이번 PR 을 막을 사유는 아니지만(이미 추적 중, 이번 diff 는 상황을 오히려 개선), 동일 계열의 재발(devDeps 유출·의존성 버전 오해소)이 다시 발생하면 이번에도 ai-review/수기 검증에만 의존하게 될 위험이 있어 저비용 스모크 가드(이미지 내 devDeps 디렉터리 부재 확인, 핵심 의존성 버전 확인) 추가를 후속 우선순위로 권고한다.

## 위험도
LOW
