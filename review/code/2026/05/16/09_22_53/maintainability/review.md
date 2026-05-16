# 유지보수성(Maintainability) 리뷰

## 발견사항

### Makefile

- **[INFO]** `e2e-up` 타겟과 `e2e-test` / `e2e-test-full` 내부의 up 명령이 구조적으로 중복됨
  - 위치: `Makefile` `e2e-test` (L49), `e2e-test-full` (L56) — `$(COMPOSE_E2E) up -d --wait --build backend-e2e` 가 세 곳에 반복
  - 상세: `e2e-test`와 `e2e-test-full`은 컨테이너를 올리는 단계를 직접 인라인 호출한다. `e2e-up` 타겟이 이미 존재하지만, 두 타겟이 이를 의존성으로 참조하지 않아 `--build` 플래그 등 up 옵션을 변경할 때 세 곳을 모두 수정해야 한다. 이번 변경에서도 세 곳을 일제히 수정한 것이 그 증거다.
  - 제안: `e2e-test`와 `e2e-test-full`에 `$(MAKE) e2e-up` 의존 또는 직접 호출을 삽입해 up 로직을 한 곳으로 집중시킨다. 예시:
    ```makefile
    e2e-test: e2e-up
        $(COMPOSE_E2E) run --rm --build backend-e2e-runner; STATUS=$$?; \
        $(MAKE) e2e-down; exit $$STATUS
    ```
    단, 현재 `e2e-test`의 인라인 호출이 `e2e-down` 실패 시에도 상태코드를 보존하는 `; STATUS=$$?; $(MAKE) e2e-down; exit $$STATUS` 패턴을 이미 사용하고 있으므로, `e2e-up`을 Make 타겟 의존성으로 놓을 경우 up 실패 시 즉시 중단된다는 차이점을 주석으로 명시해야 한다.

- **[INFO]** `e2e-up` 타겟에 달린 4행 주석은 가독성 기여가 크지만 `e2e-test` / `e2e-test-full` 타겟에는 동일한 근거 주석이 없음
  - 위치: `Makefile` L35~38 (주석 블록), L49, L59
  - 상세: `e2e-up`에만 `--build` 필요 이유를 설명하는 주석이 있고, 같은 플래그를 사용하는 `e2e-test`와 `e2e-test-full`에는 설명이 없다. 코드를 처음 보는 사람이 인라인 up 명령의 `--build`를 삭제해도 된다고 오해할 여지가 있다.
  - 제안: 위 중복 제거 제안(e2e-up 타겟 재사용)이 적용되면 자연스럽게 해소된다. 인라인 유지가 불가피하다면 타겟별 주석 또는 `# (see e2e-up comment)` 참조를 추가한다.

- **[INFO]** `run --rm --build` 패턴 — `docker compose run --build`는 Docker Compose v2.22+ 이상에서 지원되는 플래그임
  - 위치: `Makefile` L52, L60, L61
  - 상세: `docker compose run --rm --build` 조합의 `--build` 플래그는 Compose 버전에 따라 지원 여부가 다르다. 현재 프로젝트 인프라가 어떤 버전을 사용하는지 `docker-compose.e2e.yml` 주석이나 README 에 명시되어 있지 않으면, 나중에 CI 또는 로컬 환경에서 `unknown flag: --build` 오류가 발생할 수 있다. 이는 기능 문제이기도 하지만 유지보수 관점에서 "왜 이 플래그가 필요한가"에 대한 근거가 없으면 향후 삭제되기 쉽다.
  - 제안: `Makefile` 상단 또는 `e2e-test` 타겟 주석에 요구 Compose 최소 버전(예: `# requires docker compose v2.22+`)을 표기하거나, 지원 여부를 확인하는 가드를 둔다.

---

### backend/src/modules/integrations/third-party-oauth.controller.spec.ts

