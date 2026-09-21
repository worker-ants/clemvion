# Rationale 연속성 검토 — spec/2-navigation (--impl-prep, member-dup-remove)

## 발견사항

### [WARNING] DELETE 멱등성 표와의 "정면 충돌"이 이번 PR 로 여섯 번째 사례를 얻는다 — 이미 열린 tracker 항목의 재확인

- target 위치: 이번 구현이 고치는 `WorkspacesService.removeMember()` (spec 소유: `spec/data-flow/12-workspace.md §1.6`, `spec/2-navigation/9-user-profile.md §4.1/§6.1`). 충돌 대상은 cross-cutting 문서 `spec/5-system/2-api-convention.md §3` HTTP 메서드 표의 `DELETE | 멱등성 O`.
- 과거 결정 출처: 이 충돌은 developer 스스로가 이미 한 번 지적·기록했다 — `plan/in-progress/spec-draft-nullable-notation-followups.md` 4857~4862행이 이전 `--impl-done`(integration PR, `review/consistency/2026/09/21/11_42_00` WARNING 1, **rationale_continuity**)의 결론을 인용한다: "다섯 경로 전부 동시 삭제의 진 쪽에 404 를 준다... 이것은 **적힌 것과 다르게 동작한다**."
- 상세: `2-api-convention.md §3`은 "DELETE = 멱등 O"만 적고 각주가 없다. workflow·workspace·trigger·schedule·integration 다섯 경로가 이미 "동시 삭제의 진 쪽=404"로 고쳐졌고, 이번 PR로 `workspace_member` 삭제(여섯 번째)도 같은 패턴(원자적 `delete()` 의 `affected===0` → 404)을 따른다. 즉 이 PR 은 새 위반을 만드는 것이 아니라 **이미 식별된 미해결 충돌의 인스턴스 수를 5→6으로 늘린다**. 같은 트래커의 다음 대기열(`AuthConfigsService.remove()`·`ModelConfigService.remove()`·webauthn credential 삭제, 7~9번째)까지 합치면 이 표의 각주 필요성은 더 커진다.
- 제안: 새로 막을 필요는 없다(이미 3라운드 연속 "비차단"으로 처분된 planner 항목, `spec_impact` 는 developer 권한 밖). 다만 이번 PR의 plan(`member-dup-remove.md`) 체크리스트나 트래커 갱신 시 "다섯 경로" 표현을 "여섯 경로(+ 대기 중 셋)"로 갱신해 두어, 그 planner 각주 작업이 스코프를 놓치지 않게 한다.

### [INFO] `data-flow/12-workspace.md §1.6`(멤버 제거)가 "동시 삭제 → 두 번째 404" 서술 부재 목록에서 빠져 있다

- target 위치: `spec/data-flow/12-workspace.md §1.6` (`DELETE /api/workspaces/:id/members/:memberId`), `spec/2-navigation/9-user-profile.md §4.1`·`§6.1`.
- 과거 결정 출처: `plan/in-progress/spec-draft-nullable-notation-followups.md` 4849행의 열린 planner 항목 — "`1-workflow-list.md §2.6` · `data-flow/12-workspace.md §1.10` · `3-schedule.md §4` · `4-integration.md §9` 에 «동시 삭제 → 두 번째 404» 서술이 없다"(트리거 §4.4 만 있음).
- 상세: 이 열거는 워크플로/워크스페이스-삭제(§1.10)/스케줄/통합 네 자리만 나열하고, **멤버 제거(§1.6)는 포함하지 않는다**. `removeMember()`가 이번 PR로 같은 계열에 합류하면 §1.6도 같은 침묵(서술 부재)을 갖게 되어 그 목록에서 빠진 다섯 번째 구멍이 된다.
- 제안: 해당 planner 항목의 나열에 `data-flow/12-workspace.md §1.6` 을 추가하도록 트래커를 갱신한다(이번 PR이 코드를 병합한 뒤). 우선순위는 기존 항목과 동일(낮음·비차단)로 두면 된다.

### [WARNING] --impl-prep 번들이 이 구현이 건드리는 코드의 spec 소유 문서를 컨텍스트 예산으로 통째로 생략했다

