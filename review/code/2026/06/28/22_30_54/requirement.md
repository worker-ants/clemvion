# 요구사항(Requirement) 리뷰

## 발견사항

### 파일 1: http-exception.filter.spec.ts

- **[INFO]** `requestId` 항상 발급 단언 (5xx 포함)
  - 위치: 신규 테스트 line 49 (`expect(body.error.requestId).toBeDefined()`)
  - 상세: spec/5-system/2-api-convention.md §5.3 — "requestId: 모든 에러 응답에 항상 포함". 기존 5xx masking 테스트에 `requestId` 단언이 누락돼 있었는데, 이번 diff 에서 5xx 테스트에도 추가해 spec 요건을 완전히 커버한다. 구현(`http-exception.filter.ts` line 103)도 모든 경로에서 발급하므로 테스트-구현-spec 세 계층 일치.

- **[INFO]** `QueryFailedError(23505) → 409 RESOURCE_CONFLICT` 테스트 신규 추가
  - 위치: line 52–67
  - 상세: `isUniqueViolation` 분기(구현 line 78-83)가 이미 존재했으나 기존 테스트에 없었다. 테스트가 분기를 커버하게 됐다. spec/5-system/3-error-handling.md §1.3 에서 `RESOURCE_CONFLICT`=409 로 정의되며, 구현이 정확히 매핑한다.
  - 주의: 테스트의 `driverError.code = '23505'` 는 실제 TypeORM `driverError` 구조에서 `code` 프로퍼티가 있음을 전제한다. 구현(`http-exception.filter.ts line 21`)이 `driverError?.code === '23505'` 로 읽으므로 테스트 fixture 가 올바르게 구성됐다.

- **[INFO]** nested `{ error: { code, message, details } }` envelope 테스트 (API §5.3 shape)
  - 위치: line 69–91
  - 상세: 구현에서 이미 nested error 인식 로직이 있었으나(filter line 61-73) 테스트 미존재. 이번 테스트가 `code`, `message`, `details`, `requestId` 네 필드를 모두 단언한다. spec/5-system/2-api-convention.md §5.3 의 `{ error: { ... } }` envelope 형식과 부합.

- **[WARNING]** `QueryFailedError` 테스트에서 driver error message 미노출 단언이 `message` 필드에만 국한됨
  - 위치: line 66 (`expect(body.error.message).not.toContain('duplicate key value')`)
  - 상세: 구현(line 83)은 `'Resource already exists or has been modified concurrently.'` 고정 문구를 사용한다. 테스트가 내부 원문 미노출(CWE-209)을 negative assertion 으로 확인하지만, 양성 단언 `toBe('Resource already exists or...')` 이 없어 구현의 정확한 문구가 바뀌더라도 통과할 수 있다. 에러 핸들링 spec(§1.3)은 RESOURCE_CONFLICT 의 message 고정 문구를 규정하지 않으므로 CRITICAL 은 아니나, 회귀 방지 측면에서 양성 단언 추가를 권장한다.
  - 제안: `expect(body.error.message).toBe('Resource already exists or has been modified concurrently.')` 를 추가해 message 문구까지 pin.

---

### 파일 2 & 3: client-ip.spec.ts / client-ip.ts

- **[INFO]** [SPEC-DRIFT] `extractClientIpFromHeaders` 반환형 `null → undefined` 변경
  - 위치: client-ip.ts line 556-566 diff, spec/5-system/1-auth.md §2.3 클라이언트 IP 행
  - 상세: spec/5-system/1-auth.md §2.3 표의 "클라이언트 IP" 행은 소비처 표현을 암묵적으로 전제하며, `extractClientIpFromHeaders` 의 반환형(`string | null` vs `string | undefined`)을 직접 명세하지는 않는다. 변경 이유(소비처의 `?? undefined` 중간 변환 제거)는 합리적이고 의도적이다. `extractClientIp(req)` 는 여전히 `string | null` 를 반환하므로 두 함수의 반환형이 달라졌지만, 소비처가 다르므로 코드 레벨 일관성은 유지된다. 코드 자체는 버그 아니며, spec 문서에 이 분리 이유(`extractClientIpFromHeaders: undefined`, `extractClientIp: null`)가 기록되지 않아 spec 이 낡은 상태다.
  - 제안: 코드 유지 + `spec/5-system/1-auth.md §2.3` 클라이언트 IP 행에 두 함수의 반환형 분리를 명문화.

