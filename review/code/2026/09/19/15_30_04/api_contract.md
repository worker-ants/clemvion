# API 계약(API Contract) 리뷰

이 라운드(`15_30_04`)는 앞선 세 라운드(`13_58_22` → `14_29_33` → `15_02_57`)의 지적을 처분한 뒤의 상태를 본다.
`review/code/2026/09/19/15_02_57/api_contract.md` 가 남긴 유일한 WARNING(`:id/test` throttle 비대칭)과
이전 라운드들의 INFO(rotate 400/422, preview-test 오라클, `dns.lookup` 스레드풀 잔여)는 커밋
`6bf7c026d`(리뷰 3라운드 처분)에서 "W1 · W9 는 트래커" 로 명시적으로
`plan/in-progress/spec-draft-nullable-notation-followups.md`(4799~4818행)에 등재됐음을 실측으로 확인했다 —
코드로 고치지 않고 planner 결정 대기로 넘긴 것이 의도적이며 문서화돼 있다.

> **관측 사실(뮤테이션 아님, 관찰만)**: 이 리뷰를 진행하는 동안 워킹트리가 다른 세션에 의해 변경됐다. 조사 시점에는
> `integrations.service.ts`/`integrations.service.spec.ts` 의 `rotate()` 재조회 전환이 **미커밋** 상태였는데, 리포트
> 작성 직전 재확인한 `git status`에서는 그 두 파일의 변경이 사라지고(다른 세션이 커밋한 것으로 보임) 대신
> `spec/2-navigation/4-integration.md`가 새로 수정 중(unstaged)이었으며 브랜치가 origin/main 대비 8개 커밋 앞서
> 있었다(리뷰 시작 시점 gitStatus 는 5개 커밋만 보고했다). 본 리뷰어는 저장소에 어떤 파일도 쓰거나 고치지 않았다 —
> 아래 발견사항은 orchestrator 가 제공한 `_prompts/api_contract.md` 스냅숏(및 그 스냅숏과 합치하는 시점에 직접 읽은
> 소스)을 근거로 하며, 이후 `rotate()` 변경이 미커밋에서 커밋 상태로 바뀐 것은 결론에 영향이 없다(같은 내용을 그대로
> 커밋한 것으로 보인다 — 아래 첫 항목 참고). `spec/2-navigation/4-integration.md` 의 새 변경은 이 프롬프트 번들에
> 포함되지 않아 검토 범위 밖이다.

## 발견사항

- **[INFO]** `rotate()` 가 부분 `save()` 뒤 응답을 메모리 엔티티 대신 **재조회한 행**으로 만들도록 바뀌었다 — 계약상
  더 정확해졌다(회귀 아님)
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `rotate()` (조사 시점엔 미커밋 diff,
    `git diff HEAD -- src/modules/integrations/integrations.service.ts` 로 확인. 게이트 없는 구간이라 함수명으로 기재)
  - 상세: 직전 커밋(`6bf7c026d`)은 `updatedAt` 을 코드에서 명시해 저장하는 방식으로 W5(회전 뒤 응답의 `updatedAt` 이
    회전 전 시각으로 남는 문제)를 고쳤는데, 그 위에 다시 `integrationRepository.findOne()` 재조회로 바꿨다. 재조회는 DB 가
    실제로 정한 `updated_at`·동시에 `logUsage` 가 쓴 `lastUsedAt` 을 그대로 반영하므로 응답이 저장된 행과 항상 일치한다 —
    e2e `E`(응답 `updatedAt` === DB `updated_at`)와 unit 테스트(`findOne` 이 두 번째 호출에서 재조회 행을 반환하도록
    mock)가 이 경로를 검증한다. 행이 삭제된 극단적 동시성 케이스에서만 메모리 엔티티로 폴백한다 — 이 폴백 자체는 이번 PR 이
    새로 만든 취약점이 아니라 기존 `??` 패턴을 유지한 것이다.
  - 제안: 없음(참고 기록). 응답-DB 정합성이 개선된 방향.

