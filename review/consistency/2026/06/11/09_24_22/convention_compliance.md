# 정식 규약 준수 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done)  
검토 범위: `spec/data-flow/` (diff-base: origin/main)  
실제 변경 파일: `spec/data-flow/2-auth.md`, `spec/5-system/3-error-handling.md`

---

## 발견사항

### [WARNING] `spec/data-flow/` 영역이 frontmatter 가드 scope 밖
- **target 위치**: `spec/data-flow/*.md` 전체 (16개 파일)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §1 적용 대상`
- **상세**: `spec-frontmatter-parse.ts` 의 `INCLUDE_PREFIXES` 는 `spec/2-navigation/`, `spec/3-workflow-editor/`, `spec/4-nodes/`, `spec/5-system/`, `spec/7-channel-web-chat/`, `spec/conventions/` 를 열거한다. `spec/data-flow/` 는 이 목록에 없어 `id`/`status` frontmatter 검증 대상에서 완전히 제외된다. 결과적으로 이 영역의 16개 문서는 현재 구현 lifecycle 추적(backlog→implemented)이 전혀 이루어지지 않는다. 신규 영역으로 추가된 `data-flow/` 가 conventions 에 반영되지 않은 상태다.
- **제안**: `spec/conventions/spec-impl-evidence.md §1` 에 `spec/data-flow/**.md` 를 INCLUDE_PREFIXES 로 추가하고, `spec-frontmatter-parse.ts` 의 `INCLUDE_PREFIXES` 배열을 동기 갱신한다. 이후 해당 영역 각 파일에 frontmatter(`id`, `status`, `code:`) 를 추가한다. `spec/data-flow/0-overview.md` 는 basename 이 `0-overview.md` 이므로 `EXCLUDE_BASENAMES` 예외에 해당해 frontmatter 면제 유지.

---

### [WARNING] `2-auth.md` 본문 주석에 묻힌 설계 근거 — Rationale 섹션 미등재
- **target 위치**: `spec/data-flow/2-auth.md` §1.4 (줄 180–189), `## Rationale` 섹션 (줄 338–356)
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"
- **상세**: 이번 diff 에서 추가된 **refresh token 회전 원자성(트랜잭션 wrap, 조건부 UPDATE TOCTOU 방지)** 은 실질적인 설계 결정이다. 현재 이 근거가 §1.4 다이어그램 아래 블록 인용(`> **회전 원자성** ...`)에만 서술돼 있고, `## Rationale` 섹션에는 대응하는 항목이 없다. 규약상 "결정의 배경·근거" 는 Rationale 섹션에 위치해야 한다. 다이어그램 주석에 inline 서술은 흐름 이해를 위한 보조 설명으로는 유효하나, 그것이 Rationale 역할을 대체하지는 않는다.
- **제안**: `## Rationale` 섹션에 `### Refresh token 회전 원자성 (트랜잭션 + 조건부 UPDATE)` 항목을 추가해 설계 결정의 근거(TOCTOU 방지, 세션 소실 방지, JWT 사전 계산 분리 이유)를 정식으로 등재한다. §1.4 인라인 주석은 흐름 참조용으로 유지해도 무방하나 Rationale 과 중복되는 분량은 요약 + 링크로 축약하면 단일 진실 원칙에 맞다.

---

### [INFO] `spec/data-flow/` 폴더명에 숫자 prefix 없음
- **target 위치**: `spec/data-flow/` (디렉토리명)
- **위반 규약**: 명시적 규약 없음. 기존 spec 영역 폴더는 모두 `2-navigation`, `3-workflow-editor`, `4-nodes`, `5-system`, `7-channel-web-chat` 처럼 숫자 prefix 를 사용.
- **상세**: `spec/data-flow/` 는 숫자 prefix 없이 도메인명만 사용하고 있어 기존 영역 폴더 명명 패턴과 다르다. 현재 정식 규약(`spec/conventions/`) 에 spec 영역 폴더명 형식을 규정하는 문서가 없고 CLAUDE.md 도 이를 명시하지 않으므로 위반이 아닌 일관성 차이다.
- **제안**: 현 폴더명 유지가 기능상 문제없으며 변경 비용(링크 전수 수정)이 크다. 다만 `spec/conventions/spec-impl-evidence.md §1` 갱신 시 이 영역을 공식 목록에 등재하면 자연스럽게 체계 안에 포함된다.

---

### [INFO] `3-error-handling.md` 의 `TOKEN_INVALID` 트리거 확장 — 에러 코드 의미 기반 명명 검토
- **target 위치**: `spec/5-system/3-error-handling.md` (변경된 `TOKEN_INVALID` 행)
- **위반 규약**: `spec/conventions/error-codes.md §1 의미 기반 명명` 및 `§2 안정성/rename 정책`
- **상세**: `TOKEN_INVALID` 의 트리거 설명이 "변조/형식 오류" 에서 "변조/형식 오류, refresh 토큰 미존재/소유자 부재, 또는 refresh 회전 시 조건부 revoke 매칭 0건(동시 회전 경합)" 으로 확장됐다. 코드명 자체는 변경되지 않았으므로 rename 정책(§2) 은 충족. `TOKEN_INVALID` 라는 이름은 동시 회전 경합 케이스에도 의미적으로 수용 가능하다(무효화된 토큰 시도). 위반은 아니며 현행 규약 범위 안이다.
- **제안**: 추가 조치 불필요. 다만 "동시 회전 경합" 케이스가 "변조/형식 오류" 와 다른 맥락임을 명확히 하고 싶다면 `error-codes.md §3 Historical-artifact 예외 레지스트리` 와 같은 방식으로 코드 의미 도메인을 보완하는 노트를 `3-error-handling.md` 에 추가하는 것이 선택지다 — 현재 수준으로도 충분히 명확하다.

---

## 요약

`spec/data-flow/` 전체 문서에 가장 중요한 규약 갭은 **frontmatter 의무 적용 범위 누락**이다: 이 영역은 `spec-impl-evidence.md §1` 의 `INCLUDE_PREFIXES` 에 포함되지 않아 lifecycle 추적 가드가 작동하지 않는다. 이는 기존 규약을 이 새 영역에 확장하지 않은 데서 비롯된 것으로, 현행 규약을 직접 위반하는 것은 아니지만 규약이 제공하려는 안전망(spec→code 증거 강제)이 누락된다. 이번 diff 에서 변경된 `2-auth.md` 의 회전 원자성 설계 근거가 Rationale 섹션이 아닌 body 주석에만 있는 것은 문서 구조 규약에서 거리가 있다. 나머지 변경사항(에러 코드 트리거 확장, 상호 참조 링크)은 정식 규약을 준수한다.

---

## 위험도

MEDIUM

`spec/data-flow/` frontmatter 누락은 CI 가드 무작동으로 이어져 이 영역이 spec-only 상태로 방치되거나 구현과 괴리가 생겨도 빌드가 감지하지 못한다.
