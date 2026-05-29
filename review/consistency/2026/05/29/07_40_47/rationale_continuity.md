# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-mail-send-status.md`
검토 모드: spec draft (--spec)
검토일: 2026-05-29

---

## 발견사항

### [WARNING] preview-test 의 "외부 호출 없음" 원칙과 이메일 SMTP verify() 수행의 충돌

- **target 위치**: 변경 1 (`spec/2-navigation/4-integration.md §5.5`) — "저장 전 사전 검증(`POST /api/integrations/preview-test`) … 세 경로 모두 동일하게 실제 SMTP `verify()` 를 수행한다"
- **과거 결정 출처**: `spec/2-navigation/4-integration.md §5.8 Cafe24` 블록 (line 608) — "**사전 검증(`POST /api/integrations/preview-test`)**: 저장 전 자격 증명의 구조적 유효성만 검증하며, **외부 네트워크 호출은 수행하지 않는다**"
- **상세**:
  기존 spec 은 `preview-test` endpoint 가 "외부 네트워크 호출을 수행하지 않는다"는 원칙을 Cafe24 §5.8 에 명문화했다. 대비 근거도 같은 항에 담겨 있다 — "막 발급된 토큰이라 refresh 가 불필요". 이 원칙은 Cafe24 만을 위한 것이 아니라 `preview-test` endpoint 의 공통 동작으로 서술되어 있다.

  target draft 의 변경 1 은 Email SMTP 에 대해 `preview-test` 를 포함한 세 경로 모두 실제 SMTP `verify()` 를 수행한다고 변경한다. 이는 "외부 네트워크 호출 없음" 원칙과 직접 충돌한다.

  draft 자체가 이 충돌을 의식하고 있다 — "preview-test 도 외부 호출 수행 (email 은 자격증명 자체가 외부 SMTP 인증을 요구하므로 cafe24 와 달리 구조 검증만으로 불충분)". 이 맥락에서 근거는 **있으나**, 이 근거가 spec 의 기존 Rationale 항을 공식적으로 번복하는 방식으로 기술되어 있지 않다. 기존 `spec/2-navigation/4-integration.md ## Rationale` 에 "preview-test 가 외부 호출을 하지 않는 이유"나 "이메일은 예외" 항목이 없으며, 변경 4 에서 추가되는 Rationale 도 본 draft plan 파일 안에만 표기되고 spec Rationale 에 신규 항 추가 형태로 작성되어 있다.

  단, target draft의 변경 4 가 integration.md `## Rationale` 에 해당 항목 추가를 명시하고 있으므로, draft 자체가 번복을 인식하고 새 Rationale 작성을 포함하고 있다는 점은 고려해야 한다. 다만 새 Rationale 에 "기존 preview-test 의 '외부 호출 없음' 원칙이 이메일에 한해 왜 적용되지 않는가" 를 명시적으로 다루지 않으면 spec 독자가 두 서술 사이에 모순을 보게 된다.
- **제안**:
  변경 4 의 Rationale 항 ("SMTP 연결 테스트를 `verify()` 로 구현") 에 기존 `§5.8 Cafe24` 의 "preview-test 는 외부 호출 없음" 원칙과의 관계를 명시적으로 서술한다. 예: "Cafe24 의 preview-test 는 구조 검증만으로 충분하여 외부 호출을 하지 않는다 (§5.8 기재). Email 은 자격증명(SMTP 서버 인증) 자체가 외부 네트워크 접속 없이는 검증 불가이므로 해당 원칙의 예외로 간주한다." 아울러 §5.8 Cafe24 본문의 "외부 네트워크 호출은 수행하지 않는다" 표현을 "Cafe24 는 외부 네트워크 호출을 수행하지 않는다 (Email 등 자격증명 자체가 네트워크 검증을 요구하는 서비스는 Rationale 참조)" 로 보완하면 두 서술이 공존할 수 있다.

---

