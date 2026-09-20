# Rationale 연속성 검토 — spec/4-nodes/4-integration/ (impl-prep, plan: ssrf-catch-instanceof)

## 검토 대상 요약

plan `plan/in-progress/ssrf-catch-instanceof.md` 은 SSRF 가드 소비자 4곳(`http-request.handler.ts` preflight, `http-redirect.ts` `outboundBlockReason`, `database-query.handler.ts`, `database-connection-tester.ts`)의 `catch (err)` 를 `instanceof SsrfBlockedError` 로 좁혀, **가드가 실제로 던진 "판정"만 차단 코드(`HTTP_BLOCKED`/`DB_HOST_BLOCKED`/tester 의 `*_CONNECT_FAILED`)로 옮기고, 판정이 아닌 오류는 각 호출부의 "분류되지 않은 실패" 경로로 승격**하는 코드 리팩터다. `spec_impact: none` — spec 문서 변경 없음.

target 은 `spec/4-nodes/4-integration/` 전체 번들(+ 교차 참조된 `spec/2-navigation/4-integration.md`, `spec/1-data-model.md`, `spec/0-overview.md` 등의 Rationale 발췌)이다. 아래는 이 spec 들의 `## Rationale`/본문이 이미 확립한 결정과 plan 의 방향이 정합하는지를 점검한 결과다.

## 발견사항

없음 — CRITICAL/WARNING 없음. 아래는 정합성 확인 근거(INFO 성격)만 남긴다.

- **[INFO] plan 은 기존 Rationale 이 이미 확립한 "판정 vs 그 외" 경계를 코드에 뒤늦게 맞추는 것 — 새 결정이 아니다**
  - target 위치: `spec/4-nodes/4-integration/2-database-query.md` §6.2 `DB_HOST_BLOCKED` 행("SSRF 가드가 `credentials.host` 를 ... 로 해석해 차단"), §4 SSRF 가드 문단; `1-http-request.md` §6 `HTTP_BLOCKED` 행, §8.3; `spec/2-navigation/4-integration.md` §5.3/§5.4("host 가 SSRF 가드에 차단 → `HTTP_BLOCKED`/`DB_HOST_BLOCKED`", "그 밖(네트워크·타임아웃·TLS 등) → `HTTP_CONNECT_FAILED`/`DB_CONNECT_FAILED`")
  - 과거 결정 출처:
    1. `2-database-query.md` `## Rationale` → "`DB_HOST_BLOCKED` 전용 SSRF 차단 코드 신설 (2026-06-12, refactor 04 C-3 후속)" — SSRF 차단을 다른 통합 실패와 "구분해 분기"하기 위해 전용 코드를 신설했다고 명시.
    2. `1-http-request.md` §8.3 "SSRF 차단 메시지 일반화 — 정찰 면 축소 (2026-07-05)" — "redirect 대상·한도 초과 SSRF 차단도 `HTTP_BLOCKED` 로 라우팅한다 — 종전 redirect hop 의 SSRF 예외가 바깥 일반 catch로 떨어져 오분류(`HTTP_TRANSPORT_FAILED`/`INTEGRATION_CALL_FAILED`)되던 것을 ... 정정."
    3. `spec/2-navigation/4-integration.md` `## Rationale` → "연결 테스트 — Database·HTTP 는 실제로 접속한다 (2026-09-19)" — `DB_HOST_BLOCKED`/`HTTP_BLOCKED` 는 호스트 차단 전용, 나머지(`DB_CONNECT_FAILED`/`HTTP_CONNECT_FAILED` 등)는 "연결 테스트 전용" 코드로 명확히 분리.
  - 상세: 세 Rationale 모두 "SSRF 판정(차단)"과 "그 외 실패(네트워크·transport·일반 예외)"를 **서로 다른 코드로 분기**하는 것이 합의된 설계다. 그런데 plan 문서가 기술하는 현재 구현(4개 호출부의 `catch (err)` → 무조건 차단 코드로 승격)은 이 분리를 흐리고 있었다 — 즉 **코드가 spec 이 이미 정한 경계에서 drift 된 상태**였다. plan 의 `instanceof SsrfBlockedError` 좁히기는 이 세 Rationale 이 요구하는 경계를 실제로 강제하는 방향이며, 새 대안을 도입하거나 기존 결정을 뒤집는 것이 아니다.
  - 제안: 결함 없음. 다만 구현 PR/커밋 본문에 위 세 Rationale(특히 `2-database-query.md` "`DB_HOST_BLOCKED` 전용 SSRF 차단 코드 신설"과 `1-http-request.md` §8.3)을 근거로 인용하면, 이후 리뷰어가 "왜 판정만 골라내는가"를 spec 에서 바로 추적할 수 있다 — 필수는 아님.

