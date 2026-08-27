# 보안(Security) 코드 리뷰 — masking-residuals-0b195b (`12_28_26`, 4라운드 누적)

## 검토 방법

이 diff 는 `masking-expression-egress-split` 작업의 4번째 리뷰 라운드이며, `origin/main` 대비
누적된 변경에는 이전 세 라운드(`10_53_52` CRITICAL 1건, `11_25_15` WARNING 3건, `12_00_05`
WARNING 6건)가 이미 발견·처리한 수정 커밋들과 그 산출물(`review/code/2026/08/27/{10_53_52,
11_25_15,12_00_05}/**`, `review/consistency/2026/08/24/19_26_06/**`)이 포함돼 있다. 핵심 소스
5개 파일(`mask-sensitive-fields.util.{ts,spec.ts}`, `handler-output.adapter.{ts,spec.ts}`,
`execution-context.service.ts`, `ai-turn-executor.ts` 해당 구간)을 `Read`로 현재 상태 그대로
대조하고, 안전 불변식(`DEFAULT_SENSITIVE_KEYS ⊆ CREDENTIAL_KEY_PATTERN`)을 정규식·목록을 직접
대조해 22개 키 전부 재검증했으며, WS 쪽 로컬 정규식이 config echo 경로에 실제로 관여하지
않음(`maskWireEnvelope` → `deepRedactSecretsPreserving` → 공유 `CREDENTIAL_KEY_PATTERN`)을 소스
추적으로 확인했다. spec 미러 스윕 대상 8개 지점(`node-output.md:256`,
`4-execution-engine.md:193/203/1510`, `1-ai-agent.md:480/755/979/1114`)을 `grep`으로 전수
재확인해 stale 인용이 남아 있지 않음을 검증했다.

## 발견사항

