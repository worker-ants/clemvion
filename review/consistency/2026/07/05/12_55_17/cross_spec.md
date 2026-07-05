# Cross-Spec 일관성 검토 — SSRF 차단 메시지 일반화 (HTTP Request `HTTP_BLOCKED`)

- 검토 모드: 구현 착수 전 검토 (`--impl-prep`)
- Target: `spec/4-nodes/4-integration/` (변경 없음 예정 — 이번 작업은 `http-request.handler.ts` 의 `output.error.message` 를 일반화해 `database-query.handler.ts` 의 `DB_HOST_BLOCKED` 패턴을 미러링. spec 변경 의도 없음)
- 비교 대상: `spec/4-nodes/4-integration/{0-common,1-http-request,2-database-query,3-send-email}.md`, `spec/2-navigation/4-integration.md`, `spec/5-system/3-error-handling.md`, `codebase/backend/src/nodes/integration/{http-request,database-query,_base}/*`

## 발견사항

- **[WARNING] `HTTP_BLOCKED` 메시지 일반화는 이미 spec 이 명문화한 "Planned" 항목 — 그러나 target 문서 자체는 이를 아직 반영하지 않아 구현 후 spec 이 stale 해진다**
  - target 위치: `spec/4-nodes/4-integration/1-http-request.md` §5.3(예시 없음)/§5.8/§6/§8.2, `0-common.md` §7
  - 충돌 대상: `spec/4-nodes/4-integration/2-database-query.md` §4 "SSRF 가드" 콜아웃 및 Rationale `### DB_HOST_BLOCKED 전용 SSRF 차단 코드 신설` (line 375-377): "**메시지 일반화**: 클라이언트 노출 메시지는 차단된 host/IP 를 포함하지 않는다 … 동일 원칙을 **HTTP/Email SSRF 메시지 일반화 follow-up 과 공유한다**."
  - 상세: DB spec 은 이미 HTTP/Email 에도 동일한 메시지 일반화가 뒤따를 것을 명시적으로 예고했다(follow-up 로 지칭). 그러나 `1-http-request.md` 는 현재 `HTTP_BLOCKED` 에 대한 `output.error.message` 예시·필드 표가 전혀 없다(§5.3 에 케이스 예시 자체가 없음 — HTTP 4xx/5xx, Transport 실패 두 케이스만 JSON 예시 보유). 즉 코드가 구현되면 실제 동작(host/IP 미노출 일반화 문구)이 spec 의 "무엇을 노출하는가"에 대한 명시적 계약과 어긋나는 것은 아니지만(현재 spec 은 애초에 `HTTP_BLOCKED` 메시지 내용에 대해 아무 것도 약속하지 않음), **DB_HOST_BLOCKED 가 받은 수준의 명시 문서화**(예시 JSON·필드 표·Rationale) 를 HTTP 는 아직 갖추지 못했다.
  - 제안: 구현 완료 시 (a) `1-http-request.md` §5.3 에 `HTTP_BLOCKED` 케이스의 `output.error.message` 예시(일반화 문구, host/IP 없음)를 추가하고, (b) `2-database-query.md` Rationale 의 "follow-up" 을 "완료" 로 갱신하거나 `1-http-request.md` 자체에 대칭 Rationale 절을 신설해 cross-reference 를 닫을 것. project-planner 로 spec 갱신 위임 필요(현재 "no spec change intended" 라고 명시했으나, 이 변경은 §5.3 예시·필드 표라는 **spec 본문의 실제 약속**을 갱신해야 하는 범주 — 순수 사실 미러링이 아니라 신규 계약 문서화임).

