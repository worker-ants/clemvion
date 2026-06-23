# 요구사항(Requirement) 코드 리뷰

리뷰 대상: 증분 3 — 일관성 검토 산출물(2026-06-23·2026-06-24) + spec 갱신 + 구현 코드 (webchat-console 운영 콘솔)

---

## 발견사항

### [INFO] 일관성 검토 산출물 파일 자체 (파일 1–20)
- 위치: `review/consistency/2026/06/23/10_27_50/`, `review/consistency/2026/06/23/13_38_25/`, `review/consistency/2026/06/24/02_34_35/`
- 상세: 일관성 검토 산출물(meta.json, checker 결과 .md, _retry_state.json, SUMMARY.md)은 그 자체로 "기능 구현 코드"가 아니라 리뷰 프로세스가 생성한 메타 파일이다. 요구사항 충족 관점에서 직접 점검할 비즈니스 로직이 없다. 단, 2026-06-24 02:34:35 세션의 SUMMARY.md 가 BLOCK:YES(Critical 1건) 를 정확히 기록하고 있고, 해당 Critical(NAV-WC-04 "백엔드 미저장" 구식화)이 이번 증분에서 파일 24(`spec/2-navigation/_product-overview.md`) 갱신으로 해소된 사실을 확인했다.
- 제안: 없음(정상 기록).

---

### [INFO] `spec/0-overview.md` §6.2 갱신 (파일 21)
- 위치: `spec/0-overview.md` 줄 1672, 1681
- 상세: "임베드형 웹채팅 위젯 + SDK" 행에 운영 콘솔(`5-admin-console.md`) 참조와 "라이브 미리보기는 위젯 co-deploy 후 증분 2" 주의를 추가했다. co-deploy 파이프라인(`copy-widget.mjs`)이 이번 증분 범위에 포함됨에도 "증분 2" 라는 표현이 그대로 잔류한다. consistency 검토 INFO-1(2026-06-24 세션)에서 동기화를 권고했고, live-preview 가 placeholder(wc:ready 타임아웃 8초 후 "unavailable" 안내)로 동작하므로 미리보기 UI 자체는 아직 증분 2 대상이라는 점에서 현행 기술이 완전히 오해는 아니다. 단 "co-deploy 파이프라인 자체는 구현 완료"라는 사실이 §6.2 에 반영되지 않아 독자 혼란 소지가 있다.
- 제안: §6.2 에 "co-deploy 파이프라인(`copy-widget.mjs`)은 이번 증분에 포함 완료; 미리보기 UI 는 위젯 동봉 후 증분 2"로 명확화하면 좋으나 현재 INFO 수준.

---

### [WARNING] `spec/2-navigation/2-trigger-list.md` API 표 `interactionEnabled` 파라미터 추가 (파일 22)
- 위치: `spec/2-navigation/2-trigger-list.md` 줄 1705
- 상세: `GET /api/triggers` 목록에 `interactionEnabled` 쿼리 파라미터를 추가했다. 구현(`use-web-chat.ts` 줄 52–56)은 `params: { type: "webhook", interactionEnabled: true, limit: MAX_LIST_LIMIT }` 로 이 파라미터를 실제 사용한다. 백엔드 실체 확인이 필요하다 — `QueryTriggerDto` 에 `interactionEnabled` 가 실제로 존재하고, `findAll` 이 이를 JSONB 필터로 처리하는지.

구현 파일을 grep 해 확인한 결과 `codebase/backend/src/modules/triggers/dto/query-trigger.dto.ts` 에 `interactionEnabled` 필드가 존재하며, `triggers.service.ts` 에서 JSONB 필터로 적용된다는 사실이 consistency checker(cross_spec.md)와 naming_collision.md 에서 확인됐다. spec 기술과 구현이 일치한다.

spec 기술에서 "`sort`/`order` 반영은 미구현/Planned" 비고에서 기존 "(triggers.service.ts:99)" 파일 위치 주석이 삭제됐는데, 이는 문서 정확성을 위해 유지하는 것이 좋다(구현 SoT 위치 추적 용이). 큰 문제는 아님.
- 제안: 없음(기능 구현 일치). sort/order 주석의 파일 위치 참조 삭제는 INFO 수준.

---

