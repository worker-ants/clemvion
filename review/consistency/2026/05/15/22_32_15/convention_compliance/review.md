# 정식 규약 준수 검토 — `spec/5-system/8-embedding-pipeline.md`

검토 모드: `--impl-prep` (구현 착수 전 검토)
검토 일시: 2026-05-15

---

## 발견사항

### [WARNING] Rationale 섹션이 작업 메모(task log) 형태로 작성됨
- **target 위치**: `## Rationale` 섹션 (파일 마지막, 줄 276~334)
- **위반 규약**: `CLAUDE.md` §프로젝트 스펙 문서 — "각 spec 문서는 권장 3섹션 구성을 따른다: (3) **Rationale** — 결정의 배경·근거·폐기된 대안. 옛 memory/ ADR 의 자리."
- **상세**: 현재 Rationale 섹션은 "작업 메모: 지식베이스 임베딩 모델 사용자 선택 (2026-05-02 완료)"라는 제목 하에 배경·사용자 결정·핵심 결과·검증·후속 검토·후속 적용까지 구현 일지 성격의 내용을 그대로 담고 있다. Rationale 섹션의 목적은 **아키텍처 결정의 배경·근거·폐기된 대안** 이며, 완료된 구현 내역이나 검증 결과를 나열하는 위치가 아니다. 특히 `_원본 메모: memory/kb-embedding-model-selection.md_` 는 폐기 경로(`memory/`) 를 직접 참조하는 주석으로, 독자에게 불필요한 혼란을 준다.
- **제안**: Rationale 섹션을 "임베딩 모델 사용자 선택의 배경과 근거", "차원 가변성 채택 근거", "BullMQ 큐 전환 근거" 등 순수한 결정 배경 중심으로 재작성한다. 구현 완료 내역(V021~V024 마이그레이션 상세, 테스트 통과 수 등)은 Rationale에 두지 않거나 최소화한다. `plan/complete/archive/from-memory/` 참조 주석도 삭제하거나 각주로 이동한다.

---

### [WARNING] `memory/` 경로 직접 참조
- **target 위치**: `## Rationale` 첫 줄 — `_원본 메모: memory/kb-embedding-model-selection.md_`
- **위반 규약**: `CLAUDE.md` §폴더 구조 명명 컨벤션 — "옛 `prd/`, `memory/`, `user_memo/` 폴더는 docs-consolidation(2026-05-12) 으로 모두 `spec/` 또는 `plan/complete/archive/` 로 흡수되었다. 신규 문서를 옛 경로 컨벤션으로 만들지 않는다."
- **상세**: 살아있는 spec 문서 본문에 `memory/` 경로를 직접 참조하는 주석이 노출되어 있다. docs-consolidation 이후 `memory/` 는 폐기된 경로이므로, 이 참조는 독자에게 폐기 경로를 가리키는 잘못된 안내가 된다.
- **제안**: 해당 주석(`_원본 메모: memory/kb-embedding-model-selection.md_`)을 삭제한다. 역사적 참조가 꼭 필요하면 `plan/complete/archive/from-memory/` 로 경로를 교정한다.

---

### [WARNING] Rationale 섹션 마지막에 외부 리뷰 경로 참조 (`review/2026-05-02_13-18-24/`)
- **target 위치**: Rationale 마지막 줄 — `리뷰 결과 및 조치 내역: review/2026-05-02_13-18-24/SUMMARY.md + RESOLUTION.md`
- **위반 규약**: `CLAUDE.md` §review 경로 명명 컨벤션 — review 세션 경로는 `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` (nested ISO 형식). 또한 spec 본문에 시점 기록 산출물 경로를 직접 인라인하는 것은 spec 문서의 "최종 상태 기술" 원칙과 어긋난다.
- **상세**: `review/2026-05-02_13-18-24/` 는 옛 flat 경로 형식이다. spec 본문은 "제품의 최종 상태"를 정의하는 문서이므로, 과거 특정 리뷰 세션에 대한 링크는 spec의 유지보수 부담을 높이고 독자를 혼란스럽게 한다.
- **제안**: spec 본문에서 리뷰 경로 참조를 제거한다. 해당 내용이 필요하다면 Rationale 외부(예: plan/complete/) 에 두거나 삭제한다.

---

### [INFO] 섹션 번호 체계가 Overview 없이 시작
- **target 위치**: `## 1. 개요` (줄 7)
- **위반 규약**: `CLAUDE.md` §프로젝트 스펙 문서 권장 3섹션 구성 — "단일 spec 파일 영역은 본문 상단에 직접 `## Overview` 섹션을 둔다."
- **상세**: `8-embedding-pipeline.md` 는 단독 파일이므로 `## Overview` 섹션을 두는 것이 권장 패턴이다. 현재 `## 1. 개요` 는 Overview 섹션에 해당하는 내용을 담고 있으나, 섹션 제목이 `Overview` 가 아닌 `1. 개요` 이고 규약에서 명시한 제목 키워드와 다르다. 이는 hard violation은 아니지만 다른 spec 파일과 일관성 면에서 다소 거리가 있다.
- **제안**: 현재 `## 1. 개요` 를 `## Overview` 로 교체하거나, 현행 방식을 유지하면서 CLAUDE.md 의 "단일 파일 영역에서 `## Overview` 사용" 권고를 `N-name.md` 형식에서도 번호 prefix 허용으로 규약을 명확히 갱신하는 것을 검토한다.

---

### [INFO] 파일 파싱 섹션 내 헤더 명칭 오타
- **target 위치**: `### 3.1 지원 형식` (줄 45) — 테이블 헤더 `파서` 컬럼이 일부 행에서 `직접 읽기`로 서술
- **위반 규약**: 해당 없음 (정식 규약 위반 아님, 단순 내용 품질)
- **상세**: 이 항목은 정식 규약 준수와 직접 관련이 없으므로 순수 INFO 수준으로만 기록한다.
- **제안**: 해당 없음 (spec 내용 정합성 검토 범위 밖).

---

## 요약

`spec/5-system/8-embedding-pipeline.md` 는 파일명·숫자 prefix·위치 모두 CLAUDE.md 명명 컨벤션을 준수하고 있으며, `spec/conventions/` 의 정식 규약(node-output, migrations, swagger, cafe24-api-metadata)과 직접 충돌하는 내용은 없다. 임베딩 파이프라인 고유의 API 경로·큐·WebSocket 이벤트 명명도 정식 규약에서 별도 규정이 없는 영역으로, 위반 사항은 아니다. 다만 Rationale 섹션이 "결정 배경·근거" 가 아닌 구현 완료 일지 형태로 작성되어 있고, 이미 폐기된 `memory/` 경로를 직접 참조하는 주석이 살아있는 spec 본문에 남아 있어 두 건의 WARNING 이 발생한다. 추가로 과거 리뷰 세션의 flat 경로 참조도 spec 최종 상태 원칙에 어긋나 WARNING 으로 분류된다. 이 발견사항들은 구현 착수를 차단할 CRITICAL 수준은 아니나, spec 정합성 유지를 위해 Rationale 섹션 정비를 권장한다.

---

## 위험도

LOW
