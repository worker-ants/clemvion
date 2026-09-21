# Cross-Spec 일관성 검토 — `spec/2-navigation` (impl-prep)

## 검토 범위 안내

target 문서 번들 중 실제 본문이 전달된 것은 `1-workflow-list.md` · `2-trigger-list.md` ·
`3-schedule.md` (+ 루트 `0-overview.md`) 뿐이었다. `4-integration.md` · `6-config.md` ·
`9-user-profile.md` 등 다수 파일과, `related_specs` 로 딸려오는 `1-data-model.md` ·
`5-system/*` · `data-flow/*` 대부분이 컨텍스트 예산으로 절단되어 있었다. 이번 impl-prep 대상
작업(`IntegrationsService.remove()` 동시 삭제 감사 중복 수정, `plan/in-progress/integration-dup-delete.md`)
이 정확히 `4-integration.md` 의 삭제 계약을 건드리므로, 해당 파일과 이를 참조하는
`spec/data-flow/5-integration.md` · `spec/data-flow/1-audit.md` · `spec/1-data-model.md §2.10`
를 `Read` 로 직접 열어 대조했다. 그 외 절단된 파일은 이번 발견사항과 직접 연결되는 지점이 없어
근거로 삼지 않았다(빈 내용 = "문제 없음" 으로 간주하지 않았다).

## 발견사항

- **[WARNING]** Integration 상태 전이 다이어그램이 `error` 상태의 삭제 경로를 누락 — 다른 spec 영역(data-flow)이 target 영역(navigation)보다 좁게 말한다
  - target 위치: `spec/2-navigation/4-integration.md` §6 상태 전이 (전이 표 `→ (삭제)` 행, L739: "사용자가 명시적으로 Delete 액션을 수행한 경우에만... 자동 삭제는 없음" — 특정 출발 상태로 한정하지 않음) + §9.1 API (L814: `DELETE /api/integrations/:id` = "삭제 (사용처 있으면 409)", status 조건 없음) + §2.1 목록 더보기 메뉴(L74: "삭제(차단 시 비활성)" — 비활성 조건은 사용처 존재 여부일 뿐 status 가 아님)
  - 충돌 대상: `spec/data-flow/5-integration.md` §3.1 `integration.status` mermaid state diagram (L376-379) — `connected --> [*]: 삭제` / `pending_install --> [*]: manual delete` / `expired --> [*]: manual delete` 세 전이만 있고 **`error --> [*]` 전이가 없다**
  - 상세: 실제 구현(`codebase/backend/src/modules/integrations/integrations.service.ts` `remove()`, L761-784)은 `status` 를 전혀 검사하지 않고 사용처(`usages`) 유무만으로 삭제를 허용한다 — `error` 상태 통합도 예외 없이 삭제 가능하며, 이는 target 문서(§6·§9.1·§2.1)가 이미 정확히 서술하는 바다. 그런데 data-flow 쪽 상태 다이어그램만 `error` 를 종단 처리에서 빠뜨려, 이 다이어그램을 참조해 "허용된 상태 집합" 을 판단하면 `error` 상태 삭제가 스펙 밖 동작처럼 보인다. 지금 착수하려는 작업이 바로 이 `remove()` 를 손대는 자리(atomic `DELETE` 로 전환)이므로, 구현자가 data-flow 쪽 다이어그램을 상태-가드의 근거로 오독해 "error 상태는 삭제 대상이 아니다" 라는 status guard 를 새로 끼워 넣으면 §6/§9.1/§2.1 이 이미 보장하는 동작(및 UI 의 "삭제(차단 시 비활성)" 문구)을 깨는 회귀가 된다.
  - 제안: `spec/data-flow/5-integration.md` §3.1 다이어그램에 `error --> [*]: 삭제` 전이 한 줄 추가 (다른 두 종단 전이와 대칭). 이번 PR 의 `spec_impact: none` 범위 밖이므로 이 수정 자체를 이번 PR 에 강제할 필요는 없으나, `remove()` 구현 시 상태 가드를 추가하지 않는 근거로 target 문서(§6/§9.1)를 우선 참조하도록 developer 주의 환기.

