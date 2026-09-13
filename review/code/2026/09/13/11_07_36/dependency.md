# 의존성(Dependency) 리뷰

## 조사 방법

`git diff origin/main...HEAD --stat` 전수 확인 결과 `package.json`·`pnpm-lock.yaml`·
`node_modules` 관련 변경은 **0건**이다. 이 PR 은 DTO 필드명 정정(`error`→`message`,
`latencyMs`/`meta` 유령 필드 제거, `code` 필드 신설), 유저 가이드 에러 코드 정합화, 신규
회귀 가드 테스트 3종 추가로 구성되며 외부 패키지 표면을 전혀 건드리지 않는다.

## 발견사항

- **[INFO]** 신규 테스트가 사용하는 `supertest` + `@nestjs/testing` HTTP 레벨 계약 검증
  패턴은 새 의존성이 아니라 기존 관례의 재사용이다.
  - 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts` (describe
    `'POST /model-configs/:id/test — 와이어 계약 (HTTP)'`)
  - 상세: `supertest` 는 이미 `codebase/backend/package.json` devDependencies 에
    `^7.0.0` 으로 고정돼 있고(신규 추가 아님), 같은 패턴이 `triggers.controller.spec.ts`·
    `health.controller.spec.ts` 에도 선례가 있다. 버전 고정·라이선스·취약점 이슈 없음.
  - 제안: 없음 (문제 아님, 확인 사실만 기록).

- **[INFO]** `guide-sanitized-message-parity.test.ts` 가 frontend 테스트에서 backend 소스
  (`codebase/backend/src/modules/llm/utils/sanitize-error.util.ts`)를 **import 가 아니라
  `fs.readFileSync` 텍스트 스캔**으로 읽는다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts`
    (`sotText = fs.readFileSync(...)`)
  - 상세: 코드 내 주석이 그 이유를 명시한다 — "frontend 테스트가 backend 소스를 import하면
    패키지 경계를 넘는 빌드 의존이 생긴다"는 것을 피하기 위한 의도적 설계이며, 같은 폴더의
    가드 가족(`guide-error-code-existence.test.ts` 등)이 동일 관례를 따른다. 정규식 기반
    텍스트 파싱이 정본 import 대비 깨지기 쉽지만, vacuity floor 단언(8건 정확히 추출됐는지)
    으로 실패 방향을 안전하게 막아 둔 것도 코드에서 확인했다. 이것은 **패키지 매니저가
    추적하지 않는 파일-경로 결합(soft coupling)**이라 `sanitize-error.util.ts` 파일이 이동·
    개명되면 빌드는 안 깨지고 테스트만 조용히 무의미해질 수 있다(단, vacuity floor 가
    그 경우도 RED 로 잡도록 설계돼 있어 실질 위험은 낮다).
  - 제안: 없음 (설계 의도와 안전장치를 확인, 추가 조치 불필요).

- **[INFO]** 내부 모듈 의존 그래프 변경: `llm-model-config.controller.spec.ts` 가 기존에
  `LlmService`/`LlmPreviewService` 를 타입 전용(mock)으로만 참조하던 것을 실제 클래스
  임포트로 바꾸고, `ModelConfigService`·`LLMClientFactory`·`LlmUsageLogService`·
  `TransformInterceptor` 를 신규로 끌어들인다.
  - 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts` (파일 상단
    import 블록)
  - 상세: 전부 backend 내부 모듈이며 외부 패키지 아님. 실제 `LlmService` 를 DI 컨테이너에
    넣고 그 하위 의존만 mock 하는 통합-스타일 단위 테스트로, 코드 내 주석이 "mock 서비스면
    필드 이름 축에서 vacuous"라는 근거를 명시해 설계 의도가 뚜렷하다. 순환 의존·레이어
    위반 없음(`llm` 모듈이 `model-config` 모듈의 서비스를 provider 로 주입받는 기존 구조를
    그대로 사용).
  - 제안: 없음.

새로 추가된 순수 유틸 `guide-error-code-scan.ts` 는 외부 패키지 없이 정규식/문자열
연산만 사용하며, `walkTree`·`collectMdxFiles`·`repoRoot` 등 기존 테스트 헬퍼를 재사용한다
(신규 생성 아님, `git show origin/main:...` 로 기존 존재 확인).

## 요약

이번 변경은 DTO 필드 정합화·문서 정정·회귀 가드 테스트 추가로 구성된 순수 내부 리팩터링이며,
`package.json`/lockfile 변경이 전무해 새 외부 의존성·버전 고정·라이선스·취약점·번들 크기
이슈가 발생하지 않는다. 신규 테스트가 쓰는 `supertest` 패턴은 기존 devDependency 와 기존
선례를 재사용한 것이고, frontend→backend 텍스트 스캔 방식의 soft coupling 은 의도적 설계로
문서화돼 있으며 vacuity floor 로 안전장치가 걸려 있다. 내부 모듈 의존 그래프도 기존 계층
구조 안에서의 재배선일 뿐 순환·레이어 위반이 없다. 의존성 관점에서 지적할 CRITICAL/WARNING
은 없다.

## 위험도
NONE
