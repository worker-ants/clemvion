# 요구사항(Requirement) 리뷰

## 검증 방법

이 PR 은 사실상 ESLint 9→10 상향(backend + `packages/*` 8개) + 그로 인해 새로 활성화된
`no-useless-assignment`/`preserve-caught-error` recommended 룰 위반 15건 수정 +
`eslint-unicorn-peer-guard.ts` 의 `parseGteFloor` 파서 확장 + 문서/plan 동기화로 구성된다.
이미 같은 PR 안에서 `/ai-review` 2라운드(`11_45_02`, `12_28_11`)가 Critical 1건(PROJECT.md
카운트 불일치)·Warning 2건(force-split 테스트 부재, secret-resolver 테스트 부재)을 잡아 커밋
`0f3b3e0c3`/`9bcbb7fa5`/`3a540aa81`/`193f90f48` 로 해소했다. 본 라운드에서는 그 조치들이
실제로 올바른지, 그리고 "let x = 기본값" → "let x" 축소 15곳이 전부 진짜 안전한지(선언 후
모든 실행 경로에서 사용 전 재할당되는지)를 직접 소스를 열어 재추적했다.

## 발견사항

- **[INFO]** `cause` 보존 계약을 잠그는 런타임 단언 부재 — 이미 plan 에 등재된 잔여 항목, 신규 아님
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts:316` (`throw new Error(..., { cause: err })`), `codebase/backend/src/nodes/data/code/code.handler.ts:454` (동일 패턴)
  - 상세: 두 곳 모두 `preserve-caught-error` 대응으로 `cause: err` 를 새로 붙였는데, 대응 스펙 문서(`spec/4-nodes/5-data/2-code.md:369`)는 에러 메시지 문자열만 규정하고 `cause` 필드 존재 여부는 규정하지 않는다 — 메시지 문자열은 두 파일 모두 변경 전과 동일하므로 spec 위반은 아니다. 다만 "cause 가 원본 예외와 동일하다" 는 새 계약을 잠그는 테스트가 없어(기존 테스트는 `.message` 정규식만 확인) 향후 `cause: err` 가 실수로 지워져도 정적 검사·테스트 어느 쪽도 못 잡는다. `plan/in-progress/deps-peer-gating-and-eslint10.md:229` 에 이미 "(후속, INFO) cause 부착 판단 근거의 문서화 비대칭" 으로 등재돼 있고, 직전 라운드 RESOLUTION(`12_28_11`)이 "spec-linked 라 지금 고치면 `--impl-done` 이 무효화된다" 는 근거로 명시적으로 유예한 항목이다. 새로운 지적이 아니라 기존 유예 결정을 재확인.
  - 제안: 조치 불요(이미 tracked). 다음에 이 파일들을 편집할 기회에 `err.cause` 를 함께 단언하는 케이스 추가를 고려.

## 검증한 항목 (문제 없음)

- **`no-useless-assignment` 8개 파일 dead-initializer 제거** — 각 지점에서 catch 블록이 (a) 조기 `return`(execution-engine.service.ts:4918 `live`, public-webhook-throttle.guard.ts:67 `trigger`, kb-tool-provider.ts:239 `results`, ssrf-safe-url.util.ts:156 `addrs`) (b) 명시적 fallback 대입(form-mode.ts:289 `re = null`, web-chat-sdk/src/index.ts:63 `size` → throw, information-extractor.handler.ts:328 `recalled = []`) 중 하나이므로 TypeScript definite-assignment 가 안전함을 보장한다 — 직접 소스를 열어 전부 확인. 동작 변화 없음.
- **`text-chunker.ts` dead-store 제거(`overlapBuffer = getOverlapText(...)`)** — `forceSplitAndPush` 시그니처에 overlap 파라미터가 없고, 제거된 대입 두 줄 뒤 `overlapBuffer = ''` 가 무조건 실행돼 이전 값을 덮으므로 진짜 죽은 코드였다. 대응 회귀 테스트(`text-chunker.spec.ts`)를 직접 손으로 재추적해 force-split 진입 케이스와 `overlapBuffer=''` 리셋 관측 케이스(캐리오버 마커 `ARRYOVER` 불포함 단언) 양쪽 모두 실제로 판별 가능함을 확인했다 — 리셋을 지우면 마지막 청크가 `'ARRYOVER. TAILMARKER done.'` 이 돼 단언이 깨진다.
- **`knowledge-base.service.ts` dead-store 제거(`graphRequeued -= slice.length`)** — 해당 catch 블록은 무조건 `throw err`로 끝나 `graphRequeued` 반환값에 도달하지 않는다(`return { embeddingRequeued, graphRequeued }` 는 catch 밖). 보정 로직 삭제가 반환값에 영향을 주지 않음을 확인.
- **`ai-turn-executor.ts` `finalSystemPrompt` 재할당 2곳 제거** — `executeSingleTurn`(1525~1938행 범위) 과 `executeMultiTurn`(1939행~) 각 스코프에서 제거 지점 이후 그 지역 변수가 재참조되지 않음을 grep+수동 스코프 경계 확인으로 검증. `applySingleTurnMemoryInjection`/`injectThreadContext` 가 반환하는 (주입된) system prompt 는 `messages` 배열에만 반영되고 별도 지역 변수로 되받지 않는 설계 변경이며, 하위 로직은 전부 `messages` 만 소비한다.
- **`preserve-caught-error` 대응 `cause: err` 추가 2곳** — `expression-resolver.service.ts`/`code.handler.ts` 모두 노출 메시지 문자열이 spec(`spec/4-nodes/5-data/2-code.md:369`)과 일치하며 변경 전후 동일. `secret-resolver.service.ts` 만 의도적으로 `preserve-caught-error` 를 disable 유지 — `spec/conventions/secret-store.md:220`(SS-SE-05: ref+workspaceId 만 로그, plaintext 미기록)과 `#814` 선례(서버 로그 노출을 안전하다고 오판했던 사고)에 근거해 crypto 에러 상세가 Activity API 로 새는 것을 막는 의도적 예외이고, spec 과 모순되지 않는다.
- **`eslint-unicorn-peer-guard.ts` `parseGteFloor` 확장** — `>=X`/`>=X.Y`/`>=X.Y.Z` 정규식이 실제 설치본(`eslint-plugin-unicorn@73`)의 `peerDependencies.eslint === ">=10.4"` 를 정확히 `[10,4,0]` 으로 해석함을 `node_modules` 실물 대조로 직접 확인했다. 복합 range(`'>=9.18.0 <10.0.0'`)·무효 표기(`'>='`, `'>=x'`)는 여전히 null 을 반환해 fail-closed 계약이 유지됨을 정규식 anchor(`$`) 분석으로 확인.
- **`PROJECT.md`/`.github/dependabot.yml`/`codebase/backend/eslint.config.mjs` 3-way 정합** — "dependabot ignore 1건"(PROJECT.md) ↔ 실제 `.github/dependabot.yml` 의 `ignore:` 항목 수(`typescript` 1건) ↔ `eslint.config.mjs` 의 registry 실측 표(`66+=>=10.4`, 66·70·73 모두 동일)가 서로 어긋나지 않음을 직접 열어 대조. `--strict-peer-dependencies` 가 `.github/actions/pnpm-workspace/action.yml` 에 실재함(주장이 아니라 실측)도 확인. frontend/channel-web-chat 이 `eslint: "^9"` 로 남아 있음도 `package.json` 직접 확인으로 검증.
- **`plan/in-progress/deps-peer-gating-and-eslint10.md` 체크리스트** — §2(eslint 10 상향 9/11), §3(frozen 게이트 사각지대, `typeorm→ioredis` 미판정) 등 미완료 항목은 전부 근거와 함께 명시적으로 후속 백로그로 분리돼 있고 이번 PR 의 스코프 밖임이 문서 자체에서 확인된다. TODO/FIXME/HACK/XXX 형태의 미완성 표식은 diff 전체에서 0건.

