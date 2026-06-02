# Convention Compliance Review

**Target**: `spec/7-channel-web-chat/2-sdk.md` (draft version in prompt payload)
**Mode**: spec draft (--spec)
**Date**: 2026-06-02

---

## 발견사항

### [CRITICAL] npm 패키지명이 기존 파일과 충돌 — 단일 진실 위반

- **target 위치**: 프롬프트 페이로드 도입부 확정 블록 `> **npm scope 확정**: 패키지명은 @workflow/web-chat — eia-sdk-publish.md §결정 #3` 및 §2 섹션 헤더 `## 2. npm 패키지 @workflow/web-chat (개발자용)`
- **위반 규약**: CLAUDE.md "정보 저장 위치 — 단일 진실 원칙"; `spec/conventions/spec-impl-evidence.md` §1 (단일 진실 원칙)
- **상세**: draft는 npm scope를 `@workflow/web-chat`으로 "확정"으로 선언하나, 실제 repo의 (a) `spec/7-channel-web-chat/2-sdk.md`는 `@clemvion/web-chat`을 잠정으로 유지하고, (b) `codebase/packages/web-chat-sdk/package.json`의 `"name"`도 `"@clemvion/web-chat"`이며, (c) `plan/in-progress/eia-sdk-publish.md` §결정 #3 scope 항목이 아직 미채움(미결) 상태다. draft가 미결 plan 결정을 이미 완료된 것으로 기정사실화해 spec·plan·코드 세 곳의 단일 진실이 동시에 어긋난다.
- **제안**: `eia-sdk-publish.md` §결정 #3이 실제로 `@workflow/*`로 채워지고 `package.json`이 동시에 갱신된 뒤에 spec draft를 확정 처리해야 한다. 그 전까지는 `@workflow/web-chat` "확정" 표기 대신 잠정 표기(`eia-sdk-publish.md 결정 종속`)를 유지한다. 또는 동일 commit에 `package.json` rename + plan 결정 항목 채움 + spec 갱신을 묶는다.

---

### [WARNING] 문서 구조 — Overview 섹션 없음 (3섹션 권장 미준수)

- **target 위치**: 문서 전체 섹션 구조 (§1 스니펫 로더 → §2 npm 패키지 → §3 postMessage 프로토콜 → §4 Boot config 스키마 → Rationale)
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장
- **상세**: Overview 섹션이 없이 §1 본문으로 바로 진입한다. 본 문서 범위(loader + npm SDK + postMessage 계약)를 요약하는 `## Overview`가 없으면 처음 읽는 구현자가 이 spec의 경계를 파악하는 데 더 많은 맥락을 요구한다. `_product-overview.md`가 영역 Overview 역할을 하더라도 개별 spec 파일의 Overview는 해당 파일 범위를 명시하는 별도 역할이다.
- **제안**: 본문 앞에 `## Overview` 섹션을 추가해 "본 spec 범위 = CDN 스니펫 로더 + npm SDK + postMessage 프로토콜 + BootConfig 스키마"를 한 문단으로 명시한다. 기존 도입부 blockquote들을 이 섹션 하단으로 이동하거나 통합하는 것도 가능하다.

---

### [WARNING] Rationale 번호 체계 — R1 없이 R2, R3부터 시작

- **target 위치**: `## Rationale` → `### R2.` / `### R3.`
- **위반 규약**: CLAUDE.md "결정의 배경·근거 — 해당 spec 문서 끝의 `## Rationale`". 프로젝트 관행상 Rationale은 R1부터 순차 번호를 사용하며 cross-reference 일관성을 유지한다 (예: `spec/conventions/chat-channel-adapter.md` R1~R4, R-CCA-*).
- **상세**: R1이 존재하지 않아 외부에서 `2-sdk §R1`을 참조하려 할 때 문서에 없는 앵커를 찾게 된다. 삭제된 R1의 흔적이거나 의도적 시작점이라면 그 사유를 Rationale 섹션 도입에 명시해야 한다.
- **제안**: (a) 삭제된 R1이 있었다면 Rationale 섹션 첫 줄에 번호 체계 설명(예: "R1 — [내용 없음, 향후 예약]")을 두거나, (b) 남은 항목을 R1, R2로 renumber한다.

---

### [WARNING] 공개 SDK 인스턴스 메서드 타입 계약 미명시 — on()/off()/구독 해제 패턴