- **[INFO]** 타입 단언 방식의 일관성 — 변경 전후 모두 `(res as { headers?: Record<string, string> })` 형태의 인라인 캐스팅을 사용함
  - 위치: `third-party-oauth.controller.spec.ts` L428~431 (변경 전 L428~430)
  - 상세: 이번 변경은 `Record<string, unknown>` → `Record<string, string>` 로 타입을 좁혀 `@typescript-eslint/no-base-to-string` 위반을 해소한 것으로, 목적이 명확하고 범위가 최소하다. 다만 같은 spec 파일의 다른 곳에서 동일한 `res.headers` 접근 패턴이 있다면 타입 단언 방식이 산재하게 되어 일관성이 떨어질 수 있다.
  - 제안: 현재 변경 범위는 적절하다. 향후 `res.headers` 접근이 여러 곳에서 반복된다면 공통 헬퍼 타입 가드나 테스트 유틸 함수로 추출을 고려한다.

- **[INFO]** `String(contentType ?? '')` → `contentType ?? ''` 변경 — 가독성 향상
  - 위치: L431 (변경 전 L430)
  - 상세: 이미 타입이 `string`으로 좁혀졌으므로 불필요한 `String()` 래핑을 제거한 것이다. 코드 의도가 더 명확해졌고 일관성 측면에서도 개선이다. 이슈 없음.

---

### plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md

- **[INFO]** 계획 문서의 구조와 서술 품질이 우수함 — 근본 원인, 증거, 의도적 제외 섹션이 명확히 분리되어 있고 체크리스트가 실제 작업 단계를 반영함. 별도 지적 없음.

---

### review/consistency/2026/05/16/09_13_51/SUMMARY.md 및 _prompts 파일들

- **[INFO]** consistency-check 산출물 파일들은 project-generated 성격이므로 직접적인 유지보수성 지적은 해당 없음. 다만 `_prompts/convention_compliance.md` 내 spec convention 내용(cafe24-api-metadata, conversation-thread 등)이 review 세션 payload에 전문(全文) 삽입되어 있어, 이 파일들이 저장소에 커밋될 경우 동일 spec 내용의 복사본이 `review/` 경로에 추가로 존재하게 된다.
  - 위치: `review/consistency/2026/05/16/09_13_51/_prompts/convention_compliance.md`
  - 상세: 이는 orchestrator의 설계(prompt payload = spec snapshot 포함)에 따른 것으로, single source of truth 위반보다는 "시점 기록용 snapshot" 성격이다. CLAUDE.md 의 "review/** 는 시점 기록 성격" 정책과 부합하므로 Critical/Warning 수준의 문제는 아니다. 다만 파일 크기가 상당하고(635+ 라인) 저장소 크기에 지속적으로 기여한다는 점은 인지해 둘 필요가 있다.
  - 제안: 현재 설계 대로 유지하되, prompt payload의 spec 전문 삽입이 불필요하게 커진다면 장기적으로 spec 파일 경로 참조 방식으로 전환하는 것을 검토할 수 있다.

---

## 요약

이번 변경의 핵심은 Makefile의 `--build` 플래그 누락 수정이며, 코드 범위가 좁고 목적이 명확하다. 유지보수성 관점의 주요 지적은 Makefile의 중복 호출 구조다 — `e2e-up`, `e2e-test`, `e2e-test-full` 세 곳에서 동일한 `$(COMPOSE_E2E) up -d --wait --build backend-e2e` 명령이 인라인으로 반복되어, 향후 플래그 변경 시 세 곳을 모두 수정해야 하는 구조다. TypeScript spec 파일의 변경은 타입 좁히기로 가독성과 lint 준수를 동시에 개선한 적절한 수정이다. Plan 문서는 근본 원인 분석과 증거가 충실하게 기술되어 있어 유지보수성에 긍정적으로 기여한다. 전반적으로 코드 변경 범위가 최소화되어 있고 의도가 명확하며, 중복 호출 구조를 제외하면 유지보수성상 중요한 결함은 없다.

## 위험도

LOW
