# 정식 규약 준수 검토 결과

**대상**: `spec/5-system/4-execution-engine.md`
**검토 모드**: 구현 착수 전 (--impl-prep)
**검토일**: 2026-06-17

---

## 발견사항

### [INFO] 전역 Redis 키 3개가 §9.1 패턴 예외임을 본문에서 명시했으나 규약 문서가 없음

- target 위치: `spec/5-system/4-execution-engine.md §9.1·§9.2` — `exec:recover:lock`, `exec:cont:seq:<executionId>`, `exec:seq:<executionId>` 키
- 위반 규약: 직접 위반은 아님. 단, §9.1 에서 스스로 선언한 `{service}:{workspaceId}:{resource}:{id}:{sub}` 패턴에서 벗어나는 전역 키의 근거가 해당 절 footnote 에만 기록되어 있고, `spec/conventions/` 아래에 Redis 키 명명 규약 문서가 존재하지 않는다.
- 상세: 전역 키 3개가 worskspace-scoped 패턴에서 의도적으로 벗어나는 이유가 §9.1 footnote 에 산문으로 기술돼 있다. 이는 규약 문서(`spec/conventions/`)가 아닌 spec 본문 내에서 자체 해석되고 있어, 후속 개발자가 새 전역 키를 추가할 때 규약 근거를 찾기 어렵다.
- 제안: 현재 구조에서 즉각적인 수정 필요는 없다(INFO). 향후 Redis 키 패턴을 `spec/conventions/` 수준 정식 규약으로 승격할 때 §9.1·§9.2 내용을 이전하는 것을 고려한다.

---

### [INFO] `4.x` 절 번호가 정식 계층 번호 체계를 벗어남

- target 위치: `spec/5-system/4-execution-engine.md` 줄 422 — `### 4.x waiting_for_input park`
- 위반 규약: 명시적 conventions 문서에 절 번호 체계를 규정하는 항목은 없으나, CLAUDE.md 의 "문서 구조 규약"(Overview / 본문 / Rationale 3섹션 권장)과 일반적인 계층형 번호 관행상 `4.x` 는 정상 번호가 아니다.
- 상세: `§4.1` / `§4.2` / `§4.3` 뒤에 `§4.x` 가 등장한다. 이는 "태스크 큐 미도입 → `§4.4` 예정 자리" 를 나타내는 플레이스홀더 표기로 보이나, 참조 링크에서 `§4.x` 를 정확히 인용할 수 없어 cross-reference 가 불명확해진다. 다른 절이 이미 `§4.4` 이벤트 발행 sink (`§4.4`) 를 사용하므로 충돌 가능성도 있다.
- 제안: `§4.4 waiting_for_input park` 로 공식 번호를 부여하고, `§4.4` 이벤트 발행 sink 를 `§4.5` 로 renumber 하거나, park 절을 `§4.0` 또는 별도 annotation box 로 처리한다.

---

### [INFO] frontmatter `pending_plans` 경로 실존 여부 — 작업 착수 전 확인 필요

- target 위치: `spec/5-system/4-execution-engine.md` frontmatter, 줄 10–13
  ```yaml
  pending_plans:
    - plan/in-progress/execution-engine-residual-gaps.md
    - plan/in-progress/spec-sync-execution-engine-gaps.md
    - plan/in-progress/exec-intake-queue-impl.md
    - plan/in-progress/exec-park-durable-resume.md
  ```
- 위반 규약: `spec/conventions/spec-impl-evidence.md §4` 가드 — `spec-pending-plan-existence.test.ts` 는 `pending_plans:` 의 모든 path 가 `plan/in-progress/` 또는 `plan/complete/` 에 실존해야 한다고 강제한다.
- 상세: 이 spec 은 `status: partial` 이므로 `pending_plans:` 의무가 적용된다. 해당 plan 파일 중 일부가 구현 완료 후 `plan/complete/` 로 이동됐거나 파일명이 변경됐다면 build 가드가 이미 실패하고 있을 것이다. --impl-prep 검토 대상인 만큼, 착수 전 `spec-pending-plan-existence.test.ts` 를 실행해 현재 상태를 확인한다.
- 제안: `npm test --workspace frontend -- spec-pending-plan-existence` 실행 후 실패 plan 경로를 `plan/complete/` 참조로 갱신하거나, 완료된 항목은 제거한다. 통과 시에는 현 상태 유지.

---

### [WARNING] §7.5.2 에서 정의된 `EXECUTION_INTERNAL_ERROR` 코드가 `spec/conventions/error-codes.md` 에 미등재

