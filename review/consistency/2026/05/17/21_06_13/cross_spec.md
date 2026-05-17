# Cross-Spec 일관성 검토 결과

**대상 draft**: `plan/in-progress/spec-draft-cafe24-call-401-retry.md`
**검토 범위**: 변경 1~4 (cafe24 §6.1 / MCP Client §8.4 / 통합 §10.5 / 통합 Rationale)
**참조 corpus**: spec/0-overview.md, spec/1-data-model.md, spec/2-navigation/4-integration.md (현행), spec/4-nodes/4-integration/4-cafe24.md (현행), spec/5-system/11-mcp-client.md (현행), spec/2-navigation/{0,1,10,11,12,13}-*.md

---

### 발견사항

- **[INFO]** 변경 1 (cafe24 §6.1): 에러 코드 표 (§6, line 313) 와 격하 동작 기술이 아직 동기화 안 됨
  - target 위치: 변경 1 §6.1 "공통 격하 동작" — `CAFE24_AUTH_FAILED` 를 401/403 양쪽에 공통 발사
  - 충돌 대상: `spec/4-nodes/4-integration/4-cafe24.md` §6 에러 코드 표 (line 313) — 현재 `CAFE24_AUTH_FAILED` 조건이 `401 / 403` 으로 단순 기술되어 있고, `meta.statusCode` 란도 `401 / 403` 으로 묶여 있음
  - 상세: draft 는 401 에 "refresh + 재시도 후 2xx 면 에러 없음 / 재시도도 401 이면 격하" 라는 조건부 경로를 도입한다. 그러나 §6 에러 코드 표의 `CAFE24_AUTH_FAILED` 행은 여전히 `401 / 403` 모두에 무조건 격하인 듯 보인다. draft 의 변경 1 은 §6.1 본문만 교체하고 §6 표의 조건 컬럼 (`401 / 403`) 을 정정하지 않는다. 표를 읽는 독자가 "401 → 즉시 CAFE24_AUTH_FAILED" 로 오해할 여지가 남는다.
  - 제안: §6 에러 코드 표의 `CAFE24_AUTH_FAILED` 조건 셀을 `401 (refresh + 재시도 소진 시) / 403` 으로 보정하고, `meta.statusCode` 도 `401 / 403` → `401 (재시도 후) / 403` 으로 명시. draft 의 변경 1 범위에 표 수정을 추가할 것.

- **[INFO]** 변경 1 (cafe24 §6.1): 기존 §4 step 6 (실행 흐름) 과 변경 후 §6.1 의 흐름 기술 연동 필요
  - target 위치: 변경 1 §6.1 본문
  - 충돌 대상: `spec/4-nodes/4-integration/4-cafe24.md` §4 step 6 (line 89) — 현재 "토큰 만료 확인 및 갱신" 이후 `INTEGRATION_NOT_CONNECTED` throw 만 언급하고, 401 reactive 회복 경로가 기술되어 있지 않음
  - 상세: §4 의 실행 흐름 step 6 은 proactive 갱신(만료 60초 전 자동갱신)만 서술한다. draft 가 도입하는 reactive 401 회복(`executeWithRateLimit()` 안의 401 분기)은 step 6 이후 step 7(실제 API 호출) 에 해당하는데, §4 에 해당 흐름 서술이 없다. §4 step 7 또는 신규 step 으로 "API 호출 시 401 수신 → refreshViaQueue → 1회 재시도" 흐름을 추가해야 §4 가 실행 흐름의 완전한 SoT 가 된다.
  - 제안: draft 의 변경 1 범위에 §4 실행 흐름 step 보완을 포함하거나, 별도 변경 5 로 추가. 최소한 §4 step 6 뒤에 "Cafe24 API 호출 401 시 §6.1 자가 회복 흐름 참조" 형태의 전달 링크라도 추가.

- **[WARNING]** 변경 2 (MCP Client §8.4): line 69 안내문 변경이 §8.4 본문 변경과 별도 위치이지만 두 변경이 분리되어 있어 적용 순서 실수 시 불일치 발생 가능
  - target 위치: 변경 2 — §8.4 본문 교체 + line 69 인근 안내문 정정 두 위치
  - 충돌 대상: `spec/5-system/11-mcp-client.md` 현행 line 69 (`> Internal Bridge 도 §8.4 의 인증 실패 자동 status 전환 정책을 따른다 — 401/403 응답 시 …`) 와 §8.4 본문 (line 430-440)
  - 상세: 이 두 변경은 각각 적용해도 이론적으로 일관된 상태가 되나, 만약 하나만 반영되면 §8.4 본문이 "외부 MCP 한정" 이라고 말하는데 line 69 는 여전히 Internal Bridge 가 무조건 §8.4 를 따른다고 기술하는 모순이 생긴다. 반대로 line 69 만 먼저 반영되면 §8.4 본문에 Internal Bridge 예외 서술이 없어 독자 혼란이 발생한다. 두 변경은 반드시 한 커밋/PR 에 동시 적용되어야 한다.
  - 제안: draft 에 "변경 2 의 §8.4 본문과 line 69 안내문은 원자적으로 함께 반영" 임을 명기. plan/in-progress 의 구현 체크리스트에도 두 위치를 한 항목으로 묶을 것.

