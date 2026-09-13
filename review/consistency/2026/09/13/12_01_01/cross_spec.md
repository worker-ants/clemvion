# Cross-Spec 일관성 검토 — cross_spec

## 검토 범위 및 방법

- target scope: `spec/5-system/` (`--impl-done`, diff-base `origin/main`).
- **spec 델타 0** — 이 브랜치는 `spec/**` 을 전혀 바꾸지 않았다(전수 확인:
  `git diff origin/main...HEAD --name-only -- spec/` 출력 없음). 실제 변경은
  `codebase/backend`(LLM·Integrations DTO/서비스), `codebase/frontend`(유저 가이드 MDX +
  API 클라이언트), `.claude/lib/docs/__tests__/`(신규 가드 3종), `plan/`·`review/`·
  `CHANGELOG.md`·`PROJECT.md` 이다. 따라서 본 검토는 "target 문서 vs 다른 spec 영역"
  이 아니라 **"이번 구현·문서 변경이 인용하는 사실이 기존 spec 여러 영역과 합치하는가"**
  로 수행했다(§ 검토 모드 지시에 따라 CWD 대신 워킹트리 절대경로/`git show HEAD:`로 확인).
- 프롬프트 번들은 예산 초과로 `spec/5-system/*` 대부분과 `git diff` 본문이 절단되어 있어,
  절단된 부분은 워킹트리에서 `git diff origin/main...HEAD`·`Read`·`grep` 으로 직접 재확인했다.
- 이 세션 직전 라운드(`review/consistency/2026/09/13/11_33_51`)가 이미 동일 변경분에
  대해 cross_spec 검토를 수행해 CRITICAL 1건(naming_collision 소관, `MAKESHOP_UNRESOLVED_PATH_PARAM`
  이 실제 방출 코드가 아님)과 WARNING 1건(도메인 카탈로그 §6 누락)을 냈다. 커밋
  `42680d5f9`(fix(guide): CRITICAL 해소)로 CRITICAL 은 해소됐고, 이후 커밋(`171627852` 하니스
  전용, `d32886607`·트리거 바인딩 커밋들)은 이 스코프의 코드/문서를 다시 건드리지 않았다 —
  즉 HEAD 는 그 라운드가 검증한 최종 상태와 동일하다. 본 라운드에서는 그 결론을 재검증하고
  추가 각도(데이터 모델·API 계약·상태 전이·RBAC·계층 책임)를 훑었다.

## 발견사항

