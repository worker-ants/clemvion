# 의존성(Dependency) 리뷰

## 발견사항

### 새 의존성 (safe-regex ^2.1.1 + @types/safe-regex ^1.1.6)

- **[INFO]** `safe-regex@2.1.1` 및 타입 패키지 `@types/safe-regex@1.1.6` 신규 추가
  - 위치: `codebase/backend/package.json` dependencies/devDependencies, `package-lock.json`
  - 상세: ReDoS(Catastrophic Backtracking) 방어를 위해 사용자 입력 regex 를 컴파일 전 휴리스틱으로 검사하는 라이브러리. 사용처는 `src/nodes/core/condition-evaluator.util.ts` 단일 chokepoint (`compileUserRegex`) 로 집중되어 있음. 보안 목적의 추가이므로 필요성은 정당하다.
  - 제안: 현상 유지 적절.

### 버전 고정

- **[INFO]** `safe-regex` 는 `^2.1.1` (캐럿 범위)로 지정되어 있음
  - 위치: `package.json` line `"safe-regex": "^2.1.1"`
  - 상세: 프로젝트의 다른 의존성(`jsonwebtoken: "9.0.3"` 제외)도 대부분 캐럿 범위를 사용하는 패턴과 일관됨. `package-lock.json` 에 `2.1.1` 이 고정되어 있으므로 재현성 문제는 없다.
  - 제안: 프로젝트 컨벤션 준수. 이슈 없음.

### 라이선스

- **[INFO]** `safe-regex@2.1.1` — MIT 라이선스
  - 위치: `package-lock.json` `"license": "MIT"` (safe-regex, regexp-tree 모두)
  - 상세: 프로젝트 라이선스 `UNLICENSED` 와 충돌 없음. MIT 는 상업적 비공개 사용에 제약 없다.
  - 제안: 이슈 없음.

### 취약점

- **[INFO]** `safe-regex` 및 전이 의존성 `regexp-tree@0.1.27` 에 대해 npm audit 결과 알려진 취약점 없음
  - 위치: `package-lock.json` `node_modules/safe-regex`, `node_modules/regexp-tree`
  - 상세: 두 패키지 모두 보안 어드바이저리 미등록 상태. `regexp-tree` 는 safe-regex 가 내부적으로 사용하는 파서로, MIT 라이선스, 현재 최신 버전.
  - 제안: 이슈 없음.

### 불필요한 의존성

- **[INFO]** Node.js 표준 라이브러리 또는 기존 의존성으로 대체 가능성 검토
  - 위치: `src/nodes/core/condition-evaluator.util.ts`
  - 상세: Node.js 18+의 `vm.runInNewContext` 타임아웃 방식이나 `zod` 정규식 밸리데이터로는 지수 백트래킹 탐지가 불가. 현재 사용 중인 `zod@^4.3.6`, `class-validator@^0.15.1` 에는 ReDoS 정적 분석 기능이 없음. `safe-regex` 는 정적 AST 분석(regexp-tree 기반)으로 컴파일 전 탐지하므로 대체재가 없다.
  - 제안: 이슈 없음.

### 의존성 크기

- **[INFO]** `safe-regex` 48KB + 전이 의존성 `regexp-tree` 428KB — 합계 약 476KB
  - 위치: `node_modules/safe-regex/`, `node_modules/regexp-tree/`
  - 상세: 백엔드(Node.js 서버) 전용 패키지이므로 프론트엔드 번들 영향 없음. 서버 빌드(NestJS/dist)에는 포함되나 프로세스 시작 시 한 번만 로드. 476KB 는 이미 수백 MB 규모인 백엔드 `node_modules` 대비 무시할 수준.
  - 제안: 이슈 없음.

### 호환성

