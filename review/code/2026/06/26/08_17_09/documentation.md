### 발견사항

- **[INFO]** `BridgeDeps.position` / `zIndex` 필드의 JSDoc 문서 수준은 충분하다.
  - 위치: `/Volumes/project/private/clemvion/codebase/packages/web-chat-sdk/src/bridge.ts` lines 398–401
  - 상세: 신규 추가된 두 필드 모두 spec 참조(`spec 2-sdk §3`)와 기본값 동작을 한 줄 주석으로 명시하고 있다. 인라인 블록 주석(lines 437–440)도 `position:fixed` 단독 사용의 문제와 코너 flush 이유를 충분히 설명한다.
  - 제안: 현재 수준 유지 적절.

- **[INFO]** `DEFAULT_Z_INDEX` 상수 JSDoc이 있으나 spec 참조 섹션 번호가 부정확하다.
  - 위치: `/Volumes/project/private/clemvion/codebase/packages/web-chat-sdk/src/bridge.ts` line 407
  - 상세: 주석은 "spec 2-sdk §3 예시값"이라고 하지만, spec §3(line 106)은 z-index 숫자값을 직접 명시하지 않고 `appearance`를 따른다는 원칙만 기술한다. 실제 예시 값 `2147483000`은 spec §1 스니펫 예제(line 38)에 등장한다.
  - 제안: 주석을 "spec 2-sdk §1 스니펫 예시값"으로 수정하거나 "§1 코드 예제에 나타난 값"으로 명확화.

- **[INFO]** `WidgetBridge` 클래스 수준 JSDoc(클래스 전체 설명)이 없다.
  - 위치: `/Volumes/project/private/clemvion/codebase/packages/web-chat-sdk/src/bridge.ts` line 417
  - 상세: `export class WidgetBridge` 선언 바로 위에 클래스 목적을 요약하는 JSDoc이 없다. 공개 클래스이므로 API 문서 생성 도구가 설명을 수집하지 못한다. 파일 상단의 모듈 레벨 주석(lines 1–4)이 일부 역할을 하지만 클래스 문서는 클래스 선언부에 있어야 한다.
  - 제안: 클래스 선언 위에 JSDoc을 추가. 예: `/** host ↔ iframe postMessage bridge. boot config 에 따라 iframe 을 생성하고 wc:* 프로토콜로 명령 큐·이벤트 구독·resize 적용을 담당한다. */`

- **[INFO]** `destroy()` 메서드에 JSDoc이 없다.
  - 위치: `/Volumes/project/private/clemvion/codebase/packages/web-chat-sdk/src/bridge.ts` line 489
  - 상세: `post`, `on`, `off`는 JSDoc이 있으나 `destroy()`는 주석이 없다. 외부에서 직접 호출 가능한 공개 메서드다.
  - 제안: `/** iframe 과 메시지 리스너를 제거하고 내부 상태를 정리한다. 이후 인스턴스 재사용 불가. */` 추가.

- **[INFO]** spec 2-sdk §3 line 106은 "position/zIndex 는 `appearance` 를 따른다"고 한 줄로만 기술하며, host 가 실제로 어떤 CSS 속성(`bottom:0`, `left/right:0`, `z-index`)을 설정해야 하는지 구체적인 구현 명세가 없다.
  - 위치: `/Volumes/project/private/clemvion/spec/7-channel-web-chat/2-sdk.md` line 106
  - 상세: plan 파일(`plan/in-progress/web-chat-loader-iframe-position.md` # spec 섹션)도 "필요 시 §3 에 host 가 설정하는 정확한 style(bottom/side/z-index) 1줄 보강 검토"라고 스스로 인지하고 있다. 현재 spec 을 읽는 다른 개발자가 구현 방법을 파악하기 어렵다.
  - 제안: §3의 `wc:resize host 처리(필수)` 단락 끝에 "host iframe 고정 배치: `position:fixed; bottom:0; left:0`(bottom-left) 또는 `right:0`(bottom-right 기본); `z-index: appearance.zIndex ?? 2147483000`" 한 줄을 추가하면 spec 과 구현의 정합성이 명확해진다. 이는 project-planner 역할의 별도 작업으로 위임이 필요하다.

- **[INFO]** plan 파일이 `in-progress` 상태로 남아 있다.
  - 위치: `/Volumes/project/private/clemvion/plan/in-progress/web-chat-loader-iframe-position.md`
  - 상세: 체크리스트 모든 항목이 `[x]` 완료 표시이며 커밋도 완료됐다. `plan/complete/` 로 이동이 아직 처리되지 않은 것으로 보인다.
  - 제안: 머지 완료 후 plan-lifecycle 규칙에 따라 `plan/complete/` 로 이동 처리.

- **[INFO]** 테스트 파일 자체의 describe 블록 설명이 문서 역할을 잘 수행하고 있다.
  - 위치: `/Volumes/project/private/clemvion/codebase/packages/web-chat-sdk/src/bridge.spec.ts` lines 63–91
  - 상세: 신규 테스트 케이스명이 기대 동작을 충분히 설명하고 있으며, "position:fixed 만으로는 본문 끝 정적 위치에 박혀 화면 밖으로 나간다 — 코너 anchor 필수" 인라인 주석이 비전문가도 이해할 수 있게 근거를 설명한다.
  - 제안: 현재 수준 유지.

- **[INFO]** README 또는 SDK 사용법 문서 업데이트 필요성 없음.
  - 상세: `position`/`zIndex`는 기존 `appearance` 객체 하위 옵션으로 이미 spec §4 BootConfig 스키마와 spec §1 스니펫 예제에 문서화되어 있다. 사용자 노출 API 계약은 변경되지 않으며 버그 수정 성격이므로 별도 사용자 문서 갱신은 불필요하다.

### 요약

이번 변경은 기존 spec이 이미 요구한 `position`/`zIndex` 동작의 누락된 구현을 채우는 버그 수정이다. 신규 코드의 인라인 주석·JSDoc·테스트 설명은 전반적으로 충실하며 spec 참조도 명시되어 있다. 다만 세 가지 소규모 문서 갭이 있다: (1) `DEFAULT_Z_INDEX` 주석의 spec 섹션 번호 오기재, (2) `WidgetBridge` 클래스 및 `destroy()` 메서드 수준 JSDoc 부재, (3) spec §3 자체에 host가 설정할 구체적 CSS 속성이 명시되지 않아 spec-impl 정합성 문서가 불완전하다. 이 중 spec 보강은 developer가 직접 처리할 수 없으며 project-planner 위임 또는 후속 작업으로 이월이 필요하다.

### 위험도
LOW