- target 위치: 조립된 프롬프트의 `spec/2-navigation/9-user-profile.md`, `6-config.md` 등 15개 파일 — 전부 "⚠️ 본문 생략됨 — 컨텍스트 예산 초과"로 대체되어 있다.
- 과거 결정 출처: 없음(이번 조립 자체의 결함). 다만 동일 클래스 문제가 기존에도 기록된 바 있다(`--spec` 모드 예산이 conventions 를 통째로 떨구는 선례).
- 상세: `9-user-profile.md` frontmatter `code:` 는 `codebase/backend/src/modules/workspaces/**` 를 명시적으로 포함한다 — 즉 이번 PR이 고치는 `WorkspacesService.removeMember()` 의 **spec 소유 문서 그 자체**가 이 rationale-continuity 검토용 번들에서 빠졌다. 저장소를 직접 `Read` 하여 보완 확인한 결과 `9-user-profile.md`·`data-flow/12-workspace.md`·`5-system/1-auth.md` 어디에도 `removeMember()`의 동시성/락 정책을 직접 규정하거나 이번 처방(원자적 DELETE, 락 없음)과 충돌하는 명시적 Rationale은 없었다. 하지만 이는 수동 보완 확인이며, 번들 예산 로직이 이 파일을 습관적으로 떨어뜨리면 다음 회차에는 실제 충돌을 놓칠 수 있다.
- 제안: (a) 이번 판정에는 실질적 영향 없음(수동 확인 완료). (b) harness 차원에서 --impl-prep 번들 예산 산정 시 "이번 diff/plan 이 실제로 건드리는 코드의 `code:` 소유 문서"를 우선순위 상위로 고정하는 개선을 고려할 가치가 있다(기존 `--spec` 모드 예산 이슈와 같은 클래스).

### [WARNING] owner 보호 invariant 의 TOCTOU 창 — spec 이 무조건 서술("owner 는 제거 불가")하지만 이번 PR 은 닫지 않는다

- target 위치: `plan/in-progress/member-dup-remove.md` §C.2 (개발자 자신이 인지·기록한 미해결 항목). 대응 spec invariant: `spec/data-flow/12-workspace.md §1.6`("owner 는 제거 불가"), `spec/5-system/1-auth.md §3.2 †`("Admin 의 멤버 삭제는 대상이 Owner 인 경우 거부된다").
- 과거 결정 출처: 위 두 spec 자리는 이 invariant를 조건 없이 서술한다(레이스 상황을 언급하지 않음).
- 상세: `removeMember()`의 현재(및 이번 PR 이후) 코드는 `member.role === 'owner'` 가드와 `assertAdmin` 검사를 **무락 읽기 위에서** 수행한다. 동시에 `transferOwnership`이 대상을 owner로 승격시키면, 가드를 통과한 뒤 실제로 owner 가 제거될 수 있다 — spec이 서술하는 invariant를 우회하는 설계다. plan 자신도 이를 §C.2로 인지하고 "재현되는지 프로브로 먼저 확인 → 재현되면 별건 사안으로 등재, 안 되면 이유를 적는다"로 미뤘다. 즉 이번 PR은 감사 중복만 닫고 이 창은 의도적으로 그대로 둔다.
- 제안: 이 자체는 새로 도입되는 결함이 아니라 기존 갭의 (재)확인이라 이번 PR을 막을 사안은 아니다. 다만 plan의 D 체크리스트("C-2 owner 승격 TOCTOU 프로브")가 완료되기 전에 `plan/complete/`로 옮기지 말고, 결과(재현 여부와 근거)를 `data-flow/12-workspace.md §1.6` 곁에 트리거 삭제 §4.3의 "남는 창" 패턴처럼 명시적으로 남기거나, 별도 트래커 항목으로 등재해 invariant 서술과 실제 보장 사이의 간극이 묵시적으로 방치되지 않게 한다.

## 요약

target(`spec/2-navigation`, 특히 `1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md`)은 이번 구현이 따르는 "무락 삭제 → 원자적 DELETE 의 affected 로 판정" 패턴(workflow/trigger/schedule/integration 선례, #1369~#1372)과 정합적이며, 앞선 PR들이 이미 `4-integration.md` Rationale의 기각된 advisory-lock 대안을 재도입하지 않았음을 명시적으로 확인한 선례가 있고 이번 PR도 같은 근거(외부 HTTP 호출 없음)로 동일 패턴을 따른다 — 기각된 대안의 재도입이나 무근거 번복은 발견되지 않았다. 다만 (1) `5-system/2-api-convention.md §3`의 "DELETE=멱등 O" 서술과 실제 "동시 요청 진 쪽=404" 동작 간의 정면 충돌이 이번 PR로 여섯 번째 인스턴스를 얻는데 이는 이미 열린 planner tracker 항목의 재확인이고, (2) 그 tracker의 "서술 부재" 목록이 멤버 제거(§1.6)를 아직 포함하지 않으며, (3) --impl-prep 번들이 이 구현의 spec 소유 문서(`9-user-profile.md`)를 예산 초과로 통째로 생략했고(수동 보완 확인상 실질적 충돌은 없었음), (4) owner 보호 invariant 의 TOCTOU 창이 spec의 무조건적 서술과 어긋날 여지가 있음에도 plan이 의도적으로 미룬 상태다. 넷 다 이번 PR을 차단할 성격은 아니며 대부분 이미 알려진 논점의 재확인·정밀화에 해당한다.

## 위험도

MEDIUM
