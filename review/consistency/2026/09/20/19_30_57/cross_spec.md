# Cross-Spec 일관성 검토 — `spec/2-navigation` (impl-prep)

## 검토 범위와 방법

번들에는 `spec/2-navigation` 6개 파일(`1-workflow-list.md`, `2-trigger-list.md`, `3-schedule.md` 전문 +
`4-integration.md` 등 나머지는 컨텍스트 예산으로 절단) 과 `spec/0-overview.md` 전문이 포함됐고,
target 이 참조하는 다른 영역 spec(1-data-model, 5-system/1-auth, 5-system/2-api-convention,
5-system/3-error-handling, 5-system/14-external-interaction-api, 5-system/15-chat-channel,
data-flow/10-triggers, data-flow/11-workflow 등)은 전부 "본문 생략" 처리되어 번들만으로는 대조가
불가능했다. 이에 따라 위 파일들을 저장소에서 직접 `Read`/`grep` 하여 target 의 핵심 주장을 실제
SoT 와 대조했다. 검토는 target 이 명시적으로 인용하는 앵커·필드·상태·에러 코드·요구사항 ID 를
표본으로 삼았으며, 인용되지 않은 나머지 90여 개 파일 전체를 전수 대조하지는 않았다(아래 "한계"
참고).

## 대조 결과 (일치 확인)

다음 항목은 target 의 서술과 실제 SoT 문서가 **일치**함을 확인했다 — 발견사항이 아니라 검토
근거를 남기기 위해 기록한다.

- **Folder 엔티티** (`1-workflow-list.md §3.1`) — `(workspace_id, parent_id, name)` UNIQUE, 최대
  깊이 5, `parent_id` CASCADE, 같은 워크스페이스 한정, 비순환 제약이 `spec/1-data-model.md §2.5`
  와 정확히 일치.
- **Trigger / WebhookEndpointReservation** (`2-trigger-list.md §3`, §4.3) — `endpoint_path` 전역
  UNIQUE, 예약 영구 보존, FK CASCADE(workflow/workspace → trigger → schedule), `execution.trigger_id`
  SET NULL 이 `spec/1-data-model.md §2.8/§2.8.1/§2.9.1` 및 `spec/data-flow/10-triggers.md §1.4/§3.1`
  과 일치.
- **RBAC** (`2-trigger-list.md §4.1`, `1-workflow-list.md §3.1` 의 `editor+`) — `spec/5-system/1-auth.md
  §3.2` 의 `Trigger: CRUD/CRUD/CRUD/R` (Owner/Admin/Editor/Viewer) 와 일치. Auth Config Reveal
  Admin+ 제한도 트리거 상세의 "+ 새 인증 설정 만들기 Admin+" 서술과 정합.
- **API 응답 계약** (`§5.4` 부재 표현) — `TriggerDto.workflow` / `ScheduleDto.trigger.workflow` 의
  "키 생략(기준 b)" 판정이 `spec/5-system/2-api-convention.md §5.4` 의 판정 기준·검증 층 서술과
  일치. 목록 페이지네이션 shape(`data`+`pagination` 형제)도 `§5.2` 와 일치.
- **에러 코드 카탈로그** — `TRIGGER_ENDPOINT_PATH_CONFLICT`, `AUTH_CONFIG_NOT_FOUND` 모두
  `spec/5-system/3-error-handling.md` 에 등재되어 있고, 등재 내용이 target 의 서술과 일치(역참조도
  target 문서를 정확히 가리킴).
- **workflow duplicate 범위** (`1-workflow-list.md §2.6/§3`) — 캔버스 전체 복제, 버전·트리거·
  테스트 데이터셋 미승계, `is_active=false` 시작이 `spec/data-flow/11-workflow.md §1.5` 및 그
  Rationale("메타-only 서술의 철회")과 일치.
- **요구사항 ID** — `NAV-WF-04`(생성/복제/삭제), `NAV-WF-07`(공유 워크플로우 구분 표시) 모두
  `spec/2-navigation/_product-overview.md` 에 동일 의미로 정의되어 있어 재사용·충돌 없음.