### [WARNING] `spec/2-navigation/_layout.md` Web Chat 메뉴 삽입 + 번호 재정렬 (파일 23)
- 위치: `spec/2-navigation/_layout.md` 줄 1728 (ASCII tree), 줄 1746 (메뉴 테이블)
- 상세: Web Chat(MessageCircle, `/web-chat`)이 Schedule(4번) 다음 5번 위치에 삽입되고, 이후 항목이 6–13번으로 재정렬됐다. Marketplace 주석도 `System Status(10)` → `System Status(11)` 로 갱신됐다. 이는 consistency cross_spec WARNING(W-2)의 해소이며, 구현 `sidebar.tsx` 의 `navItems` 배열 순서(Schedule 다음에 Web Chat)와 일치한다.

구현 측 아이콘(`MessageCircle`)이 spec(`말풍선 아이콘 (MessageCircle)`)과 일치한다. href(`/web-chat`)도 일치한다. ASCII tree에 Web Chat 항목이 추가됐다.

[SPEC-DRIFT] 이번 증분에서 sidebar.tsx의 실제 구현(MessageCircle 아이콘 + `/web-chat` href)이 spec보다 선행 확인됐고, 이제 spec이 그것을 따라잡았다. 코드가 옳고 spec이 갱신된 케이스 — 정상.
- 제안: 없음. 요구사항 충족.

---

### [CRITICAL → 이번 증분에서 해소됨] `spec/2-navigation/_product-overview.md` NAV-WC-04 갱신 (파일 24)
- 위치: `spec/2-navigation/_product-overview.md` 줄 1797
- 상세: consistency 검토 2026-06-24 세션에서 CRITICAL 로 지적된 "NAV-WC-04 '백엔드 미저장' 구식화"가 이번 증분에서 해소됐다. 갱신된 행:
  ```
  NAV-WC-04 | 외형/콘텐츠 빌더 (BootConfig 필드, 인스턴스 단위 서버 저장 `config.interaction.appearance` — 결정 2026-06-24, [5-admin-console §4·R2](../7-channel-web-chat/5-admin-console.md)) | 필수 | ✅
  ```
  구현(`use-web-chat.ts` `useUpdateWebChatAppearance()` → `PATCH /api/triggers/:id { interaction: { enabled, tokenStrategy, appearance } }`)과 정합한다. `WebChatAppearanceDto` 가 실제 서버 저장을 수행하며, 이는 `interaction-config.dto.ts` 의 `appearance?: WebChatAppearanceDto` 로 연결됐다.

NAV-WC-01 ~ NAV-WC-06 요구사항이 §3.14 절로 정의됐고, `5-admin-console.md` Overview 의 `NAV-WC-01..06` 링크가 이제 실존 앵커를 가리킨다. 이전 consistency 검토의 "dead reference" 경고가 해소됐다.
- 상태: **이번 증분에서 해소 완료**. 추가 조치 불필요.

---

### [INFO] `spec/5-system/14-external-interaction-api.md` — `appearance` 서브객체 + `authType` 정리 (파일 25)
- 위치: `spec/5-system/14-external-interaction-api.md` 줄 1820, 1830–1852
- 상세: (a) `"authType": "bearer"` → `"authConfigId": null` 교체 — V066 폐기 필드 정리. (b) `interaction.appearance` 옵셔널 서브객체와 silent-deletion 주의 문단 추가.

silent-deletion 경고(`appearance` 없이 PATCH 하면 기존 저장 외형이 조용히 소실)는 `use-web-chat.ts` 의 `useUpdateWebChatAppearance()` 가 항상 `enabled`·`tokenStrategy`·`appearance` 세 필드를 함께 전송하도록 구현했고, 주석에도 명기(줄 147–148)했다. spec 주의사항과 구현이 정합한다.

`WebChatAppearanceDto` SoT 참조가 spec 에 명시(`SoT: interaction-config.dto.ts 의 WebChatAppearanceDto / spec 7-channel-web-chat/5-admin-console §4`)됐다.
- 제안: 없음. 기능 완전성 충족.

---