- **[INFO]** 동시 DELETE idempotency 계약이 형제 리소스 문서 중 하나(trigger)에만 명시되어 있다
  - target 위치: `spec/2-navigation/2-trigger-list.md` §4.4 결과·에러 (L558): "동시 삭제: 두 클라이언트가 동시에 같은 트리거를 삭제하면 두 번째는 `404 RESOURCE_NOT_FOUND`"
  - 충돌 대상: `spec/2-navigation/1-workflow-list.md`(전체) · `spec/2-navigation/3-schedule.md`(전체) — 두 문서 모두 동일한 "동시 DELETE 두 건이 감사 행을 두 번 남기는" 결함을 최근 각각 수정했음에도(`4a9828afe` workflow, `fc5ea6b76` schedule — 이번 세션 git log) 결과로 드러나는 "두 번째 요청은 무엇을 반환하는가" 계약을 본문에 서술하지 않는다. `spec/5-system/2-api-convention.md` · `spec/5-system/3-error-handling.md` 에도 "동시 DELETE" 를 다루는 cross-cutting 규칙이 없다(grep 0건) — 즉 이 계약은 어느 한 곳에도 공식적으로 통합되어 있지 않고 트리거 문서에만 우연히 존재한다.
  - 상세: 지금 착수하는 Integration 삭제 수정도 같은 결함 클래스(`plan/in-progress/integration-dup-delete.md` §A 표)이며, 완료되면 "두 번째 요청은 404" 라는 동일한 관찰 가능 계약이 생긴다. 그런데 target 영역 안에서조차 이 계약을 적을 자리(트리거처럼 §4.4 류 절)가 workflow-list·schedule·(이번에 다룰) 4-integration 어디에도 없어, 이후 사람이 "트리거만 이 동작을 하나?" 로 오독할 여지가 있다. Critical/Warning 급 모순은 아니고(트리거 문서가 틀린 것도 아니고, 다른 문서들이 침묵할 뿐 반대 주장을 하지도 않는다) 문서 커버리지의 비대칭이다.
  - 제안: 리소스별로 각각 채우기보다, `spec/5-system/2-api-convention.md` 에 "동시 DELETE — 패자는 404 RESOURCE_NOT_FOUND, 클라이언트는 무시 가능" 같은 cross-cutting 절을 신설하고 트리거 문서의 L558 을 그쪽 링크로 좁히는 편이 향후 동일 패턴 반복(schedule·workflow·integration 넷째)의 문서 부채를 막는다. 이번 PR 의 `spec_impact: none` 결정과는 별개 트랙 — 즉시 처리를 요구하지 않음.

## 요약

target 영역(`spec/2-navigation`)의 로드된 세 문서(workflow-list·trigger-list·schedule)는 서로 간, 그리고 `0-overview.md` 와는 뚜렷한 모순 없이 정합적이다(요구사항 ID·API 계약·RBAC 표는 상호 참조가 명시적이고 이미 "모순 아님" 근거까지 inline 으로 정리되어 있다). 이번 impl-prep 대상 작업이 실제로 건드리는 `4-integration.md`(번들에서는 절단됨, 직접 Read)를 그 데이터-흐름 짝문서(`data-flow/5-integration.md`)와 대조한 결과 하나의 실질적 WARNING(상태 다이어그램이 `error` 상태의 삭제 종단을 빠뜨려, 지금 진행할 `remove()` 리팩터링이 그 다이어그램을 근거로 상태 가드를 잘못 추가할 여지)과 형제 리소스 문서 간 문서 커버리지 비대칭 INFO 하나를 확인했다. 둘 다 이번 PR 의 `spec_impact: none` 결정을 뒤집을 필요는 없고, CRITICAL 급 데이터 모델·API 계약·요구사항 ID 충돌은 발견되지 않았다.

## 위험도

LOW
