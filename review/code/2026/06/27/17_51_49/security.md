### 발견사항

- **[INFO]** `apiKey: 'sk-plain-key'` — 테스트 픽스처 평문 키
  - 위치: `codebase/backend/src/modules/llm/llm-preview.service.spec.ts` (테스트 추가 구문)
  - 상세: 테스트 픽스처 값으로, 실제 자격증명이 아닌 명백한 더미 값. 보안 위협 없음.
  - 제안: 해당 없음 (테스트 환경 한정, 실제 키 아님).

- **[INFO]** `local` provider SSRF 검증 면제 (pre-existing)
  - 위치: `codebase/backend/src/modules/llm/llm-preview.service.ts` — `if (params.baseUrl && params.provider !== 'local')` 분기
  - 상세: `provider === 'local'` 경로는 `isPrivateHost`·`resolvesToPrivate` SSRF 검사를 우회한다. insider가 사설 IP baseUrl을 local provider로 지정할 수 있다. 이 PR이 도입한 변경이 아니며 spec §5.5에 의도적 설계로 기재되어 있다. 1차 리뷰(W-2)에서 수용(미수정) 처리되어 인프라 egress 방화벽으로 위임된 pre-existing 갭.
  - 제안: 인프라 egress 방화벽 적용 시까지 현 상태 유지 (별 트랙). `provider === 'local'` 경로에도 SSRF 검사를 적용하려면 spec 변경 필요.

- **[INFO]** DNS rebinding 2차 방어 부재 (pre-existing)
  - 위치: `codebase/backend/src/modules/llm/llm-preview.service.ts` — SSRF 검사 블록 주석 "2차 (connect 시점 TTL 재해석) 는 egress 방화벽 필요"
  - 상세: DNS 쿼리 후 실제 HTTP 연결 시점에서 TTL 만료로 IP가 재해석될 수 있는 DNS rebinding 2차 공격에 대한 방어가 없다. spec §5.5에 잔존 갭으로 명시, 인프라 egress 위임. 이 PR의 변경 범위 밖.
  - 제안: 범위 외. 인프라 수준 egress 방화벽으로 해소.

- **[INFO]** throttle per-IP 우회 가능성 (pre-existing)
  - 위치: `codebase/backend/src/common/constants/throttle.ts` (SENSITIVE_ACTION_THROTTLE 정책 적용 엔드포인트 전체)
  - 상세: `UserThrottlerGuard`가 인증 사용자에게는 `user:<sub>` 키를 사용하지만, 미인증 요청에서 IP 로테이션으로 throttle을 우회할 수 있다. 기존 구조 한계로 이 PR이 도입한 문제 아님.
  - 제안: 별 트랙. 미인증 경로에도 IP 기반 집계 강화 검토.

### 요약

이번 변경셋은 보안 관점에서 순기능만 포함한다. `capModelList`(MAX 500) 도입으로 악의적·잘못 설정된 provider의 대량 응답으로부터 메모리·페이로드를 방어하고, `SENSITIVE_ACTION_THROTTLE` 공통 상수 추출로 rate-limit 정책의 단일 출처를 강화했으며, Swagger `@ApiTooManyRequestsResponse` 추가로 429 응답이 명시됐다. `ParseUUIDPipe`·`ParseEnumPipe`·`@Roles('editor')` 등 기존 입력 검증·인가 구조는 그대로 유지된다. 에러 메시지는 `sanitizeLlmErrorMessage`를 통해 새니타이징되고 있다. 하드코딩된 실제 시크릿은 없으며, 테스트 픽스처 더미 키는 보안 위협이 아니다. 남은 우려(SSRF local 면제·DNS rebinding 2차·IP 로테이션)는 모두 pre-existing 갭으로 spec §5.5에 기재되어 인프라 egress 위임된 상태이며, 이 PR에서 신규 도입되지 않았다.

### 위험도

LOW
