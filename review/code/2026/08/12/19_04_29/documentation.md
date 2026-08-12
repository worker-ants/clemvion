# 문서화(Documentation) Review

## 검토 방법

`origin/main...HEAD` 9개 커밋(`779a6e240`~`6298d6fdb`) 전체 diff(83개 파일, `CHANGELOG.md` ·
`idempotency.interceptor.ts`/`.spec.ts` · `external-interaction.e2e-spec.ts` · `plan/**` 2건 ·
`spec/data-flow/15-external-interaction.md` · `review/**` 77개)를 대상으로 했다. `review/**`
77개는 이 작업이 이미 거친 6차례 문서화 리뷰(`16_29_45`→`18_52_47`)와 1차례 consistency
검토(`18_27_29`)의 산출물이 이번 커밋들에 동봉된 것이며, 각 라운드 자체가 CRITICAL 1건(dead
code)·WARNING 다수(자매 자리 누락·docstring stale·처분 불이행 등)를 지적하고 순차 조치해
왔다. 이번 라운드는 그 누적 결과인 최종 코드 상태를 프롬프트에 의존하지 않고 저장소에서
직접 열어 재검증했다.

## 독립 검증 (직접 대조)

- `idempotency.interceptor.ts`: 클래스/필드/메서드 JSDoc이 현재 구현(성공 채널 인라인 판정 +
  `isErrorStatusCacheable()` named 함수 + `catchError` 기반 409/410 재현 + `storeEntry()`
  직렬화 가드)과 정확히 대응함을 라인 단위로 확인했다. `isErrorStatusCacheable` JSDoc의 "네
  경우 모두 spec 에 회귀 테스트가 있다"는 실제로 409(`:272`)·410(`:303`)·5xx(`:389`)·
  404(`:443`) 4개 `it` 블록과 정확히 대응함을 `idempotency.interceptor.spec.ts` 에서 직접
  확인했다.
- `idempotency.interceptor.spec.ts` 모듈 docstring(`:17-25`, 세 번째 describe 요약)이 "적재·
  직렬화가 조용히 실패할 수 있는 **4건**은 warn 을 단언하고 나머지 3건은 단언하지 않는다"고
  적은 주장을, 세 번째 describe 블록의 `it` 7개(`:555,585,605,630,665,682,724`)를 전수 grep
  으로 대조해 정확히 4건(`555,630,682,724`)만 `Logger.prototype.warn` 단언을 포함함을
  확인했다 — 직전 라운드(`18_52_47`)가 고친 "전부"라는 과장 문구가 이번엔 정확한 부분집합
  서술로 남아 있다.
- `external-interaction.e2e-spec.ts`: `IDEM-1`/`IDEM-2`/`IDEM-3` 헤더 코멘트(`:362-368`)가
  실제 세 `it` 블록(409 재현·400 미캐시·410 재현)과 일치하고, 파일 전체 테스트 ID(`A`~`J`,
  `IDEM-1`~`3`)에 `grep` 전수 대조로 중복이 없음을 재확인했다(`18_07_36` WARNING이 잡았던
  `I-2` 충돌은 재발하지 않았다).
- `CHANGELOG.md`: "조건식만 바꿔서는 고쳐지지 않았다"는 재설계 경위, `requestId` 비재현
  caveat 을 실제 코드(예외 필터가 매 응답 새 `requestId` 발급)와 대조해 정확함을 확인했다.
- `spec/data-flow/15-external-interaction.md`: §2.2 표에서 "⚠️ 현행 구현 갭" 각주만 정확히
  삭제됐고 나머지 서술은 무변경 — 코드(`isErrorStatusCacheable` 닫힌 목록)와 정합.

## 발견사항

