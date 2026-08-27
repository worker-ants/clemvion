# 보안(Security) 코드 리뷰 — masking-residuals-0b195b (12_00_05, 3라운드 누적 diff)

## 검토 범위 및 방법

이번 diff 는 `origin/main` 대비 누적된 전체 변경(원 설계 변경 `348c2b3ca` + `10_53_52` CRITICAL
수정 `fa6e2294c` + `11_25_15` WARNING(mirror-sweep) 수정 + 그 세 라운드의 `review/**` 산출물
커밋)이다. 이미 두 차례(`10_53_52`, `11_25_15`)의 독립적인 보안 리뷰가 핵심 안전 주장(포함관계
캐너리 파생, egress 커버리지)을 실측 검증했으므로, 이번 라운드는 (a) 그 검증이 이번 diff 의
**최종 상태**에서도 여전히 성립하는지 재확인하고 (b) 직전 라운드가 지적한 WARNING(spec 미러
스윕 불완전)이 실제로 닫혔는지, (c) 새로 추가된 파일(review 산출물 19+개, spec 6개)에 신규
보안 이슈가 없는지를 확인했다.

핵심 소스 4개 파일(`mask-sensitive-fields.util.ts`/`.spec.ts`, `handler-output.adapter.ts`,
`ai-turn-executor.ts`)과 stale 인용이 지적됐던 spec 3자리(`node-output.md:256`,
`4-execution-engine.md:193`, `1-ai-agent.md:755,979`)를 `Read`/`grep` 으로 직접 열어 **커밋된
현재 상태**를 대조했다(diff 만으로 판단하지 않음).

## 발견사항

- **[INFO]** 직전 CRITICAL(포함관계 캐너리가 `DEFAULT_SENSITIVE_KEYS` 에서 실제로 파생되지
  않음)의 수정이 이번 diff 의 최종 상태에서도 유효함을 독립 재확인
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts:10`
    (`export const DEFAULT_SENSITIVE_KEYS`), `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts:139`
    (`const KEYS = [...DEFAULT_SENSITIVE_KEYS];`)
  - 상세: 현재 소스를 직접 읽어 `DEFAULT_SENSITIVE_KEYS` 의 22개 키(소문자화 후 21개,
    `apiKey`/`apikey` 중복)를 전부 손으로 `CREDENTIAL_KEY_PATTERN`
    (`/^(password|passwd|pwd|api[_-]?key|secret|[a-z0-9_-]*token|private[_-]?key|client[_-]?secret|authorization|cookie|x[_-]api[_-]?key)$/i`,
    `sanitize-error-message.ts:113`)에 대조했다 — 예외 없이 전부 매칭된다. 테스트가
    `Object.keys(maskSensitiveFields({...}))`(입력 리터럴을 그대로 반환하므로 상수와 무관했던
    초판 결함)이 아니라 `[...DEFAULT_SENSITIVE_KEYS]` 로 실제 런타임 상수를 spread 하는 것도
    확인했다. 이전 두 라운드가 각각 뮤테이션 재현(M4, `oauthCred`/`oauthCredXYZ` 추가 →
    실패 관측)으로 검증한 것과 일치하며, 이번 라운드의 코드 상태에서도 회귀가 없다.
  - 제안: 없음 (양호, 재확인 완료).

- **[INFO]** 직전 라운드(`11_25_15`)가 지적한 spec 미러 스윕 WARNING 3건(node-output.md:256 ·
  execution-engine.md:193 · ai-agent.md:755,979 의 논리 오류)이 이번 diff 에서 모두 올바르게
  닫혔음을 확인
  - 위치: `spec/conventions/node-output.md:256`, `spec/5-system/4-execution-engine.md:193`,
    `spec/4-nodes/3-ai/1-ai-agent.md:755`, `:979`
  - 상세: 네 자리 전부 `~~maskSensitiveFields boundary~~ **allow-list 로 애초에 배제** — 그
    boundary 는 2026-08-24 에 제거됐고, 이 배제는 그것과 무관하다`로 통일되게 정정돼 있다.
    `11_25_15` 라운드가 지적한 논리적 자기모순(부재를 "egress 마스킹" 에 귀속시키는 문장)은
    더 이상 없다. `1-ai-agent.md:1114` 부근의 `requestPayload` 항목은 (allow-list 배제가 아니라
    실제 egress 마스킹 대상이므로) 별개로 "egress(REST/WS)에서 자동 마스킹" 으로 정확히 남아
    있어 형제 서술과도 일관된다. 보안 근거 문서(R-5, EIA §R17)가 실제 메커니즘과 어긋난 채
    남는 위험은 이번 상태 기준으로 해소됐다.
  - 제안: 없음 (양호, 재확인 완료).

- **[WARNING]** (기지 사안, 재확인) config echo 안전성이 "safe-by-construction" 에서
  "safe-by-convention" 으로 구조적으로 이동 — 표현식을 통한 크로스-노드 자격증명 릴레이가
  egress 초크포인트를 지나지 않는다
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:53`
    (`config: r.config ?? {}`), `spec/2-navigation/14-execution-history.md` R-5 정정 블록
    (게이트 469-484)
  - 상세: 이 변경 이후 `config` 는 DB 에 원문 저장되고 표현식(`$node["X"].config.<field>`)도
    원문을 읽는다. "실행 이력을 읽는" 모든 경로(REST/WS)는 egress 마스킹을 거치므로 그 축은
    안전함을 재확인했다. 다만 "워크플로 편집 권한자가 한 노드의 `config.apiKey` 를 다른 노드
    body 에 실어 제3자 엔드포인트로 전송" 하는 경로는 egress 를 아예 지나지 않아 원리적으로
    막을 수 없다 — 이는 마스킹 boundary 제거로 새로 생긴 실제 트레이드오프이지 오탐이 아니다.
    다만 R-5 정정 블록과 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에
    "워크스페이스 경계는 넘지 않는다"·"근본 처방은 자격증명 참조 간접화"로 이미 명시 등재돼
    있고, 두 차례 리뷰가 동일하게 비차단으로 판정했다. 이번 라운드도 신규 미문서화 결함은
    아니라고 판단한다.
  - 제안: 이미 등재된 백로그(자격증명 참조 간접화, 예: `llmConfigId` 패턴을 HTTP Request/Send
    Email 등에 확산 — "평문 자격증명을 담는 노드 타입이 몇 개인가" 실측이 다음 단계로 지정됨)의
    우선순위를 유지. 이 PR 자체를 차단할 사유는 아니다.

