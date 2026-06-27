# Scope Review

## 분석 대상 커밋

- `4fcb5c7c` — 핵심 버그 픽스: `Array.isArray` → length 기반 가드 + `Array.from` 정규화
- `773a8017` — 코드 리뷰 SUMMARY 반영: 가독성·방어 개선

기준 베이스: `b470022b` (origin/main)

---

## 발견사항

### [INFO] `!Number.isFinite` + `> 32` 방어 가드 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-queue-replay-arguments/codebase/packages/web-chat-sdk/src/loader.ts` replay 루프 (commit 773a8017, INFO#1)
- 상세: 버그 픽스의 핵심 요건은 `Array.isArray` → `length` 기반으로 교체하는 것이었으나, 리뷰 반영 커밋에서 `!Number.isFinite(length)` 와 `length > 32` 상한 가드가 추가됐다. 이 두 조건은 원래 버그 수정 범위에 없던 방어적 DoS 가드다.
- 제안: 공개 SDK 보안 레이어에 합당한 추가이므로 제거보다는 유지 권장. 단, 향후 PR 에서는 버그 픽스 커밋과 방어 가드 커밋을 분리하면 범위 추적이 명확해진다.

### [INFO] `Array.prototype.slice.call` → `Array.from` 교체
- 위치: 동일 파일 replay 루프 (commit 773a8017, INFO#8)
- 상세: 기능적으로 동일한 두 표현식 중 가독성 위주로 교체한 것이며, 실질 버그 수정과 무관한 마이크로 리팩토링이다.
- 제안: 수정 자체는 무해하고 코드베이스 스타일에 일치하나, 버그 픽스 커밋과 별개 커밋으로 분리됐으면 이상적.

### [INFO] `GlobalCall` 타입 JSDoc 추가
- 위치: 동일 파일, `GlobalCall` 타입 선언 위 (commit 773a8017, INFO#5)
- 상세: 버그의 원인(runtime array-like 불일치)과 정규화 전략을 문서화하는 JSDoc이다. 기능 변경 없이 맥락을 직접 설명하므로 범위를 실질적으로 벗어나지 않는다.
- 제안: 수용.

### [INFO] 변수명 `call` → `queuedCall` → `raw` 순차 변경
- 위치: 동일 파일 replay 루프
- 상세: `call` → `queuedCall` 은 새 로직에서 raw unknown 핸들이 필요해진 필연적 재명명이고, `queuedCall` → `raw` 는 review 시 이름 중복 해소용 재명명(INFO#7)이다. 두 단계 모두 버그 픽스 코드 경로 내부에서 발생한 변경이므로 무관한 리팩토링이 아니다.
- 제안: 수용.

### [INFO] 테스트 주석 2건 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-queue-replay-arguments/codebase/packages/web-chat-sdk/src/loader.spec.ts` (INFO#10, INFO#12)
- 상세: 기존 Array 경로 테스트와 신규 array-like 테스트의 목적을 명시하는 인라인 주석이다. 테스트 추가와 직접 연결된 컨텍스트 설명이므로 범위 이탈 아님.
- 제안: 수용.

---

## 요약

변경은 `loader.ts`의 replay 루프와 `loader.spec.ts`의 해당 회귀 테스트로 집중됐으며, 무관한 파일이나 기능 영역에 대한 수정은 없다. `!Number.isFinite` + `> 32` 방어 가드와 `Array.from` 교체가 원래 버그 픽스 명세를 소폭 초과하지만, 같은 코드 경로 내부의 방어적 개선이고 코드 리뷰 반영 단계에서 명시 근거(INFO#1, INFO#8) 아래 적용된 것이므로 허용 범위 내로 판단한다.

## 위험도

NONE
