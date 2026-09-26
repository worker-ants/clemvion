# 문서화(Documentation) 리뷰 — rotate-bot-token-body (2R)

## 개요

이 라운드는 1R(`review/code/2026/09/26/17_55_14`) 이후 추가된 커밋(`ecaed6534` 스타일 수정,
`e3fd2b674` plan 갱신, `fafc6b8ac` `bodyParamDesignType` 에러 경로 테스트, `7d03bdfb1` 1R 리뷰
산출물 커밋)까지 포함한 전체 diff(`origin/main..HEAD`, 32 파일)를 다시 본 것이다. 실제 제품
문서화 대상은 파일 1~11(CHANGELOG, 신규 DTO 2개·컨트롤러 3개·캐너리 spec 3개·`swagger-probe`
헬퍼+spec)이고, 나머지(12~32)는 plan 과 이전 리뷰/consistency 산출물이다.

## 발견사항

- **[INFO]** 이 PR 이 "닫는다"고 선언한 상위 트래커 항목이 이 라운드 시점에도 여전히 미체크
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:2459`(직접 확인한 실제 줄
    번호, `- [ ]`) · `plan/in-progress/rotate-bot-token-body.md` `## 체크리스트` 마지막 줄
    (`- [ ] 트래커 항목 닫기 · 전역 가드 후속 등재`)
  - 상세: 1R 에서 documentation reviewer 가 낸 WARNING(트래커 항목 stale·낡은 처방 문구)에 대해
    `review/code/2026/09/26/17_55_14/RESOLUTION.md` 는 "마무리 커밋에서 닫는다"고 명시적으로
    처분했다. 실제로 `rotate-bot-token-body.md` 체크리스트는 `/ai-review`·`--impl-done`·
    `트래커 항목 닫기` 세 항목을 전부 `[ ]` 로 정직하게 남겨 두고 있어(허위 완료 주장 없음),
    이는 프로젝트 관례상 정상적인 미종결 상태(리뷰 통과 → `--impl-done` → 마무리 커밋 순서)이지
    새로 발견된 결함이 아니다. 다만 다음 세션이 이 항목을 잊지 않도록 재확인 차원에서 기록한다.
  - 제안: 조치 불필요(이미 계획됨) — `--impl-done` 이전, 마무리 커밋에서
    `spec-draft-nullable-notation-followups.md:2459` 를 `[x]` 로 체크하고 처방 문구를 실채택안
    ("문서 전용 DTO + `@ApiBody`, 파라미터는 인라인 유지 — 전역 파이프 계약 변경 회피")으로
    정정할 것. `rotate-bot-token-body.md` 체크리스트의 해당 줄도 함께 체크.

- **[INFO]** `*RequestDto` 명명 관례가 `swagger.md` §1-7 에 아직 규약화되지 않음 — 기존에 알려진
  갭, 재확인만
  - 위치: `spec/conventions/swagger.md` §1-7
  - 상세: 신규 `ChatChannelRotateBotTokenRequestDto`/`ContinueExecutionRequestDto` 는 저장소
    기존 관례(`ReRunRequestDto` 등)와 일치하지만 §1-7 표에는 명문화돼 있지 않다. plan 의
    "안 하는 것" 절과 1R 문서화 리뷰가 이미 지적했고, 위 트래커 정정과 함께 등재하기로 계획돼
    있다.
  - 제안: 별도 조치 불필요 — 위 INFO 의 트래커 정정 작업에 묶여 있음.

## 참고 (양호한 점 — 1R 이후 신규 변경분)

- `fafc6b8ac` 가 `bodyParamDesignType` 의 두 방어적 에러 분기(`@Body()` 부재, 둘 이상,
  `design:paramtypes` 부재)에 대해 `swagger-probe.spec.ts` 에 전용 테스트 4건을 추가했고,
  `swagger-probe.ts` 의 JSDoc도 "`@Body()` 가 없거나 둘 이상이면 던진다"로 정확히 갱신되어
  구현·주석·테스트가 서로 일치한다(1R WARNING #1 해소, 재검증 완료).
  `codebase/backend/src/shared/testing/swagger-probe.ts` 의 `bodyParamDesignType` 함수 JSDoc,
  `codebase/backend/src/shared/testing/swagger-probe.spec.ts` `describe('bodyParamDesignType — 에러 경로', …)`.
- `ecaed6534`(스타일: `controller.prototype as object`)는 런타임·문서 영향 없는 타입 좁히기이며
  커밋 메시지가 "동작 불변"임을 명시해 정확하다.
- CHANGELOG 엔트리("OpenAPI 가 3개 엔드포인트의 요청 본문 스키마를 광고한다")는
  `CHANGELOG.md` 상단 기준 1항(OpenAPI 로 광고하는 계약의 변화)에 정확히 해당하고, 세 라우트의
  필수/선택·에러코드 서술이 실제 DTO/컨트롤러 코드·spec(`15-chat-channel.md` §5.4,
  `12-webhook.md` WH-EP-04/05)과 직접 대조해 일치함을 확인했다. `fafc6b8ac`·`ecaed6534`(테스트
  전용·스타일 변경)는 CHANGELOG 기준상 항목을 만들지 않는 변경이며 실제로도 추가되지 않아
  정합적이다.
  참조 로그: `_test_logs/{lint,unit,build,e2e}-20260926-*.log` — `RESOLUTION.md` 가 인용한
  네 로그 파일 모두 실제로 존재함을 확인했다(허위 근거 아님).
- README(`codebase/backend/README.md`)는 개별 엔드포인트 목록을 다루지 않아 이번 변경으로 인한
  갱신 필요성 없음을 확인했다.

## 요약

1R 대비 이번 라운드의 신규 변경분(에러 경로 테스트 보강·스타일 수정·1R 리뷰 산출물 커밋)은
문서화 관점에서 결함이 없다 — 앞서 지적된 WARNING(헬퍼 에러 분기 무테스트)이 코드·JSDoc·테스트
삼자 일치로 정확히 해소됐다. 유일하게 남은 항목은 상위 트래커 항목 미종결인데, 이는 프로젝트가
명시적으로 계획한 "리뷰 통과 → `--impl-done` → 마무리 커밋" 순서상 아직 그 단계에 도달하지
않았을 뿐이며 plan 이 스스로 미완료로 정직하게 표시하고 있어 새로운 결함으로 보지 않는다(INFO,
비차단). CRITICAL/WARNING 급 신규 발견사항 없음.

## 위험도

LOW
