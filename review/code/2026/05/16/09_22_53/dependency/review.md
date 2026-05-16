# 의존성(Dependency) Review

## 발견사항

- **[INFO]** 변경 대상 파일에 새 외부 패키지/라이브러리 추가 없음
  - 위치: `Makefile`, `backend/src/modules/integrations/third-party-oauth.controller.spec.ts`, `plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md`, `review/consistency/2026/05/16/09_13_51/SUMMARY.md`
  - 상세: 이번 변경 세트는 (1) Makefile에 `--build` 플래그 추가, (2) TypeScript 타입 리터럴 수정, (3) plan/review 문서 신규 생성으로만 구성된다. `package.json`, `package-lock.json`, `docker-compose.e2e.yml`(diff 미포함)의 의존성 섹션에 변경이 없으며 외부 패키지 추가·업그레이드·제거가 없다.
  - 제안: 이슈 없음.

- **[INFO]** Docker BuildKit 내부 의존성 — `--build` 플래그 추가로 Docker 빌드 레이어 캐시에 대한 런타임 의존이 명시됨
  - 위치: `Makefile` 변경 라인 (e2e-up, e2e-test, e2e-test-full 타겟)
  - 상세: `docker compose ... up -d --wait --build backend-e2e` 및 `run --rm --build` 플래그는 Docker BuildKit의 레이어 캐시 재사용에 의존한다. 이는 외부 패키지 의존성이 아니라 빌드 인프라 의존이다. Docker BuildKit은 Docker Engine 23.0+에서 기본 활성화되어 있고 프로젝트가 이미 `docker-compose.e2e.yml`을 사용하고 있으므로 호환성 우려는 없다. 캐시 히트 시 첫 빌드 이후 증분 빌드 오버헤드는 매우 작다.
  - 제안: 이슈 없음. 기존 인프라 의존 범위 안이다.

- **[INFO]** 내부 모듈 간 의존 관계 — `third-party-oauth.controller.spec.ts` 타입 수정
  - 위치: `backend/src/modules/integrations/third-party-oauth.controller.spec.ts` L85-88
  - 상세: `Record<string, unknown>` → `Record<string, string>` 타입 좁히기는 동일 파일 내 타입 단언 수정으로, 외부 의존성이나 내부 모듈 간 의존 구조에 영향을 주지 않는다. `@typescript-eslint/no-base-to-string` lint 규칙 위반을 해소하는 목적이므로 올바른 방향이다.
  - 제안: 이슈 없음.

## 요약

이번 변경 세트(`bg-monitoring-e2e-fix-f789b9`)는 순수한 빌드 플래그 수정(`Makefile --build` 추가)과 TypeScript 타입 정밀화, 문서 추가로만 구성된다. 새 외부 패키지 도입, 버전 변경, 라이선스 문제, 알려진 취약점을 가진 의존성 사용, 번들 크기 변화, 내부 모듈 간 의존 관계 변경은 전혀 없다. Docker BuildKit 레이어 캐시에 대한 런타임 의존이 더 명시적으로 드러나지만 이미 프로젝트가 의존하고 있던 인프라 범위 안이다. 의존성 관점에서 지적할 사항이 없는 무결한 변경이다.

## 위험도

NONE
