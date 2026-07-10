# Consistency Check 통합 보고서 (`--impl-prep spec/7-channel-web-chat/`)

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 success, CRITICAL 0건)

## 전체 위험도
**MEDIUM** — Critical 없음. `spec/7-channel-web-chat/` 자체 정합성은 양호하나, 이번 편집(`widget-presentation-restore`)과 무관하게 사전부터 존재하던 상태(status) drift 2건이 cross-spec 검토에서 재확인됨(EIA §8.4 rate-limit "Planned" 오기재, NAV-WC-06 완료 미반영).

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `4-security.md` §4 가 EIA §8.4 `/interact` rate-limit(분당 60)을 "Planned(미구현)"로 잘못 인용 — 자신이 근거로 든 SoT(EIA §8.4)와 직접 모순. EIA §8.4 는 실제로 "구현됨"(`InteractionRateLimiterService`+`InteractionRateLimitGuard`)이며 코드로도 확인됨 | `spec/7-channel-web-chat/4-security.md` §4 | `spec/5-system/14-external-interaction-api.md` §8.4 (Rate Limit 표) | "SSE 동시 3/execution, interact 분당 60/execution 모두 구현됨"으로 정정하거나 중복 서술을 삭제하고 EIA §8.4 참조로 축약(중복 서술이 drift 재발 원인). 구현 재작업 유발은 없으나 리뷰어 오인 방지 위해 정정 권장 |
| 2 | Cross-Spec | NAV-WC-06(라이브 미리보기) 요구사항 카탈로그 상태가 🚧(미완료, "증분 2 대기")로 stale — 실제로는 `5-admin-console.md`(status: implemented) + `0-overview.md` §6.2 + `plan/complete/web-chat-console.md`("Phase 1/3 완료")로 이미 완료 확인됨 | `spec/2-navigation/_product-overview.md` (NAV-WC-06 행, line 222) | `spec/7-channel-web-chat/5-admin-console.md`, `spec/0-overview.md` §6.2, `plan/complete/web-chat-console.md` | NAV-WC-06 상태를 ✅ 로 갱신(NAV-WC-01~05 와 정합). `project-planner` 소관(`_product-overview.md` 요구사항 카탈로그) — 이번 target PR 범위 밖일 수 있으나 같은 커밋 또는 팔로우업으로 정리 권장 |
| 3 | Convention Compliance | `GET /api/hooks/:endpointPath/embed-config` 응답의 `{ data }` 봉투(wrap) 표기가 문서 3곳에서 누락 — 실제 구현(`hooks.controller.ts` `@ApiOkWrappedResponse`)은 `{ data: { allowlist, enforce } }` 반환하는데 target 은 `{ allowlist, enforce }`(unwrap)로만 표기. 같은 문서 내 다른 endpoint(webhook 시작)는 wrap 을 명시해 표기 비대칭 | `spec/7-channel-web-chat/3-auth-session.md` §3 step 0(라인 44), `4-security.md` §3-①(라인 101-109)·Rationale I3(라인 188-190) | `spec/conventions/swagger.md` §2-5/§5-2 (전역 TransformInterceptor `{ data }` wrap 규칙), 실제 코드 `hooks.controller.ts` | (1) `3-auth-session.md` step 0 을 `→ { data: { allowlist, enforce } }` 로 정정 + wrap 주석 추가. (2) `4-security.md` §3-①/I3 표기에도 봉투 명시. (3) §Rationale R5 언랩 대상 열거에 `embed-config` 추가. 런타임 영향 없음(클라이언트가 `json.data ?? json` 폴백 처리) — 순수 문서 정정 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Rationale Continuity | `_product-overview.md` §2 "목표(v1)"의 "전체 렌더"(라이브 렌더 축)와 신규 "비목표"의 새로고침 복원 제약(persistence 축)이 나란히 있어 오독 여지 이론상 존재(모순은 아님) | `spec/7-channel-web-chat/_product-overview.md` §2 | 필수 아님. 원하면 "목표" 항목 말미에 "(새로고침 복원 범위는 §2 비목표 참조)" 1구 추가 |
| 2 | Convention Compliance | `_product-overview.md` H1 제목 포맷이 형제 영역 6개 문서(`# PRD: <이름>`)와 다름(`# Channel Web Chat — ...`). 본문 섹션 구성은 동일해 실질적 구조 위반 아님 | `spec/7-channel-web-chat/_product-overview.md:1` | 강제 규약 아님, 차단 사유 아님. 일관성 원하면 `# PRD: Channel Web Chat` 형태로 정렬 고려 |
| 3 | Plan Coherence | `conversation-thread.md` §2.1 신설 문장이 "확장은 §7 v2 검토 사안"이라 명시하지만 §7 "v2 로드맵" 리스트 자체에는 대응 bullet 없음(양방향 상호참조 미완결) | `spec/conventions/conversation-thread.md` §2.1 / §7 | 필수 아님(직전 라운드 WARNING 권고 중 §2.1 택일로 이미 충족). 원하면 §7 에 1줄 bullet 추가로 완결성 강화 |
| 4 | Naming Collision | "표시-전용 presentation 노드"(target)와 "Blocking vs Display-only"(0-common.md §10.6)가 같은 이분법을 다른 한글 표현으로 서술 — 의미 정합, 상호 링크로 이미 연결돼 혼동 위험 낮음 | `spec/4-nodes/6-presentation/0-common.md` §10.6 vs target 문구 | 조치 불요. 추후 `conventions/` 용어집 정리 시 참고 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | EIA §8.4 rate-limit "Planned" 오기재(SoT 모순) + NAV-WC-06 완료 미반영, 상태(status) drift 2건. `spec/7-channel-web-chat/` 자체는 인접 영역과 대체로 잘 정합 |
| Rationale Continuity | NONE | 직전 라운드(22_27_45) WARNING 1건·INFO 3건이 이번 커밋(28a358375)에서 전부 반영됐음을 diff 로 확인. Rationale 위반(기각 대안 재도입·합의 원칙 위반) 없음. INFO 1건(표현 명확성) |
| Convention Compliance | LOW | `embed-config` 응답 `{ data }` 봉투 표기 3곳 누락(swagger.md §2-5/§5-2 불일치, 런타임 영향 없음). 나머지 문서 구조·명명·enum 레지스트리 정합 양호 |
| Plan Coherence | NONE | `plan/in-progress/**` 40개 전수 스캔, 교집합 6개 plan 라인 대조 — 충돌·중복·선행조건 훼손 없음. INFO 1건(§2.1↔§7 상호참조) |
| Naming Collision | NONE | 이번 diff(`1-widget-app.md` 2곳 문구 정정 + `_product-overview.md` 비목표 1항목)는 신규 식별자 도입 없음, 전부 기존 정의 재사용. 앵커 링크 전부 실재 확인. INFO 1건(용어 표기 참고) |

