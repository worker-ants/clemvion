# 요구사항(Requirement) 리뷰 — guide-error-code-truth (라운드 3)

## 검토 방법

이 changeset(82개 파일)은 이미 2회의 `/ai-review` + `--impl-done` 라운드(`10_12_19`,
`10_40_34`)를 거쳤고 그 산출물 자체가 이번 diff 안에 재커밋되어 있다. 두 라운드가 이미
지적·처분한 항목(JSDoc 배치, `collectBackendTokens` 파라미터명, 8갈래 문장 parity 가드,
형제 `TestConnectionResultDto.code` 미선언 등)은 저장소 원본을 직접 `Read`로 재확인해
실제로 반영됐음을 확인했고 — 재지적하지 않는다. 이 라운드는 **아직 어느 checker 도 짚지
않은 새 결함**을 찾는 데 집중했다(`review/code/2026/09/13/{10_12_19,10_40_34}/*.md` 전수
grep으로 중복 여부 확인).

핵심 소스를 직접 열어 대조했다: `llm.service.ts`(`testConnection`), 두 DTO
(`ModelTestConnectionResultDto`/`TestConnectionResultDto`), `response-contract.ts`
(`assertMatchesContract` 판정 로직), `llm-model-config.controller.spec.ts`(전체, 프롬프트
절단분), `guide-error-code-{scan,existence}.test.ts`(전체), `plan/in-progress/
guide-error-code-truth.md`(전체), 그리고 관련 spec 3건(`spec/2-navigation/4-integration.md
§9.1`·`spec/2-navigation/6-config.md §3`·`spec/5-system/7-llm-client.md §6`·`spec/5-system/
3-error-handling.md §1.4`).

## 발견사항

- **[WARNING]** 신규 노드-종류별 에러 코드 표(`run-results{,.en}.mdx`)가 spec §1.4 카탈로그
  대비 5개 코드를 누락한다 — 그중 둘은 표에 이미 실린 `HTTP_BLOCKED`와 spec 이 명시적으로
  "대칭"이라 부르는 형제 코드다
  - 위치: `codebase/frontend/src/content/docs/05-run-and-debug/run-results.en.mdx:174-180`
    (신규 표, `| Node kind | Codes |`), 동일 구조가 `run-results.mdx:186-192`(한국어판)
  - 상세: `spec/5-system/3-error-handling.md §1.4`(130~139행)의 카테고리별 실재 코드
    카탈로그와 새 표를 줄 단위로 대조했다.
    - **Database**: spec 은 `DB_QUERY_FAILED · DB_CONNECTION_ERROR · DB_CONSTRAINT_VIOLATION
      · DB_PERMISSION_DENIED · DB_HOST_BLOCKED` 다섯을 나열하는데 새 표는 넷만 싣고
      `DB_HOST_BLOCKED`(SSRF 차단 — host 가 사설/loopback, 기본 ON)를 뺐다. 이 코드는 실제로
      발행된다 — `codebase/backend/src/nodes/integration/database-query/
      database-query.handler.ts:268`에서 `IntegrationError('DB_HOST_BLOCKED', …)`로 던지고
      `database-query.handler.spec.ts`가 `describe('SSRF host guard (DB_HOST_BLOCKED)')`로
      전용 테스트까지 갖고 있다.
    - **Email**: spec 은 `EMAIL_SEND_FAILED · EMAIL_HOST_BLOCKED` 둘인데 새 표는
      `EMAIL_SEND_FAILED` 하나만 싣는다. `EMAIL_HOST_BLOCKED`도 실제 발행 코드다
      (`send-email.handler.spec.ts:344`가 `expect(out.output.error?.code).toBe
      ('EMAIL_HOST_BLOCKED')`로 확인).
    - **AI · LLM**: spec 은 `LLM_CALL_FAILED · LLM_RATE_LIMIT · LLM_RESPONSE_INVALID ·
      LLM_TIMEOUT · MAX_COLLECTION_RETRIES_EXCEEDED` 다섯인데 새 표는 넷만 싣는다.
      `MAX_COLLECTION_RETRIES_EXCEEDED`는 `information-extractor.handler.ts:1307`에서
      실제로 발행된다.
    - **Sub-workflow**: spec 은 다섯 (`SUB_WORKFLOW_FAILED · SUB_WORKFLOW_NOT_FOUND ·
      SUB_WORKFLOW_TIMEOUT · SUB_WORKFLOW_QUEUE_FAILED · WORKFLOW_FORBIDDEN_WORKSPACE`)인데
      새 표는 셋만 싣는다. 나머지 둘도 `workflow.handler.ts:272,296`에서 실제로 반환된다.
    - **HTTP**: 유일하게 완전하다 — spec 의 `HTTP_TRANSPORT_FAILED · HTTP_4XX · HTTP_5XX ·
      HTTP_BLOCKED`를 전부 실었고, `HTTP_TIMEOUT`은 spec 자신이 "미발행"이라 명시하므로
      빠진 것이 옳다.
    - 이 표를 **정확히 5범주**로 도입한 취지 자체가 *"'노드가 실패했다'를 대표하는 단일 코드는
      없다 — 노드 종류별로 갈린다"*(plan §B)는 진실을 전달하는 것인데, 그 표가 각 종류
      **안에서** 다시 불완전해 같은 문제(사용자가 실제로 마주칠 코드를 어디서도 못 찾음)를
      한 단계 좁은 스코프에서 재현한다. `DB_HOST_BLOCKED`·`EMAIL_HOST_BLOCKED`는 SSRF 방어라
      사용자가 사설 IP 를 대상으로 실수로 설정했을 때 실제로 마주칠 코드인데, 이 저장소
      전체에서 사용자 문서 어디에도 등장하지 않는다(`grep -rln "DB_HOST_BLOCKED\|
      EMAIL_HOST_BLOCKED" codebase/frontend/src/content/docs/` → 0건).
    - 신규 가드(`guide-error-code-existence.test.ts`)는 이 방향을 **원리적으로 못 잡는다** —
      가이드가 적은 코드가 backend 에 실재하는지만 보는 **일방향(존재) 검사**이고, 실재하는데
      가이드에 없는 코드(**완전성** 방향)는 설계상 대상이 아니다(스캐너 자신의 JSDoc,
      `guide-error-code-scan.ts:9-14`도 이 축이 자매 가드의 스코프임을 명시하지 않는다).
      자매 가드 `guide-sanitized-message-parity.test.ts`는 정확히 이 "누락 방향"까지 양방향
      대조하도록 설계돼 있는데(`"SoT 의 8갈래가 모두 표에 실려 있다 (누락 방향)"`), 이 표에는
      그런 짝이 없다.
  - 제안: `run-results{,.en}.mdx` 표에 다섯 코드를 추가해 spec §1.4 와 완전히 미러링한다.
    이 파일들은 `codebase/frontend/**`이라 developer 쓰기 권한 안이므로 즉시 고칠 수 있다
    (spec 변경이 아니다). 재발 방지를 원하면 `guide-sanitized-message-parity.test.ts`와 같은
    "SoT → 표 누락 방향" 대조를 이 표에도 추가하는 것을 고려— SoT 는 `error-codes.ts`의
    카테고리별 상수 또는 spec §1.4 표 자체.