- **[INFO]** 직전 라운드 CRITICAL("포함관계 캐너리가 `DEFAULT_SENSITIVE_KEYS` 에서 파생되지
  않음")이 실제로 해소돼 있음을 독립 재검증
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts:10`
    (`export const DEFAULT_SENSITIVE_KEYS`), `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts:139`
    (`const KEYS = [...DEFAULT_SENSITIVE_KEYS];`, 이 프롬프트 게이트로는 파일 2 diff 139행)
  - 상세: `DEFAULT_SENSITIVE_KEYS` 를 `export` 하고 spec 이 `[...DEFAULT_SENSITIVE_KEYS]` 로
    직접 spread 하도록 재작성되어 있다. 목록의 22개 키(`apiKey`/`api_key`/`apikey`/`password`/
    `passwd`/`token`/`accessToken`/`access_token`/`refreshToken`/`refresh_token`/`csrfToken`/
    `csrf_token`/`authToken`/`auth_token`/`sessionToken`/`session_token`/`idToken`/`id_token`/
    `secret`/`client_secret`/`clientSecret`/`authorization`)을 `sanitize-error-message.ts:112`
    의 `CREDENTIAL_KEY_PATTERN`
    (`/^(password|passwd|pwd|api[_-]?key|secret|[a-z0-9_-]*token|private[_-]?key|client[_-]?secret|authorization|cookie|x[_-]api[_-]?key)$/i`)
    에 하나씩 직접 대입해 전부 매치함을 확인했다 — 포함관계(⊆)가 실제로 성립한다.
  - 제안: 없음(양호, 확인 완료).

- **[INFO]** WS 전용 로컬 `CREDENTIAL_KEY_PATTERN` 비대칭이 config echo 경로에는 관여하지
  않음을 직접 추적으로 확인 (기지 사안, 별건 추적 중)
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:78-79`
    (`sanitizePayloadForWs` 전용 로컬 상수) vs `codebase/backend/src/shared/utils/sanitize-error-message.ts:112`
  - 상세: `websocket.service.ts` 의 `maskWireEnvelope`(:460-465)는 `deepRedactSecretsPreserving`
    을 호출하며, 이는 `sanitize-error-message.ts` 의 공유 `CREDENTIAL_KEY_PATTERN` 을 쓴다 —
    `x-api-key` 를 포함하는 **넓은** 쪽이다. `websocket.service.ts:78` 의 로컬 사본(좁은 쪽,
    `x-api-key` 미포함)은 `sanitizePayloadForWs(ctx.chatChannel)`(:533) 한 자리에만 쓰인다.
    즉 이 PR 이 egress 하나에 전적으로 의존하게 만든 config echo 경로는 넓은 쪽 정규식을
    타므로 이 비대칭의 영향을 받지 않는다 — `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
    의 신규 W6 등재(이 diff 파일 9, 게이트 529~532행)와 일치한다.
  - 제안: 없음(이 PR 범위 밖, 이미 별건 트래커에 "합칠 땐 넓은 쪽으로" 로 명시).

- **[WARNING]** (기지·문서화된 트레이드오프, 비차단) config 안전성이 storage-time 마스킹
  → egress-only 로 전환되며 두 가지 방어 축이 약화된다
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts` (게이트
    30~53행, `config: r.config ?? {}`); `spec/2-navigation/14-execution-history.md` R-5
    정정 블록(게이트 65~67행)
  - 상세: (1) `NodeExecution.outputData.config` 가 이제 DB 에 **원문**으로 저장된다 — 종전엔
    저장 시점 마스킹이 DB 직접 접근(백업·관리자 쿼리·향후 export API)까지 방어했으나, 이제는
    egress 두 곳(REST/WS)만 지나면 마스킹되고 DB 를 직접 읽는 경로는 항상 원문을 본다. (2)
    표현식이 `config` 를 원문으로 읽으므로, 같은 워크스페이스 작성 권한자가 한 노드의
    `config.apiKey` 를 다른 노드 body 에 실어 제3자 엔드포인트로 전송하는 크로스-노드
    자격증명 릴레이가 구조적으로 가능해진다(워크스페이스 경계는 넘지 않음). 이 두 가지는
    모두 이 PR 이 의도한 변경(표현식이 마스킹된 리터럴을 읽던 기능 오염을 고치기 위함)의
    **직접적 대가**이며, `spec/2-navigation/14-execution-history.md` R-5 와
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 신규 항목(이 diff 파일 9,
    게이트 373~385행)에 이미 명시적으로 등재·미판정 처리돼 있다 — 신규 미문서화 결함이
    아니다. safe-by-construction(생성 시점 강제) → safe-by-convention(각 egress 의 규율에
    의존) 전환도 같은 블록에 기록돼 있으며, 타입/컴파일 레벨 강제가 없어 향후 `config`/
    `outputData` 를 반환하는 신규 엔드포인트가 두 egress 헬퍼를 우회하면 조용히 샐 수 있다.
  - 제안: 이미 트래커에 등재된 근본 처방(자격증명을 값이 아니라 `llmConfigId` 같은 참조로
    담게 하는 패턴의 일반화) 우선순위를 유지. 이 PR 자체는 비차단.

- **[INFO]** `ExecutionContextService.setStructuredOutput` 이 이제 `adapted.config` 를
  참조로 저장 — 마스킹 boundary 가 겸하던 암묵적 deep-clone 소실
  - 위치: `codebase/backend/src/modules/execution-engine/context/execution-context.service.ts:140-149`
    (JSDoc, 이 diff 파일 4 게이트 141~148행)
  - 상세: 종전엔 `maskSensitiveFields` 가 항상 새 객체를 만들어 반환했으므로 `adapted.config`
    가 우연히 fresh 객체였다. 이제 어댑터가 마스킹을 하지 않으므로 핸들러가 반환한 원본
    객체가 그대로 장수명 캐시(`ExecutionContextService`)에 들어간다 — 핸들러가 반환 후 자신의
    `config` 객체를 변형하면 캐시도 함께 변형된다. 이 자체는 인젝션·인증 취약점은 아니고
    (핸들러는 1st-party 코드), `handler-output.adapter.spec.ts` 의 `toBe` 캐너리로 이미
    참조-전달을 고정해 회귀를 잡도록 해 뒀다. 보안 관점보다는 데이터 무결성/side-effect
    관점 이슈에 가까워 documentation/side_effect 리뷰 소관으로 남긴다.
  - 제안: 없음(이미 캐너리로 고정됨).

## 요약

이 PR 의 핵심 보안 변경(노드 `config` echo 마스킹을 어댑터 boundary → REST/WS egress 전용으로
이동)은 세 차례의 선행 라운드가 발견한 CRITICAL 1건(포함관계 캐너리가 실제로는
`DEFAULT_SENSITIVE_KEYS` 에서 파생되지 않던 결함)과 WARNING 다수(spec 미러 스윕 불완전·vacuous
타입 단언)를 거쳐 현재 시점에는 모두 실제로 해소돼 있음을 직접 소스 대조와 정규식 수기
검증으로 재확인했다. `DEFAULT_SENSITIVE_KEYS` 의 22개 키가 egress `CREDENTIAL_KEY_PATTERN` 에
전부 포함되고, REST(`redactStoredDataForResponse`)·WS(`maskWireEnvelope`) 두 출구가 모두 그
공유 정규식을 사용하며, WS 로컬 좁은 사본은 config echo 경로와 무관함을 확인했다. 남는 리스크
(DB 저장값이 이제 원문이라는 점, 크로스-노드 자격증명 릴레이, safe-by-convention 전환)는 전부
spec R-5 정정 블록과 트래커에 이미 명시적으로 문서화·등재된 **의도된 트레이드오프**이며, 이번
diff 가 새로 만든 미문서화 결함은 발견되지 않았다. 하드코딩된 시크릿은 없고(테스트 픽스처는
전부 합성값), 인증/인가·URL·요청 검증 표면은 변경되지 않았다.

## 위험도

LOW
