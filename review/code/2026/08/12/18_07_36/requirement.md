# 요구사항(Requirement) 리뷰 — EIA §R8 idempotency 캐시 범위 (409/410), 누적 diff 최종 확인

## 배경

이 diff는 origin/main 대비 누적본으로, `IdempotencyInterceptor` 의 §R8 캐시 대상(닫힌 목록
`2xx`·`409`·`410`) 정합화가 4라운드(`16_29_45` CRITICAL→재설계, `16_53_26` WARNING→조치,
`17_07_45` WARNING 4건→조치)를 거친 뒤, 이번에 e2e 테스트(`I-1`/`I-2`, 커밋 `0f7907ec4`)가
새로 추가된 상태다. 과거 라운드의 판정을 액면가로 받지 않고 실제 소스(`idempotency.interceptor.ts`,
`idempotency.interceptor.spec.ts`, `external-interaction.e2e-spec.ts`, `interaction.service.ts`,
`interaction.controller.ts`)를 직접 Read 하고 spec 원문과 line-level 로 대조했다.

## 검증 방법

1. `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 전문 Read.
2. `spec/5-system/14-external-interaction-api.md` §R8 원문, `spec/data-flow/15-external-interaction.md`
   §2.2 표를 Read 해 line-level 대조.
3. `interaction.service.ts` 의 409/410 throw 지점(253·431·478·505행)과
   `interaction.controller.ts` 의 `@HttpCode(202)` 고정(65·111행)을 grep 으로 재확인.
4. `codebase/backend/test/external-interaction.e2e-spec.ts` 의 신규 `I-1`/`I-2` 케이스 전문 Read.
5. 기존 e2e 파일들의 Redis 연결 패턴(`execution-seq-allocator-load.e2e-spec.ts`,
   `integration-cache-invalidate.e2e-spec.ts`)과 신규 코드의 관례 일치 확인.

## 발견사항

- **[INFO]** `isErrorStatusCacheable` docstring 의 "네 경우 모두 spec 에 회귀 테스트가 있다" 라는
  문구가 여전히 "spec 문서"와 "`*.spec.ts` 테스트 파일"을 혼동할 여지를 남긴다 — `17_07_45`
  라운드에서 이미 지적되고 "조치됨"으로 처분됐으나, 실제로는 신규 테스트 추가로 문장이 우연히
  참이 된 것이지 문구 자체는 바뀌지 않았다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:253`
    (`isErrorStatusCacheable` 상단 docstring 마지막 줄)
  - 상세: 기능에는 영향 없다. 파일 전반에 `[Spec EIA §R8]` 처럼 명세 문서를 대괄호로 명시하는
    관례가 있는데, 이 줄만 "spec" 이 test suite 를 가리키는지 명세 문서를 가리키는지 문맥으로만
    구분된다. 이미 이전 라운드에서 다뤄진 경미 사안이라 재차단 사유는 아니다.
  - 제안: "네 경우 모두 이 파일의 회귀 테스트로 고정돼 있다" 류로 한 번 더 다듬으면 완전히
    해소된다(선택, 매우 경미).

- **[INFO]** CHANGELOG 상단 §R8 엔트리(3-29행)가 4라운드에 걸친 재설계 서사(dead code→catchError
  redesign, `400` mock 누락 수정, 5xx 우회 검증 수정, **`storeEntry` 직렬화 실패가 원 409/410
  예외를 500 으로 대체할 뻔했던 방어 로직 추가**, 이번 e2e 추가)를 "조건식만 바꿔서는 고쳐지지
  않았다 → catchError 로 확장" 한 문단으로 요약하고, `storeEntry` 의 직렬화 실패 방어나 e2e 추가는
  별도로 언급하지 않는다.
  - 위치: `CHANGELOG.md:3-29`
  - 상세: 클라이언트에 보이는 계약(상태코드·에러코드·메시지 재현, `requestId` 예외)은 정확히
    서술돼 있어 "클라이언트 영향" 문단 자체는 사실과 일치한다. 누락된 것은 내부 견고성 개선
    (직렬화 실패 시 원 예외를 삼키지 않도록 한 방어)과 검증 계층 추가(e2e)로, 둘 다 코드
    docstring(`idempotency.interceptor.ts:208-212`)과 plan 체크리스트(뮤테이션 표 포함)에는
    정확히 남아 있다. CHANGELOG 가 SoT 는 아니므로 차단 사유로 보지 않는다.
  - 제안: 필수 아님. 여유가 있으면 CHANGELOG 에 "적재 실패가 원 예외를 대체하지 않도록 방어"
    한 줄을 추가하면 향후 회귀 원인 추적에 더 유리하다.

## 확인된 사항 (문제 없음 — 근거를 남겨 둔다)

