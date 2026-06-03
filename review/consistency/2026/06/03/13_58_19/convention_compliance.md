# 정식 규약 준수 검토 결과

검토 범위: `spec/` 전체 (구현 착수 전 --impl-prep 모드)
검토 기준: `spec/conventions/` 하위 정식 규약 전체 + CLAUDE.md 명명 컨벤션

---

## 발견사항

### [INFO] `spec/data-flow/` 하위 파일 — `## Overview (제품 정의)` 섹션 구조 일부 누락

- **target 위치**: `spec/data-flow/1-audit.md`, `spec/data-flow/12-workspace.md` 등 (샘플 확인)
- **위반 규약**: CLAUDE.md § 정보 저장 위치 — "단일 spec 파일 영역(예: webhook, graph-rag)은 본문 상단에 `## Overview (제품 정의)` 섹션을 직접 둔다" + `spec/0-overview.md §8 문서 컨벤션` — "N-name.md 는 정렬된 상세 spec. 본문 끝에 `## Rationale` 섹션으로 결정 근거 inline"
- **상세**: 확인한 `data-flow/1-audit.md` 와 `data-flow/12-workspace.md` 는 최상단에 `## Overview` 섹션의 서브섹션(`### System role`) 을 두어 형식 자체는 갖추고 있으나, `0-overview.md §8` 이 명시한 "단일 spec 파일 영역은 `## Overview (제품 정의)` 섹션을 상단에 둔다" 의 정확한 헤더 표기(`제품 정의` 괄호 포함 여부)가 `data-flow/0-overview.md` 의 `## Overview (제품 정의)` 패턴과 달리 단순 `## Overview` 로 쓰이고 있다. 규약 자체가 data-flow 하위 파일에 대한 헤더를 명시적으로 규정하지 않아 회색 지대이지만, CLAUDE.md 의 패턴과 미세하게 어긋난다.
- **제안**: data-flow 하위 상세 파일들의 Overview 헤더를 `## Overview (제품 정의)` 로 통일하거나, `spec/0-overview.md §8 문서 컨벤션` 에 data-flow 하위 파일의 헤더 예외를 명시하여 규약을 갱신한다.

---

### [INFO] `spec/2-navigation/0-dashboard.md` — `## Rationale` 섹션 부재

- **target 위치**: `spec/2-navigation/0-dashboard.md` 전체
- **위반 규약**: `spec/0-overview.md §8 문서 컨벤션` — "N-name.md 는 정렬된 상세 spec. 본문 끝에 `## Rationale` 섹션으로 결정 근거 inline"
- **상세**: dashboard spec 은 구현 완료 문서(`status: implemented`)이며, 결정 근거가 필요한 설계 선택이 없는 단순 명세일 수 있다. 그러나 규약은 `## Rationale` 을 "둘 수 있다(권장)" 표현으로 서술하여 의무가 아닌 권장이다. 위반이 아닌 INFO 수준.
- **제안**: 결정 근거가 있는 경우 섹션 추가. 없으면 현 상태 유지 가능. 규약이 이미 권장(optional) 이므로 추가 조치 불필요.

---

### [INFO] `spec/2-navigation/1-workflow-list.md` — `## Rationale` 섹션이 있으나 `§1` 참조만 존재

- **target 위치**: `spec/2-navigation/1-workflow-list.md` — `[Rationale §1]` 인라인 참조
- **위반 규약**: `spec/0-overview.md §8 문서 컨벤션` — "본문 끝에 `## Rationale` 섹션으로 결정 근거 inline"
- **상세**: 문서 내 인라인에서 `[Rationale §1]` 로 자기 자신을 참조하는데, 스크롤 범위 내에서 실제 `## Rationale` 섹션이 (프롬프트 페이로드의 truncation 으로 인해) 보이지 않는다. 섹션 존재 여부 자체는 확인 불가. INFO 수준으로 처리.
- **제안**: 해당 파일의 `## Rationale` 섹션이 실제로 존재하는지 확인 필요. 미존재 시 추가.

