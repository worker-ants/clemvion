# Plan 정합성 검토 결과

검토 범위: `spec/7-channel-web-chat/` (구현 완료 후 검토, diff-base=origin/main)
관련 plan: `plan/in-progress/web-chat-console.md`, `plan/in-progress/spec-draft-web-chat-console.md`

---

## 발견사항

### 1. [WARNING] Phase 0 체크박스 미갱신 — 이미 작성된 spec 을 "[ ] 미완료"로 표시 중

- **target 위치**: `plan/in-progress/web-chat-console.md` § Phase 0 "spec 반영" (라인 45–51)
- **관련 plan**: `plan/in-progress/web-chat-console.md` 자체
- **상세**: Phase 0 의 spec 반영 항목들이 `[ ]`(미완료)로 표시되어 있으나, 실제 spec 파일들은 이미 작성 완료 상태다.
  - `spec/7-channel-web-chat/5-admin-console.md` — 존재, `status: partial`, code 경로 등재
  - `spec/2-navigation/_layout.md` — Web Chat 항목 등록 완료 (§1 ASCII + §2.2 메뉴 행)
  - `spec/2-navigation/_product-overview.md` — NAV-WC-01..06 요구사항 6건 추가 완료
  - `spec/7-channel-web-chat/_product-overview.md` — 구성요소 D 추가 + 비목표 명확화 + Rationale 완료
  - `spec/7-channel-web-chat/0-architecture.md §4` — env 2건(NEXT_PUBLIC_WIDGET_CDN_BASE·WEB_CHAT_WIDGET_ORIGINS) + §4.1 동봉(co-deploy) + 버전잠금 완료
  - `spec/0-overview.md §8` — 이미 `[x]` 체크됨
- **제안**: `plan/in-progress/web-chat-console.md` Phase 0 의 미완료 `[ ]` 항목 5건을 `[x]`로 갱신. spec 이 실제로 작성된 상태를 추적에 반영해야 한다. (plan 자체가 진행 상황의 단일 진실이므로, 체크박스 불일치는 다음 담당자에게 오해를 준다.)

---

### 2. [WARNING] Phase 3 착수 전 spec 선결 사항이 현재 spec §6 에 미반영

- **target 위치**: `spec/7-channel-web-chat/5-admin-console.md §6 라이브 미리보기`
- **관련 plan**: `plan/in-progress/web-chat-console.md` Phase 3 항목 (라인 74–75)
  > "(착수 전 spec 선결, ai-review W-1) `5-admin-console §6` 에 already-loaded iframe 에 boot config 를 전달하는 메커니즘(URL query param vs `wc:boot` postMessage, `2-sdk §3` 프로토콜)을 명시 → project-planner 위임. 미정의 시 Phase 3 구현 방향 모호."
- **상세**: `5-admin-console.md §6`은 "same-origin 동봉 위젯을 iframe 으로 로드"까지 정의했으나, already-loaded iframe 에 외형 draft(boot config)를 전달하는 메커니즘(URL query param 주입 vs `wc:boot` postMessage 등)은 기술되지 않았다. 이는 plan 이 Phase 3 착수 조건으로 명시한 미결 spec 갭이다.
- **제안**: Phase 3 구현 착수 전, project-planner 가 `5-admin-console.md §6`에 boot config 전달 메커니즘을 명시해야 한다. 현재 Phase 3 는 아직 미시작이라 구현 방향 모호 상태이지만 충돌은 없다. 단, Phase 3 착수 시 이 spec 갭이 해소되지 않으면 CRITICAL 으로 격상된다.

---

### 3. [INFO] Phase 0 spec 작성 순서 역전 — spec-only/code:[] 로 작성 예정이었으나 partial/code 포함으로 직접 작성

- **target 위치**: `spec/7-channel-web-chat/5-admin-console.md` frontmatter (status, code)
- **관련 plan**: `plan/in-progress/web-chat-console.md` Phase 0 라인 46, `plan/in-progress/spec-draft-web-chat-console.md` §2.1 frontmatter 규정
- **상세**: `spec-draft-web-chat-console.md §2.1`은 5-admin-console.md 의 초기 frontmatter 를 `status: spec-only`, `code: []`로 명시했다. 그러나 실제 spec 은 구현(Phase 2 증분 1)이 완료된 후 `status: partial` + 실제 code 경로를 포함해 작성됐다. plan-lifecycle 순서(spec-only → partial)를 건너뛴 것이지만, 구현 완료 후 한번에 반영한 것으로 결과적으로 spec 과 구현이 정합한 상태다. 문서 이력 추적 관점의 차이이며 정합성 오류는 아니다.
- **제안**: 특별한 조치 불필요. plan 의 Phase 0 체크박스 갱신(발견사항 #1) 으로 추적이 충분하다.

---

### 4. [INFO] `spec-draft-web-chat-console.md` — draft 의 "미설정 시 비활성+경고" fallback 정책이 최종 spec 에서 "self-origin 기본값" 으로 변경됐으나 draft 파일 미수정

- **target 위치**: `plan/in-progress/spec-draft-web-chat-console.md §2.1` 5-admin-console §5 설치 스니펫 fallback 기술
- **관련 plan**: `plan/in-progress/web-chat-console.md` 핵심 결정 + Phase 0 (라인 34, 53)
- **상세**: `spec-draft-web-chat-console.md §2.1`은 "NEXT_PUBLIC_WIDGET_CDN_BASE 미설정 시 스니펫 생성·미리보기 UI 비활성+경고"라고 기술했으나, 동봉(co-deploy) 결정(2026-06-23)으로 최종 정책이 "미설정 시 self-origin 기본값" 으로 전환됐다. 최종 spec(`5-admin-console.md §5`)은 새 정책을 따르고, `web-chat-console.md`도 이를 명시했다. draft 파일의 구 정책이 잠재적 오독 소지가 있으나, draft 는 구현 plan 보다 하위 참조 문서라 직접적 정합성 위반은 아니다.
- **제안**: `spec-draft-web-chat-console.md §2.1`의 해당 fallback 설명에 "→ co-deploy 결정으로 self-origin 기본값으로 변경됨(web-chat-console.md 핵심 결정 참조)" 주석을 추가하거나, draft 파일을 이력 문서로 표시해 오독을 방지.

---

## 요약

Plan 정합성 관점에서 주요 문제는 두 가지다. (1) `plan/in-progress/web-chat-console.md` Phase 0 의 spec 반영 체크박스 5건이 실제 완료됐음에도 `[ ]`로 남아 진행 상황을 오독하게 할 수 있다 — 즉시 `[x]` 갱신이 필요하다. (2) Phase 3 착수 전 spec 선결 사항(5-admin-console §6 boot config 전달 메커니즘)이 현재 spec 에 미정의 상태이며 plan 이 이를 정확히 인지·블로킹 중이므로 Phase 3 착수 전 project-planner 가 반드시 보완해야 한다. 미해결 결정을 일방적으로 우회하는 충돌은 발견되지 않았고, 핵심 결정(동봉·self-origin·trigger 재사용·외형 미저장)은 spec 과 plan 이 일치한다.

## 위험도

LOW
