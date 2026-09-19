# 문서화(Documentation) 리뷰 — 연결 테스트 결과 코드 상수화 · literal union · 테스트 빈칸 셋

## 발견사항

- **[INFO]** spec `4-integration.md` §5.3/§14.1 이 HTTP 연결 테스트의 `INTEGRATION_INCOMPLETE` · `INTEGRATION_AUTH_UNSUPPORTED` 반환 가능성을 여전히 누락 (이 diff 로 새로 생긴 문제 아님, 이미 추적 중)
  - 위치: `spec/2-navigation/4-integration.md` §5.3 "결과:" 목록, §14.1 "에러 코드 vocabulary" 표 (§5.3 헤딩 line 451, §14.1 헤딩 line 1092 — 실측 확인)
  - 상세: `codebase/backend/src/modules/integrations/connection-test-codes.ts` (파일 2) 의 `IntegrationTestResultCode` union 은 `HttpCredentialsResult` 의 실패 코드(`INTEGRATION_INCOMPLETE`/`INTEGRATION_AUTH_UNSUPPORTED`)를 정확히 포함한다 — 코드는 이미 맞다. 문제는 spec 쪽으로, §5.3 "결과:" 목록과 §14.1 vocabulary 표 어디에도 HTTP 연결 테스트가 이 두 코드를 낼 수 있다는 서술이 없다. 이 갭은 이번 developer 세션의 `--impl-prep`(`review/consistency/2026/09/19/23_02_33/cross_spec.md`, `SUMMARY.md`)에서 이미 WARNING 으로 잡혀 "별도 planner 턴" 으로 명시적으로 넘겨졌고, `plan/in-progress/connection-test-codes-and-gaps.md` 체크리스트에도 그대로 기록돼 있다. 즉 새로 발견한 게 아니라 이미 올바르게 추적되고 있는 기존 spec 갭이다 — 재조사·재차단 불필요, 다만 이 항목이 조용히 유실되지 않도록 이 리뷰에도 남겨 둔다.
  - 제안: 조치 불필요(이미 등재됨). 후속 planner 턴에서 `spec/2-navigation/4-integration.md` §5.3 끝에 "자격증명 필드 누락·미지원 `auth_type` 이면 `resolveHttpCredentials` 가 먼저 `INTEGRATION_INCOMPLETE`/`INTEGRATION_AUTH_UNSUPPORTED` 로 거부한다" 한 줄과 §14.1 표 갱신을 진행하면 된다.

