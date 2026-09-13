# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 확인

- **scope 델타 (`spec/conventions/`)**: 0개 파일 — 이 브랜치는 spec 문서를 바꾸지 않는다. 정상(코드 전용 PR).
- **구현 diff 실측** (`git diff origin/main --stat -- codebase/ spec/`, 워킹트리 절대경로 `/Volumes/project/private/clemvion/.claude/worktrees/guide-identifier-existence` 기준):

```
 D  codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts   (189 -)
 D  codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts             (184 -)
 A  codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts   (316 +)
 A  codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts             (214 +)
 M  codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts (2 줄, 주석만)
 5 files changed, 532 insertions(+), 375 deletions(-)
```

이 변경은 **frontend 테스트 하네스 전용**이다 — 유저 가이드(MDX)가 인용하는 식별자(에러 코드·환경변수 등)가 실재하는지 검증하는 가드를 `guide-error-code-*`(에러 코드 전용) 에서 `guide-identifier-*`(식별자 전반)로 일반화한 리네임 + 확장이다. 제품 코드·API·엔티티·이벤트는 건드리지 않는다.

## 관점별 확인

1. **요구사항 ID 충돌** — diff 에 신규 요구사항 ID(`R-*`, `CV-*` 등) 없음. 해당 없음.
2. **엔티티/타입명 충돌** — 신규 export: `IdentifierCitation`(interface), `CitationAxis`(type, 기존 동명 타입의 자연스러운 후속 — 구 파일 `guide-error-code-scan.ts` 의 `CitationAxis`/`ErrorCodeCitation`/`scanErrorCodeCitations`/`collectBackendTokens` 는 같은 diff 에서 삭제되므로 리네임이지 신규 충돌이 아니다), `scanIdentifierCitations`, `collectSourceTokens`, `collectEnvDeclarations`, `GUIDE_EXTERNAL_VOCABULARY`. `grep -rn` 전수 확인 결과 이 이름들은 저장소 내 다른 위치에서 다른 의미로 쓰이고 있지 않다.
3. **API endpoint 충돌** — 신규 endpoint 없음. 해당 없음.
4. **이벤트/메시지명 충돌** — `GUIDE_EXTERNAL_VOCABULARY` 허용목록의 토큰 `MESSAGE_CREATE` 는 Discord Gateway 이벤트명을 "우리 코드에 없는 게 정상인 외부 어휘"로 인용한다. `spec/4-nodes/7-trigger/providers/discord.md`, `spec/5-system/15-chat-channel.md`, `codebase/frontend/src/content/docs/06-integrations-and-config/discord*.mdx` 전부 동일 의미(Discord Gateway `MESSAGE_CREATE` 이벤트, v1 미수신)로 일관 사용 중 — 의미 충돌 없음. 저장소 내부에 이와 다른 의미의 `MESSAGE_CREATE` 식별자는 없음(grep 전수 확인).
5. **환경변수·설정키 충돌** — 이 diff 는 신규 ENV var/config key 를 도입하지 않는다. `collectEnvDeclarations` 는 기존 `.env.example`/`docker-compose*.yml` 을 읽는 스캐너일 뿐 새 키를 정의하지 않는다.
6. **파일 경로 충돌** — 신규 경로 `guide-identifier-existence.test.ts` / `guide-identifier-scan.ts` 는 같은 커밋에서 구 파일(`guide-error-code-existence.test.ts` / `guide-error-code-scan.ts`)이 삭제되므로 경로 중복이 없고, 디렉토리 내 기존 명명 컨벤션(`<도메인>-<목적>.test.ts` + 순수 스캐너 `<도메인>-scan.ts`/`<도메인>-parse.ts` 자매 파일 — 예: `spec-links.ts`/`spec-links.test.ts`, `plan-scan.ts`)을 그대로 따른다.

## INFO — 참고 (충돌 아님)

- **[INFO]** 모듈-private 상수 `UPPER_SNAKE` 이름 중복
  - target 신규 식별자: `guide-identifier-scan.ts` 의 (비export) `const UPPER_SNAKE = "[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+"`
  - 기존 사용처: `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts:60` 의 `const UPPER_SNAKE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;`
  - 상세: 두 파일이 각자 독립적으로 "밑줄 하나 이상 요구하는 UPPER_SNAKE 정규식"을 같은 이름의 모듈-스코프 상수로 정의한다. 둘 다 `export` 되지 않고 서로 import 관계가 없어 컴파일/런타임 충돌은 없으며 의미도 동일(오탐 방지를 위해 약어 제외)해 혼선 위험도 낮다. 새 식별자 "충돌"이라기보다 우연한 patttern 중복.
  - 제안: 충돌이 아니므로 이번 PR 에서 조치 불필요. 두 가드가 향후 공유 유틸로 합쳐질 계기가 생기면 그때 이름 통합을 고려.

- **[INFO]** 허용목록 이름 접두사 선점 확인됨 (설계 근거 검증)
  - `plan/in-progress/guide-identifier-existence.md` 가 `GUIDE_EXTERNAL_VOCABULARY` 채택 이유로 "무관 도메인의 `KNOWN_DOCS_ABSENT` 와 `KNOWN_*` 접두를 공유하지 않기 위해"라고 명시했고, 실제로 `KNOWN_DOCS_ABSENT` 는 `codebase/backend/src/nodes/integration/cafe24/metadata/catalog-docs-drift.spec.ts` 에만 존재하는 무관 도메인 상수로 확인됨. 의도적 회피가 실측과 일치한다 — 별도 조치 불필요.

## 요약

이번 diff 는 `spec/conventions/` 를 변경하지 않으며, 실제 코드 변경은 frontend 테스트 하네스 파일 5개(구 `guide-error-code-*` 를 `guide-identifier-*` 로 리네임·일반화)에 국한된다. 신규 도입 식별자(타입·인터페이스·함수·상수·파일 경로)는 전수 grep 결과 저장소 내 다른 의미로 이미 쓰이고 있는 곳이 없고, 허용목록에 등재된 외부 어휘 `MESSAGE_CREATE` 도 spec·frontend 문서 전반에서 동일한 Discord Gateway 이벤트 의미로 일관되게 쓰인다. 요구사항 ID·API endpoint·webhook/queue/sse 이벤트명·ENV 키 신규 도입도 없다. 모듈-private 정규식 상수 `UPPER_SNAKE` 이름이 backend repo-guard 와 우연히 겹치지만 비export·무관계라 충돌로 볼 수 없다(INFO 로만 기록).

## 위험도

NONE
