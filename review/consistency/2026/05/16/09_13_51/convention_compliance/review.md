# 정식 규약 준수 검토 결과

검토 대상: `Makefile`, `docker-compose.e2e.yml`
검토 모드: 구현 착수 전 (--impl-prep)
검토 일시: 2026-05-16

---

### 발견사항

규약 위반 또는 우려 사항이 없습니다.

`Makefile`과 `docker-compose.e2e.yml`은 인프라 자동화 파일이며, 다음 관점에서 검토하였습니다.

**1. 명명 규약**
- `docker-compose.e2e.yml` 파일명은 CLAUDE.md에서 e2e 격리 인프라 기준 파일로 직접 언급(`make e2e-test`, `docker-compose.e2e.yml` 기반)되어 있으며, 파일명이 일치한다.
- `name: clemvion-e2e` — Compose project name이 dev 환경(`clemvion`)과 명확히 분리되어 있어 CLAUDE.md의 격리 원칙을 준수한다.
- 서비스 이름(`postgres`, `redis`, `minio`, `migrate`, `backend-e2e`, `backend-e2e-runner`, `playwright-runner`)은 용도를 반영한 명확한 kebab-case로 작성되어 있다. 규약에 서비스 이름 패턴을 별도로 정의하지 않으나, 기존 프로젝트 관습과 일치한다.
- Makefile target 이름(`e2e-up`, `e2e-down`, `e2e-test`, `e2e-test-full`)은 CLAUDE.md의 `make e2e-test` 호출 예시와 정확히 일치한다.

**2. 출력 포맷 규약**
- 본 파일들은 노드 Output, API 응답, error code 등의 출력 포맷 규약(`spec/conventions/node-output.md`) 적용 대상이 아니다. 인프라 설정 파일이므로 해당 규약과 교차하는 지점이 없다.

**3. 문서 구조 규약**
- `Makefile`, `docker-compose.e2e.yml`은 spec 문서가 아니므로 Overview/본문/Rationale 3섹션 구성 요건이 적용되지 않는다.
- 두 파일 모두 상단 주석으로 목적과 사용법을 간결하게 기술하고 있어 가독성 측면에서 무리가 없다.

**4. API 문서 규약**
- Swagger 패턴·DTO 명명 규약(`spec/conventions/swagger.md`) 적용 대상 파일이 아니다.

**5. 금지 항목**
- `prd/`, `memory/`, `user_memo/` 경로를 참조하거나 생성하는 패턴이 없다.
- `subprocess.run(["claude", "-p", ...])` 또는 Anthropic SDK 직접 호출 패턴이 없다.
- `e2e-test-full` target의 runner 연결 방식(`&&` + `; STATUS=$$?`)이 일관성 없이 혼용되어 있으나, 이는 정식 규약의 명시적 금지 항목이 아닌 구현 품질 사항이다 (하단 INFO 항목 참조).

---

- **[INFO]** `e2e-test-full` target의 runner 연결 연산자 혼용
  - target 위치: `Makefile` 31-35행, `e2e-test-full` target
  - 위반 규약: 해당 없음 (정식 규약 금지 항목 아님)
  - 상세: `e2e-test`는 `backend-e2e-runner`를 `;`로 연결하고 `STATUS=$$?`로 종료 코드를 포착하는 패턴을 사용한다. 반면 `e2e-test-full`은 `backend-e2e-runner && playwright-runner` 로 `&&`를 사용하여 backend runner 실패 시 playwright runner를 건너뛰지만, 이어서 `; STATUS=$$?`로 playwright runner의 종료 코드만 포착한다. backend runner가 실패했을 때 exit code가 playwright-runner의 결과(미실행 시 0이 아닌 값 또는 255)에 의존하게 되어 의도한 실패 전파가 불명확하다. Makefile 상단 주석에서 "분리" 이유를 설명했으나 `e2e-test-full`의 경우 그 설명이 누락되어 있다.
  - 제안: `e2e-test`와 동일하게 `;`로 분리하고 `STATUS=$$?`로 각각 포착하거나, 주석으로 의도를 명시한다. 정식 규약 항목은 아니므로 규약 갱신이 아닌 코드 수정이 적절하다.

---

### 요약

`Makefile`과 `docker-compose.e2e.yml` 두 파일은 `spec/conventions/` 내 정식 규약(node-output, swagger, migrations, cafe24-api-metadata, conversation-thread)의 직접 적용 대상이 아닌 인프라 자동화 파일이다. CLAUDE.md에서 명시한 `make e2e-test` / `docker-compose.e2e.yml` 기반 e2e 격리 운영 방침과 정확히 부합하며, 금지된 경로·패턴을 사용하지 않는다. 발견된 유일한 사항은 `e2e-test-full` target의 종료 코드 포착 패턴 불일치로, 이는 구현 품질 차원의 INFO이며 규약 위반이 아니다.

### 위험도

NONE
