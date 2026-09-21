# Rationale 연속성 검토

## 검토 대상

- scope: `spec/2-navigation` (spec 델타 0 — 코드 전용 PR, 정상)
- 실제 diff: `codebase/backend/src/modules/integrations/integrations.service.ts`(+82/-... 리팩터) ·
  `integrations.service.spec.ts` · `codebase/backend/test/integration-delete-concurrency.e2e-spec.ts`(신규) ·
  `CHANGELOG.md` · `plan/in-progress/integration-dup-delete.md`(신규) ·
  `plan/in-progress/spec-draft-nullable-notation-followups.md`
- 프롬프트 예산 절단으로 `spec/2-navigation/4-integration.md` 본문과 실 diff 가 생략되어, 워킹트리
  절대경로(`git diff origin/main..HEAD`, `Read spec/2-navigation/4-integration.md`)로 직접 재확인함.

## 발견사항

- **[INFO] "기각된 advisory lock 재도입" 자기소명 — 근거 확인, 위반 아님**
  - target 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `remove()` 신규 주석,
    `CHANGELOG.md` "동시 DELETE 두 건이 `integration.deleted` 감사 행을 두 번 남기던 것" 항,
    `plan/in-progress/integration-dup-delete.md` §B
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` `## Rationale` → "BullMQ `cafe24-token-refresh`
    큐 — 멀티 인스턴스 race 해소" 항의 "배제한 대안" — **PostgreSQL advisory lock**
    (`pg_advisory_xact_lock(hashtext(integrationId))`), 기각 사유: "코드 단순하지만 lock 보유 중 HTTP
    요청(Cafe24 endpoint)을 transaction 안에 묶어야 해 DB 커넥션 점유 시간이 늘고, BullMQ 가 이미
    스택에 있어 별도 메커니즘 추가의 운영 부담이 더 큼."
  - 상세: target 코드 주석·CHANGELOG 가 스스로 "`4-integration.md` Rationale 이 기각한 advisory lock
    의 재도입이 아니다: 기각 사유는 «lock 보유 중 HTTP 요청» 인데 여기엔 외부 호출이 없다" 고 명시
    한다. 실제로 이번 PR 은 advisory lock 을 전혀 들이지 않고 원자적 `DELETE … WHERE id=$1 AND
    workspace_id=$2` 의 `affected` 만으로 판정한다 — 기각된 대안을 다시 채택한 것이 아니라 애초에
    그 대안 자체를 쓰지 않는다. 인용도 기각 사유의 핵심(HTTP 보유)만 정확히 짚었다(운영 부담 사유는
    이 맥락과 무관해 생략된 것으로 보이며 왜곡은 아니다).
  - 제안: 조치 불필요. 다만 이 자기소명이 코드 주석/CHANGELOG 에만 있고 `4-integration.md` 의
    Rationale 본문에는 교차 링크가 없다 — 다음에 같은 지점을 재검토할 사람을 위해, 향후
    `4-integration.md §9` 갱신(아래 두 번째 항목) 시 이 구분을 한 줄로 각주하면 재확인 비용이 준다.

- **[WARNING] "DELETE 는 멱등(O)" 표와 신규 "패자 요청 404" 동작의 정합 서술 부재 — 이미 추적 중이나 target scope 로 재확장됨**
  - target 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `remove()` —
    동시 DELETE 패자가 이제 `204` 대신 `404 RESOURCE_NOT_FOUND` 를 받는다(승자만 감사·
    `broadcastCredentialChange` 진행). `plan/in-progress/spec-draft-nullable-notation-followups.md` 의
    해당 체크리스트 항목이 이번 커밋에서 `4-integration.md §9` 를 대상에 추가함.
  - 과거 결정 출처: `spec/5-system/2-api-convention.md` §3 "HTTP 메서드" 표 — `DELETE | 리소스 삭제 |
    O`(멱등). `spec/2-navigation/4-integration.md` §9 API 표는 `DELETE /api/integrations/:id` 를
    "삭제 (사용처 있으면 409)" 로만 적고 동시 삭제 시 패자가 404 를 받는다는 서술이 없다.
  - 상세: 이 결함 클래스(#1369 workflows·#1370 triggers·#1371 schedules·이번 integrations)는 매번
    "동시 DELETE 두 건 중 패자는 이제 404" 로 응답 계약을 바꾸지만, 그 결정이 `1-workflow-list.md`
    §2.6·`data-flow/12-workspace.md` §1.10·`3-schedule.md` §4·`4-integration.md` §9 어디에도 아직
    반영되지 않았다(트리거 목록 §4.4 만 유일하게 그 계약을 문서화). REST 관용상 "멱등"은 보통
    최종 상태 수렴을 뜻하고 응답 코드까지 고정하지 않으므로 §3 표 자체가 깨졌다고 보기는 어렵지만,
    "결정의 무근거 번복" 이 아니라 "번복은 근거가 있는데 그 근거가 target spec 문서 어디에도 아직
    telling 되지 않은" 상태라, 다음 리더가 §3 의 "O" 를 "패자도 항상 204" 로 오독할 여지가 남는다.
  - 제안: 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 `4-integration.md §9`
    를 이번 라운드(`--impl-prep review/consistency/2026/09/21/10_27_27` W3)에 새로 추가해 추적 중이며,
    3라운드 연속 "비차단" 으로 처분된 선례(트리거/스케줄 축)와 동일한 낮은 우선순위 항목이다 —
    지금 즉시 target 을 막을 필요는 없다. 다만 그 백로그 항목을 실제로 집행할 때 `4-integration.md
    §9` 갱신과 함께 `2-api-convention.md` §3 에 "DELETE 의 멱등성은 최종 상태 기준이며, 동시 요청
    중 패자는 404 를 받을 수 있다" 는 한 줄 각주를 추가하는 것을 권한다 — 그래야 이번처럼 개별
    spec 파일마다 같은 질문이 반복되지 않는다.

## 요약

이번 diff(`IntegrationsService.remove()` 의 원자적 `DELETE`+`affected===0` 판정 전환)는 `spec/2-navigation/4-integration.md`
Rationale 이 명시적으로 기각한 PostgreSQL advisory lock 대안을 실제로는 채택하지 않았고, 코드 주석·CHANGELOG 가
그 구분을 스스로 정확히 밝혀 두어 "기각된 대안의 재도입" 은 성립하지 않는다. 유일하게 남는 결은 이 결함 클래스
전체(워크플로·트리거·스케줄·통합)가 반복적으로 DELETE 응답 계약을 "패자도 204" 에서 "패자는 404" 로 바꾸면서,
그 사실이 `spec/5-system/2-api-convention.md` §3 의 "DELETE = 멱등(O)" 표나 각 대상 spec 문서 어디에도 아직
반영되지 않은 점인데, 이는 이번 PR 이 새로 만든 결함이 아니라 이미 세 라운드째 추적·비차단으로 처분되어 온
백로그이며 이번 커밋이 그 범위에 `4-integration.md §9` 를 정확히 추가했다. Rationale 연속성 관점에서 target 은
과거 결정을 은밀히 뒤집거나 근거 없이 번복하지 않았고, 오히려 기각 이력을 능동적으로 인용·구분했다.

## 위험도

LOW
