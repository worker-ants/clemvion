# Convention Compliance Review

**검토 모드**: `--impl-prep`
**대상 scope**: 06-concurrency M-2 — ShutdownStateService `registerInFlight` early-return 제거 (Option A)
**검토 시각**: 2026-06-24

---

## 발견사항

### [INFO] 에러 코드 `SERVER_INTERRUPTED` — 규약 준수 확인

- target 위치: `shutdown-state.service.ts:184` (`error.code: 'SERVER_INTERRUPTED'`) + `spec/5-system/4-execution-engine.md §11.4`
- 위반 규약: `spec/conventions/error-codes.md §1`
- 상세: `SERVER_INTERRUPTED` 는 `UPPER_SNAKE_CASE` 이며 조건의 의미("서버가 shutdown 으로 인해 중단됨")를 기술한다. 도메인 prefix 없는 시스템 전역 공용 코드 패턴(`error-codes.md §1` "시스템 전역 공용 코드는 prefix 없이 쓰는 기존 범주")과 일치. 신규 도입 코드가 아니므로 rename 정책과도 무관. 규약 준수.
- 제안: 변경 불요.

### [INFO] `registerInFlight` 메서드 명명 — 규약 준수 확인

- target 위치: `shutdown-state.service.ts:105` (`registerInFlight`)
- 위반 규약: 명명 규약에 해당하는 직접 conventions 문서 없음 (백엔드 서비스 내부 메서드 식별자는 별도 spec/conventions 규약 미지정)
- 상세: camelCase 메서드명으로 TypeScript 관용 표기를 따른다. `spec/conventions/` 중 내부 서비스 메서드 명명에 특정 규약을 부과하는 문서는 없다. 규약 검토 범위 외.
- 제안: 변경 불요.

### [INFO] 구현 후 spec 갱신 불요 — plan 선언과 일치

- target 위치: `plan/in-progress/refactor/06-concurrency.md §M-2` ("spec 갱신: 불요")
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3.1` (implemented 전이 규칙)
- 상세: M-2 는 "spec 이 옳고 구현이 따라감" — `spec/5-system/4-execution-engine.md` 의 status 변경이 발생하지 않으므로 spec-impl-evidence 가드의 승격/갱신 의무가 없다. `4-execution-engine.md` frontmatter 의 `code:` 가 이미 shutdown-state.service.ts 를 커버하는 glob 을 포함하는지 확인 권장.
- 제안: 구현 PR 에서 `spec/5-system/4-execution-engine.md` frontmatter `code:` 가 shutdown-state.service.ts 경로를 커버하는지 확인. 누락 시 `code:` 항목 추가.

### [INFO] plan 완료 이동 시 `spec_impact` 선언 의무 (Gate C)

- target 위치: `plan/in-progress/refactor/06-concurrency.md` — 완료 이동 시
- 위반 규약: `spec/conventions/spec-impl-evidence.md §4.2` Gate C — `started ≥ 2026-06-04` plan 완료 시 `spec_impact` 선언 의무
- 상세: 06-concurrency 플랜은 `plan/complete/` 이동 시 `spec_impact` 선언이 필요하다. M-2 는 "spec 갱신 불요"이므로 `spec_impact: none` sentinel 로 선언하면 된다. 현시점(구현 착수 전)에서는 아직 이동 단계가 아니라 위반 아님.
- 제안: M-2 구현 완료 후 plan 완료 이동 시 `spec_impact: none` 을 frontmatter 에 명시.

### [INFO] Option B 거절 — spec §11.2 와 정합

- target 위치: plan M-2 "Option B 의도적 거절: BullMQ queue.pause()는 전역(Redis 플래그)"
- 위반 규약: 직접 conventions 위반 없음
- 상세: spec §11.2 는 "신규 job consume 중단" 을 명시하지만 메커니즘을 구분하지 않는다. @nestjs/bullmq WorkerHost 가 framework shutdown 시 worker close 로 §11.2 를 이미 충족한다는 plan 판단은 spec 과 일치하며 conventions 위반이 아니다.
- 제안: 변경 불요.

---

## 요약

M-2 구현 scope(Option A 채택: `registerInFlight` early-return 제거)는 `spec/conventions/` 의 정식 규약과 직접 충돌하는 항목이 없다. `SERVER_INTERRUPTED` 에러 코드는 `error-codes.md §1` 의 의미 기반 명명 원칙에 부합하며, spec 갱신 불요 선언은 `spec-impl-evidence.md` 의 lifecycle 가드와 정합한다. 사소한 후속 확인 사항은 (a) `spec/5-system/4-execution-engine.md` frontmatter `code:` 가 shutdown-state 경로를 커버하는지, (b) plan 완료 이동 시 `spec_impact: none` sentinel 선언이며 모두 INFO 수준이다.

---

## 위험도

NONE
