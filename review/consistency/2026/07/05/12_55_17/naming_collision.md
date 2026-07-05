# 신규 식별자 충돌 검토 — naming_collision

- 검토 모드: `--impl-prep` (구현 착수 전)
- Target 범위: `spec/4-nodes/4-integration/` (0-common, 1-http-request, 2-database-query, 3-send-email, 4-cafe24 등)
- 실제 구현 착수 대상: `plan/in-progress/http-ssrf-all-auth-followups.md` 잔여 미체크 항목 "SSRF 에러 메시지 클라이언트 일반화" (`http-safety.ts` 의 `SSRF_BLOCKED: hostname "..."` 메시지가 차단 host/IP 를 `output.error.message` 로 노출 — 정찰 면 축소 필요)

## 조사 방법

1. `naming_collision.md` 프롬프트에 번들된 target 문서(`spec/4-nodes/4-integration/**`) 전체 스캔 — 이 디렉터리 자체는 이미 커밋된 기존 spec 이며 이번 턴에서 새로 추가되는 내용은 없음(diff 없음, `git status` clean).
2. 실제 신규 작업 소스는 `plan/in-progress/http-ssrf-all-auth-followups.md` 의 유일한 미체크 코드 항목 — "SSRF 에러 메시지 클라이언트 일반화". 이 항목이 구현될 때 코드베이스에 실제로 도입될 식별자(메시지 문자열, 상수명, 함수명)를 추정해 기존 사용처와 충돌 여부를 점검.
3. 관련 기존 코드(`http-safety.ts`, 3개 handler, `error-codes.ts`, `backend-labels.ts`, `2-database-query.md` Rationale)를 대조.

## 발견사항

- **[INFO]** `SSRF_BLOCKED` (메시지 프리픽스 문자열) vs `HTTP_BLOCKED`/`DB_HOST_BLOCKED`/`EMAIL_HOST_BLOCKED` (ErrorCode enum) — 이름 유사로 인한 혼동 소지
  - target 신규 식별자: 없음(기존 식별자 재확인) — `codebase/backend/src/nodes/integration/http-request/http-safety.ts:96,100,107,130,147,417`(`http-request.handler.ts`) 의 `Error('SSRF_BLOCKED: …')` 문자열
  - 기존 사용처: `codebase/backend/src/nodes/core/error-codes.ts:18,32,37` 의 `ErrorCode.HTTP_BLOCKED` / `DB_HOST_BLOCKED` / `EMAIL_HOST_BLOCKED`. `http-safety.spec.ts`/`http-request.handler.spec.ts` 다수가 `/SSRF_BLOCKED/` 정규식으로 원본 메시지를 단언 중
  - 상세: `SSRF_BLOCKED` 는 `http-safety.ts` 내부 raw `Error` 의 message prefix(코드 아님, 3개 노드 공용 low-level 가드), `HTTP_BLOCKED`/`DB_HOST_BLOCKED`/`EMAIL_HOST_BLOCKED` 는 `IntegrationError`/`ErrorCode` 의 `output.error.code` 값(노드별로 다름, spec §6 카탈로그 SoT). 두 네이밍 계열이 유사(`*_BLOCKED`)해 "SSRF 에러 메시지 일반화" 구현 시 이 둘을 혼용하거나, 일반화된 새 메시지 상수에 `SSRF_BLOCKED` 류 이름을 재사용하면 "이것이 code 인지 message 프리픽스인지" 헷갈릴 위험이 있음. 이미 `2-database-query.md` Rationale(§`DB_HOST_BLOCKED` 전용 SSRF 차단 코드 신설)이 이 구분을 명시했으므로 문서 자체엔 문제 없음
  - 제안: 구현 시 `http-safety.ts` 내부 raw message 프리픽스는 유지하되(테스트가 다수 의존), 새로 도입할 "일반화된 클라이언트 노출 메시지" 상수/함수명은 `SSRF_BLOCKED`/`*_BLOCKED` 패턴을 피하고 `SSRF_GENERIC_MESSAGE` 또는 handler 별 로컬 상수(`DB_HOST_BLOCKED` 가 이미 쓰는 인라인 리터럴 패턴)로 명명해 code-enum 계열과 시각적으로 구분할 것

