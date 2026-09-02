# Cross-Spec 일관성 검토 — `spec-draft-ws-badge-flip-tracker-close.md`

## 검토 범위·방법

- target: `plan/in-progress/spec-draft-ws-badge-flip-tracker-close.md` (spec draft, `--spec` 모드)
- `spec_impact`: `spec/5-system/6-websocket-protocol.md`, `spec/5-system/2-api-convention.md`
- 조립된 프롬프트 번들은 컨텍스트 예산 초과로 `spec/5-system/6-websocket-protocol.md`
  본문(99,032자)이 **절단**돼 있었다 — 이 문서가 이번 draft 의 결정 ①·② 가 직접 인용하는
  1차 대상이므로, 절단된 채로는 판정이 무효하다고 보고 저장소의 실제 파일
  (`spec/5-system/6-websocket-protocol.md`, 1263줄)을 직접 읽어 대조했다. `spec/1-auth.md`,
  `spec/data-flow/8-notifications.md`, `spec/1-data-model.md`, `spec/conventions/spec-impl-evidence.md`,
  `spec/5-system/_product-overview.md` 등도 grep + 직접 열람으로 교차 확인했다.

## 발견사항

없음 — CRITICAL·WARNING·INFO 어느 등급의 cross-spec 충돌도 발견하지 못했다.

### 확인한 세부 사항 (참고용, 결함 아님)

- **데이터 모델**: 새 엔티티·필드 없음. `spec/1-data-model.md:300` 이 `Integration.status_reason` 의
  `token_expired` 값과 WS 이벤트 `auth.token_expired` 가 "표기가 유사하나 별개 네임스페이스"
  라고 이미 명시적으로 구분해 두고 있고, target 은 이 구분을 건드리지 않는다.
- **API 계약**: target 은 신규 endpoint 를 정의하지 않는다. `2-api-convention.md §10.4` 에 추가하는
  "한 줄 위임" 은 실제 `6-websocket-protocol.md §6.1`("서버발신 `disconnect()` 는 자동 재연결
  대상이 아니다")·`§6.2`("native WS 복구는 `execution.snapshot`, seq 재전송은 SSE 전용")와
  정확히 일치한다. `grep` 으로 다른 spec 문서에 같은 예외 문구의 중복 서술이 있는지 확인했으나
  없음 — 위임 방식이 실제로 두 번째 SoT 를 만들지 않는다.
- **요구사항 ID**: target 은 `R-ws-socket-lifetime-binds-token` Rationale 블록에 완료 사실 한 줄만
  추가한다(신규 ID 발급 없음). 이 ID·`R-wontdo-maintenance-appping`·`R-wontdo-rawws-rest` 는
  이미 해당 파일에 정의돼 있고 다른 영역에서 동일 ID 가 다른 의미로 쓰이는 사례는 없다.
- **상태 전이**: `status: partial → implemented` 승격 근거로 인용한
  `spec/conventions/spec-impl-evidence.md` §3 규칙("`partial` → `implemented`: 마지막
  `pending_plans` 가 `complete/` 로 이동한 commit 안에서 승격 (가드)")을 실제 파일에서
  확인 — 인용이 정확하다. `pending_plans` 로 지목된 4개 plan 파일
  (`spec-sync-websocket-protocol-gaps.md`, `spec-draft-ws-wontdo-maintenance-appping.md`,
  `spec-draft-ws-socket-lifetime-binds-token.md`, `ws-token-expired-socket-lifetime-impl.md`)이
  모두 `plan/in-progress/` 에 실존함을 확인했다. `execution.paused`/`execution.continue`/
  `execution.step` 배지가 여전히 "계획·미구현" 으로 남아도 승격을 막지 않는다는 draft 의
  선례 근거(`3-execution.md` frontmatter `status: implemented` + 활성 §6 로드맵 배지 공존)도
  실제 파일에서 확인했다 — 저장소에 이미 있는 정합 패턴과 일치한다.
- **RBAC**: 이번 변경은 권한 모델을 도입·수정하지 않는다. 토큰 만료 시 소켓을 끊는 동작은
  인가 범위 변경이 아니라 기존에 있던 갭(만료 토큰으로도 계속 이벤트 수신)을 닫는 것이며,
  `1-auth.md` 의 revoke 모델("명시적 revoke 는 이미 발급된 access token 을 무효화하지 않음")과
  `R-ws-socket-lifetime-binds-token` 의 "닫지 않는 것" 절이 이미 정합하게 서술돼 있다(target 이
  건드리는 절 아님).
- **계층 책임**: backend emit(`websocket.gateway.ts`)·frontend 구독(`ws-client.ts`)이 실제
  코드베이스에 모두 존재함을 `grep` 으로 확인했다(`AuthEventType.AUTH_TOKEN_EXPIRED` emit,
  `ws-client.ts` 의 `socket.on("auth.token_expired", …)`). decision ① 이 전제하는 "`#1266` 이
  backend·frontend 양쪽에서 구현했다" 는 사실과 어긋나지 않는다.
- **문서 상호참조**: `data-flow/8-notifications.md:347` 가 `auth.token_expired` 를 WS 이벤트
  점(`.`) 표기 선례로 인용하는데, 이 인용은 이번 승격과 무관하게 유효하며 target 변경으로
  깨지지 않는다. `2-api-convention.md §10-websocket` 절을 참조하는 다른 spec 문서
  (`_product-overview.md` 맵 링크뿐)도 §10.4 요약 문장을 복제하고 있지 않아, 위임 방식 변경이
  다른 문서를 stale 하게 만들지 않는다.

## 요약

target draft(`spec-draft-ws-badge-flip-tracker-close.md`)는 `6-websocket-protocol.md` 의
`status` 승격과 `2-api-convention.md §10.4` 예외 위임이라는 두 결정을 제안하며, 두 결정 모두
실제 두 spec 파일의 현재 본문·frontmatter·Rationale 과 정확히 합치했다(프롬프트 번들에서는 절단됐던
`6-websocket-protocol.md` 원문을 직접 대조). 다른 영역(`1-auth.md`, `1-data-model.md`,
`data-flow/8-notifications.md`, `spec-impl-evidence.md`, `_product-overview.md`)과의 데이터
모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 축에서도 모순이나 중복 SoT 를
발견하지 못했다. Cross-Spec 관점에서 이 draft 는 채택 가능하다.

## 위험도

NONE
