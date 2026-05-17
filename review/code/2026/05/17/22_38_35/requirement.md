# 요구사항(Requirement) 리뷰 — e2e compose isolate

## 발견사항

### Makefile

- **[WARNING]** `e2e-prune` 의 `--filter "name=clemvion-e2e"` 는 prefix 매칭이 아닌 exact 매칭일 수 있음
  - 위치: Makefile `e2e-prune` 타겟, `docker compose ls -a --filter "name=clemvion-e2e"` 라인
  - 상세: `docker compose ls` 의 `--filter name=` 옵션은 Docker 버전에 따라 prefix/substring/exact 동작이 다르다. Compose v2 의 경우 `name=` 필터는 정확히 해당 이름과 일치하는 project 만 반환하는 경우가 있어, `clemvion-e2e-<task>-<slug>` 형태의 worktree project 들이 필터링되지 않을 수 있다. plan 문서(Step 3)에 기재된 구현과 실제 Makefile 구현 모두 동일한 패턴을 쓰지만, 실제 동작이 의도와 다를 수 있다.
  - 제안: `docker compose ls -a --format json | jq -r '.[].Name | select(startswith("clemvion-e2e"))'` 와 같이 jq 에서 prefix 필터링을 수행하거나, `--filter "name=clemvion-e2e"` 가 실제로 prefix 매칭됨을 확인하는 주석을 추가할 것.

- **[WARNING]** `e2e-prune` 에서 `docker compose -p $$proj -f docker-compose.e2e.yml down` 이 경로 문제를 일으킬 수 있음
  - 위치: Makefile `e2e-prune` 타겟, `docker compose -p $$proj -f docker-compose.e2e.yml down -v --remove-orphans` 라인
  - 상세: `docker-compose.e2e.yml` 경로는 `$(CURDIR)` 기준 상대 경로다. `e2e-prune` 은 주로 main worktree 또는 임의의 워킹 디렉토리에서 실행될 수 있으며, `docker-compose.e2e.yml` 파일이 현재 디렉토리에 없을 경우 오류가 발생한다. 단, prune 명령은 down 을 위해 compose 파일의 서비스 정의가 필요하다.
  - 제안: 파일 경로를 절대 경로로 바꾸거나 (`$(abspath docker-compose.e2e.yml)`), compose 파일이 존재하는지 체크하는 guard 를 추가. 또는 `--volumes` flag 만 사용하는 더 단순한 방식(`docker rm -v`, `docker volume rm` 직접 호출)도 고려.

- **[INFO]** `_WT` 계산 시 공백을 포함한 경로 처리
  - 위치: Makefile `_WT := $(shell basename "$(CURDIR)" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9_-]/-/g')`
  - 상세: `basename "$(CURDIR)"` 에서 경로에 공백이 있을 경우 sed 파이프에서 예상치 못한 분리가 발생할 수 있다. 다만 Docker Compose project name 규칙상 공백 자체가 `-` 로 치환되므로 결과는 유효하다. 실용적 위험은 낮음.
  - 제안: 현재 코드로 충분하나, 공백 포함 경로에 대한 동작을 주석으로 보강해도 좋음.

- **[INFO]** `e2e-prune` 에서 `projects` 가 비어 있을 때 분기 처리는 올바르나 `for` 루프의 `proj` 변수가 인용 부호 없이 사용됨
  - 위치: Makefile `e2e-prune`, `for proj in $$projects; do ... docker compose -p $$proj ...`
  - 상세: `$$proj` 에 인용 부호가 없어 project 이름에 공백이 있으면 의도치 않은 분리가 생길 수 있다. Docker Compose project name 은 `[a-z0-9][a-z0-9_-]*` 규칙상 공백 불가이므로 실제 위험은 없으나, 방어적 코딩 관점에서 `"$$proj"` 로 인용.
  - 제안: `docker compose -p "$$proj" -f docker-compose.e2e.yml down -v --remove-orphans`

### plan/in-progress/e2e-compose-isolate.md

