# 변경 범위(Scope) 리뷰

## 검토 방법

`git diff 7e617acd6 HEAD`로 15개 파일 전수를 프롬프트 diff와 대조해 완전 일치를 확인했다(숨은 hunk 없음). 대상 plan
`plan/in-progress/integration-test-contract.md`(제목: "`POST /api/integrations/:id/test` 응답 계약 — MCP 전용 필드
3종 선언 · 성공 경로 계약 검증 · HTTP 와이어 검증")을 의도의 기준선으로 삼았다.

## 발견사항

- **[INFO] 컨트롤러 `@ApiOkWrappedResponse` 설명 문구 변경은 DTO 변경의 직접 파생물**
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` — `@Post(':id/test')` 핸들러의
    `@ApiOkWrappedResponse(TestConnectionResultDto, { description: ... })`
  - 상세: `'연결 테스트 결과 (성공 여부, 메타 정보)'` → `'연결 테스트 결과 (성공 여부, 실패 시 분류 코드, MCP 성공 시
    capability 미리보기)'`로 바뀌었다. `meta`는 이 PR과 무관한 과거 PR(`#1330`)이 이미 제거한 유령 필드였는데, 그 문구가
    지금까지 갱신되지 않고 남아 있던 것을 이번에 같은 데코레이터를 만지는 김에 정정했다. plan `## 방향` §1에 명시적으로
    예고된 항목이라 스코프 이탈은 아니지만, "메타 정보" 문구 자체의 낡음은 이번 PR이 만든 결함이 아니라는 점만 기록해 둔다.
  - 제안: 조치 불필요 — 계획대로 반영됨.

- **[INFO] 서비스 spec에 형제 DTO(`PreviewTestResultDto`) 쪽 대조 라인 1건 추가**
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts` — `previewTest` describe 블록의
    기존 MCP 성공 테스트 케이스 말미(`assertMatchesContract(result, await contractForDto(PreviewTestResultDto));` 추가)와,
    신설 테스트 `'[형제 대조] MCP 필드 셋의 선언이 PreviewTestResultDto 와 같다'`.
  - 상세: PR 제목은 `:id/test`(`TestConnectionResultDto`) 단일 엔드포인트를 가리키지만, 변경은 형제 엔드포인트
    `preview-test`(`PreviewTestResultDto`)의 테스트 파일도 건드린다. 다만 이는 plan `## 방향` §2에 "같은 생산자의 형제
    응답인데 선언이 있으면서 검증이 없는 비대칭"으로 명시 예고돼 있고, `## 뮤턴트` 표의 M3·M9가 캐너리 부재로 SURVIVED한
    것을 근거로 사후 추가된 것이 뮤테이션 실측으로 뒷받침된다. 두 DTO가 같은 `dispatchTest` 결과를 반환하는 실제 구조적
    형제 관계이므로, 한쪽만 고치는 것이 오히려 비일관을 낳는다. 계획된 확장이지 무단 기능 확장(over-engineering)은 아니다.
  - 제안: 조치 불필요.

- **[INFO] `plan/in-progress/spec-draft-nullable-notation-followups.md`에 신규 트래커 항목 추가**
  - 위치: 해당 파일, `INTEGRATION_TEST_FAILED` 상태 코드(422 vs 400) 관련 신규 체크박스 항목.
  - 상세: 이 PR의 코드 변경(`TestConnectionResultDto` 등)과는 무관한 `:id/rotate` 엔드포인트의 spec 오기를 다룬다. 언뜻
    무관한 파일 수정처럼 보이지만, `--impl-prep` 단계에서 발견된 Critical 아닌 WARNING을 developer가 직접 고치지 않고
    planner 턴으로 넘기며 트래커에 등재하는 것은 CLAUDE.md의 정한 절차(BLOCK:NO 여도 반영)와 SUMMARY.md의 권장 조치사항을
    그대로 따른 것이다. 코드 변경 없이 문서 등재만 했으므로 스코프 위반이 아니다.
  - 제안: 조치 불필요.

- **[INFO] `review/consistency/2026/09/26/20_32_24/**` 8개 신규 파일**
  - 위치: `review/consistency/2026/09/26/20_32_24/{SUMMARY.md,_retry_state.json,meta.json,cross_spec.md,rationale_continuity.md,convention_compliance.md,plan_coherence.md,naming_collision.md}`
  - 상세: `developer`가 구현 착수 직전 의무적으로 실행하는 `consistency-check --impl-prep`의 산출물이다(CLAUDE.md
    "`developer`는 구현 착수 직전 `consistency-check --impl-prep` 의무"). 코드 변경이 전혀 없는 순수 프로세스 아티팩트이며
    `review/consistency/**`는 리뷰 산출물 저장 규약상 커밋 대상이 맞다. 스코프 이탈 아님.
  - 제안: 조치 불필요.

CHANGELOG 항목, DTO 필드 3종 추가, 서비스축·와이어축 테스트, plan 문서 신설은 모두 plan `## 방향` 1~4에 1:1로 대응하며
불필요한 리팩토링·포맷팅 혼입·미사용 임포트·설정 변경은 발견되지 않았다. 새 와이어 spec 파일(`integrations.controller.wire.spec.ts`)의
provider mock 목록(`IntegrationUsageLog`·`Node`·`WorkspacesService`·`IntegrationOAuthService`·`AuditLogsService`·`IntegrationCacheBus`·`DataSource`)은
전부 생성자 주입을 채우기 위한 것으로 주석("아래는 이 경로가 닿지 않는 의존이다")이 근거를 밝히고 있어 무단 확장이 아니다.

## 요약

전체 diff(15개 파일, +822/-7)를 `git diff`로 직접 대조한 결과 모든 변경이 plan
`plan/in-progress/integration-test-contract.md`가 선언한 4개 방향(DTO 필드 선언·서비스 축 테스트·와이어 축 테스트·CHANGELOG)에
정확히 대응한다. 얼핏 스코프 밖으로 보일 수 있는 두 항목 — 형제 엔드포인트(`preview-test`) 테스트 보강과 무관한 spec
문서(`INTEGRATION_TEST_FAILED` 상태 코드)의 트래커 등재 — 은 각각 뮤테이션 실측(M3/M9 SURVIVED)과 `--impl-prep`
컨센서스 체크 절차라는 문서화된 근거를 갖고 있어 무단 확장이 아니라 계획된 최소 확장이다. Critical·Warning 급 스코프
이탈은 발견되지 않았다.

## 위험도

NONE
