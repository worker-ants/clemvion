# 보안(Security) 리뷰

## 발견사항

- **[WARNING]** e2e 전용 시크릿이 소스 코드(docker-compose.e2e.yml)에 하드코딩되어 있음
  - 위치: `docker-compose.e2e.yml` lines 1369–1373 (backend-e2e service environment block)
  - 상세: `JWT_SECRET: clemvion-e2e-jwt-secret-do-not-use-in-prod-x9y8z7`, `ENCRYPTION_KEY: 0123456789abcdef0123456789abcdef`, `INTEGRATION_ENCRYPTION_KEY: 0123456789abcdef0123456789abcdef`, DB 비밀번호 `clemvion-e2e`, MinIO 자격증명 `clemvion`/`clemvion-e2e`, Flyway `-password=clemvion-e2e` 가 모두 평문으로 커밋되어 있다. 파일 자체에 "e2e 전용 임시 secret. 운영 절대 사용 금지" 주석이 있고 `OAUTH_STUB_MODE: "true"` 를 통해 운영 분리 의도가 명확하므로 의도된 설계임을 알 수 있다. 그러나 이 파일이 git에 커밋되면 리포지토리 히스토리에 영구 보존되며, 개발자가 실수로 동일 시크릿을 운영 환경에 복사할 위험이 있다. 특히 `ENCRYPTION_KEY`/`INTEGRATION_ENCRYPTION_KEY` 가 단순 패턴(`0123456789abcdef...`)이라 추측이 용이하다.
  - 제안: e2e 전용 시크릿임을 명시하는 현 주석은 적절하다. 추가 조치로 (1) `ENCRYPTION_KEY` 값을 더 임의적인 hex 문자열로 교체해 패턴 추측을 차단하고, (2) CI에서 `docker-compose.e2e.yml` 의 시크릿 값이 운영 환경변수(k8s Secret / .env 파일 등)와 일치하지 않는지 검사하는 가드를 두는 것을 권장한다. 현재로서는 e2e 격리 컨텍스트 내 허용 범위로 판단된다.

- **[WARNING]** `e2e-prune` Makefile 타겟에서 `docker compose -p $$proj` 에 사용자 제어 가능 값이 주입됨 (잠재적 인젝션)
  - 위치: `Makefile` e2e-prune 타겟 (lines 374–382)
  - 상세: `jq -r '.[].Name'` 로 추출한 compose project 이름을 따옴표 없이 `docker compose -p $$proj` 에 넘긴다. Docker daemon의 `compose ls` 결과가 신뢰 출처이므로 일반적으로 안전하지만, `$$proj` 를 쌍따옴표 없이 사용하면 project name에 공백이나 쉘 메타문자가 포함된 경우 word splitting / 쉘 인젝션으로 이어질 수 있다. Docker compose project 명명 규칙(`[a-z0-9][a-z0-9_-]*`)이 메타문자를 허용하지 않으므로 실제 익스플로잇 가능성은 낮지만, 방어적 코딩이 부재하다.
  - 제안: `for proj in $$projects` 루프 내에서 `docker compose -p "$$proj"` 와 같이 변수를 쌍따옴표로 감싸 word splitting을 방지한다. 또한 `echo "→ pruning $$proj"` 역시 `"$$proj"` 로 따옴표 처리한다.

- **[INFO]** `COMPOSE_PROJECT` 환경변수 override가 사용자 입력을 Makefile 변수로 직접 주입함
  - 위치: `Makefile` 상단 (`COMPOSE_PROJECT ?= ...` 정의 및 `COMPOSE_E2E` 변수)
  - 상세: `COMPOSE_PROJECT=foo make e2e-test` 형태로 사용자가 임의 문자열을 compose project 명으로 지정할 수 있다. 이 값은 `docker compose -p $(COMPOSE_PROJECT)` 에 그대로 전달된다. Makefile은 쉘 명령어를 직접 실행하므로, 악의적인 값(예: `'; rm -rf /; echo '`)이 주입되면 커맨드 인젝션이 가능하다. 로컬 개발 도구 특성상 공격자가 직접 명령어를 실행할 수 있는 환경과 동일하므로 실제 위협도는 낮으나, CI 파이프라인에서 외부 입력이 이 변수로 흐른다면 문제가 될 수 있다.
  - 제안: CI에서 `COMPOSE_PROJECT` 를 외부에서 주입하는 경우 값을 Docker compose 명명 규칙(`[a-z0-9][a-z0-9_-]*`)에 맞게 검증/정규화하는 단계를 추가한다. Makefile의 `_WT` 도출 로직(소문자화 + sed 정규화)은 이미 이 패턴을 따르고 있으므로 동일 로직을 override 경로에도 적용하는 것이 일관성 있다.

