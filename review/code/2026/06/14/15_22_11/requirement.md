# 요구사항(Requirement) 리뷰 — §A.3 호출 이력 (config-call-history)

리뷰 일시: 2026-06-14  
대상 브랜치: claude/config-call-history-929994  
관련 spec: `spec/2-navigation/6-config.md §A.3`, `spec/1-data-model.md §2.13`, `spec/5-system/12-webhook.md §WH-MG-05`

---

## 발견사항

### [WARNING] `setParameters` 가 `.where()` 에서 바인딩한 `triggerIds` 파라미터를 덮어쓸 수 있음
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` 줄 577–591 (`periodQb`)
- 상세: TypeORM `QueryBuilder` 의 `setParameters()` 는 QB 가 내부적으로 보유한 전체 파라미터 맵을 **replace(덮어쓰기)** 한다. `.where('e.trigger_id IN (:...triggerIds)', { triggerIds })` 로 바인딩한 `triggerIds` 파라미터가 이후의 `.setParameters({ since24h, since7d, since30d })` 호출로 제거될 수 있다. 결과적으로 period 집계 쿼리가 `trigger_id` 조건 없이 전체 `execution` 테이블을 집계하게 되어 다른 워크스페이스·다른 인증 설정의 실행까지 포함될 수 있다. 테스트 mock 은 `setParameters` 를 `mockReturnThis()` 로 통과시키므로 이 결함을 검출하지 못한다.
- 제안: `setParameters` 대신 `.andWhere` + 개별 파라미터 전달 패턴을 사용하거나, `.where` 호출 **이후** 가 아니라 `.where` 의 두 번째 인자로 모든 파라미터를 한 번에 전달한다. 예시:
  ```ts
  .where('e.trigger_id IN (:...triggerIds)', {
    triggerIds,
    since24h: new Date(now - USAGE_PERIOD_WINDOWS_MS.last24h),
    since7d:  new Date(now - USAGE_PERIOD_WINDOWS_MS.last7d),
    since30d: new Date(now - USAGE_PERIOD_WINDOWS_MS.last30d),
  })
  ```
  또는 `addSelect` 의 FILTER 절 파라미터를 `setParameters` 가 아닌 QB 내 파라미터 병합 메서드(`setParameter` 단수)로 추가한다.

---

### [SPEC-DRIFT] `[SPEC-DRIFT]` spec/2-navigation/6-config.md §A.3 표가 구현 완료를 반영하지 않음
- 위치: `spec/2-navigation/6-config.md §A.3` 줄 101–102
- 상세: 코드는 `기간별 호출 수`(periodCounts, 롤링 윈도 24h/7d/30d), `소스 IP`(source_ip), `응답 코드`(response_code)를 완전히 구현하였으나, spec 표는 여전히 `🚧 미구현 (Planned)` 및 `소스 IP·응답 코드 컬럼은 미구현 / Planned` 로 표기되어 있다. 이는 코드가 틀린 것이 아니라 spec 표현이 낡은 것이다. plan `spec-sync-config-gaps.md` 에도 spec 동기화를 수행한다고 기술하였으나 실제 spec 파일은 아직 갱신되지 않았다.
- 제안: 코드 유지 + spec 반영. 대상: `spec/2-navigation/6-config.md §A.3` 표 3행 구현 열을 ✅ 로 갱신하고, `/usage` 응답 shape(`totalCalls`/`lastUsedAt`/`periodCounts`/`recentCalls[]`)를 §3 API 표에 추가. `project-planner` 위임.

---

### [SPEC-DRIFT] `[SPEC-DRIFT]` spec/1-data-model.md §2.13 Execution 표에 `source_ip`·`response_code` 컬럼 미등재
- 위치: `spec/1-data-model.md §2.13 Execution` 줄 453–475
- 상세: V096 마이그레이션으로 `execution.source_ip VARCHAR(45)`·`execution.response_code VARCHAR(10)` 두 컬럼이 추가되었고, 엔티티(`execution.entity.ts`)에도 반영되었지만, spec 데이터 모델 §2.13 Execution 필드 표에는 두 컬럼이 존재하지 않는다. 또한 consistency-check SUMMARY `W-1`에서 지적한 "AuthConfig 호출 집계 경로(`Execution.trigger_id → Trigger.auth_config_id` 조인)의 SoT"도 아직 spec 에 미기술 상태이다. 코드 구현은 올바르며, spec 만 낡았다.
- 제안: 코드 유지 + spec 반영. 대상: `spec/1-data-model.md §2.13` 표에 `source_ip VARCHAR(45)?`·`response_code VARCHAR(10)?` 행 추가(V096 주석 포함) 및 AuthConfig 호출 집계 경로 절 추가. `project-planner` 위임.

---

### [INFO] `spec/2-navigation/6-config.md §A.3`에 `periodCounts` 필드명·롤링 윈도 기준이 명시되지 않음
- 위치: `spec/2-navigation/6-config.md §A.3` 및 `## 3. API` (줄 252–265)
- 상세: spec §3 API 표의 `GET /api/auth-configs/:id/usage` 행에 응답 shape가 기술되지 않아 `periodCounts`, `last24h/last7d/last30d`, 롤링 윈도(캘린더 버킷 아님) 등의 계약이 spec 에서 확인 불가하다. 구현은 합리적이며 consistency-check SUMMARY I-1·I-8·I-9 에서 이미 포착된 사항이다.
- 제안: `spec/2-navigation/6-config.md §3 API` 표에 `/usage` 응답 shape 명시 (SPEC-DRIFT 와 같은 spec 갱신 배치로 처리 가능). `project-planner` 위임.

