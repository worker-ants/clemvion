# 의존성(Dependency) 리뷰 결과

## 발견사항

- **[INFO]** `ioredis` — 기존 의존성, 신규 추가 없음
  - 위치: `codebase/backend/test/execution-seq-allocator-load.e2e-spec.ts` line 3
  - 상세: `import Redis from 'ioredis'` 는 `package.json` dependencies 에 이미 `"ioredis": "^5.10.1"` 로 등재된 기존 패키지다. 새 의존성 추가가 없다.
  - 제안: 없음.

- **[INFO]** `node:crypto` — Node.js 표준 내장 모듈
  - 위치: `codebase/backend/test/execution-seq-allocator-load.e2e-spec.ts` line 2
  - 상세: `randomUUID` 는 `node:crypto` 내장 모듈에서 가져온다. 외부 패키지(`uuid` 등)를 쓰지 않고 표준 라이브러리를 사용한 것은 올바른 선택이다.
  - 제안: 없음.

- **[INFO]** `@jest/globals` — 기존 devDependency
  - 위치: `codebase/backend/test/execution-seq-allocator-load.e2e-spec.ts` line 1
  - 상세: `jest` (`^30.0.0`) 및 `@types/jest` (`^30.0.0`) 는 이미 devDependencies 에 있고, `@jest/globals` 는 jest 패키지에 포함된다. 별도 추가 없이 사용 가능하다.
  - 제안: 없음.

- **[INFO]** `docker-compose.e2e.yml` — 새 환경변수(`REDIS_HOST`, `REDIS_PORT`) 추가
  - 위치: `docker-compose.e2e.yml` backend-e2e-runner 서비스 environment 섹션
  - 상세: `REDIS_HOST: redis` / `REDIS_PORT: "6379"` 두 줄이 추가되었다. Docker Compose 에서 `redis` 는 같은 파일 내 `redis:` 서비스의 hostname 으로 기존부터 존재한다(`backend-e2e` 서비스에도 이미 동일 값이 있다). 외부 패키지 추가 없이 환경 변수 명시화만이다.
  - 제안: 없음. 추가된 값이 `?? 'redis'` 기본값과 동일하므로 기능상 변화 없이 의존성을 명시한다.

- **[INFO]** `ioredis` 버전 고정 방식
  - 위치: `codebase/backend/package.json` line 66
  - 상세: `"ioredis": "^5.10.1"` — caret(`^`) 범위 지정이며 완전한 exact pin 이 아니다. pnpm lockfile(`pnpm-lock.yaml`)이 실제 설치 버전을 고정하므로 CI 재현성 위험은 lockfile 수준에서 관리된다. 이는 프로젝트 전반의 기존 버전 관리 전략과 일관된다.
  - 제안: 현행 pnpm lockfile 기반 고정 정책을 유지하면 충분하다.

- **[INFO]** 내부 의존성 — `ExecutionSeqAllocator` 직접 import
  - 위치: `codebase/backend/test/execution-seq-allocator-load.e2e-spec.ts` line 4
  - 상세: `'../src/modules/websocket/execution-seq-allocator.service'` 를 직접 import 한다. NestJS DI 컨테이너를 우회해 인스턴스를 직접 생성하는 구조이며, 이는 동파일 내 주석과 sibling unit spec(`execution-seq-allocator.service.spec.ts`)의 동일 패턴을 따른다. 모듈 경계 위반이나 순환 의존 위험 없음.
  - 제안: 없음.

## 요약

이번 변경은 신규 외부 패키지를 전혀 추가하지 않는다. 테스트 파일이 사용하는 `ioredis`, `@jest/globals`, `node:crypto` 는 모두 기존 의존성이거나 Node.js 내장 모듈이다. `docker-compose.e2e.yml` 변경도 기존 `redis` 서비스에 대한 환경 변수 명시화일 뿐 새 컨테이너 이미지나 패키지 도입이 없다. 버전 고정은 pnpm lockfile 레벨에서 이미 관리되고 있으며, 라이선스·취약점·번들 크기·버전 충돌 위험은 해당 없다.

## 위험도

NONE
