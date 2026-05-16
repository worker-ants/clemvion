# 정식 규약 준수 검토 — convention_compliance

**검토 대상**: `plan/in-progress/spec-draft-data-model-install-token-followup.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 일시**: 2026-05-16

---

## 발견사항

### [INFO] plan 문서에 `spec_files` 비표준 frontmatter 필드 사용
- **target 위치**: 파일 상단 frontmatter (line 5-6)
- **위반 규약**: `CLAUDE.md` "PLAN 문서 라이프사이클" — frontmatter 필드는 `worktree`, `started`, `owner` 세 가지만 정의되어 있다.
- **상세**: frontmatter 에 `spec_files:` 키를 추가해 연관 spec 파일을 나열하고 있다. CLAUDE.md 의 frontmatter 정의에 이 필드는 없다. 직접적인 규약 위반이라기보다는 정의되지 않은 확장 필드를 도입한 형태다.
- **제안**: (1) 이 정보는 본문 "## 컨텍스트" 섹션에 산문 또는 bullet 로 기술하는 것으로 충분하다. frontmatter 확장이 정말 필요하다면 CLAUDE.md 의 frontmatter 정의 테이블에 `spec_files` 필드를 공식 추가하고, consistency-checker 의 `plan_coherence` 가 이를 인식하도록 갱신해야 한다.

---

### [INFO] plan 문서가 체크리스트 형식을 갖추지 않아 완료 여부 판별이 어려움
- **target 위치**: 전체 본문 (변경 1 / 변경 2 섹션)
- **위반 규약**: CLAUDE.md "PLAN 문서 라이프사이클" — "`plan/in-progress/`는 처리할 항목이 하나라도 남아있는" 문서이며, "미체크 체크박스(`[ ]`)" 등 상태 표기가 기준이다.
- **상세**: 현재 문서는 변경 내용을 서술 형식으로만 기술하고 있어, 체크박스나 완료 표기가 없다. `in-progress/` → `complete/` 이동의 분류 기준("미체크 체크박스 등")을 기계적으로 판별하기 어렵다.
- **제안**: 각 변경 항목에 `- [ ] 변경 1 — spec/1-data-model.md install_token 컬럼 설명 정정` 형식의 체크박스를 추가하면 완료 판별이 명확해지고 consistency-checker 의 `plan_coherence` 가 미완 항목을 자동 감지할 수 있다.

---

## 이상 없음 (주요 항목)

- **파일 위치 규약**: `plan/in-progress/<name>.md` 평문 파일명 패턴을 정확히 따르고 있다. `spec-draft-data-model-install-token-followup.md` — 숫자 prefix 없이 평문, 올바른 위치.
- **frontmatter 필수 3 필드**: `worktree`, `started`, `owner` 모두 존재하고 형식이 올바르다.
- **금지 경로 미참조**: `prd/`, `memory/`, `user_memo/` 등 폐기 경로를 참조하거나 생성하지 않는다.
- **spec 파일 경로 표기**: 본문에서 참조하는 `spec/1-data-model.md`, `spec/2-navigation/4-integration.md`, `spec/data-flow/integration.md` 등의 경로가 `spec/` 단일 폴더 구조를 따른다.
- **출력 포맷 / API 문서 / Swagger 규약**: 본 문서는 plan 추적 문서로 노드 Output 형식, API 응답 형식, DTO 명명 규약이 직접 적용되는 범위가 아니다. 관련 발견사항 없음.
- **명명 규약 (spec 파일 대상)**: plan 문서가 기술하는 변경 대상(`spec/1-data-model.md`)은 숫자 prefix `1-` 규칙을 따르는 파일이다. plan 문서 자체는 `plan/in-progress/` 패턴(평문, 숫자 prefix 불필요)을 올바르게 따른다.

---

## 요약

`plan/in-progress/spec-draft-data-model-install-token-followup.md` 는 정식 규약의 핵심 요구사항(위치·파일명 패턴·필수 frontmatter 3 필드·금지 경로 미참조)을 모두 준수하고 있다. CRITICAL 또는 WARNING 수준의 위반은 없다. 다만 두 가지 INFO 수준의 형식 제안이 있다: 비표준 `spec_files` frontmatter 필드(공식 정의 없는 확장)와 체크박스 부재(완료 상태 기계 판별 어려움). 두 항목 모두 규약의 직접 위반이 아닌 형식 일관성 차원의 제안이므로, 현재 상태로도 채택에 무리가 없다.

---

## 위험도

LOW
