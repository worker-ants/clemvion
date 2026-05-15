# Convention Compliance Review

**Target**: `plan/in-progress/spec-draft-brand-refresh.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 일시**: 2026-05-15

---

## 발견사항

### INFO-1: plan 문서에 spec 본문이 직접 포함된 구조 — spec 파일 경계 혼재
- **target 위치**: 문서 전체 (`## §8 정식 개정안 (drop-in 대체)` 이하 본문)
- **위반 규약**: `CLAUDE.md` 명명 컨벤션 및 정보 저장 위치 원칙 — "기술 명세(스펙)는 `spec/<영역>/*.md` 본문"
- **상세**: `plan/in-progress/` 문서는 작업 추적이 목적이며, 실제 spec 본문(`## 8. Visual Identity` ~ `## Rationale`)이 draft 형태로 plan 문서에 통째로 포함되어 있다. CLAUDE.md 는 spec 본문의 단일 진실 위치를 `spec/<영역>/*.md`로 명시하며 plan 문서는 `plan/in-progress/<name>.md`(진행 추적)로 역할을 구분한다. 단, 문서 자체에 "본 draft 가 채택되면 `spec/6-brand.md` 의 그 자리를 대체한다"고 명시하고 있으므로, 이는 채택 전 임시 보관 목적으로 허용 범위 내라 볼 수 있다. 채택 후 plan 문서에 spec 본문이 잔류한다면 단일 진실 원칙 위반이 된다.
- **제안**: 현재 draft 상태에서는 허용 가능하나, `spec/6-brand.md`에 반영 완료 후 plan 문서 내 spec 본문은 삭제하거나 링크 참조로 대체한다. "다음 액션 2번" 완료 시점에 plan 본문 정리를 명시적으로 체크리스트에 추가할 것을 권장.

---

### INFO-2: `## Rationale` 섹션 위치 — `## 9` 이후에 별도 최상위 헤딩으로 기술
- **target 위치**: `## Rationale (신규 섹션 — ## 9 직후 추가)` (line ~231)
- **위반 규약**: `CLAUDE.md` 프로젝트 스펙 문서 섹션 — "`## Rationale` — 결정의 배경·근거·폐기된 대안. **spec 문서 끝에** 위치"
- **상세**: CLAUDE.md는 Rationale 을 "해당 spec 문서 끝의 `## Rationale` 섹션"으로 정의한다. 본 draft의 Rationale 는 `## 9. 변경 이력` 직후에 동일 레벨 `## Rationale`로 배치되어 있어 규약 위치와 정합한다. 그러나 draft 문서 안에서는 plan 내용(`## Stage 2 인수인계` 등)이 Rationale 뒤에 이어지므로, 실제 `spec/6-brand.md` 반영 시 Rationale가 해당 spec 파일의 **마지막 섹션**인지 확인이 필요하다.
- **제안**: `spec/6-brand.md`에 반영 시 `## Rationale`가 파일의 최종 섹션임을 확인한다. 현재 `spec/6-brand.md`에 기존 섹션이 있다면 Rationale 뒤에 다른 섹션이 오지 않도록 배치를 점검한다.

---

### INFO-3: `spec/conventions/` 파일에 대한 직접 참조 없음
- **target 위치**: draft 전체
- **위반 규약**: `CLAUDE.md` — "정식 규약(옛 user_memo CONVENTIONS)은 `spec/conventions/<name>.md`에 보관"
- **상세**: 본 draft는 컬러 토큰, 타이포그래피, 로고 시스템 등 브랜드 시각 규약을 정의하는 문서이다. 현재 `spec/conventions/` 에는 `node-output.md`, `migrations.md`, `cafe24-api-metadata.md`, `swagger.md` 가 있으며, 이 중 본 draft와 직접 연관된 conventions 파일은 없다. 브랜드 규약을 별도 `spec/conventions/brand-tokens.md` 혹은 유사 파일로 분리해야 한다는 요건이 conventions 규약에 명시되어 있지는 않으므로 현재 `spec/6-brand.md` 내 본문 기술은 허용 범위다. 단, 컬러 토큰 네이밍(`vine-700`, `vine-dark-accent` 등)이 CSS/Tailwind 구현 시 conventions 으로 격상될 가능성이 있다.
- **제안**: 당장 위반은 아니나, Stage 2(developer) 구현 단계에서 CSS 변수 명명 규칙이 확정되면 `spec/conventions/brand-tokens.md`로 분리 여부를 검토한다.

---

## 요약

`plan/in-progress/spec-draft-brand-refresh.md`는 정식 규약(`spec/conventions/**`, `CLAUDE.md`)의 핵심 항목을 직접적으로 위반하지 않는다. 문서 구조(Overview 암묵적 포함, 본문 §8, Rationale R-1~R-8)는 CLAUDE.md 권장 3섹션 구성을 충실히 따르고 있으며, frontmatter에 `worktree`, `started`, `owner` 모두 명시되어 plan 문서 규약도 준수한다. 옛 `prd/`, `memory/` 경로 사용 흔적은 없다. 발견된 3건은 모두 INFO 등급으로, 현재 draft 상태에서 허용 가능하거나 반영 시점 체크리스트 추가를 권장하는 수준이다.

---

## 위험도

LOW
