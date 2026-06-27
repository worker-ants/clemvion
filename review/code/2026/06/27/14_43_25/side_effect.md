# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `ComposerProps` 인터페이스에 선택적 prop `loading?` 추가 — 하위 호환
  - 위치: `codebase/channel-web-chat/src/widget/components/composer.tsx` L6-8, L64
  - 상세: `loading?: boolean` 은 옵셔널이므로 기존 `Composer` 사용처가 prop 을 전달하지 않아도 `undefined`(= falsy)로 처리되어 기존 동작과 동일. 공개 인터페이스의 확장이지 파괴적 변경이 아님.
  - 제안: 변경 없음. 다만 외부 패키지에서 `ComposerProps` 타입을 직접 임포트해 사용하는 곳이 있다면 타입 파일 export 목록을 확인할 것(본 모노레포 내부 컴포넌트이므로 현재는 해당 없음).

- **[INFO]** `Composer.submit` 내 `disabled` 만 검사, `loading` 미검사
  - 위치: `codebase/channel-web-chat/src/widget/components/composer.tsx` L8-13 (`submit` 함수)
  - 상세: `if (!trimmed || disabled) return;` 에 `loading` 조건이 없다. `panel.tsx` 의 실제 사용처에서는 `loading=true` 일 때 항상 `disabled=true` 이기도 하므로(booting/streaming → `phase !== "awaiting_user_message"` → `disabled=true`) 현재 호출 경로에서는 문제가 없다. 그러나 `Composer` 를 직접 사용하면서 `loading=true, disabled=false` 조합을 전달하면 버튼은 `disabled` HTML 속성이 붙지 않아(= `disabled={false || !text.trim()}`) 텍스트가 있을 때 폼 제출이 가능해질 수 있다.
  - 제안: 필수 수정은 아니지만, 방어적으로 `submit` 내 가드를 `if (!trimmed || disabled || loading) return;` 으로 확장하면 `Composer` 단독 사용 시 계약 불일치를 차단할 수 있다.

- **[INFO]** `@keyframes wc-spin` 이름이 `widgetStyles` 문자열 전역에 등록됨
  - 위치: `codebase/channel-web-chat/src/widget/styles.ts` 마지막 추가 라인
  - 상세: 위젯은 iframe 내부에서 동작하며 `widgetStyles` 는 해당 iframe document 에만 주입되므로, 호스트 페이지 CSS 네임스페이스와 충돌하지 않는다. iframe 내부에서 `wc-spin` 이 다른 곳에 중복 정의될 가능성은 현재 없음.
  - 제안: 변경 없음. `wc-` prefix 네이밍 규약 준수 확인 완료.

- **[INFO]** `plan/complete/` 에 plan 문서를 직접 신규 생성 (in-progress 경유 없음)
  - 위치: `plan/complete/web-chat-composer-loading-indicator.md`
  - 상세: 라이프사이클 규약상 `plan/in-progress/` 에 먼저 생성 후 완료 시 `plan/complete/` 로 이동하는 것이 정석이나, 이 커밋에서는 처음부터 `plan/complete/` 에 `status: complete` 로 작성됨. 단일 커밋 픽스(소규모 핫픽스) 이므로 실질적 운영 리스크는 없으나, plan 라이프사이클 추적 도구가 이력을 누락할 수 있음.
  - 제안: 핫픽스 패턴으로 허용 가능. 필요 시 `.claude/docs/plan-lifecycle.md` 에 "단일 커밋 픽스 직접 complete 허용" 케이스를 명문화할 것.

## 요약

이번 변경은 `Composer` 컴포넌트에 선택적 `loading` prop 을 추가하고, `panel.tsx` 에서 `booting|streaming` 페이즈에 해당 값을 전달하며, `styles.ts` 에서 비활성 버튼 CSS 및 스피너 애니메이션을 추가하는 순수 외형·접근성 개선이다. 전역 변수·환경 변수·네트워크 호출·파일시스템 부작용은 전혀 없으며, 기존 인터페이스 변경은 옵셔널 prop 추가로 하위 호환된다. `submit` 함수 내 `loading` 미검사는 현재 `panel.tsx` 사용 패턴에서 무해하나 `Composer` 직접 사용 시 잠재적 계약 불일치가 될 수 있어 INFO 로 기록한다. CSS 애니메이션은 iframe 격리 범위 내에 한정되며 호스트 페이지에 누출되지 않는다.

## 위험도

LOW
