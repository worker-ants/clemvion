# Cross-Spec 일관성 검토 — `spec/2-navigation/`

검토 모드: `--impl-prep` / target 파일: `0-dashboard.md`, `1-workflow-list.md`, `10-auth-flow.md`, `11-error-empty-states.md`, `13-user-guide.md`, `14-execution-history.md`, `15-system-status.md`, `16-agent-memory.md` (일부 truncated). 대조 대상: `spec/0-overview.md`, `spec/1-data-model.md`(§2.19 까지 확인).

## 발견사항

- **[WARNING]** `Workspace.timezone` 필드 경로 표기 불일치
  - target 위치: `spec/2-navigation/10-auth-flow.md` §6.2 "생성 규칙" 표 — `| Workspace.timezone | 브라우저 타임존 (Accept-Language 헤더에서 추론) 또는 UTC |`
  - 충돌 대상: `spec/1-data-model.md` §2.2 Workspace 엔티티 — `timezone` 은 top-level 컬럼이 아니라 `settings`(JSONB) 안의 알려진 키(`settings.timezone: string?`, NAV-SC-06)로만 정의되어 있다. Workspace 엔티티에 별도 `timezone` 컬럼은 존재하지 않는다.
  - 상세: §6.2 표의 다른 행(`Workspace.name`/`Workspace.slug`/`Workspace.type`/`WorkspaceMember.role`)은 모두 실제 top-level 컬럼이라, 같은 표기 관례를 따르는 `Workspace.timezone` 행도 top-level 필드처럼 읽힌다. 그러나 SoT(`1-data-model.md`)에는 timezone 이 `settings` JSONB 의 nested 키다. 문구 자체가 오타 수준이라 해도, 이 표는 "가입 시 무엇을 어디에 써야 하는가"를 정의하는 생성 규칙표라 신규 구현자가 문자 그대로 읽으면 별도 `timezone` 컬럼 마이그레이션을 추가하거나, 반대로 `settings.timezone` 에 값을 쓰는 기존 로직을 놓칠 위험이 있다. 또한 두 문서가 서술하는 "기본값 결정 시점"도 미묘히 다르다 — data-model 은 "값이 비어 있을 때 서버가 읽는 시점 fallback"(`미설정 시 process.env.TZ → UTC`)을 말하는 반면, auth-flow 는 "가입 시 브라우저 타임존을 추론해 즉시 기록"하는 쓰기 시점 규칙을 말한다. 두 규칙이 상호 보완적일 수도 있지만(가입 시 항상 값을 채우면 read-time fallback 은 legacy row 에만 적용), 문서 자체에는 그 관계가 명시돼 있지 않다.
  - 제안: `10-auth-flow.md` §6.2 의 필드명을 `Workspace.settings.timezone`으로 정정하고, "가입 시 기록되는 값"과 data-model 의 "미설정 시 read-time fallback" 이 서로 다른 시점의 규칙임을 한 줄로 상호 참조(예: data-model §2.2 각주에 "가입 시 채움 규칙은 auth-flow §6.2 참조"를 추가)하면 향후 drift 를 막을 수 있다.

