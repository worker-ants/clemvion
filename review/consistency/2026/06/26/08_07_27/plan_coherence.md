# Plan 정합성 검토 결과

검토 모드: `--impl-prep`
Target: `plan/in-progress/web-chat-loader-iframe-position.md`
검토 기준: `plan/in-progress/**` 전체

---

## 발견사항

발견된 충돌·미해소·누락 사항이 없습니다.

---

## 상세 검토

### 1. 미해결 결정과의 충돌

target 이 내리는 결정:
- `BridgeDeps` 에 `position?: "bottom-right"|"bottom-left"` + `zIndex?: number` 추가
- iframe 에 `bottom:0`, `right:0`(기본) 또는 `left:0`(`bottom-left`) 고정
- `DEFAULT_Z_INDEX = 2147483000` 기본값 적용

확인 결과: `spec/7-channel-web-chat/2-sdk.md` line 38·106·115 가 이미 `appearance.position`(`'bottom-right'|'bottom-left'`) 과 `zIndex`(예시값 2147483000)를 명시하고, "position/zIndex 는 `appearance` 를 따른다"고 확정되어 있다. target 이 일방적으로 결정하는 미해결 항목이 아니라 기존 spec 의 버그 수정 구현이다. 충돌 없음.

관련 in-progress plan 중 web-chat SDK·로더 영역을 다루는 항목:
- `channel-web-chat-impl.md` — WidgetBridge 초기 구현. 본 변경은 해당 plan 완료 이후 발견된 버그 fix 로 scope 직교.
- `channel-web-chat-followups.md` — 전체 파킹(보류) 상태, 활성 TODO 0건. 본 변경과 영역 무관.
- `web-chat-snippet-queue-stub.md` — `snippet.ts` 수정. `packages/web-chat-sdk` 의 `bridge.ts`·`index.ts`·`bridge.spec.ts`·`index.spec.ts` 는 수정 대상이 아님. 파일 충돌 없음.
- `web-chat-preview-improvements.md` — 백엔드 `execution.message` 이벤트·EIA·미리보기 UI. `packages/web-chat-sdk` 건드리지 않음. 충돌 없음.
- `webchat-eager-start.md` — 완료 단계(impl-done BLOCK:NO), backlog만 잔여. `bridge.ts` 미수정. 충돌 없음.
- `eia-sdk-publish.md` — publish 정책 결정만(internal-only 확정). 패키지 코드 변경 없음.

결론: 미해결 결정과의 충돌 없음.

### 2. 선행 plan 미해소

target 이 가정하는 사전 조건:
- `packages/web-chat-sdk` 패키지 존재(bridge.ts / index.ts 파일 구조)
- spec `2-sdk.md §3` 에 position/zIndex 명세 존재

두 조건 모두 이미 충족됨(`channel-web-chat-impl.md` 구현 완료, spec 명세 기작성).

결론: 선행 plan 미해소 없음.

### 3. 후속 항목 누락

target 변경이 미치는 파급:
- `packages/web-chat-sdk/src/bridge.ts`·`index.ts` 수정 → 로더 빌드 재배포 필요(target 자체가 "배포 주의" 섹션에서 명시).
- spec 변경 없음(target 명시: "변경 없음 — §3 이미 명시, 필요 시 §3 보강 1줄 검토").
- 다른 plan 이 `bridge.ts`·`index.ts`를 수정 예정인 항목 없음 — 후속 항목 무효화 없음.

결론: 후속 항목 누락 없음.

---

## 요약

`web-chat-loader-iframe-position.md` 는 `spec/7-channel-web-chat/2-sdk.md §3` 이 이미 확정한 `appearance.position`/`zIndex` 명세를 구현이 따르지 않은 순수 버그 수정이다. 진행 중인 다른 plan 과 파일 충돌이 없고, 미해결 결정을 우회하거나 선행 조건이 미해소된 항목도 없으며, 후속 plan 을 무효화하는 변경도 없다. Plan 정합성 관점에서 즉시 착수 가능하다.

## 위험도

NONE
