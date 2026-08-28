# 테스트(Testing) 리뷰 — eslint 9→10 상향 (3회차)

## 사전 확인 사항

이번 브랜치는 직전 두 라운드(`11_45_02`, `12_28_11`)의 testing 리뷰에서 지적된 WARNING 2건이
이미 코드로 반영된 상태다. 세 번째 리뷰어로서 그 두 픽스를 신뢰하지 않고 소스를 직접 열어
독립적으로 재검증했다.

## 검증한 항목 (문제 없음 — 직접 확인)

- **force-split `overlapBuffer` 리셋 회귀 테스트 (`text-chunker.spec.ts`)**: 2회차가 지적한
  vacuous 문제("force-split 진입" 테스트만으로는 `overlapBuffer = ''` 리셋 자체는 관측되지
  않음, 뮤테이션으로 원복해도 GREEN)에 대해 추가된 두 번째 케이스(`force-split 이 직전 문단의
  overlap 캐리오버를 끊는다`, 게이트 132~166줄)를 `codebase/backend/src/modules/knowledge-base/chunking/text-chunker.ts`
  의 실제 로직(52~106줄)과 직접 대조했다. fixture 구조(문단1 → force-split 대상 문장 →
  force-split 이후 tailSentence)가 `overlapBuffer` 를 실제로 **읽는 유일한 지점**(루프 종료 후
  `pushChunk(chunks, currentChunk, overlapBuffer, …)`)에 도달하도록 설계돼 있어, 리셋을
  지우면 `last.content` 가 `CARRYOVER_MARKER` 를 포함하게 되어 RED 로 갈린다는 주장이 코드
  흐름상 타당하다. `RESOLUTION.md`(`review/code/2026/08/28/12_28_11/RESOLUTION.md`)에 예측
  (RED/GREEN)과 실측을 나란히 적어 둔 것도 확인했다 — 신뢰할 만한 discriminating fixture다.
- **`SecretResolverService.resolve()` 복호화 실패 테스트 (`secret-resolver.service.spec.ts`
  게이트 199~231줄)**: `Buffer.alloc(12+4+16)`(전부 0)이 `secret-crypto.ts`의 envelope 포맷
  (`IV(12B)‖ciphertext‖tag(16B)`, `decryptSecret` 89~91줄의 `setAuthTag`)과 대조해 AES-GCM
  authTag 검증에서 결정적으로 실패함을 확인했다. `expect.assertions(3)`으로 catch 미진입(=테스트
  실패)을 강제하고, 메시지뿐 아니라 `err.cause === undefined`까지 단언해 "disable 주석이 지워지고
  `cause: err`가 추가되는" 보안 회귀(SS-SE-05)를 실제로 잡는다. vacuous 하지 않다.
- **`no-useless-assignment` 대응 8개 파일**(`ssrf-safe-url.util.ts`, `form-mode.ts`,
  `execution-engine.service.ts`, `public-webhook-throttle.guard.ts`, `kb-tool-provider.ts`,
  `information-extractor.handler.ts`, `web-chat-sdk/src/index.ts`, `code.handler.ts` 등)의
  `let x: T = <default>` → `let x: T`: 표본으로 `ssrf-safe-url.util.ts`(`addrs`),
  `kb-tool-provider.ts`(`results`), `information-extractor.handler.ts`(`recalled`)를 직접
  열어 catch 블록이 전부 조기 `return`(kb-tool-provider) 또는 재대입(`recalled = []`,
  `addrs = […]`)임을 확인 — TypeScript definite-assignment 가 컴파일 타임에 보증하므로 새 테스트
  없이도 회귀 위험이 낮다는 이전 라운드 판단에 동의한다.
- **`{ cause: err }` 추가 후 기존 회귀 테스트 유효성**: `expression-resolver.service.spec.ts`
  (121~129줄 부근)와 `code.handler.spec.ts`(195줄)를 직접 확인 — 둘 다 `.message` 정규식만
  단언하고 `cause`/부재를 단언하는 테스트가 없어, 이번 diff로 메시지 문자열이 바뀌지 않았으므로
  기존 테스트는 그대로 통과한다(회귀 없음, 8번째 관점 정합).
