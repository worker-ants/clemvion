# RESOLUTION — ③ model-config polish 코드 리뷰 조치

리뷰 SUMMARY: `review/code/2026/06/27/17_23_53/SUMMARY.md` (risk LOW, Critical 0, Warning 3).
모든 조치는 단일 resolution 커밋(`refactor(llm,config): ai-review 조치 …`)에 포함.

## 조치 항목

| SUMMARY # | 분류 | 조치 | 위치 |
|---|---|---|---|
| W-1 | FIX | `INVITATION_THROTTLE` const 선언을 모든 import 이후로 이동 (llm controller 패턴과 일치) | `workspaces.controller.ts` |
| W-3 | FIX | spy 복원을 `try/finally` 로 감싸 assertion 실패 시에도 `mockRestore` 보장 | `list-models-cap.spec.ts` |
| W-2 | 수용(미수정) | `previewModels` local-provider SSRF 면제는 **pre-existing 의도적 설계**(spec §5.5 기재, 테스트 intentional). 본 PR 이 도입하지 않음. 인프라 egress 방화벽 위임 — 별 트랙 | `llm-preview.service.ts` |
| I-1 | FIX (SPEC) | api-convention §7 에 초대 발송/재발송 10/min 행 추가 + 공통 `SENSITIVE_ACTION_THROTTLE` 명시. 표 범위 note "하위 2행→3행" 갱신 | `spec/5-system/2-api-convention.md §7` |
| I-2 | FIX (SPEC) | 6-config §3 `preview-models` 행에 cap 500 보강 (`:id/models` 와 대칭) | `spec/2-navigation/6-config.md §3` |
| I-3 | FIX | probe 3 핸들러에 `@ApiTooManyRequestsResponse({ description: '요청 빈도 초과 (분당 10회)' })` 추가 | `llm-model-config.controller.ts` |
| I-7 | FIX | `SENSITIVE_ACTION_THROTTLE` 에 `as const` 추가 (불변성 명시) | `common/constants/throttle.ts` |
| I-9 | FIX | cap spec 빈 배열 케이스를 `toBe`(참조 동일) 로 통일 | `list-models-cap.spec.ts` |
| I-13 | FIX | `capModelList` JSDoc 에 `@param`/`@returns` 추가 | `list-models-cap.ts` |
| I-17 | FIX | `7-llm-client.md` frontmatter `code:` 에 `list-models-cap.ts` 등록 (spec-impl-evidence 커버) | `spec/5-system/7-llm-client.md` |

## 보류·후속 항목

| SUMMARY # | 사유 |
|---|---|
| I-4 (throttle IP 한계) | `UserThrottlerGuard` 는 이미 인증 시 `user:<sub>` 키 — 인증 probe 는 사용자당 집계. 미인증 IP 로테이션은 기존 구조 한계, 별 트랙 |
| I-5 (DNS rebinding 2차) | spec §5.5 기재 잔존 갭, 인프라 egress 위임 — 범위 외 |
| I-6 (ModelTypeFilter↔ModelInfo 타입 단언) | 단언을 `model-type.ts`(model-config)에 두면 model-config→llm 역방향 type-import 발생(아키텍처 비대칭). optional INFO 라 미적용 |
| I-8 (cap 이하 원본 참조 반환) | 기존 listModels 캐시 패턴과 동일, in-place mutate 경로 없음. 우선순위 낮음 |
| I-10/I-11/I-12/I-14 (추가 테스트/JSDoc) | 상수값·throttle 교체·캐시히트 cap 은 기존 unit/e2e 로 간접 커버. 사전 갭 JSDoc 은 tech-debt |
| I-15 (silent truncation 미관측) | 사용자 결정(B) — `truncated` body 플래그는 응답 shape breaking 이라 의도적 silent 선택 |
| I-16 (`ModelListDto` swagger 불일치) | 사전 인지 이슈, wire shape(bare array) 정정은 응답 계약 변경 수반 — 별 PR |

## TEST 결과

resolution 조치 후 TEST WORKFLOW 전체 재수행:

- lint: 통과 (`_test_logs/lint-20260627-174357.log`)
- unit: 통과 — backend 378 suites / frontend 전체 (`_test_logs/unit-20260627-174453.log`)
- build: 통과 (`_test_logs/build-20260627-174555.log`)
- e2e: 통과 — 215 tests (`_test_logs/e2e-20260627-174750.log`)