---

### [INFO] `periodCounts` 쿼리가 모든 실행(archived/cancelled 포함)을 집계함
- 위치: `auth-configs.service.ts` 줄 576–591
- 상세: 기간별 호출 수 쿼리는 `trigger_id IN` 조건만 적용하므로 `cancelled`·`failed`·`pending` 상태의 실행도 포함된다. spec §A.3 표에 "호출 수" 정의(모든 상태 vs 완료된 호출만)가 명시되지 않아 현재 동작이 요구사항을 위반하는지 판단 불가하다. `totalCalls` 도 동일하게 전체 상태를 집계하므로 일관성은 있다.
- 제안: spec 에서 "호출 수" 기준(모든 status vs 특정 subset)을 명확히 기술할 것을 권장. 현 구현이 잘못됐다고 판단하기 어려우므로 INFO 로 남긴다.

---

### [INFO] `responseCode` 필드 타입이 서비스(`string`)와 DTO(`string`) 사이에서는 일치하지만 `null` 가능성 불일치
- 위치: `auth-configs.service.ts` 줄 549 (`responseCode: string`), `auth-config-response.dto.ts` 줄 552 (`responseCode: string`)
- 상세: 서비스 반환 타입에서 `responseCode: string` (non-null)으로 선언되어 있다. `e.responseCode ?? e.status` 폴백 때문에 null 이 될 수 없어 이 선언은 정확하다. DTO도 `responseCode: string` (non-null)이며 Swagger `@ApiProperty`에 `nullable` 없음 — 일관성 있음. 단, `e.status` 값이 항상 존재하는지 TypeORM 레벨에서는 보장되나, `Execution.status` 컬럼에 `nullable: false`이므로 문제없다.
- 제안: 변경 불요. 관찰 사항으로 기록.

---

### [INFO] 프론트엔드 테스트(`usage-drawer.test.tsx`)가 비-HTTP 트리거 `responseCode` 표시를 명시적으로 검증하지 않음
- 위치: `codebase/frontend/src/app/(main)/authentication/__tests__/usage-drawer.test.tsx` 줄 1226–1228
- 상세: 테스트 데이터에 `e-schedule` (responseCode: "failed")가 포함되어 있으나, 테스트 단언은 "—" (sourceIp null 플레이스홀더)만 검증하고 `responseCode: "failed"` 텍스트가 실제로 렌더되는지는 단언하지 않는다. 기능적으로는 올바르게 렌더되겠지만 테스트 커버리지 관점에서 gap이다.
- 제안: `expect(screen.getByText("failed")).toBeInTheDocument()` 또는 유사한 단언을 추가하면 비-HTTP 폴백 경로의 UI 렌더를 보장할 수 있다.

---

## 요약

§A.3 호출 이력(소스 IP·응답 코드·기간별 호출 수) 구현은 전반적으로 의도된 기능을 완전히 구현하고 있다. DB 스키마(V096), 엔티티, 실행 엔진 옵션 확장, hooks.service 전달, getUsage 서비스 로직, DTO, 프론트엔드 UI·i18n까지 일관된 체인을 형성하며, 엣지 케이스(트리거 없음, getRawOne null, orphan trigger, 비-HTTP 트리거 null)에 대한 단위 테스트도 충분히 작성되어 있다. 핵심 위험은 `periodQb` 에서 TypeORM `setParameters()` 가 `.where()` 에 바인딩된 `triggerIds` 파라미터를 덮어써 기간 집계가 전체 테이블을 스캔하는 데이터 오염 버그로, 이는 테스트 mock 으로 검출되지 않는 실제 런타임 위험이다(WARNING). spec 동기화 누락(§A.3 표, §2.13 컬럼)은 코드가 아니라 spec 이 낡은 SPEC-DRIFT 이며 `project-planner` 위임 사항이다.

---

## 위험도

**MEDIUM**
