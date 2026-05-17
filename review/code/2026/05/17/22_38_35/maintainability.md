# 유지보수성(Maintainability) 리뷰

## 발견사항

### Makefile

- **[INFO]** `_WT` 변수명이 내부 구현 세부를 잘 숨기지 못함
  - 위치: `Makefile` 4번째 줄 (`_WT := ...`)
  - 상세: `_WT` 는 "worktree" 를 축약한 것이나, 언더스코어 prefix 가 Make 관례에서 "private" 을 의미하지 않으므로 읽는 사람이 의미를 즉시 파악하기 어렵다. `WORKTREE_BASENAME` 이나 `_WORKTREE_DIR` 처럼 의도를 드러내는 이름이 더 적합하다.
  - 제안: `_WT_BASENAME := $(shell basename "$(CURDIR)" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9_-]/-/g')` 로 변경하고 아래 줄도 일관되게 갱신.

- **[INFO]** `e2e-prune` 타겟의 인라인 셸 스크립트가 다소 길어 가독성이 낮음
  - 위치: `Makefile` `e2e-prune` 타겟 (66~82번째 줄)
  - 상세: 한 `@projects=...` 라인 안에 파이프, `jq`, `if`, `for` 루프까지 다단계 로직이 한 문장으로 연결되어 있다. Make 레시피 특성상 완전한 분리가 어렵지만, 세미콜론 기반 인라인 스크립트는 오류 발생 시 디버깅이 까다롭다.
  - 제안: `scripts/e2e-prune.sh` 로 로직을 추출하고 타겟에서는 `@bash scripts/e2e-prune.sh` 한 줄만 호출하는 방식을 고려. 다른 스크립트(`scripts/setup-githooks.sh`)도 동일 패턴을 이미 사용 중이므로 일관성도 향상된다.

- **[INFO]** `e2e-prune` 내부 `docker compose -p $$proj` 에 파일 플래그 `-f` 가 하드코딩되어 있어, `COMPOSE_E2E` 변수와 중복
  - 위치: `Makefile` `e2e-prune` 루프 내부 (`docker compose -p $$proj -f docker-compose.e2e.yml down ...`)
  - 상세: `COMPOSE_E2E` 변수가 이미 `-f docker-compose.e2e.yml -p $(COMPOSE_PROJECT)` 를 캡슐화하고 있으나, `e2e-prune` 에서는 `$$proj` 를 동적으로 변경해야 하므로 직접 반복이 불가피한 상황이다. 그러나 파일명 `docker-compose.e2e.yml` 은 두 곳에 산재하여 파일명이 바뀌면 두 곳 모두 수정해야 한다.
  - 제안: `E2E_COMPOSE_FILE := docker-compose.e2e.yml` 을 별도 변수로 선언하고, `COMPOSE_E2E` 와 `e2e-prune` 모두 이를 참조하도록 통일.

### docker-compose.e2e.yml

- **[INFO]** 서비스별 인라인 주석이 동일 문구를 반복
  - 위치: `migrate`, `backend-e2e`, `backend-e2e-runner` 서비스의 `image:` 바로 위 주석 3곳
  - 상세: "Project name 과 무관하게 모든 worktree 가 같은 image 를 공유 (build cache 절약)." 문구가 3번 그대로 반복된다. 파일 상단 헤더 주석("Image 캐시 공유" 섹션)에서 이미 설명하고 있으므로 중복이다.
  - 제안: 서비스별 인라인 주석은 제거하거나 `# see: Image 캐시 공유 (헤더 참고)` 처럼 참조 한 줄로 대체. 상단 헤더 주석이 SSOT 역할을 하면 충분.

### CLAUDE.md

- **[INFO]** 추가된 bullet 항목이 기존 항목 대비 문장 길이가 현저히 길어 가독성이 저하됨
  - 위치: `CLAUDE.md` "운영 규칙" 섹션, 새로 추가된 "e2e 인프라는 worktree 별 자동 격리" 항목
  - 상세: 기존 bullet 항목들은 1~2문장 수준으로 핵심만 기술하고 세부 사항은 링크로 처리하는 패턴이다. 추가된 항목은 같은 bullet 안에 격리 방식·project 이름 도출 방식·`e2e-prune` 안내까지 포함되어 있어 밀도가 높고 다른 항목들과 스타일이 다르다.
  - 제안: "격리 세부는 `PROJECT.md §빌드·린트·테스트 명령` 참고" 로 링크를 앞에 두고, 핵심 한 문장만 bullet 에 남기는 방식이 기존 패턴과 일치한다.

### PROJECT.md

- **[INFO]** "Worktree 별 e2e 자동 격리" 단락이 단일 문단으로 너무 길어 독해 부담이 있음
  - 위치: `PROJECT.md` 빌드·린트·테스트 명령 섹션 직후 추가된 bold 단락
  - 상세: 한 문단 안에 project name 도출 방식, 격리 효과, image 공유 메커니즘, override 방법, 상세 참고 위치까지 5가지 개념이 혼재한다. README.md 에서는 같은 내용을 bullet list + 코드 블록으로 분리해 표현하고 있어 두 문서 간 서술 방식이 불일치한다.
  - 제안: PROJECT.md 도 bullet list 형식으로 분리하거나, 핵심(격리 자동화 + override 방법)만 2~3문장으로 압축하고 상세는 README.md 로 참조 유도.

### README.md

- **[INFO]** 변경 내용 자체는 적절하나, 일부 정보가 문서 내에서 두 위치에 중복 서술됨
  - 위치: README.md 의 "격리 인프라 기반 e2e" 섹션 (산문 단락) 과 하위 bullet list
  - 상세: 산문에서 `clemvion-e2e`, `clemvion-e2e-<task>-<slug>` 명명 규칙을 설명한 뒤, 바로 아래 bullet list 에서 같은 내용을 다시 열거한다. 독자가 같은 정보를 두 번 읽게 된다.
  - 제안: 산문은 "Makefile 이 자동 도출하므로 manual 설정 불필요" 라는 결과만 기술하고, 명명 규칙 예시는 bullet list 한 군데에만 남긴다.

## 요약

이번 변경은 e2e compose project 격리라는 명확한 목적을 가지며, 핵심 로직(`_WT`/`COMPOSE_PROJECT` 도출, `COMPOSE_E2E` 변수 주입, `e2e-prune` 타겟 추가, `image:` 명시)은 단일 책임 원칙에 따라 Makefile 한 곳에 집중되어 있어 전반적으로 유지보수성이 양호하다. 다만 세 가지 측면에서 소규모 개선 여지가 있다. 첫째, `_WT` 변수명과 `e2e-prune` 인라인 셸 복잡도는 관련 패턴(`scripts/` 분리)을 이미 사용 중인 코드베이스와 일관성이 다소 어긋난다. 둘째, docker-compose.e2e.yml 내 서비스별 image 주석이 헤더 섹션과 중복된다. 셋째, CLAUDE.md / PROJECT.md / README.md 에 동일 격리 설명이 각 문서의 기존 서술 밀도와 다르게 추가되어 있어, 문서 간 스타일 일관성이 약간 저하된다. 모두 기능에는 영향 없는 사항이며 단기 수정이 어렵지 않다.

## 위험도

LOW
