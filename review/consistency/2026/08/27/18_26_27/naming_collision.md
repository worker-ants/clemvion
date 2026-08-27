STATUS=success naming_collision review complete — no collisions found
===REPORT_MARKDOWN_BELOW===
# 신규 식별자 충돌 검토 — spec/conventions/ (doclink-guard-scope)

## 조사 범위 재확정

번들에는 `spec/conventions/` 전체(약 250개 파일)가 참조용으로 실려 있으나, `origin/main` 대비
실제 diff 는 다음으로 한정된다 (`git diff origin/main --stat`):

- `spec/conventions/spec-impl-evidence.md` — §4.2 표의 `spec-link-integrity.test.ts` 행에
  "(3) 거버넌스 문서" 서술 추가 (신규 ID/엔티티/엔드포인트 없음, 순수 서술 확장)
- `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` — 신규 테스트 스위트 2개
- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` — 신규 함수/상수 4개
- `.github/workflows/spec-link-checks.yml` — pathspec 2줄 추가
- `PROJECT.md` — 문서 링크 검증 절 재작성 (`check-doc-links.py` → vitest 가드로 전환)
- `scripts/check-doc-links.py` — 삭제
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — 체크리스트 완료 표기
- `review/code/2026/08/27/**` — 리뷰 산출물 (신규 식별자 도입과 무관)

target 은 신규 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·ENV var 를 도입하지 않는다.
새로 생기는 것은 (a) 코드 레벨 함수/상수 4개, (b) CI pathspec 항목 2개뿐이다. 이 관점에서
점검했다.

## 발견사항

### [INFO] 신규 함수/상수 4개는 기존 명명 패턴과 충돌 없음, 확인 완료
- target 신규 식별자: `collectGovernanceMarkdown`, `findBrokenGovernanceLinks`,
  `GOVERNANCE_SKIP_DIRS` (`spec-links.ts`), `MIN_CLAUDE_DOCS` (`spec-link-integrity.test.ts`)
- 기존 사용처: 전체 저장소 `git grep` 결과 이 diff 파일들 외에는 0건. 형제 함수
  `collectSpecMarkdown`/`collectCodebaseSources`/`findBrokenLinks`/`findBrokenPlanLinks`
  (`spec-links.ts:159,275,351,380`)와 `collect*`/`findBroken*Links` 접두 패턴이 일관되고,
  `GOVERNANCE_SKIP_DIRS` 는 기존 `CODEBASE_SKIP_DIRS` (`spec-links.ts:375`) 와 동일 패턴의
  자매 상수다.
- 상세: 충돌 없음. 명명이 기존 컨벤션을 그대로 따르고 있어 리뷰어·개발자가 역할을 즉시
  유추 가능.
- 제안: 없음.

### [INFO] "governance" 용어의 기존 사용과 의미 충돌 없음
- target 신규 식별자: "거버넌스 문서" (root `*.md` + `.claude/**.md`) — spec-impl-evidence.md
  §4.2, spec-links.ts, PROJECT.md 전반에서 일관 사용
- 기존 사용처: `spec/conventions/node-cancellation.md:166` `"두 sentinel 의 governance 가
  다르다"` — `AbortError` sentinel 의 관리 주체를 가리키는 일반 영단어 사용
- 상세: 두 사용처 모두 식별자(ID/타입/상수)가 아니라 산문 어휘이고 도메인이 완전히
  분리(문서 트리 스코프 명명 vs 코드 실행 취소 시맨틱)돼 혼동 여지가 낮다. 정식 식별자
  충돌이 아니므로 등급을 CRITICAL/WARNING 으로 올리지 않는다.
- 제안: 조치 불요.

### [INFO] CI pathspec `:(glob)*.md` / `.claude/**` — 신규 등재, 기존 항목과 중복 없음
- target 신규 식별자: `.github/workflows/spec-link-checks.yml` 의 `pathspecs` 목록에
  `:(glob)*.md`, `.claude/**` 2줄 추가
- 기존 사용처: 동 워크플로의 기존 pathspec 목록(`codebase/**`, `spec/**`,
  `scripts/ci-paths-changed.sh`, `.github/workflows/_changed-paths.yml` 등)에 겹치는 항목 없음
  (diff 는 순수 추가, 치환 아님).
- 상세: 충돌 없음. `:(glob)` magic 부재 시 `*` 가 `/` 를 넘어 17,202개 파일을 잡는다는
  실측이 주석에 함께 남아 있어(코드 리뷰 대상은 아니지만) 근거도 명시적이다.
- 제안: 없음.

### [INFO] `scripts/check-doc-links.py` 삭제 후 잔존 참조 없음
- target 신규 식별자 없음(삭제) — 참고로 확인
- 기존 사용처: `PROJECT.md` 의 `python3 scripts/check-doc-links.py` 호출부는 이 diff 에서
  함께 vitest 명령으로 치환됐다. `git grep check-doc-links` 로 잔존 참조 재확인 결과
  diff 파일들(설명 산문) 외 dangling 참조 없음.
- 상세: 파일 경로 충돌 관점에서 문제 없음 — 삭제된 경로를 계속 가리키는 자리가 없다.
- 제안: 없음.

## 요약

이번 target 은 신규 제품 요구사항·엔티티·API endpoint·이벤트·ENV var 를 하나도 도입하지
않는 순수 인프라/가드 스코프 확장(문서 링크 가드에 "거버넌스 문서" 스코프 추가 + 열등
중복 스크립트 삭제)이다. 실제로 신설되는 식별자는 코드 레벨 함수/상수 4개와 CI
pathspec 2줄뿐이며, 전수 `git grep` 확인 결과 기존 저장소 어디에서도 다른 의미로
선점되어 있지 않다. 명명 패턴도 기존 자매 함수/상수(`collectSpecMarkdown`,
`CODEBASE_SKIP_DIRS` 등)와 일관돼 혼동 유발 요소가 없다. CRITICAL/WARNING 등급 발견사항
없음.

## 위험도

NONE
