### 발견사항

- **[INFO]** `buildIntegrationDetailRedirectUrl` — `integrationId` 를 URL 경로 세그먼트에 직접 삽입
  - 위치: `buildIntegrationDetailRedirectUrl(integrationId: string)` (diff +138~145)
  - 상세: `integrationId` 가 DB에서 조회된 UUID로 오는 경우 정상이나, 파라미터 타입이 `string` 으로만 선언되어 있어 호출자가 임의 문자열을 넘기면 경로 탐색 형태의 URL이 생성될 수 있다(`../../admin` 등). 실제 호출부(`target.id`)는 TypeORM이 반환한 UUID이므로 실질 위험은 낮지만, 함수 자체에는 입력 검증이 없다.
  - 제안: `integrationId` 가 UUID 형식인지 검사하거나(`/^[0-9a-f-]{36}$/i`), URL 생성 전 `encodeURIComponent(integrationId)` 를 적용해 경로 탐색을 방지할 것.

- **[INFO]** `assertInstallNonceNotReplayed` — `installNonceCache` 미설정 시 graceful no-op
  - 위치: diff +119
  - 상세: Redis가 미설정된 환경에서는 nonce replay 검사가 완전히 생략된다. 타임스탬프 ±5분 윈도우만 남으므로 5분 이내 동일 요청 재전송이 허용된다. 이는 기존 동작 그대로이므로 이번 리팩터링이 새로운 취약점을 도입하지는 않는다.
  - 제안: 운영 환경 Redis 필수 여부를 스펙/배포 가이드에 명시해 graceful fallback이 의도된 열화인지 명확히 할 것. `warn` 로그를 추가하면 모니터링에 도움됨.

- **[INFO]** `persistReauthorizeState` — `providerMeta`에 `client_secret` 포함
  - 위치: diff +155~179, caller 쪽 providerMeta 구성부
  - 상세: cafe24 private 앱과 makeshop은 `client_secret`을 `providerMeta`에 포함해 DB state row에 저장한다. 기존 동작 그대로이며 `providerMeta`는 `encryptedJsonTransformer`로 암호화되어 저장된다(`normalizeRawStateRow` -> `decryptJson`). 이번 리팩터링은 이 흐름을 보존하는 것이므로 새 취약점은 없다.
  - 제안: state row TTL(`STATE_TTL_MS = 10분`) 만료 후 purge가 정상 동작하는지 `purgeExpired()` 경로를 주기적으로 모니터링할 것.

- **[INFO]** `replayErrorCode` 파라미터 — 에러 코드 문자열이 caller-supplied
  - 위치: `assertInstallTimestampFresh(timestamp, replayErrorCode)` (diff +89~103)
  - 상세: 에러 코드가 외부 입력이 아닌 서비스 내부 호출부(`'CAFE24_INSTALL_REPLAY'`, `'MAKESHOP_INSTALL_REPLAY'`)에서 리터럴로 고정되므로 실질 위험은 없다. 다만 이 함수가 `public`으로 노출되거나 테스트 외부에서 임의 문자열이 주입될 수 있는 경로가 생기면 에러 응답 조작이 가능해진다.
  - 제안: `private` 접근자를 유지하고, 향후 에러코드가 외부 소스를 받는 방향으로 변경 시 화이트리스트 검증을 추가할 것.

### 요약

이번 변경은 `handleInstall(cafe24)` 와 `handleMakeshopInstall` 의 보안 보일러플레이트 4종을 private helper로 추출한 순수 behavior-preserving 리팩터링이다. 타임스탬프 윈도우 검사, nonce replay 가드, redirect URL 생성, reauthorize state 퍼시스턴스 모두 기존 로직을 그대로 이동했으며, 새로운 입력 경로나 권한 검증 우회가 도입되지 않았다. 발견된 사항은 모두 기존 설계에서 이미 존재하던 LOW 수준 관찰(URL 경로 세그먼트 인코딩 부재, Redis graceful fallback, `client_secret` DB 저장)으로 이번 리팩터링과 무관하다. 하드코딩된 시크릿, SQL/커맨드 인젝션, XSS, 인증 우회, 안전하지 않은 암호화 알고리즘, 에러 메시지를 통한 민감 정보 누출은 없다.

### 위험도

NONE