- **[INFO]** Trigger 출처 분류(`triggerSource`)가 `Trigger.type = 'manual'` 케이스를 명시적으로 다루지 않음
  - target 위치: `spec/2-navigation/14-execution-history.md` §2.4 "Trigger 출처 분류" 표 (판정 우선순위: subworkflow → manual(`executed_by != null`) → schedule(`Trigger.type === 'schedule'`) → webhook(`Trigger.type === 'webhook'`) → unknown)
  - 충돌 대상: `spec/1-data-model.md` §2.8 Trigger 엔티티 — `type` enum 이 `webhook / schedule / manual` 세 값으로 정의되어 있어, `Trigger.type = 'manual'` 인 행이 데이터상 존재할 수 있음을 암시한다.
  - 상세: §2.4 판정 규칙은 `trigger_id`가 가리키는 Trigger 의 type 이 `schedule`/`webhook`일 때만 그 값으로 분류하고, `manual`은 오직 `executed_by != null` 여부로만 판정한다. 만약 `Execution.trigger_id`가 `type='manual'`인 Trigger 행을 가리키면서 동시에 `executed_by`가 NULL인 케이스가 실제로 존재한다면(예: 시스템이 대신 실행을 발화한 경우), 그 실행은 표의 5단계 우선순위 중 어디에도 매칭되지 않고 `unknown`으로 떨어진다 — "manual" trigger 인데 "manual" source 로 분류되지 못하는 사각지대다. 다만 현재 문서들만으로는 `Trigger.type='manual'` 행이 실제 UI/API 로 생성되는 경로가 있는지 확인할 수 없어(워크플로우 목록·대시보드 어디에도 "manual 트리거 생성" 플로우가 없다), 이론적 갭인지 실제 데이터 갭인지 불확실하다.
  - 제안: `Trigger.type='manual'` 행이 실제로 생성/참조되는 경로가 있는지 확인하고, 있다면 §2.4 판정 규칙에 `trigger_id != null && Trigger.type === 'manual'` 분기를 추가하거나(우선순위상 executed_by 케이스보다 뒤), 없다면(현재 enum 값이 예약/미사용이라면) data-model §2.8 또는 execution-history §2.4 어느 한쪽에 "manual type 은 Execution.trigger_id 로 참조되지 않는다"는 한 줄 주석을 추가해 두 문서의 암묵적 전제를 명시화.

- **[INFO]** `workflow-list.md` 상태 필터 설명의 잔존 모순 문구 (참고용 — 순수 cross-spec 은 아니나 API 계약 서술 신뢰도에 영향)
  - target 위치: `spec/2-navigation/1-workflow-list.md` §2.3 필터 표의 "상태" 행 — `⚠️ 현재 클라이언트는 서버 계약과 어긋난 파라미터를 보낸다 — 아래 경고 참고`
  - 충돌 대상: 같은 문서 바로 아래 인용문 — `상태 필터는 서버 계약(query-workflow.dto.ts)·클라이언트(page.tsx) 모두 ?status=active|inactive 로 정렬되어 end-to-end 동작한다 (과거 클라이언트가 ?isActive= 를 보내던 불일치는 수정 완료)`
  - 상세: 표 셀의 경고(⚠️)가 "현재도 어긋나 있다"고 단정하는 반면, 바로 아래 문장은 "수정 완료"라고 명시한다. 같은 문서 내 인접 서술이 서로 다른 시점의 상태(수정 전/후)를 모두 현재형으로 기술해, 이 섹션을 인용하는 다른 spec(예: 이 필터 동작을 전제하는 후속 작업)이 어느 쪽이 최신인지 오독할 위험이 있다.
  - 제안: 표 셀의 ⚠️ 문구를 제거하거나 과거형("과거엔 어긋났으나 수정됨")으로 통일해 인접 서술과 정렬.

## 요약

`spec/2-navigation/` 대상 8개 문서는 이미 상당히 성숙한 상태로, 요구사항 ID 재사용(EH-DETAIL-06/12 분리)·RBAC floor 상보 관계(Integration editor+ vs Organization-scope Admin+)·상태 enum(Execution 6종) 등 전형적인 cross-spec 충돌 소지가 되는 지점들은 이미 문서 내 Rationale 절에서 명시적으로 선점·해소되어 있다. 이번 검토에서 새로 발견된 것은 CRITICAL 급 모순은 없고, (1) `auth-flow.md` 의 워크스페이스 생성 규칙표가 `Workspace.timezone` 을 실제로는 `settings.timezone`(JSONB nested key)인 필드를 top-level 컬럼처럼 표기해 구현자를 오도할 소지가 있는 WARNING 1건, (2) Trigger 출처 분류 로직이 데이터 모델의 `Trigger.type='manual'` 값을 판정 우선순위에서 명시적으로 다루지 않는 잠재적 커버리지 갭, (3) 워크플로우 목록 문서 내 상태 필터 설명의 신구 문구 잔존 모순, 총 2건의 INFO 뿐이다. 전체적으로 구현 착수를 차단할 사안은 없다.

## 위험도

LOW
