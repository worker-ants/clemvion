# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부 의존성 추가 없음 — 기존 devDependency 재사용
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:6` (`import * as ts from 'typescript';`)
  - 상세: 이 PR 전체(`git diff --stat origin/main...HEAD`)에서 `package.json`·lockfile(`pnpm-lock.yaml` 등) 변경이 0건이다. 새로 추가된 정적 가드(`param-uuid-pipe-guard.ts`)가 유일하게 새로 쓰는 외부 패키지는 `typescript` 컴파일러 API인데, 이는 `codebase/backend/package.json:129`에 이미 `"typescript": "^5.7.3"` 로 devDependency 로 존재한다(형제 가드 `dto-class-name-collision` 등도 이미 같은 패턴으로 AST 파싱을 수행 중). 버전 고정은 caret range(`^5.7.3`)로, 저장소의 기존 관례와 동일하다 — 이 PR 이 새로 도입한 패턴이 아니다.
  - 제안: 없음 (조치 불요).

- **[INFO]** 내부 의존성 재사용 — 새 유틸리티 대신 기존 test-utility 활용
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:8` (`import { toPosixRelative } from '../../common/__test-utils__/source-scan';`), `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts:4` (`import { collectTsFiles } from '../../common/__test-utils__/source-scan';`)
  - 상세: 새 가드가 파일 수집(`collectTsFiles`)·경로 정규화(`toPosixRelative`) 로직을 직접 재구현하지 않고 이미 존재하는 `codebase/backend/src/common/__test-utils__/source-scan.ts` (다른 repo-guard 들의 공용 유틸)를 그대로 import 해서 쓴다. 표준 라이브러리·기존 의존성으로 대체 가능한지 관점에서 바람직한 선택 — 불필요한 의존성/중복 구현이 없다.
  - 제안: 없음 (조치 불요, 긍정적 패턴으로 기록).

- **[INFO]** 나머지 변경분(컨트롤러 데코레이터 추가, mdx/문서, i18n 라벨, plan 문서)은 import/의존성 표면에 영향 없음
  - 위치: `codebase/backend/src/modules/auth/auth.controller.ts`, `codebase/backend/src/modules/triggers/triggers.controller.ts` (기존 `@nestjs/common`·`@nestjs/swagger` 데코레이터 사용 확장뿐, 새 import 없음), `codebase/frontend/src/content/docs/**/*.mdx`, `codebase/frontend/src/lib/i18n/backend-labels.ts`, `plan/in-progress/*.md`
  - 상세: `ParseUUIDPipe`(`@nestjs/common`)와 `ApiParam`(`@nestjs/swagger`)은 두 컨트롤러 파일에 이미 import 되어 있던 심볼이며 이번 diff 는 데코레이터 인자/파라미터 데코레이터 적용 위치만 바꾼다. 프런트엔드 mdx·i18n 변경은 문자열 값 수정이며 신규 패키지·번들 크기·빌드 시간에 영향 없음.
  - 제안: 없음.

## 요약

이번 변경분은 신규 외부 패키지 추가가 전혀 없다(`package.json`/lockfile diff 0건). 유일하게 새로 작성된 정적 분석 코드(`param-uuid-pipe-guard.ts`, `param-uuid-pipe.spec.ts`, fixture)는 이미 저장소에 pin 되어 있는 `typescript` devDependency 와 기존 내부 test-utility(`source-scan.ts`)만 재사용하며, 형제 repo-guard 들과 동일한 기존 패턴을 따른다. 나머지 컨트롤러·문서·i18n 변경도 기존 라이브러리(`@nestjs/common`, `@nestjs/swagger`) 범위 안에서 데코레이터 사용을 확장한 것뿐이라 라이선스·취약점·버전 충돌·번들 크기 어느 축에서도 새로운 리스크가 없다.

## 위험도

NONE
