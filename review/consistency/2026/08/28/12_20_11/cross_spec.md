# Cross-Spec 일관성 검토 — spec/5-system/ (impl-done)

## 검토 컨텍스트

- 검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- 실제 `git diff origin/main` 결과, **`spec/**` 하위 파일은 단 한 줄도 변경되지 않았다** (`git diff origin/main --stat -- spec/` 출력 없음).
- 변경분은 `codebase/**` 29개 파일로, 전부 **ESLint 10 업그레이드**(`plan/in-progress/deps-peer-gating-and-eslint10.md`)에 기인한 기계적 변경이다:
  - `codebase/backend/eslint.config.mjs` — `eslint-plugin-unicorn` peer 고정 범위 `^56`→`^73`, 근거 주석 갱신 (backend/packages 9개를 ESLint 10 으로 상향)
  - `codebase/frontend/eslint.config.mjs`, `codebase/channel-web-chat/eslint.config.mjs` — ESLint 9 잔류 사유 주석 추가 (`eslint-config-next` 전이 의존성 peer 상한)
  - backend `package.json`, `packages/*/package.json` 8개 — `eslint` 버전 명세 상향
  - backend 소스 9개 파일 — ESLint 10 `preserve-caught-error`(recommended) 규칙 대응으로 `throw new Error(msg, { cause: err })` 추가, 또는 `no-unnecessary-initializer`류 규칙 대응으로 `let x = null/[]/0` → `let x;`/`const` 로 정리
  - `secret-resolver.service.ts` — 유일하게 `cause` 보존을 **의도적으로 억제**(`eslint-disable-next-line preserve-caught-error`), crypto 에러 상세가 Activity API 로 노출되는 것을 막기 위함이며 기존 결정(`#814` SSRF 에러 메시지 일반화, SS-SE-05)을 그대로 인용
  - `src/repo-guards/__tests__/eslint-unicorn-peer-guard.ts`/`.spec.ts` — peer range 파서를 2-component(`>=10.4`) 표기까지 받도록 확장, 회귀 가드 갱신
  - `text-chunker.ts`/`knowledge-base.service.ts`/`ai-turn-executor.ts` — 죽은 대입 제거 + 설명 주석 보강 (동작 변경 없음, `overlapBuffer`/`graphRequeued`/`finalSystemPrompt` 지역변수가 실제로는 이미 다른 경로에서 처리되고 있었음을 문서화)

이 중 어느 것도 엔티티/필드, API 계약(endpoint·method·요청/응답 shape), 요구사항 ID, 상태 머신, RBAC, 계층 책임 분할을 변경하지 않는다. `spec/5-system/1-auth.md`, `3-error-handling.md` 등 번들에 포함된 본문을 대조해도 이번 diff 가 건드리는 개념(에러 cause 체이닝, lint 설정, 죽은 코드 정리)에 대응하는 spec 조항 자체가 없다 — 즉 "spec 이 기술한 것과 코드가 달라졌다"는 종류의 충돌이 성립할 표면이 없다.

## 발견사항

없음. 이번 target(`spec/5-system/`)은 코드 변경분과 무관하게 실제로 수정되지 않았고, 코드 변경분 자체도 다른 spec 영역(데이터 모델·API·RBAC·상태 전이·계층 책임)과 교차할 소지가 있는 실질 변경을 포함하지 않는다.

## 요약

이번 --impl-done 검토 대상은 명목상 `spec/5-system/`이지만 실제 diff(`origin/main` 대비)는 `spec/**`를 전혀 건드리지 않았으며, 변경된 `codebase/**` 29개 파일은 전부 ESLint 10 업그레이드에 수반된 기계적 정리(lint 설정·에러 `cause` 체이닝·죽은 대입 제거·peer 가드 파서 확장)다. 동작·계약·엔티티·권한·상태 전이에 영향을 주는 실질 변경이 없으므로 Cross-Spec 관점에서 충돌 가능성이 있는 표면 자체가 존재하지 않는다. `secret-resolver.service.ts`의 `cause` 억제는 기존 보안 결정(#814/SS-SE-05)을 그대로 계승한 것으로 spec 과 충돌하지 않고 오히려 일치한다.

## 위험도

NONE
