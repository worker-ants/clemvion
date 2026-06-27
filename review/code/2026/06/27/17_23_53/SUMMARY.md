# Code Review 통합 보고서

리뷰 범위: `268ef02a4..HEAD` (③ model-config polish, 14 files). Router 선별 10 reviewer 실행 (performance·dependency·database·concurrency skip — 무관).

## 전체 위험도
**LOW** — 신규 취약점 없음. Critical 0건, Warning 3건(import 순서·SSRF 설계 트레이드오프·spy 복원 누락). 모두 기능 정확성에 영향 없는 코드 품질/테스트 격리 수준.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W-1 | 유지보수성 | `const INVITATION_THROTTLE = SENSITIVE_ACTION_THROTTLE;` 가 import 블록 중간에 삽입 — `llm-model-config.controller.ts`(모든 import 후 배치)와 불일치 | `workspaces.controller.ts` | const 선언을 모든 import 이후로 이동 |
| W-2 | 보안/설계 트레이드오프 | `previewModels` SSRF 검증이 `provider !== 'local'` 에서만 실행 — local provider 로 사설 IP baseUrl 지정 가능 (insider). **의도적·spec §5.5 기재·테스트 intentional** | `llm-preview.service.ts` | 인프라 egress 방화벽 위임 (본 PR 범위 외) |
| W-3 | 테스트 격리 | `list-models-cap.spec.ts` "logs a warning..." 의 `warn.mockRestore()` 가 assertion 실패 시 미실행 → spy 누수 | `list-models-cap.spec.ts` | `afterEach`/`try-finally` 로 복원 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 처리 |
|---|----------|----------|------|
| I-1 | SPEC-DRIFT | `SENSITIVE_ACTION_THROTTLE` JSDoc 이 §7 을 SoT 로 지정하나 §7 에 초대/sensitive-action tier 행 없음 | FIX (§7 행 추가) |
| I-2 | SPEC-DRIFT | 6-config §3 `:id/models` 엔 cap 500 기재됐으나 `preview-models` 행 누락 (동일 capModelList) | FIX (preview 행 보강) |
| I-3 | API 문서화 | probe 3 핸들러에 `@ApiTooManyRequestsResponse` 누락 (초대 엔드포인트엔 있음) | FIX |
| I-6 | 아키텍처 | `ModelTypeFilter extends ModelInfo['type']` 타입 단언으로 정합 강제 가능 | FIX (1줄) |
| I-7 | 부작용 | `SENSITIVE_ACTION_THROTTLE` `as const` 부재 | FIX |
| I-9 | 테스트 | 빈 배열 케이스 `toEqual` vs 다른 케이스 `toBe` 혼재 | FIX |
| I-13 | 문서화 | `capModelList` JSDoc `@param`/`@returns` 부재 | FIX |
| I-17 | User Guide Sync | `7-llm-client.md` 본문이 `list-models-cap.ts` 명시하나 frontmatter `code:` 미등록 | FIX |
| I-4 | 보안 | throttle IP 기반 한계 (IP 로테이션) — 기존 구조 동일 | 별 트랙 |
| I-5 | 보안 | DNS rebinding 2차 — spec §5.5 기재 잔존 갭, 인프라 위임 | 범위 외 |
| I-8 | 부작용 | `capModelList` 상한 이하 시 원본 참조 반환 — 기존 패턴 동일, mutate 경로 없음 | 보류 |
| I-10/I-11/I-12 | 테스트 | 상수값·throttle 교체·캐시히트 cap 직접 테스트 부재 | 보류 (e2e/단위 커버) |
| I-14 | 문서화 | 공개 메서드 JSDoc 사전 갭 | tech-debt |
| I-15 | API 계약 | silent truncation 미관측 — 인지·수용된 트레이드오프(사용자 결정 B) | 수용 |
| I-16 | API 계약 | `ModelListDto` swagger 가 wire shape(bare array)와 불일치 — 사전 인지, 본 PR 범위 외 | 별 트랙 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | local SSRF 면제(의도적) W-2; DNS rebinding 인프라 위임 |
| architecture | LOW | import 사이 const W-1; model-type.ts 위치 적합 |
| requirement | LOW | 기능 충족; SPEC-DRIFT 2건(코드 fix 불필요) |
| scope | NONE | 14파일 전부 계획 4항목 1:1 대응 |
| side_effect | LOW | 공유 객체 참조·원본 배열 반환 — 실질 위험 없음 |
| maintainability | LOW | const/import 순서 W-1; assertion 스타일 혼재 |
| testing | LOW | mockRestore 격리 W-3; 일부 직접 테스트 부재(INFO) |
| documentation | LOW | JSDoc 태그 부재; spec 비대칭(SPEC-DRIFT 중복) |
| api_contract | LOW | @ApiTooManyRequestsResponse 누락; silent truncation(인지됨) |
| user_guide_sync | LOW | `7-llm-client.md` code: 글로브에 list-models-cap.ts 미등록 |

## 권장 조치사항

1. **[W-1]** `workspaces.controller.ts` const 를 import 이후로 이동.
2. **[W-3]** spec 의 spy 복원을 `afterEach` 로.
3. **[W-2]** 수용 — pre-existing·spec §5.5 기재·인프라 위임. 본 PR 미수정.
4. **[SPEC-DRIFT I-1·I-2]** §7 sensitive-action tier 행 + 6-config preview-models cap 보강.
5. **[INFO cheap]** I-3·I-6·I-7·I-9·I-13·I-17 반영.

→ 처리 결과·재테스트: `RESOLUTION.md` 참조.
