# 부작용(Side Effect) 리뷰

## 대상 요약

이번 리뷰 대상 2개 파일 모두 순수 마크다운 문서다 — 실행 코드가 아니다.

1. `review/consistency/2026/08/10/01_37_01/rationale_continuity.md` — 신규 생성된 consistency-checker 산출 리포트.
2. `spec/conventions/spec-impl-evidence.md` — spec 컨벤션 문서. `code:` frontmatter 목록에 항목 1개 추가, `§2.2` 에 문단 1개 추가, `§4.2` 표의 `plan-frontmatter.test.ts` 행 서술 확장.

코드 함수·전역 변수·환경 변수·네트워크 호출·이벤트/콜백에 해당하는 변경이 원천적으로 없다. 다만 두 항목만 부작용 관점에서 점검할 가치가 있어 확인했다.

## 발견사항

- **[INFO]** `review/` 산출물 신규 생성 — 프로젝트 관례상 정상 위치
  - 위치: `review/consistency/2026/08/10/01_37_01/rationale_continuity.md` (신규 파일 전체)
  - 상세: 새 파일 생성이라는 점에서 "파일시스템 부작용" 점검 대상이지만, `CLAUDE.md` 의 "일관성 검토 산출물 → `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`" 규약과 정확히 일치하는 경로·명명이다. 기존 파일을 덮어쓰거나 다른 위치를 오염시키지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `code:` frontmatter 목록에 `plan-scan.ts` 추가 — 빌드 가드가 실제로 소비하는 데이터 변경이지만 대상 파일 실존 확인됨
  - 위치: `spec/conventions/spec-impl-evidence.md:15` (frontmatter `code:` 리스트, diff 게이트 `15|+  - codebase/frontend/src/lib/docs/__tests__/plan-scan.ts`)
  - 상세: 이 문서 자체의 frontmatter `code:` 필드는 `spec-code-paths.test.ts` (build 차단 가드)가 glob 매치를 검증하는 "준-인터페이스" 데이터다. 추가된 경로 `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts` 가 실제로 존재하는지 확인했다 — 실존한다(`ls` 로 검증, 5824 bytes, 2026-08-10 01:42 수정). 따라서 이 변경이 빌드 가드를 깨뜨리는 부작용은 없다.
  - 제안: 조치 불요 (검증 완료).

- **[INFO]** `§4.2` 표의 `plan-frontmatter.test.ts` 행 서술 확장 (검증 범위 1→3항목으로 문서화) — 문서만 변경, 실제 가드 동작 변경 아님
  - 위치: `spec/conventions/spec-impl-evidence.md:132` (diff 게이트 `132|+| \`plan-frontmatter.test.ts\` ...`)
  - 상세: 옛 행(삭제된 줄, 게이트 없음)은 단일 항목("top-level in-progress worktree/started/owner")만 서술했고, 새 행은 동일 가드 파일이 실은 3가지(worktree/started/owner, plan/complete status, 링크 무결성)를 검증한다고 서술을 확장했다. 이는 코드 동작을 바꾸는 변경이 아니라 기존 동작에 대한 문서 서술을 더 정확하게 넓힌 것으로 보인다(사이드이펙트 관점에서는 무해 — 실행 흐름·인터페이스에 영향 없음). 문서-코드 일치 여부(서술이 실제 `plan-frontmatter.test.ts` 구현과 정확히 맞는지)는 일관성 검토 영역이라 본 리뷰의 점검 관점(8종) 밖이다.
  - 제안: 조치 불요. 서술-구현 정합성은 consistency-checker 소관.

- **[INFO]** `§2.2` 신규 문단 — `status:` 키의 plan/spec 도메인 분리 서술 추가
  - 위치: `spec/conventions/spec-impl-evidence.md:87`
  - 상세: 순수 설명 문단 추가로, 코드·가드 동작에 어떤 영향도 주지 않는다. `plan-scan.ts` 의 `TERMINAL_PLAN_STATUSES` 를 SoT 로 지칭하는데, 이는 서술일 뿐 이 문서가 그 상수를 정의하거나 재정의하지 않는다.
  - 제안: 조치 불요.

## 요약

두 파일 모두 마크다운 문서 변경으로, 함수 시그니처·전역 상태·환경 변수·네트워크 호출·이벤트/콜백 등 전통적 부작용 표면이 존재하지 않는다. 유일하게 "코드처럼 소비되는" 부분은 `spec-impl-evidence.md` frontmatter 의 `code:` 글로브 목록인데, 추가된 경로(`plan-scan.ts`)가 실제로 존재함을 직접 확인해 빌드 가드(`spec-code-paths.test.ts`)를 깨뜨리는 부작용이 없음을 검증했다. `review/consistency/.../rationale_continuity.md` 신규 파일도 프로젝트 산출물 경로 규약과 정확히 일치한다. 부작용 관점에서 CRITICAL/WARNING 급 발견은 없다.

## 위험도

NONE
