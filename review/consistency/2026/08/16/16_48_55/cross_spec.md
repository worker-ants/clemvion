# Cross-Spec 일관성 검토 — `plan/in-progress/eia-internal-rest-error-masking.md`

## 발견사항

- **[WARNING]** WS 프로토콜 spec 의 `execution.snapshot` 항목이 이번 마스킹 결정을 반영하지 않는다
  - target 위치: `## 조치` 표면 전수 #6 (`websocket.gateway.ts:399` → `findById`), spec 초안 ① 불릿 (`POST /executions/:id/re-run` 과 WS `execution.snapshot` 은 `findById` 를 재사용하므로 함께 덮인다)
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md:182`(`execution.snapshot` 필드 표) 및 §6.2(`:872`)
  - 상세: `execution.snapshot` 은 `ExecutionsService.findById` 가 반환하는 **Execution 전체 객체**를 그대로 싣는다고 `6-websocket-protocol.md` 자신이 명시한다(`:182`, `:872`). target 은 바로 그 `findById` 를 마스킹 관문으로 확장하므로, `execution.snapshot` payload 의 nested `execution.error`/`nodeExecutions[].error` 는 이 PR 이후 원문에서 마스킹값으로 바뀐다. 그런데 target 의 spec 초안은 `14-external-interaction-api.md` §R17 만 고치고, WS 이벤트 카탈로그의 정본 위치인 `6-websocket-protocol.md` 의 `execution.snapshot` 행/§6.2 본문은 건드리지 않는다. 이 저장소는 최근에도 "WS 이벤트 값·타입의 정본 위치 7곳 정정"(#1176)을 별도 PR 로 돌려야 했을 만큼 WS 카탈로그 정본 위치 drift 가 반복돼 온 영역이다 — `6-websocket-protocol.md` 만 보는 독자는 `execution.snapshot.execution.error` 가 이제 마스킹된다는 사실을 알 수 없다.
  - 제안: `6-websocket-protocol.md:182`(필드 표) 또는 §6.2 본문에 한 줄 — *"`execution` nest 안의 `error`/`nodeExecutions[].error` 는 [EIA §R17](./14-external-interaction-api.md#r17-...) 의 내부 REST 마스킹 관문(`findById` 경유)을 그대로 상속한다"* — 를 planner 턴 체크리스트(현재 ⓐⓑⓒⓓ)에 ⓔ 로 추가. 이 spec 은 `status: partial` 이고 `pending_plans: spec-sync-websocket-protocol-gaps.md` 를 이미 갖고 있으므로, 별도 PR 로 미루더라도 그 트래커에 최소 항목만은 등재해야 "정본 위치 drift" 재발을 막는다.

- **[WARNING]** `12-background.md`(background-runs 엔드포인트, 4-nodes 영역)가 이번 결정으로 바뀌는 자기 응답 스키마를 문서화하지 않는다
  - target 위치: `## 설계` "표면 전수" 절 및 §R17 초안 불릿의 *"자매 표면인 `GET /executions/:id/background-runs/:id` 의 body 노드도 같이 건다"*
  - 충돌 대상: `spec/4-nodes/1-logic/12-background.md` §8.2 (응답 스키마, `nodeExecutions.data: NodeExecution[]`)
  - 상세: 실측 확인 — `background-runs.service.ts:302` 는 실제로 `redactStoredErrorForResponse(row.error)` 를 호출해 이 엔드포인트의 `nodeExecutions[].error` 를 마스킹한다(코드는 target 의 서술과 일치). 그러나 `12-background.md` §8.2 는 이 필드의 shape 을 *"[실행 상세 조회 §5.1] 재사용"* 이라고만 적고, 마스킹 여부는 전혀 언급하지 않는다. 이 엔드포인트의 정본 spec 은 `4-nodes/1-logic/12-background.md`(다른 영역)인데, target 의 planner 턴 체크리스트(ⓐⓑⓒⓓ)와 `spec_impact` frontmatter 둘 다 이 파일을 포함하지 않는다 — 구현은 끝났는데 그 엔드포인트를 소유한 spec 영역만 조용히 stale 해진다.
  - 제안: `12-background.md` §8.2 의 `nodeExecutions.data` 행(또는 §8.2 서두)에 *"`error` 필드는 [EIA §R17](../../5-system/14-external-interaction-api.md#r17-...) 의 내부 REST 마스킹을 상속한다(자매 표면)"* 한 줄을 planner 턴 항목으로 추가. `spec_impact` frontmatter 에도 이 파일을 추가.

