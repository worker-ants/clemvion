# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불요.

## 전체 위험도
**LOW** — WARNING 2건(convention_compliance) 존재하나 차단 수준 아님. 나머지 checker 는 모두 NONE.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `webchat-eager-start.md` 가 `in-progress/` 에 잔류 — 기능 구현 완료 후 `complete/` 이동 및 spec `pending_plans` 제거·`status` 승격 미완 | `spec/7-channel-web-chat/0-architecture.md`, `1-widget-app.md`, `3-auth-session.md` `pending_plans:` | `spec/conventions/spec-impl-evidence.md §3` — partial→implemented 전이 규칙 | `plan/in-progress/webchat-eager-start.md` 를 `plan/complete/` 로 이동하고, 참조 세 spec 의 `pending_plans:` 에서 제거. 잔여 plan 없으면 `status: implemented` 승격 |
| 2 | convention_compliance | `2-sdk.md` `pending_plans:` 에 `eia-sdk-publish.md` 누락 — 본문에서 직접 인용됨에도 frontmatter 미등재 | `spec/7-channel-web-chat/2-sdk.md` frontmatter `pending_plans:` | `spec/conventions/spec-impl-evidence.md §3` — partial 상태 시 미구현 surface 담당 plan 의무 등재 | `eia-sdk-publish.md` 가 `2-sdk.md` 의 미구현 표면(npm 배포)을 책임진다면 `pending_plans:` 에 추가. 구현 표면과 무관한 publish 정책 트랙이라면 본문 링크 유지·frontmatter 제외 유지 가능 — 팀 결정 필요 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `spec/4-nodes/5-data/2-code.md` 가 isolated-vm 라이브러리 지원 floor 를 `node>=22` 로 표기해 프로젝트 runtime floor 오독 가능 (실제 충돌 아님) | `spec/4-nodes/5-data/2-code.md` | "isolated-vm 6.x 라이브러리는 `node>=22` 를 지원하지만, 프로젝트 runtime floor 는 `PROJECT.md` 정책(`>=24`)을 따른다"로 명확화 |
| 2 | rationale_continuity | `channel-web-chat/package-lock.json` 의 `engines.node` `>=20` → `>=24` 상향 — `§R4` Rationale 에 런타임 버전 결정 미기록 (번복 아님) | `spec/7-channel-web-chat/0-architecture.md §4` 배포 설정 블록 | "Node engine >=24 전제" 한 줄 추가 권장 |
| 3 | rationale_continuity | `@vitejs/plugin-react` v4→v6 갱신 — `§R4` "Vite SPA 기각"은 프레임워크 선택 기각이며 Vitest devDependency 와 무관 (위반 아님) | `spec/7-channel-web-chat/1-widget-app.md` | 조치 불요 |
| 4 | convention_compliance | `_product-overview.md` `## Rationale` 상위 헤딩 누락 — `### 제품 영역 분리` 만 있고 `## Rationale` 미존재 | `spec/7-channel-web-chat/_product-overview.md` | `## Rationale` 헤딩 추가 권장 (면제 대상 문서이므로 가드 영향 없음) |
| 5 | convention_compliance | `3-auth-session.md` `pending_plans:` 에 `fix-webchat-sse-field-map.md` 미등재 — `0-architecture.md` 에만 있으며 SSE 영역이 architecture spec 소관이므로 분리 정상 | `spec/7-channel-web-chat/3-auth-session.md` | 현상 유지 |
| 6 | plan_coherence | `channel-web-chat-impl.md` 에 "sanitize 정책 spec 문서화 완료" 메모 미기록 | `plan/in-progress/channel-web-chat-impl.md` | 선택적 메모 추가 |
| 7 | plan_coherence | `webchat-eager-start.md` · `fix-webchat-sse-field-map.md` 의 `complete/` 이동 항목 미체크 | `plan/in-progress/webchat-eager-start.md`, `plan/in-progress/fix-webchat-sse-field-map.md` | 본 변경 차단 사유 아님. 별도 후속 이동 권장 |
| 8 | naming_collision | `spec/4-nodes/` 하위 6개 파일이 `id: common` 중복 사용 — 이번 diff 도입 아닌 기존 상태 | `spec/4-nodes/{1-logic,2-flow,3-ai,4-integration,5-data,7-trigger}/0-common.md` | 추후 `logic-common`, `flow-common` 등 prefix 부여 권고. 현 diff 차단 사유 아님 |
| 9 | naming_collision | `EPOCH_TOLERANCE_SECONDS`, `verifyCode`, otplib v13 functional imports — 신규 도입이나 기존 코드베이스·spec 어디와도 충돌 없음 | `codebase/backend/src/modules/auth/totp.service.ts` | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | otplib v12→v13 및 `engines.node >=24` 모두 spec 과 정합. INFO 1건(isolated-vm floor 표기 언어 드리프트) |
| rationale_continuity | NONE | `spec/7-channel-web-chat` Rationale 결정(R1·R3·R4·R6·R8) 어느 것도 번복 없음. INFO 2건 |
| convention_compliance | LOW | WARNING 2건: `webchat-eager-start.md` plan 이동 미완, `eia-sdk-publish.md` frontmatter 누락. INFO 6건 |
| plan_coherence | NONE | `safe-html.ts` 구현이 plan 에 이미 완료 기록됨. INFO 2건(추적 완결 권장) |
| naming_collision | NONE | 신규 식별자 충돌 없음. `id: common` 중복은 기존 상태(diff 무관) |

## 권장 조치사항

1. (WARNING 1 해소) `plan/in-progress/webchat-eager-start.md` 를 `plan/complete/` 로 이동하고, `spec/7-channel-web-chat/0-architecture.md` · `1-widget-app.md` · `3-auth-session.md` 의 `pending_plans:` 에서 제거. 제거 후 잔여 plan 이 없으면 해당 spec 의 `status:` 를 `implemented` 로 승격.
2. (WARNING 2 해소) `eia-sdk-publish.md` 가 `spec/7-channel-web-chat/2-sdk.md` 의 미구현 npm 배포 표면을 책임지는지 팀 확인 후, 해당하면 `2-sdk.md` frontmatter `pending_plans:` 에 추가.
3. (INFO 권장) `spec/4-nodes/5-data/2-code.md` isolated-vm 관련 표기에 "프로젝트 runtime floor 는 `PROJECT.md` 정책(`>=24`)" 문구를 삽입해 오독 방지.
4. (INFO 권장) `spec/7-channel-web-chat/_product-overview.md` 에 `## Rationale` 상위 헤딩 추가.
5. (INFO 선택) `plan/in-progress/channel-web-chat-impl.md` 에 "spec/7-channel-web-chat/4-security.md §1.1 sanitize 매트릭스 + §R4 문서화 완료" 메모 추가.