- **[INFO]** `POST /api/integrations/:id/test` 가 `preview-test` 와 동급의 실제 outbound 프로브가 됐는데도 route
  레벨 throttle 이 없는 상태가 그대로 남아 있다 — **새 이슈 아님, 트래커 등재 확인**
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` — `testConnection()` 핸들러
    (`@Post(':id/test')`). 게이트 없음 — `grep -n "@Post(':id/test')" integrations.controller.ts` 로 직접 확인(현재도
    `@Throttle` 미부착, 전역 기본값만 적용).
  - 상세: 이전 라운드(`15_02_57`)가 WARNING 으로 지적한 상태가 코드로는 고쳐지지 않았다. 다만
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 4799~4807행에 "preview-test 가 인증된 사용자의
    외부 연결 오라클" 항목과 묶여 `/ai-review review/code/2026/09/19/15_02_57 api_contract WARNING 9` 를 명시
    인용하며 planner 결정 대기로 등재돼 있음을 확인했다(커밋 `6bf7c026d` 메시지도 "W1·W9(preview-test 오라클·`:id/test`
    throttle)는 트래커" 라고 못박는다). 프로젝트 관례(유예 근거는 실측 필요)에 맞춰 실측 확인했으므로 재지적하지 않고
    참고만 남긴다.
  - 제안: 없음(트래커에서 처리 예정). 코드 변경이 이뤄지면 이 라운드가 재확인할 대상.

- **[INFO]** `rotate()` 의 `INTEGRATION_TEST_FAILED` 실패가 `400`(`BadRequestException`)인데 `spec/2-navigation/4-integration.md
  §9.4` 는 `422`, `spec/5-system/11-mcp-client.md` 는 `400` 으로 서로 어긋난 채 남아 있다 — **새 이슈 아님, 트래커
  등재 확인**
  - 위치: `integrations.service.ts` `rotate()` 내 `throw new BadRequestException({ code: 'INTEGRATION_TEST_FAILED', ... })`.
    게이트 없음(diff 밖 기존 코드) — `grep -n "INTEGRATION_TEST_FAILED" integrations.service.ts` 로 확인.
  - 상세: `plan/in-progress/spec-draft-nullable-notation-followups.md` 4760~4767행에 두 spec 문서가 서로도
    어긋난다는 사실과 함께 "rotate 는 연결 테스트의 세부 `code`(`DB_AUTH_FAILED` 등)를 버리고 늘
    `INTEGRATION_TEST_FAILED` 만 준다" 는 세분성 격차까지 같은 결정에 묶어 planner 대기로 등재돼 있다. 신규 e2e
    (`integration-connection-test.e2e-spec.ts` D)도 "**상태 코드는 단언하지 않는다**" 고 주석과 assertion(`toBeGreaterThanOrEqual(400)`,
    `toBeLessThan(500)`)으로 명시해, 이 미확정 상태를 회귀 테스트로 굳히지 않도록 스스로 방어하고 있다 — 계약 관점에서
    바람직한 처리다.
  - 제안: 없음(트래커에서 처리 예정).

- **[INFO]** Database·HTTP 서비스가 "구조 검증만 통과하면 항상 성공" 이던 `preview-test`/`:id/test`/`rotate` 세
  엔드포인트의 동작을 의도적으로 breaking 하게 바꾼다 — 문서화는 충분하다
  - 위치: `CHANGELOG.md`(Unreleased 항목), `codebase/backend/src/modules/integrations/integrations.controller.ts`
    (`preview-test`·`:id/test`·`:id/rotate` 세 핸들러의 `@ApiOperation.description`),
    `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management*.mdx`.
  - 상세: 스키마 자체는 `PreviewTestResultDto.code?: string`(옵셔널, additive) 추가뿐이라 breaking change 가
    아니지만, **동작**은 breaking 이다 — 이미 저장된 틀린 자격증명의 Database·HTTP 통합은 `Test connection` 이 이제
    실패하고, `Rotate credentials` 도 새 값이 연결 테스트를 통과해야 저장된다. CHANGELOG 의 "배포 뒤 보일 수 있는 것"
    절과 spec Rationale, 사용자 가이드(en/ko 두 언어) 세 곳이 이 변화를 일관되게 서술하고 있어 하위 호환성 영향에
    대한 커뮤니케이션은 충분하다고 판단한다.
  - 제안: 없음 — 배포 커뮤니케이션(운영자 공지)만 확인.

- **[INFO]** 응답 스키마·계약 검증 배선은 견고함을 재확인했다
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
    (`PreviewTestResultDto.code?`, `TestConnectionResultDto.code` 코멘트 갱신),
    `codebase/backend/src/modules/integrations/integrations.service.spec.ts:1958,1986,714`
    (`assertMatchesContract(…, PreviewTestResultDto)` / `TestConnectionResultDto`).
  - 상세: `PreviewTestResultDto` 는 `TestConnectionResultDto` 와 형제 필드임을 JSDoc 으로 명시했고, 두 DTO 모두
    `assertMatchesContract` 로 실제 반환 값과 선언이 일치하는지 unit 레벨에서 검증한다(선언 누락 회귀는 뮤턴트로
    RED 가 난다는 것이 `integration-db-http-testers.md` 실측표에 기록돼 있다). Database·HTTP credentials 는
    `dispatchTest` 1단계(`validateCredentials`)가 항상 먼저 구조를 강제하므로 테스터 내부의
    `credentials as unknown as DbCredentials` 캐스팅이 검증되지 않은 입력을 받을 여지는 없다.
  - 제안: 없음.

## 요약

이 라운드가 검토한 diff 는 앞선 세 라운드의 API 계약 관련 지적(응답 `updatedAt` 정합성, 노드-테스터 URL 조립 방식
불일치, entity tester 의 동시성 상한 누락)을 실제로 해소했고, 남은 두 항목(`:id/test` throttle 비대칭, rotate
400/422 spec 불일치)은 코드로 고치는 대신 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에
명시적으로 planner 결정 대기로 등재돼 있음을 실측 확인했다 — 재지적할 새로운 코드 결함이 아니다. 응답 스키마 변경은
`code?: string` 필드 추가뿐인 additive 변경이며 `assertMatchesContract` 로 계약 검증까지 배선돼 있다. Database·
HTTP 통합의 연결 테스트가 "형식 검사만" 에서 "실제 접속" 으로 바뀌는 것은 동작상 breaking change 이지만 CHANGELOG·
spec Rationale·사용자 가이드(ko/en) 세 곳에 일관되게 문서화돼 있어 하위 호환성 커뮤니케이션은 충분하다. 이 라운드에서
새로 발견한 API 계약 결함(CRITICAL/WARNING)은 없다.

## 위험도
LOW
