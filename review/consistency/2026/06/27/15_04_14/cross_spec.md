# Cross-Spec 일관성 검토 결과

**검토 대상**: `spec/7-channel-web-chat/` (구현 완료 후 검토, diff-base=origin/main)
**구현 변경 범위**: `codebase/channel-web-chat/src/widget/components/composer.tsx` + `composer.test.tsx` + `panel.test.tsx` + `panel.tsx`(일부 diff 잘림)

---

## 발견사항

### [INFO] 코드 주석의 spec 섹션 참조 부정확 — §R6 vs §2
- target 위치: `composer.test.tsx` describe 블록 제목 `"§R6 AI 응답 중"`, `composer.tsx` JSDoc `"spec 1-widget-app §R6"`, `panel.test.tsx` describe 제목 `"§R6 게이팅"`
- 충돌 대상: `spec/7-channel-web-chat/1-widget-app.md §2` (화면 구조 — 입력창 행) vs `§R6` (워크플로우 시작 — 패널 open 시(eager) 채택 근거)
- 상세: `§R6`은 eager-start 결정의 rationale 섹션이며, 로딩 시 스피너·`aria-busy=true`·`aria-label="AI 응답 중"` 비활성 외형의 primary SoT 는 `§2 입력창 행`("**booting/streaming(AI 처리 중)** 에는 스피너 + `aria-busy=true` + `aria-label="AI 응답 중"`")이다. §R6 은 "입력창(Composer)도 같은 조건으로 비활성화한다(§2 입력창 행)"처럼 §2 로 위임하고 있어, 코드 주석이 §R6 를 단독 SoT 처럼 표기한 것은 부정확하다. 기능 동작에는 영향이 없으나 나중에 spec 참조를 추적할 때 혼란을 줄 수 있다.
- 제안: 코드 주석·test describe 제목을 `"spec 1-widget-app §2 (입력창 행)"` 또는 `"§2·§R6 Composer 게이팅"` 으로 교정하면 spec SoT 가 명확해진다. spec 변경 불필요.

---

## 점검 관점별 충돌 없음 확인

| 관점 | 판정 | 근거 |
|---|---|---|
| 데이터 모델 충돌 | 없음 | `Composer.loading` prop 은 순수 UI 상태. 엔티티·필드 정의 변경 없음 |
| API 계약 충돌 | 없음 | 위젯 SPA 내부 컴포넌트 prop 변경이며 EIA endpoint·HTTP method·request/response shape 변경 없음 |
| 요구사항 ID 충돌 | 없음 | 신규 요구사항 ID 부여 없음. 코드가 참조하는 §R6 / §2 는 모두 `spec/7-channel-web-chat/1-widget-app.md` 내 동일 문서 |
| 상태 전이 충돌 | 없음 | `phase=booting` / `phase=streaming` → `loading=true`, `phase=awaiting_user_message` → `loading=false` 는 `1-widget-app.md §3` 상태기계(booting→streaming→awaiting_user_message)와 정합 |
| 권한·RBAC 충돌 | 없음 | RBAC 변경 없음 |
| 계층 책임 충돌 | 없음 | `codebase/channel-web-chat/src/widget/components/` 는 `0-architecture.md §1` 위젯 SPA 레이어에 정의된 책임 영역 |

**추가 cross-cutting 점검 결과**:
- `spec/7-channel-web-chat/4-security.md §6` WCAG AA 방침과 일치: 구현이 `aria-busy`·`aria-hidden`·`aria-label` 을 적절히 적용함.
- `spec/0-overview.md §3.4` 상태 표시 패턴(Badge/Skeleton/Toast/Alert) 과 충돌 없음: Composer 내 스피너는 "입력창 내부 응답 중" UX 이며 전역 상태 표시 패턴의 대상이 아님.
- `spec/1-data-model.md` 엔티티: 변경 없음.
- `spec/5-system/14-external-interaction-api.md` EIA 계약: 변경 없음.

---

## 요약

이번 변경은 `Composer` 컴포넌트에 `loading` prop 을 추가하고 booting/streaming 상태에서 스피너·ARIA 속성을 렌더하는 순수 UI 개선이다. 이 동작은 이미 `spec/7-channel-web-chat/1-widget-app.md §2` 입력창 행에 명시("booting/streaming(AI 처리 중) 에는 스피너 + `aria-busy=true` + `aria-label="AI 응답 중"`")되어 있으며, 다른 영역(데이터 모델·API 계약·EIA·RBAC·상태기계)과의 직접적인 모순은 없다. 유일한 지적사항은 코드 주석이 §R6 를 단독 SoT 로 참조하지만 실제 loading 외형 SoT 는 §2 임을 명확히 하는 INFO 수준 의견이다.

---

## 위험도

**NONE**
