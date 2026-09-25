# Cross-Spec 일관성 검토 — Personal 통합 소유자 강제 (integration-personal-owner)

검토 대상: `spec/2-navigation/4-integration.md §8` 판정 규칙 신설 + 구현(`codebase/backend/src/modules/integrations/**`,
`workflow-assistant/tools/**`) — `git -C .../integration-personal-owner diff origin/main...HEAD` (27 files / 4408 lines).
spec 델타는 이번 diff 에 없음(같은 PR 의 선행 planner 커밋 `f47069564` 가 이미 반영) — 본 검토는 그 spec 변경 및 이를 구현한
코드가 **다른 spec 영역**과 충돌하는지를 본다.

## 발견사항

- **[WARNING] OAuth 콜백의 신규 "커밋 직전 인가 재판정" 분기가 관련 spec 두 곳에 반영되지 않음**
  - target 위치: `spec/2-navigation/4-integration.md §8` 판정 규칙(신설) — 이 규칙을 구현한
    `codebase/backend/src/modules/integrations/integration-oauth.service.ts` 의 `assertRequesterStillAllowed`
    (신규 private 메서드, `handleCallback` 의 `SELECT ... FOR UPDATE` 직후·`credentials` 덮어쓰기 직전에 호출).
  - 충돌 대상: `spec/data-flow/5-integration.md §1.2` "OAuth 연결 (begin → authorize → callback)" 의 mermaid
    시퀀스 다이어그램과 뒤따르는 "callback 실패 (token exchange 실패 등)" 서술, 그리고
    `spec/2-navigation/4-integration.md §10.4` 에러 매핑 표.
  - 상세: 이 PR 이전에는 reauthorize/request-scopes 콜백이 `SELECT ... FOR UPDATE` 로 row 를 잠근 뒤 곧바로
    `credentials` 를 덮어썼다(`git show origin/main:.../integration-oauth.service.ts` 확인). 이번 PR 은 그 사이에
    `assertRequesterStillAllowed` 를 끼워 넣어 — begin 시작 시점과 콜백 시점 사이(OAuth state TTL 구간)에 요청자가
    강등되었거나 Personal 통합의 가시성을 잃었으면 — `RESOURCE_NOT_FOUND`(404, personal 가시성 상실) 또는
    `ADMIN_REQUIRED`(403, Organization Admin 상실)를 던지고 트랜잭션을 롤백해 자격 증명 교체를 막는다. 이것은
    "이미 외부 provider 동의 화면까지 통과한 콜백이 인가 재판정만으로 실패할 수 있다"는, 이 PR 이 새로 도입한
    구조적 분기다. 그런데:
    - `data-flow/5-integration.md §1.2` 의 시퀀스 다이어그램은 `SELECT ... FOR UPDATE` 다음 바로 `UPDATE integration
      SET credentials=...` 로 이어지는 옛 흐름 그대로다(이 파일은 이번 diff 에 없음 — plan draft 는 "인가는 §8 이
      SoT" 라는 이유로 의도적으로 손대지 않았으나, 이번에 추가된 것은 "누가 호출할 수 있는가" 가 아니라 **이미 진행
      중이던 흐름의 커밋 직전 단계에서 성공/실패가 갈리는 새 분기**라 시퀀스 서술의 몫이다). 바로 아래 "callback 실패"
      단락도 token-exchange 실패류만 나열하고 이 실패 모드는 언급하지 않는다.
    - `2-navigation/4-integration.md §10.4` 에러 매핑 표에는 이 실패에 대응하는 행이 없다. 실측(`markIntegrationCallbackError`,
      같은 파일 라인대 ~1009 이하): `status='connected'` 인 통합에서 이 예외가 발생하면 `OAUTH_TOKEN_EXCHANGE_FAILED`·
      `OAUTH_INVALID_SCOPE` 전용 분기 어디에도 안 걸려 "그 외(연결됨 + 비-토큰 에러): `last_error` 만 기록, `status`
      보존" 폴백으로 떨어진다 — 동작 자체는 안전하지만(§10.4 의 "네트워크 오류" 행과 같은 부류), 그 부류에 이 케이스가
      속한다는 사실이 §10.4 표 어디에도 적혀 있지 않다. `integration-status-reason.ts` 파일 자신의 관례("새 케이스는
      위 union 에 추가")를 기준으로 봐도 `RESOURCE_NOT_FOUND`/`ADMIN_REQUIRED` 는 그 union 에 없다(다만 위 폴백 경로라
      실제로는 `statusReason` 갱신 자체가 스킵되므로 `unknown_error` 로 떨어지지도 않는다 — 영향은 "안 알려짐" 이지
      "오분류" 는 아니다, 정정).
  - 제안: `data-flow/5-integration.md §1.2` 시퀀스 다이어그램의 `reauthorize`/`request_scopes` 분기에
    `assertRequesterStillAllowed`(가시성·Organization Admin 재판정) 단계를 삽입하고, 실패 시 트랜잭션이 롤백된다는
    note 를 추가한다. `4-integration.md §10.4` 에는 "커밋 직전 인가 재판정 실패(요청자가 begin~callback 사이 권한을
    잃음)" 행을 추가해 `RESOURCE_NOT_FOUND`/`ADMIN_REQUIRED` → "last_error 만 기록, status 보존" 을 명시한다. 둘 다
    이 PR 의 `spec_impact` 에는 없던 파일이라 별도 후속 spec 패치가 필요하다.

