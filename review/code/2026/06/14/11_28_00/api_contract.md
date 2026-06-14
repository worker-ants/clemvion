# API 계약(API Contract) 리뷰

## 발견사항

### [INFO] update 응답에서 마스킹 적용 — 기존 create/regenerate 와 일관성 확인 필요
- 위치: `auth-configs.service.ts` `update()` 메서드 반환값 (`return this.toMasked(saved)`)
- 상세: `update()` 는 `this.toMasked(saved)` 를 반환하지만, `create()` / `regenerate()` 는 평문을 그대로 반환한다. 이 차이는 설계 의도(생성·재발급은 1회 평문 노출 허용, 편집은 마스킹 유지)에 부합하며 스펙 §A.4 와 일치한다. API 계약 관점에서는 PATCH 응답이 마스킹된 형태로 오는 것이 클라이언트에 의도치 않은 놀라움이 될 수 있으나, 이 동작은 Swagger DTO 설명과 스펙 R-2 에 명시돼 있으므로 계약 위반은 아니다. 참고용으로만 기록.
- 제안: 필요 시 OpenAPI 응답 스키마에 `config` 필드의 마스킹 여부를 엔드포인트별로 명시하면 클라이언트 온보딩이 쉬워진다.

### [INFO] UpdateAuthConfigDto — `config` 필드 내부 키 유효성 검증 부재
- 위치: `update-auth-config.dto.ts` `config?: Record<string, unknown>`
- 상세: `config` 는 `@IsObject()` 만 있고 내부 키/값 형식의 DTO 수준 검증이 없다. 현재는 서비스 레이어(`SECRET_CONFIG_KEYS` 필터링)에서 방어하고 있어 동작상 안전하지만, 임의 키를 무제한 허용하는 열린 스키마다. `additionalProperties: true` 라고 Swagger 에도 명시돼 있어 계약상 의도된 형태이며, 백엔드 서비스가 알 수 없는 키를 그대로 저장한다는 점은 알려진 트레이드오프다.
- 제안: type 별 허용 키를 서비스 레이어에서 추가 화이트리스트 필터링하거나, 추후 type-discriminated union DTO 로 분리하면 스키마 준수 수준이 높아진다. 현 변경 범위에서는 허용 가능하다.

### [INFO] 프론트엔드 PATCH 페이로드에 `type` 미포함 — 하위 호환성 관점 양호
- 위치: `auth-config-form.ts` `buildAuthConfigUpdatePayload()`, `authentication-form.test.tsx` PATCH mock 검증
- 상세: 편집 PATCH 페이로드에는 `type` 이 포함되지 않아 `UpdateAuthConfigDto` 의 optional `type` 필드를 통한 type 변경이 API 레벨에서 허용되는 상태다. 프론트엔드에서는 type 변경을 차단(UI disabled)하지만, API 직접 호출 시 type 변경이 가능하다. 이 경우 기존 비밀값과 type 이 불일치하는 상태가 생길 수 있다(예: `api_key` type 에 `token` 키만 존재). 스펙 R-2 는 "type 변경도 편집 폼에서 차단"이라고 명시하지만 API 계약 레벨에서의 차단 여부는 명시하지 않는다.
- 제안: 보안·정합 측면에서 `update()` 서비스에서 `type` 변경 시도를 감지해 `BadRequestException` 을 반환하는 것을 권장한다. 현재는 INFO 수준이나 운영 상황에 따라 WARNING 으로 상향될 수 있다.

### [INFO] ipWhitelist 항목 형식 서버 검증 없음
- 위치: `update-auth-config.dto.ts`, `create-auth-config.dto.ts` (변경 범위 내 `UpdateAuthConfigDto`)
- 상세: `ipWhitelist: string[]` 은 `@IsString({ each: true })` 만 있고 IP/CIDR 형식 검증이 없다. 프론트엔드의 `isValidIpOrCidr()` 는 UX 가드이며, 백엔드는 저장 시점에 임의 문자열을 수락한다. 실행 시점(`verifyWebhookRequest`)에서 `parseIp()` 가 fail-closed 로 처리하므로 보안상 무해하지만, 유효하지 않은 CIDR 이 저장돼도 에러 없이 무시되는 침묵 실패 경로가 존재한다.
- 제안: `@Matches(/^(...)$/, { each: true })` 등으로 IP/CIDR 형식을 DTO 레벨에서 검증하면 저장 전 400 Bad Request 를 반환할 수 있다. 현재는 INFO 수준.

## 요약

이번 변경의 핵심 API 계약 변경은 PATCH `/auth-configs/:id` 의 `config` 필드 처리 방식을 wholesale-replace 에서 shallow-merge 로 전환한 것이다. DTO 문서(`update-auth-config.dto.ts`)의 Swagger 설명도 이에 맞춰 갱신됐고, 프론트엔드의 PATCH 페이로드도 비밀값을 포함하지 않도록 설계됐다(`buildAuthConfigUpdatePayload`). 기존 API 클라이언트 관점에서는 config 패치 동작이 달라지므로 technically breaking 이지만, 이전 동작(wholesale-replace)이 오히려 비밀값 파손을 유발하는 버그였기 때문에 이 변경은 정정(bugfix)으로 분류된다. 하위 호환성 파괴 위험은 낮다. 주요 미결 사항은 API 레벨에서 `type` 변경 차단이 없다는 점과 `ipWhitelist` 항목 형식의 서버 검증 부재이며, 두 사항 모두 현재 동작에 보안 취약점을 직접 생성하지는 않으므로 INFO 수준으로 분류한다.

## 위험도

LOW