- **[WARNING]** plan 체크리스트에 미완료 항목 다수 존재 — 이 commit 에 포함된 code 변경으로 완료된 항목들이 `[ ]` 로 남아있음
  - 위치: `## 작업 체크리스트` 섹션 (라인 1702~1713 해당)
  - 상세: `docker-compose.e2e.yml` 수정, `Makefile` 수정, `PROJECT.md` 갱신, `README.md` 갱신, `CLAUDE.md` 갱신 이 모두 이 commit 에 포함되어 완료되었음에도 `[ ]` 로 표기되어 있다. 이는 plan 문서가 commit 과 함께 체크박스를 갱신하지 않은 상태다. CLAUDE.md plan 라이프사이클 규칙에 따르면 단계가 끝날 때마다 plan 문서를 갱신해야 한다.
  - 제안: `docker-compose.e2e.yml` 수정, Makefile 수정, PROJECT.md 갱신, README.md 갱신, CLAUDE.md 갱신 항목을 `[x]` 로 갱신. `TEST WORKFLOW`, `e2e-prune syntax 확인`, `동시 실행 검증`, `/ai-review`, `plan → complete/` 이동, `PR 생성` 은 아직 진행 중이므로 `[ ]` 유지 또는 상태 명시.

- **[INFO]** Step 3 의 plan 문서에 기재된 `e2e-prune` 구현과 실제 Makefile 구현 간 미세 차이
  - 위치: plan 문서 Step 3 코드 블록 (라인 1683~1686)
  - 상세: plan 에는 `xargs -I{} docker compose -p {} down -v --remove-orphans` 형태로 기재되어 있으나, 실제 Makefile 구현은 `for` 루프 방식으로 구현되었다. 기능 동작은 동일하나 두 방식의 오류 처리 행동이 다를 수 있다 (`xargs` 는 하나 실패 시 계속, `for` 루프도 유사하게 동작하므로 실질적 차이는 없음).
  - 제안: plan 을 최종 구현 기준으로 갱신하거나, "구현 시 for 루프로 변경" 노트를 추가.

### docker-compose.e2e.yml

- **[INFO]** `playwright-runner` 서비스에는 `image:` 명시가 없는 이유가 주석에만 설명됨
  - 위치: `docker-compose.e2e.yml` `playwright-runner` 서비스
  - 상세: `playwright-runner` 는 `mcr.microsoft.com/playwright:v1.59.1-jammy` public image 를 직접 사용하므로 `build:` 섹션이 없다. 변경사항 없이 올바르게 유지되었으나, 헤더 주석에서 "3개 서비스에 image: 명시"라 서술했을 때 `playwright-runner` 제외 이유가 암묵적이다. plan 문서는 이를 명시적으로 언급함.
  - 제안: 현재 코드로 충분. 기능 완전성 문제 없음.

### CLAUDE.md / PROJECT.md / README.md

- **[INFO]** 문서 일관성: 세 문서 모두 동일한 격리 메커니즘을 설명하며 상호 교차 참조가 적절히 구성됨. 중복 설명이 있으나 대상 독자가 다르므로(CLAUDE.md=운영 정책, PROJECT.md=개발 명령 레퍼런스, README.md=입문 가이드) 의도된 설계.
  - 위치: 각 문서의 e2e 격리 관련 섹션
  - 상세: 기능 완전성 관점에서 문제 없음. 다만 README.md 의 "기존 default-name 이미지 stale 로 남으므로 `docker image prune` 권장" 안내가 README 본문에는 없고 plan 문서에만 있다. 실사용자가 마이그레이션 시 혼란할 수 있음.
  - 제안: README.md 의 e2e 섹션 또는 `e2e-prune` 설명 아래에 "기존 `clemvion-e2e-*:latest` 스타일의 stale image 는 `docker image prune` 으로 정리" 안내 한 줄 추가 권장.

## 요약

이번 변경은 병렬 worktree 에서의 e2e docker compose project namespace 충돌 문제를 해결하기 위한 것으로, 핵심 요구사항(컨테이너·볼륨·network 격리, image 캐시 공유, stale project 일괄 정리)은 모두 구현되어 있다. Makefile 의 `COMPOSE_PROJECT` 도출 로직, `docker-compose.e2e.yml` 의 `name:` 제거 및 `image:` 명시, `e2e-prune` 타겟 추가, 그리고 CLAUDE.md/PROJECT.md/README.md 문서 갱신까지 설계 의도와 실제 구현이 잘 일치한다. 주요 우려 사항은 `e2e-prune` 의 `--filter "name=clemvion-e2e"` 가 prefix 매칭이 아닌 exact 매칭으로 동작할 경우 워크트리 project 들이 누락될 수 있다는 점과, `docker-compose.e2e.yml` 의 상대 경로 의존성으로 인한 경로 문제다. plan 체크리스트가 완료된 작업에 대해 갱신되지 않은 점도 규약 위반이나, 기능 동작에는 영향 없다.

## 위험도

LOW
