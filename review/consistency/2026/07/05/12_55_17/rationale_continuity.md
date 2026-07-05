# Rationale 연속성 검토 — `spec/4-nodes/4-integration/`

검토 모드: `--impl-prep` (구현 착수 전 검토, scope=`spec/4-nodes/4-integration/`)

## 컨텍스트

target 문서 번들(`0-common.md` / `1-http-request.md` / `2-database-query.md` / `3-send-email.md` / `4-cafe24.md`)은 현재 저장소 `spec/4-nodes/4-integration/` 의 실제 내용과 동일하다 (payload 는 이번 작업이 착수하기 **직전** baseline). 작업 슬러그(`ssrf-error-generalize`)와 `plan/in-progress/http-ssrf-all-auth-followups.md` 의 미완료 항목("SSRF 에러 메시지 클라이언트 일반화")을 대조하면, 이번 작업의 목적은 정확히 아래 발견사항 1 이 지적하는 갭을 closing 하는 것이다. 즉 이 검토는 "target 이 이미 과거 결정을 어겼다" 는 사후 확인이라기보다, **착수 전 시점에 이미 존재하는 self-contradiction 을 구현 대상 스코프 산정에 반영해야 한다**는 확인이다.

## 발견사항

### [CRITICAL] HTTP Request `HTTP_BLOCKED` / Transport 실패 경로가 이미 확정된 "SSRF 메시지 일반화" Rationale 을 위반 중

- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md` §4 step 8 (SSRF 가드 설명), §5.3.1/§5.3.2 의 `output.error.details.url` 필드 정의, §6 에러 코드 표 `HTTP_BLOCKED` 행
- **과거 결정 출처**: `spec/4-nodes/4-integration/2-database-query.md` `## Rationale` → "`DB_HOST_BLOCKED` 전용 SSRF 차단 코드 신설 (2026-06-12, refactor 04 C-3 후속)" 항의 "메시지 일반화" 서브섹션: *"클라이언트 노출 메시지는 차단된 host/IP 를 포함하지 않는다 (정찰면 축소). 차단 상세(원본 host)는 `logUsage` 서버 활동 로그에만 남긴다. **동일 원칙을 HTTP/Email SSRF 메시지 일반화 follow-up 과 공유한다**."`
- **상세**: DB Query 문서는 이미 "SSRF 차단 시 client-facing 메시지에 host/IP 를 넣지 않는다"를 **HTTP/Email 에도 적용될 공유 원칙**으로 못박았다(2026-06-12). 그러나 HTTP Request 문서(§4 step 8, §5.3, §6)는 이 원칙을 아직 반영하지 않은 채 `output.error.details.url` 을 "실제 요청한 URL (sanitize 적용 — 자격증명 제거)"로만 규정한다 — 이 sanitize 는 `sanitizeUrlCredentials`(userinfo/쿼리 자격증명 제거)이지 host/IP 제거가 아니다. `HTTP_BLOCKED` 는 `HTTP_TRANSPORT_FAILED`/`HTTP_4XX`/`HTTP_5XX` 와 같은 §5.3 테이블 행을 공유하므로, 스펙 문면대로라면 SSRF 로 차단된 요청도 `output.error.details.url` 에 **차단된 실제 host/IP** (예: `http://169.254.169.254/latest/meta-data`)가 그대로 노출된다. 코드 레벨 근거도 동일 방향이다 — 공용 가드 `codebase/backend/src/nodes/integration/http-request/http-safety.ts` 의 `assertSafeOutboundUrl`/`assertSafeOutboundHostResolved` 는 `SSRF_BLOCKED: hostname "${parsed.hostname}" resolves to a restricted network range` 형태로 **차단된 hostname/IP 를 메시지 문자열에 직접 삽입**해 throw 한다. 이 메시지는 HTTP/DB/Email 세 핸들러가 공유하는 단일 유틸이므로, DB Query 는 이미 승격 코드(`DB_HOST_BLOCKED`)로 이 원문 메시지를 감춘 반면(§4 SSRF 가드 절 "클라이언트 노출 메시지는 차단 host/IP 를 포함하지 않는 일반화 문구") HTTP Request 는 아직 원문을 그대로 흘려보낼 개연성이 spec 문면상 남아 있다. `plan/in-progress/http-ssrf-all-auth-followups.md` 의 미체크 항목 "SSRF 에러 메시지 클라이언트 일반화"("http-safety.ts 의 SSRF_BLOCKED: hostname "..." 메시지가 차단 host/IP 를 output.error.message 로 노출(정찰 면)")가 이 갭을 정확히 추적하고 있어, 이는 우연한 문서 누락이 아니라 **이미 인지되고 합의됐으나 아직 spec/코드 양쪽에 반영되지 않은 확정 결정**이다.
- **제안**: 본 작업(`ssrf-error-generalize`)에서 `1-http-request.md` §4 step 8·§5.3.1(4xx/5xx 는 SSRF 와 무관하므로 영향 없음)·§5.3.2·§6 에 다음을 반영: (a) `HTTP_BLOCKED` 케이스의 `output.error.message`/`output.error.details.url` 을 host/IP 미포함 일반화 문구로 명시(예: `"Request blocked by SSRF policy"`), 원본 host 는 활동 로그(Usage log, `integration` 인증 한정)에만 보존, (b) `3-send-email.md` 의 `EMAIL_HOST_BLOCKED` 에도 동일 언어로 명시 확인(현재는 §8.0 이 "SoT 는 `2-navigation/4-integration.md`" 라고만 참조하고 정작 send-email 자신의 §5.3 표 1 행에는 message 일반화 여부가 명시돼 있지 않음 — 발견사항 2 참조), (c) 공용 `http-safety.ts` 의 `SSRF_BLOCKED: hostname "..."` throw 메시지 자체를 일반화하거나, 세 핸들러가 catch 시 공통으로 host/IP 를 strip 하는 지점을 spec 에 SoT 로 명시. DB Query 의 "메시지 일반화" Rationale 항목을 정본으로 삼아 HTTP/Email 문서에서 명시적으로 인용하는 것을 권장 (현재 인용이 단방향 — DB → HTTP/Email 공유 선언은 있으나 HTTP/Email 쪽에서 back-reference 가 없음).

