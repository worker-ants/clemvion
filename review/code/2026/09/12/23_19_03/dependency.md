# 의존성(Dependency) 리뷰

## 검토 범위

이번 변경셋(7개 파일)은 keyset 커서의 id 성분이 검증 없이 `uuid` 컬럼에 바인딩돼 22P02 →
500 으로 마스킹되던 결함 2건을 고친 것이다. 대상 파일:

1. `CHANGELOG.md` (문서)
2. `codebase/backend/src/modules/auth/login-history.service.spec.ts` (테스트)
3. `codebase/backend/src/modules/auth/login-history.service.ts` (구현)
4. `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts` (테스트)
5. `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` (구현)
6. `plan/in-progress/keyset-cursor-uuid-validation.md` (신규 plan, 트래킹 문서)
7. `plan/in-progress/spec-draft-nullable-notation-followups.md` (기존 plan 정정)

`package.json`·`pnpm-lock.yaml`·`pnpm-workspace.yaml` 등 매니페스트 파일은 변경셋에
포함되어 있지 않다.

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — 기존 내부 유틸 재사용
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:8` (`import { isUuidShaped } from '../../common/utils/uuid';`),
    `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:22` (`import { isUuidShaped } from '../../../common/utils/uuid';`)
  - 상세: 두 구현 파일 모두 UUID 형태 검증을 위해 신규 패키지(`uuid`, `is-uuid`, `validator` 등)를 추가하지 않고, 저장소에 이미 존재하는 `codebase/backend/src/common/utils/uuid.ts` 의 `isUuidShaped` 함수를 재사용했다. `git log --oneline -- codebase/backend/src/common/utils/uuid.ts` 로 확인한 결과 이 파일은 이번 diff 로 신설된 것이 아니라 기존 파일(가장 오래된 관련 커밋 `3d6e93dec`)이다. 새 패키지 도입, 버전 고정, 라이선스, 취약점, 번들 크기 항목은 해당 없음.
  - 제안: 없음 (권장 방식 그대로 적용됨 — 표준 라이브러리/기존 의존성으로 대체 가능한지 항목에도 이미 부합).
- **[INFO]** 내부 모듈 의존 관계 변화 — 두 서비스가 공용 유틸에 새로 결합
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts` (import 추가), `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` (import 추가)
  - 상세: `auth` 모듈과 `executions/background-runs` 모듈이 각각 `common/utils/uuid`에 대한 의존을 새로 갖게 됐다. 두 곳 모두 순수 함수(`isUuidShaped`)를 값으로만 소비하며 순환 의존이나 계층 역전 우려는 없다 — `common/utils`는 이미 저장소 전반에서 소비되는 leaf 유틸 계층이다. `plan/in-progress/keyset-cursor-uuid-validation.md` §A 는 "새 함수를 만들지 않고 기존 `isUuidShaped`를 재사용했다"는 근거(형식 오류로 인가 응답을 오분류하는 `isValidUuid`와의 비대칭)를 명시적으로 남겼다.
  - 제안: 없음.
- **[INFO]** 테스트 파일도 새 테스트 의존성 도입 없음
  - 위치: `codebase/backend/src/modules/auth/login-history.service.spec.ts:1-4`, `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts` (import 구간)
  - 상세: 두 spec 파일 모두 기존에 쓰던 `@nestjs/testing`, `@nestjs/typeorm` 등만 사용하며 UUID 검증 테스트에 리터럴 문자열(`'3fa85f64-5717-4562-b3fc-2c963f66afa6'`, nil UUID `'00000000-0000-0000-0000-000000000000'`)을 직접 하드코딩해 별도 fixture 라이브러리(`@faker-js/faker` 등)에 기대지 않았다.
  - 제안: 없음.
- **[INFO]** CHANGELOG.md 는 이 트리거/키셋 커서 변경과 무관한 이전 항목(pnpm override 상향·libc 메타데이터 복원 등)을 이미 포함하고 있으나, 이번 diff 는 그 문서 상단에 새 섹션만 추가한 것이라 실제 의존성 변경을 재도입하지 않는다.
  - 위치: `CHANGELOG.md:3-27` (신규 추가 구간)
  - 상세: diff 상 실제로 변경(`+`)된 줄은 새 "Unreleased" 섹션 헤더뿐이며, 그 아래 pnpm override 관련 서술은 기존에 이미 커밋된 내용으로 이번 리뷰의 변경 대상이 아니다(unified diff 게이트가 비어 있는 컨텍스트 구간).
  - 제안: 없음.

## 요약

이번 변경셋은 코드·문서 수준의 취약점 수정이며 의존성 관점에서는 완전히 중립적이다. 새 외부 패키지 추가·버전 변경·매니페스트(package.json/pnpm-lock.yaml/pnpm-workspace.yaml) 수정이 전혀 없고, 두 서비스 파일이 새로 갖게 된 유일한 결합은 저장소에 이미 존재하는 내부 유틸(`common/utils/uuid.ts`의 `isUuidShaped`) 재사용뿐이다. 라이선스·취약점·번들 크기·버전 충돌 항목은 모두 해당 사항이 없으며, 내부 의존 관계도 leaf 유틸 계층에 대한 단방향 참조 추가로 계층 위반이나 순환 의존을 만들지 않는다.

## 위험도

NONE
