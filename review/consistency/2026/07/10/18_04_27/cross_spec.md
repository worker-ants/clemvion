### 발견사항

- **[INFO]** 동일 축(status ≠ connected)의 "expired/error" 열거가 target 미포함 2곳에도 잔존
  - target 위치: (target 문서는 4곳만 명시 — `2-navigation/4-integration.md` §6·에러표, `4-nodes/4-integration/0-common.md` §4.2, `3-send-email.md`)
  - 충돌 대상: `spec/4-nodes/4-integration/_product-overview.md` INT-US-03 (`연동이 expired/error 상태로 전이되면 … 경고 뱃지 표시`, line 58) · `spec/4-nodes/4-integration/0-common.md` §2 (`연결 상태(connected/expired/error) 배지 표시`, line 43)
  - 상세: 두 곳 모두 "connected 아님" 상태를 `expired`/`error` 2종만 열거하고 `pending_install` 을 포함하지 않는다. target 이 고치는 §4.2 에러 코드 표(라인 83)와 같은 파일(`0-common.md`) 안에서 불과 40줄 위(§2)에 있는 이 배지 서술은 그대로 두면, 같은 파일 안에서 "에러 코드 표는 pending_install 포함" vs "선택 UI 배지 설명은 pending_install 미포함" 이 병존하게 된다. 다만 이는 target 이 다루는 **노드 실행 에러 코드**(런타임 throw) 축이 아니라 **에디터 UI 경고 뱃지**(INT-US-03) 축이라 의미상 직교할 수 있음 — pending_install 통합을 참조하는 노드에 에디터 경고 뱃지를 띄울지는 target 의 코드 검증 범위 밖(별도 요구사항)이라 이번 draft 가 건드릴 필요는 없다고 판단됨.
  - 제안: 이번 4곳 fix 로 충분(회귀 아님). 다만 project-planner 가 후속으로 INT-US-03/§2 배지 로직이 실제 코드에서 pending_install 을 포함하는지 별도 확인해 두면 좋음(차단 사유 아님, backlog 성격).

- **[INFO]** target 의 정정 방향이 도메인 내 다른 spec 파일들과 이미 정합함 (positive cross-check)
  - target 위치: 전체 변경 4곳
  - 충돌 대상: `spec/4-nodes/4-integration/1-http-request.md:321,339` · `spec/4-nodes/4-integration/2-database-query.md:312,324,344` · `spec/4-nodes/4-integration/4-cafe24.md:105-106,331` · `spec/5-system/3-error-handling.md:113` · `spec/data-flow/5-integration.md:229,280`
  - 상세: 위 파일들은 이미 `INTEGRATION_NOT_CONNECTED` = "status ≠ connected"(resolveIntegration 검증) / `INTEGRATION_INCOMPLETE` = "credential 필드 누락" 축으로 명확히 구분해 서술하고 있고, `data-flow/5-integration.md:280` 은 스캐너 쿼리에서 `status NOT IN (expired, error, pending_install)` 로 3종 모두 명시한다. 즉 target 이 고치는 4곳이 오히려 stale outlier였고, 나머지 도메인은 이미 target 의 결론과 일치 — 충돌 없음, 오히려 정합화.
  - 제안: 별도 조치 불요. 참고용으로만 기록.

### 요약

제공된 cross-spec 컨텍스트(`spec/0-overview.md`, `spec/1-data-model.md`)에는 `INTEGRATION_NOT_CONNECTED`/`INTEGRATION_INCOMPLETE`/`pending_install` 관련 서술이 target 과 모순되는 지점이 없다. `1-data-model.md` §2.10 Integration.status enum 은 이미 `connected/expired/error/pending_install` 4종을 정의하고 있어, target 이 고치려는 3곳(§6, 에러표, 0-common §4.2, send-email)이 `pending_install` 을 누락한 채 2종만 나열하던 것이 오히려 data-model 과 어긋나는 stale 이었다 — target 의 수정이 data-model 과의 정합성을 회복시킨다. 요구사항 ID·API 계약·상태 전이표(§6 자체의 전이 규칙)·RBAC·계층 책임 어느 것도 target 이 변경하지 않으며, doc-only 정정이라 신규 충돌 표면이 없다. 저장소 전체를 추가로 훑어본 결과 같은 도메인의 다른 파일들(http-request/database-query/cafe24/error-handling/data-flow)이 이미 target 이 채택한 구분(상태검사=NOT_CONNECTED, credential누락=INCOMPLETE)을 정확히 따르고 있어 target 의 방향성이 재확인된다. 유일한 잔여 관찰은 같은 파일(`0-common.md`) 안 UI 배지 서술(§2)과 `_product-overview.md` INT-US-03 요구사항이 별도 축(에디터 경고 뱃지, 런타임 에러 코드 아님)에서 여전히 `pending_install` 을 누락하고 있다는 점인데, 이는 target 의 검증 범위(코드 대조된 노드 실행 에러 코드) 밖이라 차단 사유가 아니며 INFO 로만 남긴다.

### 위험도
NONE
