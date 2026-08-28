# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `chunkText` 의 "force split" 분기(문장 하나가 `chunkSize` 를 초과하는 경우)가 어떤 기존 테스트에도 걸리지 않는다 — 이번 PR 이 정확히 그 분기의 `no-useless-assignment` 데드스토어를 제거했는데, 그 안전성 판단이 순전히 수동 코드 읽기(= `forceSplitAndPush` 시그니처에 `overlapBuffer` 파라미터가 없어 제거된 대입이 진짜 죽은 코드였음)에만 의존한다.
  - 위치: `codebase/backend/src/modules/knowledge-base/chunking/text-chunker.ts` 함수 `chunkText` — diff 게이트 79~80줄 (`forceSplitAndPush` 호출 직후 `overlapBuffer = '';` 분기). 대응 테스트 파일 `codebase/backend/src/modules/knowledge-base/chunking/text-chunker.spec.ts` 에는 `sentenceTokens > chunkSize` 를 유발하는 케이스(단일 문장이 청크 크기를 넘는 경우)가 전혀 없다(`grep -n "force"` 결과 0건).
  - 상세: 제거된 줄은 실제로 죽은 코드였다(`forceSplitAndPush`는 `overlapBuffer`를 인자로 받지 않으며, 바로 다음 줄에서 `overlapBuffer = ''`로 무조건 재대입되어 이전 값을 덮는다) — 이번 변경 자체는 안전하다. 그러나 이 판정을 검증할 자동 테스트가 하나도 없어서, 향후 이 분기를 다시 건드릴 때(예: `forceSplitAndPush`에 오버랩 인자를 추가하는 리팩터)는 회귀를 잡을 안전망이 없다.
  - 제안: `chunkSize` 보다 훨씬 긴 단일 "문장"(마침표 없는 긴 문자열 또는 아주 작은 `chunkSize`)을 입력해 강제 분할 경로를 타는 테스트를 `text-chunker.spec.ts` 에 추가하고, 강제분할 이후 청크의 overlap 내용(있다면 빈 문자열이어야 함)까지 단언한다.

- **[WARNING]** `SecretResolverService.resolve()` 의 복호화 실패 catch 분기가 어떤 테스트로도 실행되지 않는다 — 이 PR 은 바로 이 분기에 `eslint-disable-next-line preserve-caught-error` 를 추가하면서 "`cause: err` 를 달면 안 된다(크립토 에러 상세가 Activity API 로 노출되는 걸 막기 위한 의도적 추상화, `#814` 근거 인용)"는 보안 불변식을 코드 주석으로 명시했는데, 그 불변식을 잠그는 테스트가 없다.
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` 메서드 `resolve()` catch 블록 — diff 게이트 85~95줄(`eslint-disable-next-line preserve-caught-error` + `throw new Error('Secret decryption failed')`). `secret-resolver.service.spec.ts` 전체에 `decrypt` 실패·손상된 ciphertext·"Secret decryption failed" 문자열을 다루는 테스트가 없음(grep 0건).
  - 상세: 이 분기는 의도적으로 원본 에러 상세를 감추는 보안 경계다. 지금은 사람이 남긴 주석만이 그 의도를 지키고 있고, 나중에 누군가 `no-unhandled-error` 류 lint 정리를 하며 `eslint-disable` 줄을 지우고 `cause: err` 를 붙여도 어떤 테스트도 실패하지 않는다.
  - 제안: `decryptSecret` 이 던지도록 만들 수 있는 손상 ciphertext(또는 mock)로 `resolve()` 를 호출해 `(a)` 메시지가 정확히 `'Secret decryption failed'` 이고 `(b)` `err.cause` 가 `undefined` 임을 함께 단언하는 회귀 테스트를 추가한다.

- **[INFO]** `expression-resolver.service.ts`/`code.handler.ts` 에 새로 붙인 `{ cause: err }` 자체를 검증하는 단언이 없다 — 기존 테스트는 래핑된 에러의 `.message` 정규식만 확인한다.
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts` diff 게이트 316~318줄, `codebase/backend/src/nodes/data/code/code.handler.ts` diff 게이트 454줄. 대응 테스트: `expression-resolver.service.spec.ts`(121~129줄 부근, `.toThrow(/Expression error.../)` 만 확인) / `code.handler.spec.ts`(192~196줄 부근, `.rejects.toThrow(/syntax error/)` 만 확인).
  - 상세: 이번 변경으로 새로 생긴 계약은 "원본 에러가 `cause` 로 보존된다" 는 것인데, 그 계약 자체를 잠그는 테스트가 없다. `preserve-caught-error` 룰이 향후 다시 켜지지 않는 한, 누군가 `cause: err` 를 실수로 지워도 정적 검사도 테스트도 잡지 못한다.
  - 제안: 두 곳 모두에서 `err.cause`가 원본 예외 객체와 동일함을 단언하는 케이스를 하나씩 추가한다(예: `expect((thrown as Error).cause).toBe(originalError)`).

