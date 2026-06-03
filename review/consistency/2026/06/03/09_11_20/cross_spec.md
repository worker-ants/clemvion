# Cross-Spec 일관성 검토 결과

target: `plan/in-progress/spec-draft-conventions-code-data.md`
검토 기준: worktree `spec/` 내 최신 파일 상태 (변경 이미 적용됨)

---

## 발견사항

- **[INFO]** `0-overview.md §2.5` 참조 모호성
  - target 위치: draft 변경 항목 6 — "`0-overview.md §2.5` — code 출력 포트 수 1 → 2"
  - 충돌 대상: `/spec/0-overview.md` §2.5 (시스템 아키텍처 개요의 "Integration Service" 절)
  - 상세: draft 가 인용하는 "0-overview.md §2.5" 는 실제 변경된 파일인 `spec/4-nodes/0-overview.md §2.5` (Data 노드 2종 표)와 다르다. `spec/0-overview.md §2.5` 는 Integration Service 설명 절이어서, 이 참조를 그대로 따르면 잘못된 파일이 검색된다. 실제 파일의 `code` 행 출력 포트 수는 `1 → 2` 로 이미 수정돼 있고 (`spec/4-nodes/0-overview.md:181`), 모순은 없다 — plan 문서의 인용 경로 기술 오류다.
  - 제안: plan 문서의 해당 항목을 "**`spec/4-nodes/0-overview.md §2.5`** — code 출력 포트 수 1 → 2" 로 정정. spec 자체는 이미 올바르게 수정됨.

- **[INFO]** `id: common` 다중 정의 — 기존 INFO 잔여 항목
  - target 위치: draft "잔여" 섹션 마지막 — `id: common` 다중정의 INFO
  - 충돌 대상: `spec/4-nodes/1-logic/0-common.md`, `spec/4-nodes/2-flow/0-common.md`, `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/4-integration/0-common.md`, `spec/4-nodes/5-data/0-common.md`, `spec/4-nodes/7-trigger/0-common.md` — 6개 파일 모두 `id: common` 선언
  - 상세: 동일 `id` 값이 여러 파일에 선언돼 있으나, 현재 이 `id` 필드가 파일 간 unique key 로 enforced 되는 시스템은 없으므로 즉각 기능 오류는 없다. draft 가 이미 INFO 로 분류하고 "차후 정합 작업으로 분리" 한 항목 — 본 검토에서도 INFO 유지.
  - 제안: 차후 `id` 스코핑 규약 도입 시 (`<category>/<id>` 형식 등) 일괄 처리.

- **[INFO]** `spec/4-nodes/5-data/1-transform.md` `## Rationale` 섹션 부재
  - target 위치: draft "잔여" 섹션 — `1-transform.md Rationale 신설`
  - 충돌 대상: `spec/4-nodes/5-data/1-transform.md` (현재 Rationale 섹션 없음)
  - 상세: `2-code.md` 는 이번 draft 에서 Rationale 를 신설했으나 `1-transform.md` 는 Rationale 절 없음. `spec/0-overview.md §8` 문서 컨벤션은 "본문 끝에 `## Rationale` 섹션을 둘 수 있다" 로 권장이지 강제는 아니다. 기능 충돌 없음.
  - 제안: 차후 transform 관련 결정(output root 배치, pre-flight-only 에러 정책 등)을 `## Rationale` 로 문서화.

---

## 이번 draft 핵심 변경의 타 spec 충돌 여부 (결론)

**Principle 7 (`code.config.code` echo)**: `spec/conventions/node-output.md` Principle 7 "항상 echo" 목록에 `code (raw — 사용자 코드 본문, code.config.code)` 가 추가됐고, "절대 echo 금지" 목록에서 제거됐다. `spec/4-nodes/5-data/2-code.md §5.1` 및 `§Rationale` 과 완전 일치. `spec/4-nodes/5-data/0-common.md §4` (`code.code 필드는 보안 차원에서 echo하되`) 와도 일치. **충돌 없음**.

**Principle 8.2 (`output` root 직접 배치)**: `spec/conventions/node-output.md` Principle 8.2 표에서 "코드 실행 결과 → `output.result`" 행이 "output (root 직접) — Code/Transform 은 output.result 래핑 미적용" 으로 정정됐고, 주석에 LLM 계열 한정 규칙이 명기됐다. `spec/4-nodes/5-data/2-code.md §5.1` (`output: 42`, `output.ok`) 및 `§Rationale` 과 완전 일치. `spec/4-nodes/5-data/0-common.md §4` (`code: 사용자 코드의 return 값`) 과도 일치. **충돌 없음**.

**`meta.error?`/`meta.errorCode?` 제거**: `spec/conventions/node-output.md` Principle 2 Code 행에 `meta.error`/`meta.errorCode` 별칭은 Phase 1 D 에서 폐기됐음이 이미 기술돼 있다. `spec/4-nodes/5-data/0-common.md §4` 도 동일. **이미 정합, 충돌 없음**.

**Code 출력 포트 수 1 → 2**: `spec/4-nodes/0-overview.md §2.5` Data 노드 표의 `code` 행 출력 열이 `2` 로 표기됨. `spec/4-nodes/5-data/2-code.md §3.2` (`success` / `error` 2개 출력 포트) 와 일치. **충돌 없음**.

**`2-code.md` Rationale 신설**: 신규 섹션으로, 기존 어떤 spec 과도 모순되지 않는다.

---

## 요약

이번 draft(spec-draft-conventions-code-data)가 적용한 5건의 변경은 모두 **기존 구현·spec 본문과 conventions 메타문서 간 drift 정합화**로, 새로운 데이터 모델·API 계약·상태 전이·RBAC 구조를 도입하지 않는다. `spec/conventions/node-output.md`, `spec/4-nodes/5-data/2-code.md`, `spec/4-nodes/5-data/0-common.md`, `spec/4-nodes/0-overview.md` 네 파일 간 동일 사실에 대한 기술이 최종적으로 일치하며, 다른 영역 spec(데이터 모델, API 규약, RBAC 등)과 교차 모순도 없다. 발견된 사항은 plan 문서의 경로 기술 오류(INFO), `id: common` 다중정의(INFO, 기 인지 잔여), `1-transform.md` Rationale 부재(INFO, 기 인지 잔여) 3건으로 모두 INFO 등급이다.

---

## 위험도

NONE