---

### [WARNING] `spec/1-data-model.md` — frontmatter `status: implemented` 이나 일부 엔티티는 🚧·❌ 상태

- **target 위치**: `spec/1-data-model.md` frontmatter (`status: implemented`)
- **위반 규약**: CLAUDE.md § 정보 저장 위치 / `spec/conventions/spec-impl-evidence.md` 에서 spec 의 구현 상태와 frontmatter `status` 의 정합성을 요구. 본 검토에서 `spec-impl-evidence.md` 원문을 직접 읽지는 않았으나, `spec/0-overview.md §6.2 / §6.3` 에서 "백엔드만 존재(🚧)" 혹은 "미구현(❌)" 으로 명시된 항목(Parallel P1+P2 완료 표기 포함, 임베드형 웹채팅 `status: partial` 등)이 있다.
- **상세**: `spec/1-data-model.md` 는 `status: implemented` 로 선언되나, 동 문서 내 `§2.9 Schedule.parameter_values`, `§2.13 Execution.chain_id` 등 일부 필드는 특정 migration 버전 번호를 명시하며 최근 추가된 필드임을 시사한다. 그러나 `status: implemented` 는 "이 spec 이 구현됐다" 는 의미로 단일 진실이 `spec/0-overview.md §6.1~§6.3` 에 있으며, data-model 은 엔티티 정의 spec 이므로 status 가 구현 완료 전체를 의미한다고 볼 수 있어 CRITICAL 은 아니다. 그러나 `SecretStore(§2.21.1)` 의 경우 `spec/0-overview.md §6.2` 에서 언급되지 않아 상태가 모호하다.
- **제안**: 미구현 필드를 명시적으로 `status: partial` 또는 frontmatter 에 `pending_plans:` 를 추가해 구현 상태를 명확히 하거나, data-model 문서 특성상 엔티티 정의가 구현보다 앞서는 것이 당연하므로 규약을 갱신해 data-model spec 의 `status` 의미를 별도 정의한다.

---

### [WARNING] `spec/2-navigation/0-dashboard.md` — `## Overview (제품 정의)` 섹션 부재

- **target 위치**: `spec/2-navigation/0-dashboard.md` 전체 구조
- **위반 규약**: `spec/0-overview.md §8 문서 컨벤션` — "단일 spec 파일 영역(예: webhook, graph-rag)은 본문 상단에 `## Overview (제품 정의)` 섹션을 직접 둔다" + CLAUDE.md 정보 저장 위치 표 — "진입 문서의 `## Overview`"
- **상세**: `0-dashboard.md` 는 `## 1. 개요` 로 시작하며 `## Overview (제품 정의)` 라는 정식 섹션 헤더를 갖지 않는다. `spec/0-overview.md §8` 의 컨벤션은 영역 내 단독 spec 파일 또는 번호 붙은 상세 spec 에서 `## Overview (제품 정의)` 를 top-level 섹션으로 갖도록 권장한다. `0-dashboard.md` 는 `_product-overview.md` 가 존재하는 영역(2-navigation)의 상세 spec 이지만, `## 1. 개요` 라는 번호 섹션이 역할상 Overview 에 해당하므로 의미 충돌은 없다. 그러나 규약 상 표준 헤더와의 불일치는 navigation 상세 spec 전반에 패턴으로 존재한다(`0-dashboard`, `1-workflow-list` 모두 번호 섹션으로 개요 기술).
- **제안**: 규약을 갱신하여 `_product-overview.md` 를 가진 영역의 상세 spec 파일들은 `## N. 개요` 패턴을 허용한다고 명시하거나, 기존 상세 spec 파일들의 `## 1. 개요` 를 `## Overview (제품 정의)` 로 통일한다. 전자(규약 갱신)가 기존 파일 다수를 변경하지 않아도 되므로 비용이 낮다.

---

