# 정식 규약 준수 검토 결과

검토 대상: `spec/5-system/` (구현 완료 후 검토, diff-base=origin/main)
검토 일시: 2026-06-10

---

## 발견사항

### 1. [INFO] 1-auth.md Rationale — 신규 추가된 §1.5.D 항목이 §2.3.A 뒤에 위치 (섹션 번호 역순)

- **target 위치**: `/spec/5-system/1-auth.md` `## Rationale` 섹션 끝 (라인 538)
- **위반 규약**: CLAUDE.md "결정의 배경·근거 — 해당 spec 문서 끝의 `## Rationale`". Rationale 섹션 내부의 sub-heading 순서에 대한 강제 규약은 없으나, 기존 Rationale 항목들은 §1.5.A → §1.5.B → §1.5.C → §1.4.A … → §2.3.A 순으로 배열된다. 이번에 추가된 `### 1.5.D` 는 `### 2.3.A` 다음에 위치해 번호 순서가 역행한다.
- **상세**: `git diff` 기준 신규 추가 §1.5.D 항목(`워크스페이스 초대 토큰을 raw 로 저장하는 이유`)이 `### 2.3.A` 이후에 append 됐다. 규약 자체가 Rationale 내부 순서를 강제하지는 않으므로 기능적 위반은 아니나, 동일 섹션(§1.5) 의 다른 Rationale 항목(§1.5.A·B·C)과 연속성이 끊겨 독자 탐색 시 일관성이 떨어진다.
- **제안**: `### 1.5.D` 항목을 `### 1.5.C` 와 `### 1.4.A` 사이로 이동해 §1.5.* 항목을 연속 배치. 또는 현 append 방식을 허용하는 내부 합의를 명시(별도 규약 갱신 불필요 — 제약이 없는 사안).

---

### 2. [INFO] 1-auth.md §1.5.4 에러 응답 — historical-artifact lower_snake_case 코드 주석의 cross-reference 형식

