# Convention Compliance Review — `spec/7-channel-web-chat/`

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/7-channel-web-chat/, diff-base=origin/main)

---

## 발견사항

### [INFO] `4-security.md` frontmatter `id` 가 basename 과 불일치 — 의도된 패턴이나 주석 없음
- **target 위치**: `spec/7-channel-web-chat/4-security.md` frontmatter `id: web-chat-security`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — "파일 basename 기반 권장. 같은 basename 이 영역을 달리해 중복될 때는 후발 문서가 영역 prefix 로 충돌을 회피한다"
- **상세**: `id: web-chat-security` 는 basename `4-security` 가 아니라 `web-chat-security` 다. 문서 내 주석(`# basename '4-security' 와 의도적으로 다름 — 타 영역의 '4-security' 슬러그와 충돌 방지`)이 이를 설명하고 있다. 규약 §2.1 은 이 패턴을 허용하지만 "basename 불일치처럼 보여도 의도된 패턴"이라는 인라인 설명이 문서 안에 있으므로 규약 위반은 아니다. 다만 규약 §2.1 이 주석을 frontmatter 에 두도록 명시하지는 않으므로 형식 차이만 존재한다.
- **제안**: 현 상태 유지 가능. `spec-impl-evidence §2.1` 이 이미 이 패턴을 명시적으로 허용하므로 가드도 통과한다. 추가 조치 불필요.

### [INFO] `_product-overview.md` 에 frontmatter(`id`/`status`) 없음 — 규약상 면제 대상
- **target 위치**: `spec/7-channel-web-chat/_product-overview.md` (frontmatter 없음)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §1` (적용 대상) + §2 (frontmatter 스키마)
- **상세**: `_product-overview.md` 는 `_` prefix 로 시작하는 파일이라 `spec-impl-evidence §1` 제외 목록("spec/<영역>/_*.md (밑줄 prefix — leaf 가 아닌 layout/index 성격)")에 해당한다. frontmatter 의무가 면제된다. 위반 아님.
- **제안**: 이미 규약 준수. 추가 조치 불필요.

### [INFO] `_product-overview.md` 에 `## Rationale` 섹션 없음 — 권장 구조 미완
- **target 위치**: `spec/7-channel-web-chat/_product-overview.md` 전체 구조
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장
- **상세**: `_product-overview.md` 는 Overview·본문·Rationale 3섹션 구성을 권장받는데, 파일 내 Rationale 섹션이 `## Rationale` 제목 아래 있으나 "제품 영역 분리" · "운영 콘솔과 외형 저장 범위의 경계" 두 항목이 있다. 이 섹션 자체는 정상이다. 위반 아님.
- **제안**: 추가 조치 불필요.

### [INFO] `3-auth-session.md` 에 `## Overview` 섹션 없음 — 권장 3섹션 부재
- **target 위치**: `spec/7-channel-web-chat/3-auth-session.md` 전체 구조
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)"
- **상세**: `0-architecture.md` · `2-sdk.md` 에는 Rationale 섹션이 있고, `4-security.md` 에는 `## Overview` + 본문 + `## Rationale` 3섹션 구조가 있다. 그러나 `3-auth-session.md` 는 `## Overview` 없이 바로 `## 1. 공개 위젯 = webhook 인증 없음` 으로 시작하고 끝에 `## Rationale` 을 둔다. `1-widget-app.md` 도 동일 패턴 (Overview 없음). 일부 spec 은 Overview 섹션 없이 바로 본문으로 시작하는 것이 기존 패턴으로 보이므로 강제 규약 위반은 아니나 `4-security.md` 와의 일관성이 낮다.
- **제안**: INFO 수준. 영역 내 3섹션 통일이 유지보수에 도움이 되나 강제 규약이 아님.

### [INFO] 구현 diff 의 변경 범위가 `3-auth-session §R6` spec 변경과 정확히 정합됨 — 문서 규약 준수 확인
- **target 위치**: `codebase/channel-web-chat/src/lib/session-store.ts` diff (localStorage → sessionStorage 전환)
- **위반 규약**: 없음. 확인 사항.
- **상세**: diff 는 `session-store.ts` 에서 `localStorage` → `sessionStorage` 로 교체하고, 주석이 `spec/7-channel-web-chat/3-auth-session §R6` 를 명시한다. spec `3-auth-session.md §R6` 및 `1-widget-app §3.1` 이 sessionStorage 를 명시적으로 규정하며, 코드 주석이 SoT(단일 진실)를 정확히 참조한다. API 명명·출력 포맷 등 규약 차원의 일탈 없음.
- **제안**: 추가 조치 불필요.

### [INFO] `system-status.e2e-spec.ts` e2e 픽스는 본 PR 구현과 무관한 pre-existing drift 수정 — 명시적으로 주석 처리됨
- **target 위치**: `codebase/backend/test/system-status.e2e-spec.ts` diff (EXPECTED_QUEUE_NAMES 에 `workspace-invitations-pruner` 추가)
- **위반 규약**: 없음.
- **상세**: 주석이 "본 PR(web-chat sessionStorage)과 무관한 pre-existing e2e drift 수정"이라고 명확히 밝힌다. 이는 규약 차원의 문제가 없고 코드 리뷰 범위 투명성 면에서도 적절하다.
- **제안**: 추가 조치 불필요.

---

## 요약

`spec/7-channel-web-chat/` 영역 문서 전체가 정식 규약(`spec/conventions/`)을 대체로 잘 준수한다. 6개 spec 파일 모두 frontmatter에 `id`/`status`/`code:` 를 보유하고 `spec-impl-evidence` 규약의 lifecycle 가드를 충족한다. `_product-overview.md` 는 `_` prefix 면제 대상으로 frontmatter 없음이 정상이다. `4-security.md` 의 `id: web-chat-security` basename 불일치는 규약 §2.1 이 명시적으로 허용하는 "영역 prefix 충돌 방지" 패턴이며 문서 내 주석으로 의도가 명문화돼 있다. 에러 코드·Swagger·audit-action 등 나머지 정식 규약은 이번 diff 범위(sessionStorage 전환)와 교차하지 않아 위반 사항이 없다. API 응답 봉투 형식(`{ data }` TransformInterceptor 래핑)·이벤트 페이로드 SSE 필드명·postMessage `wc:` namespace prefix 등 출력 포맷 규약도 spec 본문이 규약과 일치하게 기술된다. 금지 항목(srcdoc 자가 생성, 백엔드 model 직접 호출, 전역명 silent overwrite 등)이 모두 명시적으로 "기각/금지"로 표기돼 있다. 발견된 항목 전부 INFO 수준이며 정식 규약 위반은 없다.

---

## 위험도

NONE