- **[INFO]** 변경 3 (통합 §10.5): 새로 추가되는 "401 자동 회복" bullet 과 기존 "갱신 실패 시" bullet 의 호출 체계가 명시적으로 연결되어 있지 않음
  - target 위치: 변경 3 §10.5 신규 bullet "401 자동 회복 (`call()` 경로)"
  - 충돌 대상: `spec/2-navigation/4-integration.md` §10.5 기존 "갱신 실패 시 (2026-05-16 갱신)" bullet
  - 상세: 새 bullet 은 `refreshViaQueue` 를 거쳐 1회 재시도하고, refresh 자체 실패 시 `error(auth_failed)` 전이를 "[Spec Cafe24 §6.1] 의 전이 발사" 로 위임한다. 그러나 기존 "갱신 실패 시" bullet 은 `refresh_token invalid_grant → error(auth_failed)` 전이를 §10.5 에서 직접 서술한다. 독자 관점에서 refresh 실패 전이의 SoT 가 §10.5 인지 §6.1 인지 명확하지 않다. (실제로는 §6.1 이 cafe24 한정 SoT 이고 §10.5 는 cross-provider 공통 서술 이지만 이 구분이 텍스트에서 불명확하다.)
  - 제안: §10.5 "갱신 실패 시" bullet 에 "cafe24 의 경우 §6.1 의 격하 경로 참조" 형태의 명시적 교차 참조를 추가하거나, "갱신 실패 시" bullet 의 `error(auth_failed)` 전이 기술이 §10.5 (공통 layer) 의 것이고 §6.1 (cafe24 layer) 은 reactive 회복 추가 레이어임을 문서 구조상 명확화.

- **[INFO]** `spec/1-data-model.md` §2.10 `status_reason` 정의와 draft 간 형식 확인
  - target 위치: 변경 1 §6.1 "403 (스코프 부족 / 앱 미설치)" — `status_reason='insufficient_scope'` 사용
  - 충돌 대상: `spec/1-data-model.md` §2.10 Integration.status_reason 서술 (현재 `error → insufficient_scope / auth_failed / network / unknown`)
  - 상세: draft 에서 403 케이스 `insufficient_scope` 시그널 시 `status_reason='insufficient_scope'` 를 사용하는데, 이는 데이터 모델에 이미 정의된 값이다. draft 가 "새 reason 추가 없음" 으로 선언한 것과 일치한다. CRITICAL 충돌 없음 — 확인 완료.
  - 제안: 별도 조치 불필요.

- **[INFO]** `spec/0-overview.md` §6.2 Cafe24 통합 구현 현황 서술 갱신 검토
  - target 위치: 변경 전반 (401 자가 회복 정책 도입)
  - 충돌 대상: `spec/0-overview.md` §6.2 Cafe24 통합 현황 서술 (현재 `PR #20-#67` 까지 구현 완료 서술)
  - 상세: §6.2 는 Cafe24 통합의 구현 완료 범위를 서술하지만 "401 자가 회복" 패턴을 명시적으로 열거하지는 않는다. 구현 완료 시 §6.2 의 서술을 갱신해야 할 수도 있지만, 해당 bullet 이 지나치게 상세화되면 overview 문서의 성격과 맞지 않아 갱신하지 않아도 충분할 수 있다.
  - 제안: 구현 PR 머지 후 §6.2 에 "401 reactive 회복" 을 한 줄 추가할지 선택적으로 판단. BLOCK 대상 아님.

- **[INFO]** `spec/2-navigation/4-integration.md` §11 알림 정책과 401 자가 회복 간 상호작용 — 알림 발사 불발 확인
  - target 위치: 변경 1 §6.1 재시도 성공 경로 (`status='connected'` 유지)
  - 충돌 대상: `spec/2-navigation/4-integration.md` §11.2 알림 생성 / `spec/1-data-model.md` §2.19 Notification.type
  - 상세: 재시도 성공 시 `status='connected'` 가 유지되어 `error(auth_failed)` 전이가 발생하지 않는다. 따라서 `integration_action_required` 알림이 발사되지 않는다. 이는 draft 가 의도한 동작이며, §11.2 의 알림 발사 조건(`error → action_required`)과 충돌하지 않는다. 알림 정책 모순 없음.
  - 제안: 별도 조치 불필요.

---

### 요약

이번 draft 는 4개 spec 파일에 걸쳐 Cafe24 access_token 401 자가 회복 정책을 도입하는 변경이다. Cross-Spec 관점에서 CRITICAL 또는 WARNING 등급의 직접 모순은 발견되지 않았다. 가장 주목할 사항은 WARNING 1건으로, MCP Client §8.4 본문과 line 69 안내문 두 위치가 원자적으로 동시 반영되지 않으면 일시적으로 서로 모순되는 상태가 생길 수 있다. 이는 draft 를 배포하는 PR 단위에서 두 위치를 한 커밋에 묶는 것으로 해결된다. 나머지 INFO 4건은 §6 에러 코드 표 보정, §4 실행 흐름 step 보완, §10.5 교차 참조 명확화, §0-overview.md 선택적 갱신 등 문서 완결성 향상을 위한 권장 보완이다. 데이터 모델(`Integration.status_reason` enum), API 계약, RBAC 모델, 계층 책임 분할 영역에서는 충돌이 없다. draft 채택을 차단할 이유가 없으며 spec 반영 후 INFO 항목을 순차 해소하는 것을 권장한다.

---

### 위험도

LOW
