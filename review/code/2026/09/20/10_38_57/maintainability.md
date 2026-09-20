# 유지보수성(Maintainability) 리뷰

## 검토 범위

이 변경은 SSRF 가드 소비자 넷(+동반 1건)의 `catch` 를 `instanceof SsrfBlockedError` 로 "차단 판정"과 "가드 자체의 고장"을 가르는 리팩토링이다(`plan/complete/ssrf-catch-instanceof.md` — 트래커 `spec-draft-nullable-notation-followups.md` 항목 해소).

코드 대상:
- `codebase/backend/src/modules/integrations/database-connection-tester.ts` / `.spec.ts`
- `codebase/backend/src/modules/integrations/http-connection-tester.ts` / `.spec.ts`
- `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` / `.spec.ts`
- `codebase/backend/src/nodes/integration/http-request/http-redirect.ts` / `.spec.ts`(신설)
- `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` / `.spec.ts`

`plan/**`, `review/**` 산출물은 제품 코드가 아니라 가독성/네이밍/함수길이/중첩/매직넘버/중복/복잡도/일관성 관점의 평가 대상이 아니므로 제외했다(선행 라운드와 동일한 스코핑).

이 diff 는 이미 같은 워크트리에서 두 라운드(`review/code/2026/09/20/09_35_16`, `10_09_56`) 리뷰를 거쳐 지적 사항이 커밋 `e8d810405`(1라운드 조치)·`fff0d14bf`(2라운드 조치)로 반영된 뒤의 최종 상태다. 아래는 그 최종 상태에 대한 독립 재검토다.

## 발견사항

- **[INFO]** 판정/비판정 분기(`if (!(err instanceof SsrfBlockedError))` 및 그 근거 주석)가 프로덕션 코드 4곳(+ SMTP 가드까지 5곳)에 구조적으로 반복되고, 설명 주석도 거의 동일 문구로 반복된다.
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts:147`, `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts:271`, `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:362`, `codebase/backend/src/nodes/integration/http-request/http-redirect.ts:36`(역방향 형태: `if (err instanceof SsrfBlockedError) return …`)
  - 상세: `grep`으로 확인한 결과 "판정은 `SsrfBlockedError` 하나뿐이다" 로 시작하는 동일 계열 주석이 `send-email/smtp-host-guard.ts` 를 포함해 5개 파일에 나타난다. 각 호출부의 사후 처리(응답 객체 반환 vs throw, 사용 코드, usage 로그 기록 여부)가 서로 달라 얇은 공용 헬퍼로 묶으면 파라미터가 늘어나는 트레이드오프가 있다. 이 항목은 이미 1라운드(`review/code/2026/09/20/09_35_16` INFO 1)와 2라운드(`10_09_56` INFO 2번째 항목)에서 지적되었고, 두 RESOLUTION.md 모두 "공용 헬퍼 추출은 트래커의 «공용 가드를 http-request/ 밖 중립 위치로 이동» 항목과 결이 같다"는 근거로 조치를 보류했다 — 새 지적이 아니라 기존에 근거를 남기고 유예된 판단의 재확인이다.
  - 제안: 지금 조치 불필요. 가드가 두 번째 비판정 예외 유형을 구분해야 하는 시점이 오면 공용 위치 이동과 함께 헬퍼 추출을 재고.

- **[INFO]** `http-request.handler.ts` 의 `execute()` 가 이미 약 450줄(140~589행)인 상태에서 이번 diff 가 판정/비판정 분기 처리 로직(약 25줄, `buildPreflightErrorOutput` 재호출 포함)을 그 안에 그대로 얹어 더 길어졌다.
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` — `execute()`(140행 시작), 새 분기는 358~386행
  - 상세: 새로 추가된 블록 자체는 기존 관용구(`buildPreflightErrorOutput`, `toLogError`)를 그대로 재사용해 국지적으로는 깔끔하지만, 이미 여러 책임(config 파싱 · echo 구성 · preflight · fetch · 리다이렉트 · 응답 매핑 · 에러 매핑)을 한 함수가 갖고 있는 기존 구조에 조건 분기 하나를 더 얹은 형태다. 이번 변경이 만든 문제는 아니고 이미 두 라운드에서 "중첩·함수 길이가 과도해지지 않았다"고 판단된 바 있어 즉시 조치를 요구할 정도는 아니지만, 이후 이 함수를 더 건드릴 계획이 있다면 preflight 에러 처리(판정/비판정 분기 전체)를 private 메서드로 뽑는 편이 함수 전체 길이를 줄이는 데 도움이 된다.
  - 제안: 지금 조치 불필요(선행 두 라운드 판단과 동일). 향후 같은 함수를 다시 손댈 일이 생기면 리팩토링 후보로 고려.