### [WARNING] SMTP SSRF 가드를 "HTTP/DB 와 동일 정책"으로 신규 확장 — 기존 Rationale 에 SMTP SSRF 정책이 부재

- **target 위치**: 변경 1 — "SMTP host 는 HTTP Request / Database Query 노드와 **동일한 SSRF 정책**을 따른다", 변경 4 — "SMTP SSRF 가드를 http/db 와 동일 `ALLOW_PRIVATE_HOST_TARGETS` 로 통일 (2026-05-29)"
- **과거 결정 출처**: `spec/4-nodes/4-integration/1-http-request.md` (SSRF 가드 §4) · `spec/5-system/7-llm-client.md §SSRF 가드` · `spec/5-system/11-mcp-client.md §3.2` — 모두 독립적으로 SSRF 가드를 정의했으나 SMTP에 대한 언급이 없다. `spec/4-nodes/4-integration/3-send-email.md` 에는 SSRF 가드가 존재하지 않는다.
- **상세**:
  기존 spec 에는 SMTP 노드에 SSRF 가드를 적용하거나 제외한다는 결정이 모두 없다. 따라서 "기각된 대안 채택" 은 아니다. 그러나 SMTP SSRF 가드 신설은 기존 `spec/4-nodes/4-integration/3-send-email.md` 의 보안 섹션(§1 `> **보안**: nodemailer 의 `path`/`href` 옵션 차단…`)이 커버하지 않은 영역을 처음 도입하는 것으로, 해당 node spec 에도 병행하여 반영이 필요하다.

  draft 의 변경 1 은 `spec/2-navigation/4-integration.md §5.5` 만 수정 대상으로 명시하지만, `spec/4-nodes/4-integration/3-send-email.md` §4 실행 로직(SMTP 발송 단계) 과 §6 에러 코드 표에는 `EMAIL_HOST_BLOCKED` 및 SSRF 가드 적용 사실이 반영되지 않는다. send-email 노드 spec 은 독립 SoT 이므로 integration spec 수정만으로는 일관성이 부족하다.

  또한 연결 테스트 경로 (`preview-test`, `:id/test`, rotate) 와 실제 발송 (`send_email` 노드) 양쪽에 동일 가드를 적용한다고 draft 가 명시하는데, 이 두 경로는 서로 다른 spec 문서(`4-integration.md §5.5` vs `4-nodes/4-integration/3-send-email.md`) 에서 관리된다. 변경 3 (`3-error-handling.md`) 은 `EMAIL_HOST_BLOCKED` 를 Email 행에 추가하나, `3-send-email.md §6` 에는 같은 코드가 추가되어야 한다.
- **제안**:
  (a) `spec/4-nodes/4-integration/3-send-email.md §4` 실행 로직 — SMTP 발송 전 `assertSafeOutboundHost(host)` 단계 명시 (HTTP 노드와 동일 위치 패턴).
  (b) `3-send-email.md §6` 에러 코드 표 — `EMAIL_HOST_BLOCKED` 행 추가.
  (c) `3-send-email.md ## Rationale` 에 SSRF 가드 신설 결정 항 추가 (또는 integration.md Rationale 참조 링크 명시).
  (d) draft 의 "변경 3 side-effect" 항에 send-email 노드 spec 수정 필요성을 명시한다.

---

### [INFO] `SMTP_SEND_FAILED` → `EMAIL_SEND_FAILED` 정정 — 기존 spec 의 stale 표기 원인 불명

