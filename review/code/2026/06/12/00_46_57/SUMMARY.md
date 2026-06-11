# Code Review 통합 보고서

## 전체 위험도
**LOW** — 기능 결함 없음. SPEC-DRIFT 1건(spec 갱신 필요), 테스트 커버리지 경미한 미비 2건, 코드 스타일 경미한 이슈 2건.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `AuditLogDto.action` open-ended 처리 계약(레거시 값 존재 가능, enum 단정 금지)이 API 문서에 추가됐으나 spec/5-system/1-auth.md §4.1 에 반영되지 않음 | `audit-log-response.dto.ts` L291-301 | 코드 유지 + spec/5-system/1-auth.md §4.1 또는 §4.2 에 "DB 는 자유 문자열 컬럼이며 레거시 값이 존재할 수 있으므로 클라이언트는 enum 으로 단정하지 말 것" 추가 |
| 2 | Testing | `integrations.service.spec.ts` `update` describe 에서 빈 body(`{}`) 호출 시 `save` 가 여전히 실행됨이 테스트로 드러나지 않음 (불필요한 DB 쓰기, 성능 이슈) | `integrations.service.spec.ts` 신규 `update` describe | 불필요한 save 최적화 여부 테스트 추가 고려 (spec 미요구, 기능 버그 아님) |
| 3 | Testing | `integrations.service.spec.ts` `update` describe 에서 `integrationRepo.save` mock 구현이 `name: 'Renamed'` 반영 보장 여부 불명확 — 가독성 저하 | `integrations.service.spec.ts` 신규 `describe('update', ...)` | `save` mock 을 `jest.fn().mockImplementation((entity) => Promise.resolve(entity))` 로 명시해 가독성 향상 |
| 4 | Maintainability | `auth-configs.service.ts` 에 `import * as crypto` 와 `import { randomBytes } from 'crypto'` 이중 import 혼재 | `auth-configs.service.ts` L1-12 | 한 방식으로 통일. 현재 변경 범위 밖이므로 별도 이슈로 추적 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 테스트 fixture 평문 자격증명이 Secret 스캐닝 false positive 유발 가능. 실질 위험 없음 | `auth-configs.service.spec.ts` 전체 | `// test-only` 주석 또는 `TEST_` 접두사 |
| 2 | Security | `constantTimeEquals` 길이 다르면 즉시 false — 이론적 길이 오라클. 실질 위험 낮음 | `auth-configs.service.ts` | 현행 유지 가능 |
| 3 | Security | `req.ip` trust proxy 미설정 시 `undefined` 전파 | `auth-configs.controller.spec.ts` | 프로덕션 `trust proxy` 확인 |
| 4 | Security | 읽기 엔드포인트 `@Roles` 미적용 — 의도된 설계 | `auth-configs.controller.spec.ts` | 마스킹 일관성 주기 검토 |
| 5 | Requirement | OAuth reauthorize `begin()` 위임만·audit 미기록 — spec §14.3 미명문화 | `integrations.service.ts` | spec §14.3 분기 명문화 권장 |
| 6 | Requirement | `USAGE_RECENT_CALLS_LIMIT = 20` — spec 에 반환 건수 미정의 | `auth-configs.service.ts` | 필요 시 spec 명시 |
| 7 | Testing | swallow 테스트에서 `ipAddress` 분기 미검증 | `audit-logs.spec.ts` | ipAddress 유/무 케이스 분리 |
| 8 | Testing | swallow 테스트 `details: entry.details ?? {}` 기본값 미검증 | `audit-logs.spec.ts` | `details: {}` 단언 추가 |
| 9 | Testing | `{ ip: undefined } as Request` 캐스팅 — `as unknown as Request` 가 명시적 | `auth-configs.controller.spec.ts` | 캐스팅 변경 |
| 10 | Testing | `transferOwnership` 실패 케이스 audit 미기록 검증 없음 | `workspaces.service.spec.ts` | 실패 케이스 not-called 단언 |
| 11 | Maintainability | `@ApiProperty.description` `+` 문자열 연결 — 스타일 불일치 | `audit-log-response.dto.ts` | template literal 통일 |
| 12 | Side Effect | `update` 파라미터 순서 확인 권장 | `integrations.service.spec.ts` | 구현 파일 확인 — 불일치 시 테스트가 즉각 검출 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 보안 취약점 없음. HMAC 화이트리스트·constant-time 비교·IP 화이트리스트 fail-closed 등 긍정적 패턴 |
| requirement | LOW | SPEC-DRIFT 1건(action open-ended 계약 spec 미반영), OAuth reauthorize audit 분기 미명문화 |
| scope | N/A | output_file(`scope.md`) 디스크 미존재 — 결과 반영 불가 |
| side_effect | NONE | 공개 API 시그니처·전역 상태·이벤트 계약 변경 없음 |
| maintainability | LOW | `crypto` 이중 import(pre-existing), `@ApiProperty` 문자열 연결 스타일 |
| testing | LOW | swallow 테스트 ipAddress/details 분기, update mock 가독성, transferOwnership 실패 audit |

## 발견 없는 에이전트

- **security**: Critical/Warning 없음 (INFO 6건, 인지된 트레이드오프/긍정 패턴)
- **side_effect**: Critical/Warning 없음 (INFO 5건, 부작용 없음)

## 권장 조치사항

1. **[SPEC-DRIFT]** `spec/5-system/1-auth.md §4.1` 에 action 자유 문자열·레거시 값 캐비엇 추가 — **developer 권한 밖(spec read-only), project-planner 별건**.
2. **[선택적]** `crypto` 이중 import 통일 — **pre-existing, 본 PR 범위 밖**.
3. **[선택적]** swallow 테스트 ipAddress/details 분기 케이스 — INFO 수준.
4. **[선택적]** `transferOwnership` 실패 케이스 audit 미호출 단언 — INFO 수준.
5. **[선택적]** spec §14.3 OAuth reauthorize 분기 명문화 — project-planner 별건.

## 라우터 결정

라우터가 선별 실행함.

- **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing` (6명, 전원 router_safety 강제 포함)
- **제외**: `performance`, `architecture`, `documentation`, `dependency`, `database`, `concurrency`, `api_contract`, `user_guide_sync` (8명)

> 비고: `scope` reviewer 의 output_file(`scope.md`)이 디스크에 존재하지 않아 해당 에이전트 결과를 통합하지 못했습니다.

---

## 종결 판정 (라운드 2)

라운드 1 의 Critical 0 / Warning 8 → 5건 수정·3건 근거 기각 후 본 라운드 2 는
**Critical 0 / Warning 4**. 4건 전부 신규 회귀가 아니라:

- **W1 (SPEC-DRIFT)**: developer 권한 밖(spec read-only) — project-planner 별건.
- **W2**: pre-existing `update()` always-save 동작(본 PR 미변경) 재지적, "기능 버그 아님" 자인.
- **W3**: `integrationRepo.save` 글로벌 mock 이 이미 `mockImplementation((entity) => Promise.resolve(entity))` 라 충족됨 — moot.
- **W4**: pre-existing `crypto` 이중 import(본 PR 미도입), 리뷰어도 "범위 밖 별도 추적" 명시.

남은 항목이 모두 범위 밖/pre-existing/moot 이고 위험도 LOW·Critical 0 이므로
리뷰 루프를 종결한다. 처분 상세: `RESOLUTION.md`.