- **§R8 닫힌 목록과 구현의 line-level 일치**: spec 원문("캐시 대상은 닫힌 목록이다: 위에 열거한
  `2xx`·`409`·`410` 이 전부다 … `statusCode === 400` 은 … `statusCode >= 400` 은 반대로 `409`·`410`
  을 떨궈 …", `spec/5-system/14-external-interaction-api.md` §R8)가
  `isErrorStatusCacheable(statusCode) { return statusCode === 409 || statusCode === 410; }`
  (`idempotency.interceptor.ts:255-257`, 성공 쪽은 `cacheTapped` 내부 `statusCode < 200 ||
  statusCode >= 300` 인라인 조건, `:177`)로 정확히 옮겨졌다. `spec/data-flow/15-external-interaction.md:258`
  의 "⚠️ 현행 구현 갭" caveat 삭제도 이제 신규 e2e(`I-1`)로 실측 뒷받침된다.
- **RxJS 채널 분리가 실제로 배선돼 있다**: `409`·`410` 은 `interaction.service.ts` 가
  `ConflictException`(478·505행)/`GoneException`(253·431행) 으로 throw 하므로 error 채널로 흐르고,
  `cacheTapped()` 는 `tap({next})` 뿐 아니라 `catchError` 로 `err instanceof HttpException` 판정 후
  `isErrorStatusCacheable(err.getStatus())` 로 적재한다(`idempotency.interceptor.ts:163-203`).
  컨트롤러가 `@HttpCode(HttpStatus.ACCEPTED)`(202) 로 고정돼 있음을 `interaction.controller.ts:65,111`
  에서 직접 확인 — 성공 채널의 `res.statusCode` 가 409/410 이 될 수 없다는 이 설계의 전제와 일치한다.
- **캐시 재현이 왜곡 없이 재현된다**: 캐시 히트 시 `409`/`410` 이면
  `throw new HttpException(JSON.parse(cached.responseJson), cached.statusCode)`
  (`idempotency.interceptor.ts:136-139`)로 원 예외를 그대로 재현한다.
- **`storeEntry` 의 예외-대체 방어**: `catchError` 셀렉터 내부에서 `storeEntry`가 호출되는데,
  그 안의 `JSON.stringify` 를 `try/catch` 로 감싸 실패 시 적재만 skip 하고
  `return throwError(() => err)` (원 예외)가 항상 실행되도록 방어돼 있다
  (`idempotency.interceptor.ts:214-233`). `void this.redis.set(...).catch(...)` 형태라 비동기
  SET 실패도 별도로 흡수된다.
- **신규 e2e(`I-1`/`I-2`)가 실제 계약을 검증한다**: 이전 라운드(`17_07_45` api_contract INFO)가
  "실 HTTP 왕복을 검증하는 e2e 부재"를 잔여 리스크로 남겼는데, 이번 diff 가 그 갭을 정확히 메운다.
  `I-1` 은 `G-2` 와 동형으로 실제 `STATE_MISMATCH` 409 를 유발한 뒤, **상태코드만 비교하지 않고
  Redis 엔트리(`interaction:idempotency:<key>`)를 직접 조회**해 `statusCode`/`responseJson` 을
  단언하고, 재요청이 같은 응답을 재현하는지까지 확인한다(`external-interaction.e2e-spec.ts:371-444`).
  plan 노트(`plan/in-progress/backend-lint-gate-broken-on-main.md:549-556`)가 밝히듯 상태코드만
  비교하는 fixture 는 캐시 유무를 가르지 못했던 전력이 있어, 이 관측점 선택이 판별력 있는
  설계다. `I-2` 는 400 미적재 + 정정 재제출 성공(202)을 확인해 R8 의 반대 축(예외 대상)도
  커버한다(`:446-510`). 두 e2e 모두 기존 파일 관례(`redis` host/port 처리, `db` client 재사용)와
  일치한다.
- **문서 3종(CHANGELOG·plan·spec)이 실제 동작과 사실 정합**: plan 체크리스트
  (`plan/in-progress/backend-lint-gate-broken-on-main.md:539-635`)는 1차 시도 실패와 재설계 경위,
  3·4차 라운드에서 "고친 자리 옆의 같은 자리"를 반복해서 놓쳤다는 교훈을 감추지 않고 남겼고,
  이번에 e2e 완료 항목을 `[x]` 로 전환하면서 "첫 e2e 는 판별력이 없었다"는 실패 경험까지
  정직하게 기록했다(`:552-557`). spec 캐비트 삭제는 이제 e2e 로도 뒷받침된다.

## 요약

`IdempotencyInterceptor` 의 §R8 캐시 대상(`2xx`·`409`·`410` 닫힌 목록)이 실제 구현과
line-level 로 일치하며, 과거 라운드가 지적한 CRITICAL(dead code)·WARNING들(자매 테스트 케이스
누락, 직렬화 실패 시 예외 대체 위험)은 모두 코드 상에서 해소가 확인된다. 이번 diff 의 신규
부분(e2e `I-1`/`I-2`)은 이전 라운드가 "이 PR 을 막을 사유는 아니나 잔여 리스크"로 남겨 뒀던
"단위 mock 이 실제 Nest 파이프라인을 반영 못 한다"는 구조적 갭을 실제로 메우며, 상태코드
비교만으로는 판별되지 않는다는 사실을 스스로 실패 경험으로 문서화한 뒤 Redis 엔트리 직접
조회로 재설계한 판별력 있는 테스트다. `EIA-RL-02`(동일 키 24h 동일 응답 재현)는 이제 409/410
범위에서도 단위·e2e 양쪽에서 검증된다. 남은 것은 CHANGELOG 서사가 4라운드의 내부 견고성
개선(직렬화 방어)과 e2e 추가를 명시적으로 언급하지 않는다는 경미한 문서 완결성 사안과, 이미
한 차례 다뤄진 docstring 문구 하나뿐이며 둘 다 기능·계약에 영향이 없는 INFO 다.

## 위험도

NONE
