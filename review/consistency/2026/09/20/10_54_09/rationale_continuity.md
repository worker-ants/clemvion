# Rationale 연속성 검토 — SSRF 가드 소비자 넷의 `instanceof SsrfBlockedError` 분기 (impl-done)

대상 diff: `database-connection-tester.ts` · `http-connection-tester.ts` · `database-query.handler.ts` · `http-redirect.ts` · `http-request.handler.ts` (+각 spec) — scope `spec/4-nodes/4-integration/` 델타는 0(코드 전용 PR).

## 발견사항

- **[INFO]** 에러 코드 카탈로그에 "가드 고장" 신규 트리거 라인 누락
  - target 위치: `spec/4-nodes/4-integration/0-common.md` §4.2, `1-http-request.md` §6, `2-database-query.md` §6 (모두 **미변경**)
  - 과거 결정 출처: `0-common.md` §4.2 `INTEGRATION_CALL_FAILED` 행("기타 일반 예외(분류되지 않은 실패)") / `1-http-request.md` §6 `INTEGRATION_*` 행(현재 유일 트리거로 "integrationId 부재" 만 명시) / §6 `HTTP_TRANSPORT_FAILED` 행("fetch 가 reject 한 경우 — DNS/연결 거부/소켓/timeout" 으로 한정 서술)
  - 상세: 이번 diff 는 SSRF 가드가 `SsrfBlockedError` 가 아닌 오류(가드의 고장)를 던지는 경우를 새로 구분해 `http-request.handler.ts`/`database-query.handler.ts` preflight 는 `INTEGRATION_CALL_FAILED` 로, `http-request.handler.ts` 의 **리다이렉트 홉** 실패는 (기존 transport-catch 를 그대로 타서) `HTTP_TRANSPORT_FAILED` 로 승격한다. `INTEGRATION_CALL_FAILED` 는 이미 "기타 일반 예외" 라는 넓은 정의라 저촉은 아니지만, `HTTP_TRANSPORT_FAILED` 의 문서 정의("네트워크/타임아웃")는 "가드 로직 자체의 버그"까지 포함한다고 읽기 어렵다 — 같은 원인(가드 고장)이 진입 시점(최초 preflight vs 리다이렉트 홉)에 따라 서로 다른 코드로 나가는 비대칭도 spec 표에는 없다. `spec_impact: none` 으로 선언돼 있어 이 갭이 spec 에 반영될 계획이 이번 커밋엔 없다.
  - 제안: 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(diff 에 포함, "1-http-request.md frontmatter code: 에 http-redirect.ts · 세 에러 표에 «가드의 고장» 트리거" 항목, owner=planner, 2026-09-20 등재)에 정확히 이 갭으로 등재돼 있다 — 별도 조치 불요, planner 턴에서 회수 확인만 하면 됨.

- **[INFO]** `1-http-request.md` frontmatter `code:` 목록에 `http-redirect.ts` 누락 (기존 갭, 이번 PR 로 재확인됨)
  - target 위치: `spec/4-nodes/4-integration/1-http-request.md` frontmatter `code:`
  - 과거 결정 출처: 없음(문서화 누락 그 자체) — 이번 PR 이 `http-redirect.ts` 에 `SsrfBlockedError` re-export 를 추가하며 그 파일의 SSRF 관여도가 다시 확인됨
  - 상세: §4 step 9(리다이렉트 5홉 + 홉마다 SSRF 재검증)를 구현하는 파일이 spec-코드 증거 목록에 없다. developer 의 자기-반증형 소정정 대상도 아니다(예고 문장의 정정이 아니라 증거 목록 누락).
  - 제안: 위와 같은 tracker 항목에 이미 병기돼 있음 — planner 턴에서 함께 등재.

