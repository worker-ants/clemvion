# 문서화(Documentation) 리뷰 결과 — `origin/main...HEAD` (backend lint warning 전량 처분 + `--max-warnings 0` + R8 캐너리 fix)

## 검증 방법

- `git log --oneline origin/main..HEAD` 로 이 브랜치의 8개 커밋 구성(`17221ecb9` → `e95201932`
  → `ba93680ab`(오염 revert) → `9add2eba7` → `ee8e44e8f` → `67b7d7d77` → `7c7aee1c4` →
  **`b0b57366f`(이번 라운드가 새로 보는 마지막 커밋 — `12_24_14` WARNING 2건 fix)**) 확인.
- `codebase/backend/README.md`, `package.json` 의 `lint`/`lint:fix` 스크립트 문구가 서로
  일치하는지 직접 Read 로 재확인 — 일치.
- `git show b0b57366f`로 마지막 커밋의 실제 diff(`idempotency.interceptor.spec.ts` +
  `plan/in-progress/backend-lint-gate-broken-on-main.md`)를 직접 열람.
- `spec/5-system/14-external-interaction-api.md` §R8 원문을 직접 Read.
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 전문을 직접
  Read 하고, 이 PR 이전부터 있던 주석인지 `git log -S`로 출처 확인.
- `codebase/backend/src/common/decorators/workspace-reflection-canary.ts`,
  `codebase/backend/src/scripts/migrate-node-output-refs.spec.ts` 의 신규/기존 주석을 직접 대조.

## 발견사항

