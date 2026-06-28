# 문서화(Documentation) 리뷰 결과

리뷰 대상: codebase/backend — http-exception filter CWE-209 fix, client-ip 테스트 보강, PublicWebhookThrottleGuard extractClientIp 통합, 이전 review 사이클 RESOLUTION/SUMMARY 산출물
리뷰 일시: 2026-06-28

---

## 발견사항

### [INFO] `mapHttpErrorLike` JSDoc — CWE-209 문구가 이미 추가됨 (이전 사이클 조치 확인)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/common/filters/http-exception.filter.ts` L103 (JSDoc)
- 상세: diff 에서 `* 반환 \`message\` 는 CWE-209 방지를 위해 내부 원문을 echo 하지 않고 상태 기반 고정 문구만 쓴다.` 한 줄이 JSDoc 끝에 추가됐다. 이전 리뷰 사이클(17_00_25 I17) 에서 요구한 조치가 이미 이번 diff 에 포함된 상태이므로 추가 조치 불필요. 인라인 주석(L111–113)도 동일한 맥락을 보완하고 있어 호출자와 구현자 모두에게 의도가 명확히 전달된다.
- 제안: 현 상태 유지. 조치 완료.

### [INFO] `public-webhook-throttle.guard.ts` — 삭제된 `extractClientIp` export 이관 근거가 최종 파일에서 미추적
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` (파일 말미 — `extractClientIp` 함수 블록 전체 삭제)
- 상세: 삭제된 `extractClientIp` 함수의 JSDoc 에는 "04 후속: `auth/utils/client-ip` 단일 구현으로 통합해 사본 drift 방지" 라는 이관 이유가 명확히 기술되어 있었다. 그러나 삭제와 함께 이 근거도 사라졌고, 최종 파일 어느 위치에도 이관 결정의 흔적이 없다. 반면 spec 파일(`public-webhook-throttle.guard.spec.ts`) 에는 이관 사실을 설명하는 인라인 주석이 남아 있어 두 파일 간 문서화 수준이 비대칭이다. 미래에 이 파일을 처음 읽는 개발자가 `extractClientIpFromHeaders` 직접 호출 맥락을 파악하려면 git blame 또는 spec 파일을 참조해야 한다.
- 제안: `PublicWebhookThrottleGuard` 클래스 JSDoc 또는 `extractClientIpFromHeaders` import 라인 근처에 `// IP 추출: auth/utils/client-ip.extractClientIpFromHeaders 에 위임 (단일 구현 drift 방지)` 한 줄 추가. 필수는 아니나 최초 리더 안내에 도움이 된다.

### [INFO] `http-exception.filter.spec.ts` — 새 테스트 케이스 인라인 주석 품질 양호, 비-413 4xx 단언도 추가됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/common/filters/http-exception.filter.spec.ts` L46–48, L51–68 (신규 테스트 2건)
- 상세: 413 테스트에 `// 내부 message 를 echo 하지 않고 일반 문구만 반환한다(CWE-209).` 주석이 추가됐고, 비-413 4xx 테스트에도 `// CWE-209: 내부 원문 미노출, 일반 문구만. 원문은 logger.warn 로만 남는다.` 주석이 포함됐다. 이전 리뷰(17_00_25 W1·I15·I17) 에서 요구한 조치들이 모두 반영된 상태이다. 주석이 단언 의도를 명확히 설명하므로 추가 조치 불필요.
- 제안: 현 상태 유지.

### [INFO] `public-webhook-throttle.guard.spec.ts` — 이관 주석이 두 위치에 중복 존재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.spec.ts` (삭제 블록 직후 이관 주석 L228–229, 이전 사이클 섹션 헤더 근처)
- 상세: `// (extractClientIp 헤더 추출 엣지 케이스는 \`auth/utils/client-ip.spec.ts\` 의 \`extractClientIpFromHeaders\` 로 이관 — Guard 는 공유 코어를 직접 호출한다.)` 주석이 삭제된 코드 바로 뒤 한 곳에만 위치한다. 이전 리뷰(17_00_25 I14·유지보수성 I5) 에서 두 곳 중복이 지적됐는데, 이번 diff 에서 실제로 한 곳으로 정리된 것으로 보인다. 정리가 완료된 경우 조치 완료.
- 제안: 최종 파일에서 중복 여부 재확인 후, 단일 위치만 남아 있으면 조치 완료로 닫는다.

### [INFO] `RESOLUTION.md` — 조치 항목 표가 SPEC-DRIFT 문서화 반영 여부를 코드 수준에서도 확인 필요
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/review/code/2026/06/28/17_00_25/RESOLUTION.md` (파일 6, 신규)
- 상세: RESOLUTION 이 "FIXED: `3-error-handling.md §1.3` 에 고정 문구·CWE-209 비-echo 원칙 기재" 및 "`12-webhook.md §6` 에 fail-open ERROR 로깅 추가" 를 완료로 기록하고 있다. 이 spec 변경이 이번 diff 에 포함되어 있지 않으므로 별도 커밋에 반영됐거나 plan 추적 중임을 의미한다. RESOLUTION 문서 자체의 형식은 적절하며 조치·보류 항목 구분이 명확하다.
- 제안: spec 반영 커밋이 이 PR 에 포함됐는지 확인한다. 미포함이면 `plan/in-progress/` plan 파일에 spec 반영 항목이 열려 있는지 확인 권장.

### [INFO] `_retry_state.json` 내 절대 경로 하드코딩 — 도구 자동 생성 파일, 문서화 대상 아님
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/review/code/2026/06/28/17_00_25/_retry_state.json`
- 상세: `session_dir`, `prompt_file`, `output_file` 등이 로컬 절대 경로로 하드코딩되어 있다. 오케스트레이터 런타임 상태 파일로 이식성이 없으나 이는 도구 설계 의도이므로 문서화 이슈가 아니다. 별도 문서화 불요.
- 제안: 현 상태 유지.

---

## 요약

이번 변경의 문서화 수준은 이전 리뷰 사이클(17_00_25) 지적사항이 대부분 반영된 후 제출된 것으로, 전반적으로 양호하다. `mapHttpErrorLike` JSDoc 에 CWE-209 관련 문구가 추가됐고, 새 테스트 케이스에도 의도를 설명하는 인라인 주석이 포함되어 있다. 주요 미비점은 `extractClientIp` 삭제 이후 최종 구현 파일에서 이관 결정의 흔적이 사라진 것으로, 이는 미래 독자를 위한 안내 목적의 선택적 개선 사항이다. API 문서·README·CHANGELOG·환경변수 문서 관점에서는 신규 설정 추가나 엔드포인트 변경이 없으므로 업데이트 필요성이 없다. RESOLUTION 문서는 조치·보류 항목이 명확히 구분되어 있어 추적성이 높다. 모든 발견사항이 INFO 수준으로 차단 사유가 없다.

## 위험도

NONE

---

STATUS: PASS
