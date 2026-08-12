# 유지보수성(Maintainability) 리뷰 결과

델타 = `origin/main...HEAD` 누적 diff, 38개 파일. 실질 애플리케이션 코드는 12개 backend TS 파일
+ `package.json`(`--max-warnings 0`) + `README.md`(문구 정정) — 전부 `no-unsafe-*` lint warning
처분을 위한 **타입 주석/제네릭/단언 추가뿐인 기계적 변경**이다(로직 변경 없음, 이전 두 라운드가
emit 바이트 비교로 실증). 나머지 24개 파일은 `plan/in-progress/backend-lint-gate-broken-on-main.md`
갱신과 직전 두 리뷰 세션(`11_06_12`, `12_05_39`)의 산출물(RESOLUTION/SUMMARY/reviewer md/meta.json)
커밋이라 코드 유지보수성 관점의 검토 대상이 아니다.

이번 라운드에서 실제로 **새로** 검토할 지점은 (1) `README.md` 한 줄 문구 정정, (2)
`idempotency.interceptor.spec.ts` 에 추가된 5건의 신규 테스트(`responseOverride` 옵션 포함)다.
나머지 12개 소스 파일의 diff 는 직전 두 라운드(`11_06_12`, `12_05_39`)의 maintainability 리뷰가
이미 동일 hunk 를 상세 검토했고(콜백 시그니처 반복 6곳, `HttpResponseLike` 네이밍, `Array.isArray`
주석 반복 2곳 등, 전부 NONE/조치 불요 판정), 직접 재확인한 결과 그 사이 재수정되지 않아 판정이
그대로 유효하다.

## 발견사항

- **[INFO]** `idempotency.interceptor.spec.ts` 신규 `describe` 블록에서 인터셉터 생성자 호출이
  5회 동일하게 반복됨
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:165-169`,
    `:196-200`, `:214-218`, `:235-239`, `:269-273` — 전부
    `new IdempotencyInterceptor(undefined, redis as never, undefined)` 형태
  - 상세: 같은 `describe('IdempotencyInterceptor (캐시 히트 · 응답 형태 방어)')` 블록 안에서
    `bodyHashOf` 는 반복되는 해시 계산을 헬퍼로 이미 추출했는데(`:149-152`), 바로 옆의
    `new IdempotencyInterceptor(...)` 3-인자 호출은 동일한 5곳에서 그대로 인라인 반복된다 — 같은
    블록 내에서 한쪽 중복은 걷어내고 다른 쪽은 남긴 셈이라 스타일이 일관되지 않는다. 로직이
    복잡하지 않아 심각하지는 않지만, 향후 생성자 시그니처가 바뀌면(예: 4번째 인자 추가) 5곳을
    전부 손으로 고쳐야 한다.
  - 제안: `const makeInterceptor = (redis: RedisStub) => new IdempotencyInterceptor(undefined, redis as never, undefined);`
    같은 로컬 헬퍼로 추출하면 5곳이 1곳으로 줄고, `bodyHashOf` 와 스타일도 맞는다. 강제 수정
    사유는 아님(가독성 저해가 크지 않고, 각 테스트가 인자를 무엇으로 채우는지 그 자리에서 바로
    보이는 지역성 장점도 있음).

- **[INFO]** `README.md` 문구 정정 — 명확성 개선, 결함 아님
  - 위치: `codebase/backend/README.md:19`
  - 상세: `| npm run lint | ESLint (report-only — 자동 수정 안 함) |` → `| npm run lint | ESLint —
    트리를 고치지 않음(\`--fix\` 없음). **warning 1건도 실패**(\`--max-warnings 0\`) |`. `package.json`
    의 `--max-warnings 0` 도입으로 실제 동작이 바뀌었고, 그 사실을 문서가 정확히 반영한다. 원래
    "report-only" 가 "자동 수정 안 함" 을 뜻했다는 것(정정 아님)까지 RESOLUTION.md 가 `git log -S`
    로 근거를 남기며 확인했고, 새 문구도 그 원래 의미를 보존한 채 게이팅 사실만 병기해 모호함이
    없다. 판정: 문제 없음(발견 아님, 확인 목적).

- 이전 두 라운드(`11_06_12`, `12_05_39`)가 이미 검토·carry-forward 한 12개 소스 파일 diff 를
  재확인한 결과, 그 사이 재수정되어 판정이 달라진 곳은 없다. 요약:
  - `migrate-node-output-refs.ts` 콜백 타입 시그니처 반복 6곳(`:247-252`,`:292-297`,`:312-317`,
    `:332-337`,`:437-442`,`:487-492`) — 로직 중복이 아니라 타입 중복, 1회성 저빈도 스크립트라
    강제 리팩터 사유 아님(재확인, 변화 없음).
  - `ai-agent.schema.ts:645`·`render-tool-provider.ts:376-377,458-459` 의 `Array.isArray` →
    `any[]` 좁힘 설명 주석 반복(2개 파일) — 로직 아닌 설명 반복, 3번째 파일 등장 시 재검토
    (재확인, 변화 없음).
  - `idempotency.interceptor.ts` 의 `HttpResponseLike` 인터페이스(`:24-37`) — 저장소 기존
    `*Like` 구조적 타입 컨벤션·`getResponse<T>()` 최소 shape 관행에 부합, 왜 express `Response`
    를 직접 쓰지 않는지 근거가 주석에 명확(재확인, 변화 없음).
  - `execution-engine.service.ts:2909-2911` 의 `m.query<{ id: string }[]>` 신규 주석 — 코드
    반복이 아니라 파급 효과·shape 근거를 설명해 실제로 유용(재확인, 변화 없음).
  - `triggers.service.ts:31,546,1077` — `SetupResult` import·`as object`·`let result: SetupResult`
    모두 기존 모듈 엣지·인터페이스 계약을 명시한 것뿐, 신규 결합·복잡도 증가 없음(재확인, 변화 없음).

- `plan/in-progress/backend-lint-gate-broken-on-main.md`, `review/code/2026/08/12/{11_06_12,12_05_39}/*`
  — 산문 문서·리뷰 산출물이라 함수 길이/중첩/매직넘버 등 코드 유지보수성 기준이 적용되지
  않는다. 리뷰 산출물 커밋은 이 저장소의 명시된 표준 워크플로(구현 완료 후 `/ai-review` 산출물
  커밋)에 부합하므로 별도 지적 없음.

## 요약

이번 델타의 실질 코드 변경은 여전히 로직을 건드리지 않는 타입 강화뿐이며, 12개 소스 파일에
대한 판정은 직전 두 라운드의 상세 분석과 재확인 결과 동일하게 유지된다(전부 NONE, 강제 수정
사유 없음). 이번 라운드에서 새로 추가된 내용 중 `README.md` 문구 정정은 실제 동작 변화를
정확히 반영해 문제가 없다. `idempotency.interceptor.spec.ts` 에 추가된 5건의 신규 테스트는
캐시 히트/409/4xx 제외/형태 없는 응답 방어라는 실질 계약을 잘 고정하지만, 인터셉터 생성자 호출이
5곳에서 동일하게 인라인 반복되어(같은 블록의 `bodyHashOf` 헬퍼 추출과 대비되는 경미한 스타일
비일관) 로컬 헬퍼로 묶을 여지가 있다 — 다만 가독성을 심각히 해치지 않아 INFO 수준이며 강제 수정
대상은 아니다. CRITICAL/WARNING 급 유지보수성 결함은 없다.

## 위험도

NONE
