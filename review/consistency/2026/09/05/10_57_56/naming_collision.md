# 신규 식별자 충돌 검토 — `spec/conventions/` (impl-done)

## 검토 범위 확인

`--impl-done` scope 델타 3개 파일 + 연관 코드 diff 1개(63줄)를 워킹트리 절대경로 기준으로 직접 확인했다(프롬프트 예산 절단으로 diff 본문이 안 실려 있어 `git diff origin/main...HEAD` 를 직접 재실행).

- `spec/conventions/migrations.md` — 기존 §5→§6 참조 정정 1건 + "인덱스 교체는 DROP-먼저" 요약 blockquote 추가(신규 식별자 없음, 기존 README 섹션 인용)
- `spec/conventions/review-citations.md` — **신규 파일**(136줄), `id: review-citations`
- `spec/conventions/spec-impl-evidence.md` — `code:` 필드 정의 행에 "순수 문서형 convention 예외" 설명 1문장 추가(기존 필드 재해석, 신규 필드 아님)
- `codebase/backend/migrations/README.md` — §5 말미에 "인덱스 교체는 DROP-먼저" 3문장 순서 패턴 + `V110__schedule_workspace_next_run_index.sql` 선례 인용 추가

## 발견사항

없음. 아래 관점별로 신규 식별자를 전수 대조했다.

- **요구사항/spec ID**: `id: review-citations` — `git -C <worktree> grep -rn "^id: review-citations"` 결과 `review-citations.md` 자신 1건뿐. `spec/conventions/*.md` 24개 파일명 전체와 대조해도 겹치는 basename·id 없음.
- **엔티티/타입명**: 이번 델타에 신규 TS interface/DTO 없음(문서·마이그레이션만 변경). `code:` 키 재해석("준수 예시" 예외)은 신규 식별자가 아니라 기존 필드의 의미역 확장이며, `spec-impl-evidence.md §2.2` 가 이미 이런 재해석을 다루는 절이라 새로 충돌할 자리가 아니다.
- **API endpoint**: 신규 endpoint 없음.
- **이벤트/메시지명**: 신규 없음.
- **환경변수/설정키**: 신규 없음(`FLYWAY_POSTGRESQL_TRANSACTIONAL_LOCK` 은 기존 값 재인용).
- **파일 경로**: 
  - `spec/conventions/review-citations.md` — kebab-case, 형제 파일(`migrations.md`, `spec-impl-evidence.md`, `swagger.md` 등) 네이밍 컨벤션과 일치. 기존 파일과 경로 충돌 없음. `spec-area-index.test.ts` 는 `spec/conventions/` 를 flat reference(무-index)로 명시 제외하므로 신규 파일 추가로 인한 index 누락도 아니다.
  - 신규 마이그레이션 `V110__schedule_workspace_next_run_index.sql`/`.conf` — `ls codebase/backend/migrations/` 로 직접 대조: `V109` 다음 단조 증가, 중복 없음. `check-migration-versions.py`/`migrations.spec.ts` 가드 관점에서도 충돌 없음.
  - 신규 패턴명 "인덱스 교체는 DROP-먼저" — `spec/conventions/migrations.md`, `codebase/backend/migrations/README.md`(정의 자리), `spec/data-flow/8-notifications.md`(선행 사례 정정 각주) 세 곳에서 모두 같은 대상을 가리키는 일관 인용이고, 기존에 다른 의미로 쓰이던 동일 문자열은 없다.

## 요약

이번 라운드의 `spec/conventions/` 델타는 (1) 완전 신규 convention 문서 1건(`review-citations.md`, id 유일성 확인), (2) 기존 필드 설명 보강 1문장(`spec-impl-evidence.md`), (3) 섹션 참조 정정 + 신규 마이그레이션 패턴명 도입(`migrations.md`/README.md, `V110` 번호 유일성 확인) 으로 구성된다. 신규 ID·타입명·endpoint·이벤트명·env var·파일 경로 6개 관점 모두 기존 사용처와 대조한 결과 충돌이 발견되지 않았다.

## 위험도

NONE
