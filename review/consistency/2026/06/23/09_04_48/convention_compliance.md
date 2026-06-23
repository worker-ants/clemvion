# 정식 규약 준수 검토 결과

target: `plan/in-progress/spec-draft-web-chat-console.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-06-23

---

## 발견사항

### [INFO] plan frontmatter 비필수 필드 `kind`·`status`·`scope`·`related`·`created` 사용

- target 위치: frontmatter (lines 1–38)
- 위반 규약: `.claude/docs/plan-lifecycle.md §4` — plan/in-progress frontmatter 필수 필드는 `worktree`·`started`·`owner` 3개. 추가 필드는 "허용"되나 규약에 정의된 공식 필드가 아님
- 상세: `kind: spec-draft`, `status: draft`, `scope:`, `related:`, `created:` 는 plan-lifecycle §4 에 정의되지 않은 비공식 확장 필드다. `build guard plan-frontmatter.test.ts` 는 이 필드 존재 자체를 fail 시키지 않으므로 가드 위반은 아니나, `status` 는 spec frontmatter 의 lifecycle enum 과 혼동 가능성이 있고, `created` 는 `started` 와 의미 중복이다.
- 제안: `status`·`created` 비공식 필드 제거하고 표준 필드만 유지. `kind`·`scope`·`related` 는 plan 내 prose 로 옮기는 것이 규약 정합. 최소한 `status: draft` 가 spec frontmatter 의 `status` enum(backlog/spec-only/partial/implemented/archived)과 혼동되지 않도록 다른 키 이름 사용 권장.

---

### [WARNING] 신규 spec `5-admin-console.md` 의 frontmatter 에 `pending_plans:` 경로가 미존재 plan 을 가리킬 수 있음

- target 위치: §2.1 `spec/7-channel-web-chat/5-admin-console.md` 제안 frontmatter
- 위반 규약: `spec/conventions/spec-impl-evidence.md §4` — `spec-pending-plan-existence.test.ts` 는 `pending_plans:` 의 모든 path 가 `plan/in-progress/` 또는 `plan/complete/`(in-progress→complete 치환) 에 실존 의무
- 상세: draft 는 `pending_plans: - plan/in-progress/web-chat-console.md` 를 선언하고 "spec write 전에 그 plan 파일을 먼저 생성해야" 라고 주석을 달았다. 이 순서 제약(plan 파일 생성 → spec write)은 정확하며 가드와 일치한다. 단, draft 자체(plan 문서)는 현재 그 plan 파일 없이 작성됐으므로, spec 반영 시점에 실제로 `plan/in-progress/web-chat-console.md` 가 존재하지 않으면 빌드 fail 이 발생한다. draft 단계에서 이미 이 순서를 명시한 것은 규약 인식 측면에서 올바르나, Phase 0 실행 시 plan 파일 생성이 spec write 보다 반드시 앞서야 한다는 점을 집행 단계에서 재확인 필요.
- 제안: 현재 draft 의 주석(§3 "순서 주의" 박스)이 이미 이를 적시하고 있으므로 draft 자체의 수정은 불필요. spec 반영 Phase 0 실행 체크리스트에 "1. `web-chat-console.md` plan 파일 생성 먼저 → 2. spec write" 순서를 명확히 유지할 것.

---

### [WARNING] 신규 spec `5-admin-console.md` 의 배치 결정 미확정 — `spec-area-index.test.ts` 차단 가능성

- target 위치: §2.1 "문서 배치(잠정)" 박스
- 위반 규약: `spec/conventions/spec-impl-evidence.md §4.2` — `spec-area-index.test.ts` 는 각 영역 폴더(≥2 sibling)에 모든 sibling spec 이 index 에서 링크 의무를 강제함
- 상세: draft 는 최종 배치를 `7-channel-web-chat/5-admin-console.md` 또는 `2-navigation/<N>-web-chat.md` 두 후보 중 하나로 열어두었다. 어느 쪽에 배치하든 해당 영역의 area index 에 링크가 등재되어야 `spec-area-index.test.ts` 를 통과한다. 현재 `spec/7-channel-web-chat/` 에는 area index 파일이 없으며(`_product-overview.md`·`0-architecture.md` 등 파일이 5개), `spec/2-navigation/` 에는 `_product-overview.md`(밑줄 prefix — 면제)와 다수 번호 파일이 있다. 신규 파일을 2-navigation 에 추가하면 기존 index 문서에서 링크 추가가 의무다.
- 제안: spec write 시 배치 확정과 동시에 해당 영역 index(또는 적절한 index 파일)에 링크를 추가할 것. `spec/7-channel-web-chat/` 에 배치 시 area index 파일 존재 여부도 확인.

---

### [CRITICAL] `5-admin-console.md` 에 `status: spec-only` + `pending_plans:` 를 동시 선언할 때 plan 파일 미존재 시 빌드 즉시 fail

- target 위치: §2.1 frontmatter 블록, §3 "순서 주의" 박스
- 위반 규약: `spec/conventions/spec-impl-evidence.md §4` — `spec-pending-plan-existence.test.ts` 는 `pending_plans:` 선언 즉시 파일 실존 강제. `status: spec-only` 라도 `pending_plans:` 가 있으면 동일 가드 적용.
- 상세: spec 파일(`5-admin-console.md`)을 write 하는 시점에 `plan/in-progress/web-chat-console.md` 가 존재하지 않으면 빌드가 즉시 fail 한다. draft 는 §3 에서 "plan 파일 생성 → spec write 순서" 를 명시했으나, 이것은 저자 의도이지 가드가 집행하는 순서가 아니다. spec write commit 이 먼저 푸시되면 CI 가 바로 차단한다. 이 순서 역전 실수는 worktree 내 작업 순서만 지키면 막을 수 있으나, 잘못된 순서로 commit 을 쌓으면 revert 가 필요하다.
- 제안: Phase 0 실행 절차에 다음 순서를 **같은 commit 또는 순서 보장된 별도 commit** 으로 명시: (1) `plan/in-progress/web-chat-console.md` 생성 및 커밋 → (2) `spec/7-channel-web-chat/5-admin-console.md` (또는 `2-navigation/<N>-web-chat.md`) write 및 커밋. 두 파일을 같은 commit 에 넣어도 가드 통과 가능.

---

### [INFO] `NEXT_PUBLIC_WIDGET_CDN_BASE` env 신설 — `spec/7-channel-web-chat/0-architecture.md §4` 에 등재 지시

- target 위치: §2.5, §1.3
- 위반 규약: 직접 위반 없음. 기존 `0-architecture.md` 가 `status: partial` + `pending_plans:` 를 보유하므로 해당 spec 갱신 시 frontmatter 의 `code:` 도 유효 경로 유지 필요
- 상세: `NEXT_PUBLIC_WIDGET_CDN_BASE`(admin frontend)·`WEB_CHAT_WIDGET_ORIGINS`(backend) 두 env 를 `0-architecture §4` 에 등재하는 것은 정보 저장 위치 원칙상 올바르다. 다만 `0-architecture.md` 는 현재 pending_plans 에 여러 plan 파일이 등재돼 있어 spec 변경 시 기존 pending_plans 상태와의 정합을 확인해야 한다.
- 제안: `0-architecture.md` 갱신 시 기존 `pending_plans:` 목록이 여전히 in-progress 인지 확인 후 필요 시 최신화.

---

### [INFO] `spec/2-navigation/_product-overview.md` 에 `NAV-WC-*` 요구사항 블록 신설 — 기존 NAV-* 패턴 준수 확인

- target 위치: §2.4
- 위반 규약: 해당 없음 — 규약 준수 확인
- 상세: `NAV-WC-*` prefix 는 기존 `NAV-WF-*`·`NAV-TR-*`·`NAV-SC-*` 패턴과 일치하는 올바른 규약 준수다. 요구사항 블록 신설 위치(`2-navigation/_product-overview.md`) 도 올바르다. 상태 컬럼에 이모지 표기 시 기존 양식(`✅`·`🚧` 등)과 일관성 있게 맞출 것.
- 제안: 이상 없음.

---

### [INFO] i18n 의무 — `sidebar.webChat` ko/en dict 동반 갱신 명시는 규약 준수

- target 위치: §2.3 "i18n dict 의무" 단락
- 위반 규약: 해당 없음 — `spec/conventions/i18n-userguide.md` Principle 1·2 준수 확인
- 상세: draft 가 Principle 1·2 를 직접 인용하며 ko/en dict 양쪽 갱신 의무를 spec 본문 의무로 명시한 것은 올바르다. 콘솔 페이지 문자열 `web-chat` dict 쌍 명시도 Principle 2 (parity) 를 지킨다.
- 제안: spec 본문(`5-admin-console.md`)에도 i18n dict 키 목록(`sidebar.webChat`, `webChat.*`)을 예시로 명시해 구현자가 누락하지 않도록 보강 권장.

---

### [INFO] `5-admin-console.md` 배치 후보 판단 — 규약상 `2-navigation/` 배치가 지배적 패턴

- target 위치: §2.1 "문서 배치(잠정)" 박스
- 위반 규약: CLAUDE.md "정보 저장 위치" 원칙 — `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview` 에 제품 정의, `spec/<영역>/*.md` 에 기술 명세
- 상세: 기존 메뉴 화면 spec 들(`3-schedule.md`·`4-integration.md`·`5-knowledge-base.md` 등)은 모두 `spec/2-navigation/` 에 위치하며, nav-area 페이지 spec = 2-navigation 폴더가 지배적 패턴이다. `7-channel-web-chat/` 은 채널 기술 spec(위젯 아키텍처·SDK·보안·EIA 클라이언트) 을 담는 폴더로 역할이 분리되어 있다. 콘솔은 채널의 관리 surface 이지만 화면 spec 의 SoT 는 nav 영역이 적합하다.
- 제안: `spec/2-navigation/<next_number>-web-chat.md` 로 배치 권장. `7-channel-web-chat/` 에는 §2.2(`_product-overview.md`)·§2.5(`0-architecture.md`) 수정만 수행. 이 결정은 규약 강제 사항이 아닌 패턴 권고이므로 `7-channel-web-chat/` 선택도 가드 fail 을 유발하지는 않는다.

---

## 요약

`plan/in-progress/spec-draft-web-chat-console.md` 는 전반적으로 정식 규약을 올바르게 인식하고 있으며, spec frontmatter status enum 선택(`spec-only`), 요구사항 ID 패턴(`NAV-WC-*`), i18n Principle 1·2 의무 명시, 문서 3섹션 구조(Overview/본문/Rationale) 모두 규약에 부합한다. CRITICAL 위험은 신규 spec 의 `pending_plans:` 선언과 참조 plan 파일 생성의 순서 의존성이다 — spec write commit 시점에 `plan/in-progress/web-chat-console.md` 가 존재해야 빌드 fail 을 피할 수 있으며, 두 파일을 같은 commit 에 넣거나 plan 파일 생성 commit 을 먼저 쌓는 방식으로 집행해야 한다. WARNING 2건은 area index 등재 의무(`spec-area-index` 가드)와 동일한 pending plan 실존 의무를 spec write 시점에 집행해야 한다는 점이다. 배치 결정(`7-channel-web-chat/` vs `2-navigation/`)은 규약 강제 사항이 아니나 기존 지배적 패턴(`2-navigation/`) 을 따르는 것이 일관성 측면에서 권장된다.

---

## 위험도

MEDIUM
