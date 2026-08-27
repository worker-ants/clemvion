# 보안(Security) 코드 리뷰 — masking-residuals-0b195b (11_25_15)

## 검토 범위 및 방법

이번 라운드의 diff 는 두 겹이다: (1) `config` echo 마스킹을 어댑터에서 egress 로 옮긴 원 변경
(`handler-output.adapter.ts` 등, 커밋 `348c2b3ca`), (2) 직전 라운드(`10_53_52`)가 낸
**CRITICAL**("포함관계 캐너리가 `DEFAULT_SENSITIVE_KEYS` 에서 실제로 파생되지 않는다")에 대한
수정(커밋 `fa6e2294c`), 그리고 그 두 라운드의 리뷰 산출물(`review/**`)·spec 정정(`spec/**`)이
동일 diff 세트에 함께 커밋되어 있다.

핵심 코드 4개 파일은 diff 만으로 판단하지 않고 저장소에서 `Read`/`git show HEAD:...` 로 직접
열어 **커밋된 최종 상태**를 확인했고, `CREDENTIAL_KEY_PATTERN` 정규식(REST/WS 공유본)이
`DEFAULT_SENSITIVE_KEYS` 의 현재 22개 키 전부를 문자열 매칭으로 실제로 커버하는지 수동으로
대조했다.

## 발견사항

- **[INFO]** 직전 라운드 CRITICAL("포함관계 캐너리 미파생")은 **실제로 고쳐졌다** — 독립 검증 완료
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts:10`(`export const DEFAULT_SENSITIVE_KEYS`), `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts:139`(`const KEYS = [...DEFAULT_SENSITIVE_KEYS];`)
  - 상세: `git show HEAD:codebase/backend/src/common/utils/mask-sensitive-fields.util.ts` 로 커밋된 최종 소스를 직접 확인했다 — 상수가 `export` 되고, 테스트는 `Object.keys(maskSensitiveFields({...}))`(입력 리터럴을 그대로 되돌려주므로 상수와 무관했던 초판 방식)가 아니라 `[...DEFAULT_SENSITIVE_KEYS]` 로 **실제 런타임 상수를 spread** 한다. `CREDENTIAL_KEY_PATTERN`(`codebase/backend/src/shared/utils/sanitize-error-message.ts:113`, `/^(password|passwd|pwd|api[_-]?key|secret|[a-z0-9_-]*token|private[_-]?key|client[_-]?secret|authorization|cookie|x[_-]api[_-]?key)$/i`)에 현재 목록의 22개 키(소문자화 후 21개, `apiKey`/`apikey` 중복)를 전부 수동 대조한 결과 예외 없이 매칭됨을 확인했다 — 포함관계가 실제로 성립하고, 이제 그 성립을 진짜 상수 기반 테스트가 단언한다. CRITICAL 로 재상신할 사유 없음.
  - 제안: 없음 (양호, 확인 완료).

- **[WARNING]** (기지 사안, 재확인) config echo 안전성이 "safe-by-construction" 에서 "safe-by-convention" 으로 이동 — 표현식을 통한 크로스-노드 자격증명 릴레이가 구조적으로 열려 있다
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:53`(`config: r.config ?? {}`), `spec/2-navigation/14-execution-history.md:479-484`(R-5 정정 블록)
  - 상세: 이 변경 이후 `config` 는 DB 에 원문으로 저장되고 표현식(`$node["X"].config.<field>`)도 원문을 읽는다. 이는 표현식이 마스킹된 값을 읽던 기능 버그를 고치는 의도된 조치이고, egress(REST `redactStoredDataForResponse`/WS `maskWireEnvelope`, 둘 다 공유 `deepRedactSecretsPreserving`)가 "실행 이력을 읽는" 경로는 여전히 가린다 — 이 부분은 위에서 재검증했다. 다만 "워크플로우 편집 권한자가 자신의 워크플로우 로직으로 한 노드의 `config.apiKey` 를 다른 HTTP Request/Send Email 노드 body 에 실어 제3자 엔드포인트로 전송"하는 경로는 egress 초크포인트를 아예 지나지 않으므로 원리적으로 막을 수 없다. spec(R-5 정정 블록)이 이 트레이드오프를 "워크스페이스 경계는 넘지 않는다"·"근본 처방은 자격증명 참조 간접화"로 명시하고 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 "미판정" 백로그로 등재까지 마쳤음을 확인했다 — 신규 미문서화 결함은 아니며 이 PR 을 차단할 사유는 아니다. 그러나 이 값 자체는 여전히 실질적인 보안 트레이드오프이므로 재확인 차원에서 기록한다.
  - 제안: 이미 등재된 백로그(자격증명 참조 간접화, 예: `llmConfigId` 패턴을 HTTP Request/Send Email 등에 확산)의 우선순위를 유지 — 실제 몇 개 노드 타입이 평문 자격증명을 `config` 값으로 받는지부터 재는 것이 다음 단계로 이미 적혀 있다.

