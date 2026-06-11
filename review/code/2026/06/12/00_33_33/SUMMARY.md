# Code Review 통합 보고서

## 전체 위험도

**LOW** — 신규 취약점 없음. 감사 로그 CRUD 일원화 리팩터링 품질은 양호하나, `recordAudit` positional 파라미터 혼동 가능성·`req.ip undefined` 미정규화·테스트 커버리지 갭 등 LOW 수준 경고 다수 존재.

---

## Critical 발견사항

_없음_

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W-1 | Maintainability / Security | `recordAudit(action, workspaceId, userId, resourceId, ipAddress?)` — 5개 positional `string` 파라미터, TypeScript 가 인자 순서 오류를 탐지 못함. 감사 로그 주체·대상이 컴파일 타임 오류 없이 뒤바뀔 수 있음. | `auth-configs.service.ts` `recordAudit()` | 단일 options 객체 `{ action, workspaceId, userId, resourceId, ipAddress? }` 로 리팩터링하거나 branded/opaque type 적용 |
| W-2 | API Contract | `req.ip` 가 `undefined` 일 때 `null` 정규화 없이 서비스로 전달되어 `ipAddress: undefined` 로 audit 기록될 수 있음. `AuditLogDto.ipAddress` 의 OpenAPI 스키마(`nullable: true`, `null` 기대)와 미묘하게 불일치. | `auth-configs.controller.ts` CRUD 핸들러 전체 | 컨트롤러 또는 서비스에서 `req.ip ?? null` 로 정규화 |
| W-3 | Testing | `AuditLogsService.record()` 의 best-effort(swallow) 계약 — DB 오류 시 예외를 삼키고 경고 로그만 남기는 핵심 계약을 검증하는 단위 테스트가 없음 | `audit-logs.service.ts` `record()` catch 블록 | `audit-logs.service.spec.ts` 에 `repo.save` 가 reject 할 때 `record()` 가 resolve 되는 케이스 추가 |
| W-4 | Testing | `integrations.service.spec.ts` `update` 케이스에서 `integrationRepo.save` 호출 여부 미검증 — 구현이 `save` 를 생략해도 현 테스트는 통과 | `integrations.service.spec.ts` `update → records integration.updated` | `expect(integrationRepo.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Renamed' }))` 단언 추가 |
| W-5 | Testing | OAuth `reauthorize` 경로에서 audit 미기록 계약이 명시적으로 단언되지 않음 — non-OAuth 만 `integration.reauthorized` 기록이라는 분기 계약이 회귀 방지 테스트 없음 | `integrations.service.spec.ts` `reauthorize → OAuth` 케이스 | `expect(auditLogsService.record).not.toHaveBeenCalled()` 단언 추가 |
| W-6 | Testing | `auth-configs.controller.spec.ts` 읽기 경로(`findAll`/`findOne`/`getUsage`)의 "audit 없음" 계약이 명시적으로 검증되지 않음 — 의도 불명확 | `auth-configs.controller.spec.ts` `userId/req.ip 전파` describe | 읽기 경로에서 `auditLogsService.record` 미호출을 단언하는 테스트 또는 코멘트 추가 |
| W-7 | Requirement | `integrations.service.ts` `update` 메서드 — `changes` 가 비어도 `save()` 가 항상 호출되어 불필요한 DB write 발생. 요구사항 위반은 아니나 "변경 없으면 아무 동작 없음" 계약이 spec 에 명시되지 않아 혼란 가능 | `integrations.service.ts` `update` L671 | `Object.keys(changes).length > 0` guard 추가 또는 현 동작을 의도적으로 문서화 |
| W-8 | Documentation | `AuditLogDto.action` `@ApiProperty` description 이 action 목록을 수동으로 나열하는 이중 SoT 구조 — `AUDIT_ACTIONS` 상수와 별도로 관리되므로 향후 action 추가 시 미갱신 위험 | `audit-log-response.dto.ts` L84–90 | `Object.values(AUDIT_ACTIONS).join(', ')` 등 동적 생성 또는 "현재 값은 `AUDIT_ACTIONS` const 참조" 한 줄로 축약 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I-1 | Security | `constantTimeEquals` — 길이 불일치 시 조기 `false` 반환으로 타이밍 오라클 이론적 가능. 실제 공격 조건(네트워크 레이턴시 우세)에서 실질 위험 매우 낮음 | `auth-configs.service.ts` `constantTimeEquals` | 완전한 타이밍 안전이 필요하면 최대 길이로 패딩 후 `timingSafeEqual` 결합 패턴 사용 가능 (현 코드도 실용적 수준 충분) |
| I-2 | Security | `req.ip undefined` 전파 — `trust proxy` 미설정 환경에서 모든 민감 작업의 IP 추적 무력화. 명시적으로 허용된 설계 | `auth-configs.controller.ts` 전체 | 배포 환경 `trust proxy` 설정 필수화 운영 가이드 명시; `'unknown'` sentinel 값 사용 검토 |
| I-3 | Security | `update()` 내 `Object.assign(config, data)` — `data.config` 필드로 SECRET_CONFIG_KEYS 직접 덮어쓰기 가능 여부가 이번 diff 범위 내 미확인. DTO 레벨 방어 전제. Pre-existing 이슈 | `auth-configs.service.ts` `update` | DTO 레벨에서 `config` 필드 내 비밀 키 직접 수정 차단 여부 검토 |
| I-4 | Security | `HMAC_ALLOWED_ALGORITHMS` 화이트리스트 (sha256/sha512) 및 `constantTimeEquals` 등 핵심 방어 메커니즘 유지·검증됨 — 양호 | `auth-configs.service.ts` | 없음 |
| I-5 | Maintainability | `USAGE_RECENT_CALLS_LIMIT = 20` 과 `findAll` 기본 limit 20 이 동일 값 — 항상 같아야 한다면 `DEFAULT_PAGE_LIMIT` 단일 상수로 통합 검토 | `auth-configs.service.ts` | 선택적 통합 |
| I-6 | API Contract | `getUsage` 응답 DTO 의 `recentCalls` 최대 건수가 OpenAPI 문서에 미노출. 익명 인터페이스 반환 타입이라 문서화 부족 | `auth-configs.service.ts` `getUsage` | `@ApiProperty({ maxItems: 20 })` 등으로 OpenAPI 문서화 검토 |
| I-7 | Testing | `getUsage` 에서 `USAGE_RECENT_CALLS_LIMIT = 20` 이 실제로 지켜지는지 검증하는 테스트 없음. 상수 값 변경 시 조용히 통과 | `auth-configs.service.spec.ts` | `getUsage` describe 에 `limit(20)` 호출 단언 추가 (선택적) |
| I-8 | Documentation | `spec/5-system/1-auth.md §4.1` 표, `AUDIT_ACTIONS` 상수, `AuditLogDto.action` description — 삼중 일치 확인됨. 양호 | 전체 | 없음 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | recordAudit positional 파라미터 혼동 가능성(컴파일 미탐지), req.ip undefined 전파. 신규 취약점 없음 |
| requirement | LOW | integrations.service.ts update 에서 변경 없어도 save() 호출되는 불필요 DB write. 기능 요구사항 위반 아님 |
| scope | N/A (출력 파일 없음) | status=success 로 기록됐으나 scope.md 파일 미존재 — 판정 불가 |
| side_effect | NONE | 모든 변경이 런타임 부작용 없음. AuditAction 추가 export 하위 호환적 |
| maintainability | LOW | recordAudit 5개 positional 파라미터 시그니처가 향후 유지보수 위험. 나머지 개선(중복 제거, 상수화, 상수 참조 통일) 양호 |
| testing | LOW | best-effort swallow 계약 테스트 부재, OAuth reauthorize audit 부재 단언 미검증, update save 호출 미검증 |
| documentation | LOW | AuditLogDto.action description 이중 SoT 구조(수동 목록 관리). 나머지 문서화 품질 양호 |
| api_contract | LOW | req.ip undefined → null 미정규화로 OpenAPI nullable 계약과 미묘한 불일치. Breaking change 없음 |