- **[WARNING]** `idempotency.interceptor.ts` 안에 **아직 남아 있는 기존 주석 세 곳**이 캐시
  제외 범위를 Spec EIA §R8 에 반해 "4xx 전체" 로 서술한다 — 이번 PR 이 바로 옆 코드(같은 함수의
  `getResponse()` 호출)를 만지고 새 JSDoc 까지 추가하면서도, 그리고 **같은 PR 이 방금 이
  정확히 같은 오귀속 문제를 테스트 이름에서 발견·수정했으면서도(`b0b57366f`)**, 소스 코드 자체의
  주석은 손대지 않았다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:118`
    (`* 4xx 는 캐시 제외 (Spec EIA §R8) — 사용자가 재시도해야 함.`, `cacheTapped()` 메서드
    docstring). 관련 주석: `:42`(`4xx 중 VALIDATION_ERROR 는 캐시 제외 (Spec EIA §R8)` — 필드
    docstring), `:54-55`(클래스 docstring, `400 VALIDATION_ERROR` 만 언급하고 다른 4xx/5xx 도
    제외된다는 사실은 서술하지 않음).
  - 상세: `spec/5-system/14-external-interaction-api.md` §R8 원문은 다음과 같다 —
    "4xx 응답 중 `400 VALIDATION_ERROR` **만** idempotency cache 에서 제외하고, 그 외
    (성공 2xx / `409 Conflict` / `410 Gone`) 는 캐시한다." 그런데 실제 구현(`:131`,
    `if (statusCode >= 400) return;`)은 400 뿐 아니라 409·410·모든 5xx 를 전부 캐시에서 뺀다.
    `:118`의 주석("4xx 는 캐시 제외 (Spec EIA §R8)")은 **이 넓은 동작을 spec 이 요구하는 것처럼
    서술**한다 — spec 원문과 정반대다. `git log -S "4xx 는 캐시 제외" -- .../idempotency.interceptor.ts`
    로 확인한 결과 이 주석은 원본 PR `35ff9c19b`(#230, 2026-05-21)부터 존재했고 이번 lint 정리
    델타의 diff 는 이 줄을 건드리지 않았다 — **선재 결함이다.**
    다만 이번 델타는 (a) `HttpResponseLike` 신규 JSDoc(`:24-33`)을 이 클래스에 추가하며 이
    함수를 정면으로 다뤘고, (b) `12_24_14` 라운드 requirement WARNING 이 지적한 **바로 이
    §R8 오귀속 문제를 테스트 이름에서 정확히 찾아내 고쳤다**(`4xx 응답은 캐시하지 않는다
    (Spec EIA §R8)` → `400 VALIDATION_ERROR 는 캐시하지 않는다`, `idempotency.interceptor.spec.ts:216`)
    — 그리고 spec 을 정확히 인용하는 새 캐너리 주석까지 같은 파일(spec 파일)에 남겼다
    (`:232-245`, "Spec EIA §R8 은 … 만 제외하고 … 캐시한다 … 그런데 구현의 제외 조건은
    `statusCode >= 400` 이라 409·410 까지 함께 떨군다"). 즉 **테스트 파일의 주석은 이제
    정확한데, 바로 그 옆의 프로덕션 코드 주석은 여전히 틀린 채로 남았다** — 같은 저장소, 같은
    기능, 두 파일이 서로 모순된 이야기를 한다. 캐너리 테스트나 plan 백로그(`§후속`, 새로 추가된
    "idempotency 캐시 제외 조건이 Spec EIA §R8 보다 넓다" 항목)를 못 본 채 `idempotency.interceptor.ts`
    소스만 읽는 다음 개발자는 `:118` 주석을 그대로 믿고 "spec 이 4xx 전체 제외를 요구한다"고
    오판할 수 있다.
  - 판단 근거(WARNING 등급인 이유): 동작 자체를 고치는 것(behavioral fix)은 이 PR 의 "타입
    전용·런타임 미접촉" 정체성을 깨므로 유예가 정당하다는 논리(RESOLUTION/plan 백로그)에
    동의한다. 그러나 **주석 정정은 런타임에 전혀 영향을 주지 않는다** — side_effect 리뷰가
    이미 이 파일 전체의 emit 이 이번 델타에서 바이트 동일함을 증명했듯, 주석 텍스트를 바꾸는
    것은 emit 결과에 아무 영향이 없다. "런타임 미접촉" 을 근거로 동작 fix 를 유예한 것과 달리,
    이 주석 fix 를 유예할 근거는 없다 — 오히려 이번 PR 이 같은 문제를 테스트에서 이미 고쳤기
    때문에 소스 주석만 정정하지 않은 비일관이 더 두드러진다.
  - 제안: `:118`(그리고 `:42`, `:54-55`)을 새 캐너리 테스트가 쓴 정확한 문구와 정합하게
    고친다. 예:
    ```ts
    /**
     * RxJS operator — 정상 응답을 캐시. status 가 200~399 일 때만 적재.
     * 현재 구현은 4xx/5xx 를 전부 캐시 제외한다 — Spec EIA §R8 은 `400 VALIDATION_ERROR`
     * **만** 제외를 요구하고 409/410/그 외 4xx·5xx 는 캐시 대상이라고 명시하므로, 이 범위는
     * spec 보다 넓다(선재 결함, `plan/in-progress/backend-lint-gate-broken-on-main.md` §후속
     * 및 `idempotency.interceptor.spec.ts` "409 도 캐시되지 않는다" 캐너리 참조).
     */
    ```
    코드 변경(런타임 로직) 없이 텍스트만 바뀌므로 이 PR 의 "type-only" 정체성과 emit 바이트
    동일 불변식을 깨지 않는다.

## 요약

이번 라운드가 처음 보는 신규 커밋(`b0b57366f`)은 직전 `12_24_14` 라운드의 WARNING 2건(잘못된
spec 인용 테스트 이름, 과장된 plan 서술)을 정확히 조치했다 — 새 캐너리 테스트(`409 도 캐시되지
않는다`)와 plan 백로그 항목이 spec §R8 원문을 정확히 인용하고, 파일 최상단 docstring 도 신규
`describe` 블록(캐시 히트·손상 JSON·형태 방어)을 정확히 반영한다. `README.md`/`package.json`
의 `lint` 스크립트 서술도 일치를 유지한다. 다만 그 정정 과정에서 놓친 자리가 하나 있다 —
`idempotency.interceptor.ts` 소스 자체의 기존 주석 세 곳(`:42`, `:54-55`, 특히 `:118`)이 여전히
"4xx 는 캐시 제외 (Spec EIA §R8)" 라고 서술해, spec 이 명시적으로 반대로 말하는 범위(400
VALIDATION_ERROR 만 제외)를 spec 의 이름으로 정당화하고 있다. 이 주석은 이번 PR 이전
(`35ff9c19b`, #230)부터 있던 선재 결함이라 WARNING 의 원인이 이 PR 은 아니지만, 이번 PR 이 바로
그 함수에 새 JSDoc 을 추가했고 같은 §R8 오귀속 문제를 테스트 이름에서는 정확히 찾아 고쳤으면서
소스 주석은 그대로 둔 비일관이 생겼다. 동작 fix 와 달리 주석 fix 는 런타임에 전혀 영향을 주지
않으므로 "type-only PR" 정체성을 해치지 않고 지금 바로 정정할 수 있다.

## 위험도

LOW
