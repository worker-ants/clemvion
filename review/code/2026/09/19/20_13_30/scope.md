# 변경 범위(Scope) 리뷰 — 웹훅 경로 영구 예약 2라운드 (V133 후속 조치)

## 검토 방법

`git diff origin/main...HEAD --stat` 로 전체 56개 파일을 확인하고, 1라운드(`review/code/2026/09/19/19_44_33`) 이후 새로 추가된 커밋
`a4a4791a7`(test — 경합 e2e · CHANGELOG · 리뷰 INFO 반영)와 `116c72eb8`(docs — 1라운드 SUMMARY·RESOLUTION 커밋)을 `git show`로
직접 열어 diff 전문을 확인했다. 1라운드 스스로의 `scope.md`(위험도 NONE)가 이미 커버한 `codebase/**` 8개 파일·spec 5개·plan 1개는
그 판단을 재검증하지 않고, **1라운드 이후 신규로 생긴 변경**(CHANGELOG 갱신, 경합 e2e 신규, 리뷰 INFO 반영 diff, 1라운드 리뷰
산출물 자체의 커밋)에 집중했다.

## 발견사항

이번 증분(`a4a4791a7`, `116c72eb8`)에서 CRITICAL/WARNING 급 스코프 이탈은 찾지 못했다.

- **[INFO]** `webhook-trigger.e2e-spec.ts` 의 중복 헬퍼 통합이 diff 상 "이동"으로 보임(정상)
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts` — B5 절 구간에 정의돼 있던 `expectConflict`(원래 235~245행 부근)를
    삭제하고, B4 절 앞(약 181~194행)에 `expectPathConflict` 하나로 통합
  - 상세: 커밋 메시지("e2e 의 409 단언 헬퍼 둘(B5 · B7/B8)을 하나로")와 1라운드 `RESOLUTION.md` INFO5 항목("409 단언 헬퍼 중복 →
    `expectPathConflict` 하나로")에 정확히 대응하는 계획된 조치다. 리팩터링이지만 **이번 작업과 무관한 정리가 아니라, 직전
    라운드 리뷰가 지적한 항목을 해소하는 것**이라 범위 이탈로 보지 않는다.
  - 조치 불요 — 기록용.

- **[INFO]** 격리 수준 주석이 처음 쓴 문장을 실측으로 정정
  - 위치: `codebase/backend/migrations/V133__webhook_endpoint_reservation.sql` 의 `reserve_webhook_endpoint_path()` 함수 내
    `SELECT workspace_id INTO reserved_by` 위 주석 블록
  - 상세: 커밋 메시지에 "처음 쓴 «더 높은 격리 수준이면 SELECT 가 NULL 을 봐 거부» 는 틀렸고, REPEATABLE READ 에서는
    `ON CONFLICT` 가 40001 로 끝난다(실측)" 라고 명시돼 있다. `CLAUDE.md` §자기-반증형 소정정 절차를 SQL 마이그레이션 인라인
    주석에 (spec 문서가 아니라 코드 주석이므로 그 절차의 적용 대상은 아니지만) 유사한 정신으로 따른 정정으로 보이며, 이번
    PR 이 직접 쓴 문장을 이번 PR 안에서 실측으로 고친 것이라 범위 밖 변경이 아니다.
  - 조치 불요.

## 스코프 검증 결과 (문제 없음)

- **CHANGELOG.md**: 1라운드 리뷰 W1("사용자 영향 있는 보안성 변경인데 CHANGELOG 누락")을 정확히 해소하는 `## Unreleased` 항목
  추가 + 선행 V132 항목 "남는 창" 단락에 역참조 한 문장 추가. 기능과 무관한 다른 CHANGELOG 항목은 건드리지 않았다.
- **`webhook-endpoint-reservation.e2e-spec.ts` 신규 테스트**: 1라운드 W2("동시 경합 미검증")를 해소하는 단일 테스트 하나만
  추가됐고, 파일 헤더의 "이 파일은 V133 메커니즘만 본다" 스코프 고지에 맞춰 "예외는 두 연결의 경합 테스트 하나" 라고 스스로
  스코프 경계를 명시했다. 서비스/API 계층 테스트를 이 파일에 얹지 않고 메커니즘(DB 트리거·PK 경합) 검증에 국한했다.
- **`triggers.controller.ts`/migration 주석**: 문구 다듬기·경합 시나리오 설명 추가뿐 — 로직 변경 없음.
- **`review/code/2026/09/19/19_44_33/**` 13개 파일 신규 커밋(`116c72eb8`)**: 이 저장소 관례상 코드 리뷰 산출물은
  `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 에 커밋되며(`CLAUDE.md` 정보 저장 위치 표, `developer` SKILL §REVIEW WORKFLOW),
  이번 기능(V133)의 1라운드 검토·해소 이력을 기록하는 정규 산출물이다 — 별도 목적을 갖는 무관한 추가가 아니다.
- **plan 체크리스트(`c6d82a84e`)**: "구현" 항목 체크 + `/ai-review`·`--impl-done` 두 항목 신규 추가는 `plan-lifecycle.md` 가
  정한 정상적인 진행 갱신이며, 실제 구현 완료 사실(커밋 `406749289`, TEST WORKFLOW 통과 실측)과 일치한다.
- **임포트**: `webhook-endpoint-reservation.e2e-spec.ts` 에 추가된 `import crypto from 'node:crypto'` 는 새 테스트가 쓰는
  `crypto.randomUUID()` 에 대응 — 미사용 임포트 없음.
- **포맷팅/공백**: 이번 증분 diff 에서 공백 전용 변경 없음.
- **설정 변경**: 없음.
- **frontend/기타 무관 영역**: 이번 증분에서도 무변경.

## 요약

1라운드 이후 추가된 두 커밋(`a4a4791a7`, `116c72eb8`)은 모두 직전 `/ai-review` 라운드가 남긴 Warning 2건(CHANGELOG 누락·동시
경합 미검증)과 INFO 다수를 정확히 해소하는 조치이며, 새로 추가된 e2e 테스트·주석·CHANGELOG 항목·리뷰 산출물 커밋 어느 것도
V133 "웹훅 경로 영구 예약" 기능 및 그 리뷰 사이클과 무관한 영역을 건드리지 않았다. 1라운드 자체 `scope.md`(위험도 NONE)가
평가한 `codebase/**` 핵심 구현 8개 파일·spec 5개·plan 1개에 대한 판단도 이번 재검토에서 뒤집을 근거를 찾지 못했다. 불필요한
리팩토링·기능 확장·무관한 파일 수정·의미 없는 포맷팅·임포트 잡음·의도치 않은 설정 변경 모두 발견되지 않았다.

## 위험도

NONE
