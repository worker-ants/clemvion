# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부 패키지 추가 없음 — 기존 의존성만 활용
  - 위치: `backend/package.json`
  - 상세: 이번 커밋(`ed11854`)에서 변경된 파일은 소스 코드 5개와 plan 문서 2개뿐이며, `package.json` / `package-lock.json` 변경이 전혀 없다. 새 외부 라이브러리를 도입하지 않아 라이선스·취약점·번들 크기 문제가 발생하지 않는다.
  - 제안: 해당 없음.

- **[INFO]** NestJS `OnModuleInit` 인터페이스 추가 — 기존 NestJS 패키지 범위 내
  - 위치: `backend/src/nodes/integration/cafe24/cafe24.module.ts` line 4, 846
  - 상세: `OnModuleInit`은 `@nestjs/common` 에 이미 포함된 인터페이스로, 별도 패키지 설치 없이 기존 의존성(`@nestjs/common ^11.0.1`) 범위 내에서 사용한다.
  - 제안: 해당 없음.

- **[WARNING]** `IntegrationsModule`을 `Cafe24Module`이 직접 import — 양방향 의존 잠재 위험
  - 위치: `backend/src/nodes/integration/cafe24/cafe24.module.ts` line 20–21, 837
  - 상세: `Cafe24Module`이 `IntegrationsModule`을 `imports` 배열에 추가하고 `IntegrationsService`를 DI 받는다. `IntegrationsModule`은 `execution-engine.module.ts`를 통해 `Cafe24Module`을 이미 간접 참조(`execution-engine.module.ts` → `Cafe24Module`, `IntegrationsModule`이 같은 앱 모듈에 등록)하므로, NestJS의 모듈 그래프에서 순환 의존성이 실제로 형성되지 않는지 런타임 부트스트랩 단계에서 검증해야 한다. 또한 `IntegrationsModule`이 나중에 `Cafe24Module`에 직접 의존하는 코드가 추가될 경우 `A → B → A` 순환이 완성된다.
  - 제안: NestJS `forwardRef()` 없이 현재 단방향(`Cafe24Module → IntegrationsModule`)이 유지되는지 CI 기동 테스트(`nest build` 성공 여부)로 명시적으로 검증할 것. 장기적으로 `registerEntityTester`를 호출하는 책임을 상위 `AppModule` 레벨 또는 전용 초기화 서비스로 분리해 `nodes → modules` 단방향 의존을 유지하는 방안을 검토한다.

- **[INFO]** `Cafe24ApiClient` 내 `AbortController` + `setTimeout` — 표준 Node.js API 활용
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` `rawPing` 메서드 (line 742–756 범위)
  - 상세: 30초 타임아웃 구현에 `AbortController`와 `setTimeout`을 사용한다. 추가 패키지 없이 Node.js 내장 API를 활용하는 올바른 접근이다.
  - 제안: 해당 없음.

- **[INFO]** 내부 모듈 의존 방향은 선언 의도와 일치
  - 위치: `cafe24.module.ts`, `integrations.module.ts`, `integrations.service.ts`
  - 상세: `IntegrationsService`는 `nodes/*`를 직접 import하지 않으며(`nodes/` 경로 임포트 없음), `EntityAwareTester` 타입을 자체 정의해 `nodes` 패키지를 모르는 상태를 유지한다. `Cafe24Module`만이 `IntegrationsModule`을 알고 있어 `nodes → modules` 단방향이 코드 레벨에서는 준수된다.
  - 제안: 해당 없음.

- **[INFO]** 버전 고정 상태 — `^` 범위 지정이 전체 프로젝트 관행으로 일관됨
  - 위치: `backend/package.json`
  - 상세: 이번 변경으로 새 패키지가 추가되지 않아 버전 고정 변경도 없다. 기존 `^` 범위 지정이 유지된다. `overrides` 블록에 `lodash`, `picomatch`, `liquidjs`, `ip-address`, `express-rate-limit` 이 명시돼 있어 known-vulnerable transitive 의존성의 최소 버전이 고정된다.
  - 제안: 해당 없음.

## 요약

이번 커밋은 새 외부 패키지를 전혀 추가하지 않아 라이선스·취약점·번들 크기 측면에서 의존성 위험이 없다. 모든 기능은 `@nestjs/common`(`OnModuleInit`), Node.js 내장 API(`AbortController`, `setTimeout`), 그리고 기존 TypeORM/BullMQ 인프라만으로 구현됐다. 주목할 점은 `Cafe24Module`이 `IntegrationsModule`을 imports 배열에 신규 추가한 것으로, 현재는 단방향(`nodes → modules`)이지만 향후 역방향 의존이 생기면 순환이 될 수 있다. NestJS 부트스트랩 성공 여부로 검증이 가능하며 현재 코드에서는 순환이 존재하지 않는다. 나머지 내부 의존 관계(`IntegrationsService`가 `nodes/*`를 직접 참조하지 않는 구조)는 설계 의도에 맞게 잘 지켜졌다.

## 위험도

LOW
