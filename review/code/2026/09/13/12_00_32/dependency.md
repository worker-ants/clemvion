# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부 의존성 없음 (검증 완료)
  - 위치: 전체 diff (`git diff origin/main --stat`, `package.json`/`package-lock.json`/`pnpm-lock.yaml` 매치 0건)
  - 상세: 이번 변경은 CHANGELOG/PROJECT.md 문서, backend DTO(`integration-response.dto.ts`, `model-config-response.dto.ts`) 필드 정리, `LlmService.testConnection` 반환 키 이름 변경(`error`→`message`), 신규 테스트 3종(`guide-error-code-existence.test.ts`, `guide-error-code-scan.ts`, `guide-sanitized-message-parity.test.ts`), 사용자 가이드 MDX 6쌍, 그리고 다수의 `review/**` 산출물(수정 대상 아님)로 구성된다. 어떤 파일에서도 `package.json`/lockfile 변경이 없다.
  - 제안: 없음 (해당 없음).

- **[INFO]** 신규 테스트가 끌어오는 심볼은 전부 기존 내부 모듈 재사용
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts` (import 구문), `codebase/backend/src/modules/integrations/integrations.service.spec.ts:13-17`, `codebase/backend/src/modules/llm/llm.service.spec.ts:5-9`, `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts` (신규 `describe` 블록 상단 import)
  - 상세: `guide-error-code-existence.test.ts` 는 `./tree-walk`(`a6d916192`/이전 커밋에서 이미 존재) 와 `./impl-anchor-parse` 를 재사용하고, 새 순수 모듈 `guide-error-code-scan.ts` 는 `node:fs`/정규식만 쓴다. backend 세 스펙 파일이 새로 import 하는 `assertMatchesContract`/`contractForDto` (`codebase/backend/src/shared/testing/response-contract.ts`) 는 이번 PR 이 아니라 이전 PR(`f5d97aa39`, `#1288`)에서 이미 도입된 내부 헬퍼다 — 이번 PR 은 그 배선을 두 엔드포인트(`/model-configs/:id/test`, `/integrations/:id/test`)에 추가로 연결할 뿐 새 코드를 얹지 않는다. `llm-model-config.controller.spec.ts` 가 새로 import 하는 `supertest`·`@nestjs/testing`·`@nestjs/common` 은 backend `package.json` 에 이미 고정된 devDependency 이며(`supertest": "^7.0.0"`), 저장소 내 다른 컨트롤러 스펙(`health.controller.spec.ts`, `triggers.controller.spec.ts`)에서 동일 패턴으로 이미 쓰이고 있다.
  - 제안: 없음 — 표준 재사용 패턴으로 바람직하다.

- **[INFO]** 버전 고정·라이선스·취약점·번들 크기·호환성 항목 해당 없음
  - 위치: 전체 diff
  - 상세: 새 패키지 추가가 없으므로 버전 고정 정책, 라이선스 호환성, 알려진 CVE, 번들 크기/빌드 시간 영향, 기존 의존성과의 버전 충돌 — 이 다섯 관점 모두 이번 diff 표면에 해당 사항이 없다.
  - 제안: 없음.

## 요약

이번 변경 세트(11개 실 코드/문서 파일 + `plan/`·`review/` 산출물)에는 신규 외부 패키지 추가, `package.json`/lockfile 수정이 전혀 없다. 새로 추가된 테스트 파일들이 import 하는 심볼은 모두 이전 커밋에서 이미 도입된 내부 모듈(`tree-walk`, `impl-anchor-parse`, `response-contract` 등)이거나 이미 고정 버전이 있는 기존 devDependency(`supertest`)이며, 새 순수 로직 모듈(`guide-error-code-scan.ts`)도 Node 표준 라이브러리와 정규식만 사용한다. 의존성 관점에서 이 PR 이 도입하는 위험은 없다.

## 위험도

NONE