---

## 발견 없는 에이전트

- **side_effect**: 프로덕션 런타임 부작용 전혀 없음으로 판정 (위험도 NONE)

---

## 권장 조치사항

1. **(W-1) `recordAudit` 시그니처를 단일 options 객체로 변경** — `{ action, workspaceId, userId, resourceId, ipAddress? }` 형태로 리팩터링. TypeScript 가 인자 순서 오류를 컴파일 타임에 차단 가능. 현재 감사 로그 주체·대상 스왑이 무방비.
2. **(W-2) `req.ip ?? null` 정규화** — 컨트롤러 또는 서비스에서 `undefined` 를 `null` 로 변환하여 OpenAPI DTO(`nullable: true`) 계약과 일치시킴.
3. **(W-3) `AuditLogsService.record` best-effort 테스트 추가** — DB 오류 시 예외를 삼키는 핵심 계약을 `audit-logs.service.spec.ts` 에 명시적으로 검증.
4. **(W-4) `integrationRepo.save` 호출 단언 추가** — `integrations.service.spec.ts` update 케이스에서 실제 저장 경로 검증.
5. **(W-5) OAuth reauthorize audit 미기록 단언 추가** — `expect(auditLogsService.record).not.toHaveBeenCalled()` 로 분기 계약 명시.
6. **(W-6) 읽기 경로 "audit 없음" 계약 명시** — `findAll`/`findOne`/`getUsage` 에서 audit 미기록 의도를 테스트 또는 주석으로 문서화.
7. **(W-7) `integrations.service.ts update` 불필요 `save()` 호출 guard** — `Object.keys(changes).length > 0` 조건 추가 또는 현 동작 의도 문서화.
8. **(W-8) `AuditLogDto.action` description 이중 SoT 해소** — 동적 생성 또는 `AUDIT_ACTIONS` const 참조 한 줄로 축약.

---

## 라우터 결정

라우터가 reviewer 를 선별했습니다 (`routing=done`).

- **실행** (8명): `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract`
- **강제 포함(router_safety)** (6명): `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`
- **제외** (6명):

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 라우터 선별 제외 |
| architecture | 라우터 선별 제외 |
| dependency | 라우터 선별 제외 |
| database | 라우터 선별 제외 |
| concurrency | 라우터 선별 제외 |
| user_guide_sync | 라우터 선별 제외 |

> **참고**: `scope` reviewer 는 `status=success` 로 기록됐으나 출력 파일(`scope.md`)이 디렉터리에 존재하지 않아 발견사항을 통합할 수 없었습니다.
