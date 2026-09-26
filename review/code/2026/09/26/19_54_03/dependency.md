# 의존성(Dependency) 리뷰 — request-body-guard

## 발견사항

- **[INFO]** 새 외부 패키지 추가 없음 — 전량 기존 의존성 재사용
  - 위치: `codebase/backend/package.json` (변경 없음, `git diff --stat` 확인), `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts`(`import 'reflect-metadata'`), `codebase/backend/src/common/pipes/validation.pipe.ts`
  - 상세: 이번 PR 39개 변경 파일 중 `package.json`/`pnpm-lock.yaml` 변경은 0건이다(`git diff --stat origin/main...HEAD` 확인). 신규 가드가 쓰는 `reflect-metadata`·`@nestjs/swagger`·`@nestjs/common`·`class-validator`·`class-transformer` 는 모두 기존 의존성이고 버전도 그대로다(`@nestjs/common: ^11.0.1`, `@nestjs/swagger: ^11.4.5`, `reflect-metadata: ^0.2.2`). 버전 고정(pinning)·라이선스·취약점 관점에서 새로 검토할 대상이 없다.
  - 제안: 조치 불요.

- **[INFO]** 신설 가드 파일은 프로덕션 빌드에서 이미 제외됨 — 번들 크기 영향 없음(검증됨)
  - 위치: `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts`(신규), `codebase/backend/src/shared/testing/swagger-probe.ts`(`bodyArgIndexes` 신규 export) / `codebase/backend/tsconfig.build.json` `exclude` 목록
  - 상세: `tsconfig.build.json` 의 `exclude` 에 `src/repo-guards/**` 와 `src/shared/testing/**` 가 이미 등재돼 있음을 직접 확인했다(과거 `masked-reject-callers-guard` 가 devDependency `typescript` 를 dist 로 흘려 프로덕션 설치를 깬 사고의 재발 방지 조치, 주석에 이력 명시). 이번 PR 이 이 두 디렉터리에 추가한 신규 코드(`request-body-advertised-guard.ts`, `bodyArgIndexes`)는 자동으로 같은 exclude 규칙에 걸려 `dist` 로 나가지 않는다. 새 devDependency 도 끌어오지 않았으므로(신규 `import` 는 형제 가드 파일·같은 저장소 프로덕션 모듈뿐) 이 축의 위험도 없다.
  - 제안: 조치 불요 — 기존 가드 격리 장치가 그대로 신규 파일을 커버함을 확인한 기록으로 남긴다.

- **[INFO]** `@nestjs/swagger` 비공개(undocumented) 리플렉션 키에 대한 문자열 하드코딩 — 기존에 이미 있던 패턴의 두 번째 사례, semver caret 범위와 결합한 호환성 리스크
  - 위치: `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts:16-18`(`SWAGGER_API_PARAMETERS` 등 상수 선언)
  - 상세: 해당 상수들(`'swagger/apiParameters'`, `'swagger/apiExcludeEndpoint'`, `'swagger/apiExcludeController'`)은 `@nestjs/swagger` 의 `dist/constants.js` 내부 값을 손으로 옮겨 적은 것이다. 실제로 확인한 결과 `@nestjs/swagger`(설치된 버전 11.4.5)의 `package.json` `exports` 필드는 `.`·`./plugin`·`./package.json` 세 진입점만 열어 두고 `dist/constants` 를 공식적으로 export 하지 않는다 — 코드 주석의 주장과 실측이 일치한다. `package.json` 의 버전 범위는 `^11.4.5`(exact pin 아님)이므로 마이너·패치 업그레이드로 이 내부 키 형식이 바뀔 여지가 이론상 남아 있다(lockfile 이 실제 설치 버전을 고정하지만, 다음 `pnpm update` 시 조용히 갈릴 수 있다). 다만 이 패턴 자체는 이번 PR 이 새로 만든 것이 아니라 형제 파일 `forbidden-response-codes-guard.ts` 에 이미 존재하던 것을 그대로 재사용(복제)한 것이고, 키가 틀리면 모든 `@ApiBody` 가 "없음"으로 읽혀 위반이 쏟아지는 **fail-closed** 설계라 조용한 오탐 통과는 아니다(코드 주석·plan 에 명시).
  - 제안: 조치 불요(기존에 수용된 리스크의 반복, 새 버그 아님) — 다만 향후 `@nestjs/swagger` 메이저 업그레이드 작업 시 이 두 파일(`forbidden-response-codes-guard.ts`, `request-body-advertised-guard.ts`)의 하드코딩 키를 함께 재검증해야 한다는 점을 업그레이드 체크리스트에 남겨둘 만하다.

- **[INFO]** 내부 모듈 의존 방향 — 프로덕션 모듈(`validation.pipe.ts`) → 테스트 전용 가드(`repo-guards/__tests__`)로의 역방향 의존 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts:7`(`import { UNVALIDATED_METATYPES } from '../../common/pipes/validation.pipe'`)
  - 상세: 신규 가드가 프로덕션 파이프 모듈의 export(`UNVALIDATED_METATYPES`)를 가져오는 단방향 의존이다. `validation.pipe.ts` 쪽에서 `repo-guards` 를 참조하는 코드는 없음을 확인했다 — 순환 의존 없음. 같은 가드 파일이 형제 가드(`forbidden-response-codes-guard.ts`)의 타입·함수와 `shared/testing/swagger-probe.ts` 의 `bodyArgIndexes` 도 가져오는데, 이 역시 기존 계층 구조(가드/테스트 헬퍼 레이어 내부 교차 참조)를 따른 것으로 새 계층 위반은 아니다.
  - 제안: 조치 불요.

## 동시 실행 관측 (내가 만들지 않은 미커밋 변경)

- 리뷰 도중 `git status --short` 로 `codebase/backend/src/common/pipes/validation.pipe.ts` 에 **미커밋 diff**(`UNVALIDATED_METATYPES` 배열에서 `Number` 원소 제거)가 관측됐다. 나는 이 파일을 쓰거나 뮤테이션한 적이 없다 — 동시에 같은 워크트리를 읽는 다른 reviewer 의 뮤턴트 검증 작업으로 추정된다. 지시에 따라 `git checkout`/`restore` 로 되돌리지 않았고, 위 발견사항·판정은 이 미커밋 변경을 건드리지 않은 **저장소 원본** 기준이다. 다음 사람이 이 잔여물을 새 결함으로 오인하지 않도록 기록해 둔다.

## 요약

이번 PR 은 `package.json`/`pnpm-lock.yaml` 변경이 없고, 새 외부 패키지·버전 변경·라이선스 이슈·알려진 취약점이 전혀 없다. 신설된 가드 코드(`request-body-advertised-guard.ts`, `bodyArgIndexes`)는 이미 존재하는 `tsconfig.build.json` exclude 규칙에 자동으로 포섭되어 프로덕션 번들에 실리지 않음을 직접 확인했다. 유일하게 주목할 지점은 `@nestjs/swagger` 의 비공식 내부 리플렉션 키를 문자열로 하드코딩한 부분인데, 이는 형제 가드 파일에 이미 있던 기존 패턴의 반복이며 fail-closed 로 설계돼 있어 새로운 위험을 추가하지 않는다. 의존성 관점에서 차단 사유는 없다. (참고: 리뷰 도중 다른 reviewer 로 추정되는 미커밋 변경 1건을 `validation.pipe.ts` 에서 관측했으나 내가 만든 것이 아니며 손대지 않았다.)

## 위험도

NONE
