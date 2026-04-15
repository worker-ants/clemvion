## 발견사항

### [WARNING] `NodesModule`에서 불필요한 `forwardRef` 사용
- **위치:** `nodes.module.ts`
- **상세:** `NodesModule`이 `forwardRef(() => ExecutionEngineModule)`로 import하고 있으나, `ExecutionEngineModule`은 `NodesModule`을 직접 import하지 않는다. 실제 순환 의존성이 없는데 `forwardRef`를 사용하면 NestJS가 초기화를 지연 처리해 DI 컨테이너 해석 순서가 예측 불가능해지고, 디버깅이 어려워진다.
- **제안:** `ExecutionEngineModule`이 실제로 `NodesModule`을 import하지 않는다면 `forwardRef` 없이 직접 import로 변경

---

### [WARNING] `bootstrap()` 이전에 `GET /nodes/definitions` 호출 시 빈 배열 반환
- **위치:** `node-component.registry.ts:bootstrap()` / `nodes.controller.ts:listDefinitions()`
- **상세:** `bootstrap()`은 `ExecutionEngineService.onModuleInit()`에서 호출되고, `listDefinitions()`는 컨트롤러 엔드포인트로 언제든 호출된다. `onModuleInit`이 완료되기 전 요청이 들어오면 `components` Map이 비어 있어 빈 배열이 반환된다. 클라이언트가 이를 "노드 없음" 상태로 오해할 수 있다.
- **제안:** `bootstrap()` 완료 여부를 추적하는 플래그를 두고, 미완료 상태에서 `listDefinitions()` 호출 시 503 또는 초기화 진행 중 응답 반환

---

### [WARNING] `bootstrap()` 중복 호출 시 예외로 서비스 시작 실패
- **위치:** `node-component.registry.ts:bootstrap()`
- **상세:** `this.components.has(type)`으로 중복 등록을 감지해 `throw new Error`를 발생시킨다. 테스트 환경에서 `ExecutionEngineService.onModuleInit()`을 명시적으로 두 번 호출하거나, NestJS가 특정 조건에서 `onModuleInit`을 재호출하면 서비스 부팅 실패로 이어진다.
- **제안:** `throw` 대신 `logger.warn()`으로 경고하고 재등록 건너뛰기, 또는 테스트에서 `onModuleInit` 중복 호출 방지

---

### [INFO] `zod` production dependency 추가로 `@anthropic-ai/sdk`의 optional peer dependency 자동 해결
- **위치:** `package.json`, `package-lock.json`
- **상세:** `@anthropic-ai/sdk`는 `zod: ^3.25.0 || ^4.0.0`을 optional peer로 선언한다. `zod ^4.3.6`이 production dep에 추가되면서 이 peer dep이 해결되어 SDK의 Zod 기반 타입 생성 기능이 활성화될 수 있다. 의도된 변경이라면 문제없으나, 의도치 않은 경우 SDK 동작이 달라질 수 있다.
- **제안:** 의도된 변경임을 주석 또는 커밋 메시지로 명시

---

### [INFO] `package-lock.json`에서 다수 패키지의 `"peer": true` 플래그 제거
- **위치:** `package-lock.json` (bullmq, class-transformer, class-validator, typeorm, pg, ws 등 다수)
- **상세:** npm lock file 재생성 시 peer 관계 해석이 변경되어 이전에 `peer: true`로 표시되던 패키지들이 직접 의존성으로 전환되었다. 실제 설치 버전은 동일하지만, `npm ci`로 설치 시 동작 차이는 없다. 다만 이러한 대규모 lock file 변경은 PR diff를 읽기 어렵게 만든다.
- **제안:** `npm install` 대신 `npm ci` 사용 일관성 유지, 불필요한 lock file 재생성 최소화

---

### [INFO] 신규 엔드포인트 `GET /nodes/definitions`에 인증 가드 적용 여부 확인 필요
- **위치:** `nodes.controller.ts:listDefinitions()`
- **상세:** 클래스 레벨에 `@ApiBearerAuth('access-token')`이 있지만, 실제 `@UseGuards()`가 전역 설정이나 클래스 레벨에 적용되어 있는지 확인이 필요하다. 노드 정의 목록은 시스템 내부 구조를 노출하므로 인증 없이 공개되면 정보 노출 위험이 있다.
- **제안:** 기존 엔드포인트와 동일한 인증 가드가 적용되는지 확인

---

## 요약

이번 변경은 핸들러 등록 로직을 `ExecutionEngineService`에서 `NodeComponentRegistry`로 추출하고, Zod 기반 메타데이터 API를 추가하는 구조적 리팩토링이다. 전반적으로 의도치 않은 상태 변경, 전역 변수 도입, 외부 네트워크 호출 같은 심각한 부작용은 없다. 주요 리스크는 불필요한 `forwardRef` 사용으로 인한 DI 초기화 순서 불안정성, 모듈 초기화 완료 전 API 호출 시 빈 응답 반환 가능성, 그리고 `bootstrap()` 중복 호출 시 서비스 크래시다. `package-lock.json`의 대규모 `peer` 플래그 변경은 기능에 영향을 주지 않지만 코드 리뷰 가독성을 저해한다.

## 위험도

**LOW**