# Convention Compliance Review

검토 대상: `spec/7-channel-web-chat` (구현 완료 후, diff-base=origin/main)
검토일: 2026-06-06

---

## 발견사항

### [WARNING] `pending_plans` 의 `webchat-eager-start.md` — 미병합 시 guard 실패 위험

- **target 위치**: `spec/7-channel-web-chat/0-architecture.md`, `1-widget-app.md`, `3-auth-session.md` frontmatter `pending_plans` 항목
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4` — `spec-pending-plan-existence.test.ts` 가 `plan/in-progress/webchat-eager-start.md` 의 **repo-root 기준 실존**을 강제
- **상세**: 세 spec 파일이 `plan/in-progress/webchat-eager-start.md` 를 `pending_plans` 로 등록했고, 해당 파일은 현재 **워크트리(`plan/in-progress/webchat-eager-start.md` modified 상태)** 에만 존재한다. 워크트리 안에서는 guard 가 통과하지만, 이 plan 파일이 **PR merge 시 실제 `plan/in-progress/`** 에 포함되지 않으면 merge 후 `spec-pending-plan-existence.test.ts` 가 실패한다.  
  현재 git status 는 `M plan/in-progress/webchat-eager-start.md` (modified) 로 tracked 상태라 merge 에 포함될 것으로 보이나, PR 커밋에 이 파일이 포함되는지 확인이 필요하다.
- **제안**: PR 커밋 목록에 `plan/in-progress/webchat-eager-start.md` 가 포함돼 있는지 명시적으로 확인하고, 빠져 있으면 stage 후 포함. 완료 시점에 spec 파일에서 `pending_plans` 제거 또는 `plan/complete/` 로 이동 병행.

---

### [INFO] `id` 값이 파일 basename 과 불일치 (권장 사항)

- **target 위치**: `spec/7-channel-web-chat/` 내 모든 spec 파일의 frontmatter `id` 필드
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `id: string (kebab-case). 파일 basename(확장자 제외) 기반 **권장**`
- **상세**: 파일명과 id 의 대응이 아래와 같이 어긋난다.

  | 파일명 | 실제 id | basename 기반 권장 id |
  |---|---|---|
  | `0-architecture.md` | `web-chat-architecture` | `0-architecture` |
  | `1-widget-app.md` | `web-chat-widget-app` | `1-widget-app` |
  | `2-sdk.md` | `web-chat-sdk` | `2-sdk` |
  | `3-auth-session.md` | `web-chat-auth-session` | `3-auth-session` |
  | `4-security.md` | `web-chat-security` | `4-security` |

  규약은 **권장(recommended)** 이지 강제가 아니므로 build 실패를 유발하지 않는다. 그러나 id 가 도메인 의미를 포함(`web-chat-*`)해 검색·참조가 명확하다는 점에서 현재 값도 합리적이다.
- **제안**: 현재 id 값을 유지하거나, 전 영역에 일관성 있게 맞추기. 이번 변경(diff)이 id 를 새로 정의한 것이 아니므로 이번 PR 에서 수정 불필요. 향후 규약 갱신 시 "영역 prefix + 도메인명" 패턴도 명문화 고려.

---

### [INFO] `_product-overview.md` 에 `## Overview` 섹션 표제가 없음 (구조 소폭 편차)

- **target 위치**: `spec/7-channel-web-chat/_product-overview.md` — `## 1. 개요 / 문제` 섹션
- **위반 규약**: CLAUDE.md 의 "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장
- **상세**: `_product-overview.md` 는 `## 1. 개요 / 문제`, `## 2. 목표 / 비목표`, `## 3. 사용 시나리오`, `## 4. 제품 구성요소`, `## Rationale` 구조다. "Overview" 표제가 아닌 `## 1. 개요 / 문제` 로 시작하지만, 의미상 Overview 섹션 역할을 한다. 또한 `_*.md` 는 spec-impl-evidence §1 제외 대상(frontmatter 불필요)으로 가드 미적용이며, 내용·구조 모두 product-overview 역할을 충실히 수행하고 있다.
- **제안**: 이 정도 편차는 허용 범위 내이므로 수정 불필요. 규약 문서에서 `_product-overview.md` 의 표제 패턴을 예시로 추가할 수 있으면 더 명확해진다.

---

### [INFO] `EiaClient.startConversation` 파라미터 타입에서 `firstMessage` 제거 — 내부 API breaking change 고려

- **target 위치**: `codebase/channel-web-chat/src/lib/eia-client.ts` 함수 시그니처, `codebase/channel-web-chat/src/lib/eia-client.test.ts`
- **위반 규약**: `spec/conventions/error-codes.md §2` 의 "rename/변경 = breaking change" 원칙의 정신 — 에러 코드에 명시된 규율이나, 공개 API 파라미터 타입 제거도 동일 원칙이 적용될 수 있음
- **상세**: `payload: { profile?, firstMessage?, [k] }` → `payload: { profile?, [k] }` 로 `firstMessage` 가 제거됐다. 이 파일은 `codebase/channel-web-chat/` 내부 전용 모듈이며, 공개 npm 패키지(`@workflow/web-chat`)의 외부 계약이 아니라 내부 구현이다. spec §R6 의 명시적 설계 결정("firstMessage 폐기")을 반영한 것으로, spec 과 구현이 일치한다. 외부 npm 계약은 `ChatInstance` 타입(2-sdk §5)이고 변경되지 않았다.
- **제안**: 내부 모듈 변경으로 breaking change 우려 없음. 이 정도는 정상 리팩토링 범위. INFO 수준으로 기록만.

---

## 요약

`spec/7-channel-web-chat` 영역의 모든 spec 파일은 `spec/conventions/spec-impl-evidence.md` 의 frontmatter 구조(`id`, `status: partial`, `code:`, `pending_plans:`)를 올바르게 갖추고 있다. 3섹션 구성(Overview/본문/Rationale)도 전 파일에 충족돼 있으며, `_product-overview.md` 는 제외 대상으로 별도 처리된다. 구현 diff 의 신규 파일(`use-widget-eager-start.test.ts`, `panel.test.tsx`)은 subject 파일 기반 명명 패턴을 준수하고, postMessage 프로토콜의 `wc:` namespace prefix 규약도 지켜지고 있다. 주요 유의 사항은 `webchat-eager-start.md` plan 파일이 PR merge 커밋에 포함되는지 확인하는 것이다 — 포함되면 `spec-pending-plan-existence` guard 도 통과한다. `id` 와 basename 불일치는 권장 사항 미충족으로 build 차단이 없으며, 기존부터 이어진 일관된 패턴이어서 이번 PR 범위에서 수정 불필요하다.

## 위험도

LOW
