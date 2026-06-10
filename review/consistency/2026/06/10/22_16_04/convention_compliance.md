# Convention Compliance Review

**Target**: `plan/in-progress/spec-draft-health-probe-status.md` (embedded in prompt payload; file does not yet exist on disk)
**Mode**: spec draft (--spec)
**Date**: 2026-06-10

---

## 발견사항

### [CRITICAL] `plan/in-progress/spec-draft-health-probe-status.md` 가 디스크에 존재하지 않음

- target 위치: 문서 전체 — 파일 경로 `plan/in-progress/spec-draft-health-probe-status.md`
- 위반 규약: `CLAUDE.md §정보 저장 위치` — "진행 중 작업: `plan/in-progress/<name>.md`"; `plan-lifecycle §1` — "새 plan 은 항상 `plan/in-progress/` 에서 생성"
- 상세: 검토 시점에 해당 파일이 디스크에 존재하지 않는다. 본 리뷰는 prompt payload 안에 인라인으로 삽입된 내용을 대상으로 수행된다. draft 가 파일로 저장되지 않은 채 일관성 검토가 호출되면, 이후 단계(project-planner 워크플로 §5 spec 반영)에서 draft 를 기준으로 spec 을 적용할 SoT 파일이 없어 invariant 가 깨진다. `plan-frontmatter.test.ts` 빌드 가드도 파일 존재를 전제로 동작한다.
- 제안: 검토 이전에 또는 검토 직후 즉시 `plan/in-progress/spec-draft-health-probe-status.md` 로 저장한다.

---

### [WARNING] `spec/data-flow/9-observability.md` 가 frontmatter(`id`/`status`) 부재 — 적용 범위 밖이지만 SoT 지목 문서에 대한 한계 명기 권장

- target 위치: `## 영향받는 문서 > spec/data-flow/9-observability.md (substantive — SoT)` (lines 88–101), `## 후속 > 수동 감사 노트` (lines 141–143)
- 위반 규약: `spec/conventions/spec-impl-evidence.md §1` 적용 대상 목록 (`spec/data-flow/**` 미포함)
- 상세: draft 자신이 §후속 체크리스트 "수동 감사 노트"에 `9-observability.md` 가 `spec-impl-evidence` 가드 범위 밖임을 올바르게 기술하고 있다. 규약 위반은 아니나, SoT 로 지목된 문서가 빌드 가드 밖에 있으면 spec-impl 갭이 자동으로 탐지되지 않는다. draft 가 이를 인지하고 있으므로 현재 draft 는 규약 내에서 허용된다.
- 제안: spec 적용 시 Rationale 에 이 한계를 유지·기록한다. 장기적으로 `spec/data-flow/**` 를 `spec-impl-evidence.md §1` 적용 범위에 추가하거나, 현 수동 감사 방침을 유지하는 결정을 명문화한다.

---

### [WARNING] `spec/5-system/16-system-status-api.md` cross-ref 추가 후 `spec-link-integrity.test.ts` anchor 정합 확인 필요

- target 위치: `## 영향받는 문서 > spec/5-system/16-system-status-api.md` (lines 110–113)
- 위반 규약: `spec/conventions/spec-impl-evidence.md §4.2` — `spec-link-integrity.test.ts` 가 `spec/**.md` 내 in-repo 링크 타깃 존재 + `#anchor` heading slug 실존 검증
- 상세: draft 가 제안한 `"HTTP status code 및 liveness/readiness probe 역할 분리는 9-observability.md §1.1 참조"` cross-ref 를 추가할 경우, `spec-link-integrity.test.ts` 가 해당 anchor(`#1-1-health-check` 등 실제 slug)의 heading 실존을 검증한다. spec 적용 전 상태에서는 `9-observability.md §1.1` heading 이 아직 없으므로, spec 적용 순서(9-observability.md 먼저 수정 → 16-system-status-api.md cross-ref 추가)가 맞지 않으면 빌드 가드가 실패한다.
- 제안: spec 적용 시 `9-observability.md §1.1` heading 을 먼저 확정하고, `16-system-status-api.md` 의 cross-ref anchor 가 실제 heading slug 와 일치하는지 확인한다.

---

### [INFO] plan 문서 내 변경 항목 식별자(`HP-C-1` ~ `HP-C-4`) 명명은 규약에 정의된 패턴 외

- target 위치: `## 변경 요지` 섹션 (lines 58–84)
- 위반 규약: 명시적으로 금지한 패턴 없음. `spec/conventions/` 에 plan draft 내 change ID 명명 규약이 없다.
- 상세: `HP-C-1` 식 식별자는 이 draft 가 spec 에 반영될 때 plan 문서 내부에만 남고 spec 자체에는 들어가지 않으므로 직접적 규약 위반이 아니다. 사소한 형식 일관성 사항.
- 제안: 수정 불필요.

---

### [INFO] `spec/5-system/3-error-handling.md` 정정 후 frontmatter `status` 검토

- target 위치: `## 영향받는 문서 > spec/5-system/3-error-handling.md` (lines 102–108)
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` 라이프사이클 — `implemented` spec 본문 정정 시 status 재분류 필요 여부
- 상세: `3-error-handling.md` 는 현재 `status: implemented` 이다. §7.2 `참고` Note 의 "liveness probe 용" 진술을 정정하는 것은 기존 구현 범위 내의 명확화(오진술 수정)이므로 status 를 `partial` 로 강등할 필요가 없다. `code:` glob 에 `codebase/backend/src/modules/health/**/*.ts` 가 이미 포함되어 있어 새 `/api/health/live` 컨트롤러도 동일 glob 에 매치된다. 위반 없음 — 확인 사항으로 기록.
- 제안: spec 적용 시 `3-error-handling.md` frontmatter 가 `status: implemented` + 기존 `code:` glob 유지로 충분한지 확인한다. 새 endpoint 가 glob 범위 내에 들어오면 변경 불필요.

---

## 요약

`plan/in-progress/spec-draft-health-probe-status.md` draft 는 전반적으로 정식 규약을 준수한다. plan frontmatter 필수 3필드(`worktree`·`started`·`owner`)가 모두 존재하고, 문서 구조(배경/변경 요지/영향받는 문서/Rationale/후속)가 project-planner SKILL 권장 3섹션 틀에 부합한다. 명명 규약·출력 포맷 규약·API 문서 규약 관련 직접 위반은 없다. 가장 중요한 문제는 draft 파일이 아직 디스크에 저장되지 않아 프로젝트 워크플로의 파일 기반 SoT invariant 가 충족되지 않는다는 점(CRITICAL)이다. 나머지는 spec 적용 시 점검이 필요한 링크 anchor 정합(WARNING)과 `9-observability.md` 가드 범위 밖 한계에 대한 인지(WARNING — draft 자신이 이미 기록)다.

## 위험도

MEDIUM