- **[WARNING]** 테스트 혼용: `extractClientIp` 최종 폴백은 여전히 `null` 반환인데 테스트가 이를 정확히 검증함
  - 위치: client-ip.spec.ts line 518 (`expect(extractClientIp(req)).toBeNull()`)
  - 상세: `extractClientIp` 는 `string | null` 을 반환하고 실제로 모든 소스 없을 때 `null` 을 반환한다. `extractClientIpFromHeaders` 는 `undefined` 를 반환하도록 바뀌었으나 `extractClientIp` 는 바뀌지 않았다. 두 함수의 반환형 비대칭이 계속 존재하며, 소비처(`hooks.service.ts`)에서 `extractClientIpFromHeaders` 를 쓰는 경우 `sourceIp` 는 `string | undefined` 타입이다. TypeScript 타입 시스템상 이 값을 `execute` options 의 `sourceIp?: string` 에 그대로 전달해도 호환된다. 기능 버그 없음.

- **[INFO]** `shouldTrustCfConnectingIp` 및 `extractClientIp` 테스트는 기존 그대로로 커버 완전함
  - 상세: 추가·수정된 테스트가 기존 null → undefined 계약 변경만 반영했고, CF on/off·XFF·IPv6-mapped 정규화·폴백 우선순위 등 핵심 경로는 이전 테스트가 이미 커버한다. 새 diff 가 두 테스트(제목 변경 + 단언 변경)만 수정했으므로 커버리지 퇴보 없음.

---

### 파일 4: executions.service.ts

- **[INFO]** `getStatusById` 공개 API 신규 추가
  - 위치: line 697-703 diff
  - 상세: 기능 완전성 — 조회 실패를 `.catch(() => null)` 로 흡수하고, 미존재 시 `null` 반환. `HooksService.getActiveExecutionStatus` 가 `executionsService['executionRepository']` private 브래킷 접근에서 이 공개 메서드로 전환하는 것이 M-3 의 목적이다.

- **[INFO]** `select: ['id', 'status']` 투사 사용
  - 상세: `findOne` 에 `select` 배열 형태 사용. TypeORM 은 배열 형태(`['id', 'status']`)와 객체 형태(`{ id: true, status: true }`) 모두 지원한다. 동일 파일의 `verifyOwnership` 등이 QueryBuilder `addSelect` 를 쓰는 것과 혼용이지만 `findOne` 단순 경우에는 배열 형태가 더 간결하다. 기능 버그 없음.

- **[INFO]** 미존재 `executionId` 처리
  - 상세: `findOne` 결과가 `null` 이면 `row?.status ?? null` 로 `null` 반환. 소비처(`getActiveExecutionStatus`)가 `null → 비-활성` 으로 처리하므로 올바른 폴백.

---

### 파일 5: hooks.service.spec.ts

- **[WARNING]** `executionRepository` private 브래킷 접근이 mock 에 여전히 잔류
  - 위치: line 2347, 2483 (`moduleRef.get(ExecutionsService) as { executionRepository: ... }`)
  - 상세: 두 테스트(`parseUpdate 성공 + 활성 execution 있음 → InteractionService.interact()`, `parseUpdate 성공 + execution 이 running → executionStillRunning`)가 `moduleRef.get(ExecutionsService).executionRepository.findOne.mockResolvedValue(...)` 를 통해 mock findOne 을 직접 조작하고 있다. 이는 새 mock IIFE 가 `executionRepository` 를 내부 closure 변수로 노출해 `getStatusById` 가 그 `findOne` 에 위임하는 방식이므로 기능적으로는 정상 동작한다. 그러나 이 패턴은 `executionRepository` 를 mock 외부로 노출하는 것을 강제해, 실제 `ExecutionsService` 의 구조적 의존을 테스트 mock 에 반영한다는 점에서 캡슐화가 불완전하다.
  - 제안: 두 테스트를 `moduleRef.get(ExecutionsService).getStatusById.mockResolvedValueOnce(...)` 패턴으로 전환하면 테스트가 공개 API 만 접근해 더 안전해진다. 다만 기존 23개 테스트 사이트를 일괄 전환하는 범위 작업이므로 즉각 차단은 아님.

