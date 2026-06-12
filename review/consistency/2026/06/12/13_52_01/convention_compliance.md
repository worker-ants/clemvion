# 정식 규약 준수 검토 결과

**검토 대상**: `spec/4-nodes/5-data/` (0-common.md, 1-transform.md, 2-code.md)
**검토 모드**: 구현 완료 후 검토 (--impl-done, diff-base=origin/main)
**검토일**: 2026-06-12

---

## 발견사항

### INFO-1: `spec/4-nodes/5-data/0-common.md` — `## Rationale` 섹션 부재
- **target 위치**: `spec/4-nodes/5-data/0-common.md` 전체 (섹션 없음)
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"
- **상세**: `0-common.md` 는 § 1~5 본문만 있고 Rationale 섹션이 없다. `1-transform.md` 와 `2-code.md` 는 모두 Rationale 섹션을 갖고 있다. 단, `0-common.md` 는 다른 두 문서의 공통 규약 요약 역할이라 독립적인 설계 결정이 적고, 두 노드 문서가 Rationale 를 직접 보유하므로 영향 범위가 제한적이다.
- **제안**: 경미한 형식 불일치이므로 `0-common.md` 에 `## Rationale` 절을 추가하거나, 또는 `_product-overview.md` 수준의 공통 소개 문서임을 frontmatter 나 도입 설명에 명시해 3섹션 권장이 적용되지 않는 문서임을 표시.

---

### INFO-2: `spec/4-nodes/5-data/1-transform.md` — `## Rationale` 섹션 부재
- **target 위치**: `spec/4-nodes/5-data/1-transform.md` 전체 (## Rationale 절 없음)
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"
- **상세**: `2-code.md` 와 달리 `1-transform.md` 에는 `## Rationale` 섹션이 없다. transform 노드의 설계 결정(runtime 에러 포트 없음, 모든 에러 pre-flight throw, no-op 정책, object_omit 차단 등)에 대한 근거가 문서 내 인라인 주석이나 parenthetical 로 흩어져 있다. 하지만 이는 공식 규약 섹션 대신 인라인 설명으로 대체된 상태다.
- **제안**: `## Rationale` 섹션을 추가하고 핵심 설계 결정(runtime 에러 포트 미설치 이유, no-op vs throw 분리 정책, ReDoS 방지 200자 제한 근거 등)을 이관. 단 인라인 설명이 충분히 상세하고 규약 위반으로 볼 수 없으므로 INFO 등급 처리.

---

### INFO-3: `code.handler.ts` — `resolveMemoryLimitMb` 내보내기가 `@internal` JSDoc 로만 표시
- **target 위치**: `codebase/backend/src/nodes/data/code/code.handler.ts`, `resolveMemoryLimitMb` 함수 선언부
- **위반 규약**: 직접 위반 규약 없음. `spec/conventions/swagger.md` §1 패턴 참고 — API surface 에 노출되는 식별자는 역할 명확화 권장
- **상세**: `resolveMemoryLimitMb` 는 `export function` 으로 선언됐으나 JSDoc `@internal Exported only for unit testing` 으로 표시됐다. TypeScript 레벨에서 내부 전용임을 강제하는 수단(module boundary 패턴, `@internal` 타입 strip 등)이 없으므로 외부 소비자에게 public API 로 노출될 수 있다.
- **제안**: 사소한 형식 문제이며 현재 규약에서 직접 금지하지 않으므로 INFO 유지. 테스트 접근성을 위한 내보내기라면 현재 패턴이 프로젝트 내 관례에 부합하는지 확인.

---

### INFO-4: diff 내 `backend-labels.ts` 변경 — `CODE_MEMORY_LIMIT` 에러 메시지에서 하드코딩 `128MB` 제거
- **target 위치**: `codebase/frontend/src/lib/i18n/backend-labels.ts:1428`
- **위반 규약**: 직접 위반 규약 없음 (변경이 규약에 *부합*하는 사례임)
- **상세**: 이번 diff 에서 `"코드 실행 중 메모리 한도(128MB)를 초과했어요."` → `"코드 실행 중 메모리 한도를 초과했어요."` 로 수정됐다. 이는 `spec/4-nodes/5-data/2-code.md §7.2` 의 env-tunable 정책 변경과 일치하며, 고정된 용량 수치를 메시지에 박지 않는 올바른 방향이다. 규약 위반이 아니라 규약에 부합하는 변경임을 확인.

---

### INFO-5: `appstore-orders.md` 응답 파라미터 표 — `order` 필드 설명 오류 (Cafe24 카탈로그, diff 비대상)
- **target 위치**: `spec/conventions/cafe24-api-catalog/application/appstore-orders.md`, `order` 행 `설명` 컬럼
- **위반 규약**: `spec/conventions/cafe24-api-catalog/_overview.md §7.3` — "추측·날조로 field·샘플을 채우지 않는다"
- **상세**: `order` 응답 wrapper 행의 설명이 `"정렬 순서 asc : 순차정렬 · desc : 역순 정렬"` 로 기재돼 있다. 이는 `(응답 객체)` 로 기재해야 하는 wrapper 필드에 `order` 파라미터(정렬 순서)의 설명이 잘못 복사된 것으로 보인다. `application/apps.md` 의 동일 위치는 올바르게 `(응답 객체)` 로 돼 있다. 단 이 파일은 이번 diff 대상이 아니며 기존 데이터 오류다. `_overview.md §7.2` 에서 wrapper 는 `(응답 객체)` 로 표기해야 한다고 명시한다.
- **제안**: `appstore-orders.md` 의 두 `order` wrapper 행(`GET ...` 과 `POST ...` 모두) 설명을 `(응답 객체)` 로 정정. 이번 구현 diff 와 무관하므로 별도 follow-up 으로 처리해도 됨.

---

## 요약

`spec/4-nodes/5-data/` 영역의 세 문서(`0-common.md`, `1-transform.md`, `2-code.md`)와 이번 코드 diff 는 정식 규약(`spec/conventions/`)을 전반적으로 잘 준수하고 있다. Frontmatter (`id`/`status`/`code:`) 는 모두 적절히 선언됐고, 5필드 invariant(Principle 0), `output.error` 표준 봉투(Principle 3.2), `UPPER_SNAKE_CASE` 에러 코드 명명(error-codes.md §1), `config` echo 원칙(Principle 7), `output` root 직접 배치(Principle 8.2 Code 예외), `meta` 필드 구성(Principle 2) 모두 규약과 일치한다. `2-code.md` Rationale 섹션에서 `CODE_MEMORY_LIMIT` 정규화 매핑 SoT 를 `conventions/error-codes.md §4` 로 명시 참조하고, `CODE_NODE_MEMORY_LIMIT_MB` env-tunable 변경이 error-codes.md §4 표와 일치하게 갱신된 점도 확인됐다. 발견된 사항은 모두 INFO 등급으로 CRITICAL/WARNING 위반은 없다. `1-transform.md` 의 Rationale 섹션 부재와 `0-common.md` 의 동일 누락이 가장 눈에 띄는 개선 포인트이나, 설계 근거가 인라인 설명으로 존재해 실질적 정보 손실은 없다.

## 위험도

NONE
