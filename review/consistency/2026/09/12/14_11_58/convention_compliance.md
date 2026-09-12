# 정식 규약 준수 검토 — `plan/in-progress/spec-update-chat-channel-adapter-status.md`

## 검토 범위

target 은 `spec/conventions/**` 자체가 아니라 그것을 갱신하려는 **plan draft**(SPEC-DRIFT,
`resolution-applier` 산출)다. 따라서 두 층을 모두 확인했다:

1. draft 문서 자체(frontmatter·파일명·섹션 구조)가 `plan/**` 관련 정식 규약(plan-lifecycle,
   PROJECT.md, `resolution-applier.md` 템플릿)을 따르는가
2. draft 가 제안하는 `spec/conventions/chat-channel-adapter.md` 편집안이 `spec-impl-evidence.md`
   의 frontmatter 스키마·`status` 라이프사이클을 위반하지 않는가

## 발견사항

없음 — 아래 실측 근거로 5개 관점 전부 확인했다.

### 1. 명명 규약

- 파일명 `plan/in-progress/spec-update-chat-channel-adapter-status.md` — PROJECT.md
  ("spec 자체에 누락·오류가 있다고 판단됨 → `plan/in-progress/spec-update-<name>.md`",
  `PROJECT.md:183,222`) 및 `.claude/agents/resolution-applier.md` §3 템플릿
  ("SPEC-DRIFT … `plan/in-progress/spec-update-<area>.md`") 과 정확히 일치. `<area>` 를
  대상 convention 파일명(`chat-channel-adapter`)+주제(`status`)로 잡은 것도 관례에 부합.
- `owner: resolution-applier` — `.claude/agents/resolution-applier.md:103` 자기 정의의
  frontmatter 예시(`owner: resolution-applier`)와 문자 그대로 동일. 임의 값이 아니라
  agent 정의가 지정한 값이다.

### 2. 출력 포맷 규약

해당 없음(코드 변경·API 응답/이벤트 페이로드/에러 코드 스키마 변경 없음). draft 본문이 인용하는
`error.code`/`@ApiBadGatewayResponse` 등은 이미 별도 커밋(`a4f943f4b` 등)에서 처리된 배경
사실 인용일 뿐, 이 draft 가 신규로 규정하는 포맷이 아니다.

### 3. 문서 구조 규약

- draft 자체 frontmatter(`worktree`/`started`/`owner`) — `plan-lifecycle.md §4` 의
  top-level `plan/in-progress/*.md` 3필드 스키마와 정확히 일치. `worktree: impl-setup-error-code-ddd078`
  는 실제 현재 worktree 디렉토리명과 일치(`basename $(pwd)` 로 확인), `started: 2026-09-12`
  는 ISO 형식.
- 섹션 구성(`## 분류` → `## 원본 발견사항` → `## 제안 변경`)이 `resolution-applier.md` §3
  템플릿과 1:1 대응. 추가된 `## 실측 근거`·`## 영향` 은 템플릿에 없는 보강 섹션이나 금지되지
  않고, `plan-frontmatter.test.ts` 등 build guard 는 섹션 헤더를 검사하지 않는다(그레이-matter
  는 frontmatter 만 파싱) — 구조 규약 위반 아님.
- 제안된 spec 본문 갱신 라벨 `> **2026-09-12 갱신 — 조건 충족.**` 형식은 이 저장소
  `spec/conventions/**` 전반에서 이미 쓰이는 "`> **정정/갱신 (YYYY-MM-DD…)**:`" 콜아웃 관례
  (`interaction-type-registry.md:148`, `secret-store.md:69`, `review-citations.md:99`,
  `conversation-thread.md:390`)와 형식이 일치한다. 원문을 취소선 없이 보존하고 갱신 사실만
  덧붙이는 방식도 이 draft 가 CLAUDE.md 의 "자기-반증형 소정정" 예외를 쓰는 게 아니라
  (조건 1 미충족 → planner 턴으로 정상 라우팅) 일반 spec 갱신이므로, §조건4 의 "원문 취소선
  유지" 강제가 애초에 적용 대상이 아니다 — 이 구분을 draft 가 정확히 짚고 라벨도
  "정정(자기-반증형 소정정)" 이 아니라 "갱신"으로 갈라 썼다(오인 유발 없음).

### 4. API 문서 규약

해당 없음 — draft 는 데코레이터/DTO 를 직접 편집하지 않는다. 언급된
`@ApiBadGatewayResponse` 는 별도로 이미 반영된 사실의 인용이다.

### 5. 금지 항목 / spec-impl-evidence.md 정합성

- `pending_plans:` 를 "구현 완료"로 갱신하면서도 `status: partial` 은 그대로 유지하고
  나머지 3개 항목(`chat-channel-discord-gateway.md` 등)을 리스트에 남기는 제안은
  `spec-impl-evidence.md §3` 라이프사이클 표("partial → implemented: **마지막**
  `pending_plans` 가 `complete/` 로 이동한 commit 안에서 승격")와 정확히 부합한다 — 3개
  항목이 여전히 `in-progress` 이므로 `status` 를 `implemented` 로 올리지 않은 것이 맞다.
- 제안된 YAML 주석 블록(6줄)이 `pending_plans:` 리스트 앞에 오는 형태 — 이 필드를 검증하는
  `spec-pending-plan-existence.test.ts` 는 gray-matter 기반 `spec-frontmatter-parse.ts` 를
  쓰므로 주석 줄 수와 무관하게 정상 파싱된다. (참고: 과거 `review_guard._parse_frontmatter_code`
  의 주석-후-엔트리 유실 버그는 **`code:` 키 전용** 파서였고 2026-09-06 에 수정됐다 — 이
  draft 가 편집하는 `pending_plans:` 키는 애초에 그 버그의 영향 범위 밖이었다.)
- §1.1.2 헤딩 실측(`chat-channel-adapter.md:156` "`setupChannel` 실패 판별 — 자격 증명
  거부는 `code` 로 **선언**한다")이 draft 가 인용하는 "`code` 선언 계약" 표현과 정확히
  일치 — 인용 오류 없음.
- SPEC-DRIFT 항목에 대해 "코드 변경 없음"을 `## 영향`에 명시한 것은
  `resolution-applier.md` §3-4 "SPEC-DRIFT 는 코드 무수정" 규칙 준수.

## 요약

target 은 spec 자체가 아니라 `spec/conventions/chat-channel-adapter.md` 를 갱신하기 위한
resolution-applier 산출 draft이며, 자체 frontmatter·파일명·섹션 구조가
`plan-lifecycle.md`·`PROJECT.md`·`resolution-applier.md` 템플릿과 정확히 일치하고, 제안된
spec 편집 내용도 `spec-impl-evidence.md` 의 frontmatter 스키마(`status`/`pending_plans`
라이프사이클)와 충돌 없이 정합한다. 인용된 §1.1.2 헤딩·라인 번호도 실측 대조로 정확했다.
정식 규약(`spec/conventions/**`) 관점에서 CRITICAL/WARNING 급 위반은 발견되지 않았다.

## 위험도

NONE