### [WARNING] Send Email `EMAIL_HOST_BLOCKED` 의 메시지 일반화 여부가 자체 문서에 명시되지 않음 (간접 참조만 존재)

- **target 위치**: `spec/4-nodes/4-integration/3-send-email.md` §5.3 표 1 (`EMAIL_HOST_BLOCKED` 행), §8.0 Rationale
- **과거 결정 출처**: 동일하게 `2-database-query.md` Rationale "메시지 일반화" 서브섹션, 그리고 `spec/2-navigation/4-integration.md` `## Rationale` → "SMTP SSRF 가드를 http/db 와 동일 `ALLOW_PRIVATE_HOST_TARGETS` 로 통일" 항 (플래그·코드명 근거만 다루고 메시지 내용 일반화는 언급 안 함)
- **상세**: `3-send-email.md` §8.0 은 "코드명(`EMAIL_HOST_BLOCKED`) 채택 근거 … 는 `2-navigation/4-integration.md` Rationale 이 SoT" 라고 참조를 걸어두었으나, 정작 그 SoT 문서(`2-navigation/4-integration.md` "SMTP SSRF 가드를…" 항)에도 "메시지에 host 를 넣지 않는다" 는 서술이 없다 — 코드명·플래그 재사용 근거만 있다. `2-database-query.md` 의 "메시지 일반화" 결정이 send-email 문서 어디에도 명시적으로 상속되지 않아, DB Query 문서만 읽은 개발자와 Send Email 문서만 읽은 개발자가 서로 다른 결론(전자는 일반화 의무, 후자는 불명확)에 도달할 위험이 있다.
- **제안**: `3-send-email.md` §5.3 표 1 의 `EMAIL_HOST_BLOCKED` 행에 "클라이언트 노출 메시지는 차단 host 를 포함하지 않는 일반화 문구" 를 명시하고, `2-database-query.md` 의 "메시지 일반화" Rationale 항을 직접 인용하는 cross-link 을 추가.

### [INFO] 발견사항 1·2 는 "합의된 원칙 위반"이 아니라 "합의는 됐으나 spec 반영이 지연된 상태" — Rationale 자체는 정합적