## 권장 조치사항

1. (BLOCK 해소 사유 아님 — 참고) `spec/7-channel-web-chat/4-security.md` §4 의 EIA §8.4 `/interact` rate-limit "Planned" 서술을 "구현됨"으로 정정하거나 중복 서술 삭제 — SoT(EIA §8.4)와의 직접 모순 해소
2. `spec/2-navigation/_product-overview.md` NAV-WC-06 상태를 🚧 → ✅ 로 갱신(project-planner 소관, 팔로우업 가능)
3. `spec/7-channel-web-chat/3-auth-session.md` §3 step 0, `4-security.md` §3-①/Rationale I3 에 `embed-config` 응답의 `{ data }` 봉투 표기 추가 + R5 언랩 대상 목록에 `embed-config` 추가
4. INFO 4건은 선택 사항 — 필요 시 §2/§7 상호참조 문구 보강, `_product-overview.md` 제목 포맷 정렬

---

**호출자 처리 (developer)**: `BLOCK: NO` → 구현 착수. WARNING 3건은 모두 **본 변경(위젯 `asEnvelope` truncation 흡수)과 무관한 사전 존재 spec drift** 이며 `project-planner` 소관 spec-only 정정이다 — `plan/in-progress/widget-presentation-restore.md` §5 에 기록하고 별도 팔로우업으로 분리한다(본 PR 범위: 위젯 코드 + §2 계약 정정).