### [INFO] `spec/7-channel-web-chat/0-architecture.md` §4.1 동봉 + carve-out (파일 26)
- 위치: `spec/7-channel-web-chat/0-architecture.md` 줄 1877, 1889–1922
- 상세: (a) admin 미리보기의 same-origin 동봉 iframe 예외(`srcdoc` 자가 생성은 여기서도 금지) 명시. (b) env 테이블(`NEXT_PUBLIC_WIDGET_CDN_BASE` / `WEB_CHAT_WIDGET_ORIGINS`) + CORS 불일치 경고 추가. (c) §4.1 절 신설(동봉 방식, 버전 잠금). (d) §R8 carve-out 상세 추가.

구현 `live-preview.tsx` 가 `sandbox="allow-scripts allow-same-origin allow-forms"` 로 실제 same-origin 동봉 iframe 을 구현하며(줄 124), `0-architecture §4.1·§R8 carve-out` 을 정확히 따른다. `widget-base.ts` 의 `getWidgetAppUrl()` 이 동봉 경로(`/_widget/web-chat/v1/app`)를 반환하고, 이는 §4.1 의 동봉 서빙 경로(`codebase/frontend/public/_widget/web-chat/v1/`)와 일치한다.
- 제안: 없음.

---

### [INFO] `spec/7-channel-web-chat/2-sdk.md` — `wc:boot` 재전송 멱등 시맨틱 추가 (파일 27)
- 위치: `spec/7-channel-web-chat/2-sdk.md` 줄 1942–1948
- 상세: consistency rationale 검토가 INFO 로 지적한 "wc:boot 재전송(외형 갱신 목적) 패턴이 2-sdk §3 표에 미명시" 이슈를 해소한 것. `live-preview.tsx` 줄 103–106 에서 `status === "ready"` 시 + `postBoot` 갱신(외형 변경) 시 재전송하는 구현과 spec 기술이 일치한다.

`wc:resize` hidden/blocked 시 `{ width: 0, height: 0, state: 'collapsed' }` emit 시맨틱도 추가됐다. `live-preview.tsx` 의 `wc:resize` 수신 핸들러는 `height` 가 숫자인 경우에만 처리하므로(줄 88–91), 0이 들어와도 `clamp(0, 320, 640) = 320` 으로 최솟값이 유지된다. 이는 §6 의 "최소 320 = collapsed 런처 높이 보장"과 정합한다.
- 제안: 없음.

---

### [INFO] `spec/7-channel-web-chat/3-auth-session.md` — step 0 embed-config 조회 추가 (파일 28)
- 위치: `spec/7-channel-web-chat/3-auth-session.md` 줄 1972–1973
- 상세: 세션 시퀀스에 `0. (boot) 위젯: GET /api/hooks/:path/embed-config → soft 검증` 스텝이 추가됐다. `EmbedConfigService.resolve()` 구현이 이 시퀀스를 정확히 따른다 — endpointPath로 공개 trigger 조회 → workspace allowlist 해석 → `{ allowlist, enforce }` 반환. trigger 미존재·DB 오류·인증 webhook 모두 `{ allowlist: [], enforce: false }` fail-open으로 동작하며, spec §3-① "존재 여부 누설 없음" 요건과 일치한다.
- 제안: 없음.

---

### [INFO] `spec/7-channel-web-chat/4-security.md` — iframe sandbox 설명 + embed-config 흐름 보완 (파일 29)
- 위치: `spec/7-channel-web-chat/4-security.md` 줄 1997, 2007–2017
- 상세: (a) sandbox 행에 `allow-same-origin` 포함 트레이드오프 명시 — consistency rationale INFO-4(2026-06-24)에서 "Rationale 에 미기재"로 지적한 사항을 해소. (b) §3-① soft 검증 흐름에 `/embed-config` 엔드포인트 동작(공개·무인증, 캐시 정책, fail-open) 상세 추가.

`embed-config.service.ts` 의 동작과 spec 기술이 line-level 일치:
- trigger 미존재 → `{ allowlist: [], enforce: false }` ✓ (서비스 줄 47)
- 인증 webhook → `authConfigId: IsNull()` 필터로 null 반환 → allow-all ✓ (서비스 줄 43–44)
- DB 오류 → catch → `{ allowlist: [], enforce: false }` ✓ (서비스 줄 59–63)
- allowlist 빈 → `enforce: false` ✓ (서비스 줄 56–57)

