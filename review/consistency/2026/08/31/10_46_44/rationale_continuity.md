# Rationale 연속성 검토 — `plan/in-progress/spec-draft-lockout-and-alertrule.md`

## 발견사항

- **[WARNING]** ① "이메일 알림" 제거가 spec 본문 편집으로만 계획돼 있고 `5-system/1-auth.md` 의 `## Rationale` 에 정정 근거를 남기는 처방이 없다
  - target 위치: draft `## ① ... "이메일 알림" 은 틀렸다` §"처방 — 문구 제거" (draft 55~62행)
  - 과거 결정 출처: `spec/1-data-model.md` 의 `## Rationale` "WorkflowVersion.snapshot 구성 서술 정정 (2026-07-31)" 항목 — **같은 성격의 drift 정정**(spec 문서 한 곳이 구현/타 spec 과 어긋나 표현을 제거)을 처리할 때, 이 저장소는 본문만 조용히 고치지 않고 "drift 출처가 무엇이었는지, 왜 그 표현이 틀렸는지" 를 Rationale 에 남겨 두는 관례를 이미 세웠다("방치했다면 오해를 낳았을 것이다" 문구가 그 이유를 명시).
  - 상세: draft 의 ① 실측 표(SoT 3곳 대조: 코드·data-flow·에러 코드)는 정확히 그 정정-근거 Rationale 항목에 들어갈 내용이지만, "처방" 은 `5-system/1-auth.md:52` 표 문구 삭제만 지시하고 spec 의 `## Rationale` 갱신은 지시하지 않는다. 이대로 집행되면 이 실측 근거는 `plan/` (결국 `complete/`) 에만 남고, spec 자체에는 "왜 이메일 알림이 없는가/과거에 있었는데 왜 지워졌는가" 를 설명하는 흔적이 사라진다. 다음에 §1.1 표를 보는 사람은 "원래 이메일 알림이 없었는지, 있었다가 지워졌는지" 를 spec 만으로 재구성할 수 없다 — 바로 WorkflowVersion.snapshot 항목이 막으려던 실패 모드다.
  - 제안: 처방에 "`5-system/1-auth.md` `## Rationale` 에 짧은 정정 항목(예: '§1.1 로그인 실패 행의 이메일 알림 문구 제거 (2026-08-31)') 을 추가하고, 위 실측 표(코드/data-flow/에러코드 SoT 대조)를 그 항목에 옮겨 담는다" 를 명시적으로 추가.

- **[WARNING]** ② `alert_rule` 을 `1-data-model.md` 로 등재하며 "기각한 대안" 텍스트가 draft 자체의 Rationale 에만 있고, target spec(`1-data-model.md`)의 `## Rationale` 로 이식하라는 처방이 없다
  - target 위치: draft `## ② alert_rule(V016) 이 데이터 모델 SoT 에 없다` §"처방 — §2.25 에 엔티티 섹션 신설" (draft 84~119행) vs draft 자체의 `## Rationale` §"기각한 대안 — alert_rule 을 9-observability.md 에 그대로 두기" (draft 165~169행)
  - 과거 결정 출처: `spec/1-data-model.md:833` 의 §2.24 앞 "**넘버링 주의**" 인라인 노트 — 이 문서는 SoT 배치·번호 재사용 여부 같은 편집 판단을 **본문에 흘려 쓰지 않고 근거를 남기는** 관례가 이미 있다(RerankConfig 구 §2.16.1 번호를 재사용하지 않는 이유를 명시). 또한 같은 문서 `## Rationale` 전체가 "이 엔티티가 왜 이 위치·이 형태인가" 를 기록하는 자리로 이미 쓰이고 있다(WorkflowVersion.snapshot 항목 등).
  - 상세: "처방" 섹션은 §2.25 표 신설·인덱스·§1 트리 반영만 지시한다. "기각한 대안 — 9-observability.md 에 그대로 두기" 라는, SoT 원칙에 정면으로 관련된 논거는 draft 파일 하단(plan 문서 자신의 Rationale)에만 적혀 있고, 이를 spec `1-data-model.md` 의 `## Rationale` 에도 옮겨 적으라는 지시가 없다. plan 은 `complete/` 로 이동(또는 archive)되므로, spec 만 보는 사람에게는 "왜 alert_rule 정의가 여기 있고 9-observability 는 발췌만 하는가" 의 근거가 남지 않는다.
  - 제안: 처방에 "§2.25 신설과 함께 `1-data-model.md` `## Rationale` 에 'alert_rule(V016) 을 §2.25 로 등재 — SoT 원칙, 기각한 대안: 9-observability.md 존치' 항목을 추가한다" 를 명시적으로 추가. §2.24 앞 "넘버링 주의" 노트와 같은 인라인 각주 형태도 대안이 될 수 있으나, 이 결정은 엔티티 하나 전체의 배치 결정이라 `## Rationale` 항목이 더 적합하다.