- **[INFO]** (기지 사안, 재확인) WS 전용 로컬 `CREDENTIAL_KEY_PATTERN` 사본이 공유본보다 좁음
  (`x-api-key` 미포함) — config echo 경로는 영향 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:78-79` vs
    `codebase/backend/src/shared/utils/sanitize-error-message.ts:112-113`
  - 상세: `maskWireEnvelope` 은 이 로컬 정규식이 아니라 공유 `deepRedactSecretsPreserving` 을
    호출하므로 이 PR 이 다루는 config echo 경로는 영향받지 않는다. 로컬본은
    `sanitizePayloadForWs(ctx.chatChannel)` 라우팅 컨텍스트 전용이며, 이미
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(2026-08-24 등재, 미판정)에
    별건으로 추적 중이다.
  - 제안: 이 PR 범위 아님. 통합 시 반드시 넓은 쪽(REST)으로 합칠 것 — 좁은 쪽으로 합치면 REST
    가 후퇴한다(이미 트래커에 명시됨).

- **[INFO]** 빈 문자열(`''`) 자격증명 값은 두 마스커 모두 통과시킨다 — 이 PR 로 실제 동작이
  바뀐 지점이나 값 자체가 비어 있어 실질 유출은 없음
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts` (`[대조군] 빈
    문자열 자격증명은 원문으로 통과한다` 블록), `sanitize-error-message.ts` 의
    `deepRedactObject`(`v !== null && v !== undefined && v !== ''` 가드)
  - 상세: 어댑터 마스킹이 있을 때는 빈 문자열도 `'****'` 형태로 눌렸으나, 이제 egress 까지 원문
    그대로 통과한다. 값이 비어 있어 실질 자격증명 유출은 없고, 이 PR 이 신설한 대조군 테스트가
    그 사각을 우연이 아니라 의도로 명시적으로 고정했다.
  - 제안: 없음(의도적으로 문서화된 사각, 실질 위험 없음).

