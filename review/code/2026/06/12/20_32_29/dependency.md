# 의존성(Dependency) 리뷰

## 발견사항

### 새 의존성

- **[INFO]** `safe-regex@2.1.1` (runtime) + `@types/safe-regex@1.1.6` (devDependency) 신규 추가
  - 위치: `codebase/backend/package.json` L80, L106; `codebase/backend/package-lock.json`
  - 상세: ReDoS(지수 백트래킹) 방어를 위해 사용자 입력 regex 패턴을 컴파일 전 정적 AST 분석으로 검사하는 라이브러리. 전이 의존성은 `regexp-tree@0.1.27` 하나뿐. 사용처는 `src/nodes/core/condition-evaluator.util.ts`의 `compileUserRegex` 단일 초크포인트에 집중되어 있어 의존성 범위가 잘 제어된다. 보안 목적(04 M-3) 추가로 필요성이 정당하고, 기존 의존성(`zod`, `class-validator`)으로는 지수 백트래킹 정적 탐지가 불가하므로 대체재가 없다.
  - 제안: 현상 유지 적절. 이슈 없음.

### 버전 고정

- **[INFO]** `safe-regex: "^2.1.1"` — 캐럿 범위(semver minor/patch 자동 업그레이드 허용)
  - 위치: `codebase/backend/package.json` L80
  - 상세: 프로젝트 내 다른 의존성 대부분이 캐럿 범위를 사용하는 패턴과 일관된다(`jsonwebtoken: "9.0.3"` 처럼 고정된 케이스는 소수). `package-lock.json`에 `2.1.1`이 고정되어 있어 `npm ci` 환경에서 재현성 보장. `safe-regex`가 보안 라이브러리이므로 patch 업데이트는 자동 허용하는 것이 일반적으로 권장된다.
  - 제안: 현재 컨벤션(캐럿 + lock 고정) 적절. 이슈 없음.

### 라이선스

- **[INFO]** `safe-regex@2.1.1` MIT / `regexp-tree@0.1.27` MIT
  - 위치: `package-lock.json` `"license": "MIT"` (safe-regex, regexp-tree 모두 확인)
  - 상세: 프로젝트는 `UNLICENSED`(비공개 독점)로 선언되어 있다. MIT 라이선스는 상업적 비공개 사용·재배포에 제약이 없으며(저작권 고지 보존만 요구) 프로젝트 라이선스와 충돌하지 않는다. `@types/safe-regex@1.1.6`도 MIT.
  - 제안: 이슈 없음.

### 취약점

- **[INFO]** `safe-regex@2.1.1` 및 전이 의존성 `regexp-tree@0.1.27`에 대해 현재 알려진 취약점 없음
  - 위치: `package-lock.json` `node_modules/safe-regex`, `node_modules/regexp-tree`
  - 상세: 두 패키지 모두 npm advisory DB 미등록. `safe-regex`는 2.1.1이 2019년 이후 안정 유지, `regexp-tree`는 0.1.27(2023년 릴리즈). 자체 취약점 이력 없음. 단, `safe-regex`의 휴리스틱(star height 기반)은 alternation-overlap(`(a|a)*` 계열)을 탐지하지 못하는 알려진 한계가 있으나, 이는 라이브러리 취약점이 아닌 탐지 범위 한계로 코드 주석에 명시되어 있다.
  - 제안: 이슈 없음.

### 불필요한 의존성

- **[INFO]** `safe-regex` — 표준 라이브러리 또는 기존 의존성으로 대체 불가
  - 위치: `codebase/backend/src/nodes/core/condition-evaluator.util.ts`
  - 상세: Node.js `vm.runInNewContext` 타임아웃 방식은 런타임 실행 중 탐지(ReDoS 발생 후 중단)라 서버 리소스 소비 후 차단이다. `zod`, `class-validator`는 입력 스키마 검증 라이브러리로 ReDoS 정적 분석 기능이 없다. `safe-regex`는 컴파일 전 정적 AST 분석으로 지수 백트래킹 패턴을 사전에 거부하는 유일한 경로다.
  - 제안: 이슈 없음.

### 의존성 크기

- **[INFO]** `safe-regex`(~20KB) + `regexp-tree`(~428KB) — 합계 약 450KB
  - 위치: `codebase/backend/node_modules/`
  - 상세: 백엔드 전용(Node.js 서버) 패키지이므로 프론트엔드/channel-web-chat 번들에 영향 없음. 수백 MB 규모의 백엔드 `node_modules` 대비 무시할 수준. `regexp-tree`는 `safe-regex`가 내부적으로 정규식 AST 파싱에 사용하는 파서로 런타임에 한 번 로드된다.
  - 제안: 이슈 없음.

### 호환성

