# Cross-Spec 일관성 검토 — `spec/4-nodes/4-integration/` (impl-done)

검토 모드: `--impl-done`, scope=`spec/4-nodes/4-integration/`, diff-base=`origin/main`.
scope 델타는 0개 파일(이 브랜치는 spec 을 바꾸지 않았다) — 코드 전용 PR 이므로 이는 정상이다.
구현 diff(10개 파일, `SsrfBlockedError` 도입으로 "SSRF 가드 판정" 과 "가드의 고장" 을 가르는 변경, `840e8e7f9`+`fff0d14bf`)를 워킹트리에서 직접 확인했다.

## 발견사항

- **[WARNING]** `INTEGRATION_CALL_FAILED` 트리거 목록이 새 코드 경로를 반영하지 못해 세 문서에서 나란히 stale
  - target 위치: `spec/4-nodes/4-integration/0-common.md` §4.2 (85행) / `1-http-request.md` §4 step 8(96행)·§6(338행 `INTEGRATION_*` 행) / `2-database-query.md` §6.2(344행)
  - 충돌 대상: 동일 target 영역 내 세 문서가 서로 "완결된 열거"로 읽히는데, 실제로는 병합된 코드(`http-request.handler.ts` 354-578행, `database-query.handler.ts` 262-345행)가 네 번째 트리거를 추가했다.
  - 상세:
    - `0-common.md` §4.2 는 `INTEGRATION_CALL_FAILED` 를 "**`IntegrationError` 가 아닌 throw 의 기본 코드** (`toLogError` fallback)" 로 정의한다. 그런데 병합된 코드는 SSRF 가드가 `SsrfBlockedError` 가 아닌 오류(가드 자체의 고장)를 던지면 `new IntegrationError('INTEGRATION_CALL_FAILED', sanitizeMessage(detail))` 를 **명시적으로 구성해 던진다** — `IntegrationError` "가 아닌" 경로가 아니라 `IntegrationError` **인** 새 경로다. 코드 값은 같지만 발생 메커니즘 서술이 더 이상 전체를 덮지 못한다.
    - `1-http-request.md` §6 의 `INTEGRATION_*` 행은 트리거를 `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED` / `INTEGRATION_INCOMPLETE` / `INTEGRATION_AUTH_UNSUPPORTED` / `INTEGRATION_CALL_FAILED`(integrationId 부재 fallback) "**모두 본 경로로 surface**" 라고 닫힌 열거로 서술하는데, 이제 "SSRF 가드가 판정 아닌 오류를 던졌을 때"도 같은 코드로 이 경로에 합류한다 — 열거에 없다.
    - 같은 문서 §4 step 8 은 "실패 시 catch 후 §5.3 (`output.error.code = 'HTTP_BLOCKED'`) 라우팅" 이라고 **조건 없이** 적어, 방금 병합된 수정이 정확히 반증한 옛 동작(가드가 무엇을 던지든 `HTTP_BLOCKED`)을 여전히 문면으로 서술한다. §6 의 더 정확한 "SSRF 차단(호스트 검증…)" 정의와도 같은 문서 안에서 어긋난다.
    - `2-database-query.md` §6.2 도 동일 패턴 — `INTEGRATION_CALL_FAILED` 행이 "integrationId 부재 fallback" 만 열거하고 "SSRF 가드 고장" 트리거가 빠져 있다.
    - 기능적으로는 깨지지 않는다(코드 값 자체는 이미 spec 이 정의한 "분류되지 않은 실패" 의미와 부합하고, `chat-channel-adapter.md` 등 소비자가 `INTEGRATION_CALL_FAILED` 를 개별 열거하지 않으므로 하위 계약에 영향 없음) — 그래서 CRITICAL 이 아니라 WARNING이다. 다만 세 문서가 "닫힌 열거"체로 쓰여 있어, 이 표만 보고 판단하는 다음 리더(혹은 spec-coverage 감사)는 이 트리거의 존재를 알 수 없다.
  - 제안: `project-planner` 턴에서 세 문서에 "SSRF 가드가 판정(`SsrfBlockedError`) 아닌 오류를 던졌을 때" 한 줄씩 추가. 이 작업은 이미 `plan/in-progress/ssrf-catch-instanceof.md` 의 `--impl-prep` INFO 항목("`INTEGRATION_CALL_FAILED` 의 새 트리거를 spec 표에 한 줄(planner)")으로 스스로 등재돼 있다 — 아직 미이행 상태이므로 이 검토가 그 잔여 항목을 재확인한 것이다. `트래커 해소` 전에 처리 권장.

- **[INFO]** `1-http-request.md` frontmatter `code:` 목록에 `http-redirect.ts` 부재
  - target 위치: `spec/4-nodes/4-integration/1-http-request.md` frontmatter `code:` (212-216행)
  - 충돌 대상: 실제 워킹트리 `codebase/backend/src/nodes/integration/http-request/http-redirect.ts` (SSRF 판정 분기의 핵심 파일 중 하나, 이번 PR 에서도 수정됨)
  - 상세: frontmatter 는 `http-request.handler.ts` / `http-request.schema.ts` / `http-safety.ts` / `sanitize-response-headers.util.ts` 만 나열한다. `http-redirect.ts` 는 §4 step 9 의 리다이렉트 홉 처리와 이번 SSRF 판정 분기 로직을 담는데도 빠져 있다. 이 결손은 이번 PR 이 만든 것이 아니라 기존 결손이며, 같은 plan 의 `--impl-prep` WARNING(2)로 이미 등재돼 "마무리 커밋에서 등재" 예정이었다.
  - 제안: 위 `INTEGRATION_CALL_FAILED` 표 갱신과 함께 같은 planner 턴에서 `code:` 목록에 `http-redirect.ts` 추가.

## 요약

이번 PR 은 spec 영역(`spec/4-nodes/4-integration/`)을 건드리지 않는 코드 전용 변경(SSRF 가드 소비자 4곳이 "차단 판정"과 "가드 자체의 고장"을 `instanceof SsrfBlockedError` 로 가르도록 정정)이며, 새 코드가 쓰는 `HTTP_BLOCKED`/`DB_HOST_BLOCKED`/`DB_CONNECT_FAILED`/`HTTP_CONNECT_FAILED`/`INTEGRATION_CALL_FAILED` 는 모두 기존 spec 이 이미 정의한 코드값이라 API 계약·데이터 모델·상태 전이·RBAC·계층 책임 어느 축에서도 새로운 충돌은 없다. 다만 `INTEGRATION_CALL_FAILED` 를 "닫힌 열거"로 서술하는 세 문서(`0-common.md` §4.2, `1-http-request.md` §4/§6, `2-database-query.md` §6.2)가 이번에 추가된 트리거를 반영하지 못해 문서 완결성이 실제 구현보다 좁아졌다 — 이는 이미 담당 plan 이 자체 INFO 항목으로 인지·이관해 둔 잔여 작업이므로 새로운 발견이라기보다 미해소 항목의 재확인이다. 병합을 막을 이유는 없으나, 트래커 해소 전 planner 턴으로 세 문서 동기화를 권고한다.

## 위험도

LOW
