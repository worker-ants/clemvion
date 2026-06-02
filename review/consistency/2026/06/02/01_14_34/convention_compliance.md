# Convention Compliance Review — `spec/7-channel-web-chat/2-sdk.md`

검토 모드: spec draft (--spec)
검토일: 2026-06-02

---

## 발견사항

### [INFO] spec/7-channel-web-chat 영역은 spec-impl-evidence frontmatter 의무 대상 외
- target 위치: 문서 전체 frontmatter (`id`, `status`, `code`, `pending_plans`)
- 위반 규약: `spec/conventions/spec-impl-evidence.md §1 적용 대상`
- 상세: `spec-impl-evidence.md §1` 의 frontmatter 의무 inclusive list 는 `spec/2-`, `spec/3-`, `spec/4-`, `spec/5-`, `spec/conventions/` 만 열거한다. `spec/7-channel-web-chat/` 영역은 명시되지 않았다. target 문서가 frontmatter 를 포함하는 것은 문제가 없으나, build-time 가드(`spec-frontmatter.test.ts` 등 4건)가 이 파일을 검증하지 않는다는 점에서 frontmatter 정합성이 자동으로 보장되지 않는다.
- 제안: (a) `spec-impl-evidence.md §1` 에 `spec/7-channel-web-chat/**.md` 를 inclusive list 에 추가하거나, (b) 현행 유지(가드 미적용)를 의도라면 INFO 수준에서 수용 가능. `spec/6-brand.md` 처럼 단순 overview 성격이 아닌 이상 가드 적용을 권장.

---

### [WARNING] frontmatter `code:` 경로가 실제 구현 위치와 불일치 가능성
- target 위치: frontmatter `code: - codebase/packages/web-chat-sdk/**`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1 필드 정의` — `code:` 는 "본 spec 이 약속한 surface 의 구현 경로. 레포 루트 기준 상대경로"
- 상세: target 문서의 `code:` 는 `codebase/packages/web-chat-sdk/**` 를 가리킨다. 그러나 CLAUDE.md 폴더 구조에는 채널 위젯 SPA 가 `codebase/channel-web-chat/` 에 위치한다고 명시되어 있다. npm 패키지(`@workflow/web-chat`)의 SDK 코드가 실제로 `codebase/packages/web-chat-sdk/` 에 위치하는지, 아니면 다른 경로인지 검증이 필요하다. 경로가 stale 하거나 아직 미생성 상태라면 `status: partial` + `code:` >= 1 매치 가드를 통과하지 못한다(가드 적용 시).
- 제안: 실제 코드 경로를 확인 후 frontmatter `code:` 를 갱신하거나, 아직 경로가 없는 경우 `status: spec-only` 로 조정. `pending_plans:` 에 나열된 plan 파일들이 실존하는지도 함께 확인.

---

### [INFO] 문서 구조 — Overview 섹션 부재 (3섹션 권장 구조)
- target 위치: 문서 최상위 구조
- 위반 규약: CLAUDE.md §정보 저장 위치 — "제품 정의·요구사항 → `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`"; 3섹션 구조(Overview / 본문 / Rationale) 권장
- 상세: target 문서는 `## 1. 스니펫 로더` 부터 시작하여 직접 본문으로 진입하며 `## Overview` 섹션이 없다. Rationale 섹션은 존재한다. 서두 인용 블록(`> 관련:`)이 진입 맥락 역할을 일부 대체한다.
- 제안: 엄격한 위반은 아니나(권장 구조), Overview 섹션 추가를 통해 이 spec 문서가 무엇을 다루는지 한 문단으로 명시하면 3섹션 구조에 완전히 부합한다.

---

### [INFO] npm scope 확정 고지 블록이 Rationale 과 내용을 중복 서술
- target 위치: 문서 상단 `> **npm scope 확정**:` 인용 블록 + Rationale §R2
- 위반 규약: CLAUDE.md §정보 저장 위치 단일 진실 원칙 — 결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale` 에 기재
- 상세: target 문서는 npm scope 확정을 서두 인용 블록에서 설명하고 Rationale §R2 에서도 재서술한다. 결정 자체는 `eia-sdk-publish.md §결정 #3` 이 SoT 이므로 서두와 Rationale 양쪽에서 동일 내용을 서술하는 것은 단일 진실 원칙상 거리가 있다.
- 제안: 서두 블록은 "확정 결과(패키지명) + SoT 링크" 한 줄로 축소하고, 배경·근거는 Rationale §R2 에만 유지.

---

## 요약

target 문서(`spec/7-channel-web-chat/2-sdk.md` 제안 버전)는 `spec/conventions/` 의 정식 규약을 직접 위반하는 CRITICAL 항목이 없다. 주요 관찰: (1) `spec/7-channel-web-chat/` 영역이 `spec-impl-evidence.md` 의 frontmatter 의무 대상 inclusive list 에 포함되지 않아 build-time 가드가 적용되지 않으며, 영역 추가 여부를 결정해야 한다(INFO). (2) `code:` 에 지정된 `codebase/packages/web-chat-sdk/**` 경로가 실제 위치와 일치하는지 검증이 필요하며, 불일치 시 `status: partial` 의 `code:` >= 1 매치 가드 위반이 된다(WARNING). (3) 문서 구조 3섹션 중 Overview 가 생략됐으나 Rationale 은 있고 인용 블록이 역할을 대체하므로 INFO 수준이다. npm scope 확정 내용은 단일 진실 원칙상 Rationale 로 집중시키는 것을 권장한다. 전반적으로 규약 준수 수준은 양호하며 WARNING 1건, INFO 3건이다.

## 위험도

LOW
