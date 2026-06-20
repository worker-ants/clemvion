# Dependency Review

## 발견사항

### 파일 1: codebase/backend/eslint.config.mjs

- **[INFO]** 새 의존성 없음 — ESLint 규칙 설정 변경(규칙 추가) 만이고 외부 패키지 추가 없음.
  - 위치: 전체 파일
  - 상세: `@typescript-eslint/no-unnecessary-type-assertion`는 이미 설치된 `typescript-eslint` 패키지가 제공하는 규칙이므로 추가 의존성 필요 없음.
  - 제안: 없음.

---

### 파일 2: codebase/backend/package.json

- **[INFO]** 새 외부 의존성 없음 — 변경 내용은 `lint` 스크립트를 `--fix` 없는 report-only 로 전환하고 `lint:fix` 를 별도로 분리한 것뿐.
  - 위치: `"scripts"` 섹션
  - 상세: 의존성(`dependencies`, `devDependencies`) 블록은 변경 없음. 기존 패키지 버전도 유지.
  - 제안: 없음.

- **[WARNING]** 기존 의존성 `jsonwebtoken` 이 `9.0.3` 으로 `^` 없이 정확히 고정되어 있음 (변경 diff 외의 기존 설정).
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/package.json` 라인 219
  - 상세: 다른 의존성들은 모두 `^` caret 범위로 지정하는데, `jsonwebtoken`만 정확한 버전(`9.0.3`)으로 고정되어 있다. git 이력(`d548a7ae`)에서 P0 보안 이유로 의도적으로 고정한 것으로 보이나, 이 버전의 이후 패치에서 보안 수정이 있을 경우 업데이트가 차단된다.
  - 제안: 의도적 고정이라면 inline 주석으로 근거를 명시할 것. 아니면 `"^9.0.3"` 으로 패치 허용 범위로 변경을 검토.

- **[INFO]** `@nestjs/swagger` 가 workspace 루트 `pnpm.overrides` 에서 `"11.2.7"` 로 정확히 고정 (딥 임포트 호환성 이유 명시).
  - 위치: `/Volumes/project/private/clemvion/package.json` `pnpm.overrides`
  - 상세: `swagger-pin` 주석에 이유가 기술되어 있어 의도적 고정임이 명확.
  - 제안: 없음.

---

### 파일 3: codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts

- **[WARNING]** `gray-matter` 가 `devDependencies` 가 아닌 `dependencies` (프로덕션 의존성)에 선언되어 있음.
  - 위치: `/Volumes/project/private/clemvion/codebase/frontend/package.json` `dependencies."gray-matter": "^4.0.3"`
  - 상세: 이 테스트 파일과 `codebase/frontend/src/lib/docs/registry.ts` 모두 `gray-matter` 를 사용한다. `registry.ts` 는 `node:fs` 기반으로 빌드 시 실행되는 Next.js 서버사이드 코드로 보이므로, 프로덕션 deps 에 둔 것이 완전히 틀리지는 않다. 그러나 Next.js CSR 앱(spec/7-channel-web-chat 의 스펙상 "임베드형 웹채팅 위젯 SPA — Next.js CSR") 기준에서는 `gray-matter` 의 번들 포함 여부를 재확인해야 한다. 클라이언트 번들에 포함되면 불필요한 용량 증가(gray-matter ~12 KB minified + js-yaml 전이 의존성 포함)를 유발할 수 있다.
  - 제안: `registry.ts` 의 사용이 빌드 시(getStaticProps/server-only)에만 국한된다면 그대로 `dependencies` 유지. 클라이언트 번들 포함 여부는 `next build --debug` 또는 번들 분석기로 확인 권장.

- **[INFO]** 테스트에서 사용하는 `gray-matter`, `node:fs`, `node:path` 는 기존 의존성이며 새로 추가된 것이 없음.
  - 위치: 파일 상단 import
  - 상세: `gray-matter` 는 이미 `codebase/frontend/package.json` 에 존재. `node:fs`, `node:path` 는 Node.js 빌트인.
  - 제안: 없음.

- **[INFO]** 테스트 sentinel 파일명 변경(`knowledge-base-quality-improvements.md` → `competitive-analysis-n8n-flowise.md`) 은 의존성 변경이 아님 — plan 파일 존재 확인용 상수 교체.
  - 위치: 파일 라인 301–302
  - 상세: 의존성 관점에서 영향 없음.
  - 제안: 없음.

---

### 파일 4: plan/complete/exec-single-node.md

- **[INFO]** plan 문서(Markdown). 의존성과 무관.
  - 상세: `spec_impact` 필드 포맷을 인라인 문자열에서 YAML 리스트로 변경한 것이며, 외부 패키지·라이브러리와 무관.
  - 제안: 없음.

---

## 요약

이번 변경 셋에서 새로운 외부 의존성은 추가되지 않았다. `backend/package.json` 변경은 lint 스크립트 분리뿐이며 의존성 블록은 손대지 않았다. 기존 의존성 중 `jsonwebtoken 9.0.3` 의 정확 버전 고정이 주의 사항이나, git 이력 상 의도적 보안 고정으로 판단되며 이번 PR 의 변경 범위 밖이다. frontend 에서 `gray-matter` 가 프로덕션 `dependencies` 로 선언된 것은 서버사이드 문서 레지스트리 코드에서 실제 사용되므로 구조적으로는 정당하나, Next.js 클라이언트 번들 포함 여부를 번들 분석으로 한 번 검증하는 것이 바람직하다. 전반적으로 의존성 관점의 신규 리스크는 없다.

## 위험도

LOW
