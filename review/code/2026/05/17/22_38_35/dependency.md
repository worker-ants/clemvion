# 의존성(Dependency) 리뷰 결과

## 발견사항

- **[INFO]** `e2e-prune` 타겟에 `jq` 런타임 의존성 추가
  - 위치: `Makefile` — `e2e-prune` 타겟, `docker-compose.e2e.yml` 헤더 주석
  - 상세: `make e2e-prune` 실행 시 `docker compose ls --format json` 출력을 파싱하기 위해 시스템에 `jq` 가 설치되어 있어야 한다. 이는 기존 Makefile 에는 없던 신규 외부 도구 의존성이다. macOS 에서는 `brew install jq`, Linux 에서는 `apt/yum` 등으로 설치해야 한다. `e2e-prune` 타겟만 해당되며, 일상적인 `e2e-test` / `e2e-up` / `e2e-down` 에는 영향 없다.
  - 제안: 현재 Makefile 이 `command -v jq` 체크 + 안내 메시지 + `exit 1` 패턴으로 누락 시 명확한 오류를 내도록 처리되어 있어 적절하다. 다만 README.md / PROJECT.md 의 사전 요구 사항 목록("Node.js 20+, Docker & Docker Compose")에 jq 를 선택적 도구로 명시하면 더 좋다.

- **[INFO]** `docker compose ls --filter "name=clemvion-e2e"` 의 `--filter` 플래그 동작 주의
  - 위치: `Makefile` — `e2e-prune` 타겟, 라인 `docker compose ls -a --filter "name=clemvion-e2e" --format json`
  - 상세: Docker Compose `ls --filter name=<value>` 는 prefix 매칭이 아니라 정확히 일치(exact match) 하거나 포함(contains) 방식으로 동작할 수 있다. 실제로 `docker compose ls` 의 `--filter name=` 은 이름에 해당 문자열이 포함된 모든 project 를 반환한다. 즉 `clemvion-e2e` 를 포함하는 이름(예: `clemvion-e2e`, `clemvion-e2e-task-slug`) 이 모두 잡힌다. 이는 의도된 동작이므로 문제는 없으나, 만약 Docker 버전에 따라 동작이 다를 경우 stale project 가 잡히지 않을 수 있다.
  - 제안: Docker Compose CLI 버전에 따라 `--filter` 동작이 달라질 수 있음을 주석에 명시하거나, `jq` 로 `.Name | startswith("clemvion-e2e")` 를 추가로 필터링하면 방어적이다. 예: `jq -r '.[] | select(.Name | startswith("clemvion-e2e")) | .Name'`

- **[INFO]** 이미지 태그 `latest` 고정 — 공유 이미지 캐시 전략
  - 위치: `docker-compose.e2e.yml` — `migrate`, `backend-e2e`, `backend-e2e-runner` 서비스의 `image:` 필드
  - 상세: `clemvion-e2e/backend:latest`, `clemvion-e2e/migrate:latest`, `clemvion-e2e/backend-deps:latest` 모두 `:latest` 태그를 사용한다. 이는 외부 레지스트리에서 pull 하는 이미지가 아니라 로컬 빌드 전용 이미지이므로 일반적인 `:latest` 핀닝 부재 문제(예: 외부 패키지 버전 비결정성)와는 성격이 다르다. `docker compose build` 시 항상 로컬에서 새로 빌드되므로 worktree 간 image 공유 최적화 의도에 부합한다.
  - 제안: 로컬 전용 이미지이므로 현재 방식은 적절하다. 다만 CI 환경에서 `e2e-prune` 없이 이미지가 누적될 수 있으므로 CI cleanup 단계에서 `docker image prune` 을 별도 고려할 수 있다.

- **[INFO]** 기존 인프라 이미지(`pgvector/pgvector`, `redis`, `minio/minio`, `minio/mc`)의 버전 고정 유지 확인
  - 위치: `docker-compose.e2e.yml` — 기존 인프라 서비스 이미지 선언부 (변경 없음)
  - 상세: 이번 변경에서 인프라 이미지(`pgvector/pgvector:${POSTGRES_VERSION:-pg18}`, `redis:7-alpine`, `minio/minio:RELEASE.2025-04-22T22-12-26Z`, `minio/mc:RELEASE.2025-04-16T18-13-26Z`)는 수정되지 않았다. minio 이미지는 SHA 타임스탬프 형식으로 핀닝되어 있어 재현성이 보장된다. redis 는 `7-alpine` 마이너 버전 미고정이나, 이는 이번 변경과 무관한 기존 상태다.
  - 제안: 이번 변경 범위 밖이나, 향후 `redis:7.2-alpine` 또는 정확한 digest 핀닝을 고려할 수 있다.

## 요약

이번 변경(`fix(e2e): isolate docker compose project per worktree`)은 외부 패키지/라이브러리를 새로 추가하지 않는다. npm `package.json` 수정, Dockerfile `RUN npm install`, 또는 기타 애플리케이션 의존성 변경이 전혀 없다. 추가된 의존성은 `make e2e-prune` 타겟 전용 시스템 도구인 `jq` 하나뿐이며, 이는 선택적(optional) 운영 편의 명령에만 필요하고 Makefile 내에서 존재 여부를 체크해 누락 시 명확한 오류 메시지를 출력하도록 처리되어 있다. Docker Compose 의 `-p` 플래그를 통한 project name 격리, `image:` 명시를 통한 빌드 캐시 공유 전략 모두 기존 의존성 범위 내에서 동작하는 인프라 설정 변경이다. 의존성 관점에서 전반적으로 안전하며, jq 의 선택적 의존성과 `docker compose ls --filter` 동작에 대한 소소한 주의 사항만 존재한다.

## 위험도

LOW
