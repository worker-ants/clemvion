# 문서화(Documentation) 리뷰

## 검토 방법

이번 diff(56개 파일)는 애플리케이션 코드 변경이 없는 순수 문서/spec/plan/리뷰 산출물 변경이다. 실질 콘텐츠 변경은 6개 파일뿐이고 나머지 50개는 이 세션 안에서 이미 지나간 리뷰(`review/code/2026/09/05/{09_27_04,09_42_13}`) · consistency-check(`review/consistency/2026/09/05/{09_13_39,09_53_09,10_04_12,10_13_38}`) 라운드의 산출물(시점 기록, 사후 편집 대상 아님)이다. 실질 콘텐츠 파일들을 저장소에서 직접 열어 diff 만이 아니라 전체 파일 상태로 대조했다:

- `codebase/backend/migrations/README.md` §5 (전체 컨텍스트 124~167행)
- `spec/conventions/migrations.md` §5 신규 5줄
- `spec/conventions/review-citations.md` (신규, 전문 128행 — diff 가 잘려 있어 전체를 읽었다)
- `spec/conventions/spec-impl-evidence.md` §2.1 `code:` 필드 각주
- `spec/data-flow/8-notifications.md` V056 caveat
- `plan/complete/spec-draft-migration-rerun-and-citations.md` (전문 222행)
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 체크박스 클로징 구간

이 세션은 이미 5라운드(09_27_04 → 09_42_13 → 09_53_09 → 10_04_12 → 10_13_38)에 걸쳐 문서 상호 참조·코드펜스 중첩·부록 이중 관리·`code:` 필드 재해석 SoT 미동기화·V056 caveat 누락 등을 지적하고 조치해 왔다. 그 조치들이 실제로 현재 파일에 반영돼 있는지 재현 확인했고(전부 반영 확인, 회귀 없음), 그 위에서 신규 관점을 스캔했다.

## 발견사항

- **[INFO]** README.md §5 "규칙" 불릿이 새로 추가된 예시(`DO $$ ... $$`)를 반영하지 않았다
  - 위치: `codebase/backend/migrations/README.md:134`(설명 문단) vs `codebase/backend/migrations/README.md:139`(규칙 불릿)
  - 상세: 134행 인용문("그럼에도 한 파일 한 statement 컨벤션을 유지하는 이유")은 이번 PR 에서 "같은 파일에 *transactional* statement (예: `ALTER TABLE`, `DO $$ ... $$`) 와 `CONCURRENTLY` 를 섞으면 ... Flyway 의 mixed 판정에 걸립니다" 로 `DO $$ ... $$` 예시를 새로 추가했다(§1.2 의 `mixed=true` 실측을 반영하기 위함으로 보인다). 그런데 바로 아래 **"규칙:" 불릿 목록**(139행)은 여전히 "같은 파일 안에 *transactional* statement (예: `ALTER TABLE`) 와 `CONCURRENTLY` 를 섞지 않습니다" 로, `DO` 블록 예시가 빠진 채 남아 있다. 두 문장은 같은 규칙을 설명 문단과 규칙 요약으로 나눠 적은 것인데, 신규 예시가 설명 쪽에만 들어가고 요약 쪽에는 반영되지 않아 "규칙:" 만 훑는 독자는 `DO $$ ... $$` 도 이 제한에 걸린다는 것을 놓칠 수 있다. 바로 이 문서 자신이 155행에서 `DO` 블록을 mixed 판정에 걸리는 사례로 상세히 다루고 있어(§1.2 (c) 형태), 규칙 요약과 설명 사이의 예시 불일치가 눈에 띈다.
  - 제안: 139행의 "(예: `ALTER TABLE`)" 를 "(예: `ALTER TABLE`, `DO $$ ... $$`)" 로 맞춰 134행과 동기화한다. 사소하지만 두 문장이 같은 규칙을 반복 서술하는 자리라 불일치가 남으면 다음 편집자가 "규칙:" 쪽만 보고 예시 목록을 업데이트할 때 또 어긋날 수 있다.

- **[INFO]** `spec/conventions/migrations.md` 신규 불릿의 위치가 §5 절차 흐름을 끊는다
  - 위치: `spec/conventions/migrations.md`(§5 "새 마이그레이션 추가 절차", 1~6번 순서 목록 직후 신규 삽입 지점 — diff 상 `outOfOrder` 절 다음, "PR open 후에는..." 블록쿼트 바로 앞)
  - 상세: §5 는 "1. rebase → 2. max V 확인 → ... → 6. PR 오픈" 순서의 **순차 절차**이고, 그 직후 원래 있던 블록쿼트("PR open 후에는 가능한 빠르게 리뷰·머지...")는 그 절차의 마무리 당부다. 이번 PR 이 추가한 "기존 인덱스를 교체하는 마이그레이션은 재실행 안전성 패턴이 따로 있다" 불릿은 순서 목록의 continuation 이 아니라 **별개 주제**(인덱스 교체 시의 특수 패턴 참조)인데, 정확히 그 절차 목록과 마무리 블록쿼트 "사이"에 끼어들어가 있다. 렌더링 자체는 깨지지 않는다(빈 줄로 분리돼 별도 불릿 목록으로 렌더링됨, 실측 확인) — 순수하게 **읽는 흐름**의 문제다. "6. PR 을 연다" 로 절차가 끝나자마자 곧바로 "PR 이후엔 빨리 머지하라" 는 당부가 나오는게 자연스러운데, 그 사이에 무관한 주제(인덱스 교체 패턴)가 끼어 절차 문서의 논리 흐름이 잠깐 끊긴다.
  - 제안: 급하지 않음(문서 성격상 INFO) — 이 불릿을 블록쿼트 뒤로 옮기거나, `### 5-1.`/불릿 소제목으로 명시적으로 분리해 "이건 특수 케이스 참고"임을 시각적으로 구분하면 절차 목록의 완결성이 더 또렷해진다.

