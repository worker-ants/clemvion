# 정식 규약 준수 검토 결과

검토 범위: `spec/7-channel-web-chat` (구현 완료 후 검토, diff-base=origin/main)
검토 일시: 2026-06-17
대상 규약: `spec/conventions/**`

---

## 발견사항

### [INFO] `_product-overview.md` — frontmatter 없음 (의도된 면제)
- target 위치: `spec/7-channel-web-chat/_product-overview.md` (파일 전체)
- 위반 규약: `spec/conventions/spec-impl-evidence.md §1` 제외 목록
- 상세: `_product-overview.md` 는 `_*.md` (밑줄 prefix) 제외 패턴으로 frontmatter 의무 면제 대상이다. 실제 frontmatter 가 없는 것은 규약과 일치. 보고 목적으로 기록하나 위반 아님.
- 제안: 현상 유지.

### [INFO] `_product-overview.md` — `## Rationale` 섹션 미완 구성
- target 위치: `spec/7-channel-web-chat/_product-overview.md` § Rationale
- 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장
- 상세: `_product-overview.md` 는 Overview·본문(§1~§4)·Rationale 3구성을 갖추었고 Rationale 에 "제품 영역 분리" 근거가 있다. 단 Rationale 제목 앞에 `### ` 이 아닌 일반 텍스트 표현이며 heading 레벨이 없다. 기술 명세 문서(0~4번)는 `## Rationale` + `### R<n>.` 패턴을 엄수하는데, `_product-overview.md` 의 Rationale 절은 heading 없이 `### 제품 영역 분리 (vs 5-system 흡수)` 만 있어 `## Rationale` 상위 헤딩이 빠졌다.
- 제안: `## Rationale` 헤딩을 추가해 3섹션 구성과 일치시킨다. 면제 대상 문서이므로 가드는 영향을 주지 않지만, 일관성 측면에서 교정 권장.

### [WARNING] `0-architecture.md` pending_plans — `webchat-eager-start.md` 계속 잔류
- target 위치: `spec/7-channel-web-chat/0-architecture.md` frontmatter `pending_plans:`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `partial → implemented` 전이 규칙: 모든 `pending_plans` 가 `complete/` 로 이동하면 `implemented` 로 승격 의무
- 상세: `plan/in-progress/webchat-eager-start.md` 는 현재 `plan/in-progress/` 에 실존하므로 `spec-pending-plan-existence.test.ts` 가드는 통과한다. 그러나 eager-start 기능이 현 diff(구현 완료 후 검토 모드)에서 이미 구현·반영됐다면, 해당 plan 이 `complete/` 로 이동 완료됐는지 확인이 필요하다. 아직 in-progress 에 남아 있으므로 현재는 가드 위반이 아니지만, plan 이동 없이 방치되면 `spec-status-lifecycle.test.ts` 의 "partial 의 pending_plans 모두 complete 인데 status 미승격" 가드가 향후 fail 할 수 있다. (본 diff 범위에서 eager-start plan 의 완료 이동 여부를 확인하지 못해 WARNING 으로 기록.)
- 제안: `plan/in-progress/webchat-eager-start.md` 가 이 브랜치의 구현으로 완료됐다면 `plan/complete/` 로 이동하고, 이동 후 해당 plan 을 참조하는 세 spec (`0-architecture`, `1-widget-app`, `3-auth-session`) 의 `pending_plans:` 에서 제거한 뒤 남은 plan 이 없으면 `status: implemented` 로 승격한다. 완료 이동이 이미 예정된 별도 작업이라면 현 상태 유지.

### [INFO] `0-architecture.md` id 명명 — `web-chat-architecture` (basename 불일치)
- target 위치: `spec/7-channel-web-chat/0-architecture.md` frontmatter `id: web-chat-architecture`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — "파일 basename(확장자 제외) 기반 권장. 같은 basename 이 영역을 달리해 중복될 때는 후발 문서가 영역 prefix 로 충돌 회피"
- 상세: 파일 basename 은 `0-architecture` 이지만 id 는 `web-chat-architecture` 로 차이가 있다. 이 패턴은 다른 영역의 동명 파일(`spec/4-nodes/0-architecture.md` 등)과의 id 충돌 회피를 위한 의도된 prefix 사용이며, `spec-impl-evidence.md §2.1` 의 "후발 문서가 영역 prefix 로 충돌을 회피"에 해당한다. 규약 위반이 아닌 정상 패턴이나 명시적으로 관찰 기록.
- 제안: 현상 유지. 규약 준수.

### [INFO] 5개 기술 명세 spec 모두 `status: partial` — code 글로브 ≥1 매치 요건
- target 위치: `spec/7-channel-web-chat/0-architecture.md` ~ `4-security.md` frontmatter `code:`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `status: partial` 시 `code:` ≥1 파일 매치 의무
- 상세: 각 spec 의 `code:` 글로브가 실제 파일을 가리키는지는 빌드 가드(`spec-code-paths.test.ts`)가 자동 검증한다. `4-security.md` 의 `code:` 는 `codebase/backend/src/common/cors/web-chat-cors.ts`, `codebase/backend/src/modules/web-chat-cors/**` 등 구체적 경로를 포함하며 diff 에서 해당 파일들이 구현됐음이 확인된다(`web-chat-cors.ts` 등 참조). `1-widget-app.md` 의 `code:` glob(`codebase/channel-web-chat/**`)과 `2-sdk.md`(`codebase/packages/web-chat-sdk/**`) 는 broad glob 이라 새 파일이 없는 경우 매치 실패 위험이 있으나, diff 에서 `channel-web-chat/` 구조가 있음이 확인된다. 빌드 가드 결과를 최종 확인하는 것으로 충분.
- 제안: 현상 유지. 빌드 가드가 커버.

