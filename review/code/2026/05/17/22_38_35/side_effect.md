# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[WARNING]** `e2e-prune` 타겟의 `docker compose ls --filter` 가 prefix 매칭이 아닌 exact 매칭을 수행할 수 있음
  - 위치: `Makefile` L377 — `docker compose ls -a --filter "name=clemvion-e2e" --format json`
  - 상세: Docker Compose의 `--filter name=<value>` 옵션은 구현에 따라 prefix 매칭이 아닌 exact name 매칭을 하는 경우가 있다. `clemvion-e2e-<task>-<slug>` 형태의 프로젝트가 목록에 잡히지 않으면 `e2e-prune` 이 stale 컨테이너를 정리하지 못한다. Docker Compose v2.x 에서 `--filter name=foo` 는 `foo` 가 포함된 이름 전체를 반환하는 경우도 있으나, 버전에 따라 동작이 다르다. 의도한 "접두 매칭" 이 보장되지 않을 수 있다.
  - 제안: `docker compose ls -a --format json | jq -r '.[] | select(.Name | startswith("clemvion-e2e")) | .Name'` 와 같이 jq 레이어에서 prefix 필터링을 수행하거나, 공식 문서에서 `--filter name=` 의 정확한 매칭 semantics 를 확인 후 명시적으로 문서화한다.

- **[WARNING]** 공유 Docker image 이름(`clemvion-e2e/backend:latest` 등)이 worktree 간 동시 빌드 시 race condition 을 유발할 수 있음
  - 위치: `docker-compose.e2e.yml` — `image: clemvion-e2e/backend:latest`, `image: clemvion-e2e/migrate:latest`, `image: clemvion-e2e/backend-deps:latest`
  - 상세: 두 worktree 가 동시에 `make e2e-test` 를 실행하면 컨테이너·볼륨은 project name 별로 격리되지만, `--build` 플래그로 인해 두 worktree 가 동시에 같은 image tag 를 덮어쓰는 빌드를 경쟁적으로 실행한다. `docker build --tag clemvion-e2e/backend:latest` 가 동시에 두 번 실행되면 한쪽의 빌드 결과가 다른 쪽을 덮어쓸 수 있고, 먼저 빌드를 끝낸 worktree 가 실행 중인 컨테이너가 다른 worktree 의 빌드 결과물로 교체될 위험이 있다(image replace 는 실행 중 컨테이너에 즉시 영향을 주지 않으나, 재시작 시 영향). 이는 의도한 격리 목표와 충돌한다.
  - 제안: image 캐시 공유의 실용성과 동시 빌드 안전성 사이의 trade-off 를 문서화한다. 또는 image 이름에도 `COMPOSE_PROJECT` 를 반영하여 완전 격리하되, 첫 빌드 후 image 를 공유 tag 로 re-tag 하는 방식을 택한다. 최소한 주석에 "동시 빌드 시 image race 가능" 경고를 추가한다.

- **[WARNING]** `_WT` Make 변수가 shell 실행(`$(shell ...)`)으로 평가 시점에 `CURDIR` 을 읽으므로, `make` 를 다른 디렉터리에서 `-C` 플래그로 호출할 경우 의도와 다른 값이 도출될 수 있음
  - 위치: `Makefile` L343 — `_WT := $(shell basename "$(CURDIR)" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9_-]/-/g')`
  - 상세: `make -C /some/other/path e2e-test` 처럼 외부에서 호출하면 `$(CURDIR)` 이 호출 경로를 반영해 `COMPOSE_PROJECT` 가 예상 밖의 값을 가진다. CI 스크립트 등에서 `-C` 를 사용하는 경우 격리 네임스페이스가 깨진다.
  - 제안: `COMPOSE_PROJECT ?=` 를 통해 외부 override 가 가능하도록 이미 처리되어 있으므로 이 경우 CI 에서 `COMPOSE_PROJECT` 를 명시적으로 지정하도록 문서에 안내한다.

- **[INFO]** `e2e-prune` 타겟이 `docker compose -p $$proj -f docker-compose.e2e.yml down` 을 실행할 때 `docker-compose.e2e.yml` 이 현재 작업 디렉터리에 존재해야 함
  - 위치: `Makefile` L381 — `docker compose -p $$proj -f docker-compose.e2e.yml down -v --remove-orphans`
  - 상세: `e2e-prune` 은 main worktree 에서 실행될 것으로 예상되지만, 만약 `docker-compose.e2e.yml` 이 없는 경로에서 실행되면 에러가 발생한다. 현재 `-f` 에 절대경로가 아닌 상대경로가 사용되어 `make` 실행 위치에 의존한다.
  - 제안: 기능상 worktree 의 Makefile 안에서 실행되므로 문제는 없지만, `$(CURDIR)/docker-compose.e2e.yml` 로 절대경로를 명시하면 안전성이 높아진다.

- **[INFO]** `docker-compose.e2e.yml` 에서 `name:` 최상위 키 제거는 역호환 부작용이 있음
  - 위치: `docker-compose.e2e.yml` diff — `name: clemvion-e2e` 삭제
  - 상세: 기존에 `name: clemvion-e2e` 가 하드코딩되어 있던 시절에 생성된 컨테이너/볼륨/네트워크는 `clemvion-e2e` 프로젝트 네임스페이스로 남아 있다. 새 코드로 교체 후 `make e2e-down` 을 실행하면 `COMPOSE_PROJECT` 도출값이 main worktree에서 `clemvion-e2e` 로 동일하게 나오므로 main worktree 에서는 정리가 정상 작동한다. 다만 이전에 `name:` 키 없이 다른 방식으로 생성된 project 가 있다면 정리가 누락될 수 있다.
  - 제안: 마이그레이션 안내(첫 적용 시 `make e2e-prune` 또는 `make e2e-down` 을 한번 실행할 것)를 PR 설명이나 PROJECT.md 에 추가한다.

- **[INFO]** `COMPOSE_PROJECT` 환경 변수가 새롭게 공개 인터페이스(override 가능한 변수)로 도입됨
  - 위치: `Makefile` L344 — `COMPOSE_PROJECT ?= ...`
  - 상세: 사용자 또는 CI 환경에 이미 `COMPOSE_PROJECT` 라는 이름의 환경 변수가 설정되어 있다면, 의도치 않게 e2e compose project name 이 해당 값으로 덮어씌워진다. `?=` 를 사용했으므로 이는 의도된 동작이지만, 사용자 환경에서의 충돌 가능성이 문서화되지 않았다.
  - 제안: Makefile 상단 주석 또는 PROJECT.md 에 "`COMPOSE_PROJECT` 환경 변수가 이미 설정되어 있다면 해당 값이 우선됨" 을 명시한다.

## 요약

이번 변경은 병렬 worktree 에서의 e2e Docker Compose 프로젝트 네임스페이스 충돌을 해결하기 위한 것으로, 전반적인 설계는 올바르다. `CURDIR` 기반 `COMPOSE_PROJECT` 도출 로직은 의도된 격리를 대부분의 상황에서 달성한다. 그러나 Docker image 이름이 project name 과 독립적으로 worktree 간 공유되도록 설계된 부분이 동시 빌드 race condition 을 유발할 수 있으며, `e2e-prune` 의 `--filter name=` 매칭 semantics 가 Docker Compose 버전에 따라 prefix 매칭이 아닐 수 있다는 점은 주의가 필요하다. 이 두 WARNING 은 정상 단일 worktree 사용 환경에서는 발현되지 않으나, 본 변경의 핵심 목표인 "여러 worktree 동시 e2e 실행" 시나리오에서 부작용이 발생할 수 있다.

## 위험도

LOW
