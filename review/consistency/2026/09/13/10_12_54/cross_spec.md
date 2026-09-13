# Cross-Spec 일관성 검토 — `guide-error-code-truth` (--impl-done, scope=spec/5-system/)

## 전제

이 브랜치는 `spec/5-system/**` 파일을 한 건도 바꾸지 않았다(스코프 델타 0 — 정상, 코드·유저 가이드
전용 PR). 따라서 본 검토는 "target 문서 vs 다른 spec 영역"이 아니라 **이 diff 가 만든 실제
코드/가이드 상태가 `spec/5-system/**`(특히 `3-error-handling.md`·`7-llm-client.md`)의 기존 서술과
충돌하는지"** 를 확인했다. 코드·가이드는 워킹트리를 절대경로로 직접 읽었고, 임의 문서는 상대경로가
아니라 `Read`/`grep` 로 실제 파일을 열어 대조했다.

## 발견사항

- **[WARNING] 유저 가이드가 `LLM_RATE_LIMIT` 를 "노드 수준"과 "엔진 수준" 두 표에 동시에 올린다 — SoT 의 계층 구분과 모순**
  - target 위치: 이 diff 가 새로 쓴 `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx`(및 `.en.mdx`) `## 에러 메시지 해석` 절
  - 충돌 대상: `spec/5-system/3-error-handling.md §1.4` (엔진 수준 표 vs 노드 수준 런타임 에러 표)
  - 상세: 이번 diff 가 이 절에 **새로 도입한 구조**는 "노드가 실패했을 때의 코드는 노드 종류를
    따라간다"(노드-종류별 표, `AI · LLM` 행에 `LLM_CALL_FAILED` · `LLM_RATE_LIMIT` ·
    `LLM_RESPONSE_INVALID` · `LLM_TIMEOUT`)와 "실행 전체(엔진) 수준에서 붙는 코드는 **따로**
    있어요"(이어지는 `<FieldTable>`) 라는 **두 층을 명시적으로 분리 선언**하는 것이다. 그런데
    바로 그 "엔진 수준" `<FieldTable>` 에도 `LLM_RATE_LIMIT` 가 그대로 남아 있다(수정 전
    "Typical error codes" 플랫 리스트에서 이관된 잔존 행 — `NODE_EXECUTION_FAILED`·
    `INTEGRATION_ERROR` 행만 지우고 `LLM_RATE_LIMIT` 행은 그대로 둠). 결과적으로 가이드
    자신이 방금 세운 "노드 종류별 vs 엔진 수준은 별개" 라는 주장을 같은 화면에서 **자기
    반증**한다. 그리고 SoT 인 `3-error-handling.md §1.4` 는 `LLM_RATE_LIMIT` 를 명확히
    **노드 수준 런타임 에러**(`output.error.code`, LLM 카테고리, line 137)로만 분류하고,
    엔진 수준 표(`EXECUTION_TIMEOUT`·`EXECUTION_TIME_LIMIT_EXCEEDED`·`WORKER_HEARTBEAT_TIMEOUT`·
    `RECURSION_DEPTH_EXCEEDED`·`MAX_ITERATIONS_EXCEEDED`·`CYCLE_DETECTED`·`INVALID_EXPRESSION`·
    `VARIABLE_NOT_FOUND`·`TYPE_MISMATCH`·`ERROR_PORT_FALLBACK`, line 117-128)에는 `LLM_RATE_LIMIT`
    가 **등재돼 있지 않다**. 즉 가이드의 "엔진 수준" 표가 SoT 에 없는 코드를 엔진 수준으로
    잘못 분류해 실었다. 이번 배치가 고친 결함(가이드가 존재하지 않는/은퇴한/오귀속된 에러
    코드를 적는다)과 **같은 클래스**의 잔존 사례다 — `guide-error-code-existence` 가드는
    "코드가 backend 소스에 실재하는가"만 보므로(`LLM_RATE_LIMIT` 는 실재한다) 이 층-분류
    오류는 잡지 못한다.
  - 제안: `run-results{,.en}.mdx` 의 "엔진 수준" `<FieldTable>`에서 `LLM_RATE_LIMIT` 행을
    제거한다(이미 위 노드-종류별 표의 `AI · LLM` 행에 있으므로 중복 삭제). spec 쪽 변경은
    불필요 — `3-error-handling.md §1.4` 는 이미 정확하다.

