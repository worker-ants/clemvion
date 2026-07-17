# 유지보수성(Maintainability) 리뷰

## 대상
- `codebase/frontend/eslint.config.mjs` — `src/lib/**` 파일이 `@/components/**` 를 import 하지 못하도록 `no-restricted-imports` 규칙을 추가하는 신규 `files`-scoped 블록.

## 검증 사실
- `src/lib/conversation/rag-types.ts` 에 이미 "lib → components 레이어 역전 금지" 결정 배경이 문서화되어 있음을 확인 (해당 파일의 주석). 이번 커밋은 그 결정을 lint 규칙으로 자동화한 것.
- `npx eslint src/lib` 실행 결과 신규 규칙으로 인한 신규 오류 없음(기존 무관 warning 2건만 존재) — 규칙 도입이 기존 코드를 깨지 않음을 확인.
- 임시 fixture 로 alias(`@/components/foo`)·상대경로(`../components/bar`, 2단계 및 3단계 깊이의 `../../components`, `../../../components`) 양쪽 import 형태가 모두 정확히 차단됨을 실측 확인.
- `codebase/backend/eslint.config.mjs` 를 대조군으로 확인한 결과, "`files: [...]` 로 스코프를 좁히고 규칙 옆에 배경 설명 주석을 붙이는" 패턴이 이미 backend 쪽에 확립되어 있음(예: `no-console` override, `unicorn/catch-error-name` 도입 주석 등). 본 변경은 그 컨벤션을 그대로 따름.

## 발견사항

- **[INFO]** 배경 주석이 구체적 파일 경로를 하드코딩
  - 위치: `codebase/frontend/eslint.config.mjs:37-38` (`// 배경 주석: src/lib/conversation/rag-types.ts · src/components/editor/run-results/conversation-utils.ts`)
  - 상세: 규칙 자체의 동작(`files`/`patterns`)과 무관하게, 예시로 언급된 두 파일 경로가 향후 리네임·이동되면 주석이 가리키는 대상이 사라져 stale 참조가 될 수 있음. 다만 규칙의 강제력 자체(`no-restricted-imports`)는 파일 경로와 독립적이라 기능에는 영향 없음.
  - 제안: 크게 문제되는 수준은 아니나, 배경 설명을 별도 spec/conventions 문서(레이어링 규칙)로 옮기고 여기서는 그 문서를 링크하는 방식이면 파일 이동에 더 강건함. 현재도 backend eslint.config.mjs 의 인라인 주석 관행과 일관되므로 필수 수정은 아님.

- **[INFO]** 상대경로 매칭 글롭 패턴(`**/../components`, `**/../components/**`)이 다소 비직관적
  - 위치: `codebase/frontend/eslint.config.mjs:49-52`
  - 상세: minimatch 세그먼트 매칭에 익숙하지 않은 독자에게는 "왜 `..`/`components` 두 세그먼트 조합으로 임의 깊이의 상대경로를 잡는지"가 즉각적으로 이해되지 않을 수 있음. 실측으로는 2~3단계 깊이 모두 정상 차단됨을 확인했고, 옆에 "alias 를 우회한 상대경로 형태" 주석이 이미 붙어 있어 의도 파악은 가능함.
  - 제안: 필수 아님. 원한다면 주석에 "임의 깊이의 `../`, `../../` 등을 모두 포괄" 한 줄만 추가하면 다음에 규칙을 수정할 사람의 이해 비용이 더 줄어듦.

- **[INFO]** 정적 import 외 동적 `import()` 는 이 규칙으로 커버되지 않음
  - 위치: `codebase/frontend/eslint.config.mjs:41-58` (규칙 정의 전반)
  - 상세: ESLint 기본 `no-restricted-imports` 는 `ImportDeclaration`/`export ... from` 형태를 대상으로 하며, 런타임 `import("@/components/...")` 동적 호출까지는 차단하지 않음(별도 옵션·플러그인 필요). 현재 `src/lib/**` 에 동적 import 사용 사례가 없어 실질적 리스크는 낮으나, 향후 코드 스플리팅 목적으로 lib 쪽에서 동적 import 를 쓰게 되면 이 가드가 우회될 수 있음.
  - 제안: 당장 조치 불필요. 필요 시 후속 규칙 확장 대상으로만 메모.

## 요약
신규 코드가 아니라 `eslint.config.mjs` 에 `src/lib/** → @/components/**` 레이어 역전을 차단하는 `files`-scoped `no-restricted-imports` 블록 하나를 추가하는 소규모 변경이다. 이미 코드 주석으로만 존재하던 아키텍처 결정("lib 은 components 를 참조하지 않는다")을 자동화된 CI 게이트로 승격시키는 성격이라 유지보수성 관점에서는 순수하게 개선 방향이며, 함수 길이·중첩·매직넘버·중복·복잡도 등 통상적 우려 항목은 애초에 해당하지 않는(설정 선언) 변경이다. backend `eslint.config.mjs` 에 이미 확립된 "files 스코프 + 배경 설명 주석" 패턴과도 일관되고, alias·상대경로 양쪽 import 형태를 정확히 차단함을 실측으로 확인했다. 지적된 항목은 모두 INFO 수준(주석 staleness 가능성, 글롭 가독성, 동적 import 미커버)으로 즉시 수정을 요하지 않는다.

## 위험도
NONE

STATUS: success