- **[INFO]** 작업 트리에 이 리뷰와 무관해 보이는 미커밋 변경이 남아 있다 — 유지보수성 결함은 아니지만 절차상 이상 상태로 보고한다.
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` (커밋 `3e63e599f` 기준 워킹트리, `git status --short` 에 `M` 으로 표시)
  - 상세: `git diff` 로 확인한 결과 560행 `const message = toLogError(err).message;` 가 `const message = err instanceof Error ? err.message : String(err);` 로 되돌려져 있다 — 2라운드에서 고친 마스킹(`fff0d14bf`)을 국소적으로 되돌리는 모양이다. 이 세션은 이 파일을 쓰지 않았고, 병렬 fan-out 중인 다른 reviewer 의 뮤테이션 테스트가 원복되지 않은 채 남았을 가능성이 있다(같은 워크트리를 동시에 여러 reviewer 가 읽는 상황). `git checkout`/`git restore` 는 금지 규약이라 되돌리지 않았다. 이 보고서의 위 분석은 `git diff`/`git show HEAD` 기준 커밋된 소스(=prompt 의 diff 와 일치)를 대상으로 했으며, 이 미커밋 라인 자체는 분석에 반영하지 않았다.
  - 제안: 오케스트레이터가 라운드 종료 전에 `git status --short` 로 이 잔여물을 확인하고, 다른 reviewer 의 활성 작업이 아님을 확인한 뒤 정리할 것.

## 긍정적으로 확인된 점 (참고)

- 새 분기들은 각 파일이 이미 갖고 있던 에러 처리 관용구(`buildPreflightErrorOutput`, `toLogError`, `sanitizeMessage`, `clampMessage`, `CONNECTION_TEST_CODES.*`, `IntegrationError`)를 그대로 재사용해 새 매직 문자열·새 헬퍼를 도입하지 않았다.
- `database-query.handler.ts` 의 `catch` 블록은 `const detail = err instanceof Error ? err.message : String(err);` 를 진입 직후 한 번만 계산해 `logger.warn`·`sanitizeMessage` 양쪽에서 재사용한다 — 2라운드에서 지적된 "동일 표현식 이중 계산" 스타일 불일치(`review/code/2026/09/20/10_09_56` WARNING)가 실제로 해소되어 있다.
- `http-redirect.ts` 신설 함수들의 JSDoc 이 "판정만 사유가 된다 / 판정 아닌 오류는 그대로 던진다"를 명시해 계약이 코드와 나란히 읽힌다.
- 5개 spec 파일의 mock 패턴(`jest.requireActual` 로 `SsrfBlockedError` 실물을 보존하고 가드 함수만 `jest.fn`)과 새 테스트명(한국어 서술형, "가드가 판정 아닌 오류를 던지면 …")이 일관적이다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커 항목이 `[x]` 로 갱신되고 해소 근거(뮤턴트 다섯 · 실측)가 남아 다음 사람이 이 변경의 스코프를 추적할 수 있다.

## 뮤테이션/재현 검증

가설 확인을 위한 코드 수정은 하지 않았다 — 저장소는 `Read`/`Grep`/`git diff`/`git log` 로만 조회했다. 위 세 번째 발견사항(미커밋 변경)은 내가 만든 것이 아니며, 원복도 시도하지 않았다(위 규약: `git checkout`/`git restore` 금지, 확신 없으면 보고). `git status --short` 로 확인한 시점 기준 다른 파일 변경은 없었다(신규 리뷰 산출물 디렉터리 `review/code/2026/09/20/10_38_57/` 는 이번 라운드 자체의 것).

## 요약

코드 변경 자체(파일 1~10)는 이미 두 라운드의 리뷰·수정을 거친 뒤의 안정된 상태이며, 판정/비판정 분기가 각 파일의 기존 에러 처리 관용구·상수·테스트 패턴을 그대로 따르고 있어 가독성·네이밍·함수 길이·중첩·매직넘버 어느 측면에서도 새로운 결함이 없다. 유일하게 남는 것은 "판정 vs 비판정" 분류 로직과 근거 주석이 4~5개 파일에 반복되는 점인데, 이는 두 선행 라운드에서 이미 식별되어 명시적 트레이드오프 근거와 함께 후속 트래커 항목(공용 가드 위치 이동)으로 유예된 사안이라 이번에 새로 조치를 요구하지 않는다. 별도로, 이 세션이 만들지 않은 미커밋 변경(`http-request.handler.ts` 의 마스킹 되돌림)이 워크트리에 남아 있어 절차상 이상 상태로 보고했다 — 코드 자체의 유지보수성 결함은 아니다.

## 위험도

LOW