- **[INFO]** `safe-regex` 는 CommonJS 모듈(`require` 기반)
  - 위치: `codebase/backend/node_modules/safe-regex/index.js` 첫 줄 `const analyzer = require('./lib/analyzer')`
  - 상세: 프로젝트 TypeScript 설정이 ESM 또는 CommonJS 어느 쪽이든, NestJS(CommonJS transpile) 환경에서 `import safeRegex from 'safe-regex'` 형식의 default import 는 `esModuleInterop: true` 가 있으면 정상 동작. `package-lock.json` lock 파일에 정상 resolved 확인됨.
  - 제안: 이슈 없음. 단, `tsconfig.json` 에 `esModuleInterop: true` 가 활성화되어 있는지 확인 권장 (NestJS 기본 템플릿에서는 기본 활성).

### 내부 의존성

- **[INFO]** `WebsocketModule` 이 `WorkflowsModule` 을 `forwardRef` 로 추가 임포트
  - 위치: `src/modules/websocket/websocket.module.ts`
  - 상세: 04 M-6 IDOR 방어를 위해 `WebsocketGateway` 가 `WorkflowsService.findById` 를 호출. KB 패턴과 동형으로 `forwardRef` 를 올바르게 사용. `WorkflowsModule` 이 이미 `WebsocketModule` 을 역방향으로 임포트하는 경우에도 `forwardRef` 가 순환을 해소한다.
  - 제안: 기존 KB-WS 패턴과 동일하므로 이슈 없음.

- **[INFO]** `condition-eval.util.ts`(logic/_shared) 가 `compileUserRegex` 를 core 에서 re-export
  - 위치: `src/nodes/logic/_shared/condition-eval.util.ts`
  - 상세: `coreCompileUserRegex` 를 alias 없이 re-export 해 `filter.handler.ts`, `transform.handler.ts` 두 소비자에게 단일 chokepoint 를 제공. 의존 방향(logic -> core)은 기존 패턴과 일관됨.
  - 제안: 이슈 없음.

### 부가 변경 (package-lock.json)

- **[INFO]** `@nestjs-modules/mailer` 하위에 `chokidar@3.6.0`, `glob-parent@5.1.2`, `readdirp@3.6.0` 항목이 lock 파일에 신규 추가됨 (optional + peer)
  - 위치: `package-lock.json` lines 3750-3825
  - 상세: 이 항목들은 `safe-regex` 와 무관하게 `@nestjs-modules/mailer` 의 선택적 피어 의존성으로 lock 파일 재생성 시 함께 기록된 것으로 보임. 모두 MIT 라이선스, optional/peer 플래그이므로 프로덕션 바이너리에 포함되지 않는다.
  - 제안: 이슈 없음.

- **[INFO]** `uglify-js@3.19.3` 에 `"dev": true` 플래그가 새로 추가됨
  - 위치: `package-lock.json` line 18917
  - 상세: lock 파일 재생성 중 npm 이 정확한 dev-only 표시를 기록한 것. 동작 변경 없음.
  - 제안: 이슈 없음.

---

## 요약

이번 변경에서 유일한 신규 외부 의존성은 `safe-regex@2.1.1` (runtime) 과 `@types/safe-regex@1.1.6` (devDependency) 이다. 해당 패키지는 ReDoS 방어를 위한 정적 분석 라이브러리로, 기존 표준 라이브러리나 이미 사용 중인 의존성으로는 대체할 수 없는 기능(지수 백트래킹 패턴 컴파일 전 탐지)을 제공한다. MIT 라이선스로 프로젝트와 호환되고, 현재 알려진 취약점이 없으며, 전이 의존성(`regexp-tree@0.1.27`)을 포함해도 약 476KB 수준으로 백엔드 번들에 미치는 영향이 미미하다. 버전은 프로젝트 컨벤션에 맞게 캐럿 범위 + lock 고정으로 관리되고 있다. 내부 모듈 의존 관계 변경(`WebsocketModule` -> `WorkflowsModule`)은 기존 `forwardRef` 패턴을 따르며 이슈가 없다. 전반적으로 의존성 관점에서 우려할 사항이 없다.

## 위험도

NONE
