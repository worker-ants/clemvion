# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] private helper 4종 추가 — 클래스 인터페이스 변경 없음
- 위치: 라인 89–179 (신규 추가된 4개 private 메서드)
- 상세: `assertInstallTimestampFresh`, `assertInstallNonceNotReplayed`, `buildIntegrationDetailRedirectUrl`, `persistReauthorizeState` 모두 `private` 접근 제어자로 선언되어 외부 public API 에 노출되지 않는다. 클래스 생성자 시그니처, 기존 public 메서드(`handleInstall`, `handleMakeshopInstall`, `begin`, `handleCallback` 등)의 시그니처는 일절 변경되지 않았다.
- 제안: 해당 없음. 의도적 설계로 문제 없음.

### [INFO] `persistReauthorizeState` — DB 쓰기 부작용은 기존과 동일
- 위치: 라인 155–179, 및 `handleInstall`/`handleMakeshopInstall` 호출 지점
- 상세: 이전에는 각 메서드 내부에서 `this.stateRepository.create(...)` + `await this.stateRepository.save(...)` 를 직접 실행했다. 추출 후에도 동일한 두 ORM 호출을 동일한 순서로 실행하며, 저장 필드(`state`, `workspaceId`, `userId`, `provider`, `serviceType`, `mode='reauthorize'`, `integrationId`, `requestedScopes`, `integrationName`, `scope`, `providerMeta`, `expiresAt`)가 모두 유지된다. `mode` 필드는 helper 내부에서 `'reauthorize'`로 하드코딩하는데, 두 caller 모두 기존에 동일하게 `'reauthorize'`를 사용했으므로 semantic 변화 없다.
- 제안: 해당 없음. 동작 동일성 확인됨.

### [INFO] `assertInstallNonceNotReplayed` — null 체크 로직이 `if (!this.installNonceCache) return;` 방식으로 변경
- 위치: 라인 119, 기존 `if (this.installNonceCache) { ... }` 블록 대체
- 상세: 기존 코드는 `if (this.installNonceCache) { ... }` 블록으로 cache 존재 시에만 실행했고, 추출된 helper 는 `if (!this.installNonceCache) return;` 조기 반환 패턴으로 동등하게 처리한다. 두 구현 모두 cache 미설정 시 graceful no-op 동작을 보장하므로 부작용 없다.
- 제안: 해당 없음.

### [INFO] `buildIntegrationDetailRedirectUrl` — URL 구성 로직 추출 (환경 변수 읽기 패턴 유지)
- 위치: 라인 138–145
- 상세: `this.oauthEnv.frontendUrl || this.oauthEnv.appUrl || 'http://localhost:3000'` 접근 패턴은 기존 caller inline 코드와 완전히 동일하다. `oauthEnv` getter 가 `configService?.get<OAuthEnvConfig>('oauth') ?? emptyOAuthEnvConfig()` 를 통해 환경 변수를 읽으므로 환경 변수 읽기 부작용의 성격도 기존과 동일하다. 로그 출력(`this.logger.log(...)`) 은 helper 에 포함되지 않고 각 caller 에 잔류한다. 로그 메시지 내용은 변경되었으나(`trimmed/integrations/${target.id}` → `${redirectUrl}`) 결과값이 동일한 문자열이므로 실질적 차이 없다.
- 제안: 해당 없음.

### [INFO] `randomBytes(24).toString('hex')` 호출이 helper 내부로 이동
- 위치: 라인 162 (`persistReauthorizeState`)
- 상세: 기존에는 `handleInstall`/`handleMakeshopInstall` 각 메서드에서 `const state = randomBytes(24).toString('hex')` 를 직접 호출했다. 추출 후 동일 호출이 `persistReauthorizeState` 내부로 이동했으며, helper 가 `state` 문자열을 return 해 caller 에서 동일하게 OAuth authorize URL 빌드에 사용된다. 난수 생성 엔트로피 소스(`crypto.randomBytes`)와 출력 형식 변화 없음.
- 제안: 해당 없음.

### [INFO] `makeshop code_verifier` — `providerMeta` 경로로 전달 보존
- 위치: `handleMakeshopInstall`의 `persistReauthorizeState` 호출부 (providerMeta 내 `code_verifier: verifier`)
- 상세: PKCE `verifier`가 `providerMeta` 객체에 포함된 상태로 `persistReauthorizeState`에 전달되고, helper는 이를 그대로 `stateRecord.providerMeta`에 저장한다. callback 단계에서 `record.providerMeta`를 통해 `code_verifier`를 꺼내는 기존 경로와 완전히 동일하게 유지된다.
- 제안: 해당 없음.

## 요약

이번 변경은 `handleInstall`(cafe24)과 `handleMakeshopInstall`에 중복 존재하던 인스톨 보일러플레이트 4종을 동일 클래스의 `private` helper로 추출한 순수한 behavior-preserving 리팩토링이다. 새로운 전역 변수, 외부 서비스 호출, 파일시스템 접근, 이벤트/콜백 등록은 전혀 도입되지 않았다. 공개 API(public 메서드·생성자 시그니처·export 목록)는 변경되지 않았으며, DB 쓰기(`stateRepository.save`) 및 환경 변수 읽기(`oauthEnv`) 부작용은 기존과 동일한 경로·순서·의미로 유지된다. nonce 체크의 null 가드 방향 전환(`if cache` → `if !cache return`)과 `randomBytes` 호출 위치 이동 모두 관찰 가능한 행동 변화를 일으키지 않는다. 의도치 않은 부작용은 발견되지 않았다.

## 위험도

NONE
