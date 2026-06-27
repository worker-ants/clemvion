# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** `ioredis` 직접 임포트 — 기존 의존성 재사용
  - 위치: `codebase/backend/test/execution-seq-allocator-load.e2e-spec.ts` line 3
  - 상세: `import Redis from 'ioredis'`는 `package.json` dependencies에 이미 선언된 `"ioredis": "^5.10.1"`을 그대로 사용한다. 신규 패키지 추가 없음.
  - 제안: 해당 없음. 적절한 재사용.

- **[INFO]** `@jest/globals` 명시적 임포트 — 기존 패턴 일치
  - 위치: `codebase/backend/test/execution-seq-allocator-load.e2e-spec.ts` line 1
  - 상세: `package.json`에 `"@jest/globals"` 항목이 명시적으로 없으나, `jest` 패키지(`^30.0.0`)가 `@jest/globals`를 번들로 포함한다. 프로젝트의 다른 e2e 스펙 파일들(`app.e2e-spec.ts`, `workflow-assistant.e2e-spec.ts` 등)도 동일하게 `from '@jest/globals'` 임포트를 사용하고 있으므로 기존 확립된 패턴과 일치한다.
  - 제안: 해당 없음.

- **[INFO]** `node:crypto` — Node.js 내장 모듈
  - 위치: `codebase/backend/test/execution-seq-allocator-load.e2e-spec.ts` line 2
  - 상세: `randomUUID`는 Node.js 14.17+부터 내장된 `crypto` 모듈 함수이며, `node:` 접두사 형식은 Node.js 16+에서 권장되는 명시적 내장 임포트 패턴이다. `package.json`의 엔진 요건(`"node": ">=24"`)과 완전히 호환된다. 외부 패키지 의존 없음.
  - 제안: 해당 없음.

- **[INFO]** `docker-compose.e2e.yml` — 새 환경변수 추가, 이미지 변경 없음
  - 위치: `docker-compose.e2e.yml` backend-e2e-runner 서비스 환경 변수 섹션
  - 상세: `REDIS_HOST: redis` / `REDIS_PORT: "6379"` 두 환경변수가 추가된다. 신규 컨테이너 이미지나 외부 서비스는 없다. `redis:7-alpine` 이미지는 이미 파일에 정의된 기존 인프라 서비스이며 변경되지 않았다. 추가된 값은 네트워크 내 기본값(`?? 'redis'`)과 동일하나, 의존성을 명시적으로 선언한 보수적 접근이다.
  - 제안: 해당 없음.

- **[INFO]** `ioredis` 버전 고정 방식 — caret 범위
  - 위치: `codebase/backend/package.json` line 66
  - 상세: `"ioredis": "^5.10.1"` — caret 고정으로 minor/patch 업데이트를 허용한다. 이는 기존 프로젝트 정책(pnpm workspace + lockfile)과 일치하므로 lockfile이 실제 버전을 고정한다. 이번 변경에서 버전 정책을 변경한 것은 없다.
  - 제안: 해당 없음. lockfile 관리로 재현성 확보.

- **[INFO]** 내부 의존성 — `ExecutionSeqAllocator` 직접 인스턴스화
  - 위치: `codebase/backend/test/execution-seq-allocator-load.e2e-spec.ts` line 38, 154-155
  - 상세: `../src/modules/websocket/execution-seq-allocator.service`를 직접 임포트하고 NestJS DI 컨테이너 없이 인스턴스화한다. duck-typed 어댑터(`makeProvider`)로 `RedisConnectionProvider` 인터페이스를 충족한다. `as never` 타입 캐스팅은 sibling unit spec과 동일한 확립된 패턴이며 타입 시스템을 우회하지만 런타임 동작에는 영향 없다. DI 프레임워크를 피해 테스트 격리성을 높이는 합리적 선택.
  - 제안: 해당 없음.

## 요약

이번 변경(`execution-seq-allocator-load.e2e-spec.ts` 신규 추가 + `docker-compose.e2e.yml` 환경변수 2개 추가)은 신규 외부 패키지를 전혀 도입하지 않는다. 사용된 세 임포트 — `@jest/globals`(jest 번들), `node:crypto`(Node.js 내장), `ioredis`(기존 프로덕션 의존성) — 모두 이미 프로젝트에 존재하며, 동일 test/ 디렉터리의 다른 e2e 스펙들과 완전히 동일한 패턴을 따른다. docker-compose 변경도 기존 `redis:7-alpine` 서비스에 환경변수를 명시적으로 연결한 것에 그친다. 라이선스, 취약점, 번들 크기, 호환성 관점에서 어떠한 위험도 없다.

## 위험도

NONE
