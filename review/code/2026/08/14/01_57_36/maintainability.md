# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 두 "자매 지점 전수" 구조적 회귀 가드가 소비 지점을 세는 정규식을 그대로 복제했다 — `stripComments`/`countCalls` 만 이번 라운드에 `source-scan.ts` 로 통합됐고, "소비 지점 자체의 수" 를 세는 정규식은 여전히 두 파일에 각각 박제돼 있다.
  - 위치: `codebase/backend/src/common/utils/assert-row-array.spec.ts:62-63` (`CONSUMING_QUERY`) / `codebase/backend/src/common/utils/update-returning-rows.spec.ts:54` (`CONSUMING`)
  - 상세: 두 상수는 `/const\s+\w+[^=\n]*=\s*\n?\s*await\s+[\w.]*\.query[<(]/g` 로 글자 하나까지 동일하다. 이번 라운드가 "호출 수를 세는" 로직(`stripComments`+`countCalls`)은 정확히 이 이유로 `common/__test-utils__/source-scan.ts` 로 뽑아냈으면서, 바로 옆의 "소비 지점 자체를 찾는" 정규식은 통합하지 않고 남겨뒀다. 새로운 raw-query 관용구(예: 구조분해·체이닝)가 나와 이 패턴을 넓혀야 할 때 한쪽만 고치고 다른 쪽을 잊으면, 이 PR 이 반복해서 겪은 "가드가 비대칭으로 하드닝된다" 결함 클래스가 그대로 재발한다. (이미 직전 라운드 `22_45_24` maintainability INFO 로 지적됐고 "급하지 않음" 으로 넘겼던 항목이 이번 라운드에도 손대지 않은 채 남아 있다 — `countCalls` 를 뽑아내는 김에 같이 정리할 좋은 기회였다.)
  - 제안: `source-scan.ts` 에 `countConsumingQueryStatements(src)` 류로 이 정규식도 함께 옮긴다. 시급하지 않다면 최소한 "이 정규식은 자매 파일과 동일해야 한다" 는 주석을 양쪽에 남겨 drift 를 사람이라도 알아채게 한다.

- **[INFO]** `knowledge-base.service.ts` 5개 호출부에서 `updateReturningRows(...)` 의 결과를 받는 지역 변수 이름이 통일돼 있지 않다.
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:544`(`rowsOut`), `:578`(`rowsOut`), `:752`(`resetRows`)
  - 상세: 세 지점 모두 "raw 쿼리 결과 → `updateReturningRows` 로 언랩한 행 배열" 이라는 같은 개념을 가리키는데 이름이 `rowsOut`/`resetRows` 로 갈린다(같은 파일 안에서조차 통일이 안 됨). 기능에는 영향 없지만, 5곳이 동일 패턴(raw query → 헬퍼 → 사용)을 반복하는 걸 알아보기 어렵게 만든다.
  - 제안: `rows`(원본 unknown) / `unwrapped` 또는 `rowsOut` 처럼 하나의 명명 규칙으로 5곳 모두 맞춘다.

- **[INFO]** `updateReturningRows` 와 "같은 계약" 이라고 문서화된 자매 헬퍼 `assertRowArray` 사이에 첫 파라미터 이름이 다르다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts:56` (`result: unknown`) vs `codebase/backend/src/common/utils/assert-row-array.ts:31` (`rows: unknown`)
  - 상세: `update-returning-rows.ts` 의 `detail` 파라미터 JSDoc(56-63행)이 "자매 헬퍼 `assertRowArray` 와 같은 계약" 이라고 명시적으로 짝지어 놓았는데, 정작 첫 번째 인자(원시 쿼리 결과) 이름은 `result` vs `rows` 로 다르다. 둘을 나란히 읽는 사람에게 "같은 계약" 이라는 서술이 시그니처 레벨에서는 덜 명확해진다.
  - 제안: 둘 다 `rows`(또는 둘 다 `result`)로 통일.

- **[INFO]** `assertRowArray` JSDoc 의 `{@link updateReturningRows}` 가 실제로 임포트되지 않은 심벌을 가리킨다.
  - 위치: `codebase/backend/src/common/utils/assert-row-array.ts:16`
  - 상세: TSDoc/TypeDoc 의 `@link` 는 해당 파일 스코프에서 그 식별자가 실제로 참조 가능해야 링크가 해석된다. 이 파일은 `updateReturningRows` 를 import 하지 않으므로 이 링크는 IDE/문서 생성기에 따라 그냥 텍스트로 남을 수 있다. 기능적 영향은 없지만 "클릭 가능한 상호참조" 의도가 깨진다.
  - 제안: 급하지 않음 — 문서 생성 파이프라인이 실제로 `@link` 를 해석하는지 확인 후, 필요하면 `import type { updateReturningRows } from './update-returning-rows';` 를 type-only 로 추가하거나 링크를 코드 스팬(`` `updateReturningRows` ``)으로 낮춘다.