- **[INFO]** 새 클라이언트 메시지 문자열이 이미 부분 선점됨 — "일반화 문구"와 프론트 fallback 이 이미 존재
  - target 신규 식별자: (구현 예정) HTTP Request 용 "일반화된 SSRF 차단 메시지" 문자열
  - 기존 사용처: `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts:229` — `'Database host resolves to a private/loopback address blocked by SSRF policy.'`, `send-email.handler.ts:181` — `'SMTP host points to a private/loopback address blocked by policy.'`, `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts:450,458` — `"Request blocked by SSRF policy."` / `"Database host blocked by SSRF policy."` fallback 문자열
  - 상세: DB/Email 경로는 이미 host/IP 미노출 일반화 메시지로 구현되어 있고(`2-database-query.md:106` "클라이언트 노출 메시지는 차단 host/IP 를 포함하지 않는 일반화 문구"), frontend 테스트가 `"Request blocked by SSRF policy."` 라는 정확한 문자열을 이미 fallback 값으로 참조하고 있다. HTTP Request 경로에 신규 도입할 일반화 메시지는 이 기존 문자열들과 패턴을 맞춰야 하며(`"<X> blocked by SSRF policy."` 형태), 임의로 다른 문구(`"Access denied by security policy"` 등)를 새로 만들면 3개 노드 간 메시지 어휘가 불일치해 §4 SSRF opt-out callout 이 요구하는 "일관 메커니즘" 톤이 깨진다. 다만 UI 상 실제 노출 문구는 `backend-labels.ts` 의 `HTTP_BLOCKED`/`DB_HOST_BLOCKED` 코드 키가 이미 완전히 대체하므로(§ `LABEL_KO`), raw 백엔드 message 는 API 응답 JSON·서버 로그·비-UI 소비자에게만 도달함 — 충돌이라기보다 "새 문자열이 정찰 정보(host/IP)를 담지 않기만 하면" 되는 낮은 리스크
  - 제안: 신규 HTTP Request 일반화 메시지는 기존 `"... blocked by SSRF policy."` 어휘 패턴을 재사용해 `"Outbound request blocked by SSRF policy."` 류로 통일. `backend-labels.test.ts:450` 의 fallback 문자열이 이미 이 정확한 문구를 기대하고 있으므로 그대로 채택하면 별도 조정 불필요

- **[INFO]** 파일 경로/함수명 — 신규 파일 도입 없음, 기존 `http-safety.ts` 경로 재사용 예상
  - target 신규 식별자: 없음
  - 기존 사용처: `codebase/backend/src/nodes/integration/http-request/http-safety.ts` (HTTP Request 소유 디렉터리 하위지만 DB Query 도 import, JSDoc 상단에 "SSRF guard helpers for the HTTP Request handler / DB Query node" 로 이미 공용화 명시)
  - 상세: 이번 구현은 기존 함수(`assertSafeOutboundUrl`, `assertSafeOutboundHostResolved`)의 반환/throw 메시지 내용만 조정할 가능성이 높고 새 파일·새 export 심볼을 요구하지 않음. 파일 경로 충돌 없음
  - 제안: 해당 없음 (참고용 기록)

## 요약

target 으로 번들된 `spec/4-nodes/4-integration/` 디렉터리 자체는 이번 턴에 새로 추가되는 내용이 없는 기존 spec(diff 없음)이며, 실질적으로 구현될 작업은 `plan/in-progress/http-ssrf-all-auth-followups.md` 의 잔여 1개 항목("SSRF 에러 메시지 클라이언트 일반화")뿐이다. 이 작업 범위에서는 새 요구사항 ID·엔티티·API endpoint·이벤트명·ENV var·파일 경로가 전혀 도입되지 않으며, 기존 `HTTP_BLOCKED`/`DB_HOST_BLOCKED`/`EMAIL_HOST_BLOCKED` 에러 코드 및 `ALLOW_PRIVATE_HOST_TARGETS` 환경변수는 이미 spec·코드·i18n·error-codes.ts 전반에서 정의·등록되어 그대로 재사용된다. 유일한 주의점은 (1) `http-safety.ts` 내부의 raw 메시지 프리픽스 `SSRF_BLOCKED`(문자열)와 `ErrorCode.*_BLOCKED`(코드 enum)라는 두 유사 명명 계열을 구현 중 혼동하지 않는 것, (2) 새로 일반화할 HTTP 경로의 클라이언트 메시지 문자열이 이미 DB/Email 경로 및 frontend 테스트가 기대하는 `"... blocked by SSRF policy."` 어휘 패턴과 일치하도록 맞추는 것이다. 두 사항 모두 CRITICAL/WARNING 수준의 실제 충돌이 아니라 구현 시 참고할 명명 일관성 권고(INFO)에 해당한다.

## 위험도

NONE
