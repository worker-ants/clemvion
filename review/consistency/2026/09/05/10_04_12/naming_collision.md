# 신규 식별자 충돌 검토 — naming_collision

## 검토 대상 실측 요약

- `spec/conventions/migrations.md` — 기존 §5 (새 마이그레이션 추가 절차) 에 5줄 추가. 새 식별자 도입 없음 — `codebase/backend/migrations/README.md` §5 의 기존 문단(*"인덱스 교체는 DROP-먼저"*, bold 텍스트, heading 아님·앵커 미생성)을 산문으로 인용만 한다.
- `spec/conventions/review-citations.md` — **완전 신규 파일**(+124줄, `id: review-citations`). 코드 주석의 리뷰 산출물 인용 형식(날짜 포함 여부·적용 범위)을 규정하는 순수 컨벤션 문서. 새 엔티티·API·이벤트·ENV 를 도입하지 않는다.
- 구현 diff(54줄)는 `codebase/backend/migrations/README.md` 뿐이며, 그 안에서 이미 병합돼 있는 `V110__schedule_workspace_next_run_index.sql`(이번 PR 범위 밖, 선례로만 인용됨)을 근거로 "인덱스 교체는 DROP-먼저" 절차를 문서화한 것이다.

## 점검 관점별 확인 내역

1. **요구사항 ID 충돌** — `spec/conventions/*.md` 전체의 frontmatter `id:` 를 전수 확인(`grep -rn "^id:"`). `review-citations` 는 유일값, 다른 문서와 충돌 없음. `migrations` 는 기존 문서 자신의 id 로 재사용(변경 아님).
2. **엔티티/타입명 충돌** — 이번 변경은 TypeScript 인터페이스·DTO 를 도입하지 않는다(문서 컨벤션 성격). 해당 없음.
3. **API endpoint 충돌** — 신규 endpoint 없음. 해당 없음.
4. **이벤트/메시지명 충돌** — 신규 webhook/queue/SSE 이벤트명 없음. 해당 없음.
5. **환경변수·설정키 충돌** — 신규 ENV/config key 없음. 해당 없음.
6. **파일 경로 충돌** — `spec/conventions/review-citations.md` 는 기존 kebab-case 단일 파일 컨벤션(`migrations.md`, `swagger.md`, `redis-keys.md`, `secret-store.md` 등)과 명명 패턴이 일치하고, 동일 경로를 쓰는 기존 파일이 없음(`git log`/디렉토리 확인).

## 추가 실측 (코드 레벨 부수 확인)

- README.md 신설 문단이 선례로 든 `V110__schedule_workspace_next_run_index.sql`(및 `.conf`)은 이번 PR 이전에 이미 병합된 파일이며, 새로 정의하는 인덱스명 `idx_schedule_workspace_next_run` 은 `codebase/backend/migrations/` 전체에서 유일하다(`grep -rn` 확인) — 기존 `idx_schedule_next_run`(V002) 은 해당 마이그레이션이 의도적으로 대체(DROP)하는 대상이지 이름 충돌이 아니다.
- `review-citations.md` 의 `code:` 예시 파일(`roles.guard.spec.ts`, `sanitize-loader-error.ts`)을 다른 컨벤션 문서가 `code:` 로 이중 주장하고 있지 않음을 확인.

## 발견사항

없음 — 이번 델타(문서 2건 + 코드 diff 1건)에서 새로 도입되는 요구사항 ID·엔티티·endpoint·이벤트·ENV·파일 경로 중 기존 사용처와 충돌하는 항목을 찾지 못했다.

## 요약

이번 target 은 실질적으로 (a) 기존 `migrations.md` 에 README.md 신규 절차를 가리키는 5줄 산문 인용을 추가한 것과 (b) 코드 주석의 리뷰 인용 형식을 규정하는 완전 신규 컨벤션 문서(`review-citations.md`)를 추가한 것으로 구성된다. 두 변경 모두 신규 엔티티·API·이벤트·ENV·요구사항 ID 를 발급하지 않으며, 유일하게 신규로 등재되는 식별자인 frontmatter `id: review-citations` 와 파일 경로는 `spec/conventions/` 전체 대비 유일함을 확인했다. 구현 diff 에서 선례로 인용된 `V110` 마이그레이션의 인덱스명(`idx_schedule_workspace_next_run`)도 저장소 전체에서 유일하여 코드 레벨 충돌도 없다.

## 위험도

NONE