- **[INFO]** `getStatusById` mock IIFE 구현의 `.catch(() => null)` 동작이 실제와 일치
  - 위치: line 1626-1633
  - 상세: 실제 `getStatusById` 의 `.catch(() => null)` (executions.service.ts line 700)와 동일 패턴을 mock 이 재현한다. `executionRepository.findOne().catch(() => null)` 호출 순서가 올바르다.

---

### 파일 6: hooks.service.ts

- **[INFO]** `extractClientIpFromHeaders` 반환형 변경에 따른 중간 변환 제거
  - 위치: diff line -3 (`?? undefined` 제거 세 곳)
  - 상세: `extractClientIpFromHeaders` 가 이미 `string | undefined` 를 반환하므로, 이전의 `?? undefined` 는 `null ?? undefined === undefined` 로 실질적 no-op 이었다. 제거가 정확하다.

- **[INFO]** [SPEC-DRIFT] `clientIp ?? undefined` → `clientIp` 단순화
  - 위치: hooks.service.ts line 2515, 2524, 2533 diff
  - 상세: spec/5-system/1-auth.md §2.3 의 "webhook/rate-limit/ip_whitelist 경로는 헤더 기반(CF-gated → XFF 첫 IP)만 적용" 기술은 이 동작의 SoT이지만, `extractClientIpFromHeaders` 의 반환형이 `null → undefined` 로 바뀐 것과 그로 인한 소비처 단순화는 명시적으로 기술되지 않았다. 코드 변경은 의도적이고 합리적이다.

- **[INFO]** `getActiveExecutionStatus` private-bracket-access → `getStatusById` 공개 메서드 전환
  - 위치: hooks.service.ts line 2551-2568 diff
  - 상세: 이전 구현은 `this.executionsService['executionRepository']?.findOne?.(...)` 로 private 필드에 브래킷 접근했다. 이는 TypeScript 의 접근 제어를 우회하는 안티패턴이며 리팩토링 정당하다. 새 `getStatusById` 공개 메서드로 위임한 후 null-falsy guard(`if (!status) return null`)가 동일 동작을 유지한다.

- **[WARNING]** `getActiveExecutionStatus` 의 null-falsy guard 가 `PENDING` 상태를 삼킬 수 있음
  - 위치: hooks.service.ts line 2558-2559 (`const status = await this.executionsService.getStatusById(executionId); if (!status) return null;`)
  - 상세: `ExecutionStatus.PENDING` 는 문자열 `'pending'` 로, falsy 가 아니다. 따라서 `if (!status)` 는 `null`/`undefined` 만 잡고 실제 status 값은 통과한다. 기능 버그 없음. 다만 원 코드의 `if (!execution)` 패턴과 `status` 값의 null guard 가 혼용된 것처럼 보일 수 있어 가독성 주의 필요.
  - 제안: `if (status == null) return null;` 로 명시적 null-check 를 권장 (strict null equality).

---

## 요약

이번 변경은 세 주제로 구성된다. (1) `GlobalExceptionFilter` 테스트 강화 — `QueryFailedError(23505) → 409 RESOURCE_CONFLICT`, nested error envelope, 5xx requestId 단언을 추가해 spec §5.3·§1.3 요건을 테스트 레벨에서 완전히 커버했다. (2) `extractClientIpFromHeaders` 반환형 `null → undefined` 통일 — 소비처의 불필요한 `?? undefined` 변환을 제거해 타입 일관성을 높였으며, `extractClientIp` 의 최종 폴백은 여전히 `null` 이어서 두 함수의 반환형 비대칭은 유지된다. 기능 버그 없음. (3) `ExecutionsService.getStatusById` 공개 메서드 도입 및 `HooksService.getActiveExecutionStatus` 의 private 브래킷 접근 제거 — 캡슐화를 복원했으며 테스트 mock 도 동일 위임 패턴으로 구성됐다. 일부 hooks 테스트가 여전히 `executionRepository.findOne` 을 직접 조작하는 패턴을 사용하는 점(mock closure 경유)은 향후 `getStatusById` 직접 mock 으로 전환할 것을 권장하나 기능상 문제는 없다. 전반적으로 기능 요구사항을 충족하며 CWE-209 방어·spec §5.3 requestId 요건·spec §2.3 IP 추출 정책이 코드-테스트 양면에서 일치한다.

## 위험도

LOW
