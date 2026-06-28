# 문서화(Documentation) 리뷰 결과

리뷰 대상: codebase/backend — http-exception filter CWE-209 fix, client-ip 테스트 보강, PublicWebhookThrottleGuard extractClientIp 통합, consistency review 산출물
리뷰 일시: 2026-06-28

---

## 발견사항

### [INFO] http-exception.filter.ts — `mapHttpErrorLike` JSDoc 이 일반-문구 분기 로직을 설명하지 않음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/common/filters/http-exception.filter.ts` — `mapHttpErrorLike` JSDoc (L287–L292)
- 상세: 기존 JSDoc 은 "4xx 면 그 상태로 표준 봉투에 싣는다" 고만 기술하고 있으며, 이번 변경에서 추가된 핵심 동작 — "내부 메시지를 클라이언트에 반환하지 않고 상태별 일반 문구로 교체한다 (CWE-209)" — 을 JSDoc 본문에서 명시적으로 언급하지 않는다. 인라인 주석이 메서드 내부에 추가됐으나 공개 JSDoc 레벨 설명과 동기화되지 않았다. 메서드를 읽는 호출자 입장에서는 반환 `message` 필드가 원본 메시지가 아니라 sanitized 문구임을 JSDoc 만으로는 알 수 없다.
- 제안: JSDoc 끝에 `* 반환 `message` 는 CWE-209 위반 방지를 위해 상태 기반 일반 문구만 사용한다 — 원본 메시지는 호출부 `logger.warn` 으로만 남긴다.` 한 줄 추가.

### [INFO] public-webhook-throttle.guard.ts — 삭제된 `extractClientIp` export 에 대한 소비자 이관 문서 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` (diff 末尾)
- 상세: `extractClientIp` 함수가 이 파일에서 제거되고 `auth/utils/client-ip` 의 `extractClientIpFromHeaders` 로 직접 대체됐다. 삭제된 export 의 JSDoc 에는 이관 이유가 잘 설명돼 있었으나(04 후속: 사본 drift 방지), 삭제 diff 에만 존재하고 최종 파일에는 이 결정의 흔적이 없다. 테스트 파일에는 이관 사실을 설명하는 주석이 남아 있어 비대칭이다.
- 제안: 파일 최상단 import 블록 근처 또는 `PublicWebhookThrottleGuard` 클래스 JSDoc 본문에 `// IP 추출: auth/utils/client-ip.extractClientIpFromHeaders 에 위임 (단일 구현 drift 방지 — 04 후속)` 한 줄 추가. 필수는 아니지만 최초 리더를 위한 안내가 된다.

### [INFO] client-ip.spec.ts — 새 테스트 케이스에 `afterEach` env 복원 누락 가능성 주석 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/auth/utils/client-ip.spec.ts` L357–L369 (신규 추가 테스트 2건)
- 상세: `afterEach` 블록이 describe 상단에 정의돼 있어 실제로 env 복원이 동작한다. 그러나 신규 케이스 중 `'whitespace-only XFF → null'` (L367–369)는 `TRUST_CF_CONNECTING_IP` 를 건드리지 않으므로 afterEach 역할을 이해하려면 블록 상단을 다시 봐야 한다. 현재 수준에서 혼동이 발생할 가능성이 낮으므로 INFO 로 분류.
- 제안: 현 수준 유지 가능. 필요 시 해당 it 블록에 `// CF off(기본) 상태에서 실행 — afterEach 가 환경 원복 담당` 한 줄 추가.

### [INFO] consistency review 산출물 — `_retry_state.json` 의 절대 경로 하드코딩
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/review/consistency/2026/06/28/16_50_18/_retry_state.json`
- 상세: JSON 파일 내 `session_dir`, `prompt_file`, `output_file` 필드가 로컬 절대 경로를 포함한다. 이 파일은 도구 내부 상태 파일이므로 문서화 이슈는 아니나, 해당 파일을 다른 머신에서 재사용 시 경로가 깨진다. 운영 문서나 README 에 "이 파일은 로컬 세션 상태 파일로 이식 불가" 설명이 없다.
- 제안: 이 파일은 도구 자동 생성 산출물로, 별도 문서화 불요. 단 `.claude/docs/subagent-call-contract.md` 에 `_retry_state.json` 의 성격(로컬 세션 전용)을 한 줄 언급하면 혼동이 줄어든다.

---

## 요약

이번 변경의 문서화 수준은 전반적으로 양호하다. 핵심 보안 변경(CWE-209 메시지 sanitize)은 인라인 주석으로 충분히 설명됐고, `extractClientIp` 이관 결정도 테스트 파일 주석으로 추적 가능하다. 다만 `mapHttpErrorLike` JSDoc 이 반환 `message` 가 sanitized 문구임을 명시하지 않아 이 메서드를 독립적으로 읽는 경우 동작을 오해할 수 있고, 삭제된 export 에 대한 이관 근거가 최종 파일에서는 추적 불가하다. API 문서·README·CHANGELOG·환경변수 문서 측면에서는 신규 설정 추가나 엔드포인트 변경이 없어 업데이트 필요성이 없다. 모든 발견사항은 INFO 수준으로, 차단 사유가 없다.

## 위험도

NONE

---

STATUS: PASS
