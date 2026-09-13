# Cross-Spec 일관성 검토 — `guide-error-code-truth` (--impl-done, scope=`spec/5-system/`, 라운드 3)

## 전제

이 브랜치는 `spec/5-system/**` 를 한 건도 바꾸지 않았다(스코프 델타 0 — 코드·유저 가이드·harness
전용 PR 이라 정상). 프롬프트의 diff 절은 예산 초과로 절단되어 있어, 실제 변경분은 워킹트리를
절대경로로 직접 대조했다(`git diff origin/main..HEAD` — `codebase/` 21파일/816+61줄).

이 세션은 같은 plan(`guide-error-code-truth`)에 대한 **네 번째 cross-spec 검토**다 — 앞선 세
라운드(`review/consistency/2026/09/13/01_15_40`[--impl-prep] · `10_12_54`[--impl-done R1] ·
`10_41_13`[--impl-done R2])의 발견·처분 상태를 먼저 grep/Read 로 재확인하고, 그 이후 커밋
(`de99def86` "리뷰 라운드 2 — 형제 엔드포인트에도 계약 검사를 걸고, 내 JSDoc 자기모순을 고친다")
이 새 cross-spec 결함을 만들었는지만 추가로 봤다.

## 발견사항

- **[WARNING] `3-error-handling.md §1` 카탈로그가 Integration(Cafe24/Makeshop)·OAuth 코드 계열을
  여전히 누락 — 미해소 잔존, 이번 라운드가 만든 결함 아님**
  - target 위치: `spec/5-system/3-error-handling.md` §1.1~§1.12 (Integration 노드 도메인 전용
    절 부재)
  - 충돌 대상: `spec/conventions/error-codes.md`("본 규율은 `CAFE24_*`·`OAUTH_*` 등 인라인
    문자열 발행 코드를 포함한다"), `spec/4-nodes/4-integration/{4-cafe24,5-makeshop}.md §6`
    (`CAFE24_*`/`MAKESHOP_*` 실재 카탈로그), `spec/2-navigation/4-integration.md`(`OAUTH_*` 계열)
  - 상세: `01_15_40`·`10_41_13` 두 라운드가 이미 지목했다. `grep -n "CAFE24\|MAKESHOP\|OAUTH_"
    spec/5-system/3-error-handling.md` 는 이번에도 0건이다. `spec/**` 는 이 PR 의 developer 쓰기
    범위 밖이라 이 갭을 좁히지 못한 것 자체는 정상.
  - 상세(비판정 사유): `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner
    항목으로 정확히 등재돼 있고, 겹치는 제안을 내는 다른 두 plan(`spec-update-node-cancellation-
    shutdown-classification.md`·`keyset-cursor-uuid-validation.md`)까지 실측 병기해 한 planner
    턴에서 §1 하위 구조를 통합 결정하도록 지시해 두었다. **새 발견 아님 — 재확인**.
  - 제안: 별도 조치 불요. 위 planner 항목이 세 plan 을 한 턴에 처리하면 자동 해소.

- **[WARNING] `testConnection` 실패 응답 shape 이 `7-llm-client.md`·`6-config.md` 어느 표에도
  없음 — 미해소 잔존, 이번 라운드에서 구현이 한 단계 더 확정됐는데 spec 앵커는 그대로 없음**
  - target 위치: `spec/5-system/7-llm-client.md` §8.3 "LlmService.testConnection — kind별 probe
    전략" 표 (`{ success: true }` / `{ success: true, dimension? }` 성공 케이스만 기술)
  - 충돌 대상: `spec/2-navigation/6-config.md` §B.3(동일하게 성공 케이스만 기술 — "실패: 에러
    메시지 표시" 로 필드명 없이 산문 서술), `spec/2-navigation/4-integration.md` §9.1(형제
    엔드포인트는 `{success, code, message}` 실패 shape 을 명시 문서화)
  - 상세: `01_15_40`(최초 지목, 당시는 "확정 예정") → `10_41_13`(코드에 이미 배선 완료 확인) →
    이번 라운드(`de99def86`)에서 실패 shape 계약이 **HTTP 와이어 레벨 테스트**(`llm-model-config.
    controller.spec.ts` 신규 `describe('POST /model-configs/:id/test — 와이어 계약 (HTTP)')`)로
    한 단계 더 굳어졌다 — 응답 키 전수(`['message','success']`)까지 단언한다. 즉 계약은 코드·
    테스트 양쪽에서 완전히 확정됐는데, 그 확정된 계약을 적을 spec 자리는 이번 라운드에도 새로
    생기지 않았다. `spec/**` 쓰기는 developer 범위 밖이라 이 PR 로는 닫을 수 없는 항목.
  - 상세(비판정 사유): 같은 tracker 파일에 `- [ ] "testConnection 실패 응답 shape 이 어느 spec
    표에도 없다" (planner, 2026-09-13 등재 · "5개 checker 전원이 짚었다")` 로 이미 등재돼 있고,
    8갈래 문장 SoT 경로(`sanitize-error.util.ts`)까지 명시해 두었다. **새 발견 아님**.
  - 제안: 별도 조치 불요 — planner 항목 처리 시 두 표에 `{ success: false, message }` (코드
    없음, `{success,code,message}` 형제와 의도적으로 다른 이유도 함께) 를 추가하면 해소.

- **[INFO] `/api/integrations/:id/test` 배선이 실패 경로에만 걸려 있고, 성공 경로(MCP 전용
  `capabilities`/`serverInfo`/`preview`)는 여전히 미선언 — 의도적 부분 배선, 이번 라운드가
  스스로 등재**
  - target 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts` 신규
    `assertMatchesContract(result, await contractForDto(TestConnectionResultDto))` (실패
    케이스에만 부착)
  - 충돌 대상: `spec/2-navigation/4-integration.md` §9.1(`IntegrationDto`/`IntegrationTestResult`
    관련 서술에 MCP 전용 3필드는 언급 없음 — 코드 쪽 타입에만 존재)
  - 상세: 이번 라운드의 주석이 스스로 "성공 경로에는 아직 걸 수 없다 — MCP 성공 응답 3종이
    미선언"이라고 명시하고, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에도
    developer 항목("`/api/integrations/:id/test` 의 MCP 전용 응답 필드 3종이 미선언 + 계약
    검증자 미배선")으로 이미 등재돼 있다. spec 문서 자체에 이 3필드를 문서화하는 SoT 문장이
    없어 spec-코드 간 모순은 아니지만(spec 이 침묵), DTO 완결 시 `4-integration.md` 도 함께
    갱신 대상인지는 아직 결정되지 않았다.
  - 제안: 차단 사유 아님. DTO 신설(developer 항목) 완료 시 `spec/2-navigation/4-integration.md`
    에 MCP 성공 shape 등재 필요 여부를 같은 턴에서 판단.

## 검증 완료 — 이번 라운드(`de99def86`) 이후 재확인해도 충돌 없는 항목

- `TestConnectionResultDto.code?: string` 신설 + `IntegrationTestResult.code` 값 재확인:
  `spec/2-navigation/4-integration.md §9.1`(`200 + { success:false, code:'INTEGRATION_INCOMPLETE' }`
  기존 문서화)과 정확히 합치. DTO 가 낡았던 것이지 spec 이 낡았던 게 아니었다는 diff 주석의
  주장을 spec 원문으로 재확인.
- `TestConnectionResultDto.meta` 제거: `spec/2-navigation/4-integration.md` 전체에 이 엔드포인트
  응답의 `meta` 필드 서술 0건(다른 endpoint, `/api/integrations/services` 의 `meta.
  publicAppAvailable` 과는 별개 namespace) — 제거가 spec 과 충돌하지 않음.
- `run-results{,.en}.mdx`/`error-handling{,.en}.mdx` 의 `NODE_EXECUTION_FAILED`/`nodeName` →
  `LLM_TIMEOUT`/`nodeLabel` 치환: `spec/5-system/3-error-handling.md §1.4`(구 코드 3종 "더 이상
  사용하지 않는다" 명시) · §2.2 예시(`nodeLabel`, 2026-08-17 정정 완료)와 정확히 일치.
- `integrations{,.en}.mdx` 의 `MAKESHOP_API_ERROR` → `MAKESHOP_404` + 코드 계열 설명:
  `spec/4-nodes/4-integration/5-makeshop.md §6` 카탈로그(`MAKESHOP_404`·`422`·`4XX`·`5XX`·
  `AUTH_FAILED`·`RATE_LIMITED`·`TRANSPORT_FAILED`)와 정확히 일치.
- `models{,.en}.mdx` 의 5행 코드표 → 8갈래 고정 문장표 치환: `spec/2-navigation/6-config.md §B.3`
  ("실패: 에러 메시지 표시" — 코드 미문서화)와 모순 없음(오히려 정합). `LLM_AUTH_ERROR`·
  `LLM_MODEL_NOT_FOUND` 는 `spec/5-system/7-llm-client.md:345` 에 명시적으로 **Planned**(현재는
  `LLM_CONNECTION_ERROR` 로 수렴)로 서술돼 있어, 구 가이드가 "이미 나온 기능"으로 서술한 것이
  spec 과 어긋났었다는 CHANGELOG 의 주장과 spec 원문이 일치.
- `user-guide-evidence.md §2.1` 관계표 미갱신(신규 가드 2건 미반영): `10_12_54`·`10_41_13` 이미
  확인, 이번 라운드도 `spec/**` 미변경이라 상태 무변. planner 항목 등재 확인.
- RBAC·상태 전이·요구사항 ID·데이터 모델 축: 이번 라운드 변경분(JSDoc 정정, 형제 엔드포인트
  계약 검사 배선, HTTP 와이어 테스트 신설)에서 이 네 축과 충돌하는 서술을 찾지 못했다. `Editor+`
  권한 게이트(`7-llm-client.md` "권한" 문단)는 이번 라운드에서 변경되지 않았다.

## 요약

이번 라운드(`de99def86`)가 만든 `codebase/**` 변경(형제 엔드포인트 `assertMatchesContract` 배선,
HTTP 와이어 레벨 계약 테스트, JSDoc 정정)은 기존 spec SoT(`3-error-handling.md`·`7-llm-client.md`·
`5-makeshop.md`·`2-navigation/4-integration.md`·`6-config.md`)와 충돌하지 않으며 새 cross-spec
결함도 만들지 않았다. 3라운드에 걸쳐 반복 확인된 두 WARNING(§1 카탈로그의 Integration/OAuth 코드
누락, `testConnection` 실패 shape 의 spec 앵커 부재)은 이번 PR 이 새로 만든 것이 아니라 `spec/**`
쓰기 권한 밖에서 생긴 pre-existing gap이며, 둘 다 `plan/in-progress/spec-draft-nullable-notation-
followups.md` 에 planner 항목으로 정확히 등재되어 있어 이 PR 을 막을 사유가 아니다. 새로 발견된
INFO 한 건(형제 엔드포인트의 성공 경로 계약 검사 미배선)도 이미 developer 항목으로 자체 등재돼
있다. Critical 은 0건이다.

## 위험도

LOW