- **[INFO]** `auth-oauth.service.spec.ts` 안에서 같은 `handleCallback` 응답의 mock 형태가 갈린다 — 이 PR 이 원인으로 지목한 바로 그 형태가 4곳 남아 있다.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.spec.ts:276, 296, 313, 327` (모두 `dataSource.query.mockResolvedValueOnce([validState])`) vs 이번에 추가된 `:244`, `:356` (튜플 `[[validState], 1]` / `[[...], 1]`)
  - 상세: 이 파일 자신의 234번째 줄 주석이 "이 스위트도 `[validState]`(행 배열)를 mock 하고 있었다 — 그것이 4개월간 결함을 가린 원인" 이라고 명시적으로 지적한다. 그런데 그 지적 이후에도 나머지 4개 테스트는 여전히 `[validState]` 형태를 유지한다. `updateReturningRows` 가 튜플·행 배열 양쪽을 다 받아들이므로 지금은 동작에 문제가 없고, e2e(`auth-oauth-callback.e2e-spec.ts`)가 실 드라이버 shape 을 별도로 고정하므로 실질적 커버리지 공백도 아니다. 다만 같은 describe 블록 안에 "위험하다고 지목된 형태" 와 "하드닝된 형태" 가 섞여 있으면, 다음에 이 파일을 복사해 새 테스트를 추가하는 사람이 다수결로 보이는 `[validState]` 쪽을 따라할 위험이 남는다.
  - 제안: 필수는 아님. 시간이 될 때 4곳도 튜플 형태로 맞추거나, 최소한 "이 4곳은 `updateReturningRows` 가 두 shape 을 모두 받아들이므로 의도적으로 남겨뒀다" 는 주석을 한 줄 남기면 다음 독자의 판단을 줄여준다.

- **[INFO]** e2e 시드 헬퍼의 SQL 플레이스홀더 순서가 파라미터 배열 순서와 시각적으로 어긋난다.
  - 위치: `codebase/backend/test/auth-oauth-callback.e2e-spec.ts:42-43`
  - 상세: `VALUES ($1, $2, 'login', $4, ...$3)` 로 `$4` 가 `$3` 보다 앞에 나온다. `params` 배열은 `[state, provider, String(expiresInMs), rememberMe]` 순서라 매핑 자체는 정확하지만(각각 $1·$2·$3·$4), VALUES 절에서 $4 가 $3 보다 먼저 등장해 한눈에 대조하기 어렵다.
  - 제안: 컬럼 순서를 `(state, provider, mode, expires_at, remember_me)` 로 바꾸거나 `params` 순서를 맞춰, `$1..$4` 가 등장 순서대로 읽히게 한다.

- **[INFO]** `knowledge-base.service.ts` 의 5개 호출부가 "raw query → `updateReturningRows` 로 언랩 → 사용" 3단 관용구를 거의 동일하게 반복한다.
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:336-348`(reExtractAll CAS), `:533-547`(embedding 재큐), `:569-582`(graph 재큐), `:720-736`(reEmbedAll CAS), `:740-755`(reEmbedAll reset)
  - 상세: SQL 문·`detail` 문자열만 다르고 나머지 3줄(선언 → 헬퍼 호출 → `.length`/`.map` 사용)은 구조가 같다. 헬퍼 자신의 JSDoc(`update-returning-rows.ts`)이 "호출부 문맥이 자리마다 달라야 한다" 는 이유로 공용화를 지양하고 있어 지금 수준의 반복은 트레이드오프로 보이며 즉시 문제는 아니다. 다만 6번째 유사 지점이 생기면 이 관용구를 한 번 더 손으로 베끼게 되므로 참고로 남긴다.
  - 제안: 급하지 않음 — 세 번째 유사 서비스에서 같은 관용구가 또 나오면 그때 추출을 고려.

## 요약

이번 diff 의 핵심(`assert-row-array.ts`/`update-returning-rows.ts` 두 헬퍼의 역할 분담과 8개 소비 지점 전환, `source-scan.ts` 로의 카운팅 로직 통합)은 함수 길이·중첩·복잡도 면에서 무난하고, 위험한 자리마다 "왜 위험한가" 를 호출부 `detail` 로 남기는 헬퍼 계약도 일관되게 지켜졌다. 진짜 결함(튜플 shape 오인)에 비해 이번 변경 자체가 새로 심은 유지보수성 문제는 크지 않다 — 대부분 이미 직전 라운드가 부분적으로 정리한 duplication 의 잔여물(정규식 하나 남음)이거나, 명명·문서 링크 수준의 사소한 불일치다. `[validState]` 잔존 mock 은 이 PR 의 자기 서술과 표면적으로 모순돼 보이지만 헬퍼가 두 shape 을 모두 허용하도록 설계됐고 e2e 가 실드라이버 shape 을 별도로 고정하므로 실질 리스크는 낮다. CRITICAL 급 유지보수성 결함은 없다.

## 위험도

LOW
