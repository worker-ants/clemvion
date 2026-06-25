# Rationale 연속성 검토 결과

검토 모드: --impl-prep  
Target: `plan/in-progress/web-chat-loader-iframe-position.md`  
관련 Spec: `spec/7-channel-web-chat/2-sdk.md`

---

## 발견사항

특이사항 없음. 아래는 전체 점검 결과 요약이다.

### [INFO] target 이 spec Rationale 를 정확히 참조·인용하고 있음

- target 위치: `plan/in-progress/web-chat-loader-iframe-position.md` §Root cause
- 과거 결정 출처: `spec/7-channel-web-chat/2-sdk.md §3 (line 106)` — `position/zIndex 는 appearance 를 따른다`
- 상세: target 은 "spec 2-sdk §3(line 106)는 `position/zIndex 는 appearance 를 따른다`고 명시 → 구현이 spec 을 안 따른 버그" 라고 명시하며, 기각되거나 폐기된 대안을 재도입하지 않는다. 수정 방향(bottom/side: 0, zIndex: DEFAULT_Z_INDEX 2147483000)은 spec §3 및 §4 BootConfig 예시(`zIndex: 2147483000, position: 'bottom-right'`)와 완전히 일치한다.
- 제안: 현 상태로 적합. spec §3 에 "host iframe 에 설정되는 구체 스타일(`bottom:0`, `left:0`/`right:0`, `z-index`)" 을 1줄 보강하면 이후 유사 버그 예방에 도움이 된다고 target 스스로 언급하고 있으나 이는 구현 이후 선택적 개선이다.

### [INFO] iframe-in-DOM vs iframe-외부-런처 아키텍처 결정과 정합

- target 위치: `plan/in-progress/web-chat-loader-iframe-position.md` §Root cause 2번째 단락
- 과거 결정 출처: `spec/7-channel-web-chat/2-sdk.md §1` — "런처(위젯 진입점)는 별도 DOM 주입이 아니라 iframe 내부 위젯 SPA 가 렌더하며, loader 는 wc:resize 로 iframe 박스만 조절한다"
- 상세: target 은 "위젯 SPA 는 iframe 내부에서 런처/패널을 `position:fixed; bottom:16px; left/right:16px`로 띄우고, host iframe 을 코너 flush(bottom:0 + side:0)로 고정해야 내부 런처가 페이지 모서리 16px 에 온다" 고 설명한다. 이는 spec 의 "런처는 iframe 내부, loader 는 박스만 조절" 아키텍처 invariant 를 그대로 따른다. host iframe 박스 수정(bottom/side 추가)은 이 원칙의 정확한 적용이며, loader 가 런처를 직접 DOM 에 주입하는 기각된 대안으로 후퇴하지 않는다.
- 제안: 없음.

### [INFO] 콘솔 라이브 미리보기 경로와 SDK 로더 경로 분리 — 기존 아키텍처와 정합

- target 위치: `plan/in-progress/web-chat-loader-iframe-position.md` §Root cause 3번째 단락
- 과거 결정 출처: `spec/7-channel-web-chat/2-sdk.md` 전반적 구조 (스니펫 로더 경로 vs 직접 iframe 경로 구분)
- 상세: target 은 "콘솔 미리보기는 SDK 로더가 아니라 콘솔 레이아웃 박스 안의 직접 iframe 이라 이 경로를 안 타서 버그가 안 드러났다" 고 서술한다. 이는 두 경로가 별개임을 인정하는 것으로, 기존 아키텍처 결정(스니펫/npm 로더 경로와 콘솔 내부 경로의 분리)과 충돌하지 않는다. 수정 범위를 `packages/web-chat-sdk` 로더 경로로만 한정한 것도 원칙에 부합한다.
- 제안: 없음.

---

## 요약

`plan/in-progress/web-chat-loader-iframe-position.md` 는 순수 버그픽스 plan 으로, 기각된 대안을 재도입하거나 합의된 설계 원칙을 위반하는 내용이 없다. target 이 직접 인용한 `spec/7-channel-web-chat/2-sdk.md §3 (line 106)` 의 결정(position/zIndex 는 appearance 를 따른다), §1 의 아키텍처 invariant (런처는 iframe 내부, loader 는 박스만 조절), §4 BootConfig 예시값(zIndex: 2147483000, position: 'bottom-right'/'bottom-left')이 모두 수정 방향과 일치한다. spec 변경 없음 선언도 현 spec 이 이미 이 동작을 명시하고 있다는 점에서 적절하며, Rationale 연속성 관점에서 차단 사항은 없다.

---

## 위험도

NONE
