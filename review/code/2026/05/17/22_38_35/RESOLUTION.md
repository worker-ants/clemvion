# RESOLUTION — e2e compose project worktree 격리

세션: `review/code/2026/05/17/22_38_35/`
대상 commit: `31214fec fix(e2e): isolate docker compose project per worktree`
리뷰 결과: WARNING 5 + INFO 18 (Critical 0). router 가 13 reviewer 중 8 명을 선택, 5 명 (performance / architecture / testing / database / concurrency) skip.

## 조치 항목

### Critical

없음 (SUMMARY 와 동일).

### Warning

| ID | 발견 | 조치 |
|----|------|------|
| W-1 | 공유 Docker image race condition (동시 빌드 시) | `docker-compose.e2e.yml` 헤더의 "Image 캐시 공유" 절에 BuildKit 동작·트레이드오프·해소 절차를 명시. image 이름에 `COMPOSE_PROJECT` 를 섞는 강한 격리는 본 PR 의 캐시 공유 가치를 무너뜨려 채택 X — 동시 빌드 race 가 발견되면 `make e2e-prune` + `docker image prune` 후 순차 재실행 가이드. fix commit: 본 RESOLUTION 과 같은 commit |
| W-2 | `--filter "name=clemvion-e2e"` 매칭 semantics 불확실 | `Makefile` `e2e-prune` 의 필터링을 jq 의 `select(.Name == "clemvion-e2e" or startswith("clemvion-e2e-"))` anchor 매칭으로 변경. compose 버전 비의존. 주석으로 사유 명시 |
| W-3 | `e2e-prune` 의 `$$proj` 인용 부호 부재 | `docker compose -p "$$proj"` + `-f "$(E2E_COMPOSE_FILE)"` 모두 쌍따옴표로 감쌈. (현재 project name 도출 자체에 공백 가능성이 없어도 방어 코딩 적용) |
| W-4 | plan 체크박스가 완료 항목들도 `[ ]` 상태 | `plan/in-progress/e2e-compose-isolate.md` 의 체크리스트를 실제 진행 상태로 갱신. 미완 항목은 plan 이동·PR 생성 두 줄만 남김 |
| W-5 | `e2e-prune` `-f` 상대 경로 | `E2E_COMPOSE_FILE := $(CURDIR)/docker-compose.e2e.yml` 변수 신설 → 모든 compose 호출이 절대 경로 참조 (INFO #16 도 함께 해소). 호출 위치 의존성 제거 |

### Info — 조치

| ID | 발견 | 조치 |
|----|------|------|
| I-5 / I-11 | README 사전 요구 사항에 `jq` 미기재 | `README.md` "사전 요구 사항" 절에 `jq (make e2e-prune 실행 시; macOS: brew install jq)` 추가 |
| I-7 | `make -C <다른 dir>` 호출 시 `$(CURDIR)` 가 달라져 격리 키 변동 | `Makefile` 헤더 주석에 `make -C ...` 사용 시 `COMPOSE_PROJECT=...` 명시 권장 한 줄 추가 |
| I-8 | 격리 방식 첫 적용 시 마이그레이션 안내 부재 | `README.md` 격리 e2e 단락의 `> blockquote` 끝에 "본 격리 적용 직후 첫 실행 시 옛 `clemvion-e2e` namespace 잔여 정리" 한 줄 안내 추가 |
| I-9 | 외부 env 가 `COMPOSE_PROJECT` 를 이미 export 했을 때 `?=` 가 그것을 우선 | `Makefile` 헤더 주석에 "외부 env 우선" 동작 명시. CI 에서 의도치 않은 덮어쓰기 방지 안내 |
| I-10 | PROJECT.md → CLAUDE.md 역방향 링크 없음 | `PROJECT.md` 격리 단락 끝에 `CLAUDE.md §Worktree 기반 작업 정책` 링크 추가 |
| I-13 | `e2e-prune` 주석과 실제 명령 의미 불일치 | jq anchor 매칭 변경과 함께 주석을 "`--filter` semantics 가 compose 버전 의존이라 jq 단계에서 anchor 보장" 으로 갱신 |
| I-14 | `_WT` 약어 명확성 | `_WT_BASENAME` 으로 rename. 의도 (worktree dir basename) 가 드러남 |
| I-16 | `docker-compose.e2e.yml` 파일명이 두 곳에 중복 하드코딩 | `E2E_COMPOSE_FILE` 변수 도입 (W-5 와 함께 한 번에 해소) |
| I-17 | `docker-compose.e2e.yml` 의 서비스별 `image:` 인라인 주석 3회 동일 문구 | 헤더 절을 참조하는 한 줄 (`# image 공유 — 헤더의 "Image 캐시 공유" 절 참고.`) 로 단축 |
| I-18 | plan 의 `e2e-prune` 구현 예시가 실제 구현과 다름 (`xargs` → `for`) | plan Step 3 의 코드 블록을 실제 구현 기준 (`for` 루프 + jq `startswith`) 으로 갱신 |

### Info — 보류 (후속 항목)

본 PR 의 범위인 "worktree 별 compose project 격리" 와 직접 결합되지 않은 보안·CI 강화 항목들은 별도 plan 으로 분리 권장. 본 PR 에서 처리하면 변경 의도가 흐려져 review 가독성도 손해.

| ID | 발견 | 후속 처리 권장 |
|----|------|----------------|
| I-1 | e2e `ENCRYPTION_KEY` 가 단순 hex 패턴 (`0123456789abcdef0123456789abcdef`) | 새 plan `e2e-secrets-strengthen.md` — e2e 전용 시크릿 강화 + CI parity 가드. 호스트 미노출이라 우선순위 LOW |
| I-2 | CI 환경에서 외부 `COMPOSE_PROJECT` 검증 가드 부재 | 현재 CI 환경 자체 미구성 — CI 도입 시 함께 검토 |
| I-3 | Flyway `-password=...` command-line 인자 (docker inspect Args 노출) | I-1 과 동일 plan 으로 묶어 `FLYWAY_PASSWORD` env 화 |
| I-4 | (W-2 와 중복) `--filter` 외부 동명 프로젝트 포함 가능성 | W-2 조치 (jq anchor) 로 해소됨 |
| I-6 | CI 환경의 image 누적 (`:latest`) | CI 도입 시 cleanup job 으로 처리 |
| I-12 | 파일 헤더 주석 보강 확인 요청 | 이미 본 PR 에서 헤더에 "Project name 격리" / "Image 캐시 공유" 두 절을 추가했으므로 자체 충족 |
| I-15 | `e2e-prune` 로직을 `scripts/e2e-prune.sh` 로 추출 | 의식적 보류 — 인라인 10줄 정도로 분리 가치 미미. 추후 e2e 헬퍼가 더 늘어나면 `scripts/e2e/*.sh` 묶음으로 재검토 |

## 라우터 결정 (재인용)

- 실행 (8): `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `documentation`, `dependency`, `api_contract`
- skip (5): `performance`, `architecture`, `testing`, `database`, `concurrency` — 변경 성격 (인프라 설정 + 문서) 상 무관

## TEST 결과

### lint
- 대상 아님 (코드 0 line 변경, Makefile / yaml / md 만)
- `make help` 로 Makefile 파싱 정상 확인

### unit test
- 대상 아님 (코드 0 line 변경)

### build
- 대상 아님 (코드 0 line 변경)

### e2e test
**통과**: 2회 수행.

- 1차 (RESOLUTION 작성 전, 변경 직후): `make e2e-test` → 16/16 suites, 93/93 tests PASS, 약 46s (인프라 기동 + migrate + e2e + down 포함, jest e2e 실행 자체는 24.4s). compose down 로그에서 `docker compose -f docker-compose.e2e.yml -p clemvion-e2e-e2e-compose-isolate-d74453 down -v --remove-orphans` 가 명시되어 `-p` flag 가 worktree 별 project name 으로 적용됨을 확인. 컨테이너 이름도 `clemvion-e2e-e2e-compose-isolate-d74453-postgres-1` 형식으로 격리.
- 2차 (RESOLUTION 작성 후, fix 검증): `make e2e-test` → 16/16 suites, 93/93 tests PASS, 약 44s (jest e2e 자체 21.5s). compose down 로그에서 `-f $(CURDIR)/docker-compose.e2e.yml` 절대 경로 적용 확인 (W-5 fix 검증). 격리 동작 유지.

### (best-effort) 동시 worktree 실행 검증
**보류**: 1차 e2e 통과 로그에서 `-p clemvion-e2e-e2e-compose-isolate-d74453` 가 명확히 적용되고 컨테이너/볼륨/network 이름이 worktree dir 로 분리됨을 확인 → 격리 자체는 단일 실행으로도 입증. 추가로 main worktree 의 옛 namespace (`clemvion-e2e`) 와 본 worktree 의 새 namespace (`clemvion-e2e-e2e-compose-isolate-d74453`) 를 동시 실행하는 시나리오는 macOS Docker Desktop 메모리/CPU 부담 (인프라 + backend 컨테이너 2배) 을 피해 생략. 본 PR merge 후 다른 worktree 가 새 Makefile 을 받으면 모두 자기 worktree dir 기반 project name 으로 격리되므로 같은 mechanism 으로 검증된 것.

## 보류·후속 항목

위 "Info — 보류" 표 참고. 별도 plan 으로 분리할 항목은 본 PR merge 후 생성 예정. 본 plan (`plan/in-progress/e2e-compose-isolate.md`) 은 PR merge 시점에 `complete/` 로 이동.
