### 발견사항

발견 없음 (CRITICAL/WARNING/INFO 없음).

**근거 (조사 경위)**:

1. `origin/main..HEAD` diff 실측 결과, 이번 변경분은 `spec/**` 를 전혀 건드리지 않는다 —
   변경 파일은 `codebase/backend/.../expression-resolver.service.spec.ts`,
   `codebase/backend/.../secret-resolver.service.ts`(주석 5줄 추가),
   `codebase/backend/.../code.handler.spec.ts`, 신규
   `packages/expression-engine/src/__tests__/error-shape.spec.ts`, 그리고
   `plan/in-progress/deps-peer-gating-and-eslint10.md` + `review/code/**` 산출물뿐이다.
   target 으로 지정된 `spec/5-system/` 본문은 이번 PR 로 인한 신규·변경 내용이 없다.

2. `spec/5-system/3-error-handling.md §6.3.1`(`Error.cause` 부착 기준, C1 AND C2)은
   `git log`상 `44346ec81`(#1230, "`Error.cause` 부착 기준을 §6.3.1 로 정본화")로 이미
   `origin/main` 에 병합되어 있다 — 이번 브랜치가 새로 쓴 것이 아니라 이번 브랜치는
   그 기준에 맞춰 코드·테스트를 보강했을 뿐이다. 즉 §6.3.1 자체의 cross-spec 검증은
   병합 시점(#1230)에 이미 수행됐어야 할 몫이고, 본 검토(이번 PR)가 새로 유입시킨
   cross-spec 표면이 아니다.

3. 이번 PR 이 건드린 유일한 spec-연계 코드(`secret-resolver.service.ts`)가 §6.3.1·
   `spec/conventions/secret-store.md` 의 `SS-SE-05`(복호화 실패 시 `ref`+`workspaceId` 만
   로그, plaintext·crypto 상세 미기록)와 실제로 일치하는지 직접 대조했다 —
   `resolve()` catch 블록은 `logger.error` 에 `ref`+`workspaceId` 만 남기고
   `throw new Error('Secret decryption failed')` 로 `cause` 미부착 상태를 유지한다.
   C1(message 가 원본을 담지 않음)이 거짓이므로 §6.3.1 규칙대로 비부착이 맞고,
   `SS-SE-05` 와도 모순 없다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층
   책임 어느 관점에서도 다른 영역과 충돌하는 변경이 없다.

4. plan 문서(`deps-peer-gating-and-eslint10.md`)에 남은 "형제 3곳→4곳" 등 문구 정정
   TODO 는 이미 in-progress plan 에 항목으로 등재되어 있어 cross-spec 상 신규 리스크가
   아니라 추적 중인 문서 정리 항목이다.

### 요약

이번 diff(`origin/main..HEAD`)는 `spec/**` 를 전혀 변경하지 않으며, 검토 대상으로 지정된
`spec/5-system/` 의 실질 내용(특히 §6.3.1)도 이전 PR(#1230)에서 이미 `origin/main` 에
병합된 것으로 이번 브랜치가 새로 쓴 것이 아니다. 이번 브랜치의 코드 변경(`secret-resolver`
주석 보강, expression/code 에러 캐너리 테스트 추가)은 그 기존 spec 규칙(§6.3.1) 및
`spec/conventions/secret-store.md`(SS-SE-05)와 대조해도 일치한다. 다른 영역(데이터 모델·
API 계약·요구사항 ID·상태 전이·RBAC·계층 책임)과의 충돌을 시사하는 변경은 없다.

### 위험도
NONE