- **`eslint-unicorn-peer-guard.ts` / `eslint-unicorn-peer.spec.ts`**: 전체 파일을 열어 확인한
  결과 discriminating fixture 설계가 모범적이다 — `parseGteFloor`의 3가지 자릿수 형태
  (`>=X`/`>=X.Y`/`>=X.Y.Z`)와 진짜 무효 형태(`'>='`, `'>=x'`, 복합 range)를 나란히 검증하고,
  `satisfiesFloor([10,9,1], …)=true` vs `satisfiesFloor([10,0,0], …)=false` 짝 테스트로
  "major만 올리면 된다"는 오해를 차단한다. 설치본 실측(`readInstalledPackageJson`)과
  eslint CLI 서브프로세스 실측(`lintFixtureText`) 모두 하드코딩 없이 실제 `node_modules`를
  읽어 vacuity를 방지한다(주석에 그 근거가 실측과 함께 적혀 있고 코드와 일치함을 확인).

## 발견사항 (남은 잔여 — 모두 INFO, 등재·의도적 유예 확인)

- **[INFO]** `{ cause: err }` 신규 계약(원본 에러 보존)을 잠그는 런타임 테스트가 여전히 없다.
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts`
    diff 게이트 316~318줄, `codebase/backend/src/nodes/data/code/code.handler.ts` diff 게이트
    454줄. 대응 spec: `expression-resolver.service.spec.ts`, `code.handler.spec.ts` (둘 다
    `grep -n cause` 0건, 직접 확인).
  - 상세: 이 계약이 깨져도(`cause: err` 삭제) 정적 검사(`preserve-caught-error` 룰)가 다시
    잡아주므로 완전 무방비는 아니다. 1~2회차에서 이미 이 항목을 지적했고,
    `plan/in-progress/deps-peer-gating-and-eslint10.md`(229~247줄)에 developer SKILL
    §수렴 예외 근거(동작 결함 아님·정적 검사 백스톱 존재)와 함께 후속으로 명시 등재돼 있음을
    직접 열어 확인했다. 새로운 항목이 아니라 이미 정당하게 유예된 항목이다.
  - 제안: (필수 아님) `expect((thrown as Error).cause).toBe(originalError)` 한 줄씩 추가하면
    정적 검사와 독립적인 런타임 고정이 된다. 지금 이 라운드에서 처리할 필요는 없다(등재됨).
- **[INFO]** frontend/`channel-web-chat`의 "eslint 9 잔류 — 상류 peer 미지원" 상태에 backend
  `eslint-unicorn-peer.spec.ts`와 대칭되는 자동 회귀 가드가 없다.
  - 위치: `codebase/frontend/eslint.config.mjs` diff 게이트 1~21줄. 대조:
    `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer.spec.ts`.
  - 상세: 마찬가지로 plan 문서(240~247줄 부근, "2라운드 INFO #6")에 이미 등재돼 있음을 확인.
    `--strict-peer-dependencies`가 사후에(다른 사람이 실수로 올렸을 때) 잡아주는 안전망이
    이미 있어 완전 무방비는 아니다.
  - 제안: (필수 아님, 스코프 밖) 관측용 스크립트 고려 가능하나 이번 PR 스코프는 아니다.

## 요약

이번 3회차 리뷰에서 독립적으로 소스를 재확인한 결과, 1·2회차가 지적한 WARNING 2건(force-split
`overlapBuffer` 리셋 미검증, `SecretResolverService` 복호화 실패 미검증)은 discriminating
fixture와 vacuity 방지 단언(`expect.assertions`, `cause` 부재 단언)을 갖춘 견고한 테스트로
실제로 닫혔음을 코드 대조로 확인했다. `parseGteFloor` 확장에 대한 회귀 테스트도 형태(자릿수)
축을 정확히 커버해 모범적이다. `no-useless-assignment` 대응 8개 파일의 dead-initializer 제거는
전부 catch 블록의 조기 반환/재대입 구조상 TypeScript definite-assignment 가 안전을 보증하므로
추가 테스트 없이도 회귀 위험이 낮다. 남은 두 건(`cause` 보존 계약의 런타임 미검증, frontend
eslint 9 해제 조건의 자동 가드 부재)은 모두 Critical/Warning이 아니며, developer SKILL
§수렴 예외 근거와 함께 `plan/in-progress/deps-peer-gating-and-eslint10.md`에 이미 등재돼 있음을
직접 열어 확인했다 — 새로 발견된 갭이 아니라 정당하게 유예된 항목이다. 테스트 관점에서 이번
브랜치는 병합을 막을 이유가 없다.

## 위험도

LOW
