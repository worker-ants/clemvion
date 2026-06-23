# 정식 규약 준수 검토 결과

검토 범위: `spec/2-navigation` 전체 (--impl-done, diff-base=origin/main)

---

## 발견사항

### [WARNING] 대부분의 spec 문서에 `## Overview` 섹션 누락
- target 위치: `spec/2-navigation/0-dashboard.md`, `1-workflow-list.md`, `2-trigger-list.md`, `10-auth-flow.md`, `11-error-empty-states.md`, `13-user-guide.md`, `15-system-status.md`, `16-agent-memory.md` — 모두 Overview 섹션 없이 본문 섹션(`## 1. 화면 구조` 등)부터 시작
- 위반 규약: CLAUDE.md "정보 저장 위치" — `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`; CLAUDE.md developer/SKILL.md 권장 3섹션 (Overview / 본문 / Rationale)
- 상세: `spec/2-navigation/14-execution-history.md`는 `## Overview (제품 정의)` 섹션을 구비하여 제품 정의·배경·목표·요구사항을 구조화하고 있지만, 같은 영역의 나머지 7개 문서는 Overview 섹션이 없다. CLAUDE.md는 각 영역 spec 의 진입 문서에 `## Overview` 를 두도록 권장하며 이는 _product-overview.md 또는 각 spec 의 Overview 섹션으로 표현된다. 특히 `2-trigger-list.md` 는 M-8 2단계 작업 대상이므로 이 점이 직접 관련된다.
- 제안: 각 spec 파일 상단에 `## Overview` 섹션을 추가하고 해당 화면의 제품 정의·목적·요구사항 요약을 기술한다. `14-execution-history.md` 의 패턴을 참고. 규약 위반이라기보다 "권장 패턴 미준수"에 해당하므로 WARNING 등급. 전체 영역에 일괄 적용 시 `spec` 변경이므로 `project-planner` 에 위임 필요.

---

### [WARNING] `AUTH_CONFIG_NOT_FOUND` 에러 코드가 공식 카탈로그에 미등재
- target 위치: `spec/2-navigation/2-trigger-list.md` §3 API — `PATCH /api/triggers/:id` 설명 중 "미스매치 시 400 `VALIDATION_ERROR` 또는 `AUTH_CONFIG_NOT_FOUND`"
- 위반 규약: `spec/5-system/3-error-handling.md §1.1` 공용 에러 코드 카탈로그 (RESOURCE_NOT_FOUND, RESOURCE_CONFLICT 등 공식 등재 코드 목록)
- 상세: `AUTH_CONFIG_NOT_FOUND` 는 백엔드 코드(`triggers.service.ts:502`)에서 실제로 발행되며 spec 본문에도 명시되어 있다. 그러나 `3-error-handling.md` 의 공식 카탈로그에는 등재되어 있지 않다. `RESOURCE_NOT_FOUND` 의 AuthConfig 특화 코드라는 점에서 `MODEL_CONFIG_NOT_FOUND` 패턴과 동형이나, 후자는 카탈로그에 등재되어 있고 전자는 누락 상태다. 에러 코드 명명 자체는 `spec/conventions/error-codes.md §1` 의 의미 기반 원칙(도메인 prefix + 조건 기술)을 잘 따른다.
- 제안: `spec/5-system/3-error-handling.md §1.1` 또는 `§1.3` 에 `AUTH_CONFIG_NOT_FOUND | AuthConfig 리소스 부재 또는 워크스페이스 불일치 | 404` 를 추가 등재한다. `spec/` 변경이므로 `project-planner` 위임.

---

### [INFO] `10-auth-flow.md` §2 하위 섹션 번호가 순서 역전
- target 위치: `spec/2-navigation/10-auth-flow.md` — `### 2.4 처리 플로우` (line 482) 다음에 `### 2.6 초대 토큰을 통한 가입` (line 491), 그 뒤에 `### 2.5 이메일 인증 안내 화면` (line 505) 순서로 배치됨
- 위반 규약: 명시적 순서 규약은 없으나, 문서 구조의 일관성(섹션 번호 오름차순 배치)은 암묵적 관행이며 독자가 §2.5 를 §2.6 이전에 읽을 것을 기대하게 만든다
- 상세: §2.6 이 §2.4 의 "특수 케이스 분기" 이고 §2.5 가 공통 결과 화면인 흐름 논리로 의도적 배치일 수 있다. 그러나 번호 역전은 참조 혼란을 유발한다. 예: "§2.4 처리 플로우 step 3" 에서 "§2.5 이메일 인증 안내 화면" 을 언급하지만, 물리적으로 §2.6 이 먼저 나온다.
- 제안: 섹션을 `2.4 → 2.5 → 2.6` 순서로 재배치하거나, 현재 §2.6 을 §2.5 로 renumber 하고 현재 §2.5 를 §2.6 으로 renumber 하거나, 번호를 가나다순이 아닌 흐름 순 배치임을 명기하는 주석을 추가한다.

---

### [INFO] `spec/2-navigation/16-agent-memory.md` frontmatter id 가 basename 과 불일치 (의도적 패턴 — 확인 필요)
- target 위치: `spec/2-navigation/16-agent-memory.md` frontmatter — `id: nav-agent-memory` (파일명 `16-agent-memory.md`, basename `agent-memory`)
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — "id: 파일 basename 기반 권장. **같은 basename 이 영역을 달리해 중복될 때는 후발 문서가 영역 prefix 로 충돌을 회피한다**"
- 상세: 이 불일치는 의도된 패턴이다 — `spec/5-system/17-agent-memory.md` 가 이미 `agent-memory` id 를 선점하고 있으므로, `spec/2-navigation/16-agent-memory.md` 가 `nav-agent-memory` 로 충돌 회피한 것으로 보인다. 실제 규약이 정확히 이 케이스를 설명하고 있어 위반이 아님. 단순 확인 메모.
- 제안: 별도 조치 불필요. 규약 §2.1 에 정확히 들어맞는 패턴.

---

## 요약

`spec/2-navigation` 영역의 전반적인 정식 규약 준수 수준은 양호하다. Frontmatter 스키마(id/status/code/pending_plans), API endpoint 명명 패턴(`/api/<resource>`), 에러 코드 명명 규약(UPPER_SNAKE_CASE, 의미 기반 도메인 prefix), 응답 봉투(`{ "data": ... }`) 표기, Swagger 데코레이터 패턴 언급, Rationale 섹션 구비 등 핵심 규약을 전반적으로 잘 준수하고 있다. 주요 미흡 사항은 두 가지다: (1) Overview 섹션이 `14-execution-history.md` 에만 있고 나머지 7개 문서에는 없어 3섹션 권장 구조가 일관되지 않은 점, (2) `AUTH_CONFIG_NOT_FOUND` 에러 코드가 실제 코드와 spec 본문에 존재하지만 공식 에러 카탈로그에 미등재인 점. 두 항목 모두 spec 수정이 필요하므로 project-planner 위임 사안이며, 구현 채택 자체를 차단하는 Critical 위반은 없다.

## 위험도

LOW