- **[WARNING] DB 선례 자체가 "차단 상세는 활동 로그(`logUsage`)에만 남는다" 는 문서화된 약속을 실제로 지키지 않음 — HTTP 가 동일 코드 패턴을 그대로 미러링하면 같은 갭을 재생산**
  - target 위치: (구현 예정) `http-request.handler.ts` catch 블록
  - 충돌 대상: `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` lines 219-231 (`assertSafeOutboundHostResolved` catch → `throw new IntegrationError('DB_HOST_BLOCKED', '<정적 일반화 문구>')`), `spec/4-nodes/4-integration/2-database-query.md` line 106 및 Rationale line 375-377
  - 상세: spec 은 "차단 상세(원본 host)는 `logUsage` 서버 활동 로그에만 남긴다" 고 명시하지만, 실제 코드는 `catch { throw new IntegrationError('DB_HOST_BLOCKED', <정적 문자열>) }` 로 원본 `Error` (hostname/IP 포함 메시지, `http-safety.ts` 의 `SSRF_BLOCKED: hostname "..." resolves to a restricted network range`)를 완전히 버리고 새 정적 문자열로 교체한다. 이후 `logUsage` 는 `toLogError(err)` 를 호출하는데, 이 시점의 `err` 는 이미 정적 일반화 메시지를 가진 `IntegrationError` 이므로 `IntegrationUsageLog` 에도 **원본 host/IP 가 전혀 기록되지 않는다** — `logger.warn` 등 다른 어떤 sink 도 원본을 캡처하지 않는다(해당 handler 파일 내 `logger.warn` 호출은 1건뿐이며 pg pool idle client 에러 전용, SSRF 무관).
  - 이는 target 이 컨텍스트로 전달받은 전제("Original detail stays in server-side usage log")와 실제 DB 선례 코드의 동작이 **불일치**함을 의미한다. HTTP 구현이 이 패턴을 문자 그대로 미러링(catch 후 원본 버리고 정적 문자열로 재-throw)하면, HTTP 도 동일하게 "usage log 에 원본이 남는다"는 (틀린) 전제 위에서 구현되어 실제로는 서버 어디에도 원본 hostname/IP 가 남지 않게 된다.
  - 제안: 구현 시 catch 블록에서 새 `IntegrationError` 를 throw 하기 **전에** 원본 caught error(`err.message`, 실제 hostname/IP 포함)를 `logger.debug`/`logger.warn` 등으로 서버 로그에 명시적으로 남기거나, `IntegrationError` 에 별도 internal-only 필드(`cause`) 로 원본을 보존해 `logUsage`/서버 로그 경로에서만 소비하도록 설계할 것. 그렇지 않으면 spec 문구("차단 상세는 활동 로그에만 남는다")를 실제에 맞게 정정해야 한다(둘 중 하나는 반드시 갱신 — 이 갭은 DB 에도 이미 존재하므로 이번 기회에 3개 노드(HTTP/DB/Email) 모두 동일 원칙으로 정정하는 편이 일관적).
  - 참고: 이 문제는 DB_HOST_BLOCKED 구현(2026-06-12, refactor 04 C-3 후속)에 이미 존재하던 pre-existing gap 이며 이번 target 작업이 새로 만드는 결함은 아니다. 그러나 "mirror DB_HOST_BLOCKED" 를 그대로 따르면 HTTP 도 같은 갭을 상속하므로 함께 검토할 가치가 있다.

- **[INFO] `spec/2-navigation/4-integration.md` 에러 코드 vocabulary 표의 `HTTP_BLOCKED` 행은 `DB_HOST_BLOCKED` 행과 달리 "메시지는 host/IP 미포함 일반화" 문구가 없음**
  - target 위치: (해당 없음 — target 문서 범위 밖, `spec/2-navigation/4-integration.md` 는 `spec/4-nodes/4-integration/` 밖의 영역)
  - 충돌 대상: `spec/2-navigation/4-integration.md` line 1091 (`DB_HOST_BLOCKED` 행: "database_query 노드 `error` 포트 출력 (**메시지는 host/IP 미포함 일반화**)") vs line 1094 (`HTTP_BLOCKED` 행: "HTTP 노드 `error` 포트 출력" — 일반화 언급 없음)
  - 상세: 두 행은 같은 표의 병렬 항목인데 DB 행만 메시지 일반화 사실을 명시하고 HTTP 행은 침묵한다. 순수 명명/문서 동기화 이슈이며 구현에 영향은 없으나, 구현 후 이 표를 갱신하지 않으면 두 대칭 코드(`HTTP_BLOCKED`/`DB_HOST_BLOCKED`)의 문서 커버리지가 계속 비대칭으로 남는다.
  - 제안: 구현 완료 시 `HTTP_BLOCKED` 행에도 동일한 "(메시지는 host/IP 미포함 일반화)" 각주 추가.

