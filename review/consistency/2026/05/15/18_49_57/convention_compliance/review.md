# 정식 규약 준수 검토 — `spec/6-brand.md`

검토 모드: `--impl-prep` (구현 착수 전 검토)  
검토 대상: `spec/6-brand.md`  
검토 규약: `spec/conventions/` 전체 + `CLAUDE.md` 명명 컨벤션

---

## 발견사항

### 1. [WARNING] 문서 제목에 `PRD:` prefix 사용
- **target 위치**: `spec/6-brand.md` 1행 — `# PRD: 브랜드 가이드 — Clemvion`
- **위반 규약**: `CLAUDE.md` §정보 저장 위치 — "제품 정의·요구사항(옛 PRD) → `spec/<영역>/_product-overview.md` 또는 영역 진입 문서의 `## Overview (제품 정의)` 섹션"
- **상세**: docs-consolidation(2026-05-12) 이후 `PRD`라는 용어는 `spec/` 안에서 *"옛 PRD"* 로 대체 지칭된다. 파일 제목에 `PRD:` 를 그대로 노출하면, 신규 문서가 옛 경로 컨벤션을 답습하는 것처럼 오해될 수 있다.
- **제안**: 제목을 `# 브랜드 가이드 — Clemvion` 으로 변경하거나, `## Overview (제품 정의)` 섹션을 문서 상단에 두고 본문을 이어가는 구조로 전환한다. `PRD:` prefix 삭제가 가장 간단한 수정이다.

### 2. [INFO] 권장 3섹션 구조에서 Overview 섹션 미분리
- **target 위치**: `spec/6-brand.md` 전체 구조
- **위반 규약**: `CLAUDE.md` §프로젝트 스펙 문서 — "각 spec 문서는 권장 3섹션 구성(1. Overview / 2. 본문 / 3. Rationale)을 따른다"
- **상세**: 문서는 `§1~§7` 브랜드 스토리·가치 정의, `§8` 비주얼 아이덴티티 스펙, `Rationale` 의 흐름을 가지며, 3섹션의 정신은 대체로 충족된다. 다만 명시적인 `## Overview` 헤딩이 없어 ① 사용자 가치·목표를 기술하는 "Overview (제품 정의)" 영역과 ② 기술 명세인 "본문" 영역의 경계가 구조적으로 드러나지 않는다. `## Rationale` 섹션은 존재하므로 3번째 섹션은 준수됨.
- **제안**: `§1~§7` 을 묶는 `## Overview (제품 정의)` 헤딩을 최상단에 추가하고, `§8` 앞에 `## 브랜드 시각 규약 (스펙)` 또는 이에 준하는 본문 섹션 헤딩을 추가한다. 강제 규약은 아니지만 일관성에 도움이 된다.

### 3. [INFO] 파일 위치 패턴 검토 — 단일 spec 파일 영역의 `N-name.md` 규칙 준수 여부
- **target 위치**: 파일 경로 `spec/6-brand.md`
- **위반 규약**: `CLAUDE.md` 명명 컨벤션 표 — `spec/<영역>/N-name.md` 패턴은 "정렬 보장된 상세 spec 문서"
- **상세**: `spec/6-brand.md` 는 `spec/` 루트 직하 파일로, 숫자 prefix `6-` 를 사용하고 있어 컨벤션과 일치한다. `spec/` 루트는 `0-overview.md`, `1-data-model.md` 처럼 숫자 prefix 단일 파일들로 구성된 영역이므로 별도 위반 없음. 확인 차원의 INFO.
- **제안**: 현행 유지. 이상 없음.

---

## 요약

`spec/6-brand.md` 는 정식 규약(`spec/conventions/` 전체)에 직접 저촉되는 항목이 없다. 본 문서는 브랜드·비주얼 아이덴티티를 정의하는 spec 이므로 노드 Output(`node-output.md`), Swagger(`swagger.md`), Cafe24 API Metadata(`cafe24-api-metadata.md`), 마이그레이션(`migrations.md`) 규약의 적용 범위 바깥이다. `Rationale` 섹션 보유, 숫자 prefix 파일명, 폐기 경로(`prd/`, `memory/`) 미사용 등 주요 규약을 준수하고 있다. 다만 문서 제목에 잔존하는 `PRD:` prefix 는 docs-consolidation 이후 지양되는 표현이므로 제거를 권고한다(WARNING). Overview/본문 섹션 헤딩 미분리는 사소한 형식 제안(INFO) 수준이다.

---

## 위험도

LOW
