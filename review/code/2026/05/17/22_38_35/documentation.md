# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** CLAUDE.md 의 새 규칙이 단방향 참조로만 연결됨
  - 위치: `CLAUDE.md` — "운영 규칙" 섹션, 신규 추가 bullet
  - 상세: `PROJECT.md §빌드·린트·테스트 명령` 을 참조(`참고`)하고 있으나, 반대로 PROJECT.md 에는 CLAUDE.md worktree 운영 규칙을 보완 설명하는 링크가 없다. 사용자가 PROJECT.md 만 읽으면 격리 메커니즘의 전체 그림(worktree 정책 자체)을 놓칠 수 있다.
  - 제안: PROJECT.md 의 **Worktree 별 e2e 자동 격리** 단락 끝에 `(상세 worktree 운영 정책은 \`CLAUDE.md §Worktree 기반 작업 정책\` 참고)` 문장을 추가해 양방향 교차 참조를 완성한다. 단, 내용 자체는 정확하므로 필수 수정 사항은 아니다.

- **[INFO]** `e2e-prune` 의 jq 의존성이 PROJECT.md 명령 표에는 기재되었으나 README 에는 사전 요구 사항에 미기재
  - 위치: `README.md` — "사전 요구 사항" 섹션 (Node.js 20+, Docker & Docker Compose 두 항목)
  - 상세: `make e2e-prune` 이 `jq` 바이너리를 필요로 하는 사실이 Makefile 주석(`jq 의존 — macOS 는 brew install jq`)과 help 텍스트(`jq 필요`)에는 표기되어 있고, README 의 `make e2e-prune` 명령 소개 줄에도 `(jq 필요)` 가 표기되어 있다. 그러나 "사전 요구 사항" 섹션에는 포함되지 않아 독자가 빠르게 요구 사항을 점검할 때 jq 를 누락할 수 있다.
  - 제안: README 의 사전 요구 사항 목록에 `jq (make e2e-prune 실행 시; macOS: \`brew install jq\`)` 항목을 선택적 도구로 추가한다.

- **[INFO]** docker-compose.e2e.yml 파일 자체의 헤더 주석이 리뷰 대상에 없어 일관성 미확인
  - 위치: `docker-compose.e2e.yml` (이번 diff 에 포함되지 않음)
  - 상세: commit 메시지에 `docker-compose.e2e.yml 의 name: clemvion-e2e 제거` 및 `image:` 명시가 포함됨을 언급하고, PROJECT.md 의 격리 설명이 `docker-compose.e2e.yml 헤더 주석` 을 참조하도록 안내하고 있다. 해당 파일 헤더에 격리 방식 주석이 실제로 추가되었는지 이번 리뷰에서 확인할 수 없다. Makefile 상단 주석이 동일 내용을 이미 포함하고 있으므로 중복이 되더라도 compose 파일 자체 헤더에도 요약 주석이 있어야 파일을 독립적으로 열 때 의미를 파악할 수 있다.
  - 제안: `docker-compose.e2e.yml` 파일 상단에 project name 이 `name:` 키 없이 Makefile `-p` 로 주입됨을 명시하는 1~3줄 주석이 있는지 확인하고, 없다면 추가한다.

- **[INFO]** Makefile `e2e-prune` 의 filter 조건이 주석과 미묘하게 다름
  - 위치: `Makefile` — `e2e-prune` 타겟 본문
  - 상세: 주석(`본 타겟은 'clemvion-e2e' 접두를 가진 모든 compose project`)은 접두어 필터임을 설명하나, 실제 명령은 `--filter "name=clemvion-e2e"` (등호 일치)를 사용하고 docker compose ls 의 name 필터가 부분 문자열 매칭인지 정확한 일치인지 docker 버전에 따라 다를 수 있다. 주석과 코드 의미가 정확하게 일치하는지 명확히 하거나, 필터 동작을 주석에 보충 설명하면 혼란을 줄일 수 있다.
  - 제안: 주석에 `--filter "name=clemvion-e2e"` 가 docker compose ls 에서 name 접두어 매칭으로 동작함을 명시한다 (`docker compose ls` 의 name 필터는 접두어 부분 일치임을 확인 후 주석에 반영).

- **[INFO]** CHANGELOG 업데이트 없음
  - 위치: 루트 CHANGELOG (존재 여부 미확인)
  - 상세: 이번 변경은 병렬 worktree e2e 격리라는 기능적으로 중요한 인프라 변경이다. 프로젝트에 CHANGELOG 파일이 있다면 해당 변경을 기재해야 한다. commit 메시지가 상세히 작성되어 있으므로 git log 만으로 추적 가능하지만, CHANGELOG 를 별도 관리하는 경우라면 누락이다.
  - 제안: CHANGELOG 가 관리 중이라면 `fix(e2e): isolate docker compose project per worktree` 항목 추가를 검토한다.

## 요약

이번 변경(`fix(e2e): isolate docker compose project per worktree`)은 문서화 측면에서 전반적으로 충실하다. CLAUDE.md · PROJECT.md · README.md · Makefile 네 곳 모두 동일 내용(worktree 별 compose project 격리, `e2e-prune` 타겟, image 공유)을 일관되게 반영했으며, 각 파일에서 적절한 수준의 설명과 예시를 포함하고 있다. 발견된 사항은 모두 INFO 등급으로, 문서가 없거나 오래되어 코드와 어긋난 경우는 없다. 다만 (1) 양방향 교차 참조의 미완성, (2) jq 사전 요구 사항이 README 전용 섹션에 미기재, (3) docker-compose.e2e.yml 파일 자체의 헤더 주석 추가 여부 미확인, (4) Makefile 주석과 filter 로직 사이의 표현 불일치 등 소소한 개선 여지가 있다.

## 위험도

LOW
