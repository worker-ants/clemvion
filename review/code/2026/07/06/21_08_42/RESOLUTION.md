# Code Review 후속 조치 (RESOLUTION)

세션: `review/code/2026/07/06/21_08_42`
대상 커밋: `56c72ba9f` — feat(notifications): team_invite channel in_app 하향
리뷰 결과: **7 reviewer 완료, Critical 0 / Warning 0** (INFO/LOW 만).

## 판정

전체 위험도 **NONE**. Critical·Warning 발견 없음 → `resolution-applier` 자동 fix 파이프라인 불필요.
INFO/LOW 발견만 존재하며, 그중 조치 가치가 있는 1건만 처리했다.

## 조치 (1건)

| # | Reviewer | 등급 | 발견 | 조치 |
|---|----------|------|------|------|
| 1 | documentation | LOW | `CHANGELOG.md` PR3 "Unreleased" 항목이 `team_invite` 를 `channel: 'both'`(인앱+이메일)로 서술 — 본 커밋의 `in_app` 하향과 불일치. 미출시(Unreleased) 상태라 shipped changelog 가 자체 모순될 위험 | **수정 완료** — 해당 항목의 채널 서술을 `execution_failed`/`schedule_failed`=both, `team_invite`=in_app 으로 분리하고 이메일 중복 회피 근거·§5.1 각주 참조를 명시. (CHANGELOG 는 codebase/** 밖이라 review gate 재무장 없음.) |

## 무조치 (INFO — 근거)

- **scope INFO #1–4**: 부속 산출물(plan 완료 이동, consistency 6파일, spec 2곳, 테스트 2줄)은 전부
  CLAUDE.md 규약이 요구하는 필수 산출물 — 스코프 이탈 아님.
- **maintainability INFO #5 (channel 리터럴 하드코딩)**: `NotificationsService.notify()` 의 `channel`
  파라미터가 이미 리터럴 유니온 타입(`'in_app'|'email'|'both'`)이라 오타는 컴파일 타임에 잡힌다 —
  enum 상수화 이득 낮음, 기존 관례 준수. 무조치.
- **maintainability INFO #6 (docstring 확장 중복)**: spec 참조 링크를 포함해 SoT 원칙 유지 —
  결정 근거를 코드 인근에 남기는 것이 유지보수에 유리. 현행 유지.
- **testing INFO #9 (통합/e2e 부재)**: `in_app` 다운스트림(이메일 미발송)은 `NotificationsService`
  기존 unit 테스트로 커버되고, `channel: 'in_app'` 단언이 서비스 spec 에 고정됨(30/30 pass). "이메일
  중복 회피"를 초대 API→메일 mock 호출 횟수로 고정하는 통합 테스트는 강화 제안일 뿐 Critical 아님 —
  본 변경 범위(리터럴 1줄) 대비 과하여 이월. 필요 시 별도 테스트 보강 plan.
- **testing INFO #11 (mock 순차 체이닝 브리틀)**: 기존 관례이며 본 diff 로 신규 도입 아님 — 무조치.

## 검증

- unit: `npx jest workspace-invitations.service.spec.ts` → 30/30 pass (channel=in_app 단언 포함).
- lint: 변경 파일 eslint clean.
- typecheck: 변경 파일 type-clean (무관 pre-existing presentation-node spec 에러만 존재).
- e2e: 본 변경은 알림 채널 리터럴 1줄 — HTTP 계약·DB 스키마·라우트 무변경이라 e2e 표면 영향 없음.
  초대 API e2e 는 기존 흐름 그대로(초대 생성·이메일 발송 best-effort) 유지.
