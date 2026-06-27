# 보안(Security) 리뷰

## 발견사항

### [WARNING] `local` provider 로 SSRF 가드 우회 가능 (기존 설계 결정, 이번 변경에서 확인)
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/llm/llm-preview.service.ts` L1036-1053
- 상세: `previewModels` 의 SSRF 검증(`isPrivateHost` + `resolvesToPrivate`)은 `params.provider !== 'local'` 조건 아래서만 실행된다. 따라서 Editor+ 권한 보유자(또는 탈취된 계정)가 `provider: 'local'`으로 요청을 보내면 `baseUrl` 에 임의 사설 IP(`10.x`, `169.254.169.254` 등)를 지정해 내부 서비스를 탐색할 수 있다. 테스트에서도 "allows a private IP for the local provider (intentional exception)"으로 명시되어 있어 **설계 상의 의도적 트레이드오프**이나, insider threat 또는 계정 탈취 시나리오에서 내부망 스캐닝 수단이 된다.
- 제안: 단기적으로 `local` provider 에 허용할 IP 범위를 화이트리스트(loopback/LAN 서브넷)로 제한하거나, `local` 허용을 워크스페이스 관리자(admin+) 이상으로 격상하는 방안 검토. 근본 해결책은 egress 방화벽으로 애플리케이션 레이어 밖에서 내부망 도달을 차단하는 것이며, spec §5.5 주석에서도 동일하게 지적됨.

### [INFO] 스로틀 적용 단위가 IP 기반이라 분산 호출 방어 미흡
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/common/constants/throttle.ts` (새 파일)
- 상세: `SENSITIVE_ACTION_THROTTLE`(분당 10회)은 `@nestjs/throttler` 기본 키 생성(IP 기반)을 따른다. 동일 워크스페이스 소속 여러 IP 에서 병렬 호출하거나 IP 로테이션 공격 시 provider API 과금 억제 효과가 줄어든다.
- 제안: 워크스페이스 ID 또는 인증 사용자 ID를 포함하는 커스텀 ThrottlerGuard 키를 도입해 per-workspace/per-user 단위로 제한하는 것이 더 강한 방어. (긴급 수준 아님 — 기존 구조와 동일한 한계)

### [INFO] DNS rebinding 2차 방어 미적용 (기존 설계 한계, 이번 변경에서 확인)
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/llm/llm-preview.service.ts` L1044-1052
- 상세: 1차 DNS 조회 시점에 사설 IP 여부를 확인하나, 공격자가 낮은 TTL 을 이용해 최초 조회는 공개 IP 로 응답하고 실제 연결 시점에 사설 IP 로 변경하는 DNS rebinding 2차 공격은 차단되지 않는다. 코드 주석에 "egress 방화벽 필요"로 이미 기록됨.
- 제안: 이미 spec §5.5 에 기록된 잔존 갭. 인프라 레이어 egress 방화벽으로 해결해야 하며 본 PR 범위 외.

### [INFO] 테스트 파일의 평문 API 키 픽스처
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/llm/llm-preview.service.spec.ts` L578 (`apiKey: 'sk-plain-key'`)
- 상세: 테스트 픽스처에 `sk-plain-key`, `azure-key` 등 플레이스홀더가 포함되어 있으나 mock 환경에서만 사용되며 실제 provider 를 호출하지 않는다. 실제 API 키가 아니라 보안 문제 없음. 확인 차원에서 기록.
- 제안: 문제 없음. 현행 유지.

## 요약

이번 변경은 기존 인라인 상수를 공유 `SENSITIVE_ACTION_THROTTLE` 로 추출하고, provider 모델 목록 응답에 대한 방어적 상한(`capModelList`, MAX=500)을 두 경로(`LlmService.listModels`, `LlmPreviewService.previewModels`)에 일관 적용하는 보안 강화 리팩터다. ParseEnumPipe 로 `type` 파라미터 인젝션을 차단하고, 에러 메시지는 `sanitizeLlmErrorMessage` 로 정제하는 기존 패턴도 유지된다. 하드코딩된 시크릿은 없으며 인증/인가(`@Roles`, `@Throttle`, `ParseUUIDPipe`) 데코레이터 적용도 적절하다. 신규 취약점은 도입되지 않았으며, 주목할 만한 기존 설계 트레이드오프는 `local` provider 의 SSRF 가드 면제(의도적)와 DNS rebinding 2차 방어 미적용(인프라 레이어 위임)이다.

## 위험도

LOW
