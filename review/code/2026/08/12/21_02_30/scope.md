# 변경 범위(Scope) 리뷰

## 검토 대상

- `CHANGELOG.md`
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts`
- `codebase/backend/test/external-interaction.e2e-spec.ts`

의도: Spec EIA §R8 "캐시 키 스코프" — 멱등 캐시 키를 `Idempotency-Key` 헤더 값 단독에서
`<executionId>:<route>:<key>` 로 확장해, 서로 다른 execution 간·`interact`/`cancel` route 간
캐시 네임스페이스 공유를 차단한다. `git log` 로 대조한 실제 커밋(`2e433c001` fix +
`8316c8981` test 정정)과 본 리뷰 payload 의 diff 내용이 정확히 일치한다.

## 발견사항

- **[INFO]** `idempotency.interceptor.ts` 의 `import type { Request } from 'express'` →
  `import type { RequestWithInteraction } from './interaction.guard'` 교체
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:18`
  - 상세: import 대상이 바뀌어 언뜻 "임포트 변경" 항목에 해당하나, `RequestWithInteraction` 은
    이번 변경으로 신설된 타입이 아니라 `interaction.guard.ts:71` 에 이미 존재하고
    `InteractionGuard` 가 써 오던 타입이다(`grep` 로 확인). `req.interaction.executionId` 를
    읽으려면 이 타입으로 좁혀야 하므로 스코프 내 필수 변경이다.
  - 제안: 없음 — scope 위반 아님, 참고용 기록.

- **[INFO]** 기존 테스트(`IdempotencyInterceptor (W-4 provider 경로)` 블록의 첫 케이스)에서
  `expect(sharedRedis.get).toHaveBeenCalledWith(expect.stringContaining('interaction:idempotency:key-1'))`
  를 `expect(sharedRedis.get).toHaveBeenCalledWith(scopedKey('key-1'))` 로 교체
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:173`
  - 상세: 키 포맷이 `interaction:idempotency:<key>` → `interaction:idempotency:<executionId>:<route>:<key>`
    로 바뀌면서 옛 `stringContaining` 리터럴이 더 이상 실제 키의 부분 문자열이 아니게 되어
    (구분자 사이에 `exec-aaa:interact:` 가 끼어듦) 이 수정 없이는 기존 테스트가 그대로 깨진다.
    범위를 벗어난 "불필요한 정리"가 아니라 구현 변경이 강제한 필수 수반 수정이다.
  - 제안: 없음.

- **[INFO]** `codebase/backend/test/external-interaction.e2e-spec.ts` 에서 `IDEM-4`/`IDEM-5`
  의 단언 순서를 "키 존재 확인" → "행동(상태코드) 확인" 순에서 반대로 재배치(`8316c8981`)
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts:620-641`(IDEM-4),
    `:675-691`(IDEM-5)
  - 상세: 같은 기능(§R8 캐시 키 스코프)의 테스트 품질을 뮤테이션 실측으로 교정한 후속 커밋이며,
    새 파일·새 관심사를 끌어들이지 않고 같은 두 테스트 케이스 내부 단언 순서만 조정했다.
    범위 이탈이 아니라 같은 PR 목표에 대한 검증 강화다.
  - 제안: 없음.

CRITICAL/WARNING 수준의 스코프 이탈은 발견되지 않았다. 4개 파일 모두 "캐시 키를
execution+route 로 스코프한다"는 단일 의도에 직접 종속된 변경이며 다음을 확인했다:

- **무관한 파일 없음**: 수정된 파일은 인터셉터 본체·그 unit spec·그 e2e spec·CHANGELOG 뿐이다.
  다른 모듈·컨트롤러·spec 문서·설정 파일은 건드리지 않았다.
- **기능 확장 없음**: `isErrorStatusCacheable`, TTL, fail-open 정책, 409/410 캐시 목록 등
  기존 로직은 그대로이고, 추가된 로직은 스코프 키 조립과 `req.interaction` 부재 시 skip 분기뿐이다.
- **불필요한 리팩토링 없음**: `cacheTapped`/`storeEntry`/`isErrorStatusCacheable` 등 기존
  함수는 형태 변경 없이 그대로 재사용된다.
- **포맷팅/주석 잡음 없음**: 추가된 주석·JSDoc 은 전부 신규 스코프 로직(`req.interaction`
  근거, route 축이 필요한 이유, fallback 금지 이유)을 직접 설명하며, 관련 없는 기존 주석을
  건드리지 않았다.
- **설정 변경 없음**: `package.json`/CI 설정 등 변경 없음.
- **CHANGELOG.md**: 최상단에 새 항목 1건만 추가(`diff` 상 `+` 만 존재, 기존 항목 unmodified).

## 요약

이번 변경은 Spec EIA §R8 "캐시 키 스코프" 구현이라는 단일 목표에 정확히 대응한다.
핵심 파일(인터셉터 구현)과 그 계약을 검증하는 unit/e2e 테스트, 그리고 CHANGELOG 항목만
수정했고, 각 diff 라인은 스코핑 로직(실행 축·라우트 축·fallback 금지)이나 그로 인해
강제된 기존 테스트/타입 수정으로 직접 추적된다. `import type { Request }` →
`RequestWithInteraction` 교체와 기존 `stringContaining` 단언 교체는 표면적으로는
"임포트 변경"·"기존 테스트 수정"처럼 보이지만, 둘 다 이번 기능 변경이 없으면 성립하지 않는
필수 수반 수정이며 사전 존재하던 타입/규약을 재사용한 것으로 확인했다. 불필요한 리팩토링,
관련 없는 파일 수정, 포맷팅/주석 잡음, 사용하지 않는 임포트, 의도치 않은 설정 변경은
발견되지 않았다.

## 위험도

NONE
