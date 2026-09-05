# Rationale 연속성 검토 — `migrations.md` / `review-citations.md` / `spec-impl-evidence.md` / `data-flow/8-notifications.md`

## 검토 방법

이번 라운드의 실 델타는 직전 라운드(`review/consistency/2026/09/05/10_04_12`)가 cross_spec 에서
낸 WARNING 2건 + INFO 2건을 조치한 커밋 `0509dff6a`(및 그 직전 `1b6ce5f8a`)다. 다음을 대조했다.

- `codebase/backend/migrations/README.md` 신설 "인덱스 교체는 DROP-먼저" 3-statement 패턴 —
  실제 마이그레이션 파일 `V056__notification_active_partial_index.sql`,
  `V106__schedule_trigger_id_index.sql`, `V110__schedule_workspace_next_run_index.sql` 을 직접
  열어 README 표의 서술(V056=CREATE→DROP 진짜 교체, V106=CREATE 만·신규 추가, V110=DROP-먼저
  선례)과 line-level 대조.
- `spec/conventions/migrations.md` §3 Append-only·§4 `outOfOrder=false`·§6 다층 안전망·§7 폐기
  대안(타임스탬프 prefix / `outOfOrder=true` / Merge Queue / branch protection) — 신설 포인터
  문단·README 패턴이 이 원칙들을 우회하거나 뒤집는지.
- `spec/data-flow/8-notifications.md` Rationale "Hard delete 가 아닌 soft delete" 문단에 새로
  붙은 캐비엇("위 2문장 순서는 V056 시점의 것") — 실제 V056 파일 주석의 순서(1) CREATE, 2)
  DROP)와 캐비엇 주장이 일치하는지, append-only 원칙("V056 자신은 소급 수정 대상 아님")과
  충돌하는지.
- `spec/conventions/spec-impl-evidence.md` §2.1 `code:` 정의에 신설된 "시행 코드 없는 순수
  문서형 convention" 예외 각주 — R-1(`code:` 글로브 허용 원칙)·Overview("spec 약속 surface 가
  지금 구현됐는가"의 핵심 invariant)와 충돌하는지, `review-citations.md` 쪽 선행 Rationale과
  내용이 정합한지(상호 링크 여부 포함).
- `spec/conventions/review-citations.md` §3 신설 `spec/**` 행 + Rationale 각주 — 같은 문서
  §3 의 기존 원칙("맥락 없이 읽히는 자리" 판별 기준)과의 정합, `swagger.md` §3 과의 방향 일치
  (직전 라운드가 이미 확인한 것의 회귀 여부).
- `git log --follow -p -- codebase/backend/migrations/README.md` 전체 이력 — "DROP-먼저" 패턴이
  과거 어느 커밋에서든 명시적으로 기각된 대안이었는지 확인(선례 없음 확인, 재도입 아님).
- 직전 3개 연속 라운드(`09_13_39`, `09_53_09`, `10_04_12`)의 `rationale_continuity.md` — 전부
  "발견 없음"이었고, 그 사이 지적된 것은 rationale_continuity 가 아니라 cross_spec 의 WARNING
  이었음을 확인(권한·관점 중복 없음).

## 발견사항

(없음 — CRITICAL/WARNING/INFO 모두 신규 발견 없음)

## 확인했으나 문제 없음으로 판정한 항목

- **README "DROP-먼저" 3-statement 패턴과 §4(hang 해결) 의 관계**: 재확인 결과 §4 는
  `FLYWAY_POSTGRESQL_TRANSACTIONAL_LOCK=false` 로 "두 번째 `CONCURRENTLY` statement 부터
  hang" 문제를 해결한 것이고, 신설 패턴은 별개 실패 모드(`CREATE` 실패 후 재실행 시 invalid
  잔재로 인덱스 0개화)를 다룬다. 두 Rationale 이 서로 다른 실패 모드를 다루므로 §4 를 뒤집지
  않는다 — 이 판정은 직전 라운드(`10_04_12`)가 이미 내렸고 이번 커밋은 그 판정 대상 문단을
  건드리지 않았다(cross-reference 앵커 문구만 정정).
