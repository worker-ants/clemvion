# Cross-Spec 일관성 검토 — spec-draft-webchat-i18n-scope

대상: `plan/in-progress/spec-draft-webchat-i18n-scope.md` (Edit A~D: `spec/conventions/i18n-userguide.md`,
`spec/7-channel-web-chat/_product-overview.md` §2, `spec/7-channel-web-chat/2-sdk.md` §4,
`spec/7-channel-web-chat/5-admin-console.md` §4)

## 검증 방법

draft 가 인용하는 실제 spec 본문(`spec/conventions/i18n-userguide.md`, `spec/7-channel-web-chat/_product-overview.md`,
`2-sdk.md`, `5-admin-console.md`)과 인접 영역(`spec/0-overview.md`, `spec/1-data-model.md`,
`spec/2-navigation/_product-overview.md` NAV-WC-*, `spec/5-system/14-external-interaction-api.md`,
`spec/conventions/conversation-thread.md`, `spec/conventions/spec-impl-evidence.md`, `PROJECT.md`,
`.claude/config/doc-sync-matrix.json`, `hardcoded-korean-ratchet.test.ts`)를 직접 대조했다. draft 내 라인 번호·앵커
인용(`5-admin-console.md:117-118`, `:126`, `:214`, `_product-overview.md #2-목표--비목표`, `2-sdk.md
#4-boot-config-스키마`)은 모두 현재 파일과 정확히 일치함을 확인했다(stale 없음). `new-ui-string` glob
(`codebase/frontend/src/**/*.tsx`)과 `hardcoded-korean-ratchet.test.ts` 의 `SCAN_ROOTS = ["components","app","lib"]`
(= `codebase/frontend/src/{...}`)도 draft 의 "가드가 이미 위젯을 스캔 밖에 둔다" 주장과 일치한다.

## 발견사항