- **Chat Channel provider 카탈로그** — target 이 나열하는 `telegram`/`slack`/`discord` 가
  `spec/4-nodes/7-trigger/providers/_overview.md §1` 의 supported 목록과 일치.
- **Chat Channel Rationale 앵커** — target 이 인용하는 R-CC-10/11/12/21, R-K, §5.4.1/§5.4.1.1/
  §5.4.1.2 앵커가 `spec/5-system/15-chat-channel.md` 에 실제로 존재.

## 발견사항

- **[INFO]** Folder 리소스가 RBAC 매트릭스 SoT 에 별도 행으로 없음
  - target 위치: `spec/2-navigation/1-workflow-list.md §3.1` (`POST/PATCH/DELETE /api/folders` 를
    `editor+` 로 명시)
  - 충돌 대상: `spec/5-system/1-auth.md §3.2 리소스별 권한 매트릭스`
  - 상세: §3.2 매트릭스는 Workspace/멤버/Workflow/Trigger/Schedule/Integration/Knowledge
    Base/Auth Config/Model Config/Statistics/System Status/Marketplace/Audit Log 를 개별 행으로
    나열하지만 **Folder 는 어디에도 등장하지 않는다** (`grep Folder spec/5-system/1-auth.md` 0건).
    target 의 `editor+` 는 Workflow/Trigger/Schedule 과 동일한 패턴이라 값 자체가 다른 영역과
    모순되지는 않지만, 그 값을 뒷받침하는 canonical SoT 행이 없어 향후 §3.2 가 갱신될 때 Folder
    가 빠진 채로 남을 위험이 있다 — 새 리소스 도입 시 RBAC 매트릭스 동시 갱신 관례
    (`CLAUDE.md`/spec 컨벤션이 요구하는 "정보 저장 위치 단일 진실")와 어긋난다.
  - 제안: CRITICAL/차단 사유는 아니므로 즉시 수정 요구는 아니지만, `5-system/1-auth.md §3.2`
    에 `Folder | CRUD | CRUD | CRUD | R` 행을 추가해 target 의 인라인 권한 서술을 SoT 에도
    반영하는 후속 편집을 권장한다 (project-planner 소관, `--spec` 게이트 통과 대상).

## 한계 (컨텍스트 예산으로 미검증)

번들이 절단한 94개 파일 중 아래는 target 이 빈번히 참조하지만 이번 검토에서 앵커 존재만
표본 확인했고 **본문 의미 전체를 라인 단위로 대조하지는 못했다**: `5-system/14-external-interaction-api.md`
§4/§7.1/§7.3, `5-system/12-webhook.md` WH-*, `conventions/chat-channel-adapter.md`,
`data-flow/12-workspace.md`. 이 자리에 없다는 사실을 "충돌 없음의 증거"로 확대 해석하지 말 것 —
후속 검토에서 이 영역이 변경되면 재대조가 필요하다.

## 요약

`spec/2-navigation` 의 표본 검증 대상(데이터 모델 필드·제약, RBAC 매트릭스, API 응답 계약(§5.2/§5.4),
에러 코드 카탈로그, 요구사항 ID, 트리거/스케줄/워크플로우 상태 전이 및 cascade 규칙)은 실제
`spec/1-data-model.md`, `spec/5-system/1-auth.md`, `spec/5-system/2-api-convention.md`,
`spec/5-system/3-error-handling.md`, `spec/data-flow/10-triggers.md`, `spec/data-flow/11-workflow.md`
와 모두 일치했으며, target 문서 자체가 이미 여러 Rationale 절에서 과거 drift(예: workflow duplicate
메타-only 오기술, Prisma 오기술)를 정정한 이력을 갖고 있어 cross-spec 정합도가 높다. 유일한
발견은 Folder 리소스가 RBAC 매트릭스 SoT 에 개별 행으로 등재되지 않은 문서화 갭(INFO)이며, 이는
값의 모순이 아니라 SoT 누락이다. impl-prep 을 차단할 CRITICAL/WARNING 은 발견되지 않았다.

## 위험도

LOW
