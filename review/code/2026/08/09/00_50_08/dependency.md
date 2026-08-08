# 의존성(Dependency) 리뷰

## 발견사항

없음. 아래 실측 근거로 8개 점검 관점 전부 해당 없음(N/A)을 확인했다.

- **[INFO]** 이 변경분은 순수 lint-fix 이며 의존성 표면에 영향이 없다
  - 위치: 리포 전체 (`git diff origin/main...HEAD`, 75 files changed / 34 files in this reviewer's payload)
  - 상세:
    - `package.json` / lockfile(`pnpm-lock.yaml` 등) 변경 파일 0건 (`git diff origin/main...HEAD --name-only | grep -iE "package.json|lock"` → 무출력).
    - `.eslintrc` / `eslint.config.*` / prettier 설정 변경 0건 — 규칙 자체가 아니라 규칙 위반 코드만 고쳤다.
    - 추가된 import 문(`+` 라인) 전수 검사 결과 외부 패키지 신규 import 0건 (`grep -nE "^\+.*(from '|from \"|require\()"` → 상대경로(`'../'`, `'./'`) 이외 매치 없음).
    - 내부 모듈 import 변경도 1건뿐이며(`codebase/backend/src/modules/hooks/hooks.service.ts`), 이는 새 의존 관계 추가가 아니라 이미 import 중이던 `../chat-channel/shared/language-hint-defaults` 에서 미사용 named import(`type LanguageLocale`)를 제거하고 인라인 캐스트를 없앤 것 — `no-unnecessary-type-assertion` 규칙 준수를 위한 정리다. 모듈 간 의존 그래프(§8 내부 의존성)는 불변.
    - plan 문서(`plan/in-progress/backend-lint-gate-broken-on-main.md`)의 서술과도 일치: 이 PR 은 `prettier/prettier` 122건 포맷 수정 + `no-unnecessary-type-assertion` 54건(회귀 7건 원복 포함) 처분만을 스코프로 하며, 남은 `no-unsafe-*` 45건 등은 "이 PR 에서 하지 않는다"고 명시적으로 defer 되어 있어 향후 PR 에서도 신규 외부 의존성 도입 계획은 보이지 않는다.
  - 제안: 해당 없음(조치 불필요). 향후 `no-unsafe-*` 잔여 47건을 별도 PR 로 처분할 때 타입 보강 방식이 새 유틸리티 패키지 도입으로 이어지는지만 그 시점에 재확인하면 된다.

## 요약
검토 대상 34개 파일(및 리포 전체 diff 75개 파일)은 backend ESLint/Prettier 게이트 복구를 위한 순수 포맷팅·타입 단언 정리 변경이다. `package.json`/lockfile/ESLint·Prettier 설정 변경이 전혀 없고, 추가된 import 문 중 상대경로가 아닌 것이 하나도 없어 신규 외부 의존성이 없으며, 유일하게 바뀐 import 1건도 기존 내부 모듈에서 미사용 타입을 제거한 것으로 의존 관계 자체는 그대로다. 의존성 관점에서는 새 패키지·버전 변경·라이선스·취약점·번들 크기·호환성·내부 의존 그래프 어느 항목도 영향받지 않는다.

## 위험도
NONE