- **[INFO]** 새 "적용 범위" 절이 `codebase/packages/**` 를 명시하지 않음
  - target 위치: Edit A, `spec/conventions/i18n-userguide.md` 신설 `## 적용 범위 (Scope)` — "적용 대상:
    `codebase/frontend/**`·`codebase/backend/**`" / "제외 대상: `codebase/channel-web-chat/**`"
  - 충돌 대상: 최상위 `CLAUDE.md` 폴더 구조 — `codebase/{frontend,backend,packages,channel-web-chat}` 4개 영역을
    구분. `spec/conventions/spec-impl-evidence.md:128` 의 `spec-link-integrity.test.ts` 소스 스캔 범위도
    `codebase/{backend,frontend,channel-web-chat,packages}` 4영역을 명시적으로 나열한다.
  - 상세: 이번 draft 의 트리거 자체가 "규약이 침묵하면 반복 WARNING 이 난다"는 문제였다. 새 Scope 절은 그 침묵을
    `codebase/frontend/**`·`codebase/backend/**`(포함)와 `codebase/channel-web-chat/**`(제외) 2개 영역에 대해서만
    닫고, 나머지 한 영역인 `codebase/packages/**`(`web-chat-sdk`/`sdk`/`expression-engine`/`graph-warning-rules`/
    `node-summary`/`chat-channel-validation`)에 대해서는 포함·제외 어느 쪽도 명시하지 않는다. 실측 확인 결과
    현재 `codebase/packages/**` 에는 `.tsx`/`.jsx` 파일이 없고(헤드리스 라이브러리) UI 렌더링 문자열도 없어
    Principle 1(TSX 하드코딩 금지)이 적용될 표면이 현재는 없다 — 그래서 **당장 실제 충돌은 아니다**. 다만 향후
    packages 안에 UI 컴포넌트(예: `web-chat-sdk` 데모/설정 UI)가 생기면 동일한 "규약 침묵" 문제가 재발할 여지가
    남는다.
  - 제안: Edit A 의 "적용 대상"/"제외 대상" 나열에 `codebase/packages/**`(예: "현재 UI 렌더링 표면 없음 — TSX 도입
    시 재검토" 1줄)를 명시적으로 포함해 완전성을 확보하는 것을 권장한다. 코드 변경도 재작업도 필요 없는 문구
    추가라 draft 의 "코드 변경 없음" 원칙과 충돌하지 않는다. 사소하므로 다음 개정에 묶어도 무방.

- **[INFO]** `5-admin-console.md §6.1:214` remount-on-locale-change 와 "inert" 프레이밍의 표면적 긴장
  - target 위치: Edit C/D (`2-sdk.md §4`, `5-admin-console.md §4` locale 각주) 및 draft 자체의 "side-effect
    점검 대상" 항목
  - 충돌 대상: `spec/7-channel-web-chat/5-admin-console.md:206-214` (§6.1 boot config 전달 메커니즘) — "**`endpointPath`/
    `locale`** 이 바뀔 때만 iframe key 를 바꿔 재마운트"
  - 상세: §6.1 은 `locale` 을 `endpointPath` 와 동급으로 "identity 변경 → 강제 재마운트" 대상에 묶어 두어, 처음
    읽는 사람은 "locale 이 뭔가 기능적으로 유의미하니 재마운트하는구나"로 오해할 여지가 있다 — Edit C/D 가 선언하는
    "reserved/inert(위젯 언어 미변경)" 와 결이 다르게 읽힐 수 있다. 이는 실제 spec 모순은 아니다(remount 는
    forward-compat 목적으로 정당화 가능하고, draft 도 이를 이미 "무모순"으로 판단해 §6.1 무변경을 선택했다) — 다만
    두 절이 서로 다른 문서 위치(2-sdk §4 vs admin-console §6.1)에 있어 향후 리뷰어가 다시 같은 의문을 제기할 가능성이
    있다.
  - 제안: 선택 사항. §6.1:214 문장 끝에 "(reserved 필드 — [2-sdk §4](./2-sdk.md#4-boot-config-스키마))" 각주를 붙여
    두 절을 상호 참조시키면 재발 방지에 도움이 되나, 필수 아님. 반영하지 않아도 BLOCK 사유 아님.

기타 5개 관점(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC) 은 draft 가 신규 엔티티·필드·엔드포인트·요구사항
ID·상태 머신·권한 규칙을 전혀 도입하지 않으므로(순수 문서/스코프 명문화, 코드·데이터 변경 없음) 해당 사항 없음.
특히:
- `spec/1-data-model.md §2.1 User.locale`("언어 설정, 기본 ko")과 draft 의 `BootConfig.locale`(위젯 boot config
  필드)은 이름만 같을 뿐 서로 다른 도메인(제품 내부 사용자 vs 위젯 방문자)이라 필드 재정의 충돌이 아니다 — 기존
  `AuthConfig.type` vs `Integration.auth_type` 처럼 이미 문서 전반에서 "동일 이름·다른 도메인"을 허용하는 기존
  패턴과 정합적이다.
- `spec/7-channel-web-chat/5-admin-console.md §8`("i18n KO/EN 동반 갱신 의무" — 콘솔 메뉴/페이지 문자열용)은
  구성요소 D(운영 콘솔, `codebase/frontend/**`)를 대상으로 하며 draft 가 제외하는 위젯 SPA
  (`codebase/channel-web-chat/**`)와 겹치지 않는다 — draft 도 이 절을 건드리지 않는다. 일관.
- `spec/conventions/conversation-thread.md §9`(임베드 위젯 UI 계약 스코프 예외 선례)가 이미 "임베드형 채널 위젯은
  에디터/콘솔과 다른 규약을 따른다"는 동일 패턴을 확립해 두어, 이번 draft 의 i18n 스코프 분리 접근과 정합적이다.
- `spec/2-navigation/_product-overview.md` NAV-WC-01~06, `spec/5-system/14-external-interaction-api.md` 의
  `interaction.appearance.locale` 예시 어디에도 "locale 이 위젯 UI 언어를 바꾼다"는 상충 주장이 없다.

## 요약

target draft 는 신규 데이터 모델·API·요구사항 ID·상태 전이·RBAC 를 전혀 도입하지 않는 순수 문서/스코프 명문화이며,
인용하는 모든 라인 번호·앵커가 현재 spec 본문과 정확히 일치하고, 근거로 든 코드 가드 범위(`hardcoded-korean-
ratchet.test.ts`, `doc-sync-matrix.json` `new-ui-string`)도 실측과 부합한다. 인접 영역
(`1-data-model.md` User.locale, `5-admin-console.md §8` 콘솔 i18n 의무, `conversation-thread.md §9` 임베드 위젯
스코프 예외, EIA `interaction.appearance` 예시)과도 실질적 충돌이 없으며 오히려 기존 "임베드 위젯은 별도 스코프"
패턴과 정합적이다. 유일한 잔여 갭은 새 "적용 범위" 절이 `codebase/packages/**` 를 명시적으로 다루지 않는다는 점인데,
현재 packages 안에 UI 렌더링 표면이 없어 실제 충돌은 아니고 완전성 차원의 INFO 다. `5-admin-console §6.1` 의
remount-on-locale-change 문구도 draft 가 이미 검토해 무모순으로 판단한 사안으로 재확인됐다.

## 위험도

LOW
