# 의존성(Dependency) 리뷰

## 검토 범위와 방법

리뷰 대상 28개 파일(`CHANGELOG.md`, backend LLM/model-config 모듈 4개, 신규 backend 테스트 2개,
frontend mdx 문서 8개, frontend `model-configs` API 클라이언트·테스트 2개, 신규 frontend 가드
2개(`guide-error-code-scan.ts`/`guide-error-code-existence.test.ts`), plan 문서 2개, 지난
consistency-check 산출물 6개)을 전수로 확인했다. 의존성 관점에서 실질적으로 문제될 수 있는 대상은
새 import 문이 등장하는 3개 신규/변경 TS 파일이었다 — 나머지는 문서(mdx/md)·DTO 필드 삭제·JSON 산출물이라
의존성 축과 무관하다.

`package.json`·lockfile 변경 여부를 직접 확인했다:

```
git diff origin/main...HEAD --name-only | grep -i "package.json\|lock"   # 결과 없음
```

이 changeset 전체에 `package.json`/`pnpm-lock.yaml` diff가 **하나도 없다** — 즉 신규 외부 패키지
추가·버전 변경이 원리적으로 없다.

새로 등장한 import 를 전부 대조했다:

- `llm-model-config.controller.spec.ts` (파일 3): `@nestjs/common`, `@nestjs/testing`, `supertest` —
  모두 `codebase/backend/package.json` 기존 `dependencies`/`devDependencies`(`supertest@^7.0.0`,
  `@types/supertest@^6.0.2`)에 이미 있다. 신규 추가 없음.
- `guide-error-code-existence.test.ts` (파일 17): `vitest`, `node:fs`, `node:path` — 기존
  테스트 러너 + Node 내장 모듈. `walkTree`/`collectMdxFiles`/`repoRoot` 는
  `codebase/frontend/src/lib/docs/__tests__/tree-walk.ts`·`impl-anchor-parse.ts` — 각각
  `#1146`·`a36395f5c` 커밋으로 이미 저장소에 존재하는 내부 모듈이며 이번 changeset 이 아니라
  재사용이다(`git log` 로 확인).
- `guide-error-code-scan.ts` (파일 18, 신규): import 문 자체가 없다 — 순수 `RegExp`/문자열 연산만
  쓰는 self-contained 모듈. 외부 의존성 0.
- `llm.service.spec.ts`(파일 4)·`llm-model-config.controller.spec.ts`(파일 3) 가 새로 쓰는
  `assertMatchesContract`/`contractForDto` (`codebase/backend/src/shared/testing/response-contract.ts`)
  도 기존 내부 모듈 재사용이다.

## 발견사항

- **[INFO] 신규 외부 의존성 없음 — 확인됨**
  - 위치: 저장소 루트(`git diff origin/main...HEAD -- '**/package.json' 'pnpm-lock.yaml'`)
  - 상세: 이번 changeset 은 `package.json`/lockfile 을 전혀 건드리지 않는다. 새로 추가된
    TS 파일(`guide-error-code-scan.ts`)은 외부 패키지를 import 하지 않고 Node/TS 내장 기능만
    사용하며, 테스트 파일들이 새로 쓰는 심볼(`supertest`, `assertMatchesContract`,
    `walkTree`, `collectMdxFiles`)은 모두 기존에 이미 설치·존재하던 것들이다. 버전 고정·라이선스·
    취약점·번들 크기·호환성 항목은 이번 변경으로 발생하는 리스크가 없다.
  - 제안: 없음 — 정보성 확인.

- **[INFO] 내부 의존성 방향 — 새 가드가 backend/packages 소스를 순회하는 방식**
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts` (`collectBackendTokens`
    함수) · 호출부는 `guide-error-code-existence.test.ts` 의 `walkTree(root, ["codebase/backend/src",
    "codebase/packages"], ...)`
  - 상세: frontend 테스트 코드가 빌드 타임에 `codebase/backend/src`·`codebase/packages` 파일을
    파일시스템 레벨(`fs.readFileSync`)로 직접 읽어 문자열 토큰을 추출한다. 이는 frontend →
    backend 로의 **런타임 실행 의존성이 아니라 build/test-time 문자열 스캔**이며, 자매 가드
    `impl-anchor-existence.test.ts` 와 같은 기존 패턴(`plan/in-progress/guide-error-code-truth.md`
    §D 에서 명시적으로 검토됨)을 그대로 따른다. 새로운 계층 결합을 만들지는 않지만, backend 소스
    트리 구조(디렉터리명 `codebase/backend/src`, `codebase/packages`)가 바뀌면 frontend 테스트가
    조용히 vacuous 해질 수 있는 결합점이라는 점은 plan 문서 자신도 "vacuity floor" 단언
    (`mdxFiles.length`·`sourceTexts.length`·`backendTokens.size` 하한)으로 이미 대비하고 있다.
  - 제안: 추가 조치 불필요 — 이미 vacuity floor 로 방어돼 있음을 확인.

- **[INFO] DTO 필드 제거(`latencyMs`)가 OpenAPI 소비자에 미치는 영향 — 의존성 방향은 아니지만 계약 축**
  - 위치: `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts:53-58`,
    `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:460-462`
  - 상세: 순수 의존성(패키지) 문제는 아니지만, OpenAPI 스펙을 소비하는 외부 코드 생성기(예:
    프런트 SDK 생성기가 있다면)가 이 필드 삭제로 영향받을 수 있는지 확인이 필요하다. 저장소 내
    검색상 이 두 DTO 의 `latencyMs` 소비처는 없었다(diff 설명과 일치) — frontend
    `model-configs.ts`(파일 16)에서도 같은 필드가 함께 제거됐고 그 테스트(파일 15)도 갱신됐다.
    외부(서드파티) 소비자용 공개 SDK 패키지가 이 DTO 를 기반으로 생성되는 파이프라인이 있는지는
    이 프롬프트 번들 범위 밖이라 확인하지 못했다.
  - 제안: 만약 OpenAPI 스펙을 바탕으로 자동 생성되는 별도 클라이언트 SDK 패키지가 있다면
    (이번 diff 범위엔 안 보임) 재생성이 필요하다는 점만 참고로 남긴다 — CI/버전 게이트에서
    확인될 사안으로 이 리뷰의 차단 사유는 아니다.

## 요약

이번 changeset 은 `package.json`/lockfile 을 전혀 수정하지 않으며, 새로 추가된 TS 파일들이
import 하는 모든 심볼(`supertest`, NestJS 테스트 유틸, `assertMatchesContract`/`contractForDto`,
`walkTree`/`collectMdxFiles`)은 기존에 이미 설치·존재하던 패키지 또는 내부 모듈의 재사용이다.
신규 순수 스캐너 모듈(`guide-error-code-scan.ts`)은 외부 의존성이 전혀 없는 self-contained
정규식 기반 구현이다. 나머지 변경은 문서(mdx/CHANGELOG/plan)와 DTO 필드 삭제(`latencyMs`,
생산자 0건 확인됨)·필드명 통일(`error`→`message`)로, 의존성 관점에서는 리스크가 없다. 새 의존성·
버전 고정·라이선스·취약점·번들 크기·호환성 항목 모두 해당 사항 없음(N/A)으로 판정한다.

## 위험도

NONE