## 확인 사실 (이전 라운드 조치의 재현 검증 — 회귀 없음)

- `plan/complete/spec-draft-migration-rerun-and-citations.md` 의 코드펜스: 백틱 3연속 펜스 8개(4쌍), 중첩 없이 균형 — `09_27_04` WARNING(중첩 펜스로 부록 B 렌더링 붕괴) → `09_42_13` 가 부록 전문 자체를 제거하는 방식으로 해소한 것을 직접 재확인.
- 같은 문서 §3(`아래 ③ 참조`, 103행)과 실제 헤딩 `## ③ 이 draft 가 등재하는 후속`(187행)이 일치 — `09_27_04` INFO(`§3` vs `③` 불일치) 해소 확인.
- `codebase/backend/migrations/README.md:127` 의 "그 패턴은 같은 절(§5) 아래 **인덱스 교체는 DROP-먼저** 에 있습니다" — `10_04_12` INFO(`§인덱스 교체` 라는 앵커 없는 이름 참조) 가 이 문구로 정정된 것 확인.
- `spec/conventions/review-citations.md` §3 표에 `spec/**` 행이 실제로 존재(`spec/** 문서 | 적용 | ...`) — `10_04_12` WARNING(§3 표가 spec/** 를 다루지 않음) 해소 확인. 같은 §3 에 `scripts/**`·`.github/**`·DTO/컨트롤러 JSDoc 행도 모두 존재 — `09_53_09` 라운드 W1/INFO#3 반영 확인.
- `spec/conventions/spec-impl-evidence.md:81` 의 `code:` 필드 정의에 "예외 — 시행 코드가 없는 순수 문서형 convention" 각주 + `review-citations.md` 로의 링크, 그리고 `review-citations.md` Rationale 쪽에서도 "이 예외는 `spec-impl-evidence.md` §2.1 `code:` 필드 정의에도 각주로 등재했다"는 역방향 링크 — `10_04_12` WARNING(`code:` 재해석이 SoT 문서에 반영 안 됨) 이 양방향으로 해소된 것 확인.
- `spec/data-flow/8-notifications.md:275-279` 에 V056 의 구 순서(CREATE→DROP)가 "V056 이 적용된 시점의 것" 이라는 caveat + README §5 로의 포인터가 실제로 존재 — `10_04_12` WARNING(같은 V056 을 캐비엇 없이 서술하는 spec 이 방치됨) 해소 확인.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 신규 두 후속 항목("Flyway mixed=true 도입 여부", "해소 불가 bare 인용 8건 채우기")이 `- [ ]` 체크박스 형식으로 등재돼 있음 — `09_13_39` INFO(§3 후속 항목이 산문 형식이라 체크박스 자가점검에서 누락 위험) 이 이번 신규 항목에는 처음부터 올바른 형식으로 반영됨.
- CHANGELOG.md 미갱신 — 이 저장소의 CHANGELOG 관례를 실측 확인한 결과(기존 항목 전수가 API/wire-format 변경 전용) 순수 프로세스 규약 문서 변경에는 CHANGELOG 항목이 요구되지 않는 패턴이라 결함 아님.

## 요약

이번 diff 는 애플리케이션 코드 변경이 없는 순수 문서/spec/plan PR 이며, 실질 변경은 마이그레이션 재실행 안전성 패턴(README §5 확장)과 리뷰 인용 규약(`review-citations.md` 신설) 두 건을 성문화하는 6개 파일에 집중된다. 같은 세션 안에서 이미 5라운드의 문서화 관련 리뷰(코드펜스 렌더링 붕괴, 부록 이중 관리, `code:` SoT 미동기화, V056 캐비엇 누락 등 WARNING 다수)가 진행되어 전부 조치·재현 확인됐고, 이번 라운드에서 회귀는 발견되지 않았다. 새로 찾은 것은 두 건의 저위험 INFO뿐이다 — README §5 "규칙" 요약 불릿이 설명 문단에 새로 추가된 `DO $$ ... $$` 예시를 반영하지 않은 것과, `migrations.md` 신규 참조 불릿이 §5 절차 목록과 마무리 당부 사이에 끼어 흐름을 끊는 것. 둘 다 렌더링·가드·빌드에 영향이 없는 가독성 수준의 문제로, CRITICAL/WARNING 급 발견은 없다.

## 위험도
LOW
