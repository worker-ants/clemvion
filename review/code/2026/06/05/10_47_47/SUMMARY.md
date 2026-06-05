# Code Review 통합 보고서 — PR-A2a `_resumeCheckpoint` schemaVersion + 재구성 견고화

## 전체 위험도
**LOW** — 기능 결함 없음. Critical 발견사항 없음. 경고 3건(테스트 견고성 2건 + CHANGELOG 누락 1건) 이 전부.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성 | `CheckpointSubject` 타입이 `describe` 블록 안에 중첩 정의되어 재사용 불가 | `execution-engine.service.spec.ts` L66–84 | 파일 최상위 스코프로 끌어올려 재사용성 확보 |
| 2 | 유지보수성 / 테스트 | `RESUME_INCOMPATIBLE_STATE` 통합 테스트에서 `waitForAiConversation` 를 `try/finally` 수동 monkey-patch 후 복원 — `jest.spyOn` 미사용으로 복원 누락 시 후속 테스트에 side-effect 위험 | `execution-engine.service.spec.ts` L196–224 | `jest.spyOn(svcAny, 'waitForAiConversation').mockResolvedValue(undefined)` + `spy.mockRestore()` 로 교체 |
| 3 | 문서화 | CHANGELOG.md `Unreleased` 섹션에 PR-A2a 항목 없음 — 롤링 배포 중 `RESUME_INCOMPATIBLE_STATE` 동작 변화를 운영팀이 인지하기 어려움 | `CHANGELOG.md` | `## Unreleased` 에 "execution-engine: `_resumeCheckpoint` 에 `schemaVersion`(=1) 추가, 롤링 배포 중 구 인스턴스 graceful `RESUME_INCOMPATIBLE_STATE` 종결, 기존 row backward-compatible" 항목 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `...resumeFields` spread 로 DB JSONB 의 모든 필드가 `resumeState` 에 전달됨 — allow-list 미적용(deny-list/strip 방식) | `execution-engine.service.ts` `buildRetryReentryState` | 장기적으로 명시 필드 열거(allow-list) 또는 checkpoint 로드 시 스키마 검증 단계 도입 권장 |
| 2 | 보안 | 에러 메시지에 `ckptVersion` / `CHECKPOINT_SCHEMA_VERSION` 값 포함 — 채널 어댑터 변환 누락 시 내부 정보 노출 가능 | `execution-engine.service.ts` `RehydrationError` 생성자 | 채널 어댑터 `error.code === 'RESUME_INCOMPATIBLE_STATE'` 분기에서 원본 메시지 사용자 미노출 확인 |
| 3 | 요구사항 / 테스트 | `RESUME_INCOMPATIBLE_STATE` 통합 테스트에서 spec §7.5 표 요구 "동반 NodeExecution `failed` 마킹" 미검증 (`mockNodeExecutionRepo.createQueryBuilder` 호출 여부 미확인) | `execution-engine.service.spec.ts` L200–226 | `expect(mockNodeExecutionRepo.createQueryBuilder).toHaveBeenCalled()` 추가 |
| 4 | 요구사항 / 테스트 | `RESUME_INCOMPATIBLE_STATE` 통합 테스트의 error.code 검증이 QueryBuilder mock 체인(`set?.mock?.calls`) 의존 — mock 구조 변경 시 false-pass 위험. `expect(codes.length).toBeGreaterThan(0)` 사전 가드 없음 | `execution-engine.service.spec.ts` L200–226 | `expect(codes.length).toBeGreaterThan(0)` 가드를 `toContain` 이전에 추가 |
| 5 | 유지보수성 | 상수 선언 `CHECKPOINT_SCHEMA_VERSION` 뒤 빈 줄 없이 `clampNodeErrorMessage` 함수가 이어져 기존 파일 패턴과 불일치 | `execution-engine.service.ts` L255 인근 | 상수 선언 블록 뒤 빈 줄 1개 추가 |
| 6 | 유지보수성 | 숫자 필드 방어적 기본값 패턴(`typeof resumeFields.X === 'number' ? resumeFields.X : 0`)이 5개 필드에 인라인 반복 | `execution-engine.service.ts` `buildRetryReentryState` | `coerceNumber(v, def=0)` 헬퍼 추출 또는 배열+reduce 로 통일 |
| 7 | 유지보수성 | 버전 가드 2단 중첩 조건문(`isAiConversation && resumeCheckpoint` → `typeof ckptVersion === 'number' && ckptVersion > ...`) | `execution-engine.service.ts` L1630 인근 | 향후 가드 확장 대비 early-return guard 패턴으로 정리 권장 |
| 8 | 테스트 | `buildResumeCheckpoint` stamp 테스트가 `totalInputTokens`, `totalOutputTokens`, `totalThinkingTokens`, `toolCalls` pass-through 미검증 | `execution-engine.service.spec.ts` L87–97 | 나머지 핵심 필드 assertion 또는 extra key 없음 assertion 추가 |
| 9 | 테스트 | `buildRetryReentryState` retry 모드(non-resumeMode) 경로 미테스트 | `execution-engine.service.spec.ts` L103–145 | `opts` 생략 + 완전한 `_retryState` 전달 시 원본 값 유지 단언 추가 |
| 10 | 테스트 | 경계값 `schemaVersion === 1`(현재 버전과 동일) 정상 통과 케이스 미테스트 | `execution-engine.service.spec.ts` 전체 추가 블록 | `schemaVersion: 1` checkpoint 가 `RESUME_INCOMPATIBLE_STATE` 를 발생시키지 않는 케이스 추가 |
| 11 | 테스트 | `buildResumeCheckpoint(undefined)` 외 `null` 등 다른 falsy/non-object 입력 미테스트 | `execution-engine.service.spec.ts` L99–101 | `null` 입력에 대해 `toBeUndefined()` 단언 추가 |
| 12 | 문서화 | plan 파일의 A2a 체크박스가 미완료(`[ ]`) 상태로 추정됨 | `plan/in-progress/exec-park-durable-resume.md` | plan lifecycle 정책에 따라 A2a 체크박스 `[x]` + 완료 날짜 기록 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `...resumeFields` allow-list 미적용(장기 주의), 에러 메시지 내부 정보 포함(채널 어댑터 변환 보장 조건부 수용) |
| requirement | LOW | spec §7.5 NodeExecution failed 마킹 미검증, 통합 테스트 사전 가드 부재 |
| scope | NONE | 변경 범위 커밋 목적과 정확히 수렴. 무관 수정 없음 |
| side_effect | N/A | 출력 파일 부재 — 재시도 필요 |
| maintainability | LOW | CheckpointSubject 스코프(WARNING), monkey-patch 패턴(WARNING), 소규모 일관성 이슈 다수 |
| testing | LOW | 경계값·retry 모드·필드 pass-through 미검증 등 선택적 보강 권고 |
| documentation | LOW | CHANGELOG 항목 누락(WARNING), plan 체크박스 미업데이트(INFO), 코드 문서화 자체는 양호 |

