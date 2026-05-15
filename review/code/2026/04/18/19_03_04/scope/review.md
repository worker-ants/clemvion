## 발견사항

### [CRITICAL] `.claude/scheduled_tasks.lock` 파일 포함
- **위치**: 파일 46
- **상세**: i18n과 전혀 무관한 스케줄러 잠금 파일이 변경 목록에 포함됨. 이 파일은 런타임 프로세스 상태를 나타내며 커밋 대상이 아님.
- **제안**: `.gitignore`에 추가하고 변경에서 제외

---

### [WARNING] `"use client"` 추가로 서버 컴포넌트 사용 불가
- **위치**: `date.ts:1`, `execution-status.ts:1`
- **상세**: 두 유틸리티 모듈에 `"use client"` 지시어를 추가함으로써 서버 컴포넌트에서의 사용이 차단됨. `formatDate`나 `formatDuration` 같은 순수 함수는 서버/클라이언트 양측에서 쓸 수 있어야 하며, 이는 locale 읽기 방식의 설계 문제이지 `"use client"` 전파로 해결할 사항이 아님.
- **제안**: locale을 항상 명시적 파라미터로 받도록 하고, 스토어 의존성을 제거하여 순수 함수로 유지

---

### [WARNING] `formatDuration` 중복 구현
- **위치**: `date.ts` (신규), `execution-status.ts` (기존)
- **상세**: `date.ts`에 새로운 `formatDuration`이 추가되었지만 `execution-status.ts`에도 동명의 함수가 이미 존재함. 두 함수는 미묘하게 다른 동작을 함 (`null` 처리 여부, 소수점 포맷). 어떤 것을 언제 써야 하는지 불분명하여 혼란을 야기함.
- **제안**: 하나의 구현으로 통합하거나 명확하게 다른 이름을 사용

---

### [WARNING] `formatDuration` 출력 포맷 동작 변경
- **위치**: `execution-status.ts`, `execution-status.test.ts`
- **상세**: `1000ms → "1.0s"` 에서 `"1s"`로 변경되고 `59999ms` 케이스 테스트가 삭제됨. i18n 작업과 묶여 있지만 실제로는 별도 버그 수정/리팩토링으로 볼 수 있는 동작 변경임.
- **제안**: 동작 변경이 의도적이라면 별도 커밋/PR로 분리

---

### [WARNING] `formatDate`의 `"date"` 포맷 분기 제거
- **위치**: `date.ts` diff, `"date"` format 분기 삭제
- **상세**: i18n과 직접 관련 없는 코드 단순화. 기능적으로는 동등하지만 불필요한 리팩토링이 i18n 변경과 혼재됨.
- **제안**: i18n 변경과 무관한 정리는 별도로 분리

---

### [INFO] `STATUS_LABEL` 상수를 `getStatusLabel()` 함수로 교체
- **위치**: `execution-status.ts`
- **상세**: public API 변경 — `STATUS_LABEL` 객체를 직접 참조하던 모든 소비자가 함수 호출 방식으로 업데이트되어야 함. 변경 자체는 i18n에 필요하지만, 파급 범위 확인이 필요함.
- **제안**: `STATUS_LABEL`을 참조하는 나머지 코드가 모두 갱신되었는지 확인

---

## 요약

변경의 주축인 i18n 적용(하드코딩 문자열 → `useT()` 교체, 테스트 locale 초기화, MDX 메타데이터 영문 추가, 신규 i18n 인프라 파일)은 범위에 부합하나, **`.claude/scheduled_tasks.lock` 파일 포함**, **`"use client"` 전파로 인한 서버 컴포넌트 차단**, **`formatDuration` 중복 구현 도입**, **출력 포맷 변경 혼재** 등 i18n과 무관하거나 별도로 다뤄야 할 변경들이 같은 PR에 섞여 있어 검토 및 롤백을 어렵게 만든다.

## 위험도
**MEDIUM**