- **[INFO]** MinIO/DB 자격증명이 docker-compose.e2e.yml 내 두 서비스(migrate, createbuckets)에 중복 평문 기재됨
  - 위치: `docker-compose.e2e.yml` createbuckets 환경변수 블록 및 migrate command 인자
  - 상세: `POSTGRES_PASSWORD: clemvion-e2e`, `MINIO_ROOT_PASSWORD: clemvion-e2e`, Flyway `-password=clemvion-e2e` 가 각각 다른 서비스에 반복 기재된다. 중복 자체가 보안 취약점은 아니지만 변경 시 누락 위험을 높이며, Flyway command-line 인자로 전달된 비밀번호는 `docker inspect` 나 `ps` 결과에 노출될 수 있다 (`JAVA_TOOL_OPTIONS` 등 환경변수 방식과 달리).
  - 제안: Flyway의 `-password` 를 command 인자 대신 `FLYWAY_PASSWORD` 환경변수로 전달하면 `docker inspect` 의 Args 필드에 평문이 노출되는 것을 막을 수 있다. e2e 환경임을 감안할 때 우선순위는 낮다.

- **[INFO]** `make e2e-prune` 이 `--filter "name=clemvion-e2e"` 필터로 prefix 기반 프로젝트를 일괄 정리함 — 예상치 못한 project 포함 가능성
  - 위치: `Makefile` e2e-prune 타겟
  - 상세: `docker compose ls -a --filter "name=clemvion-e2e"` 는 Docker의 substring/prefix 매칭에 따라 `clemvion-e2e`, `clemvion-e2e-*` 외의 이름(예: 직접 `clemvion-e2e-custom` 으로 만든 외부 project)도 포함할 수 있다. 의도치 않은 project가 `down -v --remove-orphans` 로 삭제될 수 있다.
  - 제안: `jq -r '.[].Name | select(test("^clemvion-e2e(-|$)"))'` 와 같이 regex anchor를 활용해 `clemvion-e2e` 또는 `clemvion-e2e-` 로 시작하는 project만 선택적으로 처리한다.

## 요약

이번 변경의 보안 관점 핵심 대상은 `docker-compose.e2e.yml` 의 하드코딩 시크릿과 `Makefile` 의 쉘 변수 처리 두 영역이다. e2e 인프라 시크릿(`JWT_SECRET`, `ENCRYPTION_KEY`, DB/MinIO 자격증명)이 소스 코드에 평문으로 커밋된 것은 이 파일의 사용 목적(로컬/CI e2e 전용, `OAUTH_STUB_MODE=true`)이 명확히 문서화되어 있고 운영과 분리된 격리 환경임을 고려하면 의도된 수준의 타협으로 볼 수 있다. 다만 `ENCRYPTION_KEY` 의 단순 패턴(`0123456789abcdef...`)과 `e2e-prune` 의 변수 인용 누락은 개선이 필요하다. COMPOSE_PROJECT의 외부 override 경로는 CI 컨텍스트에서 주의가 필요하며, Flyway 비밀번호의 command 인자 노출은 낮은 우선순위의 개선 사항이다. 전반적으로 도구(Makefile, docker compose) 및 인프라 레이어의 변경이 주를 이루며 애플리케이션 코드 레이어의 신규 취약점은 없다.

## 위험도

LOW