- **[INFO] 도메인 에러 코드 카탈로그(`spec/4-nodes/4-integration/5-makeshop.md §6` ·
  `4-cafe24.md §6`)가 `*_UNRESOLVED_PATH_PARAM` 1종을 여전히 누락 — 기존 등재 확인**
  - target 위치: (spec 델타 없음 — 이번 PR 은 `codebase/frontend` MDX 만 수정)
  - 충돌 대상: `spec/4-nodes/4-integration/5-makeshop.md §6`(에러 코드 표, `MAKESHOP_UNRESOLVED_PATH_PARAM`
    미기재) · `spec/4-nodes/4-integration/4-cafe24.md §6`(형제 `CAFE24_UNRESOLVED_PATH_PARAM`
    도 미기재)
  - 상세: 이번 PR 이 고친 유저 가이드(`integrations.mdx`)는 이제 이 실패를
    `INTEGRATION_CALL_FAILED`(공용 fallback) + `message` 접두 형태로 정확히 서술하지만,
    그 근거가 되는 두 도메인 spec 자신의 §6 에러 코드 표에는 여전히 이 실패 형태
    (`throw new Error(...)` → 일반 fallback 귀속)가 등재돼 있지 않다. `developer` 는
    `spec/**` 쓰기 권한이 없어 직접 고치지 못했고, 대신 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    에 "§1 최상위 카탈로그 누락" 항목의 처리 범위를 `4-cafe24.md §6`/`5-makeshop.md §6`
    갱신까지 명시적으로 확장해 등재했다(실측: 해당 plan diff 에 `MAKESHOP_UNRESOLVED_PATH_PARAM`·
    `CAFE24_UNRESOLVED_PATH_PARAM` 신규 체크리스트 항목 확인). 이번 코드/문서 변경 자체가
    새로 만든 결함이 아니라, 기존에 갈라져 있던 문서 계층(최상위 카탈로그 `3-error-handling.md
    §1.4` vs 도메인별 카탈로그 `§6`) 간 동기화 누락이 이번 실측으로 드러나 이미 tracker 에
    올라간 상태다.
  - 제안: 다음 `project-planner` 턴에서 `spec-draft-nullable-notation-followups.md` 를 처리할 때
    두 파일의 §6 표에 해당 행(설명: "path placeholder 미해결 — 일반 `Error` throw 로
    `IntegrationError` 가 아니므로 공용 fallback `INTEGRATION_CALL_FAILED` 로 귀속, 실제
    사유는 `message` 접두 `*_UNRESOLVED_PATH_PARAM: ...`")을 함께 추가할 것. BLOCK 사유
    아님 — 등급을 CRITICAL/WARNING 이 아니라 INFO 로 낮춘 이유는 (a) 코드-문서 불일치가
    사용자에게 잘못을 보여주는 방향이 아니라 spec 내부 문서 계층 간 완전성 누락이고
    (b) 이미 명시적으로 tracker 에 등재되어 유실 위험이 없기 때문.

- **[없음 — 확인 후 기각] `LlmService.testConnection` 반환 필드 `error → message` 이 API 계약
  spec 과 충돌하는지 점검**
  - `spec/2-navigation/6-config.md` §3 API 표(`POST /api/model-configs/:id/test`)는
    성공 응답만 `{ success }` / `{ success, dimension? }` 로 서술하고 실패 시 필드 이름은
    명시하지 않는다. 이번 diff 는 실패 필드명을 `error` → `message` 로 정정했는데, 이는
    이미 그 spec 표가 실패 필드명을 규정하지 않고 있으므로 이번 변경과 **모순되지 않는다**
    (DTO·프런트엔드가 원래 `message` 를 참조하고 있었음 — `CHANGELOG.md` 실측 병기).
    다만 그 API 표 자체가 실패 응답 형태를 아예 서술하지 않는 것은 pre-existing 갭이며
    이번 PR 이 만든 것이 아니라 스코프 밖으로 판단해 별도 발견으로 등재하지 않는다(직전
    라운드 `convention_compliance`/`cross_spec` 도 이 항목을 "위반 아님/pre-existing" 으로
    분류해 조치 불요로 닫았다 — 동일 결론).

- **[없음 — 확인 후 기각] `TestConnectionResultDto.code` 신설 필드가 §9.1 문서와 합치**
  - `spec/2-navigation/4-integration.md` §9.1(`POST /api/integrations/:id/test`)은
    `200 + { success:false, code:'INTEGRATION_INCOMPLETE' }` 형태를 이미 명시하고 있고,
    §4.2 `IntegrationTestResult.code` 서술과도 일치한다. DTO 에 `code?: string` 을 추가한
    것은 이미 문서화된 실제 방출 필드를 선언에 반영한 것으로, 새 계약을 만들지 않는다.
    `latencyMs`·`meta` 제거도 실측(생산자 0건, `meta` 는 해당 엔드포인트 반환 타입에
    없음)과 spec 어디에도 그 두 필드가 언급되지 않는다는 점이 일치한다.

- **[없음 — 확인 후 기각] `nodeName` → `nodeLabel` 필드명 정정(`run-results.mdx`)**
  - `spec/5-system/6-websocket-protocol.md`(2026-08-16 정정)와 `spec/5-system/3-error-handling.md`
    (2026-08-17 정정)가 이미 "엔진 emit 전수가 `nodeLabel`, `nodeName` emit 은 0건"이라고
    명시해 두었다. 유저 가이드가 이번에 `nodeName` 을 `nodeLabel` 로 고친 것은 기존에
    정정된 spec 을 뒤늦게 따라잡은 것이며 새로운 충돌이 아니다.

- **[없음 — 확인 후 기각] 노드별 에러 코드 표(`run-results.mdx` 신규 카테고리 표)와
  `spec/5-system/3-error-handling.md §1.4` 카탈로그 대조**
  - HTTP/DB/Email/LLM/Code/Sub-workflow 카테고리와 코드 목록(`HTTP_TRANSPORT_FAILED` ·
    `HTTP_4XX` · `HTTP_5XX` · `HTTP_BLOCKED` · `DB_QUERY_FAILED` 등)이 spec 표(§1.4)와
    문자열 단위로 정확히 일치한다. `NODE_EXECUTION_FAILED`/`INTEGRATION_ERROR`/`LLM_ERROR`
    삭제도 spec 의 "구 에러 코드... 더 이상 사용하지 않는다" 서술과 합치한다.

- **[없음 — 확인 후 기각] MakeShop 에러 코드(`integrations.mdx`)와
  `spec/4-nodes/4-integration/5-makeshop.md §6` 대조**
  - `MAKESHOP_404`·`MAKESHOP_422`·`MAKESHOP_4XX`·`MAKESHOP_5XX`·`MAKESHOP_AUTH_FAILED`·
    `MAKESHOP_RATE_LIMITED`·`MAKESHOP_TRANSPORT_FAILED`·`MAKESHOP_UNKNOWN_OPERATION`·
    `MAKESHOP_MISSING_FIELDS`·`MAKESHOP_INVALID_SHOP_UID` 열거와 "호출 전/후" 두 갈래 구분
    서술이 spec §6 표·§4 step 설명과 정확히 합치. `MAKESHOP_UNRESOLVED_PATH_PARAM`
    관련 CRITICAL 은 위 "검토 범위" 절에서 언급한 대로 이미 해소됨(`INTEGRATION_CALL_FAILED`
    로 정정).

## 요약

이번 diff 는 `spec/5-system/` 을 포함해 `spec/**` 을 전혀 수정하지 않았고(델타 0), 실질은
백엔드 DTO·서비스의 "선언 vs 실제 발행" 불일치 정정과 그에 맞춘 유저 가이드(코드베이스 내
MDX) 개정이다. 직전 라운드(`11_33_51`)가 발견한 유일한 CRITICAL(가이드가 새로 인용한
`MAKESHOP_UNRESOLVED_PATH_PARAM` 이 실제 방출 코드가 아니었던 건)은 이후 커밋
(`42680d5f9`)에서 실제 방출 코드(`INTEGRATION_CALL_FAILED`)로 정정되어 해소되었고, HEAD 는
그 정정 이후 상태 그대로다. 이번 라운드에서 데이터 모델·API 계약·요구사항 ID·상태 전이·
RBAC·계층 책임 여섯 관점으로 재확인한 결과 새로운 CRITICAL/WARNING 은 발견되지 않았다.
유일한 잔여 항목은 도메인별 에러 코드 카탈로그(`5-makeshop.md §6`·`4-cafe24.md §6`)가
`*_UNRESOLVED_PATH_PARAM` 계열을 여전히 누락하고 있다는 것인데, 이는 developer 권한 밖의
`spec/**` 수정이 필요해 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`
에 명시적으로 등재되어 다음 planner 턴을 기다리는 상태이므로 BLOCK 사유가 아닌 INFO 로
분류한다.

## 위험도
LOW
