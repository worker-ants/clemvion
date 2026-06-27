# 보안(Security) 리뷰

**리뷰 대상 범위**: mc-endpoint-hardening — model-config 부속 엔드포인트 hardening (listModels type 검증)
**주요 코드 파일**: `codebase/backend/src/modules/llm/llm-model-config.controller.ts`, `codebase/backend/test/workspace-rbac.e2e-spec.ts`, `spec/5-system/3-error-handling.md`
**리뷰 기준일**: 2026-06-27

---

## 발견사항

### [INFO] `listModels` Viewer+ 공개 — 실시간 provider 호출 남용 가능성

- 위치: `llm-model-config.controller.ts` `GET :id/models` 핸들러 (라인 452)
- 상세: `@Roles` 미적용이 의도적(spec §3·R-7)이므로 워크스페이스 멤버 전원이 호출 가능하다. 이 엔드포인트는 실시간 provider API 호출을 유발한다. `PROVIDER_PROBE_THROTTLE`(분당 10회)이 적용돼 있으나, throttle key 범위(per-user vs per-IP)가 컨트롤러 코드에서 드러나지 않는다. per-IP 기반이면 NAT 뒤 다수 사용자 공유 환경에서 정상 사용자 차단이 발생할 수 있고, 반대로 사용자 식별 없이 IP 기반이면 Viewer 다수가 협력해 provider 비용을 유발할 여지가 있다.
- 제안: 애플리케이션 레벨 throttle guard 설정에서 `generateKey`가 사용자 ID 기반인지 확인하고, 만약 아니라면 인증된 사용자 ID를 키로 포함하도록 설정 검토. 이 항목은 본 PR 범위의 설계 결정(Viewer+ 유지)과 충돌하지 않으며, throttle guard 구성 레벨의 확인 사항이다.

---

### [INFO] `previewModels` 엔드포인트에서 사용자 제공 API 키 처리 — 로그 마스킹 의존

- 위치: `llm-model-config.controller.ts` `POST preview-models` 핸들러 (라인 407), `PreviewModelListDto` body
- 상세: `preview-models` 엔드포인트는 클라이언트가 제출하는 `apiKey` 를 저장 없이 즉시 provider에 전달하는 설계다(CHANGELOG 명시). 그러나 NestJS request body 로깅 미들웨어나 디버그 로그가 활성화돼 있을 경우 `PreviewModelListDto`의 `apiKey` 필드가 로그에 노출될 수 있다. 에러 처리 spec §6.3은 "API Key, Bearer Token, 비밀번호" 자동 마스킹을 선언하나, 이것이 구현에서 `apiKey` JSON 필드명까지 커버하는지 컨트롤러 diff 에서는 확인되지 않는다.
- 제안: `PreviewModelListDto`의 `apiKey` 필드에 `@Exclude()` 또는 커스텀 sanitizer가 적용돼 있는지 DTO 파일을 확인한다. 없다면 마스킹 필터에 `apiKey` 패턴을 명시적으로 추가하거나 DTO 변환 시 필드를 redact하는 방어 코드를 검토한다. 본 PR의 코드 변경 자체는 이 경로를 수정하지 않으므로 pre-existing 사항으로 분류한다.

---

### [INFO] SSRF 가드 서비스 레이어 의존 — 컨트롤러에서 비가시

- 위치: `llm-model-config.controller.ts` `POST :id/test`, `POST preview-models` 핸들러; 에러 처리 spec §1.3 `MODEL_CONFIG_INVALID` 설명
- 상세: `testConnection`과 `previewModels`는 provider base URL을 포함한 자격증명을 사용해 실제 외부 서버에 연결을 시도한다. self-hosted provider(`local`, `tei`)의 base URL이 사용자 입력이고, SSRF 방어는 `llm.service.ts`·`llm-preview.service.ts` 서비스 레이어에 존재한다고 spec이 명시(R-4, error-handling §1.3)한다. 컨트롤러 레벨에는 URL 사전 검증이 없다. 서비스 레이어의 SSRF 가드가 올바르게 동작하면 문제 없지만, 이 PR의 diff 범위 밖이라 실제 구현을 검증할 수 없다.
- 제안: `llm.service.ts`와 `llm-preview.service.ts`에서 base URL에 대한 SSRF 가드(`MODEL_CONFIG_INVALID` 발행 경로)가 `tei`/`local` 외 사설망 IP 및 loopback을 차단하는지 별도 검토한다. 서비스 레이어 구현은 본 PR 범위 밖이므로 INFO로 등록한다.

---

## 보안 개선 사항 (이번 변경이 해결한 것)

다음은 본 PR 변경으로 **개선된** 보안 항목이다.

1. **입력 검증 강화 (POSITIVE)**: `type` 쿼리 파라미터에 `ParseEnumPipe(MODEL_TYPE_ENUM, { optional: true })`를 적용해 허용값(`chat`·`embedding`) 외 값은 서비스 레이어 도달 전 400으로 거부한다. 이전에는 임의 문자열이 서비스로 전달됐으며, 서비스가 이를 DB 쿼리 필터나 분기 조건으로 사용할 경우 잠재적 예측 불가 동작의 여지가 있었다.

2. **rate-limit 상수 단일화 (POSITIVE)**: `PROVIDER_PROBE_THROTTLE` 상수 도입으로 3개 핸들러 간 throttle 설정 불일치 가능성이 제거됐다. 이전에는 개별 객체 리터럴 `{ default: { limit: 10, ttl: 60_000 } }`을 각 핸들러에 복사해 한 곳만 변경 시 비대칭이 생기는 위험이 있었다.

3. **UUID 경로 파라미터 검증 (POSITIVE, 기존 유지)**: `:id` 파라미터는 `ParseUUIDPipe`로 UUID 형식을 강제해 경로 파라미터를 통한 인젝션을 차단한다.

4. **RBAC 정합 (POSITIVE, 이전 PR 완료)**: `testConnection`·`previewModels`는 `@Roles('editor')`로 게이트돼 과금 provider 호출에 대한 Viewer 직접 접근을 차단한다. `listModels`는 Viewer+를 의도적으로 유지(spec R-7).

---

## 요약

이번 변경은 보안 관점에서 **경감 방향**이다. 핵심 변경인 `ParseEnumPipe` 적용은 `type` 쿼리 파라미터의 허용값을 열거형으로 제한해 임의 문자열이 서비스 레이어로 유입되는 경로를 차단한다. `PROVIDER_PROBE_THROTTLE` 상수화는 3개 공개 provider 호출 엔드포인트의 rate limit 일관성을 보장한다. 인젝션, 하드코딩 시크릿, 인증 우회, 알려진 취약 라이브러리 사용 등 OWASP Top 10 핵심 범주에서 Critical·Warning 등급 취약점은 발견되지 않았다. 발견된 3건은 모두 INFO 수준으로, (1) throttle key 범위에 대한 설정 수준 확인 사항, (2) 사용자 제공 API 키 로그 마스킹 범위의 pre-existing 관찰, (3) SSRF 가드의 서비스 레이어 의존으로 컨트롤러에서 비가시적인 부분이다. 세 항목 모두 이번 PR이 신규 도입한 위험이 아니며 실행 가능한 완화책이 이미 서비스 레이어·설정 레이어에 명시돼 있다.

---

## 위험도

LOW

---

STATUS: SUCCESS
