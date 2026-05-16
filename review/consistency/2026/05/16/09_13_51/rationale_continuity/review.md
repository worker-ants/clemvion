### 발견사항

- **[INFO]** Makefile 인라인 Rationale(기각된 `--abort-on-container-exit` 패턴) 은 유지됨
  - target 위치: `Makefile` 주석 블록 (L23-25) — "Docker Desktop 의 network race 와 충돌하는 사례가 있어 분리"
  - 과거 결정 출처: `Makefile` 자체 주석 (인라인 ADR). `spec/` 레벨 Rationale 없음.
  - 상세: `--abort-on-container-exit` 가 Docker Desktop network race 를 유발해 기각됐고, 대신 `up -d --wait` + `run --rm` + `; STATUS=$$?` 패턴을 채택한 결정이 코드 주석으로 보존되어 있다. 현재 `Makefile` 내 어떤 타겟도 이 기각된 패턴을 재도입하고 있지 않다.
  - 제안: 문제 없음. 향후 타겟 추가 시에도 `--abort-on-container-exit` 재사용은 주석 근거에 따라 금지.

- **[INFO]** `docker-compose.e2e.yml` 의 격리 원칙(ephemeral, 호스트 포트 미노출, `OAUTH_STUB_MODE`) 유지됨
  - target 위치: `docker-compose.e2e.yml` 전체
  - 과거 결정 출처: `docker-compose.e2e.yml` 파일 상단 주석 블록 + `CLAUDE.md` e2e 인프라 원칙 ("e2e 는 `docker-compose.e2e.yml` 에서 격리 인프라" 정책)
  - 상세: (a) `name: clemvion-e2e` 로 dev 인프라와 project-level 격리, (b) 호스트 포트 미노출로 dev 포트 충돌 방지, (c) 영속 볼륨 없는 ephemeral 설계, (d) `OAUTH_STUB_MODE: "true"` 로 OAuth 실 호출 차단. 이 4가지 invariant 가 모두 유지된다.
  - 제안: 향후 서비스 추가 시 이 4가지 속성을 동일하게 적용해야 한다. 특히 `OAUTH_STUB_MODE` 는 e2e 격리의 핵심이므로 신규 OAuth 의존 기능 e2e 작성 시 이 설정이 테스트 의미에 영향을 주는지 반드시 검토.

- **[INFO]** `profiles: ["test"]` runner 분리 원칙 유지됨
  - target 위치: `docker-compose.e2e.yml` L164, L182 (`backend-e2e-runner`, `playwright-runner`)
  - 과거 결정 출처: `docker-compose.e2e.yml` 주석("runner 서비스는 `profiles: ["test"]` 로 분리되어 `make e2e-up` 만으로는 안 뜬다")
  - 상세: `make e2e-up` 과 `make e2e-test` 의 역할이 명확히 분리되어 있고, runner 서비스는 profile 게이트로 분리된 설계가 유지된다.
  - 제안: 문제 없음.

- **[INFO]** Makefile `--build` 플래그 누락 — plan 의 결정과 현재 파일 상태 불일치 (Rationale 연속성 범위 경계)
  - target 위치: `Makefile` L18, L27, L32 (`e2e-up`, `e2e-test`, `e2e-test-full` 타겟의 `up -d --wait` 호출)
  - 과거 결정 출처: `plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md` — "e2e-up, e2e-test, e2e-test-full 타겟에 `--build` 플래그 추가" (체크박스 `[x]`)
  - 상세: plan 문서는 `--build` 추가가 완료됐다고 표기하지만, 실제 `Makefile` 에는 `--build` 가 없다. `--build` 추가는 기각된 어떤 대안을 재도입하는 것이 아니며(기각된 대안은 `--abort-on-container-exit` 패턴이었음), 기존 `up -d --wait` 패턴을 유지하면서 캐시 새로고침만 추가하는 것이므로 Rationale 원칙과 충돌하지 않는다. 다만 plan 이 완료됐다고 기록됐는데 파일이 미반영된 상태는 `plan_coherence` 검사 영역이며 Rationale 연속성 자체의 위반은 아니다.
  - 제안: 본 checker 범위 밖이나 기록 목적으로 명시. `plan_coherence` checker 또는 구현 재확인이 필요.

### 요약

`Makefile` 과 `docker-compose.e2e.yml` 은 spec 레벨의 `## Rationale` 섹션 대상 문서가 아니다. 이 두 파일에 관련된 과거 설계 결정은 (a) Makefile 인라인 주석의 `--abort-on-container-exit` 기각 기록, (b) `docker-compose.e2e.yml` 의 ephemeral·호스트포트 미노출·project 격리·`OAUTH_STUB_MODE` invariant 네 가지, (c) `profiles: ["test"]` runner 분리 원칙이다. 현재 두 파일의 내용은 이 모든 과거 결정과 충돌하지 않으며, 제공된 spec Rationale 발췌(data-model, OAuth/integration, navigation, user-profile, AI-assistant 영역)는 이 두 인프라 파일과 직접적 연관이 없어 충돌 가능성이 없다. plan 문서와 실제 Makefile 상태 간 불일치(--build 누락)는 Rationale 원칙 위반이 아니며 plan_coherence 영역이다.

### 위험도

NONE
