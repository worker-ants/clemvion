# Rationale 연속성 검토 결과

검토 대상: `spec/7-channel-web-chat/` (구현 완료 후, diff-base=origin/main)
검토 범위: 구현 변경사항 (`codebase/frontend/src/app/(main)/web-chat/`, `codebase/frontend/src/components/web-chat/`, `codebase/frontend/src/lib/web-chat/`)

---

## 발견사항

- **[INFO]** `live-preview.tsx` — placeholder 단계이지만 spec 약속과 명시적 정합
  - target 위치: `codebase/frontend/src/components/web-chat/live-preview.tsx` 주석 (증분 1 / 증분 2)
  - 과거 결정 출처: `spec/7-channel-web-chat/5-admin-console.md §R6` — 위젯 동봉(co-deploy) + same-origin `src` iframe 채택, `srcdoc` 자가 생성 기각
  - 상세: 현재 구현은 Phase 1(co-deploy 빌드 파이프라인) 전 단계이므로 placeholder 렌더를 하고 있으며, 주석에 증분 2(Phase 3)에서 `getWidgetAppUrl()` 를 `src` iframe 으로 띄운다고 명시되어 있다. `srcdoc` 자가 생성이나 직접 React 컴포넌트 마운트(iframe 없음)는 어디에도 도입되지 않았다. 기각된 대안이 재도입되지 않은 상태.
  - 제안: 증분 2 도입 시 `about:blank`/`srcdoc` 를 사용하지 않도록 구현 시 재검토. 현재는 이상 없음.

- **[INFO]** `use-web-chat.ts` 타입 정의에 `"per_trigger"` 나열
  - target 위치: `codebase/frontend/src/components/web-chat/use-web-chat.ts` line 30 — `tokenStrategy?: "per_execution" | "per_trigger"`
  - 과거 결정 출처: `spec/7-channel-web-chat/3-auth-session.md §2·§R3` — per_trigger(영구 `itk_*`)는 **미지원**, 공개 스니펫에 영구 토큰 노출 위험으로 **배제**
  - 상세: 타입 정의는 기존 Trigger API 응답의 필드를 그대로 반영한 것으로 보이며, 실제 생성 코드(`useCreateWebChat` mutationFn)에서는 `tokenStrategy: "per_execution"` 만 사용한다. per_trigger 를 실제로 활용하거나 노출하는 경로는 없다. 단, 타입 유니언에 `per_trigger` 가 있어 향후 실수로 사용될 여지가 남는다.
  - 제안: 해당 타입을 `"per_execution"` 단일로 좁히거나, 주석으로 "web-chat 콘솔에서는 per_execution 만 사용"을 명시해 기각된 옵션임을 표시. 기능 위반은 아니나 예방적 조치.

- **[INFO]** `use-appearance-draft.ts` — localStorage 사용, 비목표 준수 확인
  - target 위치: `codebase/frontend/src/components/web-chat/use-appearance-draft.ts`
  - 과거 결정 출처: `spec/7-channel-web-chat/5-admin-console.md §4·§R3`, `_product-overview §2 비목표` — 외형의 **백엔드 저장·서빙 금지**, localStorage 클라이언트 보존만 허용
  - 상세: 구현이 localStorage 에만 저장하고 백엔드 API 를 전혀 호출하지 않는다. 비목표 ("위젯 외형의 백엔드 저장·서빙형 관리 콘솔") 위반 없음. spec R2·R3 의 결정과 완전히 정합.
  - 제안: 이상 없음. 참고 확인 사항.

---

## 요약

검토한 구현 변경사항(`web-chat` 콘솔 — 인스턴스 목록, 생성 다이얼로그, 외형 빌더, 설치 스니펫, 라이브 미리보기 placeholder, 사이드바 메뉴 등록)은 `spec/7-channel-web-chat/` Rationale 의 핵심 결정들을 충실히 따르고 있다. 명시적으로 기각된 대안(srcdoc 자가 생성, 직접 React 마운트, per_trigger 토큰, Shadow DOM, 외형 백엔드 저장, 신규 백엔드 엔티티 추가)이 재도입된 사례는 없다. 합의된 설계 원칙(trigger 재사용·R5, emit-only 스니펫·R2, localStorage 보존·R3, same-origin iframe 미리보기·R6, co-deploy 버전 잠금)도 모두 준수된다. 유일한 경미한 위험은 `use-web-chat.ts` 타입에 `per_trigger` 가 유니언으로 남아 있다는 점이나 실제 기능 경로에서는 사용되지 않으므로 현재 위반은 아니다.

---

## 위험도

NONE
