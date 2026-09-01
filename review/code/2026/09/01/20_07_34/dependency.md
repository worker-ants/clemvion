# Dependency Review

## 발견사항

- **[INFO]** 6개 패키지 `package.json` 의 유일한 실질 변경은 `lint` 스크립트의 glob 따옴표 처리(`eslint src/**/*.ts` → `eslint "src/**/*.ts"`)뿐이며, `dependencies`/`devDependencies` 항목·버전 범위는 이번 diff 에서 전혀 손대지 않았다. 새 외부 패키지 추가 없음, 기존 caret(`^`) 버전 고정 방식도 그대로 유지된다.
  - 위치: `codebase/packages/ai-end-reason/package.json:11`, `codebase/packages/chat-channel-validation/package.json:11`, `codebase/packages/expression-engine/package.json:11`, `codebase/packages/graph-warning-rules/package.json:11`, `codebase/packages/masked-markers/package.json:11`, `codebase/packages/node-summary/package.json:11`
  - 상세: 6개 파일 모두 동일한 한 줄만 바뀌었고, `devDependencies`(`eslint ^10.9.1`, `typescript ^5.7.3`, `typescript-eslint ^8.65.0`, `jest ^30.0.0` 등)와 `expression-engine`의 `dependencies.dayjs ^1.11.20`은 전·후 컨텍스트에서 동일하다. 라이선스·취약점·번들 크기·버전 충돌 관점에서 새로 검토할 대상이 없다.
  - 제안: 없음(순수 스크립트 견고화, 의존성 관점 리스크 없음).

- **[INFO]** 이번 quoting 수정의 배경이 되는 실측이 `plan/in-progress/expression-engine-error-shape-spec-broken-on-main.md`에 문서화돼 있다 — 같은 커밋·같은 `pnpm-lock.yaml`인데 **CI(`pnpm install --filter '<pkg>...'` 서브트리 설치)와 로컬(전체 워크스페이스 설치)의 유효 모듈 해석(hoisting)이 달라져** `ts-jest`/`eslint`가 다른 결과를 낸다는 내용이다. 이는 의존성 리졸루션이 설치 방식에 따라 갈리는 환경 종속성 사례로, 의존성 리뷰 관점에서 주목할 가치가 있다.
  - 위치: `plan/in-progress/expression-engine-error-shape-spec-broken-on-main.md:33-50`(정정 표), `:118-122`(미해결 체크리스트 "로컬-CI 툴체인 차이 규명")
  - 상세: `codebase/packages/expression-engine/src/parser.ts:317`의 `case TokenType.LParen: {` 블록 스코프 추가와 6개 `package.json`의 lint glob quoting은, 이 plan 문서가 지적한 로컬 전용 실패(각각 `no-case-declarations`, glob 미확장 추정) 증상을 개별적으로 우회한 것으로 보인다. 다만 근본 원인(서브트리 설치 vs 전체 워크스페이스 설치 간 hoisting 차이)은 해당 plan 문서에서 **아직 미해결 항목으로 남아 열려 있다**(`:118-122`). 이번 PR 이 그 원인을 은폐하거나 대충 덮은 것은 아니고, 스스로 "묶어서 본다"·"이 PR 에서 고치지 않는다"고 범위를 명시했다.
  - 제안: 새로 요구할 조치 없음 — 이미 별도 plan 항목으로 추적 중. 다만 후속 세션에서 이 문서의 "로컬-CI 툴체인 차이 규명" 항목이 실제로 pnpm workspace hoisting 문제로 확정되면, monorepo 전역의 다른 패키지에도 같은 클래스의 잠재 결함(로컬 GREEN ≠ CI GREEN, 혹은 반대)이 있는지 함께 점검할 필요가 있다.

- **[INFO]** `codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts` 의 타입 술어 변경(`entry is [SubclassName, ErrorsModule[SubclassName]]`)은 TS2677(부분타입 불일치) 컴파일 에러를 타입 유도 방식으로 해소한 것으로, 새 의존성 추가 없이 기존 `typescript ^5.7.3`/`typescript-eslint ^8.65.0` 범위 내에서 처리됐다.
  - 위치: `codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts:64-77`
  - 상세: 순수 타입 레벨 수정이며 패키지 의존 그래프에 영향 없음.
  - 제안: 없음.

- **[INFO]** 내부 패키지 간 의존 관계(`@workflow/ai-end-reason`, `@workflow/chat-channel-validation`, `@workflow/expression-engine`, `@workflow/graph-warning-rules`, `@workflow/masked-markers`, `@workflow/node-summary`)는 이번 diff 에서 서로 import/require 하지 않는 독립 리프 패키지로, 6곳에 동일한 lint 스크립트 패턴이 반복 적용됐을 뿐 신규 내부 의존 엣지는 생기지 않았다.
  - 위치: 위 6개 `package.json` 전체
  - 제안: 없음.

`plan/complete/spec-draft-avatar-storage-key.md`(신규, 이동 완료 문서) 및 `plan/in-progress/spec-draft-avatar-storage-key.md`(삭제, 위 파일로 이동)는 spec 문서·plan 라이프사이클 산출물이며 의존성 관점에서 검토 대상 아님.

## 요약

이번 diff 는 의존성 그래프에 실질 변경이 없다 — 6개 `package.json`의 유일한 수정은 `lint` 스크립트 glob 따옴표 처리(쉘 환경별 확장 차이 대응)이고, `dependencies`/`devDependencies` 버전은 전혀 건드리지 않았다. `expression-engine`의 `parser.ts`/`error-shape.spec.ts` 변경도 새 패키지 도입 없이 기존 TypeScript/ESLint 버전 내에서의 코드·타입 수정이다. 유일하게 주목할 만한 신호는 동반된 plan 문서가 실측한 "CI 서브트리 설치 vs 로컬 전체 워크스페이스 설치 간 pnpm hoisting 차이"이며, 이는 이번 PR 의 결함이 아니라 이미 별도 추적 중인 미해결 조사 항목으로 투명하게 남아 있다. 새 의존성·라이선스·취약점·번들 크기 이슈는 없다.

## 위험도

NONE
