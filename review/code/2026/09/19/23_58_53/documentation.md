# 문서화(Documentation) 리뷰 — 연결 테스트 결과 코드 상수화 · literal union · 테스트 빈칸 셋 (2라운드)

## 검증 방법 메모

이 diff 는 anchor(`ea27c21b3`) 대비 누적 diff로, 1라운드 리뷰(`review/code/2026/09/19/23_34_45`)에서 지적된 WARNING 2건(MakeShop
`pingConnection` 런타임 테스트 부재, 타입 계약 테스트의 `TestGateCode` 누락)이 이미 `287aa2b89` 로 조치된 상태를 포함한다. 문서화
관점에서는 1라운드 산출물(`documentation.md` 등)의 판단이 이번 라운드에도 유효한지 코드·spec 파일을 직접 열어 재확인했고, 라운드
사이에 추가된 커밋(`287aa2b89` 테스트 보강, `88ea114c4`/`683023dfa` plan·리뷰 문서)에 새로 도입된 문서화 이슈가 있는지 점검했다.

- `spec/2-navigation/4-integration.md` §5.3(451행 "결과:" 목록)·§14.1(1092행 "에러 코드 vocabulary" 표, 1100-1122행)을 직접 열어
  `INTEGRATION_INCOMPLETE`/`INTEGRATION_AUTH_UNSUPPORTED` 가 HTTP 연결 테스트 경로(`resolveHttpCredentials` 공유 실패)로도 반환될 수
  있다는 서술이 여전히 없음을 재확인했다(1라운드 INFO 그대로 유효).
- `codebase/backend/src/modules/integrations/integrations.service.ts:392`·`:965`·`:978` 을 대조해, `connection-test-codes.ts`
  의 `TestGateCode` 주석 "쓰는 곳이 한 함수뿐" 이 `IntegrationTestResult.code` 생산 지점(965행, `testConnection`) 기준으로는 정확함을
  확인했다 — 392행의 `IntegrationCredentialsUnreadableError`(NestJS 예외 payload `code`)는 별개 계약(HTTP 400 에러 바디)이라 같은
  문자열이 두 곳에 나타나도 주석의 "한 함수" 주장과 모순되지 않는다.
- `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts` 의 `mapPingError` JSDoc "알려진 종류" 목록(3종)에
  `CAFE24_INSUFFICIENT_SCOPE` 가 빠진 것을, 실제로 그 코드가 `mapPingError` 가 아니라 `pingConnection` 본문(417·444행)에서 직접
  생성됨을 grep 으로 재확인해 오래된 주석이 아님을 검증했다.
- `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:478-483` 의 `code?: string` JSDoc
  예시 목록(`MCP_* · EMAIL_* · DB_* · HTTP_* · INTEGRATION_INCOMPLETE 등`)이 이번 diff 로 신설된 `IntegrationTestResultCode` /
  `CAFE24_*` / `MAKESHOP_*` / `INTEGRATION_AUTH_UNSUPPORTED` 를 여전히 인용하지 않음을 재확인했다(1라운드 INFO 그대로 유효, diff 밖).
- `CHANGELOG.md` 관례(최근 항목들은 "배포 뒤 보일 수 있는 것" 절을 갖는 사용자 체감 변경)를 확인했고, 이번 변경은 plan 문서 스스로
  "동작은 바뀌지 않는다" 고 명시한 순수 내부 리팩터라 CHANGELOG 갱신 대상이 아니라는 1라운드 결론이 유효함을 재확인했다.

## 발견사항

- **[INFO]** spec `4-integration.md` §5.3/§14.1 이 HTTP 연결 테스트의 `INTEGRATION_INCOMPLETE`/`INTEGRATION_AUTH_UNSUPPORTED` 반환
  가능성을 여전히 누락 (이번 diff 가 만든 갭 아님, 이미 추적 중 — 재확인)
  - 위치: `spec/2-navigation/4-integration.md` §5.3 "결과:" 목록(HTTP/REST 헤딩 451행), §14.1 "에러 코드 vocabulary" 표(헤딩
    1092행, 표 1100-1122행)
  - 상세: `codebase/backend/src/modules/integrations/connection-test-codes.ts` 의 `IntegrationTestResultCode` union 은
    `HttpCredentialsResult` 실패 코드(`INTEGRATION_INCOMPLETE`/`INTEGRATION_AUTH_UNSUPPORTED`)를 정확히 포함하고, 코드 쪽은
    맞다. spec 쪽 §5.3 결과 목록·§14.1 표 어디에도 HTTP 연결 테스트가 이 두 코드를 낼 수 있다는 서술이 없다(§14.1 의
    `INTEGRATION_INCOMPLETE` 행은 노드 핸들러의 "credentials JSONB 필수 필드 누락" 의미로만 등재돼 있고, `INTEGRATION_AUTH_UNSUPPORTED`
    는 표에 아예 없음). 이 갭은 이번 developer 세션의 `--impl-prep`(`review/consistency/2026/09/19/23_02_33`)에서 이미 WARNING
    으로 잡혀 plan 체크리스트 (1)에 "spec 쓰기라 트래커 등재(planner)" 로 명시돼 있고, `plan/in-progress/connection-test-codes-and-gaps.md`
    의 체크리스트 마지막 두 항목(`--impl-done`, "트래커 두 항목 해소")이 아직 미완료(`[ ]`)라 이 라운드에서도 자연스럽게 아직
    미반영 상태다 — 새로 발견한 문제가 아니라 예정대로 지연 중인 항목.
  - 제안: 조치 불필요(이미 등재·추적 중). `--impl-done` 이후 별도 planner 턴에서 §5.3 결과 목록과 §14.1 표에 반영.

