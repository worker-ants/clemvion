## 발견사항

- **[INFO]** Planned 액션 목록의 동사형이 구현된 액션과 표기 방식 불일치
  - target 위치: `spec/5-system/1-auth.md §4.1` Planned 표 (`workspace.create`, `workflow.create`, `member.invite`, `trigger.create` 등)
  - 충돌 대상: `spec/5-system/1-auth.md §4.1` 구현된 액션 표 (`integration.created`, `integration.updated`, `integration.deleted` 등) + `codebase/backend/src/modules/audit-logs/audit-action.const.ts` 명명 규약 주석 ("integration 은 발생 사건을 기록하므로 과거분사 `created`/`updated`")
  - 상세: 구현된 액션과 `AUDIT_ACTIONS` const 는 `<resource>.<past-participle>` 형태(`integration.created`, `integration.updated`, `integration.rotated`)를 사용하지만, Planned 표는 같은 `<resource>.<infinitive>` 형태(`workspace.create`, `workflow.create`, `workflow.update`, `member.invite` 등)를 쓴다. `execution.re_run` 처럼 과거분사가 아닌 verb 도 이미 구현 목록에 들어가 있어 규약 자체가 "resource.verb (시제는 도메인별)" 임에도 불구하고, Planned 목록의 imperative 형태는 기존 integration 계열 과거분사형과 혼재될 경우 DB 질의 패턴에 혼란을 줄 수 있다. 현재 Planned 는 미구현이므로 실제 충돌은 발생하지 않지만, 구현 시 verb form 결정 없이 그대로 `AUDIT_ACTIONS` 에 추가하면 `workspace.create` vs `integration.created` 비일관이 재현된다.
  - 제안: Planned 표의 verb form 을 "구현 시 과거분사로 맞출 예정" 임을 주석으로 명시하거나, 아예 Planned 목록의 verb 를 과거분사형(`workspace.created`, `workflow.created`, `member.invited`)으로 미리 정규화. `execution.re_run` 처럼 과거분사가 부자연스러운 케이스만 예외로 문서화하면 충분하다.

- **[INFO]** `spec/5-system/1-auth.md §4.1` Planned 표에서 `workspace.transfer_ownership` 이 구현 완료됐음에도 워크스페이스 Planned 행에 잔존 여부 확인 필요
  - target 위치: `spec/5-system/1-auth.md §4.1` Planned 표 — 워크스페이스 행: `workspace.create, workspace.update, workspace.delete`
  - 충돌 대상: 구현된 액션 표의 워크스페이스 행: `workspace.transfer_ownership` (구현됨)
  - 상세: 구현된 액션 표에 `workspace.transfer_ownership` 이 있지만 Planned 표의 워크스페이스 행에는 `workspace.create, workspace.update, workspace.delete` 만 있다. 구현된 `workspace.transfer_ownership` 과 Planned 의 `workspace.create·update·delete` 는 서로 독립된 항목이므로 현재 내용은 모순이 아니다. 다만 `workspace.transfer_ownership` 의 naming 이 다른 워크스페이스 Planned 액션(`workspace.create`, `workspace.delete`)과 verb-form 이 이미 다르다는 점(전자는 snake_case noun phrase, 후자는 단일 verb)을 인지해야 한다.
  - 제안: 실제 충돌은 없으나, Planned 워크스페이스 행을 구현 시 `workspace.transfer_ownership` 과 동일하게 `workspace.created`, `workspace.updated`, `workspace.deleted` 형태로 맞출지 별도 결정을 요한다. 현재 문서에 이 결정이 명시되어 있지 않다.

- **[INFO]** `data-flow/1-audit.md §1.1` Rationale 의 legacy row 처리 방침이 query layer 에 명시적으로 반영되지 않음
  - target 위치: `spec/data-flow/1-audit.md` Rationale — "기존 레거시 row 는 audit 불변 원칙상 그대로 둔다"
  - 충돌 대상: `spec/data-flow/1-audit.md §2.1` 필터 설명 — `action`(완전 일치)
  - 상세: 기존 DB 에 `re_run_initiated` 로 적재된 레거시 row 는 `action=execution.re_run` 쿼리에서 히트되지 않는다. 완전 일치(exact match) 필터 방식이므로 이전 값과 이후 값이 양쪽으로 분산된다. `spec/data-flow/1-audit.md §2.1` 은 이 분기 상황을 언급하지 않는다.
  - 제안: `spec/data-flow/1-audit.md §2.1` 필터 설명에 "레거시 `re_run_initiated` row 는 `action=re_run_initiated` 로만 조회됨 — 신규 row 는 `execution.re_run`" 한 줄을 추가하거나, 조회 UI/API 문서에 migration 시점(G-02) 이전·이후 action 값이 다를 수 있다는 주석을 달면 운영 혼란을 방지할 수 있다. 차단 사유는 아니나 운영 관점 명확성을 위한 권장 사항이다.

## 요약

이번 변경(G-01/G-02)은 `re_run_initiated` → `execution.re_run` 리네임과 `AUDIT_ACTIONS` union type 도입으로 audit action 네이밍 일관성을 높이는 내용이다. `spec/5-system/1-auth.md §4.1` 과 `spec/data-flow/1-audit.md §1.1` 이 모두 이번 브랜치에서 함께 갱신됐으므로 코드-spec 간 직접 모순은 없다. 발견된 사항은 모두 INFO 등급이며, Planned 목록의 verb form 비일관(과거분사 미정규화), 레거시 `re_run_initiated` row 에 대한 query-layer 미언급이 향후 구현 및 운영 시 혼란을 줄 수 있는 수준이다. CRITICAL·WARNING 충돌은 발견되지 않았다.

## 위험도

LOW