- **[INFO]** `safe-regex` CommonJS 모듈 — `import safeRegex from 'safe-regex'` default import 형태
  - 위치: `codebase/backend/src/nodes/core/condition-evaluator.util.ts` L1
  - 상세: `safe-regex`는 CommonJS(`module.exports`) 형태. `import safeRegex from 'safe-regex'`는 TypeScript의 `esModuleInterop: true` 설정이 활성화된 환경에서 정상 동작한다. NestJS 기본 템플릿에서는 `esModuleInterop: true`가 기본 활성화되어 있다. `package-lock.json`에 정상 resolved 확인.
  - 제안: 기존 tsconfig에 `esModuleInterop: true`가 포함되어 있을 것이나, 불안하다면 `tsconfig.json`에서 확인 권장. 실질적 이슈는 없음.

### 내부 의존성

- **[INFO]** `WebsocketModule` -> `WorkflowsModule` forwardRef 추가 (4번째 forwardRef)
  - 위치: `codebase/backend/src/modules/websocket/websocket.module.ts`
  - 상세: 04 M-6 IDOR 방어를 위해 `WebsocketGateway`가 `WorkflowsService.findById`를 호출. `KnowledgeBaseModule` forwardRef 패턴과 동형으로 올바르게 적용. `WebsocketModule`의 forwardRef 개수가 4개(`ExecutionEngineModule`, `ExecutionsModule`, `KnowledgeBaseModule`, `WorkflowsModule`)로 누적됨 — 순환 해소 자체는 정상이나 이 수준에서 초기화 순서 버그 위험이 높아짐. architecture.md 리뷰에서 WARNING으로 이미 지적됨.
  - 제안: 중기적으로 `ChannelAuthorizationService` 분리를 통한 의존성 단순화 권장(별도 plan). 현 시점에서는 이슈 없음.

- **[INFO]** `condition-eval.util.ts`(logic/_shared) -> `condition-evaluator.util.ts`(core) re-export 확장
  - 위치: `codebase/backend/src/nodes/logic/_shared/condition-eval.util.ts`
  - 상세: `compileUserRegex`가 core에서 logic/_shared로 re-export되어 `filter.handler.ts`, `transform.handler.ts` 두 소비자가 core를 직접 참조하지 않고 중간 레이어를 경유. 의존 방향(logic -> core)은 기존 패턴과 일관되며 레이어 경계를 유지한다.
  - 제안: 이슈 없음.

### lock 파일 부가 변경

- **[INFO]** `@nestjs-modules/mailer` 하위 `chokidar@3.6.0`, `glob-parent@5.1.2`, `readdirp@3.6.0` lock 파일 신규 기록 (optional + peer)
  - 위치: `codebase/backend/package-lock.json` lines 3750-3825
  - 상세: `safe-regex` 추가 후 `npm install`(또는 `npm ci`) 재실행 시 `@nestjs-modules/mailer`의 선택적 피어 의존성이 lock 파일에 함께 기록된 것. 세 패키지 모두 `"optional": true, "peer": true` 플래그로 실제 프로덕션 바이너리에 포함되지 않는다. MIT 라이선스.
  - 제안: 정상 동작. 이슈 없음.

- **[INFO]** `uglify-js@3.19.3`에 `"dev": true` 플래그 신규 추가
  - 위치: `codebase/backend/package-lock.json` line 18917
  - 상세: lock 파일 재생성 시 npm이 정확한 dev-only 분류를 기록한 것. 동작 변경 없음.
  - 제안: 이슈 없음.

---

## 요약

이번 변경에서 신규 추가된 외부 의존성은 `safe-regex@2.1.1`(runtime)과 `@types/safe-regex@1.1.6`(devDependency) 두 패키지뿐이다. 두 패키지 모두 MIT 라이선스로 프로젝트와 호환되며, 현재 알려진 보안 취약점이 없다. `safe-regex`는 기존 표준 라이브러리나 이미 사용 중인 의존성으로 대체할 수 없는 ReDoS 정적 분석 기능(컴파일 전 지수 백트래킹 패턴 탐지)을 제공하므로 추가 필요성이 정당하다. 버전은 프로젝트 컨벤션(캐럿 범위 + lock 파일 고정)을 따르고, 전이 의존성(`regexp-tree@0.1.27`)을 포함해도 약 450KB 수준으로 백엔드 번들 영향이 미미하다. 사용처가 `compileUserRegex` 단일 초크포인트로 집중되어 있어 의존성 범위가 잘 제어된다. 내부 모듈 의존성 변경(`WebsocketModule` -> `WorkflowsModule` forwardRef 추가)은 기존 KB-WS 패턴과 동형이며 기능적 이슈가 없다(forwardRef 4개 누적에 따른 중기 리팩터링 권장은 아키텍처 리뷰 범위). lock 파일의 부가 변경(`chokidar` 계열 optional peer 기록, `uglify-js` dev 플래그)은 npm 재생성 부산물로 실질적 영향이 없다. 의존성 관점에서 차단할 사항이 없다.

## 위험도

NONE
