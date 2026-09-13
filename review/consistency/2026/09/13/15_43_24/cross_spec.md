# Cross-Spec 일관성 검토 — cross_spec

## 검토 범위 확인

- 검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`.
- `spec/conventions/` 자체의 실제 델타는 **0개 파일** — 이 브랜치는 spec 을 바꾸지 않았다.
- 구현 diff 는 5개 파일(`guide-error-code-existence.test.ts`/`guide-error-code-scan.ts` 삭제,
  `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts` 신설,
  `guide-sanitized-message-parity.test.ts` 미세 수정) + `CHANGELOG.md`/`PROJECT.md`/
  `plan/in-progress/**` 문서 갱신. 코드 변경은 전부 frontend 테스트/도구 코드
  (`codebase/frontend/src/lib/docs/__tests__/`)이며, 런타임 API·데이터 모델·RBAC·상태
  머신을 다루는 서버/클라이언트 프로덕션 코드는 건드리지 않는다. 확인은 워킹트리 절대경로
  기준 `git diff origin/main...HEAD` 로 직접 실측했다(프롬프트 diff 는 예산 절단으로 미표시).

## 관점별 점검

1. **데이터 모델 충돌** — 대상 없음. 신규 파일은 `CitationAxis`/`IdentifierCitation` 타입과
   순수 함수(`scanIdentifierCitations`/`collectSourceTokens`/`collectEnvDeclarations`)뿐이며,
   `spec/**` 이 정의하는 어떤 도메인 엔티티(User·Workspace·Execution 등)와도 겹치지 않는다.
2. **API 계약 충돌** — 대상 없음. endpoint·request/response shape 변경 없음.
3. **요구사항 ID 충돌** — 대상 없음. 신규 요구사항 ID 부여 없음.
4. **상태 전이 충돌** — 대상 없음.
5. **권한·RBAC 모델 충돌** — 대상 없음.
6. **계층 책임 충돌** — `spec/conventions/frontend-layering.md` 와 대조 확인. 신규 파일은
   `src/lib/docs/__tests__/` 아래에 있어 `{lib, types} → components` import 금지 규칙의
   대상 디렉터리(`LOWER_LAYERS`)에 형식상 속하지만, 이 규약이 막는 것은 **컴포넌트 계층으로의
   import** 뿐이다. 신규 코드는 `node:fs`/`node:path` 로 backend·packages 소스와
   `.env.example`/`docker-compose*.yml` 을 **텍스트로 읽을 뿐 import 하지 않으며**, 대상
   디렉터리도 `src/components/**` 가 아니라 저장소 루트·`codebase/backend/**`다 — 규약이
   가드하는 "상위 계층 import" 방향과 무관하다. 또한 동일 계열의 선행 가드
   (`impl-anchor-existence.test.ts`, 구 `guide-error-code-existence.test.ts`)가 이미 같은
   패턴(테스트 코드가 backend 소스를 문자열로 읽어 대조)으로 존재해 왔으므로 이번 변경이
   새로 여는 계층 위반이 아니다. **결론: 충돌 없음.**

## 발견사항

- **[WARNING]** 가드 가족 SoT(`user-guide-evidence.md`)가 이번에 확장된 가드를 아직 모른다
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 최상단
    주석 (`SoT: spec/conventions/user-guide-evidence.md (가드 가족)`), `PROJECT.md` 가드
    카탈로그 표
  - 충돌 대상: `spec/conventions/user-guide-evidence.md` §2 (가드 가족 관계표) — grep 결과
    `guide-error-code`/`guide-identifier`/`guide-sanitized-message-parity` 어느 것도
    등장하지 않는다(실측: 세 식별자 모두 0건)
  - 상세: 코드·`PROJECT.md`는 이 가드가 "`user-guide-evidence.md` §2 의 가드 가족에 합류"
    한다고 명시하는데, 정작 그 SoT 문서 본문에는 이 가드 가족(구 `guide-error-code-*` 포함,
    선행 PR 부터 이미 누락)이 반영돼 있지 않다 — 코드가 주장하는 소속과 spec 문서의 실제
    내용이 어긋나는 **문서 간 정의 중복/누락**이다. 다만 이것은 이번 세션이 새로 만든
    문제가 아니라 이전 `--impl-prep`(`review/consistency/2026/09/13/12_33_41`)이 이미
    WARNING #1/#2 로 잡아 planner 등재를 요구했고, `plan/in-progress/
    spec-draft-nullable-notation-followups.md` 에 트래커 항목으로 반영돼 있다(§D 표,
    `#1330` 해소 블록의 취소선·번복 근거 포함). CLAUDE.md 규약상 `spec/**` 쓰기는
    project-planner 전용이라 developer 가 직접 고칠 수 없는 항목이다.
  - 제안: 새 처분 필요 없음 — 다음 planner 턴에서 `user-guide-evidence.md` §2 관계표에
    `guide-identifier-existence`(리네임 반영) 행 추가 + frontmatter `code:` 목록 갱신 +
    "허용목록 없음 → 4강제 허용목록" 원칙 번복의 Rationale 등재를 **한 턴으로 묶어** 처리할
    것 (트래커 항목이 이미 그렇게 요구하고 있음).

## 요약

이번 diff 는 유저 가이드 문서 검증용 frontend 테스트/스캐너 코드(및 그에 딸린 plan·
CHANGELOG·PROJECT.md 문서)만 바꾸며, `spec/conventions/` 자체는 변경하지 않았다. 데이터
모델·API 계약·요구사항 ID·상태 전이·RBAC 어느 관점에서도 다른 spec 영역과 충돌하는 지점이
없고, frontend-layering 관점에서도 텍스트 읽기(비-import)라 계층 위반이 아니다. 유일하게
남는 것은 "코드가 스스로 SoT 라 부르는 `user-guide-evidence.md` 문서가 아직 그 가드 가족을
모른다"는 이미 알려진 WARNING 이며, 이는 이번 세션이 아니라 이전 리뷰가 이미 발견해
planner 트래커에 등재해 둔 항목이라 신규 차단 사유가 아니다.

## 위험도

LOW
