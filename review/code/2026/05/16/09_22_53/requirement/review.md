# 요구사항(Requirement) Review

## 발견사항

- **[INFO]** `e2e-test-full` 의 `e2e-down` 실행 조건 비대칭
  - 위치: `Makefile` `e2e-test-full` 타겟 (변경 후 L55-62)
  - 상세: `e2e-test` 타겟은 `; STATUS=$$?; $(MAKE) e2e-down; exit $$STATUS` 패턴으로 테스트 성패와 무관하게 항상 `e2e-down` 을 수행한다. 반면 `e2e-test-full` 은 `backend-e2e-runner && playwright-runner; STATUS=$$?; $(MAKE) e2e-down` 구조다. `&&` 연결로 인해 `backend-e2e-runner` 가 실패하면 `playwright-runner` 는 건너뛰고 곧바로 `e2e-down` 이 실행되므로 `e2e-down` 자체는 도달한다. 단, 이 동작은 기존 코드에서 이미 존재하던 것이며 이번 변경이 도입한 문제는 아니다. 그러나 요구사항 관점에서 "끝나면 자동 down" 의도가 `e2e-test` 와 동일하게 보장되는지 명시적 주석이 없어 독자가 혼동할 여지가 있다.
  - 제안: `e2e-test` 와 동일하게 `; STATUS=$$?; \` 패턴으로 통일하거나, 현재 `&&` 패턴이 의도적임을 주석으로 명시한다.

- **[INFO]** `run --rm --build` 의 `--build` 는 일부 Docker Compose 버전에서 `run` 서브커맨드에 미지원
  - 위치: `Makefile` `e2e-test` L52, `e2e-test-full` L60-61
  - 상세: `docker compose run --build` 플래그는 Compose v2.22+(Docker Desktop 4.23+) 이상에서 도입되었다. 그 이전 버전 환경(특히 CI 의 Docker-in-Docker 이미지)에서는 `unknown flag: --build` 오류로 e2e 전체가 실패할 수 있다. `up --build` 는 오래 전부터 지원되므로 `backend-e2e` 이미지는 `up` 단계에서 이미 빌드된다. `runner` 이미지 역시 소스 변경이 없다면 `up --build` 이후에는 캐시로 처리된다. 결과적으로 `run --rm --build runner` 는 "runner 이미지도 항상 최신 빌드"라는 방어적 의도이나, 버전 의존성을 새로 도입하는 비용이 있다.
  - 제안: 최소 지원 Docker Compose 버전을 README 또는 `Makefile` 상단 주석에 명시하거나, CI 환경의 Compose 버전이 v2.22+ 임을 확인하여 이슈 없음을 기록한다.

- **[INFO]** `third-party-oauth.controller.spec.ts` — `contentType` 이 `undefined` 일 때의 단언 의미 변화
  - 위치: `backend/src/modules/integrations/third-party-oauth.controller.spec.ts` L86-88
  - 상세: 변경 전 코드는 `String(contentType ?? '')` 로 `undefined` 를 빈 문자열로 변환한 뒤 `.toContain('text/html')` 를 단언했다. 변경 후 코드는 `contentType ?? ''` 로 이미 `string` 타입이 보장된 값에 `.toContain('text/html')` 를 단언한다. 동작 결과는 동일하나(헤더가 없으면 두 경우 모두 단언 실패), 변경 전에는 `String()` 래핑이 런타임 보호막 역할을 했고, 변경 후에는 타입 시스템이 `Record<string, string>` 으로 명시됨으로써 컴파일 타임에 동등한 보증이 이뤄진다. 의도와 구현 간 괴리 없이 타입 정확도를 높인 올바른 변경이다. 단, 헤더가 실제로 `string` 이 아닌 값(예: `string[]`)이 들어올 가능성은 zero인지 원본 Express 응답 객체와의 정합성을 확인할 필요가 있다.
  - 제안: `res.headers` 의 실제 타입이 `Record<string, string>` 임을 테스트 setup 주석으로 명시하면 후속 유지보수자의 혼동을 방지할 수 있다. 기능상 문제는 없다.

- **[INFO]** plan 문서 체크리스트 — "REVIEW WORKFLOW" 항목이 미완료 상태로 `in-progress/` 에 위치
  - 위치: `plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md` L157
  - 상세: `[ ] REVIEW WORKFLOW` 항목이 미체크 상태다. 이는 현재 진행 중인 코드 리뷰 세션 자체이므로 `in-progress/` 위치는 정확하다. 리뷰 완료 후 이 항목이 `[x]` 로 갱신되고 문서가 `complete/` 로 이동되어야 한다. 리뷰어로서 plan 상태가 의도에 부합함을 확인했다.
  - 제안: 리뷰 RESOLUTION 이후 plan 문서를 `[x] REVIEW WORKFLOW` 로 갱신하고 `git mv` 로 `plan/complete/` 이동을 수행한다.

- **[INFO]** `e2e-up` 단독 타겟의 `--build` 추가 — CI/개발자 수동 호출 시 영향
  - 위치: `Makefile` `e2e-up` 타겟 L41
  - 상세: `e2e-up` 은 독립적으로 호출 가능한 타겟이다. `--build` 를 추가함으로써 `e2e-up` 만 호출하는 스크립트나 CI step 이 있다면 빌드 시간이 추가된다. 이는 의도된 변경이며 주석으로도 설명되어 있다. 요구사항(stale 이미지 방지) 관점에서는 올바르다.
  - 제안: 없음. 의도와 구현이 일치한다.

## 요약

이번 변경은 `make e2e-*` 타겟에 `--build` 플래그를 추가하여 소스 변경 후 stale Docker 이미지로 인한 사일런트 404 실패를 근본적으로 차단하는 단일 목적 핫픽스다. 변경 범위가 좁고(Makefile 4줄, spec 파일 1개 타입 수정), 주석으로 배경과 이유가 충분히 설명되어 있어 의도와 구현 간 괴리가 없다. `e2e-test-full` 의 `&&` 연결 패턴과 `docker compose run --build` 의 최소 버전 의존성이 문서화되지 않은 암묵적 전제이나, 기존 코드에서 이미 존재하거나 현재 환경에서 검증된 사항이다. 타입 수정(`Record<string, string>`)도 기능 변경 없이 eslint 경고를 해소하는 올바른 변경이다. 전반적으로 요구사항(stale 이미지 방지, lint 오류 해소)을 완전히 충족하며 미완성 항목이나 비즈니스 로직 오류는 없다.

## 위험도

LOW
