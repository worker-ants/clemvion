# Cross-Spec 일관성 검토 — button-cap-spec-validator plan

**검토 대상**: `plan/in-progress/button-cap-spec-validator.md`
**검토 모드**: `--plan`
**검토 일시**: 2026-05-19

---

### 발견사항

- **[INFO]** 완료 항목과 스펙 실제 상태의 일치 확인
  - target 위치: plan §작업 항목 (체크된 항목 전체)
  - 충돌 대상: `spec/4-nodes/6-presentation/0-common.md §1.1`, `1-carousel.md` L22·24·35·417·432, `2-table.md` L353, `_product-overview.md` ND-CL-08
  - 상세: plan 이 "[x]" 로 표기한 spec 수정 사항이 실제 파일에 모두 반영되어 있음. `0-common.md §1.1` "노드당 최대 **5개**" 명시, carousel.md 전체 cap 5, table.md "5개 초과" 표기, ND-CL-08 "최대 5개/아이템" — 모두 일치.
  - 제안: 별도 조치 불필요.

- **[INFO]** backend 상수·validator 상태 일치 확인
  - target 위치: plan §현 cap 인벤토리
  - 충돌 대상: `codebase/backend/src/nodes/presentation/_shared/button.types.ts`, `carousel.schema.ts`
  - 상세: `MAX_BUTTONS_PER_NODE = 5` 상수가 존재하고 `validateButtons` 및 `validateCarouselItemButtons` 모두 동일 상수를 참조함. frontend `button-list-editor.tsx` `maxButtons = 5` default 도 일치. 4-layer SSOT 정렬 완료 상태.
  - 제안: 별도 조치 불필요.

- **[INFO]** 병행 plan(`loop-count-policy`, `node-config-required-defaults-sweep`)과 수정 파일 비중복 확인
  - target 위치: plan §관련 문서 §병행 PR
  - 충돌 대상: `plan/in-progress/loop-count-policy.md`, `plan/in-progress/node-config-required-defaults-sweep.md`
  - 상세: `loop-count-policy` 는 `spec/4-nodes/1-logic/3-loop.md` 를 수정하며 presentation 파일은 건드리지 않음. `node-config-required-defaults-sweep` 워크트리(`node-config-required-defaults-sweep`)는 현재 디렉토리 목록에 없어 이미 머지되었거나 별 파일 경합이 없음. presentation 파일(`0-common.md`, `1-carousel.md`, `2-table.md`, `_product-overview.md`)을 두 병행 plan 이 동시 수정하는 충돌은 없음.
  - 제안: 별도 조치 불필요.

- **[INFO]** chart.md · template.md 의 버튼 cap 명시 부재
  - target 위치: plan §작업 항목 (chart/template 미언급)
  - 충돌 대상: `spec/4-nodes/6-presentation/3-chart.md`, `spec/4-nodes/6-presentation/5-template.md`
  - 상세: chart.md·template.md 의 `buttons` 필드 설명에 "최대 5개" 숫자를 명시하지 않고 `0-common.md §1` 에 위임한다. 이는 의도적 설계이며 spec 에서 `0-common.md §1.1` 이 SSOT 로 선언되어 있어 모순이 없음. 단, 차후 carousel.md 처럼 inline 명시가 필요하다는 요청이 생길 수 있다.
  - 제안: 현 상태 유지 가능. 명확성을 원하면 chart.md L22 (`buttons` 행)·template.md L20 (`buttons` 행)에 "(최대 5개 — [공통 §1.1](./0-common.md#11-유효성-검증))" 를 추가하는 minor sync 고려.

- **[INFO]** `0-common.md` Rationale 가 "노드당 10개" 를 선행값으로 언급 (역사 기록)
  - target 위치: `spec/4-nodes/6-presentation/0-common.md §Rationale` + §9 CHANGELOG
  - 충돌 대상: 없음 (역사 서술)
  - 상세: Rationale 에서 "종전: 노드당 10개" 표현은 변경 배경 서술이므로 모순이 아님. 현행 규칙은 §1.1 의 "노드당 최대 5개" 가 단일 진실이다.
  - 제안: 별도 조치 불필요.

---

### 요약

plan `button-cap-spec-validator.md` 의 완료 항목([x])이 정의하는 변경 사항은 실제 `spec/**` 및 `codebase/**` 에 모두 반영되어 있다. `spec/4-nodes/6-presentation/0-common.md §1.1` ("노드당 최대 5개"), carousel.md 전체 cap 5 표기, table.md "5개 초과", ND-CL-08 "최대 5개/아이템", backend `MAX_BUTTONS_PER_NODE = 5` SSOT, frontend `maxButtons = 5` default — 6개 포인트가 모두 정합하며 다른 spec 영역(데이터 모델, 실행 엔진, 워크플로우 에디터, conventions/node-output.md, RBAC, API 계약, 상태 전이)과 충돌하는 부분이 없다. 병행 plan(`loop-count-policy`, `node-config-required-defaults-sweep`, `send-email-to-array-only`)과 수정 파일 경합도 없다. 미완료 항목(`[ ] consistency-check 재실행`, `[ ] tests + lint + typecheck`, `[ ] /ai-review`, `[ ] PR + merge`, `[ ] git mv`)은 plan 운영 절차 범주이며 spec 충돌과 무관하다.

---

### 위험도

NONE
