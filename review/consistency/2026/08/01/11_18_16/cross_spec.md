# Cross-Spec 일관성 검토 — spec/7-channel-web-chat (--impl-done)

## 발견사항

없음.

**근거 (조사 과정)**:

- `git diff origin/main...HEAD --name-only` 로 실제 변경 파일 전수를 확인한 결과, `spec/**` 아래 파일은
  **단 하나도 변경되지 않았다**. 변경분은 다음으로 구성된다:
  - `codebase/backend/package.json`, `codebase/channel-web-chat/package.json`,
    `codebase/frontend/package.json`, `codebase/packages/{ai-end-reason,chat-channel-validation,
    expression-engine,graph-warning-rules,node-summary,sdk,web-chat-sdk}/package.json` — 전부
    `"typescript": "^7..." → "^5..."` **devDependency 버전 핀 1줄 되돌림**뿐이고 로직 변경 없음.
  - `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts` +
    `typescript-toolchain.test.ts` (신규) — 워크스페이스 전역 TypeScript major 계약을 검사하는
    저장소 위생 가드. 형제 모듈 `internal-package-registration-guard.ts` 와 같은 기존 패턴을 따름.
  - `.github/dependabot.yml`, `PROJECT.md`, `pnpm-lock.yaml`, `plan/in-progress/typescript-7-rollback.md`,
    `plan/in-progress/typescript-toolchain-followups.md` — 프로세스/거버넌스 문서·lockfile.
- 즉 이번 diff 는 dependabot(`#1047`)가 `typescript` 를 `5.9.3 → 7.0.2` 로 잘못 올려 Jenkins main
  빌드(backend `nest build` · frontend `pnpm install`)가 전면 실패한 사고의 **복구(버전 롤백) +
  재발 방지 가드**다. `plan/in-progress/typescript-7-rollback.md` frontmatter 에 `spec_impact: none`
  이 명시돼 있고, 본문도 "`/consistency-check --impl-prep` 생략 — 본 변경은 의존성 버전 복원·CI
  설정·저장소 가드로 `spec/` 어느 영역도 대상이 아니다" 라고 스스로 밝히고 있다 — 이번
  `--impl-done` 호출과 정합적인 선언이다.
- `codebase/channel-web-chat/package.json` 이 변경분에 포함돼 있어 orchestrator 가 그 파일의
  `code:` glob(`codebase/channel-web-chat/**`) 매핑으로 target spec area 를
  `spec/7-channel-web-chat` 로 라우팅했다(라우팅 자체는 합리적 — 코드 경로 매칭 기준대로 동작).
  다만 실제 변경 내용은 위젯 앱의 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 중
  **어느 것도 건드리지 않는다** — `codebase/channel-web-chat/src/**` 등 제품 코드는 diff 에
  전혀 등장하지 않는다. 즉 6개 점검 관점 각각에 대해 "target 이 새로 정의/변경한 내용"이 존재하지
  않아 다른 spec 영역과 비교할 대상 자체가 없다.
- `spec/` 내 어느 파일도 `repo-guards`/`typescript-toolchain` 문자열을 언급하지 않음을 grep 으로
  확인 — 신규 가드 파일은 spec 이 규정하는 어떤 계약(엔티티·API·RBAC 등)과도 접점이 없는 순수
  내부 개발 툴체인 코드다.
- 참고로 `plan/in-progress/typescript-7-rollback.md` 는 같은 PR 의 `/ai-review` 가 Critical 0 ·
  Warning 0 · INFO 20(risk LOW) 로 이미 완료됐음을 기록하고 있다 — 코드 리뷰 축의 검증은
  cross-spec 범위 밖이라 본 검토에서 재확인하지 않았다.

## 요약

이번 target(`spec/7-channel-web-chat`, `--impl-done`)은 라우팅 매핑상 선택됐을 뿐, 실제 diff 는
`typescript` 메이저 버전 사고 복구(패키지 버전 롤백)와 재발 방지용 저장소 가드/거버넌스 문서
갱신으로만 구성되어 있고 `spec/**` 어느 파일도 변경되지 않았으며 위젯 앱의 제품 코드(데이터
모델·API·상태기계·RBAC·계층 책임)도 건드리지 않는다. 따라서 데이터 모델 충돌·API 계약 충돌·
요구사항 ID 충돌·상태 전이 충돌·권한 모델 충돌·계층 책임 충돌 6개 관점 모두 비교할 신규/변경
내용이 없어 발견사항이 없다. 이는 담당 plan 문서가 스스로 `spec_impact: none` 으로 선언하고
`--impl-prep` 을 의도적으로 생략한 것과도 일치하는, 정당한 "델타 0" 케이스다.

## 위험도
NONE
