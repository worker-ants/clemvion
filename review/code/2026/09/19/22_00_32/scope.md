# 변경 범위(Scope) 리뷰 — SMTP SSRF 가드 통합 (`ssrf-guard-integration-unify`)

## 검증 방법
`git diff --stat origin/main...HEAD` 로 실제 diff 37개 파일 전량을 프롬프트의 파일 목록과 대조 — 완전히 일치(누락·추가 없음). `plan/in-progress/ssrf-guard-integration-unify.md` 의 "할 것" 절과 `review/code/2026/09/19/21_38_32/RESOLUTION.md` 의 1라운드 조치 표를 기준으로 각 파일의 변경 사유를 대조했다.

## 발견사항

- **[INFO]** `SsrfBlockedError` 클래스 신설은 plan 원안(항목 1~4)에는 없던 항목이지만, 1라운드 리뷰 WARNING(#1, 메시지 접두어 매직스트링 계약)에 대한 `resolution-applier` 조치로 `RESOLUTION.md` W1 행에 커밋(`a1e1a591b`)까지 명시적으로 추적된다. CLAUDE.md 의 "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무" 조항에 해당하는 정상 워크플로 산출물이며 범위 이탈이 아니다.
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts` 클래스 `SsrfBlockedError` (게이트 47~52)

- **[INFO]** `scripts/backend-typecheck-baseline.json` 의 `total: 197 → 194` 및 `http-safety.spec.ts` 항목 삭제는 설정 파일 변경이지만, plan 체크리스트("build 의 타입체크 ratchet 이 http-safety.spec 3 → 4 를 잡았다 … 4 → 0, baseline 197 → 194")에 실측이 기록되어 있고 실제 타입 오류 수정(`lookup` mock 오버로드 교정)의 직접 결과다. 손으로 고친 것이 아니라 ratchet 스크립트 재생성 산출물로 보인다.
  - 위치: `scripts/backend-typecheck-baseline.json`

- **[INFO]** `common/utils/smtp-host-guard.{ts,spec.ts}` 삭제 → `nodes/integration/send-email/smtp-host-guard.{ts,spec.ts}` 로 이동은 파일 위치 변경(리팩터링처럼 보일 수 있음)이지만, plan 본문에 "`common` → `nodes` 역방향 import 를 만들지 않으려고" 라는 근거가 명시되어 있고, `isSmtpHostBlocked` 를 `http-safety.ts` 판정으로 교체하는 이번 작업과 물리적으로 분리할 수 없는 변경이다(같은 파일의 구현 교체 + 이동). 4곳의 import 경로 갱신(`integrations.service.ts`, `.spec.ts`, `send-email.handler.ts`, `.spec.ts`)도 이 이동에 종속된 기계적 변경으로, 별도 리팩터링이 아니다.

- **[INFO]** `review/code/2026/09/19/21_38_32/**`(15개 파일)와 `review/consistency/2026/09/19/21_02_09/**`(7개 파일)가 diff 에 포함되어 있으나, 이는 이번 PR 워크플로 자체가 요구하는 `--impl-prep` consistency-check 및 1라운드 `/ai-review` 산출물이며 프로젝트 컨벤션(`review/code/<date>/<time>/`, `review/consistency/<date>/<time>/`)이 지정한 정규 저장 위치다. 무관한 파일이 아니다.

- **[INFO]** `CHANGELOG.md`·`codebase/backend/.env.example` 변경은 1라운드 리뷰 WARNING #5~#7(문서화 누락)에 대한 조치로 `RESOLUTION.md` 에 커밋 매핑이 되어 있다. 코드 변경 범위와 직접 연결된 문서 갱신이며 무관한 수정이 아니다.

- **[INFO]** `integrations.service.ts`(게이트 1594~1595)·`send-email.handler.ts`(게이트 176~178)의 주석 정정(`SMTP_BLOCK_PRIVATE_HOSTS` phantom 플래그 → `ALLOW_PRIVATE_HOST_TARGETS` 실제 동작)은 plan "할 것" 항목 3에 명시된 대상이며, 주석 외 로직 변경은 없다.

- **[INFO]** `http-safety.ts` 모듈 docstring 에 "공용인데 `http-request/` 폴더에 있는 이유" 단락(게이트 11~13)이 새로 추가됐는데, 이는 1라운드 리뷰 WARNING #2(공용 SoT가 특정 기능 폴더에 상주)에 대한 최소 조치로 `RESOLUTION.md` 에 "이유 한 줄"로 명시돼 있다. 실제 폴더 이동(더 큰 리팩터링)은 하지 않고 주석 설명 + 트래커 등재로 최소화했다 — over-engineering 아님.

이 외 파일(`http-safety.ts`/`.spec.ts` 의 IPv4-mapped 판정 로직, `smtp-host-guard.ts` 신설, e2e B2 케이스)은 모두 plan 의 실측·"할 것" 절과 1:1 대응하며, 포맷팅만 바뀐 줄이나 사용하지 않는 임포트 추가, 무관한 코드 정리는 발견되지 않았다.

## 요약
diff 37개 파일 전량을 `git diff --stat origin/main...HEAD` 결과와 대조한 결과 프롬프트 목록과 완전히 일치했고, 각 파일 변경은 plan 문서("할 것" 4개 항목)·1라운드 리뷰 RESOLUTION 표 중 하나에 명확히 소급된다. 파일 이동(`common/utils` → `nodes/integration/send-email`)·신규 에러 클래스·주석 정정·CHANGELOG/.env.example 갱신·타입체크 baseline 갱신 모두 근거가 문서화된 정당한 변경이며, 요청 범위를 벗어난 추가 기능·무관한 리팩터링·불필요한 포맷팅 변경은 발견되지 않았다. review/consistency 산출물 포함은 프로젝트 워크플로가 요구하는 정규 산출물이다.

## 위험도
NONE