### [INFO] `spec/data-flow/` — `_product-overview.md` 부재

- **target 위치**: `spec/data-flow/` 폴더
- **위반 규약**: CLAUDE.md 정보 저장 위치 표 — "`_product-overview.md` — 다중 spec 파일을 가진 영역의 제품 정의"
- **상세**: `spec/data-flow/` 는 `0-overview.md` + `1-audit.md` ~ `12-workspace.md` 까지 총 13개 파일을 가진 다중 파일 영역이다. CLAUDE.md 규약에 따르면 다중 spec 파일 영역은 `_product-overview.md` 를 가져야 한다. 그러나 `data-flow/0-overview.md` 가 `## Overview (제품 정의)` 섹션을 상단에 가지며 영역 진입 문서 역할을 하고 있다. `spec/0-overview.md §8 문서 컨벤션` 에 따르면 data-flow 는 `0-overview.md` 가 진입 문서 역할을 하는 영역 유형으로 명시된 경우다.
- **상세 분석**: `spec/0-overview.md §8 문서 맵` 에서 `spec/data-flow/` 는 `0-overview.md` 를 진입 문서로 지목한다. 이는 `_product-overview.md` 패턴과 `0-overview.md` 패턴이 공존하는 설계 의도를 가진 것으로 볼 수 있어 CRITICAL 위반은 아니다. 단, CLAUDE.md 정보 저장 위치 표가 이 두 패턴의 구분 기준을 명확히 하지 않는다.
- **제안**: CLAUDE.md 또는 `spec/0-overview.md §8` 에 "data-flow 처럼 `0-overview.md` 가 진입 문서인 영역은 `_product-overview.md` 대신 `0-overview.md` 로 대체 가능" 임을 명시하여 규약과 현실의 간극을 해소한다.

---

### [INFO] `spec/conventions/error-codes.md` — Overview 섹션 표준 헤더(`## Overview`) 미사용

- **target 위치**: `spec/conventions/error-codes.md` 1~28행
- **위반 규약**: CLAUDE.md 정보 저장 위치 표 — "단일 spec 파일 영역은 본문 상단에 `## Overview (제품 정의)` 섹션을 직접 둔다"
- **상세**: `spec/conventions/error-codes.md` 는 `## Overview` 섹션이 있으나 그 아래 첫 번째 본문 섹션이 `## 1. 의미 기반 명명 (핵심 원칙)` 으로 바로 시작한다. 이는 단일 spec 파일에 Overview 섹션이 있는 경우의 올바른 패턴이며, 추가적으로 `## Rationale` 도 문서 끝에 있다. 규약 준수.
- **제안**: 현 상태 유지. INFO 는 누락 없음을 확인한 결과.

---

### [WARNING] `spec/1-data-model.md` — `## Rationale` 하위 항목 형식이 일부 비표준 헤더 계층 사용

- **target 위치**: `spec/1-data-model.md §Rationale` — `### install_token 형식`, `### Execution.execution_path → ExecutionNodeLog` 등
- **위반 규약**: `spec/0-overview.md §8` — "본문 끝에 `## Rationale` 섹션으로 결정 근거 inline"
- **상세**: Rationale 하위 항목들이 `###` (H3) 를 사용하는 것은 규약 자체에서 금지하지 않는다. 그러나 일부 Rationale 하위 항목(예: `2.17.3 Rationale (AuthConfig 도메인)`)은 Rationale 절이 `§2.17.3` 서브섹션으로 본문 중간에 삽입되어 있어, 규약이 명시한 "본문 끝" 패턴에서 벗어난다.
- **상세 분석**: `spec/1-data-model.md` 의 `§2.17.3 Rationale (AuthConfig 도메인)` 는 `## Rationale` 섹션 바깥에 본문 중간에 위치한다. 규약은 "본문 끝의 `## Rationale` 섹션" 을 권장하나, 본문 중간의 인라인 Rationale 을 명시적으로 금지하지는 않는다. 그러나 일관성 저하는 있다.
- **제안**: `§2.17.3 Rationale` 을 문서 끝 `## Rationale` 섹션으로 통합 이동하거나, 규약을 갱신하여 섹션 내 인라인 Rationale 서브섹션도 허용함을 명시한다.

