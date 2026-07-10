### 발견사항

- **[INFO]** `INVALID_PASSWORD` 의 §1.3→§1.2 재배치 근거가 Rationale 신규 bullet 에 명시적으로 없음
  - target 위치: `plan/in-progress/catalog-residual-codes.md` 변경 2c·2d (`spec/5-system/3-error-handling.md` §1.2.1 하단 주석 정정 + Rationale 신규 bullet)
  - 과거 결정 출처: `spec/5-system/3-error-handling.md` §1.2.1 현재 본문(정정 대상) — "`INVALID_PASSWORD`(...비밀번호 변경, `users.service.ts changePassword`, **§1.3 별도 등재 예정**)"
  - 상세: #887 이 남긴 기존 주석은 `INVALID_PASSWORD` 를 §1.3(유효성 검증 에러)에 등재할 예정이라고 명시했었다. target 은 이를 §1.2(인증/인가 에러)로 정정한다. 이 정정 자체는 근거가 충분하다 — `INVALID_PASSWORD` 는 401(`UnauthorizedException`)이고 §1.2 표는 401/403/423 코드 전용, §1.3 표는 400/404/409/422 코드만 담아 401 이 하나도 없다. 즉 원래 "§1.3 예정" 메모가 도리어 카탈로그의 HTTP-status 기반 섹션 구조와 어긋나 있었다. 다만 target 의 Rationale 신규 bullet(2d) 은 배치 결과("§1.2 에 배치")만 적고 **"왜 §1.3 이 아니라 §1.2 인가"(401 status 정합)를 명시하지 않는다** — `PASSWORD_REQUIRED` 의 §1.2.1 배치는 "핵심 배치 결정" 단락으로 상세히 근거를 남기면서, 같은 pass 에서 함께 일어나는 §1.3→§1.2 번복은 상대적으로 근거가 옅다.
  - 제안: 2d Rationale bullet 에 "`INVALID_PASSWORD`(401)는 §1.3(400/404/409/422 전용)이 아니라 §1.2(401/403/423 전용)의 HTTP-status 구조에 부합해 배치를 정정했다" 한 문장을 추가해, 향후 재검토자가 "§1.3 예정" 문구가 **번복된 결정이 아니라 애초에 섹션 구조와 불일치했던 placeholder 오류였다**는 것을 바로 알 수 있게 한다.

- **[INFO]** `error-codes-catalog-sot.md` 후속 체크리스트가 3코드 중 2코드만 나열
  - target 위치: `plan/in-progress/catalog-residual-codes.md` 배경 단락 ("#887 §1.2.1 주석·`error-codes-catalog-sot.md §후속`이 이 3코드를 deferred 로 지목")
  - 과거 결정 출처: `plan/in-progress/error-codes-catalog-sot.md` §후속 체크리스트 (L56) — "`NOT_A_MEMBER`(403)·`INVALID_PASSWORD`(change-password) 도 §1 미등재 — 동일 완결성 pass 에서 흡수"
  - 상세: 실제 spec 소스(`3-error-handling.md` §1.2.1 하단 주석)는 3코드(`INVALID_PASSWORD`·`NOT_A_MEMBER`·`PASSWORD_REQUIRED`)를 deferred 로 지목하지만, 자매 plan `error-codes-catalog-sot.md` 의 추적 체크리스트는 2코드(`NOT_A_MEMBER`·`INVALID_PASSWORD`)만 나열하고 `PASSWORD_REQUIRED` 가 빠져 있다. Rationale 자체의 충돌은 아니고(두 출처 모두 동일 사실을 가리키되 한쪽이 불완전) 결정 번복도 아니지만, target 워크플로 체크리스트가 "`error-codes-catalog-sot.md §후속` L56 체크박스 갱신" 을 항목으로 두고 있어 그 문서를 그대로 체크 완료 처리하면 `PASSWORD_REQUIRED` 흡수 사실이 그 plan 문서에는 기록되지 않을 위험이 있다.
  - 제안: `error-codes-catalog-sot.md` L56 체크박스를 닫을 때 텍스트에 `PASSWORD_REQUIRED` 를 함께 언급해 두 문서 간 추적 정합을 맞춘다 (target 워크플로 체크리스트에 이미 "L56 체크박스 갱신" 항목이 있으므로 그 시점에 반영 가능).

### 요약
target 이 다루는 세 코드(`NOT_A_MEMBER`·`INVALID_PASSWORD`·`PASSWORD_REQUIRED`)의 배치는 코드 ground truth(HTTP status·발행처)와 기존 카탈로그의 섹션 구조(§1.2=401/403/423 인증·인가, §1.2.1=2FA/WebAuthn/재인증 전용, §1.3=400/404/409/422 유효성)에 정확히 부합하며, 검증 결과 어떤 항목도 기존 `## Rationale` 에서 명시적으로 기각된 대안을 재도입하거나 합의 원칙(등재만·정의 SoT 보존, TOKEN_INVALID 인라인 cross-ref 선례, UPPER_SNAKE_CASE 명명 규율)을 위반하지 않는다. `PASSWORD_REQUIRED` 를 형제 코드 `PASSWORD_INVALID` 와 동일한 §1.2.1 에 배치하는 핵심 결정은 이미 이전 consistency-check 라운드(14_53_01)에서 CRITICAL 로 지적되어 정정된 이력이 있고, 이번 draft 에는 그 정정이 온전히 반영돼 있다(잔존하는 구 배치 언급 없음). `INVALID_PASSWORD` 의 §1.3→§1.2 재배치는 결정 번복처럼 보일 수 있으나 실제로는 원래 "§1.3 예정" 메모가 섹션의 HTTP-status 구조와 애초에 어긋난 placeholder 오류였음을 바로잡는 것으로, target 이 이를 "정정"으로 명시하고 있어 심각도는 낮다 — 다만 그 근거를 Rationale bullet 에 한 문장으로 명문화하면 향후 재검토 비용이 줄어든다. 발견된 두 항목은 모두 INFO 수준의 보완 제안이며 CRITICAL/WARNING 급 위반은 없다.

### 위험도
LOW
