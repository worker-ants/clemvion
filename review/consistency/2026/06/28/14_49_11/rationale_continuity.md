# Rationale 연속성 검토 결과

검토 범위: `spec/7-channel-web-chat/` (diff-base: `origin/main`, impl-done 모드)
변경 파일: `spec/7-channel-web-chat/1-widget-app.md`, `2-sdk.md`, `5-admin-console.md`

---

## 발견사항

### 1. **[INFO]** 입력창 활성 조건 확장 — `pending=null` 추가, 기존 Rationale 와 정합

- **target 위치**: `spec/7-channel-web-chat/1-widget-app.md` §2 화면 구조 표 "입력창" 행
- **과거 결정 출처**: `1-widget-app.md ## Rationale §R6` (eager-start 전환 결정)
- **상세**: 기존 spec 은 입력창 활성 조건을 `awaiting_user_message + ai_conversation 표면`으로 기술했다. 이번 변경은 이를 `텍스트 표면 = ai_conversation OR pending=null`(ai_conversation 도달 전 과도 상태)로 확장하고 판정 SoT 를 `widget-state.isTextInputSurface` 로 지정했다. `§R6` 의 큐 게이팅 규칙("첫 표면이 `buttons`/`form` 이면 큐 폐기")과 논리적으로 정합하며, 이 조건 확장은 기각된 대안을 재도입하거나 invariant 를 깨지 않는다. `isTextInputSurface(null)=true` 는 구현 코드(`widget-state.ts:31`)에서 확인된다.
- **평가**: Rationale 위반 없음. `§R6` 큐 게이팅 근거의 자연스러운 구현 정밀화다. 선택적으로 `§R6` 끝에 "입력창의 `pending=null` 과도 상태 포함" 한 줄 메모를 추가하면 연속성이 더 명확해진다.
- **제안**: 현재 수준으로 충분하나, `1-widget-app.md §R6` 의 "큐 게이팅" 단락에 `pending=null(과도 상태)도 텍스트 표면으로 간주 → flush 허용`임을 한 줄 언급하면 향후 리더가 `§R6` 만 보고도 전 동작을 이해할 수 있다.

---

### 2. **[INFO]** `resetSession` 메서드 스니펫 목록 추가 — 기존 Rationale 와 충돌 없음

- **target 위치**: `spec/7-channel-web-chat/2-sdk.md` §1 스니펫 로더 메서드 목록
- **과거 결정 출처**: `2-sdk.md ## Rationale §R3` (구독 해제·전역명 충돌 방지), `5-admin-console.md §3 §wc:command resetSession`
- **상세**: 기존 `§1` 메서드 열거에 `resetSession` 이 빠져 있었고 이번에 추가됐다. `wc:command resetSession` 은 `2-sdk.md §3` 의 postMessage 프로토콜 표에 이미 정의되어 있었고, `5-admin-console.md §6` 의 "새 세션" 버튼도 이 명령을 참조하고 있었다. 따라서 이번 변경은 §1 산문 목록이 §3 프로토콜 표와 `ChatInstance` §5 타입을 완전히 반영하지 못하던 누락을 교정한 것이다. 어떤 Rationale 도 `resetSession` 을 명시적으로 배제하거나 기각하지 않았다.
- **평가**: Rationale 위반 없음. 기존 §3 과 §5 의 정의와 §1 산문 목록 사이의 drift 수정이다.

---

### 3. **[INFO]** `5-admin-console.md` 링크 오류 수정 (`R5` → `§R2`) — 합의 원칙 재정렬

- **target 위치**: `spec/7-channel-web-chat/5-admin-console.md` §2 본문 및 Rationale §R1
- **과거 결정 출처**: `0-architecture.md ## Rationale §R2` (클라이언트 consumer 원칙)
- **상세**: 기존 `5-admin-console.md` §2 와 §R1 은 "client-consumer 원칙"의 출처를 `0-architecture R5`(iframe 문서 관련 rationale)로 잘못 링크하고 있었다. 실제 client-consumer 원칙의 SoT 는 `0-architecture §R2`("EIA 외부 consumer 로 한정, facade 미신설")이다. 이번 변경이 이를 `§R2`로 교정했다.
- **평가**: Rationale 위반 없음. 잘못 링크된 Rationale 참조를 올바른 항으로 수정한 교정이다.

---

### 4. **[INFO]** `5-admin-console.md` Overview 섹션 헤더 정규화

- **target 위치**: `spec/7-channel-web-chat/5-admin-console.md` `## Overview (제품 정의)` → `## Overview`
- **과거 결정 출처**: 프로젝트 공통 규약 (CLAUDE.md 3섹션 구성: Overview / 본문 / Rationale)
- **상세**: `## Overview (제품 정의)` 는 공통 3섹션 규약의 `## Overview` 표준에서 벗어난 drift 였다. 이번 변경이 표준 헤더로 정규화했다.
- **평가**: Rationale 위반 없음. 규약 정합 교정이다.

---

## 요약

이번 변경(`webchat-polish-batch-99e2ed`)의 spec 변경 3건은 모두 Rationale 연속성 관점에서 충돌이 없다. 가장 실질적 변경인 입력창 활성 조건의 `pending=null` 과도 상태 포함은 `1-widget-app §R6` 의 큐 게이팅 원칙에서 논리적으로 파생되는 정밀화이며, `§R6` 가 기각했던 "lazy 모델" 또는 "`firstMessage` 동봉" 을 재도입하지 않는다. `resetSession` 메서드 추가는 기각 이력이 없는 정의 누락 교정이고, 링크 오류 수정과 헤더 정규화는 기존 합의 원칙을 강화하는 방향의 변경이다. 기각된 대안의 재도입, 합의된 invariant 위반, 무근거 번복 중 어느 것도 발견되지 않았다.

## 위험도

NONE