- **[INFO]** 하드코딩된 시크릿 없음 — 테스트 픽스처는 전부 합성 placeholder
  - 위치: `handler-output.adapter.spec.ts`(`'sk-secret-1234567890'` 등), `mask-sensitive-fields.util.spec.ts`(`'SUPER-SECRET-VALUE-0123456789'`)
  - 상세: 실제 API 키/토큰 패턴처럼 보이지만 전부 테스트 전용 합성값이며 실제 자격증명이 아니다.
  - 제안: 없음.

- **[INFO]** `review/**` 신규 산출물(19개 이상 파일)은 과거 리뷰 라운드의 읽기 전용 기록물이며
  자체적으로 신규 보안 이슈를 만들지 않음
  - 위치: `review/code/2026/08/27/{10_53_52,11_25_15}/**`, `review/consistency/2026/08/24/19_26_06/**`
  - 상세: 코드/스키마 변경이 아니라 이전 리뷰의 진단·근거를 기록한 markdown/json 이며, 시크릿·
    인증 정보가 포함되지 않았다(코드 인용은 전부 함수명/변수명/합성 테스트값).
  - 제안: 없음.

## 점검 관점별 요약

1. **인젝션(SQL/XSS/커맨드/경로탐색)**: 해당 diff 범위 내 신규 인젝션 벡터 없음.
2. **하드코딩된 시크릿**: 없음(테스트 픽스처는 합성값).
3. **인증/인가**: 변경 없음 — REST/WS 인가 게이트·롤 게이팅은 그대로. 이 PR 은 응답 데이터의
   **마스킹 시점**(storage-time → egress-time)만 이동한다.
4. **입력 검증**: 해당 없음(신규 사용자 입력 경로 없음).
5. **OWASP A02(암호화 실패/민감정보 노출)**: 핵심 트레이드오프 — `config` 의 DB 저장이
   마스킹값→원문으로 바뀌고 표현식이 원문을 읽는다. egress(REST/WS) 마스킹은 정본 구현 기반
   테스트·직접 코드 추적으로 재검증했고 성립을 확인했다. 남은 구조적 리스크(크로스-노드
   릴레이·safe-by-convention)는 spec·plan 에 이미 명시 등재됨.
6. **암호화**: 해당 없음(마스킹 알고리즘 자체 불변, 위치만 이동).
7. **에러 처리**: 해당 없음(`error` 컬럼 마스킹 경로는 이 PR 대상 아님, 기존 그대로).
8. **의존성 보안**: 신규 의존성 없음.

## 요약

이번 라운드는 이전 두 차례(`10_53_52`, `11_25_15`)의 보안 리뷰가 각각 지적한 CRITICAL(포함관계
캐너리 미파생)과 WARNING(spec 미러 스윕 불완전 — `node-output.md:256`·
`4-execution-engine.md:193`·`1-ai-agent.md` 논리 오류)이 이번 diff 의 최종 커밋 상태에서 모두
실제로 해소됐음을 직접 소스를 열어 독립 재확인했다. `DEFAULT_SENSITIVE_KEYS` 22개 키 전부가
`CREDENTIAL_KEY_PATTERN` 에 매칭됨을 손으로 재검증했고, 세 spec 자리의 정정문도 논리적으로
일관됨을 확인했다. 남아 있는 것은 이미 두 라운드가 동일하게 판정한 기지(旣知) 트레이드오프
(safe-by-convention 전환에 따른 크로스-노드 자격증명 릴레이, WS 로컬 정규식 비대칭, 빈 문자열
값 사각)뿐이며, 전부 spec R-5 정정 블록·plan 백로그에 이미 명시 등재돼 이 PR 을 차단할 신규
미문서화 보안 결함은 발견되지 않았다. 하드코딩된 시크릿·인젝션·인증/인가 회귀도 없다.

## 위험도

LOW
