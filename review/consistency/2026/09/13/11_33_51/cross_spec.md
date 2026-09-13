# Cross-Spec 일관성 검토 — `guide-error-code-truth` (--impl-done, scope=`spec/5-system/`, 4번째 라운드)

## 전제

이 브랜치는 `spec/5-system/**` 를 한 건도 바꾸지 않았다(스코프 델타 0 — 코드·유저 가이드·harness
전용 PR 이라 정상). 프롬프트의 diff 절은 예산 초과로 절단되어 있어, 실제 변경분·현재 코드 상태는
워킹트리를 절대경로로 직접 대조했다(`git show/diff`, `grep -rn`).

이 plan(`guide-error-code-truth`)에 대해서는 이미 세 차례의 cross-spec 검토가 있었다
(`review/consistency/2026/09/13/{01_15_40,10_12_54,10_41_13,11_08_03}`). 그중 마지막
(`11_08_03`)은 커밋 `de99def86`(리뷰 라운드 2) 시점까지 확인했고 WARNING 2건(§1 카탈로그의
Integration/OAuth 코드 누락, `testConnection` 실패 shape 의 spec 앵커 부재)을 "이미 planner
등재된 pre-existing gap" 으로 판정했다. 이번 라운드는 (a) 그 이후 커밋
(`137784219` "리뷰 라운드 3" — `run-results{,.en}.mdx` 에 spec §1.4 대비 누락됐던 실재 코드 5종
보강)이 새 cross-spec 결함을 만들었는지, (b) 앞선 세 라운드가 보지 않은 각도(도메인별 에러 코드
카탈로그의 완전성)에 결함이 있는지를 추가로 봤다.

## 발견사항

