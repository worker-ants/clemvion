# Cross-Spec 일관성 검토 — `Makefile, docker-compose.e2e.yml`

검토 모드: `--impl-prep` (구현 착수 전 검토)
대상 범위: `Makefile` e2e 타겟에 `--build` 플래그 추가

---

## 발견사항

이번 변경은 `Makefile` 의 `e2e-up` / `e2e-test` / `e2e-test-full` 타겟에 `--build` 플래그를 추가하는 순수 빌드 툴링 버그픽스다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 규칙 중 어느 것도 수정하지 않는다. 아래 점검 결과를 기술한다.

### 데이터 모델 충돌

발견 없음. `Makefile` / `docker-compose.e2e.yml` 은 엔티티 정의를 보유하지 않는다.

### API 계약 충돌

발견 없음. 빌드 플래그 변경은 e2e 실행 방식에만 영향을 미치며, HTTP endpoint / request-response shape 과 무관하다.

### 요구사항 ID 충돌

발견 없음. 이 변경에 요구사항 ID 가 사용되지 않는다.

### 상태 전이 충돌

발견 없음. `docker-compose.e2e.yml` 의 서비스 의존 체인(`depends_on: condition: service_healthy / service_completed_successfully`)은 변경되지 않으며, `backend-e2e` 의 상태 전이(`healthy` 로 인정되어야 runner 기동)도 그대로다.

### 권한·RBAC 모델 충돌

발견 없음. 빌드 플래그는 RBAC 구조와 무관하다.

### 계층 책임 충돌

발견 없음. `docker-compose.e2e.yml` 은 이미 `backend-e2e` 와 `backend-e2e-runner` 모두에 `build:` 섹션을 보유하고 있다. `--build` 플래그 추가는 기존 Compose 설계(빌드 가능 서비스)와 완전히 일치한다.

---

### 참조 spec 와의 정합 확인

| 참조 위치 | 내용 | 정합 여부 |
|----------|------|----------|
| `spec/conventions/migrations.md:57` | `make e2e-test` 로 마이그레이션 dry-run 수행 | 명령 이름 변경 없음 — 정합 |
| `.claude/skills/developer/SKILL.md` §TEST WORKFLOW | `make e2e-test` / `make e2e-test-full` / `make e2e-down` 명령 | 명령 이름 변경 없음 — 정합 |
| `.claude/skills/developer/SKILL.md:66` | "e2e 는 `docker-compose.e2e.yml` 에서 backend 이미지를 빌드해 실행" | `--build` 는 이 설명이 항상 성립하도록 보장하는 수정 — 정합 강화 |
| `spec/0-overview.md §2.6` | "셀프 호스팅: Docker Compose에 포함" (MinIO) | e2e Compose 파일 구조 변경 없음 — 정합 |

---

### 부가 관찰 (INFO)

- **[INFO]** `docker-compose.e2e.yml` 의 `backend-e2e` 서비스는 `--build` 를 Makefile 에서 지정하지 않아도 `build:` 섹션이 존재해 Compose 가 최초에 빌드한다. 그러나 이후 소스 변경 시 `--build` 없이는 재빌드가 일어나지 않는다는 점이 이번 버그의 근본 원인이다. 이 사실은 Makefile help 메시지(`e2e-up: e2e 인프라 + backend-e2e 까지 백그라운드 기동`)와도 일치하며, `--build` 추가 후에도 동일 서술이 유효하다. spec 수정 불필요.
  - target 위치: `Makefile:12-35`
  - 충돌 대상: 없음 (단순 관찰)
  - 상세: 변경이 기존 Compose 구조 및 모든 참조 spec 과 일치함을 확인하는 정보성 메모.
  - 제안: 필요 없음.

---

## 요약

이번 구현 대상(`Makefile` e2e 타겟에 `--build` 플래그 추가)은 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 중 어떤 영역과도 충돌하지 않는다. `docker-compose.e2e.yml` 은 이미 빌드 가능한 서비스 구조를 보유하고 있으며, `spec/conventions/migrations.md` 및 `.claude/skills/developer/SKILL.md` 가 참조하는 `make e2e-test` 명령 이름도 변경되지 않는다. 오히려 `developer/SKILL.md` 가 "e2e 는 backend 이미지를 빌드해 실행"이라고 명시한 설계 의도를 `--build` 추가가 항상 보장하게 되어 정합성이 강화된다. Cross-Spec 관점에서 구현 착수를 차단할 이유가 없다.

## 위험도

NONE
