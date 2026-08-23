# 신규 식별자 충돌 검토 — spec/5-system/14-external-interaction-api.md (--impl-done)

## 사전 확인

`git diff origin/main...HEAD` 로 실제 변경 파일을 직접 확인했다(번들의 `<git diff origin/main...HEAD -- code_areas>`
섹션은 컨텍스트 예산 초과로 절단되어 있었다). 이번 라운드의 실 변경 코드/스펙 범위:

- `spec/5-system/14-external-interaction-api.md` — §R17 Rationale 절 내 문구 교체(기존 "미구현·잔여" 서술을
  "해소, 단 `getStatus` 한 출구 한정"으로 갱신). **신규 requirement ID·신규 섹션 헤더 없음.**
- `codebase/backend/src/shared/utils/node-output-allowlist.ts` (신규 파일) — `NODE_OUTPUT_ALLOWED_KEYS`,
  `allowlistNodeOutputKeys()`, `PublicHandlerOutputKey`(파일-로컬 타입), `assertAllowlistCoversHandlerContract`(파일-로컬)
- `codebase/backend/src/modules/external-interaction/interaction.service.ts` — 위 함수를 import 해 `getStatus` 의
  waiting `nodeOutput` 조립부에 적용
- `CHANGELOG.md`, `plan/complete/nodeoutput-allowlist.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`

직전 라운드(`18_30_40`, --impl-prep)는 "allowlist 명명이 아직 확정되지 않았다"며 후속 재검토를 명시적으로
요구했다 — 본 라운드가 그 재검토이며, 위 신규 식별자 4종을 대상으로 전수 검사했다.

## 점검 결과

### 1. 요구사항 ID 충돌
이번 diff 는 신규 `EIA-*` ID 를 부여하지 않는다(§R17 은 기존 Rationale 항목이며 번호가 바뀌지 않았다). `EIA-NX-*`
/ `EIA-IN-*` / `EIA-AU-*` / `EIA-RL-*` / `EIA-NF-*` 계열은 이전 라운드에서 이미 전수 grep 되어 충돌 없음이
확인됐고, 이번 diff 가 그 목록에 아무것도 추가하지 않으므로 재확인 결과도 동일. 충돌 없음.

### 2. 엔티티/타입명 충돌
신규 식별자 `allowlistNodeOutputKeys`, `NODE_OUTPUT_ALLOWED_KEYS`, `PublicHandlerOutputKey`,
`assertAllowlistCoversHandlerContract` 를 `codebase/**`·`spec/**`·`plan/**` 전수 grep:

- `allowlistNodeOutputKeys` — 정의(`node-output-allowlist.ts`)·테스트(`node-output-allowlist.spec.ts`)·소비처
  (`interaction.service.ts`)·spec 서술(`14-external-interaction-api.md` §R17)·plan 서술(`spec-sync-...-gaps.md`)
  전부 동일 함수를 동일 의미로 가리킨다. 다른 의미의 동명 식별자 없음.
- `NODE_OUTPUT_ALLOWED_KEYS` — 정의·테스트·JSDoc 참조만 존재, 타 의미 재사용 없음.
- `PublicHandlerOutputKey` / `assertAllowlistCoversHandlerContract` — 파일-로컬(export 안 됨) 타입/상수라 애초에
  모듈 간 충돌 표면이 없다. 동명 재사용도 없음.
- 파일명 `node-output-allowlist.ts` 는 `find codebase -iname "*node-output*"` 결과 기존
  `scripts/migrate-node-output-refs.ts`(표현식 참조 마이그레이션), `expression/node-output-schema-enrichers.ts`
  (프런트 표현식 스키마)와 이름이 겹치지 않고 의미도 다르다 — 접두어 공유(`node-output-`)일 뿐 충돌 아님.
- 자매 파일 `strip-external-only-fields.ts`(deny-list)와의 관계는 파일 헤더 주석이 "의도적 분리"로 이미
  설명하고 있어 명명 혼동 소지가 없다.

충돌 없음.

### 3. API endpoint 충돌
이번 diff 는 신규 REST endpoint 를 추가하지 않는다(기존 `GET /api/external/executions/:executionId` 의 내부
필드 필터링 로직만 변경). 충돌 대상 없음.

### 4. 이벤트/메시지명 충돌
신규 webhook/queue/SSE 이벤트명 추가 없음. `nodeOutput` 필드 자체는 기존 wire 계약(§5.2/§5.3)에서 이미 쓰이던
필드명이며 이번 변경은 그 필드에 최상위 key allowlist 를 얹는 내부 구현일 뿐, 필드명·이벤트명 신설이 아니다.
충돌 대상 없음.

### 5. 환경변수·설정키 충돌
신규 ENV var·config key 없음. `NODE_OUTPUT_ALLOWED_KEYS` 는 런타임 설정값이 아니라 컴파일타임에 고정된 TS
상수(`Object.freeze`)이며 config/env 네임스페이스와 무관. 충돌 대상 없음.

### 6. 파일 경로 충돌
`codebase/backend/src/shared/utils/node-output-allowlist.ts`(+`.spec.ts`) — 같은 디렉토리의 기존 8개 파일
(`bcrypt-format.ts`, `redact-stored-error.ts`, `retry-after.ts`, `sanitize-error-message.ts`,
`strip-external-only-fields.ts`, `terminal-duration.ts`, `terminal-error-payload.ts`)과 동일한 kebab-case
"동사/명사-목적" 명명 컨벤션을 따르며 기존 파일과 경로가 겹치지 않는다.
`plan/complete/nodeoutput-allowlist.md` 도 동일 이름의 기존 plan 파일 없음(`find plan -iname
"*nodeoutput-allowlist*"` 결과 1건, 자기 자신). 충돌 없음.

## 요약
이번 --impl-done 라운드에서 실제로 도입된 신규 식별자는 `allowlistNodeOutputKeys` / `NODE_OUTPUT_ALLOWED_KEYS` /
(파일-로컬) `PublicHandlerOutputKey` / `assertAllowlistCoversHandlerContract` 와 파일 경로
`shared/utils/node-output-allowlist.ts` 로 범위가 좁고, 요구사항 ID·API endpoint·이벤트명·환경변수는 신규
추가가 없다(§R17 은 기존 항목의 문구 갱신). 위 신규 식별자 전부를 `codebase/**`·`spec/**`·`plan/**` 전수
grep 한 결과 동일 이름이 다른 의미로 이미 쓰이는 사례를 찾지 못했으며, 명명은 자매 deny-list 파일·기존
디렉토리 컨벤션과도 일관된다. 신규 식별자 충돌 관점에서 이 변경은 안전하다.

## 위험도
NONE