## 발견 없는 에이전트

- **scope**: NONE 등급 — 범위 이탈 없음, 무관 수정 없음

## 권장 조치사항

1. **[WARNING #2] `jest.spyOn` 교체** — `waitForAiConversation` monkey-patch 를 `jest.spyOn(...).mockResolvedValue(undefined)` + `spy.mockRestore()` 로 교체해 후속 테스트 격리 보장 (`execution-engine.service.spec.ts` L196–224).
2. **[WARNING #1] `CheckpointSubject` 타입 스코프 승격** — 최상위 스코프로 끌어올려 미래 checkpoint 관련 테스트 재사용 가능하게 (`execution-engine.service.spec.ts` L66–84).
3. **[WARNING #3] CHANGELOG 항목 추가** — `## Unreleased` 에 `_resumeCheckpoint` schemaVersion 도입 및 롤링 배포 영향 명시.
4. **[INFO #3] NodeExecution failed 마킹 검증 추가** — `RESUME_INCOMPATIBLE_STATE` 통합 테스트에 `mockNodeExecutionRepo.createQueryBuilder` 호출 여부 assertion 추가해 spec §7.5 표 완전 충족.
5. **[INFO #4] 사전 가드 추가** — `expect(codes.length).toBeGreaterThan(0)` 을 `toContain` 이전에 삽입해 false-pass 방지.
6. **[INFO #10] 경계값 테스트 추가** — `schemaVersion: 1` 정상 통과 케이스 추가.
7. **[INFO #1] allow-list 장기 개선** — `resumeFields` spread 를 명시 필드 열거로 전환 또는 checkpoint 로드 시 스키마 검증 단계 도입 (단기 긴급도 낮음).
8. **[INFO #12] plan 체크박스 업데이트** — A2a 완료 시 plan lifecycle 정책에 따라 `[x]` 전환 및 날짜 기록.

---

## 라우터 결정

라우터 사용 (`routing=done`):

- **실행 (forced by router_safety)**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명 — 전체 forced)
- **강제 포함(router_safety)**: security, requirement, scope, side_effect, maintainability, testing, documentation (전체)

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | router 선별 제외 |
| architecture | router 선별 제외 |
| dependency | router 선별 제외 |
| database | router 선별 제외 |
| concurrency | router 선별 제외 |
| api_contract | router 선별 제외 |
| user_guide_sync | router 선별 제외 |

---

*재시도 필요: 1건 — `side_effect` (output_file 부재: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/review/code/2026/06/05/10_47_47/side_effect.md`)*