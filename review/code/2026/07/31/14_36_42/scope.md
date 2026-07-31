# 변경 범위(Scope) 리뷰 — dep-hygiene (tailwind lockstep + next>postcss floor sync)

## 발견사항

- **[INFO]** `pnpm-lock.yaml` 에 의도한 2건(tailwindcss, next>postcss/postcss) 외에 jest/ts-jest/ts-node/eslint-import-resolver-typescript 관련 peer-dependency 조합(resolution key) 재계산이 광범위하게 나타남
  - 위치: `pnpm-lock.yaml:625, 652, 683, 710, 737, 767, 770, 800, 806, 15342, 15362, 15389, 15404, 15410, 16652-16710, 17020-17038, 20459-20505, 20530` 등 다수
  - 상세: 여러 importer(backend, codebase/packages/* 6곳)에서 `jest@30.4.2(@types/node@...)( ts-node@...)` 형태의 peer-parameterized 이름이 `jest@30.4.2`(bare) 로 단순화되거나 반대로 분리되고, `eslint-import-resolver-typescript@3.10.1(eslint-plugin-import@2.32.0)(...)` 의 peer 표기가 확장되는 등 표면적으로 tailwind/postcss 와 무관한 패키지들의 항목이 다수 바뀐다. 직접 대조한 결과 실제 semver(`jest 30.4.2`, `ts-jest 29.4.11`, `eslint-import-resolver-typescript 3.10.1` 등)는 전부 동일하고, 바뀐 것은 pnpm 이 내부적으로 붙이는 peer-dependency 조합 표기뿐이다 — `specifier:` 필드가 바뀐 곳은 plan 문서가 명시한 대로 `postcss`(`pnpm-lock.yaml:497`) 와 `tailwindcss`(`pnpm-lock.yaml:539`) 2건뿐임을 diff 전체에서 확인했다. 즉 workspace-global override(`next>postcss`) 변경이 pnpm 의 전역 peer 재해소를 트리거해 발생한 기계적 부산물로 보이며, plan 문서 "실측 검증" 절에서도 이를 명시적으로 disclose 하고 있다(`pnpm install --frozen-lockfile` 통과 확인 포함).
  - 제안: 조치 불요 — lockfile 재계산 부산물을 수작업으로 되돌리면 오히려 `--frozen-lockfile` 정합성이 깨진다. 다만 PR 설명에 "lockfile 변경 대부분은 pnpm 재계산 부산물" 이라는 plan 문서의 문구를 그대로 인용해 두면 리뷰어가 광범위한 lockfile diff 를 보고 오인하는 것을 예방할 수 있다(이미 plan 문서 §실측 검증에 기재돼 있어 추가 조치는 선택 사항).

## 요약

`codebase/frontend/package.json`(`tailwindcss` `^4.2.2`→`^4.3.3`), `pnpm-workspace.yaml`(`next>postcss` 오버라이드 `^8.5.14`→`^8.5.18`), `scripts/check-pnpm-security-config.py`(동일 `EXPECTED_OVERRIDES` 값, PROJECT.md 가 강제하는 2-place 동기화 규약 준수)는 신규 plan 문서(`plan/in-progress/dep-hygiene-tailwind-postcss.md`)가 서술한 2가지 의도(①tailwind lockstep 스큐 해소, ②postcss 오버라이드 하한을 직접 의존 하한과 동기화)와 각각 1줄 단위로 정확히 일치하며, 값 변경 외의 재정렬·주석 수정·포맷팅 변경은 없다. `pnpm-lock.yaml` 은 두 manifest 값 변경의 필연적 재생성 결과로, `specifier:` 레벨 변경은 plan 문서가 명시한 딱 2건(postcss, tailwindcss)뿐이고 나머지는 jest/ts-jest 계열의 peer-dependency 표기 재해시(byproduct)로 확인된다 — 애플리케이션 코드·기능·설정에 대한 추가 수정, 관련 없는 리팩토링, import 정리, 기능 확장은 전혀 발견되지 않았다. plan 문서 자체도 "2-1. 범위 밖 — 명시" 절에서 잔여 `pnpm audit` 17건을 별도 PR 로 명시적으로 이연시켜 스코프 경계를 스스로 선언하는 등 범위 관리가 모범적이다.

## 위험도

LOW