- **target 위치**: `/spec/5-system/1-auth.md` §1.5.4 에러 응답 섹션 아래 인라인 blockquote (라인 260)
- **위반 규약**: `spec/conventions/error-codes.md §3` Historical-artifact 예외 레지스트리. 해당 주석 자체는 §3 의 예외 등재 근거와 일치하므로 내용 위반은 아니다. 단, 주석 내 링크가 `[node-output.md` **Principle 3.2**`](../conventions/node-output.md#32-outputerror-표준-형태)` 와 `[error-codes.md §1`](../conventions/error-codes.md#1-의미-기반-명명-핵심-원칙)` 양쪽을 `UPPER_SNAKE_CASE 규약` 의 SoT 로 병기하는데, `error-codes.md` Overview 는 **표기(`UPPER_SNAKE_CASE`)의 SoT 는 `3-error-handling.md §3.2`·`node-output.md §3.2`** 이며 `error-codes.md` 는 "재선언하지 않는다"고 명시한다. `error-codes.md §1` 은 표기 규약을 소유하지 않으므로 참조 대상으로 부적절하다.
- **상세**: 본 변경 diff 범위 외 기존 텍스트이므로 이번 커밋에서 신규 도입된 오류는 아니다. 그러나 타겟 문서 전범위 검토 항목으로 포함.
- **제안**: `[error-codes.md §1]` 참조를 `[error-codes.md §3]` (historical-artifact 레지스트리)로 교정. 표기 SoT 링크는 `[3-error-handling.md §3.2]` 또는 `[node-output.md §3.2]` 단독 유지.

---

### 3. [INFO] 11-mcp-client.md — `## Rationale` 섹션 부재

- **target 위치**: `/spec/5-system/11-mcp-client.md` 전체 (마지막 섹션 §12 확장 포인트)
- **위반 규약**: CLAUDE.md "결정의 배경·근거 — 해당 spec 문서 끝의 `## Rationale`". spec 문서는 Overview / 본문 / Rationale 3섹션 구성을 권장한다.
- **상세**: `11-mcp-client.md` 는 §2.2 `stdio 미지원 사유`, §3 Integration 모델 설명, §4 Connection Lifecycle 설계 등 설계 결정 근거를 본문 내에 분산 서술하고 있으나 문서 끝에 집약된 `## Rationale` 섹션이 없다. 다른 `spec/5-system/` 파일들(`1-auth.md`, `10-graph-rag.md`)은 모두 `## Rationale` 를 보유한다. 이번 diff 에서 해당 파일을 직접 수정하지 않았으므로 이번 커밋의 신규 위반은 아니나, 전범위 검토 항목으로 포함.
- **제안**: 문서 말미에 `## Rationale` 섹션을 추가하고, §2.2 stdio 미지원 사유, §3.1 service_type 설계, §4.1 세션 단위 결정, §6 격리 원칙 등 현재 본문에 분산된 설계 근거를 한 곳에 정리. 규약이 "권장"이므로 CRITICAL/WARNING 아닌 INFO.

---

### 4. [INFO] 10-graph-rag.md — `## Overview` 섹션이 상위 heading `### 1. 목표` 이중 구조

- **target 위치**: `/spec/5-system/10-graph-rag.md` 라인 29 `## Overview (제품 정의)` 및 내부 `### 1. 목표`, `### 2. 범위` 등
- **위반 규약**: CLAUDE.md "Overview / 본문 / Rationale 3섹션 권장". `10-graph-rag.md` 는 `## Overview (제품 정의)` 아래 `### 1. 목표` ~ `### 8. 미결/후속 검토` 를 두고, 이후 `## 1. 개요` 로 본문을 재시작하는 구조다. 즉 `## Overview` 와 `## 1. 개요` 가 분리되어 있어 "Overview / 본문 / Rationale" 3섹션 경계가 모호하고, 번호 체계 내 `## 1.` 이 Overview 하위에도(`### 1. 목표`) 존재하고 본문에도(`## 1. 개요`) 존재해 중첩이 된다.
- **상세**: 이번 diff 외 기존 구조이며, 이번 커밋에서 10-graph-rag.md 는 변경되지 않았다. 전범위 검토 항목.
- **제안**: `## Overview` 내 `### 1. 목표` … `### 8. 미결` 을 본문(body)으로 통합하거나, `## Overview` 를 단락 요약으로 축소하고 나머지를 `## 1.` 이하 본문으로 이동. Rationale 은 이미 `## Rationale` 섹션으로 존재.

---

## 이번 diff 범위의 주요 준수 사항 (양호)

- **신규 Rationale §1.5.D**: `## Rationale` 끝에 append 되어 섹션 위치 규약(문서 끝) 준수.
- **Rate Limit 확정값 갱신**: `spec/5-system/1-auth.md §1.5.1` 의 "구현 시 결정" → 구체적 값(`10건/분`)으로 갱신됐으며, cross-reference `[data-flow §1.2]` 를 인라인으로 포함해 단일 진실 원칙 준수.
- **에러 코드 표기**: 이번 diff 내 신규 에러 코드 추가 없음. 기존 `lower_snake_case` historical-artifact 코드(`invitation_*`)는 `error-codes.md §3` 예외 레지스트리에 이미 등재되어 있어 규약 위반 아님.
- **Frontmatter**: `1-auth.md` 의 `id`, `status`, `code`, `pending_plans` 필드 모두 `spec-impl-evidence.md §2` 스키마 준수.

---

## 요약

이번 diff(`spec/5-system/1-auth.md` — Rate Limit 확정값 + Rationale §1.5.D 추가)는 정식 규약을 직접 위반하는 사항이 없다. 발견된 4건은 모두 INFO 수준의 사소한 형식 일관성 제안이며, 그 중 2건(발견사항 3·4)은 이번 diff 대상 파일이 아닌 기존 spec 문서의 구조적 불일치다. 발견사항 1(Rationale 항목 역순 위치)은 현행 규약이 순서를 강제하지 않으므로 선택적 개선 사항이다. 발견사항 2(cross-reference SoT 부정확)는 기존 텍스트의 링크 정확도 문제로, 기능적 오해보다는 문서 품질 차원의 이슈다.

---

## 위험도

NONE
