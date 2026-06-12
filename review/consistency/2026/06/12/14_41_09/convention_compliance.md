# 정식 규약 준수 검토 결과

대상: `spec/conventions/chat-channel-adapter.md`
검토 기준: `spec/conventions/**` 정식 규약 전체

---

## 발견사항

### [INFO] `## Overview` 섹션 누락
- **target 위치**: 파일 상단, `## 1. Adapter Interface` 바로 앞
- **위반 규약**: `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` — `## Overview (제품 정의)` / 본문 / `## Rationale` 3섹션 권장
- **상세**: 본 문서는 본문(`## 1`~`## 7`) + `## Rationale` 구조이나 `## Overview` 섹션이 없다. 본문 최상단(파일 head 단락)의 한 줄 요약이 Overview 역할을 하고 있으나 섹션 헤딩이 없어 구조 규약의 명시적 패턴과 어긋난다.
- **제안**: `## 1. Adapter Interface` 앞에 `## Overview` 섹션을 추가하고, 현재 본문 첫 단락("본 컨벤션은 외부 chat 플랫폼 어댑터가 구현해야 하는…")을 이 섹션으로 이동한다. 단, 이는 "권장" 규약으로, 규약 문서 자체(`spec/conventions/*.md`)에서는 구조가 다소 가변적인 선례가 있으므로 CRITICAL이 아닌 INFO로 분류.

### [INFO] Rationale ID 혼용 — `R1`–`R4` 가 `R-CCA-N` prefix 없이 유지됨
- **target 위치**: `## Rationale` 섹션 `### R1`~`### R4` 및 본문 내 cross-link `[R3](#r3-…)`, `[R4](#r4-…)`
- **위반 규약**: 파일 자체의 Rationale ID 컨벤션 선언(line 498) — "신규 Rationale 은 `R-CCA-N` prefix 사용, 기존 `R1~R4` 는 하위 호환 유지" + Spec Chat Channel §3.1 `R-CC-N` 패턴과 동일 정신
- **상세**: 규약이 `R1~R4`를 명시적으로 "하위 호환 유지(rename 시 cross-link 깨짐 위험)" 예외로 자기 문서화하고 있으므로 실제 위반이 아니다. 다만 이 예외가 컨벤션 내부에서만 선언되고 다른 규약 문서에는 등재되지 않아, 미래 독자가 예외 근거를 찾기 위해 파일을 직접 읽어야 한다.
- **제안**: 현재 상태를 유지하되, 이 예외를 본 파일 `## Rationale` 도입부(line 498)에 이미 적절히 설명하고 있으므로 추가 조치 불필요. 다른 spec 파일에서 `R1`~`R4` 를 cross-link할 때는 `[CCA §R-CCA-N]` 형식이 아니라 `[CCA R1]` 식 별도 표현이 필요할 수 있다는 점은 주의.

---

## 준수 사항 (이상 없음)

- **frontmatter 스키마** (`spec/conventions/spec-impl-evidence.md §2`): `id`, `status`, `code`, `pending_plans` 모두 존재. `id: chat-channel-adapter`는 파일 basename과 일치.
- **`status: partial` + `pending_plans:` 의무** (`spec-impl-evidence.md §3`): `status: partial`이며 `pending_plans:`에 3개 plan 경로가 선언되어 있고, 세 경로 모두 `plan/in-progress/`에 실존 확인.
- **`code:` 글로브 매치** (`spec-impl-evidence.md §4`): `codebase/backend/src/modules/chat-channel/**`가 실제 디렉토리에 파일 다수 매치.
- **파일 위치 및 명명** (`spec/conventions/<name>.md`): 경로·파일명 규약 준수.
- **`## Rationale` 섹션 존재**: 문서 말미에 Rationale 섹션 존재.
- **에러 코드 명명** (`spec/conventions/error-codes.md §1`): 본 문서가 참조하는 `HTTP_4XX`, `HTTP_5XX`, `EXECUTION_TIMEOUT`, `CODE_TIMEOUT`, `CODE_MEMORY_LIMIT`, `CODE_EXECUTION_FAILED`, `LLM_RATE_LIMIT` 등 에러 코드는 모두 `UPPER_SNAKE_CASE`이며 의미 기반 명명 준수.
- **interaction-type 값 참조** (`spec/conventions/interaction-type-registry.md §1`): `form`, `buttons`, `ai_conversation`, `ai_form_render` 4종 모두 registry에 등재된 값이며, `ai_form_render`에 대한 SoT 참조(`interaction-type-registry.md §1`) 인라인 주석 포함.
- **관련 문서 링크**: 파일 헤드의 관련 문서 블록이 존재하고 spec 내 주요 cross-reference가 명시됨.

---

## 요약

`spec/conventions/chat-channel-adapter.md`는 정식 규약(`spec/conventions/spec-impl-evidence.md`, `error-codes.md`, `interaction-type-registry.md`)의 핵심 요건을 모두 충족한다. frontmatter 스키마·status lifecycle·pending_plans 실존·code 글로브 매치·에러 코드 명명·interaction type 값 등 모든 binding 항목이 규약에 부합한다. 발견된 사항은 `## Overview` 섹션 헤딩 부재(권장 사항 미이행)와 Rationale ID 혼용(문서 자체가 예외로 자기 선언)으로, 둘 다 채택 시 다른 시스템의 invariant를 깨는 CRITICAL 위반이 아닌 사소한 형식 일관성 수준(INFO)이다.

---

## 위험도

LOW
