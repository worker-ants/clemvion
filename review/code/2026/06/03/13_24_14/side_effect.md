# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] `defaultDemoForm.apiBase` 기본값 변경 — 기존 로컬 저장 상태와의 불일치 가능성
- 위치: `/codebase/channel-web-chat/src/app/demo/demo-config.ts` line 397
- 상세: `defaultDemoForm.apiBase` 가 `"http://localhost:3011/api"` → `"http://localhost:3011"` 로 변경된다. 이 값은 React `useState(defaultDemoForm)` 의 초기값으로만 쓰인다. 브라우저 localStorage 등에 이전 기본값이 영속된 경우는 없으므로(데모 폼 상태는 메모리 only) 기존 사용자 데이터에는 영향이 없다. 다만 이 기본값이 다른 테스트 픽스처나 문서 스니펫에서 하드코딩되어 참조되는 곳이 있다면 불일치가 생길 수 있다 — `demo-config.test.ts` 내 `buildBootConfig` 테스트가 이미 `"http://x/api"` 식 입력을 사용하는 경우에도 `normalizeApiBase` 로 정규화되므로 일관된다.
- 제안: 현재 변경 범위 안에서 문제 없음. 추가 테스트나 fixture 가 `/api` 가 붙은 값을 기대하는지 grep 권장.

### [INFO] `normalizeApiBase` 신규 공개 export — 하위 호환 추가
- 위치: `/codebase/channel-web-chat/src/app/demo/demo-config.ts` lines 353–358
- 상세: 새 함수가 `export` 로 추가되어 공개 API 확장이다. 기존 함수(시그니처)는 변경되지 않았고, 새 export 를 제거하더라도 기존 사용자는 영향 없다. 추가-only 변경이므로 하위 호환 파괴 없음.
- 제안: 이상 없음.

### [INFO] `buildBootConfig` 내부 동작 변경 — `apiBase` 값이 항상 정규화됨
- 위치: `/codebase/channel-web-chat/src/app/demo/demo-config.ts` line 446 (diff line `+    apiBase: normalizeApiBase(form.apiBase)`)
- 상세: 이전에는 `form.apiBase.trim()` 만 했으나, 이제 `normalizeApiBase` 가 추가로 후행 `/api` 를 제거한다. 이 함수의 반환값인 `BootMessage.apiBase` 를 소비하는 `use-widget.ts` → `EiaClient` 는 `joinUrl` 로 경로를 덧붙이므로, 정규화 후 origin 만 남는 것이 의도된 동작이다. 그러나 `buildBootConfig` 호출자가 데모 외부(e.g. SDK 쪽 코드)에서 `/api` 를 붙인 채 넘긴다고 기대했다면 의도치 않은 strip 이 발생한다. 현재 코드베이스에서 `buildBootConfig` 는 `demo-host.tsx` 에서만 호출되며, 데모 전용 함수이므로 외부 SDK 의존 없음 — 안전하다.
- 제안: 이상 없음. 단, 함수 JSDoc 에 "호출자가 이미 정규화된 origin 을 넣으면 멱등" 임을 명시하면 명확도 향상.

### [INFO] `use-widget.ts` `openStream` 에 `onError` 콜백 추가 — 기존 `EiaClient.openStream` 시그니처와의 호환
- 위치: `/codebase/channel-web-chat/src/widget/use-widget.ts` lines 948–957 (diff)
- 상세: `EiaClient.openStream` 의 `handlers` 파라미터는 `{ onEvent, onError? }` 형태로 이미 `onError` 를 선택 필드로 정의하고 있다(`eia-client.ts` line 97–100). 따라서 기존 시그니처를 변경하지 않고 선택 필드를 채우는 것이므로 하위 호환 파괴 없음. `onError` 콜백 내부는 `console.warn` 만 호출하며, 상태 변경·이벤트 디스패치·스트림 닫기 등 부작용 없음.
- 제안: 이상 없음. `console.warn` 은 브라우저 콘솔에만 기록되고 전역/공유 상태에 영향 없음.

### [INFO] `demo-host.tsx` 라벨·placeholder·힌트 텍스트 변경 — UI 상태에 영향 없음
- 위치: `/codebase/channel-web-chat/src/app/demo/demo-host.tsx` lines 494–495, 509–515 (diff)
- 상세: `label` 문자열과 `placeholder` 변경은 순수 렌더 문자열이며 어떤 상태도 변경하지 않는다. 새 `<p>` 힌트 블록 추가도 읽기 전용 표시이며 이벤트 핸들러·상태·외부 호출 없음.
- 제안: 이상 없음.

### [INFO] `README.md` 문서 전용 변경
- 위치: `/codebase/channel-web-chat/README.md` lines 35–43 (diff)
- 상세: 마크다운 문서 추가이므로 런타임 부작용 없음.
- 제안: 이상 없음.

---

## 요약

이번 변경은 데모 전용 헬퍼(`demo-config.ts`)에 `normalizeApiBase` 함수를 추가하고, `buildBootConfig` 내부에서 `apiBase` 를 정규화하도록 한정된 리팩터링이다. 신규 export 는 추가-only 이며 기존 함수 시그니처는 그대로다. `use-widget.ts` 의 `onError` 콜백 추가는 이미 선택 필드로 정의된 시그니처를 채우는 것에 불과하며 `console.warn` 이외 어떤 상태 변경도 일으키지 않는다. 전역 변수 도입·파일시스템 부작용·환경 변수 읽기/쓰기·네트워크 호출 추가·이벤트 발생 패턴 변경 중 의도치 않은 것은 발견되지 않았다. `defaultDemoForm.apiBase` 기본값 변경은 메모리 전용 초기값이므로 영속 상태와 충돌하지 않는다.

## 위험도

NONE
