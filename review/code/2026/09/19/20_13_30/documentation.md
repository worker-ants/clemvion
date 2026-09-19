# 문서화(Documentation) 리뷰 — 웹훅 경로 영구 예약 (V133), 2라운드

## 검토 방법

이번 라운드(`20_13_30`)는 직전 라운드(`19_44_33`)가 이미 상세히 문서화 관점을 검토한 뒤, 그 SUMMARY(Critical 0 · Warning 2 ·
INFO 13)에 대한 조치 커밋 `a4a4791a7`(W1 CHANGELOG · W2 경합 e2e · INFO 6건 반영)·`c6d82a84e`(plan 체크박스)·`116c72eb8`
(1라운드 SUMMARY/RESOLUTION 커밋)까지 포함한 전체 diff(`origin/main...HEAD`)를 대상으로 한다. 직전 라운드에서 이미
문서화 관점으로 정밀 검토된 부분(마이그레이션 헤더·엔티티 JSDoc·서비스 JSDoc·spec 5개 파일 상호 참조 등)은 재검토하되,
실제 변경분(`a4a4791a7`·`c6d82a84e`)에 집중해 신규로 도입된 문서 갭이 있는지 확인했다. `git show`로 각 커밋의 실제 diff를
직접 열어 대조했고, 저장소 파일은 수정하지 않았다(`git status --short` 로 확인 — 이 세션에서 변경 없음).

## 발견사항

이번 라운드에서 신규로 발견된 CRITICAL·WARNING 급 문서화 결함은 없다.