- **target 위치**: §1 스니펫 로더 메서드 목록 (`on(event, cb)` / `off(event, cb?)` / 구독 해제 함수 반환), §2 npm 예시 (`const unsubscribe = chat.on(...)`)
- **위반 규약**: 공식 규약은 없으나 CLAUDE.md "기술 명세 — spec/<영역>/*.md 본문"이 타입 계약을 명시적으로 문서화해야 하는 의무를 내포. `spec/conventions/node-output.md` Principle 11 유추 적용 (API shape과 예시의 정합성).
- **상세**: `on()` 반환 타입(구독 해제 함수 `() => void`)과 `off(event, cb?)` 시그니처가 TypeScript interface로 어디에도 명시되어 있지 않다. §4는 BootConfig(입력 옵션)만 타입화하며, 반환되는 인스턴스 메서드 계약은 산문 설명과 예시 코드에 의존한다. 구현자가 `off(event)` (이벤트 전체 해제) vs `off(event, cb)` (특정 핸들러 해제) 차이를 TypeScript 시그니처 없이 산문으로만 파악해야 한다.
- **제안**: §4(또는 별도 §5)에 `interface ClemvionChatInstance` 또는 동등한 TypeScript 타입을 추가해 `on()`, `off()`, `open()`, `close()`, `shutdown()`, `updateProfile()`, `sendMessage()` 시그니처를 명시한다.

---

### [INFO] 마크다운 표 셀 내 파이프 문자 이스케이프 누락

- **target 위치**: §3 postMessage 프로토콜 표 `wc:resize` 행, 페이로드 열 `{ width, height, state: 'collapsed'|'expanded' }`
- **위반 규약**: 마크다운 표준 표 문법 (표 셀 안의 `|`는 `\|`로 이스케이프해야 함)
- **상세**: 마크다운 렌더러가 `|`를 셀 구분자로 해석해 표가 깨질 수 있다.
- **제안**: `state: 'collapsed'\|'expanded'` 로 백슬래시 이스케이프하거나 페이로드 상세를 표 아래 코드 블록으로 이동한다.

---

### [INFO] frontmatter `id` — 파일 basename과 불일치 (권장 벗어남)

- **target 위치**: frontmatter `id: web-chat-sdk`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §2.1 "id — 파일 basename(확장자 제외) 기반 권장"
- **상세**: 파일명 `2-sdk.md`의 basename은 `2-sdk`이지만 `id`는 `web-chat-sdk`다. 규약은 "권장"이므로 필수 위반은 아니다. 더 서술적인 id가 허용되나, 다른 파일들의 id 패턴과 일관성을 확인할 필요가 있다.
- **제안**: 현행 유지 가능. 다만 영역 내 다른 파일 id 패턴(`0-architecture` → `id: web-chat-architecture` 등)과 일치하도록 정비하면 일관성이 높아진다.

---

## 요약

`spec/7-channel-web-chat/2-sdk.md` draft의 가장 심각한 문제는 **npm 패키지 scope(`@workflow/web-chat`)를 "확정"으로 선언했으나, `plan/in-progress/eia-sdk-publish.md`의 scope 결정 항목이 미채움 상태이고 `codebase/packages/web-chat-sdk/package.json`도 `@clemvion/web-chat`을 유지 중이어서 spec·plan·코드 세 곳의 단일 진실이 동시에 어긋난다**는 점이다 (CRITICAL). 문서 구조 면에서는 Overview 섹션 부재와 Rationale 번호가 R2부터 시작하는 점이 규약 권장과 어긋나며 (WARNING), 공개 SDK 인스턴스 메서드(on/off 포함)의 TypeScript 타입 계약이 산문 설명과 예시에만 의존해 명확성이 부족하다 (WARNING). 마크다운 표 파이프 이스케이프 및 frontmatter id 불일치는 경미한 형식 문제(INFO)다. `spec/7-channel-web-chat/` 영역은 `spec-impl-evidence.md` §1의 frontmatter 의무 적용 inclusive list(spec/2~5, spec/conventions)에 포함되지 않으므로 frontmatter 가드 자체는 위반이 아니나, 자발적으로 frontmatter를 두고 있으므로 해당 필드들은 규약을 준수해야 한다.

## 위험도

**HIGH** — npm scope 확정 선언이 plan·코드 단일 진실을 깨뜨리며, 해당 scope로 구현이 착수될 경우 패키지명 rename 비용 및 downstream 의존 코드 수정이 발생한다.
