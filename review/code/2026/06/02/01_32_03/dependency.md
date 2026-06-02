# 의존성(Dependency) 리뷰

## 발견사항

### [INFO] 새 의존성 없음 — backend (ioredis 기존 의존성 재사용)
- 위치: `codebase/backend/src/modules/hooks/public-webhook-quota.service.ts`
- 상세: `PublicWebhookQuotaService` 가 `import Redis from 'ioredis'` 로 Redis 클라이언트를 직접 인스턴스화하지만, `ioredis ^5.10.1` 은 `codebase/backend/package.json` 의 `dependencies` 에 이미 존재한다. 신규 외부 패키지 추가 없음. `@nestjs/common`, `@nestjs/config`, `typeorm` 등 Guard/Service 에서 사용하는 모든 NestJS 의존성도 기존 선언 범위 안이다.
- 제안: 없음.

### [INFO] 새 의존성 없음 — frontend/channel-web-chat
- 상세: 이번 변경에서 `codebase/frontend/package.json` 혹은 `codebase/channel-web-chat/package.json` 의 의존성 변경은 포함되지 않았다.
- 제안: 없음.

### [WARNING] web-chat-sdk — ESLint 관련 devDependency 4개 신규 추가, 버전 범위(^) 핀닝 여부 확인 필요
- 위치: `codebase/packages/web-chat-sdk/package.json` devDependencies
- 상세: `@eslint/js ^9.18.0`, `eslint ^9.18.0`, `globals ^16.0.0`, `typescript-eslint ^8.20.0` 4개가 신규 추가됐다. `^` 범위 지정은 minor/patch 자동 갱신을 허용한다. 이 패키지들은 devDependencies 이므로 런타임 번들이나 npm 소비자에게 영향 없다. 단, `package-lock.json` 이 함께 커밋돼 있어 실질적인 버전은 lock 파일에 고정된다 — lock 파일 유지 시 재현성 확보됨.
- 추가 관찰: 동일 버전(eslint 9.18.0, typescript-eslint 8.20.0, globals 16.x, @eslint/js 9.18.0)이 `codebase/backend/package.json` 에도 이미 선언돼 있어 monorepo 내 버전 정합성이 유지된다. 중복 설치가 발생할 수 있으나 각 패키지가 독립 npm 워크스페이스를 쓰므로 빌드 충돌은 없다.
- 제안: 현재 lock 파일이 커밋돼 있으므로 재현성은 확보된 상태. 향후 monorepo 루트 `package.json` 에서 공유 devDependency 를 끌어올려 중복을 줄이는 것을 검토할 수 있으나 필수 조치 아님.

### [INFO] 라이선스 — 신규 추가 패키지 모두 허용 라이선스
- 위치: `codebase/packages/web-chat-sdk/package.json` 신규 4개
- 상세: `@eslint/js`(MIT), `eslint`(MIT), `globals`(MIT), `typescript-eslint`(MIT). 모두 MIT 라이선스로 상업적 사용·재배포 허용. 프로젝트와 충돌 없음.
- 제안: 없음.

### [INFO] 취약점 — 신규 추가 패키지 기준 알려진 취약점 없음 (지식 기준일 2025-08)
- 상세: `eslint 9.18.0`, `typescript-eslint 8.20.0`, `globals 16.x`, `@eslint/js 9.18.0` 은 2025년 8월 기준 알려진 CVE 없음. devDependency 이므로 런타임 공격 표면 없음. `ioredis 5.x` 는 이미 사용 중이며 신규 추가 아님.
- 제안: 없음.

### [INFO] 불필요한 의존성 여부 — 신규 ESLint 추가는 정당
- 상세: 이전에 `lint` 스크립트가 `tsc --noEmit` 만 수행했으나, 이번 변경으로 flat config 기반 ESLint 를 채택했다. `plan/in-progress/channel-web-chat-followups.md §7` 에 "eslint devDep 채택 완료 C-1" 로 명시된 의도적 추가다. 표준 라이브러리나 기존 의존성으로 대체 불가한 린팅 기능이므로 불필요하지 않다.
- 제안: 없음.

### [INFO] 의존성 크기 — devDependency 전용, 번들 크기 영향 없음
- 상세: 신규 4개 모두 `devDependencies` 에 한정. `esbuild` 로 번들되는 `dist/loader.js`, `dist/index.js` 에는 포함되지 않는다. 빌드 시간은 lint 단계(dev 시만)에서 증가하지만 CI 공식 편입은 아직 별도 작업으로 분리된 상태(plan §7).
- 제안: 없음.

### [INFO] 내부 의존성 — hooks 모듈 내 결합도 정상 범위, @InjectRepository(Trigger) DI 전제 확인 필요
- 위치: `codebase/backend/src/modules/hooks/`
- 상세: `PublicWebhookThrottleGuard` 가 `@InjectRepository(Trigger)` 로 triggers 모듈의 엔티티에, `PublicWebhookQuotaService` 에 직접 의존한다. `hooks.module.ts` diff 상 `providers` 만 추가됐고 `imports` 배열은 변경이 없다. 만약 `HooksModule` 이 기존에 `TriggersModule` 또는 `TypeOrmModule.forFeature([Trigger])` 를 import 하지 않는다면 런타임에서 `Nest can't resolve dependencies of the PublicWebhookThrottleGuard` 오류가 발생한다.
- 제안: `hooks.module.ts` 의 `imports` 배열에 `TriggersModule` 혹은 `TypeOrmModule.forFeature([Trigger])` 가 포함돼 있는지 확인할 것. diff 에 `imports` 변경이 없으므로 기존 선언이 존재할 가능성이 높으나 명시적 확인 권장.

### [INFO] Redis 인스턴스 연결 증가 — 서비스별 독립 인스턴스 패턴, codebase 관행과 일치
- 위치: `codebase/backend/src/modules/hooks/public-webhook-quota.service.ts` 66행
- 상세: `PublicWebhookQuotaService` 가 자체 `new Redis(...)` 인스턴스를 생성한다. 이미 `channel-conversation.service.ts`, `continuation-bus.service.ts`, `health.service.ts`, `interaction-token.service.ts`, `idempotency.interceptor.ts`, `cafe24-install-nonce-cache.service.ts` 등 6개 이상의 서비스가 동일 패턴을 사용하므로 프로젝트 관행과 일치한다. `lazyConnect: true`, `maxRetriesPerRequest: 2` 옵션으로 연결 지연·재시도 영향을 최소화했다.
- 제안: 현 패턴은 codebase 관행 내 허용 범위. 장기적으로 Redis 연결 풀 공유 여부는 별도 아키텍처 개선 작업으로 추적 가능.

## 요약

이번 변경에서 backend 는 신규 외부 의존성을 추가하지 않았고, 기존 `ioredis ^5.10.1` 을 재사용하여 `PublicWebhookQuotaService` 와 `PublicWebhookThrottleGuard` 를 구현했다. `web-chat-sdk` 패키지에는 `@eslint/js`, `eslint`, `globals`, `typescript-eslint` 4개의 devDependency 가 신규 추가됐으나 모두 MIT 라이선스이고 backend 에서 동일 버전을 이미 사용 중이어서 monorepo 버전 정합성이 유지된다. `package-lock.json` 이 커밋돼 버전 재현성도 확보된 상태다. 런타임 번들 크기에는 영향 없음. 유일한 주의 사항은 `PublicWebhookThrottleGuard` 의 `@InjectRepository(Trigger)` DI 가 `HooksModule.imports` 에 이미 `Trigger` 엔티티 공급이 선언돼 있는지 런타임 전 확인이 필요하다는 점이다.

## 위험도

LOW
