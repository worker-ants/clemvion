# 의존성(Dependency) 리뷰 결과

## 발견사항

### [INFO] eslint-plugin-unicorn@^56.0.1 신규 추가 (devDependency)
- 위치: `pnpm-lock.yaml` — `codebase/backend` devDependencies, specifier `^56.0.1`, resolved `56.0.1`
- 상세: catch 변수명 통일(`err`) 강제를 위한 린트 규칙(`unicorn/catch-error-name`) 도입 목적으로 추가. 프리셋 전체가 아닌 단일 룰만 활성화하므로 불필요한 린트 규칙 오염 없음. devDependency 이므로 런타임 번들 영향 없음.
- 제안: 현 상태 적절. 추가 조치 불필요.

### [INFO] eslint-plugin-unicorn v56 고정 이유 명시적 문서화 (버전 고정)
- 위치: `pnpm-lock.yaml` specifier `^56.0.1` (캐럿 범위), 커밋 메시지에 v57+ peer 제약 설명
- 상세: v57+는 eslint peer `>=9.20`을 요구하는데, 현 프로젝트 eslint floor(`^9.18`)와 충돌. v56으로 상한을 사실상 제한한 근거가 커밋 메시지에 명시되어 있음. `^56.0.1`은 minor/patch 업데이트를 허용하므로 엄밀한 patch 고정은 아니나, 메이저 버전 상한이 의도에 부합. lockfile에 `56.0.1`로 해소되어 재현성 보장됨.
- 제안: 허용 가능. 필요 시 `specifier: 56.0.1`(정확 고정)으로 변경을 고려할 수 있으나, pnpm lockfile이 버전을 못 박으므로 현실적 위험도는 낮음.

### [INFO] 전이 의존성 13개 신규 추가
- 위치: `pnpm-lock.yaml` packages/snapshots 섹션
- 상세: `eslint-plugin-unicorn@56.0.1`의 전이 의존성으로 다음이 추가됨.
  - `@types/normalize-package-data@2.4.4`
  - `builtin-modules@3.3.0`
  - `clean-regexp@1.0.0`
  - `core-js-compat@3.49.0`
  - `escape-string-regexp@1.0.5`
  - `globals@15.15.0`
  - `hosted-git-info@2.8.9`
  - `is-builtin-module@3.2.1`
  - `jsesc@0.5.0`
  - `normalize-package-data@2.5.0`
  - `read-pkg-up@7.0.1`, `read-pkg@5.2.0`
  - `regjsparser@0.10.0`
  - `semver@5.7.2`
  - `spdx-correct@3.2.0`, `spdx-exceptions@2.5.0`, `spdx-expression-parse@3.0.1`, `spdx-license-ids@3.0.23`
  - `type-fest@0.6.0`, `type-fest@0.8.1`
  - `validate-npm-package-license@3.0.4`

  이 패키지들은 모두 devDependency 체인이므로 프로덕션 번들·런타임에 포함되지 않음. `read-pkg-up`은 package.json 탐색용으로 unicorn이 `no-array-for-each` 등의 rule 평가 시 내부 사용함.

### [INFO] `semver@5.7.2` 추가 (전이)
- 위치: `pnpm-lock.yaml`, `normalize-package-data@2.5.0` 의존
- 상세: 프로젝트에 이미 `semver@6.3.1`, `semver@7.x`가 공존하며, `5.7.2`가 전이로 추가됨. semver 5.x는 알려진 CVE가 없는 안정 버전. 다중 semver 버전 공존은 pnpm 구조상 일반적이며 devDependency 체인에만 속함.
- 제안: 조치 불필요.

### [INFO] `resolve` 패키지 optional 플래그 제거
- 위치: `pnpm-lock.yaml` snapshots — `resolve@1.22.12`의 `optional: true` 제거
- 상세: `normalize-package-data@2.5.0`이 `resolve`를 비선택적으로 요구하면서 기존 optional 표시가 제거됨. 실제 패키지 설치 여부·동작에는 영향 없음(이미 lockfile에 존재).
- 제안: 조치 불필요.

### [INFO] 라이선스 호환성
- 상세: `eslint-plugin-unicorn`은 MIT 라이선스. 전이 의존성(`builtin-modules`, `clean-regexp`, `read-pkg-up`, `semver` 등) 모두 MIT 또는 ISC. `spdx-*` 패키지들도 MIT. 프로젝트 라이선스와 충돌 없음.
- 제안: 조치 불필요.

### [INFO] 번들 크기·빌드 시간 영향
- 상세: 모든 신규 의존성이 `devDependencies` 체인. 프로덕션 빌드(NestJS 컴파일 결과물, frontend 번들)에 포함되지 않음. CI lint 단계에서 패키지 설치 시간이 소폭 증가할 수 있으나 미미한 수준.
- 제안: 조치 불필요.

### [INFO] 내부 모듈 의존 관계
- 위치: `codebase/backend/src/nodes/presentation/table/table.handler.ts`
- 상세: 이번 변경에서 새 내부 의존성 추가 없음. 기존 `@workflow/expression-engine`, `../../core/`, `../_shared/` 등 내부 임포트 구조 유지.
- 제안: 조치 불필요.

---

## 요약

이번 변경의 의존성 영향은 `codebase/backend` devDependency에 `eslint-plugin-unicorn@^56.0.1` 1개를 추가한 것이 전부이며, 프로덕션 런타임·번들에는 영향이 없다. v56 고정 이유(v57+ eslint peer 충돌)가 커밋 메시지에 명확히 설명되어 있고 pnpm lockfile이 재현성을 보장한다. 전이 의존성 약 20개가 추가되나 모두 devDependency 체인에 국한되며 MIT/ISC 라이선스로 호환성 문제가 없다. 알려진 취약점·버전 충돌·불필요한 중복은 발견되지 않았다.

## 위험도

NONE