### [INFO] `3-auth-session.md` pending_plans — `fix-webchat-sse-field-map.md` 미포함
- target 위치: `spec/7-channel-web-chat/3-auth-session.md` frontmatter `pending_plans:` (누락 아님, 별도 spec 참조)
- 위반 규약: 해당 없음 (누락이 아님)
- 상세: `fix-webchat-sse-field-map.md` 는 `0-architecture.md` 의 `pending_plans:` 에만 등재됐고 `3-auth-session.md` 에는 없다. SSE 필드 매핑 이슈는 `0-architecture.md §3` 에서 다루므로 해당 spec 만 pending_plans 를 보유하는 것이 적절하다. 분리 원칙 정상.
- 제안: 현상 유지.

### [WARNING] `2-sdk.md` — `eia-sdk-publish.md` 를 `pending_plans:` 에 미등록
- target 위치: `spec/7-channel-web-chat/2-sdk.md` frontmatter `pending_plans:`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `status: partial` 시 미구현 surface 를 책임지는 plan 을 `pending_plans:` 에 의무 등재
- 상세: `2-sdk.md` 본문 §2 에 `plan/in-progress/eia-sdk-publish.md` 를 직접 참조하며 "현 increment 미배선 (계획) — EIA 호출(triggerWebhook/SSE)·예시 배선은 [plan channel-web-chat-followups] 에서 추적"라고 기술한다. `eia-sdk-publish.md` 는 npm publish 정책을 다루는 별도 plan 이지만, 이 plan 이 `status: partial` 의 미구현 surface 일부를 책임지는 plan 이라면 `pending_plans:` 에 등재돼야 한다. 현재 `eia-sdk-publish.md` 가 `plan/in-progress/` 에 실존하며 `2-sdk.md` 본문에서 직접 인용되지만 frontmatter `pending_plans:` 에는 누락돼 있다. 단, npm publish 정책은 구현 surface 완성(배선)과 다른 트랙일 수 있어 배제가 의도적일 수 있다.
- 제안: `eia-sdk-publish.md` 가 `2-sdk.md` 의 미구현 surface(npm 배포)를 책임지는 plan 이라면 `pending_plans:` 에 추가한다. 구현 표면과 무관한 publish 정책만 다룬다면 본문 링크만 유지하고 frontmatter 제외가 정당하다 — 팀 결정이 필요하며 현재는 WARNING 으로 기록.

### [INFO] `4-security.md` `embed-config.service.ts` · `embed-config.dto.ts` code 경로 — 구체 경로 사용
- target 위치: `spec/7-channel-web-chat/4-security.md` frontmatter `code:`
- 위반 규약: 없음. 규약 준수 관찰.
- 상세: `spec-impl-evidence.md §1` 의 `R-1` 에서 글로브와 구체 경로 모두 허용한다. `embed-config.service.ts` 등 구체 경로 지정은 정상이며 `spec-code-paths.test.ts` 가 파일 실존을 검증한다.
- 제안: 현상 유지.

### [INFO] `spec/7-channel-web-chat` 영역 index 가드 — `_product-overview.md` 가 index 역할
- target 위치: `spec/7-channel-web-chat/_product-overview.md`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §4.2` — `spec-area-index.test.ts` (각 영역 폴더에 index 문서 존재 + 모든 sibling spec 이 index 에서 링크)
- 상세: `_product-overview.md` 본문에 `0-architecture.md`, `1-widget-app.md`, `2-sdk.md`, `3-auth-session.md`, `4-security.md` 가 모두 링크돼 있다. 가드 `spec-area-index.test.ts` 가 이를 자동 검증한다. 관찰 결과 이상 없음.
- 제안: 현상 유지.

---

## 구현 diff 범위의 규약 관련 관찰

diff 에 포함된 `codebase/backend/src/modules/auth/totp.service.ts` 와 `totp.service.spec.ts` 변경은 `spec/7-channel-web-chat` 범위와 무관하며, `spec/conventions/` 중 `swagger.md`·`error-codes.md`·`audit-actions.md` 와도 직접 접점이 없다. backend 패키지 버전 업그레이드(`otplib ^12 → ^13`, `@types/node ^22 → ^24` 등) 및 `channel-web-chat/package-lock.json` 의 Node.js 엔진 요건 갱신(`>=20 → >=24`)도 `spec/conventions/` 규약 위반 사항이 없다.

---

## 요약

`spec/7-channel-web-chat` 의 5개 기술 명세 파일은 `spec-impl-evidence.md` 의 frontmatter 스키마(`id`/`status`/`code`/`pending_plans`)를 전반적으로 준수한다. `id` 값이 basename 과 다른 것은 영역 간 충돌 회피를 위한 의도된 패턴이다. `_product-overview.md` 는 `_*.md` 면제 대상이며 구성도 적절하다. 주의사항은 두 가지다. 첫째, `2-sdk.md` 의 `pending_plans:` 에서 본문에서 직접 인용된 `eia-sdk-publish.md` 가 누락됐으며, 이 plan 이 미구현 표면을 책임진다면 추가가 필요하다 (WARNING). 둘째, `webchat-eager-start.md` 가 아직 in-progress 에 있는데 해당 기능이 이번 구현 diff 에서 완료됐다면 plan 이동·spec 승격 절차를 이행해야 한다 (WARNING). 그 외는 모두 INFO 수준의 사소한 형식 일관성 사안이다.

---

## 위험도

LOW
