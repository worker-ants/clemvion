# RESOLUTION — config-call-history-929994 / 15_02_15

fix commit: `cb51723e`
원본 구현 commit: `73ce21c8`

> **주의**: fix commit(cb51723e)이 원래 ai-review(15_02_15)를 stale 하게 만든다.
> main 은 fresh `/ai-review --branch main` 을 한 번 더 실행해야 한다 (clean 이면 RESOLUTION 없이 통과).

---

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W-3 | 코드 (API Contract) | cb51723e | `AuthConfigUsageCallDto.sourceIp` → `@ApiProperty({ nullable: true })` + `string \| null` non-optional; `responseCode` description 에 enum 폴백 동작 명시 |
| W-4 | 코드 (Performance) | cb51723e | `getUsage` 3개 쿼리 `Promise.all` 병렬화 |
| W-5 | 코드 (Performance/DB) | cb51723e | V096 에 `idx_execution_trigger_started (trigger_id, started_at DESC WHERE trigger_id IS NOT NULL)` 추가; DOWN 에 DROP 추가 |
| W-9 | 코드 (Maintainability) | cb51723e | `handleChatChannelWebhook` 상단에 `const clientIp = extractClientIp(input.headers)` 추출, execute options 에서 재사용 — `handleWebhook` 패턴 통일 |
| W-10 | 코드 (API Contract) | cb51723e | W-3 와 동일 fix — `sourceIp` DTO non-optional 화 |
| W-11 | 코드 (Testing) | cb51723e | `makeExecutionRepo` QB mock 을 `countQb`/`periodQb`/`recentQb` 3개 독립 객체로 분리, `mockReturnValueOnce` 체인 구성 |
| W-12 | 코드 (Testing) | cb51723e | `hooks.service.spec` chat-channel 그룹에 `x-forwarded-for` 헤더 케이스 1건 추가 (`sourceIp: '203.0.113.42'` 단언) |
| I-2 | 코드 (Security/NaN) | cb51723e | `periodRaw` 파싱에 `safeCount` 헬퍼 (`isNaN(n) \|\| n < 0 ? 0 : n`) |
| I-10 | 코드 (Testing) | cb51723e | `trigger=undefined` orphan execution → `triggerName === 'Unknown'` 폴백 테스트 추가 |
| I-11 | 코드 (Testing) | cb51723e | `recentQb.limit(20)` 단언 추가 |
| I-13 | 코드 (Documentation) | cb51723e | `getUsage` 에 JSDoc 추가 (반환 shape, 롤링 윈도, NULL 폴백, Promise.all 근거) |

---

## 오탐 확인 (처리 없음)

| SUMMARY # | 오탐 근거 |
|-----------|-----------|
| I-3 [SPEC-DRIFT] | commit 73ce21c8 이 이미 `spec/1-data-model.md §2.13` 에 `source_ip`/`response_code` 컬럼 추가 + AuthConfig 호출 집계 경로 SoT 기록 완료 — diff 확인 |
| I-4 [SPEC-DRIFT] | commit 73ce21c8 이 이미 `spec/2-navigation/6-config.md §A.3` 표를 ✅ 승격, Planned 설명 제거, §3 API 응답 shape 기록, Rationale R-6 추가 완료 — diff 확인 |
| I-14 | I-3/I-4 와 동일 근거 — spec diff 가 commit 73ce21c8 에 포함됨 |

---

## 보류·후속 항목 (본 PR 범위 밖 / defer)

| SUMMARY # | 사유 | 추적 |
|-----------|------|------|
| W-1 | X-Forwarded-For 신뢰 정책 — `extractClientIp` 가 인증 IP whitelist 검증과 호출 이력 영속에 이미 공용으로 쓰이는 **기존 동작**. 신뢰 프록시 체인 검증은 codebase 전역 정책 변경이라 본 PR 범위 밖. 현재 동작 유지. | — |
| W-2 | `source_ip` IP 형식 검증 — C-그룹 followup `plan/in-progress/spec-sync-config-gaps.md` 에 별도 추적 중. `@IsIP` storage-validation 포함. | `plan/in-progress/spec-sync-config-gaps.md` |
| W-6 | `AuthConfigsService` → `Execution`/`Trigger` 직접 의존 — 기존 도메인 구조. 본 PR 이 도입한 신규 의존 아님. | 후속 리팩토링 항목 |
| W-7 | `ExecuteOptions` ISP 위반 (`triggerId` variant 에 HTTP 전용 필드 혼재) — 기존 구조. 본 PR 신규 도입 아님. | 후속 리팩토링 항목 |
| W-8 | `authentication/page.tsx` God Component BarChart 인라인 — God Component 분리 후속 작업 시 함께 이동. 기존 추적된 항목. | 후속 분리 항목 |
| W-13 | `getUsage` 반환 타입 인라인 리터럴 — JSDoc 추가(I-13)로 가독성 향상; named interface 분리는 저위험·저우선순위. | — |
| I-5 | `totalCalls`+`periodCounts` 단일 COUNT FILTER 통합 — 성능 개선 가능하나 W-4 Promise.all 로 3 왕복 병렬화가 완료돼 즉시 효과 미미. 후속 개선 검토. | — |
| I-6 | 프론트 BarChart `data` 배열 `useMemo` — 선택적 최적화. 후속. | — |
| I-7 | `response_code VARCHAR(10)` 길이 — status enum 폴백 저장 경로 없음 확인. 현재 위험 없음. | — |
| I-9 | 3쿼리 `now` 경쟁 조건 주석 — Promise.all 병렬화 후 `now` 고정이 더 중요해짐. 현 구조 유지 시 "not transactionally consistent" 주석 고려 가능 (후속). | — |
| I-12 | 프론트 BarChart `data` prop 단언 테스트 — 후속. | — |
| I-15 | Vitest zustand 스토어 afterEach 복원 — 파일 단위 격리로 현재 무해. 후속. | — |

---

## TEST 결과

- lint  : 통과
- unit  : 통과 (40 passed)
- e2e   : 통과 (191/191)
