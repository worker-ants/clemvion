# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 확정

이 라운드가 실제로 다루는 델타는 `spec/conventions/` 아래 2개 파일이다.

- `spec/conventions/migrations.md` — 기존 "§5 새 마이그레이션 추가 절차" 말미에 4줄 단락 추가
  (README.md §5 의 "인덱스 교체는 DROP-먼저" 패턴을 가리키는 참조문 1개)
- `spec/conventions/review-citations.md` — **신규 파일** (111줄, `new file mode`)

구현 diff 는 `codebase/backend/migrations/README.md` 1개 파일·54줄이며, migrations.md 참조문이
가리키는 실제 신규 서브섹션("인덱스 교체는 DROP-먼저", `### 5.` 안의 굵은 글씨 하위 항목)이 여기 있다.

번들에 섞인 `chat-channel-adapter.md`·`swagger.md`·`cafe24-api-catalog/**` 등은 이번 PR 의 변경
대상이 아니라 context 로 첨부된 related_specs (본문이 예산 절단됨) 이므로 신규 식별자 충돌 분석
대상에서 제외했다 — `git diff origin/main...HEAD -- spec/conventions/` 로 실측 확인.

## 발견사항

이번 델타가 새로 도입하는 식별자는 다음이 전부다.

1. frontmatter `id: review-citations` (신규 문서 ID)
2. 파일 경로 `spec/conventions/review-citations.md`
3. 섹션 제목 §1~§4 (인용은 유지한다 / 날짜를 포함한다 / 적용 범위 / 소급 정리 대상 아님)
4. README.md 내 굵은 글씨 하위 항목 "인덱스 교체는 DROP-먼저"

각 항목을 6개 관점으로 대조한 결과, **충돌 없음**을 확인했다.

- **ID 충돌** — `grep -rn "id: review-citations" spec/` 결과 신규 파일 자신 외 매치 없음.
  `id: migrations` 는 이번 델타로 변경되지 않았고 기존 그대로다.
- **엔티티/타입명 충돌** — 이번 델타는 DTO·인터페이스·엔티티를 도입하지 않는다 (문서·규약 성격).
- **API endpoint 충돌** — 해당 없음 (신규 endpoint 없음).
- **이벤트/메시지명 충돌** — 해당 없음.
- **환경변수/설정키 충돌** — 해당 없음.
- **파일 경로 충돌** — `spec/conventions/review-citations.md` 는 `origin/main` 에 존재하지
  않는 신규 경로이고 (`git log origin/main -- spec/conventions/review-citations.md` 결과 없음),
  기존 kebab-case 명명 컨벤션(`node-cancellation.md`, `redis-keys.md` 등)과 일치한다.
  README.md 의 "인덱스 교체는 DROP-먼저" 도 기존 헤더와 문자열 중복이 없다
  (`grep -n "인덱스 교체" README.md` → 신규 줄 1건뿐).

추가로 다음도 확인했다 (충돌 아님, 참고).

- 신규 문서가 `code:` frontmatter 에 인용한 `roles.guard.spec.ts` / `sanitize-loader-error.ts`
  는 다른 conventions 문서의 `code:` 목록과 겹치지 않는다.
- migrations.md 의 신규 참조문이 가리키는 README.md §5 는 migrations.md 자신의 "## 5. 새
  마이그레이션 추가 절차" 와 번호가 같은 "§5" 이지만, 이는 이번 델타가 새로 만든 패턴이 아니다
  — 같은 문서에 이미 존재하던 "README.md §4·§5 참고" 인용(§5 새 마이그레이션 추가 절차 3번
  항목, 변경 전부터 존재)과 동일한 기존 관례이므로 신규 충돌로 보지 않는다.
- 선례로 인용된 마이그레이션 파일 `V056`·`V106`·`V110` 은 실제 워킹트리에 존재하는 실파일이다
  (`ls codebase/backend/migrations/` 로 확인) — 존재하지 않는 파일을 가리키는 dangling 인용이
  아니다.

## 요약

이번 라운드의 실제 델타는 `spec/conventions/migrations.md` 의 4줄 추가 참조문과
`spec/conventions/review-citations.md` 신규 문서(+ README.md 짝 구현 54줄) 뿐이다. 신규
도입 식별자(문서 ID, 파일 경로, 섹션명, README 하위 항목명)를 요구사항 ID·엔티티/타입명·API
endpoint·이벤트명·환경변수·파일 경로 6개 관점에서 전수 대조했으나 기존 사용처와 충돌하는
사례를 찾지 못했다. `review-citations` ID·파일 경로는 `origin/main` 에 전례가 없는 완전 신규이고,
관련 `plan/complete/spec-draft-migration-rerun-and-citations.md` 산출물과도 명명이 일치한다.

## 위험도

NONE
