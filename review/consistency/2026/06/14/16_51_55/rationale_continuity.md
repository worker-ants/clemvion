# Rationale 연속성 검토 결과

검토 모드: --impl-done  
Scope: spec/2-navigation/6-config.md  
Diff base: origin/main  

---

## 발견사항

변경 범위는 `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts` 의 `@ApiProperty()` 데코레이터에 대한 두 가지 수정으로 한정된다.

1. `AuthConfigUsagePeriodCountsDto` — `description` 문자열을 영문→한국어로 변환하고 `type: Number` 명시 추가, 각 필드에 JSDoc 코멘트 추가.
2. `AuthConfigUsageCallDto` — `sourceIp` / `responseCode` 필드에 `type: String` 명시 추가.

이 변경들과 관련된 Rationale 결정을 아래 4개 관점에서 점검한 결과:

### 발견사항 없음 (NONE)

**1. 기각된 대안의 재도입 — 해당 없음**

- `spec/2-navigation/6-config.md § R-6` 는 기간별 호출 수를 "롤링 윈도(24h/7d/30d), 캘린더 버킷 아님"으로 명시적으로 결정했다. 변경된 `description` 문자열 `'최근 24시간 롤링 윈도 호출 건수 (캘린더 일 경계 아님).'` 은 이 결정을 그대로 반영한다. 과거 기각된 "캘린더 버킷" 대안을 재도입하는 내용이 없다.

**2. 합의된 원칙 위반 — 해당 없음**

- `R-6` 의 `source_ip`·`response_code` 저장 결정("webhook 은 실제 HTTP 코드, 비-HTTP 트리거는 NULL → status enum 폴백")이 DTO 의 `nullable: true` + 설명 텍스트(`'캐처되지 않은 호출(비-HTTP 트리거·배포 이전 row)은 null'`)와 정합된다.
- `R-2` 의 "항상 마스킹 + Reveal 엔드포인트" 원칙에 영향을 주는 변경이 없다.
- `spec/2-navigation/6-config.md § R-1` 의 select-only 모델 선택 정책은 이 diff 와 무관하다.

**3. 결정의 무근거 번복 — 해당 없음**

- Swagger `@ApiProperty` 의 `type` 명시 추가(`type: Number` / `type: String`)는 NestJS/Swagger 플러그인 없이 런타임 타입 추론을 보강하는 관례적 코드 보완이다. spec 에 `@ApiProperty` 의 `type` 명시 여부를 결정한 Rationale 항이 없으므로 "번복"에 해당하지 않는다.
- description 한국어 전환도 spec Rationale 내 "DTO description 언어를 영문으로 고정한다"는 결정이 없으므로 번복으로 볼 수 없다 (단, `spec/conventions/cafe24-api-metadata.md` 는 MCP tool description 에 "영문 권장"을 명시하고 있으나, 이는 MCP tool 한정이며 내부 DTO description 을 대상으로 하지 않는다).

**4. 암묵적 가정 충돌 — 해당 없음**

- `spec/1-data-model.md §2.13` 에 기록된 `source_ip VARCHAR(45)` (IPv6 포함 최대 길이) invariant 를 우회하는 설계가 없다. `sourceIp: string | null` DTO 타입은 그대로다.
- `response_code` 의 "webhook 성공 = '202', 비-HTTP = NULL → status enum 폴백" invariant 도 그대로 유지된다.

---

## 요약

대상 diff 는 `AuthConfigUsagePeriodCountsDto` 와 `AuthConfigUsageCallDto` 의 `@ApiProperty` 데코레이터에 대한 순수 서술적 보완(description 한국어화, `type` 명시, JSDoc 추가)으로만 구성된다. 기존 `spec/2-navigation/6-config.md § R-6` 에서 확정된 롤링 윈도·소스 IP·응답 코드 저장 결정, `R-2` 의 마스킹 원칙, `spec/1-data-model.md` 의 컬럼 invariant 중 어느 것도 침해하거나 우회하지 않는다. 과거 Rationale 에서 기각된 캘린더 버킷 대안·전용 call-log 엔티티 대안·인라인 인증 방식을 재도입하는 내용도 없다. Rationale 연속성 관점의 이슈가 존재하지 않는다.

---

## 위험도

NONE