- **[INFO]** `TestConnectionResultDto.code` (Swagger 응답 DTO) 의 JSDoc 예시 목록이 새 타입과 분리된 채로 남음
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:479-484` (`code?: string` 필드의 JSDoc, "MCP_* · EMAIL_* · DB_* · HTTP_* · INTEGRATION_INCOMPLETE 등")
  - 상세: 이 필드는 이번 diff 의 `IntegrationTestResult.code`(이제 `IntegrationTestResultCode` 로 정밀 타입화)와 같은 값을 그대로 노출하는 API 응답 DTO 인데, 이 diff 에서 손대지 않았다. 예시 목록에 `CAFE24_*`/`MAKESHOP_*` 계열이 빠져 있고, 새로 만든 authoritative union(`IntegrationTestResultCode`, `connection-test-codes.ts`)을 가리키는 링크도 없다 — Swagger 쪽 `string` 타입 자체는 의도적(고정 enum 을 강제하지 않으려는 선택으로 보임)이라 바꿀 필요는 없지만, JSDoc 이 이제 존재하는 정본 union 을 인용하지 않아 "이 필드가 가질 수 있는 정확한 값 목록은 어디서 보나" 라는 질문에 하나 더 찾아봐야 답이 나온다.
  - 제안: 선택 사항(이번 diff 스코프 밖). 여유가 있으면 `@ApiPropertyOptional()` 위 JSDoc 에 `{@link IntegrationTestResultCode}` 참조를 한 줄 추가.

## 확인한 항목 — 문제 없음 (근거 기록)

- `connection-test-codes.ts` 상단 JSDoc 이 인용하는 spec 섹션(§5.3/§5.4/§5.5/§14.1)은 실제 `spec/2-navigation/4-integration.md` 에 그 번호와 제목으로 존재함을 `grep`/`Read` 로 직접 대조 확인했다. "노드 런타임 `ErrorCode` 와 이름·뜻이 같은 셋(`HTTP_BLOCKED`/`DB_HOST_BLOCKED`/`EMAIL_HOST_BLOCKED`)" 주장도 `nodes/core/error-codes.ts` 에서 동일 문자열 상수로 확인했다 — 주석이 지어낸 근거가 아니다.
- `connection-test-codes.spec.ts` 의 두 번째 `it`(타입 수준 계약)에 붙은 "⚠️ 강제하는 것은 jest 가 아니라 tsc 다" 경고는 `scripts/check-backend-typecheck-ratchet.py` 존재를 확인했고, jest 가 타입을 지운다는 서술과 맞는 정확한 방어적 문서화다 — 다음 사람이 이 테스트를 "런타임에서도 검증됨" 으로 오독할 위험을 미리 차단한다.
- `database-connection-tester.ts`/`database-driver-sockets.spec.ts` 의 신규·수정 주석(`closeWithin` 상한 설명, mysql2 가 생성과 동시에 연결을 시작해 unit 에서 예외적으로 실제 소켓을 여는 이유, `try/finally` 로 바꾼 이유)은 "왜" 를 정확히 설명하며 실제 diff 동작과 일치한다.
- `cafe24-api.client.ts`/`makeshop-api.client.ts` 의 `Cafe24PingCode`/`MakeshopPingCode` JSDoc + `pingConnection` 기존 JSDoc 을 실제 함수 본문과 대조했다 — `CAFE24_INSUFFICIENT_SCOPE` 가 `mapPingError` 의 "알려진 종류" 목록에 없는 것은 오래된 주석이 아니라, 그 코드가 `mapPingError` 가 아니라 `pingConnection` 본문에서 직접 만들어지기 때문(주석 스코프가 정확함).
- `integrations.service.ts` 의 `IntegrationTestResult.code` 필드 JSDoc 이 `code?: string` 시절의 설명(`Failure code (e.g. MCP_* · ...)`)에서 `{@link IntegrationTestResultCode}` 참조로 정확히 갱신됐다 — 오래된 주석이 남지 않았다.
- 새 `plan/in-progress/connection-test-codes-and-gaps.md` 는 실측·할 것·비대상·체크리스트 4단 구성을 정확히 따르고, frontmatter `spec_impact: none` 은 이 diff 가 `spec/**` 를 건드리지 않는다는 사실과 일치한다.
- README·CHANGELOG 갱신은 불필요하다고 판단: 이번 변경은 사용자에게 보이는 동작·API 계약을 바꾸지 않는 내부 리팩터(원시 문자열 → 상수/리터럴 union) + 기존 동작을 고정하는 테스트 3건 추가이며, plan 문서 스스로 "동작은 바뀌지 않는다" 를 명시한다. 저장소 `CHANGELOG.md` 관례는 배포 후 사용자가 체감하는 변경(예: SSRF 가드 확장)에 "배포 뒤 보일 수 있는 것" 절을 붙이는 방식인데, 이번 변경엔 그런 절이 필요한 외부 관측 가능 변화가 없다.
- `review/consistency/2026/09/19/23_02_33/*` (파일 12~19) 는 이번 developer 세션이 실행한 `--impl-prep` consistency-check 산출물 그대로이며, SUMMARY.md 의 WARNING 2건·INFO 5건이 각 checker 전문과 정확히 일치한다 — 산출물 자체의 내적 정합성에 문제는 없다.

## 요약

핵심 코드 변경(파일 1~10)의 JSDoc·인라인 주석 품질은 이 저장소 평균보다 뚜렷이 높다 — spec 섹션 인용은 전부 실측 검증됐고, "타입 테스트가 런타임에는 no-op" 같은 함정을 미리 경고하는 등 다음 독자를 위한 방어적 설명이 충실하다. 오래된 주석·깨진 문서 참조는 발견되지 않았다. 유일하게 남는 문서 갭(spec §5.3/§14.1 이 HTTP 연결 테스트의 `INTEGRATION_INCOMPLETE`/`INTEGRATION_AUTH_UNSUPPORTED` 반환을 언급하지 않음)은 이번 diff 가 만든 것이 아니라 기존 spec 갭이며, 이미 이번 세션의 consistency-check 로 정확히 잡혀 별도 planner 턴으로 넘겨진 상태다 — 유실 방지 차원에서만 재기록했다. README·CHANGELOG 갱신 의무는 없다.

## 위험도

LOW