- **[INFO] `chat-channel-adapter §3.1` 분류표 영향 여부 확인 필요 — Email 선례는 명시적으로 "영향 없음" 분석을 남겼으나 HTTP 는 아직 없음**
  - target 위치: (해당 없음 — 참고용)
  - 충돌 대상: `spec/2-navigation/4-integration.md` Rationale "SMTP SSRF 가드를 http/db 와 동일 `ALLOW_PRIVATE_HOST_TARGETS` 로 통일" 절의 "**chat-channel 분류표 영향 없음**" 하위 절 (line 1136) — `EMAIL_HOST_BLOCKED` 에 대해서만 chat-channel-adapter §3.1 영향 분석을 명시. `HTTP_BLOCKED` 자체에 대한 동일 분석은 spec 어디에도 없음(단, 메시지 *내용* 변경은 코드 enum 자체를 바꾸지 않으므로 분류표에 영향이 없을 개연성이 높다).
  - 상세: 이번 target 작업은 `output.error.code`(`HTTP_BLOCKED`) 를 바꾸지 않고 `output.error.message` 문자열만 일반화하는 것이므로, `error-handling §1.4` 의 "enum 확장 시 분류표 검토 의무" 트리거 조건(코드 추가/변경)에 해당하지 않는다 — 즉 이 자체는 충돌이 아니다. 다만 향후 유사 리뷰에서 "메시지만 바뀐 것" 과 "코드가 바뀐 것"을 혼동하지 않도록 짚어둔다.
  - 제안: 조치 불필요(정보 제공 목적). 코드(enum) 를 손대지 않는 한 chat-channel-adapter 분류표 갱신 의무는 발생하지 않는다.

## 요약

이번 target 변경(HTTP Request `HTTP_BLOCKED` 의 `output.error.message` 를 host/IP 미노출 일반화 문구로 교체)은 기존 `DB_HOST_BLOCKED` 선례와 `spec/4-nodes/4-integration/2-database-query.md` 의 명시적 follow-up 예고에 정확히 부합하며, 에러 코드(`HTTP_BLOCKED`) 자체나 데이터 모델·API 계약·상태 전이·RBAC·계층 책임 어느 관점에서도 직접적 모순(CRITICAL)은 발견되지 않았다. 다만 두 가지 정합성 갭이 있다: (1) HTTP 문서(`1-http-request.md`)는 `HTTP_BLOCKED` 의 메시지 내용에 대한 명시 계약(예시·필드 표)이 현재 전무해 구현 후 DB 수준의 문서 커버리지로 맞춰야 spec-코드 정합이 유지되고, (2) 더 중요하게는 "원본 상세는 서버 활동 로그(`logUsage`)에 남는다" 는 DB 선례의 문서화된 약속이 실제 코드에서는 지켜지지 않는(원본이 catch 블록에서 완전히 버려지는) pre-existing 결함이며, target 이 이 패턴을 그대로 "미러링"하면 HTTP 도 같은 결함(서버 어디에도 원본 hostname/IP 가 남지 않음)을 상속한다 — 이는 보안 감사 관점에서 중요할 수 있으므로 구현 착수 전에 실제 로깅 설계를 재확인할 가치가 있다. 두 갭 모두 CRITICAL 로 격상할 사유(다른 영역을 즉시 작동 불가하게 만듦)는 아니므로 WARNING 으로 등급했다.

## 위험도

MEDIUM — CRITICAL 충돌은 없으나, "원본 상세 보존" 전제가 실제로 어디서도 지켜지지 않는 보안-관련 문서-코드 갭이 있고(기존 DB 패턴에 이미 존재, 이번에 HTTP 로 상속될 소지), 구현 완료 후 spec 예시·필드 표·cross-reference 갱신(§5.3, DB Rationale 의 follow-up 문구, 2-navigation 표) 이 필요하다.