- **[INFO] `guide-error-code-existence` 가드가 `spec/conventions/user-guide-evidence.md §2`(가드 3건) 관계표에 아직 미등재 — 이미 tracker 에 planner 항목으로 등재됨**
  - target 위치: 신규 `codebase/frontend/src/lib/docs/__tests__/{guide-error-code-existence.test.ts,guide-error-code-scan.ts}` 및 그 헤더 주석("SoT: spec/conventions/user-guide-evidence.md (가드 가족)"), `CHANGELOG.md` Unreleased 항목("`user-guide-evidence.md` 의 가드 가족")
  - 충돌 대상: `spec/conventions/user-guide-evidence.md §2 Build-time 가드 (3건)` — 이 헤더와
    관계표(§2.1)는 여전히 3건만 서술하고 신규 가드가 없다
  - 상세: 코드·CHANGELOG 는 이미 이 신규 가드를 그 컨벤션의 "가드 가족" 일원으로 서술하는데,
    `spec/**` 는 developer 쓰기 범위 밖이라 실제 spec 문서는 아직 갱신되지 않았다. 스코프
    델타가 0인 이유이기도 하다.
  - 상세(비판정 사유): 이 갭은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    에 `- [ ] "user-guide-evidence.md §2.1 관계표에 새 가드가 빠져 있다" (planner, 2026-09-13
    등재)` 로 정확히 등재돼 있고, `--impl-prep`(`review/consistency/2026/09/13/01_15_40`
    naming_collision WARNING#4·#5)에서 이미 지적된 사안이 처분까지 이어진 것이다. 새로운
    발견이 아니라 확인 차원의 기록.
  - 제안: 별도 조치 불요 — 위 planner 항목이 처리되면 자동 해소.

- **[INFO] `2-navigation/4-integration.md §9.1` 이 서술하는 `{success, code, message}` 중 `code` 가 `TestConnectionResultDto` 에 선언돼 있지 않다 (pre-existing, 이번 diff 범위 밖)**
  - target 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` `TestConnectionResultDto`(이번 diff 는 `latencyMs` 제거 주석만 추가, `code` 필드는 diff 전후 동일하게 미선언)
  - 충돌 대상: `spec/2-navigation/4-integration.md` §9.1 표 비고 및 Rationale("결과 body 형식이
    이미 `{ success, code, message }` 의 success/false 패턴") — `IntegrationsService.testConnection`
    실측(`integrations.service.ts` 다수 지점)도 실제로 `code` 를 싣는다.
  - 상세: `ModelTestConnectionResultDto`(이번 배치가 고친 것)의 결함이 "선언에는 있는데 안
    나가는 필드"(`latencyMs`, 과잉 선언)였다면, 이 형제 DTO 는 정반대 방향 —"실제로 나가는데
    선언에 없는 필드"(`code`, 과소 선언)다. 이번 PR 은 이 DTO 를 건드리지 않았고(주석 추가만),
    plan 의 §E 항목 3(`testConnection` shape 미문서 planner 등재)도 LLM 쪽만 겨냥해 이 gap 을
    명시적으로 다루지 않는다.
  - 제안: 급하지 않음 — 다음 spec/DTO 정합 라운드에서 `TestConnectionResultDto` 에 `code?: string`
    를 추가하거나(선호), §9.1 서술을 실제 선언에 맞춰 정정. 이번 배치가 새로 만든 문제는 아니므로
    이 PR 을 막을 사유는 아니다.

## 검증 완료 — 충돌 없음으로 확인한 항목

- `LlmService.testConnection` 반환 필드 `error`→`message` 변경, `ModelTestConnectionResultDto`/
  `TestConnectionResultDto` 의 `latencyMs` 제거: `spec/5-system/7-llm-client.md §8.3`(성공
  케이스만 서술)과 모순되지 않는다(그 표는 실패 shape 을 애초에 다루지 않음 — 별도 WARNING
  으로 이미 tracker 등재, 위 참고).
  `models{,.en}.mdx` 의 8갈래 문장표는 `codebase/backend/src/modules/llm/utils/
  sanitize-error.util.ts` 의 실제 분기·순서와 정확히 일치.
- `run-results{,.en}.mdx`/`error-handling{,.en}.mdx` 의 `NODE_EXECUTION_FAILED`→`LLM_TIMEOUT`
  치환과 노드-종류별 코드표(HTTP/DB/Email/AI·LLM/Code/Sub-workflow)는 `3-error-handling.md
  §1.4`·§3.1 카탈로그·§2.2 예시(`"code": "LLM_TIMEOUT"`)와 정확히 일치. §1.4 는 `NODE_EXECUTION_FAILED`/
  `INTEGRATION_ERROR`/`LLM_ERROR` 를 "더 이상 사용하지 않는다"고 이미 명시하므로 이번 삭제는
  SoT 를 뒤늦게 따라간 것.
  단 `LLM_RATE_LIMIT` 중복 배치는 위 WARNING 참고.
- `integrations{,.en}.mdx` 의 `MAKESHOP_API_ERROR`→`MAKESHOP_404` + 코드 계열 설명은
  `spec/4-nodes/4-integration/5-makeshop.md §6`(`MAKESHOP_404`/`422`/`4XX`/`5XX`/`AUTH_FAILED`/
  `RATE_LIMITED`/`TRANSPORT_FAILED` 등)과 정확히 일치.
- RBAC·상태 전이·요구사항 ID·계층 책임 축에서는 이번 diff 범위(LLM testConnection 필드명 정정
  + 유저 가이드 3파일 정정 + 신규 build-time 가드)와 충돌하는 서술을 찾지 못했다.

## 요약

이번 diff 는 `spec/5-system/**` 를 건드리지 않았고, 실측 결과 코드·가이드 변경 대부분이
`3-error-handling.md`·`7-llm-client.md`·`5-makeshop.md` 의 기존 SoT 서술과 정확히 합치한다.
다만 이번 편집이 `run-results.mdx`(ko/en)에 새로 도입한 "노드 종류 vs 엔진 수준" 2단 구조에서
`LLM_RATE_LIMIT` 를 양쪽 표에 중복 배치해, 가이드 자신의 새 주장과도 어긋나고 `3-error-handling.md
§1.4` 의 노드/엔진 계층 구분과도 어긋나는 잔존 결함이 하나 남아 있다(WARNING). 나머지 두 발견은
이미 plan tracker 에 planner 항목으로 등재됐거나(가드 관계표 미등재) 이번 diff 범위 밖의
pre-existing gap(integrations DTO `code` 미선언)이라 정보성으로만 기록한다. 이 배치를 막을
CRITICAL 은 없다.

## 위험도

LOW