- **[INFO]** frontmatter `spec_impact` 가 target 본문이 스스로 예고하는 영향 범위보다 좁다
  - target 위치: frontmatter `spec_impact:` (2개 파일) vs 체크리스트 `planner 턴 ⓑ` (`14-execution-history.md` 갱신 예고)
  - 충돌 대상: `spec_impact` 목록 자체(`spec/5-system/14-external-interaction-api.md`, `spec/conventions/secret-store.md`)와 본문의 ⓑ 항목
  - 상세: 본문은 R-5 경계를 `2-navigation/14-execution-history.md` 에 별도 명시하는 작업을 planner 턴 ⓑ 로 이미 예고했지만, 이 파일은 `spec_impact` 리스트에 없다. `spec_impact` 를 소비하는 후속 게이트(Gate C 등)가 이 리스트만으로 영향 범위를 판단한다면 ⓑ 대상 파일이 자동 번들링에서 누락될 수 있다.
  - 제안: planner 턴 착수 시 `spec_impact` 에 `spec/2-navigation/14-execution-history.md`(그리고 위 두 WARNING 이 채택되면 `6-websocket-protocol.md`·`4-nodes/1-logic/12-background.md`)를 추가.

- **[INFO]** `Execution.error` 마스킹과 API 규약 §5.3 의 "원문 echo 금지" 원칙의 관계가 명시되지 않는다
  - target 위치: "전제를 무수정 프로브로 먼저 실증했다" 표 마지막 행 (`Node "Send Email" failed` → 무변화)
  - 충돌 대상: `spec/5-system/2-api-convention.md:167` (§5.3 에러 응답 — *"내부 구현 원문 ... 을 echo 하지 않는다 — 정보 노출(CWE-209) 방지"*)
  - 상세: 직접 모순은 아니다 — §5.3 은 요청 자체가 실패했을 때의 HTTP 에러 envelope(`{error:{code,message}}`, `GlobalExceptionFilter`)에 대한 규칙이고, `Execution.error` 는 200 응답 안의 도메인 데이터라 `3-error-handling.md:126`(*"두 레이어 분리"*)가 이미 이 구분을 문서화해 뒀다. 다만 target 자신의 프로브가 보여주듯 `deepRedactSecrets` 는 자격증명 패턴만 잡고 일반 내부 예외 텍스트(`"Node ... failed"`)는 그대로 통과시킨다 — 이는 §5.3 이 요구하는 수준(내부 구현 원문 전면 비echo)보다 명백히 느슨하다. 같은 "error.message" 라는 이름과 같은 CWE-209 동기를 공유하는 두 필드가 다른 강도의 정책을 갖는다는 점이 문서 어디에도 교차 인용돼 있지 않아, 이후 보안 감사·리뷰에서 "§5.3 위반" 으로 재지적될 소지가 있다.
  - 제안: §R17 교체 불릿 또는 그 옆에 한 줄 — *"본 마스킹은 §5.3(HTTP 에러 envelope)과 다른 레이어(도메인 데이터, `3-error-handling.md` 두 레이어 분리 원칙)이며, 자격증명 패턴만 겨냥한다(§5.3 의 전면 비echo 와 범위가 다름을 의도함)"* — 를 추가하면 향후 오탐 재지적을 예방.

- **[INFO]** `secret-store.md` Overview 의 절대 문구가 이제 예외 2건을 안는다
  - target 위치: 스펙 초안 ② (`Trigger.config.interaction.triggerToken` 비대상 신설)
  - 충돌 대상: `spec/conventions/secret-store.md:13` (*"모든 도메인 모듈 ... 은 본 convention 의 `SecretResolver` 를 경유"*)
  - 상세: 이미 `AuthConfig.config` 예외(§1, `:40`)가 이 절대 문구와 형식상 어긋나 있었고, target 의 D 결정이 같은 패턴의 두 번째 필드-단위 예외를 추가한다. 직접 모순이라기보다 문구의 정밀도 문제 — "모듈" 단위 서술인데 실제 예외는 "필드" 단위다.
  - 제안: Overview 문장에 "필드 단위 명시적 예외는 §1 비대상 절에 등재" 정도의 완화 어구를 planner 턴에서 함께 다듬으면 향후 세 번째 예외가 또 같은 혼동을 반복하지 않는다. 급하지 않음 — 이번 PR 필수 아님.