- target 위치: `spec/5-system/4-execution-engine.md §7.5.2`, 줄 1017–1018·1024
- 위반 규약: `spec/conventions/error-codes.md §1` — "클라이언트에 노출되는 에러 코드는 의미 기반 명명 원칙을 따르며, 신규 client-safe 코드는 중앙 `ErrorCode` enum 의 기존 네임스페이스를 확장한다." §2 — "에러 코드 rename 은 breaking change, 처음부터 의미 정확한 이름을 부여해야 한다."
- 상세: `EXECUTION_INTERNAL_ERROR` 는 §7.5.2 본문에서 "generic fallback" 으로 도입됐고, `EXECUTION_MESSAGE_TOO_LONG` 도 동 절에서 정의된다. 두 코드 모두 `spec/conventions/error-codes.md §3`(historical-artifact 예외 레지스트리) 또는 본문 카탈로그 SoT 인 `spec/5-system/3-error-handling.md §1` 에 등재돼 있지 않다. 에러 코드 규약(`error-codes.md §1`)은 "프로젝트 전체의 에러 코드 문자열에 적용된다"고 명시하므로, spec 본문에서만 선언하고 conventions/error-codes 에 누락된 것은 단일 진실 원칙 위배다.
- 제안: `EXECUTION_INTERNAL_ERROR` 와 `EXECUTION_MESSAGE_TOO_LONG` 을 `spec/conventions/error-codes.md §3` 또는 SoT 인 `3-error-handling.md §1.4` 카탈로그에 등재한다. 단, `3-error-handling.md` 가 카탈로그 SoT 라면 `error-codes.md` 는 명명 규약만 소유하므로 `3-error-handling.md` 갱신으로 충분하다.

---

### [INFO] `§2.13` 참조 — 존재하지 않는 절 번호

- target 위치: `spec/5-system/4-execution-engine.md §7.1` 테이블, "attempts 소진 (terminal)" 행 — `(기존 코드 **유지·의미 재정의**: "절대 30분 stale" → "stalled 재배달 소진". §2.13 동기화)`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §4.2` 링크 무결성 가드 (`spec-link-integrity.test.ts`) — spec 내 in-repo 링크는 대상이 존재해야 한다. 단, `§2.13` 은 anchor 형식이 아니라 절 번호 언급이므로 링크 가드에 직접 걸리지는 않을 수 있다.
- 상세: `§2.13` 은 본 문서 어디에도 존재하지 않는다(최상위 §2 `그래프 순회` 의 하위 절은 §2.1~§2.3). 의도된 참조 대상을 특정할 수 없다.
- 제안: 잘못된 절 번호 참조를 올바른 절(`spec/conventions/error-codes.md §3` 의 `WORKER_HEARTBEAT_TIMEOUT` 항목)로 교체하거나, 참조를 삭제한다.

---

### [INFO] 문서 구조 — Overview / 본문 / Rationale 3섹션 모두 존재 (적합)

- 문서는 `## Overview`(줄 22), 본문 §1–§11, `## Rationale`(줄 1235) 의 권장 3섹션 구조를 준수한다. 이는 CLAUDE.md 의 명명 컨벤션 및 구조 권고를 따른 것이다.

---

### [INFO] frontmatter `id` 가 파일 basename 과 일치하지 않음

- target 위치: `spec/5-system/4-execution-engine.md` frontmatter 줄 2 — `id: execution-engine`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — "`id` 는 파일 basename(확장자 제외) 기반 권장". 파일 basename 은 `4-execution-engine` 이나 `id` 는 `execution-engine` 이다.
- 상세: `4-` prefix 를 제외한 형태이므로 basename 과 정확히 일치하지 않는다. 단, 동 규약은 "기반 권장(권고)" 이고 같은 영역 내 중복 충돌 방지용 언급이므로 basename 의 순서 prefix(`4-`) 를 제외하는 관행은 프로젝트 전반에서 광범위하게 사용되는 패턴으로 보인다. 가드(`spec-frontmatter.test.ts`)가 `id` 와 basename 의 일치를 강제하지 않는 한 실질 위반은 아니다.
- 제안: 현재 관행을 spec-impl-evidence §2.1 의 "권장" 표현에 맞춰 변경할 필요는 없다. 단, 동 규약이 `숫자-` prefix 제외를 명시적으로 허용하도록 규약 갱신을 고려할 수 있다(INFO 제안).

---

## 요약

`spec/5-system/4-execution-engine.md` 는 spec-impl-evidence 규약의 frontmatter 필수 필드(`id`, `status`, `code:`, `pending_plans:`)를 모두 갖추고 있으며, Overview / 본문 / Rationale 3섹션 구조도 준수한다. audit-actions, error-codes, spec-impl-evidence 등 핵심 conventions 와의 명시적 충돌은 없다. 다만 §7.5.2 에서 새로 도입된 `EXECUTION_INTERNAL_ERROR` · `EXECUTION_MESSAGE_TOO_LONG` 에러 코드가 `spec/conventions/error-codes.md` 또는 `3-error-handling.md §1.4` 카탈로그에 등재되지 않은 점(WARNING), `§2.13` 존재하지 않는 절 번호 참조(INFO), `§4.x` 플레이스홀더 절 번호(INFO)가 확인된다. 구현 착수를 차단하는 CRITICAL 위반은 없으나, WARNING 사항인 에러 코드 미등재는 향후 클라이언트 계약 단일 진실을 위해 보완이 권고된다.

## 위험도

LOW
