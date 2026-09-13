# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 확인

- **scope 델타 (`spec/conventions/`)**: 0개 파일 — 이 브랜치는 spec 문서를 바꾸지 않는다. 정상(코드 전용 PR, 델타 0 자체는 CRITICAL 근거 아님).
- **구현 diff 실측** (`git diff origin/main...HEAD --numstat -- codebase/`, 워킹트리 절대경로 `/Volumes/project/private/clemvion/.claude/worktrees/guide-identifier-existence` 기준):

```
 D  codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts   (189 -)
 D  codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts             (184 -)
 A  codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts   (330 +)
 A  codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts             (227 +)
 M  codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts (2줄, 주석 참조만)
```

이 변경은 **frontend 테스트 하네스 전용**이다 — 유저 가이드(MDX)가 인용하는 식별자(에러 코드·환경변수)가 실재하는지 검증하는 가드를 `guide-error-code-*`(에러 코드 전용)에서 `guide-identifier-*`(식별자 전반)로 일반화한 리네임 + 확장이다. 제품 코드·API·엔티티·이벤트·ENV 는 건드리지 않는다.

**이번 세션(16_04_45)이 새로 다루는 델타는 "라운드 4" 커밋(`6b4c03af6`, 직전 리뷰 `15_43_24` 이후 유일한 신규 커밋)뿐이다** — `CODE_FIELD` 정규식에 왼쪽 경계 `(?<![A-Za-z])` 추가 + 판별 fixture(`mycode`/`statusCode`/`code`/bare `code:`) 4건 추가. **신규 식별자(타입·함수·상수·파일 경로)는 0건** — 정규식 리터럴 수정과 로컬 테스트 케이스 추가뿐이라 이번 관점의 신규 후보가 없다.

## 관점별 확인

1. **요구사항 ID 충돌** — diff 에 신규 요구사항 ID(`R-*`/`CV-*` 등) 없음. 해당 없음.
2. **엔티티/타입명 충돌** — 신규 export: `IdentifierCitation`(interface), `CitationAxis`(type, 값 `"field-table"|"code-field"|"backtick"`), `scanIdentifierCitations`, `collectSourceTokens`, `collectEnvDeclarations`, `GUIDE_EXTERNAL_VOCABULARY`. 구 파일(`guide-error-code-scan.ts`)의 `CitationAxis`/`ErrorCodeCitation`/`scanErrorCodeCitations`/`collectBackendTokens`/축값 `"prose"` 는 같은 diff 에서 삭제되므로 리네임이지 신규 충돌이 아니다. `"prose"` 를 재사용하지 않고 `"backtick"` 을 신설한 것도 plan(§명명)이 의도적으로 명시한 선택이며, 전수 grep 결과 `"backtick"` 문자열이 다른 axis enum·타입에서 다른 의미로 쓰이는 곳은 없다. 전수 `git grep` 재확인 결과 위 6개 식별자는 저장소 어디에도 다른 의미로 이미 쓰이고 있지 않다(이 두 파일 안에서만 등장).
3. **API endpoint 충돌** — 신규 endpoint 없음. 해당 없음.
4. **이벤트/메시지명 충돌** — `GUIDE_EXTERNAL_VOCABULARY` 허용목록의 유일한 항목 `MESSAGE_CREATE` 는 Discord Gateway 이벤트명을 "우리 코드에 없는 게 정상인 외부 어휘"로 인용한다. 저장소 내 다른 `MESSAGE_CREATE` 용례(spec discord 문서·frontend discord mdx)도 전부 같은 Discord Gateway 의미로 일관 — 의미 충돌 없음.
5. **환경변수·설정키 충돌** — 이 diff 는 신규 ENV var/config key 를 도입하지 않는다. `collectEnvDeclarations` 는 기존 `.env.example`/`docker-compose*.yml` 을 읽는 스캐너이지 새 키를 정의하지 않는다.
6. **파일 경로 충돌** — 신규 경로 `guide-identifier-existence.test.ts` / `guide-identifier-scan.ts` 는 같은 커밋에서 구 파일(`guide-error-code-existence.test.ts` / `guide-error-code-scan.ts`)이 삭제되므로 경로 중복이 없고, 디렉토리 내 기존 명명 컨벤션(`<도메인>-<목적>.test.ts` + 순수 스캐너 `<도메인>-scan.ts`/`<도메인>-parse.ts` 자매 파일 — 예: `impl-anchor-existence.test.ts`/`impl-anchor-parse.ts`)을 그대로 따른다.

## INFO — 참고 (충돌 아님, 과거 라운드에서 이미 확인·유지)

- **[INFO]** 모듈-private 상수 `UPPER_SNAKE` 이름 중복
  - target 신규 식별자: `guide-identifier-scan.ts` 의 (비export) `const UPPER_SNAKE = "[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+"`
  - 기존 사용처: `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts:60` 의 `const UPPER_SNAKE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;`
  - 상세: 두 파일이 각자 독립적으로 동일한 정규식 의미의 모듈-스코프 상수를 같은 이름으로 정의한다. 둘 다 비export·무import관계라 컴파일/런타임 충돌은 없다. 새 식별자 "충돌"이라기보다 우연한 패턴 중복.
  - 제안: 이번 PR 에서 조치 불필요.

- **[INFO]** 허용목록 이름 접두사 선점 확인됨 (설계 근거 검증, 재확인)
  - `plan/in-progress/guide-identifier-existence.md` §명명 표가 `GUIDE_EXTERNAL_VOCABULARY` 채택 이유로 "무관 도메인의 `KNOWN_DOCS_ABSENT` 와 `KNOWN_*` 접두를 공유하지 않기 위해"라고 명시했고, 실제로 `KNOWN_DOCS_ABSENT` 는 `codebase/backend/src/nodes/integration/cafe24/metadata/catalog-docs-drift.spec.ts` 에만 존재하는 무관 도메인 상수(Cafe24 카탈로그-문서 drift 예외 목록)로 grep 재확인됨. 의도적 회피가 실측과 계속 일치 — 조치 불필요.

## 요약

이번 라운드(16_04_45)가 실제로 다루는 델타는 직전 리뷰(`15_43_24`, 위험도 NONE) 이후의 유일한 커밋인 "라운드 4"(`6b4c03af6`)뿐이며, 그 커밋은 `CODE_FIELD` 정규식의 왼쪽 경계 추가와 판별 fixture 4건 추가로 **신규 식별자를 도입하지 않는다**. `spec/conventions/` 델타도 0이다. 5개 파일 969줄짜리 전체 diff(리네임 `guide-error-code-*`→`guide-identifier-*` 포함)의 신규 도입 식별자(타입·인터페이스·함수·상수·파일 경로: `IdentifierCitation`·`CitationAxis`·`scanIdentifierCitations`·`collectSourceTokens`·`collectEnvDeclarations`·`GUIDE_EXTERNAL_VOCABULARY`·축값 `"backtick"`·경로 2건)는 전수 grep 결과 저장소 내 다른 의미로 이미 쓰이고 있는 곳이 없으며, 이는 앞선 5회의 동일 관점 리뷰(12:33·14:41·15:03·15:23·15:43)에서 반복 확인된 결과와 일치한다. 허용목록 유일 항목 `MESSAGE_CREATE` 도 Discord Gateway 이벤트라는 동일 의미로 spec·frontend 문서 전반에서 일관 사용된다. 요구사항 ID·API endpoint·webhook/queue/sse 이벤트명·ENV 키 신규 도입도 없다.

## 위험도

NONE
