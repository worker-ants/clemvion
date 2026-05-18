# Code Review 통합 보고서

세션: `review/code/2026/05/18/23_11_13`
대상: `main..worktree-node-config-required-defaults-sweep` (4 commit, schema 메타 sweep + plan 신설 + 후속 fix)

## 전체 위험도

**MEDIUM** — `ui.required` / `ui.requiredWhen` 메타데이터 sweep 자체는 안전. 기능 의미 수준의 경고 3건 + 테스트 관련 경고 2건 존재.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 |
|---|---|---|---|
| W-1 | 요구사항 | `loop.count` 의 `default('1')` 로 인해 `loop:no-count` warningRule 이 dead rule. `ui.required: true` 와 의미 충돌 | `loop.schema.ts` |
| W-2 | 요구사항 | `send-email.to` 가 zod (배열 전용) ↔ `validateSendEmailConfig` (문자열도 허용) 비대칭. 단일 문자열 형태 `to` 데이터의 zod 파싱 실패 가능 | `send-email.schema.ts` |
| W-3 | 요구사항 | `switch.switchValue` 의 `requiredWhen: { notEquals: 'expression' }` 이 hidden 상태에서도 적용 가능성 | `switch.schema.ts` |
| W-4 | 테스트 | Logic 카테고리 5 노드 spec 의 warningRules fired/not-fired 회귀 테스트 부재 또는 확인 불가 | `foreach/map/split/loop/switch.schema.spec.ts` |
| W-5 | 테스트 | `send-email.schema.spec.ts` `it.each` 콜백이 `ruleId` 인자 미수신 → 두 source 연결이 테스트 이름에만 서술 | `send-email.schema.spec.ts` |

## 참고 (INFO) — 15건

- 보안: `disableFileAccess` 핸들러 실제 적용 (범위 밖), `isRecipientsLike` RFC 5321 미검증 (기존 로직), `requiredWhen.notEquals` frontend 처리 확인, `loop.breakCondition` 임의 표현식 허용 (기존 로직)
- 유지보수성: `VALID_OPERATIONS` / `VALID_OPS` 중복 선언, 테스트 패턴 혼재, `uiMeta` 시그니처 좁음
- 문서화: 주석 상세도 차이, `uiMeta` docstring 부재, `form.required` 동명 혼동, `requiredWhen.notEquals` plan 명시 누락, plan 분리, describe 위치, 파일 목적 주석

상세는 `RESOLUTION.md` 참고.

## 라우터 결정

- **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
- **제외**: performance, architecture, dependency, database, concurrency, api_contract (6명)

| 제외된 reviewer | 이유 |
|---|---|
| performance | 메타데이터 추가만, I/O / 반복문 변경 없음 |
| architecture | 기존 schema 내 메타 추가만, 모듈 경계 변경 없음 |
| dependency | package.json / lock 변경 없음 |
| database | DB 마이그레이션 / SQL 변경 없음 |
| concurrency | async / Promise / 큐 코드 변경 없음 |
| api_contract | HTTP route / Swagger 변경 없음 |

## 에이전트별 위험도

| reviewer | 위험도 | 핵심 |
|---|---|---|
| security | NONE | 기존 방어 영향 없음. INFO 6건 |
| requirement | MEDIUM | W-1 / W-2 / W-3 |
| scope | NONE | plan 의도와 완전 일치 |
| side_effect | LOW | 백엔드 파싱 영향 없음. `notEquals` frontend 처리 확인 (INFO) |
| maintainability | LOW | 중복 선언, 패턴 혼재 등 INFO 6건 |
| testing | LOW | W-4, W-5 + INFO 5건 |
| documentation | LOW | 주석 통일 등 INFO 7건 |

## 후속 처리

`RESOLUTION.md` 에서 W-1~W-5 분류 및 처리 결과 기록.
