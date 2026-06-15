# API 계약(API Contract) 리뷰 결과

## 발견사항

### [INFO] ipWhitelist 요청 검증 — DTO 계층에 @IsIpOrCidr 추가
- 위치: `codebase/backend/src/modules/auth-configs/dto/create-auth-config.dto.ts:270`, `update-auth-config.dto.ts:521`
- 상세: `CreateAuthConfigDto` 및 `UpdateAuthConfigDto` 의 `ipWhitelist` 필드에 커스텀 `@IsIpOrCidr({ each: true })` 데코레이터가 추가됨. 기존 `@IsString({ each: true })` 만으로는 CIDR 표기 포함 IP 형식을 충분히 검증할 수 없었는데, 이번 변경으로 저장 시점에 단일 IP(IPv4/IPv6) 또는 CIDR 만 허용하고 무효 항목은 400 으로 거부하는 계약이 명확해졌다.
- 제안: 양호. 추가 개선 불필요.

### [INFO] 빈 배열 허용 정책 — UpdateAuthConfigDto 전체 삭제 의미론 명시
- 위치: `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts:579-583`
- 상세: `ApiPropertyOptional` description 에 "빈 배열(`[]`) 전송 시 화이트리스트 전체 삭제" 임을 명시하고 있으며, DTO 검증도 빈 배열을 통과시킨다. PATCH 언어에서 빈 배열은 "필드 초기화(clear)" 의미론으로 일관된 처리다.
- 제안: 양호. 이 의미론이 실제 서비스 계층에서도 동일하게 처리되는지 확인할 것 (이번 diff 범위 외).

### [INFO] isIpOrCidr 검증 로직 — 런타임 파싱과 동일 기준 사용
- 위치: `codebase/backend/src/modules/auth-configs/dto/is-ip-or-cidr.validator.ts:396-403`
- 상세: `Address4.isValid || Address6.isValid` 를 사용해 `AuthConfigsService.parseIp` 와 동일한 수용 기준을 공유한다. DTO 에서 통과한 값은 런타임 평가 시 항상 파싱 가능하므로 저장-런타임 간 드리프트가 제거된다. 하위 호환성 측면: 이전에는 무효 IP 문자열도 저장될 수 있었으나, 이번 추가로 신규 요청은 400 으로 거부된다. 이미 저장된 기존 레코드에는 영향 없음.
- 제안: 양호.

### [WARNING] revealedSecret 30초 타이머 — useEffect 미적용 (메모리 누수 잠재)
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx:1149`
- 상세: `revealMutation.onSuccess` 내에서 `window.setTimeout(() => setRevealedSecret(null), 30_000)` 를 직접 호출하고 있으나, 이번 변경에서 추가된 `useEffect` 패턴(타이머 id 저장 → cleanup 반환)은 `generatedKey` 에만 적용됐다. `revealedSecret` 타이머는 컴포넌트 언마운트 시 `clearTimeout` 이 호출되지 않아 stale setState 가 발생할 수 있다. API 계약 관점에서는 reveal 응답 후 보안 민감 평문이 클라이언트에 의도치 않게 잔류할 수 있는 경로다.
- 제안: `revealedSecret` 도 `useEffect` 로 동일한 패턴 적용.

```ts
useEffect(() => {
  if (!revealedSecret) return;
  const timer = window.setTimeout(() => setRevealedSecret(null), 30_000);
  return () => window.clearTimeout(timer);
}, [revealedSecret]);
```

그리고 `revealMutation.onSuccess` 에서 직접 `window.setTimeout` 호출 제거.

## 요약

이번 변경의 핵심은 `ipWhitelist` 필드에 대한 서버 측 요청 검증 강화(`@IsIpOrCidr`)와 프론트엔드 `generatedKey` 평문 30초 자동 클리어 구현이다. API 계약 관점에서 DTO 계층의 `ipWhitelist` 형식 검증이 런타임 파싱 기준과 일치하도록 설계된 것은 긍정적이며, 하위 호환성 위반(breaking change)은 없다. 다만 `revealedSecret` 에 대해 `useEffect` 기반 타이머 클린업이 적용되지 않아 클라이언트 언마운트 시 stale 상태 업데이트 가능성이 존재하며, 보안 민감 평문의 노출 시간 제어 일관성 측면에서 WARNING 수준으로 식별된다.

## 위험도
LOW

---

STATUS=success ISSUES=1
