# 변경 범위(Scope) Review

## 발견사항

### [WARNING] plan 체크박스가 구현 완료 상태를 반영하지 않음
- 위치: `plan/in-progress/web-chat-console.md` Phase 3 항목
- 상세: 커밋은 Phase 3의 핵심 태스크를 모두 실구현했다 — `live-preview.tsx`에 iframe + wc:ready/wc:boot 로직 전체, `live-preview.test.tsx` 4개 테스트, `widget-base.ts`의 `getWidgetOrigin()`, `page.tsx`에서 props 연결. 그러나 plan 업데이트에서 이 항목들은 `[ ]`(미완료)로 남겨졌다. plan에 `[x]`로 체크되어야 할 항목: "콘솔 내 contained same-origin iframe 임베드", "unit 테스트(iframe src·postMessage 흐름 mock)", "동봉 미설정 시 fallback (placeholder 유지)" (타임아웃 → unavailable overlay 로 구현됨).
- 제안: 완료된 항목들을 `[x]`로 갱신하여 plan이 실제 구현 상태를 반영하도록 수정. "동봉 미설정 시 fallback"은 `READY_TIMEOUT_MS` 타임아웃 + unavailable overlay 로 구현됐으므로 동일하게 완료 처리 가능.

### [INFO] spec §6.1 항목 5와 구현 방식의 차이
- 위치: `spec/7-channel-web-chat/5-admin-console.md` §6.1 항목 5 vs `codebase/frontend/src/components/web-chat/live-preview.tsx`
- 상세: spec은 "외형 폼이 바뀌면 iframe 재마운트(key 변경)"라고 명시하지만, 실제 구현은 외형(`draft`) 변경 시 재마운트 없이 `wc:boot` 재전송으로 처리한다. `iframeSrc` key는 `apiBase`, `endpointPath`, `draft.locale`만 포함 — `draft.appearance` 등 외형 값은 key에 포함되지 않는다. 이 설계 선택은 불필요한 iframe 재마운트 없이 boot 재전송으로 외형을 갱신하는 더 효율적인 접근이며, 현재 spec은 그와 다른 방식을 서술하고 있어 스코프 내 spec-impl 불일치가 존재한다.
- 제안: spec §6.1 항목 5를 실제 구현 방식으로 수정: "외형 폼(appearance·headerTitle 등)만 바뀌면 `wc:boot` 재전송으로 갱신(재마운트 없음); `endpointPath`·`locale`·`apiBase` 변경 시에만 iframe key 재마운트". 또는 구현에서 draft 전체를 key에 포함시켜 spec과 일치시킴.

### [INFO] 테스트 파일의 미사용 임포트
- 위치: `codebase/frontend/src/components/web-chat/__tests__/live-preview.test.tsx` 1행
- 상세: `waitFor`가 `@testing-library/react`에서 임포트됐으나 어떤 테스트에서도 사용되지 않는다.
- 제안: `waitFor` 임포트 제거.

## 요약

변경 범위는 커밋 메시지가 선언한 "위젯 co-deploy 빌드 파이프라인(Phase 1) + 라이브 미리보기 iframe(Phase 3)" 에 부합하며, 관련 없는 파일이나 코드 영역이 수정되지 않았다. 파일별 변경 모두 feat 의도에 직결된다: `.gitignore`·`eslint.config.mjs`는 build artifact ignore, `package.json`은 `build:widget` 스크립트 등록, `copy-widget.mjs`는 co-deploy 빌드 파이프라인, `live-preview.tsx`·`widget-base.ts`는 Phase 3 구현, `page.tsx`는 props 연결, 테스트는 단위 커버리지, plan/spec은 연관 문서 업데이트. 주요 문제는 plan 체크박스가 이미 구현된 항목들을 미완료로 표시하는 상태 불일치와, spec §6.1 항목 5가 서술한 재마운트 방식과 실제 구현(boot 재전송 방식)의 차이다. 불필요한 리팩토링, 기능 확장, 무관 수정은 없다.

## 위험도

LOW
