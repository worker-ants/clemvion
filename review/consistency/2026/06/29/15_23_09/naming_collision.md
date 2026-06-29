## 발견사항

충돌로 판정되는 항목이 없었다. 아래는 각 관점별 점검 결과다.

### 1. 요구사항 ID 충돌

target 의 `id: user-guide-evidence` 는 `spec/conventions/user-guide-evidence.md` 단 하나에만 존재한다. 다른 conventions spec ID 목록(`i18n-userguide`, `spec-impl-evidence`, `chat-channel-adapter`, `interaction-type-registry`, `data-hydration-surfaces`, `node-output`, `error-codes` 등)과 겹치지 않는다.

### 2. 엔티티/타입명 충돌

- `ImplAnchor` — spec 전체에서 `/spec/conventions/user-guide-evidence.md`, `/spec/conventions/i18n-userguide.md §Principle 7`, `/spec/2-navigation/13-user-guide.md` 세 곳에서 참조되는데, 세 곳 모두 동일 컴포넌트를 가리킨다. 다른 의미로 쓰이는 곳 없음.
- `kind` prop — target 이 도입하는 `kind` 는 `<ImplAnchor>` JSX prop 이다. spec 전반에서 `ModelConfig(kind=chat|embedding|rerank)`, `kind='explore'` 등 다양한 `kind` 식별자가 존재하나, 이들은 전혀 다른 도메인(ModelConfig 타입 판별 / AI assistant 도구 속성)의 별개 필드다. JSX prop 네임스페이스와 Prisma/TS 타입 네임스페이스는 분리되어 있어 런타임 또는 spec 의미 상 충돌 없음.
- `describes` prop — 다른 spec 파일이나 기존 엔티티에서 같은 이름의 prop/필드로 다른 의미로 쓰이는 사례를 발견하지 못했다.

### 3. API endpoint 충돌

target 은 새 API endpoint 를 도입하지 않는다. `kind="api-endpoint"` 는 기존 controller route 를 *참조*하는 anchor prop 값일 뿐 신규 endpoint 정의가 아니다.

### 4. 이벤트/메시지명 충돌

target 이 새로 도입하는 이벤트·큐·SSE 이름 없음. 해당 없음.

### 5. 환경변수·설정키 충돌

target 이 새로 도입하는 ENV var 또는 config key 없음.

### 6. 파일 경로 충돌

- `spec/conventions/user-guide-evidence.md` — 이미 존재하는 파일이자 target 자체다(신규 생성이 아닌 기존 파일 검토). 동명 파일이 다른 경로에 없다.
- `codebase/frontend/src/components/docs/mdx/impl-anchor.tsx` — 디렉토리를 확인한 결과 실제로 존재한다. 명명 충돌이 아니라 target 이 이 파일을 implementation 경로로 선언한 것이며, 파일이 실존하므로 정합하다.
- `codebase/frontend/src/lib/docs/__tests__/impl-anchor-existence.test.ts`, `integrations-coverage.test.ts`, `triggers-coverage.test.ts`, `impl-anchor-parse.ts` — 동 디렉토리를 확인한 결과 모두 실존한다. 기존 가드 파일명(`registry.test.ts`, `nodes-coverage.test.ts`, `spec-code-paths.test.ts` 등)과 겹치지 않는다.
- `codebase/frontend/src/lib/conversation/__tests__/hydration-coverage.test.ts` (기존)와 `integrations-coverage.test.ts`/`triggers-coverage.test.ts` (target 선언) — 네이밍 패턴(`<domain>-coverage.test.ts`)을 공유하지만 디렉토리(`conversation/__tests__/` vs `docs/__tests__/`)가 다르고 도메인 prefix 도 다르다. 충돌 없음.

## 요약

target `spec/conventions/user-guide-evidence.md` 가 도입하는 식별자(`id: user-guide-evidence`, `ImplAnchor` 컴포넌트, `kind` enum 4값, `describes` prop, 가드 파일 3건)는 기존 spec·코드 코퍼스 내에서 다른 의미로 사용 중인 선례가 없다. `kind` 라는 단어는 ModelConfig/AI assistant 도메인에서도 쓰이나 네임스페이스가 완전히 분리되어 있어 혼동 가능성이 없다. 파일 경로 모두 이미 실존하며 기존 가드 파일명과 충돌하지 않는다. 식별자 충돌 관점의 위험 요소를 발견하지 못했다.

## 위험도

NONE