- **[INFO] connection-tester 두 곳(`http-connection-tester.ts`/`database-connection-tester.ts`)의 no-throw 계약은 `spec/2-navigation/4-integration.md` §5.3/§5.4 의 "결과 코드" 모델과 일치**
  - target 위치: `spec/2-navigation/4-integration.md` §5.3 HTTP/REST, §5.4 Database ("결과: 성공 → success:true / host 차단 → `*_BLOCKED` / 그 밖 → `*_CONNECT_FAILED`")
  - 과거 결정 출처: 같은 파일 `## Rationale` "연결 테스트 — Database·HTTP 는 실제로 접속한다" + `pingConnection()` 의 "never throws + 메시지만 surface" 계약(§Rationale "transport 실패 카운터 제외")과 짝을 이루는 설계 원칙.
  - 상세: plan 이 `database-connection-tester.ts` JSDoc("던지지 않는다 — 결과를 돌려준다")과 `http-connection-tester.ts` 의 try 안쪽 이동을 요구하는 것은, §5.3/§5.4 가 "결과(코드)를 반환"하는 모델로 tester 를 문서화한 것과 정확히 대응한다. `SsrfBlockedError` → 차단 코드, 그 외 → `*_CONNECT_FAILED` 라는 분기 자체도 §5.3/§5.4 표와 문자 그대로 일치.
  - 제안: 결함 없음. 확인만.

- **[INFO] SMTP 가드(이미 분리됨)와의 정합 — plan 이 인용한 선례가 spec 상으로도 확인됨**
  - target 위치: `3-send-email.md` §4 step 6-7, §5.3 註("`execute()` 의 try/catch 안에서 `IntegrationError` 가 catch 된 경우에만 그 code 가 직접 노출된다 ... 그 외 catch 분기의 모든 throw ... 는 `EMAIL_SEND_FAILED` 로 mapping")
  - 상세: plan 이 "SMTP 가드만 이미 가른다"고 전제한 부분이 spec 문서와도 일치 — 별도 조치 불필요.

## 컨텍스트 예산 갭 (참고, 판정에 영향 없음)

번들 프롬프트에서 `spec/5-system/4-execution-engine.md`(§10 Integration Handler 계약의 원 출처), `spec/5-system/3-error-handling.md`, `spec/2-navigation/4-integration.md` 등 다수가 "컨텍스트 예산 초과"로 절단되어 있었다. `spec/2-navigation/4-integration.md` 는 이번 판정에 핵심적이라 원본 파일(`spec/2-navigation/4-integration.md`, 1829줄)을 직접 열어 §5.3/§5.4/`## Rationale` 을 확인했다. `execution-engine.md`/`error-handling.md` 는 이번 plan 의 좁은 스코프(가드 소비자의 catch 세분화, 가드·`port:'error'` 라우팅 자체는 비대상)와 직접 충돌 가능성이 낮다고 판단해 전문을 열지 않았다 — 이 판단이 근거가 되어야 할 만큼 execution-engine 층의 Rationale 이 관여한다면 재검토가 필요하다.

## 요약

plan `ssrf-catch-instanceof` 이 다루는 4개 호출부 catch 세분화는 `spec/4-nodes/4-integration/` 및 `spec/2-navigation/4-integration.md` 가 이미 명문화한 "SSRF 판정 코드(HTTP_BLOCKED/DB_HOST_BLOCKED/tester 차단 코드) vs 그 외 실패(INTEGRATION_CALL_FAILED/HTTP_TRANSPORT_FAILED/DB_CONNECT_FAILED/HTTP_CONNECT_FAILED)" 분리 원칙과 완전히 정합한다. 오히려 현재 구현(무조건 차단으로 승격)이 2026-06-12/2026-07-05/2026-09-19 세 차례에 걸쳐 확립된 이 경계에서 drift 된 상태였고, plan 은 그 drift 를 되돌리는 방향이다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 중 어느 것도 발견되지 않았다. `spec_impact: none` 판단도 타당하다 — 문서화된 계약(코드 이름·분기 조건)은 그대로이고 구현만 계약에 맞춰진다.

## 위험도

NONE
