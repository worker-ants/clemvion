# Cross-Spec 일관성 검토 결과

검토 모드: 구현 완료 후 (--impl-done)
대상 plan: `plan/complete/web-chat-loader-iframe-position.md`
diff-base: origin/main

---

## 발견사항

충돌 없음 — 이하 근거.

### [INFO] `DEFAULT_Z_INDEX = 2147483000` 값이 spec §1 예시값과 정확히 일치

- target 위치: `codebase/packages/web-chat-sdk/src/bridge.ts` (신규 export 상수)
- 충돌 대상: `spec/7-channel-web-chat/2-sdk.md §1` 스니펫 예시 `zIndex: 2147483000`
- 상세: 충돌 없음. 구현 상수값(`2147483000`)이 spec §1 예시값과 동일해 일관적이다. 상수명 `DEFAULT_Z_INDEX` 는 spec 의 "기본값" 표현과도 부합한다.
- 제안: 현재 spec §4 `BootConfig.appearance.zIndex?: number` 와 §1 예시값은 동기화됐으나, spec 본문에 "기본 z-index = 2147483000" 을 명시하는 규범적 문장이 없다. 구현이 spec 예시를 선도한 상태이므로 spec §4 또는 §3 에 "미지정 시 loader 기본값 `2147483000`" 을 1행 추가하면 향후 다른 구현자가 동일 값을 독립 선택할 수 있다 (필수 아님 — INFO 수준).

### [INFO] `BridgeDeps.position / zIndex` 필드가 `BootConfig.appearance.*` 계층을 직접 노출

- target 위치: `codebase/packages/web-chat-sdk/src/bridge.ts` — `BridgeDeps` 인터페이스 신규 필드
- 충돌 대상: `spec/7-channel-web-chat/2-sdk.md §4` `BootConfig.appearance.position / zIndex`
- 상세: 충돌 없음. `BridgeDeps` 는 내부(패키지 내) 인터페이스이며 `boot()` 가 `config.appearance?.position / zIndex` 를 flattening 해 전달한다. 공개 계약인 `BootConfig.appearance` 는 변경 없이 spec §4 와 정확히 일치한다.
- 제안: 없음. 내부 구현 캡슐화 패턴은 정상.

---

## 요약

이번 변경(iframe 코너 고정 + z-index 기본값 적용)은 `spec/7-channel-web-chat/2-sdk.md §3`("position/zIndex 는 `appearance` 를 따른다"), `§4` BootConfig 스키마(`position?: 'bottom-right' | 'bottom-left'; zIndex?: number`), `§1` 예시값(`zIndex: 2147483000`)과 완전히 정합한다. 변경 범위는 web-chat SDK 내부(`BridgeDeps`, `WidgetBridge`, `boot()` 배선)에 한정되며, 데이터 모델(spec/1-data-model.md), API 계약(spec/5-system), 요구사항 ID, 상태 전이, RBAC, 계층 책임 등 다른 spec 영역과의 충돌이 없다. INFO 수준 제안 두 건은 spec 보강 권고 사항이며 구현을 차단하지 않는다.

---

## 위험도

NONE
