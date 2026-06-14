# 요구사항(Requirement) Review — config §A.3 호출 이력

## 발견사항

### [INFO] `safeUsageCount` 의 정수 절삭 미적용
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L45-47 (`safeUsageCount`)
- 상세: DB `COUNT(*)` 는 항상 정수를 반환하지만, 드라이버가 부동소수점 문자열(`'7.0'`)을 돌려보내는 이론적 경우에 `Number('7.0')` → `7` 이 되므로 실제 문제는 없다. 다만 `Math.floor` 나 `parseInt` 없이 `Number(raw)` 만 사용하므로 소수점이 포함된 비정상 값이 그대로 반환된다. DB COUNT 한정 용도에서는 실용 무해하나 방어 코드로서의 완결성은 부족하다.
- 제안: `return isNaN(n) || n < 0 ? 0 : Math.floor(n);` 로 교체하거나 현행 유지 후 주석으로 "DB COUNT 한정 용도" 명시.

### [INFO] `periodQb` 에서 `.where()` + `.setParameters()` 를 분리 호출
- 위치: `auth-configs.service.ts` L586-600
- 상세: `.where('e.trigger_id IN (:...triggerIds)', { triggerIds })` 후 `.setParameters({ since24h, ... })` 를 별도 호출한다. TypeORM 0.3 의 `setParameters` 는 `expressionMap.parameters[key] = value` 로 key별 병합(덮어씌우기가 아님)되므로 `triggerIds` 파라미터는 유지된다. 동작은 올바르나, 가독성·실수 방지를 위해 `.where('...', { triggerIds, since24h, since7d, since30d })` 로 단일 호출로 통합하거나 `.where().setParameters()` 가 merge임을 주석으로 명시하면 유지보수성이 개선된다.
- 제안: 두 파라미터 맵을 `.where()` 한 곳에서 합쳐 전달하도록 리팩토링 권장 (기능 버그 없음, 코드 명확성 이슈).

### [INFO] `clientIp ?? undefined` 의 undefined 전파 경로
- 위치: `hooks.service.ts` L183, L609
- 상세: `extractClientIp` 가 `string | undefined` 를 반환하므로 `clientIp ?? undefined` 는 항상 `string | undefined` 다. `??` 가 아니라 `|| undefined` 도 아니므로 null 은 애초에 반환되지 않지만, `clientIp` 가 이미 `string | undefined` 이고 `?? undefined` 는 `null` 만 `undefined` 로 변환한다는 점에서 코드가 다소 중복적이다. 기능상 문제 없음. `ExecuteOptions.sourceIp?: string` 는 `undefined` 허용이므로 그대로 전달해도 된다.
- 제안: `sourceIp: clientIp` 로 단순화 가능 (동작 동일).

### [INFO] `AuthConfigUsageCallDto.responseCode` — DTO 타입 vs 서비스 반환 타입 일치
- 위치: `auth-config-response.dto.ts` L549 (`responseCode: string`), `auth-configs.service.ts` L628 (`responseCode: e.responseCode ?? e.status`)
- 상세: 서비스는 `string` 을 항상 반환(폴백 보장)하고 DTO 도 `string` (non-null) 으로 선언한다. 일치하며 기능적으로 올바르다. `AuthConfigUsageCallDto` 의 JSDoc 주석이 "항상 non-null" 을 명확히 설명하고 있어 혼동 여지도 없다.

### [INFO] `recentQb` 에 `select('e')` 없이 `innerJoinAndSelect` 사용
- 위치: `auth-configs.service.ts` L602-608
- 상세: `createQueryBuilder('e').innerJoinAndSelect('e.trigger', 't')` 패턴은 TypeORM 에서 엔티티 전체 컬럼(`e.*`)을 자동 SELECT 한다. 새 컬럼 `source_ip`, `response_code` 가 `Execution` 엔티티에 `@Column` 으로 정의되어 있으므로 `getMany()` 결과에 자동 포함된다. spec §A.3 에서 요구하는 모든 필드(`id`, `triggerName`, `status`, `sourceIp`, `responseCode`, `startedAt`)가 정상 반환된다.

## Spec Fidelity 점검

### spec/2-navigation/6-config.md §A.3 호출 이력 표
| spec 요구사항 | 코드 구현 | 일치 |
|---|---|---|
| `totalCalls`: 연결 트리거 누적 실행 수 | `getCount()` + trigger_id IN 조건 | ✅ |
| `periodCounts { last24h, last7d, last30d }` 롤링 윈도 | `USAGE_PERIOD_WINDOWS_MS` + `COUNT(*) FILTER` 단일 쿼리 | ✅ |
| `recentCalls` 최근 20건, `triggerName/status/sourceIp/responseCode/startedAt` | `getMany()` limit(20) + `.map()` 변환 | ✅ |
| 소스 IP: `Execution.source_ip`, webhook/chat-channel extractClientIp | V096 컬럼 + hooks.service `clientIp` 전달 | ✅ |
| 응답 코드: webhook HTTP 코드('202'), 비-HTTP NULL → status 폴백 | `WEBHOOK_ACCEPTED_RESPONSE_CODE = '202'` + `e.responseCode ?? e.status` | ✅ |
| UI: 막대 차트(recharts BarChart) | frontend `page.tsx` BarChart | ✅ |
| 비-HTTP 트리거 소스 IP null → UI `—` | `call.sourceIp ?? "—"` | ✅ |

### spec/1-data-model.md §2.13 Execution
| spec 요구사항 | 코드 구현 | 일치 |
|---|---|---|
| `source_ip Varchar(45)? NULL` (V096) | `@Column({ name: 'source_ip', type: 'varchar', length: 45, nullable: true })` | ✅ |
| `response_code Varchar(10)? NULL` (V096) | `@Column({ name: 'response_code', type: 'varchar', length: 10, nullable: true })` | ✅ |
| 호출 집계 경로: `Execution.trigger_id → Trigger.auth_config_id` 조인 | `Trigger.find({ auth_config_id }) → triggerIds → QB` | ✅ |
| AuthConfig 호출 집계 SoT callout 존재 | `1-data-model.md L478` callout 추가 확인됨 | ✅ |

### spec/2-navigation/6-config.md §3 API
| spec 요구사항 | 코드 구현 | 일치 |
|---|---|---|
| `GET /api/auth-configs/:id/usage` 응답 `{ totalCalls, lastUsedAt, periodCounts, recentCalls }` | `AuthConfigUsageDto` 필드 4종 | ✅ |

### spec/5-system/12-webhook.md WH-MG-05
| spec 요구사항 | 코드 구현 | 일치 |
|---|---|---|
| 호출 이력에서 응답 코드 확인 필수 | `Execution.response_code` + `getUsage` 폴백 로직 | ✅ |

## 요약

변경사항은 §A.3 호출 이력(소스 IP·응답 코드·기간별 호출 수) 전체를 완전히 구현한다. DB 마이그레이션(V096), 엔티티 컬럼, `ExecuteOptions` 타입 확장, `execute()` 영속, `hooks.service` 양방향(webhook·chat-channel) 전달, `getUsage` periodCounts 집계, DTO, 프론트엔드 UI(BarChart + 테이블 컬럼), i18n(ko·en) 등 전 계층이 일관되게 구현되었으며 spec `6-config.md §A.3`, `1-data-model.md §2.13`, WH-MG-05 와 line-level 로 일치한다. 발견된 사항은 모두 INFO 수준의 코드 스타일·방어코드 개선 제안이며 기능 버그·요구사항 누락·spec 위반은 없다.

## 위험도

LOW
