> **복구본**: disk-write gap — journal 반환값 복구.

## 발견사항

- **[CRITICAL]** `locale` "boot 시 1회 해석·고정" 계약 위반 — `wc:boot` 재전송만으로 실제 UI 언어가 바뀜(스펙이 명시적으로 금지하는 동작)
  - 위치: `codebase/channel-web-chat/src/widget/widget-app.tsx:26-30`
    ```ts
    const locale = useMemo(
      () => resolveLocale(config?.locale, currentNavigatorLang()),
      [config?.locale],
    );
    ```
  - 상세: 이번 diff 로 `spec/7-channel-web-chat/2-sdk.md` §3("단 `locale` 은 boot 시 1회 해석되므로(§4·R6) 재전송만으로는 UI 언어가 바뀌지 않는다 — locale 변경은 iframe 재마운트가 필요하다"), `1-widget-app.md §4`("locale 변경은 재전송이 아니라 iframe 재마운트로 반영된다"), `5-admin-console.md §6.1`("locale 은 boot 시 1회 해석되므로 … 재마운트로 새 위젯 UI 언어를 적용한다") 세 곳이 동일한 계약을 명문화했고, `widget-app.tsx` 자신의 코드 주석도 "locale 변경은 iframe 재마운트로 반영"이라 주장한다. 그러나 실제 구현은 `config?.locale`을 의존성으로 삼는 `useMemo`라, `useWidget`의 `bridge.onBoot`(→`applyConfig`→`setConfig`)이 **모든** `wc:boot` 수신(최초 boot 뿐 아니라 재전송)마다 `config` state를 무조건 갱신하고, `config?.locale` 값이 이전과 달라지면 `useMemo`가 즉시 재계산되어 **iframe 재마운트 없이** UI 언어가 바뀐다. 직접 스크래치 리프로 테스트로 확인함: `WidgetApp` 마운트 → `locale:'ko'`로 boot → 이어서 **같은 인스턴스에** `locale:'en'`으로 `wc:boot` 재전송 → `screen.getByLabelText("Open chat")`(EN 런처)이 즉시 나타나고 `"채팅 열기"`(KO)는 사라짐(반증 테스트는 검증 후 삭제함). 관리 콘솔의 `LivePreview`(`codebase/frontend/src/components/web-chat/live-preview.tsx`)는 `key={iframeSrc}`에 `locale`을 포함시켜 자체적으로 항상 리마운트하므로 현재 유일한 호스트에서는 이 경로가 가려지지만, `2-sdk.md`는 이를 **범용 SDK 계약**으로 문서화했고(host가 직접 `wc:boot`를 postMessage하는 저수준 경로도 명시적으로 허용), 이 계약을 강제하는 코드/테스트가 전혀 없다. 즉 스펙(권위) · 코드 자신의 주석(의도) · 실제 런타임 동작이 3자 불일치.
  - 제안: `widget-app.tsx`의 locale 해석을 "boot 완료 후 1회만 고정"하도록 변경(예: `useRef`/lazy `useState`로 `config`가 처음 non-null이 되는 시점의 `resolveLocale` 결과만 캡처하고 이후 `config?.locale` 변화는 무시). 이후 이 불변식을 검증하는 회귀 테스트(동일 인스턴스에 locale이 다른 두 번째 `wc:boot`를 보내도 chrome 언어가 그대로인지) 추가.

- **[INFO]** `_product-overview.md §2` — 신규 i18n 목표가 "목표 (v1)" 목록이 아니라 "비목표" 목록 하위에 남음 (plan 서술과 실제 Edit 위치 불일치)
  - 위치: `spec/7-channel-web-chat/_product-overview.md` §2 (line 40 이하 "비목표 (v1 → 백로그)" 블록 내부, "위젯 UI 다국어화 — 잔여 비목표" 항목의 하위 `단 …목표로 승격` 문구)
  - 상세: `plan/in-progress/spec-draft-webchat-en-i18n.md` §4 "Edit A"는 "'위젯 UI 다국어화(EN 등)' 비목표 항목을 **목표로 이동**(chrome 한정)"이라고 명시했으나, 실제 diff는 해당 항목을 "목표 (v1)"(line 29-39) 목록으로 옮기지 않고 여전히 "비목표 (v1 → 백로그)" 목록 안에 남긴 채 "단 … 목표로 승격한다"는 예외 문장만 삽입했다. 내용 자체는 정확하지만(승격 사실은 명시됨), 문서 구조상 "목표 (v1)" 불릿만 훑는 독자는 이 신규 목표를 놓칠 수 있어 plan이 스스로 서술한 Edit 의도와 실제 적용 위치가 다르다.
  - 제안: 기능에 영향 없는 문서 정리 사항 — 후속 spec 정리 시 해당 항목을 "목표 (v1)" 목록으로 실제 이동하거나, Edit A 서술을 "비목표 목록 내 예외 문구로 승격 명시"로 정정.

## 요약
i18n 메커니즘(위젯 로컬 catalog·`t()`·`resolveLocale`) 자체는 매우 꼼꼼하다 — ko/en 32키 전수 parity·placeholder parity·비어있지 않은 문자열 가드(catalog.test.ts)가 통과하고, 위젯 소스 전체를 스캔한 결과 하드코딩 한국어 UI 문자열이 남아있지 않으며(주석·console 진단문 제외), 채널 전체 vitest 335/335·`tsc --noEmit`·`test_doc_sync_matrix.py` 7/7이 모두 통과한다. 그러나 이번 diff가 새로 추가한 "`locale`은 boot 시 1회 해석 후 고정되며 변경은 iframe 재마운트로만 반영된다"는 SDK 계약(2-sdk.md/1-widget-app.md/5-admin-console.md 3곳 명문화 + 코드 자신의 주석)이 `widget-app.tsx`의 `useMemo` 의존성 배열 때문에 실제로 지켜지지 않는다 — `wc:boot` 재전송만으로 재마운트 없이 UI 언어가 즉시 바뀌는 것을 리프로로 확인했다. 유일한 현재 호스트(운영 콘솔 라이브 미리보기)는 자체적으로 항상 iframe key 리마운트를 강제해 이 경로를 우회하므로 제품 시연 상 증상은 나타나지 않지만, 문서화된 범용 SDK 계약을 위반하는 명백한 spec-code 불일치이며 이를 막는 테스트도 없다. 그 외에는 `_product-overview.md`의 목표 목록 배치 위치가 plan 서술과 미세하게 다른 정도의 INFO성 발견뿐이다.

## 위험도
HIGH
