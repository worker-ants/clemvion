# 변경 범위(Scope) 리뷰 — `trigger-save-partial-patch`

## 범위 요약

이번 branch diff(`origin/main...HEAD`, 30개 파일)의 핵심은 단 하나 — `TriggersService.update()`
(창 1)가 락 안 재읽기 뒤 **엔티티 통째 `save`** 하던 것을 **이 요청이 바꾸는 필드만 담은 부분 객체
`save`** 로 좁혀, 락 밖에서 커밋된 컬럼(`notification_secret_v2`·`last_triggered_at`·
`chat_channel_token_v2`·schedule 동기화 `name`/`is_active`)이 옛 값으로 되써지는 lost-update 를
막는 것이다. 나머지 파일은 전부 이 한 가지 변경을 지지하는 테스트/문서/기록물로, 각각의 존재 이유가
plan(`plan/in-progress/trigger-save-partial-patch.md`)과 CHANGELOG 에 명시돼 있다.

- `codebase/backend/src/modules/triggers/triggers.service.ts` — 저장 payload 를 `defined`+`config`
  부분 객체로 좁히고, 응답은 `save` 반환값에서 `updatedAt` 하나만 취하도록 수정(핵심 diff, 실질 코드
  변경은 약 8줄).
- `codebase/backend/src/modules/triggers/triggers.service.spec.ts` — 위 변경에 대응하는 단위 테스트
  갱신(저장 키 집합 단언 + `save` 반환값 `null` 회귀 테스트 신규).
- `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts` — 창 1 이
  `save` 반환값(`updatedAt`)을 읽게 되면서 mock `save` 를 `async`+반환값 폴백으로 맞추고, 뮤턴트
  재측정치(53→60)를 갱신. 코드 변경(async화)과 직접 인과관계가 있다.
- `codebase/backend/test/trigger-update-save-window.e2e-spec.ts` — 신규 e2e, 부분 객체 `save` 가
  필요한 이유(락 밖 컬럼 보존)와 PR 안에서 낸 자체 회귀(반환값 null 오염)를 실제 Postgres 로 고정.
- `codebase/backend/jest.config.ts` — 새 e2e 파일이 `pg` Client 외 TypeORM `DataSource` 도 여는
  예외 사실 하나만 기존 주석에 추가(4줄).
- `CHANGELOG.md`, `plan/in-progress/trigger-save-partial-patch.md` — 이 수정의 배경·실측·1라운드
  리뷰 처분 기록. 프로젝트 관례(작업 완료 시 CHANGELOG/plan 갱신) 그대로.
- `review/code/2026/09/17/13_44_39/*`, `review/consistency/2026/09/17/13_04_39/*` — 이전
  `/ai-review`·`/consistency-check --impl-prep` 세션의 산출물. 프로젝트 컨벤션(`CLAUDE.md` "코드
  리뷰 산출물"·"일관성 검토 산출물" 저장 위치, `feedback_review_fix_stale_loop.md` "코드 커밋 →
  리뷰 세션 → SUMMARY → 리뷰-only 커밋" 순서)상 리뷰 라운드가 진행되면 이전 라운드 산출물이 같은
  브랜치 diff 안에 함께 커밋되는 것이 정상 워크플로다 — 이번 작업이 별도로 만든 부가 산출물이
  아니라 표준 절차의 흔적이다.

`git diff --stat origin/main...HEAD` 로 확인한 30개 파일 전체가 위 목록에 정확히 대응하며, 위 목적과
무관한 파일(frontend, 다른 backend 모듈, 의존성 버전, 무관한 설정)은 없다.

## 발견사항

- **[INFO]** `update()` 메서드가 이번 PR 로 다시 커진다 (주석 위주)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()` 저장/응답 블록
    (diff 게이트 680~717행)
  - 상세: 이번 hunk 의 실질 코드 변경은 약 8줄(`const patch`, `m.save` 호출, `Object.assign`,
    `if (written.updatedAt) …`)인데 반해 그 근거를 설명하는 주석은 30줄 넘게 추가됐다. 스코프
    일탈은 아니다 — 추가된 주석 전부가 "왜 `save` 인가"·"왜 부분 객체인가"·"왜 반환값 통째를 안
    쓰는가"라는, 이번 수정 자체의 설계 근거이지 무관한 서술이 아니다. 다만 결과적으로 단일 메서드가
    더 비대해지는 것은 사실이며, 이는 1라운드 리뷰(`review/code/2026/09/17/13_44_39/SUMMARY.md`
    INFO#6)에서 이미 지적되고 "이번 PR 스코프 밖"으로 명시적으로 defer 된 항목이다 — 이번 2라운드
    diff 에서 새로 생긴 스코프 문제가 아니라 기존에 처분된 항목의 재확인.
  - 제안: 조치 불요(이미 트래킹됨). 재-flag 방지를 위해 기록만 남김.

다른 관점(불필요한 리팩토링·기능 확장·무관한 파일 수정·포맷팅 혼입·주석 drive-by·임포트 정리·설정
변경)에서는 위반 사례를 찾지 못했다. `trigger-transaction-mock.ts` 의 async 화, `jest.config.ts`
주석 추가, mock 재측정 수치 갱신 모두 핵심 코드 변경에 직접 종속된 필연적 부수 변경이며, 독립적인
"정리성" 편집이 아니다.

## 요약

30개 변경 파일 전원이 "창 1 `save` 를 부분 객체로 좁힌다"는 단일 목적과 그 목적을 검증·기록하는
테스트/문서/리뷰 산출물로 수렴한다. 요청 범위를 벗어난 리팩토링, 기능 확장, 무관한 파일 수정,
포맷팅 혼입, 불필요한 임포트/설정 변경은 발견되지 않았다. 유일한 INFO 는 메서드 비대화(주석
위주)이며 이미 이전 라운드에서 식별·defer 처리된 항목의 재확인일 뿐이다.

## 위험도
NONE
