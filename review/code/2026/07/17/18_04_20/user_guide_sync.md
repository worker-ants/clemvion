# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 발견사항

없음 — 매칭되는 trigger 없음.

## 분석 요약

`.claude/config/doc-sync-matrix.json` (`rows[]` 21개 행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(122-144행) 을 SSOT 로 적재해 검토했다.

리뷰 대상 변경 set (prompt 파일 목록 + `git diff --name-only origin/main...HEAD` 로 교차 확인):

- `.claude/hooks/guard_review_before_push.py` (git push 가드 — shlex 기반 서브커맨드 판정 재작성)
- `.claude/tools/reap-merged-worktrees.sh` (워크트리 GC reaper — `--keep` 세션 앵커 보호 추가)
- `.claude/tools/bootstrap-session.sh` (세션 부트스트랩 — reaper 에 앵커 경로 전달)
- `.claude/tests/test_push_detection.py` (push 가드 회귀 테스트)
- `.claude/tests/test_reap_merged_worktrees.py` (reaper 회귀 테스트)
- `.claude/tests/README.md`
- `.claude/docs/worktree-policy.md` (harness 정책 문서 — 유저 가이드 아님)
- `plan/in-progress/harness-session-anchor-guards.md` (작업 추적 plan)
- `review/code/2026/07/17/17_09_10/*` (이전 리뷰 세션 산출물)

전부 `.claude/**` (Claude Code 하네스 자체의 git 훅·워크트리 관리 도구·테스트·정책 문서) 와 `plan/**` 범위 안이다. 매트릭스의 21개 trigger(glob 13개 + semantic 8개) 를 전수 대조했으며, 다음 어떤 경로도 변경 set 에 없다:

- `codebase/backend/src/nodes/**` (신규 노드 / 노드 schema 변경)
- `codebase/frontend/src/**/*.tsx` (신규 UI 문자열)
- `codebase/channel-web-chat/src/**/*.tsx` (위젯 chrome 문자열)
- `codebase/frontend/src/content/docs/**` (유저 가이드 MDX / 신규 섹션 디렉토리)
- `codebase/frontend/src/lib/i18n/**` (dict / backend-labels)
- `codebase/backend/src/**/*.controller.ts`, `dto/**` (백엔드 API)
- `codebase/backend/src/modules/system-status/system-status.constants.ts` (BullMQ 큐)
- `codebase/backend/src/nodes/core/error-codes.ts` (ErrorCode enum)
- `codebase/backend/src/modules/auth/**` (인증·권한·세션 흐름)
- `codebase/packages/expression-engine/**` (표현식 언어)
- `spec/2-*/**`, `spec/3-*/**`, `spec/4-*/**`, `spec/5-*/**`, `spec/conventions/**` (spec 대규모 변경)

semantic-match 행(신규 warningCode/errorCode 발행, cross-cutting enum, backend zod ui.label, handler output field, AuthConfig type enum, 실행·디버깅 흐름, 통합/제공자, 환경 변수·런타임) 도 의미상 무관 — 본 변경은 제품 도메인 로직(노드·API·인증·표현식 엔진·실행 엔진)이 아니라 Claude Code 하네스 자신의 git push 게이트와 워크트리 GC 스크립트에 대한 신뢰성 수정이다. `.claude/docs/worktree-policy.md` 는 "유저 가이드"(`codebase/frontend/src/content/docs/`)가 아니라 개발자용 harness 운영 정책 문서이므로 매트릭스 target 어느 것과도 겹치지 않는다.

trigger 21개 중 매칭 0건, 누락 0건.

## 요약

변경 코드(git push 가드 shlex 재작성 + 워크트리 GC reaper 세션 앵커 보호 + 관련 테스트·정책 문서·plan) 는 `.claude/` 하네스 인프라에 한정되며 `codebase/**`·`spec/**` 를 전혀 건드리지 않는다. `doc-sync-matrix.json` 의 21개 trigger 중 매칭 0건, 따라서 유저 가이드·i18n dict·backend-labels 동반 갱신 누락 검출 대상 자체가 없다. 해당 없음.

## 위험도

NONE