- **[WARNING]** `integrations{,.en}.mdx`의 새 MakeShop 에러 코드 설명 문장이 실재하는
  코드 11종 중 7종만 나열한다 — 단 이 넷이 "호출 실패 방식"이 아니라 "사전 검증 실패"라
  의도적 스코프 좁힘일 수도 있어 WARNING으로 낮춘다
  - 위치: `codebase/frontend/src/content/docs/02-nodes/integrations.en.mdx:290` (신규 문장
    "The error port's `code` splits by how the call failed — `MAKESHOP_404` · `MAKESHOP_422`
    · `MAKESHOP_4XX` · `MAKESHOP_5XX` · `MAKESHOP_AUTH_FAILED` · `MAKESHOP_RATE_LIMITED` ·
    `MAKESHOP_TRANSPORT_FAILED`"), 한국어판은 `integrations.mdx:301`
  - 상세: `codebase/backend/src/nodes/integration/makeshop/makeshop.handler.ts`를 grep 한
    결과 위 7종 외에 `MAKESHOP_UNKNOWN_OPERATION`(152행)·`MAKESHOP_MISSING_FIELDS`
    (190·202행)·`MAKESHOP_INVALID_SHOP_UID`(222행)·`MAKESHOP_UNRESOLVED_PATH_PARAM`(436행)
    넷이 더 있고, 전부 `IntegrationError`로 던져져 같은 error 포트 `{error:{code,message}}`
    shape 으로 나간다 — `plan/in-progress/spec-draft-nullable-notation-followups.md`도 이
    11종을 실측으로 이미 세어 놓았다("실재 목록은 … 전수로 11종"). 다만 이 넷은 "API 호출이
    어떻게 실패했나"가 아니라 "노드 설정이 애초에 유효한가"(연산 미존재·필수 필드 누락·
    shop_uid 형식)를 검사하는 pre-flight 가드라, 문장의 주어("the call failed")가 의도적으로
    그 넷을 배제한 것일 수도 있다 — 판단이 모호해 CRITICAL 로 올리지 않는다.
  - 제안: 의도적 배제라면 그 경계("호출 실패 코드"와 "설정 검증 실패 코드"는 별도)를 문장에
    한 줄 명시하고, 아니라면 표를 11종으로 넓힌다. 어느 쪽이든 사람의 판단이 필요한 항목이다.