- **[INFO]** ③ `Notification.type`(§2.19) 닫힌 목록에 `alert_` 계열 3개 값 추가는 Rationale 신설 없이도 무방
  - target 위치: draft `## ③ ... Notification.type 이 닫혀 있는데 값이 빠졌다` §"처방" (draft 136~140행)
  - 상세: 이는 새로운 설계 결정이 아니라 이미 코드가 방출하는 값(`alerts-evaluator.service.ts:213`)을 닫힌 목록에 반영하는 사실 정정이다. `data-flow/9-observability.md` Rationale 의 "닫힌 집합을 실제 배선된 값만 열거" 원칙과 방향이 같다(코드↔문서 동기화를 요구하는 그 원칙을 오히려 이행하는 쪽). 별도 Rationale 항목 없이 "§2.25 에서 파생" 각주만으로도 충분하다고 판단되나, 원한다면 위 ①·②와 같은 자리에 한 줄 덧붙여도 좋다.

## 검증한 사실 (Rationale 위반 없음을 뒷받침)

- `git log -S "이메일 알림" -- spec/5-system/1-auth.md` → 최초 PRD/spec 일괄 작성 커밋(`05089d5a6`/`ca227cc36`) 이후 **한 번도 수정된 적 없다**. 별도 Rationale 항목으로 "채택"된 결정이 아니었으므로, 제거가 "기각된 대안의 재도입"이나 "합의된 결정의 번복"에 해당하지 않는다. `spec/2-navigation/9-user-profile.md §5.3`(실제 이메일 즉시발송 목록: 실행 실패·Integration 만료·팀 초대)도 계정 잠금을 포함하지 않아 draft 의 실측과 일치한다.
- `spec/1-data-model.md` 의 최종 top-level 엔티티는 `§2.24 LlmUsageLog` (실측 확인) — draft 가 다음 번호로 `§2.25` 를 쓰는 것은 정확하다.
- draft 가 제안한 §2.25 필드·타입·FK 동작(`workflow_id` CASCADE nullable, `created_by` **SET NULL**)·인덱스(`(workspace_id)`, `(enabled) WHERE enabled=true` partial)는 실제 마이그레이션 `codebase/backend/migrations/V016__alert_rules.sql` 과 1:1 로 일치한다 — 근거를 지어낸 곳이 없다.
- `channel` 값 도메인 차이(`AlertRule.channel`: in_app/email vs `Notification.channel`(§2.19): in_app/email/both)는 draft 가 스스로 명시하고 통합을 시도하지 않아, 두 엔티티의 독립적 값 도메인이라는 기존 설계를 침해하지 않는다.
- `spec/2-navigation/9-user-profile.md §6.3` 의 기존 alert API 계약(`type`/`threshold`/`window?`/`channel?`/`workflowId?`/`enabled?`)이 draft 의 §2.25 필드 구성과 정확히 대응 — 새 데이터 모델이 기존에 이미 문서화된 API 계약과 충돌하지 않는다.
- `plan/in-progress/spec-sync-auth-gaps.md` 의 "추가 발견" 두 항목(W1 계정 잠금 알림·W2 alert_rule SoT)과 "auth 트래커라 주제가 안 맞아 임시로 둔다" 메모가 실제로 존재해, draft §④ 의 트래커 종결 서술과 일치한다.
- 기각된 대안 재도입, 데이터 모델·auth·observability spec 의 기존 `## Rationale` 항목이 정한 원칙(예: install_token 형식, refresh 회전 원자성, health probe 분리, 감사 로그 분리 등)과의 충돌은 발견되지 않았다.

## 요약

draft 는 두 항목(계정 잠금 이메일 알림 문구 제거, `alert_rule` 데이터 모델 등재) 모두 **실측 근거가 탄탄**하고 과거에 명시적으로 채택된 결정을 뒤집거나 기각된 대안을 되살리는 사례는 없다 — "이메일 알림" 문구는애초 별도 Rationale 없이 최초 일괄 작성 커밋에 들어간 미검증 서술이었고, `alert_rule` 등재는 이미 구현·타 spec 이 합의한 내용을 SoT 로 옮기는 문서 정합화다. 다만 이 저장소는 같은 성격의 정정(§2.15 `settings` 제거, §2.24 번호 재사용 회피 각주)마다 `## Rationale` 에 근거를 남기는 관례를 스스로 세워 두었는데, 이번 draft 의 "처방" 절은 본문 편집만 지시하고 그 근거를 대상 spec 의 `## Rationale` 로 이식하라는 지시가 빠져 있다 — 집행 시 근거가 plan 문서에만 남고 spec 에는 흔적이 사라질 위험이 있다.

## 위험도

MEDIUM
