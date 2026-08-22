### 발견사항

없음 — CRITICAL/WARNING/INFO 급 cross-spec 충돌을 발견하지 못했다.

검토 근거(수행한 확인):

- **변경 범위 식별**: `spec/5-system/3-error-handling.md` §1.3 카탈로그의 Manual re-run
  경로 `error.code` 를 `INVALID_INPUT` → `INVALID_TRIGGER_PARAMETERS` 로 통일(rename).
  동반 편집: `spec/4-nodes/7-trigger/1-manual-trigger.md`(§6 경로별 코드 표) ·
  `spec/5-system/13-replay-rerun.md`(§8.1 정의 SoT) · `spec/5-system/12-webhook.md`(§5.2
  구현 노트) · `spec/5-system/14-external-interaction-api.md`(§R17 wrapper 서술) ·
  `spec/conventions/error-codes.md`(§4.1/§4.2 분리 신설 + §5 Rename 이력 신규 행).
- **요구사항 ID(에러 코드) 충돌 검사**: 전체 `spec/**` + `codebase/backend/src` +
  `codebase/frontend/src` + `codebase/channel-web-chat` 를 `INVALID_INPUT` 으로 grep — 잔존
  5건(spec 3 + 코드 1 comment, 총 4개 파일) 전부 "예전엔 여기가 `INVALID_INPUT` 이었다" 는
  **이력 서술**이며 발행 지점은 0건. `INVALID_TRIGGER_PARAMETERS` 는 다른 영역에서 다른 의미로
  쓰이는 재사용 없음(신규 카탈로그 등재가 유일한 정의).
- **API 계약 정합성**: `executions.service.ts`(발행부) · `executions.controller.ts`(Swagger
  `@ApiBadRequestResponse`) · `executions-rerun.service.spec.ts`(단언) · frontend
  `rerun-modal.tsx`(`ERROR_CODE_TO_KEY` 는 `RERUN_*` 4종만 매핑하므로 이 코드는 generic
  fallback으로 안전) · 유저가이드 `triggers.mdx`/`triggers.en.mdx` 가 모두 새 코드로 일치.
  `spec/data-flow/10-triggers.md`·`spec/data-flow/11-workflow.md` 는 execute/save 경로만
  다루고 re-run 을 언급하지 않아(re-run 은 별도 data-flow 문서가 없음) 갱신 누락이 아니다.
- **명명 규약(conventions/error-codes.md) 내부 정합성**: §2 rename-stability 정책("이름 정확성
  향상만을 위한 rename 금지")과의 관계를 §5 신규 행이 "선존 drift 통일" 로 명시적으로 예외
  주장하고, 기존 3개 rename 선례("breaking 영향 없음을 확인")와 리스크 등급이 다름을
  구분해 적어 §5 표의 과잉 일반화를 방지하는 각주도 있다 — 규약 문서 자기 자신과 모순 없음.
  §4.1/§4.2 분리도 `webhook §5.2`·`error-handling §1.3` 두 인입 참조("error-codes 규약 §4
  패턴")가 착지하도록 정정됐고, `0-common.md §1` 앵커도 유효하다.
- **계층 책임**: `resolveTriggerParametersRejectingMasked` wrapper 가 base
  `resolveTriggerParameters` 를 감싸는 설계(Webhook/Schedule 은 base 를 공유, Manual 만
  마커 거부 wrapper 사용)와 이를 강제하는 CI 가드(`masked-reject-callers-guard.ts`)가 실제
  파일로 존재하며, `1-manual-trigger.md`·`14-external-interaction-api.md` §R17 양쪽에
  동일하게 서술돼 있어 레이어 분리 결정에 모순 없음.
- **plan 트래커 정합**: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의
  관련 체크박스 4건이 실제 편집과 일치하게 `[x]` 로 갱신됐다(임의 mismatch 없음).

### 요약

target 변경은 Manual 3경로(주 실행·저장·re-run)의 `error.code` 를 `INVALID_TRIGGER_PARAMETERS`
로 통일하는 rename 이며, 카탈로그(`3-error-handling.md`) · 도메인 SoT(`13-replay-rerun.md`,
`1-manual-trigger.md`) · 명명 규약(`conventions/error-codes.md`) · 인접 도메인 참조
(`12-webhook.md`, `14-external-interaction-api.md`) 가 전부 동일 방향으로 갱신돼 있고, 은퇴
코드(`INVALID_INPUT`)의 잔존은 전부 의도된 이력 주석/각주다. 코드(발행부·Swagger·테스트)와
프론트(에러 매핑·유저가이드)도 spec 과 일치해 API 계약·요구사항 ID·계층 책임 어느 관점에서도
다른 spec 영역과의 직접 모순이나 잠재 충돌을 찾지 못했다. 이미 `--plan`(16_34_50)·
`--impl-prep`(15_35_56) 단계 checker 들이 지적한 항목도 이번 편집에 반영되어 있다.

### 위험도
NONE