- **[INFO]** `TestConnectionResultDto.code`(Swagger 응답 DTO) JSDoc 예시 목록이 새 정본 union 을 여전히 인용하지 않음 (diff 밖, 1라운드 재확인)
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:478-483`
  - 상세: 이 필드는 이번 diff 의 `IntegrationTestResult.code`(이제 `IntegrationTestResultCode` 로 정밀 타입화)와 동일한 값을 그대로
    노출하는 응답 DTO인데 diff 대상이 아니다. JSDoc 예시("MCP_* · EMAIL_* · DB_* · HTTP_* · INTEGRATION_INCOMPLETE 등")에
    `CAFE24_*`/`MAKESHOP_*`/`INTEGRATION_AUTH_UNSUPPORTED` 가 빠져 있고, 새로 만든 정본 union(`IntegrationTestResultCode`)을
    가리키는 링크도 없다. DTO 자체 위 주석이 "이 필드가 이전엔 미선언 상태였다" 는 사실을 스스로 상세히 기록해 둔 만큼(478행
    주변 히스토리 코멘트), 정본이 새로 생긴 지금이 이 JSDoc 을 갱신하기 좋은 시점이라는 점만 참고로 남긴다.
  - 제안: 선택 사항(이번 diff 스코프 밖). 여유가 있으면 `@ApiPropertyOptional()` 위 JSDoc 에 `{@link IntegrationTestResultCode}`
    참조 한 줄 추가.

## 확인한 항목 — 문제 없음 (근거 기록, 1라운드 이후 변경분 포함)

- `287aa2b89` 로 추가된 `makeshop-api.client.spec.ts` 의 `describe('pingConnection (test-connection probe)')` 블록 JSDoc —
  "Cafe24 형제와 같이 세 실패 코드를 리터럴로 고정한다" 는 서술이 실제 4개 `it` (200/자격증명 누락/403/네트워크 실패)과 정확히
  일치하고, `connection-test-codes.spec.ts` 의 "기대값은 리터럴로" 관례와도 표현이 일치한다.
- `connection-test-codes.spec.ts` 의 `accepted` 배열이 6개 부분 union(`TestGateCode` 포함)을 전부 담도록 갱신됐고 주석("union 을
  이루는 여섯 무리에서 하나씩")이 실제 배열 길이(`toHaveLength(6)`)와 일치함을 확인했다 — 1라운드 WARNING #2 조치 후 주석·코드
  정합.
- `connection-test-codes.ts` 의 `TestGateCode` JSDoc "쓰는 곳이 한 함수뿐" 주장을 `integrations.service.ts:392,965,978` 세 곳과
  대조 — `IntegrationTestResult.code` 를 생산하는 지점은 965행(`testConnection`) 하나뿐이고, 392행은 별개 계약(예외 payload)이라
  모순 없음(위 "검증 방법 메모" 참고).
- `cafe24-api.client.ts` `mapPingError` JSDoc "알려진 종류" 3종 목록에 `CAFE24_INSUFFICIENT_SCOPE` 가 없는 것은 오래된 주석이
  아니라 그 코드가 `pingConnection` 본문(417·444행)에서 직접 생성되기 때문임을 grep 으로 재확인.
- `plan/in-progress/connection-test-codes-and-gaps.md` 체크리스트가 실제 git 상태(`--impl-done`·트래커 해소 미완료)와 정확히
  일치 — plan 서술이 실제보다 앞서가지 않는다.
- `review/code/2026/09/19/23_34_45/*`, `review/consistency/2026/09/19/23_02_33/*` (1라운드 산출물)는 그 시점 코드 상태를 반영한
  스냅샷 리포트다. 이후 커밋(`287aa2b89`)으로 코드 줄 번호가 일부 이동했지만(예: `connection-test-codes.spec.ts` 의
  `@ts-expect-error` 위치가 40/42/44 → 46/48/50 대로 shift), 이는 히스토리 문서의 정상적 특성이며 라이브 코드 주석이 아니므로
  갱신 의무가 있는 "오래된 주석"으로 취급하지 않았다.
- CHANGELOG.md 갱신 불요 판단 재확인 — 최근 항목들의 "배포 뒤 보일 수 있는 것" 관례와 대조했을 때, 이번 변경은 plan 이 스스로
  "동작은 바뀌지 않는다" 고 선언한 순수 타입 리팩터 + 테스트 보강이라 해당 관례의 대상이 아니다.

## 요약

1라운드에서 지적된 테스트 커버리지 WARNING 2건은 `287aa2b89` 로 조치됐고, 그 조치로 추가된 코드(MakeShop `pingConnection`
테스트 블록, `connection-test-codes.spec.ts` 의 `accepted` 배열 확장)의 JSDoc·주석은 기존 관례(리터럴 기대값, wire 계약 근거)와
정확히 일치해 새로 도입된 문서화 결함이 없다. 남은 두 항목(spec §5.3/§14.1 의 HTTP 게이트 코드 누락, DTO JSDoc 이 정본 union 을
인용하지 않음)은 이번 diff 가 만든 것이 아니라 이전부터 있던 갭이며, 전자는 이미 `--impl-prep` 단계에서 WARNING 으로 잡혀 별도
planner 턴으로 인계 대기 중임을 plan 체크리스트로 재확인했다. README·CHANGELOG 갱신 의무는 없다.

## 위험도

LOW