- **[INFO]** (기지 사안, 재확인) WS 전용 로컬 `CREDENTIAL_KEY_PATTERN` 사본이 공유본보다 좁다(`x-api-key` 미포함) — config echo 경로는 영향 없음, 별건 추적 중
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:78-79`(`/^(...)$/i`, `x[_-]api[_-]?key` 없음) vs `codebase/backend/src/shared/utils/sanitize-error-message.ts:113`(포함)
  - 상세: `websocket.service.ts:12-14`/`:463` 에서 `maskWireEnvelope` 이 이 로컬 정규식이 아니라 공유 `deepRedactSecretsPreserving` 을 호출함을 직접 확인했다 — 즉 이 PR 이 다루는 `config` echo 경로는 이 비대칭의 영향을 받지 않는다. 로컬 정규식은 `chatChannel` 라우팅 컨텍스트(`sanitizePayloadForWs`) 전용이며, 그 항목은 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(2026-08-24 등재, "미판정")에 별건으로 추적되고 있다. 다만 이 PR 로 config echo 의 안전성이 "egress 마스킹 하나"에 전적으로 의존하게 된 만큼, 이 두 정규식이 동명이인으로 갈라져 있는 구조 자체의 우선순위는 계속 높게 유지할 가치가 있다.
  - 제안: 이 PR 의 범위는 아님. 별건 처리 시 반드시 **넓은 쪽으로** 합칠 것(좁은 쪽으로 합치면 REST 후퇴).

- **[INFO]** 리뷰 도중 공유 worktree 에서 일시적 뮤테이션 오염을 관측 — HEAD 는 clean, 실제 결함 아님
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts` (작업 트리 일시 상태, 커밋 아님)
  - 상세: 이 리뷰 도중 한 시점에 `Read` 도구로 해당 파일을 열었을 때 `DEFAULT_SENSITIVE_KEYS` 목록 끝에 `'oauthCredXYZ'` 항목이 추가된 상태를 관측했다. 그러나 `git status --porcelain`(untracked 2개 리뷰 산출물 외 변경 없음)·`git diff HEAD`(빈 결과)·`git show HEAD:<path>`·`sed -n`(bash `cat -n`) 를 각각 재확인한 결과 **현재 HEAD·작업트리 모두 그 키가 없다** — 직전 라운드(`10_53_52`)의 CRITICAL 수정 커밋 본문이 언급한 M4 재현(egress 가 못 잡는 가상 키 `oauthCred` 주입 검증)과 정확히 같은 종류의, 이 공유 worktree 에서 동시 실행 중인 다른 프로세스(예: 병렬 뮤테이션 검증)가 남긴 **일시적 상태**로 판단된다(이 저장소의 기존 기록: `feedback_reviewer_mutates_shared_worktree`·이전 라운드 `side_effect.md` INFO 와 동일 패턴). 이번 PR 의 커밋된 코드 결함이 아니다.
  - 제안: 조치 불필요. 다만 이 세션 종료 시점에도 작업트리에 `oauthCredXYZ`/`.orig` 류 잔존이 있다면 다음 작업자가 오탐(false RED)으로 시간을 쓰지 않도록 정리 확인을 권장.

