spec draft 문서와 정식 규약(`spec/conventions/`)을 대조하여 점검합니다.

---

## 발견사항

---

### [WARNING] §4.1 Rate Limit 헤더명 불일치 — `X-Cafe24-Call-Limit` vs `X-Api-Call-Limit`

- **target 위치**: `4-cafe24.md` §4.1 Rate Limit 처리 상세 표 (첫 번째 행) vs §4 실행 로직 intro 단락, §5.1 meta 필드 테이블
- **위반 규약**: `spec/conventions/node-output.md` Principle 3.2 / Principle 11 — 에러 컨트랙트 및 출력 예시의 필드·출처가 일관되어야 한다
- **상세**:
  - §4.1 표: `X-Cafe24-Call-Limit` → `meta.callLimit`
  - §4 intro 단락: `X-Api-Call-Limit`(현재/상한)
  - §5.1 meta 필드 설명: `X-Api-Call-Limit` 헤더 (`현재/상한`)
  - §2 / §5.8 핵심 결정 요약에서도 `X-Api-Call-Limit` 사용

  실제 Cafe24 Admin API 응답 헤더명은 `X-Api-Call-Limit`이므로 §4.1 표의 `X-Cafe24-Call-Limit`은 오기. 구현 시 wrong 헤더를 읽는 버그로 이어질 수 있다.
- **제안**: §4.1 표 첫 행의 `X-Cafe24-Call-Limit` → `X-Api-Call-Limit` 으로 정정.

---

### [WARNING] `spec/4-nodes/4-integration/4-cafe24.md` — `## Overview` 섹션 누락

- **target 위치**: `4-cafe24.md` 파일 최상단 (# Spec: Cafe24 직후)
- **위반 규약**: `CLAUDE.md` 프로젝트 명세 구조 규약 — "단일 spec 파일 영역은 본문 상단에 직접 `## Overview` 섹션을 둔다"
- **상세**: 현재 draft 는 제목 다음에 관련 문서 callout과 한 줄 설명 단락으로 바로 진입한 뒤 `## 1. 설정` 으로 이어진다. 권장 3섹션(Overview / 본문 / Rationale) 중 Overview 섹션이 없고, 제품 가치·요구사항·목표를 담는 공식 진입점이 없는 상태다. 나머지 두 섹션(본문·Rationale §9)은 온전히 존재한다.
- **제안**: `## 1. 설정` 앞에 `## Overview` 섹션을 추가하고, "한국 이커머스 SaaS Cafe24 Admin API 통합 노드" 의 사용자 가치·지원 범위(18카테고리)·워크플로/AI Agent 이중 활용 목적을 2~4문장으로 기술.

---

### [INFO] §5.3.2 · §5.3.3 error case — `config` echo 에서 `fields` 생략 여부 모호

- **target 위치**: `4-cafe24.md` §5.3.2 Rate Limit 재시도 소진, §5.3.3 Transport 실패 JSON 예시
- **위반 규약**: `spec/conventions/node-output.md` Principle 7 (config echo는 rawConfig spread), Principle 11 (undefined 필드는 생략 가능)
- **상세**: §5.1 성공 케이스는 `config.fields` 를 포함하나, §5.3.2·§5.3.3 에러 케이스 예시에는 `fields` 가 없다. Principle 11에 따라 `fields: {}` (빈 객체)이면 생략 가능하므로 규약 위반은 아니지만, 이 두 케이스에서도 실제 실행 시 `fields` 가 rawConfig 에 존재했다면 echo 되어야 한다는 점이 예시에서 명확하지 않다.
- **제안**: §5.3.2·§5.3.3 예시에 `"fields": { ... }` 를 생략 이유와 함께 인라인 주석으로 명시하거나(`// fields omitted for brevity — echoed as-is if set`), 성공 케이스처럼 `"fields": {}` 를 명시적으로 포함.

---

## 요약

전반적으로 `spec/conventions/node-output.md` 의 핵심 Principle 들(Principle 0 5필드 invariant, Principle 1.1 config/output 직교, Principle 3 에러 컨트랙트, Principle 7 config echo 자격증명 제외, Principle 8.2 `output.response` 관용 네이밍)을 충실히 따르고 있다. Swagger·Migration 규약은 이 spec draft 단계에서 해당 없다. Critical 위반은 없으며, WARNING 2건 중 하나(`X-Api-Call-Limit` 오기)는 구현 단계에서 버그로 이어질 수 있어 spec write 전 수정이 필요하다.

## 위험도

**LOW** — Critical 위반 없음. WARNING 1건(`X-Api-Call-Limit` 헤더명 오기)을 수정하고 `## Overview` 섹션을 추가한 뒤 spec write 진행 가능.