- **[INFO]** 직전 라운드 WARNING(W1: CHANGELOG 누락)이 이번 diff에서 정확히 해소됨 (긍정 확인)
  - 위치: `CHANGELOG.md` (게이트 1~22, `## Unreleased — 지우거나 바꾼 웹훅 경로를 다른 워크스페이스가 다시 등록할 수
    있었다`), 그리고 아래쪽 기존 V132 항목의 「남는 창」 단락에 추가된 역참조(게이트 69, "위 «지우거나 바꾼 웹훅 경로를…»
    항목이 닫았다")
  - 상세: 새 항목이 선행 V131/V132 CHANGELOG 항목과 동일한 형식(문제 → 고친 것 → 배포 뒤 보일 수 있는 것)을 따르고,
    실제 구현(V133 예약 테이블·409 매핑·메시지 변경)과 문구가 정확히 일치한다("메시지는 «쓸 수 없는 경로» 로 바꿨다" ↔
    `triggers.service.ts`의 실제 문자열 "그 엔드포인트 경로는 쓸 수 없어요" — grep 대조 확인, 옛 문구 "이미 다른 트리거가
    쓰고 있다" 는 코드베이스 어디에도 잔존하지 않음). 선행 항목에서 이 항목으로의 역참조도 추가돼 두 항목의 연속성이
    드러난다. 조치 불요 — 기록 목적.

- **[INFO]** 직전 라운드 INFO#4(격리 수준 전제)가 "실측으로 반증 → 정정"의 모범 사례로 반영됨 (긍정 확인)
  - 위치: `codebase/backend/migrations/V133__webhook_endpoint_reservation.sql:43-46` (게이트 번호는 diff 기준, 함수 본문
    `SELECT workspace_id INTO reserved_by` 바로 위 주석)
  - 상세: RESOLUTION.md(INFO 4)가 스스로 밝히듯 "처음 쓴 문장(«더 높은 격리 수준이면 SELECT 가 NULL 을 봐 거부»)은 실측이
    반증"했고, 정정문("REPEATABLE READ 이상이면 위 INSERT 가 직렬화 실패(40001)로 끝난다(실측) — 쓰기는 막히지만 409 가
    아니다")이 실측을 명시하며 함께 실렸다. 신규 경합 e2e(`webhook-endpoint-reservation.e2e-spec.ts`, `a4a4791a7`)가 이
    READ COMMITTED 전제를 실제로 검증한다(주석 자체가 검증 가능한 형태로 남음). 조치 불요 — 모범 사례로 기록.

- **[INFO]** `database.md` INFO#2(합성 제약 이름이 실재 오브젝트가 아니라는 사실을 트리거 함수 자체에도 명시)가 반영됨
  (긍정 확인)
  - 위치: `codebase/backend/migrations/V133__webhook_endpoint_reservation.sql:51` (`IF reserved_by IS DISTINCT FROM
    NEW.workspace_id THEN` 바로 위 신규 주석 "CONSTRAINT 는 실재 제약의 이름이 아니라 라벨이다…")
  - 상세: 이전에는 서비스 계층(`triggers.service.ts`) JSDoc에만 있던 설명이 이제 발생 지점인 트리거 함수 자체에도
    한 줄로 남아, `\d webhook_endpoint_reservation` 등으로 실제 제약을 조회하는 운영자가 혼동할 여지를 줄인다. 조치 불요.

- **[INFO]** `testing.md` INFO#1(같은 파일 내 `expectConflict`/`expectPathConflict` 중복 헬퍼)이 통합됨 (긍정 확인)
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts` — B5 직전에 있던 로컬 `expectConflict`와 B7 직전의
    `expectPathConflict`가 파일 스코프 `expectPathConflict` 하나로 합쳐지고 JSDoc(게이트 179~183 부근)이 "B5 도 · B7·B8 도
    같아야 한다"는 취지로 갱신됨.
  - 상세: 응답 계약이 나중에 바뀔 때 두 곳 중 한 곳만 고치는 드리프트 위험이 사라졌다. JSDoc도 실제 사용 범위(B4~B8 전체)를
    정확히 반영한다. 조치 불요.

- **[INFO]** `maintainability.md` INFO(Swagger 설명 문자열의 서술어 비대칭)가 다듬어짐 (긍정 확인)
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:51`
  - 상세: "...트리거가 이미 존재하거나(...), 다른 워크스페이스가 예약한 경로(...)."(명사구로 끝남) → "...트리거가 이미
    있거나(...), 그 경로를 다른 워크스페이스가 예약했다(...)."(양쪽 절 모두 서술어로 종결)로 교체돼 문장 구조가
    대칭을 이룬다. 조치 불요.

- **[INFO]** 신규 경합 e2e 테스트의 JSDoc이 "왜 이 테스트가 필요한가"와 "인터리빙 지점을 어떻게 확정하는가"를 정확히 서술
  (긍정 확인, 신규 코드 대상)
  - 위치: `codebase/backend/test/webhook-endpoint-reservation.e2e-spec.ts` (파일 끝에 추가된
    `it('동시에 처음 잡는 같은 경로 — ...')` 직전 JSDoc)
  - 상세: "«하나만 성공» 은 전역 UNIQUE 만으로도 참이라 예약을 가르지 못해 이 둘을 본다"는 설명이 실제 두 단언
    (`constraint: OWNER_LABEL` / 롤백 시 예약 주인이 바뀜)과 정확히 대응하고, "인터리빙 지점은 «기다리는 쪽이 실제로 잠금
    대기 중»"이라는 대목이 `pg_stat_activity` 폴링 코드와 line-level로 일치한다. 파일 헤더 JSDoc에도 "예외는 두 연결의
    경합 테스트 하나다 — ... 공유 e2e DB의 `public`을 건드린다"는 문구가 추가돼, 이 파일의 나머지 테스트(임시 스키마 격리)와
    다른 격리 전략을 쓰는 이유를 미리 알려준다. 조치 불요 — 기록 목적.

- **[INFO]** (직전 라운드에서 이미 포착된 사안, 재확인만) `plan/in-progress/spec-draft-webhook-endpoint-reservation.md`가
  아직 `plan/complete/` 로 이동하지 않은 채 spec 본문·e2e 헤더가 그 최종 경로를 선인용
  - 위치: `plan/in-progress/spec-draft-webhook-endpoint-reservation.md:171-176` (체크리스트 마지막 세 항목 `/ai-review`·
    `--impl-done`·`트래커 해소 · plan/complete/ 로` 가 아직 `[ ]`)
  - 상세: 직전 라운드 documentation.md INFO와 동일한 사안이며 새로 진행되지 않았다 — 이번 라운드가 그 첫 항목
    (`/ai-review`)을 채우는 단계이므로 정상적인 순서다. 새로운 결함이 아니다.
  - 제안: 조치 불요 — 마무리 커밋(트래커 해소 + `plan/complete/` 이동)에서 자연 해소.

## 정합성이 확인된 항목 (참고 — 오탐 방지)

- CHANGELOG 새 항목의 문구("메시지는 «쓸 수 없는 경로» 로 바꿨다")와 실제 서비스 메시지 문자열이 grep 기준 정확히 일치.
- 옛 에러 메시지("이미 다른 트리거가 쓰고 있다")는 코드베이스 전역에서 잔존 참조 0건(clean replace).
- `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX`(옛 단일 상수명)에 대한 참조는 `plan/complete/**`·`review/code/2026/09/19/01_04_31/**`
  등 과거 이력 문서에만 남아 있고, 현재 코드베이스(`codebase/**`)나 최신 spec 본문에는 잔존하지 않음 — 오래된 주석 아님.
- 마이그레이션 헤더·엔티티 JSDoc·서비스 JSDoc·spec 5개 파일 간 상호 참조는 직전 라운드(`19_44_33/documentation.md`)가
  이미 "매우 높은 수준으로 정확" 하다고 판정했고, 이번 라운드의 추가 변경분(`a4a4791a7`)도 같은 수준을 유지한다 — 재검토
  결과 새로운 불일치 없음.

## 요약

이번 라운드는 직전 문서화 리뷰(`19_44_33`)가 지적한 유일한 WARNING(CHANGELOG 누락)과 INFO 다수(격리 수준 전제 정정,
합성 제약 이름 명시, 중복 테스트 헬퍼 통합, Swagger 문장 다듬기)를 정확하고 빠짐없이 반영했다. 특히 격리 수준 관련
주석은 "처음 쓴 문장이 실측으로 반증됐다"는 사실을 숨기지 않고 정정문에 그대로 남긴 점, 신규 경합 e2e의 JSDoc이 인터리빙
지점과 두 단언의 근거를 코드와 line-level로 대응시킨 점이 눈에 띈다. 새로 도입된 CRITICAL·WARNING 급 문서화 결함은
없으며, 남은 유일한 항목(plan draft의 `plan/complete/` 선인용)은 이미 알려진 정상 시퀀싱 이슈로 마무리 커밋에서
자연 해소된다.

## 위험도

NONE