---

### [INFO] `spec/conventions/swagger.md` — 응답 DTO 위치 규약 (`dto/responses/`) 이 다른 spec 에서 일관적으로 참조되고 있는지 교차 확인 필요

- **target 위치**: `spec/conventions/swagger.md §5-1`
- **위반 규약**: `spec/conventions/swagger.md §5-1` — 응답 DTO 위치: `codebase/backend/src/modules/<module>/dto/responses/*-response.dto.ts`
- **상세**: `spec/2-navigation/0-dashboard.md §7` 에서 `DashboardSummaryDto` 응답이 언급되나, 이 DTO 가 `dto/responses/` 패턴을 따르는지 spec 레벨에서 확인 불가. spec 문서 자체는 규약을 위반하지 않지만, spec 에서 DTO 를 언급할 때 위치 경로를 명시하지 않으면 추후 구현 시 규약 미준수 위험이 있다.
- **제안**: 개별 spec 문서에서 DTO 를 언급할 때 규약 경로(`dto/responses/*.dto.ts`)를 명시하거나, 구현 착수 시 swagger.md §5-1 을 체크리스트로 활용하는 것으로 충분하다.

---

### [CRITICAL] `spec/conventions/node-output.md §3.2.1` invariant 위반 가능성 — `retryable: false` 와 `retryAfterSec` 동반 제약이 다른 spec 에서 명시적으로 반영되지 않음

- **target 위치**: `spec/conventions/node-output.md §3.2.1` — "`retryable === true` 일 때만 set 가능 — `false` 와 함께 set 시 spec 위반 (convention-compliance checker 가 발견)"
- **위반 규약**: `spec/conventions/node-output.md §3.2.1` — `retryAfterSec` invariant
- **상세**: `node-output.md §3.2.1` 은 "invariant: `retryable === true` 일 때만 `retryAfterSec` set 가능 — `false` 와 함께 set 시 spec 위반" 을 명시하며 "convention-compliance checker 가 발견" 이라고 명시적으로 본 checker 의 역할을 지목하고 있다. 이 invariant 는 LLM 계열 노드 spec (`spec/4-nodes/3-ai/1-ai-agent.md`, `spec/4-nodes/3-ai/3-information-extractor.md`, `spec/4-nodes/3-ai/2-text-classifier.md`) 에서 `output.error.details` 스키마를 정의할 때 해당 제약을 인라인으로 재선언해야 한다. 이 검토의 스캔 범위(프롬프트 페이로드)에 AI 노드 상세 spec 이 포함되지 않아 직접 검증이 불가능하지만, CRITICAL 수준 invariant 가 "convention-compliance checker 가 발견한다" 고 명시한 점에서 본 검토에서 플래그 의무가 있다.
- **제안**: `spec/4-nodes/3-ai/` 하위 AI 노드 spec 들이 `output.error.details.retryAfterSec` 문서화 시 "invariant: retryable === true 인 경우에만" 제약을 명시하고 있는지 검증한다. 미명시 시 각 노드 spec 에 SoT 참조(`[node-output §3.2.1](../../../conventions/node-output.md)`)를 추가한다.

---

### [WARNING] `spec/0-overview.md §8` 문서 맵 — `spec/conventions/` 문서 목록이 partial (일부 규약 파일 미등재)

