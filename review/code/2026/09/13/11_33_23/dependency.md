# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — `package.json`/lockfile 미변경 (확인됨)
  - 위치: 저장소 루트(diff 전체) — `git diff origin/main...HEAD --stat -- '*.json' 'pnpm-lock.yaml'` 결과 0건
  - 상세: 이번 변경은 (1) `LlmService.testConnection` 반환 필드명 정리(`error`→`message`), (2) `TestConnectionResultDto`/`ModelTestConnectionResultDto` 의 유령 필드(`latencyMs`, `meta`) 제거와 실제로 발행되던 `code` 필드 추가, (3) 새 vitest 테스트 3개(`guide-error-code-existence.test.ts`, `guide-error-code-scan.ts`, `guide-sanitized-message-parity.test.ts`) 및 기존 `assertMatchesContract`/`contractForDto`(`codebase/backend/src/shared/testing/response-contract.ts`) 배선, (4) 문서(MDX) 내용 정정으로 구성된다. 신규 테스트 파일들의 import 는 `vitest`, `node:fs`, `node:path`, 그리고 저장소 내부 모듈(`./impl-anchor-parse`, `./tree-walk`, `../../shared/testing/response-contract`)뿐이다. `response-contract.ts` 자체도 기존 의존성인 `@nestjs/common`/`@nestjs/swagger`만 사용한다. `ImplAnchor` 컴포넌트(`codebase/frontend/src/components/docs/mdx/impl-anchor.tsx`) 역시 이미 다른 가드(`impl-anchor-existence.test.ts`, `no-internal-refs.test.ts` 등)가 사용 중인 기존 내부 컴포넌트다.
  - 제안: 없음 — 조치 불요.

- **[INFO]** frontend 테스트가 backend 소스 파일을 경로 문자열로 읽는 크로스-패키지 결합 (의존성 관점 8. 내부 의존성)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts` (`sotRel` 상수, `sanitize-error.util.ts` 경로 하드코딩)
  - 상세: 새 가드가 `codebase/backend/src/modules/llm/utils/sanitize-error.util.ts` 를 `fs.readFileSync` 로 텍스트 파싱해 프런트엔드 가이드 문서와 대조한다. 패키지 경계를 넘는 **빌드타임 import**는 만들지 않지만(주석에 명시된 의도적 설계), 파일 경로 자체가 frontend 테스트와 backend 모듈 간의 암묵적 결합점이 된다. 다만 이 패턴은 같은 디렉터리의 자매 가드(`impl-anchor-parse.ts` 계열)가 이미 쓰고 있는 기존 관례이고, 경로가 어긋나면 (파일 없음 → 예외, 또는 정규식 추출 0건 → vacuity floor 8건 단언이 즉시 RED) **실패가 시끄러운 방향**으로 설계되어 있어 실질 위험은 낮다. 새로 도입된 위험이 아니라 기존 관례의 연장이다.
  - 제안: 조치 불요. 향후 `sanitize-error.util.ts` 를 이동/리네임할 때 이 테스트의 `sotRel` 도 동반 갱신해야 한다는 점만 인지.

- **[INFO]** DTO 필드 정리는 번들/런타임 의존성에 영향 없음
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`, `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts`
  - 상세: `latencyMs`/`meta` 제거와 `code` 추가는 동일 파일 내 데코레이터(`@ApiProperty`, `@ApiPropertyOptional`)만 사용하며 새 패키지를 끌어오지 않는다. Swagger 문서 생성 로직·NestJS 버전에 영향 없음.
  - 제안: 조치 불요.

## 요약

이번 diff 는 `package.json`/lockfile 변경이 전혀 없어 신규 외부 패키지 추가·버전 고정·라이선스·취약점·번들 크기 항목 모두 해당 사항이 없다. 실질 변경은 백엔드 응답 필드명 정리(`error`→`message`), DTO 의 유령 필드 제거 및 실배선 필드(`code`) 추가, 기존 계약 검사기(`assertMatchesContract`/`contractForDto`)를 두 엔드포인트에 새로 배선한 테스트, 그리고 유저 가이드 문서(MDX)의 에러 코드 서술을 실측과 맞추는 정정으로 구성된다. 새로 추가된 테스트 파일들은 전부 기존 내부 모듈·기존 devDependency(`vitest`)만 사용하며, 유일하게 주목할 점은 frontend 가이드-패리티 테스트가 backend 소스 파일을 텍스트로 읽어 대조하는 크로스-패키지 결합인데, 이는 같은 디렉터리 자매 가드들이 이미 채택한 기존 관례이고 실패 시 조용히 통과하지 않도록 vacuity floor 로 방어되어 있어 위험이 낮다. 종합적으로 의존성 관점의 리스크는 없다.

## 위험도

NONE
