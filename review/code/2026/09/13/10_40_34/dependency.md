# 의존성(Dependency) 리뷰

## 검토 범위와 방법

이번 changeset(28개 코드/문서/plan 파일 + 이전 라운드 `review/code/.../10_12_19/**`·
`review/consistency/.../01_15_40/**` 산출물 재커밋분)을 대상으로, `origin/main...HEAD` 기준
실제 diff 를 직접 재확인했다(프롬프트 절단 구간은 `Bash`/`Read` 로 원본 대조):

```
git diff origin/main...HEAD --name-only | grep -iE "package\.json|lock"   # 결과 0건
```

이 changeset 전체에 `package.json`/`pnpm-lock.yaml` diff 가 **하나도 없음**을 직접 확인했다
(모노레포 내 `package.json` 11개 전수 위치도 확인했으나 diff 대상 56개 파일 중 어디에도
포함되지 않는다). 새로 등장한 `import`/`require` 문을 파일별로 grep 해 전부 대조했다.

## 발견사항

- **[INFO]** 신규 외부 의존성 없음 — 직접 확인
  - 위치: 저장소 루트 (`git diff origin/main...HEAD --name-only | grep -iE "package\.json|lock"` → 0건)
  - 상세: `llm-model-config.controller.spec.ts` 가 새로 쓰는 `@nestjs/common`(`INestApplication` 타입)·
    `@nestjs/testing`(`Test`)·`supertest` 는 `codebase/backend/package.json` 에 이미 `dependencies`/
    `devDependencies`(`@nestjs/common@^11.0.1`·`@nestjs/testing@^11.0.1`·`supertest@^7.0.0`·
    `@types/supertest@^6.0.2`)로 존재한다(grep 으로 확인). `llm.service.spec.ts`·
    `llm-model-config.controller.spec.ts` 가 새로 import 하는 `assertMatchesContract`/`contractForDto`
    (`codebase/backend/src/shared/testing/response-contract.ts`)와 `guide-error-code-existence.test.ts`
    가 새로 import 하는 `walkTree`(`./tree-walk.ts`)·`collectMdxFiles`/`repoRoot`(`./impl-anchor-parse.ts`)
    는 이번 diff 에서 **수정되지 않은 기존 파일**이다(`git diff origin/main...HEAD --name-status` 로
    해당 3개 파일이 changeset 목록에 없음을 확인) — 순수 내부 모듈 재사용이다.
  - 제안: 없음 — 정보성 확인.

- **[INFO]** 신규 순수 스캐너 모듈은 외부 의존성 0
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts` (신규 파일, 전체)
  - 상세: 파일 전체에 `import`/`require` 문이 **하나도 없다**(직접 열어 확인). `RegExp`/문자열
    연산만 쓰는 self-contained 모듈이며, `collectBackendTokens`/`scanErrorCodeCitations` 모두
    인자로 받은 문자열 배열만 처리한다.
  - 제안: 없음.

- **[INFO]** 내부 의존성 방향 — frontend 테스트가 backend/packages 소스 트리를 build-time 에 직접 읽는다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts`
    (`walkTree(root, ["codebase/backend/src", "codebase/packages"], ...)`)
  - 상세: `codebase/frontend` 의 테스트 스위트가 `codebase/backend/src`·`codebase/packages` 경로를
    하드코딩해 파일시스템 레벨로 순회·`fs.readFileSync` 한다. 이는 런타임 실행 의존성이 아니라
    build/test-time 문자열 스캔이며, 같은 파일이 재사용하는 `tree-walk.ts`/`impl-anchor-parse.ts` 는
    이미 저장소에 존재하던 자매 가드 `impl-anchor-existence.test.ts` 가 확립한 선례를 그대로
    따른다(이번 diff 가 새로 만든 결합 방향이 아니다). 디렉터리 구조가 바뀌면 이 스캔이 조용히
    비어(vacuous) 질 수 있는 결합점이지만, 파일 자체가 `mdxFiles.length`·`sourceTexts.length`·
    `backendTokens.size` 하한(vacuity floor) 단언으로 이미 방어하고 있음을 코드에서 확인했다.
  - 제안: 추가 조치 불필요.

- **[INFO]** 신규 build-time 가드가 매 테스트 실행마다 backend+packages 전체를 동기 I/O 로 로드 — 의존성 크기(빌드 시간) 축 참고
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts`
  - 상세: 패키지 크기 문제는 아니지만 "의존성 크기·빌드 시간 영향" 관점에서, 이 스위트는 매
    vitest 실행마다 `codebase/backend/src`+`codebase/packages` 전 `.ts` 파일을 재귀 로드한다.
    선형(O(총 바이트 수)) 스캔이고 `it()` 당 재계산이 아니며, 동일 계열 자매 가드가 이미 같은
    패턴을 쓰고 있어 이번 PR 이 새로 도입한 비용 클래스는 아니다. 저장소 규모가 수 배 커지면
    누적 벽시계 비용이 관찰 대상이 될 수 있다는 점만 참고로 남긴다(성능 리뷰어 관점과 중복,
    차단 사유 아님).
  - 제안: 없음 (지금 규모에서는 문제 아님).

- **[INFO]** `latencyMs` DTO 필드 제거는 의존성(패키지) 축이 아니라 계약(contract) 축 — 참고만
  - 위치: `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts`,
    `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
  - 상세: OpenAPI 로 광고되던 필드를 제거하는 것은 "새 의존성/버전"이 아니라 API 계약 축이라
    본 관점(의존성) 밖이다. 별도 `api_contract.md` 리뷰어가 다루는 사안임을 확인했고, 실측상
    생산자 0건이었다는 근거(CHANGELOG·주석)도 직접 grep 으로 재확인했다. 이 리뷰에서는 차단
    사유로 등재하지 않는다.
  - 제안: 없음 (다른 관점 리뷰어의 담당).

## 요약

`origin/main...HEAD` 전체 diff 를 직접 확인한 결과 `package.json`/`pnpm-lock.yaml` 변경이
전혀 없어 새 외부 패키지 추가·버전 변경·라이선스·취약점·번들 크기 리스크가 원리적으로 없다.
신규/변경 TS 파일이 쓰는 모든 심볼(`supertest`, NestJS 테스트 유틸, `assertMatchesContract`/
`contractForDto`, `walkTree`/`collectMdxFiles`)은 기존에 이미 설치·존재하던 패키지 또는
diff 밖의 기존 내부 모듈 재사용이며, 신규 스캐너 `guide-error-code-scan.ts` 는 import 문이
전무한 self-contained 정규식 모듈이다. 유일한 구조적 관찰점은 frontend 테스트가 build-time 에
backend/packages 소스를 직접 읽는 내부 의존 방향인데, 이는 기존 자매 가드가 이미 확립한 선례를
재사용한 것이고 vacuity floor 로 조용한 실효화까지 방어돼 있어 신규 리스크가 아니다.

## 위험도

NONE