- **[WARNING] MakeShop/Cafe24 도메인 에러 코드 카탈로그(`5-makeshop.md`/`4-cafe24.md` §6)가
  자기 자신의 코드베이스 대비 1종을 누락 — 이번 PR 이 그 미문서화 코드를 가이드에 처음 인용했다**
  - target 위치: `codebase/frontend/src/content/docs/02-nodes/integrations{,.en}.mdx`
    (`MAKESHOP_UNRESOLVED_PATH_PARAM` — 이번 PR 의 §C 수정으로 신규 인용)
  - 충돌 대상: `spec/4-nodes/4-integration/5-makeshop.md §6`(에러 코드 표, 11종 중
    `MAKESHOP_UNKNOWN_OPERATION`·`MAKESHOP_MISSING_FIELDS`·`MAKESHOP_INVALID_SHOP_UID` 세
    D4-prefight 코드만 등재하고 `MAKESHOP_UNRESOLVED_PATH_PARAM` 은 누락) · 같은 문제가
    `spec/4-nodes/4-integration/4-cafe24.md §6`(형제 코드 `CAFE24_UNRESOLVED_PATH_PARAM` 역시
    §6 표에 없음 — `codebase/backend/src/nodes/integration/cafe24/cafe24.handler.ts:453` 에는
    실재)에도 동형으로 존재
  - 상세: 실측 — `grep -rn "UNRESOLVED_PATH_PARAM" codebase/backend/src/nodes/integration/
    {makeshop,cafe24}/` 은 각각 handler 파일에서 1건씩 나오는데, `grep -n
    "UNRESOLVED_PATH_PARAM" spec/4-nodes/4-integration/*.md` 는 0건이다. 두 도메인 SoT 파일
    §6 에는 이 코드를 배제한다는 Rationale 도 없다 — 단순 누락으로 보인다(`HTTP_TIMEOUT(미발행)`
    처럼 의도적 제외를 명시한 선례와 다르다). 이 PR 이전에는 `integrations{,.en}.mdx` 가
    `MAKESHOP_API_ERROR` 하나만 (지어낸 이름으로) 인용했으므로 이 미문서화 코드가 유저 가이드에
    등장한 적이 없었다 — 이번 PR 의 §C 수정(`MAKESHOP_API_ERROR` → 실제 11종 중 7+4 분리 서술)이
    처음으로 이 갭을 유저 가이드 표면에 노출시켰다. 즉 이 PR 자체의 핵심 결함 클래스("가이드가
    적는 에러 코드에 spec 앵커가 없다")가 여기서도 한 단계 좁은 스코프로 재현된다 — `137784219`
    커밋 메시지가 스스로 지적한 "지어낸 이름을 없애면서 실재하는 이름을 빠뜨렸다" 와 같은 계열의
    사각지대이지만, 그 라운드가 고친 것은 **최상위 카탈로그**(`3-error-handling.md §1.4`) 였고
    **도메인별 카탈로그**(`4-cafe24.md`/`5-makeshop.md` §6)는 대조하지 않았다.
  - 상세(비판정 완화 사유): `plan/in-progress/spec-draft-nullable-notation-followups.md` 에
    이미 등재된 "`3-error-handling.md §1` 카탈로그가 통합·LLM 코드 계열을 통째로 누락" 항목의
    본문이 "실재 목록은 backend 전수로 11종(...`UNRESOLVED_PATH_PARAM`)" 이라고 이미 적어 두어
    이 코드의 존재 자체는 인지돼 있다. 다만 그 항목이 겨냥하는 파일은 `3-error-handling.md` 뿐이고
    `4-cafe24.md`/`5-makeshop.md` 자신의 §6 표 갱신은 명시 범위에 없다 — planner 턴에서 최상위
    카탈로그를 채울 때 도메인 SoT 두 파일도 함께 갱신 대상으로 넣지 않으면 이 특정 누락은 그대로
    남는다.
  - 제안: 기존 planner 항목(§1 카탈로그 누락)의 처리 범위에 "`4-cafe24.md §6`·`5-makeshop.md §6`
    에 `*_UNRESOLVED_PATH_PARAM` 행 추가"를 명시적으로 포함시키거나, 별도 한 줄로 등재한다.
    developer 는 `spec/**` 쓰기 권한 밖이라 이 PR 로 직접 닫을 수 없다 — 차단 사유는 아니다.

- **[INFO] `ModelTestConnectionResultDto.message` 의 `nullable: true` + `| null` 선언이 실제
  방출 패턴(키 생략)과 형태가 다름 — 이번 PR 이 만든 것도 악화시킨 것도 아닌 pre-existing 상태**
  - target 위치: `codebase/backend/src/modules/model-config/dto/responses/
    model-config-response.dto.ts` (`@ApiPropertyOptional({ nullable: true }) message?: string |
    null;`)
  - 충돌 대상: `spec/5-system/2-api-convention.md §5.4`("키를 생략하는 필드 → `@ApiPropertyOptional()`
    + `field?: T` (`| null` **금지**)")
  - 상세: `LlmService.testConnection` 의 반환 타입 주석은 `message?: string`(실측:
    `llm.service.ts:326` — `| null` 없음)이고 실제로 `message` 는 실패 시에만 문자열로
    포함되며 성공 시 키 자체가 생략된다(`null` 을 명시적으로 반환하는 경로 없음) — 즉 §5.4 의
    "키 생략" 패턴인데 DTO 는 "`null` 상시 존재" 패턴의 선언(`nullable: true` + `| null`)을
    같이 얹었다. 다만 이 선언 자체는 이번 PR 의 diff 가 만든 게 아니다 — `git show 911d9d7dd`
    확인 결과 `message?: string | null` / `nullable: true` 줄은 그대로이고 이번 PR 은 그
    바로 위에 주석만 추가했다(§5.4 는 이번 PR 이전부터 존재하던 규약).
  - 제안: 차단 사유 아님(§5.4 는 "소급 적용 대상 아님" 조항을 두고 있고, 클라이언트는 어차피
    optional chaining 으로 두 표현 모두 안전하게 처리한다). 이 DTO 를 다음에 만질 때
    `@ApiPropertyOptional()` + `message?: string` (`| null` 제거)로 정리하면 §5.4 와 정확히
    합치한다 — 지금 등재해 두면 다음 사람이 놓치지 않는다.

## 검증 완료 — 이번 라운드(`137784219`) 변경분이 기존 spec 과 충돌하지 않음을 재확인

- `run-results{,.en}.mdx` 신규 노드-카테고리 표(`DB_HOST_BLOCKED`·`EMAIL_HOST_BLOCKED`·
  `MAX_COLLECTION_RETRIES_EXCEEDED`·`SUB_WORKFLOW_QUEUE_FAILED`·`WORKFLOW_FORBIDDEN_WORKSPACE`
  5종 추가)를 `spec/5-system/3-error-handling.md §1.4` 노드-레벨 카테고리 표와 항목 단위로
  전수 대조 — HTTP/Database/Email/LLM/Code/Sub-workflow 여섯 카테고리 전부 정확히 일치한다
  (spec 이 "미발행" 으로 명시한 `HTTP_TIMEOUT` 은 가이드도 정확히 제외).
  `error-handling{,.en}.mdx` 는 이 표를 복제하지 않고 `run-results` 로 포인터만 걸어 두어 두
  SoT 가 갈릴 위험이 없다.
- `MAKESHOP_UNRESOLVED_PATH_PARAM` 을 제외한 나머지 10종(`MAKESHOP_404`·`422`·`4XX`·`5XX`·
  `AUTH_FAILED`·`RATE_LIMITED`·`TRANSPORT_FAILED`·`UNKNOWN_OPERATION`·`MISSING_FIELDS`·
  `INVALID_SHOP_UID`)은 `5-makeshop.md §6` 과 정확히 일치, "호출 전/후" 경계 서술도 spec 의
  `(D4)` prefight 마킹과 합치한다.
- CHANGELOG.md 의 정정된 수치("`code` 는 `integrations.service.ts` 4곳 + MCP 테스터 6곳")는
  실제 `TestConnectionResultDto.code` 선언·`spec/2-navigation/4-integration.md §9.1`
  (`200 + { success:false, code:'INTEGRATION_INCOMPLETE' }`)과 모순 없이 합치.
  `de99def86` 커밋 본문에 남아 있는 정정 전 "26곳" 서술은 과거 커밋 메시지라 지금 와서
  고칠 대상이 아니다(커밋 로그는 불변 기록).
- RBAC·상태 전이·요구사항 ID·데이터 모델 축: 이번 라운드 변경분(mdx 문서·plan 파일)은 코드를
  건드리지 않아 이 네 축과 충돌할 표면이 없다. `Editor+` 권한 게이트도 무변경.
- `user-guide-evidence.md` frontmatter `code:`·§2.1 관계표가 신규 가드 파일 3종을 아직
  반영하지 않은 상태는 `01_15_40`·`10_41_13`·`11_08_03` 이 이미 확인했고 이번 라운드도 상태
  무변(`spec/**` 미변경) — planner 항목 등재 재확인, 새 발견 아님.

## 요약

이번 라운드(`137784219`)가 `run-results{,.en}.mdx` 에 보강한 노드-카테고리 표 5종은
`spec/5-system/3-error-handling.md §1.4`·`5-makeshop.md §6` 과 정확히 합치하며 새 결함을
만들지 않았다. 다만 같은 라운드가 이미 스스로 지적한 "지어낸 이름을 없애면서 실재 이름을
빠뜨렸다" 는 사각지대의 **또 다른 인스턴스**를 도메인 카탈로그 레벨에서 하나 찾았다 —
`integrations{,.en}.mdx` 가 이번 PR 에서 처음으로 인용한 `MAKESHOP_UNRESOLVED_PATH_PARAM`
(및 형제 `CAFE24_UNRESOLVED_PATH_PARAM`)이 `4-cafe24.md`/`5-makeshop.md` 자신의 §6 카탈로그에
없다. 이 갭은 이번 PR 이 만든 게 아니라(코드는 이전부터 있었다) 기존 spec 의 pre-existing
누락이며, 이미 등재된 "§1 카탈로그 누락" planner 항목이 인지하고 있는 11종 목록에 이 코드가
이미 포함돼 있어 처리 경로는 존재한다 — 다만 그 항목이 겨냥하는 파일(`3-error-handling.md`)과
실제로 고쳐야 할 파일(도메인별 `§6`)이 갈라져 있어 명시적으로 범위를 넓히지 않으면 조용히
남을 수 있다. 이 PR 을 막을 사유는 아니다(Critical 0, developer 의 `spec/**` 쓰기 권한 밖).
두 번째 발견(`ModelTestConnectionResultDto.message` 의 nullable 선언 형태)은 이번 PR 과
무관한 사전 존재 상태로 정보 제공 목적의 INFO 다.

## 위험도

LOW