- **[INFO]** frontend/`channel-web-chat` 의 "eslint 10 상향 차단" 상태에는 backend `eslint-unicorn-peer.spec.ts` 와 대칭되는 자동 회귀 가드가 없다 — 같은 PR 안에서 두 개의 구조적으로 동일한 "메이저 업그레이드가 상류 peer 로 막혀 있다" 상황 중 backend 쪽만 "사람이 다시 판정할 필요 없는" 상시 테스트로 승격됐다.
  - 위치: `codebase/frontend/eslint.config.mjs` diff 게이트 1~21줄(신규 헤더 주석, "해제 조건: 위 셋의 peer 에 `^10` 이 들어오는 것"). 대조: `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer.spec.ts` (동일 클래스 문제에 대한 실측 가드).
  - 상세: 지금은 `eslint-plugin-react`/`eslint-plugin-jsx-a11y`/`eslint-plugin-import` 의 registry 실측을 사람이 다시 하지 않는 한 이 조건이 풀렸는지 알 방법이 없다. dependabot 이 이 세 패키지를 자동으로 올려 unmet peer 를 관측시켜 주긴 하겠지만(사후 발견), backend 사고(#1049)에서 얻은 교훈("사람이 직접 버전을 올리는 경로는 CI 게이트 없이 무방비")이 여기엔 아직 적용되지 않았다.
  - 제안: 필수는 아니지만, `req('eslint-plugin-react/package.json').peerDependencies.eslint` 등을 실측해 `>=10` 지원 여부를 매 CI 런마다 로그/경고하는 가벼운 가드를 고려할 수 있다(차단은 아니고 관측용).

## 좋았던 점 (참고)

`codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer-guard.ts` / `eslint-unicorn-peer.spec.ts` 의 `parseGteFloor` 확장은 테스트 관점에서 모범적이다: 이전에 "해석 안 되는 형태"로 분류됐던 `'>=9'`/`'>=9.18'` 를 유효 케이스로 옮기고, 진짜 새 무효 케이스(`'>='`, `'>=x'`)를 추가했으며, `[10,9,1]` vs `[10,0,0]` 을 같은 `>=10.4` 플로어에 대해 나란히 검증해(분기를 가르는 discriminating fixture) "major 만 올리면 된다"는 오해까지 차단한다. `readInstalledPackageJson` 헬퍼 도입 사유(exports map 제약)도 실측 근거가 명확하다.

## 요약

이번 PR 은 대부분 ESLint 9→10 상향에 따른 기계적 drive-by 수정(`no-useless-assignment` 로 인한 `let x = default` → `let x` 축소, `preserve-caught-error` 로 인한 `cause: err` 추가)과 dependabot/문서 주석 정리이며, 핵심 로직 변경은 `parseGteFloor` 파서 확장 하나뿐이다. `let` 초기화 제거들은 전부 확인해 본 결과 catch 블록이 조기 반환/throw 하는 패턴이라 TypeScript definite-assignment 로 실제 동작 변화가 없음을 코드 레벨에서 확인했다(테스트 리스크 낮음). `parseGteFloor` 관련 테스트는 견고하다. 다만 이 PR 이 직접 건드린 두 분기 — `text-chunker.ts` 의 강제분할 경로, `secret-resolver.service.ts` 의 복호화 실패 경로 — 는 각각 데드코드 제거의 안전성과 보안 불변식(에러 상세 비노출)을 코드 주석만으로 주장하고 있을 뿐 이를 잠그는 테스트가 전혀 없어, 향후 같은 자리를 다시 만지는 사람에게 회귀 안전망이 없다. `cause: err` 신설 계약도 메시지만 검증될 뿐 `cause` 필드 자체는 테스트되지 않는다.

## 위험도

MEDIUM
