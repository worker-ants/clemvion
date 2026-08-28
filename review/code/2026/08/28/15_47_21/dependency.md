# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** `@eslint/eslintrc` devDependency 제거 — 사용처 0건 확인, 정당한 정리
  - 위치: `codebase/backend/package.json:49` (구 라인, 삭제됨 — diff 게이트 기준 삭제 전 위치는 94번 항목 바로 아래 `"@eslint/eslintrc": "^3.3.6",`)
  - 상세: `codebase/backend/package.json` devDependencies 에서 `@eslint/eslintrc: ^3.3.6` 선언 한 줄만 삭제됐다. `codebase/backend` 트리 전체에 `@eslint/eslintrc` / `FlatCompat` import, `.eslintrc*` 파일이 0건임을 직접 grep 으로 재확인했다(빈 결과). eslint 10 은 `@eslint/js` 만 요구하고 `@eslint/eslintrc` 를 더 이상 번들하지 않으므로, 이 선언은 eslint 9→10 상향(이전 커밋) 이후 아무도 참조하지 않는 죽은 devDependency로 남아 있었다. `pnpm-lock.yaml` importers 섹션에서도 해당 항목이 대칭 제거됐고, snapshot 섹션에서는 `@jest/core@30.4.2` 계열의 peer 해소 표기(파라미터 없는 버전 → `(ts-node@10.9.2(...))` 파라미터 부착)가 부수적으로 바뀌었는데, 이는 pnpm 이 dedup 후보 하나(`@eslint/eslintrc` 경유로 별도 존재하던 무파라미터 `@jest/core`)를 잃고 남은 단일 해소로 수렴한 것으로, 기능적 차이는 없다.
  - 제안: 조치 불필요. plan(`plan/in-progress/deps-peer-gating-and-eslint10.md`)에 근거(grep 전수, node_modules 확인, lint 통과)가 이미 기록돼 있고 독립 검증도 일치한다. dependabot 이 이 죽은 패키지에 대해 반복 생성하던 bump PR(`#1184` 부류)이 사라지는 부수 이익도 있다.

- **[INFO]** 워크스페이스 간 eslint 메이저 버전 분리(backend/packages=10, frontend/channel-web-chat=9)는 이번 diff 범위 밖이지만 함께 인지할 사항
  - 위치: `codebase/backend/package.json:116` (`"eslint": "^10.9.1"`) — frontend 쪽은 이번 diff 대상 파일에 없음(별도 커밋에서 처리된 것으로 plan 문서가 명시)
  - 상세: plan 문서에 따르면 `eslint-config-next` 의존 스택(`eslint-plugin-react`/`jsx-a11y`/`import`)이 아직 eslint 10 을 지원하지 않아 frontend/channel-web-chat 은 eslint 9 에 머문다. 이번 diff 자체는 이 분리를 만들지 않고(이미 이전 커밋에서 확정) 그 뒤처리(`@eslint/eslintrc` 죽은 선언 제거)만 수행한다. 두 메이저가 워크스페이스별로 공존하는 상태가 유지보수 축을 늘리므로, 해제 조건(§2 실측 표)을 사람이 재확인해야 한다는 점만 기록해 둔다.
  - 제안: 조치 불필요 — 이미 plan 에 해제 조건과 근거가 명문화돼 있고, 이번 PR 의 스코프는 아니다.

- **[INFO]** 이번 diff 는 신규 외부 패키지를 추가하지 않는다
  - 위치: `codebase/backend/package.json` 전체 diff — 변경 라인은 삭제 1줄뿐
  - 상세: 확인한 5개 파일(`codebase/backend/package.json`, 2개 `*.spec.ts` 테스트 파일, plan md, `pnpm-lock.yaml`) 중 실제 의존성 매니페스트 변경은 devDependency 삭제 1건이 전부다. `expression-resolver.service.spec.ts`/`code.handler.spec.ts` 추가 테스트는 `cause: err` 계약을 잠그는 순수 테스트 코드로, 새 라이브러리 import 가 없다(기존 서비스 클래스 재사용).
  - 제안: 없음.

## 요약

이번 변경은 의존성 관점에서 순수한 축소(cleanup) 커밋이다. backend 의 `@eslint/eslintrc` devDependency 는 eslint 10 상향 이후 참조가 전무한 죽은 선언이었고, 이를 제거한 근거(grep 전수, `node_modules/@eslint/` 확인, lint 통과)가 plan 문서에 남아 있으며 독립 재확인 결과도 일치한다. 신규 외부 패키지 추가, 버전 고정 정책 변경, 라이선스 이슈, 알려진 취약점 유입은 없다. `pnpm-lock.yaml` 의 나머지 diff(`@jest/core`/`jest-config` 해소 표기 변화)는 dedup 부산물로 기능적 영향이 없다. 두 spec.ts 파일 변경은 테스트 전용이며 의존성 표면에 영향이 없다.

## 위험도

NONE