- **[INFO]** 클래스 상단 요약 JSDoc이 이번에 정식 동작이 된 "캐시 히트 시 409/410 을 예외로
  재현"을 bullet 로 명시하지 않는다 (선행 라운드 `16_53_26` 문서화 리뷰가 이미 지적, 3라운드
  경과에도 미반영)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:49-57`
    (클래스 docstring bullet 5개)
  - 상세: bullet 목록은 "같은 키로 재요청 시 같은 응답을 그대로 재현 (멱등)"(일반 서술)과
    "같은 키 + 다른 body 는 `409 Conflict`"(캐시 미스 시 즉시 발생하는
    `IDEMPOTENCY_KEY_CONFLICT`)만 언급하고, 이 PR 의 핵심 신규 동작인 "캐시 히트 시 저장된
    `409`/`410` 을 예외로 재현"(`:135-140`)은 클래스 최상단 요약에 없다. 메서드/필드 docstring
    (`cacheTapped`, `isErrorStatusCacheable`, `IdempotencyEntry.responseJson`)이 각각 정확히
    보완하므로 틀린 서술은 아니고, 심각도는 낮다. 다만 이미 `16_53_26` 라운드가 "여유가 있으면
    한 줄 추가" 로 제안했음에도 이후 5개 라운드가 전부 "제안, 필수 아님"으로 재확인만 하고
    실제 반영은 없었다 — 클래스를 처음 훑는 사람은 여전히 이 bullet 목록만으로는 R8 범위
    (409/410 재현 포함)를 알 수 없다.
  - 제안: 필수 아님. 여유가 있으면 "캐시 대상은 `2xx`·`409`·`410` 닫힌 목록([Spec EIA §R8]) —
    409/410 은 예외로 재현" 한 줄을 bullet 에 추가.

- **[INFO]** plan 백로그의 미착수 항목(`readKey`/`hashBody` 경계값 테스트)이 이미 해소된 R8
  선재 결함을 여전히 미해결 전제로 참조한다 (선행 라운드 `18_07_36` 문서화 리뷰가 이미 지적,
  diff 범위 밖 unchanged context)
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:569-571` (unchecked 항목 —
    "함께: 클래스 docstring 에 R8 선재 결함 참조 한 줄 추가(INFO 2, 경미).")
  - 상세: `:571` 문구는 R8 결함이 아직 미해결이던 시점(`12_55_52` 라운드)에 작성됐다. 지금은
    바로 아래 `:572`("idempotency 캐시 제외 조건이 Spec EIA §R8 보다 넓다 — 선재 결함")가
    `[x]` 로 완료 처리됐고 그 전제 자체가 사라졌다. 이번 diff 는 이 unchecked 항목 자체를
    건드리지 않았다(문맥 그대로 유지되는 줄) — 향후 이 항목을 집어드는 사람이 문자 그대로
    따르면 이미 고쳐진 결함을 "참조"하라는 지시를 받는다. 실질 영향은 낮음(그 항목이 실제로
    착수될 때 자연히 드러날 성격).
  - 제안: 필수 아님. 여유가 있으면 그 구절을 삭제하거나 "R8 선재 결함(`eia-r8-cache-scope` 로
    해소됨, `:572` 참조)"처럼 과거형으로 정정.

## 요약

`Idempotency-Key` 캐시를 Spec EIA §R8 의 닫힌 목록(`2xx`·`409`·`410`)에 맞추는 6라운드에
걸친 재설계(dead code CRITICAL 1건 → 자매 자리 누락 WARNING 다수 → 문서 과장 WARNING)가
이번 라운드 시점에는 완전히 수렴돼 있음을 프롬프트가 아니라 저장소를 직접 열어 재확인했다.
CHANGELOG·구현/테스트 docstring·인라인 주석·spec 미러(`data-flow/15`)·plan 완료 서사·e2e
헤더 코멘트가 전부 현재 코드와 정확히 일치하며, 이전 라운드들이 지적한 "오래된 주석"·
"문서한 보장이 구현보다 넓다" 류 결함은 모두 실제로 해소된 상태로 남아 있다(예: 세 번째
describe 모듈 docstring의 "4건만 warn 단언" 서술을 `it` 7개 전수와 대조해 정확함을 확인).
남는 것은 3~5라운드 전부터 반복적으로 "제안, 필수 아님"으로 유예돼 온 INFO 2건뿐이다 — 클래스
최상단 bullet 요약이 409/410 재현을 명시하지 않는 점, plan 백로그 한 줄이 이미 해소된 갭을
과거형이 아니게 참조하는 점. 둘 다 기능·회귀 위험이 없고 새 API·환경변수·README 대상 표면도
없다.

## 위험도

NONE
