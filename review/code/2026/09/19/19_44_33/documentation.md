# 문서화(Documentation) 리뷰 — 웹훅 경로 영구 예약 (V133)

## 발견사항

- **[WARNING]** 사용자 영향이 있는 보안성 동작 변경인데 `CHANGELOG.md` 항목이 없다
  - 위치: `CHANGELOG.md` (이번 diff 에 미포함 — 최근 수정 커밋은 무관한 `0a040b96c`)
  - 상세: 이 PR 은 바로 앞선 커밋 `e29b2bb51`(V131·V132, endpoint_path 전역 UNIQUE)이 `CHANGELOG.md`
    "다른 워크스페이스가 알고 있는 웹훅 경로를 등록하면 수신 웹훅을 가로챌 수 있었다" 항목의 **"남는 창"**
    단락에 명시적으로 남긴 갭("주인이 트리거를 지우면 그 경로는 비고, 경로를 아는 누구든 다시 등록할
    수 있다(묘비 부재 — 트래커 등재)")을 정확히 닫는 후속 변경이다. 그 선행 커밋도, 같은 영역의 다른
    최근 커밋(`0a040b96c` Database/HTTP 연결 테스트, `a9288bf6e` 트리거 자원 정리)도 전부 `## Unreleased`
    항목을 추가했는데, 이번 변경(V133)만 `CHANGELOG.md` 를 건드리지 않았다. 배포 뒤 동작이 실제로
    바뀐다 — 지우거나 바꾼 웹훅 경로를 그 워크스페이스가 아닌 누구도 다시 쓸 수 없게 되는 것은 운영자·
    타 워크스페이스 사용자에게 보일 수 있는 사용자 영향이며, 3라운드의 `--spec`/`--impl-prep` consistency
    check(5개 checker × 3세션) 는 모두 `spec/**` 만 대조 범위로 삼아 `CHANGELOG.md` 갱신 필요성은
    애초에 점검 대상이 아니었다 — 이 게이트를 통과했다고 해서 CHANGELOG 누락이 걸러진 것은 아니다.
  - 제안: 선행 항목과 같은 형식으로 `## Unreleased — 지우거나 바꾼 웹훅 경로를 다른 워크스페이스가
    다시 등록할 수 있었다` 절을 추가하고, "고친 것"(V133 예약 테이블·DB 트리거·409 매핑) · "배포 뒤 보일
    수 있는 것"(옛 경로 재사용 시도가 이제 409) 을 선행 항목의 톤에 맞춰 적을 것. 선행 항목의 "남는 창"
    단락에서 이 항목으로의 역참조("→ 이제 V133 이 닫음" 등)를 남기면 두 항목의 연속성도 드러난다.

- **[INFO]** 이미 커밋된 spec 본문이 아직 `plan/in-progress/` 에 있는 계획 파일의 `plan/complete/`
  경로를 인용한다 (선행 consistency check 에서 이미 포착·판정된 사항 — 참고용 재확인)
  - 위치: `spec/1-data-model.md` `## Rationale` «지운 · 바꾼 웹훅 경로의 영구 예약 (2026-09-19)» 마지막
    줄 "근거·실측: `plan/complete/spec-draft-webhook-endpoint-reservation.md`" (커밋 `47f946b94` 로 이미
    반영됨) · `codebase/backend/test/webhook-endpoint-reservation.e2e-spec.ts` 파일 헤더 JSDoc 의 동일 인용
  - 상세: 대상 파일은 현재 `plan/in-progress/spec-draft-webhook-endpoint-reservation.md` 에 있고
    `plan/complete/` 로는 아직 이동되지 않았다(체크리스트 마지막 항목 `[ ] 트래커 해소 · 이 draft
    plan/complete/ 로` 가 미체크). 즉 이 시점 기준으로 위 인용 경로는 실재하지 않는다. 다만 이는
    `review/consistency/2026/09/19/19_11_16/SUMMARY.md` INFO #4 · `plan_coherence.md` · `naming_collision.md`
    가 이미 "target 이 앞서고 plan 이동이 뒤따르는 `--impl-prep` 시점의 정상 순서" 로 판정해 둔 사안이라
    새로운 결함은 아니다.
  - 제안: 별도 조치 불요 — 이 draft 를 `plan/complete/` 로 옮기는 마무리 커밋에서 자동으로 해소된다.
    다만 그 이동이 이번 PR 의 같은 커밋/PR 안에서 이뤄지는지 마무리 시점에 한 번 더 확인할 것
    (`c6d82a84e` 체크리스트에 이미 `[ ]` 항목으로 남아 있음).

## 정합성이 확인된 항목 (참고 — 오탐 방지)

- **마이그레이션 SQL 헤더**(`V133__webhook_endpoint_reservation.sql`): spec 절 인용(§2.8.1·§3·Rationale)·
  설계 근거(왜 DB 트리거인지, 순서가 뜻을 가지는 이유, 기존 데이터의 한계)·수동 롤백(DOWN, 주석)까지
  모두 갖춘 모범적인 마이그레이션 문서. `spec/conventions/migrations.md` 관례와 정합.
- **`WebhookEndpointReservation` 엔티티**: 클래스·필드 JSDoc 이 소유권 모델·DB 트리거 강제·409 매핑을
  정확히 요약. `spec/1-data-model.md §2.8.1` 과 문구 수준까지 일치.
- **`triggers.service.ts`**: `TRIGGER_ENDPOINT_PATH_CONFLICT_NAMES`/`isEndpointPathUniqueViolation`/
  `rethrowEndpointPathConflict` 의 JSDoc 이 두 제약 이름의 성격 차이(실재 인덱스 vs 트리거가 붙이는 라벨),
  BEFORE 트리거 우선순위, "이름이 바뀌면 조용히 좁아진다" 는 실패 모드까지 정확히 서술 — 코드와 주석이
  정확히 일치한다(직전 consistency WARNING #1 이 지적한 predicate 확장이 구현·문서 양쪽에 반영됨).
  `pg-error.ts` 의 `pgErrorConstraint()` 동작(driver 두 표면 흡수)과도 실제로 부합한다(직접 대조 확인).
- **`triggers.controller.ts`**: Swagger 설명 상수 갱신이 `spec/5-system/3-error-handling.md` §1.10 문구와
  일치, "SoT 한 곳" 주석도 최신 상태.
- **e2e 신설 파일**(`webhook-endpoint-reservation.e2e-spec.ts`): "왜 따로 무는가" · "어떻게" · "이 파일이
  보지 않는 것"(서비스/API 시나리오는 `webhook-trigger` B7~B9 소관)을 파일 헤더에 명시 — 스코프 경계가
  분명해 다음 편집자가 중복 커버리지를 오인할 우려가 낮다.
- **spec 5개 파일**(`1-data-model.md`·`12-webhook.md`·`2-trigger-list.md`·`3-error-handling.md`·
  `data-flow/10-triggers.md`) 갱신 문구가 서로 단어 단위로 정합 — 3라운드 consistency check(2026-09-19
  18:56/19:11/19:21) 가 이미 CRITICAL 0·WARNING 0(최종)으로 수렴시킨 상태를 재확인.
- **README**: `codebase/backend/README.md` 는 애초에 라우트·엔티티 단위 상세를 다루지 않는 성격이라
  (spec/ 가 단일 진실) 갱신 불필요.
- UI 고지(삭제 확인 다이얼로그·경로 변경 경고에 "다른 워크스페이스 재사용 불가" 문구 추가 여부)는
  planner 가 명시적으로 "더하지 않기로" Rationale 에 근거를 남긴 결정이며, 이미 `--spec`/`--impl-prep`
  두 라운드 모두 INFO 수준으로 검토·수용됨 — 재지적하지 않음.

## 요약

migration SQL·엔티티·서비스·컨트롤러·e2e·spec 5개 파일 전반의 인라인 문서·JSDoc·spec 상호 참조는
매우 높은 수준으로 정확하고 서로 일치한다(코드 주석이 실제 동작·SoT 위치·실패 모드까지 정확히 서술).
유일하게 비어 있는 축은 `CHANGELOG.md` 다 — 이 변경이 닫는 선행 갭("남는 창")이 그 파일에 명시적으로
기록돼 있었고, 같은 시기 인접 커밋들도 예외 없이 `## Unreleased` 항목을 추가하는 관행을 지켰는데
이번 변경만 빠졌다. 이는 5라운드 consistency check 어디서도 점검 대상이 아니었던(스코프가 `spec/**`
로 한정됨) 영역이라 이 리뷰에서 처음 드러난 갭이다. 그 외 하나(plan 경로 선인용)는 이미 다른 checker 가
포착·판정을 마친 정상적인 시퀀싱 이슈로, 마무리 단계에서 자연 해소된다.

## 위험도

LOW