- **target 위치**: 변경 2 (`spec/2-navigation/4-integration.md` 에러 코드 vocabulary 표 §991 부근) — "`SMTP_SEND_FAILED` → `EMAIL_SEND_FAILED` 로 정정 (구현·error-codes.ts·error-handling.md §1.4 와 일치. 기존 표기가 stale)"
- **과거 결정 출처**: `spec/5-system/3-error-handling.md §1.4` — `EMAIL_SEND_FAILED` 로 이미 기재됨. `spec/4-nodes/4-integration/3-send-email.md §5.3` 에도 `EMAIL_SEND_FAILED` 로 기재됨. integration.md 에서만 `SMTP_SEND_FAILED` 가 잔존.
- **상세**:
  이는 "기각된 결정의 재도입" 이 아니라 반대 방향 — stale 이름을 올바른 이름으로 정정하는 작업으로, Rationale 연속성 관점에서는 긍정적 수정이다. 다만 `SMTP_SEND_FAILED` 가 integration.md 에만 남게 된 경위 (spec drift 의 최초 발생 시점이나 이유) 가 Rationale 에 기록되어 있지 않다. 단순 typo/drift 수정이라면 INFO 수준.
- **제안**:
  변경 4 Rationale 항에 "기존 `SMTP_SEND_FAILED` 는 initial draft 의 잔재로, 다른 spec 문서에서 이미 `EMAIL_SEND_FAILED` 로 확정된 코드명과 일치시킨다"는 한 문장을 추가하면 독자가 두 이름이 공존했던 이유를 추적할 수 있다.

---

### [INFO] `EMAIL_CONNECT_FAILED` 신규 코드 — 기존 Rationale 비교 대상 없으나 error-codes 규약 준수 확인 필요

- **target 위치**: 변경 1 — "실패 시 `IntegrationTestResult.code = EMAIL_CONNECT_FAILED`"
- **과거 결정 출처**: `spec/5-system/3-error-handling.md §1.4` — Email 행에 `EMAIL_SEND_FAILED` 만 기재. `spec/4-nodes/4-integration/3-send-email.md §6` 에도 없음.
- **상세**:
  `EMAIL_CONNECT_FAILED` 는 연결 테스트(test/preview-test) 경로의 결과 코드로, 노드 런타임 에러 코드(`output.error.code`)가 아니다 — `IntegrationTestResult.code` 로 반환된다. 따라서 `3-error-handling.md §1.4` 표(노드 런타임 에러 코드)와는 다른 맥락. draft 의 변경 3 은 `EMAIL_HOST_BLOCKED` 만 `§1.4` 표에 추가하고 있어 이 점은 일관적이다. 단, `IntegrationTestResult.code` 의 허용 값 목록이 spec 어딘가에 SoT 로 관리되는지 확인이 필요하다 — `EMAIL_CONNECT_FAILED` 가 해당 목록에 추가되어야 한다면 그 spec 문서에도 반영이 필요하다.
- **제안**:
  `IntegrationTestResult` 코드 vocabulary 의 SoT (예: `spec/2-navigation/4-integration.md` 내 에러 코드 표 또는 `spec/5-system/3-error-handling.md`) 에 `EMAIL_CONNECT_FAILED` 를 정식 등록하거나, 변경 2 의 에러 코드 vocabulary 표 업데이트 항목에 포함 여부를 명시한다.

---

## 요약

target draft 는 구현 완료 동작을 spec 에 소급 기록하는 작업으로, 전반적으로 기각된 대안을 재도입하거나 합의된 invariant 를 우회하는 수준은 아니다. 그러나 두 가지 WARNING 이 존재한다. 첫째, `preview-test` 가 "외부 네트워크 호출을 수행하지 않는다"는 기존 spec 원칙을 Email SMTP 에서 번복하는데, 변경 4 의 새 Rationale 이 기존 원칙과의 관계를 명시적으로 연결짓지 않아 spec 독자에게 모순으로 보일 수 있다. 둘째, SMTP SSRF 가드는 send-email 노드 spec(`3-send-email.md`) 에 병행 반영이 없어 단일 SoT 원칙에 어긋난다 — integration.md 만 수정하면 노드 spec 과 실행 로직·에러 코드 표 사이에 drift 가 발생한다. 두 WARNING 모두 spec PR 내에서 추가 수정으로 해소 가능하며 블로커 수준은 아니다.

## 위험도

MEDIUM