## 검증 메모 (충돌 아님 — 참고용 확인)

- `spec/1-data-model.md:556-562` §2.14 원본/복사 표는 target 의 CRITICAL C2 인용(§2.14 가 `Execution.error` 를 최초 failed NodeExecution 의 **복사**로 정의)과 정확히 일치한다.
- `spec/2-navigation/14-execution-history.md:464-466` R-5 는 target 의 인용(Config 탭 한정, "롤 게이팅이 아니라 서버 boundary masking parity")과 정확히 일치하고, `Execution.error` 를 이미 규정하고 있지 않다는 target 의 구분도 맞다.
- `spec/2-navigation/9-user-profile.md:229-233` RBAC 매트릭스는 "워크플로우 조회 = Viewer ✅" 이며 target 의 "no `@Roles` 게이트 = viewer 포함 전원 조회" 전제와 상충하지 않는다(오히려 뒷받침).
- `spec/3-workflow-editor/3-execution.md:478` §10.6.1 은 노드별 서브탭(Error 탭 = `NodeExecution`/`output.error` 레벨)이라 target 의 W1-(c) "다른 컬럼이라 동반 갱신 불요" 판정과 일치.
- `spec/5-system/14-external-interaction-api.md:1462-1487` 현재 §R17 텍스트(결정 2026-08-16, 종결 emit 마스킹 + "내부 REST 와의 비대칭은 미결이다")는 target 이 인용한 "현재(미결 선언)" 문구와 정확히 일치 — #1177/#1178 이후 상태를 정확히 반영해 시작하고 있다.
- `spec/conventions/secret-store.md:40` "비대상 — `AuthConfig.config`" 는 target 의 "현재 AuthConfig.config 만 있다" 서술과 일치, D 항목 삽입 위치(그 블록 뒤)도 구조적으로 무리 없다.
- `spec/5-system/14-external-interaction-api.md:910` "향후 secret store 통합 검토" 문구도 target 의 인용과 일치, 교체 대상으로 정확히 지목됨.
- `spec/5-system/2-api-convention.md`/`3-error-handling.md` 는 REST 에러 envelope 과 엔진/도메인 error 데이터를 이미 "두 레이어 분리" 로 명시적으로 나눠 두고 있어(`3-error-handling.md:126`), target 의 접근(도메인 데이터 값만 마스킹, 계약 형태 불변)이 이 기존 레이어 분리와 구조적으로 정합한다.
- 정본 트래커 `spec-sync-external-interaction-api-gaps.md` 의 I1/D 항목은 target 이 서술한 "2026-08-16 사용자 택일" 내용과 정확히 일치 — 병렬 세션 충돌 없음.

## 요약

target 의 핵심 결정(내부 REST `Execution.error` 마스킹, `interaction.triggerToken` secret-store 비대상 예외)은 인용한 기존 spec(§2.14 원본/복사, R-5, §R17 선례, secret-store.md 현재 비대상 블록, `:910`)과 실측 대조 결과 전부 정확하며 직접적 CRITICAL 모순은 발견되지 않았다. 다만 이번 변경이 실제로 건드리는 코드 경로(WS `execution.snapshot` 의 `findById` 재사용, background-runs 엔드포인트의 `nodeExecutions[].error` 마스킹 — 코드로 확인함)를 소유하는 **다른 두 spec 영역**(`5-system/6-websocket-protocol.md`, `4-nodes/1-logic/12-background.md`)이 target 의 planner 턴 체크리스트와 `spec_impact` 어디에도 포함돼 있지 않아, 구현이 반영된 뒤에도 그 두 문서만은 조용히 stale 해질 위험이 있다 — 이 저장소가 최근에도 겪은 "WS 이벤트 정본 위치 drift" 와 같은 패턴이다. 나머지 두 건(API 규약 §5.3 과의 관계, secret-store Overview 문구)은 실질 충돌이 아니라 교차 참조 보강 권고 수준이다.

## 위험도
MEDIUM
