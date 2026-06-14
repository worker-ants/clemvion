# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-done`  
대상: `spec/2-navigation/6-config.md` / diff `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts`

---

## 발견사항

신규 식별자가 도입된 항목 없음.

이번 diff 는 기존 DTO 클래스(`AuthConfigUsagePeriodCountsDto`, `AuthConfigUsageCallDto`)의 `@ApiProperty` 데코레이터에 `type: Number` / `type: String` 을 추가하고, 필드 설명 문자열을 영문에서 한국어로 교체하며, 인라인 JSDoc 주석을 추가한 **순수 어노테이션 변경**이다. 아래 기존 식별자는 변경되지 않았다.

| 식별자 종류 | 변경 전 | 변경 후 |
|---|---|---|
| 클래스명 | `AuthConfigUsagePeriodCountsDto`, `AuthConfigUsageCallDto` | 동일 (이름 변경 없음) |
| 필드명 | `last24h`, `last7d`, `last30d`, `sourceIp`, `responseCode` | 동일 (필드 추가·제거 없음) |
| API 엔드포인트 | `GET /api/auth-configs/:id/usage` | 변경 없음 |
| 이벤트/메시지명 | 해당 없음 | 해당 없음 |
| ENV var / 설정 키 | 해당 없음 | 해당 없음 |
| 파일 경로 | `dto/responses/auth-config-response.dto.ts` | 동일 |

기존 사용처(`auth-configs.service.ts`, `auth-configs.controller.ts`, `execution-engine.service.ts`, `hooks.service.ts`)와 충돌하는 신규 식별자가 없다.

---

## 요약

이번 구현 diff 는 기존 DTO 필드명·클래스명·엔드포인트·이벤트명·ENV var 를 변경하지 않는다. `type:` 명시와 JSDoc·설명 한국어화는 OpenAPI 스펙 품질 개선용 어노테이션 수정에 해당하며, 어떤 식별자 충돌도 발생하지 않는다.

---

## 위험도

NONE