- **[INFO]** 테스트 픽스처의 시크릿류 문자열은 전부 합성 placeholder — 하드코딩된 실제 시크릿 없음
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.spec.ts`(`'sk-secret-1234567890'`, `'AAAABBBB4321'`, `'p@ssw0rd'`, `'Bearer xyz-token-abcdef'` 등), `mask-sensitive-fields.util.spec.ts`(`'SUPER-SECRET-VALUE-0123456789'`)
  - 상세: 전부 테스트 전용 합성값이며 실제 자격증명이 아니다.
  - 제안: 없음.

## 점검 관점별 요약

1. 인젝션(SQL/XSS/커맨드/경로탐색): 해당 diff 범위 내 신규 인젝션 벡터 없음.
2. 하드코딩된 시크릿: 없음(테스트 픽스처는 합성값).
3. 인증/인가: 변경 없음 — REST/WS 인가 게이트는 그대로이고, 이 PR 은 응답 데이터의 **마스킹 시점**만 이동한다.
4. 입력 검증: 해당 없음(신규 사용자 입력 경로 없음).
5. OWASP Top 10 (A02 암호화 실패/민감정보 노출): 핵심 트레이드오프 — `config` 의 DB 저장이 마스킹값→원문으로 바뀌고, 표현식이 원문을 읽는다. egress(REST/WS) 마스킹은 정본 구현 실행 기반 테스트로 재검증했고 성립을 확인했다. 남은 리스크(크로스-노드 릴레이·safe-by-convention)는 이미 spec·plan 에 명시적으로 등재됨.
6. 암호화: 해당 없음(마스킹 알고리즘 자체는 불변, 위치만 이동).
7. 에러 처리: 해당 없음(`error` 컬럼 마스킹 경로는 이 PR 대상 아님, 기존 그대로).
8. 의존성 보안: 신규 의존성 없음.

## 요약

직전 라운드(`10_53_52`)가 낸 CRITICAL — "포함관계 캐너리가 `DEFAULT_SENSITIVE_KEYS` 에서 실제로
파생되지 않아 목록이 넓어져도 새 키를 검사하지 못한다" — 는 이번 diff 에서 **실제로 고쳐졌다**.
`DEFAULT_SENSITIVE_KEYS` 를 export 하고 테스트가 `[...DEFAULT_SENSITIVE_KEYS]` 로 직접 spread
하도록 재작성됐음을 커밋된 소스(`git show HEAD`)에서 직접 확인했고, 현재 22개 키 전부가 egress
공유 정규식(`CREDENTIAL_KEY_PATTERN`)과 문자열 수준에서 실제로 매칭됨을 별도로 대조해 포함관계가
성립함을 재검증했다. `config` echo 마스킹을 어댑터에서 egress 로 옮긴 핵심 설계 변경 자체는 REST/WS
양쪽이 공유 `deepRedactSecrets*` 를 거치는 것을 코드 추적으로 확인했으며, 남아 있는 실질적
트레이드오프(표현식을 통한 크로스-노드 자격증명 릴레이, safe-by-convention 전환, WS 로컬 패턴
비대칭)는 전부 이미 spec R-5 정정 블록과 plan 백로그에 명시적으로 기록·추적되고 있어 이번 PR 을
차단할 CRITICAL/신규 미문서화 결함은 발견되지 않았다. 리뷰 도중 관측한 공유 worktree 뮤테이션
오염은 커밋된 상태와 무관한 일시적 현상임을 다각도로 확인했다.

## 위험도

LOW