## 요약

핵심 로직 변경은 `parseGteFloor` 파서 확장 하나뿐이고 나머지는 ESLint 9→10 상향에 따른 기계적 lint 대응(dead-initializer 제거, `cause` 체이닝 추가)과 문서/plan 동기화다. 두 차례 선행 `/ai-review` 라운드가 Critical(PROJECT.md 카운트 드리프트)과 테스트 커버리지 갭(force-split 분기, secret 복호화 실패 분기)을 실제로 잡아 뮤테이션 실측까지 거쳐 해소했음을 본 라운드에서 소스 레벨로 재확인했다 — 특히 `text-chunker.spec.ts` 의 2번째 테스트는 `overlapBuffer=''` 리셋을 제거하면 실제로 RED 가 되는 판별 가능한(discriminating) fixture 임을 직접 손으로 트레이스해 검증했다. `let x = 기본값` → `let x` 로 바뀐 8개 파일은 전부 catch 블록이 조기 반환하거나 명시적으로 재할당하므로 정의역 흐름상 안전하며 SSRF·webhook 인증·execution 종결 등 보안/정합성에 민감한 지점을 포함해도 동작 변화가 없다. `preserve-caught-error` 예외 처리(secret-resolver)는 SS-SE-05 spec 및 `#814` 선례와 정합한다. 남은 유일한 관찰(cause 보존 계약의 런타임 미검증)은 이미 plan 문서에 근거와 함께 등재된 기존 유예 항목이라 새로 지적할 성격이 아니다. 요구사항 충족 관점에서 병합을 막을 이유가 없다.

## 위험도
NONE