- **[INFO]** (확인) `spec/2-navigation/6-config.md §3`이 `POST /api/model-configs/:id/test`의
  실패 응답 shape(`{success:false, message}`)을 문서화하지 않는 spec 갭은 **이미 올바르게
  planner 백로그로 위임돼 있다** — 재지적 아님, 처리 경로 검증 목적의 기록
  - 위치: `spec/2-navigation/6-config.md:281`("응답 `data`: chat `{ success }`, embedding
    `{ success, dimension? }`" — 실패 shape 언급 없음) vs
    `plan/in-progress/spec-draft-nullable-notation-followups.md`의
    `"testConnection` 실패 응답 shape 이 어느 spec 표에도 없다"` 항목(2026-09-13 등재,
    `--impl-prep 01_15_40` 5개 checker 전원 지적)
  - 상세: `developer`는 `spec/` 쓰기 권한이 없어(자기-반증형 소정정 조건에도 해당 안 함 —
    이 문장은 developer 자신이 쓴 예고가 아니라 원래부터 있던 spec 서술) 이 갭을 직접 고칠
    수 없고, 등재 문구가 실측(§9.1 은 형제 엔드포인트에서 이미 문서화하는데 §3 은 성공
    케이스만 적혀 있다는 비대칭)을 정확히 근거로 들고 있다.
  - 제안: 없음 — 절차가 맞다. 병합 후 planner 턴에서 §3 갱신 여부만 추적.

- **[INFO]** (확인) `assertMatchesContract`/`sanitizeLlmErrorMessage`/`ModelTestConnectionResultDto`
  등 핵심 코드·주석의 spec 인용 4건을 원문 대조 — 전부 정확
  - 위치·상세: (1) `llm.service.ts:312-314`의 "형제 `/api/integrations/:id/test`가 이미
    `{success, code, message}`" 인용 → `spec/2-navigation/4-integration.md:798` 원문과 일치.
    (2) CHANGELOG 의 "`LLM_AUTH_ERROR`·`LLM_MODEL_NOT_FOUND`는 `7-llm-client.md §6`의
    Planned" → `spec/5-system/7-llm-client.md:345`("미구현(Planned) — 세분화 에러 코드:
    `LLM_AUTH_ERROR`(401), `LLM_MODEL_NOT_FOUND`(404) …") 및 §6 헤더(331행 "6. 에러 처리")와
    정확히 일치. (3) "`NODE_EXECUTION_FAILED`·`INTEGRATION_ERROR`는 은퇴" →
    `spec/5-system/3-error-handling.md:143` 원문과 일치. (4) `TestConnectionResultDto.code`
    주석의 "spec §9.1 이 이미 문서화" → 위 (1)과 동일 라인.
  - 제안: 없음 — 확인 완료.

## 긍정적으로 확인한 사항 (참고)

- `llm-model-config.controller.spec.ts`의 HTTP 왕복 계약 테스트(215~261행)가 실제
  `TransformInterceptor`+진짜 `LlmService`를 태워 응답 wire 를 검증하고, 주석에 적은
  "세 단언이 실제로 가르는 것" 표(뮤턴트별 RED/GREEN)가 `response-contract.ts`의 실제 판정
  로직(제거된 required 아닌 optional 필드는 통과)과 정확히 일치함을 직접 코드 대조로 확인했다.
  근거 없이 지어낸 주장이 아니다.
- `sanitize-error.util.ts`의 8개 `return` 리터럴이 `models{,.en}.mdx`의 8행 표와 정확히
  1:1 로 일치함을 직접 대조했다(신규 `guide-sanitized-message-parity.test.ts`의 주장과 일치).
- `guide-error-code-scan.ts`/`guide-error-code-existence.test.ts`는 스스로 "부재(missing)
  방향은 검출하지 않는다"는 설계 한계를 문서화해 두었다 — 위 첫 WARNING 이 정확히 그 한계가
  현실화된 사례다. 가드 설계 자체는 정직하고 일관적이다.

## 요약

두 차례 리뷰 라운드를 거친 성숙한 PR이며, `error`→`message` 3층 필드 불일치 수정과
`assertMatchesContract` 배선, DTO 유령 필드 정리, 은퇴/지어낸 에러 코드명 정정은 모두 spec
원문과 line-level 로 대조해 정확함을 확인했다. 다만 이번 라운드에서 새로 발견한 것은, 이 PR
이 새로 도입한 **노드-종류별 에러 코드 표**(`run-results{,.en}.mdx`) 자체가 spec §1.4 카탈로그
대비 불완전하다는 점이다 — 이미 표에 실은 `HTTP_BLOCKED`의 명시적 대칭 형제인
`DB_HOST_BLOCKED`·`EMAIL_HOST_BLOCKED`(둘 다 SSRF 방어, 실제 발행)를 포함해 5개 실재 코드가
빠졌다. 이는 "'노드가 실패했다'를 대표하는 단일 코드는 없다"는 이 PR의 핵심 주장을 전달하는
바로 그 표에서, 한 단계 좁은 스코프로 같은 유형의 불완전성이 재현된 것이며, 신규 가드는
설계상(존재 검사만, 완전성 검사 아님) 이 결함을 잡지 못한다. MakeShop 코드 설명 문장의 4종
누락(pre-flight 검증 코드)은 의도적 스코프 좁힘일 가능성이 있어 판단을 사람에게 넘긴다.
그 외 spec 인용·DTO 계약·역할 경계(§3 spec 갭의 planner 위임)는 전수 대조로 문제없음을
확인했다.

## 위험도

MEDIUM