- **[INFO] RBAC §3.2 매트릭스의 "Integration (Personal): 자기 것"(Viewer 포함)과 §8 "아직 강제되지 않는 것"의
  Viewer 제약이 같은 표 안에서 각주 없이 갈린다**
  - target 위치: `spec/2-navigation/4-integration.md §8` "아직 강제되지 않는 것" 마지막 절 — "Viewer 의 자기
    personal 생성 · 별칭 수정 · rotate · 삭제. 라우트 가드가 Editor 라 막혀 있다 — 표보다 좁다."
  - 충돌 대상: `spec/5-system/1-auth.md §3.2` 리소스별 권한 매트릭스 — `Integration (Personal) | 자기 것 | 자기 것 |
    자기 것 | 자기 것` (Owner/Admin/Editor/Viewer 전부 "자기 것", 즉 매트릭스만 보면 Viewer 도 자기 personal 을
    CRUD 할 수 있는 것처럼 읽힌다).
  - 상세: 이 갭은 이 PR 이전부터 있었고(§3.2 표는 이번 diff 에 포함되지 않음, `--spec` 처리 표에서도 "변경 없음"으로
    확인됨) 이 PR 이 새로 만든 모순은 아니다. 다만 §3.2 는 바로 위(§3.2 "† Admin 멤버 삭제의 대상 제약")에 매트릭스와
    다른 세부 제약을 각주로 쓰는 관례가 있는데, "Integration (Personal)" 행에는 그 관례가 적용되지 않아 §3.2 만 읽는
    사람은 이 갭을 발견하지 못한다. 이번 PR 이 §8 에 "아직 강제되지 않는 것" 을 명문화하고 후속 plan
    (`integration-personal-owner-followup.md`)까지 만든 김에, §3.2 쪽에도 짧은 상호 참조를 남기면 두 문서를 따로
    읽었을 때의 불일치를 없앨 수 있다.
  - 제안: `spec/5-system/1-auth.md §3.2` 의 "Integration (Personal)" 행 또는 그 아래에 각주를 추가해 "Viewer 의
    생성·수정·rotate·삭제는 라우트 가드(`@Roles('editor')`)가 막아 이 표보다 좁다 — [통합 §8 아직 강제되지 않는
    것](../2-navigation/4-integration.md#8-권한-규칙)" 정도로 상호 참조. 필수는 아니며(§8 자체가 이미 정직하게
    적어 두었다) 다음 스캔의 재발견 비용을 줄이는 정도의 개선.

그 외 확인한 교차 지점은 정합했다: `5-system/3-error-handling.md §1.2` `ADMIN_REQUIRED` 카탈로그(발행처에
`IntegrationsService` 추가 반영), `conventions/error-codes.md §5`(rename 이력 등재 불필요 — `FORBIDDEN` 은 retired
아니고 전역 fallback 으로 계속 발행되므로 등재 대상 아님, 실측 확인), `4-nodes/4-integration/_product-overview.md`
INT-MG-07(§8 링크 추가 확인), `3-workflow-editor/4-ai-assistant.md`(`list_integrations`·`integration-selector`·
`mcp-server-selector`·`collectPendingUserConfig` 서술 전부 "남의 personal 제외" 로 갱신 확인, 실제 코드
`candidate-lookup.service.ts`/`explore-tools.service.ts`/`assistant-finish-guard.service.ts` 와 대조), `2-navigation/
9-user-profile.md §4.2`·`0-overview.md`(둘 다 diff 없음, §8 을 SoT 로 이미 위임해 두어 정합), `4-nodes/4-integration/
0-common.md §2`(노드 설정 패널의 Integration 선택 드롭다운은 `GET /api/integrations` 목록을 그대로 쓰므로 SQL 가시성
필터가 자동 적용 — 별도 후보 경로 아님).

## 요약

이번 PR 의 핵심 spec 변경(§8 판정 규칙)과 그 구현은 인접 spec 영역(RBAC §3.2, error-handling §1.2, INT-MG-07,
AI 어시스턴트 후보 계약, user-profile §4.2, overview)과 대체로 정합하며, `--spec`/`--impl-prep` 두 차례 검토와
4라운드 `/ai-review` + 광범위한 뮤테이션 테스트(P1–P20, R1–R14)가 이미 기능적 정합성을 촘촘히 눌러 놓았다. 다만
이 PR 이 구현 과정에서 새로 추가한 "OAuth 콜백 커밋 직전 인가 재판정" 분기(`assertRequesterStillAllowed`)는
`spec/data-flow/5-integration.md §1.2` 의 시퀀스 다이어그램과 `spec/2-navigation/4-integration.md §10.4` 에러
매핑 표 어디에도 반영되지 않아, 해당 두 문서를 SoT 로 참조하는 다음 사람이 이 새 실패 모드를 발견하지 못한다
(동작 자체는 안전하게 fallback 되므로 CRITICAL 은 아니다). RBAC §3.2 매트릭스와 §8 의 Viewer 제약 간 각주 부재는
이 PR 이전부터 있던 갭이라 부차적이다.

## 위험도

LOW