- **target 위치**: 전체 검토 대상 3개 문서 (`1-http-request.md` / `2-database-query.md` / `3-send-email.md`)
- **과거 결정 출처**: `2-database-query.md` Rationale + `plan/in-progress/http-ssrf-all-auth-followups.md`
- **상세**: 이는 "기각된 대안의 재도입" 이나 "결정의 무근거 번복" 유형이 아니다 — DB Query 의 Rationale 이 이미 "HTTP/Email 도 같은 원칙을 따라야 한다"고 명시했고, plan 파일이 그 후속작업을 별도 항목으로 인지·추적하고 있다. 즉 본 작업(ssrf-error-generalize)이 바로 그 갭을 메우는 작업이므로, 이는 새로 발견된 모순이 아니라 **이미 확정된 결정을 아직 구현/문서화하지 않은 상태**다. 다만 `--impl-prep` 검토 시점에 이 갭이 spec 본문에 아직 남아 있으므로, 구현자가 "HTTP/Email 은 지금 상태로 이미 충분하다"고 오판하지 않도록 명시적으로 짚어둔다.
- **제안**: 구현 완료 후 `1-http-request.md` §4/§5.3/§6, `3-send-email.md` §5.3/§8.0 을 갱신하면서 `plan/in-progress/http-ssrf-all-auth-followups.md` 의 해당 체크박스를 함께 닫을 것. 새 Rationale 이 필요하다면 (예: 일반화 문구의 정확한 표현, 로그 보존 범위) `1-http-request.md` 자체 `## Rationale` §8.2 뒤에 서브 항목으로 추가해 DB Query 항과 대칭을 이루게 할 것.

### [INFO] `output.error.details.url`/`method` 필드 정의가 §5.3 전체(4xx/5xx/Transport/SSRF)에 단일 서술로 뭉쳐 있어 SSRF 케이스만의 예외를 표현할 자리가 없음

- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md` §5.3.1·§5.3.2 필드 표, §6 에러 코드 표
- **과거 결정 출처**: `2-database-query.md` Rationale "메시지 일반화" (HTTP 케이스의 표 구조적 갭이 문제의 근본 원인)
- **상세**: 현재 §5.3 은 4xx/5xx 응답(§5.3.1)과 Transport 실패(§5.3.2) 두 하위 케이스만 명시적 JSON 예시를 갖고, `HTTP_BLOCKED` 는 §6 표 안에 "SSRF 차단 … 종전 throw 였으나 D4 이후 본 경로"로만 서술되어 자체 JSON 예시·필드 표가 없다. 이 구조적 공백이 발견사항 1 이 지적한 누락의 표면적 원인이기도 하다 — SSRF 차단 케이스 전용 서브섹션(예: §5.3.3)이 없어 "이 케이스만 details.url 을 다르게 채운다"는 예외를 문서 구조상 넣을 자리가 마땅치 않았다.
- **제안**: `2-database-query.md` §5.3 처럼 SSRF 차단을 별도 하위 케이스(예: §5.3.3 SSRF 차단)로 승격하고, 그 안에서만 `output.error.message`/`details` 를 일반화 문구로 정의하면 발견사항 1 의 반영이 구조적으로 자연스러워진다.

## 요약

target 스펙 번들 자체는 최근 결정(D4 error-port 통일, HTTP SSRF 전-인증 적용, `DB_HOST_BLOCKED` 신설, Send Email array-only 등)을 각 문서의 `## Rationale` 에 충실히 기록하고 있어 전반적인 Rationale 연속성은 양호하다. 다만 `2-database-query.md` 의 2026-06-12 Rationale 이 "SSRF 차단 시 client-facing 메시지에 host/IP 를 넣지 않는다"는 원칙을 HTTP/Email 공유 원칙으로 명시적으로 선언했음에도, `1-http-request.md`(및 부분적으로 `3-send-email.md`)의 본문은 아직 이 원칙을 반영하지 않고 있다 — 특히 공용 유틸 `http-safety.ts` 가 실제로 hostname/IP 를 메시지에 삽입해 throw 하는 코드 근거까지 확인돼, 이는 문서만의 누락이 아니라 실제 동작의 미반영이다. 다행히 이 갭은 `plan/in-progress/http-ssrf-all-auth-followups.md` 가 이미 별도 항목으로 추적 중이며 현재 작업(`ssrf-error-generalize`)의 목적과 정확히 일치하므로, "발견되지 않은 모순"이 아니라 "착수 전 시점에 아직 닫히지 않은 이미 합의된 갭"이다. 구현 시 이 갭을 스코프에 포함하고, 완료 후 세 문서(HTTP/DB/Email) 의 Rationale 이 상호 인용하며 대칭을 이루도록 마무리할 것을 권고한다.

## 위험도

MEDIUM