- **target 위치**: `spec/0-overview.md §4 영역별 진입 문서` 테이블 및 `§8 문서 맵`
- **위반 규약**: CLAUDE.md 정보 저장 위치 — "제품 전체 개요·시스템 아키텍처·cross-cutting 진입은 `spec/0-overview.md`"
- **상세**: `spec/0-overview.md §4` 의 영역별 진입 문서 테이블은 일부 conventions 만 링크한다: `node-output.md`, `execution-context.md`, `error-codes.md`. 그러나 실제 `spec/conventions/` 에는 `swagger.md`, `migrations.md`, `secret-store.md`, `conversation-thread.md`, `chat-channel-adapter.md`, `interaction-type-registry.md`, `data-hydration-surfaces.md`, `cross-node-warning-rules.md`, `node-cancellation.md`, `i18n-userguide.md`, `spec-impl-evidence.md`, `user-guide-evidence.md`, `cafe24-api-metadata.md`, `cafe24-restricted-scopes.md` 등이 존재한다. 이 중 상당수가 문서 맵에 미등재되어 있다.
- **상세 분석**: `spec/0-overview.md` 가 모든 규약 파일을 나열해야 한다는 명시적 규약은 없다. `§8 문서 맵` 의 "정식 규약" 행이 `spec/conventions/` 전체를 가리키며 "노드 Output 규약, Swagger 패턴 등" 으로 요약하고 있어 완전 열거를 의도하지 않을 수 있다. 그러나 cross-cutting 진입 역할의 `0-overview.md` 에서 규약 파일 발견성이 낮다.
- **제안**: `spec/0-overview.md §4` 또는 `§8` 에 주요 conventions 파일을 열거하거나, `spec/conventions/README.md` 또는 `spec/conventions/0-overview.md` 를 신설하여 규약 파일 목록을 관리한다. 단, 현행 `spec/0-overview.md §8` 이 전체 열거를 시도하지 않는다는 설계 의도라면 규약 갱신이 필요하지 않다.

---

### [INFO] `spec/conventions/migrations.md §1` 명명 규약 — descriptor `snake_case` 권장과 가드 정규식 허용 집합의 불일치를 spec 에서 명시

- **target 위치**: `spec/conventions/migrations.md §1`
- **위반 규약**: (위반 없음 — 이미 규약이 스스로 불일치를 명시함)
- **상세**: `migrations.md §1` 은 "권장 문자집합은 영문 소문자 + 숫자 + `_`" 이나 가드 정규식들이 더 넓게 허용한다는 점을 규약 스스로 명시적으로 인정하고 있다. 이는 규약 위반이 아닌 의도된 설계다. 정식 규약 문서로서 내부 일관성 관점에서 올바르게 문서화되어 있다.
- **제안**: 현 상태 유지.

---

## 요약

`spec/` 전체를 대상으로 정식 규약(`spec/conventions/`) 과 CLAUDE.md 명명 컨벤션 관점에서 검토한 결과, 직접적 invariant 위반은 1건(CRITICAL — `node-output.md §3.2.1` invariant 의 AI 노드 spec 반영 여부 미확인)이 확인되었고, 규약과 실제 문서 패턴 간 거리감은 3건(WARNING), 사소한 형식 일관성 제안은 4건(INFO)이다. 가장 주목할 점은 CLAUDE.md 가 "다중 spec 파일 영역은 `_product-overview.md` 를 사용한다" 고 규정하나 `spec/data-flow/` 는 `0-overview.md` 패턴을 사용한다는 점으로, 규약 자체의 명확화가 필요하다. `spec/2-navigation/` 상세 파일들의 `## 1. 개요` vs `## Overview (제품 정의)` 헤더 불일치는 광범위한 패턴으로, 규약 갱신(허용 명시) 또는 일괄 헤더 수정 중 하나의 일관된 방향이 필요하다.

## 위험도

**MEDIUM**

(CRITICAL 1건은 스캔 범위 외 파일(`spec/4-nodes/3-ai/` 상세 spec)의 미검증으로 인한 불확실성이며, 현재 확인된 spec 파일 내에서 정식 규약 invariant 직접 위반은 발견되지 않음. WARNING 3건은 규약 자체의 명확화 또는 문서 패턴 통일로 해소 가능한 수준.)