- **V056/V106/V110 서술의 실물 대조**: `V056` 주석은 실제로 "순서: 1) CREATE 새 인덱스
  CONCURRENTLY 2) DROP 옛 인덱스 CONCURRENTLY" 로 DROP-먼저가 아니다. `data-flow/8-notifications.md`
  에 새로 붙은 캐비엇("위 2문장 순서는 V056 시점의 것")이 정확히 이 사실을 가리키므로 지어낸
  모순이 아니라 실제 모순을 드러내고 캐비엇으로 봉합한 것 — CLAUDE.md 원칙("과거 결정을
  뒤집으면서 새 Rationale 를 함께 작성")을 오히려 충족한다. `V110` 파일도 README 표·본문이
  주장하는 "DROP-먼저 선례"와 실제 DROP→CREATE→DROP 3문장이 일치.
- **append-only 원칙과의 관계**: README·`data-flow/8-notifications.md` 모두 "V056 자신은
  append-only 라 소급 수정 대상이 아니다"를 명시하고, 실제로 V056/V106 `.sql` 파일은 이번
  diff 에서 건드리지 않았다(git diff 확인) — `migrations.md` §3 Append-only 원칙을 우회하지
  않는다.
- **`spec-impl-evidence.md` 신설 예외와 R-1/Overview invariant 의 관계**: 신설 각주는 "강제하는
  가드가 없어 '구현 경로' 개념이 성립하지 않는 경우"에 한정된 예외이고, 그 경우에도 "준수
  예시 파일"을 요구해 완전한 면제(빈 `code:`)는 허용하지 않는다 — Overview 의 핵심 invariant
  ("spec 약속 surface 가 지금 구현됐는가")가 애초에 적용 대상이 아닌 문서형 convention 에
  한정된 좁은 예외라 invariant 우회로 보지 않는다. `review-citations.md` Rationale
  (`### code: 가 "구현 경로" 가 아니라 "준수 예시" 를 가리키는 이유`)과 문구·논리가 일치하고
  이번 커밋이 양방향 링크(`spec-impl-evidence.md → review-citations.md`, 기존
  `review-citations.md → spec-impl-evidence.md` 각주)를 완성했다 — 직전 라운드 cross_spec
  WARNING#1 이 요구한 조치와 정확히 일치.
- **`review-citations.md` §3 `spec/**` 행 신설과 §3 기존 판별 기준의 정합**: "맥락 없이 읽히는
  자리"(§3 표 서두 기준)에 `spec/**` 도 해당한다는 근거("살아 있는 문서라 오래 읽힌다")가
  `codebase/**` 행의 근거와 동일 논리 — 새 원칙을 만들지 않고 기존 판별 기준을 그대로 적용한
  것.
- **README 내부 cross-reference 표기 정정**(`§인덱스 교체` → `같은 절(§5) 아래 인덱스 교체는
  DROP-먼저`): 직전 라운드 INFO#2(가짜 앵커 지적)를 그대로 반영 — 텍스트만 정정, 패턴 자체나
  Rationale 근거는 변경 없음.
- **역사 대조**: `git log --follow -p -- codebase/backend/migrations/README.md` 전체 이력에서
  "DROP-먼저"·"invalid 인덱스 재활용" 류 패턴이 과거에 검토되어 명시적으로 기각된 흔적 없음
  (V022/V030 split, V058 단일-statement Rationale 등 과거 항목은 모두 "한 파일 한 CONCURRENTLY"
  범위이지 재실행 안전성 이슈가 아니다) — 기각된 대안의 재도입이 아니라 신규 결정.
- **`mixed=true` 도입 여부를 별도 결정 항목으로 미룬 것**: 이번 커밋에서도 그대로 유지 —
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커 등재 상태에 변화 없음
  (diff 에 해당 파일 없음). "한 PR 이 단독으로 정하지 않는다"는 직전 라운드 판정을 그대로 승계.

## 요약

이번 라운드의 실 변경분(커밋 `0509dff6a`)은 직전 라운드에서 rationale_continuity 가 아닌
cross_spec 이 지적한 두 문서 간 상호 링크 미비를 조치한 것으로, `migrations.md` 의
append-only·다층 안전망 원칙, `spec-impl-evidence.md` 의 `code:` invariant, `data-flow/8-notifications.md`
의 soft-delete Rationale 어느 것도 뒤집거나 우회하지 않는다. 신설된 두 캐비엇/각주는 모두
실제 마이그레이션 파일(V056/V106/V110)과 line-level 로 대조해 정확함을 확인했고, 과거 커밋
이력에서 "DROP-먼저" 패턴이 이전에 기각된 흔적도 없다. 연속 4개 라운드째(`09_13_39` → `09_53_09`
→ `10_04_12` → 본 라운드) Rationale 연속성 관점의 신규 발견이 없다.

## 위험도

NONE