- **[INFO]** 가드 «고장» 메시지의 마스킹 강도가 차단 판정 분기와 비대칭
  - target 위치: `http-request.handler.ts`(preflight `INTEGRATION_CALL_FAILED` 분기) · `database-query.handler.ts`(동일) · `database-connection-tester.ts`
  - 과거 결정 출처: `1-http-request.md` §8.3 "SSRF 차단 메시지 일반화 — 정찰 면 축소(2026-07-05)" — 차단 **판정**은 host/IP 를 완전히 제거한 고정 문구로 치환(CWE-209)
  - 상세: 판정(`SsrfBlockedError`) 분기는 §8.3 대로 host/IP 미노출 고정 문구를 유지하지만, 새로 분리된 "가드 고장" 분기는 `sanitizeMessage`(자격증명 패턴만 마스킹)를 거친 원문을 그대로 `output.error.message` 로 내보낸다 — 원칙적으로 §8.3 과 같은 강도의 마스킹은 아니다. 다만 이는 §8.3 이 다루는 대상(SSRF 차단 판정)의 확장이 아니라 별개 실패군(가드 버그)이라 §8.3 재도입/번복은 아니고, 오늘 가드가 낼 수 있는 유일한 비판정 오류(`isBlockedHostname` 의 `TypeError`)에는 host/IP 가 들어 있지 않아 실제 유출 경로는 없음(해당 plan 문서가 도달 가능성을 실측·주석에 남김).
  - 제안: 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 "가드 «고장» 메시지에는 host/IP 마스킹이 없다 — 판정 분기와 비대칭" 항목(owner=developer, 낮음, 2026-09-20 등재)으로 등재돼 후속 처리 예정 — 별도 조치 불요.

## 정합 확인 (반례 없음 — 참고용)

- **D4 라우팅 원칙**(`0-common.md` §4 D4 결정: "모든 IntegrationError → `port:'error'`, throw 로 노드 실행 실패시키는 경로는 없다")은 그대로 유지된다 — 새로 분리된 "가드 고장" 분기도 결국 `IntegrationError`로 승격돼 같은 D4 catch-경로로 흐른다.
- **§8.2 "SSRF 가드 전 인증 방식 적용" · §8.3 "SSRF 차단 메시지 일반화"** 의 기각된 대안(별도 opt-out 플래그, `output.error.details` 노출, 빈 message)은 이번 diff 에서 재도입되지 않았다. 판정(`SsrfBlockedError`) 경로의 메시지·라우팅·usage 로그 코드는 diff 전후로 동일하다.
- **§6.3.1 `Error.cause` 부착 기준(C1/C2)** — `database-query.handler.ts` 의 새 `IntegrationError('INTEGRATION_CALL_FAILED', …)` 승격은 `cause` 를 부착하지 않으며, 코드 주석이 명시적으로 C2("message·name 밖의 속성이 통째로 딸려 온다")를 근거로 든다 — 정본 기준을 정확히 따른 사례다.
- **`2-database-query.md` Rationale "`DB_HOST_BLOCKED` 전용 SSRF 차단 코드 신설(2026-06-12)"** — 차단 판정에 대해서만 `DB_HOST_BLOCKED` 를 유지하고, 새로 분리된 가드-고장 분기는 그 코드를 침범하지 않는다(별도 `INTEGRATION_CALL_FAILED`) — 결정 유지.
- 이번 PR 이 통일하려는 "판정만 사유로, 다른 오류는 각자의 미분류 실패 경로로" 원칙은 spec Rationale 에 명문화된 결정이 아니라, 기존에 이미 존재하던 SMTP 가드(`send-email/smtp-host-guard.ts`)의 실제 구현 패턴을 나머지 4개 소비자에 맞춘 것이다 — "새 원칙 도입" 이 아니라 "기존 비대칭(4곳만 다르게 동작)의 해소"로, 결정 번복에 해당하지 않는다.

## 요약

이번 diff 는 spec 문서를 전혀 건드리지 않는 코드 전용 방어적 리팩터이며, 기존 Rationale(D4 라우팅, §8.2/§8.3 SSRF 메시지 일반화, §6.3.1 cause 부착 C1/C2, `DB_HOST_BLOCKED` 전용 코드)을 재도입·번복·우회하지 않는다. 다만 새로 분리된 "가드 고장(판정 아님)" 분기가 기존 에러 코드(`INTEGRATION_CALL_FAILED`/`HTTP_TRANSPORT_FAILED`)의 문서화된 정의보다 넓게 쓰이는 카탈로그 완결성 갭과, 그 분기의 마스킹 강도가 판정 분기(§8.3)보다 약한 비대칭이 있다 — 둘 다 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 (developer/planner 소유·낮음 우선순위로) 사전 등재돼 후속 처리가 예정돼 있으므로, 이번 검토 시점 기준으로는 조치가 필요한 새 발견이라기보다 기존 추적 항목의 재확인이다.

## 위험도

LOW
