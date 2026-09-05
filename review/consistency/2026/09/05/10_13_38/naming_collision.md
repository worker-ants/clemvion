# 신규 식별자 충돌 검토

## 검토 범위

- `spec/conventions/migrations.md` — §5 절차에 "인덱스 교체 재실행 안전성" 각주 5줄 추가 (신규 식별자 없음, 기존 §6 이하 참조만 추가)
- `spec/conventions/review-citations.md` — **신규 파일** (127줄), `id: review-citations` 신규 spec-impl-evidence frontmatter 도입
- `spec/conventions/spec-impl-evidence.md` — `code:` 필드 정의에 "순수 문서형 convention" 예외 각주 1줄 추가 (신규 식별자 없음)
- `spec/data-flow/8-notifications.md` — V056 인덱스 교체 서술에 "DROP-먼저" 패턴 참조 각주 6줄 추가 (신규 식별자 없음)
- `codebase/backend/migrations/README.md` — §5 "인덱스 교체는 DROP-먼저" 신규 하위 절 도입 (구현 diff, 29줄 추가/2줄 삭제)

## 발견사항

신규 식별자 충돌 관점에서 CRITICAL/WARNING 급 발견 없음. 아래는 확인 절차와 결과 기록.

- **[INFO]** `id: review-citations` 신규 등록 — 충돌 없음 확인
  - target 신규 식별자: `spec/conventions/review-citations.md` frontmatter `id: review-citations`
  - 기존 사용처: 없음 — `spec/**/*.md` frontmatter 전수 grep 결과 `review-citations` id 중복 0건. `spec/conventions/*.md` 25개 파일의 `id:` 값 전수 대조 결과도 유일값. (`spec-impl-evidence.md` 156·172행의 `id: chat-channel` 중복은 §2.1 예시로 든 YAML 코드펜스 안의 설명용 샘플이며 실제 frontmatter 아님 — 오탐 아님을 확인)
  - 상세: 파일명(`review-citations.md`)·id(`review-citations`) 모두 기존 `spec/conventions/` 25개 파일(`chat-channel-adapter`, `spec-impl-evidence`, `swagger` 등)의 kebab-case 명명 컨벤션과 일치. `codebase/**` 전수 grep 에서도 `ReviewCitation`/`review_citation` 등 동명 엔티티·컬럼·타입 없음.
  - 제안: 없음(문제 없음).

- **[INFO]** "인덱스 교체는 DROP-먼저" 패턴명 신규 도입 — 충돌 없음 확인
  - target 신규 식별자: `codebase/backend/migrations/README.md` §5 신규 하위 절 제목 "인덱스 교체는 DROP-먼저" (spec 쪽 `migrations.md`·`data-flow/8-notifications.md` 두 곳에서 동일 문자열로 인용)
  - 기존 사용처: 없음 — 변경 전(`origin/main`) `spec/`·`codebase/backend/migrations/README.md` 전체에서 "인덱스 교체"/"DROP-먼저"/"DROP INDEX CONCURRENTLY" 조합 검색 결과 이 라운드 이전에는 해당 패턴명이 존재하지 않았다.
  - 상세: 세 문서(migrations.md, 8-notifications.md, README.md)가 같은 문자열로 정확히 교차 인용하고 있어 용어 충돌·표기 흔들림 없음.
  - 제안: 없음(문제 없음).

- **[INFO]** `migrate-repair` 서비스명 재참조 — 신규 도입 아님, 충돌 무관
  - target 신규 식별자 아님 — `spec/conventions/migrations.md` §3 의 `migrate-repair` 언급은 이번 diff 범위 밖(§3 은 변경되지 않음)이며 기존 `codebase/backend/migrations/README.md`(`docker compose up migrate-repair`)와 이미 일치하는 기존 식별자. 참고로만 기록.

## 요약

이번 diff 는 신규 엔티티·DTO·API endpoint·webhook/큐/SSE 이벤트·ENV 변수를 하나도 도입하지 않는다 — 변경은 (1) 신규 convention 문서 `review-citations.md` 1건의 spec id 등록, (2) 기존 세 문서(migrations.md·spec-impl-evidence.md·8-notifications.md)에 대한 짧은 상호 참조 각주, (3) 마이그레이션 README 의 신규 절차명("인덱스 교체는 DROP-먼저") 도입뿐이다. 새 id·파일명·패턴명 모두 기존 `spec/conventions/` 명명 컨벤션(kebab-case, basename=id)과 정합하고, `spec/**`·`codebase/**` 전수 검색으로 동일 식별자의 선행 사용례가 없음을 확인했다. 신규 식별자 충돌 관점에서 차단할 사안 없음.

## 위험도

NONE
