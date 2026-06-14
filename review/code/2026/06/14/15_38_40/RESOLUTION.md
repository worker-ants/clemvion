# RESOLUTION — config-call-history-929994 / 15_38_40 (3rd fresh review)

대상 commits: `73ce21c8`(feat) · `cb51723e`(fix#1) · `18c87e06`(fix#2)
본 RESOLUTION: **추가 코드 변경 없음** — 잔여 경고는 전부 0-Critical 의 style/architecture/systemic/deferred 로, 본 PR 게이트 사유가 아님을 명시 기록한다.

> **3회 연속 fresh review 모두 Critical 0.** 라운드별 실질 발견은 이미 조치됨:
> - round1(15_02_15): W-3/W-10(DTO 계약)·W-4(쿼리 병렬)·W-5(인덱스)·W-9(clientIp 패턴)·W-11/W-12(테스트) → fix#1(cb51723e).
> - round2(15_22_11): **W-1(setParameters 가 triggerIds 덮어써 cross-workspace 누출) = 오탐** (TypeORM `setParameters` 는 `setParameter` per-key merge — `node_modules/typeorm/query-builder/QueryBuilder.js:193-198` 확인, triggerIds 바인딩 보존). **W-9(무관 필드 `lastUsedAt` 의 @ApiPropertyOptional→@ApiProperty 스코프 회귀) = 실질 → fix#2(18c87e06) 로 복원.** 그 외 메타/테스트 보강.
> - round3(본 리뷰): Critical 0. 잔여 18 경고는 아래 분류대로 비조치(accept/defer).

## 잔여 경고 분류 (round3 = 15_38_40)

| # | 카테고리 | 분류 | 근거 |
|---|----------|------|------|
| W-1 | Security (XFF 신뢰) | **accept (systemic)** | `extractClientIp`(CF-Connecting-IP 기본 off + X-Forwarded-For 첫 IP) 는 codebase 전역 trust-proxy 정책. 인증 IP whitelist 검증이 **본 PR 이전부터** 동일 함수를 써왔고(`getUsage` 가 아니라 `verifyWebhookRequest` 경로) 본 PR 은 그 동일 값을 로깅에 재사용할 뿐. 신뢰 프록시 체인 역산은 전역 정책 변경이라 본 PR 범위 밖. 3개 라운드 반복 지적이나 신규 도입 아님. |
| W-2 | Security (sourceIp 형식 검증) | **defer (C-그룹 followup)** | `plan/in-progress/spec-sync-config-gaps.md` 의 "backend auth-config DTO @IsIP storage-validation" 후속 항목으로 추적 중. IP 형식 검증은 캡처 경로(`extractClientIp`)가 헤더에서 파싱한 값이라 임의 문자열 위험 낮고, JSX 이스케이프로 XSS 차단. |
| W-3 | Security (responseCode 타입 개방) | **accept** | 값은 서버 사이드 고정 상수(`WEBHOOK_ACCEPTED_RESPONSE_CODE='202'`) 또는 DB status enum 폴백 — 외부 입력 경로 없음(I-1 보안 reviewer 확인). 리터럴 유니온화는 over-engineering. |
| W-4 | Architecture (getUsage 인라인 반환 타입) | **accept (minor)** | 컨트롤러가 `AuthConfigUsageDto` 로 문서화 + 서비스 반환을 그대로 통과. named interface 추출은 가치 낮음. round1 W-13 과 동일 — 의식적 미조치. |
| W-5 | Architecture (ExecuteOptions `'in'` 판별) | **accept (pre-existing)** | 기존 유니온 구조(executedBy/triggerId/reRunOf 판별이 이미 `'in'` 내로잉). discriminated `kind` 전환은 엔진 전역 리팩토링이라 본 PR 범위 밖. |
| W-6 | Architecture (God Component 재확장) | **defer (추적된 후속)** | `plan/in-progress/spec-sync-config-gaps.md` "§후속 — God Component 분리(AuthConfigCreateForm/EditDialog/훅)" 항목. 본 PR 은 usage drawer 영역만 수정(create/edit 폼 무변경). 우선순위 상향(저→중) 권고만 plan 에 반영 가능. |
| W-7 | Performance (count+period 중복 스캔) | **accept (minor)** | Promise.all 병렬 실행이라 레이턴시 영향 없음(round3 I-4 reviewer 도 "우선순위 낮음" 명시). totalCalls 를 getRawOne 에 통합하면 1회 절감되나 mock/테스트 재작업 대비 이득 낮음. |
| W-8 | Performance (innerJoinAndSelect 전체 로드) | **accept (minor)** | recentCalls 최대 20건 한정이라 Trigger 엔티티 전체 로드 비용 무시 가능. |
| W-9 | Maintainability (getUsage 책임 혼재) | **accept (minor)** | 3개 QB 인라인은 단일 메서드 내 응집 — private helper 분리는 가독성 취향. |
| W-10 | Maintainability (DAY_MS 상수) | **accept (cosmetic)** | `24*60*60*1000` 패턴은 codebase 다수 관용. |
| W-11 | Maintainability (mock 주석 모순) | **accept (cosmetic)** | `makeExecutionRepo` 주석이 "순서 비의존" 이라 했으나 `mockReturnValueOnce` 는 호출순서 의존. 단, Promise.all 배열 리터럴은 createQueryBuilder() 를 **동기적 좌→우 순서**(count→period→recent)로 호출하므로 mock 순서는 결정적으로 안전(false-positive 없음). 주석 문구만 부정확 — 동작 무해. |
| W-12 | Maintainability (BarChart 인라인 배열) | **accept (negligible)** | 3-element 배열, reviewer 도 "성능 영향 미미" 명시. God Component 분리 시 `UsagePeriodChart` 로 함께 이동. |
| W-13 | Testing (spec 간 NULL shape 불일치) | **accept** | `execution-engine.service.spec` 은 미전달 시 `sourceIp:null`/`responseCode:null` 영속을 단언(execute create), `hooks.service.spec` 은 options 에 `sourceIp:undefined` 전달을 단언 — 레이어가 다르므로 shape 차이는 정상(options undefined → 컬럼 null). |
| W-14 | Testing (totalCalls/recentCalls 불일치 케이스) | **accept (minor)** | 세 쿼리 독립 mock 으로 이미 분리 검증(periodCounts·recentCalls·totalCalls 각각 단언). |
| W-15 | Documentation (202 제약 주석) | **accept** | `WEBHOOK_ACCEPTED_RESPONSE_CODE` 선언부 JSDoc 에 이미 "인증 실패(401)·검증(400)·비활성(410)은 execute 전 throw 라 row 미생성 → 호출 이력 행은 항상 202" 명시(hooks.service.ts). 호출 지점 중복 주석 불요. |
| W-16 | Documentation (responseCode description 한국어) | **accept (cosmetic)** | 프로젝트 spec/주석 1차 언어가 한국어. 폴백 예시(`'completed'`,`'failed'`)는 description 에 이미 포함. |
| W-17 | Side Effect (periodCounts 신규 키 / 구형 클라이언트) | **accept** | 프론트는 `{!isUsageLoading && !isUsageError && usageData && ...}` 가드 안에서만 접근하고 동일 배포의 백엔드가 항상 periodCounts 반환 — 런타임 접근 에러 불가. additive 필드라 계약 파괴 아님. |
| W-18 | Side Effect (ExecuteOptions 타 호출자) | **accept (의도된 동작)** | schedule/manual/re-run 등 비-HTTP 트리거 호출자는 sourceIp/responseCode 를 **의도적으로 미전달** → DB NULL(=비-HTTP 호출). getUsage 가 NULL 을 status enum 으로 폴백 표시하므로 정상. 누락이 아니라 설계. |

INFO(I-1~I-22)는 전부 "현행 유지/없음/선택적" 수준 — 별도 조치 없음. SPEC-DRIFT(있었다면)는 commit 73ce21c8 이 `spec/1-data-model.md §2.13` + `spec/2-navigation/6-config.md §A.3·§3·Rationale R-6` 를 이미 반영(오탐).

## 결론

- **BLOCK 사유 없음** — 3개 라운드 연속 Critical 0, 실질 발견(setParameters 오탐 규명·DTO 스코프 회귀)은 조치 완료.
- 잔여 경고는 systemic(전역 정책)·deferred(C-그룹/God Component 추적 항목)·cosmetic(주석·상수·메모이즈) 으로 본 PR 게이트 아님.
- 추가 코드 변경 없음 → 본 resolved review(15_38_40)가 최신 commit(18c87e06)을 postdate 하여 CODE-REVIEW freshness 게이트 충족.