`Cache-Control: public, max-age=300` 은 hooks.controller.ts 에서 실제 헤더로 설정되는지 별도 확인이 필요하다(이번 diff 에서 controller 변경이 있는지 payload 에서 확인 불가).
- 제안: hooks.controller.ts 의 `/embed-config` 엔드포인트에 `@Header('Cache-Control', 'public, max-age=300')` 또는 인터셉터가 실제로 적용됐는지 확인 권장.

---

### [WARNING] `spec/7-channel-web-chat/5-admin-console.md` status frontmatter 불일치 가능성 (파일 30)
- 위치: `spec/7-channel-web-chat/5-admin-console.md` 줄 2040 — `status: implemented`
- 상세: `spec/conventions/spec-impl-evidence.md` 의 라이프사이클은 `spec-only` → `partial` → `implemented` 순서다. `status: implemented` 는 모든 `pending_plans` 가 완료돼 `plan/complete/` 로 이동된 후 설정해야 한다. `5-admin-console.md` 에는 `pending_plans:` 키가 없고 `status: implemented` 가 직접 기재됐다.

plan 파일(`plan/in-progress/web-chat-console.md`)이 아직 `plan/complete/` 로 이동되지 않았다면(Phase 4 e2e 및 user guide 미완) `status: implemented` 는 조기 설정이다. 규약상 `pending_plans` 가 없는 `implemented` 는 허용될 수 있지만, plan 이 in-progress 에 잔류하는 한 `partial` + `pending_plans: [plan/...]` 이 더 정확한 상태다.

consistency convention_compliance checker(2026-06-24)는 이를 언급하지 않았고, 이 issue 는 spec-impl-evidence 규약과의 line-level 불일치다.
- 제안: `plan/in-progress/web-chat-console.md` 가 `plan/complete/` 로 이동 완료될 때 `status: implemented` 가 확정된다. 그 전까지는 `status: partial` + `pending_plans: [plan/in-progress/web-chat-console.md]` 가 규약에 더 부합한다. Phase 4 e2e·user guide 가 완료·이동된 후 `implemented` 로 전환할 것을 권고.

---

### [INFO] `use-web-chat.ts` — `InteractionTokenStrategy` 타입에 `"per_trigger"` 포함 (파일 관련)
- 위치: `codebase/frontend/src/components/web-chat/use-web-chat.ts` 줄 25, `codebase/frontend/src/lib/types/trigger` (추정)
- 상세: `tokenStrategy?: InteractionTokenStrategy` 가 `"per_execution" | "per_trigger"` 유니언이고, 생성(`useCreateWebChat`)에서는 `"per_execution"` 만 사용한다. consistency rationale 검토가 INFO 로 지적했다. 기능 경로에서는 per_trigger 가 사용되지 않으므로 CRITICAL/WARNING 은 아니다. 단, `useUpdateWebChatAppearance` 가 기존 인스턴스의 `tokenStrategy` 를 그대로 전달(줄 160)하므로, 기존 trigger 에 `per_trigger` 가 설정됐을 경우 PATCH 시 보존된다 — 이는 올바른 동작이다.
- 제안: 없음(현재 동작 정합). `spec/7-channel-web-chat/3-auth-session.md §2·§R3` 에 "per_trigger 는 웹채팅 콘솔에서 생성하지 않음"을 주석으로 명시하면 예방적으로 유용하나 필수 아님.

---

### [INFO] `use-appearance-draft.ts` — localStorage 시드 우선순위 미묘한 edge case
- 위치: `codebase/frontend/src/components/web-chat/use-appearance-draft.ts` 줄 77–85
- 상세: `seedDraft()` 는 서버 `appearance` 가 있으면(`hasServerAppearance()`) 그것을 우선하고, 없으면 localStorage 를 시도한다. `hasServerAppearance()` 는 "하나라도 비어 있지 않은 값 존재"를 기준으로 한다(줄 73). 운영자가 서버에 빈 상태(`{}` 또는 모든 필드 `""`)를 저장하고자 하는 경우, `hasServerAppearance` 가 false 를 반환해 서버 clear 의도가 localStorage 에 의해 덮여쓰여질 수 있다. 그러나 스펙(`spec 5-admin-console §4`)에서 "저장된 값이 항상 우선"을 명시하므로, 서버에 빈 객체를 저장하는 시나리오는 지원 범위 외로 봐도 무방하다. 현재 구현은 spec 의도와 부합한다.
- 제안: 없음.

---

