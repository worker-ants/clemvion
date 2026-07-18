# 신규 식별자 충돌 검토 — `spec/conventions/frontend-layering.md` (impl-done)

## 검토 범위 확인

diff-base `29aa918a653a0efb5f792dc7e105c0887f03ef25` 대비 실제 변경분:

- `spec/conventions/frontend-layering.md` — frontmatter `status: partial → implemented`, `pending_plans` 제거, §4 CI 강제 범위 서술 갱신(`files: ["src/lib/**"]` → `LOWER_LAYERS = ["src/lib/**", "src/types/**"]`), §4.1 서술 갱신. §1 계층 표(`src/types/**` 최하위 계층 선언)는 diff-base 시점에 이미 존재 — 이번 diff 의 신규 도입이 아니다.
- `codebase/frontend/eslint.config.mjs` — 신규 export `LOWER_LAYERS`, 신규 module-local const `LAYERS_LABEL`/`RESOLUTION_HINT`/`STATIC_IMPORT_MSG`(+ 기존 `DYNAMIC_IMPORT_MSG`/`REQUIRE_MSG` 리팩터), `files: ["src/lib/**"] → LOWER_LAYERS`.
- `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts` — `CONFIG_LOWER_LAYERS`(import alias), `GUARD_BLOCK_KEY`, `EXPECTED_LOWER_LAYERS` 등 테스트 로컬 식별자 신규.
- `plan/in-progress/spec-draft-frontend-layering.md` → `plan/complete/spec-draft-frontend-layering.md` (rename, 완료 처리).
- `conversation-utils.ts`/`rag-types.ts` — 주석 텍스트만 변경(spec 링크 추가), 식별자 변경 없음.

이번 target 이 새로 도입하는 식별자는 요구사항 ID 신설이 아니라 **①  JS export/const 이름(`LOWER_LAYERS` 등)**과 **② 이미 spec 에 선언돼 있던 `src/types/**` 를 CI 스코프에 실장** 두 축뿐이다. 아래는 각 축을 기존 사용처와 대조한 결과.

## 점검 결과

### 1. 요구사항 ID 충돌
신규 ID 없음. `id: frontend-layering` 은 diff-base 에도 존재하던 기존 ID이며 이번 변경은 `status` 값만 전이(`partial → implemented`)한다. `git -C <worktree> grep -rn "^id: frontend-layering" spec/` → 해당 파일 1건만 매치, 중복 ID 없음.

### 2. 엔티티/타입명 충돌
신규 export `LOWER_LAYERS`(`codebase/frontend/eslint.config.mjs:23`)와 파생 상수(`LAYERS_LABEL`, `RESOLUTION_HINT`, `STATIC_IMPORT_MSG`), 테스트측 `CONFIG_LOWER_LAYERS`/`GUARD_BLOCK_KEY`/`EXPECTED_LOWER_LAYERS` 를 `codebase/` 전역(`frontend`·`backend`·`channel-web-chat`·`packages`) 대상으로 grep — 위 파일 2개(정의부 `eslint.config.mjs` + 소비부 `eslint-layering-guard.test.ts`) 밖에서는 어디에도 등장하지 않는다. `backend/eslint.config.mjs`·`channel-web-chat/eslint.config.mjs` 에도 동명 export 없음. 유일한 외부 소비처(`eslint-layering-guard.test.ts`)는 이미 `LOWER_LAYERS as CONFIG_LOWER_LAYERS` 로 alias import 해 자기 스코프의 지역 상수(`EXPECTED_LOWER_LAYERS` 등)와 이름이 겹치지 않도록 방어하고 있다. 충돌 없음.

### 3. API endpoint 충돌
해당 없음 — 이번 변경에 신규 endpoint 없음.

### 4. 이벤트/메시지명 충돌
해당 없음 — webhook·queue·sse 이벤트 신설 없음. (`STATIC_IMPORT_MSG` 등은 ESLint 룰 메시지 문자열이지 이벤트명이 아니며, 다른 룰 메시지와 이름 공유 스코프가 없다.)

### 5. 환경변수·설정키 충돌
해당 없음 — 신규 ENV var·config key 없음. `LOWER_LAYERS` 는 JS 모듈 내부 상수이며 `.env`/config 키 네임스페이스와 무관.

### 6. 파일 경로 충돌
- `spec/conventions/frontend-layering.md` 경로 자체는 변경 없음(기존 파일의 frontmatter/본문 갱신).
- `src/types/**` 를 CI 스코프에 추가하는 것은 **새 디렉터리 신설이 아니라** 기존에 존재하던 `codebase/frontend/src/types/transform.ts` 를 가드 대상에 포함시키는 것뿐이다(`ls codebase/frontend/src/types/` 로 확인 — diff-base 시점에도 이미 존재). 신규 경로 충돌 없음.
- `plan/in-progress/spec-draft-frontend-layering.md` → `plan/complete/spec-draft-frontend-layering.md` 이동은 `plan/complete/` 에 동명 파일이 이미 있는지 확인(`find plan/complete -iname "*frontend-layering*"`) — 결과 1건(이동된 파일 자체)뿐, 중복 없음.

### 부가 확인 — "레이어" 용어 다의성 (target 문서 자체가 이미 방어)
`frontend-layering.md` 의 "레이어" 는 `0-overview.md` 의 Data Layer, `execution-context.md` 의 3계층 등과 동명이의어일 수 있는 잠재 혼선이나, 이는 diff-base 이전부터 문서 §Overview 에 명시적 disclaimer(`> 본 문서의 "레이어" 는 frontend 디렉터리 의존 방향(§1)만을 가리킨다 — ... 타 문서의 동명 용어와 무관하다.`)로 이미 방어돼 있고 이번 diff 가 건드린 범위가 아니다. 신규 충돌 아님.

## 요약
이번 target(`spec/conventions/frontend-layering.md` status 승격 + 관련 impl)이 새로 도입하는 식별자는 JS 모듈 로컬 export/const(`LOWER_LAYERS` 계열)와 spec frontmatter 상태값 전이뿐이며, 둘 다 codebase 전역 grep 기준으로 기존 사용처와 이름이 겹치지 않는다. `src/types/**` CI 스코프 편입도 신규 디렉터리가 아니라 기존 디렉터리를 가드 대상에 추가한 것이라 경로 충돌이 없고, plan 파일의 in-progress→complete 이동도 목적지 중복이 없다. 신규 식별자 충돌 관점에서 문제 없음.

## 위험도
NONE
