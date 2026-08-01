# 변경 범위(Scope) 리뷰

## 검토 대상 및 방법

`git diff --stat 06c2651c9 39c8a9875` 로 실제 커밋 diff(15개 파일, +801/-443)를 프롬프트 페이로드와 대조했고, 프롬프트에서 잘린 두 파일(`typescript-toolchain.test.ts` 전체, `pnpm-lock.yaml` 전체)은 `Read`/`git diff`로 직접 열어 확인했다. 선언된 작업 범위는 `plan/in-progress/typescript-7-rollback.md`: "dependabot #1047 이 typescript 를 7.0.2 로 올려 Jenkins main 빌드가 backend·frontend 둘 다 실패 → 5.x 롤백 + major bump 재발 방지".

## 발견사항

- **[INFO]** `pnpm-lock.yaml` 재생성 과정에서 typescript 와 무관한 `eslint-plugin-import` peer 해석 키(resolution key) 표기가 바뀌었다
  - 위치: `pnpm-lock.yaml:16019` (및 16039, 16076 — 동일 패턴 반복)
  - 상세: `eslint-plugin-import: 2.32.0(eslint-import-resolver-typescript@3.10.1)(eslint@9.39.4(jiti@2.7.0))` → `2.32.0(eslint-import-resolver-typescript@3.10.1(eslint-plugin-import@2.32.0(eslint@9.39.4(jiti@2.7.0)))(eslint@9.39.4(jiti@2.7.0)))(eslint@9.39.4(jiti@2.7.0))`. 실제 패키지 버전(2.32.0)은 그대로이고 peer 그래프 표기만 더 깊게 펼쳐졌다. `git diff`로 lockfile 전체를 typescript 문자열 유무로 필터링해 대조한 결과, 이 항목과 `@nestjs/schematics@11.1.0(...)` 중복 리졸브 정리(typescript@7.0.2 키 소멸에 따른 자연스러운 dedup) 외에는 typescript 버전 변경(및 그에 종속된 `@typescript/typescript-*` 네이티브 바이너리 optionalDependencies 제거)으로 전부 설명된다. `pnpm install` 이 전체 의존성 그래프를 재계산하며 나타나는 잘 알려진 부작용이지, 수작업 편집이 아니다.
  - 제안: 액션 불필요. 리뷰어가 "무관한 패키지명이 diff에 등장" 사실만 보고 스코프 이탈로 오판하지 않도록 기록만 남긴다.

- **[INFO]** 회귀 가드 신설(2개 신규 파일, +393줄)이 "롤백"보다 넓은 "재발 방지" 목적을 포함
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts`(176줄, 전체 신규) / `typescript-toolchain.test.ts`(217줄, 전체 신규)
  - 상세: 순수 버전 되돌리기라면 10개 `package.json` + `pnpm-lock.yaml` 로 끝나지만, 이번 변경은 워크스페이스 탐색·range 파싱·compiler API 검사 로직을 담은 신규 모듈과 20개 테스트 케이스를 추가했다. 다만 이는 `plan/in-progress/typescript-7-rollback.md` 제목 자체("...+ major bump 재발 방지")와 Overview·"조치"·"가드 설계" 절에서 착수 전부터 명시적으로 선언된 스코프이고, 기존 형제 파일 `internal-package-registration-guard.ts`/`internal-package-registration.test.ts` 의 명명·분리 규약을 그대로 따랐다(신규 로직 중복 없이 `ROOT`/`listAtPath`/`PackageManifest` 를 형제 모듈에서 import 로 재사용, 형제 파일 자체는 미수정). "요청 이상"으로 볼 근거(사후에 몰래 끼워 넣은 기능 확장)는 없다 — 사고 원인이 "이 major bump 를 잡아낼 게이트가 전무했다"는 것이므로 게이트 추가는 사고의 직접 대응이다.
  - 제안: 액션 불필요. 향후 유사 리뷰에서 "P0 롤백 PR 치고 diff 가 크다"는 표면적 인상만으로 스코프 위반 판정을 내리지 않도록 근거를 남긴다.

이 외에 검토한 항목 중 이슈 없음을 확인한 것들:
- 10개 `package.json` 각각의 diff는 `"typescript": "^7..." → "^5..."` 단일 라인 변경뿐이며, 동일 파일 내 다른 dependency·script·설정 변경은 없다.
- `.github/dependabot.yml` 은 기존 3개 `package-ecosystem` 블록 중 세 번째(루트 pnpm 워크스페이스)에만 `ignore:` 블록을 추가했고, 앞의 두 블록(github-actions, mermaid-lint npm)은 손대지 않았다. 추가된 24줄 주석은 파일에 이미 존재하는 다른 두 항목의 서술 분량(각 15~19줄)과 같은 스타일이라 이 파일의 기존 컨벤션에 부합한다.
- 신규 가드 파일의 import(`fs`/`path`/`createRequire`/`ROOT`/`listAtPath`/`PackageManifest`) 및 신규 테스트 파일의 import(가드가 export 하는 10개 심볼 전부) 모두 본문에서 실사용되며 미사용 import 없음.
- `plan/in-progress/typescript-7-rollback.md` 는 frontmatter(`worktree`/`spec_impact: none` 등) 가 규약을 따르고, `spec/` 변경이 전혀 없어 `spec_impact: none` 선언과 일치한다. `/consistency-check --impl-prep` 생략 사유도 문서에 명시돼 있다.
- `git diff --stat` 로 확인한 15개 변경 파일이 프롬프트에 나열된 15개와 정확히 일치 — 프롬프트에 없는 숨은 파일 변경 없음.

## 요약

전체 변경은 "TypeScript 7.0.2 → 5.x 롤백 + 재발 방지 가드"라는 선언된 단일 목적에 정확히 수렴한다. 10개 `package.json` 은 typescript 버전 한 줄만 되돌렸고, `pnpm-lock.yaml`(대형 diff)은 전량 그 버전 변경의 기계적 파생물임을 문자열 필터링으로 직접 검증했다. `dependabot.yml` 의 ignore 규칙과 신규 가드 2파일은 겉보기엔 "롤백" 그 이상이지만 plan 문서 제목·Overview 에서 처음부터 선언된 스코프이고, 기존 형제 가드 파일의 명명·분리·재사용 컨벤션을 그대로 따라 중복 로직을 만들지 않았다. 포맷팅-only 변경, 무관한 파일 수정, 미사용 import, 설정 파일의 의도치 않은 부수 변경은 발견되지 않았다.

## 위험도

NONE
