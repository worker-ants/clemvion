# 요구사항(Requirement) 리뷰 — web-chat loader iframe 코너 고정

리뷰 대상 커밋: `82e97d2` (fix(web-chat): 로더 iframe 코너 고정)

## 발견사항

### [INFO] 기능 완전성 — 핵심 수정 완료
- 위치: `bridge.ts` 생성자 (line 442–446)
- 상세: `position:fixed` 단독으로 남아 있던 iframe이 `bottom:0` + `right:0`(기본) 또는 `left:0`(bottom-left) + z-index 까지 설정되어 코너 앵커 로직이 완전히 구현됐다. `index.ts boot()`도 `config.appearance?.position/zIndex`를 bridge에 전달한다.
- 제안: 없음.

### [INFO] spec fidelity — spec 2-sdk §3 line 106 일치
- 위치: `bridge.ts` line 441 주석·생성자, `spec/7-channel-web-chat/2-sdk.md` line 106
- 상세: spec §3 line 106은 "position/zIndex 는 `appearance` 를 따른다"고 명시한다. 구현이 이를 정확히 반영한다. `BridgeDeps.position`/`zIndex` 필드 이름·타입(`"bottom-right" | "bottom-left"`, `number`)이 spec §4 `BootConfig.appearance` 정의와 일치한다. `DEFAULT_Z_INDEX = 2147483000`은 spec §1 예시값(`zIndex: 2147483000`)과 일치하며 주석으로 명시됐다.
- 제안: 없음.

### [INFO] 엣지 케이스 — `position: "bottom-right"` 명시값 처리
- 위치: `bridge.ts` line 444–445
- 상세: `if (deps.position === "bottom-left") ... else right = "0"` 로직은 `position`이 명시적으로 `"bottom-right"`인 경우와 `undefined`(미지정)를 동일하게 `right:0`으로 처리한다. spec §4 `appearance.position` 기본값이 `bottom-right`이므로 이 동작은 올바르다. 테스트 커버리지(`makeBridge()` → undefined → right:0)도 확인됨.
- 제안: 없음.

### [INFO] 엣지 케이스 — `zIndex: 0` 입력 시 0 적용
- 위치: `bridge.ts` line 446: `deps.zIndex ?? DEFAULT_Z_INDEX`
- 상세: `??` 연산자는 `null`/`undefined`만 DEFAULT로 대체한다. `zIndex: 0` 입력 시 `"0"`이 적용되며(의도적 사용 가능), `zIndex: -1` 등 음수 입력에 대한 유효성 검사는 없다. spec §4에도 범위 제약 명세가 없으므로 INFO 수준이다.
- 제안: 비즈니스상 범위 제약이 필요하다면 향후 spec §4에 범위 제약 추가 후 검증 로직 도입.

### [INFO] 테스트 완전성 — 긍정 경로 모두 커버
- 위치: `bridge.spec.ts` 3개 신규 테스트, `index.spec.ts` 2개 신규 테스트
- 상세: (a) 기본 bottom-right + 기본 z-index, (b) bottom-left + right 미설정, (c) 사용자 지정 zIndex override, (d) boot() → appearance 전달 통합, (e) appearance 미지정 기본값 — 5가지 시나리오 커버. `position: "bottom-right"` 명시적 전달 시나리오 테스트가 없으나 로직상 else 분기와 동일해 실질적으로 커버됨.
- 제안: 없음.

### [INFO] TODO/FIXME 없음
- 상세: plan 문서 `# spec` 섹션에 "(필요 시 §3에 host가 설정하는 정확한 style(bottom/side/z-index) 1줄 보강 검토.)" 메모가 있으나, 코드 파일 내에는 TODO/FIXME/HACK/XXX 없음. 이 메모는 spec 보강 의견이며 구현 완결성 문제는 아니다.

### [INFO] [SPEC-DRIFT] spec §3 "position/zIndex" 언급의 구체성 부족
- 위치: `spec/7-channel-web-chat/2-sdk.md` §3 line 106: "position/zIndex 는 `appearance` 를 따른다."
- 상세: 현재 spec은 "따른다"는 원칙만 언급하고, host가 실제로 설정해야 하는 CSS 속성(`bottom:0`, `left:0` 또는 `right:0`, `z-index`)과 기본 코너(bottom-right)를 명시하지 않는다. 코드 구현은 이를 합리적으로 구체화했으며 되돌리는 것이 오답이다. spec 본문만 낡아 구현 세부를 미반영한 상태다.
- 제안: 코드 유지 + spec 갱신 — `spec/7-channel-web-chat/2-sdk.md` §3 line 106 wc:resize 항목 또는 그 직후에 "host iframe은 `position:fixed; bottom:0; {left|right}:0`(appearance.position에 따라 bottom-left는 left:0, 기본 bottom-right는 right:0)으로 뷰포트 코너에 앵커하고, `z-index`는 `appearance.zIndex`(미지정 시 2147483000)를 적용한다"는 1~2줄을 추가. 갱신은 `project-planner` 경로.

## 요약

이번 변경은 `WidgetBridge` iframe에 `position:fixed` 단독으로만 설정되던 버그를 수정하여 뷰포트 코너 앵커(`bottom:0`, `left:0`/`right:0`)와 z-index를 올바르게 적용한다. spec 2-sdk §3의 "position/zIndex는 appearance를 따른다"는 원칙을 구현 레벨에서 완전히 충족하며, `BootConfig.appearance` 필드명·타입·기본값이 spec §4와 일치한다. 신규 테스트 5가지가 핵심 경로를 커버하고 코드 내 TODO/FIXME는 없다. CRITICAL 또는 WARNING 발견사항 없음. spec §3이 구현 세부(CSS 속성명·기본 코너)를 명시하지 않아 `[SPEC-DRIFT]` INFO 1건이 존재하며, 이는 코드 버그가 아니라 spec 보강 대상이다.

## 위험도

NONE
