# Rationale 연속성 검토 — spec/5-system/ (--impl-prep)

## 범위 및 방법

전체로 로드된 3개 파일(`spec/5-system/1-auth.md`, `2-api-convention.md`, `3-error-handling.md`)의 본문을 각 파일 자신의 `## Rationale` 절, 그리고 함께 번들된 관련 spec(`0-overview.md`, `1-data-model.md`, `2-navigation/*.md`, `3-workflow-editor/0-canvas.md` 등)의 `## Rationale` 발췌와 대조했다. 예산 초과로 본문이 생략된 15개 `5-system/*.md` 파일(`4-execution-engine.md`·`6-websocket-protocol.md`·`14-external-interaction-api.md` 등)은 이 프롬프트에 포함되지 않았으므로 그 안의 Rationale 연속성은 이번 패스에서 판정할 수 없다 — "포함 안 됨"을 "문제 없음"의 근거로 사용하지 않았다.

## 발견사항

없음.

전체로 로드된 3개 파일은 이례적일 만큼 조밀하게 자기 참조적이다 — 각 결정 지점마다 "기각된 대안"과 그 사유가 본문 또는 Rationale 절에 명시돼 있고(예: 1-auth.md의 1.1.B-1~1.1.B-6, 1.4.D, 1.4.E, 1.4.F, 2.3.A~2.3.D), 과거 서술과 구현이 어긋났던 지점(§2.3 재인증 흐름, §3.2 멤버 관리 Admin 열, WS/EIA 에러 코드 카탈로그 완결성)은 번복이 아니라 "정합화(정정)"로 명시적으로 구분해 기록되어 있다. 다음 항목을 특히 점검했으나 모두 정합 상태였다:

- **1.4.2 WebAuthn 우선/TOTP fallback 금지** ↔ Rationale 1.4.D: 본문 규칙과 근거가 일치, 기각된 "자동 TOTP 노출" 대안이 되살아나지 않음.
- **§2.3 강제 종료 재인증(password OR TOTP)** ↔ Rationale 1.1.B-4·2.3.D: 과거 "WebAuthn/이메일 OTP 대체" 서술이 미구현 오기였음을 명시하고 실제 구현(`verifyReauth`)에 정렬한 정정으로 기록됨 — 새 Rationale 없이 조용히 뒤집힌 결정이 아님.
- **§3.2 RBAC 매트릭스 "멤버 관리" Admin=CRUD** ↔ Rationale "§3.2 정정(2026-07-28)": 실측(코드) 기반 정정이 본문에 반영되어 있고 기각된 세분화 대안(초대/제거/역할변경 행 분리)도 이유와 함께 남아 있음.
- **counter 역행 시 credential 즉시 삭제(suspend 미채택)** ↔ Rationale 1.4.E: 본문·Rationale 일치, "suspend" 대안이 재도입되지 않음.
- **WebAuthn 미설정 시 boot 거부하지 않음** ↔ "Production fail-closed 가드"(JWT_SECRET/ENCRYPTION_KEY/MCP/OAUTH_STUB/LLM_STUB): 서로 다른 축(구조적 invariant vs 선택적 기능)이라는 구분이 Rationale에 명시돼 있어 fail-closed 원칙의 예외가 아니라 의도된 별개 결정.
- **API 규약 §5.2 vs 비-페이징 `{data:{items}}`**: 형태가 다른 이유가 Rationale에 명시되고 "bare-array 통일"이 기각이 아니라 defer로 정확히 구분되어 있음 — 향후 이 defer가 별다른 새 Rationale 없이 "통일"로 조용히 되돌아가면 그때가 WARNING 대상.
- **에러 코드 카탈로그 완결성(§1.2.1/§1.8/§1.9)**: 여러 차례의 "후속 완결성 pass"가 서로의 결정을 뒤집지 않고 누적 등재만 하고 있음을 확인 — 번복 아님.

번들에 포함된 다른 영역 spec(`0-overview.md`, `1-data-model.md`, `2-navigation/1-workflow-list.md`·`2-trigger-list.md`·`4-integration.md`·`9-user-profile.md`, `3-workflow-editor/0-canvas.md`)의 Rationale 발췌에서도 대상 3개 파일의 결정(JWT/`activeWorkspaceId`, 세션 재인증, RBAC, rate limit, 에러 코드 레이어 분리)과 상충하는 재도입·무근거 번복은 발견되지 않았다 — 발췌 대부분이 auth/api-convention/error-handling과 도메인이 겹치지 않는 독립 결정(Cafe24 OAuth, 캔버스 UX, 워크플로 목록 필터 등)이었다.

## 요약

이번 --impl-prep 패스에서 전체 본문을 확인할 수 있었던 `1-auth.md`·`2-api-convention.md`·`3-error-handling.md`는 자체 Rationale 및 관련 spec의 Rationale과 충돌하는 지점을 발견하지 못했다. 문서들은 과거 결정의 번복 시 반드시 "정합화" 사유를 남기는 관행이 이미 정착되어 있어, 기각된 대안의 무근거 재도입이나 합의 원칙의 우회 사례가 보이지 않는다. 다만 컨텍스트 예산 초과로 본문이 생략된 15개 `5-system/*.md` 파일(특히 `4-execution-engine.md`·`6-websocket-protocol.md`·`14-external-interaction-api.md`처럼 다른 파일에서 빈번히 참조되는 SoT 문서)은 이번 패스로 커버되지 않았으므로, 그 파일들에 대한 변경이 실제 impl 대상이라면 별도 패스(파일 단위 직접 Read)로 재검토가 필요하다.

## 위험도
NONE
