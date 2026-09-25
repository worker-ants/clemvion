# Rationale 연속성 검토

대상: `plan/in-progress/spec-draft-integration-personal-owner-callback.md` (spec draft, `--spec` 모드)
비교 대상: `spec/2-navigation/4-integration.md` `## Rationale`(«Personal 통합 소유자 강제» 외 전체), `spec/data-flow/5-integration.md` `## Rationale`, `spec/5-system/1-auth.md` §2~§3 본문(RBAC), 실제 구현 코드(`integration-oauth.service.ts` · `integration-visibility.ts`)

## 발견사항

- **[WARNING] "트래커에 질문으로 등재한다" 는 주장의 근거가 되는 트래커가 어디에도 없다**
  - target 위치: `## Rationale` → "왜 코드는 그대로인가" 항, `«요청자가 더는 볼 수 없는 행에 last_error 를 남기는 것이 맞는가» 는
    코드 판단이라 트래커(«통합 소유자 강제의 테스트 · 구조 잔여»)에 질문으로 등재한다`
  - 과거 결정 출처: 이 프로젝트의 확립된 관례 — `spec/2-navigation/4-integration.md` `## Rationale` §9.1
    ("§9.1 의 IntegrationDto 인벤토리 주장 경계") 의 "캐비엇의 유지 비용을 알고 둔다" 항은 유예하는 판단을 **실제로 트래커
    항목에 적었다** ("그 사실을 트래커 항목에도 적었다") 는 과거형으로 서술하고, 그 관례는 `review/code/2026/09/26/00_27_56/RESOLUTION.md`
    에서도 "W1 · W3 · W4 → 트래커 «통합 소유자 강제의 테스트 · 구조 잔여» 신설" 로 반복됐다.
  - 상세: `plan/`·`codebase/` 전체에서 `"통합 소유자 강제의 테스트 · 구조 잔여"` 문자열을 검색하면 이 target 문서와
    `review/code/2026/09/26/00_27_56/RESOLUTION.md`(이 이름을 "신설" 한다고 주장한 바로 그 라운드) 자신 외에는 **어디에도
    나오지 않는다** — 실제로 그 이름의 plan 파일이나 그 안의 체크리스트 항목이 생성된 적이 없다. `git show 0b25ed298`
    의 유일한 plan 변경은 `integration-personal-owner.md` 라운드 표에 요약 문장을 한 줄 추가한 것뿐이고, 그 라운드가
    "신설" 한다고 말한 개별 항목(W1 매니저 분기 unit·W3 조건부 쓰기 헬퍼·W4 e2e fixture)은 어느 파일에도 실체화되지
    않았다. 이번 target 은 그 **존재하지 않는 트래커**에 또 하나의 질문을 "등재한다" 고 적어, 같은 패턴(주장만 하고
    실제 파일에 쓰지 않음)을 한 번 더 반복한다. 반면 바로 같은 PR 계열의 실제 후속 트래커
    `plan/in-progress/integration-personal-owner-followup.md` 는 존재하고 checklist 형태로 유지되고 있는데(§8 "아직
    강제되지 않는 것" 4건이 여기 있다), target 은 이 실재 파일 대신 유령 이름을 가리킨다. `git diff`로 확인한 결과 이번
    PR 에서 `integration-personal-owner-followup.md` 에 가해진 유일한 수정은 frontmatter 오타 정정(`미착수`→`unstarted`)
    뿐이고 새 항목은 없다.
  - 제안: "등재한다" 를 실제로 수행한다 — `plan/in-progress/integration-personal-owner-followup.md`(또는 새 tracker 파일을
    실제로 생성)에 이 질문("요청자가 더는 볼 수 없게 된 행에 `last_error` 를 남기는 것이 맞는가")을 체크리스트 항목으로
    추가하고, target 의 Rationale 문장이 그 실재 경로를 가리키도록 고친다. 최소한 "등재한다"(현재/미래형)를 "등재 예정 —
    아직 어느 tracker 파일에도 없음" 처럼 정직하게 표시해 다음 사람이 존재하지 않는 이름을 다시 grep 하며 헤매지 않게
    한다.

## 정합성 확인 — 충돌 없음으로 판정한 항목 (기록용)

아래는 상충 가능성이 있어 보여 대조했으나 **기각된 대안의 재도입·원칙 위반·무근거 번복·invariant 충돌이 아님**으로
판정한 항목이다.

- **RESOURCE_NOT_FOUND · ADMIN_REQUIRED 재사용**: target 이 새로 추가하는 §10.4 행은 «Personal 통합 소유자 강제»
  Rationale 의 **채택된** 결정(옵션 2 "남의 personal 은 404", 결정문 "거부 코드는 ADMIN_REQUIRED 로 올렸다")을 그대로
  재사용한다. 기각된 대안 3("403 + 새 에러 코드 `INTEGRATION_OWNER_REQUIRED`")을 재도입하지 않는다. 코드
  (`integration-visibility.ts` `integrationNotFoundError`/`adminRequiredError`)와도 정확히 일치한다.
  `spec/2-navigation/4-integration.md` §8 "거부는 403 ADMIN_REQUIRED" 와도 일치.
- **`pending_install` 제외**: target 의 커밋 직전 재판정은 `pending_install` 행을 보지 않는다고 명시하는데, 이는
  «OAuthState.mode=reauthorize 를 초기 install 에도 재사용한 이유» Rationale(그 상태의 `state.user_id` 는 요청자가
  아니라 생성자)과 정합적이다. 코드(`persistReauthorizeState` 의 `userId: params.target.createdBy`, `handleInstall`
  이후 test-run 재진입 케이스 포함)로 교차 확인해도 이 예외 처리가 다른 재사용 케이스(연결된 행에 대한 request-scopes
  후 test-run 재실행)에서도 일관되게 "본인=createdBy" 정의와 맞아떨어진다 — 새로 가정을 우회하는 지점 없음.
  `assertRequesterStillAllowed` 의 `@Optional() workspacesService` 부재 시 **fail-closed**(거부)는 이 스펙 전반에
  퍼진 fail-closed 관례(§ Production fail-closed 가드 JWT_SECRET·ENCRYPTION_KEY·MCP 등)와 방향이 같다.
- **`data-flow/5-integration.md` §1.2 "callback 실패 시 status 보존" 일반 규칙과의 관계**: 기존 §10.4 에는 "코드 교환
  실패(mode=reauthorize, status=connected) → `error(auth_failed)`" 로 **전이**하는 예외 행이 이미 있다. target 이
  추가하는 재판정 실패는 토큰 교환 **이후**·커밋 **직전**의 별도 실패점이라 이 전이 규칙과 겹치지 않고, 오히려 target
  자신의 Rationale이 "connected 행의 다른 비-교환 실패(state mismatch·네트워크 오류)와 같은 규칙" 이라고 명시적으로
  자리를 밝혀 두어 두 규칙이 충돌하지 않게 구분했다.
- **RBAC §3.2 "자기 것" 각주 추가**: `spec/5-system/1-auth.md` 에는 Personal 통합에 대한 기존 서술이 매트릭스 행
  하나(`자기 것` × 4열)뿐이었고, 상충하는 기존 노트가 없어 순수 추가(cross-reference)다 — 새 Rationale 을 요구할
  성격의 변경이 아니다.
- **트랜잭션 커넥션으로 역할 재조회**: `WorkspacesService.getMemberRole(..., manager)` 를 "행 락을 쥔 트랜잭션 커넥션"
  으로 호출하는 설계는, BullMQ 관련 Rationale(「PostgreSQL advisory lock」 기각 사유: "lock 보유 중 HTTP 요청을 트랜잭션에
  묶으면 DB 커넥션 점유 시간이 늘어난다")과 표면적으로 유사해 보이지만, 이번 재조회는 단순 SELECT(역할 1행 조회)이지
  외부 HTTP 호출이 아니므로 그 우려가 적용되는 사례가 아니다. 오히려 3라운드 리뷰(review/code/2026/09/25/23_58_59)가
  "두 번째 커넥션을 빌리면 stale 역할을 읽는다" 는 CRITICAL 을 이미 잡아 이 설계로 수정된 이력이 있어(커밋
  `a8b5c8b13`), target 은 그 수정 이후 상태를 정확히 서술할 뿐이다.

## 요약

target 이 서술하는 "커밋 직전 인가 재판정" 자체는 `spec/2-navigation/4-integration.md` «Personal 통합 소유자 강제»
Rationale 의 채택 결정(옵션 1: 쓰기 경로를 닫는다) 범위 안에 있고, 기각된 대안을 재도입하지 않으며, 코드
(`assertRequesterStillAllowed` 등)와 대조해도 서술이 정확하다. RBAC §3.2 각주 추가도 상충 없는 순수 보완이다. 유일한
흠은 target 자신의 Rationale 이 "코드 판단을 트래커에 질문으로 등재한다" 고 주장하면서 가리키는 트래커
(«통합 소유자 강제의 테스트 · 구조 잔여»)가 실제로는 어느 plan 파일에도 존재하지 않는 이름이라는 점이다 — 이는 직전
`/ai-review` 4라운드에서 이미 "신설한다" 고 말해 놓고 실체화하지 않은 패턴을 그대로 이어받은 것이라, Rationale
연속성의 "결정 등재" 관행이 문서상 주장과 실제 파일 사이에서 계속 어긋나고 있음을 보여준다. 나머지 대조 항목은 모두
과거 Rationale·구현과 정합했다.

## 위험도

LOW