### [INFO] `live-preview.tsx` — `wc:ready` 타임아웃 8초, spec 에 미정의
- 위치: `codebase/frontend/src/components/web-chat/live-preview.tsx` 줄 18 (`READY_TIMEOUT_MS = 8000`)
- 상세: `spec/7-channel-web-chat/5-admin-console.md §6` 은 타임아웃 값을 명시하지 않는다. 구현이 8초를 선택했다. 타임아웃 후 "unavailable" 안내가 표시되는 동작은 §5 의 "동봉 번들 자체가 없을 때만 스니펫/미리보기 UI 를 비활성 + 경고"와 정합하다. 값 자체가 규약에서 정의되지 않아 구현이 임의로 선택했으나, 기능 위반은 아니다.
- 제안: 없음.

---

### [INFO] `snippet.ts` — `</script>` 이스케이프 + U+2028/2029 처리
- 위치: `codebase/frontend/src/lib/web-chat/snippet.ts` 줄 92–98
- 상세: `escapeForScript()` 가 `</script>` 조기 종료 + JS 라인 구분자(U+2028/U+2029) 를 이스케이프한다. 이는 spec 에 명시되지 않은 방어적 보안 구현으로, 운영자가 입력한 값이 스니펫 JSON 에 포함될 때 XSS 를 방지한다. 서버 측 `WebChatAppearanceDto` 의 화이트리스트 검증과 클라이언트 `sanitizeDraft` 의 다층 방어로 인해 실제로 악성 값이 흘러오기 어렵지만, 방어 심층화 관점에서 적절한 구현이다.
- 제안: 없음.

---

### [INFO] `_product-overview.md` 비목표 항목 갱신 + D 구성요소 추가 (파일 31)
- 위치: `spec/7-channel-web-chat/_product-overview.md` 줄 2310–2313, 2320
- 상세: 비목표 항목이 "per-workspace 테마/브랜딩 관리 콘솔" 으로 범위를 좁히고, per-instance 서버 저장은 v1 범위임을 단서로 명시했다. 구현 `useUpdateWebChatAppearance()` 가 trigger 단위(`PATCH /api/triggers/:id`)로 저장하며 workspace 단위 저장을 하지 않으므로, 비목표 범위가 구현과 정합한다. 구성요소 D(운영 콘솔)가 테이블에 추가됐고, 실제 코드 경로(`codebase/frontend/src/app/(main)/web-chat/**`)와 일치한다.
- 제안: 없음.

---

## 요약

이번 증분에서 도입된 코드 변경과 spec 갱신은 전반적으로 의도한 기능을 충실히 구현하고 있다. NAV-WC-04 Critical(백엔드 미저장 → 서버 저장 갱신), cross_spec WARNING(EIA spec `appearance` 서브객체 미정의, `authType` 잔류), plan_coherence WARNING(spec-draft 역반영 누락) 이 모두 이번 증분의 spec 갱신으로 해소됐다. 구현 코드(`use-web-chat.ts`, `use-appearance-draft.ts`, `live-preview.tsx`, `widget-base.ts`, `snippet.ts`, `embed-config.service.ts`, `WebChatAppearanceDto`, `InteractionConfigDto`)는 `spec/7-channel-web-chat/5-admin-console.md` 의 §2·§4·§5·§6·§7 과 line-level 로 일치한다. 핵심 비즈니스 규칙 — 트리거 재사용(신규 엔티티 없음), per-instance 서버 저장, localStorage draft 캐시(서버 SoT), wc:boot 재전송 멱등 갱신, same-origin 동봉 iframe 미리보기, embed-config fail-open soft 검증, viewer+ 조회·editor+ 편집 RBAC — 이 모두 구현과 spec 에서 정합하게 기술·구현됐다. 유일하게 주목할 사항은 `5-admin-console.md` frontmatter 의 `status: implemented` 설정이 plan 이 아직 `in-progress` 에 잔류하는 상태에서 조기 설정된 가능성이 있는 점이다. hooks.controller.ts 의 `/embed-config` 캐시 헤더 적용 여부도 별도 확인이 권장된다.

---

## 위험도

LOW

(Critical 없음. WARNING 1건: `5-admin-console.md status: implemented` 의 조기 설정 가능성 — plan 완료이동 시 자동 해소. 나머지는 INFO 수준 문서화·명확화 사항.)

---

STATUS: OK
